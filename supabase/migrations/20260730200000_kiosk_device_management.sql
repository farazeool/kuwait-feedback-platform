-- Kiosk Device Management System
-- Enables remote management, configuration, and monitoring of iPad kiosk devices

-- =====================================================
-- ENUMS
-- =====================================================

create type public.kiosk_status as enum ('active', 'paused', 'maintenance', 'offline', 'revoked', 'archived');
create type public.kiosk_channel as enum ('kiosk', 'tablet', 'qr');

-- =====================================================
-- TABLES
-- =====================================================

-- Kiosk devices (touchpoints) - Physical iPad devices
create table public.kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  location_id uuid not null,
  
  -- Device identification
  device_name text not null check (char_length(device_name) between 1 and 120),
  device_identifier text unique check (char_length(device_identifier) between 8 and 64),
  access_token text not null unique default encode(gen_random_bytes(32), 'base64url'),
  
  -- Current assignment
  survey_id uuid references public.surveys (id) on delete set null,
  
  -- Device metadata
  channel public.kiosk_channel not null default 'kiosk',
  status public.kiosk_status not null default 'active',
  notes text check (notes is null or char_length(notes) <= 1000),

  -- Remote configuration (pushed to the device on each config poll)
  default_language text not null default 'en'
    check (default_language in ('en', 'ar')),
  branding jsonb not null default '{}'::jsonb,
  idle_timeout_seconds integer not null default 60
    check (idle_timeout_seconds between 10 and 600),

  -- Monitoring
  last_seen_at timestamptz,
  last_response_at timestamptz,
  total_responses integer not null default 0,
  
  -- Device info (reported by kiosk)
  device_model text,
  os_version text,
  app_version text,
  
  -- Audit
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  
  -- Constraints
  constraint kiosk_devices_location_fk
    foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
    on delete cascade,
  constraint kiosk_devices_id_organization_key
    unique (id, organization_id)
);

-- Kiosk configuration history - Track all configuration changes
create table public.kiosk_config_history (
  id uuid primary key default gen_random_uuid(),
  kiosk_device_id uuid not null references public.kiosk_devices (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  
  -- What changed
  previous_survey_id uuid references public.surveys (id) on delete set null,
  new_survey_id uuid references public.surveys (id) on delete set null,
  previous_status public.kiosk_status,
  new_status public.kiosk_status,
  
  -- Who and when
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default timezone('utc', now()),
  change_reason text check (change_reason is null or char_length(change_reason) <= 500)
);

-- =====================================================
-- INDEXES
-- =====================================================

create index kiosk_devices_organization_id_idx on public.kiosk_devices (organization_id);
create index kiosk_devices_location_id_idx on public.kiosk_devices (location_id);
create index kiosk_devices_survey_id_idx on public.kiosk_devices (survey_id);
create index kiosk_devices_status_idx on public.kiosk_devices (status)
  where status not in ('archived', 'revoked');
-- NOTE: access_token already has a unique constraint, which provides its own
-- btree index. No separate index is created here to avoid a redundant index.

create index kiosk_config_history_device_id_idx on public.kiosk_config_history (kiosk_device_id);
create index kiosk_config_history_organization_id_idx on public.kiosk_config_history (organization_id);
create index kiosk_config_history_changed_at_idx on public.kiosk_config_history (changed_at desc);

-- =====================================================
-- TRIGGERS
-- =====================================================

create trigger kiosk_devices_updated_at
  before update on public.kiosk_devices
  for each row
  execute function public.set_updated_at();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

alter table public.kiosk_devices enable row level security;
alter table public.kiosk_config_history enable row level security;

-- Kiosk devices RLS policies
create policy "Platform admins have full access to kiosk devices"
  on public.kiosk_devices
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.platform_role = 'platform_admin'
      and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.platform_role = 'platform_admin'
      and profiles.status = 'active'
    )
  );

create policy "Organization members can view their kiosk devices"
  on public.kiosk_devices
  for select
  using (
    organization_id in (
      select organization_id
      from public.organization_memberships
      where user_id = auth.uid()
      and status = 'active'
    )
  );

-- NOTE: a `for all` policy without `with check` only constrains the rows a
-- user may READ. Without the `with check` clause below, an org admin could
-- INSERT or UPDATE a kiosk row carrying another organization's
-- organization_id, escaping tenant isolation. The check mirrors the using
-- clause so a row can never be written outside the caller's organization.
create policy "Organization owners and admins can manage kiosk devices"
  on public.kiosk_devices
  for all
  using (
    organization_id in (
      select organization_id
      from public.organization_memberships
      where user_id = auth.uid()
      and role in ('organization_owner', 'organization_admin')
      and status = 'active'
    )
  )
  with check (
    organization_id in (
      select organization_id
      from public.organization_memberships
      where user_id = auth.uid()
      and role in ('organization_owner', 'organization_admin')
      and status = 'active'
    )
  );

create policy "Location managers can view kiosk devices at their locations"
  on public.kiosk_devices
  for select
  using (
    location_id in (
      select location_id
      from public.location_memberships
      where user_id = auth.uid()
      and role = 'location_manager'
      and status = 'active'
    )
  );

-- Kiosk config history RLS policies
create policy "Platform admins have full access to kiosk config history"
  on public.kiosk_config_history
  for all
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.platform_role = 'platform_admin'
      and profiles.status = 'active'
    )
  )
  with check (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
      and profiles.platform_role = 'platform_admin'
      and profiles.status = 'active'
    )
  );

create policy "Organization members can view their kiosk config history"
  on public.kiosk_config_history
  for select
  using (
    organization_id in (
      select organization_id
      from public.organization_memberships
      where user_id = auth.uid()
      and status = 'active'
    )
  );

-- =====================================================
-- FUNCTIONS - Kiosk Management RPCs
-- =====================================================

-- List kiosk devices for an organization
create or replace function public.list_kiosk_devices(
  p_organization_id uuid,
  p_location_id uuid default null,
  p_status public.kiosk_status default null
)
returns table (
  id uuid,
  organization_id uuid,
  location_id uuid,
  location_name_en text,
  location_name_ar text,
  device_name text,
  device_identifier text,
  survey_id uuid,
  survey_title_en text,
  survey_title_ar text,
  channel public.kiosk_channel,
  status public.kiosk_status,
  notes text,
  default_language text,
  branding jsonb,
  idle_timeout_seconds integer,
  last_seen_at timestamptz,
  last_response_at timestamptz,
  total_responses integer,
  device_model text,
  os_version text,
  app_version text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Check authorization
  if not exists (
    select 1 from public.organization_memberships om
    where om.user_id = auth.uid()
    and om.organization_id = p_organization_id
    and om.status = 'active'
  ) and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.platform_role = 'platform_admin'
    and p.status = 'active'
  ) then
    raise exception 'Not authorized to view kiosk devices for this organization';
  end if;

  return query
  select
    kd.id,
    kd.organization_id,
    kd.location_id,
    l.name_en as location_name_en,
    l.name_ar as location_name_ar,
    kd.device_name,
    kd.device_identifier,
    kd.survey_id,
    s.title_en as survey_title_en,
    s.title_ar as survey_title_ar,
    kd.channel,
    kd.status,
    kd.notes,
    kd.default_language,
    kd.branding,
    kd.idle_timeout_seconds,
    kd.last_seen_at,
    kd.last_response_at,
    kd.total_responses,
    kd.device_model,
    kd.os_version,
    kd.app_version,
    kd.created_at,
    kd.updated_at
  from public.kiosk_devices kd
  join public.locations l
    on l.id = kd.location_id
    and l.organization_id = kd.organization_id
  left join public.surveys s
    on s.id = kd.survey_id
    and s.organization_id = kd.organization_id
  where kd.organization_id = p_organization_id
    and (p_location_id is null or kd.location_id = p_location_id)
    and (p_status is null or kd.status = p_status)
  order by kd.created_at desc;
end;
$$;

-- Create a new kiosk device
create or replace function public.create_kiosk_device(
  p_organization_id uuid,
  p_location_id uuid,
  p_device_name text,
  p_device_identifier text default null,
  p_survey_id uuid default null,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
begin
  -- Check authorization
  if not exists (
    select 1 from public.organization_memberships om
    where om.user_id = auth.uid()
    and om.organization_id = p_organization_id
    and om.role in ('organization_owner', 'organization_admin')
    and om.status = 'active'
  ) and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.platform_role = 'platform_admin'
    and p.status = 'active'
  ) then
    raise exception 'Not authorized to create kiosk devices for this organization';
  end if;

  -- Verify location belongs to organization
  if not exists (
    select 1 from public.locations
    where id = p_location_id
    and organization_id = p_organization_id
    and status = 'active'
  ) then
    raise exception 'Invalid location for this organization';
  end if;

  -- Verify survey belongs to organization and is active
  if p_survey_id is not null and not exists (
    select 1 from public.surveys
    where id = p_survey_id
    and organization_id = p_organization_id
    and status = 'active'
  ) then
    raise exception 'Invalid or inactive survey for this organization';
  end if;

  -- Create the kiosk device
  insert into public.kiosk_devices (
    organization_id,
    location_id,
    device_name,
    device_identifier,
    survey_id,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_location_id,
    p_device_name,
    p_device_identifier,
    p_survey_id,
    p_notes,
    auth.uid()
  )
  returning id into v_device_id;

  -- Log initial configuration
  insert into public.kiosk_config_history (
    kiosk_device_id,
    organization_id,
    new_survey_id,
    new_status,
    changed_by,
    change_reason
  )
  values (
    v_device_id,
    p_organization_id,
    p_survey_id,
    'active',
    auth.uid(),
    'Initial device creation'
  );

  return v_device_id;
end;
$$;

-- Update kiosk device configuration
create or replace function public.update_kiosk_device(
  p_device_id uuid,
  p_device_name text default null,
  p_survey_id uuid default null,
  p_status public.kiosk_status default null,
  p_notes text default null,
  p_change_reason text default null,
  p_default_language text default null,
  p_branding jsonb default null,
  p_idle_timeout_seconds integer default null,
  p_clear_survey boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_old_survey_id uuid;
  v_old_status public.kiosk_status;
  v_new_survey_id uuid;
  v_survey_changed boolean := false;
begin
  -- Lock the row so concurrent admin edits cannot interleave and produce an
  -- audit trail that disagrees with the final row state.
  select organization_id, survey_id, status
  into v_org_id, v_old_survey_id, v_old_status
  from public.kiosk_devices
  where id = p_device_id
  for update;

  if v_org_id is null then
    raise exception 'Kiosk device not found';
  end if;

  -- Check authorization
  if not exists (
    select 1 from public.organization_memberships om
    where om.user_id = auth.uid()
    and om.organization_id = v_org_id
    and om.role in ('organization_owner', 'organization_admin')
    and om.status = 'active'
  ) and not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
    and p.platform_role = 'platform_admin'
    and p.status = 'active'
  ) then
    raise exception 'Not authorized to update this kiosk device';
  end if;

  -- Resolve the target survey. p_clear_survey allows explicit unassignment,
  -- which a plain coalesce() could never express.
  if p_clear_survey then
    v_new_survey_id := null;
  else
    v_new_survey_id := coalesce(p_survey_id, v_old_survey_id);
  end if;

  v_survey_changed := v_new_survey_id is distinct from v_old_survey_id;

  -- A newly assigned survey must belong to this organization and be active.
  -- This is the tenant-isolation guard for remote survey reassignment.
  if v_survey_changed and v_new_survey_id is not null then
    if not exists (
      select 1 from public.surveys
      where id = v_new_survey_id
      and organization_id = v_org_id
      and status = 'active'
    ) then
      raise exception 'Invalid or inactive survey for this organization';
    end if;
  end if;

  -- Update the device
  update public.kiosk_devices
  set
    device_name = coalesce(p_device_name, device_name),
    survey_id = v_new_survey_id,
    status = coalesce(p_status, status),
    notes = coalesce(p_notes, notes),
    default_language = coalesce(p_default_language, default_language),
    branding = coalesce(p_branding, branding),
    idle_timeout_seconds = coalesce(p_idle_timeout_seconds, idle_timeout_seconds)
  where id = p_device_id;

  -- Log configuration change if survey or status changed
  if v_survey_changed or (p_status is not null and p_status <> v_old_status) then
    insert into public.kiosk_config_history (
      kiosk_device_id,
      organization_id,
      previous_survey_id,
      new_survey_id,
      previous_status,
      new_status,
      changed_by,
      change_reason
    )
    values (
      p_device_id,
      v_org_id,
      v_old_survey_id,
      v_new_survey_id,
      v_old_status,
      coalesce(p_status, v_old_status),
      auth.uid(),
      p_change_reason
    );
  end if;

  return true;
end;
$$;

-- Get kiosk configuration by access token (for kiosk devices to poll)
create or replace function public.get_kiosk_config(
  p_access_token text
)
returns table (
  device_id uuid,
  device_name text,
  survey_public_slug text,
  status public.kiosk_status,
  default_language text,
  branding jsonb,
  idle_timeout_seconds integer,
  last_config_change timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device_id uuid;
  v_status public.kiosk_status;
begin
  -- Resolve device by access token. Archived devices are treated as
  -- non-existent so a decommissioned device cannot keep polling.
  select id, kiosk_devices.status
  into v_device_id, v_status
  from public.kiosk_devices
  where access_token = p_access_token;

  if v_device_id is null or v_status = 'archived' then
    raise exception 'Invalid access token' using errcode = 'insufficient_privilege';
  end if;

  -- Track liveness for every valid poll, including paused/maintenance devices,
  -- so operators can still see that the hardware is online. Revoked devices are
  -- intentionally excluded: they must not appear healthy.
  if v_status <> 'revoked' then
    update public.kiosk_devices
    set last_seen_at = timezone('utc', now())
    where id = v_device_id;
  end if;

  -- Return current configuration. The survey slug is withheld unless the
  -- device is active, so a paused/maintenance/revoked device can never render
  -- a survey even if the client ignores the status field.
  return query
  select
    kd.id as device_id,
    kd.device_name,
    case when kd.status = 'active' then s.public_slug else null end as survey_public_slug,
    kd.status,
    kd.default_language,
    kd.branding,
    kd.idle_timeout_seconds,
    greatest(
      coalesce(
        (select max(changed_at) from public.kiosk_config_history where kiosk_device_id = kd.id),
        kd.updated_at
      ),
      kd.updated_at
    ) as last_config_change
  from public.kiosk_devices kd
  left join public.surveys s
    on s.id = kd.survey_id
    and s.organization_id = kd.organization_id
    and s.status = 'active'
  where kd.id = v_device_id;
end;
$$;

-- Update kiosk heartbeat and device info
create or replace function public.update_kiosk_heartbeat(
  p_access_token text,
  p_device_model text default null,
  p_os_version text default null,
  p_app_version text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  -- Only devices that are still commissioned may record a heartbeat. Without
  -- the status filter an archived or revoked token would return true and the
  -- device would believe it is healthy (false success).
  update public.kiosk_devices
  set
    last_seen_at = timezone('utc', now()),
    device_model = coalesce(p_device_model, device_model),
    os_version = coalesce(p_os_version, os_version),
    app_version = coalesce(p_app_version, app_version)
  where access_token = p_access_token
    and status not in ('archived', 'revoked');

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Record kiosk response submission (called by feedback API)
create or replace function public.record_kiosk_response(
  p_access_token text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  -- Only an active device may attribute a response to itself. A paused,
  -- maintenance, revoked or archived device must not increment counters.
  update public.kiosk_devices
  set
    last_response_at = timezone('utc', now()),
    total_responses = total_responses + 1
  where access_token = p_access_token
    and status = 'active';

  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

-- Resolves the tenant binding for a single device from its own access token.
-- The token is the device's bearer secret, so returning that device's own
-- organization/location/survey is not a cross-tenant disclosure. No row is
-- returned for an unknown token, and archived devices are excluded entirely.
create or replace function public.resolve_kiosk_attribution(
  p_access_token text
)
returns table (
  device_id uuid,
  organization_id uuid,
  location_id uuid,
  survey_id uuid,
  channel public.kiosk_channel,
  status public.kiosk_status
)
language sql
security definer
set search_path = public
stable
as $$
  select
    d.id,
    d.organization_id,
    d.location_id,
    d.survey_id,
    d.channel,
    d.status
  from public.kiosk_devices d
  where d.access_token = p_access_token
    and d.status <> 'archived';
$$;

-- =====================================================
-- GRANTS
-- =====================================================

grant select on public.kiosk_devices to authenticated;
grant select on public.kiosk_config_history to authenticated;

grant execute on function public.list_kiosk_devices to authenticated;
grant execute on function public.create_kiosk_device to authenticated;
grant execute on function public.update_kiosk_device to authenticated;
grant execute on function public.get_kiosk_config to anon, authenticated;
grant execute on function public.update_kiosk_heartbeat to anon, authenticated;
grant execute on function public.record_kiosk_response to anon, authenticated;
grant execute on function public.resolve_kiosk_attribution to anon, authenticated;
