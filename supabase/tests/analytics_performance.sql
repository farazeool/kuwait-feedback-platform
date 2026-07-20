\set ON_ERROR_STOP on

explain (analyze, buffers, format text)
select organization_id, location_id, survey_id, submitted_at, overall_rating
from public.survey_responses
where organization_id = '20000000-0000-4000-8000-000000000001'
  and submitted_at >= '2026-07-01 00:00:00+00'
  and submitted_at < '2026-08-01 00:00:00+00'
order by submitted_at desc
limit 500;

explain (analyze, buffers, format text)
select location_id, status, count(*)
from public.alerts
where organization_id = '20000000-0000-4000-8000-000000000001'
  and created_at >= '2026-07-01 00:00:00+00'
  and created_at < '2026-08-01 00:00:00+00'
group by location_id, status;

explain (analyze, buffers, format text)
select question_id, rating_value, count(*)
from public.survey_answers
where question_id = '50000000-0000-4000-8000-000000000001'
  and rating_value is not null
group by question_id, rating_value;
