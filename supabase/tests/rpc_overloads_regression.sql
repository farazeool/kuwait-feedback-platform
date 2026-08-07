-- Regression test: verify no unexpected PostgreSQL function overloads exist
-- that would cause PostgREST PGRST203 ambiguous-function errors.
--
-- Every application RPC must have exactly one client-callable signature
-- (with the sole intentional exception of assert_analytics_scope).

begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

-- Define the expected overload sets
-- Each entry: (function_schema, function_name, expected_overload_count, is_intentional)

select plan(19);

-- ==============================================================================
-- 1. No unexpected overloads for any public RPC
-- ==============================================================================

-- Functions that should have exactly ONE signature
select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'get_analytics_overview'),
  1,
  'get_analytics_overview has exactly 1 signature'
);

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'get_kpi_dashboard'),
  1,
  'get_kpi_dashboard has exactly 1 signature'
);

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_protected_survey_response'),
  1,
  'submit_protected_survey_response has exactly 1 signature'
);

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_public_survey_response'),
  1,
  'submit_public_survey_response has exactly 1 signature'
);

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'update_response_workflow'),
  1,
  'update_response_workflow has exactly 1 signature'
);

-- assert_analytics_scope is the sole intentional overload
select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'assert_analytics_scope'),
  2,
  'assert_analytics_scope has exactly 2 signatures (intentional)'
);

-- ==============================================================================
-- 2. Grant verification
-- ==============================================================================

-- get_analytics_overview: authenticated only
select is(
  has_function_privilege('authenticated', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'get_analytics_overview'
    limit 1
  ), 'EXECUTE'),
  true,
  'get_analytics_overview is executable by authenticated'
);

select is(
  has_function_privilege('anon', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'get_analytics_overview'
    limit 1
  ), 'EXECUTE'),
  false,
  'get_analytics_overview is NOT executable by anon'
);

-- get_kpi_dashboard: authenticated only
select is(
  has_function_privilege('authenticated', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'get_kpi_dashboard'
    limit 1
  ), 'EXECUTE'),
  true,
  'get_kpi_dashboard is executable by authenticated'
);

select is(
  has_function_privilege('anon', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'get_kpi_dashboard'
    limit 1
  ), 'EXECUTE'),
  false,
  'get_kpi_dashboard is NOT executable by anon'
);

-- submit_protected_survey_response: anon only (public submission endpoint)
select is(
  has_function_privilege('anon', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_protected_survey_response'
    limit 1
  ), 'EXECUTE'),
  true,
  'submit_protected_survey_response is executable by anon'
);

select is(
  has_function_privilege('authenticated', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_protected_survey_response'
    limit 1
  ), 'EXECUTE'),
  false,
  'submit_protected_survey_response is NOT executable by authenticated (only anon)'
);

-- submit_public_survey_response: no direct client execute (internal helper)
select is(
  has_function_privilege('anon', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_public_survey_response'
    limit 1
  ), 'EXECUTE'),
  false,
  'submit_public_survey_response is NOT executable by anon (internal helper)'
);

select is(
  has_function_privilege('authenticated', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'submit_public_survey_response'
    limit 1
  ), 'EXECUTE'),
  false,
  'submit_public_survey_response is NOT executable by authenticated (internal helper)'
);

-- update_response_workflow: authenticated only
select is(
  has_function_privilege('authenticated', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'update_response_workflow'
    limit 1
  ), 'EXECUTE'),
  true,
  'update_response_workflow is executable by authenticated'
);

select is(
  has_function_privilege('anon', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'update_response_workflow'
    limit 1
  ), 'EXECUTE'),
  false,
  'update_response_workflow is NOT executable by anon'
);

-- assert_analytics_scope (8-param): authenticated only (internal helper)
-- The 5-param version has no grants (only called via SECURITY DEFINER)
select is(
  has_function_privilege('anon', (
    select p.oid from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname = 'assert_analytics_scope'
      and p.pronargs = 8
    limit 1
  ), 'EXECUTE'),
  false,
  'assert_analytics_scope (8-param) is NOT executable by anon'
);

-- ==============================================================================
-- 3. No obsolete overload signatures remain
-- ==============================================================================

-- These specific argument-type combinations should NOT exist in the database:

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'get_analytics_overview'
     and p.pronargs = 9),
  0,
  'No 9-parameter get_analytics_overview variant exists'
);

select is(
  (select count(*)::integer from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname = 'get_kpi_dashboard'
     and p.pronargs = 8
     and p.proargnames::text like '%p_department_id%'),
  0,
  'No 8-parameter get_kpi_dashboard with department_id variant exists'
);

select * from finish();
rollback;
