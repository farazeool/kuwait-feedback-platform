-- Phase 8: Review Workflow Fixes - Add reason requirement for all outcomes
-- Forward-only additive migration.

-- Add reason field to update_response_workflow for audit trail
-- Note: The existing function signature is:
-- update_response_workflow(p_response_id, p_status, p_assigned_to, p_tags, p_note, p_controlled_record_type, p_controlled_record_reference, p_controlled_record_reason, p_follow_up_details, p_outcome_summary)
-- p_controlled_record_reason covers controlled_investigation/immediate_escalation
-- p_follow_up_details covers branch_followup
-- We need to add a general 'reason' field for monitor_only as well.

-- Create a new overloaded version that accepts a general reason parameter
create or replace function public.update_response_workflow(
  p_response_id uuid,
  p_status public.response_workflow_status,
  p_assigned_to uuid default null,
  p_tags text[] default array[]::text[],
  p_note text default null,
  p_controlled_record_type public.controlled_record_type default null,
  p_controlled_record_reference text default null,
  p_controlled_record_reason text default null,
  p_follow_up_details text default null,
  p_outcome_summary text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_response public.survey_responses%rowtype;
  v_tags text[];
  v_actor_id uuid;
begin
  select * into v_response from public.survey_responses sr
  where sr.id = p_response_id and public.can_manage_response(sr.id) for update;
  if not found then raise exception 'Response workflow access denied' using errcode = '42501'; end if;
  if p_assigned_to is not null and not public.user_can_access_location(p_assigned_to, v_response.location_id) then
    raise exception 'Assignee cannot access this location' using errcode = '22023';
  end if;
  select coalesce(array_agg(tag order by tag), array[]::text[]) into v_tags
  from (select distinct btrim(value) tag from unnest(coalesce(p_tags, array[]::text[])) value
        where char_length(btrim(value)) between 1 and 40 and value !~ '[[:cntrl:]]') clean;
  if cardinality(v_tags) > 20 or cardinality(v_tags) <> cardinality(coalesce(p_tags, array[]::text[])) then
    raise exception 'Tags are invalid or duplicated' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) not between 1 and 2000 then
    raise exception 'Internal note is invalid' using errcode = '22023';
  end if;

  -- Phase 8: REQUIRE reason for ALL outcomes
  -- monitor_only: requires reason
  if p_status = 'monitor_only' and (p_controlled_record_reason is null or char_length(btrim(p_controlled_record_reason)) = 0) then
    raise exception 'Reason is required for monitor_only review outcome' using errcode = '22023';
  end if;

  -- branch_followup: requires follow_up_details
  if p_status = 'branch_followup' and (p_follow_up_details is null or char_length(btrim(p_follow_up_details)) = 0) then
    raise exception 'Follow-up details are required for branch follow-up' using errcode = '22023';
  end if;

  -- controlled_investigation: requires type, reference, reason
  if p_status = 'controlled_investigation' then
    if p_controlled_record_type is null then
      raise exception 'Controlled record type is required for controlled investigation' using errcode = '22023';
    end if;
    if p_controlled_record_reference is null or char_length(btrim(p_controlled_record_reference)) = 0 then
      raise exception 'Controlled record reference is required' using errcode = '22023';
    end if;
    if p_controlled_record_reason is null or char_length(btrim(p_controlled_record_reason)) = 0 then
      raise exception 'Reason is required for controlled investigation' using errcode = '22023';
    end if;
  end if;

  -- immediate_escalation: requires type, reference, reason
  if p_status = 'immediate_escalation' then
    if p_controlled_record_type is null then
      raise exception 'Controlled record type is required for immediate escalation' using errcode = '22023';
    end if;
    if p_controlled_record_reference is null or char_length(btrim(p_controlled_record_reference)) = 0 then
      raise exception 'Controlled record reference is required' using errcode = '22023';
    end if;
    if p_controlled_record_reason is null or char_length(btrim(p_controlled_record_reason)) = 0 then
      raise exception 'Reason is required for immediate escalation' using errcode = '22023';
    end if;
  end if;

  -- Get actor ID
  v_actor_id := auth.uid();

  -- Update the workflow
  update public.survey_responses set
    workflow_status = p_status,
    internal_tags = v_tags,
    assigned_to = p_assigned_to,
    reviewed_at = case when p_status != 'monitor_only' then coalesce(reviewed_at, timezone('utc', now())) else reviewed_at end,
    resolved_at = case when p_status = 'immediate_escalation' then timezone('utc', now()) else resolved_at end
  where id = p_response_id;

  -- Record status history for audit trail
  if v_response.workflow_status is distinct from p_status then
    insert into public.response_status_history (
      response_id, organization_id, actor_id, previous_status, new_status, reason
    ) values (
      p_response_id, v_response.organization_id, v_actor_id,
      v_response.workflow_status, p_status,
      case when p_controlled_record_reason is not null then btrim(p_controlled_record_reason)
           when p_follow_up_details is not null then btrim(p_follow_up_details)
           else null end
    );
  end if;

  -- Add internal note
  if p_note is not null then
    insert into public.response_internal_notes (response_id, organization_id, author_id, note)
    values (p_response_id, v_response.organization_id, v_actor_id, btrim(p_note));
  end if;
end;
$$;

-- Ensure the function permissions are set correctly
grant execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text, public.controlled_record_type, text, text, text, text) to authenticated;

-- Add response_status_history table if it doesn't exist
do $$
begin
  create table if not exists public.response_status_history (
    id uuid primary key default gen_random_uuid(),
    response_id uuid not null references public.survey_responses (id) on delete cascade,
    organization_id uuid not null references public.organizations (id) on delete cascade,
    actor_id uuid not null references auth.users (id) on delete set null,
    previous_status public.response_workflow_status,
    new_status public.response_workflow_status not null,
    reason text check (reason is null or char_length(btrim(reason)) <= 2000),
    created_at timestamptz not null default timezone('utc', now())
  );

  -- RLS policies
  if not exists (select 1 from pg_policies where policyname = 'response_status_history_org_scope') then
    alter table public.response_status_history enable row level security;
    create policy response_status_history_org_scope
      on public.response_status_history for all to authenticated
      using (
        public.can_read_organization(organization_id) or
        public.is_platform_admin()
      ) with check (
        public.can_manage_organization(organization_id) or
        public.is_platform_admin()
      );
  end if;

  -- Index
  create index if not exists idx_response_status_history_response
    on public.response_status_history (response_id, created_at desc);
end
$$;