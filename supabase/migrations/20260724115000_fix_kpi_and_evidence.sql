-- Fix KPI and Evidence page failures
-- Root Cause 1: Overloaded get_kpi_dashboard confuses PostgREST (PGRST203)
-- Root Cause 2: Evidence FK columns reference auth.users, but queries use profiles!
--   join hints, so PostgREST can't resolve the relationship (PGRST200)
-- ---------------------------------------------------------------------------

-- Fix 1: Drop the old 5-param get_kpi_dashboard overload so the 8-param
-- version is unambiguous. The 5-param version from 20260722120000 was
-- superseded by the full 8-param version in 20260722160000 but was never
-- dropped, creating function overloading that PostgREST cannot resolve.
drop function if exists public.get_kpi_dashboard(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid,
  p_survey_id uuid
);

-- Fix 2: Re-point FK constraints from auth.users to public.profiles so
-- PostgREST can resolve the "uploader:profiles!uploaded_by" join hints
-- used across all evidence-related queries.

-- Evidence table
alter table public.evidence
  drop constraint if exists evidence_uploaded_by_fkey,
  drop constraint if exists evidence_verified_by_fkey;

alter table public.evidence
  add constraint evidence_uploaded_by_fkey
    foreign key (uploaded_by) references public.profiles (id) on delete set null,
  add constraint evidence_verified_by_fkey
    foreign key (verified_by) references public.profiles (id) on delete set null;

-- Verification table
alter table public.verification
  drop constraint if exists verification_verifier_id_fkey;

alter table public.verification
  add constraint verification_verifier_id_fkey
    foreign key (verifier_id) references public.profiles (id) on delete set null;

-- Effectiveness review table
alter table public.effectiveness_review
  drop constraint if exists effectiveness_review_reviewer_id_fkey;

alter table public.effectiveness_review
  add constraint effectiveness_review_reviewer_id_fkey
    foreign key (reviewer_id) references public.profiles (id) on delete set null;
