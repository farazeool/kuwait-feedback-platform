-- Kiosk Enrollment Session Schema Foundation
--
-- Additive migration. Introduces the table that will back link-based kiosk
-- enrollment ("setup links"). This migration deliberately ships SCHEMA ONLY:
-- no RPCs, no token generation, no credential changes. Those arrive in a
-- later, separate migration so that this one is trivially reversible and
-- fully compatible with the currently deployed application.
--
-- EXPAND-AND-CONTRACT POSITION
-- ---------------------------
-- This is the EXPAND step. Nothing here is read or written by production code
-- today. No existing kiosk column is dropped, no existing RPC is altered, and
-- no existing kiosk record is modified. The legacy six-character activation
-- code path in 20260801090000_kiosk_activation_system.sql remains the only
-- live enrollment mechanism until the RPC migration lands.
--
-- ACTIVE SESSION RULE (read this before changing the unique index)
-- ---------------------------------------------------------------
-- A session is considered OPEN when:
--     used_at IS NULL AND revoked_at IS NULL
-- A session is considered USABLE when it is OPEN and additionally:
--     expires_at > now()
--
-- The partial unique index below enforces at most one OPEN session per kiosk
-- device. It intentionally does NOT include `expires_at > now()`: PostgreSQL
-- requires index predicates to be IMMUTABLE, and now() is STABLE, so a
-- time-dependent partial unique index is not expressible.
--
-- Consequence, stated plainly: an OPEN-but-EXPIRED session continues to
-- occupy the single active slot for its kiosk. Releasing that slot is the
-- responsibility of the issuing RPC, which must close the prior session by
-- setting revoked_at (with failure_reason 'superseded' or 'expired') in the
-- same transaction that inserts the replacement. That behaviour is specified
-- here and implemented in the next migration.

-- =====================================================
-- 1. TABLE
-- =====================================================

create table if not exists public.kiosk_enrollment_sessions (
  id uuid primary key default gen_random_uuid(),

  -- Tenancy
  organization_id uuid not null
    references public.organizations (id) on delete cascade,
  kiosk_device_id uuid not null,

  -- Credential material. Only ever the hash of the raw setup token.
  -- The raw token is returned once at issuance and is never persisted.
  token_hash text not null,

  -- Lifecycle
  expires_at timestamptz not null,
  opened_at timestamptz,
  used_at timestamptz,
  revoked_at timestamptz,
  failure_reason text,

  -- Audit
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- Tenant integrity: the device must belong to the same organization as the
  -- session. Mirrors the composite-FK convention used by
  -- kiosk_devices_location_fk in 20260730200000_kiosk_device_management.sql.
  constraint kiosk_enrollment_sessions_device_fk
    foreign key (kiosk_device_id, organization_id)
    references public.kiosk_devices (id, organization_id)
    on delete cascade,

  -- Hash column must hold a hash, never a raw token. SHA-256 hex is 64 chars;
  -- the range leaves room for a stronger digest later without a schema change.
  constraint kiosk_enrollment_sessions_token_hash_format
    check (char_length(token_hash) between 32 and 200),

  constraint kiosk_enrollment_sessions_expiry_after_creation
    check (expires_at > created_at),

  constraint kiosk_enrollment_sessions_failure_reason_length
    check (failure_reason is null or char_length(failure_reason) <= 200)
);

comment on table public.kiosk_enrollment_sessions is
  'Short-lived, single-use kiosk setup-link sessions. Stores only the hash of the setup token; the raw token is returned once at issuance and never persisted.';
comment on column public.kiosk_enrollment_sessions.token_hash is
  'Deterministic hash of the raw setup token. Never store or log the raw token.';
comment on column public.kiosk_enrollment_sessions.opened_at is
  'First time the setup link was opened on a device. Diagnostic only; does not consume the session.';
comment on column public.kiosk_enrollment_sessions.used_at is
  'Set exactly once when the token is atomically exchanged for a device credential.';
comment on column public.kiosk_enrollment_sessions.revoked_at is
  'Set when an administrator revokes the link, or when the session is superseded by a newer one.';
comment on column public.kiosk_enrollment_sessions.failure_reason is
  'Non-sensitive category describing why a session closed, e.g. superseded, expired, revoked_by_admin. Never contains token material.';

-- =====================================================
-- 2. INDEXES
-- =====================================================

-- Token-hash lookup. Unique: a hash collision or reuse must never yield two
-- candidate sessions during exchange.
create unique index if not exists kiosk_enrollment_sessions_token_hash_key
  on public.kiosk_enrollment_sessions (token_hash);

-- Kiosk device lookup (session history for one device).
create index if not exists kiosk_enrollment_sessions_kiosk_device_id_idx
  on public.kiosk_enrollment_sessions (kiosk_device_id);

-- Organization lookup (fleet-wide administrator views).
create index if not exists kiosk_enrollment_sessions_organization_id_idx
  on public.kiosk_enrollment_sessions (organization_id);

-- Expiration sweep / retention cleanup.
create index if not exists kiosk_enrollment_sessions_expires_at_idx
  on public.kiosk_enrollment_sessions (expires_at);

-- Active-session lookup: the hot path for "does this kiosk have a live link?"
create index if not exists kiosk_enrollment_sessions_active_idx
  on public.kiosk_enrollment_sessions (kiosk_device_id, expires_at desc)
  where used_at is null and revoked_at is null;

-- ACTIVE-SESSION UNIQUENESS.
-- At most one OPEN (unused, unrevoked) session per kiosk device.
-- See the header note for why expiry is not part of the predicate.
create unique index if not exists kiosk_enrollment_sessions_one_open_per_device_idx
  on public.kiosk_enrollment_sessions (kiosk_device_id)
  where used_at is null and revoked_at is null;

-- =====================================================
-- 3. TRIGGERS
-- =====================================================

drop trigger if exists kiosk_enrollment_sessions_updated_at
  on public.kiosk_enrollment_sessions;

create trigger kiosk_enrollment_sessions_updated_at
  before update on public.kiosk_enrollment_sessions
  for each row
  execute function public.set_updated_at();

-- =====================================================
-- 4. ROW LEVEL SECURITY
-- =====================================================

alter table public.kiosk_enrollment_sessions enable row level security;

-- Deny-by-default: with RLS enabled and no permissive policy matching, anon
-- gets nothing. Table privileges are additionally revoked below.

-- Platform administrators retain full access, matching the policy shape used
-- by kiosk_devices in 20260730200000_kiosk_device_management.sql.
drop policy if exists "Platform admins have full access to kiosk enrollment sessions"
  on public.kiosk_enrollment_sessions;

create policy "Platform admins have full access to kiosk enrollment sessions"
  on public.kiosk_enrollment_sessions
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

-- Organization owners and admins may READ session metadata for their own
-- organization only. Read access is metadata only: token_hash is a hash, and
-- the raw token is never stored, so no credential is exposed by this policy.
--
-- There is deliberately NO insert/update/delete policy for organization
-- members. All mutation happens through SECURITY DEFINER RPCs in the next
-- migration, so that issuance, exchange and revocation are atomic and
-- authorization is enforced in one place.
drop policy if exists "Organization admins can view their kiosk enrollment sessions"
  on public.kiosk_enrollment_sessions;

create policy "Organization admins can view their kiosk enrollment sessions"
  on public.kiosk_enrollment_sessions
  for select
  using (
    organization_id in (
      select om.organization_id
      from public.organization_memberships om
      where om.user_id = auth.uid()
        and om.role in ('organization_owner', 'organization_admin')
        and om.status = 'active'
    )
  );

-- =====================================================
-- 5. GRANTS
-- =====================================================

-- No broad access. anon must not touch this table at all; the device-facing
-- token exchange will be a narrowly scoped SECURITY DEFINER function added in
-- the next migration, not direct table access.
revoke all on public.kiosk_enrollment_sessions from public;
revoke all on public.kiosk_enrollment_sessions from anon;

-- authenticated gets SELECT only, still filtered by the RLS policies above.
grant select on public.kiosk_enrollment_sessions to authenticated;
