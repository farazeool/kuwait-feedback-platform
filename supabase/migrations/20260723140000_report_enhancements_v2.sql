-- Additional report RPCs for management reports (Fresh Produce QA spec)
-- Forward-only additive migration.

-- ---------------------------------------------------------------------------
-- get_management_decisions: management decisions/actions taken from investigations
-- ---------------------------------------------------------------------------
create or replace function public.get_management_decisions(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  return coalesce((
    select jsonb_agg(row order by (row->>'closed_at')::timestamptz desc nulls last)
    from (
      select jsonb_build_object(
        'id', i.id,
        'title', i.title,
        'branch_id', i.branch_id,
        'branch_name_en', l.name_en,
        'branch_name_ar', l.name_ar,
        'department_id', i.department_id,
        'department_name_en', d.name_en,
        'department_name_ar', d.name_ar,
        'investigated_at', i.created_at,
        'escalation_decision', i.escalation_decision,
        'recommendation', i.recommendation,
        'findings', i.findings,
        'root_cause', i.root_cause,
        'controlled_record_references', i.controlled_record_references,
        'evidence_reviewed', i.evidence_reviewed,
        'status', i.status,
        'closed_at', i.closed_at
      ) as row
      from public.investigations i
      join public.locations l on l.id = i.branch_id
      left join public.departments d on d.id = i.department_id
      where i.organization_id = p_organization_id
        and (p_location_id is null or i.branch_id = p_location_id)
        and i.created_at >= p_start_at and i.created_at < p_end_at
        and public.can_access_location(l.id)
      order by i.closed_at desc nulls last, i.created_at desc
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_management_decisions(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_management_decisions(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_followup_records: follow-up actions from response review audit
-- ---------------------------------------------------------------------------
create or replace function public.get_followup_records(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  return coalesce((
    select jsonb_agg(row order by recorded_at desc)
    from (
      select jsonb_build_object(
        'id', rra.id,
        'response_id', rra.response_id,
        'recorded_at', rra.recorded_at,
        'actor_id', rra.actor_id,
        'new_status', rra.new_status,
        'previous_status', rra.previous_status,
        'controlled_record_type', rra.controlled_record_type,
        'controlled_record_reference', rra.controlled_record_reference,
        'controlled_record_reason', rra.controlled_record_reason,
        'follow_up_details', rra.follow_up_details,
        'outcome_summary', rra.outcome_summary,
        'survey_title_en', s.title_en,
        'survey_title_ar', s.title_ar,
        'location_name_en', l.name_en,
        'location_name_ar', l.name_ar,
        'department_name_en', d.name_en,
        'department_name_ar', d.name_ar
      ) as row
      from public.response_review_audit rra
      join public.survey_responses sr on sr.id = rra.response_id
      join public.surveys s on s.id = sr.survey_id
      join public.locations l on l.id = sr.location_id
      left join public.departments d on d.id = sr.department_id
      where rra.organization_id = p_organization_id
        and (p_location_id is null or sr.location_id = p_location_id)
        and rra.recorded_at >= p_start_at and rra.recorded_at < p_end_at
        and rra.follow_up_details is not null
        and rra.follow_up_details <> ''
        and public.can_access_location(l.id)
      order by rra.recorded_at desc
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_followup_records(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_followup_records(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_corrective_action_verification: verification status metrics for corrective actions
-- ---------------------------------------------------------------------------
create or replace function public.get_corrective_action_verification(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_pending integer;
  v_accepted integer;
  v_rejected integer;
  v_more_evidence integer;
  v_by_status jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);

  select
    count(*)::integer,
    count(*) filter (where verification_status = 'pending')::integer,
    count(*) filter (where verification_status = 'accepted')::integer,
    count(*) filter (where verification_status = 'rejected')::integer,
    count(*) filter (where verification_status = 'more_evidence_required')::integer
  into v_total, v_pending, v_accepted, v_rejected, v_more_evidence
  from public.corrective_actions
  where organization_id = p_organization_id
    and (p_location_id is null or branch_id = p_location_id)
    and created_at >= p_start_at and created_at < p_end_at;

  select jsonb_agg(jsonb_build_object('status', verification_status, 'count', cnt) order by verification_status)
  into v_by_status
  from (
    select verification_status, count(*)::integer cnt
    from public.corrective_actions
    where organization_id = p_organization_id
      and (p_location_id is null or branch_id = p_location_id)
      and created_at >= p_start_at and created_at < p_end_at
    group by verification_status
  ) t;

  return jsonb_build_object(
    'total', v_total,
    'pending', v_pending,
    'accepted', v_accepted,
    'rejected', v_rejected,
    'more_evidence_required', v_more_evidence,
    'by_status', coalesce(v_by_status, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_corrective_action_verification(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_corrective_action_verification(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_corrective_action_effectiveness: effectiveness review results
-- ---------------------------------------------------------------------------
create or replace function public.get_corrective_action_effectiveness(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_effective integer;
  v_partially integer;
  v_not_effective integer;
  v_by_result jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);

  select
    count(*)::integer,
    count(*) filter (where effectiveness_result = 'effective')::integer,
    count(*) filter (where effectiveness_result = 'partially_effective')::integer,
    count(*) filter (where effectiveness_result = 'not_effective')::integer
  into v_total, v_effective, v_partially, v_not_effective
  from public.corrective_actions
  where organization_id = p_organization_id
    and (p_location_id is null or branch_id = p_location_id)
    and created_at >= p_start_at and created_at < p_end_at
    and effectiveness_result is not null;

  select jsonb_agg(jsonb_build_object('result', effectiveness_result, 'count', cnt) order by effectiveness_result)
  into v_by_result
  from (
    select effectiveness_result, count(*)::integer cnt
    from public.corrective_actions
    where organization_id = p_organization_id
      and (p_location_id is null or branch_id = p_location_id)
      and created_at >= p_start_at and created_at < p_end_at
      and effectiveness_result is not null
    group by effectiveness_result
  ) t;

  return jsonb_build_object(
    'total_reviewed', v_total,
    'effective', v_effective,
    'partially_effective', v_partially,
    'not_effective', v_not_effective,
    'by_result', coalesce(v_by_result, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_corrective_action_effectiveness(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_corrective_action_effectiveness(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_controlled_record_references: list controlled record references from responses
-- ---------------------------------------------------------------------------
create or replace function public.get_controlled_record_references(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  return coalesce((
    select jsonb_agg(row order by (row->>'recorded_at')::timestamptz desc nulls last)
    from (
      select jsonb_build_object(
        'response_id', sr.id,
        'recorded_at', sr.controlled_record_recorded_at,
        'recorded_by', sr.controlled_record_recorded_by,
        'controlled_record_type', sr.controlled_record_type,
        'controlled_record_reference', sr.controlled_record_reference,
        'controlled_record_status', sr.controlled_record_status,
        'outcome_summary', sr.controlled_record_outcome_summary,
        'survey_title_en', s.title_en,
        'survey_title_ar', s.title_ar,
        'location_name_en', l.name_en,
        'location_name_ar', l.name_ar,
        'department_name_en', d.name_en,
        'department_name_ar', d.name_ar,
        'recorded_at', sr.controlled_record_recorded_at
      ) as row
      from public.survey_responses sr
      join public.surveys s on s.id = sr.survey_id
      join public.locations l on l.id = sr.location_id
      left join public.departments d on d.id = sr.department_id
      where sr.organization_id = p_organization_id
        and (p_location_id is null or sr.location_id = p_location_id)
        and sr.controlled_record_reference is not null
        and sr.controlled_record_reference <> ''
        and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
        and public.can_access_location(l.id)
      order by sr.controlled_record_recorded_at desc nulls last
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_controlled_record_references(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_controlled_record_references(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_target_status: KPI target pass/warning/fail with severity breakdown
-- ---------------------------------------------------------------------------
create or replace function public.get_target_status(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_satisfaction_pct numeric;
  v_negative_feedback_pct numeric;
  v_response_count integer;
  v_avg_rating numeric;
  v_target_status jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);

  select
    case when count(*) filter (where overall_rating is not null) > 0
      then round(count(*) filter (where overall_rating is not null and overall_rating >= 7)::numeric / count(*) filter (where overall_rating is not null) * 100, 2)
      else null end,
    case when count(*) filter (where overall_rating is not null) > 0
      then round(count(*) filter (where overall_rating is not null and overall_rating <= 4)::numeric / count(*) filter (where overall_rating is not null) * 100, 2)
      else null end,
    count(*)::integer,
    round(avg(overall_rating), 2)
  into v_satisfaction_pct, v_negative_feedback_pct, v_response_count, v_avg_rating
  from public.survey_responses
  where organization_id = p_organization_id
    and (p_location_id is null or location_id = p_location_id)
    and submitted_at >= p_start_at and submitted_at < p_end_at;

  -- Get KPI definitions for this org
  select jsonb_agg(jsonb_build_object(
    'metric', kd.metric,
    'satisfied_min', kd.satisfied_min,
    'negative_max', kd.negative_max,
    'current_satisfaction_pct', v_satisfaction_pct,
    'current_negative_feedback_pct', v_negative_feedback_pct,
    'current_avg_rating', v_avg_rating,
    'current_response_count', v_response_count,
    'status',
      case
        when kd.metric = 'satisfaction_pct' and v_satisfaction_pct is not null and v_satisfaction_pct >= kd.satisfied_min then 'pass'
        when kd.metric = 'satisfaction_pct' and v_satisfaction_pct is not null and v_satisfaction_pct >= kd.satisfied_min - 10 then 'warning'
        when kd.metric = 'satisfaction_pct' then 'fail'
        when kd.metric = 'negative_feedback_pct' and v_negative_feedback_pct is not null and v_negative_feedback_pct <= kd.negative_max then 'pass'
        when kd.metric = 'negative_feedback_pct' and v_negative_feedback_pct is not null and v_negative_feedback_pct <= kd.negative_max + 10 then 'warning'
        when kd.metric = 'negative_feedback_pct' then 'fail'
        else 'unknown'
      end
  )) into v_target_status
  from public.kpi_definitions kd
  where kd.organization_id = p_organization_id
    and kd.is_active
    and kd.metric in ('satisfaction_pct', 'negative_feedback_pct');

  return jsonb_build_object(
    'satisfaction_pct', v_satisfaction_pct,
    'negative_feedback_pct', v_negative_feedback_pct,
    'response_count', v_response_count,
    'average_rating', v_avg_rating,
    'target_status', coalesce(v_target_status, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_target_status(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_target_status(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_concern_response_trends: concern and response trends for charts
-- ---------------------------------------------------------------------------
create or replace function public.get_concern_response_trends(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_bucket text default 'week' -- 'week' or 'month'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_bucket text;
  v_concern_trend jsonb;
  v_response_trend jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  v_bucket := coalesce(p_bucket, 'week');

  -- Concern trend by period
  select jsonb_agg(jsonb_build_object(
    'period', to_char(period_start, 'YYYY-MM-DD'),
    'concern_slug', c.slug,
    'concern_name_en', c.name_en,
    'concern_name_ar', c.name_ar,
    'count', cnt
  ) order by period_start, cnt desc)
  into v_concern_trend
  from (
    select
      date_trunc(v_bucket, sr.submitted_at) as period_start,
      rc.concern_category_id,
      count(*)::integer as cnt
    from public.response_concerns rc
    join public.survey_responses sr on sr.id = rc.response_id
    where rc.organization_id = p_organization_id
      and (p_location_id is null or sr.location_id = p_location_id)
      and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
    group by date_trunc(v_bucket, sr.submitted_at), rc.concern_category_id
  ) t
  join public.concern_categories c on c.id = t.concern_category_id;

  -- Response count trend by period
  select jsonb_agg(jsonb_build_object(
    'period', period_str,
    'count', cnt
  ) order by period_str)
  into v_response_trend
  from (
    select
      to_char(date_trunc(v_bucket, submitted_at), 'YYYY-MM-DD') as period_str,
      count(*)::integer as cnt
    from public.survey_responses
    where organization_id = p_organization_id
      and (p_location_id is null or location_id = p_location_id)
      and submitted_at >= p_start_at and submitted_at < p_end_at
    group by date_trunc(v_bucket, submitted_at)
  ) t;

  return jsonb_build_object(
    'concern_trend', coalesce(v_concern_trend, '[]'::jsonb),
    'response_trend', coalesce(v_response_trend, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_concern_response_trends(uuid, timestamptz, timestamptz, uuid, text) from public, anon;
grant execute on function public.get_concern_response_trends(uuid, timestamptz, timestamptz, uuid, text) to authenticated;