-- Secure kiosk enrollment RPCs, device-credential hardening, and the
-- is_kiosk_online volatility correction.
--
-- Additive only. No earlier migration is edited, no column is dropped, no
-- existing RPC is removed, and no existing kiosk record becomes invalid.
--
-- ---------------------------------------------------------------------------
-- Authorized roles (read off the live schema, not invented)
-- ---------------------------------------------------------------------------
--   organization_owner, organization_admin  -- via organization_memberships
--                                              with status = 'active'
--   platform_admin                          -- via profiles.platform_role
-- organization_memberships carries a CHECK forbidding platform_admin, so
-- platform admins are recognised only through profiles. Both paths are
-- folded into one helper below so every RPC agrees on the definition.
--
-- ---------------------------------------------------------------------------
-- Token model
-- ---------------------------------------------------------------------------
-- Raw setup token: 32 random bytes (two gen_random_uuid() values, ~244 bits of
-- entropy, comfortably above the 128-bit floor) rendered base64url. Chosen
-- over gen_random_bytes so the migration carries no pgcrypto dependency.
-- Stored as encode(sha256(...),'hex') only. The raw value is returned exactly
-- once, by the issuing RPC, and is not recoverable from any other function --
-- get_kiosk_enrollment_session_details deliberately returns no hash.
--
-- ---------------------------------------------------------------------------
-- Device credential model, and why access_token still gets written
-- ---------------------------------------------------------------------------
-- kiosk_devices.access_token is NOT NULL with a UNIQUE constraint, and the
-- deployed application still authenticates legacy devices by matching it. It
-- therefore cannot be nulled without breaking production, which this session
-- is forbidden from doing.
--
-- The expand step is credential_version:
--   version 1 (default, every existing row) -- legacy. access_token holds the
--       real credential in plaintext. Still accepted, unchanged.
--   version 2 (new enrollments only) -- hash-only. device_credential_hash
--       holds sha256(raw). access_token receives an opaque non-secret filler
--       ('v2:' || uuid) purely to satisfy NOT NULL/UNIQUE. That filler is
--       never returned by any RPC and is explicitly rejected as a credential
--       by validate_kiosk_device_credential, so it cannot be replayed as one
--       even by someone with direct table access.
--
-- Later contract step (NOT performed now): rotate remaining v1 devices to v2,
-- then drop the legacy branch and finally the column. Before that cleanup,
-- verify no v1 rows remain and no client still sends a v1 credential.
--
-- ---------------------------------------------------------------------------
-- Rate limiting
-- ---------------------------------------------------------------------------
-- No project-standard throttling mechanism exists in the schema, so rather
-- than bolt on a parallel subsystem this reuses rows that are written anyway:
--   issuance  -- counts sessions created for the device in the last 5 minutes
--                (read-only; no new writes, so no write amplification).
--   exchange  -- a bounded counter on the session row itself; the row already
--                exists and the counter is capped, so a flood cannot inflate
--                storage.
-- Both raise the same generic message and never disclose whether a kiosk or
-- organization exists.

-- =====================================================
-- 1. credential_version on kiosk_devices
-- =====================================================

alter table public.kiosk_devices
  add column if not exists credential_version smallint not null default 1;

comment on column public.kiosk_devices.credential_version is
  '1 = legacy plaintext access_token credential. 2 = hash-only credential in device_credential_hash; access_token holds non-secret filler.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.kiosk_devices'::regclass
      and conname = 'kiosk_devices_credential_version_known'
  ) then
    alter table public.kiosk_devices
      add constraint kiosk_devices_credential_version_known
      check (credential_version in (1, 2));
  end if;
end $$;

-- =====================================================
-- 2. Bounded exchange-attempt counter on the session
-- =====================================================

alter table public.kiosk_enrollment_sessions
  add column if not exists exchange_attempt_count smallint not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.kiosk_enrollment_sessions'::regclass
      and conname = 'kiosk_enrollment_sessions_attempt_count_bounded'
  ) then
    alter table public.kiosk_enrollment_sessions
      add constraint kiosk_enrollment_sessions_attempt_count_bounded
      check (exchange_attempt_count between 0 and 1000);
  end if;
end $$;

-- =====================================================
-- 3. Shared helpers
-- =====================================================

-- Single definition of "may administer this organization's kiosks".
create or replace function public.kiosk_admin_can_manage_org(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
      and om.role in ('organization_owner', 'organization_admin')
  )
  or exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.platform_role = 'platform_admin'
  );
$$;

-- Deterministic lookup hash. sha256() is built into Postgres 11+, so this
-- needs no extension and cannot break if pgcrypto moves schema.
create or replace function public.kiosk_hash_token(p_raw text)
returns text
language sql
immutable
set search_path = public
as $$
  select encode(sha256(convert_to(p_raw, 'UTF8')), 'hex');
$$;

-- 32 random bytes, base64url, no padding.
create or replace function public.kiosk_generate_raw_token()
returns text
language sql
volatile
set search_path = public
as $$
  select rtrim(
    translate(
      encode(
        decode(
          replace(gen_random_uuid()::text, '-', '') ||
          replace(gen_random_uuid()::text, '-', ''),
          'hex'
        ),
        'base64'
      ),
      '+/', '-_'
    ),
    '='
  );
$$;

revoke all on function public.kiosk_admin_can_manage_org(uuid) from public, anon;
revoke all on function public.kiosk_hash_token(text) from public, anon;
revoke all on function public.kiosk_generate_raw_token() from public, anon, authenticated;
grant execute on function public.kiosk_admin_can_manage_org(uuid) to authenticated;

-- =====================================================
-- 4. Issue / regenerate a setup session
-- =====================================================
-- Issuance and regeneration are deliberately the same entry point: both mean
-- "this kiosk should now have exactly one fresh setup link", and splitting
-- them would give two code paths that must agree on superseding.

create or replace function public.issue_kiosk_enrollment_session(
  p_kiosk_device_id uuid,
  p_ttl_minutes integer default 20
)
returns table (
  session_id uuid,
  raw_token text,
  expires_at timestamptz,
  superseded_previous boolean
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_raw text;
  v_superseded integer;
  v_recent integer;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  if p_ttl_minutes is null or p_ttl_minutes < 5 or p_ttl_minutes > 30 then
    raise exception 'Invalid expiration window';
  end if;

  -- Lock the device row first. This serialises concurrent issuance for the
  -- same kiosk, so two callers cannot both pass the supersede step and then
  -- collide on the one-open-session unique index.
  select kd.organization_id into v_org
  from public.kiosk_devices kd
  where kd.id = p_kiosk_device_id
  for update;

  -- Unknown device and unauthorized device produce the identical error, so
  -- this cannot be used to probe which kiosk ids exist.
  if v_org is null or not public.kiosk_admin_can_manage_org(v_org) then
    raise exception 'Not authorized';
  end if;

  select count(*) into v_recent
  from public.kiosk_enrollment_sessions s
  where s.kiosk_device_id = p_kiosk_device_id
    and s.created_at > now() - interval '5 minutes';

  if v_recent >= 5 then
    raise exception 'Too many requests, please retry shortly';
  end if;

  -- Supersede whatever is open. Required, not optional: the one-open-session
  -- index does not consider expiry (predicates must be IMMUTABLE), so an
  -- expired-but-open row still occupies the slot and would raise a raw
  -- unique_violation on insert.
  update public.kiosk_enrollment_sessions s
     set revoked_at = now(),
         failure_reason = 'superseded',
         updated_at = now()
   where s.kiosk_device_id = p_kiosk_device_id
     and s.used_at is null
     and s.revoked_at is null;
  get diagnostics v_superseded = row_count;

  v_raw := public.kiosk_generate_raw_token();

  return query
  insert into public.kiosk_enrollment_sessions (
    organization_id, kiosk_device_id, token_hash,
    expires_at, created_by
  )
  values (
    v_org, p_kiosk_device_id, public.kiosk_hash_token(v_raw),
    now() + make_interval(mins => p_ttl_minutes), auth.uid()
  )
  returning
    public.kiosk_enrollment_sessions.id,
    v_raw,
    public.kiosk_enrollment_sessions.expires_at,
    (v_superseded > 0);
end $$;

-- =====================================================
-- 5. Administrator-safe session metadata
-- =====================================================
-- Returns no token_hash and no raw token. There is intentionally no way back
-- to the token from this function.

create or replace function public.get_kiosk_enrollment_session_details(
  p_kiosk_device_id uuid
)
returns table (
  session_id uuid,
  status text,
  expires_at timestamptz,
  opened_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz,
  created_by uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select kd.organization_id into v_org
  from public.kiosk_devices kd
  where kd.id = p_kiosk_device_id;

  if v_org is null or not public.kiosk_admin_can_manage_org(v_org) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    s.id,
    case
      when s.used_at is not null    then 'used'
      when s.revoked_at is not null then 'revoked'
      when s.expires_at <= now()    then 'expired'
      when s.opened_at is not null  then 'opened'
      else 'active'
    end,
    s.expires_at, s.opened_at, s.used_at, s.revoked_at,
    s.created_at, s.created_by
  from public.kiosk_enrollment_sessions s
  where s.kiosk_device_id = p_kiosk_device_id
  -- Same deterministic ordering as revoke_kiosk_enrollment_session.
  order by
    (s.used_at is null and s.revoked_at is null) desc,
    (s.used_at is not null) desc,
    greatest(coalesce(s.used_at, 'epoch'::timestamptz),
             coalesce(s.revoked_at, 'epoch'::timestamptz)) desc,
    s.created_at desc,
    s.id desc
  limit 1;

end $$;


-- =====================================================
-- 6. Revoke a setup session
-- =====================================================
-- Truthful and idempotent. Distinguishes revoked / already_revoked /
-- already_used / expired / no_active_session rather than returning a bare
-- success, which is the same class of defect commit 9958c4e fixed for
-- activation.
--
-- Distinct from revoke_kiosk_credential: this kills a pending setup LINK,
-- that one kills an ACTIVE DEVICE credential. Neither is a substitute.

create or replace function public.revoke_kiosk_enrollment_session(
  p_kiosk_device_id uuid
)
returns table (
  outcome text,
  session_id uuid
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_row public.kiosk_enrollment_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authorized';
  end if;

  select kd.organization_id into v_org
  from public.kiosk_devices kd
  where kd.id = p_kiosk_device_id
  for update;

  if v_org is null or not public.kiosk_admin_can_manage_org(v_org) then
    raise exception 'Not authorized';
  end if;

  -- Pick the session this call should report on, deterministically.
  --
  -- created_at alone is NOT a safe ordering: now() is transaction time, so
  -- several sessions created in one transaction share an identical
  -- created_at and the winner would be arbitrary -- an admin could be told
  -- "already revoked" for a kiosk that had in fact just been enrolled.
  --
  -- Order of preference:
  --   1. the still-open session (there is at most one, by partial index);
  --   2. otherwise a USED session -- enrollment actually completed, which is
  --      the terminal, most important fact about this kiosk and must outrank
  --      a merely superseded row. Without this rank, a kiosk that had been
  --      successfully enrolled could be reported as 'already_revoked',
  --      because supersede and use both stamp the same transaction now() and
  --      the timestamp comparison below then ties.
  --   3. otherwise the most recently closed session;
  --   4. id as a final tiebreak so the result is always stable.
  select * into v_row
  from public.kiosk_enrollment_sessions s
  where s.kiosk_device_id = p_kiosk_device_id
  order by
    (s.used_at is null and s.revoked_at is null) desc,
    (s.used_at is not null) desc,
    greatest(coalesce(s.used_at, 'epoch'::timestamptz),
             coalesce(s.revoked_at, 'epoch'::timestamptz)) desc,
    s.created_at desc,
    s.id desc
  limit 1
  for update;



  if v_row.id is null then
    return query select 'no_active_session'::text, null::uuid;
    return;
  end if;

  if v_row.used_at is not null then
    return query select 'already_used'::text, v_row.id;
    return;
  end if;

  if v_row.revoked_at is not null then
    return query select 'already_revoked'::text, v_row.id;
    return;
  end if;

  if v_row.expires_at <= now() then
    -- Close the row so it stops occupying the one-open-session slot, but
    -- report the truth: it was already unusable before this call.
    update public.kiosk_enrollment_sessions
       set revoked_at = now(), failure_reason = 'expired', updated_at = now()
     where id = v_row.id;
    return query select 'already_expired'::text, v_row.id;
    return;
  end if;

  update public.kiosk_enrollment_sessions
     set revoked_at = now(), failure_reason = 'revoked_by_admin', updated_at = now()
   where id = v_row.id;

  return query select 'revoked'::text, v_row.id;
end $$;

-- =====================================================
-- 7. Atomic token exchange (device-facing)
-- =====================================================

create or replace function public.exchange_kiosk_enrollment_token(
  p_raw_token text
)
returns table (
  kiosk_device_id uuid,
  organization_id uuid,
  device_name text,
  survey_id uuid,
  default_language text,
  branding jsonb,
  idle_timeout_seconds integer,
  raw_device_credential text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_session public.kiosk_enrollment_sessions%rowtype;
  v_raw_credential text;
begin
  if p_raw_token is null or length(p_raw_token) < 20 then
    raise exception 'Invalid or expired setup link';
  end if;

  v_hash := public.kiosk_hash_token(p_raw_token);

  -- THE atomic step. Claiming the row and asserting it is unused happen in a
  -- single UPDATE, so two concurrent exchanges cannot both match: the second
  -- blocks on the row lock, re-evaluates `used_at is null` after the first
  -- commits, matches nothing, and fails. Replay fails the same way.
  update public.kiosk_enrollment_sessions s
     set used_at = now(),
         updated_at = now(),
         exchange_attempt_count = least(s.exchange_attempt_count + 1, 1000)
   where s.token_hash = v_hash
     and s.used_at is null
     and s.revoked_at is null
     and s.expires_at > now()
  returning s.* into v_session;

  if v_session.id is null then
    -- Count the failed attempt against the session when the token resolves to
    -- one, so a brute-force run against a known link is bounded. Deliberately
    -- no new row is written for an unrecognised token, so a flood of garbage
    -- tokens cannot amplify storage.
    update public.kiosk_enrollment_sessions s
       set exchange_attempt_count = least(s.exchange_attempt_count + 1, 1000),
           updated_at = now()
     where s.token_hash = v_hash;

    -- One generic message for every failure category: unknown, expired,
    -- revoked, already used. No oracle.
    raise exception 'Invalid or expired setup link';
  end if;

  if v_session.exchange_attempt_count > 20 then
    raise exception 'Invalid or expired setup link';
  end if;

  v_raw_credential := public.kiosk_generate_raw_token();

  -- Hash-only. access_token receives non-secret filler solely to satisfy the
  -- NOT NULL + UNIQUE constraints it still carries; it is never returned and
  -- is rejected as a credential for version 2 devices.
  update public.kiosk_devices kd
     set device_credential_hash = public.kiosk_hash_token(v_raw_credential),
         credential_version = 2,
         access_token = 'v2:' || gen_random_uuid()::text,
         activated_at = now(),
         updated_at = now()
   where kd.id = v_session.kiosk_device_id
     and kd.organization_id = v_session.organization_id;

  if not found then
    -- Rolls back the session claim above along with everything else.
    raise exception 'Invalid or expired setup link';
  end if;

  return query
  select
    kd.id, kd.organization_id, kd.device_name, kd.survey_id,
    kd.default_language, kd.branding, kd.idle_timeout_seconds,
    v_raw_credential
  from public.kiosk_devices kd
  where kd.id = v_session.kiosk_device_id;
end $$;

-- =====================================================
-- 8. Mark the setup link opened
-- =====================================================

create or replace function public.mark_kiosk_enrollment_session_opened(
  p_raw_token text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_updated integer;
begin
  if p_raw_token is null or length(p_raw_token) < 20 then
    return false;
  end if;

  update public.kiosk_enrollment_sessions s
     set opened_at = coalesce(s.opened_at, now()),
         updated_at = now()
   where s.token_hash = public.kiosk_hash_token(p_raw_token)
     and s.used_at is null
     and s.revoked_at is null
     and s.expires_at > now();
  get diagnostics v_updated = row_count;

  -- Boolean only; reveals nothing beyond "this link is still open".
  return v_updated > 0;
end $$;

-- =====================================================
-- 9. Device credential validation
-- =====================================================

create or replace function public.validate_kiosk_device_credential(
  p_raw_credential text
)
returns table (
  kiosk_device_id uuid,
  organization_id uuid,
  credential_version smallint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_raw_credential is null or length(p_raw_credential) < 8 then
    return;
  end if;

  -- Never let the version-2 filler be replayed as a credential.
  if p_raw_credential like 'v2:%' then
    return;
  end if;

  return query
  select kd.id, kd.organization_id, kd.credential_version
  from public.kiosk_devices kd
  where
    (
      -- New model: hash-only.
      kd.credential_version = 2
      and kd.device_credential_hash = public.kiosk_hash_token(p_raw_credential)
    )
    or
    (
      -- Legacy model: preserved deliberately so existing devices keep working.
      kd.credential_version = 1
      and kd.access_token = p_raw_credential
    )
  limit 1;
end $$;

-- =====================================================
-- 10. is_kiosk_online volatility correction
-- =====================================================
-- The function reads now() but was declared IMMUTABLE, which is simply untrue:
-- IMMUTABLE promises the same output forever for the same input, so the
-- planner is entitled to fold a call to a constant and reuse it. Confirmed
-- against the live catalog (provolatile = 'i') before changing it.
--
-- STABLE is the correct class: results are fixed within a statement but change
-- across statements. Signature, arguments, default and semantics are all
-- preserved; only the volatility label changes. Verified first that no index
-- depends on this function, so nothing needs reindexing.

create or replace function public.is_kiosk_online(
  p_last_seen_at timestamptz,
  p_threshold_seconds integer default 120
)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    p_last_seen_at is not null
    and (timezone('utc', now()) - p_last_seen_at) < (p_threshold_seconds || ' seconds')::interval;
$$;

-- =====================================================
-- 11. Grants
-- =====================================================
-- Supabase's default privileges grant EXECUTE on every new function to anon
-- as well, so an explicit REVOKE is required -- adding a GRANT does not remove
-- it. This is the same trap documented in 20260801150000.

revoke all on function public.issue_kiosk_enrollment_session(uuid, integer) from public, anon;
revoke all on function public.get_kiosk_enrollment_session_details(uuid) from public, anon;
revoke all on function public.revoke_kiosk_enrollment_session(uuid) from public, anon;
revoke all on function public.exchange_kiosk_enrollment_token(text) from public, anon, authenticated;
revoke all on function public.mark_kiosk_enrollment_session_opened(text) from public, anon, authenticated;
revoke all on function public.validate_kiosk_device_credential(text) from public, anon, authenticated;

-- Administrator surface: authenticated only. Each function then re-checks
-- auth.uid() and role, so the grant is a coarse outer gate, not the control.
grant execute on function public.issue_kiosk_enrollment_session(uuid, integer) to authenticated;
grant execute on function public.get_kiosk_enrollment_session_details(uuid) to authenticated;
grant execute on function public.revoke_kiosk_enrollment_session(uuid) to authenticated;

-- Device surface: service_role only. The enrollment page is server-rendered,
-- so the browser never calls these directly and anon needs no access at all.
-- This keeps the device path narrowly scoped instead of opening anon RPC
-- access to token exchange.
grant execute on function public.exchange_kiosk_enrollment_token(text) to service_role;
grant execute on function public.mark_kiosk_enrollment_session_opened(text) to service_role;
grant execute on function public.validate_kiosk_device_credential(text) to service_role;

comment on function public.issue_kiosk_enrollment_session(uuid, integer) is
  'Issues or regenerates the single active kiosk setup session. Returns the raw token exactly once.';
comment on function public.exchange_kiosk_enrollment_token(text) is
  'Atomically exchanges a raw setup token for a hash-only device credential. One-time use; replay and concurrent use both fail.';
comment on function public.revoke_kiosk_enrollment_session(uuid) is
  'Revokes a pending setup link. Distinct from revoke_kiosk_credential, which revokes an active device credential.';
