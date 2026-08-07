-- Kiosk Activation System Tests
-- Run with: psql -v ON_ERROR_STOP=1 -f supabase/tests/kiosk_activation_system.sql

\echo '=== KIOSK ACTIVATION SYSTEM TESTS ==='
\echo ''

-- Setup: Create test tenant context
\echo '--- Setup: Creating test context ---'

-- Get existing test data
do $$
declare
  v_org_id uuid;
  v_location_id uuid;
  v_survey_id uuid;
  v_user_id uuid;
  v_device_id uuid;
  v_activation_code text;
  v_credential text;
  v_result record;
begin
  -- Get test organization
  select id into v_org_id from public.organizations limit 1;
  if v_org_id is null then
    raise notice 'No organization found, skipping tests';
    return;
  end if;
  raise notice 'Using organization: %', v_org_id;
  
  -- Get test location
  select id into v_location_id from public.locations where organization_id = v_org_id limit 1;
  if v_location_id is null then
    raise notice 'No location found, skipping tests';
    return;
  end if;
  raise notice 'Using location: %', v_location_id;
  
  -- Get test survey
  select id into v_survey_id from public.surveys where organization_id = v_org_id and status = 'active' limit 1;
  raise notice 'Using survey: %', v_survey_id;
  
  -- Get test user (admin)
  select id into v_user_id from auth.users limit 1;
  raise notice 'Using user: %', v_user_id;
  
  -- Test 1: Create device with pending_activation status
  raise notice '';
  raise notice '=== TEST 1: Create device with pending_activation ===';
  
  -- Mock auth.uid() for the test by setting a session variable
  perform set_config('request.jwt.claims', json_build_object(
    'sub', v_user_id::text,
    'role', 'authenticated'
  )::text, false);
  
  -- The seeded user is already an owner, no need to modify membership
  -- Just verify the user has access to the organization
  perform 1 from public.organization_memberships 
  where organization_id = v_org_id and user_id = v_user_id and status = 'active';
  if not found then
    raise exception 'Test user does not have access to organization';
  end if;
  
  -- Now create the device using raw SQL with the user context
  insert into public.kiosk_devices (
    organization_id, location_id, device_name, status, access_token,
    activation_code_hash, activation_code_expires_at
  )
  values (
    v_org_id, v_location_id, 'Test Kiosk Device', 'pending_activation', 'pending_activation',
    encode(sha256('TESTCODE1'::bytea), 'hex'), timezone('utc', now()) + interval '24 hours'
  )
  returning id into v_device_id;
  
  raise notice 'Created device: %', v_device_id;
  
  -- Verify the device has pending_activation status
  perform 1 from public.kiosk_devices where id = v_device_id and status = 'pending_activation';
  if found then
    raise notice 'PASS: Device has pending_activation status';
  else
    raise exception 'FAIL: Device does not have pending_activation status';
  end if;
  
  -- Test 2: Activate device with code
  raise notice '';
  raise notice '=== TEST 2: Activate device with code ===';
  
  -- Test activation using the stored hash
  select * into v_result from public.activate_kiosk_device('TESTCODE1', 'iPad Pro', 'iOS 17', '1.0.0');
  
  if v_result.success then
    raise notice 'PASS: Device activated successfully';
    raise notice '  Device ID: %', v_result.device_id;
    raise notice '  Credential length: %', length(v_result.device_credential);
    v_credential := v_result.device_credential;
  else
    raise exception 'FAIL: Device activation failed';
  end if;
  
  -- Verify the device is now active
  perform 1 from public.kiosk_devices where id = v_device_id and status = 'active';
  if found then
    raise notice 'PASS: Device is now active';
  else
    raise exception 'FAIL: Device is not active';
  end if;
  
  -- Verify credential hash is set
  perform 1 from public.kiosk_devices where id = v_device_id and device_credential_hash is not null;
  if found then
    raise notice 'PASS: Credential hash is set';
  else
    raise exception 'FAIL: Credential hash is not set';
  end if;
  
  -- Test 3: Get config with credential
  raise notice '';
  raise notice '=== TEST 3: Get config with credential ===';
  
  begin
    select * into v_result from public.get_kiosk_config(v_credential);
    raise notice 'PASS: Got config with credential';
    raise notice '  Device name: %', v_result.device_name;
    raise notice '  Status: %', v_result.status;
  exception
    when others then
      raise exception 'FAIL: Could not get config: %', sqlerrm;
  end;
  
  -- Test 4: Reject reused activation code
  raise notice '';
  raise notice '=== TEST 4: Reject reused activation code ===';
  
  select * into v_result from public.activate_kiosk_device('TESTCODE1');
  
  if not v_result.success then
    raise notice 'PASS: Reused code correctly rejected';
  else
    raise exception 'FAIL: Reused code was accepted';
  end if;
  
  -- Test 5: Reject wrong activation code
  raise notice '';
  raise notice '=== TEST 5: Reject wrong activation code ===';
  
  select * into v_result from public.activate_kiosk_device('WRONGCODE');
  
  if not v_result.success then
    raise notice 'PASS: Wrong code correctly rejected';
  else
    raise exception 'FAIL: Wrong code was accepted';
  end if;
  
  -- Test 6: Hash credential function
  raise notice '';
  raise notice '=== TEST 6: Hash credential function ===';
  
  declare
    v_hash1 text;
    v_hash2 text;
  begin
    v_hash1 := public.hash_credential('test-credential');
    v_hash2 := public.hash_credential('test-credential');
    
    if v_hash1 = v_hash2 then
      raise notice 'PASS: Hash function is deterministic';
    else
      raise exception 'FAIL: Hash function is not deterministic';
    end if;
    
    if length(v_hash1) = 64 then
      raise notice 'PASS: Hash is 64 characters (SHA-256)';
    else
      raise exception 'FAIL: Hash is not 64 characters';
    end if;
  end;
  
  -- Test 7: Is kiosk online function
  raise notice '';
  raise notice '=== TEST 7: Is kiosk online function ===';
  
  declare
    v_is_online boolean;
  begin
    -- Should be online (last_seen_at just updated)
    v_is_online := public.is_kiosk_online(timezone('utc', now()), 120);
    if v_is_online then
      raise notice 'PASS: Device with recent last_seen_at is online';
    else
      raise exception 'FAIL: Device with recent last_seen_at is not online';
    end if;
    
    -- Should be offline (last_seen_at 5 minutes ago)
    v_is_online := public.is_kiosk_online(timezone('utc', now()) - interval '5 minutes', 120);
    if not v_is_online then
      raise notice 'PASS: Device with old last_seen_at is offline';
    else
      raise exception 'FAIL: Device with old last_seen_at is online';
    end if;
    
    -- Should be offline (null last_seen_at)
    v_is_online := public.is_kiosk_online(null, 120);
    if not v_is_online then
      raise notice 'PASS: Device with null last_seen_at is offline';
    else
      raise exception 'FAIL: Device with null last_seen_at is online';
    end if;
  end;
  
  -- Cleanup
  raise notice '';
  raise notice '=== Cleanup ===';
  delete from public.kiosk_config_history where kiosk_device_id = v_device_id;
  delete from public.kiosk_devices where id = v_device_id;
  raise notice 'Cleaned up test device';
  
  raise notice '';
  raise notice '=== ALL TESTS PASSED ===';
end;
$$;