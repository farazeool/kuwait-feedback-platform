begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

-- ---------------------------------------------------------------------------
-- Fixtures (created as the migration owner; RLS is exercised separately below)
-- ---------------------------------------------------------------------------

-- A department and a kiosk touchpoint in the seed org's Salmiya location.
insert into public.departments (id, organization_id, location_id, slug, name_en, name_ar)
values (
  '4d000000-0000-4000-8000-000000000071',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'fresh-produce', 'Fresh Produce', 'المنتجات الطازجة'
);

insert into public.touchpoints (
  id, organization_id, location_id, department_id, slug, public_token,
  name_en, name_ar, channel
) values (
  '4c000000-0000-4000-8000-000000000071',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '4d000000-0000-4000-8000-000000000071',
  'produce-kiosk', 'fptouchpoint00000000000000000000000071',
  'Produce kiosk', 'كشك المنتجات', 'kiosk'
);

-- A test scale with a deliberate gap (no point at value 3) so the new
-- scale-point validation is distinguishable from the existing bounds trigger.
insert into public.rating_scales (key, name_en, name_ar, scale_min, scale_max, satisfied_min, negative_max)
values ('test_gap_5', 'Gap scale', 'مقياس بفجوة', 1, 5, 4, 2);
insert into public.rating_scale_points (scale_key, value, label_en, label_ar, position) values
  ('test_gap_5', 1, 'One',  'واحد', 1),
  ('test_gap_5', 2, 'Two',  'اثنان', 2),
  ('test_gap_5', 4, 'Four', 'أربعة', 3),
  ('test_gap_5', 5, 'Five', 'خمسة', 4);

-- A published Fresh Produce survey: one scaled rating question and one
-- multiple-choice question whose options carry controlled concern categories.
insert into public.surveys (
  id, organization_id, location_id, public_slug, title_en, title_ar,
  status, default_locale, survey_type, published_at, created_by
) values (
  '40000000-0000-4000-8000-000000000071',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'demo-fresh-produce-qa-touchpoint-2026',
  'Fresh Produce QA', 'ضبط جودة المنتجات الطازجة',
  'active', 'en', 'fresh_produce', timezone('utc', now()),
  '10000000-0000-4000-8000-000000000001'
);

insert into public.survey_questions (
  id, survey_id, organization_id, position, question_type, status,
  prompt_en, prompt_ar, is_required, rating_min, rating_max, rating_scale,
  allow_multiple, text_max_length
) values
  (
    '50000000-0000-4000-8000-000000000071',
    '40000000-0000-4000-8000-000000000071',
    '20000000-0000-4000-8000-000000000001',
    1, 'rating', 'active', 'Rate the produce', 'قيّم المنتجات', true,
    1, 5, 'test_gap_5', false, null
  ),
  (
    '50000000-0000-4000-8000-000000000072',
    '40000000-0000-4000-8000-000000000071',
    '20000000-0000-4000-8000-000000000001',
    2, 'multiple_choice', 'active', 'Any concerns?', 'أي مخاوف؟', false,
    null, null, null, true, null
  );

insert into public.survey_question_options (
  id, question_id, survey_id, organization_id, position, label_en, label_ar, concern_category_id
) values
  (
    '60000000-0000-4000-8000-000000000071',
    '50000000-0000-4000-8000-000000000072',
    '40000000-0000-4000-8000-000000000071',
    '20000000-0000-4000-8000-000000000001',
    1, 'Not fresh', 'ليست طازجة',
    (select id from public.concern_categories where slug = 'freshness')
  ),
  (
    '60000000-0000-4000-8000-000000000072',
    '50000000-0000-4000-8000-000000000072',
    '40000000-0000-4000-8000-000000000071',
    '20000000-0000-4000-8000-000000000001',
    2, 'Looks bad', 'يبدو سيئاً',
    (select id from public.concern_categories where slug = 'appearance')
  );

-- ---------------------------------------------------------------------------
-- Anonymous read path: get_public_survey surfaces FP metadata (no direct table access)
-- ---------------------------------------------------------------------------

-- Capture concern category IDs before switching to anon (anon has no direct table access).
select set_config('test.freshness_id', id::text, false)
  from public.concern_categories where slug = 'freshness';

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  public.get_public_survey('demo-fresh-produce-qa-touchpoint-2026') ->> 'survey_type',
  'fresh_produce',
  'get_public_survey reports the fresh_produce survey type'
);
select is(
  public.get_public_survey('demo-fresh-produce-qa-touchpoint-2026')
    -> 'rating_scales' -> 'test_gap_5' -> 'points' -> 2 ->> 'value',
  '4',
  'referenced scale points are returned in position order (value 4 after the gap)'
);
select is(
  jsonb_array_length(
    public.get_public_survey('demo-fresh-produce-qa-touchpoint-2026')
      -> 'rating_scales' -> 'test_gap_5' -> 'points'
  ),
  4,
  'only the four declared points of the referenced scale are surfaced'
);
select is(
  (public.get_public_survey('demo-fresh-produce-qa-touchpoint-2026')
    -> 'questions' -> 0 ->> 'rating_scale'),
  'test_gap_5',
  'the rating question advertises its named scale'
);
select is(
  (public.get_public_survey('demo-fresh-produce-qa-touchpoint-2026')
    -> 'questions' -> 1 -> 'options' -> 0 ->> 'concern_category_id'),
  current_setting('test.freshness_id'),
  'concern-linked options expose their controlled category id'
);
select is(
  public.get_public_survey('demo-salmiya-customer-satisfaction-2026')
    -> 'rating_scales',
  '{}'::jsonb,
  'generic surveys report no referenced scales'
);

-- ---------------------------------------------------------------------------
-- Anonymous submission path: channel/department/touchpoint + normalized concerns
-- ---------------------------------------------------------------------------

-- A valid submission through the touchpoint token records kiosk context and
-- derives the department, and normalizes the two concern selections.
select lives_ok(
  $$
    select public.submit_protected_survey_response(
      'demo-fresh-produce-qa-touchpoint-2026', 'en',
      '[
        {"question_id":"50000000-0000-4000-8000-000000000071","rating":4},
        {"question_id":"50000000-0000-4000-8000-000000000072",
         "option_ids":["60000000-0000-4000-8000-000000000071","60000000-0000-4000-8000-000000000072"]}
      ]'::jsonb,
      'pgtap-fp-touchpoint-0001', repeat('f', 64),
      'web', 'fptouchpoint00000000000000000000000071'
    )
  $$,
  'a valid touchpoint submission with concern options succeeds'
);

reset role;

select is(
  (select channel from public.survey_responses where idempotency_key = 'pgtap-fp-touchpoint-0001'),
  'kiosk'::public.response_channel,
  'the touchpoint channel overrides the caller-provided channel'
);
select is(
  (select department_id from public.survey_responses where idempotency_key = 'pgtap-fp-touchpoint-0001'),
  '4d000000-0000-4000-8000-000000000071'::uuid,
  'the department is derived from the touchpoint'
);
select is(
  (select count(*) from public.response_concerns rc
    join public.survey_responses sr on sr.id = rc.response_id
    where sr.idempotency_key = 'pgtap-fp-touchpoint-0001'),
  2::bigint,
  'both concern-linked selections are normalized into response_concerns'
);
select is(
  (select count(*) from public.response_concerns rc
    join public.survey_responses sr on sr.id = rc.response_id
    where sr.idempotency_key = 'pgtap-fp-touchpoint-0001' and rc.is_primary),
  1::bigint,
  'exactly one concern is marked primary'
);
select is(
  (select cc.slug from public.response_concerns rc
    join public.survey_responses sr on sr.id = rc.response_id
    join public.concern_categories cc on cc.id = rc.concern_category_id
    where sr.idempotency_key = 'pgtap-fp-touchpoint-0001' and rc.is_primary),
  'freshness',
  'the lowest-positioned concern option becomes the primary concern'
);

-- The gap value (3) is within min/max bounds but is not a declared scale
-- point, so the new scale-point validation must reject it.
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$
    select public.submit_protected_survey_response(
      'demo-fresh-produce-qa-touchpoint-2026', 'en',
      '[{"question_id":"50000000-0000-4000-8000-000000000071","rating":3}]'::jsonb,
      'pgtap-fp-gap-0001', repeat('a', 64)
    )
  $$,
  '22023',
  'Rating answer is not a valid scale point',
  'a value inside the bounds but off the scale points is rejected'
);

-- A touchpoint token from a different location must not attach.
select throws_ok(
  $$
    select public.submit_protected_survey_response(
      'demo-salmiya-customer-satisfaction-2026', 'en',
      '[{"question_id":"50000000-0000-4000-8000-000000000001","rating":5}]'::jsonb,
      'pgtap-fp-wrongtoken-0001', repeat('b', 64),
      'web', 'nonexistent-touchpoint-token-000000000000'
    )
  $$,
  'P0002',
  'Touchpoint not found for this survey',
  'an unknown touchpoint token is rejected'
);
reset role;

-- ---------------------------------------------------------------------------
-- RLS: departments/touchpoints are location-scoped; anon has no direct access
-- ---------------------------------------------------------------------------

select ok(
  not has_table_privilege('anon', 'public.departments', 'SELECT'),
  'anonymous users cannot read departments directly'
);
select ok(
  not has_table_privilege('anon', 'public.touchpoints', 'SELECT'),
  'anonymous users cannot read touchpoints directly'
);

-- The seed analyst (read-only) can see the department but cannot create one.
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$
    insert into public.departments (organization_id, location_id, slug, name_en, name_ar)
    values ('20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001',
            'analyst-dept', 'Analyst dept', 'قسم المحلل')
  $$,
  '42501',
  'new row violates row-level security policy for table "departments"',
  'analysts cannot create departments'
);
reset role;

select * from finish();
rollback;
