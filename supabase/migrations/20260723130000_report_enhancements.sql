-- Additional report RPCs for management reports
-- Forward-only additive migration.

-- Drop the existing 1-arg corrective_actions_stats so we can add an overload
drop function if exists public.get_corrective_action_stats(uuid);

-- ---------------------------------------------------------------------------
-- get_corrective_action_stats: summary stats for corrective actions in period
-- ---------------------------------------------------------------------------
create or replace function public.get_corrective_action_stats(
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
  v_open integer;
  v_in_progress integer;
  v_pending_verification integer;
  v_verified integer;
  v_effectiveness_review integer;
  v_closed integer;
  v_rejected integer;
  v_overdue integer;
  v_by_priority jsonb;
  v_by_status jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);

  -- Get total counts
  select
    count(*)::integer,
    count(*) filter (where status = 'open')::integer,
    count(*) filter (where status = 'in_progress')::integer,
    count(*) filter (where status = 'pending_verification')::integer,
    count(*) filter (where status = 'verified')::integer,
    count(*) filter (where status = 'effectiveness_review')::integer,
    count(*) filter (where status = 'closed')::integer,
    count(*) filter (where status = 'rejected')::integer,
    count(*) filter (where status not in ('closed', 'verified') and due_date < current_date)::integer
  into v_total, v_open, v_in_progress, v_pending_verification, v_verified, v_effectiveness_review, v_closed, v_rejected, v_overdue
  from public.corrective_actions
  where organization_id = p_organization_id
    and (p_location_id is null or branch_id = p_location_id)
    and created_at >= p_start_at and created_at < p_end_at;

  -- By priority
  select jsonb_agg(jsonb_build_object('priority', priority, 'count', cnt) order by
    case priority when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end desc
  ) into v_by_priority
  from (
    select priority, count(*)::integer cnt
    from public.corrective_actions
    where organization_id = p_organization_id
      and (p_location_id is null or branch_id = p_location_id)
      and created_at >= p_start_at and created_at < p_end_at
    group by priority
  ) t;

  -- By status
  select jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by status)
  into v_by_status
  from (
    select status, count(*)::integer cnt
    from public.corrective_actions
    where organization_id = p_organization_id
      and (p_location_id is null or branch_id = p_location_id)
      and created_at >= p_start_at and created_at < p_end_at
    group by status
  ) t;

  return jsonb_build_object(
    'total', v_total,
    'open', v_open,
    'in_progress', v_in_progress,
    'pending_verification', v_pending_verification,
    'verified', v_verified,
    'effectiveness_review', 0,
    'closed', v_closed,
    'rejected', v_rejected,
    'overdue', v_overdue,
    'by_priority', coalesce(v_by_priority, '[]'::jsonb),
    'by_status', coalesce(v_by_status, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_corrective_action_stats(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_corrective_action_stats(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_branch_ranking: ranking locations by KPIs
-- ---------------------------------------------------------------------------
create or replace function public.get_branch_ranking(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_satisfaction_pct numeric;
  v_response_count integer;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at);
  return coalesce((
    select jsonb_agg(row order by satisfaction_pct desc nulls last, response_count desc)
    from (
      select jsonb_build_object(
        'id', l.id,
        'name_en', l.name_en,
        'name_ar', l.name_ar,
        'response_count', count(sr.id)::integer,
        'average_rating', round(avg(sr.overall_rating), 2),
        'satisfaction_pct', case when count(sr.id) filter (where sr.overall_rating is not null) > 0
          then round(count(sr.id) filter (where sr.overall_rating is not null and sr.overall_rating >= 7)::numeric / count(sr.id) filter (where sr.overall_rating is not null) * 100, 2)
          else null end,
        'negative_feedback_pct', case when count(sr.id) filter (where sr.overall_rating is not null) > 0
          then round(count(sr.id) filter (where sr.overall_rating is not null and sr.overall_rating <= 4)::numeric / count(sr.id) filter (where sr.overall_rating is not null) * 100, 2)
          else null end
      ) as row,
      -- computed for ordering
      case when count(sr.id) filter (where sr.overall_rating is not null) > 0
        then round(count(sr.id) filter (where sr.overall_rating is not null and sr.overall_rating >= 7)::numeric / count(sr.id) filter (where sr.overall_rating is not null) * 100, 2)
        else null end as satisfaction_pct,
      count(sr.id)::integer as response_count
      from public.locations l
      left join public.survey_responses sr on sr.location_id = l.id
        and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
      where l.organization_id = p_organization_id
        and l.status = 'active'
        and public.can_access_location(l.id)
      group by l.id, l.name_en, l.name_ar
      having count(sr.id) > 0
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_branch_ranking(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_branch_ranking(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- get_department_ranking: ranking departments by KPIs
-- ---------------------------------------------------------------------------
create or replace function public.get_department_ranking(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_satisfaction_pct numeric;
  v_response_count integer;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at);
  return coalesce((
    select jsonb_agg(row order by satisfaction_pct desc nulls last, response_count desc)
    from (
      select jsonb_build_object(
        'id', d.id,
        'name_en', d.name_en,
        'name_ar', d.name_ar,
        'location_name_en', l.name_en,
        'location_name_ar', l.name_ar,
        'response_count', count(sr.id)::integer,
        'average_rating', round(avg(sr.overall_rating), 2),
        'satisfaction_pct', case when count(sr.id) filter (where sr.overall_rating is not null) > 0
          then round(count(sr.id) filter (where sr.overall_rating is not null and sr.overall_rating >= 7)::numeric / count(sr.id) filter (where sr.overall_rating is not null) * 100, 2)
          else null end,
        'negative_feedback_pct', case when count(sr.id) filter (where sr.overall_rating is not null) > 0
          then round(count(sr.id) filter (where sr.overall_rating is not null and sr.overall_rating <= 4)::numeric / count(sr.id) filter (where sr.overall_rating is not null) * 100, 2)
          else null end
      ) as row,
      -- computed for ordering
      case when count(sr.id) filter (where sr.overall_rating is not null) > 0
        then round(count(sr.id) filter (where sr.overall_rating is not null and sr.overall_rating >= 7)::numeric / count(sr.id) filter (where sr.overall_rating is not null) * 100, 2)
        else null end as satisfaction_pct,
      count(sr.id)::integer as response_count
      from public.departments d
      join public.locations l on l.id = d.location_id
      left join public.survey_responses sr on sr.department_id = d.id
        and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
      where d.organization_id = p_organization_id
        and l.status = 'active'
        and public.can_access_location(l.id)
      group by d.id, d.name_en, d.name_ar, l.name_en, l.name_ar
      having count(sr.id) > 0
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_department_ranking(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.get_department_ranking(uuid, timestamptz, timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- get_alert_severity_breakdown: alerts by severity
-- ---------------------------------------------------------------------------
create or replace function public.get_alert_severity_breakdown(
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
    select jsonb_agg(row order by severity_order desc)
    from (
      select jsonb_build_object(
        'severity', ac.severity,
        'count', count(*)::integer
      ) as row,
      case ac.severity when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end as severity_order
      from public.alerts a
      join public.alert_configurations ac on ac.organization_id = a.organization_id
        and ac.rule_type = case
          when a.alert_type = 'low_score' then 'satisfaction_threshold'::public.alert_rule_type
          else 'satisfaction_threshold'::public.alert_rule_type
        end
        and (ac.location_id is null or ac.location_id = a.location_id)
      where a.organization_id = p_organization_id
        and (p_location_id is null or a.location_id = p_location_id)
        and a.created_at >= p_start_at and a.created_at < p_end_at
      group by ac.severity
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_alert_severity_breakdown(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_alert_severity_breakdown(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_alert_trigger_breakdown: alerts by rule type
-- ---------------------------------------------------------------------------
create or replace function public.get_alert_trigger_breakdown(
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
    select jsonb_agg(row order by count desc)
    from (
      select jsonb_build_object(
        'rule_type', ac.rule_type::text,
        'count', count(*)::integer
      ) as row,
      count(*)::integer as count
      from public.alerts a
      join public.alert_configurations ac on ac.organization_id = a.organization_id
        and ac.rule_type = case
          when a.alert_type = 'low_score' then 'satisfaction_threshold'::public.alert_rule_type
          else 'satisfaction_threshold'::public.alert_rule_type
        end
        and (ac.location_id is null or ac.location_id = a.location_id)
      where a.organization_id = p_organization_id
        and (p_location_id is null or a.location_id = p_location_id)
        and a.created_at >= p_start_at and a.created_at < p_end_at
      group by ac.rule_type
    ) entries
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_alert_trigger_breakdown(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_alert_trigger_breakdown(uuid, timestamptz, timestamptz, uuid) to authenticated;