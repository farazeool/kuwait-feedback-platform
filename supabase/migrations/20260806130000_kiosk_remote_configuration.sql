-- =====================================================
-- Boundary C1A: kiosk remote configuration (additive)
-- =====================================================
-- Extends public.kiosk_devices with a desired/applied configuration pair so a
-- kiosk can poll its intended state, acknowledge application, report a bounded
-- failure and record liveness, authenticating only through the existing
-- credential system (public.validate_kiosk_device_credential).
--
-- Additive only: nothing already applied is dropped or redefined. Existing
-- kiosk rows and enrolled credentials are preserved, and the current survey
-- assignment is backfilled into both desired and applied state so every
-- existing device starts converged.
--
-- Device identity is the device credential. IP address is never used as
-- identity or authentication. No raw credential and no credential hash is
-- returned by any function added here.

-- =====================================================
-- 1. CONFIGURATION COLUMNS
-- =====================================================
alter table public.kiosk_devices
  add column if not exists desired_config_version bigint not null default 1,
  add column if not exists applied_config_version bigint not null default 0,
  add column if not exists desired_survey_id uuid,
  add column if not exists applied_survey_id uuid,
  add column if not exists desired_mode text not null default 'active',
  add column if not exists applied_mode text not null default 'active',
  add column if not exists configuration_updated_at timestamptz,
  add column if not exists configuration_applied_at timestamptz,
  add column if not exists configuration_error text,
  add column if not exists last_heartbeat_at timestamptz;

-- =====================================================
-- 2. BACKFILL EXISTING DEVICES
-- =====================================================
-- Existing devices converge immediately (desired == applied) so no fleet-wide
-- reconfiguration is triggered by this migration. Only rows never touched by
-- this feature are backfilled, which keeps the statement safe to re-run.
--
-- Status is mapped onto an operating mode, not replaced by it: 'offline' is
-- derived from last_seen_at rather than stored, 'archived' devices must not
-- serve, and 'pending_activation' devices still need enrollment.
update public.kiosk_devices kd
set desired_survey_id = kd.survey_id,
    applied_survey_id = kd.survey_id,
    desired_mode = m.mode,
    applied_mode = m.mode,
    desired_config_version = 1,
    applied_config_version = 1,
    configuration_updated_at = timezone('utc', now()),
    configuration_applied_at = timezone('utc', now())
from (
  select
    d.id,
    case d.status
      when 'revoked' then 'revoked'
      when 'paused' then 'paused'
      when 'maintenance' then 'maintenance'
      when 'archived' then 'paused'
      when 'pending_activation' then 're_enrollment_required'
      else 'active'
    end as mode
  from public.kiosk_devices d
) m
where m.id = kd.id
  and kd.configuration_updated_at is null;

-- =====================================================
-- 3. CONSTRAINTS
-- =====================================================
-- Allowed operating modes. Kept as bounded text rather than a new enum so a
-- mode can be added later without an enum rewrite, while still rejecting
-- unknown values at write time.
alter table public.kiosk_devices
  add constraint kiosk_devices_desired_mode_check
  check (desired_mode in ('active', 'paused', 'maintenance', 're_enrollment_required', 'revoked'));

alter table public.kiosk_devices
  add constraint kiosk_devices_applied_mode_check
  check (applied_mode in ('active', 'paused', 'maintenance', 're_enrollment_required', 'revoked'));

-- A device can never claim to have applied a configuration that was never
-- issued, which is what makes a forged or replayed acknowledgement detectable.
alter table public.kiosk_devices
  add constraint kiosk_devices_config_version_order_check
  check (
    desired_config_version >= 1
    and applied_config_version >= 0
    and applied_config_version <= desired_config_version
  );

-- Device-reported text is bounded at the storage layer as well as in the RPC,
-- so a misbehaving or hostile device cannot inflate the row.
alter table public.kiosk_devices
  add constraint kiosk_devices_configuration_error_length_check
  check (configuration_error is null or char_length(configuration_error) between 1 and 500);

-- Tenant-safe survey references. These mirror kiosk_devices_survey_fk exactly:
-- the composite target public.surveys (id, organization_id) is what prevents a
-- kiosk being pointed at another organization's survey, and ON DELETE SET NULL
-- is scoped to the survey column so deleting a survey never nulls
-- organization_id.
alter table public.kiosk_devices
  add constraint kiosk_devices_desired_survey_fk
  foreign key (desired_survey_id, organization_id)
  references public.surveys (id, organization_id)
  on delete set null (desired_survey_id);

alter table public.kiosk_devices
  add constraint kiosk_devices_applied_survey_fk
  foreign key (applied_survey_id, organization_id)
  references public.surveys (id, organization_id)
  on delete set null (applied_survey_id);

-- =====================================================
-- 4. INDEXES
-- =====================================================
-- Supports the two composite FKs above on the referencing side, matching the
-- existing kiosk_devices_survey_org_idx.
create index if not exists kiosk_devices_desired_survey_org_idx
  on public.kiosk_devices (desired_survey_id, organization_id);

create index if not exists kiosk_devices_applied_survey_org_idx
  on public.kiosk_devices (applied_survey_id, organization_id);

-- The one operational query this feature adds: which devices in an
-- organization have not yet converged. Partial, so it stays small in a fleet
-- that is normally converged.
create index if not exists kiosk_devices_pending_config_idx
  on public.kiosk_devices (organization_id)
  where applied_config_version < desired_config_version;

-- =====================================================
-- 5. INTERNAL: CREDENTIAL RESOLUTION
-- =====================================================
-- Single place where a raw device credential becomes a device identity.
-- public.validate_kiosk_device_credential only matches the credential; it
-- deliberately does not judge revocation, so revocation is enforced here:
-- public.revoke_kiosk_credential sets both status = 'revoked' and
-- credential_revoked_at, and either alone is sufficient to reject.
--
-- Returns the device id only. The credential and its hash never leave this
-- function. It is not granted to any client role: the callers below are
-- SECURITY DEFINER and therefore invoke it as the owner.
create or replace function public.kiosk_resolve_device_credential(
  p_raw_credential text
)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_device_id uuid;
  v_ok boolean;
begin
  if p_raw_credential is null or length(p_raw_credential) < 8 then
    raise exception 'Invalid device credential' using errcode = 'insufficient_privilege';
  end if;

  select v.kiosk_device_id
  into v_device_id
  from public.validate_kiosk_device_credential(p_raw_credential) v
  limit 1;

  if v_device_id is null then
    raise exception 'Invalid device credential' using errcode = 'insufficient_privilege';
  end if;

  select (kd.credential_revoked_at is null and kd.status not in ('revoked', 'archived'))
  into v_ok
  from public.kiosk_devices kd
  where kd.id = v_device_id;

  if v_ok is not true then
    raise exception 'Device credential revoked' using errcode = 'insufficient_privilege';
  end if;

  return v_device_id;
end $$;

comment on function public.kiosk_resolve_device_credential(text) is
  'Resolves a raw kiosk device credential to a device id, rejecting unknown and revoked credentials. Internal: not granted to client roles, and never returns credential material.';

-- =====================================================
-- 6. INTERNAL: ERROR SANITISATION
-- =====================================================
-- Device-supplied failure text is untrusted. Control characters are stripped
-- (they corrupt logs and dashboards), whitespace is collapsed, and the result
-- is truncated to the 500 characters the column constraint allows. Empty or
-- whitespace-only input becomes NULL rather than an empty string.
create or replace function public.kiosk_sanitize_configuration_error(
  p_error text
)
returns text
language sql
immutable
as $$
  select nullif(
    left(
      btrim(regexp_replace(coalesce(p_error, ''), '[[:cntrl:]]+', ' ', 'g')),
      500
    ),
    ''
  );
$$;

comment on function public.kiosk_sanitize_configuration_error(text) is
  'Bounds and strips control characters from device-reported configuration error text.';

-- =====================================================
-- 7. RPC: FETCH DESIRED CONFIGURATION
-- =====================================================
-- The device polls its own configuration. The credential alone selects the
-- row, so a device cannot address another device and cannot reach another
-- organization: no device id is accepted as an argument.
--
-- Read-only. Liveness is recorded by the heartbeat RPC, which keeps a failing
-- poll from silently registering as a healthy device.
--
-- The returned columns are exactly the fields the device needs to render,
-- plus the version handshake. No credential, credential hash, access token or
-- activation code is exposed.
create or replace function public.get_kiosk_desired_configuration(
  p_raw_credential text
)
returns table (
  kiosk_device_id uuid,
  organization_id uuid,
  desired_config_version bigint,
  desired_survey_id uuid,
  desired_mode text,
  applied_config_version bigint,
  applied_survey_id uuid,
  applied_mode text,
  configuration_updated_at timestamptz,
  configuration_applied_at timestamptz,
  configuration_error text,
  default_language text,
  branding jsonb,
  idle_timeout_seconds integer
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_device_id uuid;
begin
  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  return query
  select
    kd.id,
    kd.organization_id,
    kd.desired_config_version,
    kd.desired_survey_id,
    kd.desired_mode,
    kd.applied_config_version,
    kd.applied_survey_id,
    kd.applied_mode,
    kd.configuration_updated_at,
    kd.configuration_applied_at,
    kd.configuration_error,
    kd.default_language,
    kd.branding,
    kd.idle_timeout_seconds
  from public.kiosk_devices kd
  where kd.id = v_device_id;
end $$;

comment on function public.get_kiosk_desired_configuration(text) is
  'Returns the calling kiosk device its own desired and applied configuration. Device identity comes solely from the credential, so no device can read another device or another organization.';

-- =====================================================
-- 8. RPC: ACKNOWLEDGE SUCCESSFUL APPLICATION
-- =====================================================
-- The device confirms it is now running a specific configuration version.
--
-- The acknowledged version is checked against the row, not trusted:
--   * a version above desired_config_version is rejected outright, so a device
--     cannot fabricate progress or park itself beyond the fleet;
--   * re-acknowledging a version at or below applied_config_version is a
--     no-op, so retries and duplicate deliveries are idempotent and can never
--     move applied state backwards;
--   * a version between applied and desired is stale (its payload has already
--     been superseded) and is likewise a no-op, leaving the device to
--     converge on the current desired version.
--
-- Only an acknowledgement of the current desired version copies the desired
-- snapshot into applied state and clears the last error.
create or replace function public.acknowledge_kiosk_configuration(
  p_raw_credential text,
  p_config_version bigint
)
returns table (
  kiosk_device_id uuid,
  acknowledged boolean,
  desired_config_version bigint,
  applied_config_version bigint,
  applied_survey_id uuid,
  applied_mode text,
  configuration_applied_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_device_id uuid;
  v_desired bigint;
  v_applied bigint;
  v_acknowledged boolean := false;
begin
  if p_config_version is null or p_config_version < 1 then
    raise exception 'Configuration version must be a positive integer'
      using errcode = 'invalid_parameter_value';
  end if;

  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  -- Row lock: two acknowledgements racing must not interleave read and write.
  select kd.desired_config_version, kd.applied_config_version
  into v_desired, v_applied
  from public.kiosk_devices kd
  where kd.id = v_device_id
  for update;

  if p_config_version > v_desired then
    raise exception 'Cannot acknowledge a configuration version that was never issued'
      using errcode = 'invalid_parameter_value';
  end if;

  if p_config_version = v_desired and p_config_version > v_applied then
    update public.kiosk_devices kd
    set applied_config_version = p_config_version,
        applied_survey_id = kd.desired_survey_id,
        applied_mode = kd.desired_mode,
        configuration_applied_at = timezone('utc', now()),
        configuration_error = null,
        last_seen_at = timezone('utc', now()),
        updated_at = timezone('utc', now())
    where kd.id = v_device_id;

    v_acknowledged := true;
  end if;

  return query
  select
    kd.id,
    v_acknowledged,
    kd.desired_config_version,
    kd.applied_config_version,
    kd.applied_survey_id,
    kd.applied_mode,
    kd.configuration_applied_at
  from public.kiosk_devices kd
  where kd.id = v_device_id;
end $$;

comment on function public.acknowledge_kiosk_configuration(text, bigint) is
  'Records that the calling kiosk applied a configuration version. Future versions are rejected; repeated or stale acknowledgements are idempotent no-ops.';

-- =====================================================
-- 9. RPC: REPORT APPLICATION FAILURE
-- =====================================================
-- The device could not apply the desired configuration.
--
-- Failure is recorded beside the configuration, never instead of it: the
-- desired state is left untouched so the device keeps retrying, and
-- applied_config_version is left untouched so the fleet view still shows what
-- the device is actually running. Only the error text and liveness change,
-- which is what makes retry safe and unlimited.
--
-- The reported text is untrusted and is sanitized and bounded before storage.
create or replace function public.report_kiosk_configuration_failure(
  p_raw_credential text,
  p_config_version bigint,
  p_error text
)
returns table (
  kiosk_device_id uuid,
  desired_config_version bigint,
  applied_config_version bigint,
  configuration_error text
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_device_id uuid;
  v_desired bigint;
  v_error text;
begin
  if p_config_version is null or p_config_version < 1 then
    raise exception 'Configuration version must be a positive integer'
      using errcode = 'invalid_parameter_value';
  end if;

  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  select kd.desired_config_version
  into v_desired
  from public.kiosk_devices kd
  where kd.id = v_device_id
  for update;

  -- A failure can only be reported against a version this device was actually
  -- given, on the same reasoning as the acknowledgement path.
  if p_config_version > v_desired then
    raise exception 'Cannot report failure for a configuration version that was never issued'
      using errcode = 'invalid_parameter_value';
  end if;

  v_error := coalesce(
    public.kiosk_sanitize_configuration_error(p_error),
    'Kiosk reported an unspecified configuration failure'
  );

  update public.kiosk_devices kd
  set configuration_error = v_error,
      last_seen_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where kd.id = v_device_id;

  return query
  select
    kd.id,
    kd.desired_config_version,
    kd.applied_config_version,
    kd.configuration_error
  from public.kiosk_devices kd
  where kd.id = v_device_id;
end $$;

comment on function public.report_kiosk_configuration_failure(text, bigint, text) is
  'Records a sanitized, bounded configuration failure for the calling kiosk without changing desired or applied state, so the device can retry.';

-- =====================================================
-- 10. RPC: HEARTBEAT
-- =====================================================
-- Liveness plus an optional self-report of the mode the device is currently
-- running. The reported mode is allowlisted against the same five modes and
-- can only describe applied state: a heartbeat can never change
-- desired_mode, desired_survey_id or any config version, so a compromised
-- device cannot reconfigure itself or the fleet through this path.
--
-- The returned configuration_pending flag lets a device on a slow heartbeat
-- learn that it should re-poll, without a second round trip.
create or replace function public.record_kiosk_heartbeat(
  p_raw_credential text,
  p_applied_mode text default null
)
returns table (
  kiosk_device_id uuid,
  last_seen_at timestamptz,
  last_heartbeat_at timestamptz,
  applied_mode text,
  configuration_pending boolean
)
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_device_id uuid;
  v_now timestamptz := timezone('utc', now());
begin
  if p_applied_mode is not null
     and p_applied_mode not in ('active', 'paused', 'maintenance', 're_enrollment_required', 'revoked') then
    raise exception 'Unsupported kiosk operating mode'
      using errcode = 'invalid_parameter_value';
  end if;

  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  update public.kiosk_devices kd
  set last_seen_at = v_now,
      last_heartbeat_at = v_now,
      applied_mode = coalesce(p_applied_mode, kd.applied_mode),
      updated_at = v_now
  where kd.id = v_device_id;

  return query
  select
    kd.id,
    kd.last_seen_at,
    kd.last_heartbeat_at,
    kd.applied_mode,
    (kd.applied_config_version < kd.desired_config_version) as configuration_pending
  from public.kiosk_devices kd
  where kd.id = v_device_id;
end $$;

comment on function public.record_kiosk_heartbeat(text, text) is
  'Records liveness for the calling kiosk and optionally its currently applied mode. Cannot alter desired configuration or any version.';

-- =====================================================
-- 11. RPC: MANAGEMENT VIEW
-- =====================================================
-- Operator-facing configuration state for one organization. Authorization
-- reuses public.kiosk_admin_can_manage_org, so this inherits the existing
-- rule: an active organization_owner or organization_admin of that
-- organization, or a platform_admin.
--
-- The organization is an explicit argument and is authorized before any row is
-- read, so an admin of one organization cannot reach another. anon and
-- authenticated callers without that membership get an exception rather than
-- an empty set, so the function cannot be used to probe for device existence.
-- No credential, credential hash or activation code is selected.
create or replace function public.get_kiosk_configuration_state(
  p_organization_id uuid
)
returns table (
  kiosk_device_id uuid,
  device_name text,
  status text,
  desired_config_version bigint,
  applied_config_version bigint,
  desired_survey_id uuid,
  applied_survey_id uuid,
  desired_mode text,
  applied_mode text,
  configuration_updated_at timestamptz,
  configuration_applied_at timestamptz,
  configuration_error text,
  last_seen_at timestamptz,
  last_heartbeat_at timestamptz,
  configuration_pending boolean
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if p_organization_id is null then
    raise exception 'Organization is required'
      using errcode = 'invalid_parameter_value';
  end if;

  if not public.kiosk_admin_can_manage_org(p_organization_id) then
    raise exception 'Not authorized to view kiosk configuration for this organization'
      using errcode = 'insufficient_privilege';
  end if;

  return query
  select
    kd.id,
    kd.device_name,
    kd.status::text,
    kd.desired_config_version,
    kd.applied_config_version,
    kd.desired_survey_id,
    kd.applied_survey_id,
    kd.desired_mode,
    kd.applied_mode,
    kd.configuration_updated_at,
    kd.configuration_applied_at,
    kd.configuration_error,
    kd.last_seen_at,
    kd.last_heartbeat_at,
    (kd.applied_config_version < kd.desired_config_version) as configuration_pending
  from public.kiosk_devices kd
  where kd.organization_id = p_organization_id
  order by kd.device_name;
end $$;

comment on function public.get_kiosk_configuration_state(uuid) is
  'Returns kiosk configuration and liveness state for one organization to its authorized administrators. Never returns credential material.';


-- =====================================================
-- 12. GRANTS (MINIMUM NECESSARY)
-- =====================================================
-- A newly created function carries EXECUTE for PUBLIC by default, so every
-- function defined above is revoked first and then granted back only where a
-- caller genuinely exists.
--
-- The two internal helpers are granted to no client role at all. They are
-- reachable only from inside the SECURITY DEFINER bodies above, matching how
-- validate_kiosk_device_credential is confined in the enrollment migration.
revoke all on function public.kiosk_resolve_device_credential(text)
  from public, anon, authenticated;
revoke all on function public.kiosk_sanitize_configuration_error(text)
  from public, anon, authenticated;

revoke all on function public.get_kiosk_desired_configuration(text)
  from public, anon, authenticated;
revoke all on function public.acknowledge_kiosk_configuration(text, bigint)
  from public, anon, authenticated;
revoke all on function public.report_kiosk_configuration_failure(text, bigint, text)
  from public, anon, authenticated;
revoke all on function public.record_kiosk_heartbeat(text, text)
  from public, anon, authenticated;
revoke all on function public.get_kiosk_configuration_state(uuid)
  from public, anon;

-- Device surface: service_role only. This mirrors the enrollment migration,
-- which grants exchange_kiosk_enrollment_token and
-- validate_kiosk_device_credential to service_role alone. The kiosk holds a
-- device credential rather than a Supabase session, and its requests are
-- proxied by trusted server-side code, so anon never needs execute here.
-- Keeping anon off the credential path means an unauthenticated browser
-- cannot call these functions at all, let alone use them to probe for a
-- valid credential.
grant execute on function public.get_kiosk_desired_configuration(text) to service_role;
grant execute on function public.acknowledge_kiosk_configuration(text, bigint) to service_role;
grant execute on function public.report_kiosk_configuration_failure(text, bigint, text) to service_role;
grant execute on function public.record_kiosk_heartbeat(text, text) to service_role;

-- Administrator surface: authenticated only, matching the enrollment RPCs.
-- The grant is the coarse outer gate; kiosk_admin_can_manage_org inside the
-- function is the actual control.
grant execute on function public.get_kiosk_configuration_state(uuid) to authenticated;

-- =====================================================
-- 13. NOTES FOR REVIEW
-- =====================================================
-- * No new table is introduced, so no new RLS policy is required. The row
--   level security already in force on public.kiosk_devices continues to
--   govern direct table access, and the columns added here are covered by it.
--   Public and anonymous callers therefore cannot enumerate kiosk devices
--   either directly or through the functions above.
-- * The SECURITY DEFINER functions deliberately bypass that RLS, which is why
--   each performs its own authorization first: credential resolution for the
--   device RPCs, kiosk_admin_can_manage_org for the management RPC.
-- * Nothing here reads a client IP or any other network attribute. Device
--   identity is the enrolled credential and only the enrolled credential.
-- * No function selects device_credential_hash, access_token or any
--   activation code, so no credential material can leave the database on
--   these paths.
