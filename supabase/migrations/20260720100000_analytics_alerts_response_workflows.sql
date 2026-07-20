-- Permission-scoped analytics, alert lifecycle, response workflow, and export auditing.

create type public.alert_status_v2 as enum (
  'open',
  'acknowledged',
  'resolved',
  'dismissed'
);

alter table public.alerts
  drop constraint alerts_acknowledgement_check,
  drop constraint alerts_resolution_check;
alter table public.alerts
  alter column status drop default,
  alter column status type public.alert_status_v2 using status::text::public.alert_status_v2,
  alter column status set default 'open';
drop type public.alert_status;
alter type public.alert_status_v2 rename to alert_status;

create type public.response_workflow_status as enum (
  'unread',
  'reviewed',
  'action_required',
  'resolved'
);

alter table public.alerts
  add column assigned_to uuid references auth.users (id) on delete set null,
  add column dismissed_at timestamptz,
  add column resolution_note text
    check (resolution_note is null or char_length(resolution_note) <= 1000),
  add constraint alerts_acknowledgement_check check (
    (status in ('open', 'dismissed') and acknowledged_at is null)
    or (status in ('acknowledged', 'resolved') and acknowledged_at is not null)
  ),
  add constraint alerts_resolution_check check (
    (status <> 'resolved' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  ),
  add constraint alerts_dismissal_check check (
    (status <> 'dismissed' and dismissed_at is null)
    or (status = 'dismissed' and dismissed_at is not null)
  );

alter table public.survey_responses
  add column workflow_status public.response_workflow_status not null default 'unread',
  add column internal_tags text[] not null default array[]::text[],
  add column assigned_to uuid references auth.users (id) on delete set null,
  add column reviewed_at timestamptz,
  add column resolved_at timestamptz,
  add column updated_at timestamptz not null default timezone('utc', now()),
  add constraint survey_responses_tags_count_check
    check (cardinality(internal_tags) <= 20),
  add constraint survey_responses_reviewed_check check (
    workflow_status = 'unread' or reviewed_at is not null
  ),
  add constraint survey_responses_resolved_check check (
    (workflow_status <> 'resolved' and resolved_at is null)
    or (workflow_status = 'resolved' and resolved_at is not null)
  );

create trigger survey_responses_set_updated_at
before update on public.survey_responses
for each row execute function public.set_updated_at();

-- Workflow-only updates must remain possible after a survey is archived.
-- Scope validation still runs for inserts or attempted scope changes.
drop trigger survey_responses_validate_scope on public.survey_responses;
create trigger survey_responses_validate_scope
before insert or update of survey_id, organization_id, location_id
on public.survey_responses
for each row execute function public.validate_survey_response_scope();

create table public.response_internal_notes (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  note text not null check (char_length(btrim(note)) between 1 and 2000),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.response_internal_notes enable row level security;
alter table public.response_internal_notes force row level security;

create policy response_internal_notes_read_permitted
on public.response_internal_notes for select to authenticated
using (public.can_access_response(response_id));

create index survey_responses_org_filters_idx
  on public.survey_responses
  (organization_id, submitted_at desc, location_id, survey_id, overall_rating);
create index survey_responses_workflow_idx
  on public.survey_responses
  (organization_id, workflow_status, assigned_to, submitted_at desc);
create index survey_responses_tags_idx
  on public.survey_responses using gin (internal_tags);
create index survey_answers_question_rating_idx
  on public.survey_answers (question_id, rating_value) where rating_value is not null;
create index survey_answers_question_text_idx
  on public.survey_answers (question_id, created_at desc) where text_value is not null;
create index survey_answer_choices_question_option_idx
  on public.survey_answer_choices (question_id, option_id, answer_id);
create index alerts_org_filters_idx
  on public.alerts (organization_id, status, location_id, created_at desc);
create index alerts_assigned_status_idx
  on public.alerts (assigned_to, status, created_at desc) where assigned_to is not null;
create index response_internal_notes_response_created_idx
  on public.response_internal_notes (response_id, created_at desc);

create function public.user_can_access_location(
  p_user_id uuid,
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1
      from public.profiles p
      where p.id = p_user_id
        and p.platform_role = 'platform_admin'
        and p.status = 'active'
    )
    or exists (
      select 1
      from public.locations l
      join public.organization_memberships om
        on om.organization_id = l.organization_id
      where l.id = p_location_id
        and om.user_id = p_user_id
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'analyst')
    )
    or exists (
      select 1
      from public.location_memberships lm
      where lm.location_id = p_location_id
        and lm.user_id = p_user_id
        and lm.status = 'active'
        and lm.role in ('location_manager', 'analyst')
    ),
    false
  );
$$;

create function public.can_manage_response(p_response_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.survey_responses sr
      where sr.id = p_response_id
        and (
          public.can_manage_organization(sr.organization_id)
          or exists (
            select 1
            from public.location_memberships lm
            where lm.location_id = sr.location_id
              and lm.user_id = auth.uid()
              and lm.status = 'active'
              and lm.role = 'location_manager'
          )
        )
    );
$$;

create function public.assert_analytics_scope(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_read_organization(p_organization_id) then
    raise exception 'Analytics access denied' using errcode = '42501';
  end if;
  if p_start_at is null or p_end_at is null or p_end_at <= p_start_at
    or p_end_at - p_start_at > interval '366 days'
  then
    raise exception 'Analytics range must be between one instant and 366 days'
      using errcode = '22023';
  end if;
  if p_location_id is not null and not exists (
    select 1 from public.locations l
    where l.id = p_location_id
      and l.organization_id = p_organization_id
      and public.can_access_location(l.id)
  ) then
    raise exception 'Location is unavailable' using errcode = '42501';
  end if;
  if p_survey_id is not null and not exists (
    select 1 from public.surveys s
    where s.id = p_survey_id
      and s.organization_id = p_organization_id
      and public.can_read_survey(s.id)
  ) then
    raise exception 'Survey is unavailable' using errcode = '42501';
  end if;
end;
$$;

create function public.get_analytics_overview(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null,
  p_rating_min numeric default null,
  p_rating_max numeric default null,
  p_alert_status public.alert_status default null,
  p_bucket text default 'day'
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
  if p_bucket not in ('day', 'week', 'month') then
    raise exception 'Unsupported analytics bucket' using errcode = '22023';
  end if;
  if p_rating_min is not null and p_rating_max is not null
    and p_rating_min > p_rating_max
  then
    raise exception 'Invalid rating range' using errcode = '22023';
  end if;

  with scoped as (
    select
      sr.*,
      q.rating_min,
      q.rating_max,
      case when sr.overall_rating is not null and q.rating_max > q.rating_min
        then round(((sr.overall_rating - q.rating_min)::numeric
          / (q.rating_max - q.rating_min)::numeric) * 100, 2)
      end as normalized_rating,
      exists (
        select 1 from public.alerts af
        where af.response_id = sr.id
          and (p_alert_status is null or af.status = p_alert_status)
      ) as matches_alert
    from public.survey_responses sr
    left join lateral (
      select sq.rating_min, sq.rating_max
      from public.survey_questions sq
      where sq.survey_id = sr.survey_id and sq.question_type = 'rating'
      order by sq.position limit 1
    ) q on true
    where sr.organization_id = p_organization_id
      and public.can_access_location(sr.location_id)
      and (p_location_id is null or sr.location_id = p_location_id)
      and (p_survey_id is null or sr.survey_id = p_survey_id)
      and (p_rating_min is null or sr.overall_rating >= p_rating_min)
      and (p_rating_max is null or sr.overall_rating <= p_rating_max)
  ), selected as (
    select * from scoped
    where submitted_at >= p_start_at and submitted_at < p_end_at
      and (p_alert_status is null or matches_alert)
  ), previous as (
    select * from scoped
    where submitted_at >= p_start_at - (p_end_at - p_start_at)
      and submitted_at < p_start_at
      and (p_alert_status is null or matches_alert)
  ), location_stats as (
    select
      l.id,
      l.name_en,
      l.name_ar,
      count(s.id)::integer as response_count,
      round(avg(s.normalized_rating), 2) as average_normalized,
      (select count(*)::integer from previous p where p.location_id = l.id) as previous_count,
      (select round(avg(p.normalized_rating), 2) from previous p where p.location_id = l.id)
        as previous_average_normalized
    from public.locations l
    left join selected s on s.location_id = l.id
    where l.organization_id = p_organization_id
      and l.status = 'active'
      and public.can_access_location(l.id)
      and (p_location_id is null or l.id = p_location_id)
    group by l.id, l.name_en, l.name_ar
  )
  select jsonb_build_object(
    'total_responses', (select count(*) from scoped),
    'selected_responses', (select count(*) from selected),
    'average_normalized', (select round(avg(normalized_rating), 2) from selected),
    'rating_scales', coalesce((
      select jsonb_agg(scale order by scale)
      from (select distinct jsonb_build_object('min', rating_min, 'max', rating_max) scale
            from selected where rating_min is not null) scales
    ), '[]'::jsonb),
    'low_score_count', (select count(*) from selected where normalized_rating <= 40),
    'open_alert_count', (
      select count(*) from public.alerts a
      where a.organization_id = p_organization_id
        and public.can_access_location(a.location_id)
        and a.status in ('open', 'acknowledged')
        and a.created_at >= p_start_at and a.created_at < p_end_at
        and (p_location_id is null or a.location_id = p_location_id)
    ),
    'rating_distribution', coalesce((
      select jsonb_agg(jsonb_build_object('band', band, 'count', count) order by band)
      from (
        select least(4, floor(normalized_rating / 20)::integer) band, count(*) count
        from selected where normalized_rating is not null
        group by 1
      ) d
    ), '[]'::jsonb),
    'response_trend', coalesce((
      select jsonb_agg(jsonb_build_object('period', period, 'count', count) order by period)
      from (
        select to_char(date_trunc(p_bucket, submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM-DD') period,
               count(*) count
        from selected group by 1
      ) t
    ), '[]'::jsonb),
    'low_score_trend', coalesce((
      select jsonb_agg(jsonb_build_object('period', period, 'count', count) order by period)
      from (
        select to_char(date_trunc(p_bucket, submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM-DD') period,
               count(*) count
        from selected where normalized_rating <= 40 group by 1
      ) t
    ), '[]'::jsonb),
    'location_comparison', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'name_en', name_en, 'name_ar', name_ar,
        'response_count', response_count,
        'average_normalized', average_normalized,
        'previous_count', previous_count,
        'previous_average_normalized', previous_average_normalized,
        'change', case when response_count >= 5 and previous_count >= 5
          then round(average_normalized - previous_average_normalized, 2) end,
        'sufficient_data', response_count >= 5
      ) order by response_count desc, name_en)
      from location_stats
    ), '[]'::jsonb),
    'survey_comparison', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', survey_group_id, 'title_en', title_en, 'title_ar', title_ar,
        'response_count', response_count, 'average_normalized', average_normalized
      ) order by response_count desc, title_en)
      from (
        select sv.survey_group_id, min(sv.title_en) title_en, min(sv.title_ar) title_ar,
               count(s.id)::integer response_count,
               round(avg(s.normalized_rating), 2) average_normalized
        from selected s join public.surveys sv on sv.id = s.survey_id
        group by sv.survey_group_id
      ) surveys
    ), '[]'::jsonb),
    'alert_metrics', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', count) order by status)
      from (
        select a.status, count(*) count
        from public.alerts a
        where a.organization_id = p_organization_id
          and public.can_access_location(a.location_id)
          and a.created_at >= p_start_at and a.created_at < p_end_at
          and (p_location_id is null or a.location_id = p_location_id)
        group by a.status
      ) alerts
    ), '[]'::jsonb),
    'recent_responses', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'submitted_at', submitted_at,
        'rating', overall_rating, 'normalized_rating', normalized_rating,
        'survey_title', survey_title, 'location_name', location_name,
        'workflow_status', workflow_status
      ) order by submitted_at desc)
      from (
        select s.id, s.submitted_at, s.overall_rating, s.normalized_rating,
               sv.title_en survey_title, l.name_en location_name, s.workflow_status
        from selected s
        join public.surveys sv on sv.id = s.survey_id
        join public.locations l on l.id = s.location_id
        order by s.submitted_at desc limit 10
      ) recent
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

create function public.get_survey_question_analytics(
  p_survey_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_text_limit integer default 20,
  p_text_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_result jsonb;
begin
  select s.organization_id into v_organization_id
  from public.surveys s
  where s.id = p_survey_id and public.can_read_survey(s.id);
  if not found then raise exception 'Survey analytics access denied' using errcode = '42501'; end if;
  perform public.assert_analytics_scope(v_organization_id, p_start_at, p_end_at, null, p_survey_id);
  if p_text_limit not between 1 and 50 or p_text_offset not between 0 and 10000 then
    raise exception 'Invalid text pagination' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'type', q.question_type,
    'label_en', q.prompt_en,
    'label_ar', q.prompt_ar,
    'response_count', (
      select count(*) from public.survey_answers sa
      join public.survey_responses sr on sr.id = sa.response_id
      where sa.question_id = q.id and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
    ),
    'rating', case when q.question_type = 'rating' then jsonb_build_object(
      'average', (select round(avg(sa.rating_value), 2) from public.survey_answers sa
        join public.survey_responses sr on sr.id = sa.response_id
        where sa.question_id = q.id and sa.rating_value is not null
          and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at),
      'median', (select percentile_cont(0.5) within group (order by sa.rating_value)
        from public.survey_answers sa join public.survey_responses sr on sr.id = sa.response_id
        where sa.question_id = q.id and sa.rating_value is not null
          and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at),
      'min', q.rating_min, 'max', q.rating_max,
      'distribution', coalesce((select jsonb_agg(jsonb_build_object('value', value, 'count', count) order by value)
        from (select sa.rating_value value, count(*) count from public.survey_answers sa
          join public.survey_responses sr on sr.id = sa.response_id
          where sa.question_id = q.id and sa.rating_value is not null
            and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
          group by sa.rating_value) d), '[]'::jsonb),
      'trend', coalesce((select jsonb_agg(jsonb_build_object('period', period, 'average', average) order by period)
        from (select to_char(date_trunc('day', sr.submitted_at at time zone 'Asia/Kuwait'), 'YYYY-MM-DD') period,
                     round(avg(sa.rating_value), 2) average
          from public.survey_answers sa join public.survey_responses sr on sr.id = sa.response_id
          where sa.question_id = q.id and sa.rating_value is not null
            and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at group by 1) t), '[]'::jsonb)
    ) end,
    'options', case when q.question_type = 'multiple_choice' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label_en', o.label_en, 'label_ar', o.label_ar,
        'count', (select count(*) from public.survey_answer_choices sac
          join public.survey_answers sa on sa.id = sac.answer_id
          join public.survey_responses sr on sr.id = sa.response_id
          where sac.option_id = o.id and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at),
        'percentage', coalesce(round((select count(*) from public.survey_answer_choices sac
          join public.survey_answers sa on sa.id = sac.answer_id
          join public.survey_responses sr on sr.id = sa.response_id
          where sac.option_id = o.id and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at)::numeric
          * 100 / nullif((select count(*) from public.survey_answers sa
            join public.survey_responses sr on sr.id = sa.response_id
            where sa.question_id = q.id and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at), 0), 2), 0)
      ) order by o.position)
      from public.survey_question_options o where o.question_id = q.id
    ), '[]'::jsonb) end,
    'recent_text_answers', case when q.question_type = 'text' then coalesce((
      select jsonb_agg(jsonb_build_object('response_id', response_id, 'text', text_value, 'submitted_at', submitted_at) order by submitted_at desc)
      from (select sr.id response_id, sa.text_value, sr.submitted_at
        from public.survey_answers sa join public.survey_responses sr on sr.id = sa.response_id
        where sa.question_id = q.id and sa.text_value is not null
          and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
        order by sr.submitted_at desc limit p_text_limit offset p_text_offset) texts
    ), '[]'::jsonb) end
  ) order by q.position), '[]'::jsonb) into v_result
  from public.survey_questions q where q.survey_id = p_survey_id;

  return v_result;
end;
$$;

create function public.update_alert_workflow(
  p_alert_id uuid,
  p_status public.alert_status,
  p_assigned_to uuid default null,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alert public.alerts%rowtype;
begin
  select * into v_alert from public.alerts a
  where a.id = p_alert_id and public.can_manage_alert(a.id) for update;
  if not found then raise exception 'Alert management access denied' using errcode = '42501'; end if;
  if p_assigned_to is not null and not public.user_can_access_location(p_assigned_to, v_alert.location_id) then
    raise exception 'Assignee cannot access this location' using errcode = '22023';
  end if;
  if p_resolution_note is not null and char_length(btrim(p_resolution_note)) > 1000 then
    raise exception 'Resolution note is too long' using errcode = '22023';
  end if;

  update public.alerts set
    status = p_status,
    assigned_to = p_assigned_to,
    resolution_note = nullif(btrim(p_resolution_note), ''),
    acknowledged_by = case when p_status in ('acknowledged', 'resolved') then auth.uid() end,
    acknowledged_at = case when p_status in ('acknowledged', 'resolved') then timezone('utc', now()) end,
    resolved_at = case when p_status = 'resolved' then timezone('utc', now()) end,
    dismissed_at = case when p_status = 'dismissed' then timezone('utc', now()) end
  where id = p_alert_id;
end;
$$;

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
    reviewed_at = case when p_status = 'unread' then null else coalesce(reviewed_at, timezone('utc', now())) end,
    resolved_at = case when p_status = 'resolved' then timezone('utc', now()) end
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

create function public.record_data_export(
  p_organization_id uuid,
  p_export_type text,
  p_filters jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_read_organization(p_organization_id) then
    raise exception 'Export access denied' using errcode = '42501';
  end if;
  if p_export_type not in ('responses', 'response_answers', 'survey_summaries', 'location_summaries', 'alert_reports')
    or octet_length(coalesce(p_filters, '{}'::jsonb)::text) > 4000
  then
    raise exception 'Invalid export request' using errcode = '22023';
  end if;
  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, changed_data
  ) values (
    p_organization_id, auth.uid(), current_user, 'INSERT', 'data_exports',
    jsonb_build_object('export_type', p_export_type, 'filters', coalesce(p_filters, '{}'::jsonb))
  );
end;
$$;

create function public.write_response_workflow_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    new.organization_id, auth.uid(), current_user, 'UPDATE', 'survey_responses', new.id,
    jsonb_build_object(
      'old', jsonb_build_object(
        'workflow_status', old.workflow_status,
        'internal_tags', old.internal_tags,
        'assigned_to', old.assigned_to,
        'reviewed_at', old.reviewed_at,
        'resolved_at', old.resolved_at
      ),
      'new', jsonb_build_object(
        'workflow_status', new.workflow_status,
        'internal_tags', new.internal_tags,
        'assigned_to', new.assigned_to,
        'reviewed_at', new.reviewed_at,
        'resolved_at', new.resolved_at
      )
    )
  );
  return new;
end;
$$;

create trigger survey_responses_workflow_audit
after update on public.survey_responses
for each row execute function public.write_response_workflow_audit();

revoke update on public.survey_responses from authenticated;
revoke update on public.alerts from authenticated;
revoke all on public.response_internal_notes from anon, authenticated;

revoke execute on function public.user_can_access_location(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.can_manage_response(uuid) from public, anon;
revoke execute on function public.assert_analytics_scope(uuid, timestamptz, timestamptz, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.get_analytics_overview(uuid, timestamptz, timestamptz, uuid, uuid, numeric, numeric, public.alert_status, text) from public, anon;
revoke execute on function public.get_survey_question_analytics(uuid, timestamptz, timestamptz, integer, integer) from public, anon;
revoke execute on function public.update_alert_workflow(uuid, public.alert_status, uuid, text) from public, anon;
revoke execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text) from public, anon;
revoke execute on function public.record_data_export(uuid, text, jsonb) from public, anon;

grant execute on function public.can_manage_response(uuid) to authenticated;
grant execute on function public.get_analytics_overview(uuid, timestamptz, timestamptz, uuid, uuid, numeric, numeric, public.alert_status, text) to authenticated;
grant execute on function public.get_survey_question_analytics(uuid, timestamptz, timestamptz, integer, integer) to authenticated;
grant execute on function public.update_alert_workflow(uuid, public.alert_status, uuid, text) to authenticated;
grant execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text) to authenticated;
grant execute on function public.record_data_export(uuid, text, jsonb) to authenticated;
grant select on public.response_internal_notes to authenticated;

comment on function public.get_analytics_overview is
  'Bounded RLS-aware analytics. Cross-scale ratings are normalized to 0-100.';
comment on table public.response_internal_notes is
  'Private staff notes. Never exposed through public survey functions or exports.';
