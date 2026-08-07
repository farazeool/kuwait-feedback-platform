-- Fix bulk_create_distribution_assignments: ON CONFLICT referenced a CHECK
-- constraint (da_single_target_check) instead of a unique index, causing
-- PostgreSQL error 42809 at runtime.
--
-- The intent was to skip duplicate assignments for the same employee+template.
-- Fix: add a partial unique index on (template_id, assigned_employee_id) where
-- assigned_employee_id is not null, and replace the ON CONFLICT clause.
-- Also add a similar index for location-based assignments.
-- Remove the broken ON CONFLICT ON CONSTRAINT clause, replacing it with
-- a proper ON CONFLICT ON CONSTRAINT that references the new unique index.

-- Add partial unique indexes for conflict detection
create unique index if not exists da_template_employee_unique
  on public.distribution_assignments (template_id, assigned_employee_id)
  where assigned_employee_id is not null;

create unique index if not exists da_template_location_unique
  on public.distribution_assignments (template_id, assigned_location_id)
  where assigned_location_id is not null;

-- Fix: replace the broken constraint reference
create or replace function public.bulk_create_distribution_assignments(
  p_organization_id uuid,
  p_template_id uuid,
  p_survey_id uuid,
  p_campaign_id uuid default null,
  p_employee_ids uuid[] default array[]::uuid[],
  p_location_ids uuid[] default array[]::uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_employee_id uuid;
  v_location_id uuid;
begin
  if not public.can_manage_organization(p_organization_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  if array_length(p_employee_ids, 1) > 0 then
    foreach v_employee_id in array p_employee_ids
    loop
      select lm.location_id into v_location_id
      from public.location_memberships lm
      where lm.user_id = v_employee_id
        and lm.status = 'active'
      limit 1;

      if v_location_id is null then
        v_location_id := p_location_ids[1];
      end if;

      if v_location_id is not null then
        insert into public.distribution_assignments (
          organization_id, template_id, survey_id, campaign_id,
          assigned_employee_id, assigned_location_id, status, created_by
        ) values (
          p_organization_id, p_template_id, p_survey_id, p_campaign_id,
          v_employee_id, v_location_id, 'active', auth.uid()
        )
        on conflict (template_id, assigned_employee_id)
          where assigned_employee_id is not null
        do nothing;
        v_count := v_count + 1;
      end if;
    end loop;
  end if;

  if array_length(p_location_ids, 1) > 0 then
    foreach v_location_id in array p_location_ids
    loop
      insert into public.distribution_assignments (
        organization_id, template_id, survey_id, campaign_id,
        assigned_location_id, status, created_by
      ) values (
        p_organization_id, p_template_id, p_survey_id, p_campaign_id,
        v_location_id, 'active', auth.uid()
      )
      on conflict (template_id, assigned_location_id)
        where assigned_location_id is not null
      do nothing;
      v_count := v_count + 1;
    end loop;
  end if;

  return v_count;
end;
$$;

-- Re-grant to authenticated
revoke execute on function public.bulk_create_distribution_assignments(
  uuid, uuid, uuid, uuid, uuid[], uuid[]
) from public, anon;
grant execute on function public.bulk_create_distribution_assignments(
  uuid, uuid, uuid, uuid, uuid[], uuid[]
) to authenticated;
