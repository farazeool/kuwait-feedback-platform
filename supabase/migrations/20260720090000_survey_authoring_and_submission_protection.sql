-- Survey groups, trusted authoring/lifecycle operations, historical guards,
-- and short-lived anonymous submission rate limiting.

alter table public.surveys
  add column survey_group_id uuid not null default gen_random_uuid(),
  add column thank_you_en text check (
    thank_you_en is null or char_length(thank_you_en) <= 500
  ),
  add column thank_you_ar text check (
    thank_you_ar is null or char_length(thank_you_ar) <= 500
  );

alter table public.surveys
  add constraint surveys_group_location_key
    unique (survey_group_id, location_id);

create index surveys_group_status_idx
  on public.surveys (survey_group_id, status);

alter table public.survey_questions
  add column help_text_en text check (
    help_text_en is null or char_length(help_text_en) <= 500
  ),
  add column help_text_ar text check (
    help_text_ar is null or char_length(help_text_ar) <= 500
  );

create table public.public_submission_rate_limits (
  survey_id uuid not null references public.surveys (id) on delete cascade,
  fingerprint_hash bytea not null check (octet_length(fingerprint_hash) = 32),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (survey_id, fingerprint_hash, window_started_at),
  constraint public_submission_rate_limits_expiry_check
    check (expires_at > window_started_at)
);

create index public_submission_rate_limits_expiry_idx
  on public.public_submission_rate_limits (expires_at);

create trigger public_submission_rate_limits_set_updated_at
before update on public.public_submission_rate_limits
for each row execute function public.set_updated_at();

alter table public.public_submission_rate_limits enable row level security;
alter table public.public_submission_rate_limits force row level security;

create function public.reject_answered_survey_structure_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_survey_id uuid;
begin
  v_survey_id := case when tg_op = 'DELETE' then old.survey_id else new.survey_id end;

  if exists (
    select 1 from public.survey_responses sr where sr.survey_id = v_survey_id
  ) then
    raise exception 'Answered survey structure is immutable; duplicate it into a draft'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger survey_questions_preserve_response_history
before update or delete on public.survey_questions
for each row execute function public.reject_answered_survey_structure_mutation();

create function public.reject_answered_option_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_survey_id uuid;
begin
  v_survey_id := case when tg_op = 'DELETE' then old.survey_id else new.survey_id end;

  if exists (
    select 1 from public.survey_responses sr where sr.survey_id = v_survey_id
  ) then
    raise exception 'Answered survey options are immutable; duplicate the survey into a draft'
      using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger survey_question_options_preserve_response_history
before update or delete on public.survey_question_options
for each row execute function public.reject_answered_option_mutation();

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
  p_questions jsonb
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
        false,
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
            label_ar
          ) values (
            v_question_id,
            v_survey_id,
            p_organization_id,
            v_option_position,
            btrim(v_option ->> 'label_en'),
            coalesce(nullif(btrim(v_option ->> 'label_ar'), ''), btrim(v_option ->> 'label_en'))
          );
        end loop;
      end if;
    end loop;
  end loop;

  return v_primary_survey_id;
end;
$$;

create function public.transition_survey_group(
  p_survey_id uuid,
  p_status public.survey_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group_id uuid;
begin
  select s.survey_group_id into v_group_id
  from public.surveys s
  where s.id = p_survey_id and public.can_manage_survey(s.id)
  for update;

  if not found then
    raise exception 'Survey not found' using errcode = 'P0002';
  end if;

  if p_status = 'draft' then
    raise exception 'Published surveys must be duplicated to create a draft'
      using errcode = '55000';
  end if;

  if p_status = 'active' then
    if exists (
      select 1
      from public.surveys s
      where s.survey_group_id = v_group_id
        and (
          char_length(btrim(s.title_en)) = 0
          or not exists (
            select 1 from public.survey_questions q where q.survey_id = s.id
          )
          or exists (
            select 1
            from public.survey_questions q
            where q.survey_id = s.id
              and (
                char_length(btrim(q.prompt_en)) = 0
                or (
                  q.question_type = 'multiple_choice'
                  and (
                    select count(*) from public.survey_question_options o
                    where o.question_id = q.id and o.is_active
                  ) < 2
                )
              )
          )
        )
    ) then
      raise exception 'Survey does not satisfy publication requirements'
        using errcode = '23514';
    end if;

    update public.survey_questions q
    set status = 'active'
    where q.survey_id in (
      select s.id from public.surveys s where s.survey_group_id = v_group_id
    ) and q.status <> 'active';

    update public.surveys s
    set status = 'active', published_at = coalesce(s.published_at, timezone('utc', now()))
    where s.survey_group_id = v_group_id;
  elsif p_status = 'archived' then
    update public.surveys s
    set status = 'archived'
    where s.survey_group_id = v_group_id;
  else
    raise exception 'Unsupported survey transition' using errcode = '22023';
  end if;
end;
$$;

create function public.duplicate_survey_group(p_survey_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.surveys%rowtype;
  v_location_ids uuid[];
  v_questions jsonb;
  v_new_id uuid;
begin
  select * into v_source
  from public.surveys s
  where s.id = p_survey_id and public.can_manage_survey(s.id);

  if not found then
    raise exception 'Survey not found' using errcode = 'P0002';
  end if;

  select array_agg(s.location_id order by s.created_at, s.id)
  into v_location_ids
  from public.surveys s
  where s.survey_group_id = v_source.survey_group_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'type', q.question_type,
      'label_en', q.prompt_en,
      'label_ar', q.prompt_ar,
      'help_text_en', q.help_text_en,
      'help_text_ar', q.help_text_ar,
      'required', q.is_required,
      'rating_min', q.rating_min,
      'rating_max', q.rating_max,
      'text_max_length', q.text_max_length,
      'options', case when q.question_type = 'multiple_choice' then (
        select coalesce(jsonb_agg(
          jsonb_build_object('label_en', o.label_en, 'label_ar', o.label_ar)
          order by o.position
        ), '[]'::jsonb)
        from public.survey_question_options o where o.question_id = q.id
      ) else '[]'::jsonb end
    ) order by q.position
  ), '[]'::jsonb)
  into v_questions
  from public.survey_questions q
  where q.survey_id = v_source.id;

  v_new_id := public.save_survey_draft(
    v_source.organization_id,
    null,
    left(v_source.title_en || ' (Copy)', 200),
    v_source.title_ar,
    v_source.description_en,
    v_source.description_ar,
    v_source.thank_you_en,
    v_source.thank_you_ar,
    v_source.default_locale,
    v_location_ids,
    v_questions
  );

  return v_new_id;
end;
$$;

create or replace function public.get_public_survey(p_public_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'public_slug', s.public_slug,
    'title', jsonb_build_object('en', s.title_en, 'ar', s.title_ar),
    'description', jsonb_build_object('en', s.description_en, 'ar', s.description_ar),
    'thank_you', jsonb_build_object('en', s.thank_you_en, 'ar', s.thank_you_ar),
    'default_locale', s.default_locale,
    'organization', jsonb_build_object(
      'name', jsonb_build_object('en', o.name_en, 'ar', o.name_ar)
    ),
    'location', jsonb_build_object(
      'name', jsonb_build_object('en', l.name_en, 'ar', l.name_ar)
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'type', q.question_type,
        'position', q.position,
        'prompt', jsonb_build_object('en', q.prompt_en, 'ar', q.prompt_ar),
        'help_text', jsonb_build_object('en', q.help_text_en, 'ar', q.help_text_ar),
        'required', q.is_required,
        'rating_min', q.rating_min,
        'rating_max', q.rating_max,
        'allow_multiple', false,
        'text_max_length', q.text_max_length,
        'options', case when q.question_type = 'multiple_choice' then coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', option_row.id,
            'position', option_row.position,
            'label', jsonb_build_object('en', option_row.label_en, 'ar', option_row.label_ar)
          ) order by option_row.position)
          from public.survey_question_options option_row
          where option_row.question_id = q.id and option_row.is_active
        ), '[]'::jsonb) else '[]'::jsonb end
      ) order by q.position)
      from public.survey_questions q
      where q.survey_id = s.id and q.status = 'active'
    ), '[]'::jsonb)
  ) into v_result
  from public.surveys s
  join public.locations l on l.id = s.location_id
  join public.organizations o on o.id = s.organization_id
  where s.public_slug = p_public_slug
    and s.status = 'active'
    and l.status = 'active'
    and o.status = 'active';

  if v_result is null then
    raise exception 'Published survey not found' using errcode = 'P0002';
  end if;

  return v_result;
end;
$$;

create function public.consume_public_submission_rate_limit(
  p_public_slug text,
  p_fingerprint_hash text,
  p_limit integer default 5,
  p_window_seconds integer default 900
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_survey_id uuid;
  v_fingerprint bytea;
  v_window timestamptz;
  v_count integer;
begin
  if p_fingerprint_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 100
    or p_window_seconds not between 60 and 86400
  then
    raise exception 'Invalid rate-limit input' using errcode = '22023';
  end if;

  select s.id into v_survey_id
  from public.surveys s
  join public.locations l on l.id = s.location_id and l.status = 'active'
  join public.organizations o on o.id = s.organization_id and o.status = 'active'
  where s.public_slug = p_public_slug and s.status = 'active';

  if not found then
    raise exception 'Published survey not found' using errcode = 'P0002';
  end if;

  v_fingerprint := decode(p_fingerprint_hash, 'hex');
  v_window := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds) * p_window_seconds
  );

  delete from public.public_submission_rate_limits
  where expires_at < timezone('utc', now());

  insert into public.public_submission_rate_limits (
    survey_id,
    fingerprint_hash,
    window_started_at,
    request_count,
    expires_at
  ) values (
    v_survey_id,
    v_fingerprint,
    v_window,
    1,
    v_window + make_interval(secs => p_window_seconds + 86400)
  )
  on conflict (survey_id, fingerprint_hash, window_started_at)
  do update set request_count = public.public_submission_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

create function public.submit_protected_survey_response(
  p_public_slug text,
  p_locale public.locale_code,
  p_answers jsonb,
  p_idempotency_key text,
  p_fingerprint_hash text
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
    p_idempotency_key
  );

  return jsonb_build_object('response_id', v_response_id, 'duplicate', false);
end;
$$;

revoke insert, update, delete on public.surveys from authenticated;
revoke insert, update, delete on public.survey_questions from authenticated;
revoke insert, update, delete on public.survey_question_options from authenticated;
revoke execute on function public.submit_public_survey_response(
  text, public.locale_code, jsonb, text
) from anon, authenticated;

revoke all on public.public_submission_rate_limits from anon, authenticated;
revoke execute on function public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb
) from public, anon;
revoke execute on function public.transition_survey_group(uuid, public.survey_status)
  from public, anon;
revoke execute on function public.duplicate_survey_group(uuid) from public, anon;
revoke execute on function public.consume_public_submission_rate_limit(
  text, text, integer, integer
) from public, authenticated;
revoke execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text
) from public, authenticated;

grant execute on function public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb
) to authenticated;
grant execute on function public.transition_survey_group(uuid, public.survey_status)
  to authenticated;
grant execute on function public.duplicate_survey_group(uuid) to authenticated;
grant execute on function public.submit_protected_survey_response(
  text, public.locale_code, jsonb, text, text
) to anon;

comment on table public.public_submission_rate_limits is
  'Short-lived SHA-256 request fingerprints only; raw IP addresses are never stored.';
comment on function public.save_survey_draft(
  uuid, uuid, text, text, text, text, text, text, public.locale_code, uuid[], jsonb
) is 'Atomically creates or replaces a valid draft definition across selected locations.';
comment on function public.transition_survey_group(uuid, public.survey_status) is
  'Validates and atomically publishes/restores or archives every location survey in a group.';
