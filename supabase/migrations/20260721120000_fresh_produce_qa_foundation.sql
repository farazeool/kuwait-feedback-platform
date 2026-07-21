-- ON-Cost Fresh Produce QA foundation (additive, backward compatible).
--
-- Adds departments, touchpoints, a response channel, a controlled concern
-- vocabulary with a normalized primary-concern join, controlled-record
-- reference fields on the existing response/outcome record, and configurable
-- rating-scale metadata (used by the Fresh Produce five-point labelled scale
-- without changing the generic 0-10 scale).
--
-- All tenant tables mirror the existing location-scoping RLS model. Global
-- controlled vocabularies (concern_categories, rating_scales,
-- rating_scale_points) are readable by authenticated callers only; anonymous
-- survey rendering receives labels through the existing SECURITY DEFINER
-- get_public_survey function, preserving the "anon touches no tables" invariant.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.response_channel as enum ('qr', 'kiosk', 'web');
create type public.survey_type as enum ('generic', 'fresh_produce');
create type public.controlled_record_type as enum ('investigation', 'ncr', 'capa');

-- ---------------------------------------------------------------------------
-- Departments (scoped to a location within an organization)
-- ---------------------------------------------------------------------------

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid not null,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null check (char_length(name_en) between 1 and 160),
  name_ar text not null check (char_length(name_ar) between 1 and 160),
  status public.entity_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint departments_location_organization_fkey
    foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
    on delete cascade,
  constraint departments_location_slug_key unique (organization_id, location_id, slug),
  constraint departments_id_scope_key unique (id, organization_id, location_id),
  constraint departments_id_organization_key unique (id, organization_id)
);

-- Prevent duplicate active department names within the same location.
create unique index departments_location_name_active_idx
  on public.departments (location_id, lower(name_en))
  where status = 'active';

create index departments_organization_status_idx
  on public.departments (organization_id, status);
create index departments_location_status_idx
  on public.departments (location_id, status);

create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Touchpoints (a physical capture point: display QR, checkout counter, kiosk)
-- ---------------------------------------------------------------------------

create table public.touchpoints (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  location_id uuid not null,
  department_id uuid not null,
  survey_id uuid,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  public_token text not null unique
    default encode(extensions.gen_random_bytes(18), 'hex')
    check (char_length(public_token) between 24 and 128),
  name_en text not null check (char_length(name_en) between 1 and 160),
  name_ar text not null check (char_length(name_ar) between 1 and 160),
  channel public.response_channel not null default 'qr',
  status public.entity_status not null default 'active',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint touchpoints_department_scope_fkey
    foreign key (department_id, organization_id, location_id)
    references public.departments (id, organization_id, location_id)
    on delete cascade,
  constraint touchpoints_survey_scope_fkey
    foreign key (survey_id, organization_id, location_id)
    references public.surveys (id, organization_id, location_id)
    on delete set null,
  constraint touchpoints_location_slug_key unique (organization_id, location_id, slug),
  constraint touchpoints_id_scope_key unique (id, organization_id, location_id)
);

create index touchpoints_organization_status_idx
  on public.touchpoints (organization_id, status);
create index touchpoints_location_status_idx
  on public.touchpoints (location_id, status);
create index touchpoints_department_idx
  on public.touchpoints (department_id, status);

create trigger touchpoints_set_updated_at
before update on public.touchpoints
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Concern categories (global controlled vocabulary) + normalized join
-- ---------------------------------------------------------------------------

create table public.concern_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name_en text not null check (char_length(name_en) between 1 and 120),
  name_ar text not null check (char_length(name_ar) between 1 and 120),
  position integer not null check (position > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index concern_categories_position_idx
  on public.concern_categories (position);

create trigger concern_categories_set_updated_at
before update on public.concern_categories
for each row execute function public.set_updated_at();

-- Multiple-choice options that represent a concern carry a stable reference to
-- the controlled category so analytics never rely on free text.
alter table public.survey_question_options
  add column concern_category_id uuid references public.concern_categories (id) on delete restrict;

create index survey_question_options_concern_idx
  on public.survey_question_options (concern_category_id)
  where concern_category_id is not null;

create table public.response_concerns (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null,
  organization_id uuid not null,
  survey_id uuid not null,
  concern_category_id uuid not null references public.concern_categories (id) on delete restrict,
  is_primary boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint response_concerns_response_scope_fkey
    foreign key (response_id, survey_id, organization_id)
    references public.survey_responses (id, survey_id, organization_id)
    on delete cascade,
  constraint response_concerns_unique_category unique (response_id, concern_category_id)
);

-- Enforce at most one primary concern per response; secondary concerns remain
-- possible for a future extension without a schema change.
create unique index response_concerns_single_primary_idx
  on public.response_concerns (response_id)
  where is_primary;

create index response_concerns_category_idx
  on public.response_concerns (concern_category_id, created_at desc);
create index response_concerns_org_idx
  on public.response_concerns (organization_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Rating-scale metadata (configurable labels + satisfied/negative thresholds)
-- ---------------------------------------------------------------------------

create table public.rating_scales (
  key text primary key check (key ~ '^[a-z0-9_]+$'),
  name_en text not null check (char_length(name_en) between 1 and 120),
  name_ar text not null check (char_length(name_ar) between 1 and 120),
  scale_min integer not null,
  scale_max integer not null,
  satisfied_min integer not null,
  negative_max integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint rating_scales_bounds_check check (scale_max > scale_min),
  constraint rating_scales_satisfied_check
    check (satisfied_min between scale_min and scale_max),
  constraint rating_scales_negative_check
    check (negative_max between scale_min and scale_max),
  constraint rating_scales_threshold_order_check check (negative_max < satisfied_min)
);

create table public.rating_scale_points (
  scale_key text not null references public.rating_scales (key) on delete cascade,
  value integer not null,
  label_en text not null check (char_length(label_en) between 1 and 120),
  label_ar text not null check (char_length(label_ar) between 1 and 120),
  position integer not null check (position > 0),
  primary key (scale_key, value)
);

create trigger rating_scales_set_updated_at
before update on public.rating_scales
for each row execute function public.set_updated_at();

-- Surveys and rating questions may opt into a named scale. Generic surveys and
-- the existing 0-10 numeric ratings keep working unchanged (rating_scale null).
alter table public.surveys
  add column survey_type public.survey_type not null default 'generic';

alter table public.survey_questions
  add column rating_scale text references public.rating_scales (key);

create index surveys_type_idx on public.surveys (organization_id, survey_type, status);

-- ---------------------------------------------------------------------------
-- Response channel + department/touchpoint context
-- ---------------------------------------------------------------------------

-- New NOT NULL column with a default of 'web' backfills every historical row to
-- the generic public web channel. Pre-channel responses cannot be reliably
-- attributed to QR or kiosk, so 'web' is the documented safe default. New
-- submissions record their true channel (see the submission migration).
alter table public.survey_responses
  add column channel public.response_channel not null default 'web',
  add column department_id uuid,
  add column touchpoint_id uuid,
  add constraint survey_responses_department_scope_fkey
    foreign key (department_id, organization_id, location_id)
    references public.departments (id, organization_id, location_id)
    on delete restrict,
  add constraint survey_responses_touchpoint_scope_fkey
    foreign key (touchpoint_id, organization_id, location_id)
    references public.touchpoints (id, organization_id, location_id)
    on delete restrict;

create index survey_responses_channel_idx
  on public.survey_responses (organization_id, channel, submitted_at desc);
create index survey_responses_department_idx
  on public.survey_responses (department_id, submitted_at desc)
  where department_id is not null;
create index survey_responses_touchpoint_idx
  on public.survey_responses (touchpoint_id, submitted_at desc)
  where touchpoint_id is not null;

-- ---------------------------------------------------------------------------
-- Controlled-record reference fields on the existing outcome record
-- ---------------------------------------------------------------------------
-- These reference EXTERNALLY controlled records (Investigation / NCR / CAPA).
-- The platform never creates or closes those records; it stores only
-- authorized, user-entered identifiers and metadata. Local review status is
-- distinct from the external record status captured here.

alter table public.survey_responses
  add column controlled_record_type public.controlled_record_type,
  add column controlled_record_reference text
    check (
      controlled_record_reference is null
      or (
        char_length(controlled_record_reference) between 1 and 100
        and controlled_record_reference ~ '^[A-Za-z0-9][A-Za-z0-9 ._/-]{0,99}$'
      )
    ),
  add column controlled_record_opened_by text
    check (controlled_record_opened_by is null or char_length(controlled_record_opened_by) between 1 and 160),
  add column controlled_record_status text
    check (controlled_record_status is null or char_length(controlled_record_status) between 1 and 60),
  add column controlled_record_outcome_summary text
    check (controlled_record_outcome_summary is null or char_length(controlled_record_outcome_summary) <= 2000),
  add column controlled_record_recorded_by uuid references auth.users (id) on delete set null,
  add column controlled_record_recorded_at timestamptz,
  -- A controlled record needs both a type and a reference, or neither.
  add constraint survey_responses_controlled_record_pairing_check check (
    (controlled_record_type is null and controlled_record_reference is null)
    or (controlled_record_type is not null and controlled_record_reference is not null)
  );

create index survey_responses_controlled_record_idx
  on public.survey_responses (organization_id, controlled_record_type, submitted_at desc)
  where controlled_record_type is not null;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.departments enable row level security;
alter table public.departments force row level security;
alter table public.touchpoints enable row level security;
alter table public.touchpoints force row level security;
alter table public.concern_categories enable row level security;
alter table public.concern_categories force row level security;
alter table public.response_concerns enable row level security;
alter table public.response_concerns force row level security;
alter table public.rating_scales enable row level security;
alter table public.rating_scales force row level security;
alter table public.rating_scale_points enable row level security;
alter table public.rating_scale_points force row level security;

-- Departments: location-scoped read, organization-managed writes (like locations).
create policy departments_platform_admin_all
on public.departments for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy departments_read_permitted
on public.departments for select to authenticated
using (public.can_access_location(location_id));

create policy departments_insert_tenant_admin
on public.departments for insert to authenticated
with check (public.can_manage_organization(organization_id) and public.can_manage_location(location_id));

create policy departments_update_tenant_admin
on public.departments for update to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_organization(organization_id) and public.can_manage_location(location_id));

create policy departments_delete_tenant_admin
on public.departments for delete to authenticated
using (public.can_manage_location(location_id));

-- Touchpoints: same posture as departments.
create policy touchpoints_platform_admin_all
on public.touchpoints for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy touchpoints_read_permitted
on public.touchpoints for select to authenticated
using (public.can_access_location(location_id));

create policy touchpoints_insert_tenant_admin
on public.touchpoints for insert to authenticated
with check (public.can_manage_organization(organization_id) and public.can_manage_location(location_id));

create policy touchpoints_update_tenant_admin
on public.touchpoints for update to authenticated
using (public.can_manage_location(location_id))
with check (public.can_manage_organization(organization_id) and public.can_manage_location(location_id));

create policy touchpoints_delete_tenant_admin
on public.touchpoints for delete to authenticated
using (public.can_manage_location(location_id));

-- Concern categories + rating scales: global controlled vocabulary. Readable by
-- any authenticated caller; only platform admins mutate the vocabulary.
create policy concern_categories_read_all
on public.concern_categories for select to authenticated using (true);
create policy concern_categories_platform_admin_all
on public.concern_categories for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy rating_scales_read_all
on public.rating_scales for select to authenticated using (true);
create policy rating_scales_platform_admin_all
on public.rating_scales for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy rating_scale_points_read_all
on public.rating_scale_points for select to authenticated using (true);
create policy rating_scale_points_platform_admin_all
on public.rating_scale_points for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Response concerns: tenant data. Readable when the response is accessible;
-- writes only via SECURITY DEFINER submission/workflow functions (like answers).
create policy response_concerns_platform_admin_all
on public.response_concerns for all to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy response_concerns_read_permitted
on public.response_concerns for select to authenticated
using (public.can_access_response(response_id));

-- ---------------------------------------------------------------------------
-- Grants (new tables only; preserves the anon "no direct tables" invariant)
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.departments to authenticated;
grant select, insert, update, delete on public.touchpoints to authenticated;
grant select on public.concern_categories to authenticated;
grant select on public.response_concerns to authenticated;
grant select on public.rating_scales to authenticated;
grant select on public.rating_scale_points to authenticated;

-- ---------------------------------------------------------------------------
-- Seed the controlled vocabularies (global, non-tenant reference data)
-- ---------------------------------------------------------------------------

insert into public.concern_categories (slug, name_en, name_ar, position) values
  ('freshness',        'Freshness',        'النضارة',          1),
  ('appearance',       'Appearance',       'المظهر',           2),
  ('availability',     'Availability',     'التوفر',           3),
  ('cleanliness',      'Cleanliness',      'النظافة',          4),
  ('price',            'Price',            'السعر',            5),
  ('staff-assistance', 'Staff assistance', 'مساعدة الموظفين',  6);

insert into public.rating_scales (key, name_en, name_ar, scale_min, scale_max, satisfied_min, negative_max) values
  ('fresh_produce_5', 'Fresh Produce quality', 'جودة المنتجات الطازجة', 1, 5, 4, 2);

insert into public.rating_scale_points (scale_key, value, label_en, label_ar, position) values
  ('fresh_produce_5', 1, 'Very poor',  'سيئ جداً', 1),
  ('fresh_produce_5', 2, 'Poor',       'سيئ',      2),
  ('fresh_produce_5', 3, 'Acceptable', 'مقبول',    3),
  ('fresh_produce_5', 4, 'Good',       'جيد',      4),
  ('fresh_produce_5', 5, 'Excellent',  'ممتاز',    5);

comment on table public.departments is
  'Location-scoped operational departments (e.g. Fresh Produce, Checkout).';
comment on table public.touchpoints is
  'Physical capture points (display QR, checkout counter, kiosk) bound to a location and department.';
comment on table public.concern_categories is
  'Global controlled concern vocabulary. Never stored as uncontrolled free text.';
comment on table public.response_concerns is
  'Normalized concern selections per response. At most one primary concern per response.';
comment on table public.rating_scales is
  'Configurable rating scales with labels and satisfied/negative thresholds. The generic 0-10 numeric scale is unaffected.';
comment on column public.survey_responses.channel is
  'Capture channel: qr, kiosk, or web. Historical rows default to web (documented backfill).';
comment on column public.survey_responses.controlled_record_reference is
  'Authorized, user-entered reference to an EXTERNALLY controlled record. The platform never creates or closes such records.';
