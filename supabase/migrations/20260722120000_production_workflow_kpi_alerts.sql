-- Production workflow, quality roles, KPI engine, and alert automation.
-- Forward-only additive migration.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.response_workflow_status_v2 as enum (
  'monitor_only',
  'branch_followup',
  'controlled_investigation',
  'immediate_escalation'
);

create type public.kpi_metric as enum (
  'satisfaction_pct',
  'negative_feedback_pct',
  'main_concern',
  'response_count',
  'average_rating'
);

create type public.alert_severity as enum ('low', 'medium', 'high', 'critical');
create type public.alert_rule_type as enum (
  'satisfaction_threshold',
  'negative_feedback_threshold',
  'concern_frequency_threshold',
  'sudden_decline'
);

-- ---------------------------------------------------------------------------
-- Response workflow state migration
-- ---------------------------------------------------------------------------

-- Drop old constraints that reference the old enum type
alter table public.survey_responses drop constraint if exists survey_responses_tags_count_check;
alter table public.survey_responses drop constraint if exists survey_responses_reviewed_check;
alter table public.survey_responses drop constraint if exists survey_responses_resolved_check;

alter table public.survey_responses
  alter column workflow_status drop default,
  alter column workflow_status type public.response_workflow_status_v2
  using case workflow_status::text
    when 'unread' then 'monitor_only'::public.response_workflow_status_v2
    when 'reviewed' then 'branch_followup'::public.response_workflow_status_v2
    when 'action_required' then 'controlled_investigation'::public.response_workflow_status_v2
    when 'resolved' then 'immediate_escalation'::public.response_workflow_status_v2
    else 'monitor_only'::public.response_workflow_status_v2
  end;

alter table public.survey_responses
  alter column workflow_status set default 'monitor_only'::public.response_workflow_status_v2;

drop function if exists public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text);
drop type public.response_workflow_status;
alter type public.response_workflow_status_v2 rename to response_workflow_status;

create function public.update_response_workflow(
  p_response_id uuid,
  p_status public.response_workflow_status,
  p_assigned_to uuid default null,
  p_tags text[] default array[]::text[],
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_response public.survey_responses%rowtype;
  v_tags text[];
begin
  select * into v_response from public.survey_responses sr
  where sr.id = p_response_id and public.can_manage_response(sr.id) for update;
  if not found then raise exception 'Response workflow access denied' using errcode = '42501'; end if;
  if p_assigned_to is not null and not public.user_can_access_location(p_assigned_to, v_response.location_id) then
    raise exception 'Assignee cannot access this location' using errcode = '22023';
  end if;
  select coalesce(array_agg(tag order by tag), array[]::text[]) into v_tags
  from (select distinct btrim(value) tag from unnest(coalesce(p_tags, array[]::text[])) value
        where char_length(btrim(value)) between 1 and 40 and value !~ '[[:cntrl:]]') clean;
  if cardinality(v_tags) > 20 or cardinality(v_tags) <> cardinality(coalesce(p_tags, array[]::text[])) then
    raise exception 'Tags are invalid or duplicated' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) not between 1 and 2000 then
    raise exception 'Internal note is invalid' using errcode = '22023';
  end if;

  update public.survey_responses set
    workflow_status = p_status,
    internal_tags = v_tags,
    assigned_to = p_assigned_to,
    reviewed_at = case when p_status = 'monitor_only' then null else coalesce(reviewed_at, timezone('utc', now())) end,
    resolved_at = case when p_status = 'immediate_escalation' then timezone('utc', now()) end
  where id = p_response_id;

  if p_note is not null then
    insert into public.response_internal_notes (response_id, organization_id, author_id, note)
    values (p_response_id, v_response.organization_id, auth.uid(), btrim(p_note));
    insert into public.audit_logs (
      organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
    ) values (
      v_response.organization_id, auth.uid(), current_user, 'INSERT',
      'response_internal_notes', p_response_id,
      jsonb_build_object('note_added', true)
    );
  end if;
end;
$$;

revoke execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text) from public, anon;
grant execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text) to authenticated;

-- Restore constraints with updated enum values
alter table public.survey_responses
  add constraint survey_responses_tags_count_check
    check (cardinality(internal_tags) <= 20),
  add constraint survey_responses_reviewed_check check (
    workflow_status = 'monitor_only' or reviewed_at is not null
  ),
  add constraint survey_responses_resolved_check check (
    (workflow_status <> 'immediate_escalation' and resolved_at is null)
    or (workflow_status = 'immediate_escalation' and resolved_at is not null)
  );

-- ---------------------------------------------------------------------------
-- Roles extension
-- ---------------------------------------------------------------------------

alter type public.app_role add value 'quality_manager';
alter type public.app_role add value 'senior_management';

-- ---------------------------------------------------------------------------
-- KPI definitions (organization-scoped configurable thresholds)
-- ---------------------------------------------------------------------------

create table public.kpi_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  metric public.kpi_metric not null,
  satisfied_min numeric(5,2) not null,
  negative_max numeric(5,2) not null,
  zero_response_handling text not null default 'hide',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint kpi_definitions_org_metric_key unique (organization_id, metric),
  constraint kpi_definitions_satisfied_check check (satisfied_min >= 0 and satisfied_min <= 100),
  constraint kpi_definitions_negative_check check (negative_max >= 0 and negative_max <= 100)
);

create trigger kpi_definitions_set_updated_at
  before update on public.kpi_definitions
  for each row execute function public.set_updated_at();

create index kpi_definitions_organization_idx
  on public.kpi_definitions (organization_id, is_active);

-- ---------------------------------------------------------------------------
-- Alert configuration (thresholds, severity, deduplication window)
-- ---------------------------------------------------------------------------

create table public.alert_configurations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid references public.locations (id) on delete cascade,
  rule_type public.alert_rule_type not null,
  threshold_value numeric(5,2) not null,
  severity public.alert_severity not null default 'medium',
  deduplication_minutes integer not null default 60,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint alert_configurations_org_rule_location_key unique (organization_id, rule_type, location_id)
);

create trigger alert_configurations_set_updated_at
  before update on public.alert_configurations
  for each row execute function public.set_updated_at();

create index alert_configurations_organization_idx
  on public.alert_configurations (organization_id, is_active);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.kpi_definitions enable row level security;
alter table public.kpi_definitions force row level security;

alter table public.alert_configurations enable row level security;
alter table public.alert_configurations force row level security;

create policy kpi_definitions_platform_admin_all
  on public.kpi_definitions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy kpi_definitions_read_permitted
  on public.kpi_definitions for select to authenticated
  using (public.can_read_organization(organization_id));

create policy kpi_definitions_write_permitted
  on public.kpi_definitions for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

create policy alert_configurations_platform_admin_all
  on public.alert_configurations for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy alert_configurations_read_permitted
  on public.alert_configurations for select to authenticated
  using (public.can_read_organization(organization_id));

create policy alert_configurations_write_permitted
  on public.alert_configurations for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.kpi_definitions to authenticated;
grant select, insert, update, delete on public.alert_configurations to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_kpi_dashboard(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null
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
  perform public.assert_analytics_scope(
    p_organization_id, p_start_at, p_end_at, p_location_id, p_survey_id
  );

  with scoped as (
    select
      sr.*,
      case when sr.overall_rating is not null and sr.overall_rating >= 7
        then 1 else 0 end as is_satisfied,
      case when sr.overall_rating is not null and sr.overall_rating <= 4
        then 1 else 0 end as is_negative,
      exists (
        select 1 from public.concern_categories cc
        join public.response_concerns rc on rc.concern_category_id = cc.id
        where rc.response_id = sr.id and rc.is_primary
      ) as has_primary_concern
    from public.survey_responses sr
    where sr.organization_id = p_organization_id
      and public.can_access_location(sr.location_id)
      and (p_location_id is null or sr.location_id = p_location_id)
      and (p_survey_id is null or sr.survey_id = p_survey_id)
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
    select
      cc.slug,
      cc.name_en,
      cc.name_ar,
      count(*)::integer as response_count
    from scoped s
    join public.response_concerns rc on rc.response_id = s.id and rc.is_primary
    join public.concern_categories cc on cc.id = rc.concern_category_id
    group by cc.slug, cc.name_en, cc.name_ar
    order by response_count desc
    limit 5
  ),
  location_kpis as (
    select
      l.id,
      l.name_en,
      l.name_ar,
      count(s.id)::integer as response_count,
      round(avg(s.overall_rating), 2) as average_rating,
      sum(s.is_satisfied)::integer as satisfied_count,
      sum(s.is_negative)::integer as negative_count
    from public.locations l
    left join scoped s on s.location_id = l.id
    where l.organization_id = p_organization_id
      and l.status = 'active'
      and public.can_access_location(l.id)
      and (p_location_id is null or l.id = p_location_id)
    group by l.id, l.name_en, l.name_ar
  ),
  department_kpis as (
    select
      d.id,
      d.name_en,
      d.name_ar,
      count(s.id)::integer as response_count,
      round(avg(s.overall_rating), 2) as average_rating
    from public.departments d
    left join scoped s on s.department_id = d.id
    where d.organization_id = p_organization_id
      and (p_location_id is null or d.location_id = p_location_id)
    group by d.id, d.name_en, d.name_ar
  )
  select jsonb_build_object(
    'total_responses', (select total_responses from totals),
    'rated_responses', (select rated_responses from totals),
    'average_rating', (select average_rating from totals),
    'satisfaction_pct', case when (select rated_responses from totals) > 0
      then round((select satisfied_count from totals)::numeric / (select rated_responses from totals) * 100, 2)
      else null end,
    'negative_feedback_pct', case when (select rated_responses from totals) > 0
      then round((select negative_count from totals)::numeric / (select rated_responses from totals) * 100, 2)
      else null end,
    'top_concerns', coalesce((select jsonb_agg(jsonb_build_object('slug', slug, 'name_en', name_en, 'name_ar', name_ar, 'count', response_count) order by response_count desc) from top_concerns), '[]'::jsonb),
    'location_kpis', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name_en', name_en, 'name_ar', name_ar, 'response_count', response_count, 'average_rating', average_rating, 'satisfaction_pct', case when response_count > 0 then round(satisfied_count::numeric / response_count * 100, 2) else null end, 'negative_feedback_pct', case when response_count > 0 then round(negative_count::numeric / response_count * 100, 2) else null end) order by response_count desc) from location_kpis), '[]'::jsonb),
    'department_kpis', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name_en', name_en, 'name_ar', name_ar, 'response_count', response_count, 'average_rating', average_rating) order by response_count desc) from department_kpis), '[]'::jsonb),
    'channel_breakdown', coalesce((
      select jsonb_agg(jsonb_build_object('channel', channel, 'count', count) order by count desc)
      from (
        select channel, count(*)::integer count
        from scoped
        group by channel
      ) d
    ), '[]'::jsonb),
    'response_trend', coalesce((
      select jsonb_agg(jsonb_build_object('period', period, 'count', count, 'satisfied', satisfied, 'negative', negative) order by period)
      from (
        select to_char(date_trunc('day', submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM-DD') period,
               count(*)::integer count,
               sum(is_satisfied)::integer satisfied,
               sum(is_negative)::integer negative
        from scoped
        group by 1
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Automatic alert evaluation trigger function
-- ---------------------------------------------------------------------------

create or replace function public.evaluate_alert_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config record;
  v_now timestamptz := timezone('utc', now());
  v_rule public.alert_rule_type;
  v_count integer;
begin
  for v_rule in
    select distinct rule_type from public.alert_configurations
    where organization_id = new.organization_id
      and is_active = true
      and (location_id is null or location_id = new.location_id)
  loop
    for v_config in
      select * from public.alert_configurations
      where organization_id = new.organization_id
        and rule_type = v_rule
        and is_active = true
        and (location_id is null or location_id = new.location_id)
      order by location_id nulls first
      limit 1
    loop
      if v_rule = 'satisfaction_threshold' and new.overall_rating is not null and new.overall_rating >= v_config.threshold_value then
        insert into public.alerts (organization_id, location_id, response_id, alert_type, status, rating_value, threshold_value, message)
        values (new.organization_id, new.location_id, new.id, 'low_score', 'open', new.overall_rating, v_config.threshold_value, format('Response rating %s meets satisfaction threshold %s', new.overall_rating, v_config.threshold_value))
        on conflict do nothing;
      elsif v_rule = 'negative_feedback_threshold' and new.overall_rating is not null and new.overall_rating <= v_config.threshold_value then
        insert into public.alerts (organization_id, location_id, response_id, alert_type, status, rating_value, threshold_value, message)
        values (new.organization_id, new.location_id, new.id, 'low_score', 'open', new.overall_rating, v_config.threshold_value, format('Response rating %s is at or below negative feedback threshold %s', new.overall_rating, v_config.threshold_value))
        on conflict do nothing;
      elsif v_rule = 'concern_frequency_threshold' then
        select count(*)::integer into v_count
        from public.response_concerns rc
        join public.survey_responses sr2 on sr2.id = rc.response_id
        where rc.concern_category_id in (
          select concern_category_id
          from public.survey_question_options
          where survey_id in (
            select id from public.surveys
            where organization_id = new.organization_id
              and location_id = new.location_id
              and status = 'active'
          )
        )
          and sr2.location_id = new.location_id
          and sr2.submitted_at >= new.submitted_at - interval '24 hours';
        if v_count >= v_config.threshold_value then
          insert into public.alerts (organization_id, location_id, response_id, alert_type, status, rating_value, threshold_value, message)
          values (new.organization_id, new.location_id, new.id, 'system', 'open', null, v_config.threshold_value, format('Concern frequency threshold %s reached in last 24h', v_config.threshold_value))
          on conflict do nothing;
        end if;
      elsif v_rule = 'sudden_decline' then
        if (
          select round(avg(overall_rating), 2)
          from public.survey_responses
          where location_id = new.location_id
            and overall_rating is not null
            and submitted_at < new.submitted_at
          order by submitted_at desc
          limit 5
        ) - (
          select round(avg(overall_rating), 2)
          from public.survey_responses
          where location_id = new.location_id
            and overall_rating is not null
            and submitted_at >= new.submitted_at - interval '7 days'
            and submitted_at < new.submitted_at
          order by submitted_at desc
          limit 5
        ) >= v_config.threshold_value then
          insert into public.alerts (organization_id, location_id, response_id, alert_type, status, rating_value, threshold_value, message)
          values (new.organization_id, new.location_id, new.id, 'system', 'open', new.overall_rating, v_config.threshold_value, format('Sudden rating decline of %s points detected', v_config.threshold_value))
          on conflict do nothing;
        end if;
      end if;
    end loop;
  end loop;
  return new;
end;
$$;

create trigger survey_responses_evaluate_alerts
  after insert on public.survey_responses
  for each row execute function public.evaluate_alert_rules();

revoke execute on function public.evaluate_alert_rules() from public, anon;
grant execute on function public.evaluate_alert_rules() to authenticated;

-- ---------------------------------------------------------------------------
-- Revoke execute and grant to authenticated
-- ---------------------------------------------------------------------------

revoke execute on function public.get_kpi_dashboard(uuid, timestamptz, timestamptz, uuid, uuid) from public, anon;
grant execute on function public.get_kpi_dashboard(uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;
