-- Use kpi_definitions thresholds and add department/touchpoint/channel filters.
-- Forward-only additive migration.

-- Extended assert_analytics_scope (5 forward-compatible params) — covers existing callers
create or replace function public.assert_analytics_scope(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_organization_id is null then raise exception 'organization_id is required' using errcode = '22023'; end if;
  if p_start_at is null or p_end_at is null then raise exception 'Date range is required' using errcode = '22023'; end if;
  if p_start_at >= p_end_at then raise exception 'Start must be before end' using errcode = '22023'; end if;
  if p_end_at - p_start_at > interval '366 days' then raise exception 'Analytics range must be between one instant and 366 days' using errcode = '22023'; end if;
  if not public.can_read_organization(p_organization_id) then raise exception 'Analytics access denied' using errcode = '42501'; end if;
  if p_location_id is not null and not public.can_access_location(p_location_id) then raise exception 'Location access denied' using errcode = '42501'; end if;
  if p_survey_id is not null and not public.can_read_survey(p_survey_id) then raise exception 'Survey access denied' using errcode = '42501'; end if;
end;
$$;

-- New 8-param assert_analytics_scope for new RPCs (callers must pass exactly 8 to disambiguate)
create or replace function public.assert_analytics_scope(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid,
  p_survey_id uuid,
  p_department_id uuid,
  p_touchpoint_id uuid,
  p_channel text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id, p_survey_id);
  if p_department_id is not null and not exists (select 1 from public.departments d where d.id = p_department_id and public.can_access_location(d.location_id)) then
    raise exception 'Department access denied' using errcode = '42501';
  end if;
  if p_touchpoint_id is not null and not exists (select 1 from public.touchpoints t where t.id = p_touchpoint_id and public.can_access_location(t.location_id)) then
    raise exception 'Touchpoint access denied' using errcode = '42501';
  end if;
end;
$$;

-- Clean KPI dashboard with configurable thresholds and additional filters
create or replace function public.get_kpi_dashboard(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null,
  p_department_id uuid default null,
  p_touchpoint_id uuid default null,
  p_channel text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_satisfied_min numeric(5,2);
  v_negative_max numeric(5,2);
  v_zero_handling text;
begin
  perform public.assert_analytics_scope(
    p_organization_id, p_start_at, p_end_at, p_location_id, p_survey_id, p_department_id, p_touchpoint_id, p_channel
  );

  -- Load thresholds from kpi_definitions (fall back to defaults)
  select satisfied_min, negative_max, zero_response_handling
    into v_satisfied_min, v_negative_max, v_zero_handling
  from public.kpi_definitions
  where organization_id = p_organization_id and metric = 'satisfaction_pct' and is_active;
  if not found then
    v_satisfied_min := 70; v_negative_max := 30; v_zero_handling := 'hide';
  end if;

  with scoped as (
    select sr.*,
      case when sr.overall_rating is not null and sr.overall_rating >= v_satisfied_min then 1 else 0 end as is_satisfied,
      case when sr.overall_rating is not null and sr.overall_rating <= v_negative_max then 1 else 0 end as is_negative,
      exists (select 1 from public.response_concerns rc2 where rc2.response_id = sr.id and rc2.is_primary) as has_primary_concern
    from public.survey_responses sr
    where sr.organization_id = p_organization_id
      and public.can_access_location(sr.location_id)
      and (p_location_id is null or sr.location_id = p_location_id)
      and (p_survey_id is null or sr.survey_id = p_survey_id)
      and (p_department_id is null or sr.department_id = p_department_id)
      and (p_touchpoint_id is null or sr.touchpoint_id = p_touchpoint_id)
      and (p_channel is null or sr.channel::text = p_channel)
      and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
  ),
  totals as (
    select
      count(*)::integer as total_responses,
      count(*) filter (where overall_rating is not null)::integer as rated_responses,
      round(avg(overall_rating), 2) as average_rating,
      sum(is_satisfied)::integer as satisfied_count,
      sum(is_negative)::integer as negative_count,
      count(*) filter (where has_primary_concern)::integer as concern_responses
    from scoped
  ),
  top_concerns as (
    select cc.slug, cc.name_en, cc.name_ar, count(*)::integer as response_count
    from scoped s join public.response_concerns rc on rc.response_id = s.id and rc.is_primary
    join public.concern_categories cc on cc.id = rc.concern_category_id
    group by cc.slug, cc.name_en, cc.name_ar order by response_count desc limit 5
  ),
  location_kpis as (
    select l.id, l.name_en, l.name_ar, count(s.id)::integer as response_count,
      round(avg(s.overall_rating), 2) as average_rating,
      sum(s.is_satisfied)::integer as satisfied_count, sum(s.is_negative)::integer as negative_count
    from public.locations l left join scoped s on s.location_id = l.id
    where l.organization_id = p_organization_id and l.status = 'active'
      and public.can_access_location(l.id) and (p_location_id is null or l.id = p_location_id)
    group by l.id, l.name_en, l.name_ar
  ),
  department_kpis as (
    select d.id, d.name_en, d.name_ar, count(s.id)::integer as response_count, round(avg(s.overall_rating), 2) as average_rating
    from public.departments d left join scoped s on s.department_id = d.id
    where d.organization_id = p_organization_id and (p_location_id is null or d.location_id = p_location_id)
    group by d.id, d.name_en, d.name_ar
  ),
  touchpoint_kpis as (
    select tp.id, tp.name_en, tp.name_ar, count(s.id)::integer as response_count, round(avg(s.overall_rating), 2) as average_rating
    from public.touchpoints tp left join scoped s on s.touchpoint_id = tp.id
    where tp.organization_id = p_organization_id group by tp.id, tp.name_en, tp.name_ar
  ),
  prev_period as (
    select
      count(*) filter (where overall_rating is not null and overall_rating >= v_satisfied_min)::integer as prev_satisfied_rated,
      count(*) filter (where overall_rating is not null)::integer as prev_rated_responses
    from public.survey_responses
    where organization_id = p_organization_id
      and (p_location_id is null or location_id = p_location_id)
      and (p_survey_id is null or survey_id = p_survey_id)
      and submitted_at >= p_start_at - (p_end_at - p_start_at) and submitted_at < p_start_at
  )
  select jsonb_build_object(
    'total_responses', (select total_responses from totals),
    'rated_responses', (select rated_responses from totals),
    'average_rating', (select average_rating from totals),
    'satisfaction_pct', case when (select rated_responses from totals) > 0 then round((select satisfied_count from totals)::numeric / (select rated_responses from totals) * 100, 2) else null end,
    'negative_feedback_pct', case when (select rated_responses from totals) > 0 then round((select negative_count from totals)::numeric / (select rated_responses from totals) * 100, 2) else null end,
    'satisfied_min', v_satisfied_min,
    'negative_max', v_negative_max,
    'top_concerns', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'name_en', name_en, 'name_ar', name_ar, 'count', response_count) order by response_count desc) from top_concerns), '[]'::jsonb),
    'location_kpis', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name_en', name_en, 'name_ar', name_ar, 'response_count', response_count, 'average_rating', average_rating, 'satisfaction_pct', case when response_count > 0 then round(satisfied_count::numeric / nullif(response_count, 0) * 100, 2) else null end, 'negative_feedback_pct', case when response_count > 0 then round(negative_count::numeric / nullif(response_count, 0) * 100, 2) else null end) order by response_count desc) from location_kpis), '[]'::jsonb),
    'department_kpis', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name_en', name_en, 'name_ar', name_ar, 'response_count', response_count, 'average_rating', average_rating) order by response_count desc) from department_kpis), '[]'::jsonb),
    'touchpoint_kpis', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name_en', name_en, 'name_ar', name_ar, 'response_count', response_count, 'average_rating', average_rating) order by response_count desc) from touchpoint_kpis), '[]'::jsonb),
    'channel_breakdown', coalesce((select jsonb_agg(jsonb_build_object('channel', channel, 'count', count) order by count desc) from (select channel, count(*)::integer count from scoped group by channel) d), '[]'::jsonb),
    'response_trend', coalesce((select jsonb_agg(jsonb_build_object('period', period, 'count', count, 'satisfied', satisfied, 'negative', negative) order by period) from (select to_char(date_trunc('day', submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM-DD') period, count(*)::integer count, sum(is_satisfied)::integer satisfied, sum(is_negative)::integer negative from scoped group by 1) t), '[]'::jsonb),
    'prev_satisfaction_pct', case when (select prev_rated_responses from prev_period) > 0 then round((select prev_satisfied_rated from prev_period)::numeric / nullif((select prev_rated_responses from prev_period), 0) * 100, 2) else null end,
    'prev_negative_feedback_pct', null
  ) into v_result;

  -- Apply zero-response handling
  if v_zero_handling = 'hide' and ((v_result->>'rated_responses')::integer is null or (v_result->>'rated_responses')::integer = 0) then
    return null;
  end if;

  return v_result;
end;
$$;

revoke execute on function public.get_kpi_dashboard(uuid, timestamptz, timestamptz, uuid, uuid, uuid, uuid, text) from public, anon;
grant execute on function public.get_kpi_dashboard(uuid, timestamptz, timestamptz, uuid, uuid, uuid, uuid, text) to authenticated;

-- Concern trend RPC for reporting
create or replace function public.get_concern_trend(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null,
  p_department_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id, p_survey_id, p_department_id, null, null);
  return coalesce((
    select jsonb_agg(row order by period desc, count desc)
    from (
      select jsonb_build_object(
        'slug', cc.slug,
        'name_en', cc.name_en,
        'name_ar', cc.name_ar,
        'period', to_char(date_trunc('month', sr.submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM'),
        'count', count(*)::integer
      ) as row,
        to_char(date_trunc('month', sr.submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM') as period,
        count(*)::integer as count
      from public.survey_responses sr
      join public.response_concerns rc on rc.response_id = sr.id
      join public.concern_categories cc on cc.id = rc.concern_category_id
      where sr.organization_id = p_organization_id
        and public.can_access_location(sr.location_id)
        and (p_location_id is null or sr.location_id = p_location_id)
        and (p_survey_id is null or sr.survey_id = p_survey_id)
        and (p_department_id is null or sr.department_id = p_department_id)
        and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
      group by cc.slug, cc.name_en, cc.name_ar, to_char(date_trunc('month', sr.submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM')
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_concern_trend(uuid, timestamptz, timestamptz, uuid, uuid, uuid) from public, anon;
grant execute on function public.get_concern_trend(uuid, timestamptz, timestamptz, uuid, uuid, uuid) to authenticated;