-- Remove obsolete regenerate_activation_code overload
--
-- Root cause: PostgREST saw two candidate functions for a two-parameter RPC call:
--   public.regenerate_activation_code(p_device_id uuid, p_organization_id uuid)
--   public.regenerate_activation_code(p_device_id uuid, p_organization_id uuid, p_user_id uuid DEFAULT auth.uid())
-- The 3-param function has a DEFAULT for p_user_id, so a 2-param PostgREST request
-- is ambiguous and PostgREST returned PGRST203 (HTTP 300).
--
-- Resolution: keep the 3-param signature (p_user_id uuid DEFAULT auth.uid()).
--   * The API route (src/app/api/admin/kiosks/[id]/activation/route.ts) calls the RPC
--     with p_device_id, p_organization_id AND p_user_id -- only the 3-param function matches.
--   * The DEFAULT keeps the 2-arg invocation form available (p_user_id falls back to
--     auth.uid()), so no two-parameter callers lose functionality.
--   * The 3-param function performs the authorization check against the supplied
--     p_user_id (falling back to auth.uid()), so it is not weaker than the removed one.
--
-- The 2-param function is removed via DROP FUNCTION IF EXISTS so this migration is
-- idempotent and also fixes databases where the overload already does not exist.
--
-- Recreate the 3-param function with an explicit EXECUTE grant for authenticated,
-- so this migration is self-contained and the grant is not lost if a future
-- migration drops/recreates the function.
--
-- Security hardening: the authorization check must always be against the
-- AUTHENTICATED caller (auth.uid()), never against a client-supplied p_user_id.
-- Before this fix, the anon role could pass an arbitrary admin's user id as
-- p_user_id and regenerate activation codes without any session.
--
-- The API route (src/app/api/admin/kiosks/[id]/activation/route.ts) calls this
-- RPC through the anon key with a user session cookie, so auth.uid() is set for
-- that call and p_user_id is redundant. p_user_id is kept as an optional
-- override that ONLY the service_role may set (e.g. server-side contexts that
-- run as service_role and therefore have no auth.uid()). A call that passes a
-- p_user_id different from the session user while NOT running as service_role is
-- rejected.
--
-- Grant EXECUTE to authenticated only (not PUBLIC), so the anon role cannot
-- invoke this RPC at all.

DROP FUNCTION IF EXISTS public.regenerate_activation_code(uuid, uuid);

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
  v_expires_at timestamptz;
  v_caller_uid uuid;
  v_effective_user_id uuid;
  v_is_service_role boolean;
BEGIN
  -- Calculate expiration time as timestamptz
  v_expires_at := now() + interval '24 hours';

  -- Identify the authenticated caller (the session user). NULL for
  -- service_role/anonymous contexts, never trusting a client-supplied p_user_id.
  v_caller_uid := auth.uid();
  v_is_service_role := (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role';

  -- Determine who to authorize as:
  --   * service_role (server-side) may act on behalf of p_user_id.
  --   * any other caller must act ONLY as themselves: p_user_id is ignored
  --     (falls back to auth.uid()), and passing a different user id is rejected.
  IF v_is_service_role THEN
    v_effective_user_id := p_user_id;
  ELSE
    v_effective_user_id := v_caller_uid;
    IF p_user_id IS DISTINCT FROM v_caller_uid THEN
      RAISE EXCEPTION 'Not authorized to regenerate activation code on behalf of another user';
    END IF;
  END IF;

  IF v_effective_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized to regenerate activation code';
  END IF;

  -- Check authorization for the effective user
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.user_id = v_effective_user_id
    AND om.organization_id = p_organization_id
    AND om.role IN ('organization_owner', 'organization_admin')
    AND om.status = 'active'
  ) AND NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = v_effective_user_id
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

  -- Only allow regeneration for pending_activation, paused, or maintenance
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
    activation_code_expires_at = v_expires_at,
    activation_code_consumed_at = NULL
  WHERE id = p_device_id AND organization_id = p_organization_id;

  -- Return the plaintext code (only time it's visible)
  RETURN QUERY SELECT 
    v_code as activation_code,
    v_expires_at as activation_code_expires_at;
END;
$$;

-- Grant execute to authenticated users only (not PUBLIC, so anon cannot invoke)
GRANT EXECUTE ON FUNCTION public.regenerate_activation_code(uuid, uuid, uuid) TO authenticated;

-- Remove the PUBLIC execute grant (was present on the old overloads) so the
-- anon role cannot call this RPC at all.
REVOKE EXECUTE ON FUNCTION public.regenerate_activation_code(uuid, uuid, uuid) FROM PUBLIC;

