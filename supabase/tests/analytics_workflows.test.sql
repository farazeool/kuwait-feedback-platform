begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(31);

-- A hidden tenant proves aggregates cannot leak a fourth response.
insert into public.organizations (id, slug, name_en, name_ar)
values ('21000000-0000-4000-8000-000000000099', 'analytics-hidden', 'Hidden analytics', 'تحليلات مخفية');
insert into public.locations (id, organization_id, slug, name_en, name_ar)
values ('31000000-0000-4000-8000-000000000099', '21000000-0000-4000-8000-000000000099', 'hidden', 'Hidden', 'مخفي');
insert into public.surveys (id, organization_id, location_id, public_slug, title_en, title_ar, status, published_at)
values ('41000000-0000-4000-8000-000000000099', '21000000-0000-4000-8000-000000000099', '31000000-0000-4000-8000-000000000099', 'analytics-hidden-survey-identifier', 'Hidden survey', 'استبيان مخفي', 'active', now());
insert into public.survey_questions (id, survey_id, organization_id, position, question_type, status, prompt_en, prompt_ar, rating_min, rating_max)
values ('51000000-0000-4000-8000-000000000099', '41000000-0000-4000-8000-000000000099', '21000000-0000-4000-8000-000000000099', 1, 'rating', 'active', 'Rate', 'قيّم', 1, 5);
insert into public.survey_responses (id, survey_id, organization_id, location_id, locale, overall_rating, submitted_at)
values ('71000000-0000-4000-8000-000000000099', '41000000-0000-4000-8000-000000000099', '21000000-0000-4000-8000-000000000099', '31000000-0000-4000-8000-000000000099', 'en', 5, '2026-07-12 12:00:00+00');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select is(
  (public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01 21:00:00+00', '2026-07-31 21:00:00+00') ->> 'selected_responses')::integer,
  3,
  'owner sees organization analytics'
);
select is(
  round((public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01 21:00:00+00', '2026-07-31 21:00:00+00') ->> 'average_normalized')::numeric, 2),
  66.67::numeric,
  'average rating is correctly normalized from the 1-5 scale'
);
select is(
  jsonb_array_length(public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01 21:00:00+00', '2026-07-31 21:00:00+00') -> 'rating_distribution'),
  3,
  'rating distribution includes the three occupied normalized bands'
);
select is(
  (public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01 21:00:00+00', '2026-07-31 21:00:00+00') ->> 'low_score_count')::integer,
  1,
  'low-score analytics use the documented 40 percent threshold'
);
select is(
  (public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01 21:00:00+00', '2026-07-31 21:00:00+00') -> 'location_comparison' -> 0 ->> 'sufficient_data')::boolean,
  false,
  'location rankings report insufficient data below five responses'
);
select is(
  (public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-08-01 00:00:00+00', '2026-08-02 00:00:00+00') ->> 'selected_responses')::integer,
  0,
  'empty date ranges return an empty analytics state'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select is((public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01') ->> 'selected_responses')::integer, 3, 'organization admin sees permitted analytics');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select is((public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01') ->> 'selected_responses')::integer, 3, 'analyst receives read-only analytics');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select is(jsonb_array_length(public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01') -> 'location_comparison'), 1, 'location manager aggregate contains only assigned locations');
select throws_ok(
  $$select public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01', '30000000-0000-4000-8000-000000000002')$$,
  '42501', 'Location access denied', 'location manager cannot request an unrelated location aggregate'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok(
  $$select public.get_analytics_overview('21000000-0000-4000-8000-000000000099', '2026-07-01', '2026-08-01')$$,
  '42501', 'Analytics access denied', 'unrelated tenant analytics are denied'
);
select is((public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01') ->> 'total_responses')::integer, 3, 'aggregate counts do not include unrelated tenant responses');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01')$$,
  '42501', 'permission denied for function get_analytics_overview', 'anonymous users cannot access analytics'
);

reset role;
insert into public.survey_responses (id, survey_id, organization_id, location_id, locale, overall_rating, submitted_at)
values ('71000000-0000-4000-8000-000000000020', '40000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'en', 5, '2026-07-19 21:30:00+00');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-19 21:00:00+00', '2026-07-20 21:00:00+00') ->> 'selected_responses')::integer, 1, 'Kuwait-local midnight boundaries include the correct UTC response');

reset role;
update public.surveys set status = 'archived' where id = '40000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select is((public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01', null, '40000000-0000-4000-8000-000000000001') ->> 'selected_responses')::integer, 4, 'archived survey analytics preserve historical responses');
select is(
  round((public.get_survey_question_analytics('40000000-0000-4000-8000-000000000001', '2026-07-01', '2026-08-01') -> 1 -> 'options' -> 0 ->> 'percentage')::numeric, 2),
  66.67::numeric,
  'multiple-choice option percentages are calculated from question respondents'
);

select lives_ok(
  $$select public.update_alert_workflow('90000000-0000-4000-8000-000000000001', 'acknowledged', '10000000-0000-4000-8000-000000000001', null)$$,
  'owner can acknowledge and assign an alert'
);
select is((select status from public.alerts where id = '90000000-0000-4000-8000-000000000001'), 'acknowledged'::public.alert_status, 'alert is acknowledged');
select lives_ok(
  $$select public.update_alert_workflow('90000000-0000-4000-8000-000000000001', 'resolved', '10000000-0000-4000-8000-000000000001', 'Follow-up complete')$$,
  'owner can resolve an alert with an internal note'
);
select ok((select status = 'resolved' and resolved_at is not null and resolution_note = 'Follow-up complete' from public.alerts where id = '90000000-0000-4000-8000-000000000001'), 'alert resolution timestamps and note are stored');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.update_alert_workflow('90000000-0000-4000-8000-000000000001', 'open', null, null)$$,
  '42501', 'Alert management access denied', 'analyst cannot mutate alerts'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.update_response_workflow('70000000-0000-4000-8000-000000000001', 'controlled_investigation', '10000000-0000-4000-8000-000000000001', array['follow-up'], 'Call the branch manager', 'investigation', 'NCR-2026-001', 'Quality issue detected', null, null)$$,
  'owner can update response workflow'
);
select ok((select workflow_status = 'controlled_investigation' and internal_tags = array['follow-up'] and reviewed_at is not null from public.survey_responses where id = '70000000-0000-4000-8000-000000000001'), 'response workflow state and tags are stored');
select is((select count(*) from public.response_internal_notes where response_id = '70000000-0000-4000-8000-000000000001'), 1::bigint, 'internal response note is stored privately');
select ok((select count(*) from public.audit_logs where record_id = '70000000-0000-4000-8000-000000000001') >= 1, 'response workflow changes create audit records');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok(
  $$select public.update_response_workflow('70000000-0000-4000-8000-000000000001', 'immediate_escalation', null, array[]::text[], null, null, null, null, null, null)$$,
  '42501', 'Response workflow access denied', 'analyst cannot mutate response workflow'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select lives_ok(
  $$select public.update_response_workflow('70000000-0000-4000-8000-000000000002', 'branch_followup', '10000000-0000-4000-8000-000000000003', array[]::text[], null, null, null, null, 'Called branch manager, audit pending', null)$$,
  'location manager can update an assigned-location response'
);

reset role;
set local role anon;
select ok(not has_table_privilege('anon', 'public.response_internal_notes', 'SELECT'), 'internal notes are never readable by public users');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.record_data_export('20000000-0000-4000-8000-000000000001', 'responses', '{"range":"30d"}'::jsonb)$$,
  'permitted user can audit an export'
);
select is((select count(*) from public.audit_logs where table_name = 'data_exports'), 1::bigint, 'export audit event is recorded without exported data');
select throws_ok(
  $$select public.get_analytics_overview('20000000-0000-4000-8000-000000000001', '2025-01-01', '2026-08-01')$$,
  '22023', 'Analytics range must be between one instant and 366 days', 'unbounded analytics ranges are rejected'
);

select * from finish();
rollback;
