-- Remove the 9-parameter overload of get_analytics_overview to resolve
-- PostgREST PGRST203 ambiguity with the 11-parameter version.
--
-- Root cause: CREATE OR REPLACE FUNCTION with different param count in
-- migration 20260725000000 created a SECOND overload instead of replacing
-- the original. PostgreSQL and PostgREST cannot disambiguate named-parameter
-- calls when both overloads accept the same first 9 params.
--
-- The 11-param overload (with p_feedback_mode and p_channel defaults) is the
-- canonical version and the one with EXECUTE granted to authenticated.
-- Callers that omit the two new params will still work via their DEFAULT NULL.

drop function if exists public.get_analytics_overview(
  uuid, timestamptz, timestamptz, uuid, uuid, numeric, numeric,
  public.alert_status, text
);
