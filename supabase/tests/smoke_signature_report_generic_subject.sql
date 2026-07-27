-- Regression: get_signature_subject_report must not throw
-- "invalid input syntax for type uuid" when subject_id is a non-UUID generic string.
-- Run with: psql $DB_URL -v ON_ERROR_STOP=1 -f this_file.sql

begin;

-- Minimal org + user + membership
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('cccccccc-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','regtest@test.local','x',now(),now(),now())
on conflict (id) do nothing;

insert into public.organizations (id, slug, name_en, name_ar, timezone, status, business_category, default_locale, date_format, number_format, primary_color, accent_color, survey_header_style)
values ('c0000000-0000-4000-8000-000000000001','org-regtest','Reg Test Org','منظمة','Asia/Kuwait','active','retail','en','dd/MM/yyyy','en-KW','#006c5b','#d5a742','standard')
on conflict (id) do nothing;

insert into public.organization_memberships (organization_id, user_id, role, status, scope)
values ('c0000000-0000-4000-8000-000000000001','cccccccc-0000-4000-8000-000000000001','organization_owner','active','organization')
on conflict do nothing;

insert into public.distribution_templates (id, organization_id, channel, template_name, render_config)
values ('c1000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','email','Reg Tpl','{"ratingStyle":"star"}')
on conflict (id) do nothing;

-- Generic assignment with a non-UUID subject_id — this is the regression case
insert into public.distribution_assignments (id, organization_id, template_id, status, subject_type, subject_id, public_token)
values ('c2000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001','c1000000-0000-4000-8000-000000000001','active','branch','branch-a',repeat('c',36))
on conflict (id) do nothing;

insert into public.rating_events (assignment_id, organization_id, rating, nonce_ref)
values ('c2000000-0000-4000-8000-000000000001','c0000000-0000-4000-8000-000000000001',4,extensions.digest('regtest-nonce','sha256'))
on conflict do nothing;

-- Call the report as the org owner (authenticated role + jwt claim)
set local role authenticated;
set local request.jwt.claims = '{"sub":"cccccccc-0000-4000-8000-000000000001","role":"authenticated"}';

do $$
declare
  v_result jsonb;
  v_label  text;
  v_count  integer;
begin
  v_result := public.get_signature_subject_report(
    'c0000000-0000-4000-8000-000000000001',
    now() - interval '30 days',
    now() + interval '1 minute'  -- exclusive upper bound; created_at = now() must be < end
  );

  v_label := v_result->'subjects'->0->>'label';
  v_count := (v_result->'subjects'->0->>'count')::integer;

  -- Must return the generic subject_id as label (no FK join)
  assert v_label = 'branch-a',
    format('Expected label "branch-a", got "%s"', v_label);

  -- Must report the seeded rating row
  assert v_count = 1,
    format('Expected count 1, got %s', v_count);

  raise notice 'PASS: generic non-UUID subject_id reported correctly (label=%, count=%)', v_label, v_count;
end;
$$;

rollback;
