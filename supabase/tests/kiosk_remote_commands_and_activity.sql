-- Boundary C3: fleet RPCs, command issuance, activity history, idempotency.
--
-- This test exercises the public RPCs added by migration
-- 20260807100000_kiosk_fleet_management.sql. It is self-contained: it
-- creates its own organisation, location, survey, and kiosk, then
-- exercises every C3 RPC and constraint against them.

\set ON_ERROR_STOP on

-- =====================================================
-- SECTION 1. FIXTURE SETUP
-- =====================================================
-- One organisation, one admin, one location, one survey, one kiosk. We
-- use fixed UUIDs so the test is reproducible.

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_org_a    uuid := '11110000-0000-4000-8000-00000000000b';
  v_loc_a    uuid := '11110000-0000-4000-8000-00000000000c';
  v_survey_a uuid := '11110000-0000-4000-8000-00000000000d';
  v_kiosk_a  uuid := '11110000-0000-4000-8000-00000000000e';
  v_admin_b  uuid := '11110000-0000-4000-8000-00000000000f';
  v_org_b    uuid := '11110000-0000-4000-8000-000000000a0a';
begin
  -- Admin user fixture.
  if not exists (select 1 from auth.users where id = v_admin_a) then
    insert into auth.users (id, instance_id, aud, role, email)
    values (v_admin_a, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', 'c3-admin-a@test.local');
  end if;
  if not exists (select 1 from auth.users where id = v_admin_b) then
    insert into auth.users (id, instance_id, aud, role, email)
    values (v_admin_b, '00000000-0000-0000-0000-000000000000',
            'authenticated', 'authenticated', 'c3-admin-b@test.local');
  end if;

  insert into public.profiles (id, display_name, preferred_locale)
  values (v_admin_a, 'C3 Admin A', 'en'),
         (v_admin_b, 'C3 Admin B', 'en')
  on conflict (id) do nothing;

  -- Two organisations so we can prove cross-org isolation.
  insert into public.organizations (id, slug, name_en, name_ar, primary_color, status)
  values (v_org_a, 'c3-org-a', 'C3 Org A', 'C3 Org A', '#000000', 'active'),
         (v_org_b, 'c3-org-b', 'C3 Org B', 'C3 Org B', '#000000', 'active')
  on conflict (id) do nothing;

  insert into public.organization_memberships (user_id, organization_id, role, scope, status)
  values
    (v_admin_a, v_org_a, 'organization_admin', 'organization', 'active'),
    (v_admin_b, v_org_b, 'organization_admin', 'organization', 'active')
  on conflict do nothing;

  insert into public.locations (id, organization_id, slug, name_en, name_ar, status)
  values (v_loc_a, v_org_a, 'c3-location', 'C3 Location', 'C3 Location', 'active')
  on conflict (id) do nothing;

  insert into public.surveys (
    id, organization_id, location_id, title_en, title_ar, public_slug,
    status, created_by, published_at
  )
  values (
    v_survey_a, v_org_a, v_loc_a, 'C3 Survey', 'C3 Survey',
    'c3-survey-slug-aaaaaaaaaaaaaaaaaa', 'active', v_admin_a, now()
  )
  on conflict (id) do nothing;

  insert into public.kiosk_devices (
    id, organization_id, location_id, device_name, device_identifier,
    status, created_by
  )
  values (
    v_kiosk_a, v_org_a, v_loc_a, 'C3 Kiosk', 'c3-kiosk-001',
    'active', v_admin_a
  )
  on conflict (id) do nothing;
end $$;

-- =====================================================
-- SECTION 2. LIST_KIOSK_FLEET AUTHORIZATION
-- =====================================================
-- Admin in org B must not see org A's kiosks.

do $$
declare
  v_admin_b uuid := '11110000-0000-4000-8000-00000000000f';
  v_org_a   uuid := '11110000-0000-4000-8000-00000000000b';
  v_count   integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_b::text, true);

  begin
    select count(*) into v_count from public.list_kiosk_fleet(v_org_a);
    raise exception 'Expected list_kiosk_fleet to reject org B admin reading org A, but it returned % rows', v_count;
  exception
    when insufficient_privilege then
      null;
  end;

  reset role;
end $$;

-- =====================================================
-- SECTION 3. ISSUE_KIOSK_COMMAND IDEMPOTENCY
-- =====================================================

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk    uuid := '11110000-0000-4000-8000-00000000000e';
  v_idem_key text := 'idem-key-' || encode(gen_random_bytes(6), 'hex');
  v_first    uuid;
  v_second   uuid;
  v_existed1 boolean;
  v_existed2 boolean;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  select command_id, already_existed into v_first, v_existed1
  from public.issue_kiosk_command(v_kiosk, 'refresh_configuration', null, v_idem_key);

  if v_existed1 then
    raise exception 'First call should not report already_existed';
  end if;

  select command_id, already_existed into v_second, v_existed2
  from public.issue_kiosk_command(v_kiosk, 'refresh_configuration', null, v_idem_key);

  if not v_existed2 then
    raise exception 'Second call should report already_existed';
  end if;

  if v_first <> v_second then
    raise exception 'Idempotency violated: first=%, second=%', v_first, v_second;
  end if;

  -- Use the RPC's "already_existed" boolean as the idempotency assertion;
  -- the direct table read would be blocked by RLS, which is the desired
  -- production behaviour for the authenticated role.
  if v_first <> v_second then
    raise exception 'Idempotency violated: first=%, second=%', v_first, v_second;
  end if;
  if not v_existed2 then
    raise exception 'Idempotency assertion failed: second call did not report already_existed';
  end if;

  reset role;
end $$;

-- =====================================================
-- SECTION 4. ISSUE_KIOSK_COMMAND WHITELIST
-- =====================================================

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk    uuid := '11110000-0000-4000-8000-00000000000e';
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  begin
    perform * from public.issue_kiosk_command(v_kiosk, 'self_destruct', null, 'whitelist-bad-key-1');
    raise exception 'Expected unsupported command_type to be rejected';
  exception
    when invalid_parameter_value then
      null;
  end;

  reset role;
end $$;

-- =====================================================
-- SECTION 5. ACTIVITY HISTORY LOGS COMMAND ISSUANCE
-- =====================================================

do $$
declare
  v_admin_a   uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk     uuid := '11110000-0000-4000-8000-00000000000e';
  v_org_a     uuid := '11110000-0000-4000-8000-00000000000b';
  v_command_id uuid;
  v_count     integer;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  select command_id into v_command_id
  from public.issue_kiosk_command(v_kiosk, 'pause', null, 'activity-test-key');

  -- Use the dashboard RPC rather than reading the table directly; RLS
  -- blocks the latter for the authenticated role, which is the correct
  -- production behaviour. We assert via the metadata summary, which
  -- exposes the command_type and status from the allowlist.
  select count(*) into v_count
  from public.list_kiosk_activity(
    v_org_a, v_kiosk, null, 'pause_requested', null, null, null, 50, 0
  )
  where metadata_summary like '%command_type=pause%'
    and metadata_summary like '%status=pending%';

  if v_count = 0 then
    raise exception 'Activity row for pause_requested was not visible via list_kiosk_activity';
  end if;

  reset role;
end $$;

-- =====================================================
-- SECTION 6. ACTIVITY METADATA SUMMARY REDACTION
-- =====================================================

do $$
declare
  v_summary text;
begin
  v_summary := public.kiosk_activity_summary(
    jsonb_build_object(
      'command_type', 'pause',
      'status', 'pending',
      'credential', 'super-secret-raw',
      'credential_hash', 'super-secret-hash',
      'token', 'bearer-abc',
      'service_role_key', 'sk_live',
      'request_body', '{"email":"x"}',
      'stack_trace', 'Error: ...'
    )
  );

  if v_summary like '%super-secret%' then
    raise exception 'Credential leaked into summary: %', v_summary;
  end if;
  if v_summary like '%bearer-abc%' then
    raise exception 'Token leaked into summary: %', v_summary;
  end if;
  if v_summary not like '%command_type=pause%' then
    raise exception 'Allowed field command_type missing from summary: %', v_summary;
  end if;
  if v_summary not like '%status=pending%' then
    raise exception 'Allowed field status missing from summary: %', v_summary;
  end if;
end $$;

-- =====================================================
-- SECTION 7. LIST_KIOSK_ACTIVITY PAGINATION + FILTER
-- =====================================================

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk    uuid := '11110000-0000-4000-8000-00000000000e';
  v_org_a    uuid := '11110000-0000-4000-8000-00000000000b';
  v_rows integer;
  v_total bigint;
begin
  -- We are still running as the test's default superuser, so direct
  -- inserts bypass RLS. The dashboard read below switches back to the
  -- authenticated context so we still exercise the production RLS path.

  for i in 1..30 loop
    insert into public.kiosk_activity_history (
      organization_id, kiosk_device_id, event_type, actor_type, metadata
    ) values (
      v_org_a, v_kiosk, 'configuration_fetched', 'kiosk_device',
      jsonb_build_object('status', 'pending', 'config_version', i)
    );
  end loop;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  select count(*), max(total_count) into v_rows, v_total
  from public.list_kiosk_activity(
    v_org_a, null, null, 'configuration_fetched', null, null, null, 5, 0
  );

  if v_rows <> 5 then
    raise exception 'Expected exactly 5 rows on the page, got %', v_rows;
  end if;

  if v_total < 30 then
    raise exception 'Expected total_count >= 30 for pagination, got %', v_total;
  end if;

  reset role;
end $$;

-- =====================================================
-- SECTION 8. LIST_KIOSK_FLEET RETURNS CONFIG STATUS
-- =====================================================

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk    uuid := '11110000-0000-4000-8000-00000000000e';
  v_org_a    uuid := '11110000-0000-4000-8000-00000000000b';
  v_status text;
  v_online boolean;
begin
  -- Force the desired/applied match as the superuser so the generated
  -- configuration_status resolves to 'current' before we read it.
  update public.kiosk_devices
    set desired_config_version = 1,
        applied_config_version = 1,
        configuration_error = null,
        last_seen_at = now()
  where id = v_kiosk;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  select configuration_status, online into v_status, v_online
  from public.list_kiosk_fleet(v_org_a)
  where id = v_kiosk;

  if v_status <> 'current' then
    raise exception 'Expected configuration_status=current, got %', v_status;
  end if;
  if v_online is not true then
    raise exception 'Expected online=true after recent heartbeat, got %', v_online;
  end if;

  reset role;
end $$;

-- =====================================================
-- SECTION 9. PENDING COMMANDS REJECT INVALID CREDENTIAL
-- =====================================================

do $$
begin
  begin
    perform * from public.list_kiosk_pending_commands('not-a-real-credential');
    raise exception 'Expected invalid credential to be rejected';
  exception
    when insufficient_privilege then
      null;
  end;
end $$;

-- =====================================================
-- SECTIONS 10-13. DIRECT TABLE ACCESS AS SERVICE ROLE
-- =====================================================
-- The remaining sections need to assert table state directly. We
-- temporarily switch into the service_role context, which bypasses
-- RLS, and back out before finishing.

-- =====================================================
-- SECTION 10. CANCEL COMMAND MOVES TO CANCELLED + LOGS ACTIVITY
-- =====================================================

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk    uuid := '11110000-0000-4000-8000-00000000000e';
  v_command_id uuid;
  v_new_status text;
  v_activity_count integer;
begin
  -- Run the RPCs as the authenticated admin so we exercise the production
  -- call path. After the RPCs we drop back to superuser for the direct
  -- table check.
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  select command_id into v_command_id
  from public.issue_kiosk_command(v_kiosk, 'resume', null, 'cancel-test-key');

  select status into v_new_status
  from public.cancel_kiosk_command(v_command_id);

  if v_new_status <> 'cancelled' then
    raise exception 'Expected status=cancelled, got %', v_new_status;
  end if;

  reset role;

  select count(*) into v_activity_count
  from public.kiosk_activity_history
  where kiosk_device_id = v_kiosk
    and event_type = 'command_cancelled'
    and metadata ->> 'command_id' = v_command_id::text;

  if v_activity_count = 0 then
    raise exception 'Cancellation activity was not logged';
  end if;
end $$;

-- =====================================================
-- SECTION 11. EXPIRE_KIOSK_COMMANDS MARKS PAST EXPIRY
-- =====================================================

do $$
declare
  v_admin_a  uuid := '11110000-0000-4000-8000-00000000000a';
  v_kiosk    uuid := '11110000-0000-4000-8000-00000000000e';
  v_command_id uuid;
  v_status text;
begin
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_admin_a::text, true);

  select command_id into v_command_id
  from public.issue_kiosk_command(v_kiosk, 'refresh_configuration', null, 'expire-test-key');

  reset role;

  update public.kiosk_remote_commands
    set expires_at = now() - interval '1 minute'
  where id = v_command_id;

  -- The sweep is service-role only, so we run it as service_role.
  set local role service_role;
  perform * from public.expire_kiosk_commands();

  reset role;

  select status into v_status
  from public.kiosk_remote_commands
  where id = v_command_id;

  if v_status <> 'expired' then
    raise exception 'Expected status=expired after sweep, got %', v_status;
  end if;
end $$;

-- =====================================================
-- SECTION 12. ACTIVITY EVENT_TYPE CONSTRAINT BLOCKS UNKNOWN VALUES
-- =====================================================

do $$
declare
  v_org_a   uuid := '11110000-0000-4000-8000-00000000000b';
  v_kiosk   uuid := '11110000-0000-4000-8000-00000000000e';
begin
  begin
    insert into public.kiosk_activity_history (
      organization_id, kiosk_device_id, event_type, actor_type
    ) values (v_org_a, v_kiosk, 'not_a_real_event', 'admin_user');
    raise exception 'Expected unknown event_type to violate check';
  exception
    when check_violation then
      null;
  end;
end $$;

-- =====================================================
-- SECTION 13. ACTIVITY ACTOR_TYPE CONSTRAINT BLOCKS UNKNOWN VALUES
-- =====================================================

do $$
declare
  v_org_a   uuid := '11110000-0000-4000-8000-00000000000b';
  v_kiosk   uuid := '11110000-0000-4000-8000-00000000000e';
begin
  begin
    insert into public.kiosk_activity_history (
      organization_id, kiosk_device_id, event_type, actor_type
    ) values (v_org_a, v_kiosk, 'configuration_fetched', 'mystery_actor');
    raise exception 'Expected unknown actor_type to violate check';
  exception
    when check_violation then
      null;
  end;
end $$;
