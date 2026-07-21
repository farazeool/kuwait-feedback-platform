-- Fresh Produce survey authoring support (additive, backward compatible).
--
-- Extends save_survey_draft to accept a survey_type parameter, pass through
-- rating_scale on rating questions, allow_multiple on multiple-choice
-- questions, and concern_category_id on options. Generic surveys remain
-- unaffected: survey_type defaults to 'generic', rating_scale is null,
-- allow_multiple defaults to false, and concern_category_id is null.

drop function if exists public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb
);

create function public.save_survey_draft(
  p_organization_id uuid,
  p_survey_id uuid,
  p_title_en text,
  p_title_ar text,
  p_description_en text,
  p_description_ar text,
  p_thank_you_en text,
  p_thank_you_ar text,
  p_default_locale public.locale_code,
  p_location_ids uuid[],
  p_questions jsonb,
  p_survey_type public.survey_type default 'generic'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_group_id uuid;
  v_primary_survey_id uuid;
  v_survey_id uuid;
  v_location_id uuid;
  v_question jsonb;
  v_question_id uuid;
  v_option jsonb;
  v_position integer;
  v_option_position integer;
  v_question_type public.question_type;
begin
  p_location_ids := coalesce(p_location_ids, array[]::uuid[]);

  if v_actor_id is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Survey management access required' using errcode = '42501';
  end if;

  if char_length(btrim(p_title_en)) not between 1 and 200
    or char_length(coalesce(p_title_ar, '')) > 200
    or char_length(coalesce(p_description_en, '')) > 1000
    or char_length(coalesce(p_description_ar, '')) > 1000
    or char_length(coalesce(p_thank_you_en, '')) > 500
    or char_length(coalesce(p_thank_you_ar, '')) > 500
  then
    raise exception 'Survey copy is invalid' using errcode = '22023';
  end if;

  if cardinality(p_location_ids) < 1 or cardinality(p_location_ids) > 20
    or cardinality(p_location_ids) <> (
      select count(distinct value)::integer from unnest(p_location_ids) value
    )
  then
    raise exception 'Select between one and twenty unique locations'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_location_ids) requested(location_id)
    left join public.locations l
      on l.id = requested.location_id
      and l.organization_id = p_organization_id
      and l.status = 'active'
    where l.id is null
  ) then
    raise exception 'A selected location is unavailable' using errcode = '22023';
  end if;

  if jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) > 50
  then
    raise exception 'Questions must be an array with at most fifty entries'
      using errcode = '22023';
  end if;

  if p_survey_id is null then
    v_group_id := gen_random_uuid();
  else
    select s.survey_group_id into v_group_id
    from public.surveys s
    where s.id = p_survey_id
      and s.organization_id = p_organization_id
      and public.can_manage_survey(s.id)
    for update;

    if not found then
      raise exception 'Survey draft not found' using errcode = 'P0002';
    end if;

    if exists (
      select 1 from public.surveys s
      where s.survey_group_id = v_group_id and s.status <> 'draft'
    ) or exists (
      select 1
      from public.survey_responses sr
      join public.surveys s on s.id = sr.survey_id
      where s.survey_group_id = v_group_id
    ) then
      raise exception 'Published or answered surveys must be duplicated before editing'
        using errcode = '55000';
    end if;
  end if;

  delete from public.surveys s
  where s.survey_group_id = v_group_id
    and not (s.location_id = any(p_location_ids));

  foreach v_location_id in array p_location_ids
  loop
    insert into public.surveys (
      organization_id,
      location_id,
      survey_group_id,
      title_en,
      title_ar,
      description_en,
      description_ar,
      thank_you_en,
      thank_you_ar,
      status,
      default_locale,
      survey_type,
      published_at,
      created_by
    ) values (
      p_organization_id,
      v_location_id,
      v_group_id,
      btrim(p_title_en),
      coalesce(nullif(btrim(p_title_ar), ''), btrim(p_title_en)),
      nullif(btrim(p_description_en), ''),
      nullif(btrim(p_description_ar), ''),
      nullif(btrim(p_thank_you_en), ''),
      nullif(btrim(p_thank_you_ar), ''),
      'draft',
      p_default_locale,
      p_survey_type,
      null,
      v_actor_id
    )
    on conflict (survey_group_id, location_id) do update set
      title_en = excluded.title_en,
      title_ar = excluded.title_ar,
      description_en = excluded.description_en,
      description_ar = excluded.description_ar,
      thank_you_en = excluded.thank_you_en,
      thank_you_ar = excluded.thank_you_ar,
      default_locale = excluded.default_locale,
      survey_type = excluded.survey_type,
      updated_at = timezone('utc', now())
    returning id into v_survey_id;

    if v_primary_survey_id is null then
      v_primary_survey_id := v_survey_id;
    end if;

    delete from public.survey_questions q where q.survey_id = v_survey_id;

    v_position := 0;
    for v_question in select value from jsonb_array_elements(p_questions)
    loop
      v_position := v_position + 1;

      if jsonb_typeof(v_question) <> 'object'
        or coalesce(v_question ->> 'type', '') not in ('rating', 'multiple_choice', 'text')
        or char_length(btrim(coalesce(v_question ->> 'label_en', ''))) not between 1 and 500
        or char_length(coalesce(v_question ->> 'label_ar', '')) > 500
        or char_length(coalesce(v_question ->> 'help_text_en', '')) > 500
        or char_length(coalesce(v_question ->> 'help_text_ar', '')) > 500
      then
        raise exception 'Question % is invalid', v_position using errcode = '22023';
      end if;

      v_question_type := (v_question ->> 'type')::public.question_type;

      if v_question_type = 'rating' and (
        coalesce(v_question ->> 'rating_min', '') !~ '^[0-9]+$'
        or coalesce(v_question ->> 'rating_max', '') !~ '^[0-9]+$'
        or (v_question ->> 'rating_min')::integer < 0
        or (v_question ->> 'rating_max')::integer > 10
        or (v_question ->> 'rating_max')::integer <= (v_question ->> 'rating_min')::integer
      ) then
        raise exception 'Rating bounds are invalid' using errcode = '22023';
      end if;

      if v_question_type = 'text' and (
        coalesce(v_question ->> 'text_max_length', '') !~ '^[0-9]+$'
        or (v_question ->> 'text_max_length')::integer not between 1 and 4000
      ) then
        raise exception 'Text length is invalid' using errcode = '22023';
      end if;

      if v_question_type = 'multiple_choice' and (
        jsonb_typeof(v_question -> 'options') <> 'array'
        or jsonb_array_length(v_question -> 'options') < 2
        or jsonb_array_length(v_question -> 'options') > 20
      ) then
        raise exception 'Multiple choice questions require two to twenty options'
          using errcode = '22023';
      end if;

      insert into public.survey_questions (
        survey_id,
        organization_id,
        position,
        question_type,
        status,
        prompt_en,
        prompt_ar,
        help_text_en,
        help_text_ar,
        is_required,
        rating_min,
        rating_max,
        rating_scale,
        allow_multiple,
        text_max_length
      ) values (
        v_survey_id,
        p_organization_id,
        v_position,
        v_question_type,
        'draft',
        btrim(v_question ->> 'label_en'),
        coalesce(nullif(btrim(v_question ->> 'label_ar'), ''), btrim(v_question ->> 'label_en')),
        nullif(btrim(v_question ->> 'help_text_en'), ''),
        nullif(btrim(v_question ->> 'help_text_ar'), ''),
        coalesce((v_question ->> 'required')::boolean, false),
        case when v_question_type = 'rating' then (v_question ->> 'rating_min')::integer end,
        case when v_question_type = 'rating' then (v_question ->> 'rating_max')::integer end,
        case when v_question_type = 'rating'
          then nullif(btrim(coalesce(v_question ->> 'rating_scale', '')), '')
        end,
        case when v_question_type = 'multiple_choice'
          then coalesce((v_question ->> 'allow_multiple')::boolean, false)
          else false
        end,
        case when v_question_type = 'text' then (v_question ->> 'text_max_length')::integer end
      ) returning id into v_question_id;

      if v_question_type = 'multiple_choice' then
        v_option_position := 0;
        for v_option in select value from jsonb_array_elements(v_question -> 'options')
        loop
          v_option_position := v_option_position + 1;
          if char_length(btrim(coalesce(v_option ->> 'label_en', ''))) not between 1 and 300
            or char_length(coalesce(v_option ->> 'label_ar', '')) > 300
          then
            raise exception 'Option % is invalid', v_option_position using errcode = '22023';
          end if;

          insert into public.survey_question_options (
            question_id,
            survey_id,
            organization_id,
            position,
            label_en,
            label_ar,
            concern_category_id
          ) values (
            v_question_id,
            v_survey_id,
            p_organization_id,
            v_option_position,
            btrim(v_option ->> 'label_en'),
            coalesce(nullif(btrim(v_option ->> 'label_ar'), ''), btrim(v_option ->> 'label_en')),
            case
              when v_option ->> 'concern_category_id' is not null
                and v_option ->> 'concern_category_id' ~* '^[0-9a-f-]{36}$'
              then (v_option ->> 'concern_category_id')::uuid
            end
          );
        end loop;
      end if;
    end loop;
  end loop;

  return v_primary_survey_id;
end;
$$;

revoke execute on function public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb, public.survey_type
) from public, anon, authenticated;
grant execute on function public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb, public.survey_type
) to authenticated;

comment on function public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb, public.survey_type
) is 'Creates or replaces a draft survey group. Accepts an optional survey_type (default generic), rating_scale on rating questions, allow_multiple on multiple-choice questions, and concern_category_id on options.';
