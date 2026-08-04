-- Schema tests for public.kiosk_enrollment_sessions
-- Migration under test: 20260802090000_kiosk_enrollment_sessions.sql
-- Scope: schema only. No enrollment RPCs exist yet.

\set ON_ERROR_STOP on

DO $$
DECLARE
  v_tests int := 0;
  v_ok boolean;
BEGIN
  ASSERT to_regclass('public.kiosk_enrollment_sessions') IS NOT NULL, 'table missing';
  v_tests := v_tests + 1;

  ASSERT (SELECT relrowsecurity FROM pg_class
          WHERE oid = 'public.kiosk_enrollment_sessions'::regclass), 'RLS not enabled';
  v_tests := v_tests + 1;

  FOR v_ok IN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema='public' AND c.table_name='kiosk_enrollment_sessions'
        AND c.column_name = x.col AND c.data_type = x.typ)
    FROM (VALUES
      ('id','uuid'),('organization_id','uuid'),('kiosk_device_id','uuid'),
      ('token_hash','text'),('expires_at','timestamp with time zone'),
      ('opened_at','timestamp with time zone'),('used_at','timestamp with time zone'),
      ('revoked_at','timestamp with time zone'),('failure_reason','text'),
      ('created_by','uuid'),('created_at','timestamp with time zone'),
      ('updated_at','timestamp with time zone')) AS x(col,typ)
  LOOP
    ASSERT v_ok, 'required column missing or wrong type';
    v_tests := v_tests + 1;
  END LOOP;

  FOR v_ok IN
    SELECT (SELECT c.is_nullable='NO' FROM information_schema.columns c
            WHERE c.table_schema='public' AND c.table_name='kiosk_enrollment_sessions'
              AND c.column_name = x.col)
    FROM (VALUES ('id'),('organization_id'),('kiosk_device_id'),('token_hash'),
                 ('expires_at'),('created_by'),('created_at'),('updated_at')) AS x(col)
  LOOP
    ASSERT v_ok, 'required NOT NULL missing';
    v_tests := v_tests + 1;
  END LOOP;

  FOR v_ok IN
    SELECT (SELECT c.is_nullable='YES' FROM information_schema.columns c
            WHERE c.table_schema='public' AND c.table_name='kiosk_enrollment_sessions'
              AND c.column_name = x.col)
    FROM (VALUES ('opened_at'),('used_at'),('revoked_at'),('failure_reason')) AS x(col)
  LOOP
    ASSERT v_ok, 'lifecycle column should be nullable';
    v_tests := v_tests + 1;
  END LOOP;

  ASSERT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.kiosk_enrollment_sessions'::regclass AND contype='p'),
    'primary key missing';
  v_tests := v_tests + 1;

  ASSERT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.kiosk_enrollment_sessions'::regclass AND contype='f'
      AND confrelid='public.organizations'::regclass), 'FK to organizations missing';
  v_tests := v_tests + 1;

  ASSERT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.kiosk_enrollment_sessions'::regclass AND contype='f'
      AND confrelid='public.kiosk_devices'::regclass AND array_length(conkey,1)=2
      AND conname='kiosk_enrollment_sessions_device_fk'), 'composite tenant FK missing';
  v_tests := v_tests + 1;

  ASSERT EXISTS (SELECT 1 FROM pg_constraint
    WHERE conrelid='public.kiosk_enrollment_sessions'::regclass AND contype='f'
      AND confrelid='auth.users'::regclass), 'FK to auth.users missing';
  v_tests := v_tests + 1;

  FOR v_ok IN
    SELECT EXISTS (SELECT 1 FROM pg_constraint
      WHERE conrelid='public.kiosk_enrollment_sessions'::regclass AND contype='c' AND conname=x.n)
    FROM (VALUES ('kiosk_enrollment_sessions_token_hash_format'),
                 ('kiosk_enrollment_sessions_expiry_after_creation'),
                 ('kiosk_enrollment_sessions_failure_reason_length')) AS x(n)
  LOOP
    ASSERT v_ok, 'required CHECK constraint missing';
    v_tests := v_tests + 1;
  END LOOP;

  FOR v_ok IN
    SELECT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
      AND tablename='kiosk_enrollment_sessions' AND indexname=x.n)
    FROM (VALUES ('kiosk_enrollment_sessions_token_hash_key'),
                 ('kiosk_enrollment_sessions_kiosk_device_id_idx'),
                 ('kiosk_enrollment_sessions_organization_id_idx'),
                 ('kiosk_enrollment_sessions_expires_at_idx'),
                 ('kiosk_enrollment_sessions_active_idx'),
                 ('kiosk_enrollment_sessions_one_open_per_device_idx')) AS x(n)
  LOOP
    ASSERT v_ok, 'required index missing';
    v_tests := v_tests + 1;
  END LOOP;

  ASSERT (SELECT indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexdef LIKE '%used_at IS NULL%'
               AND indexdef LIKE '%revoked_at IS NULL%'
          FROM pg_indexes WHERE indexname='kiosk_enrollment_sessions_one_open_per_device_idx'),
    'active-session index is not a partial UNIQUE index';
  v_tests := v_tests + 1;

  ASSERT (SELECT indexdef LIKE 'CREATE UNIQUE INDEX%' FROM pg_indexes
          WHERE indexname='kiosk_enrollment_sessions_token_hash_key'), 'token_hash not unique';
  v_tests := v_tests + 1;

  FOR v_ok IN
    SELECT NOT has_table_privilege('anon','public.kiosk_enrollment_sessions', x.p)
    FROM (VALUES ('SELECT'),('INSERT'),('UPDATE'),('DELETE')) AS x(p)
  LOOP
    ASSERT v_ok, 'anon holds a privilege on the table';
    v_tests := v_tests + 1;
  END LOOP;

  ASSERT has_table_privilege('authenticated','public.kiosk_enrollment_sessions','SELECT'),
    'authenticated cannot SELECT';
  v_tests := v_tests + 1;

  FOR v_ok IN
    SELECT NOT has_table_privilege('authenticated','public.kiosk_enrollment_sessions', x.p)
    FROM (VALUES ('INSERT'),('UPDATE'),('DELETE')) AS x(p)
  LOOP
    ASSERT v_ok, 'authenticated holds a direct write privilege';
    v_tests := v_tests + 1;
  END LOOP;

  ASSERT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='kiosk_enrollment_sessions'
      AND policyname='Organization admins can view their kiosk enrollment sessions'
      AND cmd='SELECT' AND qual LIKE '%organization_memberships%'
      AND qual LIKE '%organization_owner%' AND qual LIKE '%organization_admin%'),
    'organization isolation policy missing or not org scoped';
  v_tests := v_tests + 1;

  ASSERT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='kiosk_enrollment_sessions'
      AND policyname='Platform admins have full access to kiosk enrollment sessions'),
    'platform admin policy missing';
  v_tests := v_tests + 1;

  ASSERT NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='kiosk_enrollment_sessions'
      AND cmd IN ('INSERT','UPDATE','DELETE')
      AND policyname <> 'Platform admins have full access to kiosk enrollment sessions'),
    'unexpected member write policy exists';
  v_tests := v_tests + 1;

  ASSERT EXISTS (SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.kiosk_enrollment_sessions'::regclass
      AND tgname='kiosk_enrollment_sessions_updated_at' AND NOT tgisinternal),
    'updated_at trigger missing';
  v_tests := v_tests + 1;

  FOR v_ok IN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='kiosk_devices' AND column_name=x.c)
    FROM (VALUES ('access_token'),('device_credential_hash'),
                 ('activation_code_hash'),('activated_at')) AS x(c)
  LOOP
    ASSERT v_ok, 'pre-existing kiosk_devices column lost';
    v_tests := v_tests + 1;
  END LOOP;

  RAISE NOTICE 'catalog assertions passed: %', v_tests;
END $$;

BEGIN;
SET LOCAL session_replication_role = replica;

DO $$
DECLARE
  v_org uuid := gen_random_uuid();
  v_dev uuid := gen_random_uuid();
  v_usr uuid := gen_random_uuid();
  v_tests int := 0;
  v_blocked boolean;
BEGIN
  INSERT INTO public.kiosk_enrollment_sessions
    (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
  VALUES (v_org, v_dev, repeat('a',64), now() + interval '20 minutes', v_usr);
  v_tests := v_tests + 1;

  BEGIN
    INSERT INTO public.kiosk_enrollment_sessions
      (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
    VALUES (v_org, v_dev, repeat('b',64), now() + interval '20 minutes', v_usr);
    v_blocked := false;
  EXCEPTION WHEN unique_violation THEN v_blocked := true; END;
  ASSERT v_blocked, 'two open sessions allowed for same kiosk';
  v_tests := v_tests + 1;

  INSERT INTO public.kiosk_enrollment_sessions
    (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
  VALUES (v_org, gen_random_uuid(), repeat('c',64), now() + interval '20 minutes', v_usr);
  v_tests := v_tests + 1;

  UPDATE public.kiosk_enrollment_sessions SET used_at = now()
   WHERE kiosk_device_id = v_dev AND used_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.kiosk_enrollment_sessions
    (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
  VALUES (v_org, v_dev, repeat('d',64), now() + interval '20 minutes', v_usr);
  v_tests := v_tests + 1;

  UPDATE public.kiosk_enrollment_sessions
     SET revoked_at = now(), failure_reason = 'revoked_by_admin'
   WHERE kiosk_device_id = v_dev AND used_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.kiosk_enrollment_sessions
    (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
  VALUES (v_org, v_dev, repeat('e',64), now() + interval '20 minutes', v_usr);
  v_tests := v_tests + 1;

  -- An expired-but-open session must be created as expired: the
  -- expiry_after_creation CHECK deliberately forbids moving expires_at
  -- backwards on an existing row, so expiry is simulated at insert time.
  UPDATE public.kiosk_enrollment_sessions
     SET revoked_at = now(), failure_reason = 'superseded'
   WHERE kiosk_device_id = v_dev AND used_at IS NULL AND revoked_at IS NULL;

  BEGIN
    UPDATE public.kiosk_enrollment_sessions
       SET expires_at = created_at - interval '1 minute'
     WHERE kiosk_device_id = v_dev AND token_hash = repeat('a',64);
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN v_blocked := true; END;
  ASSERT v_blocked, 'expires_at could be moved before created_at by UPDATE';
  v_tests := v_tests + 1;

  INSERT INTO public.kiosk_enrollment_sessions
    (organization_id, kiosk_device_id, token_hash, expires_at, created_by, created_at)
  VALUES (v_org, v_dev, repeat('x',64), now() - interval '30 minutes', v_usr,
          now() - interval '60 minutes');
  v_tests := v_tests + 1;

  ASSERT EXISTS (SELECT 1 FROM public.kiosk_enrollment_sessions
                 WHERE token_hash = repeat('x',64) AND expires_at < now()
                   AND used_at IS NULL AND revoked_at IS NULL),
    'expired-open fixture row was not created as expected';
  v_tests := v_tests + 1;

  BEGIN
    INSERT INTO public.kiosk_enrollment_sessions
      (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
    VALUES (v_org, v_dev, repeat('f',64), now() + interval '20 minutes', v_usr);
    v_blocked := false;
  EXCEPTION WHEN unique_violation THEN v_blocked := true; END;
  ASSERT v_blocked, 'expired-but-open session released the slot; documented rule changed';
  v_tests := v_tests + 1;

  UPDATE public.kiosk_enrollment_sessions
     SET revoked_at = now(), failure_reason = 'superseded'
   WHERE kiosk_device_id = v_dev AND used_at IS NULL AND revoked_at IS NULL;
  INSERT INTO public.kiosk_enrollment_sessions
    (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
  VALUES (v_org, v_dev, repeat('f',64), now() + interval '20 minutes', v_usr);
  v_tests := v_tests + 1;

  BEGIN
    INSERT INTO public.kiosk_enrollment_sessions
      (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
    VALUES (v_org, gen_random_uuid(), repeat('f',64), now() + interval '20 minutes', v_usr);
    v_blocked := false;
  EXCEPTION WHEN unique_violation THEN v_blocked := true; END;
  ASSERT v_blocked, 'duplicate token_hash accepted';
  v_tests := v_tests + 1;

  BEGIN
    INSERT INTO public.kiosk_enrollment_sessions
      (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
    VALUES (v_org, gen_random_uuid(), repeat('g',64), now() - interval '1 hour', v_usr);
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN v_blocked := true; END;
  ASSERT v_blocked, 'expires_at before created_at accepted';
  v_tests := v_tests + 1;

  BEGIN
    INSERT INTO public.kiosk_enrollment_sessions
      (organization_id, kiosk_device_id, token_hash, expires_at, created_by)
    VALUES (v_org, gen_random_uuid(), 'ABC123', now() + interval '20 minutes', v_usr);
    v_blocked := false;
  EXCEPTION WHEN check_violation THEN v_blocked := true; END;
  ASSERT v_blocked, 'short raw-token-shaped value accepted into token_hash';
  v_tests := v_tests + 1;

  RAISE NOTICE 'behavioural assertions passed: %', v_tests;
END $$;

ROLLBACK;

DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.kiosk_enrollment_sessions) = 0, 'test rows leaked';
  RAISE NOTICE 'kiosk_enrollment_sessions schema tests: ALL PASSED';
END $$;
