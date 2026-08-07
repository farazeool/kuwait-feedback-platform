-- Investigation Workspace Module
-- Forward-only additive migration for Fresh Produce QA investigations.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.investigation_status as enum (
  'draft',
  'active',
  'waiting_verification',
  'closed'
);

create type public.escalation_decision as enum (
  'none',
  'quality_manager',
  'senior_management',
  'platform_admin'
);

-- ---------------------------------------------------------------------------
-- Investigations table
-- ---------------------------------------------------------------------------

create table public.investigations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Core fields
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text check (description is null or char_length(btrim(description)) <= 5000),

  -- Organizational scoping
  branch_id uuid not null references public.locations (id) on delete restrict,
  department_id uuid references public.departments (id) on delete set null,

  -- Product information
  product_id uuid,
  product_category_id uuid references public.concern_categories (id) on delete set null,
  product_name text check (product_name is null or char_length(btrim(product_name)) between 1 and 200),

  -- Investigation timing
  investigated_at timestamptz not null,

  -- People
  investigator_id uuid not null references auth.users (id) on delete restrict,
  created_by uuid not null references auth.users (id) on delete restrict,

  -- Evidence and records
  evidence_reviewed text check (evidence_reviewed is null or char_length(btrim(evidence_reviewed)) <= 5000),
  repeated_complaints boolean not null default false,
  repeated_complaints_notes text check (repeated_complaints_notes is null or char_length(btrim(repeated_complaints_notes)) <= 2000),
  
  -- JSON records for various data types
  temperature_records jsonb not null default '[]'::jsonb,
  receiving_records jsonb not null default '[]'::jsonb,
  inspection_records jsonb not null default '[]'::jsonb,
  supplier_information jsonb not null default '{}'::jsonb,

  -- Analysis
  root_cause text check (root_cause is null or char_length(btrim(root_cause)) <= 5000),
  findings text check (findings is null or char_length(btrim(findings)) <= 5000),
  recommendation text check (recommendation is null or char_length(btrim(recommendation)) <= 5000),

  -- Decision and status
  escalation_decision public.escalation_decision not null default 'none',
  status public.investigation_status not null default 'draft',

  -- Controlled record references
  controlled_record_references text[] not null default array[]::text[],

  -- Timeline (JSON array of events)
  timeline jsonb not null default '[]'::jsonb,

  -- Audit
  internal_notes text check (internal_notes is null or char_length(btrim(internal_notes)) <= 5000),
  closed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  -- Constraints
  constraint investigations_branch_organization_fkey
    foreign key (branch_id, organization_id)
    references public.locations (id, organization_id)
    on delete restrict,
  constraint investigations_closed_at_check check (
    (status = 'closed' and closed_at is not null)
    or (status <> 'closed' and closed_at is null)
  ),
  constraint investigations_controlled_references_check check (
    array_length(controlled_record_references, 1) is null
    or array_length(controlled_record_references, 1) <= 20
  )
);

alter table public.investigations enable row level security;
alter table public.investigations force row level security;

-- Indexes
create index investigations_organization_idx on public.investigations (organization_id, status, investigated_at desc);
create index investigations_branch_idx on public.investigations (branch_id, status);
create index investigations_department_idx on public.investigations (department_id, status) where department_id is not null;
create index investigations_investigator_idx on public.investigations (investigator_id, status);
create index investigations_created_by_idx on public.investigations (created_by);
create index investigations_investigated_at_idx on public.investigations (investigated_at desc);

-- ---------------------------------------------------------------------------
-- RLS Policies for Investigations
-- ---------------------------------------------------------------------------

-- Platform admin: all access
create policy investigations_platform_admin_all
  on public.investigations for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Organization read: can_read_organization
create policy investigations_read_permitted
  on public.investigations for select to authenticated
  using (public.can_read_organization(organization_id));

-- Organization write: can_manage_organization + specific roles
create policy investigations_write_permitted
  on public.investigations for insert to authenticated
  with check (
    public.can_manage_organization(organization_id)
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = investigations.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'quality_manager', 'location_manager', 'analyst')
    )
  );

-- Update: investigators, owners, quality managers, platform admins
create policy investigations_update_permitted
  on public.investigations for update to authenticated
  using (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or investigator_id = auth.uid()
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = investigations.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
    )
  ) with check (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or investigator_id = auth.uid()
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = investigations.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
    )
  );

-- Delete: platform admin only
create policy investigations_delete_permitted
  on public.investigations for delete to authenticated
  using (public.is_platform_admin());

grant select, insert, update, delete on public.investigations to authenticated;

-- ---------------------------------------------------------------------------
-- Investigation Responses (many-to-many junction)
-- ---------------------------------------------------------------------------

create table public.investigation_responses (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  response_id uuid not null references public.survey_responses (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  
  constraint investigation_responses_investigation_response_key unique (investigation_id, response_id),
  constraint investigation_responses_organization_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete cascade
);

alter table public.investigation_responses enable row level security;
alter table public.investigation_responses force row level security;

create index investigation_responses_investigation_idx on public.investigation_responses (investigation_id);
create index investigation_responses_response_idx on public.investigation_responses (response_id);
create index investigation_responses_organization_idx on public.investigation_responses (organization_id);

create policy investigation_responses_platform_admin_all
  on public.investigation_responses for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy investigation_responses_read_permitted
  on public.investigation_responses for select to authenticated
  using (public.can_read_organization(organization_id));

create policy investigation_responses_write_permitted
  on public.investigation_responses for insert to authenticated
  with check (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_responses.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

create policy investigation_responses_delete_permitted
  on public.investigation_responses for delete to authenticated
  using (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_responses.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

grant select, insert, delete on public.investigation_responses to authenticated;

-- ---------------------------------------------------------------------------
-- Investigation Alerts (many-to-many junction)
-- ---------------------------------------------------------------------------

create table public.investigation_alerts (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  alert_id uuid not null references public.alerts (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  
  constraint investigation_alerts_investigation_alert_key unique (investigation_id, alert_id),
  constraint investigation_alerts_organization_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete cascade
);

alter table public.investigation_alerts enable row level security;
alter table public.investigation_alerts force row level security;

create index investigation_alerts_investigation_idx on public.investigation_alerts (investigation_id);
create index investigation_alerts_alert_idx on public.investigation_alerts (alert_id);
create index investigation_alerts_organization_idx on public.investigation_alerts (organization_id);

create policy investigation_alerts_platform_admin_all
  on public.investigation_alerts for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy investigation_alerts_read_permitted
  on public.investigation_alerts for select to authenticated
  using (public.can_read_organization(organization_id));

create policy investigation_alerts_write_permitted
  on public.investigation_alerts for insert to authenticated
  with check (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_alerts.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

create policy investigation_alerts_delete_permitted
  on public.investigation_alerts for delete to authenticated
  using (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_alerts.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

grant select, insert, delete on public.investigation_alerts to authenticated;

-- ---------------------------------------------------------------------------
-- Investigation Corrective Actions (many-to-many junction)
-- ---------------------------------------------------------------------------

create table public.investigation_corrective_actions (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  corrective_action_id uuid not null references public.corrective_actions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  
  constraint investigation_ca_investigation_ca_key unique (investigation_id, corrective_action_id),
  constraint investigation_ca_organization_fkey
    foreign key (organization_id)
    references public.organizations (id)
    on delete cascade
);

alter table public.investigation_corrective_actions enable row level security;
alter table public.investigation_corrective_actions force row level security;

create index investigation_ca_investigation_idx on public.investigation_corrective_actions (investigation_id);
create index investigation_ca_corrective_action_idx on public.investigation_corrective_actions (corrective_action_id);
create index investigation_ca_organization_idx on public.investigation_corrective_actions (organization_id);

create policy investigation_ca_platform_admin_all
  on public.investigation_corrective_actions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy investigation_ca_read_permitted
  on public.investigation_corrective_actions for select to authenticated
  using (public.can_read_organization(organization_id));

create policy investigation_ca_write_permitted
  on public.investigation_corrective_actions for insert to authenticated
  with check (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_corrective_actions.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

create policy investigation_ca_delete_permitted
  on public.investigation_corrective_actions for delete to authenticated
  using (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_corrective_actions.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

grant select, insert, delete on public.investigation_corrective_actions to authenticated;

-- ---------------------------------------------------------------------------
-- Investigation Status History (immutable audit trail)
-- ---------------------------------------------------------------------------

create table public.investigation_status_history (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  previous_status public.investigation_status,
  new_status public.investigation_status not null,

  changed_by uuid not null references auth.users (id) on delete set null,
  changed_at timestamptz not null default timezone('utc', now()),
  change_reason text check (change_reason is null or char_length(btrim(change_reason)) <= 500)
);

alter table public.investigation_status_history enable row level security;
alter table public.investigation_status_history force row level security;

create index investigation_status_history_investigation_idx on public.investigation_status_history (investigation_id, changed_at desc);

create policy investigation_status_history_platform_admin_all
  on public.investigation_status_history for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy investigation_status_history_read_permitted
  on public.investigation_status_history for select to authenticated
  using (public.can_read_organization(organization_id));

create policy investigation_status_history_insert_permitted
  on public.investigation_status_history for insert to authenticated
  with check (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_status_history.investigation_id
        and public.can_read_organization(i.organization_id)
    )
  );

grant select, insert on public.investigation_status_history to authenticated;

-- ---------------------------------------------------------------------------
-- Investigation Comments / Timeline Events
-- ---------------------------------------------------------------------------

create table public.investigation_comments (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  author_id uuid not null references auth.users (id) on delete set null,
  comment text not null check (char_length(btrim(comment)) between 1 and 5000),
  event_type text not null default 'comment' check (event_type in ('comment', 'status_change', 'evidence_added', 'escalation', 'note')),
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.investigation_comments enable row level security;
alter table public.investigation_comments force row level security;

create index investigation_comments_investigation_idx on public.investigation_comments (investigation_id, created_at desc);

create policy investigation_comments_platform_admin_all
  on public.investigation_comments for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy investigation_comments_read_permitted
  on public.investigation_comments for select to authenticated
  using (public.can_read_organization(organization_id));

create policy investigation_comments_write_permitted
  on public.investigation_comments for insert to authenticated
  with check (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_comments.investigation_id
        and public.can_read_organization(i.organization_id)
    )
  );

grant select, insert on public.investigation_comments to authenticated;

-- ---------------------------------------------------------------------------
-- Investigation Evidence Attachments
-- ---------------------------------------------------------------------------

create table public.investigation_attachments (
  id uuid primary key default gen_random_uuid(),
  investigation_id uuid not null references public.investigations (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,

  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 500),
  file_type text not null check (file_type in ('photo', 'pdf', 'document', 'spreadsheet', 'video', 'audio', 'other')),
  description text check (description is null or char_length(btrim(description)) <= 500),
  evidence_category text check (evidence_category is null or char_length(btrim(evidence_category)) between 1 and 100),

  uploaded_by uuid not null references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now())
);

alter table public.investigation_attachments enable row level security;
alter table public.investigation_attachments force row level security;

create index investigation_attachments_investigation_idx on public.investigation_attachments (investigation_id, uploaded_at desc);

create policy investigation_attachments_platform_admin_all
  on public.investigation_attachments for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy investigation_attachments_read_permitted
  on public.investigation_attachments for select to authenticated
  using (public.can_read_organization(organization_id));

create policy investigation_attachments_write_permitted
  on public.investigation_attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_attachments.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

create policy investigation_attachments_delete_permitted
  on public.investigation_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.investigations i
      where i.id = investigation_attachments.investigation_id
        and (
          public.can_manage_organization(i.organization_id)
          or i.investigator_id = auth.uid()
          or exists (
            select 1 from public.organization_memberships om
            where om.organization_id = i.organization_id
              and om.user_id = auth.uid()
              and om.status = 'active'
              and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
          )
        )
    )
  );

grant select, insert, update on public.investigation_attachments to authenticated;

-- ---------------------------------------------------------------------------
-- Updated At Trigger
-- ---------------------------------------------------------------------------

create trigger investigations_set_updated_at
  before update on public.investigations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit Trigger (logs status changes to audit_logs)
-- ---------------------------------------------------------------------------

create function public.write_investigation_audit()
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
      new.organization_id, auth.uid(), current_user, 'UPDATE', 'investigations', new.id,
      jsonb_build_object(
        'old', jsonb_build_object(
          'status', old.status,
          'escalation_decision', old.escalation_decision
        ),
        'new', jsonb_build_object(
          'status', new.status,
          'escalation_decision', new.escalation_decision
        )
      )
    );
  end if;
  return new;
end;
$$;

create trigger investigations_audit
  after update on public.investigations
  for each row execute function public.write_investigation_audit();

-- ---------------------------------------------------------------------------
-- Status History Trigger (auto-populates history on status change)
-- ---------------------------------------------------------------------------

create function public.write_investigation_status_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status is distinct from new.status then
    insert into public.investigation_status_history (
      investigation_id, organization_id, previous_status, new_status, changed_by, change_reason
    ) values (
      new.id, new.organization_id, old.status, new.status, auth.uid(),
      null -- change_reason could be passed via application context
    );
  end if;
  return new;
end;
$$;

create trigger investigations_status_history
  after update on public.investigations
  for each row execute function public.write_investigation_status_history();

-- ---------------------------------------------------------------------------
-- Closure Validation Trigger
-- ---------------------------------------------------------------------------

create function public.validate_investigation_closure()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Set closed_at when status changes to closed
  if new.status = 'closed' and old.status <> 'closed' then
    new.closed_at := timezone('utc', now());
  end if;
  
  -- Clear closed_at if status changes away from closed
  if new.status <> 'closed' and old.status = 'closed' then
    new.closed_at := null;
  end if;
  
  return new;
end;
$$;

create trigger investigations_closure_validation
  before update on public.investigations
  for each row execute function public.validate_investigation_closure();

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

grant select, insert, update, delete on public.investigations to authenticated;
grant select, insert, delete on public.investigation_responses to authenticated;
grant select, insert, delete on public.investigation_alerts to authenticated;
grant select, insert, delete on public.investigation_corrective_actions to authenticated;
grant select, insert on public.investigation_status_history to authenticated;
grant select, insert on public.investigation_comments to authenticated;
grant select, insert, update on public.investigation_attachments to authenticated;
