-- Kiosk RLS and tenant-isolation verification.
--
-- Builds two synthetic organizations (ALPHA and BETA) that are completely
-- disjoint from the demo seed, then asserts that no actor of one org can read
-- or mutate the other org's kiosk devices, and that the anon-callable kiosk
-- RPCs cannot be used to cross a tenant boundary.
--
-- Runs in a single transaction and rolls back, leaving the database unchanged.
-- Any incorrect result raises an exception, so ON_ERROR_STOP=1 fails the run.

begin;

-- =====================================================
-- Synthetic fixtures
-- =====================================================

-- Users. auth.users is required because profiles.id references it.
insert into auth.users (id, instance_id, aud, role, email)
values
  ('11110000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-owner@kiosk.test'),
  ('11110000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alpha-manager@kiosk.test'),
  ('11110000-0000-4000-8000-00000000000c', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'beta-owner@kiosk.test');

-- A trigger on auth.users may already have materialized these profiles, so
-- upsert rather than assuming they are absent.
insert into public.profiles (id, display_name, status)
values
  ('11110000-0000-4000-8000-00000000000a', 'Alpha Owner', 'active'),
  ('11110000-0000-4000-8000-00000000000b', 'Alpha Manager', 'active'),
  ('11110000-0000-4000-8000-00000000000c', 'Beta Owner', 'active')
on conflict (id) do update
set display_name = excluded.display_name,
    status = excluded.status;

insert into public.organizations (id, slug, name_en, name_ar, created_by)
values
  ('22220000-0000-4000-8000-00000000000a', 'kiosk-alpha', 'Kiosk Alpha', 'كشك ألفا', '11110000-0000-4000-8000-00000000000a'),
  ('22220000-0000-4000-8000-00000000000b', 'kiosk-beta', 'Kiosk Beta', 'كشك بيتا', '11110000-0000-4000-8000-00000000000c');

-- organization_memberships_scope_check requires owners/admins to be
-- organization-scoped and location managers to be locations-scoped.
insert into public.organization_memberships (user_id, organization_id, role, scope, status)
values
  ('11110000-0000-4000-8000-00000000000a', '22220000-0000-4000-8000-00000000000a', 'organization_owner', 'organization', 'active'),
  ('11110000-0000-4000-8000-00000000000b', '22220000-0000-4000-8000-00000000000a', 'location_manager', 'locations', 'active'),
  ('11110000-0000-4000-8000-00000000000c', '22220000-0000-4000-8000-00000000000b', 'organization_owner', 'organization', 'active');

insert into public.locations (id, organization_id, slug, name_en, name_ar, created_by)
values
  ('33330000-0000-4000-8000-00000000000a', '22220000-0000-4000-8000-00000000000a', 'alpha-branch', 'Alpha Branch', 'فرع ألفا', '11110000-0000-4000-8000-00000000000a'),
  ('33330000-0000-4000-8000-00000000000b', '22220000-0000-4000-8000-00000000000b', 'beta-branch', 'Beta Branch', 'فرع بيتا', '11110000-0000-4000-8000-00000000000c');

-- A locations-scoped membership only confers access through an explicit
-- location_memberships grant.
insert into public.location_memberships (location_id, organization_id, user_id, role, status)
values
  ('33330000-0000-4000-8000-00000000000a', '22220000-0000-4000-8000-00000000000a',
   '11110000-0000-4000-8000-00000000000b', 'location_manager', 'active');

insert into public.kiosk_devices (
  id, organization_id, location_id, device_name, device_identifier,
  access_token, channel, status, created_by
)
values
  ('44440000-0000-4000-8000-00000000000a', '22220000-0000-4000-8000-00000000000a',
   '33330000-0000-4000-8000-00000000000a', 'Alpha Kiosk', 'ALPHA-001',
   'tok-alpha-active', 'kiosk', 'active', '11110000-0000-4000-8000-00000000000a'),
  ('44440000-0000-4000-8000-00000000000b', '22220000-0000-4000-8000-00000000000b',
   '33330000-0000-4000-8000-00000000000b', 'Beta Kiosk', 'BETA-001',
   'tok-beta-active', 'kiosk', 'active', '11110000-0000-4000-8000-00000000000c');

-- =====================================================
-- 1. Cross-organization SELECT isolation
-- =====================================================

set local role authenticated;
select set_config('request.jwt.claim.sub', '11110000-0000-4000-8000-00000000000a', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11110000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

do $$
begin
  if (select count(*) from public.kiosk_devices
      where organization_id = '22220000-0000-4000-8000-00000000000a') <> 1 then
    raise exception 'Alpha owner must see the Alpha kiosk device';
  end if;

  if exists (
    select 1 from public.kiosk_devices
    where organization_id = '22220000-0000-4000-8000-00000000000b'
  ) then
    raise exception 'TENANT LEAK: Alpha owner can read Beta kiosk devices';
  end if;

  -- A leaked access token is the highest-value secret on this table.
  if exists (select 1 from public.kiosk_devices where access_token = 'tok-beta-active') then
    raise exception 'TENANT LEAK: Alpha owner can read the Beta access token';
  end if;
end;
$$;

-- =====================================================
-- 2. Cross-organization UPDATE / DELETE denial
-- =====================================================

-- Denial may arrive either as RLS filtering the row out (0 rows affected) or
-- as a missing table-level GRANT (insufficient_privilege). Both are correct;
-- only an actual mutation of the other tenant's row is a failure.
do $$
declare
  v_rows integer;
begin
  begin
    update public.kiosk_devices
    set device_name = 'Hijacked By Alpha'
    where id = '44440000-0000-4000-8000-00000000000b';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'TENANT LEAK: Alpha owner updated a Beta kiosk device';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  begin
    delete from public.kiosk_devices
    where id = '44440000-0000-4000-8000-00000000000b';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'TENANT LEAK: Alpha owner deleted a Beta kiosk device';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- The `with check` clause must stop an org admin from re-parenting a device
-- into another tenant (a write-side escape that `using` alone cannot block).
do $$
begin
  begin
    update public.kiosk_devices
    set organization_id = '22220000-0000-4000-8000-00000000000b'
    where id = '44440000-0000-4000-8000-00000000000a';
    -- Zero rows is an acceptable outcome; a successful re-parent is not.
    if exists (
      select 1 from public.kiosk_devices
      where id = '44440000-0000-4000-8000-00000000000a'
        and organization_id = '22220000-0000-4000-8000-00000000000b'
    ) then
      raise exception 'TENANT LEAK: device re-parented into another organization';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

-- =====================================================
-- 3. list_kiosk_devices RPC denies cross-org access
-- =====================================================

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.list_kiosk_devices('22220000-0000-4000-8000-00000000000a');
  if v_count <> 1 then
    raise exception 'Alpha owner must list exactly one Alpha device, got %', v_count;
  end if;

  begin
    perform * from public.list_kiosk_devices('22220000-0000-4000-8000-00000000000b');
    raise exception 'TENANT LEAK: list_kiosk_devices returned another org''s devices';
  exception
    when others then
      if sqlerrm like 'TENANT LEAK%' then
        raise;
      end if;
  end;
end;
$$;

-- =====================================================
-- 3b. Write RPCs must re-check authorization themselves
-- =====================================================
--
-- `authenticated` holds only SELECT on kiosk_devices, so every write travels
-- through a SECURITY DEFINER RPC. Those run as the function owner and bypass
-- RLS entirely, which makes the checks inside them the only thing standing
-- between a tenant and its neighbour's devices. Test them directly.

-- These must fail LOUDLY. A silent no-op (the RPC finding no visible row and
-- returning normally) is indistinguishable from a real denial at the call
-- site, so require an explicit authorization error rather than merely the
-- absence of a mutation.
do $$
declare
  v_new_id uuid;
  v_err text;
begin
  -- Creating a device inside another organization must be refused.
  begin
    select public.create_kiosk_device(
      '22220000-0000-4000-8000-00000000000b',
      '33330000-0000-4000-8000-00000000000b',
      'Planted By Alpha', 'ALPHA-PLANT', null, null
    ) into v_new_id;
    raise exception 'TENANT LEAK: create_kiosk_device planted a device in another org';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'TENANT LEAK%' then
        raise;
      end if;
      v_err := sqlerrm;
      if v_err not ilike '%not authorized%' then
        raise exception
          'create_kiosk_device rejected cross-org create for the wrong reason: %', v_err;
      end if;
  end;

  -- Mutating another organization's existing device must be refused.
  begin
    perform public.update_kiosk_device(
      p_device_id => '44440000-0000-4000-8000-00000000000b',
      p_device_name => 'Hijacked Via RPC'
    );
    raise exception 'TENANT LEAK: update_kiosk_device mutated another org''s device';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'TENANT LEAK%' then
        raise;
      end if;
      v_err := sqlerrm;
      if v_err not ilike '%not authorized%' then
        raise exception
          'update_kiosk_device rejected cross-org update for the wrong reason: %', v_err;
      end if;
  end;

  -- Positive control. If the legitimate owner cannot write either, then the
  -- denials above prove nothing and this whole section is vacuous.
  perform public.update_kiosk_device(
    p_device_id => '44440000-0000-4000-8000-00000000000a',
    p_device_name => 'Alpha Renamed Legitimately'
  );
  if not exists (
    select 1 from public.kiosk_devices
    where id = '44440000-0000-4000-8000-00000000000a'
      and device_name = 'Alpha Renamed Legitimately'
  ) then
    raise exception
      'VACUOUS TEST: the legitimate owner could not update their own device';
  end if;
end;
$$;

-- Verifying the target row must happen with RLS out of the way: as Alpha the
-- row is invisible, so a plain SELECT returns NULL and would mask a real
-- mutation behind a false failure (or, if inverted, a false pass).
reset role;

do $$
declare
  v_name text;
begin
  select device_name into v_name
  from public.kiosk_devices
  where id = '44440000-0000-4000-8000-00000000000b';
  if v_name is distinct from 'Beta Kiosk' then
    raise exception 'TENANT LEAK: Beta device was renamed to %', coalesce(v_name, '<missing>');
  end if;

  -- The positive control above renamed Alpha's own device; confirm the write
  -- actually landed at the storage layer and was not rolled back silently.
  if not exists (
    select 1 from public.kiosk_devices
    where id = '44440000-0000-4000-8000-00000000000a'
      and device_name = 'Alpha Renamed Legitimately'
  ) then
    raise exception 'VACUOUS TEST: the legitimate owner''s write did not persist';
  end if;

  if exists (
    select 1 from public.kiosk_devices
    where device_identifier = 'ALPHA-PLANT'
  ) then
    raise exception 'TENANT LEAK: a device was planted in another organization';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '11110000-0000-4000-8000-00000000000a', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11110000-0000-4000-8000-00000000000a","role":"authenticated"}',
  true
);

-- Revoking another tenant's kiosk is a denial-of-service, not just a read
-- leak, so status transitions get their own assertion.
do $$
begin
  begin
    perform public.update_kiosk_device(
      p_device_id => '44440000-0000-4000-8000-00000000000b',
      p_status => 'revoked'
    );
  exception
    when others then null;
  end;
end;
$$;

reset role;

do $$
declare
  v_status public.kiosk_status;
begin
  select status into v_status
  from public.kiosk_devices
  where id = '44440000-0000-4000-8000-00000000000b';
  if v_status is distinct from 'active' then
    raise exception 'TENANT LEAK: Beta device status forced to %', coalesce(v_status::text, '<missing>');
  end if;
end;
$$;

-- =====================================================
-- 4. Location manager is read-only
-- =====================================================

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11110000-0000-4000-8000-00000000000b', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"11110000-0000-4000-8000-00000000000b","role":"authenticated"}',
  true
);

do $$
declare
  v_rows integer;
begin
  if not exists (
    select 1 from public.kiosk_devices
    where id = '44440000-0000-4000-8000-00000000000a'
  ) then
    raise exception 'Location manager must see kiosk devices at their location';
  end if;

  begin
    update public.kiosk_devices
    set status = 'revoked'
    where id = '44440000-0000-4000-8000-00000000000a';
    get diagnostics v_rows = row_count;
    if v_rows <> 0 then
      raise exception 'PRIVILEGE ESCALATION: location manager mutated a kiosk device';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  -- The privileged RPC is the path that actually matters: a read-only role
  -- must not be able to launder a write through it.
  begin
    perform public.update_kiosk_device(
      p_device_id => '44440000-0000-4000-8000-00000000000a',
      p_status => 'revoked'
    );
  exception
    when others then null;
  end;
end;
$$;

-- Confirm with RLS bypassed so an invisible row cannot be mistaken for an
-- unmodified one.
reset role;

do $$
declare
  v_status public.kiosk_status;
begin
  select status into v_status
  from public.kiosk_devices
  where id = '44440000-0000-4000-8000-00000000000a';
  if v_status is distinct from 'active' then
    raise exception 'PRIVILEGE ESCALATION: location manager set device status to %',
      coalesce(v_status::text, '<missing>');
  end if;
end;
$$;

-- =====================================================
-- 5. Anonymous role cannot touch kiosk tables directly
-- =====================================================

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

-- anon is denied either by a missing GRANT (insufficient_privilege) or by RLS
-- returning zero rows. Both are correct; visible rows are the failure.
do $$
begin
  begin
    if exists (select 1 from public.kiosk_devices) then
      raise exception 'TENANT LEAK: anon can read kiosk_devices directly';
    end if;
  exception
    when insufficient_privilege then null;
  end;

  begin
    if exists (select 1 from public.kiosk_config_history) then
      raise exception 'TENANT LEAK: anon can read kiosk_config_history directly';
    end if;
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

do $$
begin
  begin
    insert into public.kiosk_devices (
      organization_id, location_id, device_name, access_token, created_by
    ) values (
      '22220000-0000-4000-8000-00000000000a',
      '33330000-0000-4000-8000-00000000000a',
      'Rogue Device', 'tok-rogue', '11110000-0000-4000-8000-00000000000a'
    );
    raise exception 'TENANT LEAK: anon inserted a kiosk device';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'TENANT LEAK%' then
        raise;
      end if;
  end;
end;
$$;

-- =====================================================
-- 6. Anonymous kiosk RPCs are scoped to their own token
-- =====================================================

do $$
declare
  v_device uuid;
  v_slug text;
begin
  -- A valid token resolves only to its own device.
  select device_id into v_device
  from public.get_kiosk_config('tok-alpha-active');
  if v_device <> '44440000-0000-4000-8000-00000000000a' then
    raise exception 'get_kiosk_config resolved the wrong device';
  end if;

  -- An unknown token must be rejected, never silently resolved.
  begin
    perform * from public.get_kiosk_config('tok-does-not-exist');
    raise exception 'TENANT LEAK: get_kiosk_config accepted an invalid token';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'TENANT LEAK%' then
        raise;
      end if;
  end;

  -- Heartbeat / response attribution must not succeed on an unknown token.
  if public.update_kiosk_heartbeat('tok-does-not-exist') then
    raise exception 'FALSE SUCCESS: heartbeat returned true for an invalid token';
  end if;
  if public.record_kiosk_response('tok-does-not-exist') then
    raise exception 'FALSE SUCCESS: record_kiosk_response returned true for an invalid token';
  end if;
end;
$$;

-- =====================================================
-- 7. Device lifecycle gating via the anon RPCs
-- =====================================================

reset role;

update public.kiosk_devices set status = 'paused'
where id = '44440000-0000-4000-8000-00000000000a';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_slug text;
begin
  select survey_public_slug into v_slug
  from public.get_kiosk_config('tok-alpha-active');
  if v_slug is not null then
    raise exception 'A paused device must not receive a survey slug';
  end if;

  if public.record_kiosk_response('tok-alpha-active') then
    raise exception 'FALSE SUCCESS: a paused device attributed a response';
  end if;

  -- Paused hardware is still commissioned, so liveness must be observable.
  if not public.update_kiosk_heartbeat('tok-alpha-active') then
    raise exception 'A paused device must still be able to heartbeat';
  end if;
end;
$$;

reset role;
update public.kiosk_devices set status = 'maintenance'
where id = '44440000-0000-4000-8000-00000000000a';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_slug text;
begin
  select survey_public_slug into v_slug
  from public.get_kiosk_config('tok-alpha-active');
  if v_slug is not null then
    raise exception 'A maintenance device must not receive a survey slug';
  end if;
  if public.record_kiosk_response('tok-alpha-active') then
    raise exception 'FALSE SUCCESS: a maintenance device attributed a response';
  end if;
end;
$$;

reset role;
update public.kiosk_devices set status = 'revoked'
where id = '44440000-0000-4000-8000-00000000000a';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
declare
  v_status public.kiosk_status;
  v_org uuid;
  v_rows integer;
begin
  if public.update_kiosk_heartbeat('tok-alpha-active') then
    raise exception 'FALSE SUCCESS: a revoked device reported a healthy heartbeat';
  end if;
  if public.record_kiosk_response('tok-alpha-active') then
    raise exception 'FALSE SUCCESS: a revoked device attributed a response';
  end if;

  -- resolve_kiosk_attribution is SECURITY DEFINER and executable by anon. It
  -- intentionally still resolves a revoked device, because it is the caller's
  -- job to gate on the status it returns (src/app/api/feedback/route.ts rejects
  -- any status <> 'active' with a 409). This test therefore does NOT assert that
  -- a revoked device fails to resolve -- it pins the contract that makes the
  -- caller's gate possible: the row must carry a truthful, non-active status.
  -- If someone "hardens" this function by nulling out the status column while
  -- still returning a row, the API's gate silently passes and revoked kiosks
  -- resume writing feedback. That regression must fail here.
  select count(*) into v_rows
  from public.resolve_kiosk_attribution('tok-alpha-active');

  if v_rows > 0 then
    select status, organization_id into v_status, v_org
    from public.resolve_kiosk_attribution('tok-alpha-active');

    if v_status is null then
      raise exception
        'BROKEN CONTRACT: attribution returned a row with a null status; callers cannot gate on it';
    end if;
    if v_status = 'active' then
      raise exception
        'FALSE SUCCESS: attribution reports a revoked device as active (status=%)', v_status;
    end if;
    if v_org is null then
      raise exception
        'BROKEN CONTRACT: attribution returned a row with a null organization_id; the caller cannot enforce tenant binding';
    end if;
  end if;
end;
$$;


reset role;
update public.kiosk_devices set status = 'archived'
where id = '44440000-0000-4000-8000-00000000000a';

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);

do $$
begin
  -- An archived device must be indistinguishable from a non-existent one.
  begin
    perform * from public.get_kiosk_config('tok-alpha-active');
    raise exception 'TENANT LEAK: an archived device still resolves configuration';
  exception
    when insufficient_privilege then null;
    when others then
      if sqlerrm like 'TENANT LEAK%' then
        raise;
      end if;
  end;

  if public.update_kiosk_heartbeat('tok-alpha-active') then
    raise exception 'FALSE SUCCESS: an archived device reported a healthy heartbeat';
  end if;
  if public.record_kiosk_response('tok-alpha-active') then
    raise exception 'FALSE SUCCESS: an archived device attributed a response';
  end if;

  -- Archived is the one status resolve_kiosk_attribution filters out itself, so
  -- here the function is the sole line of defence rather than a caller's gate.
  if exists (select 1 from public.resolve_kiosk_attribution('tok-alpha-active')) then
    raise exception
      'TENANT LEAK: attribution still resolves an archived device to anon';
  end if;

  -- The token is the only credential, so attribution must never resolve one
  -- tenant's token to another tenant. Beta is still active, so a non-empty
  -- result here would be a genuine cross-tenant resolution rather than
  -- lifecycle filtering.
  declare
    v_beta_org uuid;
  begin
    select organization_id into v_beta_org
    from public.resolve_kiosk_attribution('tok-beta-active');

    if v_beta_org is distinct from '22220000-0000-4000-8000-00000000000b' then
      raise exception
        'BROKEN CONTRACT: Beta token resolved to org % instead of Beta',
        coalesce(v_beta_org::text, '<null>');
    end if;
  end;
end;
$$;


reset role;

rollback;
