-- Generic Feedback Signature — RPC smoke test (scratch/local only).
--
-- SAFETY: Run this ONLY against a local Supabase (127.0.0.1) or a DISPOSABLE
-- scratch remote project. It writes fixture rows (org/user/template/assignment)
-- and a rating event. NEVER run it against staging or production — it is not
-- idempotent-safe for real data and seeds throwaway records.
--
-- Usage:
--   psql "$SCRATCH_DB_URL" -v ON_ERROR_STOP=1 -f scripts/smoke/signature_rpc_scratch.sql
--   (run AFTER `supabase db push` has applied all migrations to the target)
--
-- What it exercises:
--   issue_rating_nonce -> record_rating -> (single-use replay guard) ->
--   get_signature_badge -> get_signature_subject_report (authenticated, single template)
--
-- Expected final state:
--   rating_rows=1, response_count=1, rating_rows_after_replay=1,
--   badge active:true, report count=1 (avg_rating 5.00)
--
-- Contains no passwords, connection strings, tokens, or production identifiers.
-- All UUIDs and the public_token below are synthetic test fixtures.

-- ---- 1. Minimal fixtures (committed; target project must be disposable) ----
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('cccccccc-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','smoke@test.local','x',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, slug, name_en, name_ar, timezone, status, business_category, default_locale, date_format, number_format, primary_color, accent_color, survey_header_style)
values ('c0000000-0000-4000-8000-000000000001','org-smoke','Smoke Org','منظمة','Asia/Kuwait','active','retail','en','dd/MM/yyyy','en-KW','#006c5b','#d5a742','standard')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id, user_id, role, status, scope)
values ('c0000000-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','organization_owner','active','organization')
on conflict do nothing;

insert into public.distribution_templates (id, organization_id, channel, template_name, render_config)
values ('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','email','Smoke Tpl','{"ratingStyle":"star"}')
on conflict (id) do nothing;

insert into public.distribution_assignments (id, organization_id, template_id, status, subject_type, subject_id, public_token)
values ('c2000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','active','branch','branch-a',repeat('c',36))
on conflict (id) do nothing;

\echo '--- 2. issue_rating_nonce (anon RPC) ---'
select (public.issue_rating_nonce(repeat('c',36), null)->>'nonce') as nonce \gset
\echo 'nonce issued (test-only, single-use):' :'nonce'

\echo '--- 3. record_rating with that nonce (anon RPC) ---'
select public.record_rating(repeat('c',36), 5, :'nonce', null, 'smoke-test') as record_result;

\echo '--- 4. verify a rating_events row landed + response_count bumped ---'
select
  (select count(*) from public.rating_events where assignment_id = 'c2000000-0000-4000-8000-000000000001') as rating_rows,
  (select response_count from public.distribution_assignments where id = 'c2000000-0000-4000-8000-000000000001') as response_count;

\echo '--- 5. replay same nonce -> must NOT insert a second row (single-use) ---'
select public.record_rating(repeat('c',36), 1, :'nonce', null, 'smoke-replay') as replay_result;
select (select count(*) from public.rating_events where assignment_id = 'c2000000-0000-4000-8000-000000000001') as rating_rows_after_replay;

\echo '--- 6. get_signature_badge (anon RPC) -> expect active:true ---'
select public.get_signature_badge(repeat('c',36)) as badge;

\echo '--- 7. get_signature_subject_report as the org owner (authenticated) ---'
begin;
  set local role authenticated;
  set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';
  select public.get_signature_subject_report(
    'c0000000-0000-4000-8000-000000000001',
    now() - interval '30 days',
    now() + interval '1 minute',
    null,
    'c1000000-0000-4000-8000-000000000001'   -- p_template_id: single-scale filter
  ) as report;
rollback;

\echo '=== EXPECTED: rating_rows=1, response_count=1, rating_rows_after_replay=1, badge active:true, report count=1 ==='
