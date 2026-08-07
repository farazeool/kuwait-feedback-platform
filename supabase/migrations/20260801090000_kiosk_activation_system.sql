-- Kiosk Activation System
-- Adds device activation workflow with one-time codes and secure credential binding

-- Ensure pgcrypto extension is available for gen_random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================
-- 1. ADD NEW STATUS AND FIELDS
-- =====================================================

-- Add 'pending_activation' to kiosk_status enum
ALTER TYPE public.kiosk_status ADD VALUE IF NOT EXISTS 'pending_activation' BEFORE 'active';

-- Add activation and credential fields
ALTER TABLE public.kiosk_devices
  ADD COLUMN IF NOT EXISTS activation_code_hash text,
  ADD COLUMN IF NOT EXISTS activation_code_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS activation_code_consumed_at timestamptz,
  ADD COLUMN IF NOT EXISTS device_credential_hash text,
  ADD COLUMN IF NOT EXISTS credential_issued_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_revoked_at timestamptz,
  ADD COLUMN IF NOT EXISTS activated_at timestamptz,
  ADD COLUMN IF NOT EXISTS config_version integer DEFAULT 1;

-- Remove 'offline' from enum values used for new devices
-- We derive offline from last_seen_at instead of storing it
-- Note: Existing 'offline' records will keep that status until updated

-- Create index for activation code lookups (on hash, not plaintext)
CREATE INDEX IF NOT EXISTS kiosk_devices_activation_code_hash_idx 
  ON public.kiosk_devices (activation_code_hash) 
  WHERE activation_code_hash IS NOT NULL;

-- Create index for credential hash lookups
CREATE INDEX IF NOT EXISTS kiosk_devices_device_credential_hash_idx 
  ON public.kiosk_devices (device_credential_hash) 
  WHERE device_credential_hash IS NOT NULL;

-- =====================================================
-- 2. HELPER FUNCTION: Generate activation code
-- =====================================================

-- Generate a 6-character alphanumeric activation code
-- Returns both the plaintext code (to show once) and its hash
CREATE OR REPLACE FUNCTION public.generate_activation_code()
RETURNS TABLE (code text, code_hash text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_hash text;
BEGIN
  -- Generate 6-character uppercase alphanumeric code
  -- Using encode with 'hex' gives us 0-9 and a-f, we uppercase for clarity
  -- Use extensions schema prefix since search_path is restricted
  v_code := upper(substring(encode(extensions.gen_random_bytes(4), 'hex') from 1 for 6));
  
  -- Hash the code using SHA-256
  v_hash := encode(sha256(v_code::bytea), 'hex');
  
  RETURN QUERY SELECT v_code, v_hash;
END;
$$;

-- =====================================================
-- 3. HELPER FUNCTION: Hash credential
-- =====================================================

CREATE OR REPLACE FUNCTION public.hash_credential(p_credential text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
IMMUTABLE
AS $$
BEGIN
  RETURN encode(sha256(p_credential::bytea), 'hex');
END;
$$;

-- =====================================================
-- 4. UPDATE create_kiosk_device TO USE pending_activation
-- =====================================================

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

  -- Create the kiosk device with pending_activation status
  -- access_token is set to a placeholder; real credential issued on activation
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
    'pending_activation'  -- Placeholder; replaced on activation
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

-- =====================================================
-- 5. FUNCTION: Get activation details (for admin UI)
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_kiosk_activation_details(
  p_device_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  id uuid,
  device_name text,
  status public.kiosk_status,
  activation_code text,
  activation_code_expires_at timestamptz,
  activation_code_consumed_at timestamptz,
  activated_at timestamptz,
  is_activated boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activation_code text;
  v_stored_hash text;
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
    RAISE EXCEPTION 'Not authorized to view activation details';
  END IF;

  -- Get device and generate fresh code to display
  -- Note: We cannot recover the original code from the hash
  -- So we need to regenerate if the admin needs to see it again
  
  RETURN QUERY
  SELECT 
    kd.id,
    kd.device_name,
    kd.status,
    NULL::text as activation_code,  -- Code is not stored, only hash
    kd.activation_code_expires_at,
    kd.activation_code_consumed_at,
    kd.activated_at,
    (kd.activated_at IS NOT NULL) as is_activated
  FROM public.kiosk_devices kd
  WHERE kd.id = p_device_id
    AND kd.organization_id = p_organization_id;
END;
$$;

-- =====================================================
-- 6. FUNCTION: Regenerate activation code
-- =====================================================

CREATE OR REPLACE FUNCTION public.regenerate_activation_code(
  p_device_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  activation_code text,
  activation_code_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_current_status public.kiosk_status;
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
    RAISE EXCEPTION 'Not authorized to regenerate activation code';
  END IF;

  -- Get current status
  SELECT status INTO v_current_status
  FROM public.kiosk_devices
  WHERE id = p_device_id AND organization_id = p_organization_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  -- Only allow regeneration for pending_activation or if code expired
  IF v_current_status NOT IN ('pending_activation', 'paused', 'maintenance') THEN
    RAISE EXCEPTION 'Cannot regenerate activation code for device with status: %', v_current_status;
  END IF;

  -- Generate new activation code
  SELECT code, code_hash INTO v_code, v_hash
  FROM public.generate_activation_code();

  -- Update device with new code
  UPDATE public.kiosk_devices
  SET 
    activation_code_hash = v_hash,
    activation_code_expires_at = timezone('utc', now()) + interval '24 hours',
    activation_code_consumed_at = NULL
  WHERE id = p_device_id AND organization_id = p_organization_id;

  -- Return the plaintext code (only time it's visible)
  RETURN QUERY SELECT 
    v_code as activation_code,
    (timezone('utc', now()) + interval '24 hours') as activation_code_expires_at;
END;
$$;

-- =====================================================
-- 7. FUNCTION: Activate kiosk device (public, uses code)
-- =====================================================

CREATE OR REPLACE FUNCTION public.activate_kiosk_device(
  p_activation_code text,
  p_device_model text DEFAULT null,
  p_os_version text DEFAULT null,
  p_app_version text DEFAULT null
)
RETURNS TABLE (
  success boolean,
  device_credential text,
  device_id uuid,
  organization_id uuid,
  survey_public_slug text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_hash text;
  v_device record;
  v_credential text;
  v_credential_hash text;
BEGIN
  -- Hash the provided code
  v_code_hash := public.hash_credential(p_activation_code);

  -- Find device by activation code hash
  SELECT 
    kd.id, kd.organization_id, kd.status, kd.survey_id, kd.activation_code_expires_at, 
    kd.activation_code_consumed_at, kd.device_name
  INTO v_device
  FROM public.kiosk_devices kd
  WHERE kd.activation_code_hash = v_code_hash;

  -- Device not found or wrong code
  IF v_device IS NULL THEN
    -- Use generic error to not leak information
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check if code already consumed
  IF v_device.activation_code_consumed_at IS NOT NULL THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check if code expired
  IF v_device.activation_code_expires_at < timezone('utc', now()) THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Check if device is in a valid state for activation
  IF v_device.status NOT IN ('pending_activation', 'paused', 'maintenance') THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Generate device credential (256-bit, hex-encoded)
  -- Use extensions schema prefix since search_path is restricted
  v_credential := encode(extensions.gen_random_bytes(32), 'hex');
  v_credential_hash := public.hash_credential(v_credential);

  -- Atomically consume code and issue credential
  UPDATE public.kiosk_devices
  SET 
    status = 'active'::public.kiosk_status,
    activation_code_consumed_at = timezone('utc', now()),
    activated_at = coalesce(activated_at, timezone('utc', now())),
    device_credential_hash = v_credential_hash,
    credential_issued_at = timezone('utc', now()),
    credential_revoked_at = NULL,
    access_token = v_credential,  -- For backwards compat with existing code
    last_seen_at = timezone('utc', now()),
    device_model = coalesce(p_device_model, device_model),
    os_version = coalesce(p_os_version, os_version),
    app_version = coalesce(p_app_version, app_version),
    config_version = config_version + 1
  WHERE id = v_device.id
    AND activation_code_consumed_at IS NULL;  -- Concurrent safety

  -- Check if update succeeded (handles race condition)
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::text, NULL::uuid, NULL::uuid, NULL::text;
    RETURN;
  END IF;

  -- Log activation in config history
  INSERT INTO public.kiosk_config_history (
    kiosk_device_id,
    organization_id,
    previous_status,
    new_status,
    changed_by,
    change_reason
  )
  VALUES (
    v_device.id,
    v_device.organization_id,
    v_device.status,
    'active'::public.kiosk_status,
    NULL,  -- No user context for public activation
    'Device activated via activation code'
  );

  -- Get survey slug if assigned
  RETURN QUERY
  SELECT 
    true as success,
    v_credential as device_credential,
    v_device.id as device_id,
    v_device.organization_id,
    s.public_slug as survey_public_slug
  FROM public.surveys s
  WHERE s.id = v_device.survey_id
    AND s.organization_id = v_device.organization_id
    AND s.status = 'active';
  
  -- If no survey, return without slug
  IF NOT FOUND THEN
    RETURN QUERY SELECT true, v_credential, v_device.id, v_device.organization_id, NULL::text;
  END IF;
END;
$$;

-- =====================================================
-- 8. UPDATE get_kiosk_config TO USE CREDENTIAL HASH
-- =====================================================

-- Drop first since return type changed
DROP FUNCTION IF EXISTS public.get_kiosk_config(text);

CREATE OR REPLACE FUNCTION public.get_kiosk_config(
  p_access_token text
)
RETURNS TABLE (
  device_id uuid,
  device_name text,
  survey_public_slug text,
  status public.kiosk_status,
  default_language text,
  branding jsonb,
  idle_timeout_seconds integer,
  last_config_change timestamptz,
  config_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_device_id uuid;
  v_status public.kiosk_status;
  v_credential_hash text;
BEGIN
  -- Hash the provided credential
  v_credential_hash := public.hash_credential(p_access_token);

  -- Resolve device by credential hash
  SELECT kd.id, kd.status INTO v_device_id, v_status
  FROM public.kiosk_devices kd
  WHERE kd.device_credential_hash = v_credential_hash
     OR kd.access_token = p_access_token;  -- Backwards compat

  -- Device not found or archived
  IF v_device_id IS NULL OR v_status = 'archived' THEN
    RAISE EXCEPTION 'Invalid device credential' USING errcode = 'insufficient_privilege';
  END IF;

  -- Revoked credential is rejected
  IF v_status = 'revoked' THEN
    RAISE EXCEPTION 'Device credential revoked' USING errcode = 'insufficient_privilege';
  END IF;

  -- Update last_seen_at for all non-revoked, non-archived devices
  IF v_status NOT IN ('revoked', 'archived') THEN
    UPDATE public.kiosk_devices
    SET last_seen_at = timezone('utc', now())
    WHERE id = v_device_id;
  END IF;

  -- Return configuration
  RETURN QUERY
  SELECT
    kd.id as device_id,
    kd.device_name,
    CASE WHEN kd.status = 'active' THEN s.public_slug ELSE NULL END as survey_public_slug,
    kd.status,
    kd.default_language,
    kd.branding,
    kd.idle_timeout_seconds,
    greatest(
      coalesce(
        (SELECT max(changed_at) FROM public.kiosk_config_history WHERE kiosk_device_id = kd.id),
        kd.updated_at
      ),
      kd.updated_at
    ) as last_config_change,
    kd.config_version
  FROM public.kiosk_devices kd
  LEFT JOIN public.surveys s
    ON s.id = kd.survey_id
    AND s.organization_id = kd.organization_id
    AND s.status = 'active'
  WHERE kd.id = v_device_id;
END;
$$;

-- =====================================================
-- 9. UPDATE update_kiosk_heartbeat TO USE CREDENTIAL HASH
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_kiosk_heartbeat(
  p_access_token text,
  p_device_model text DEFAULT null,
  p_os_version text DEFAULT null,
  p_app_version text DEFAULT null
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer;
  v_credential_hash text;
BEGIN
  -- Hash the provided credential
  v_credential_hash := public.hash_credential(p_access_token);

  -- Update device if found and in valid state
  UPDATE public.kiosk_devices
  SET
    last_seen_at = timezone('utc', now()),
    device_model = coalesce(p_device_model, device_model),
    os_version = coalesce(p_os_version, os_version),
    app_version = coalesce(p_app_version, app_version)
  WHERE (device_credential_hash = v_credential_hash OR access_token = p_access_token)
    AND status NOT IN ('archived', 'revoked');

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- =====================================================
-- 10. UPDATE resolve_kiosk_attribution TO USE CREDENTIAL HASH
-- =====================================================

-- Drop first since we're changing the function logic significantly
DROP FUNCTION IF EXISTS public.resolve_kiosk_attribution(text);

CREATE OR REPLACE FUNCTION public.resolve_kiosk_attribution(
  p_access_token text
)
RETURNS TABLE (
  device_id uuid,
  organization_id uuid,
  location_id uuid,
  survey_id uuid,
  channel public.kiosk_channel,
  status public.kiosk_status
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_credential_hash text;
BEGIN
  v_credential_hash := public.hash_credential(p_access_token);
  
  RETURN QUERY
  SELECT
    d.id,
    d.organization_id,
    d.location_id,
    d.survey_id,
    d.channel,
    d.status
  FROM public.kiosk_devices d
  WHERE (d.device_credential_hash = v_credential_hash OR d.access_token = p_access_token)
    AND d.status NOT IN ('archived', 'revoked');
END;
$$;

-- =====================================================
-- 11. FUNCTION: Revoke device credential
-- =====================================================

CREATE OR REPLACE FUNCTION public.revoke_kiosk_credential(
  p_device_id uuid,
  p_organization_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_status public.kiosk_status;
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
    RAISE EXCEPTION 'Not authorized to revoke device credential';
  END IF;

  -- Get current status
  SELECT status INTO v_old_status
  FROM public.kiosk_devices
  WHERE id = p_device_id AND organization_id = p_organization_id;

  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  -- Revoke credential and update status
  UPDATE public.kiosk_devices
  SET 
    status = 'revoked'::public.kiosk_status,
    credential_revoked_at = timezone('utc', now())
  WHERE id = p_device_id AND organization_id = p_organization_id;

  -- Log in config history
  INSERT INTO public.kiosk_config_history (
    kiosk_device_id,
    organization_id,
    previous_status,
    new_status,
    changed_by,
    change_reason
  )
  VALUES (
    p_device_id,
    p_organization_id,
    v_old_status,
    'revoked'::public.kiosk_status,
    auth.uid(),
    'Device credential revoked'
  );

  RETURN true;
END;
$$;

-- =====================================================
-- 12. FUNCTION: Re-enroll revoked device
-- =====================================================

CREATE OR REPLACE FUNCTION public.reenroll_kiosk_device(
  p_device_id uuid,
  p_organization_id uuid
)
RETURNS TABLE (
  activation_code text,
  activation_code_expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_hash text;
  v_current_status public.kiosk_status;
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
    RAISE EXCEPTION 'Not authorized to re-enroll device';
  END IF;

  -- Get current status
  SELECT status INTO v_current_status
  FROM public.kiosk_devices
  WHERE id = p_device_id AND organization_id = p_organization_id;

  IF v_current_status IS NULL THEN
    RAISE EXCEPTION 'Device not found';
  END IF;

  -- Only allow re-enrollment for revoked devices
  IF v_current_status != 'revoked' THEN
    RAISE EXCEPTION 'Can only re-enroll revoked devices';
  END IF;

  -- Generate new activation code
  SELECT code, code_hash INTO v_code, v_hash
  FROM public.generate_activation_code();

  -- Update device to pending_activation with new code
  UPDATE public.kiosk_devices
  SET 
    status = 'pending_activation'::public.kiosk_status,
    activation_code_hash = v_hash,
    activation_code_expires_at = timezone('utc', now()) + interval '24 hours',
    activation_code_consumed_at = NULL,
    device_credential_hash = NULL,
    credential_issued_at = NULL,
    credential_revoked_at = NULL
  WHERE id = p_device_id AND organization_id = p_organization_id;

  -- Log in config history
  INSERT INTO public.kiosk_config_history (
    kiosk_device_id,
    organization_id,
    previous_status,
    new_status,
    changed_by,
    change_reason
  )
  VALUES (
    p_device_id,
    p_organization_id,
    v_current_status,
    'pending_activation'::public.kiosk_status,
    auth.uid(),
    'Device re-enrollment initiated'
  );

  RETURN QUERY SELECT 
    v_code as activation_code,
    (timezone('utc', now()) + interval '24 hours') as activation_code_expires_at;
END;
$$;

-- =====================================================
-- 13. FUNCTION: Check if device is online (derived)
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_kiosk_online(
  p_last_seen_at timestamptz,
  p_threshold_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 
    p_last_seen_at IS NOT NULL 
    AND (timezone('utc', now()) - p_last_seen_at) < (p_threshold_seconds || ' seconds')::interval;
$$;

-- =====================================================
-- 14. UPDATE list_kiosk_devices to include online status
-- =====================================================

-- Drop first since return type changed
DROP FUNCTION IF EXISTS public.list_kiosk_devices(uuid, uuid, public.kiosk_status);

CREATE OR REPLACE FUNCTION public.list_kiosk_devices(
  p_organization_id uuid,
  p_location_id uuid DEFAULT null,
  p_status public.kiosk_status DEFAULT null
)
RETURNS TABLE (
  id uuid,
  organization_id uuid,
  location_id uuid,
  location_name_en text,
  location_name_ar text,
  device_name text,
  device_identifier text,
  survey_id uuid,
  survey_title_en text,
  survey_title_ar text,
  channel public.kiosk_channel,
  status public.kiosk_status,
  notes text,
  default_language text,
  branding jsonb,
  idle_timeout_seconds integer,
  last_seen_at timestamptz,
  last_response_at timestamptz,
  total_responses integer,
  device_model text,
  os_version text,
  app_version text,
  created_at timestamptz,
  updated_at timestamptz,
  activated_at timestamptz,
  is_online boolean,
  config_version integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check authorization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = auth.uid()
    AND om.organization_id = p_organization_id
    AND om.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
    AND p.platform_role = 'platform_admin'
    AND p.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to view kiosk devices for this organization';
  END IF;

  RETURN QUERY
  SELECT
    kd.id,
    kd.organization_id,
    kd.location_id,
    l.name_en as location_name_en,
    l.name_ar as location_name_ar,
    kd.device_name,
    kd.device_identifier,
    kd.survey_id,
    s.title_en as survey_title_en,
    s.title_ar as survey_title_ar,
    kd.channel,
    kd.status,
    kd.notes,
    kd.default_language,
    kd.branding,
    kd.idle_timeout_seconds,
    kd.last_seen_at,
    kd.last_response_at,
    kd.total_responses,
    kd.device_model,
    kd.os_version,
    kd.app_version,
    kd.created_at,
    kd.updated_at,
    kd.activated_at,
    public.is_kiosk_online(kd.last_seen_at) as is_online,
    kd.config_version
  FROM public.kiosk_devices kd
  JOIN public.locations l
    ON l.id = kd.location_id
    AND l.organization_id = kd.organization_id
  LEFT JOIN public.surveys s
    ON s.id = kd.survey_id
    AND s.organization_id = kd.organization_id
  WHERE kd.organization_id = p_organization_id
    AND (p_location_id IS NULL OR kd.location_id = p_location_id)
    AND (p_status IS NULL OR kd.status = p_status)
  ORDER BY kd.created_at DESC;
END;
$$;

-- =====================================================
-- 15. GRANTS
-- =====================================================

GRANT EXECUTE ON FUNCTION public.generate_activation_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hash_credential(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_kiosk_activation_details(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_activation_code(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.activate_kiosk_device(text, text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_kiosk_credential(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reenroll_kiosk_device(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_kiosk_online(timestamptz, integer) TO anon, authenticated;