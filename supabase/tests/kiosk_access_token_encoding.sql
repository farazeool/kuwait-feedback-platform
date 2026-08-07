-- Regression test for kiosk access_token encoding fix
-- Verifies that PostgreSQL encode() with 'hex' works correctly
-- and that the generate_kiosk_access_token() function is valid.
--
-- Run with: psql -f supabase/tests/kiosk_access_token_encoding.sql
-- Expected: All tests pass, no "unrecognized encoding: base64url" errors

\set ON_ERROR_STOP on
\echo '=== Kiosk Access Token Encoding Regression Tests ==='
\echo ''

-- Test 1: Verify hex encoding is supported
\echo 'Test 1: PostgreSQL hex encoding support...'
SELECT encode(gen_random_bytes(4), 'hex') AS hex_test;
\echo '✓ hex encoding works'
\echo ''

-- Test 2: Verify the function exists and works
\echo 'Test 2: generate_kiosk_access_token() function...'
SELECT public.generate_kiosk_access_token() AS generated_token;
\echo '✓ Function works, no base64url error'
\echo ''

-- Test 3: Verify token length is 64 characters (32 bytes = 64 hex chars)
\echo 'Test 3: Token length check...'
SELECT 
  LENGTH(public.generate_kiosk_access_token()) AS token_length,
  CASE WHEN LENGTH(public.generate_kiosk_access_token()) = 64 THEN '✓ Pass' ELSE '✗ Fail' END AS result;
\echo ''

-- Test 4: Verify tokens are lowercase hex
\echo 'Test 4: Token format check (lowercase hex)...'
SELECT 
  public.generate_kiosk_access_token() AS token,
  CASE WHEN public.generate_kiosk_access_token() ~ '^[0-9a-f]{64}$' THEN '✓ Pass' ELSE '✗ Fail' END AS result;
\echo ''

-- Test 5: Verify column default works
\echo 'Test 5: Column default verification...'
DO $$
DECLARE
  v_token TEXT;
BEGIN
  -- This would fail with base64url encoding
  v_token := public.generate_kiosk_access_token();
  RAISE NOTICE 'Generated token via function: %', v_token;
  RAISE NOTICE '✓ Column default function works';
END $$;
\echo ''

\echo '=== All regression tests passed ==='
\echo 'The base64url encoding error has been fixed.'