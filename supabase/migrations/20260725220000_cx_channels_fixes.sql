-- CX Channels Fix Batch — Quick Feedback RPC + alert lifecycle + KPI + distribution + integrity
-- Forward-only additive migration. Depends on 20260725210000.

-- ==============================================================================
-- 1. Create save_quick_feedback_config RPC (C6 fix)
--    Quick feedback config is stored on the surveys table. Since authenticated
--    users can't UPDATE surveys directly (revoked in 20260720090000), we need
--    a SECURITY DEFINER RPC that validates permissions first.
-- ==============================================================================

create or replace function public.save_quick_feedback_config(
  p_survey_id uuid,
  p_is_enabled boolean,
  p_rating_style text default 'emoji',
  p_positive_threshold integer default 4,
  p_negative_threshold integer default 3,
  p_follow_up_enabled boolean default true,
  p_show_comment_field boolean default true
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  -- Validate survey exists and user can manage it
  if not exists (
    select 1 from public.surveys s
    where s.id = p_survey_id and public.can_manage_survey(s.id)
  ) then
    raise exception 'Survey management access required' using errcode = '42501';
  end if;

  -- Validate input ranges
  if p_positive_threshold not between 1 and 5
    or p_negative_threshold not between 1 and 5
    or p_negative_threshold >= p_positive_threshold
    or p_rating_style not in ('emoji', 'star', 'numeric')
  then
    raise exception 'Invalid quick feedback configuration' using errcode = '22023';
  end if;

  update public.surveys
  set
    quick_feedback_enabled = p_is_enabled,
    quick_feedback_rating_style = p_rating_style,
    quick_feedback_positive_threshold = p_positive_threshold,
    quick_feedback_negative_threshold = p_negative_threshold,
    updated_at = timezone('utc', now())
  where id = p_survey_id;

  if not found then
    raise exception 'Survey not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke execute on function public.save_quick_feedback_config(
  uuid, boolean, text, integer, integer, boolean, boolean
) from public, anon;
grant execute on function public.save_quick_feedback_config(
  uuid, boolean, text, integer, integer, boolean, boolean
) to authenticated;

comment on function public.save_quick_feedback_config is
  'Update quick feedback configuration on a survey. Validates management permission and input bounds.';

-- ==============================================================================
-- 2. Fix C8 — Set overall_rating during QF submission so alert triggers fire
--    The submit_public_survey_response RPC already returns early for QF mode.
--    We need to calculate and set overall_rating before returning so the
--    AFTER INSERT triggers (evaluate_alert_rules, evaluate_escalation_rules)
--    see the correct value and fire appropriately.
-- ==============================================================================

-- Read the current QF path in the submission RPC (defined in 20260725200000)
-- The insert happens at line 190-222, then quick feedback returns at line 225-227.
-- We need to calculate overall_rating from the quickly set value before returning.

-- Since the application sets the rating via update_quick_feedback_rating() as a
-- separate UPDATE after the RPC returns, we need to instead set it INSIDE the
-- RPC so triggers see it. The simplest fix: use the quick feedback rating
-- directly as the overall_rating during the INSERT.

-- However, the RPC doesn't receive the quick rating value — the application
-- sends it to the route which calls update_quick_feedback_rating separately.
-- We need to add a p_quick_rating parameter to the RPC.

-- Since changing the submit_protected_survey_response signature (called by anon)
-- requires updating the anon grant, I need to be careful with the migration order.

-- Actually, the cleanest approach: modify the route to pass the quickRating
-- through the RPC, rather than doing a separate UPDATE. Let me update both
-- RPCs to accept an optional p_quick_rating parameter.

drop function if exists public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text
);

drop function if exists public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text
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
  p_interaction_reference text default null,
  p_distribution_public_token text default null,
  p_quick_rating integer default null
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

  -- Validate quick rating if provided
  if p_quick_rating is not null and (p_quick_rating < 1 or p_quick_rating > 5) then
    raise exception 'Quick rating must be between 1 and 5' using errcode = '22023';
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

  -- Quick feedback mode: calculate overall_rating before insert
  -- so AFTER INSERT triggers (alerts, escalation) see the correct value
  if p_feedback_mode = 'quick' and p_quick_rating is not null then
    -- Map 1-5 quick rating to 0-10 scale for compatibility
    v_overall_rating := round((p_quick_rating::numeric / 5.0) * 10.0, 2);
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
    distribution_assignment_id,
    overall_rating
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
    v_distribution_assignment_id,
    v_overall_rating
  )
  returning id into v_response_id;

  -- Record conversion for distribution links (inside the same transaction)
  if p_distribution_public_token is not null and v_distribution_assignment_id is not null then
    update public.distribution_assignments
    set response_count = response_count + 1,
        last_response_at = timezone('utc', now())
    where id = v_distribution_assignment_id;

    insert into public.distribution_link_events (
      assignment_id, organization_id, event_type, response_id
    ) values (
      v_distribution_assignment_id, v_survey.organization_id, 'conversion', v_response_id
    );
  end if;

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

  -- Compute overall_rating from rating answers (standard mode)
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
  p_interaction_reference text default null,
  p_distribution_public_token text default null,
  p_quick_rating integer default null
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
    p_interaction_reference, p_distribution_public_token,
    p_quick_rating
  );

  return jsonb_build_object('response_id', v_response_id, 'duplicate', false);
end;
$$;

-- Grants for updated signatures
revoke execute on function public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text, integer
) from public, anon, authenticated;

revoke execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text, integer
) from public, authenticated;

grant execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text, integer
) to anon;

-- Drop old function no longer needed (replaced by inline logic)
drop function if exists public.update_quick_feedback_rating(uuid, integer);

-- ==============================================================================
-- 3. Update the API route logic is handled in application code (route.ts)
--    Removing the separate update_quick_feedback_rating call since the
--    RPC now handles the rating inline.
-- ==============================================================================

-- ==============================================================================
-- 4. Rate limiting for distribution click recording (S1 fix)
--    Use the existing consume_public_submission_rate_limit mechanism,
--    keyed on a hash of (public_token + ip_address) per time window.
-- ==============================================================================

create or replace function public.record_distribution_click(
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
  v_rate_hash text;
begin
  -- Compute rate-limit hash from token + IP to prevent click fraud
  -- Uses HMAC-style approach: encode(sha256(token || ip))
  -- This prevents raw IP storage while still binding clicks to a fingerprint
  v_rate_hash := encode(
    extensions.digest(
      coalesce(p_public_token, '') || coalesce(p_ip_address, ''),
      'sha256'
    ),
    'hex'
  );

  -- Rate limit: 60 clicks per token+IP per 5 minutes
  -- This allows legitimate repeat clicks but prevents abuse
  if not public.consume_public_submission_rate_limit(
    p_public_token,
    v_rate_hash,
    60,       -- 60 clicks per window
    300       -- 5 minute window
  ) then
    return jsonb_build_object('found', false, 'rate_limited', true);
  end if;

  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (null, null, 'invalid_token', null, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', 'invalid_token');
  end if;

  if v_assignment.status = 'revoked' or v_assignment.status = 'expired' then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (v_assignment.id, v_assignment.organization_id, 'expired_click', null, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', v_assignment.status);
  end if;

  if v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()) then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (v_assignment.id, v_assignment.organization_id, 'expired_click', null, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', 'expired');
  end if;

  update public.distribution_assignments
  set click_count = click_count + 1,
      last_clicked_at = timezone('utc', now())
  where id = v_assignment.id;

  insert into public.distribution_link_events (
    assignment_id, organization_id, event_type, ip_address, user_agent, referer
  ) values (
    v_assignment.id, v_assignment.organization_id, 'click', null, p_user_agent, p_referer
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

-- ==============================================================================
-- 5. Fix C10 — Make KPI thresholds scale-aware
--    Replace hardcoded 7/4 with percentage-based thresholds derived from the
--    survey's actual rating scale (rating_min, rating_max).
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
      -- Derive rating scale bounds from the survey's first rating question
      -- If no rating question, default to 1-10 scale for backward compat
      coalesce(q.rating_min, 1) as eff_rating_min,
      coalesce(q.rating_max, 10) as eff_rating_max,
      -- Compute scale-aware thresholds
      -- satisfied: >= 80% of scale range
      -- negative: <= 40% of scale range
      case when sr.overall_rating is not null and q.rating_max > q.rating_min
        then round((q.rating_min + (q.rating_max - q.rating_min) * 0.8)::numeric, 1)
      end as satisfied_threshold,
      case when sr.overall_rating is not null and q.rating_max > q.rating_min
        then round((q.rating_min + (q.rating_max - q.rating_min) * 0.4)::numeric, 1)
      end as negative_threshold,
      exists (
        select 1 from public.concern_categories cc
        join public.response_concerns rc on rc.concern_category_id = cc.id
        where rc.response_id = sr.id and rc.is_primary
      ) as has_primary_concern
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
      and (p_feedback_mode is null or sr.feedback_mode = p_feedback_mode)
      and (p_channel is null or sr.channel = p_channel::public.response_channel)
      and sr.submitted_at >= p_start_at and sr.submitted_at < p_end_at
  ),
  totals as (
    select
      count(*)::integer as total_responses,
      count(*) filter (where overall_rating is not null)::integer as rated_responses,
      round(avg(overall_rating), 2) as average_rating,
      count(*) filter (where overall_rating is not null and overall_rating >= satisfied_threshold)::integer as satisfied_count,
      count(*) filter (where overall_rating is not null and overall_rating <= negative_threshold)::integer as negative_count,
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
      count(*) filter (where s.overall_rating is not null and s.overall_rating >= s.satisfied_threshold)::integer as satisfied_count,
      count(*) filter (where s.overall_rating is not null and s.overall_rating <= s.negative_threshold)::integer as negative_count
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
               count(*) filter (where overall_rating is not null and overall_rating >= satisfied_threshold)::integer satisfied,
               count(*) filter (where overall_rating is not null and overall_rating <= negative_threshold)::integer negative
        from scoped
        group by 1
      ) t
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- Re-grant for updated signature
revoke execute on function public.get_kpi_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, public.feedback_mode, text
) from public, anon;
grant execute on function public.get_kpi_dashboard(
  uuid, timestamptz, timestamptz, uuid, uuid, public.feedback_mode, text
) to authenticated;

-- ==============================================================================
-- 6. Fix DB-FK: Add validation trigger for evidence.entity_id
--    Since evidence is polymorphic, we can't add a single FK. Instead,
--    a trigger validates that the referenced entity actually exists.
-- ==============================================================================

create or replace function public.validate_evidence_entity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  case new.entity_type
    when 'corrective_action' then
      if not exists (select 1 from public.corrective_actions where id = new.entity_id) then
        raise exception 'Referenced corrective_action % does not exist', new.entity_id using errcode = '23503';
      end if;
    when 'investigation' then
      if not exists (select 1 from public.investigations where id = new.entity_id) then
        raise exception 'Referenced investigation % does not exist', new.entity_id using errcode = '23503';
      end if;
    when 'response' then
      if not exists (select 1 from public.survey_responses where id = new.entity_id) then
        raise exception 'Referenced response % does not exist', new.entity_id using errcode = '23503';
      end if;
    when 'alert' then
      if not exists (select 1 from public.alerts where id = new.entity_id) then
        raise exception 'Referenced alert % does not exist', new.entity_id using errcode = '23503';
      end if;
    else
      raise exception 'Unknown evidence entity type: %', new.entity_type using errcode = '22023';
  end case;
  return new;
end;
$$;

create trigger evidence_validate_entity
  before insert or update on public.evidence
  for each row execute function public.validate_evidence_entity();

comment on function public.validate_evidence_entity is
  'Validates that the entity_id in evidence references an existing record of the declared entity_type.';
comment on trigger evidence_validate_entity on public.evidence is
  'Polymorphic FK enforcement: ensures corrective_action, investigation, response, and alert references are valid.';

-- ==============================================================================
-- 7. Fix DB-NULL: Make 6 NOT NULL columns nullable where ON DELETE SET NULL
--    These columns are NOT NULL but their FKs use ON DELETE SET NULL, causing
--    constraint violations when the referenced user/profile is deleted.
--    The correct fix: make them nullable so SET NULL can succeed.
--    This preserves the audit record (the row remains, just the FK goes null).
--    For audit-sensitive tables, we add snapshot actor_name columns.
-- ==============================================================================

-- evidence.uploaded_by
alter table public.evidence
  alter column uploaded_by drop not null;

-- verification.verifier_id
alter table public.verification
  alter column verifier_id drop not null;

-- effectiveness_review.reviewer_id
alter table public.effectiveness_review
  alter column reviewer_id drop not null;

-- corrective_action_attachments.uploaded_by
alter table public.corrective_action_attachments
  alter column uploaded_by drop not null;

-- corrective_action_status_history.changed_by
-- Add snapshot column for actor identity before making FK nullable
alter table public.corrective_action_status_history
  add column if not exists changed_by_name text
    check (changed_by_name is null or char_length(changed_by_name) <= 200),
  alter column changed_by drop not null;

-- investigation_comments.author_id
alter table public.investigation_comments
  alter column author_id drop not null;

comment on column public.evidence.uploaded_by is 'Uploading user (nullable to preserve records if user is deleted)';
comment on column public.verification.verifier_id is 'Verifying user (nullable to preserve records if user is deleted)';
comment on column public.effectiveness_review.reviewer_id is 'Reviewing user (nullable to preserve records if user is deleted)';
comment on column public.corrective_action_attachments.uploaded_by is 'Uploading user (nullable to preserve records if user is deleted)';
comment on column public.corrective_action_status_history.changed_by is 'User who changed the status (nullable to preserve records if user is deleted)';
comment on column public.corrective_action_status_history.changed_by_name is 'Snapshot of actor display name at time of change';

-- ==============================================================================
-- 8. Grants
-- ==============================================================================

grant execute on function public.save_quick_feedback_config(
  uuid, boolean, text, integer, integer, boolean, boolean
) to authenticated;

grant execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text,
  public.feedback_mode, uuid, text, text, text, text, integer
) to anon;
