-- Corrective Actions Module
-- Forward-only additive migration for Fresh Produce QA corrective actions.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.corrective_action_status as enum (
  'draft',
  'open',
  'in_progress',
  'pending_verification',
  'verified',
  'effectiveness_review',
  'closed',
  'rejected'
);

create type public.corrective_action_priority as enum (
  'low',
  'medium',
  'high',
  'critical'
);

create type public.verification_status as enum (
  'pending',
  'accepted',
  'rejected',
  'more_evidence_required'
);

create type public.effectiveness_result as enum (
  'effective',
  'partially_effective',
  'not_effective'
);

create type public.closure_approval as enum (
  'pending',
  'approved',
  'rejected'
);

-- ---------------------------------------------------------------------------
-- Corrective Actions table
-- ---------------------------------------------------------------------------

create table public.corrective_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Core fields
  problem text not null check (char_length(btrim(problem)) between 1 and 5000),
  root_cause text not null check (char_length(btrim(root_cause)) between 1 and 5000),
  action_description text not null check (char_length(btrim(action_description)) between 1 and 5000),

  -- Classification
  priority public.corrective_action_priority not null default 'medium',
  status public.corrective_action_status not null default 'draft',

  -- Organizational scoping
  branch_id uuid references public.locations (id) on delete set null,
  department_id uuid references public.departments (id) on delete set null,

  -- Source linkage
  source_response_id uuid references public.survey_responses (id) on delete set null,
  related_alert_id uuid references public.alerts (id) on delete set null,
  controlled_record_reference text check (controlled_record_reference is null or char_length(btrim(controlled_record_reference)) between 1 and 200),

  -- Timeline
  due_date date not null,
  target_completion_date date not null,
  completion_date date,
  closure_date date,

  -- People
  assigned_owner_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,

  -- Verification & effectiveness
  verification_status public.verification_status default 'pending',
  verification_comments text check (verification_comments is null or char_length(btrim(verification_comments)) <= 2000),
  effectiveness_result public.effectiveness_result,
  effectiveness_review_date date,
  effectiveness_review_notes text check (effectiveness_review_notes is null or char_length(btrim(effectiveness_review_notes)) <= 2000),

  -- Closure
  closure_approval public.closure_approval default 'pending',
  closure_approved_by uuid references auth.users (id) on delete set null,
  closure_approved_at timestamptz,

  -- Audit
  internal_notes text check (internal_notes is null or char_length(btrim(internal_notes)) <= 5000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- Constraints
  constraint corrective_actions_timeline_check check (
    (target_completion_date >= due_date)
    and (completion_date is null or completion_date >= due_date)
    and (closure_date is null or closure_date >= coalesce(completion_date, due_date))
  ),
  constraint corrective_actions_closure_check check (
    (status <> 'closed' and closure_date is null and closure_approval = 'pending')
    or (status = 'closed' and closure_date is not null and closure_approval = 'approved')
  ),
  constraint corrective_actions_verification_check check (
    verification_status in ('pending', 'accepted', 'rejected', 'more_evidence_required')
  )
);

alter table public.corrective_actions enable row level security;
alter table public.corrective_actions force row level security;

create index corrective_actions_organization_idx on public.corrective_actions (organization_id, status, due_date);
create index corrective_actions_assigned_idx on public.corrective_actions (assigned_owner_id, status);
create index corrective_actions_source_idx on public.corrective_actions (source_response_id);
create index corrective_actions_alert_idx on public.corrective_actions (related_alert_id);
create index corrective_actions_branch_idx on public.corrective_actions (branch_id);
create index corrective_actions_department_idx on public.corrective_actions (department_id);

-- ---------------------------------------------------------------------------
-- RLS Policies for Corrective Actions
-- ---------------------------------------------------------------------------

-- Platform admin: all access
create policy corrective_actions_platform_admin_all
  on public.corrective_actions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Organization read: can_read_organization
create policy corrective_actions_read_permitted
  on public.corrective_actions for select to authenticated
  using (public.can_read_organization(organization_id));

-- Organization write: can_manage_organization + specific roles
create policy corrective_actions_write_permitted
  on public.corrective_actions for insert to authenticated
  with check (
    public.can_manage_organization(organization_id)
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = corrective_actions.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
    )
  );

-- Update: owners, assigned owners, quality managers, platform admins
create policy corrective_actions_update_permitted
  on public.corrective_actions for update to authenticated
  using (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or assigned_owner_id = auth.uid()
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = corrective_actions.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
    )
  ) with check (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or assigned_owner_id = auth.uid()
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = corrective_actions.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
    )
  );

-- Delete: platform admin only
create policy corrective_actions_delete_permitted
  on public.corrective_actions for delete to authenticated
  using (public.is_platform_admin());

grant select, insert, update, delete on public.corrective_actions to authenticated;

-- ---------------------------------------------------------------------------
-- Evidence Attachments
-- ---------------------------------------------------------------------------

create table public.corrective_action_attachments (
  id uuid primary key default gen_random_uuid(),
  corrective_action_id uuid not null references public.corrective_actions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 500),
  file_type text not null check (file_type in ('photo', 'pdf', 'checklist', 'training_record', 'maintenance_record', 'supplier_document', 'other')),
  description text check (description is null or char_length(btrim(description)) <= 500),

  uploaded_by uuid not null references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),

  verification_status public.verification_status default 'pending',
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  verification_comments text check (verification_comments is null or char_length(btrim(verification_comments)) <= 1000)
);

alter table public.corrective_action_attachments enable row level security;
alter table public.corrective_action_attachments force row level security;

create index ca_attachments_action_idx on public.corrective_action_attachments (corrective_action_id, uploaded_at desc);

create policy ca_attachments_platform_admin_all
  on public.corrective_action_attachments for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy ca_attachments_read_permitted
  on public.corrective_action_attachments for select to authenticated
  using (public.can_read_organization(organization_id));

create policy ca_attachments_write_permitted
  on public.corrective_action_attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.corrective_actions ca
      where ca.id = corrective_action_attachments.corrective_action_id
        and (
          public.can_manage_organization(ca.organization_id)
          or ca.assigned_owner_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = ca.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

grant select, insert, update on public.corrective_action_attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Status History (immutable audit trail)
-- ---------------------------------------------------------------------------

create table public.corrective_action_status_history (
  id uuid primary key default gen_random_uuid(),
  corrective_action_id uuid not null references public.corrective_actions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  previous_status public.corrective_action_status,
  new_status public.corrective_action_status not null,

  changed_by uuid not null references auth.users (id) on delete set null,
  changed_at timestamptz not null default timezone('utc', now()),
  change_reason text check (change_reason is null or char_length(btrim(change_reason)) <= 500)
);

alter table public.corrective_action_status_history enable row level security;
alter table public.corrective_action_status_history force row level security;

create index ca_status_history_action_idx on public.corrective_action_status_history (corrective_action_id, changed_at desc);

create policy ca_status_history_platform_admin_all
  on public.corrective_action_status_history for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy ca_status_history_read_permitted
  on public.corrective_action_status_history for select to authenticated
  using (public.can_read_organization(organization_id));

create policy ca_status_history_insert_permitted
  on public.corrective_action_status_history for insert to authenticated
  with check (
    exists (
      select 1 from public.corrective_actions ca
      where ca.id = corrective_action_status_history.corrective_action_id
        and public.can_read_organization(ca.organization_id)
    )
  );

grant select, insert on public.corrective_action_status_history to authenticated;

-- ---------------------------------------------------------------------------
-- Comments / Timeline
-- ---------------------------------------------------------------------------

create table public.corrective_action_comments (
  id uuid primary key default gen_random_uuid(),
  corrective_action_id uuid not null references public.corrective_actions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  author_id uuid not null references auth.users (id) on delete set null,
  comment text not null check (char_length(btrim(comment)) between 1 and 5000),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.corrective_action_comments enable row level security;
alter table public.corrective_action_comments force row level security;

create index ca_comments_action_idx on public.corrective_action_comments (corrective_action_id, created_at desc);

create policy ca_comments_platform_admin_all
  on public.corrective_action_comments for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy ca_comments_read_permitted
  on public.corrective_action_comments for select to authenticated
  using (public.can_read_organization(organization_id));

create policy ca_comments_write_permitted
  on public.corrective_action_comments for insert to authenticated
  with check (
    exists (
      select 1 from public.corrective_actions ca
      where ca.id = corrective_action_comments.corrective_action_id
        and public.can_read_organization(ca.organization_id)
    )
  );

grant select, insert on public.corrective_action_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Updated At Trigger
-- ---------------------------------------------------------------------------

create trigger corrective_actions_set_updated_at
  before update on public.corrective_actions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit Trigger (logs status changes to audit_logs)
-- ---------------------------------------------------------------------------

create function public.write_corrective_action_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.audit_logs (
      organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
    ) values (
      new.organization_id, auth.uid(), current_user, 'UPDATE', 'corrective_actions', new.id,
      jsonb_build_object(
        'old', jsonb_build_object(
          'status', old.status,
          'verification_status', old.verification_status,
          'effectiveness_result', old.effectiveness_result,
          'closure_approval', old.closure_approval
        ),
        'new', jsonb_build_object(
          'status', new.status,
          'verification_status', new.verification_status,
          'effectiveness_result', new.effectiveness_result,
          'closure_approval', new.closure_approval
        )
      )
    );
  end if;
  return new;
end;
$$;

create trigger corrective_actions_audit
  after update on public.corrective_actions
  for each row execute function public.write_corrective_action_audit();

-- ---------------------------------------------------------------------------
-- Status History Trigger (auto-populates history on status change)
-- ---------------------------------------------------------------------------

create function public.write_corrective_action_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.corrective_action_status_history (
      corrective_action_id, organization_id, previous_status, new_status, changed_by, change_reason
    ) values (
      new.id, new.organization_id, old.status, new.status, auth.uid(),
      null -- change_reason could be passed via application context
    );
  end if;
  return new;
end;
$$;

create trigger corrective_actions_status_history
  after update on public.corrective_actions
  for each row execute function public.write_corrective_action_status_history();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.corrective_actions to authenticated;
grant select, insert, update on public.corrective_action_attachments to authenticated;
grant select, insert on public.corrective_action_status_history to authenticated;
grant select, insert on public.corrective_action_comments to authenticated;