-- Reporting summary RPCs and batch KPI-based alert evaluation.
-- Forward-only additive migration.

-- ---------------------------------------------------------------------------
-- Add new columns to alert_configurations for sudden_decline rule
-- ---------------------------------------------------------------------------
alter table public.alert_configurations
  add column if not exists evaluation_window_hours integer not null default 24,
  add column if not exists comparison_window_days integer not null default 7,
  add column if not exists minimum_sample_count integer not null default 5;

comment on column public.alert_configurations.evaluation_window_hours is 'Recent evaluation window in hours for sudden_decline rule (default 24h)';
comment on column public.alert_configurations.comparison_window_days is 'Comparison window in days for sudden_decline rule (default 7d)';
comment on column public.alert_configurations.minimum_sample_count is 'Minimum sample count required in both windows for sudden_decline rule (default 5)';

-- ---------------------------------------------------------------------------
-- get_alert_summary: per status counts and breakdown for the report
-- ---------------------------------------------------------------------------
create or replace function public.get_alert_summary(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  return coalesce((
    select jsonb_agg(row_data order by status)
    from (
      select status, count(*)::integer as count, count(*) filter (where alert_type = 'low_score')::integer as low_score_count, count(*) filter (where alert_type = 'system')::integer as system_count
      from public.alerts
      where organization_id = p_organization_id
        and (p_location_id is null or location_id = p_location_id)
        and created_at >= p_start_at and created_at < p_end_at
      group by status
    ) row_data
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_alert_summary(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_alert_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- get_review_summary: outcome counts for the report
-- ---------------------------------------------------------------------------
create or replace function public.get_review_summary(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  return coalesce((
    select jsonb_agg(row_data order by workflow_status)
    from (
      select workflow_status, count(*)::integer as count, count(*) filter (where controlled_record_type is not null)::integer as with_controlled_record
      from public.survey_responses
      where organization_id = p_organization_id
        and (p_location_id is null or location_id = p_location_id)
        and reviewed_at is not null
        and reviewed_at >= p_start_at and reviewed_at < p_end_at
      group by workflow_status
    ) row_data
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.get_review_summary(uuid, timestamptz, timestamptz, uuid) from public, anon;
grant execute on function public.get_review_summary(uuid, timestamptz, timestamptz, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- evaluate_kpi_alert_rules: batch evaluation of KPI-based alerts
-- Handles: satisfaction_threshold, negative_feedback_threshold, concern_frequency_threshold, sudden_decline
-- Dedup: prevents duplicate open alerts for the same location/rule within the dedup window
-- ---------------------------------------------------------------------------
create or replace function public.evaluate_kpi_alert_rules(p_organization_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config record;
  v_period_end timestamptz := timezone('utc', now());
  v_period_start timestamptz;
  v_count integer := 0;
  v_alert_count integer;
  v_priority_loc uuid;
  v_message text;
  v_exists_id uuid;
  v_dedup_minutes integer;
  -- Sudden decline specific
  v_eval_start timestamptz;
  v_comp_start timestamptz;
  v_recent_avg numeric(5,2);
  v_prior_avg numeric(5,2);
  v_recent_count integer;
  v_prior_count integer;
  v_decline numeric(5,2);
begin
  if p_organization_id is null then
    raise exception 'organization_id is required' using errcode = '22023';
  end if;
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'KPI alert evaluation requires management role' using errcode = '42501';
  end if;

  v_period_start := v_period_end - interval '24 hours';

  for v_config in
    select *
    from public.alert_configurations
    where organization_id = p_organization_id and is_active
  loop
    v_dedup_minutes := coalesce(v_config.deduplication_minutes, 60);

    if v_config.location_id is not null then
      v_priority_loc := v_config.location_id;
    else
      select l.id into v_priority_loc
      from public.locations l
      where l.organization_id = p_organization_id and l.status = 'active'
      order by l.created_at desc limit 1;
    end if;
    if v_priority_loc is null then continue; end if;

    if v_config.rule_type = 'satisfaction_threshold' then
      select count(*)::integer into v_alert_count
      from public.survey_responses
      where organization_id = p_organization_id
        and location_id = v_priority_loc
        and overall_rating is not null
        and overall_rating >= v_config.threshold_value
        and submitted_at >= v_period_start and submitted_at < v_period_end;
      if v_alert_count = 0 then
        v_message := format('No responses meeting satisfaction threshold %s in the last 24 hours', v_config.threshold_value);
        select id into v_exists_id from public.alerts
        where organization_id = p_organization_id
          and location_id = v_priority_loc
          and alert_type = 'system'
          and message = v_message
          and status in ('open', 'acknowledged')
          and created_at >= v_period_end - make_interval(mins => v_dedup_minutes)
        limit 1;
        if v_exists_id is null then
          insert into public.alerts (organization_id, location_id, alert_type, status, threshold_value, message)
          values (p_organization_id, v_priority_loc, 'system', 'open', v_config.threshold_value, v_message);
          v_count := v_count + 1;
        end if;
      end if;
    elsif v_config.rule_type = 'negative_feedback_threshold' then
      select count(*)::integer into v_alert_count
      from public.survey_responses
      where organization_id = p_organization_id
        and location_id = v_priority_loc
        and overall_rating is not null
        and overall_rating <= v_config.threshold_value
        and submitted_at >= v_period_start and submitted_at < v_period_end;
      if v_alert_count > 0 then
        v_message := format('%s response(s) at or below negative feedback threshold %s in the last 24 hours', v_alert_count, v_config.threshold_value);
        select id into v_exists_id from public.alerts
        where organization_id = p_organization_id
          and location_id = v_priority_loc
          and alert_type = 'system'
          and message = v_message
          and status in ('open', 'acknowledged')
          and created_at >= v_period_end - make_interval(mins => v_dedup_minutes)
        limit 1;
        if v_exists_id is null then
          insert into public.alerts (organization_id, location_id, alert_type, status, threshold_value, message)
          values (p_organization_id, v_priority_loc, 'system', 'open', v_config.threshold_value, v_message);
          v_count := v_count + 1;
        end if;
      end if;
    elsif v_config.rule_type = 'concern_frequency_threshold' then
      select count(*)::integer into v_alert_count
      from public.response_concerns rc
      join public.survey_responses sr on sr.id = rc.response_id
      where sr.organization_id = p_organization_id
        and sr.location_id = v_priority_loc
        and sr.submitted_at >= v_period_start and sr.submitted_at < v_period_end;
      if v_alert_count >= v_config.threshold_value then
        v_message := format('Concern frequency reached %s in the last 24 hours (threshold %s)', v_alert_count, v_config.threshold_value);
        select id into v_exists_id from public.alerts
        where organization_id = p_organization_id
          and location_id = v_priority_loc
          and alert_type = 'system'
          and message = v_message
          and status in ('open', 'acknowledged')
          and created_at >= v_period_end - make_interval(mins => v_dedup_minutes)
        limit 1;
        if v_exists_id is null then
          insert into public.alerts (organization_id, location_id, alert_type, status, threshold_value, message)
          values (p_organization_id, v_priority_loc, 'system', 'open', v_config.threshold_value, v_message);
          v_count := v_count + 1;
        end if;
      end if;
    elsif v_config.rule_type = 'sudden_decline' then
      -- Calculate evaluation windows based on configuration
      v_eval_start := v_period_end - make_interval(hours => coalesce(v_config.evaluation_window_hours, 24));
      v_comp_start := v_period_end - make_interval(days => coalesce(v_config.comparison_window_days, 7));
      -- Minimum sample size required in each window
      v_alert_count := coalesce(v_config.minimum_sample_count, 5);

      -- Recent window average rating
      select count(*)::integer, coalesce(avg(overall_rating)::numeric(5,2), 0)
      into v_recent_count, v_recent_avg
      from public.survey_responses
      where organization_id = p_organization_id
        and location_id = v_priority_loc
        and overall_rating is not null
        and submitted_at >= v_eval_start and submitted_at < v_period_end;

      -- Comparison (prior) window average rating
      select count(*)::integer, coalesce(avg(overall_rating)::numeric(5,2), 0)
      into v_prior_count, v_prior_avg
      from public.survey_responses
      where organization_id = p_organization_id
        and location_id = v_priority_loc
        and overall_rating is not null
        and submitted_at >= v_comp_start and submitted_at < v_eval_start;

      -- Check minimum sample sizes in both windows
      if v_recent_count >= v_alert_count and v_prior_count >= v_alert_count then
        v_decline := v_prior_avg - v_recent_avg;
        -- Trigger if decline meets or exceeds threshold
        if v_decline >= v_config.threshold_value then
          v_message := format('Sudden rating decline of %s points detected (prior avg: %s, recent avg: %s)', v_decline, v_prior_avg, v_recent_avg);
          select id into v_exists_id from public.alerts
          where organization_id = p_organization_id
            and location_id = v_priority_loc
            and alert_type = 'system'
            and message = v_message
            and status in ('open', 'acknowledged')
            and created_at >= v_period_end - make_interval(mins => v_dedup_minutes)
          limit 1;
          if v_exists_id is null then
            insert into public.alerts (organization_id, location_id, alert_type, status, threshold_value, message)
            values (p_organization_id, v_priority_loc, 'system', 'open', v_config.threshold_value, v_message);
            v_count := v_count + 1;
          end if;
        end if;
      end if;
    end if;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.evaluate_kpi_alert_rules(uuid) from public, anon;
grant execute on function public.evaluate_kpi_alert_rules(uuid) to authenticated;