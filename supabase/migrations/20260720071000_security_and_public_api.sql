-- Tenant authorization helpers, RLS policies, and the narrow anonymous API.

create function public.is_platform_admin()
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
      where p.id = auth.uid()
        and p.platform_role = 'platform_admin'
        and p.status = 'active'
    ),
    false
  );
$$;

create function public.organization_role(
  p_organization_id uuid
)
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select om.role
  from public.organization_memberships om
  where om.organization_id = p_organization_id
    and om.user_id = auth.uid()
    and om.status = 'active'
  limit 1;
$$;

create function public.can_read_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_memberships om
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in (
          'organization_owner',
          'organization_admin',
          'analyst'
        )
    )
    or exists (
      select 1
      from public.location_memberships lm
      where lm.organization_id = p_organization_id
        and lm.user_id = auth.uid()
        and lm.status = 'active'
        and lm.role in ('location_manager', 'analyst')
    );
$$;

create function public.can_manage_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or public.organization_role(p_organization_id) in (
      'organization_owner',
      'organization_admin'
    );
$$;

create function public.can_access_location(
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.locations l
      join public.organization_memberships om
        on om.organization_id = l.organization_id
      where l.id = p_location_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in (
          'organization_owner',
          'organization_admin',
          'analyst'
        )
    )
    or exists (
      select 1
      from public.location_memberships lm
      where lm.location_id = p_location_id
        and lm.user_id = auth.uid()
        and lm.status = 'active'
        and lm.role in ('location_manager', 'analyst')
    );
$$;

create function public.can_manage_location(
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.locations l
      where l.id = p_location_id
        and public.can_manage_organization(l.organization_id)
    );
$$;

create function public.can_read_survey(
  p_survey_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.surveys s
    where s.id = p_survey_id
      and public.can_access_location(s.location_id)
  );
$$;

create function public.can_manage_survey(
  p_survey_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.surveys s
      where s.id = p_survey_id
        and public.can_manage_organization(s.organization_id)
    );
$$;

create function public.can_access_response(
  p_response_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.survey_responses sr
    where sr.id = p_response_id
      and public.can_access_location(sr.location_id)
  );
$$;

create function public.can_manage_alert(
  p_alert_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.alerts a
      where a.id = p_alert_id
        and (
          public.can_manage_organization(a.organization_id)
          or exists (
            select 1
            from public.location_memberships lm
            where lm.location_id = a.location_id
              and lm.user_id = auth.uid()
              and lm.status = 'active'
              and lm.role = 'location_manager'
          )
        )
    );
$$;

create function public.can_read_profile(
  p_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1
      from public.organization_memberships target_membership
      where target_membership.user_id = p_profile_id
        and target_membership.status = 'active'
        and public.can_manage_organization(
          target_membership.organization_id
        )
    );
$$;

create function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, preferred_locale)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'display_name', ''),
      split_part(coalesce(new.email, new.id::text), '@', 1)
    ),
    case
      when new.raw_user_meta_data ->> 'preferred_locale' = 'ar'
        then 'ar'::public.locale_code
      else 'en'::public.locale_code
    end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create function public.validate_survey_response_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_survey public.surveys%rowtype;
begin
  select *
  into v_survey
  from public.surveys s
  where s.id = new.survey_id;

  if not found
    or v_survey.organization_id <> new.organization_id
    or v_survey.location_id <> new.location_id
    or v_survey.status <> 'active'
  then
    raise exception 'Response scope does not match an active survey'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger survey_responses_validate_scope
before insert or update on public.survey_responses
for each row execute function public.validate_survey_response_scope();

create function public.validate_survey_answer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_question public.survey_questions%rowtype;
begin
  select *
  into v_question
  from public.survey_questions q
  where q.id = new.question_id
    and q.survey_id = new.survey_id
    and q.organization_id = new.organization_id
    and q.status = 'active';

  if not found then
    raise exception 'Answer does not reference an active survey question'
      using errcode = '23514';
  end if;

  case v_question.question_type
    when 'rating' then
      if new.rating_value is null
        or new.text_value is not null
        or new.rating_value < v_question.rating_min
        or new.rating_value > v_question.rating_max
      then
        raise exception 'Invalid rating answer' using errcode = '23514';
      end if;
    when 'text' then
      if new.text_value is null
        or new.rating_value is not null
        or char_length(new.text_value) > v_question.text_max_length
      then
        raise exception 'Invalid text answer' using errcode = '23514';
      end if;
    when 'multiple_choice' then
      if new.rating_value is not null or new.text_value is not null then
        raise exception 'Multiple-choice answers use answer choice rows'
          using errcode = '23514';
      end if;
  end case;

  return new;
end;
$$;

create trigger survey_answers_validate_value
before insert or update on public.survey_answers
for each row execute function public.validate_survey_answer();

create function public.validate_survey_answer_choice()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_answer public.survey_answers%rowtype;
  v_question public.survey_questions%rowtype;
begin
  select * into v_answer
  from public.survey_answers sa
  where sa.id = new.answer_id
    and sa.question_id = new.question_id;

  if not found then
    raise exception 'Choice does not match its answer question'
      using errcode = '23514';
  end if;

  select * into v_question
  from public.survey_questions q
  where q.id = new.question_id
    and q.question_type = 'multiple_choice'
    and q.status = 'active';

  if not found or not exists (
    select 1
    from public.survey_question_options sqo
    where sqo.id = new.option_id
      and sqo.question_id = new.question_id
      and sqo.is_active
  ) then
    raise exception 'Choice does not reference an active option'
      using errcode = '23514';
  end if;

  if not v_question.allow_multiple and exists (
    select 1
    from public.survey_answer_choices existing_choice
    where existing_choice.answer_id = new.answer_id
  ) then
    raise exception 'Question accepts only one option' using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger survey_answer_choices_validate_value
before insert or update on public.survey_answer_choices
for each row execute function public.validate_survey_answer_choice();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.locations enable row level security;
alter table public.location_memberships enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_questions enable row level security;
alter table public.survey_question_options enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers enable row level security;
alter table public.survey_answer_choices enable row level security;
alter table public.alerts enable row level security;
alter table public.audit_logs enable row level security;
alter table public.subscriptions enable row level security;

alter table public.profiles force row level security;
alter table public.organizations force row level security;
alter table public.organization_memberships force row level security;
alter table public.locations force row level security;
alter table public.location_memberships force row level security;
alter table public.surveys force row level security;
alter table public.survey_questions force row level security;
alter table public.survey_question_options force row level security;
alter table public.survey_responses force row level security;
alter table public.survey_answers force row level security;
alter table public.survey_answer_choices force row level security;
alter table public.alerts force row level security;
alter table public.audit_logs force row level security;
alter table public.subscriptions force row level security;

create policy profiles_platform_admin_all
on public.profiles for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy profiles_read_permitted
on public.profiles for select to authenticated
using (public.can_read_profile(id));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = auth.uid() and platform_role is null)
with check (id = auth.uid() and platform_role is null);

create policy organizations_platform_admin_all
on public.organizations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy organizations_read_permitted
on public.organizations for select to authenticated
using (public.can_read_organization(id));

create policy organizations_manage_tenant
on public.organizations for update to authenticated
using (public.can_manage_organization(id))
with check (public.can_manage_organization(id));

create policy organization_memberships_platform_admin_all
on public.organization_memberships for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy organization_memberships_read_permitted
on public.organization_memberships for select to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
  or public.can_manage_organization(organization_id)
);

create policy organization_memberships_insert_managed
on public.organization_memberships for insert to authenticated
with check (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
  and role in ('organization_admin', 'location_manager', 'analyst')
);

create policy organization_memberships_update_managed
on public.organization_memberships for update to authenticated
using (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
  and role <> 'organization_owner'
)
with check (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
  and role in ('organization_admin', 'location_manager', 'analyst')
);

create policy organization_memberships_delete_managed
on public.organization_memberships for delete to authenticated
using (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
  and role <> 'organization_owner'
);

create policy locations_platform_admin_all
on public.locations for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy locations_read_permitted
on public.locations for select to authenticated
using (public.can_access_location(id));

create policy locations_insert_tenant_admin
on public.locations for insert to authenticated
with check (public.can_manage_organization(organization_id));

create policy locations_update_tenant_admin
on public.locations for update to authenticated
using (public.can_manage_location(id))
with check (public.can_manage_organization(organization_id));

create policy locations_delete_tenant_admin
on public.locations for delete to authenticated
using (public.can_manage_location(id));

create policy location_memberships_platform_admin_all
on public.location_memberships for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy location_memberships_read_permitted
on public.location_memberships for select to authenticated
using (user_id = auth.uid() or public.can_access_location(location_id));

create policy location_memberships_insert_managed
on public.location_memberships for insert to authenticated
with check (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
  and role in ('location_manager', 'analyst')
);

create policy location_memberships_update_managed
on public.location_memberships for update to authenticated
using (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
)
with check (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
  and role in ('location_manager', 'analyst')
);

create policy location_memberships_delete_managed
on public.location_memberships for delete to authenticated
using (
  public.can_manage_organization(organization_id)
  and user_id <> auth.uid()
);

create policy surveys_platform_admin_all
on public.surveys for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy surveys_read_permitted
on public.surveys for select to authenticated
using (public.can_read_survey(id));

create policy surveys_insert_tenant_admin
on public.surveys for insert to authenticated
with check (
  public.can_manage_organization(organization_id)
  and public.can_manage_location(location_id)
);

create policy surveys_update_tenant_admin
on public.surveys for update to authenticated
using (public.can_manage_survey(id))
with check (
  public.can_manage_organization(organization_id)
  and public.can_manage_location(location_id)
);

create policy surveys_delete_tenant_admin
on public.surveys for delete to authenticated
using (public.can_manage_survey(id));

create policy survey_questions_platform_admin_all
on public.survey_questions for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy survey_questions_read_permitted
on public.survey_questions for select to authenticated
using (public.can_read_survey(survey_id));

create policy survey_questions_manage_tenant
on public.survey_questions for all to authenticated
using (public.can_manage_survey(survey_id))
with check (public.can_manage_survey(survey_id));

create policy survey_question_options_platform_admin_all
on public.survey_question_options for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy survey_question_options_read_permitted
on public.survey_question_options for select to authenticated
using (public.can_read_survey(survey_id));

create policy survey_question_options_manage_tenant
on public.survey_question_options for all to authenticated
using (public.can_manage_survey(survey_id))
with check (public.can_manage_survey(survey_id));

create policy survey_responses_platform_admin_all
on public.survey_responses for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy survey_responses_read_permitted
on public.survey_responses for select to authenticated
using (public.can_access_location(location_id));

create policy survey_responses_delete_tenant_admin
on public.survey_responses for delete to authenticated
using (public.can_manage_organization(organization_id));

create policy survey_answers_platform_admin_all
on public.survey_answers for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy survey_answers_read_permitted
on public.survey_answers for select to authenticated
using (public.can_access_response(response_id));

create policy survey_answer_choices_platform_admin_all
on public.survey_answer_choices for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy survey_answer_choices_read_permitted
on public.survey_answer_choices for select to authenticated
using (
  exists (
    select 1
    from public.survey_answers sa
    where sa.id = answer_id
      and public.can_access_response(sa.response_id)
  )
);

create policy alerts_platform_admin_all
on public.alerts for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy alerts_read_permitted
on public.alerts for select to authenticated
using (public.can_access_location(location_id));

create policy alerts_update_managers
on public.alerts for update to authenticated
using (public.can_manage_alert(id))
with check (public.can_manage_alert(id));

create policy alerts_delete_tenant_admin
on public.alerts for delete to authenticated
using (public.can_manage_organization(organization_id));

create policy audit_logs_platform_admin_read
on public.audit_logs for select to authenticated
using (public.is_platform_admin());

create policy audit_logs_tenant_read
on public.audit_logs for select to authenticated
using (
  organization_id is not null
  and public.organization_role(organization_id) in (
    'organization_owner',
    'organization_admin',
    'analyst'
  )
);

create policy subscriptions_platform_admin_all
on public.subscriptions for all to authenticated
using (public.is_platform_admin())
with check (public.is_platform_admin());

create policy subscriptions_owner_read
on public.subscriptions for select to authenticated
using (
  public.organization_role(organization_id) = 'organization_owner'
);

create function public.get_public_survey(p_public_slug text)
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
    'id', s.id,
    'public_slug', s.public_slug,
    'title', jsonb_build_object('en', s.title_en, 'ar', s.title_ar),
    'description', jsonb_build_object(
      'en', s.description_en,
      'ar', s.description_ar
    ),
    'default_locale', s.default_locale,
    'location', jsonb_build_object(
      'name', jsonb_build_object('en', l.name_en, 'ar', l.name_ar)
    ),
    'questions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', q.id,
            'type', q.question_type,
            'position', q.position,
            'prompt', jsonb_build_object('en', q.prompt_en, 'ar', q.prompt_ar),
            'required', q.is_required,
            'rating_min', q.rating_min,
            'rating_max', q.rating_max,
            'allow_multiple', q.allow_multiple,
            'text_max_length', q.text_max_length,
            'options', case
              when q.question_type = 'multiple_choice' then coalesce(
                (
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', o.id,
                      'position', o.position,
                      'label', jsonb_build_object('en', o.label_en, 'ar', o.label_ar)
                    )
                    order by o.position
                  )
                  from public.survey_question_options o
                  where o.question_id = q.id
                    and o.is_active
                ),
                '[]'::jsonb
              )
              else '[]'::jsonb
            end
          )
          order by q.position
        )
        from public.survey_questions q
        where q.survey_id = s.id
          and q.status = 'active'
      ),
      '[]'::jsonb
    )
  )
  into v_result
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

create function public.submit_public_survey_response(
  p_public_slug text,
  p_locale public.locale_code,
  p_answers jsonb,
  p_idempotency_key text default null
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
    idempotency_key
  ) values (
    v_survey.id,
    v_survey.organization_id,
    v_survey.location_id,
    p_locale,
    p_idempotency_key
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

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema public to anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select, insert, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_memberships to authenticated;
grant select, insert, update, delete on public.locations to authenticated;
grant select, insert, update, delete on public.location_memberships to authenticated;
grant select, insert, update, delete on public.surveys to authenticated;
grant select, insert, update, delete on public.survey_questions to authenticated;
grant select, insert, update, delete on public.survey_question_options to authenticated;
grant select, delete on public.survey_responses to authenticated;
grant select on public.survey_answers to authenticated;
grant select on public.survey_answer_choices to authenticated;
grant select, update, delete on public.alerts to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update, delete on public.subscriptions to authenticated;

grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.organization_role(uuid) to authenticated;
grant execute on function public.can_read_organization(uuid) to authenticated;
grant execute on function public.can_manage_organization(uuid) to authenticated;
grant execute on function public.can_access_location(uuid) to authenticated;
grant execute on function public.can_manage_location(uuid) to authenticated;
grant execute on function public.can_read_survey(uuid) to authenticated;
grant execute on function public.can_manage_survey(uuid) to authenticated;
grant execute on function public.can_access_response(uuid) to authenticated;
grant execute on function public.can_manage_alert(uuid) to authenticated;
grant execute on function public.can_read_profile(uuid) to authenticated;

grant execute on function public.get_public_survey(text) to anon, authenticated;
grant execute on function public.submit_public_survey_response(
  text,
  public.locale_code,
  jsonb,
  text
) to anon, authenticated;
