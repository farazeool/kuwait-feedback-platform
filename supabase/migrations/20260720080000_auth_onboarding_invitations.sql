-- Trusted onboarding and invitation foundations for the authenticated app.

create type public.membership_scope as enum ('organization', 'locations');

alter table public.organizations
  add column business_category text not null default 'other'
    check (business_category ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  add column phone text
    check (phone is null or phone ~ '^\+965[0-9]{8}$');

alter table public.locations
  add column governorate text not null default 'capital'
    check (governorate in (
      'capital',
      'hawalli',
      'farwaniya',
      'mubarak_al_kabeer',
      'ahmadi',
      'jahra'
    )),
  add column area text not null default 'Kuwait'
    check (char_length(area) between 1 and 120);

alter table public.organization_memberships
  add column scope public.membership_scope not null default 'organization';

update public.organization_memberships
set scope = 'locations'
where role = 'location_manager';

alter table public.organization_memberships
  add constraint organization_memberships_scope_check check (
    (role in ('organization_owner', 'organization_admin') and scope = 'organization')
    or (role = 'location_manager' and scope = 'locations')
    or role = 'analyst'
  );

create or replace function public.can_read_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.organization_memberships om
      where om.organization_id = p_organization_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and (
          om.role in ('organization_owner', 'organization_admin')
          or (om.role = 'analyst' and om.scope = 'organization')
        )
    )
    or exists (
      select 1
      from public.location_memberships lm
      where lm.organization_id = p_organization_id
        and lm.user_id = auth.uid()
        and lm.status = 'active'
        and lm.role in ('location_manager', 'analyst')
    );
$$;

create or replace function public.can_access_location(
  p_location_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or exists (
      select 1
      from public.locations l
      join public.organization_memberships om
        on om.organization_id = l.organization_id
      where l.id = p_location_id
        and om.user_id = auth.uid()
        and om.status = 'active'
        and (
          om.role in ('organization_owner', 'organization_admin')
          or (om.role = 'analyst' and om.scope = 'organization')
        )
    )
    or exists (
      select 1
      from public.location_memberships lm
      where lm.location_id = p_location_id
        and lm.user_id = auth.uid()
        and lm.status = 'active'
        and lm.role in ('location_manager', 'analyst')
    );
$$;

create function public.create_organization_with_first_location(
  p_name_en text,
  p_name_ar text,
  p_slug text,
  p_business_category text,
  p_phone text,
  p_location_name_en text,
  p_location_name_ar text,
  p_location_slug text,
  p_governorate text,
  p_area text,
  p_address text,
  p_timezone text default 'Asia/Kuwait'
)
returns table (organization_id uuid, location_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_location_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  if not exists (
    select 1 from public.profiles p
    where p.id = v_user_id and p.status = 'active'
  ) then
    raise exception 'Active profile required' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.organization_memberships om
    where om.user_id = v_user_id and om.status = 'active'
  ) then
    raise exception 'Onboarding is only available before joining an organization'
      using errcode = '42501';
  end if;

  if p_timezone <> 'Asia/Kuwait' then
    raise exception 'Unsupported timezone' using errcode = '22023';
  end if;

  insert into public.organizations (
    slug,
    name_en,
    name_ar,
    business_category,
    phone,
    timezone,
    created_by
  ) values (
    lower(btrim(p_slug)),
    btrim(p_name_en),
    coalesce(nullif(btrim(p_name_ar), ''), btrim(p_name_en)),
    lower(btrim(p_business_category)),
    nullif(btrim(p_phone), ''),
    p_timezone,
    v_user_id
  ) returning id into v_organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    scope,
    created_by
  ) values (
    v_organization_id,
    v_user_id,
    'organization_owner',
    'organization',
    v_user_id
  );

  insert into public.locations (
    organization_id,
    slug,
    name_en,
    name_ar,
    governorate,
    area,
    address_en,
    timezone,
    created_by
  ) values (
    v_organization_id,
    lower(btrim(p_location_slug)),
    btrim(p_location_name_en),
    coalesce(nullif(btrim(p_location_name_ar), ''), btrim(p_location_name_en)),
    p_governorate,
    btrim(p_area),
    nullif(btrim(p_address), ''),
    p_timezone,
    v_user_id
  ) returning id into v_location_id;

  return query select v_organization_id, v_location_id;
end;
$$;

comment on function public.create_organization_with_first_location(
  text, text, text, text, text, text, text, text, text, text, text, text
) is 'Atomically creates the first tenant, owner membership, and location for an authenticated user with no active membership.';

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (
    char_length(email) between 3 and 320
    and email = lower(email)
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  role public.app_role not null check (
    role in ('organization_admin', 'location_manager', 'analyst')
  ),
  scope public.membership_scope not null,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  invited_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organization_invitations_scope_check check (
    (role = 'organization_admin' and scope = 'organization')
    or (role = 'location_manager' and scope = 'locations')
    or role = 'analyst'
  ),
  constraint organization_invitations_expiry_check check (expires_at > created_at),
  constraint organization_invitations_acceptance_check check (
    (accepted_at is null and accepted_by is null)
    or (accepted_at is not null and accepted_by is not null)
  ),
  constraint organization_invitations_terminal_state_check check (
    accepted_at is null or revoked_at is null
  )
);

create table public.organization_invitation_locations (
  invitation_id uuid not null references public.organization_invitations (id) on delete cascade,
  location_id uuid not null,
  organization_id uuid not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (invitation_id, location_id),
  constraint organization_invitation_locations_scope_fkey
    foreign key (location_id, organization_id)
    references public.locations (id, organization_id)
    on delete cascade
);

create index organization_invitations_org_state_idx
  on public.organization_invitations (organization_id, accepted_at, revoked_at, expires_at);
create index organization_invitations_email_idx
  on public.organization_invitations (email, expires_at desc);
create index organization_invitation_locations_location_idx
  on public.organization_invitation_locations (location_id, invitation_id);

create trigger organization_invitations_set_updated_at
before update on public.organization_invitations
for each row execute function public.set_updated_at();

alter table public.organization_invitations enable row level security;
alter table public.organization_invitation_locations enable row level security;
alter table public.organization_invitations force row level security;
alter table public.organization_invitation_locations force row level security;

create policy organization_invitations_platform_admin_read
on public.organization_invitations for select to authenticated
using (public.is_platform_admin());

create policy organization_invitations_tenant_admin_read
on public.organization_invitations for select to authenticated
using (public.can_manage_organization(organization_id));

create policy organization_invitation_locations_platform_admin_read
on public.organization_invitation_locations for select to authenticated
using (public.is_platform_admin());

create policy organization_invitation_locations_tenant_admin_read
on public.organization_invitation_locations for select to authenticated
using (public.can_manage_organization(organization_id));

create function public.prepare_organization_invitation(
  p_organization_id uuid,
  p_email text,
  p_role public.app_role,
  p_location_ids uuid[] default array[]::uuid[],
  p_expires_in interval default interval '7 days'
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_invitation_id uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := timezone('utc', now()) + p_expires_in;
  v_scope public.membership_scope;
  v_location_id uuid;
begin
  p_location_ids := coalesce(p_location_ids, array[]::uuid[]);

  if v_actor_id is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Organization administrator access required' using errcode = '42501';
  end if;

  if p_role not in ('organization_admin', 'location_manager', 'analyst') then
    raise exception 'Role is not invitational' using errcode = '22023';
  end if;

  if p_expires_in <= interval '5 minutes' or p_expires_in > interval '30 days' then
    raise exception 'Invitation expiry must be between 5 minutes and 30 days'
      using errcode = '22023';
  end if;

  if p_role = 'location_manager' and cardinality(p_location_ids) = 0 then
    raise exception 'Location managers require at least one location'
      using errcode = '22023';
  end if;

  if p_role = 'organization_admin' and cardinality(p_location_ids) > 0 then
    raise exception 'Organization administrators cannot be location scoped'
      using errcode = '22023';
  end if;

  v_scope := case
    when p_role = 'organization_admin' then 'organization'::public.membership_scope
    when cardinality(p_location_ids) > 0 then 'locations'::public.membership_scope
    else 'organization'::public.membership_scope
  end;

  if exists (
    select 1
    from unnest(p_location_ids) requested(location_id)
    left join public.locations l
      on l.id = requested.location_id
      and l.organization_id = p_organization_id
      and l.status = 'active'
    where l.id is null
  ) then
    raise exception 'Invitation contains an unavailable location'
      using errcode = '22023';
  end if;

  insert into public.organization_invitations (
    organization_id,
    email,
    role,
    scope,
    token_hash,
    expires_at,
    invited_by
  ) values (
    p_organization_id,
    lower(btrim(p_email)),
    p_role,
    v_scope,
    extensions.digest(v_token, 'sha256'),
    v_expires_at,
    v_actor_id
  ) returning id into v_invitation_id;

  for v_location_id in
    select distinct requested.location_id from unnest(p_location_ids) requested(location_id)
  loop
    insert into public.organization_invitation_locations (
      invitation_id,
      location_id,
      organization_id
    ) values (v_invitation_id, v_location_id, p_organization_id);
  end loop;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    actor_database_role,
    action,
    table_name,
    record_id,
    changed_data
  ) values (
    p_organization_id,
    v_actor_id,
    current_user,
    'INSERT',
    'organization_invitations',
    v_invitation_id,
    jsonb_build_object(
      'email', lower(btrim(p_email)),
      'role', p_role,
      'scope', v_scope,
      'expires_at', v_expires_at
    )
  );

  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

create function public.accept_organization_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_invitation public.organization_invitations%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select lower(u.email) into v_user_email
  from auth.users u
  where u.id = v_user_id;

  select * into v_invitation
  from public.organization_invitations oi
  where oi.token_hash = extensions.digest(p_token, 'sha256')
  for update;

  if not found
    or v_invitation.accepted_at is not null
    or v_invitation.revoked_at is not null
    or v_invitation.expires_at <= timezone('utc', now())
    or v_invitation.email <> v_user_email
  then
    raise exception 'Invitation is invalid or unavailable' using errcode = '22023';
  end if;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    scope,
    created_by
  ) values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    v_invitation.scope,
    v_invitation.invited_by
  );

  insert into public.location_memberships (
    location_id,
    organization_id,
    user_id,
    role,
    created_by
  )
  select
    oil.location_id,
    oil.organization_id,
    v_user_id,
    v_invitation.role,
    v_invitation.invited_by
  from public.organization_invitation_locations oil
  where oil.invitation_id = v_invitation.id;

  update public.organization_invitations
  set accepted_at = timezone('utc', now()), accepted_by = v_user_id
  where id = v_invitation.id;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    actor_database_role,
    action,
    table_name,
    record_id,
    changed_data
  ) values (
    v_invitation.organization_id,
    v_user_id,
    current_user,
    'UPDATE',
    'organization_invitations',
    v_invitation.id,
    jsonb_build_object('accepted_at', timezone('utc', now()))
  );

  return v_invitation.organization_id;
exception
  when unique_violation then
    raise exception 'A membership already exists for this organization'
      using errcode = '23505';
end;
$$;

create function public.revoke_organization_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_organization_id uuid;
begin
  select oi.organization_id into v_organization_id
  from public.organization_invitations oi
  where oi.id = p_invitation_id
    and oi.accepted_at is null
    and oi.revoked_at is null
  for update;

  if not found
    or v_actor_id is null
    or not public.can_manage_organization(v_organization_id)
  then
    raise exception 'Invitation is unavailable' using errcode = '42501';
  end if;

  update public.organization_invitations
  set revoked_at = timezone('utc', now())
  where id = p_invitation_id;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    actor_database_role,
    action,
    table_name,
    record_id,
    changed_data
  ) values (
    v_organization_id,
    v_actor_id,
    current_user,
    'UPDATE',
    'organization_invitations',
    p_invitation_id,
    jsonb_build_object('revoked_at', timezone('utc', now()))
  );
end;
$$;

revoke all on public.organization_invitations from anon, authenticated;
revoke all on public.organization_invitation_locations from anon, authenticated;
revoke execute on function public.create_organization_with_first_location(
  text, text, text, text, text, text, text, text, text, text, text, text
) from public, anon;
revoke execute on function public.prepare_organization_invitation(
  uuid, text, public.app_role, uuid[], interval
) from public, anon;
revoke execute on function public.accept_organization_invitation(text)
  from public, anon;
revoke execute on function public.revoke_organization_invitation(uuid)
  from public, anon;

grant select on public.organization_invitations to authenticated;
grant select on public.organization_invitation_locations to authenticated;
grant execute on function public.create_organization_with_first_location(
  text, text, text, text, text, text, text, text, text, text, text, text
) to authenticated;
grant execute on function public.prepare_organization_invitation(
  uuid, text, public.app_role, uuid[], interval
) to authenticated;
grant execute on function public.accept_organization_invitation(text)
  to authenticated;
grant execute on function public.revoke_organization_invitation(uuid)
  to authenticated;

comment on table public.organization_invitations is
  'Server-prepared invitations; only SHA-256 token digests are persisted.';
comment on function public.prepare_organization_invitation(
  uuid, text, public.app_role, uuid[], interval
) is 'Returns a random invitation token exactly once. Email delivery is intentionally deferred.';
