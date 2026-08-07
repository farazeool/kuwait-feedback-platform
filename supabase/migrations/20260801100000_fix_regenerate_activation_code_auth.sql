-- Fix regenerate_activation_code to accept user_id parameter
-- This allows the API route to pass the authenticated user's ID
-- while maintaining proper authorization checks

CREATE OR REPLACE FUNCTION public.regenerate_activation_code(
  p_device_id uuid,
  p_organization_id uuid,
  p_user_id uuid DEFAULT auth.uid()
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
  -- Check authorization using provided user_id (defaults to auth.uid() for direct calls)
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = p_user_id
    AND om.organization_id = p_organization_id
    AND om.role IN ('organization_owner', 'organization_admin')
    AND om.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = p_user_id
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.regenerate_activation_code(uuid, uuid, uuid) TO authenticated;