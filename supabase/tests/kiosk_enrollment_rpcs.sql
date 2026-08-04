-- Tests for the kiosk enrollment RPC layer (20260802100000).
--
-- Style matches the existing kiosk suites: plain SQL, assertions that
-- `raise exception` on failure, all inside one transaction rolled back at the
-- end so the suite leaves no residue.
--
-- Authorization is exercised by impersonating roles the way the other kiosk
-- suites do: set request.jwt.claims + `set local role`, so auth.uid() returns
-- the intended user and grants/RLS apply exactly as they do in production.
--
-- NOTE ON NEGATIVE TESTS: every "must fail" case asserts the EXACT error
-- message via pg_temp.expect_err. A loose "did anything throw?" check is
-- dangerous here -- an unrelated failure (missing grant, renamed function,
-- typo) would satisfy it and a genuine security hole would be reported as a
-- working security control.

begin;

\set ON_ERROR_STOP on

-- =====================================================
-- Fixtures
-- =====================================================

create temporary table t_ids (k text primary key, v uuid);
create temporary table t_tokens (k text primary key, v text);

-- Impersonated roles must be able to read the fixture lookup tables.
-- These are temporary and disappear with the rollback.
grant select, insert, update, delete on t_ids to authenticated, anon, service_role;
grant select, insert, update, delete on t_tokens to authenticated, anon, service_role;

do $$
declare
  v_org_a uuid := gen_random_uuid();
  v_org_b uuid := gen_random_uuid();
  v_owner_a uuid := gen_random_uuid();
  v_member_a uuid := gen_random_uuid();
  v_owner_b uuid := gen_random_uuid();
  v_loc_a uuid := gen_random_uuid();
  v_loc_b uuid := gen_random_uuid();
  v_dev_a uuid := gen_random_uuid();
  v_dev_b uuid := gen_random_uuid();
  v_dev_legacy uuid := gen_random_uuid();
begin
  insert into t_ids values
    ('org_a', v_org_a), ('org_b', v_org_b),
    ('owner_a', v_owner_a), ('member_a', v_member_a), ('owner_b', v_owner_b),
    ('dev_a', v_dev_a), ('dev_b', v_dev_b), ('dev_legacy', v_dev_legacy);

  insert into auth.users (id, email, encrypted_password, email_confirmed_at,
                          created_at, updated_at, aud, role)
  values
    (v_owner_a,  'owner-a@test.local',  'x', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_member_a, 'member-a@test.local', 'x', now(), now(), now(), 'authenticated', 'authenticated'),
    (v_owner_b,  'owner-b@test.local',  'x', now(), now(), now(), 'authenticated', 'authenticated');

  insert into public.organizations (id, slug, name_en, name_ar)
  values (v_org_a, 'org-a-' || substr(v_org_a::text, 1, 8), 'Org A', 'Org A'),
         (v_org_b, 'org-b-' || substr(v_org_b::text, 1, 8), 'Org B', 'Org B');

  -- profiles rows are created automatically by the on_auth_user_created
  -- trigger and carry no organization_id: org membership lives solely in
  -- organization_memberships. Confirm the trigger fired, since the
  -- platform_admin authorization branch reads profiles.
  if (select count(*) from public.profiles
      where id in (v_owner_a, v_member_a, v_owner_b)) <> 3 then
    raise exception 'FIXTURE: expected profiles to be auto-created for all 3 users';
  end if;

  insert into public.organization_memberships
    (organization_id, user_id, role, scope, status)
  values
    (v_org_a, v_owner_a,  'organization_owner', 'organization', 'active'),
    (v_org_a, v_member_a, 'analyst',            'organization', 'active'),
    (v_org_b, v_owner_b,  'organization_owner', 'organization', 'active');

  insert into public.locations (id, organization_id, slug, name_en, name_ar)
  values (v_loc_a, v_org_a, 'loc-a-' || substr(v_loc_a::text, 1, 8), 'Loc A', 'Loc A'),
         (v_loc_b, v_org_b, 'loc-b-' || substr(v_loc_b::text, 1, 8), 'Loc B', 'Loc B');

  insert into public.kiosk_devices
    (id, organization_id, location_id, device_name, access_token,
     channel, status, default_language, branding, idle_timeout_seconds,
     total_responses, created_at, updated_at)
  values
    (v_dev_a, v_org_a, v_loc_a, 'Device A', 'tok-a-' || v_dev_a::text,
     'kiosk', 'active', 'en', '{}'::jsonb, 60, 0, now(), now()),
    (v_dev_b, v_org_b, v_loc_b, 'Device B', 'tok-b-' || v_dev_b::text,
     'kiosk', 'active', 'en', '{}'::jsonb, 60, 0, now(), now()),
    (v_dev_legacy, v_org_a, v_loc_a, 'Legacy Device', 'legacy-plaintext-credential-value',
     'kiosk', 'active', 'en', '{}'::jsonb, 60, 0, now(), now());
end $$;

create or replace function pg_temp.id(p_k text) returns uuid
language sql stable as $$ select v from t_ids where k = p_k $$;

create or replace function pg_temp.tok(p_k text) returns text
language sql stable as $$ select v from t_tokens where k = p_k $$;

create or replace function pg_temp.act_as(p_user uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.act_as_service() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role service_role';
end $$;

create or replace function pg_temp.act_as_anon() returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('role', 'anon')::text, true);
  execute 'set local role anon';
end $$;

create or replace function pg_temp.reset_role() returns void
language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

-- Runs p_sql, returns the error message, or null if it unexpectedly succeeded.
create or replace function pg_temp.err_of(p_sql text) returns text
language plpgsql as $$
begin
  execute p_sql;
  return null;
exception when others then
  return sqlerrm;
end $$;

create or replace function pg_temp.expect_err(
  p_label text, p_sql text, p_expected text
) returns void
language plpgsql as $$
declare
  v_msg text := pg_temp.err_of(p_sql);
begin
  if v_msg is null then
    raise exception 'FAIL %: expected error "%", but the call SUCCEEDED', p_label, p_expected;
  end if;
  if v_msg <> p_expected then
    raise exception 'FAIL %: expected error "%", got "%"', p_label, p_expected, v_msg;
  end if;
end $$;

-- Convenience builders for the SQL snippets used by expect_err.
create or replace function pg_temp.sql_issue(p_dev uuid) returns text
language sql immutable as $$
  select format('select public.issue_kiosk_enrollment_session(%L::uuid)', p_dev::text)
$$;

create or replace function pg_temp.sql_details(p_dev uuid) returns text
language sql immutable as $$
  select format('select public.get_kiosk_enrollment_session_details(%L::uuid)', p_dev::text)
$$;

create or replace function pg_temp.sql_revoke(p_dev uuid) returns text
language sql immutable as $$
  select format('select public.revoke_kiosk_enrollment_session(%L::uuid)', p_dev::text)
$$;

create or replace function pg_temp.sql_exchange(p_token text) returns text
language sql immutable as $$
  select format('select public.exchange_kiosk_enrollment_token(%L)', p_token)
$$;

-- =====================================================
-- SECTION 1: schema additions
-- =====================================================

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='kiosk_devices'
      and column_name='credential_version'
  ) then
    raise exception 'FAIL 1.1: credential_version column missing';
  end if;

  -- Every pre-existing device must be classified as legacy (v1) so that
  -- no already-deployed kiosk is invalidated by this migration.
  if exists (select 1 from public.kiosk_devices where credential_version <> 1) then
    raise exception 'FAIL 1.2: pre-existing devices must default to credential_version 1';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='kiosk_enrollment_sessions'
      and column_name='exchange_attempt_count'
  ) then
    raise exception 'FAIL 1.3: exchange_attempt_count column missing';
  end if;
end $$;

-- =====================================================
-- SECTION 2: is_kiosk_online volatility and behaviour
-- =====================================================

do $$
declare
  v_vol char;
begin
  select provolatile into v_vol
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname='public' and p.proname='is_kiosk_online';

  -- 's' = STABLE. The original bug was 'i' (IMMUTABLE) on a function whose
  -- result depends on now(), which lets the planner cache a stale answer.
  if v_vol <> 's' then
    raise exception 'FAIL 2.1: is_kiosk_online volatility is %, expected s (STABLE)', v_vol;
  end if;

  if public.is_kiosk_online(timezone('utc', now()) - interval '10 seconds') is not true then
    raise exception 'FAIL 2.2: recent heartbeat should be online';
  end if;

  if public.is_kiosk_online(timezone('utc', now()) - interval '10 minutes') is not false then
    raise exception 'FAIL 2.3: stale heartbeat should be offline';
  end if;

  if public.is_kiosk_online(null) is not false then
    raise exception 'FAIL 2.4: null heartbeat should be offline';
  end if;

  if public.is_kiosk_online(timezone('utc', now()) - interval '5 minutes', 600) is not true then
    raise exception 'FAIL 2.5: custom threshold should be honoured';
  end if;
end $$;

-- =====================================================
-- SECTION 3: issuance and administrator authorization
-- =====================================================

-- 3.1 unauthorized role (analyst) cannot issue
do $$
begin
  perform pg_temp.act_as(pg_temp.id('member_a'));
  perform pg_temp.expect_err('3.1', pg_temp.sql_issue(pg_temp.id('dev_a')), 'Not authorized');
  perform pg_temp.reset_role();
end $$;

-- 3.2 cross-organization admin cannot issue
do $$
begin
  perform pg_temp.act_as(pg_temp.id('owner_b'));
  perform pg_temp.expect_err('3.2', pg_temp.sql_issue(pg_temp.id('dev_a')), 'Not authorized');
  perform pg_temp.reset_role();
end $$;

-- 3.3 anon cannot issue (no EXECUTE grant at all)
do $$
declare
  v_msg text;
begin
  perform pg_temp.act_as_anon();
  v_msg := pg_temp.err_of(pg_temp.sql_issue(pg_temp.id('dev_a')));
  perform pg_temp.reset_role();

  if v_msg is null then
    raise exception 'FAIL 3.3: anon was able to issue a setup session';
  end if;
  if v_msg not like '%permission denied%' then
    raise exception 'FAIL 3.3: expected a permission-denied error for anon, got "%"', v_msg;
  end if;
end $$;

-- 3.4 authorized owner issues; raw token returned, only its hash stored
do $$
declare
  v_raw text;
  v_sid uuid;
  v_exp timestamptz;
  v_sup boolean;
  v_stored text;
begin
  perform pg_temp.act_as(pg_temp.id('owner_a'));
  select session_id, raw_token, expires_at, superseded_previous
    into v_sid, v_raw, v_exp, v_sup
  from public.issue_kiosk_enrollment_session(pg_temp.id('dev_a'));
  perform pg_temp.reset_role();

  -- 32 random bytes in base64url == 43 chars == 256 bits, well over the
  -- 128-bit floor the security requirement sets.
  if v_raw is null or length(v_raw) < 43 then
    raise exception 'FAIL 3.4: raw token missing or below entropy expectation (len %)',
      coalesce(length(v_raw), -1);
  end if;

  if v_raw !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'FAIL 3.5: raw token is not URL-safe';
  end if;

  if v_sup is not false then
    raise exception 'FAIL 3.6: first issuance must not report superseding';
  end if;

  -- Expiration must land in the required 15-30 minute window.
  if v_exp <= now() + interval '14 minutes' or v_exp > now() + interval '31 minutes' then
    raise exception 'FAIL 3.7: expiration outside the 15-30 minute window: %', v_exp;
  end if;

  select token_hash into v_stored
  from public.kiosk_enrollment_sessions where id = v_sid;

  if v_stored <> encode(sha256(convert_to(v_raw, 'UTF8')), 'hex') then
    raise exception 'FAIL 3.8: stored hash is not sha256(raw token)';
  end if;

  -- The raw token itself must not be recoverable from the row.
  if exists (
    select 1 from public.kiosk_enrollment_sessions
    where id = v_sid
      and (token_hash = v_raw or coalesce(failure_reason, '') like '%' || v_raw || '%')
  ) then
    raise exception 'FAIL 3.9: raw token found stored on the session row';
  end if;

  insert into t_tokens values ('first', v_raw);
end $$;

-- 3.5 details RPC exposes safe metadata only, never the token
do $$
declare
  v_status text;
begin
  perform pg_temp.act_as(pg_temp.id('owner_a'));
  select status into v_status
  from public.get_kiosk_enrollment_session_details(pg_temp.id('dev_a'));
  perform pg_temp.reset_role();

  if v_status <> 'active' then
    raise exception 'FAIL 3.10: expected status active, got %', v_status;
  end if;

  -- Structural guarantee: no output column is named like a secret.
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    cross join lateral unnest(p.proargnames) as a(nm)
    where n.nspname = 'public'
      and p.proname = 'get_kiosk_enrollment_session_details'
      and (nm ilike '%token%' or nm ilike '%hash%' or nm ilike '%credential%')
  ) then
    raise exception 'FAIL 3.11: details RPC exposes a token/hash/credential column';
  end if;
end $$;

-- 3.6 cross-organization details read rejected
do $$
begin
  perform pg_temp.act_as(pg_temp.id('owner_b'));
  perform pg_temp.expect_err('3.12', pg_temp.sql_details(pg_temp.id('dev_a')), 'Not authorized');
  perform pg_temp.reset_role();
end $$;

-- =====================================================
-- SECTION 4: regeneration supersedes the previous session
-- =====================================================

do $$
declare
  v_raw2 text;
  v_sup boolean;
  v_open integer;
begin
  perform pg_temp.act_as(pg_temp.id('owner_a'));
  select raw_token, superseded_previous into v_raw2, v_sup
  from public.issue_kiosk_enrollment_session(pg_temp.id('dev_a'));
  perform pg_temp.reset_role();

  if v_sup is not true then
    raise exception 'FAIL 4.1: regeneration must report superseding the previous session';
  end if;

  if v_raw2 = pg_temp.tok('first') then
    raise exception 'FAIL 4.2: regenerated token must differ from the previous token';
  end if;

  -- The documented active-session rule: at most one open session per kiosk.
  select count(*) into v_open
  from public.kiosk_enrollment_sessions
  where kiosk_device_id = pg_temp.id('dev_a')
    and used_at is null and revoked_at is null;

  if v_open <> 1 then
    raise exception 'FAIL 4.3: expected exactly 1 open session, found %', v_open;
  end if;

  insert into t_tokens values ('second', v_raw2);
end $$;

-- The superseded token must immediately stop working.
do $$
begin
  perform pg_temp.act_as_service();
  perform pg_temp.expect_err('4.4', pg_temp.sql_exchange(pg_temp.tok('first')),
    'Invalid or expired setup link');
  perform pg_temp.reset_role();
end $$;

-- =====================================================
-- SECTION 5: token exchange
-- =====================================================

-- 5.1 invalid token fails with the generic, non-enumerable message
do $$
begin
  perform pg_temp.act_as_service();
  perform pg_temp.expect_err('5.1',
    pg_temp.sql_exchange('not-a-real-token-but-plausibly-long-xxxxxxxxxxxx'),
    'Invalid or expired setup link');
  perform pg_temp.reset_role();
end $$;

-- 5.2 valid token succeeds; the issued credential is stored hash-only
do $$
declare
  v_cred text;
  v_dev uuid;
  v_stored_hash text;
  v_access text;
  v_ver smallint;
begin
  perform pg_temp.act_as_service();
  select raw_device_credential, kiosk_device_id into v_cred, v_dev
  from public.exchange_kiosk_enrollment_token(pg_temp.tok('second'));
  perform pg_temp.reset_role();

  if v_cred is null or length(v_cred) < 43 then
    raise exception 'FAIL 5.2: device credential missing or below entropy expectation';
  end if;

  if v_dev <> pg_temp.id('dev_a') then
    raise exception 'FAIL 5.3: exchange returned the wrong device';
  end if;

  select device_credential_hash, access_token, credential_version
    into v_stored_hash, v_access, v_ver
  from public.kiosk_devices where id = v_dev;

  if v_ver <> 2 then
    raise exception 'FAIL 5.4: new enrollment must set credential_version = 2, got %', v_ver;
  end if;

  if v_stored_hash <> encode(sha256(convert_to(v_cred, 'UTF8')), 'hex') then
    raise exception 'FAIL 5.5: credential hash mismatch';
  end if;

  -- The core hardening guarantee: the plaintext credential is NOT persisted.
  if v_access = v_cred then
    raise exception 'FAIL 5.6: raw credential stored in access_token (plaintext leak)';
  end if;

  if v_access not like 'v2:%' then
    raise exception 'FAIL 5.7: expected non-secret v2 placeholder in access_token, got %', v_access;
  end if;

  if not exists (
    select 1 from public.kiosk_enrollment_sessions
    where kiosk_device_id = v_dev and used_at is not null
  ) then
    raise exception 'FAIL 5.8: session must be marked used after a successful exchange';
  end if;

  insert into t_tokens values ('cred_v2', v_cred);
end $$;

-- 5.3 replay of an already-used token fails
do $$
begin
  perform pg_temp.act_as_service();
  perform pg_temp.expect_err('5.9', pg_temp.sql_exchange(pg_temp.tok('second')),
    'Invalid or expired setup link');
  perform pg_temp.reset_role();
end $$;

-- 5.4 expired token fails and leaves kiosk state untouched
do $$
declare
  v_raw text;
begin
  perform pg_temp.act_as(pg_temp.id('owner_a'));
  select raw_token into v_raw
  from public.issue_kiosk_enrollment_session(pg_temp.id('dev_legacy'));
  perform pg_temp.reset_role();

  -- Backdate created_at as well: the table enforces expires_at > created_at,
  -- so simulating an expired link means shifting the whole row into the past
  -- rather than violating (and thereby weakening) that integrity rule.
  update public.kiosk_enrollment_sessions
     set created_at = now() - interval '60 minutes',
         expires_at = now() - interval '1 minute'
   where kiosk_device_id = pg_temp.id('dev_legacy')
     and used_at is null and revoked_at is null;


  perform pg_temp.act_as_service();
  perform pg_temp.expect_err('5.10', pg_temp.sql_exchange(v_raw),
    'Invalid or expired setup link');
  perform pg_temp.reset_role();

  -- Failure must not enroll the device.
  if (select credential_version from public.kiosk_devices
      where id = pg_temp.id('dev_legacy')) <> 1 then
    raise exception 'FAIL 5.11: failed exchange must not alter kiosk enrollment state';
  end if;

  if (select device_credential_hash from public.kiosk_devices
      where id = pg_temp.id('dev_legacy')) is not null then
    raise exception 'FAIL 5.12: failed exchange must not issue a credential';
  end if;
end $$;

-- =====================================================
-- SECTION 6: revocation is real and truthful
-- =====================================================

do $$
declare
  v_out text;
begin
  perform pg_temp.act_as(pg_temp.id('owner_b'));
  perform public.issue_kiosk_enrollment_session(pg_temp.id('dev_b'));

  select outcome into v_out from public.revoke_kiosk_enrollment_session(pg_temp.id('dev_b'));
  if v_out <> 'revoked' then
    perform pg_temp.reset_role();
    raise exception 'FAIL 6.1: expected outcome revoked, got %', v_out;
  end if;

  -- Idempotent AND truthful: the repeat call must not re-claim success.
  select outcome into v_out from public.revoke_kiosk_enrollment_session(pg_temp.id('dev_b'));
  if v_out <> 'already_revoked' then
    perform pg_temp.reset_role();
    raise exception 'FAIL 6.2: expected outcome already_revoked, got %', v_out;
  end if;
  perform pg_temp.reset_role();
end $$;

-- An already-used session is reported as used, not as a fresh revocation.
do $$
declare
  v_out text;
begin
  perform pg_temp.act_as(pg_temp.id('owner_a'));
  select outcome into v_out from public.revoke_kiosk_enrollment_session(pg_temp.id('dev_a'));
  perform pg_temp.reset_role();

  if v_out <> 'already_used' then
    raise exception 'FAIL 6.3: expected outcome already_used, got %', v_out;
  end if;
end $$;

-- Unauthorized role and cross-organization admin are both rejected.
do $$
begin
  perform pg_temp.act_as(pg_temp.id('member_a'));
  perform pg_temp.expect_err('6.4', pg_temp.sql_revoke(pg_temp.id('dev_a')), 'Not authorized');
  perform pg_temp.reset_role();

  perform pg_temp.act_as(pg_temp.id('owner_b'));
  perform pg_temp.expect_err('6.5', pg_temp.sql_revoke(pg_temp.id('dev_a')), 'Not authorized');
  perform pg_temp.reset_role();
end $$;

-- A revoked setup token can no longer be exchanged.
do $$
declare
  v_raw text;
begin
  perform pg_temp.act_as(pg_temp.id('owner_b'));
  select raw_token into v_raw
  from public.issue_kiosk_enrollment_session(pg_temp.id('dev_b'));
  perform public.revoke_kiosk_enrollment_session(pg_temp.id('dev_b'));
  perform pg_temp.reset_role();

  perform pg_temp.act_as_service();
  perform pg_temp.expect_err('6.6', pg_temp.sql_exchange(v_raw),
    'Invalid or expired setup link');
  perform pg_temp.reset_role();
end $$;

-- =====================================================
-- SECTION 7: credential validation and legacy compatibility
-- =====================================================

-- Capture the v2 access_token placeholder BEFORE impersonating: service_role
-- holds EXECUTE on the RPCs but no direct grant on kiosk_devices, so the read
-- has to happen as the migration-level role. The assertion below is unchanged.
insert into t_tokens
select 'v2_placeholder', access_token
from public.kiosk_devices where id = pg_temp.id('dev_a');

do $$
declare
  v_dev uuid;
  v_ver smallint;
  n integer;
begin
  perform pg_temp.act_as_service();


  -- New hash-only credential validates.
  select kiosk_device_id, credential_version into v_dev, v_ver
  from public.validate_kiosk_device_credential(pg_temp.tok('cred_v2'));
  if v_dev is distinct from pg_temp.id('dev_a') or v_ver <> 2 then
    perform pg_temp.reset_role();
    raise exception 'FAIL 7.1: v2 credential should validate for the enrolled device';
  end if;

  -- Legacy plaintext credential still validates: no deployed kiosk is broken.
  select kiosk_device_id, credential_version into v_dev, v_ver
  from public.validate_kiosk_device_credential('legacy-plaintext-credential-value');
  if v_dev is distinct from pg_temp.id('dev_legacy') or v_ver <> 1 then
    perform pg_temp.reset_role();
    raise exception 'FAIL 7.2: legacy credential must remain valid';
  end if;

  -- Wrong credential returns no row.
  select count(*) into n
  from public.validate_kiosk_device_credential('totally-wrong-credential-value');
  if n <> 0 then
    perform pg_temp.reset_role();
    raise exception 'FAIL 7.3: invalid credential must be rejected';
  end if;

  -- The non-secret v2 placeholder left in access_token must never authenticate.
  select count(*) into n
  from public.validate_kiosk_device_credential(pg_temp.tok('v2_placeholder'));

  if n <> 0 then
    perform pg_temp.reset_role();
    raise exception 'FAIL 7.4: v2 access_token placeholder must not work as a credential';
  end if;

  perform pg_temp.reset_role();
end $$;

-- =====================================================
-- SECTION 8: grants and search_path hardening
-- =====================================================

do $$
declare
  r record;
begin
  -- anon holds EXECUTE on nothing in the enrollment surface.
  for r in
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'issue_kiosk_enrollment_session',
        'get_kiosk_enrollment_session_details',
        'revoke_kiosk_enrollment_session',
        'exchange_kiosk_enrollment_token',
        'mark_kiosk_enrollment_session_opened',
        'validate_kiosk_device_credential'
      )
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    raise exception 'FAIL 8.1: anon holds EXECUTE on %', r.proname;
  end loop;

  -- End users must not reach the device-facing surface: a signed-in tenant
  -- user must not be able to mint device credentials.
  for r in
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in ('exchange_kiosk_enrollment_token',
                        'validate_kiosk_device_credential')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
  loop
    raise exception 'FAIL 8.2: authenticated holds EXECUTE on device-facing %', r.proname;
  end loop;

  -- The admin surface must be reachable by signed-in users (role checks inside).
  for r in
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in ('issue_kiosk_enrollment_session',
                        'get_kiosk_enrollment_session_details',
                        'revoke_kiosk_enrollment_session')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
  loop
    raise exception 'FAIL 8.3: authenticated lacks EXECUTE on admin %', r.proname;
  end loop;

  -- PUBLIC must never hold EXECUTE on any of them.
  for r in
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'issue_kiosk_enrollment_session',
        'get_kiosk_enrollment_session_details',
        'revoke_kiosk_enrollment_session',
        'exchange_kiosk_enrollment_token',
        'mark_kiosk_enrollment_session_opened',
        'validate_kiosk_device_credential'
      )
      and has_function_privilege('public', p.oid, 'EXECUTE')
  loop
    raise exception 'FAIL 8.4: PUBLIC holds EXECUTE on %', r.proname;
  end loop;

  -- search_path pinned on every new function.
  for r in
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname='public'
      and p.proname in (
        'issue_kiosk_enrollment_session',
        'get_kiosk_enrollment_session_details',
        'revoke_kiosk_enrollment_session',
        'exchange_kiosk_enrollment_token',
        'mark_kiosk_enrollment_session_opened',
        'validate_kiosk_device_credential'
      )
      and (p.proconfig is null or not exists (
        select 1 from unnest(p.proconfig) c where c like 'search_path=%'
      ))
  loop
    raise exception 'FAIL 8.5: % has no pinned search_path', r.proname;
  end loop;
end $$;

-- =====================================================
-- SECTION 9: anon cannot touch the session table
-- =====================================================

do $$
declare
  n integer;
begin
  perform pg_temp.act_as_anon();
  begin
    select count(*) into n from public.kiosk_enrollment_sessions;
  exception when others then
    n := -1;  -- permission denied / RLS block
  end;
  perform pg_temp.reset_role();

  if n > 0 then
    raise exception 'FAIL 9.1: anon can read enrollment session rows (count %)', n;
  end if;
end $$;

-- =====================================================
-- SECTION 10: issuance rate limiting
-- =====================================================

do $$
declare
  i integer;
  v_err text := null;
begin
  perform pg_temp.act_as(pg_temp.id('owner_b'));
  begin
    -- The limit is below this loop count, so one of these must be refused.
    for i in 1..12 loop
      perform public.issue_kiosk_enrollment_session(pg_temp.id('dev_b'));
    end loop;
  exception when others then
    v_err := sqlerrm;
  end;
  perform pg_temp.reset_role();

  if v_err is null then
    raise exception 'FAIL 10.1: issuance rate limit never triggered';
  end if;

  if v_err <> 'Too many requests, please retry shortly' then
    raise exception 'FAIL 10.2: expected the generic throttle message, got "%"', v_err;
  end if;
end $$;

do $$ begin raise notice 'kiosk_enrollment_rpcs: ALL ASSERTIONS PASSED'; end $$;

rollback;
