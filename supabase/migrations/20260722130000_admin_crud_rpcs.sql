-- Department and touchpoint CRUD RPCs
-- Forward-only additive migration.

create or replace function public.create_department(
  p_organization_id uuid,
  p_location_id uuid,
  p_name_en text,
  p_name_ar text,
  p_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.departments (organization_id, location_id, name_en, name_ar, slug, status)
  values (p_organization_id, p_location_id, p_name_en, p_name_ar, p_slug, 'active')
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_department(
  p_department_id uuid,
  p_organization_id uuid,
  p_location_id uuid,
  p_name_en text,
  p_name_ar text,
  p_slug text,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.departments
  set location_id = p_location_id,
      name_en = p_name_en,
      name_ar = p_name_ar,
      slug = p_slug,
      status = p_status::public.entity_status
  where id = p_department_id
    and organization_id = p_organization_id;
end;
$$;

create or replace function public.create_touchpoint(
  p_organization_id uuid,
  p_location_id uuid,
  p_department_id uuid,
  p_name_en text,
  p_name_ar text,
  p_slug text,
  p_channel public.response_channel,
  p_survey_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.touchpoints (organization_id, location_id, department_id, survey_id, name_en, name_ar, slug, channel, status, public_token)
  values (p_organization_id, p_location_id, p_department_id, p_survey_id, p_name_en, p_name_ar, p_slug, p_channel, 'active', encode(extensions.gen_random_bytes(16), 'hex'))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.update_touchpoint(
  p_touchpoint_id uuid,
  p_organization_id uuid,
  p_location_id uuid,
  p_department_id uuid,
  p_name_en text,
  p_name_ar text,
  p_slug text,
  p_channel public.response_channel,
  p_status text,
  p_survey_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.touchpoints
  set location_id = p_location_id,
      department_id = p_department_id,
      survey_id = p_survey_id,
      name_en = p_name_en,
      name_ar = p_name_ar,
      slug = p_slug,
      channel = p_channel,
      status = p_status::public.entity_status
  where id = p_touchpoint_id
    and organization_id = p_organization_id;
end;
$$;

create or replace function public.create_rating_scale(
  p_key text,
  p_name_en text,
  p_name_ar text,
  p_scale_min integer,
  p_scale_max integer,
  p_satisfied_min integer,
  p_negative_max integer
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := lower(btrim(p_key));
begin
  insert into public.rating_scales (key, name_en, name_ar, scale_min, scale_max, satisfied_min, negative_max, is_active)
  values (v_key, p_name_en, p_name_ar, p_scale_min, p_scale_max, p_satisfied_min, p_negative_max, true);
  return v_key;
end;
$$;

create or replace function public.update_rating_scale(
  p_key text,
  p_name_en text,
  p_name_ar text,
  p_scale_min integer,
  p_scale_max integer,
  p_satisfied_min integer,
  p_negative_max integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.rating_scales
  set name_en = p_name_en,
      name_ar = p_name_ar,
      scale_min = p_scale_min,
      scale_max = p_scale_max,
      satisfied_min = p_satisfied_min,
      negative_max = p_negative_max,
      is_active = p_is_active,
      updated_at = timezone('utc', now())
  where key = lower(btrim(p_key));
end;
$$;

revoke execute on function public.create_department(uuid, uuid, text, text, text) from public, anon;
grant execute on function public.create_department(uuid, uuid, text, text, text) to authenticated;

revoke execute on function public.update_department(uuid, uuid, uuid, text, text, text, text) from public, anon;
grant execute on function public.update_department(uuid, uuid, uuid, text, text, text, text) to authenticated;

revoke execute on function public.create_touchpoint(uuid, uuid, uuid, text, text, text, public.response_channel, uuid) from public, anon;
grant execute on function public.create_touchpoint(uuid, uuid, uuid, text, text, text, public.response_channel, uuid) to authenticated;

revoke execute on function public.update_touchpoint(uuid, uuid, uuid, uuid, text, text, text, public.response_channel, text, uuid) from public, anon;
grant execute on function public.update_touchpoint(uuid, uuid, uuid, uuid, text, text, text, public.response_channel, text, uuid) to authenticated;

revoke execute on function public.create_rating_scale(text, text, text, integer, integer, integer, integer) from public, anon;
grant execute on function public.create_rating_scale(text, text, text, integer, integer, integer, integer) to authenticated;

revoke execute on function public.update_rating_scale(text, text, text, integer, integer, integer, integer, boolean) from public, anon;
grant execute on function public.update_rating_scale(text, text, text, integer, integer, integer, integer, boolean) to authenticated;
