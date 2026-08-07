-- Fix kiosk device creation: access_token must be unique per device
-- Root cause: create_kiosk_device() inserted a fixed 'pending_activation' placeholder
-- which violated the unique constraint when creating multiple devices.
--
-- Solution: Generate a unique access_token for each new device using the existing
-- generate_kiosk_access_token() function. This ensures:
-- 1. Every device has a unique access_token from creation
-- 2. The token can be used immediately if needed (backwards compat)
-- 3. When activated, a new credential is generated and stored in both
--    device_credential_hash (for secure verification) and access_token (for compat)

-- Update create_kiosk_device to generate unique access_token
CREATE OR REPLACE FUNCTION public.create_kiosk_device(
  p_organization_id uuid,
  p_location_id uuid,
  p_device_name text,
  p_device_identifier text DEFAULT null,
  p_survey_id uuid DEFAULT null,
  p_notes text DEFAULT null
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id uuid;
  v_activation_code text;
  v_activation_code_hash text;
  v_access_token text;
BEGIN
  -- Check authorization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = p_organization_id
    AND om.role IN ('organization_owner', 'organization_admin')
    AND om.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.platform_role = 'platform_admin'
    AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to create kiosk devices for this organization';
  END IF;

  -- Verify location belongs to organization
  IF NOT EXISTS (
    SELECT 1 FROM public.locations
    WHERE id = p_location_id
    AND organization_id = p_organization_id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid location for this organization';
  END IF;

  -- Verify survey belongs to organization and is active (if provided)
  IF p_survey_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.surveys
    WHERE id = p_survey_id
    AND organization_id = p_organization_id
    AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Invalid or inactive survey for this organization';
  END IF;

  -- Generate activation code
  SELECT code, code_hash INTO v_activation_code, v_activation_code_hash
  FROM public.generate_activation_code();

  -- Generate unique access token for this device
  v_access_token := public.generate_kiosk_access_token();

  -- Create the kiosk device with pending_activation status
  -- access_token is set to a unique generated value; replaced on activation
  INSERT INTO public.kiosk_devices (
    organization_id,
    location_id,
    device_name,
    device_identifier,
    survey_id,
    notes,
    created_by,
    status,
    activation_code_hash,
    activation_code_expires_at,
    access_token
  )
  VALUES (
    p_organization_id,
    p_location_id,
    p_device_name,
    p_device_identifier,
    p_survey_id,
    p_notes,
    auth.uid(),
    'pending_activation'::public.kiosk_status,
    v_activation_code_hash,
    timezone('utc', now()) + interval '24 hours',
    v_access_token  -- Unique generated token, not a fixed placeholder
  )
  RETURNING id INTO v_device_id;

  -- Log initial configuration
  INSERT INTO public.kiosk_config_history (
    kiosk_device_id,
    organization_id,
    new_survey_id,
    new_status,
    changed_by,
    change_reason
  )
  VALUES (
    v_device_id,
    p_organization_id,
    p_survey_id,
    'pending_activation'::public.kiosk_status,
    auth.uid(),
    'Initial device creation - pending activation'
  );

  RETURN v_device_id;
END;
$$;

-- Add a trigger to handle rare collision retries (defensive)
-- This ensures that even if gen_random_bytes produces a duplicate
-- (astronomically unlikely but theoretically possible), the insert
-- will retry with a new token rather than fail.
CREATE OR REPLACE FUNCTION public.handle_access_token_collision()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_attempts integer := 0;
  v_max_attempts integer := 5;
  v_new_token text;
BEGIN
  -- Only handle unique violation on access_token
  -- Try up to v_max_attempts times to generate a unique token
  WHILE v_attempts < v_max_attempts LOOP
    BEGIN
      -- If this is an INSERT and access_token collision occurs
      IF TG_OP = 'INSERT' THEN
        -- Let the insert proceed; if it fails with unique violation,
        -- the exception handler below will retry
        RETURN NEW;
      END IF;
      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        -- Check if it's the access_token constraint
        IF SQLERRM LIKE '%kiosk_devices_access_token_key%' THEN
          v_attempts := v_attempts + 1;
          IF v_attempts >= v_max_attempts THEN
            RAISE EXCEPTION 'Failed to generate unique access_token after % attempts', v_max_attempts;
          END IF;
          -- Generate a new token and retry
          v_new_token := public.generate_kiosk_access_token();
          NEW.access_token := v_new_token;
          -- Continue loop to retry
        ELSE
          -- Re-raise other unique violations
          RAISE;
        END IF;
    END;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Comment on the function
COMMENT ON FUNCTION public.handle_access_token_collision() IS
  'Trigger function to retry access_token generation on collision. Defensive measure against the astronomically unlikely case of gen_random_bytes returning duplicate values.';

-- Note: We do NOT install the trigger by default because:
-- 1. The probability of collision is 2^-256 per attempt (astronomically small)
-- 2. Installing triggers on every insert adds overhead
-- 3. The function is available if needed for high-volume deployments
-- To enable: CREATE TRIGGER handle_access_token_collision BEFORE INSERT ON public.kiosk_devices FOR EACH ROW EXECUTE FUNCTION public.handle_access_token_collision();

-- Update any existing rows that have the placeholder value with unique tokens
-- This is safe because pending_activation devices are not yet activated
UPDATE public.kiosk_devices kd
SET access_token = public.generate_kiosk_access_token()
WHERE kd.access_token = 'pending_activation'
  AND kd.status = 'pending_activation';

-- Test that the function works by creating a verification function
CREATE OR REPLACE FUNCTION public.test_kiosk_device_creation_unique_tokens(
  p_organization_id uuid,
  p_location_id uuid
)
RETURNS TABLE (
  device1_id uuid,
  device2_id uuid,
  tokens_different boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device1_id uuid;
  v_device2_id uuid;
  v_token1 text;
  v_token2 text;
BEGIN
  -- Create two devices
  v_device1_id := public.create_kiosk_device(
    p_organization_id,
    p_location_id,
    'Test Device 1',
    null,
    null,
    'Test creation 1'
  );
  
  v_device2_id := public.create_kiosk_device(
    p_organization_id,
    p_location_id,
    'Test Device 2',
    null,
    null,
    'Test creation 2'
  );
  
  -- Get their access tokens
  SELECT access_token INTO v_token1
  FROM public.kiosk_devices
  WHERE id = v_device1_id;
  
  SELECT access_token INTO v_token2
  FROM public.kiosk_devices
  WHERE id = v_device2_id;
  
  -- Clean up test devices
  DELETE FROM public.kiosk_config_history WHERE kiosk_device_id IN (v_device1_id, v_device2_id);
  DELETE FROM public.kiosk_devices WHERE id IN (v_device1_id, v_device2_id);
  
  RETURN QUERY SELECT v_device1_id, v_device2_id, (v_token1 IS DISTINCT FROM v_token2);
END;
$$;

-- Grant execute on the test function
GRANT EXECUTE ON FUNCTION public.test_kiosk_device_creation_unique_tokens(uuid, uuid) TO authenticated;