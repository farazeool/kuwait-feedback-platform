-- Kiosk heartbeats must advance inside a transaction. now() is transaction-
-- stable, so a retry heartbeat can otherwise retain the earlier timestamp.
-- Keep the existing RPC contract and security boundary unchanged.
create or replace function public.record_kiosk_heartbeat(
  p_raw_credential text,
  p_applied_mode text default null
) returns table (
  kiosk_device_id uuid,
  last_seen_at timestamptz,
  last_heartbeat_at timestamptz,
  applied_mode text,
  configuration_pending boolean
) language plpgsql volatile security definer
set search_path = public,
  pg_temp as $$
declare
  v_device_id uuid;
  v_now timestamptz := timezone('utc', clock_timestamp());
begin
  if p_applied_mode is not null
    and p_applied_mode not in (
      'active', 'paused', 'maintenance', 're_enrollment_required', 'revoked'
    ) then
    raise exception 'Unsupported kiosk operating mode'
      using errcode = 'invalid_parameter_value';
  end if;

  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  update public.kiosk_devices kd
  set last_seen_at = v_now,
    last_heartbeat_at = v_now,
    applied_mode = coalesce(p_applied_mode, kd.applied_mode),
    updated_at = v_now
  where kd.id = v_device_id;

  return query
  select kd.id,
    kd.last_seen_at,
    kd.last_heartbeat_at,
    kd.applied_mode,
    (kd.applied_config_version < kd.desired_config_version) as configuration_pending
  from public.kiosk_devices kd
  where kd.id = v_device_id;
end;
$$;

-- CREATE OR REPLACE preserves existing ACLs; reassert the deliberately narrow
-- service-role-only surface in case this migration is applied to a drifted DB.
revoke all on function public.record_kiosk_heartbeat(text, text)
  from public, anon, authenticated;
grant execute on function public.record_kiosk_heartbeat(text, text) to service_role;