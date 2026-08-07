-- CX Channels Integrity Fix — constraint hardening, trigger validation, audit corrector
-- Forward-only additive migration. Depends on 20260725200000.

-- ==============================================================================
-- 1. Fix distribution_assignments CHECK constraint: =1 → ≤1
--    Allows 0 targets for orphaned historical records after target entity deletion.
-- ==============================================================================

alter table public.distribution_assignments
  drop constraint if exists da_single_target_check;

alter table public.distribution_assignments
  add constraint da_single_target_check check (
    (assigned_employee_id is not null)::integer
    + (assigned_location_id is not null)::integer
    + (assigned_touchpoint_id is not null)::integer
    <= 1
  );

-- ==============================================================================
-- 2. BEFORE trigger: validate assignment target count based on status
--    - ACTIVE assignments must have exactly 1 target
--    - Inactive assignments may have 0 or 1
--    - If target count drops to 0 (from ON DELETE SET NULL), auto-revoke
-- ==============================================================================

create or replace function public.validate_distribution_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_count integer;
begin
  v_target_count := (new.assigned_employee_id is not null)::integer
                  + (new.assigned_location_id is not null)::integer
                  + (new.assigned_touchpoint_id is not null)::integer;

  -- Never allow more than one target
  if v_target_count > 1 then
    raise exception 'Distribution assignment cannot have multiple targets' using errcode = '22023';
  end if;

  -- Active assignments must have exactly one target
  if new.status = 'active' and v_target_count != 1 then
    -- If the target was just removed by ON DELETE SET NULL, auto-revoke instead of error
    if tg_op = 'UPDATE' then
      new.status := 'revoked';
    else
      raise exception 'Active distribution assignments must have exactly one target (employee, location, or touchpoint)' using errcode = '22023';
    end if;
  end if;

  return new;
end;
$$;

create trigger distribution_assignments_validate
  before insert or update on public.distribution_assignments
  for each row execute function public.validate_distribution_assignment();

comment on function public.validate_distribution_assignment is
  'Ensures active assignments have exactly one target; auto-revokes orphans when FK targets are deleted.';

-- ==============================================================================
-- 3. Fix distribution_link_events.assignment_id: allow NULL for invalid_token events
--    The column has NOT NULL + ON DELETE CASCADE, but invalid_token events
--    intentionally insert NULL. Remove NOT NULL, keep ON DELETE CASCADE with
--    a conditional check.
-- ==============================================================================

-- Remove NOT NULL from assignment_id
alter table public.distribution_link_events
  alter column assignment_id drop not null;

-- Add a CHECK to ensure: assignment_id is NOT NULL for all event types except invalid_token
alter table public.distribution_link_events
  add constraint dle_assignment_id_required check (
    (event_type = 'invalid_token' and assignment_id is null)
    or (event_type != 'invalid_token' and assignment_id is not null)
  );

comment on column public.distribution_link_events.assignment_id is
  'FK to distribution_assignments. NULL only for invalid_token events where no assignment matched.';

-- ==============================================================================
-- 4. Fix audit trigger: detect table name and build correct shape per table
--    Also reduce noise by only logging meaningful state changes.
-- ==============================================================================

drop trigger if exists distribution_templates_audit on public.distribution_templates;
drop trigger if exists distribution_assignments_audit on public.distribution_assignments;
drop function if exists public.write_distribution_audit();

create or replace function public.write_distribution_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_table_name text;
  v_diff jsonb;
  v_organization_id uuid;
  v_record_id uuid;
begin
  v_table_name := tg_table_name;

  -- Determine organization_id and record_id based on operation
  if tg_op in ('INSERT', 'UPDATE') then
    v_organization_id := new.organization_id;
    v_record_id := new.id;
  else
    v_organization_id := old.organization_id;
    v_record_id := old.id;
  end if;

  -- Build column list per table
  if v_table_name = 'distribution_templates' then
    if tg_op = 'INSERT' then
      v_diff := jsonb_build_object(
        'channel', new.channel,
        'template_name', new.template_name,
        'is_active', new.is_active,
        'is_default', new.is_default
      );
    elsif tg_op = 'UPDATE' then
      -- Only log if meaningful columns changed
      if old.template_name is distinct from new.template_name
        or old.is_active is distinct from new.is_active
        or old.is_default is distinct from new.is_default
        or old.channel is distinct from new.channel
        or old.render_config is distinct from new.render_config
      then
        v_diff := jsonb_build_object(
          'old', jsonb_strip_nulls(jsonb_build_object(
            'template_name', old.template_name,
            'channel', old.channel,
            'is_active', old.is_active,
            'is_default', old.is_default
          )),
          'new', jsonb_strip_nulls(jsonb_build_object(
            'template_name', new.template_name,
            'channel', new.channel,
            'is_active', new.is_active,
            'is_default', new.is_default
          ))
        );
      else
        return null; -- Skip trivial updates (e.g., updated_at only)
      end if;
    else -- DELETE
      v_diff := jsonb_build_object(
        'id', old.id,
        'template_name', old.template_name,
        'channel', old.channel,
        'is_active', old.is_active
      );
    end if;

  elsif v_table_name = 'distribution_assignments' then
    if tg_op = 'INSERT' then
      v_diff := jsonb_build_object(
        'template_id', new.template_id,
        'survey_id', new.survey_id,
        'campaign_id', new.campaign_id,
        'public_token_prefix', left(new.public_token, 12),
        'status', new.status,
        'target_type', case
          when new.assigned_employee_id is not null then 'employee'
          when new.assigned_location_id is not null then 'location'
          when new.assigned_touchpoint_id is not null then 'touchpoint'
          else 'none'
        end
      );
    elsif tg_op = 'UPDATE' then
      -- Only log status or target changes
      if old.status is distinct from new.status
        or old.assigned_employee_id is distinct from new.assigned_employee_id
        or old.assigned_location_id is distinct from new.assigned_location_id
        or old.assigned_touchpoint_id is distinct from new.assigned_touchpoint_id
      then
        v_diff := jsonb_build_object(
          'old', jsonb_strip_nulls(jsonb_build_object(
            'status', old.status,
            'target_type', case
              when old.assigned_employee_id is not null then 'employee'
              when old.assigned_location_id is not null then 'location'
              when old.assigned_touchpoint_id is not null then 'touchpoint'
              else 'none'
            end
          )),
          'new', jsonb_strip_nulls(jsonb_build_object(
            'status', new.status,
            'target_type', case
              when new.assigned_employee_id is not null then 'employee'
              when new.assigned_location_id is not null then 'location'
              when new.assigned_touchpoint_id is not null then 'touchpoint'
              else 'none'
            end
          ))
        );
      else
        return null; -- Skip trivial updates
      end if;
    else -- DELETE
      v_diff := jsonb_build_object(
        'id', old.id,
        'public_token_prefix', left(old.public_token, 12),
        'status', old.status
      );
    end if;
  end if;

  if v_diff is null then
    return coalesce(new, old);
  end if;

  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    v_organization_id,
    auth.uid(),
    current_user,
    tg_op,
    v_table_name,
    v_record_id,
    v_diff
  );

  return coalesce(new, old);
end;
$$;

create trigger distribution_templates_audit
  after insert or update or delete on public.distribution_templates
  for each row execute function public.write_distribution_audit();

create trigger distribution_assignments_audit
  after insert or update or delete on public.distribution_assignments
  for each row execute function public.write_distribution_audit();

comment on function public.write_distribution_audit is
  'Table-aware audit logger for distribution_templates and distribution_assignments. Skips trivial updated_at-only changes.';

-- ==============================================================================
-- 5. Index for time-range queries on distribution_link_events
-- ==============================================================================

create index dle_org_created_idx
  on public.distribution_link_events (organization_id, created_at desc);

-- ==============================================================================
-- 6. Grants for new/changed functions
-- ==============================================================================

-- The validate trigger is SECURITY DEFINER but runs inside triggers so no grant needed.
-- The audit trigger runs inside triggers so no grant needed.

-- ==============================================================================
-- 7. Comments
-- ==============================================================================

comment on constraint da_single_target_check on public.distribution_assignments is
  'Allows 0 targets (historical orphan after entity deletion) or 1 target (valid assignment). The BEFORE trigger enforces status-aware validation.';

comment on constraint dle_assignment_id_required on public.distribution_link_events is
  'assignment_id is null only for invalid_token events. All other event types require a valid FK.';
