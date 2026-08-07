-- Migration: Update list_kiosk_devices RPC with activation fields
-- This RPC returns kiosk devices with activation status, survey, and location details
-- Must drop the old version first to avoid ambiguity with the 3-parameter overload

drop function if exists list_kiosk_devices(uuid);
drop function if exists list_kiosk_devices(uuid, uuid, kiosk_status);

create or replace function list_kiosk_devices(p_organization_id uuid)
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
  from kiosk_devices kd
  left join surveys s on s.id = kd.survey_id
  left join locations l on l.id = kd.location_id
  where kd.organization_id = p_organization_id
    and kd.status != 'archived'
  order by kd.created_at desc;
end;
$$;

grant execute on function list_kiosk_devices(uuid) to authenticated;