-- Fresh Produce QA public API (read + submission) — forward-only, additive.
--
-- Delivers the two follow-on pieces the foundation migration
-- (20260721120000) documented but intentionally deferred:
--
--   1. get_public_survey now surfaces the survey type, the named rating scale
--      for each rating question (with bilingual labelled points and
--      satisfied/negative thresholds), and the controlled concern category
--      linked to each multiple-choice option. Anonymous rendering keeps
--      touching no tables directly: everything flows through this existing
--      SECURITY DEFINER function.
--
--   2. Public submission now records the true capture channel, the touchpoint
--      (resolved from its public token) and the department derived from it,
--      normalized response_concerns from concern-linked option selections, and
--      validates rating answers against the question's declared bounds and
--      named scale points. Idempotency and rate limiting are unchanged.
--
-- Existing 0-10 generic surveys are unaffected: rating_scale is null, no
-- touchpoint token is supplied, and the channel defaults to 'web'.

-- ---------------------------------------------------------------------------
-- 1. get_public_survey — expose scales, scale points, and concern linkage
-- ---------------------------------------------------------------------------

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
    -- Only the scales actually referenced by this survey's active rating
    -- questions are returned, each with its ordered labelled points.
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

-- ---------------------------------------------------------------------------
-- 2. Submission — record channel / touchpoint / department / concerns
-- ---------------------------------------------------------------------------
-- Adding trailing defaulted parameters changes the function signature, so both
-- functions are dropped and recreated. The prior grants/revokes are reissued.

drop function if exists public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text
);
drop function if exists public.submit_public_survey_response(
  text, public.locale_code, jsonb, text
);

create function public.submit_public_survey_response(
  p_public_slug text,
  p_locale public.locale_code,
  p_answers jsonb,
  p_idempotency_key text default null,
  p_channel public.response_channel default 'web',
  p_touchpoint_token text default null
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
  if jsonb_typeof(p_answers) <> 'array'
    or jsonb_array_length(p_answers) > 50
  then
    raise exception 'Answers must be a JSON array with at most 50 entries'
      using errcode = '22023';
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

  -- Resolve the capture context. A touchpoint token, when supplied, must
  -- belong to this survey's location and be active; its channel and department
  -- take precedence over the caller-provided channel so context is trustworthy.
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

    -- If the touchpoint is bound to a specific survey, it must match.
    if v_touchpoint.survey_id is not null and v_touchpoint.survey_id <> v_survey.id then
      raise exception 'Touchpoint is not bound to this survey' using errcode = '22023';
    end if;

    v_touchpoint_id := v_touchpoint.id;
    v_department_id := v_touchpoint.department_id;
    v_channel := v_touchpoint.channel;
  else
    v_channel := p_channel;
  end if;

  if p_idempotency_key is not null then
    select sr.id into v_response_id
    from public.survey_responses sr
    where sr.survey_id = v_survey.id
      and sr.idempotency_key = p_idempotency_key;

    if found then
      return v_response_id;
    end if;
  end if;

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

  insert into public.survey_responses (
    survey_id,
    organization_id,
    location_id,
    locale,
    idempotency_key,
    channel,
    department_id,
    touchpoint_id
  ) values (
    v_survey.id,
    v_survey.organization_id,
    v_survey.location_id,
    p_locale,
    p_idempotency_key,
    v_channel,
    v_department_id,
    v_touchpoint_id
  )
  returning id into v_response_id;

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

        -- Bounds (rating_min/rating_max) are enforced by the existing
        -- survey_answers validation trigger. When the question opts into a
        -- named scale, the value must additionally be a declared scale point.
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
          response_id,
          survey_id,
          organization_id,
          question_id,
          rating_value
        ) values (
          v_response_id,
          v_survey.id,
          v_survey.organization_id,
          v_question.id,
          v_rating
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
          response_id,
          survey_id,
          organization_id,
          question_id,
          text_value
        ) values (
          v_response_id,
          v_survey.id,
          v_survey.organization_id,
          v_question.id,
          v_text
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
          response_id,
          survey_id,
          organization_id,
          question_id
        ) values (
          v_response_id,
          v_survey.id,
          v_survey.organization_id,
          v_question.id
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
            answer_id,
            option_id,
            question_id
          ) values (
            v_answer_id,
            v_option_id,
            v_question.id
          );
        end loop;
    end case;
  end loop;

  -- Normalize concerns from any concern-linked options the respondent selected.
  -- The lowest question/option position becomes the single primary concern;
  -- further distinct categories are recorded as secondary. Duplicates across
  -- questions collapse via the unique (response_id, concern_category_id) index.
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
  p_touchpoint_token text default null
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
  if jsonb_array_length(p_answers) > 50 then
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
    p_touchpoint_token
  );

  return jsonb_build_object('response_id', v_response_id, 'duplicate', false);
end;
$$;

-- Reissue the exact access posture established by earlier migrations: the
-- inner function is never client-callable; only anon may invoke the protected,
-- rate-limited wrapper.
revoke execute on function public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text
) from public, anon, authenticated;
revoke execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text
) from public, authenticated;
grant execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text, public.response_channel, text
) to anon;

comment on function public.get_public_survey(text) is
  'Anonymous survey definition including survey_type, referenced rating scales with labelled points, and concern-category linkage on options.';
comment on function public.submit_public_survey_response(
  text, public.locale_code, jsonb, text, public.response_channel, text
) is 'Privileged submission writer. Records channel/department/touchpoint and normalized concerns; validates ratings against declared bounds and named scale points.';
