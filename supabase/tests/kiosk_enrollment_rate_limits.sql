-- Schema and behavior tests for the durable kiosk enrollment rate limiter.
begin;
\set ON_ERROR_STOP on

do $$
declare
  v_hash text := repeat('a', 64);
  v_other_hash text := repeat('b', 64);
begin
  assert to_regclass('public.kiosk_enrollment_rate_limits') is not null,
    'rate limit table missing';
  assert (select relrowsecurity from pg_class where oid = 'public.kiosk_enrollment_rate_limits'::regclass),
    'RLS must be enabled';
  assert not has_table_privilege('anon', 'public.kiosk_enrollment_rate_limits', 'select'),
    'anon must not read limiter records';
  assert not has_table_privilege('authenticated', 'public.kiosk_enrollment_rate_limits', 'select'),
    'authenticated must not read limiter records';
  assert has_function_privilege('service_role', 'public.consume_kiosk_enrollment_rate_limit(text,text,integer,integer)', 'execute'),
    'service_role execute grant missing';
  assert not has_function_privilege('anon', 'public.consume_kiosk_enrollment_rate_limit(text,text,integer,integer)', 'execute'),
    'anon execute grant must be absent';
  assert not has_function_privilege('authenticated', 'public.consume_kiosk_enrollment_rate_limit(text,text,integer,integer)', 'execute'),
    'authenticated execute grant must be absent';

  perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
  execute 'set local role service_role';
  assert public.consume_kiosk_enrollment_rate_limit('kiosk-enroll', v_hash, 2, 300),
    'first attempt should pass';
  assert public.consume_kiosk_enrollment_rate_limit('kiosk-enroll', v_hash, 2, 300),
    'second attempt should pass';
  assert not public.consume_kiosk_enrollment_rate_limit('kiosk-enroll', v_hash, 2, 300),
    'third attempt should be blocked';
  assert public.consume_kiosk_enrollment_rate_limit('kiosk-enroll', v_other_hash, 2, 300),
    'different hashed key should have a separate limit';
end $$;

rollback;