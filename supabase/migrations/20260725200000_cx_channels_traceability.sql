-- CX Channels Traceability — FK, conversion tracking, analytics RPC, audit
-- Forward-only additive migration. Depends on 20260725000000.

-- ==============================================================================
-- 1. distribution_assignment_id on survey_responses
-- ==============================================================================

alter table public.survey_responses
  add column distribution_assignment_id uuid
    references public.distribution_assignments (id) on delete set null;

create index survey_responses_distribution_assignment_idx
  on public.survey_responses (distribution_assignment_id)
  where distribution_assignment_id is not null;

comment on column public.survey_responses.distribution_assignment_id is
  'Links the response to the exact distribution link/assignment that generated it.';

-- ==============================================================================
-- 2. Add distribution_public_token parameter to submit_public_survey_response
--    so it resolves the assignment, stores its ID, and uses the token as
--    source_identifier.
-- ==============================================================================

create or replace function public.submit_public_survey_response(
  p_public_slug text,
  p_locale public.locale_code,
  p_answers jsonb,
  p_idempotency_key text default null,
  p_channel public.response_channel default 'web',
  p_touchpoint_token text default null,
  p_feedback_mode public.feedback_mode default 'standard',
  p_campaign_id uuid default null,
  p_source_identifier text default null,
  p_employee_reference text default null,
  p_interaction_reference text default null,
  p_distribution_public_token text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_survey public.surveys%rowtype;
  v_response_id uuid;
  v_answer_id uuid;
  v_answer jsonb;
  v_question public.survey_questions%rowtype;
  v_question_id uuid;
  v_option_id uuid;
  v_rating integer;
  v_text text;
  v_overall_rating numeric(4, 2);
  v_touchpoint public.touchpoints%rowtype;
  v_channel public.response_channel;
  v_department_id uuid;
  v_touchpoint_id uuid;
  v_distribution_assignment_id uuid;
  v_resolved_source text;
begin
  if p_feedback_mode != 'quick' then
    if jsonb_typeof(p_answers) <> 'array'
      or jsonb_array_length(p_answers) > 50
    then
      raise exception 'Answers must be a JSON array with at most 50 entries'
        using errcode = '22023';
    end if;
  end if;

  if p_idempotency_key is not null
    and char_length(p_idempotency_key) not between 8 and 128
  then
    raise exception 'Invalid idempotency key' using errcode = '22023';
  end if;

  select s.* into v_survey
  from public.surveys s
  join public.locations l on l.id = s.location_id and l.status = 'active'
  join public.organizations o on o.id = s.organization_id and o.status = 'active'
  where s.public_slug = p_public_slug
    and s.status = 'active';

  if not found then
    raise exception 'Published survey not found' using errcode = 'P0002';
  end if;

  -- Resolve distribution assignment if a public token was provided
  if p_distribution_public_token is not null then
    select da.id into v_distribution_assignment_id
    from public.distribution_assignments da
    where da.public_token = p_distribution_public_token
      and da.organization_id = v_survey.organization_id
      and da.status = 'active';

    -- If found and no explicit source_identifier was given, use the token
    if found and p_source_identifier is null then
      v_resolved_source := p_distribution_public_token;
    else
      v_resolved_source := p_source_identifier;
    end if;
  else
    v_resolved_source := p_source_identifier;
  end if;

  -- Resolve touchpoint for channel/department context
  if p_touchpoint_token is not null then
    select t.* into v_touchpoint
    from public.touchpoints t
    where t.public_token = p_touchpoint_token
      and t.organization_id = v_survey.organization_id
      and t.location_id = v_survey.location_id
      and t.status = 'active';

    if not found then
      raise exception 'Touchpoint not found for this survey' using errcode = 'P0002';
    end if;

    if v_touchpoint.survey_id is not null and v_touchpoint.survey_id <> v_survey.id then
      raise exception 'Touchpoint is not bound to this survey' using errcode = '22023';
    end if;

    v_touchpoint_id := v_touchpoint.id;
    v_department_id := v_touchpoint.department_id;
    v_channel := v_touchpoint.channel;
  else
    v_channel := p_channel;
  end if;

  -- Idempotency check
  if p_idempotency_key is not null then
    select sr.id into v_response_id
    from public.survey_responses sr
    where sr.survey_id = v_survey.id
      and sr.idempotency_key = p_idempotency_key;

    if found then
      return v_response_id;
    end if;
  end if;

  -- Quick feedback mode: skip standard question validation
  if p_feedback_mode != 'quick' then
    if (
      select count(*)
      from jsonb_array_elements(p_answers) item
    ) <> (
      select count(distinct item ->> 'question_id')
      from jsonb_array_elements(p_answers) item
    ) then
      raise exception 'Each question may be answered only once'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from jsonb_array_elements(p_answers) item
      left join public.survey_questions q
        on q.id = case
          when (item ->> 'question_id') ~* '^[0-9a-f-]{36}$'
            then (item ->> 'question_id')::uuid
          else null
        end
        and q.survey_id = v_survey.id
        and q.status = 'active'
      where q.id is null
    ) then
      raise exception 'Answer references an invalid question'
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.survey_questions q
      where q.survey_id = v_survey.id
        and q.status = 'active'
        and q.is_required
        and not exists (
          select 1
          from jsonb_array_elements(p_answers) item
          where item ->> 'question_id' = q.id::text
        )
    ) then
      raise exception 'A required question is missing'
        using errcode = '22023';
    end if;
  end if;

  -- Insert the response record with the distribution assignment FK
  insert into public.survey_responses (
    survey_id,
    organization_id,
    location_id,
    locale,
    idempotency_key,
    channel,
    department_id,
    touchpoint_id,
    feedback_mode,
    campaign_id,
    source_identifier,
    employee_reference,
    interaction_reference,
    distribution_assignment_id
  ) values (
    v_survey.id,
    v_survey.organization_id,
    v_survey.location_id,
    p_locale,
    p_idempotency_key,
    v_channel,
    v_department_id,
    v_touchpoint_id,
    p_feedback_mode,
    p_campaign_id,
    nullif(btrim(coalesce(v_resolved_source, '')), ''),
    nullif(btrim(coalesce(p_employee_reference, '')), ''),
    nullif(btrim(coalesce(p_interaction_reference, '')), ''),
    v_distribution_assignment_id
  )
  returning id into v_response_id;

  -- Skip standard answer processing in quick feedback mode
  if p_feedback_mode = 'quick' then
    return v_response_id;
  end if;

  -- Process standard answers (unchanged)
  for v_answer in
    select value from jsonb_array_elements(p_answers)
  loop
    v_question_id := (v_answer ->> 'question_id')::uuid;

    select * into strict v_question
    from public.survey_questions q
    where q.id = v_question_id
      and q.survey_id = v_survey.id
      and q.status = 'active';

    case v_question.question_type
      when 'rating' then
        if jsonb_typeof(v_answer -> 'rating') <> 'number'
          or (v_answer ->> 'rating') !~ '^-?[0-9]+$'
        then
          raise exception 'Rating answer must be an integer'
            using errcode = '22023';
        end if;

        v_rating := (v_answer ->> 'rating')::integer;

        if v_question.rating_scale is not null
          and not exists (
            select 1 from public.rating_scale_points rsp
            where rsp.scale_key = v_question.rating_scale
              and rsp.value = v_rating
          )
        then
          raise exception 'Rating answer is not a valid scale point'
            using errcode = '22023';
        end if;

        insert into public.survey_answers (
          response_id, survey_id, organization_id, question_id, rating_value
        ) values (
          v_response_id, v_survey.id, v_survey.organization_id, v_question.id, v_rating
        );

      when 'text' then
        if jsonb_typeof(v_answer -> 'text') <> 'string' then
          raise exception 'Text answer must be a string'
            using errcode = '22023';
        end if;

        v_text := btrim(v_answer ->> 'text');

        if char_length(v_text) = 0
          or char_length(v_text) > v_question.text_max_length
        then
          raise exception 'Text answer length is invalid'
            using errcode = '22023';
        end if;

        insert into public.survey_answers (
          response_id, survey_id, organization_id, question_id, text_value
        ) values (
          v_response_id, v_survey.id, v_survey.organization_id, v_question.id, v_text
        );

      when 'multiple_choice' then
        if jsonb_typeof(v_answer -> 'option_ids') <> 'array'
          or jsonb_array_length(v_answer -> 'option_ids') = 0
          or (
            not v_question.allow_multiple
            and jsonb_array_length(v_answer -> 'option_ids') <> 1
          )
        then
          raise exception 'Option selection is invalid'
            using errcode = '22023';
        end if;

        insert into public.survey_answers (
          response_id, survey_id, organization_id, question_id
        ) values (
          v_response_id, v_survey.id, v_survey.organization_id, v_question.id
        ) returning id into v_answer_id;

        for v_option_id in
          select value::text::uuid
          from jsonb_array_elements_text(v_answer -> 'option_ids')
        loop
          if not exists (
            select 1
            from public.survey_question_options sqo
            where sqo.id = v_option_id
              and sqo.question_id = v_question.id
              and sqo.is_active
          ) then
            raise exception 'Option does not belong to the question'
              using errcode = '22023';
          end if;

          insert into public.survey_answer_choices (
            answer_id, option_id, question_id
          ) values (
            v_answer_id, v_option_id, v_question.id
          );
        end loop;
    end case;
  end loop;

  -- Normalize concerns from concern-linked options
  insert into public.response_concerns (
    response_id, organization_id, survey_id, concern_category_id, is_primary
  )
  select
    v_response_id,
    v_survey.organization_id,
    v_survey.id,
    ranked.concern_category_id,
    ranked.rn = 1
  from (
    select
      sqo.concern_category_id,
      row_number() over (order by min(q.position), min(sqo.position)) as rn
    from public.survey_answers sa
    join public.survey_answer_choices sac on sac.answer_id = sa.id
    join public.survey_question_options sqo on sqo.id = sac.option_id
    join public.survey_questions q on q.id = sa.question_id
    where sa.response_id = v_response_id
      and sqo.concern_category_id is not null
    group by sqo.concern_category_id
  ) ranked
  on conflict (response_id, concern_category_id) do nothing;

  -- Compute overall_rating from rating answers
  select round(avg(sa.rating_value)::numeric, 2)
  into v_overall_rating
  from public.survey_answers sa
  join public.survey_questions q on q.id = sa.question_id
  where sa.response_id = v_response_id
    and q.question_type = 'rating';

  update public.survey_responses
  set overall_rating = v_overall_rating
  where id = v_response_id;

  return v_response_id;
exception
  when unique_violation then
    if p_idempotency_key is not null then
      select sr.id into v_response_id
      from public.survey_responses sr
      where sr.survey_id = v_survey.id
        and sr.idempotency_key = p_idempotency_key;

      if found then
        return v_response_id;
      end if;
    end if;
    raise;
end;
$$;

-- Also update the wrapper that anon calls
create or replace function public.submit_protected_survey_response(
  p_public_slug text,
  p_locale public.locale_code,
  p_answers jsonb,
  p_idempotency_key text,
  p_fingerprint_hash text,
  p_channel public.response_channel default 'web',
  p_touchpoint_token text default null,
  p_feedback_mode public.feedback_mode default 'standard',
  p_campaign_id uuid default null,
  p_source_identifier text default null,
  p_employee_reference text default null,
  p_interaction_reference text default null,
  p_distribution_public_token text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_survey_id uuid;
  v_existing_id uuid;
  v_response_id uuid;
begin
  if coalesce(jsonb_typeof(p_answers), '') <> 'array' then
    raise exception 'Answers must be an array' using errcode = '22023';
  end if;
  if p_feedback_mode != 'quick' and jsonb_array_length(p_answers) > 50 then
    raise exception 'Too many answers' using errcode = '22023';
  end if;

  select s.id into v_survey_id
  from public.surveys s
  where s.public_slug = p_public_slug and s.status = 'active';

  if found then
    select sr.id into v_existing_id
    from public.survey_responses sr
    where sr.survey_id = v_survey_id and sr.idempotency_key = p_idempotency_key;
  end if;

  if v_existing_id is not null then
    return jsonb_build_object('response_id', v_existing_id, 'duplicate', true);
  end if;

  if not public.consume_public_submission_rate_limit(
    p_public_slug,
    p_fingerprint_hash,
    5,
    900
  ) then
    raise exception 'Submission rate limit exceeded' using errcode = 'P0001';
  end if;

  v_response_id := public.submit_public_survey_response(
    p_public_slug, p_locale, p_answers, p_idempotency_key,
    p_channel, p_touchpoint_token, p_feedback_mode,
    p_campaign_id, p_source_identifier, p_employee_reference,
    p_interaction_reference, p_distribution_public_token
  );

  return jsonb_build_object('response_id', v_response_id, 'duplicate', false);
end;
$$;

-- Grants for updated signatures
revoke execute on function public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text
) from public, anon, authenticated;

revoke execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text
) from public, authenticated;

grant execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text
) to anon;

-- ==============================================================================
-- 3. record_distribution_conversion — update to increment assign count + log event
-- ==============================================================================

create or replace function public.record_distribution_conversion(
  p_public_token text,
  p_response_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
begin
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token and status = 'active';

  if not found then
    return;
  end if;

  update public.distribution_assignments
  set response_count = response_count + 1,
      last_response_at = timezone('utc', now())
  where id = v_assignment.id;

  insert into public.distribution_link_events (
    assignment_id, organization_id, event_type, response_id
  ) values (
    v_assignment.id, v_assignment.organization_id, 'conversion', p_response_id
  );
end;
$$;

grant execute on function public.record_distribution_conversion(text, uuid) to authenticated;

-- ==============================================================================
-- 4. get_distribution_analytics — tenant-scoped comprehensive RPC
-- ==============================================================================

create or replace function public.get_distribution_analytics(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_channel text default null,
  p_template_id uuid default null,
  p_campaign_id uuid default null,
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

  with scoped_assignments as (
    select da.*, dt.channel, dt.template_name
    from public.distribution_assignments da
    join public.distribution_templates dt on dt.id = da.template_id
    where da.organization_id = p_organization_id
      and (p_channel is null or dt.channel = p_channel::public.response_channel)
      and (p_template_id is null or da.template_id = p_template_id)
      and (p_campaign_id is null or da.campaign_id = p_campaign_id)
      and (p_location_id is null or
        da.assigned_location_id = p_location_id or
        exists (
          select 1 from public.location_memberships lm
          where lm.user_id = da.assigned_employee_id
            and lm.location_id = p_location_id
        ))
  ), assignment_stats as (
    select
      count(*)::integer as total_assignments,
      count(*) filter (where status = 'active')::integer as active_assignments,
      coalesce(sum(click_count), 0)::integer as total_clicks,
      coalesce(sum(response_count), 0)::integer as total_conversions
    from scoped_assignments
  ), channel_stats as (
    select
      channel,
      count(*)::integer as assignments,
      coalesce(sum(click_count), 0)::integer as clicks,
      coalesce(sum(response_count), 0)::integer as conversions
    from scoped_assignments
    group by channel
  ), response_stats as (
    select
      count(*)::integer as total_responses,
      count(*) filter (where overall_rating is not null)::integer as rated_responses,
      round(avg(overall_rating), 2) as average_rating,
      count(*) filter (where overall_rating >= 7)::integer as positive_count,
      count(*) filter (where overall_rating <= 4)::integer as negative_count,
      count(*) filter (where feedback_mode = 'quick')::integer as quick_feedback_count,
      count(*) filter (where feedback_mode = 'quick' and followed_up)::integer as followup_count,
      count(*) filter (where exists (
        select 1 from public.alerts a where a.response_id = survey_responses.id
      ))::integer as alerts_triggered,
      count(*) filter (where exists (
        select 1 from public.investigation_responses ir where ir.response_id = survey_responses.id
      ))::integer as investigations_created
    from public.survey_responses
    where organization_id = p_organization_id
      and channel in (select distinct channel from scoped_assignments)
      and submitted_at >= p_start_at and submitted_at < p_end_at
      and (p_location_id is null or location_id = p_location_id)
  ), click_events as (
    select
      count(*) filter (where event_type = 'click')::integer as total_clicks,
      count(*) filter (where event_type = 'conversion')::integer as total_conversions,
      count(*) filter (where event_type = 'expired_click')::integer as expired_clicks,
      count(*) filter (where event_type = 'invalid_token')::integer as invalid_token_clicks
    from public.distribution_link_events
    where organization_id = p_organization_id
      and created_at >= p_start_at and created_at < p_end_at
  )
  select jsonb_build_object(
    'total_assignments', (select total_assignments from assignment_stats),
    'active_assignments', (select active_assignments from assignment_stats),
    'total_clicks', (select total_clicks from click_events),
    'total_conversions', (select total_conversions from click_events),
    'expired_clicks', (select expired_clicks from click_events),
    'invalid_token_clicks', (select invalid_token_clicks from click_events),
    'click_to_conversion_rate', case when (select total_clicks from click_events) > 0
      then round((select total_conversions from click_events)::numeric / (select total_clicks from click_events) * 100, 2)
      else null end,
    'by_channel', coalesce((
      select jsonb_agg(jsonb_build_object(
        'channel', channel,
        'assignments', assignments,
        'clicks', clicks,
        'conversions', conversions,
        'conversion_rate', case when clicks > 0 then round(conversions::numeric / clicks * 100, 2) else null end
      ) order by channel)
      from channel_stats
    ), '[]'::jsonb),
    'response_metrics', jsonb_build_object(
      'total_responses', (select total_responses from response_stats),
      'rated_responses', (select rated_responses from response_stats),
      'average_rating', (select average_rating from response_stats),
      'positive_count', (select positive_count from response_stats),
      'negative_count', (select negative_count from response_stats),
      'satisfaction_pct', case when (select rated_responses from response_stats) > 0
        then round((select positive_count from response_stats)::numeric / (select rated_responses from response_stats) * 100, 2)
        else null end,
      'quick_feedback_count', (select quick_feedback_count from response_stats),
      'followup_count', (select followup_count from response_stats),
      'alerts_triggered', (select alerts_triggered from response_stats),
      'investigations_created', (select investigations_created from response_stats)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke execute on function public.get_distribution_analytics(
  uuid, timestamptz, timestamptz, text, uuid, uuid, uuid
) from public, anon;
grant execute on function public.get_distribution_analytics(
  uuid, timestamptz, timestamptz, text, uuid, uuid, uuid
) to authenticated;

comment on function public.get_distribution_analytics is
  'Tenant-scoped distribution analytics with channel, template, campaign, and location filters. Covers assignments, clicks, conversions, response KPIs, and downstream workflow.';

-- ==============================================================================
-- 5. Audit triggers on distribution_templates and distribution_assignments
-- ==============================================================================

create or replace function public.write_distribution_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table_name text;
  v_diff jsonb;
begin
  v_table_name := tg_table_name;

  if tg_op = 'INSERT' then
    v_diff := jsonb_build_object(
      'id', new.id,
      'channel', new.channel,
      'template_name', new.template_name,
      'is_active', new.is_active
    );
  elsif tg_op = 'UPDATE' then
    v_diff := jsonb_build_object(
      'old', jsonb_strip_nulls(jsonb_build_object(
        'template_name', old.template_name,
        'is_active', old.is_active,
        'status', old.status,
        'is_default', old.is_default
      )),
      'new', jsonb_strip_nulls(jsonb_build_object(
        'template_name', new.template_name,
        'is_active', new.is_active,
        'status', new.status,
        'is_default', new.is_default
      ))
    );
  elsif tg_op = 'DELETE' then
    v_diff := jsonb_build_object(
      'id', old.id,
      'template_name', old.template_name,
      'channel', old.channel
    );
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    coalesce(new.organization_id, old.organization_id),
    auth.uid(),
    current_user,
    tg_op,
    v_table_name,
    coalesce(new.id, old.id),
    coalesce(v_diff, '{}'::jsonb)
  );

  return coalesce(new, old);
end;
$$;

create trigger distribution_templates_audit
  after insert or update or delete on public.distribution_templates
  for each row execute function public.write_distribution_audit();

create trigger distribution_assignments_audit
  after insert or update or delete on public.distribution_assignments
  for each row execute function public.write_distribution_audit();

-- ==============================================================================
-- 6. Grants
-- ==============================================================================

grant usage on type public.feedback_mode to anon, authenticated;
grant usage on type public.escalation_trigger to authenticated;
grant usage on type public.signature_layout to authenticated;
