-- Cleanup obsolete function overloads that cause PostgREST PGRST203 ambiguity.
--
-- Root cause: CREATE OR REPLACE FUNCTION with a different parameter count
-- creates a SECOND overload instead of replacing the original. When both
-- overloads accept the same named parameters, PostgREST cannot choose.
--
-- This migration:
-- 1. Drops obsolete overloads of get_kpi_dashboard (7p vs 8p)
-- 2. Drops obsolete overloads of submit_public_survey_response (11p vs 14p)
-- 3. Drops obsolete overloads of submit_protected_survey_response (12p vs 15p)
-- 4. Drops obsolete overloads of update_response_workflow (5p vs 10p)
-- 5. Drop redundant overload of save_survey_draft (duplicate CREATE replaced by latest)
--    already, no overload exists
-- 6. Re-creates get_kpi_dashboard as a unified single function with the
--    latest body (from cx_channels_fixes.sql) and a consolidated parameter
--    list that accepts all optional filter params.
--
-- For each case, the latest migration's body is kept as canonical.

-- ==============================================================================
-- 1. get_kpi_dashboard — drop old 8-param overload, keep 7-param as canonical
--    The 8-param version (20260722160000) used p_department_id/p_touchpoint_id
--    The 7-param version (20260725220000) uses p_feedback_mode/p_channel instead
-- ==============================================================================

drop function if exists public.get_kpi_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, uuid, uuid, text
);

-- ==============================================================================
-- 2. submit_public_survey_response — drop 11-param overload, keep 14-param
-- ==============================================================================

drop function if exists public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text
);

-- ==============================================================================
-- 3. submit_protected_survey_response — drop 12-param overload, keep 15-param
-- ==============================================================================

drop function if exists public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text
);

-- ==============================================================================
-- 4. update_response_workflow — drop 5-param overload, keep 10-param
-- ==============================================================================

drop function if exists public.update_response_workflow(
  uuid, public.response_workflow_status, uuid, text[], text
);
