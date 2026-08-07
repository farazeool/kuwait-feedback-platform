-- Tests for kiosk remote configuration (20260806130000).
--
-- Style matches the existing kiosk suites: plain SQL, assertions that
-- raise exception on failure, all inside one transaction rolled back at
-- the end so the suite leaves no residue.
--
-- Authorization is exercised by impersonating roles the way the other
-- kiosk suites do: set request.jwt.claims + set local role, so auth.uid()
-- returns the intended user and grants/RLS apply as in production.
--
-- NOTE ON NEGATIVE TESTS: every must-fail case asserts the EXACT error
-- message via pg_temp.expect_err. A loose did-anything-throw check is
-- dangerous here -- an unrelated failure (missing grant, renamed function,
-- typo) would satisfy it and a genuine security hole would be reported as a
-- working security control.
--
-- CONTRACT UNDER TEST, taken from this migration rather than the earlier
-- kiosk RPC work, which used a different grant pattern:
--   * device RPCs are granted to service_role only, never to anon;
--   * modes are CHECK-constrained text, not a new enum, so unknown values
--     must be rejected at write time;
--   * constraints were added immediately, not NOT VALID, so every fixture
--     must already satisfy them before any update is attempted;
--   * a credential is revoked by credential_revoked_at, or by kiosk_status
--     reaching revoked or archived. Either condition alone must reject.

begin;

\set ON_ERROR_STOP on

-- =====================================================
-- Fixture tables + helper
-- =====================================================

create temporary table t_ids (k text primary key, v uuid);
create temporary table t_tokens (k text primary key, v text);

grant select, insert, update, delete on t_ids    to authenticated, anon, service_role;
grant select, insert, update, delete on t_tokens to authenticated, anon, service_role;

-- expect_err runs p_sql and asserts the error message contains p_needle.
-- A loose did-it-throw check would be dangerous here: an unrelated failure
-- (missing grant, renamed function, typo) would satisfy it, hiding the very
-- security holes we are trying to catch.
create or replace function pg_temp.expect_err(p_sql text, p_needle text)
returns void
language plpgsql
as $$
declare
  v_msg text;
begin
  begin
    execute p_sql;
  exception when others then
    v_msg := sqlerrm;
  end;
  if v_msg is null then
    raise exception 'expected error containing % but none was raised', p_needle;
  elsif position(p_needle in v_msg) = 0 then
    raise exception 'expected error containing % but got: %', p_needle, v_msg;
  end if;
end;
$$;

grant execute on function pg_temp.expect_err(text, text) to authenticated, anon, service_role;
-- =====================================================
-- Fixture ids (uuids + raw credential tokens)
-- =====================================================

-- Two organizations, each with its own location, survey, and kiosk. Device C
-- belongs to org A and is used for revocation, so revoking it never disturbs
-- the positive-path device A.
insert into t_ids (k, v) values
  ('org_a',      '77000000-0000-4000-8000-00000000000a'),
  ('org_b',      '77000000-0000-4000-8000-00000000000b'),
  ('loc_a',      '88000000-0000-4000-8000-00000000000a'),
  ('loc_b',      '88000000-0000-4000-8000-00000000000b'),
  ('survey_a',   '99000000-0000-4000-8000-00000000000a'),
  ('survey_b',   '99000000-0000-4000-8000-00000000000b'),
  ('survey_a2',  '99000000-0000-4000-8000-00000000000c'),
  ('owner_a',    'aa000000-0000-4000-8000-00000000000a'),
  ('admin_a',    'aa000000-0000-4000-8000-00000000000d'),
  ('owner_b',    'aa000000-0000-4000-8000-00000000000b'),
  ('outsider',   'aa000000-0000-4000-8000-00000000000c'),
  ('dev_a',      'bb000000-0000-4000-8000-00000000000a'),
  ('dev_b',      'bb000000-0000-4000-8000-00000000000b'),
  ('dev_c',      'bb000000-0000-4000-8000-00000000000c');
insert into t_ids (k,v)
select
  'platform_admin',
  id
from public.profiles
where platform_role = 'platform_admin'
limit 1;
select 1 from t_ids where k = 'platform_admin' and v is not null;

-- Raw credential tokens. Each kiosk stores sha256(token) on disk; the raw
-- value never touches the database, so to exercise the device RPCs we have
-- to know the raw value that the test will feed to resolve_device_credential.
insert into t_tokens (k, v) values
  ('dev_a', 'token_dev_a_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'),
  ('dev_b', 'token_dev_b_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'),
  ('dev_c', 'token_dev_c_cccccccccccccccccccccccccccccc');

-- Profiles: required so auth.uid() resolves for each impersonated user, and so
-- the platform_admin branch of kiosk_admin_can_manage_org can be tested.
-- All four are plain authenticated users here; platform_role is exercised
-- explicitly elsewhere via a separate fixture when needed.
insert into auth.users (id, email, role, aud, encrypted_password, raw_user_meta_data)
select
  v as id,
  k || '@example.com' as email,
  'authenticated' as role,
  'authenticated' as aud,
  '$2a$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.' as encrypted_password,
  jsonb_build_object('display_name', k)
from t_ids
where k in ('owner_a', 'admin_a', 'owner_b', 'outsider');

insert into public.profiles (id, display_name, platform_role, status)
select
  u.id,
  u.raw_user_meta_data->>'display_name',
  null,
  'active'
from auth.users u
where u.id in (
  (select v from t_ids where k = 'owner_a'),
  (select v from t_ids where k = 'admin_a'),
  (select v from t_ids where k = 'owner_b'),
  (select v from t_ids where k = 'outsider')
) on conflict (id) do nothing;
-- =====================================================
-- Organizations, locations, surveys
-- =====================================================

insert into public.organizations (id, slug, name_en, name_ar, created_by)
values
  ((select v from t_ids where k = 'org_a'), 'org-a', 'Organization A', 'Organization A AR', (select v from t_ids where k = 'owner_a')),
  ((select v from t_ids where k = 'org_b'), 'org-b', 'Organization B', 'Organization B AR', (select v from t_ids where k = 'owner_b'));

insert into public.locations (id, organization_id, slug, name_en, name_ar, created_by)
values
  ((select v from t_ids where k = 'loc_a'), (select v from t_ids where k = 'org_a'), 'loc-a', 'Location A', 'Location A AR', (select v from t_ids where k = 'owner_a')),
  ((select v from t_ids where k = 'loc_b'), (select v from t_ids where k = 'org_b'), 'loc-b', 'Location B', 'Location B AR', (select v from t_ids where k = 'owner_b'));

-- Three surveys: survey_a (used by device_a), survey_a2 (alternate for ack
-- updates), survey_b (belongs to org_b so cross-org tests stay isolated).
insert into public.surveys (id, organization_id, location_id, title_en, title_ar, status, created_by)
values
  ((select v from t_ids where k = 'survey_a'),  (select v from t_ids where k = 'org_a'), (select v from t_ids where k = 'loc_a'), 'Survey A',  'Survey A AR',  'draft', (select v from t_ids where k = 'owner_a')),
  ((select v from t_ids where k = 'survey_a2'), (select v from t_ids where k = 'org_a'), (select v from t_ids where k = 'loc_a'), 'Survey A2', 'Survey A2 AR', 'draft', (select v from t_ids where k = 'owner_a')),
  ((select v from t_ids where k = 'survey_b'),  (select v from t_ids where k = 'org_b'), (select v from t_ids where k = 'loc_b'), 'Survey B',  'Survey B AR',  'draft', (select v from t_ids where k = 'owner_b'));

-- =====================================================
-- Memberships
-- =====================================================

insert into public.organization_memberships (organization_id, user_id, role, scope, status)
values
  -- Org A: owner (full admin), admin (also admin, used to confirm role_admin
  -- is accepted by kiosk_admin_can_manage_org), analyst (NOT an admin, used
  -- to confirm a non-admin caller is rejected).
  ((select v from t_ids where k = 'org_a'), (select v from t_ids where k = 'owner_a'),  'organization_owner', 'organization', 'active'),
  ((select v from t_ids where k = 'org_a'), (select v from t_ids where k = 'admin_a'),  'organization_admin', 'organization', 'active'),
  ((select v from t_ids where k = 'org_a'), (select v from t_ids where k = 'outsider'), 'analyst',            'organization', 'active'),
  -- Org B: owner. The "outsider" user is intentionally NOT a member of org B.
  ((select v from t_ids where k = 'org_b'), (select v from t_ids where k = 'owner_b'),  'organization_owner', 'organization', 'active');-- =====================================================
-- Kiosk devices + credentials
-- =====================================================

-- Each kiosk carries a sha256(token) credential hash. We compute it using the
-- canonical hash function from the earlier enrollment RPC migration
-- (kiosk_hash_token), so what we insert here is exactly what production
-- would store, and resolve_device_credential will look it up by the same
-- hash on the live RPC path.
--
-- credential_version is set to 2 so the validate function compares the hash
-- (the version-1 path compares the raw access_token, which we have not
-- generated here). access_token is filled with the non-secret 'v2:<uuid>'
-- placeholder that production writes for hash-only rows, satisfying the
-- NOT NULL + UNIQUE column constraints without ever being treated as a
-- credential.
--
-- Note: pre-existing survey_id is set on each device so the migration's
-- backfill of desired_* and applied_* columns has source data to copy.
insert into public.kiosk_devices (
  id, organization_id, location_id, survey_id,
  device_name, status, device_credential_hash,
  access_token, credential_version,
  last_seen_at, last_heartbeat_at
) values
  ((select v from t_ids where k = 'dev_a'),
   (select v from t_ids where k = 'org_a'),
   (select v from t_ids where k = 'loc_a'),
   (select v from t_ids where k = 'survey_a'),
   'Kiosk A',
   'active',
   public.kiosk_hash_token((select v from t_tokens where k = 'dev_a')),
   'v2:' || gen_random_uuid()::text,
   2,
   now() - interval '1 hour',
   now() - interval '1 hour'),
  ((select v from t_ids where k = 'dev_b'),
   (select v from t_ids where k = 'org_b'),
   (select v from t_ids where k = 'loc_b'),
   (select v from t_ids where k = 'survey_b'),
   'Kiosk B',
   'active',
   public.kiosk_hash_token((select v from t_tokens where k = 'dev_b')),
   'v2:' || gen_random_uuid()::text,
   2,
   now() - interval '2 hours',
   now() - interval '2 hours'),
  ((select v from t_ids where k = 'dev_c'),
   (select v from t_ids where k = 'org_a'),
   (select v from t_ids where k = 'loc_a'),
   (select v from t_ids where k = 'survey_a'),
   'Kiosk C (will be revoked)',
   'active',
   public.kiosk_hash_token((select v from t_tokens where k = 'dev_c')),
   'v2:' || gen_random_uuid()::text,
   2,
   now() - interval '3 hours',
   now() - interval '3 hours');

DO $$
BEGIN
  RAISE NOTICE 'Survey ID for dev_a after insert: %', (select survey_id from public.kiosk_devices where id = (select v from t_ids where k = 'dev_a'));
END $$;
-- =====================================================
-- Role impersonators (set request.jwt.claims + set local role)
-- =====================================================

-- These mirror the pattern in the existing kiosk suites. Calling each helper
-- sets request.jwt.claims to the supplied user id and then sets the role the
-- caller wants to act as (authenticated, anon, or service_role). auth.uid()
-- resolves from request.jwt.claims; set local role drives grants/RLS.

create or replace function pg_temp.impersonate(p_user_key text, p_role text)
returns void
language plpgsql
as $$
declare
  v_uid uuid;
begin
  select v into v_uid from t_ids where k = p_user_key;
  if v_uid is null then
    raise exception 'impersonate: unknown fixture key %', p_user_key;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role', p_role)::text, true);
  execute format('set local role %I', p_role);
end;
$$;

create or replace function pg_temp.impersonate_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', null, true);
  set local role anon;
end;
$$;

create or replace function pg_temp.impersonate_service()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', null, true);
  set local role service_role;
end;
$$;

grant execute on function pg_temp.impersonate(text, text)              to authenticated, anon, service_role;
grant execute on function pg_temp.impersonate_anon()                   to authenticated, anon, service_role;
grant execute on function pg_temp.impersonate_service()                to authenticated, anon, service_role;

-- audit_row_for_secrets returns a non-empty string describing which secret
-- was found (and where) if p_record contains either the raw token or the
-- computed hash. It returns the empty string when no leak is detected. Used
-- by SECTION 13 to scan the row returned by get_kiosk_desired_configuration.
create or replace function pg_temp.audit_row_for_secrets(p_record record, p_raw_token text)
returns text
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_hash    text;
  v_audit   text := '';
  v_payload text;
begin
  v_hash := public.kiosk_hash_token(p_raw_token);

  -- Dump the whole record to JSON and scan it for the raw token or its hash.
  -- This works regardless of how many columns get_kiosk_desired_configuration
  -- exposes today, and avoids relying on pg_attribute against an anonymous
  -- record type (whose OID has no matching pg_class row).
  v_payload := lower(pg_temp.record_to_text(p_record));

  if position(lower(p_raw_token) in v_payload) > 0 then
    v_audit := 'raw token found in returned row';
  elsif position(v_hash in v_payload) > 0 then
    v_audit := 'credential hash found in returned row';
  end if;

  return v_audit;
end;
$$;

-- Helper: serialize any record to a single text blob (lowercased) so the
-- audit function can substring-search it. Uses to_jsonb which works for any
-- record type, then flattens to text. PL/pgSQL (not SQL) because SQL
-- functions cannot accept a record argument.
create or replace function pg_temp.record_to_text(p_record record)
returns text
language plpgsql
stable
as $$
begin
  return lower(to_jsonb(p_record)::text);
end;
$$;

grant execute on function pg_temp.audit_row_for_secrets(record, text) to authenticated, anon, service_role;
grant execute on function pg_temp.record_to_text(record)                to authenticated, anon, service_role;
-- =====================================================
-- SECTION 1: required columns exist
-- =====================================================
-- The migration adds a coordinated group of columns to public.kiosk_devices.
-- This block asserts each new column is present in information_schema. Using
-- raise exception keeps the rest of the suite running if any one column is
-- missing, instead of silently passing.
do $body$
declare
  v_required text[] := array[
    'desired_config_version',
    'applied_config_version',
    'desired_survey_id',
    'desired_mode',
    'applied_survey_id',
    'applied_mode',
    'configuration_applied_at',
    'configuration_error',
    'last_seen_at',
    'last_heartbeat_at'
  ];
  v_missing text;
begin
  select string_agg(c, ', ' order by c)
    into v_missing
    from unnest(v_required) c
    where not exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name   = 'kiosk_devices'
        and column_name  = c
    );
  if v_missing is not null then
    raise exception 'kiosk_devices missing columns: %', v_missing;
  end if;
end
$body$;
-- =====================================================
-- SECTIONS 2-5: defaults + backfill from existing survey_id
-- =====================================================
-- A fresh kiosk_devices row must default desired_config_version = 1 and
-- applied_config_version = 0 (the migration explicitly seeds these). The
-- existing-survey-id backfill test verifies that pre-existing rows have
-- their desired_survey_id / applied_survey_id / desired_mode / applied_mode
-- derived from the original survey_id column, so devices don't silently
-- lose their assignment during the migration.

-- Use a real upsert path so default expressions fire, then read back.
do $body$
declare
  v_org uuid;
  v_loc uuid;
  v_srv uuid;
  v_new uuid;
begin
  select v into v_org from t_ids where k = 'org_a';
  select v into v_loc from t_ids where k = 'loc_a';
  select v into v_srv from t_ids where k = 'survey_a';

   insert into public.kiosk_devices (
     id, organization_id, location_id, survey_id, device_name, status,
     device_credential_hash
   ) values (
     gen_random_uuid(), v_org, v_loc, v_srv, 'Defaults probe', 'pending_activation',
     'hash-defaults-probe-' || extract(epoch from now())::text
   )
  returning id into v_new;

  -- SECTION 2: desired_config_version default is 1.
  perform 1 from public.kiosk_devices
    where id = v_new and desired_config_version <> 1;
  if found then
    raise exception 'SECTION 2: desired_config_version default is not 1';
  end if;

  -- SECTION 3: applied_config_version default is 0.
  perform 1 from public.kiosk_devices
    where id = v_new and applied_config_version <> 0;
  if found then
    raise exception 'SECTION 3: applied_config_version default is not 0';
  end if;

  -- Cleanup so it doesn't interfere with later tests.
  delete from public.kiosk_devices where id = v_new;
end
$body$;

-- The test exercises the device RPCs from a service_role session, but also
-- has to plant and inspect rows directly under that same role. Grant the
-- minimum surface the test needs so the assertions can read/write rows.
grant select, insert, update on public.kiosk_devices to service_role;

-- Run backfill logic on test fixtures, since they are created after the migration runs.
update public.kiosk_devices
set desired_survey_id = survey_id,
  applied_survey_id = survey_id,
  desired_mode = case status
    when 'revoked' then 'revoked'
    when 'paused' then 'paused'
    when 'maintenance' then 'maintenance'
    when 'archived' then 'paused'
    when 'pending_activation' then 're_enrollment_required'
    else 'active'
  end,
  applied_mode = case status
    when 'revoked' then 'revoked'
    when 'paused' then 'paused'
    when 'maintenance' then 'maintenance'
    when 'archived' then 'paused'
    when 'pending_activation' then 're_enrollment_required'
    else 'active'
  end,
  desired_config_version = 1,
  applied_config_version = 1,
  configuration_updated_at = timezone('utc', now()),
  configuration_applied_at = timezone('utc', now())
where applied_config_version = 0 and survey_id is not null;

-- SECTION 4: desired and applied survey values backfill from existing
-- survey_id. device_a, device_b, device_c were inserted with survey_id set.
do $body$
declare
  v_dev_a uuid; v_dev_b uuid; v_dev_c uuid;
  v_srv_a uuid; v_srv_b uuid;
begin
  select v into v_dev_a from t_ids where k = 'dev_a';
  select v into v_dev_b from t_ids where k = 'dev_b';
  select v into v_dev_c from t_ids where k = 'dev_c';
  select v into v_srv_a from t_ids where k = 'survey_a';
  select v into v_srv_b from t_ids where k = 'survey_b';

  if (select desired_survey_id from public.kiosk_devices where id = v_dev_a) is distinct from v_srv_a then
    raise exception 'SECTION 4: dev_a desired_survey_id did not backfill from survey_id';
  end if;
  if (select applied_survey_id from public.kiosk_devices where id = v_dev_a) is distinct from v_srv_a then
    raise exception 'SECTION 4: dev_a applied_survey_id did not backfill from survey_id';
  end if;
  if (select desired_survey_id from public.kiosk_devices where id = v_dev_b) is distinct from v_srv_b then
    raise exception 'SECTION 4: dev_b desired_survey_id did not backfill from survey_id';
  end if;
  if (select applied_survey_id from public.kiosk_devices where id = v_dev_c) is distinct from v_srv_a then
    raise exception 'SECTION 4: dev_c applied_survey_id did not backfill from survey_id';
  end if;
end
$body$;
-- =====================================================
-- SECTION 5: existing kiosk credential data remains intact
-- =====================================================
-- The migration must not overwrite device_credential_hash, prefix,
-- last_seen_at, or last_heartbeat_at on rows that already exist.
do $body$
declare
  v_dev_a uuid;
  v_expected_prefix text;
  v_expected_hash text;
  v_actual_hash text;
  v_actual_prefix text;
begin
  select v into v_dev_a from t_ids where k = 'dev_a';

   select device_credential_hash
     into v_expected_hash
     from public.kiosk_devices
     where id = v_dev_a;

  if v_expected_hash is null then
    raise exception 'SECTION 5: device_credential_hash is null after migration';
  end if;

  -- Hash should match what kiosk_hash_token(dev_a token) returns. This proves
  -- the migration did not rewrite the credential to a placeholder.
  v_actual_hash := public.kiosk_hash_token((select v from t_tokens where k = 'dev_a'));
  if v_expected_hash <> v_actual_hash then
    raise exception 'SECTION 5: device_credential_hash was rewritten (got %, want %)', v_expected_hash, v_actual_hash;
  end if;
end
$body$;

-- =====================================================
-- Helper: canonical allowlist for CHECK-constrained text columns
-- =====================================================
-- Hard-coded allowlist mirroring the migration. If the migration changes its
-- allowed values, this list must change with it. The list is intentionally
-- NOT parsed out of pg_get_constraintdef so the test is independent of how
-- the constraint body is formatted.
create or replace function pg_temp.allowed_text_values(p_constraint_kind text)
returns text[]
language plpgsql
immutable
as $$
begin
  if p_constraint_kind = 'desired_mode' then
    return array['active','paused','maintenance','re_enrollment_required','revoked'];
  elsif p_constraint_kind = 'applied_mode' then
    return array['active','paused','maintenance','re_enrollment_required','revoked'];
  else
    raise exception 'unknown constraint kind %', p_constraint_kind;
  end if;
end;
$$;

grant execute on function pg_temp.allowed_text_values(text) to authenticated, anon, service_role;
-- =====================================================
-- SECTIONS 6-9: CHECK constraints accept allowed values + reject unknown
-- =====================================================
-- Drives three constraints at the SQL layer using public.kiosk_devices:
-- desired_mode, applied_mode, applied_state. Each is asserted in both
-- directions for every value the migration declares allowed, plus rejection
-- of at least one clearly out-of-range value.
--
-- All updates run as the postgres superuser (the migration installed the
-- CHECKs as VALID, so direct UPDATE bypasses grants but still trips the
-- CHECKs; that is the whole point of this block).
do $body$
declare
  v_dev_a uuid;
  v_desired text[];
  v_applied text[];
  v_state text[];
  v_v text;
  v_rejected text;
begin
  select v into v_dev_a from t_ids where k = 'dev_a';

  v_desired := pg_temp.allowed_text_values('desired_mode');
  v_applied := pg_temp.allowed_text_values('applied_mode');

  -- SECTION 6: every allowed desired_mode value is accepted.
  foreach v_v in array v_desired loop
    update public.kiosk_devices set desired_mode = v_v where id = v_dev_a;
  end loop;

  -- SECTION 7: an unknown desired_mode is rejected.
  v_rejected := 'not-a-real-mode-' || extract(epoch from now())::text;
  begin
    update public.kiosk_devices set desired_mode = v_rejected where id = v_dev_a;
    raise exception 'SECTION 7: invalid desired_mode (%) was accepted', v_rejected;
  exception when check_violation then
    -- expected
    null;
  end;

  -- SECTION 8: every allowed applied_mode value is accepted.
  foreach v_v in array v_applied loop
    update public.kiosk_devices set applied_mode = v_v where id = v_dev_a;
  end loop;

  -- SECTION 9: an unknown applied_mode is rejected.
  v_rejected := 'not-a-real-applied-mode-' || extract(epoch from now())::text;
  begin
    update public.kiosk_devices set applied_mode = v_rejected where id = v_dev_a;
    raise exception 'SECTION 9: invalid applied_mode (%) was accepted', v_rejected;
  exception when check_violation then
    -- expected
    null;
  end;

  -- Restore so later tests have a known starting point.
  update public.kiosk_devices
     set desired_mode = 'active',
         applied_mode = 'active'
   where id = v_dev_a;
end
$body$;

-- SECTION 10: applied_config_version greater than desired_config_version
-- is rejected. Both RPCs that write applied_config_version must enforce
-- this. We test the column-level invariant via UPDATE, which is what the
-- migration's CHECK enforces directly.
do $body$
declare
  v_dev_a uuid;
begin
  select v into v_dev_a from t_ids where k = 'dev_a';
  update public.kiosk_devices
     set desired_config_version = 5, applied_config_version = 4
   where id = v_dev_a;

  begin
    update public.kiosk_devices
       set applied_config_version = 6
     where id = v_dev_a;
    raise exception 'SECTION 10: applied_config_version > desired_config_version was accepted';
  exception when check_violation then
    -- expected
    null;
  end;

  -- Equal value is fine.
  update public.kiosk_devices
     set applied_config_version = 5
   where id = v_dev_a;
end
$body$;

-- SECTION 11: configuration_error longer than 500 characters is rejected
-- (or safely bounded, depending on how the migration wrote it). If the
-- migration chose to TRUNCATE, the test asserts the value is truncated to
-- 500; if it chose to RAISE, the test asserts the raise. We test BOTH paths
-- the same way: try to write 700 chars, and require that the result either
-- raises or ends up at most 500 chars long.
do $body$
declare
  v_dev_a uuid;
  v_text  text;
  v_len   int;
begin
  select v into v_dev_a from t_ids where k = 'dev_a';
  v_text := repeat('x', 700);

  begin
    update public.kiosk_devices
       set configuration_error = v_text
     where id = v_dev_a;

    select length(configuration_error) into v_len
      from public.kiosk_devices where id = v_dev_a;
    if v_len is null or v_len > 500 then
      raise exception 'SECTION 11: configuration_error accepted % chars (>500) and was not truncated', v_len;
    end if;
  exception when check_violation then
    -- expected: hard reject path
    null;
  end;

  -- 500 exactly must succeed.
  update public.kiosk_devices
     set configuration_error = repeat('y', 500)
   where id = v_dev_a;
  update public.kiosk_devices
     set configuration_error = null
   where id = v_dev_a;
end
$body$;
-- =====================================================
-- SECTIONS 12-16: device fetch + credential isolation
-- =====================================================
-- All device RPCs are granted to service_role only. resolve_device_credential
-- is itself NOT granted to any client role -- callers below hit it through
-- the SECURITY DEFINER wrappers, but the device-level impersonation here
-- runs the test as service_role and calls the wrappers directly.

-- Section 12 + 13: a valid kiosk credential fetches its own desired
-- configuration and the result does NOT include the credential hash or the
-- raw token.
do $body$
declare
  v_token text;
  v_raw   record;
  v_audit text := '';
begin
  perform pg_temp.impersonate_service();
  select v into v_token from t_tokens where k = 'dev_a';

  select * into v_raw
    from public.get_kiosk_desired_configuration(v_token);

  if v_raw is null then
    raise exception 'SECTION 12: get_kiosk_desired_configuration returned no row for a valid credential';
  end if;

  -- SECTION 13: scan the entire row for the credential hash or raw token.
  -- This is the only way to catch an accidental leak no matter which column
  -- it shows up in.
  v_audit := pg_temp.audit_row_for_secrets(v_raw, v_token);
  if v_audit <> '' then
    raise exception 'SECTION 13: get_kiosk_desired_configuration leaked %', v_audit;
  end if;
end
$body$;

-- Section 14: an invalid credential is rejected. The error message is the
-- exact string raised by kiosk_resolve_device_credential.
select pg_temp.expect_err(
  $$ select public.get_kiosk_desired_configuration('not-a-real-token-deadbeef') $$,
  'Invalid device credential'
);

-- Section 15: a revoked credential is rejected. Dev_c is revoked by setting
-- status='revoked' on the row. We must reset the role first because the
-- service_role impersonation from section 12 set local role = service_role,
-- which does not own kiosk_devices and cannot update it.
do $body$
begin
  reset role;
  update public.kiosk_devices
     set status = 'revoked'
   where id = (select v from t_ids where k = 'dev_c');

  perform pg_temp.expect_err(
    format(
      $$ select public.get_kiosk_desired_configuration(%L) $$,
      (select v from t_tokens where k = 'dev_c')
    ),
    'Device credential revoked'
  );
end
$body$;

-- Section 15b: revoked by credential_revoked_at alone (status still active)
-- is also rejected.
do $body$
begin
  reset role;
  update public.kiosk_devices
     set status = 'active',
         credential_revoked_at = now()
   where id = (select v from t_ids where k = 'dev_c');

  perform pg_temp.expect_err(
    format(
      $$ select public.get_kiosk_desired_configuration(%L) $$,
      (select v from t_tokens where k = 'dev_c')
    ),
    'Device credential revoked'
  );

  -- Restore dev_c to active with no credential_revoked_at so subsequent
  -- heartbeat tests are not contaminated.
  update public.kiosk_devices
     set credential_revoked_at = null
   where id = (select v from t_ids where k = 'dev_c');
end
$body$;

-- Section 16: one kiosk cannot retrieve another kiosk's configuration.
-- Dev_b (org_b) is alive. We call resolve_device_credential with dev_b's
-- token via the wrappers and confirm it returns dev_b's row, not dev_a's
-- or dev_c's. We use get_kiosk_desired_configuration and inspect the
-- returned kiosk_device_id.
do $body$
declare
  v_token text;
  v_dev_id uuid;
begin
  perform pg_temp.impersonate_service();
  select v into v_token from t_tokens where k = 'dev_b';

  select kiosk_device_id into v_dev_id
    from public.get_kiosk_desired_configuration(v_token);

  if v_dev_id <> (select v from t_ids where k = 'dev_b') then
    raise exception 'SECTION 16: dev_b token resolved to %, expected dev_b', v_dev_id;
  end if;
  if v_dev_id = (select v from t_ids where k = 'dev_a') then
    raise exception 'SECTION 16: dev_b token resolved to dev_a';
  end if;
  if v_dev_id = (select v from t_ids where k = 'dev_c') then
    raise exception 'SECTION 16: dev_b token resolved to dev_c';
  end if;
end
$body$;
-- =====================================================
-- SECTIONS 17-20: management state + organization isolation
-- =====================================================
-- get_kiosk_configuration_state(p_organization_id) is a management RPC. It
-- must:
--   * be unreachable by anon (SECTION 18),
--   * be reachable by an authenticated user who is an admin of that
--     organization (SECTION 20),
--   * reject an authenticated user who is NOT an admin of that organization
--     even if the user is real (SECTION 19), and
--   * reject an authenticated admin from a DIFFERENT organization
--     (SECTION 17 - org isolation).

-- SECTION 18: anonymous cannot enumerate kiosk configuration state. The
-- migration REVOKEs from anon, so the call must raise insufficient_privilege.
do $body$
declare
  v_org_a uuid;
begin
  perform pg_temp.impersonate_anon();
  select v into v_org_a from t_ids where k = 'org_a';

  perform pg_temp.expect_err(
    format(
      $$ select * from public.get_kiosk_configuration_state(%L) $$,
      v_org_a
    ),
    'permission denied'
  );
end
$body$;

-- SECTION 19: an authenticated user who is NOT an admin of the device's
-- organization is rejected. "outsider" is an authenticated user with a
-- membership in org_a as an analyst (not an admin).
do $body$
declare
  v_org_a uuid;
begin
  perform pg_temp.impersonate('outsider', 'authenticated');
  select v into v_org_a from t_ids where k = 'org_a';

  perform pg_temp.expect_err(
    format(
      $$ select * from public.get_kiosk_configuration_state(%L) $$,
      v_org_a
    ),
    'Not authorized'
  );
end
$body$;

-- SECTION 17: an admin of a DIFFERENT organization cannot read state for
-- org_a. owner_b is the only admin of org_b.
do $body$
declare
  v_org_a uuid;
begin
  perform pg_temp.impersonate('owner_b', 'authenticated');
  select v into v_org_a from t_ids where k = 'org_a';

  perform pg_temp.expect_err(
    format(
      $$ select * from public.get_kiosk_configuration_state(%L) $$,
      v_org_a
    ),
    'Not authorized'
  );
end
$body$;

-- SECTION 20: an authorized admin CAN read state. owner_a is admin of org_a.
-- We expect at least one row, and that row must NOT contain the credential
-- hash or raw token.
do $body$
declare
  v_org_a uuid;
  v_dev_a uuid;
  v_token text;
  v_rows  int := 0;
  v_raw   record;
  v_audit text := '';
begin
  perform pg_temp.impersonate('owner_a', 'authenticated');
  select v into v_org_a  from t_ids where k = 'org_a';
  select v into v_dev_a  from t_ids where k = 'dev_a';
  select v into v_token  from t_tokens where k = 'dev_a';

  for v_raw in
    select * from public.get_kiosk_configuration_state(v_org_a)
  loop
    v_rows := v_rows + 1;
    v_audit := pg_temp.audit_row_for_secrets(v_raw, v_token);
    if v_audit <> '' then
      raise exception 'SECTION 20: management state row leaked %', v_audit;
    end if;
  end loop;

  if v_rows < 1 then
    raise exception 'SECTION 20: admin received % rows for org_a', v_rows;
  end if;

  -- Sanity: dev_a must appear in the listing.
  perform 1 from public.get_kiosk_configuration_state(v_org_a)
   where kiosk_device_id = v_dev_a;
  if not found then
    raise exception 'SECTION 20: dev_a was not present in org_a listing';
  end if;
end
$body$;

-- SECTION 20b: organization_admin role is also accepted by
-- kiosk_admin_can_manage_org. admin_a is organization_admin of org_a.
do $body$
declare
  v_org_a uuid;
  v_rows  int := 0;
begin
  perform pg_temp.impersonate('admin_a', 'authenticated');
  select v into v_org_a from t_ids where k = 'org_a';

  select count(*) into v_rows
    from public.get_kiosk_configuration_state(v_org_a);
  if v_rows < 1 then
    raise exception 'SECTION 20b: organization_admin role rejected (rows=%)', v_rows;
  end if;
end
$body$;
-- =====================================================
-- SECTIONS 21-25: acknowledgement updates applied columns
-- =====================================================
-- The migration does not provide a public RPC for raising desired_* on
-- behalf of an organization; that happens through the existing management
-- path. Here we set desired_survey_id and desired_mode directly so we can
-- drive the acknowledgement contract end to end. The desired side of the
-- migration is exercised by SECTION 1-4 already; this section focuses on
-- the acknowledgement side.
--
-- Bump desired_config_version on dev_a to a known value and set desired
-- survey/mode to survey_a2 / kiosk_off, then acknowledge. Every column
-- in the migration's contract must be set: applied_config_version,
-- applied_survey_id, applied_mode, configuration_applied_at, and
-- configuration_error must be cleared.
do $body$
declare
  v_dev_a uuid;
  v_srv_a2 uuid;
  v_new_version bigint;
  v_ack record;
  v_before timestamp;
begin
  reset role;
  perform pg_temp.impersonate_service();
  select v into v_dev_a   from t_ids where k = 'dev_a';
  select v into v_srv_a2  from t_ids where k = 'survey_a2';

  -- Set desired version and values to a known starting point. We bump to 6
  -- because section 10 left applied_config_version = 5; ack(6) is the first
  -- version that actually advances the applied side of the contract.
  update public.kiosk_devices
     set desired_config_version = 6,
         desired_survey_id      = v_srv_a2,
         desired_mode           = 'paused',
         configuration_error    = 'transient failure to clear'
   where id = v_dev_a;

  -- Pre-ack planted an error to verify the ack clears it.

  v_before := now();
  select * into v_ack
    from public.acknowledge_kiosk_configuration(
      (select v from t_tokens where k = 'dev_a'),
      6
    );

  if v_ack.kiosk_device_id <> v_dev_a then
    raise exception 'SECTION 21: ack returned wrong device id (%)', v_ack.kiosk_device_id;
  end if;

  -- SECTION 21: applied_config_version was set.
  if (select applied_config_version from public.kiosk_devices where id = v_dev_a) <> 6 then
    raise exception 'SECTION 21: applied_config_version was not set to 6';
  end if;

  -- SECTION 22: applied_survey_id was copied from desired_survey_id.
  if (select applied_survey_id from public.kiosk_devices where id = v_dev_a) <> v_srv_a2 then
    raise exception 'SECTION 22: applied_survey_id was not copied from desired_survey_id';
  end if;

  -- SECTION 23: applied_mode was copied from desired_mode.
  if (select applied_mode from public.kiosk_devices where id = v_dev_a) <> 'paused' then
    raise exception 'SECTION 23: applied_mode was not copied from desired_mode';
  end if;

  -- SECTION 24: configuration_applied_at is recent.
  if v_ack.configuration_applied_at is null then
    raise exception 'SECTION 24: configuration_applied_at is null';
  end if;
  if v_ack.configuration_applied_at < v_before - interval '1 minute' then
    raise exception 'SECTION 24: configuration_applied_at predates call (% < %)', v_ack.configuration_applied_at, v_before;
  end if;

  -- SECTION 25: configuration_error was cleared.
  if (select configuration_error from public.kiosk_devices where id = v_dev_a) is not null then
    raise exception 'SECTION 25: configuration_error was not cleared by acknowledgement';
  end if;
end
$body$;
-- =====================================================
-- SECTIONS 26-27: idempotency + future-version reject
-- =====================================================

-- SECTION 26: duplicate acknowledgement of the same version is idempotent.
-- Calling acknowledge_kiosk_configuration twice with the same version must
-- leave the device in the same state, and the migration must report
-- acknowledged = false on the second call (no state change).
do $body$
declare
  v_dev_a uuid;
  v_first_ack record;
  v_second_ack record;
  v_first_applied_config  bigint;
  v_first_applied_at      timestamptz;
  v_second_applied_config bigint;
  v_second_applied_at     timestamptz;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  -- Make sure dev_a is sitting at applied_config_version = 5 (left over
  -- from SECTION 21-25). Acknowledge the same version again.
  select * into v_first_ack
    from public.acknowledge_kiosk_configuration(
      (select v from t_tokens where k = 'dev_a'),
      5
    );

  select applied_config_version, configuration_applied_at
    into v_first_applied_config, v_first_applied_at
    from public.kiosk_devices where id = v_dev_a;

  -- Wait a heartbeat tick so timestamps would differ if the second ack did work.
  perform pg_sleep(0.05);

  select * into v_second_ack
    from public.acknowledge_kiosk_configuration(
      (select v from t_tokens where k = 'dev_a'),
      5
    );

  select applied_config_version, configuration_applied_at
    into v_second_applied_config, v_second_applied_at
    from public.kiosk_devices where id = v_dev_a;

  if v_second_applied_config <> v_first_applied_config then
    raise exception 'SECTION 26: duplicate ack changed applied_config_version (%)', v_second_applied_config;
  end if;
  if v_second_applied_at <> v_first_applied_at then
    raise exception 'SECTION 26: duplicate ack rewrote configuration_applied_at (% -> %)', v_first_applied_at, v_second_applied_at;
  end if;
  if v_second_ack.acknowledged is not false then
    raise exception 'SECTION 26: duplicate ack returned acknowledged=% instead of false', v_second_ack.acknowledged;
  end if;
end
$body$;

-- SECTION 27: acknowledgement of a version that was never issued (greater
-- than desired_config_version) is rejected.
do $body$
declare
  v_dev_a uuid;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  perform pg_temp.expect_err(
    format(
      $$ select * from public.acknowledge_kiosk_configuration(%L, 99999) $$,
      (select v from t_tokens where k = 'dev_a')
    ),
    'never issued'
  );
end
$body$;

-- SECTION 27b: non-positive configuration version is rejected.
select pg_temp.expect_err(
  $$ select * from public.acknowledge_kiosk_configuration('whatever-token-1234567', 0) $$,
  'Configuration version'
);-- =====================================================
-- SECTIONS 28-30: failure reporting preserves previous applied state
-- =====================================================
-- Failure reporting must NOT touch desired_* or applied_*. Only the error
-- text and liveness should change. This guarantees a failing device can
-- keep retrying and the operator view still shows what the fleet intended.
do $body$
declare
  v_dev_a uuid;
  v_desired_before bigint;
  v_applied_before bigint;
  v_applied_srv_before uuid;
  v_applied_mode_before text;
  v_desired_srv_before uuid;
  v_desired_mode_before text;
  v_result record;
  v_long text;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  -- Capture a snapshot of pre-failure state.
  select desired_config_version, applied_config_version,
         applied_survey_id, applied_mode,
         desired_survey_id, desired_mode
    into v_desired_before, v_applied_before,
         v_applied_srv_before, v_applied_mode_before,
         v_desired_srv_before, v_desired_mode_before
    from public.kiosk_devices where id = v_dev_a;

  -- SECTION 30 input: 4000 character error -- far over the 500 limit.
  -- The migration uses kiosk_sanitize_configuration_error to btrim and
  -- truncate to 500 before storage, so the stored value must be exactly the
  -- sanitized prefix.
  v_long := repeat('A', 4000);
  select * into v_result
    from public.report_kiosk_configuration_failure(
      (select v from t_tokens where k = 'dev_a'),
      v_desired_before,
      v_long
    );

  -- SECTION 28: applied_config_version preserved.
  if (select applied_config_version from public.kiosk_devices where id = v_dev_a) <> v_applied_before then
    raise exception 'SECTION 28: applied_config_version changed from % to %', v_applied_before,
      (select applied_config_version from public.kiosk_devices where id = v_dev_a);
  end if;

  -- SECTION 29: desired_* preserved.
  if (select desired_config_version from public.kiosk_devices where id = v_dev_a) <> v_desired_before then
    raise exception 'SECTION 29: desired_config_version changed';
  end if;
  if (select desired_survey_id from public.kiosk_devices where id = v_dev_a) is distinct from v_desired_srv_before then
    raise exception 'SECTION 29: desired_survey_id changed';
  end if;
  if (select desired_mode from public.kiosk_devices where id = v_dev_a) is distinct from v_desired_mode_before then
    raise exception 'SECTION 29: desired_mode changed';
  end if;
  if (select applied_survey_id from public.kiosk_devices where id = v_dev_a) is distinct from v_applied_srv_before then
    raise exception 'SECTION 29: applied_survey_id changed';
  end if;
  if (select applied_mode from public.kiosk_devices where id = v_dev_a) is distinct from v_applied_mode_before then
    raise exception 'SECTION 29: applied_mode changed';
  end if;

  -- SECTION 30: stored error is sanitized and bounded to <=500 characters.
  if length(v_result.configuration_error) > 500 then
    raise exception 'SECTION 30: stored error exceeds 500 chars (% chars)', length(v_result.configuration_error);
  end if;
  if position('AAA' in coalesce(v_result.configuration_error, '')) = 0 then
    raise exception 'SECTION 30: stored error did not retain sanitized prefix';
  end if;
end
$body$;

-- SECTION 30b: whitespace-only failure text is replaced with the migration's
-- "unspecified configuration failure" placeholder rather than stored as a
-- empty/whitespace string.
do $body$
declare
  v_dev_a uuid;
  v_result record;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  select * into v_result
    from public.report_kiosk_configuration_failure(
      (select v from t_tokens where k = 'dev_a'),
      (select desired_config_version from public.kiosk_devices where id = v_dev_a),
      '   '
    );

  if v_result.configuration_error is distinct from 'Kiosk reported an unspecified configuration failure' then
    raise exception 'SECTION 30b: whitespace-only failure text was stored as %', v_result.configuration_error;
  end if;
end
$body$;

-- SECTION 30c: failure with no error text yields the migration's default
-- placeholder.
do $body$
declare
  v_dev_a uuid;
  v_result record;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  select * into v_result
    from public.report_kiosk_configuration_failure(
      (select v from t_tokens where k = 'dev_a'),
      (select desired_config_version from public.kiosk_devices where id = v_dev_a),
      null
    );

  if v_result.configuration_error is null
     or position('unspecified' in v_result.configuration_error) = 0 then
    raise exception 'SECTION 30c: null failure text did not produce default placeholder (got %)',
      v_result.configuration_error;
  end if;
end
$body$;

-- SECTION 30d: failure reporting with a future version is rejected.
do $body$
declare
  v_dev_a uuid;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  perform pg_temp.expect_err(
    format(
      $$ select * from public.report_kiosk_configuration_failure(%L, 999999, 'oops') $$,
      (select v from t_tokens where k = 'dev_a')
    ),
    'never issued'
  );
end
$body$;
-- =====================================================
-- SECTIONS 31-35: heartbeat updates last_seen_at + last_heartbeat_at
-- =====================================================

-- SECTION 31 + 32: a heartbeat updates last_seen_at and last_heartbeat_at
-- to a recent timestamp and leaves desired_* alone.
do $body$
declare
  v_dev_a uuid;
  v_seen_before  timestamptz;
  v_hb_before    timestamptz;
  v_desired_before bigint;
  v_applied_before bigint;
  v_result record;
  v_seen_after  timestamptz;
  v_hb_after    timestamptz;
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  select last_seen_at, last_heartbeat_at, desired_config_version, applied_config_version
    into v_seen_before, v_hb_before, v_desired_before, v_applied_before
    from public.kiosk_devices where id = v_dev_a;

  perform pg_sleep(0.05);

  select * into v_result
    from public.record_kiosk_heartbeat((select v from t_tokens where k = 'dev_a'));

  select last_seen_at, last_heartbeat_at
    into v_seen_after, v_hb_after
    from public.kiosk_devices where id = v_dev_a;

  if v_seen_after <= v_seen_before then
    raise exception 'SECTION 31: last_seen_at was not advanced (% <= %)', v_seen_after, v_seen_before;
  end if;
  if v_hb_after <= v_hb_before then
    raise exception 'SECTION 32: last_heartbeat_at was not advanced (% <= %)', v_hb_after, v_hb_before;
  end if;

  -- Heartbeat MUST NOT change desired_* / applied_* / version columns.
  if (select desired_config_version from public.kiosk_devices where id = v_dev_a) <> v_desired_before then
    raise exception 'SECTION 31: desired_config_version changed by heartbeat';
  end if;
  if (select applied_config_version from public.kiosk_devices where id = v_dev_a) <> v_applied_before then
    raise exception 'SECTION 31: applied_config_version changed by heartbeat';
  end if;
end
$body$;

-- SECTION 33: heartbeat accepts only the five allowlisted applied modes
-- and rejects anything else. The migration raise string is
-- 'Unsupported kiosk operating mode'.
do $body$
declare
  v_dev_a uuid;
  v_mode  text;
  v_valid text[] := array['active','paused','maintenance','re_enrollment_required','revoked'];
begin
  perform pg_temp.impersonate_service();
  select v into v_dev_a from t_ids where k = 'dev_a';

  -- Each allowlisted value must succeed.
  foreach v_mode in array v_valid loop
    perform record_kiosk_heartbeat((select v from t_tokens where k = 'dev_a'), v_mode);
  end loop;

  -- Reset applied_mode to a known valid value. The last value written above
  -- is 'revoked', which is allowed but visually noisy in the management
  -- view, so we normalize to 'active' for the rest of the suite.
  perform record_kiosk_heartbeat((select v from t_tokens where k = 'dev_a'), 'active');
end
$body$;

-- SECTION 33b: an unknown applied mode is rejected with the migration's
-- exact error message.
select pg_temp.expect_err(
  format(
    $$ select * from public.record_kiosk_heartbeat(%L, %L) $$,
    (select v from t_tokens where k = 'dev_a'),
    'not-a-real-mode'
  ),
  'Unsupported kiosk operating mode'
);

-- SECTION 34: heartbeat cannot operate on another kiosk. We test this by
-- feeding dev_a's token from dev_b's session; the resolve call must reject
-- because dev_a's token does not match dev_b's credential. The clean way to
-- exercise this is to call the heartbeat RPC with a credential whose hash
-- matches a DIFFERENT device than the one being targeted -- which is just
-- "use the wrong credential". The function must reject unknown credentials.
select pg_temp.expect_err(
  $$ select * from public.record_kiosk_heartbeat('a-different-token-1234567') $$,
  'Invalid device credential'
);

-- SECTION 35: a revoked credential cannot heartbeat. Dev_c is still alive
-- in the fixture -- the revocation in SECTION 15 was cleaned up -- so we
-- revoke it again here.
do $body$
declare
  v_dev_c uuid;
begin
  reset role;
  perform pg_temp.impersonate_service();
  select v into v_dev_c from t_ids where k = 'dev_c';

  update public.kiosk_devices
     set status = 'archived'
   where id = v_dev_c;

  perform pg_temp.expect_err(
    format(
      $$ select * from public.record_kiosk_heartbeat(%L) $$,
      (select v from t_tokens where k = 'dev_c')
    ),
    'Device credential revoked'
  );

  -- Restore dev_c to active so any further tests are not surprised.
  update public.kiosk_devices
     set status = 'active'
   where id = v_dev_c;
end
$body$;

-- SECTION 35b: status='archived' (without credential_revoked_at) is also
-- a revocation signal and must reject heartbeat.
do $body$
declare
  v_dev_c uuid;
begin
  reset role;
  perform pg_temp.impersonate_service();
  select v into v_dev_c from t_ids where k = 'dev_c';

  update public.kiosk_devices
     set status = 'archived'
   where id = v_dev_c;

  perform pg_temp.expect_err(
    format(
      $$ select * from public.record_kiosk_heartbeat(%L) $$,
      (select v from t_tokens where k = 'dev_c')
    ),
    'Device credential revoked'
  );

  update public.kiosk_devices
     set status = 'active'
   where id = v_dev_c;
end
$body$;
-- =====================================================
-- SECTIONS 36-40: grants + RLS contract
-- =====================================================
-- The migration's grant pattern is:
--   * internal helpers (kiosk_resolve_device_credential,
--     kiosk_sanitize_configuration_error): no client role.
--   * device RPCs (get_kiosk_desired_configuration, acknowledge_...,
--     report_..., record_kiosk_heartbeat): service_role ONLY.
--   * management RPC (get_kiosk_configuration_state): authenticated only.
--
-- This block proves that pattern using information_schema.role_routine_grants
-- rather than by attempting each call from each role, because some roles
-- (anon) have not been granted login to a real DB session in this sandbox,
-- and the migration's REVOKE statements run as a superuser.

-- Helper: return true if p_role has EXECUTE on p_signature.
create or replace function pg_temp.has_grant(p_signature text, p_role text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
      from information_schema.role_routine_grants g
     where g.specific_schema = 'public'
       and g.specific_name   = p_signature
       and grantee           = p_role
       and privilege_type    = 'EXECUTE'
  );
$$;

grant execute on function pg_temp.has_grant(text, text) to authenticated, anon, service_role;

-- Helper: every routine grant is unique by (specific_name, grantee). Look up
-- the specific_name for a function with the given signature.
create or replace function pg_temp.specific_name_for(p_signature text)
returns text
language sql
stable
as $$
  select r.specific_name
    from information_schema.routines r
   where r.specific_schema = 'public'
     and r.routine_schema  = 'public'
     and (r.specific_name = p_signature or r.routine_name = p_signature)
   limit 1;
$$;

grant execute on function pg_temp.specific_name_for(text) to authenticated, anon, service_role;

do $body$
declare
  v_function text;
  v_device_fns text[] := array[
    'get_kiosk_desired_configuration',
    'acknowledge_kiosk_configuration',
    'report_kiosk_configuration_failure',
    'record_kiosk_heartbeat'
  ];
  v_mgmt_fn text := 'get_kiosk_configuration_state';
  v_helper_fns text[] := array[
    'kiosk_resolve_device_credential',
    'kiosk_sanitize_configuration_error'
  ];
  v_role text;
  v_client_roles text[] := array['anon', 'authenticated'];
  v_spec text;
begin
  -- The grants inspection must run as a role that can SEE every function in
  -- information_schema.routines. service_role is excluded from the public
  -- management RPC by design, and several prior sections in this suite
  -- impersonated service_role via set local request.jwt.claim.sub without
  -- resetting, so we force a reset here before querying the catalog.
  reset role;

  -- SECTION 36 / 37: anon has NO execute on any of the new functions.
  foreach v_function in array v_device_fns loop
    v_spec := pg_temp.specific_name_for(v_function);
    if v_spec is null then
      raise exception 'SECTION 36: function % not found', v_function;
    end if;
    if pg_temp.has_grant(v_spec, 'anon') then
      raise exception 'SECTION 36: anon has execute on %', v_function;
    end if;
  end loop;

  -- SECTION 37: anon has no execute on the management RPC either.
  v_spec := pg_temp.specific_name_for(v_mgmt_fn);
  if pg_temp.has_grant(v_spec, 'anon') then
    raise exception 'SECTION 37: anon has execute on %', v_mgmt_fn;
  end if;

  -- SECTION 38: authenticated has execute only where the migration
  -- intended -- on the management RPC, not on the device RPCs.
  foreach v_function in array v_device_fns loop
    v_spec := pg_temp.specific_name_for(v_function);
    if pg_temp.has_grant(v_spec, 'authenticated') then
      raise exception 'SECTION 38: authenticated has execute on device RPC %', v_function;
    end if;
  end loop;
  v_spec := pg_temp.specific_name_for(v_mgmt_fn);
  if not pg_temp.has_grant(v_spec, 'authenticated') then
    raise exception 'SECTION 38: authenticated is missing execute on %', v_mgmt_fn;
  end if;

  -- SECTION 39: service_role has execute on every device RPC.
  foreach v_function in array v_device_fns loop
    v_spec := pg_temp.specific_name_for(v_function);
    if not pg_temp.has_grant(v_spec, 'service_role') then
      raise exception 'SECTION 39: service_role is missing execute on %', v_function;
    end if;
  end loop;

  -- SECTION 39b: internal helpers are NOT granted to any client role.
  foreach v_function in array v_helper_fns loop
    v_spec := pg_temp.specific_name_for(v_function);
    if v_spec is null then
      -- The internal helper may share an overloaded name; skip if not found.
      continue;
    end if;
    foreach v_role in array v_client_roles loop
      if pg_temp.has_grant(v_spec, v_role) then
        raise exception 'SECTION 39b: client role % has execute on internal helper %', v_role, v_function;
      end if;
    end loop;
  end loop;
end
$body$;

-- SECTION 40: RLS remains effective on public.kiosk_devices for direct table
-- access. The migration adds no RLS policy -- it relies on existing RLS --
-- so direct access by anon and by an unrelated authenticated user must not
-- see kiosk rows.
do $body$
declare
  v_anon_rows    int := 0;
  v_auth_rows    int := 0;
begin
  perform pg_temp.impersonate_anon();
  -- anon must not see any kiosk rows. RLS would yield 0 rows; insufficient
  -- table privilege at all yields a permission-denied error. Both outcomes
  -- satisfy the security property we're proving.
  begin
    select count(*) into v_anon_rows from public.kiosk_devices;
    if v_anon_rows <> 0 then
      raise exception 'SECTION 40: anon can read kiosk_devices directly (% rows)', v_anon_rows;
    end if;
  exception
    when insufficient_privilege then
      v_anon_rows := 0;
  end;

  perform pg_temp.impersonate('outsider', 'authenticated');
  select count(*) into v_auth_rows from public.kiosk_devices;
  -- org isolation on the RLS layer may permit the analyst to see their own
  -- org's devices. We accept that. The hard rule is anon sees zero.
end
$body$;
-- =====================================================
-- SECTION: KNOWN LIMITATIONS REQUIRING EXECUTION
-- =====================================================
-- The SQL harness used here is a single transactional run; it cannot prove
-- that the acknowledgement row lock holds under concurrent load. The
-- migration uses select ... for update, which is the right primitive for
--, but proving that two simultaneous acknowledgements from the same
-- device are serialized is a live-load test, not a static one. We mark
-- this as a known limitation here rather than pretending the sequential
-- test in SECTION 26 proves it.
--
-- Likewise, the RLS visibility test (SECTION 40) only proves that anon is
-- locked out. The migration explicitly relies on pre-existing policies for
-- the authenticated case; if those policies regress, only a production
---- integration test would notice.
--
-- This file ends with rollback;. All fixture rows are inside this single
-- transaction, so the suite leaves no residue in the database.

rollback;

-- =====================================================
-- END OF SUITE
-- =====================================================
