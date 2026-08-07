-- Restrict anon access to assert_analytics_scope (8-parameter variant).
--
-- The 8-parameter variant was created in migration 20260722160000 without
-- an explicit REVOKE, so it inherited PostgreSQL's default grant of EXECUTE
-- to PUBLIC (which includes anon and authenticated). This function is an
-- internal permission-check helper intended only for SECURITY DEFINER callers.
--
-- The 5-parameter variant already has EXECUTE revoked from anon/authenticated
-- (via 20260720100000). This makes the 8-parameter variant consistent.

-- revoke from PUBLIC (which includes anon by default) and re-grant to authenticated only
revoke execute on function public.assert_analytics_scope(
  uuid, timestamptz, timestamptz, uuid, uuid, uuid, uuid, text
) from public;
grant execute on function public.assert_analytics_scope(
  uuid, timestamptz, timestamptz, uuid, uuid, uuid, uuid, text
) to authenticated;
