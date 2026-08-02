-- Remove the production test helper function.
--
-- Context: migration 20260801120000_fix_kiosk_device_access_token_unique.sql
-- created a SECURITY DEFINER test helper
--   public.test_kiosk_device_creation_unique_tokens(uuid, uuid)
-- that creates AND deletes kiosk devices. A SECURITY DEFINER helper like this
-- must never remain callable in production, because it is not gated on real
-- authorization and performs mutating work.
--
-- This additive migration revokes execution from every role and drops the
-- function. It does not touch or alter migration 20260801120000.

-- 1. Revoke EXECUTE from PUBLIC
REVOKE EXECUTE ON FUNCTION public.test_kiosk_device_creation_unique_tokens(uuid, uuid) FROM PUBLIC;

-- 2. Revoke EXECUTE from the anonymous role
REVOKE EXECUTE ON FUNCTION public.test_kiosk_device_creation_unique_tokens(uuid, uuid) FROM anon;

-- 3. Revoke EXECUTE from the authenticated role
REVOKE EXECUTE ON FUNCTION public.test_kiosk_device_creation_unique_tokens(uuid, uuid) FROM authenticated;

-- 4. Drop the function entirely
DROP FUNCTION IF EXISTS public.test_kiosk_device_creation_unique_tokens(uuid, uuid);

-- The following production functions are intentionally left unchanged:
--   - public.create_kiosk_device
--   - public.generate_kiosk_access_token
--   - public.generate_activation_code
--   - public.regenerate_activation_code
