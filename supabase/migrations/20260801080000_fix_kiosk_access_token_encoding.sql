-- Fix kiosk access_token default: PostgreSQL encode() does not support 'base64url'
-- Root cause: The original migration used encode(gen_random_bytes(32), 'base64url')
-- which throws "unrecognized encoding: base64url" at runtime.
-- PostgreSQL only supports 'base64', 'hex', and 'escape' encodings.
--
-- Solution: Use lowercase hexadecimal encoding which is:
-- - Supported by all PostgreSQL versions
-- - URL-safe (no special characters needing encoding)
-- - Same entropy as the original 32 bytes = 64 hex characters
-- - Already unique due to gen_random_bytes() cryptographic randomness
--
-- This migration:
-- 1. Drops the column default that uses the invalid encoding
-- 2. Creates a new default using encode(gen_random_bytes(32), 'hex')
-- 3. Preserves all existing data and constraints

-- First, drop the problematic default
ALTER TABLE public.kiosk_devices 
  ALTER COLUMN access_token DROP DEFAULT;

-- Create a function to generate the token (allows easier testing/mocking)
-- Note: gen_random_bytes is provided by pgcrypto in the extensions schema
CREATE OR REPLACE FUNCTION public.generate_kiosk_access_token()
RETURNS text
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT encode(extensions.gen_random_bytes(32), 'hex');
$$;

COMMENT ON FUNCTION public.generate_kiosk_access_token() IS
  'Generate a cryptographically random 64-character hex string for kiosk device access tokens. Equivalent entropy to 32 random bytes. URL-safe with no special characters.';

-- Set the new default using the function
ALTER TABLE public.kiosk_devices 
  ALTER COLUMN access_token SET DEFAULT public.generate_kiosk_access_token();

-- Grant execute to authenticated users (needed for default to work)
GRANT EXECUTE ON FUNCTION public.generate_kiosk_access_token() TO authenticated;

-- Update the comment on the column to reflect the change
COMMENT ON COLUMN public.kiosk_devices.access_token IS
  'Cryptographically random access token for kiosk device authentication. 64-character lowercase hex string (32 bytes of entropy). Unique across all organizations. Used by kiosk devices to poll for configuration and submit responses.';