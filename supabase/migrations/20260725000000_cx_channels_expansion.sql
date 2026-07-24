-- CX Channels Expansion — Quick Feedback + Email Signature Surveys + Escalation Rules
-- Forward-only additive migration.

-- ==============================================================================
-- 1. Enum extensions
-- ==============================================================================

-- Add new channels for the expanded CX approach
alter type public.response_channel add value 'email' before 'kiosk';
alter type public.response_channel add value 'walk_in';
alter type public.response_channel add value 'website';
alter type public.response_channel add value 'phone';
alter type public.response_channel add value 'whatsapp';
alter type public.response_channel add value 'tablet';
alter type public.response_channel add value 'sms';

-- New enum to distinguish standard surveys from quick (1-tap) feedback
create type public.feedback_mode as enum ('standard', 'quick');

-- Escalation trigger types for the smart escalation engine
create type public.escalation_trigger as enum (
  'rating_threshold',
  'keywords',
  'negative_sentiment'
);

-- ==============================================================================
-- 2. Survey table — quick feedback configuration
-- ==============================================================================

alter table public.surveys
  add column quick_feedback_enabled boolean not null default false,
  add column quick_feedback_rating_style text not null default 'emoji'
    check (quick_feedback_rating_style in ('emoji', 'star', 'numeric')),
  add column quick_feedback_positive_threshold integer not null default 4
    check (quick_feedback_positive_threshold between 1 and 5),
  add column quick_feedback_negative_threshold integer not null default 3
    check (quick_feedback_negative_threshold between 1 and 5),
  add column escalation_enabled boolean not null default false,
  add column escalation_threshold integer
    check (escalation_threshold between 1 and 5),
  add column escalation_keywords text[]
    check (escalation_keywords is null or cardinality(escalation_keywords) <= 20),
  add column quick_feedback_categories jsonb not null default '[
    {"id":"waiting_time","label_en":"Waiting time","label_ar":"وقت الانتظار"},
    {"id":"staff","label_en":"Staff","label_ar":"الموظفين"},
    {"id":"cleanliness","label_en":"Cleanliness","label_ar":"النظافة"},
    {"id":"product","label_en":"Product","label_ar":"المنتج"},
    {"id":"service","label_en":"Service","label_ar":"الخدمة"},
    {"id":"other","label_en":"Other","label_ar":"أخرى"}
  ]'::jsonb;

-- ==============================================================================
-- 3. Survey responses — mode, campaign, and source tracking
-- ==============================================================================

alter table public.survey_responses
  add column feedback_mode public.feedback_mode not null default 'standard',
  add column campaign_id uuid,
  add column source_identifier text
    check (source_identifier is null or char_length(source_identifier) between 1 and 100),
  add column employee_reference text
    check (employee_reference is null or char_length(employee_reference) between 1 and 100),
  add column interaction_reference text
    check (interaction_reference is null or char_length(interaction_reference) between 1 and 100);

-- ==============================================================================
-- 4. Campaigns table (for grouping email signature distributions)
-- ==============================================================================

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  survey_id uuid not null,
  name_en text not null check (char_length(name_en) between 1 and 200),
  name_ar text not null check (char_length(name_ar) between 1 and 200),
  channel public.response_channel not null default 'qr',
  status public.entity_status not null default 'active',
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint campaigns_survey_scope_fkey
    foreign key (survey_id, organization_id)
    references public.surveys (id, organization_id)
    on delete cascade
);

create index campaigns_organization_idx on public.campaigns (organization_id, status);
create index campaigns_survey_idx on public.campaigns (survey_id);

-- ==============================================================================
-- 5. Escalation rules table (smart escalation engine)
-- ==============================================================================

create table public.escalation_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  survey_id uuid,
  location_id uuid,
  trigger_type public.escalation_trigger not null,
  threshold_value integer,
  keywords text[],
  auto_create_alert boolean not null default true,
  auto_assign_investigation boolean not null default false,
  auto_notify_manager boolean not null default false,
  severity public.alert_severity not null default 'medium',
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index escalation_rules_organization_idx on public.escalation_rules (organization_id, is_active);

-- ==============================================================================
-- 6. Indexes for new survey_responses columns
-- ==============================================================================

create index survey_responses_feedback_mode_idx
  on public.survey_responses (organization_id, feedback_mode, submitted_at desc);
create index survey_responses_campaign_idx
  on public.survey_responses (campaign_id, submitted_at desc)
  where campaign_id is not null;
create index survey_responses_source_idx
  on public.survey_responses (organization_id, source_identifier, submitted_at desc)
  where source_identifier is not null;

-- ==============================================================================
-- 7. Updated get_public_survey — expose quick feedback config
-- ==============================================================================

create or replace function public.get_public_survey(p_public_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'public_slug', s.public_slug,
    'survey_type', s.survey_type,
    'title', jsonb_build_object('en', s.title_en, 'ar', s.title_ar),
    'description', jsonb_build_object('en', s.description_en, 'ar', s.description_ar),
    'thank_you', jsonb_build_object('en', coalesce(s.thank_you_en, o.default_thank_you_en), 'ar', coalesce(s.thank_you_ar, o.default_thank_you_ar)),
    'default_locale', s.default_locale,
    'organization', jsonb_build_object(
      'name', jsonb_build_object('en', o.name_en, 'ar', o.name_ar),
      'branding', jsonb_build_object('primary_color', o.primary_color, 'accent_color', o.accent_color,
        'logo_path', o.logo_path, 'header_style', o.survey_header_style,
        'footer', jsonb_build_object('en', o.footer_text_en, 'ar', o.footer_text_ar))
    ),
    'location', jsonb_build_object('name', jsonb_build_object('en', l.name_en, 'ar', l.name_ar)),
    -- Quick feedback configuration
    'quick_feedback_enabled', s.quick_feedback_enabled,
    'quick_feedback_rating_style', s.quick_feedback_rating_style,
    'quick_feedback_positive_threshold', s.quick_feedback_positive_threshold,
    'quick_feedback_negative_threshold', s.quick_feedback_negative_threshold,
    'quick_feedback_categories', coalesce(s.quick_feedback_categories, '[]'::jsonb),
    'escalation_enabled', s.escalation_enabled,
    'rating_scales', coalesce((
      select jsonb_object_agg(rs.key, jsonb_build_object(
        'name', jsonb_build_object('en', rs.name_en, 'ar', rs.name_ar),
        'scale_min', rs.scale_min, 'scale_max', rs.scale_max,
        'satisfied_min', rs.satisfied_min, 'negative_max', rs.negative_max,
        'points', coalesce((
          select jsonb_agg(jsonb_build_object(
            'value', rsp.value,
            'position', rsp.position,
            'label', jsonb_build_object('en', rsp.label_en, 'ar', rsp.label_ar)
          ) order by rsp.position)
          from public.rating_scale_points rsp where rsp.scale_key = rs.key
        ), '[]'::jsonb)
      ))
      from public.rating_scales rs
      where rs.is_active
        and rs.key in (
          select distinct q.rating_scale
          from public.survey_questions q
          where q.survey_id = s.id and q.status = 'active' and q.rating_scale is not null
        )
    ), '{}'::jsonb),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'type', q.question_type, 'position', q.position,
      'prompt', jsonb_build_object('en', q.prompt_en, 'ar', q.prompt_ar),
      'help_text', jsonb_build_object('en', q.help_text_en, 'ar', q.help_text_ar),
      'required', q.is_required, 'rating_min', q.rating_min, 'rating_max', q.rating_max,
      'rating_scale', q.rating_scale,
      'allow_multiple', q.allow_multiple, 'text_max_length', q.text_max_length,
      'options', case when q.question_type = 'multiple_choice' then coalesce((
        select jsonb_agg(jsonb_build_object('id', so.id, 'position', so.position,
          'concern_category_id', so.concern_category_id,
          'label', jsonb_build_object('en', so.label_en, 'ar', so.label_ar)) order by so.position)
        from public.survey_question_options so where so.question_id = q.id and so.is_active
      ), '[]'::jsonb) else '[]'::jsonb end
    ) order by q.position) from public.survey_questions q where q.survey_id = s.id and q.status = 'active'), '[]'::jsonb)
  ) into v_result
  from public.surveys s join public.locations l on l.id = s.location_id
  join public.organizations o on o.id = s.organization_id
  where s.public_slug = p_public_slug and s.status = 'active' and l.status = 'active' and o.status = 'active';
  if v_result is null then raise exception 'Published survey not found' using errcode = 'P0002'; end if;
  return v_result;
end;
$$;

-- ==============================================================================
-- 8. Updated submit_public_survey_response — accept new tracking parameters
-- ==============================================================================

drop function if exists public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text
);
drop function if exists public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text
);

create function public.submit_public_survey_response(
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
  p_interaction_reference text default null
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
begin
  -- In quick feedback mode we allow empty answers array (the rating is stored
  -- differently via the quick feedback parameters)
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

  -- Resolve the capture context.
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

  -- Insert the response record with all tracking fields
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
    interaction_reference
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
    nullif(btrim(coalesce(p_source_identifier, '')), ''),
    nullif(btrim(coalesce(p_employee_reference, '')), ''),
    nullif(btrim(coalesce(p_interaction_reference, '')), '')
  )
  returning id into v_response_id;

  -- Skip standard answer processing in quick feedback mode
  if p_feedback_mode = 'quick' then
    -- In quick mode, the overall_rating is set based on the response_payload
    -- processed at the application layer. We'll update after the trigger runs.
    -- The actual overall_rating value will be set by a separate UPDATE from
    -- the application which receives the response_id.
    return v_response_id;
  end if;

  -- Process standard answers (existing logic unchanged)
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

-- ==============================================================================
-- 9. Updated submit_protected_survey_response — pass through new parameters
-- ==============================================================================

create function public.submit_protected_survey_response(
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
  p_interaction_reference text default null
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
    p_public_slug,
    p_locale,
    p_answers,
    p_idempotency_key,
    p_channel,
    p_touchpoint_token,
    p_feedback_mode,
    p_campaign_id,
    p_source_identifier,
    p_employee_reference,
    p_interaction_reference
  );

  return jsonb_build_object('response_id', v_response_id, 'duplicate', false);
end;
$$;

-- ==============================================================================
-- 10. Escalation evaluation trigger
-- ==============================================================================

create or replace function public.evaluate_escalation_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule record;
begin
  -- Only evaluate escalation rules for quick feedback responses
  if new.feedback_mode != 'quick' then
    return new;
  end if;

  for v_rule in
    select * from public.escalation_rules
    where organization_id = new.organization_id
      and is_active = true
      and (survey_id is null or survey_id = new.survey_id)
      and (location_id is null or location_id = new.location_id)
  loop
    -- Rating threshold trigger
    if v_rule.trigger_type = 'rating_threshold'
      and new.overall_rating is not null
      and new.overall_rating <= v_rule.threshold_value
    then
      if v_rule.auto_create_alert then
        insert into public.alerts (
          organization_id, location_id, response_id, alert_type, status,
          severity, rating_value, threshold_value, message
        ) values (
          new.organization_id, new.location_id, new.id, 'low_score', 'open',
          v_rule.severity, new.overall_rating, v_rule.threshold_value,
          format(
            'Quick feedback rating %s triggered escalation threshold %s',
            new.overall_rating, v_rule.threshold_value
          )
        );
      end if;
    end if;
  end loop;

  return new;
end;
$$;

create trigger survey_responses_evaluate_escalation
  after insert on public.survey_responses
  for each row execute function public.evaluate_escalation_rules();

-- ==============================================================================
-- 11. Updated get_kpi_dashboard — accept feedback_mode and channel filters
-- ==============================================================================

create or replace function public.get_kpi_dashboard(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null,
  p_feedback_mode public.feedback_mode default null,
  p_channel text default null
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
      and (p_feedback_mode is null or sr.feedback_mode = p_feedback_mode)
      and (p_channel is null or sr.channel = p_channel::public.response_channel)
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
      cc.slug, cc.name_en, cc.name_ar, count(*)::integer as response_count
    from scoped s
    join public.response_concerns rc on rc.response_id = s.id and rc.is_primary
    join public.concern_categories cc on cc.id = rc.concern_category_id
    group by cc.slug, cc.name_en, cc.name_ar
    order by response_count desc
    limit 5
  ),
  location_kpis as (
    select
      l.id, l.name_en, l.name_ar,
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
      d.id, d.name_en, d.name_ar,
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

-- ==============================================================================
-- 12. Updated get_analytics_overview — add feedback_mode and channel filters
-- ==============================================================================

create or replace function public.get_analytics_overview(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null,
  p_survey_id uuid default null,
  p_rating_min numeric default null,
  p_rating_max numeric default null,
  p_alert_status public.alert_status default null,
  p_bucket text default 'day',
  p_feedback_mode public.feedback_mode default null,
  p_channel text default null
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
      and (p_feedback_mode is null or sr.feedback_mode = p_feedback_mode)
      and (p_channel is null or sr.channel = p_channel::public.response_channel)
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
      l.id, l.name_en, l.name_ar,
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

-- ==============================================================================
-- 13. Quick Feedback Analytics RPC
-- ==============================================================================

create function public.get_quick_feedback_analytics(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_location_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);
  return jsonb_build_object(
    'quick_feedback_count', (select count(*)::integer from public.survey_responses
      where organization_id = p_organization_id
        and feedback_mode = 'quick'
        and (p_location_id is null or location_id = p_location_id)
        and submitted_at >= p_start_at and submitted_at < p_end_at),
    'positive_pct', (select
      case when count(*) > 0
        then round(count(*) filter (where overall_rating >= 4)::numeric / count(*) * 100, 2)
        else null end
      from public.survey_responses
      where organization_id = p_organization_id
        and feedback_mode = 'quick'
        and overall_rating is not null
        and (p_location_id is null or location_id = p_location_id)
        and submitted_at >= p_start_at and submitted_at < p_end_at),
    'rating_distribution', coalesce((
      select jsonb_agg(jsonb_build_object('rating', rating, 'count', count) order by rating)
      from (
        select overall_rating::integer as rating, count(*)::integer as count
        from public.survey_responses
        where organization_id = p_organization_id
          and feedback_mode = 'quick'
          and overall_rating is not null
          and (p_location_id is null or location_id = p_location_id)
          and submitted_at >= p_start_at and submitted_at < p_end_at
        group by overall_rating
      ) d
    ), '[]'::jsonb)
  );
end;
$$;

-- ==============================================================================
-- 14. Create a function to update overall_rating for quick feedback responses
--     (called by the application layer after receiving the response_id)
-- ==============================================================================

create function public.update_quick_feedback_rating(
  p_response_id uuid,
  p_rating integer
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'Quick feedback rating must be between 1 and 5' using errcode = '22023';
  end if;

  update public.survey_responses
  set overall_rating = p_rating::numeric(4,2)
  where id = p_response_id
    and feedback_mode = 'quick';

  if not found then
    raise exception 'Quick feedback response not found' using errcode = 'P0002';
  end if;
end;
$$;

-- ==============================================================================
-- 15. RLS Policies
-- ==============================================================================

-- Campaigns RLS
alter table public.campaigns enable row level security;
alter table public.campaigns force row level security;

create policy campaigns_platform_admin_all
  on public.campaigns for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy campaigns_read_permitted
  on public.campaigns for select to authenticated
  using (public.can_read_organization(organization_id));

create policy campaigns_write_permitted
  on public.campaigns for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- Escalation Rules RLS
alter table public.escalation_rules enable row level security;
alter table public.escalation_rules force row level security;

create policy escalation_rules_platform_admin_all
  on public.escalation_rules for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy escalation_rules_read_permitted
  on public.escalation_rules for select to authenticated
  using (public.can_read_organization(organization_id));

create policy escalation_rules_write_permitted
  on public.escalation_rules for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- ==============================================================================
-- 16. Grants
-- ==============================================================================

grant select, insert, update, delete on public.campaigns to authenticated;
grant select, insert, update, delete on public.escalation_rules to authenticated;

grant usage on type public.feedback_mode to anon, authenticated;
grant usage on type public.escalation_trigger to authenticated;

-- Reissue grants for updated RPC signatures
revoke execute on function public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text
) from public, anon, authenticated;

revoke execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text
) from public, authenticated;

grant execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text
) to anon;

-- KPI / analytics RPC grants
revoke execute on function public.get_kpi_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, public.feedback_mode, text
) from public, anon;
grant execute on function public.get_kpi_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, public.feedback_mode, text
) to authenticated;

revoke execute on function public.get_analytics_overview(
  uuid, timestamptz, timestamptz, uuid, uuid, numeric, numeric,
  public.alert_status, text, public.feedback_mode, text
) from public, anon;
grant execute on function public.get_analytics_overview(
  uuid, timestamptz, timestamptz, uuid, uuid, numeric, numeric,
  public.alert_status, text, public.feedback_mode, text
) to authenticated;

-- Quick feedback analytics
revoke execute on function public.get_quick_feedback_analytics(
  uuid, timestamptz, timestamptz, uuid
) from public, anon;
grant execute on function public.get_quick_feedback_analytics(
  uuid, timestamptz, timestamptz, uuid
) to authenticated;

-- Quick feedback rating update
revoke execute on function public.update_quick_feedback_rating(
  uuid, integer
) from public, anon;
grant execute on function public.update_quick_feedback_rating(
  uuid, integer
) to authenticated;

-- ==============================================================================
-- 17. Distribution system — generic templates, assignments, events
-- ==============================================================================

create type public.signature_layout as enum ('horizontal', 'vertical', 'minimal', 'branded');

-- Distribution templates: channel-specific rendering configs for any channel
create table public.distribution_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  channel public.response_channel not null,
  template_name text not null check (char_length(template_name) between 1 and 200),
  description text check (description is null or char_length(description) <= 500),
  is_active boolean not null default true,
  is_default boolean not null default false,
  -- Shared behavioral config (across all channels)
  config jsonb not null default '{}'::jsonb,
  -- Channel-specific rendering config (structure varies by channel)
  render_config jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint dt_org_channel_name_unique unique (organization_id, channel, template_name),
  constraint dt_id_org_unique unique (id, organization_id)
);

create index dt_org_channel_idx on public.distribution_templates (organization_id, channel, is_active);

-- Distribution assignments: who/what gets a link, with polymorphic target
create table public.distribution_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  template_id uuid not null,
  survey_id uuid not null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  -- Polymorphic target: exactly one should be non-null
  assigned_employee_id uuid references auth.users (id) on delete set null,
  assigned_location_id uuid references public.locations (id) on delete set null,
  assigned_touchpoint_id uuid references public.touchpoints (id) on delete set null,
  -- Link identity
  public_token text not null unique
    default encode(extensions.gen_random_bytes(18), 'hex')
    check (char_length(public_token) between 24 and 128),
  status text not null default 'active' check (status in ('active', 'paused', 'expired', 'revoked')),
  expires_at timestamptz,
  -- Frozen attribution context (snapshotted at creation time)
  metadata jsonb not null default '{}'::jsonb,
  -- Tracking counters
  click_count integer not null default 0,
  response_count integer not null default 0,
  last_clicked_at timestamptz,
  last_response_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint da_template_org_fkey
    foreign key (template_id, organization_id)
    references public.distribution_templates (id, organization_id)
    on delete cascade,
  constraint da_survey_org_fkey
    foreign key (survey_id, organization_id)
    references public.surveys (id, organization_id)
    on delete cascade,
  constraint da_single_target_check check (
    (assigned_employee_id is not null)::integer
    + (assigned_location_id is not null)::integer
    + (assigned_touchpoint_id is not null)::integer
    = 1
  )
);

create index da_org_status_idx on public.distribution_assignments (organization_id, status);
create index da_employee_idx on public.distribution_assignments (assigned_employee_id) where assigned_employee_id is not null;
create index da_location_idx on public.distribution_assignments (assigned_location_id) where assigned_location_id is not null;
create index da_touchpoint_idx on public.distribution_assignments (assigned_touchpoint_id) where assigned_touchpoint_id is not null;
create index da_token_idx on public.distribution_assignments (public_token);

-- Distribution link events: append-only click/conversion tracking
create table public.distribution_link_events (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.distribution_assignments (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  event_type text not null check (event_type in ('click', 'conversion', 'expired_click', 'invalid_token', 'duplicate_click')),
  ip_address text,
  user_agent text,
  referer text,
  response_id uuid references public.survey_responses (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index dle_assignment_idx on public.distribution_link_events (assignment_id, event_type, created_at desc);
create index dle_org_idx on public.distribution_link_events (organization_id, event_type, created_at desc);

-- RLS for distribution_templates
alter table public.distribution_templates enable row level security;
alter table public.distribution_templates force row level security;

create policy dt_platform_admin_all
  on public.distribution_templates for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy dt_read_permitted
  on public.distribution_templates for select to authenticated
  using (public.can_read_organization(organization_id));
create policy dt_write_permitted
  on public.distribution_templates for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- RLS for distribution_assignments
alter table public.distribution_assignments enable row level security;
alter table public.distribution_assignments force row level security;

create policy da_platform_admin_all
  on public.distribution_assignments for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy da_read_permitted
  on public.distribution_assignments for select to authenticated
  using (public.can_read_organization(organization_id));
create policy da_write_permitted
  on public.distribution_assignments for all to authenticated
  using (public.can_manage_organization(organization_id))
  with check (public.can_manage_organization(organization_id));

-- RLS for distribution_link_events
alter table public.distribution_link_events enable row level security;
alter table public.distribution_link_events force row level security;

create policy dle_platform_admin_all
  on public.distribution_link_events for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy dle_read_permitted
  on public.distribution_link_events for select to authenticated
  using (public.can_read_organization(organization_id));
-- Writes are done via SECURITY DEFINER functions only
create policy dle_insert_via_rpc
  on public.distribution_link_events for insert to authenticated
  with check (false); -- Only SECURITY DEFINER functions can insert

-- Record a click on a distribution link (public, SECURITY DEFINER)
create function public.record_distribution_click(
  p_public_token text,
  p_ip_address text default null,
  p_user_agent text default null,
  p_referer text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
  v_event_type text;
begin
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (null, null, 'invalid_token', p_ip_address, p_user_agent, p_referer);
    return jsonb_build_object('found', false);
  end if;

  if v_assignment.status = 'revoked' or v_assignment.status = 'expired' then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (v_assignment.id, v_assignment.organization_id, 'expired_click', p_ip_address, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', v_assignment.status);
  end if;

  if v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()) then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (v_assignment.id, v_assignment.organization_id, 'expired_click', p_ip_address, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', 'expired');
  end if;

  update public.distribution_assignments
  set click_count = click_count + 1,
      last_clicked_at = timezone('utc', now())
  where id = v_assignment.id;

  insert into public.distribution_link_events (
    assignment_id, organization_id, event_type, ip_address, user_agent, referer
  ) values (
    v_assignment.id, v_assignment.organization_id, 'click', p_ip_address, p_user_agent, p_referer
  );

  return jsonb_build_object(
    'found', true,
    'assignment_id', v_assignment.id,
    'survey_id', v_assignment.survey_id,
    'organization_id', v_assignment.organization_id,
    'location_id', v_assignment.assigned_location_id,
    'employee_id', v_assignment.assigned_employee_id,
    'touchpoint_id', v_assignment.assigned_touchpoint_id,
    'campaign_id', v_assignment.campaign_id,
    'channel', (select channel from public.distribution_templates where id = v_assignment.template_id)
  );
end;
$$;

-- Record a conversion (response submitted) against a distribution link
create function public.record_distribution_conversion(
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

-- Bulk create distribution assignments
create function public.bulk_create_distribution_assignments(
  p_organization_id uuid,
  p_template_id uuid,
  p_survey_id uuid,
  p_campaign_id uuid default null,
  p_employee_ids uuid[] default array[]::uuid[],
  p_location_ids uuid[] default array[]::uuid[]
)
returns integer
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_employee_id uuid;
  v_location_id uuid;
begin
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if array_length(p_employee_ids, 1) > 0 then
    foreach v_employee_id in array p_employee_ids
    loop
      select lm.location_id into v_location_id
      from public.location_memberships lm
      where lm.user_id = v_employee_id
        and lm.status = 'active'
      limit 1;

      if v_location_id is null then
        v_location_id := p_location_ids[1];
      end if;

      if v_location_id is not null then
        insert into public.distribution_assignments (
          organization_id, template_id, survey_id, campaign_id,
          assigned_employee_id, assigned_location_id
        ) values (
          p_organization_id, p_template_id, p_survey_id, p_campaign_id,
          v_employee_id, v_location_id
        )
        on conflict on constraint da_single_target_check do nothing;
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  if array_length(p_location_ids, 1) > 0 then
    foreach v_location_id in array p_location_ids
    loop
      insert into public.distribution_assignments (
        organization_id, template_id, survey_id, campaign_id,
        assigned_location_id
      ) values (
        p_organization_id, p_template_id, p_survey_id, p_campaign_id,
        v_location_id
      );
      v_count := v_count + 1;
    end loop;
  end if;

  return v_count;
end;
$$;

-- Triggers
create trigger distribution_templates_set_updated_at
  before update on public.distribution_templates
  for each row execute function public.set_updated_at();
create trigger distribution_assignments_set_updated_at
  before update on public.distribution_assignments
  for each row execute function public.set_updated_at();

-- Grants
grant select, insert, update, delete on public.distribution_templates to authenticated;
grant select, insert, update, delete on public.distribution_assignments to authenticated;
grant select on public.distribution_link_events to authenticated;
grant execute on function public.record_distribution_click(text, text, text, text) to anon, authenticated;
grant execute on function public.record_distribution_conversion(text, uuid) to authenticated;
grant execute on function public.bulk_create_distribution_assignments(uuid, uuid, uuid, uuid, uuid[], uuid[]) to authenticated;

-- Comments
comment on type public.feedback_mode is 'Standard multi-question surveys vs quick 1-tap feedback';
comment on type public.escalation_trigger is 'Trigger types for the smart escalation engine';
comment on type public.signature_layout is 'Layout style for distribution channel templates (used by email channel)';
comment on column public.surveys.quick_feedback_enabled is 'When true, this survey uses 1-tap quick feedback instead of the full form';
comment on column public.surveys.quick_feedback_rating_style is 'Visual style for quick feedback: emoji, star, or numeric';
comment on column public.surveys.quick_feedback_categories is 'Configurable follow-up category options shown when negative feedback is received';
comment on column public.survey_responses.feedback_mode is 'Distinguishes standard surveys from quick feedback submissions';
comment on column public.survey_responses.campaign_id is 'Links the response to a specific distribution campaign';
comment on column public.survey_responses.source_identifier is 'Optional source identifier (e.g., batch ID, link ID)';
comment on column public.survey_responses.employee_reference is 'Optional employee identifier referenced in the feedback link';
comment on column public.survey_responses.interaction_reference is 'Optional ticket or interaction reference number';
comment on table public.campaigns is 'Distribution campaigns for grouping feedback across channels and time periods';
comment on table public.escalation_rules is 'Configurable escalation rules that auto-create alerts, investigations, or notify managers';
comment on table public.distribution_templates is 'Generic distribution channel templates — one per channel type (email, qr, whatsapp, etc.) with channel-specific render_config';
comment on table public.distribution_assignments is 'Who/what gets a distribution link — polymorphic target (employee, location, or touchpoint) with a unique public token';
comment on table public.distribution_link_events is 'Append-only click and conversion tracking for distribution links';
comment on function public.record_distribution_click is 'Record a click on any distribution link, validate status/expiry, return survey context for redirect';
comment on function public.record_distribution_conversion is 'Record that a response was submitted via a distribution link';
comment on function public.bulk_create_distribution_assignments is 'Create distribution assignments for employees or locations in bulk';
