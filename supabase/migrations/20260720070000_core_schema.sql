-- Kuwait Feedback Platform core relational schema.
-- All tenant data lives in public and is protected by RLS in the next migration.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.app_role as enum (
  'platform_admin',
  'organization_owner',
  'organization_admin',
  'location_manager',
  'analyst'
);

create type public.entity_status as enum ('active', 'archived');
create type public.survey_status as enum ('draft', 'active', 'archived');
create type public.question_type as enum ('rating', 'multiple_choice', 'text');
create type public.locale_code as enum ('en', 'ar');
create type public.alert_status as enum ('open', 'acknowledged', 'resolved');
create type public.subscription_status as enum (
  'trialing',
  'active',
  'past_due',
  'canceled',
  'archived'
);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 120),
  preferred_locale public.locale_code not null default 'en',
  platform_role public.app_role,
  status public.entity_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_platform_role_check
    check (platform_role is null or platform_role = 'platform_admin')
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null check (char_length(name_en) between 1 and 160),
  name_ar text not null check (char_length(name_ar) between 1 and 160),
  timezone text not null default 'Asia/Kuwait' check (timezone = 'Asia/Kuwait'),
  status public.entity_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.organization_memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  status public.entity_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organization_memberships_user_organization_key
    unique (organization_id, user_id),
  constraint organization_memberships_tenant_role_check
    check (role <> 'platform_admin')
);

create table public.locations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null check (char_length(name_en) between 1 and 160),
  name_ar text not null check (char_length(name_ar) between 1 and 160),
  address_en text check (address_en is null or char_length(address_en) <= 500),
  address_ar text check (address_ar is null or char_length(address_ar) <= 500),
  timezone text not null default 'Asia/Kuwait' check (timezone = 'Asia/Kuwait'),
  status public.entity_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint locations_organization_slug_key unique (organization_id, slug),
  constraint locations_id_organization_key unique (id, organization_id)
);

create table public.location_memberships (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null,
  organization_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null,
  status public.entity_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint location_memberships_location_organization_fkey
    foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
    on delete cascade,
  constraint location_memberships_user_location_key unique (location_id, user_id),
  constraint location_memberships_location_role_check
    check (role in ('location_manager', 'analyst'))
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid not null,
  public_slug text not null unique
    default encode(extensions.gen_random_bytes(18), 'hex')
    check (char_length(public_slug) between 24 and 128),
  title_en text not null check (char_length(title_en) between 1 and 200),
  title_ar text not null check (char_length(title_ar) between 1 and 200),
  description_en text check (description_en is null or char_length(description_en) <= 1000),
  description_ar text check (description_ar is null or char_length(description_ar) <= 1000),
  status public.survey_status not null default 'draft',
  default_locale public.locale_code not null default 'en',
  published_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint surveys_location_organization_fkey
    foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
    on delete cascade,
  constraint surveys_active_published_check
    check (status <> 'active' or published_at is not null),
  constraint surveys_id_scope_key unique (id, organization_id, location_id),
  constraint surveys_id_organization_key unique (id, organization_id)
);

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null,
  organization_id uuid not null,
  position integer not null check (position > 0),
  question_type public.question_type not null,
  status public.survey_status not null default 'draft',
  prompt_en text not null check (char_length(prompt_en) between 1 and 500),
  prompt_ar text not null check (char_length(prompt_ar) between 1 and 500),
  is_required boolean not null default false,
  rating_min integer,
  rating_max integer,
  allow_multiple boolean not null default false,
  text_max_length integer,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_questions_survey_organization_fkey
    foreign key (survey_id, organization_id)
    references public.surveys (id, organization_id)
    on delete cascade,
  constraint survey_questions_position_key unique (survey_id, position),
  constraint survey_questions_id_survey_key unique (id, survey_id),
  constraint survey_questions_shape_check check (
    (
      question_type = 'rating'
      and rating_min is not null
      and rating_max is not null
      and rating_min >= 0
      and rating_max <= 10
      and rating_max > rating_min
      and allow_multiple = false
      and text_max_length is null
    )
    or (
      question_type = 'multiple_choice'
      and rating_min is null
      and rating_max is null
      and text_max_length is null
    )
    or (
      question_type = 'text'
      and rating_min is null
      and rating_max is null
      and allow_multiple = false
      and text_max_length between 1 and 4000
    )
  )
);

create table public.survey_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  survey_id uuid not null,
  organization_id uuid not null,
  position integer not null check (position > 0),
  label_en text not null check (char_length(label_en) between 1 and 300),
  label_ar text not null check (char_length(label_ar) between 1 and 300),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_question_options_question_survey_fkey
    foreign key (question_id, survey_id)
    references public.survey_questions (id, survey_id)
    on delete cascade,
  constraint survey_question_options_survey_organization_fkey
    foreign key (survey_id, organization_id)
    references public.surveys (id, organization_id)
    on delete cascade,
  constraint survey_question_options_position_key unique (question_id, position),
  constraint survey_question_options_id_question_key unique (id, question_id)
);

create table public.survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null,
  organization_id uuid not null,
  location_id uuid not null,
  locale public.locale_code not null,
  overall_rating numeric(4, 2) check (overall_rating between 0 and 10),
  idempotency_key text check (
    idempotency_key is null or char_length(idempotency_key) between 8 and 128
  ),
  submitted_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint survey_responses_survey_scope_fkey
    foreign key (survey_id, organization_id, location_id)
    references public.surveys (id, organization_id, location_id)
    on delete restrict,
  constraint survey_responses_id_scope_key unique (id, survey_id, organization_id)
);

create unique index survey_responses_idempotency_key
  on public.survey_responses (survey_id, idempotency_key)
  where idempotency_key is not null;

create table public.survey_answers (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  survey_id uuid not null,
  organization_id uuid not null,
  question_id uuid not null,
  rating_value integer,
  text_value text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint survey_answers_response_scope_fkey
    foreign key (response_id, survey_id, organization_id)
    references public.survey_responses (id, survey_id, organization_id)
    on delete cascade,
  constraint survey_answers_question_survey_fkey
    foreign key (question_id, survey_id)
    references public.survey_questions (id, survey_id)
    on delete restrict,
  constraint survey_answers_response_question_key unique (response_id, question_id),
  constraint survey_answers_single_scalar_value_check
    check (num_nonnulls(rating_value, text_value) <= 1),
  constraint survey_answers_text_length_check
    check (text_value is null or char_length(text_value) <= 4000)
);

create table public.survey_answer_choices (
  answer_id uuid not null references public.survey_answers (id) on delete cascade,
  option_id uuid not null,
  question_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (answer_id, option_id),
  constraint survey_answer_choices_option_question_fkey
    foreign key (option_id, question_id)
    references public.survey_question_options (id, question_id)
    on delete restrict
);

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  response_id uuid references public.survey_responses (id) on delete set null,
  alert_type text not null check (alert_type in ('low_score', 'abuse', 'system')),
  status public.alert_status not null default 'open',
  rating_value numeric(4, 2) check (rating_value between 0 and 10),
  threshold_value numeric(4, 2) check (threshold_value between 0 and 10),
  message text check (message is null or char_length(message) <= 1000),
  acknowledged_by uuid references auth.users (id) on delete set null,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint alerts_location_organization_fkey
    foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
    on delete cascade,
  constraint alerts_acknowledgement_check check (
    (status = 'open' and acknowledged_at is null)
    or (status in ('acknowledged', 'resolved') and acknowledged_at is not null)
  ),
  constraint alerts_resolution_check check (
    (status <> 'resolved' and resolved_at is null)
    or (status = 'resolved' and resolved_at is not null)
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations (id) on delete set null,
  actor_id uuid references auth.users (id) on delete set null,
  actor_database_role text not null default current_user,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id uuid,
  request_id text,
  changed_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations (id) on delete cascade,
  status public.subscription_status not null default 'trialing',
  plan_code text not null check (plan_code ~ '^[a-z0-9_]+$'),
  provider_customer_id text unique,
  provider_subscription_id text unique,
  trial_ends_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  canceled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint subscriptions_period_check check (
    current_period_starts_at is null
    or current_period_ends_at is null
    or current_period_ends_at > current_period_starts_at
  )
);

create index organization_memberships_user_idx
  on public.organization_memberships (user_id, status, organization_id);
create index organization_memberships_org_role_idx
  on public.organization_memberships (organization_id, role, status);
create index locations_organization_status_idx
  on public.locations (organization_id, status);
create index location_memberships_user_idx
  on public.location_memberships (user_id, status, location_id);
create index location_memberships_org_idx
  on public.location_memberships (organization_id, location_id, role, status);
create index surveys_location_status_idx
  on public.surveys (location_id, status);
create index surveys_organization_status_idx
  on public.surveys (organization_id, status);
create index survey_questions_survey_status_idx
  on public.survey_questions (survey_id, status, position);
create index survey_question_options_question_active_idx
  on public.survey_question_options (question_id, is_active, position);
create index survey_responses_location_submitted_idx
  on public.survey_responses (location_id, submitted_at desc);
create index survey_responses_org_submitted_idx
  on public.survey_responses (organization_id, submitted_at desc);
create index survey_answers_response_idx
  on public.survey_answers (response_id);
create index alerts_location_status_created_idx
  on public.alerts (location_id, status, created_at desc);
create index audit_logs_organization_created_idx
  on public.audit_logs (organization_id, created_at desc);
create index audit_logs_actor_created_idx
  on public.audit_logs (actor_id, created_at desc);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();
create trigger organization_memberships_set_updated_at
before update on public.organization_memberships
for each row execute function public.set_updated_at();
create trigger locations_set_updated_at
before update on public.locations
for each row execute function public.set_updated_at();
create trigger location_memberships_set_updated_at
before update on public.location_memberships
for each row execute function public.set_updated_at();
create trigger surveys_set_updated_at
before update on public.surveys
for each row execute function public.set_updated_at();
create trigger survey_questions_set_updated_at
before update on public.survey_questions
for each row execute function public.set_updated_at();
create trigger survey_question_options_set_updated_at
before update on public.survey_question_options
for each row execute function public.set_updated_at();
create trigger alerts_set_updated_at
before update on public.alerts
for each row execute function public.set_updated_at();
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();
