-- Durable, additive rate limiting for the kiosk enrollment HTTP boundary.
-- The application passes SHA-256 digests only: no IP address, token, or credential
-- is persisted by this facility.
create table if not exists public.kiosk_enrollment_rate_limits (
  scope text not null,
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null,
  attempts integer not null check (attempts >= 1),
  primary key (scope, key_hash)
);

alter table public.kiosk_enrollment_rate_limits enable row level security;

create or replace function public.consume_kiosk_enrollment_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_allowed boolean := false;
begin
  if auth.role() <> 'service_role'
     or p_scope !~ '^[a-z0-9_.-]{1,80}$'
     or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_limit > 1000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    return false;
  end if;

  insert into public.kiosk_enrollment_rate_limits as limiter
    (scope, key_hash, window_started_at, attempts)
  values (p_scope, p_key_hash, v_now, 1)
  on conflict (scope, key_hash) do update
    set window_started_at = case
          when limiter.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then v_now else limiter.window_started_at end,
        attempts = case
          when limiter.window_started_at <= v_now - make_interval(secs => p_window_seconds)
          then 1 else limiter.attempts + 1 end
  returning attempts <= p_limit into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on table public.kiosk_enrollment_rate_limits from anon, authenticated;
revoke all on function public.consume_kiosk_enrollment_rate_limit(text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_kiosk_enrollment_rate_limit(text, text, integer, integer) to service_role;