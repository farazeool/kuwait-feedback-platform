-- Evidence & Verification Module (Phase 4)
-- Polymorphic evidence attachment for corrective_actions, investigations, responses, alerts
-- Verification workflow and effectiveness review for corrective actions

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- New enum: polymorphic entity types for evidence
create type public.evidence_entity_type as enum (
  'corrective_action',
  'investigation',
  'response',
  'alert'
);

-- New enum: evidence file types (matches corrective_action_attachments.file_type)
create type public.evidence_file_type as enum (
  'photo',
  'pdf',
  'checklist',
  'training_record',
  'maintenance_record',
  'supplier_document',
  'other'
);

-- Note: public.verification_status, public.effectiveness_result, and public.closure_approval
-- enums are already defined in 20260722180000_corrective_actions.sql

-- ---------------------------------------------------------------------------
-- Evidence Table (Polymorphic)
-- ---------------------------------------------------------------------------

create table public.evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,

  -- Polymorphic linkage
  entity_type public.evidence_entity_type not null,
  entity_id uuid not null,

  -- File metadata
  file_name text not null check (char_length(btrim(file_name)) between 1 and 255),
  storage_path text not null check (char_length(btrim(storage_path)) between 1 and 500),
  file_type public.evidence_file_type not null,
  description text check (description is null or char_length(btrim(description)) <= 2000),

  -- Upload tracking
  uploaded_by uuid not null references auth.users (id) on delete set null,
  uploaded_at timestamptz not null default timezone('utc', now()),

  -- Verification fields (denormalized from latest verification row)
  verification_status public.verification_status not null default 'pending',
  verified_by uuid references auth.users (id) on delete set null,
  verified_at timestamptz,
  verification_comments text check (verification_comments is null or char_length(btrim(verification_comments)) <= 2000),

  -- Audit
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes for polymorphic queries
create index evidence_organization_idx on public.evidence (organization_id, entity_type, entity_id);
create index evidence_entity_idx on public.evidence (entity_type, entity_id);
create index evidence_uploaded_by_idx on public.evidence (uploaded_by, uploaded_at);
create index evidence_verification_idx on public.evidence (verification_status);

-- RLS
alter table public.evidence enable row level security;
alter table public.evidence force row level security;

-- Platform admin: all access
create policy evidence_platform_admin_all
  on public.evidence for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Organization members can read evidence in their org
create policy evidence_read_permitted
  on public.evidence for select to authenticated
  using (public.can_read_organization(organization_id));

-- Organization members with write roles can insert evidence
-- Must set uploaded_by = auth.uid()
create policy evidence_insert_permitted
  on public.evidence for insert to authenticated
  with check (
    public.can_manage_organization(organization_id)
    or (
      evidence.uploaded_by = auth.uid()
      and exists (
        select 1 from public.organization_memberships om
        where om.organization_id = evidence.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
          and om.role in ('organization_owner', 'organization_admin', 'location_manager')
      )
    )
  );

-- Update: platform admin, org admin/owner, location managers, or the original uploader
create policy evidence_update_permitted
  on public.evidence for update to authenticated
  using (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or uploaded_by = auth.uid()
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = evidence.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'location_manager')
    )
  ) with check (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or uploaded_by = auth.uid()
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = evidence.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'location_manager')
    )
  );

-- Delete: platform admin only
create policy evidence_delete_permitted
  on public.evidence for delete to authenticated
  using (public.is_platform_admin());

grant select, insert, update, delete on public.evidence to authenticated;

-- ---------------------------------------------------------------------------
-- Verification Table (immutable verification audit trail per evidence)
-- ---------------------------------------------------------------------------

create table public.verification (
  id uuid primary key default gen_random_uuid(),
  evidence_id uuid not null references public.evidence (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  verifier_id uuid not null references auth.users (id) on delete set null,
  status public.verification_status not null,
  comments text check (comments is null or char_length(btrim(comments)) <= 2000),
  verified_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index verification_evidence_idx on public.verification (evidence_id, verified_at desc);
create index verification_org_idx on public.verification (organization_id, status, verified_at);

-- RLS
alter table public.verification enable row level security;
alter table public.verification force row level security;

-- Platform admin: all access
create policy verification_platform_admin_all
  on public.verification for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Org members can read verifications for their org
create policy verification_read_permitted
  on public.verification for select to authenticated
  using (public.can_read_organization(organization_id));

-- Verifiers (org owner, admin, location manager) can create verifications
-- Must set verifier_id = auth.uid()
create policy verification_insert_permitted
  on public.verification for insert to authenticated
  with check (
    verification.verifier_id = auth.uid()
    and (
      public.can_manage_organization(organization_id)
      or exists (
        select 1 from public.organization_memberships om
        where om.organization_id = verification.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
          and om.role in ('organization_owner', 'organization_admin', 'location_manager')
      )
    )
  );

-- No update/delete on verifications (immutable audit trail)

grant select, insert on public.verification to authenticated;

-- ---------------------------------------------------------------------------
-- Effectiveness Review Table (for Corrective Actions)
-- ---------------------------------------------------------------------------

create table public.effectiveness_review (
  id uuid primary key default gen_random_uuid(),
  corrective_action_id uuid not null references public.corrective_actions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete set null,
  result public.effectiveness_result not null,
  review_date timestamptz not null default timezone('utc', now()),
  comments text check (comments is null or char_length(btrim(comments)) <= 3000),
  follow_up_required boolean not null default false,
  follow_up_notes text check (follow_up_notes is null or char_length(btrim(follow_up_notes)) <= 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index effectiveness_review_ca_idx on public.effectiveness_review (corrective_action_id, review_date desc);
create index effectiveness_review_org_idx on public.effectiveness_review (organization_id, result);

-- RLS
alter table public.effectiveness_review enable row level security;
alter table public.effectiveness_review force row level security;

-- Platform admin: all access
create policy effectiveness_review_platform_admin_all
  on public.effectiveness_review for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Org members can read effectiveness reviews
create policy effectiveness_review_read_permitted
  on public.effectiveness_review for select to authenticated
  using (public.can_read_organization(organization_id));

-- Org owner/admin/location_manager can insert effectiveness reviews
-- Must set reviewer_id = auth.uid()
create policy effectiveness_review_insert_permitted
  on public.effectiveness_review for insert to authenticated
  with check (
    effectiveness_review.reviewer_id = auth.uid()
    and (
      public.can_manage_organization(organization_id)
      or exists (
        select 1 from public.organization_memberships om
        where om.organization_id = effectiveness_review.organization_id
          and om.user_id = auth.uid()
          and om.status = 'active'
          and om.role in ('organization_owner', 'organization_admin', 'location_manager')
      )
    )
  );

-- Org owner/admin/location_manager can update reviews (for corrections)
create policy effectiveness_review_update_permitted
  on public.effectiveness_review for update to authenticated
  using (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = effectiveness_review.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'location_manager')
    )
  ) with check (
    public.is_platform_admin()
    or public.can_manage_organization(organization_id)
    or exists (
      select 1 from public.organization_memberships om
      where om.organization_id = effectiveness_review.organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and om.role in ('organization_owner', 'organization_admin', 'location_manager')
    )
  );

-- Delete: platform admin only
create policy effectiveness_review_delete_permitted
  on public.effectiveness_review for delete to authenticated
  using (public.is_platform_admin());

grant select, insert, update, delete on public.effectiveness_review to authenticated;

-- ---------------------------------------------------------------------------
-- Updated At Trigger for evidence
-- ---------------------------------------------------------------------------

create trigger evidence_set_updated_at
  before update on public.evidence
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit Trigger: evidence (logs verification status changes to audit_logs)
-- ---------------------------------------------------------------------------

create function public.write_evidence_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or old.verification_status is distinct from new.verification_status then
    insert into public.audit_logs (
      organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
    ) values (
      new.organization_id, auth.uid(), current_user, tg_op, 'evidence', new.id,
      jsonb_build_object(
        'old', jsonb_build_object(
          'verification_status', old.verification_status,
          'file_type', old.file_type,
          'entity_type', old.entity_type,
          'entity_id', old.entity_id
        ),
        'new', jsonb_build_object(
          'verification_status', new.verification_status,
          'file_type', new.file_type,
          'entity_type', new.entity_type,
          'entity_id', new.entity_id
        )
      )
    );
  end if;
  return new;
end;
$$;

create trigger evidence_audit
  after insert or update on public.evidence
  for each row execute function public.write_evidence_audit();

-- ---------------------------------------------------------------------------
-- Trigger: propagate verification result to evidence.denormalized fields
-- ---------------------------------------------------------------------------

create function public.propagate_verification_to_evidence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.evidence
  set
    verification_status = new.status,
    verified_by = new.verifier_id,
    verified_at = new.verified_at,
    verification_comments = new.comments
  where id = new.evidence_id;
  return new;
end;
$$;

create trigger verification_propagate_to_evidence
  after insert on public.verification
  for each row execute function public.propagate_verification_to_evidence();

-- ---------------------------------------------------------------------------
-- Trigger: effectiveness_review updates corrective_action status
-- ---------------------------------------------------------------------------

create function public.apply_effectiveness_review_to_ca()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.corrective_actions
  set
    effectiveness_result = new.result,
    effectiveness_review_date = new.review_date::date,
    effectiveness_review_notes = new.comments,
    status = case
      when new.result = 'effective' then 'effectiveness_review'
      when new.result = 'partially_effective' then 'effectiveness_review'
      when new.result = 'not_effective' then 'in_progress'
      else status
    end
  where id = new.corrective_action_id;
  return new;
end;
$$;

create trigger effectiveness_review_updates_ca
  after insert or update on public.effectiveness_review
  for each row execute function public.apply_effectiveness_review_to_ca();

-- ---------------------------------------------------------------------------
-- Closure Approval columns on corrective_actions
-- (the closure_approval enum already exists; adding workflow columns)
-- ---------------------------------------------------------------------------

-- Add closure workflow columns if not already present
alter table public.corrective_actions
  add column if not exists closure_approved_by uuid references auth.users (id) on delete set null,
  add column if not exists closure_approved_at timestamptz;

-- Closure approval audit trigger
create function public.write_closure_approval_audit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.closure_approval is distinct from new.closure_approval then
    insert into public.audit_logs (
      organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
    ) values (
      new.organization_id, auth.uid(), current_user, 'UPDATE', 'corrective_actions', new.id,
      jsonb_build_object(
        'old', jsonb_build_object('closure_approval', old.closure_approval),
        'new', jsonb_build_object('closure_approval', new.closure_approval)
      )
    );
  end if;
  return new;
end;
$$;

create trigger corrective_actions_closure_approval_audit
  after update on public.corrective_actions
  for each row execute function public.write_closure_approval_audit();

-- ---------------------------------------------------------------------------
-- Comments
-- ---------------------------------------------------------------------------

comment on table public.evidence is
  'Polymorphic evidence attachments for corrective actions, investigations, responses, and alerts. Verification status is denormalized from the latest verification row.';

comment on column public.evidence.entity_type is
  'Polymorphic discriminator: corrective_action, investigation, response, alert';

comment on column public.evidence.entity_id is
  'ID of the parent entity (corrective_actions.id, etc.)';

comment on column public.evidence.file_type is
  'Document classification: photo, pdf, checklist, training_record, maintenance_record, supplier_document, other';

comment on table public.verification is
  'Append-only verification audit trail. Each row records a verifier decision on a piece of evidence.';

comment on table public.effectiveness_review is
  'Effectiveness review for corrective actions. Records whether the implemented action was effective, partially effective, or not effective.';
