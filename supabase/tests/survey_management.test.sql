begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(23);

create temporary table survey_test_result (id uuid) on commit drop;
grant select, insert, delete on survey_test_result to authenticated;
create temporary table public_submission_fixture (
  public_slug text,
  rating_question uuid,
  choice_question uuid,
  option_id uuid
) on commit drop;
grant select on public_submission_fixture to anon, authenticated;

-- A second tenant exists only inside this rolled-back test transaction.
insert into public.organizations (id, slug, name_en, name_ar)
values ('20000000-0000-4000-8000-000000000098', 'survey-hidden-tenant', 'Hidden tenant', 'مستأجر مخفي');
insert into public.locations (id, organization_id, slug, name_en, name_ar, governorate, area)
values ('30000000-0000-4000-8000-000000000098', '20000000-0000-4000-8000-000000000098', 'hidden', 'Hidden location', 'موقع مخفي', 'capital', 'Sharq');
insert into public.surveys (id, organization_id, location_id, public_slug, title_en, title_ar)
values ('40000000-0000-4000-8000-000000000098', '20000000-0000-4000-8000-000000000098', '30000000-0000-4000-8000-000000000098', 'hidden-tenant-survey-identifier-0001', 'Hidden survey', 'استبيان مخفي');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok($$
  insert into survey_test_result
  select public.save_survey_draft(
    '20000000-0000-4000-8000-000000000001', null,
    'Milestone 4 survey', 'استبيان المرحلة الرابعة',
    'Public feedback test', 'اختبار ملاحظات عام',
    'Thank you', 'شكراً', 'en',
    array[
      '30000000-0000-4000-8000-000000000001'::uuid,
      '30000000-0000-4000-8000-000000000002'::uuid
    ],
    '[
      {"type":"rating","label_en":"Rate us","label_ar":"قيّمنا","help_text_en":"","help_text_ar":"","required":true,"rating_min":1,"rating_max":5,"text_max_length":null,"options":[]},
      {"type":"multiple_choice","label_en":"Choose one","label_ar":"اختر","help_text_en":"","help_text_ar":"","required":true,"rating_min":null,"rating_max":null,"text_max_length":null,"options":[{"label_en":"Good","label_ar":"جيد"},{"label_en":"Bad","label_ar":"سيئ"}]},
      {"type":"text","label_en":"Comment","label_ar":"تعليق","help_text_en":"","help_text_ar":"","required":false,"rating_min":null,"rating_max":null,"text_max_length":200,"options":[]}
    ]'::jsonb
  )
$$, 'owner can atomically create a multi-location survey draft');

select is(
  (select count(*) from public.surveys where survey_group_id = (select survey_group_id from public.surveys where id = (select id from survey_test_result limit 1))),
  2::bigint,
  'one survey definition creates one public survey per assigned location'
);

select lives_ok(
  $$select public.transition_survey_group((select id from survey_test_result limit 1), 'active')$$,
  'owner can publish a valid organization survey'
);
select is(
  (select count(*) from public.surveys where survey_group_id = (select survey_group_id from public.surveys where id = (select id from survey_test_result limit 1)) and status = 'active'),
  2::bigint,
  'publication activates every location survey atomically'
);
select is(
  (select count(*) from public.surveys where id = '40000000-0000-4000-8000-000000000098'),
  0::bigint,
  'owner cannot read unrelated tenant survey configuration'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.save_survey_draft('20000000-0000-4000-8000-000000000001', null, 'Forbidden', '', '', '', '', '', 'en', array['30000000-0000-4000-8000-000000000001'::uuid], '[]'::jsonb)$$,
  '42501', 'Survey management access required',
  'analyst cannot create or modify surveys'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is(
  (select count(*) from public.surveys s where s.survey_group_id = (select survey_group_id from public.surveys where id = (select id from survey_test_result limit 1))),
  1::bigint,
  'location manager sees only the assigned location survey'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
delete from survey_test_result;
insert into survey_test_result
select public.save_survey_draft(
  '20000000-0000-4000-8000-000000000001', null,
  'Invalid empty survey', '', '', '', '', '', 'en',
  array['30000000-0000-4000-8000-000000000001'::uuid], '[]'::jsonb
);
select throws_ok(
  $$select public.transition_survey_group((select id from survey_test_result limit 1), 'active')$$,
  '23514', 'Survey does not satisfy publication requirements',
  'invalid survey cannot be published'
);

reset role;
-- Recover the valid survey id without relying on RLS for the remaining public checks.
delete from survey_test_result;
insert into survey_test_result
select id from public.surveys where title_en = 'Milestone 4 survey' order by location_id limit 1;
insert into public_submission_fixture
select
  s.public_slug,
  (select q.id from public.survey_questions q where q.survey_id = s.id and q.question_type = 'rating'),
  (select q.id from public.survey_questions q where q.survey_id = s.id and q.question_type = 'multiple_choice'),
  (select o.id
   from public.survey_question_options o
   join public.survey_questions q on q.id = o.question_id
   where q.survey_id = s.id and q.question_type = 'multiple_choice'
   order by o.position limit 1)
from public.surveys s
where s.id = (select id from survey_test_result limit 1);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select ok(
  public.submit_protected_survey_response(
    (select public_slug from public_submission_fixture),
    'en',
    jsonb_build_array(
      jsonb_build_object('question_id', (select rating_question from public_submission_fixture), 'rating', 5),
      jsonb_build_object('question_id', (select choice_question from public_submission_fixture), 'option_ids', jsonb_build_array((select option_id from public_submission_fixture)))
    ),
    'survey-management-valid-0001', repeat('1', 64)
  ) ->> 'response_id' is not null,
  'published survey accepts a valid anonymous response'
);
select is(
  (public.submit_protected_survey_response(
    (select public_slug from public_submission_fixture),
    'en',
    jsonb_build_array(
      jsonb_build_object('question_id', (select rating_question from public_submission_fixture), 'rating', 5),
      jsonb_build_object('question_id', (select choice_question from public_submission_fixture), 'option_ids', jsonb_build_array((select option_id from public_submission_fixture)))
    ),
    'survey-management-valid-0001', repeat('1', 64)
  ) ->> 'duplicate')::boolean,
  true,
  'duplicate idempotency request returns the existing response'
);
select ok(
  not has_table_privilege('anon', 'public.survey_responses', 'SELECT'),
  'anonymous users cannot list submitted responses'
);

select throws_ok(
  $$select public.submit_protected_survey_response(
    (select public_slug from public_submission_fixture), 'en',
    jsonb_build_array(
      jsonb_build_object('question_id', (select rating_question from public_submission_fixture), 'rating', 99),
      jsonb_build_object('question_id', (select choice_question from public_submission_fixture), 'option_ids', jsonb_build_array((select option_id from public_submission_fixture)))
    ), 'survey-invalid-rating-0001', repeat('2', 64))$$,
  '23514', 'Invalid rating answer', 'invalid rating is rejected'
);
select throws_ok(
  $$select public.submit_protected_survey_response(
    (select public_slug from public_submission_fixture), 'en',
    jsonb_build_array(
      jsonb_build_object('question_id', (select rating_question from public_submission_fixture), 'rating', 5),
      jsonb_build_object('question_id', (select choice_question from public_submission_fixture), 'option_ids', jsonb_build_array(gen_random_uuid()))
    ), 'survey-invalid-option-0001', repeat('3', 64))$$,
  '22023', 'Option does not belong to the question', 'invalid multiple-choice option is rejected'
);
select throws_ok(
  $$select public.submit_protected_survey_response(
    (select public_slug from public_submission_fixture), 'en',
    jsonb_build_array(jsonb_build_object('question_id', (select rating_question from public_submission_fixture), 'rating', 5)),
    'survey-missing-required-0001', repeat('4', 64))$$,
  '22023', 'A required question is missing', 'missing required answer is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.transition_survey_group((select id from survey_test_result limit 1), 'archived')$$,
  'owner can archive a published survey'
);
reset role;

set local role anon;
select throws_ok(
  $$select public.submit_protected_survey_response(
    (select public_slug from public_submission_fixture), 'en', '[]'::jsonb,
    'survey-archived-0001', repeat('5', 64))$$,
  'P0002', 'Published survey not found', 'archived survey rejects new submissions'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.transition_survey_group((select id from survey_test_result limit 1), 'active')$$,
  'an archived survey can be restored only through publication validation'
);
select lives_ok(
  $$select public.transition_survey_group((select id from survey_test_result limit 1), 'archived')$$,
  'a restored survey can be archived again without deleting history'
);
reset role;
select is(
  (select count(*) from public.survey_responses where idempotency_key = 'survey-management-valid-0001'),
  1::bigint,
  'response history survives survey archival'
);
select throws_ok(
  $$delete from public.survey_questions where survey_id = (select id from survey_test_result limit 1)$$,
  '55000', 'Answered survey structure is immutable; duplicate it into a draft',
  'destructive question mutation is rejected after responses exist'
);
select ok(
  (select count(*) from public.public_submission_rate_limits) > 0
  and not has_table_privilege('anon', 'public.public_submission_rate_limits', 'SELECT'),
  'rate limiting stores only inaccessible short-lived hashed buckets'
);
select ok(
  (select bool_and(public.consume_public_submission_rate_limit(
    'demo-salmiya-customer-satisfaction-2026', repeat('f', 64), 5, 600
  )) from generate_series(1, 5)),
  'the database rate limiter permits requests within the configured bucket'
);
select is(
  public.consume_public_submission_rate_limit(
    'demo-salmiya-customer-satisfaction-2026', repeat('f', 64), 5, 600
  ),
  false,
  'the database rate limiter rejects a request beyond the configured bucket'
);

select * from finish();
rollback;
