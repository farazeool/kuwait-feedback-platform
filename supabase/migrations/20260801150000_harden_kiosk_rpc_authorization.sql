-- Harden kiosk RPC authorization before the production deployment.
--
-- Two defects are corrected here, both additive. No earlier migration is edited.
--
-- Defect 1 -- admin RPCs are reachable by `anon`.
--   Migration 20260801090000 section 15 states the intent by granting the
--   administrative kiosk RPCs to `authenticated` only. That grant does not
--   achieve exclusivity: a Supabase project ships with
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS
--       TO postgres, anon, authenticated, service_role;
--   so every newly created function is ALSO granted to `anon` automatically.
--   Adding a GRANT never removes that. Only an explicit REVOKE does, which is
--   why regenerate_activation_code (hardened in 20260801100000) is currently
--   the one admin RPC `anon` cannot reach.
--
--   These functions all gate on auth.uid(), so an anon caller gets
--   'Not authorized' rather than data. The exposure is therefore an
--   unauthenticated error oracle plus needless attack surface -- except for
--   generate_activation_code(), which performs NO authorization check and
--   hands the caller a code/hash pair. Anon must not reach that at all.
--
-- Defect 2 -- list_kiosk_devices is SECURITY DEFINER with no search_path.
--   Every other SECURITY DEFINER kiosk function pins `SET search_path`.
--   20260801093000 recreated list_kiosk_devices without it, leaving the one
--   definer-rights function in the kiosk surface open to search_path
--   manipulation. Recreated below, unchanged except for the pinned path.

-- =====================================================
-- 1. Pin search_path on list_kiosk_devices
-- =====================================================
-- Body is identical to 20260801093000; only `set search_path = public` is
-- added. CREATE OR REPLACE preserves existing grants, which section 2 then
-- corrects.

create or replace function public.list_kiosk_devices(p_organization_id uuid)
returns table (
  id uuid,
  device_name text,
  device_identifier text,
  status text,
  activation_status text,
  survey_id uuid,
  survey_title_en text,
  survey_title_ar text,
  location_id uuid,
  location_name_en text,
  location_name_ar text,
  last_seen_at timestamptz,
  activated_at timestamptz,
  last_response_at timestamptz,
  total_responses bigint,
  created_at timestamptz,
  has_activation_code boolean,
  activation_code_expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Authorization check: caller must have access to the requested organization
  if not exists (
    select 1 from public.organization_memberships om
    where om.organization_id = p_organization_id
      and om.user_id = auth.uid()
      and om.status = 'active'
  ) then
    raise exception 'Not authorized to access organization %', p_organization_id;
  end if;

  return query
  select
    kd.id,
    kd.device_name,
    kd.device_identifier,
    kd.status::text,
    case
      when kd.device_credential_hash is null then 'pending_activation'::text
      else 'activated'::text
    end as activation_status,
    kd.survey_id,
    s.title_en,
    s.title_ar,
    kd.location_id,
    l.name_en,
    l.name_ar,
    kd.last_seen_at,
    kd.activated_at,
    kd.last_response_at,
    kd.total_responses::bigint as total_responses,
    kd.created_at,
    kd.activation_code_hash is not null as has_activation_code,
    kd.activation_code_expires_at
  from public.kiosk_devices kd
  left join public.surveys s on s.id = kd.survey_id
  left join public.locations l on l.id = kd.location_id
  where kd.organization_id = p_organization_id
    and kd.status != 'archived'
  order by kd.created_at desc;
end;
$$;

-- =====================================================
-- 2. Make the administrative RPCs authenticated-only
-- =====================================================
-- Each function: drop the implicit PUBLIC grant, drop the default anon grant,
-- then (re)assert the intended authenticated grant.
--
-- service_role is unaffected: Supabase grants it directly, not via PUBLIC or
-- anon, so server-side calls using the service key continue to work.

-- generate_activation_code -- no internal authorization check; anon must not
-- be able to mint activation codes.
revoke all on function public.generate_activation_code() from public;
revoke all on function public.generate_activation_code() from anon;
grant execute on function public.generate_activation_code() to authenticated;

revoke all on function public.generate_kiosk_access_token() from public;
revoke all on function public.generate_kiosk_access_token() from anon;
grant execute on function public.generate_kiosk_access_token() to authenticated;

revoke all on function public.create_kiosk_device(uuid, uuid, text, text, uuid, text) from public;
revoke all on function public.create_kiosk_device(uuid, uuid, text, text, uuid, text) from anon;
grant execute on function public.create_kiosk_device(uuid, uuid, text, text, uuid, text) to authenticated;

revoke all on function public.update_kiosk_device(uuid, text, uuid, public.kiosk_status, text, text, text, jsonb, integer, boolean) from public;
revoke all on function public.update_kiosk_device(uuid, text, uuid, public.kiosk_status, text, text, text, jsonb, integer, boolean) from anon;
grant execute on function public.update_kiosk_device(uuid, text, uuid, public.kiosk_status, text, text, text, jsonb, integer, boolean) to authenticated;

revoke all on function public.list_kiosk_devices(uuid) from public;
revoke all on function public.list_kiosk_devices(uuid) from anon;
grant execute on function public.list_kiosk_devices(uuid) to authenticated;

revoke all on function public.get_kiosk_activation_details(uuid, uuid) from public;
revoke all on function public.get_kiosk_activation_details(uuid, uuid) from anon;
grant execute on function public.get_kiosk_activation_details(uuid, uuid) to authenticated;

revoke all on function public.revoke_kiosk_credential(uuid, uuid) from public;
revoke all on function public.revoke_kiosk_credential(uuid, uuid) from anon;
grant execute on function public.revoke_kiosk_credential(uuid, uuid) to authenticated;

revoke all on function public.reenroll_kiosk_device(uuid, uuid) from public;
revoke all on function public.reenroll_kiosk_device(uuid, uuid) from anon;
grant execute on function public.reenroll_kiosk_device(uuid, uuid) to authenticated;

-- =====================================================
-- 3. Device-facing RPCs intentionally remain anon-callable
-- =====================================================
-- Kiosk hardware holds a device credential, not a user session, so these must
-- stay reachable by anon. They are token-scoped and self-authorizing, and
-- supabase/tests/kiosk_authorization.sql pins their lifecycle gating:
--   get_kiosk_config(text)
--   update_kiosk_heartbeat(text, text, text, text)
--   record_kiosk_response(text)
--   resolve_kiosk_attribution(text)
--   activate_kiosk_device(text, text, text, text)
--   hash_credential(text)          -- pure SHA-256, no data access
--   is_kiosk_online(timestamptz, integer)  -- pure, not SECURITY DEFINER
