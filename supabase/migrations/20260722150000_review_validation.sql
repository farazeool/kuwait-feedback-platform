-- Controlled record and review validation for Fresh Produce QA.
-- Forward-only additive migration.

-- ---------------------------------------------------------------------------
-- Response review timeline for immutable audit history
-- ---------------------------------------------------------------------------
create table public.response_review_audit (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  actor_id uuid not null references auth.users (id) on delete set null,
  previous_status public.response_workflow_status,
  new_status public.response_workflow_status not null,
  -- Controlled record details (required for controlled_investigation and immediate_escalation)
  controlled_record_type public.controlled_record_type,
  controlled_record_reference text check (controlled_record_reference is null or char_length(controlled_record_reference) between 1 and 200),
  controlled_record_reason text check (controlled_record_reason is null or char_length(controlled_record_reason) between 1 and 2000),
  -- Branch follow-up details
  follow_up_details text check (follow_up_details is null or char_length(follow_up_details) between 1 and 2000),
  -- Outcome summary (optional, for later filling)
  outcome_summary text check (outcome_summary is null or char_length(outcome_summary) <= 5000),
  recorded_at timestamptz not null default timezone('utc', now()),
  constraint response_review_audit_controlled_record_required check (
    (new_status in ('controlled_investigation', 'immediate_escalation') and controlled_record_type is not null and controlled_record_reference is not null and controlled_record_reason is not null)
    or (new_status not in ('controlled_investigation', 'immediate_escalation'))
  ),
  constraint response_review_audit_follow_up_details_required check (
    (new_status = 'branch_followup' and follow_up_details is not null)
    or (new_status <> 'branch_followup')
  )
);

alter table public.response_review_audit enable row level security;
alter table public.response_review_audit force row level security;

create policy response_review_audit_org_isolation
  on public.response_review_audit for all to authenticated
  using (public.can_read_organization(organization_id))
  with check (public.can_read_organization(organization_id));

create index response_review_audit_response_idx
  on public.response_review_audit (response_id, recorded_at desc);

create index response_review_audit_organization_idx
  on public.response_review_audit (organization_id, recorded_at desc);

grant select, insert on public.response_review_audit to authenticated;

-- ---------------------------------------------------------------------------
-- Update the workflow RPC with controlled-record and follow-up validation
-- ---------------------------------------------------------------------------
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

  -- Validate controlled record requirement for controlled_investigation and immediate_escalation
  if p_status in ('controlled_investigation', 'immediate_escalation') then
    if p_controlled_record_type is null then
      raise exception 'Controlled record type is required for %', p_status using errcode = '22023';
    end if;
    if p_controlled_record_reference is null or char_length(btrim(p_controlled_record_reference)) = 0 then
      raise exception 'Controlled record reference is required for %', p_status using errcode = '22023';
    end if;
    if p_controlled_record_reason is null or char_length(btrim(p_controlled_record_reason)) = 0 then
      raise exception 'Reason is required for %', p_status using errcode = '22023';
    end if;
  end if;

  -- Validate follow-up details for branch_followup
  if p_status = 'branch_followup' then
    if p_follow_up_details is null or char_length(btrim(p_follow_up_details)) = 0 then
      raise exception 'Follow-up details are required for branch follow-up' using errcode = '22023';
    end if;
  end if;

  -- Get actor ID for audit
  v_actor_id := auth.uid();

  -- Update the survey response
  update public.survey_responses set
    workflow_status = p_status,
    internal_tags = v_tags,
    assigned_to = p_assigned_to,
    reviewed_at = case when p_status = 'monitor_only' then null else coalesce(reviewed_at, timezone('utc', now())) end,
    resolved_at = case when p_status = 'immediate_escalation' then timezone('utc', now()) end,
    controlled_record_type = case when p_status in ('controlled_investigation', 'immediate_escalation') then p_controlled_record_type else controlled_record_type end,
    controlled_record_reference = case when p_status in ('controlled_investigation', 'immediate_escalation') then btrim(p_controlled_record_reference) else controlled_record_reference end,
    controlled_record_opened_by = case when p_status in ('controlled_investigation', 'immediate_escalation') and controlled_record_type is null then auth.uid()::text else controlled_record_opened_by end,
    controlled_record_status = case when p_status in ('controlled_investigation', 'immediate_escalation') and controlled_record_type is null then 'open' else controlled_record_status end,
    controlled_record_outcome_summary = case when p_outcome_summary is not null then btrim(p_outcome_summary) else controlled_record_outcome_summary end
  where id = p_response_id;

  -- Record in review audit (immutable trail)
  insert into public.response_review_audit (
    response_id, organization_id, actor_id,
    previous_status, new_status,
    controlled_record_type, controlled_record_reference, controlled_record_reason,
    follow_up_details, outcome_summary
  ) values (
    p_response_id, v_response.organization_id, v_actor_id,
    v_response.workflow_status, p_status,
    p_controlled_record_type, btrim(p_controlled_record_reference), btrim(p_controlled_record_reason),
    btrim(p_follow_up_details), btrim(p_outcome_summary)
  );

  if p_note is not null then
    insert into public.response_internal_notes (response_id, organization_id, author_id, note)
    values (p_response_id, v_response.organization_id, v_actor_id, btrim(p_note));
    insert into public.audit_logs (
      organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
    ) values (
      v_response.organization_id, v_actor_id, current_user, 'INSERT',
      'response_internal_notes', p_response_id,
      jsonb_build_object('note_added', true)
    );
  end if;
end;
$$;

revoke execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text, public.controlled_record_type, text, text, text, text) from public, anon;
grant execute on function public.update_response_workflow(uuid, public.response_workflow_status, uuid, text[], text, public.controlled_record_type, text, text, text, text) to authenticated;
