-- Team administration, invitation delivery, settings, branding storage, and platform visibility.

create type public.invitation_delivery_status as enum (
  'pending', 'captured', 'sent', 'failed'
);

alter table public.organizations
  add column email text check (email is null or (char_length(email) <= 320 and email = lower(email))),
  add column website text check (website is null or (char_length(website) <= 500 and website ~ '^https://')),
  add column description_en text check (description_en is null or char_length(description_en) <= 2000),
  add column description_ar text check (description_ar is null or char_length(description_ar) <= 2000),
  add column default_locale public.locale_code not null default 'en',
  add column date_format text not null default 'dd/MM/yyyy' check (date_format in ('dd/MM/yyyy', 'yyyy-MM-dd')),
  add column number_format text not null default 'en-KW' check (number_format in ('en-KW', 'ar-KW')),
  add column support_email text check (support_email is null or (char_length(support_email) <= 320 and support_email = lower(support_email))),
  add column support_phone text check (support_phone is null or support_phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column primary_color text not null default '#065f46' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column accent_color text not null default '#d97706' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  add column logo_path text,
  add column icon_logo_path text,
  add column dark_logo_path text,
  add column survey_header_style text not null default 'standard' check (survey_header_style in ('standard', 'compact', 'centered')),
  add column default_thank_you_en text check (default_thank_you_en is null or char_length(default_thank_you_en) <= 500),
  add column default_thank_you_ar text check (default_thank_you_ar is null or char_length(default_thank_you_ar) <= 500),
  add column footer_text_en text check (footer_text_en is null or char_length(footer_text_en) <= 500),
  add column footer_text_ar text check (footer_text_ar is null or char_length(footer_text_ar) <= 500),
  add constraint organizations_branding_paths_check check (
    (logo_path is null or logo_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'))
    and (icon_logo_path is null or icon_logo_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'))
    and (dark_logo_path is null or dark_logo_path ~ ('^' || id::text || '/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'))
  );

alter table public.locations
  add column phone text check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$'),
  add column email text check (email is null or (char_length(email) <= 320 and email = lower(email))),
  add column opening_hours jsonb not null default '{}'::jsonb check (jsonb_typeof(opening_hours) = 'object'),
  add column inherits_timezone boolean not null default true;

alter table public.organization_invitations
  add column personal_message text check (personal_message is null or char_length(personal_message) <= 500),
  add column locale public.locale_code not null default 'en',
  add column delivery_status public.invitation_delivery_status not null default 'pending',
  add column delivery_attempts integer not null default 0 check (delivery_attempts between 0 and 20),
  add column last_delivery_at timestamptz,
  add column delivery_error_code text check (delivery_error_code is null or delivery_error_code ~ '^[a-z0-9_]{1,50}$'),
  add column superseded_by uuid references public.organization_invitations (id) on delete set null;

update public.organization_invitations
set revoked_at = timezone('utc', now())
where accepted_at is null and revoked_at is null and expires_at <= timezone('utc', now());

create unique index organization_invitations_one_open_email_idx
  on public.organization_invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

create table public.invitation_rate_limits (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email_hash bytea not null,
  action text not null check (action in ('create', 'resend')),
  window_started_at timestamptz not null,
  request_count integer not null default 1 check (request_count between 1 and 100),
  expires_at timestamptz not null,
  primary key (organization_id, email_hash, action, window_started_at)
);

alter table public.invitation_rate_limits enable row level security;
alter table public.invitation_rate_limits force row level security;
revoke all on public.invitation_rate_limits from public, anon, authenticated;

create index invitation_rate_limits_expiry_idx on public.invitation_rate_limits (expires_at);
create index organization_memberships_team_idx
  on public.organization_memberships (organization_id, status, role, created_at desc);

create or replace function public.consume_invitation_rate_limit(
  p_organization_id uuid,
  p_email text,
  p_action text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email_hash bytea := extensions.digest(lower(btrim(p_email)), 'sha256');
  v_window timestamptz := date_trunc('hour', timezone('utc', now()));
  v_email_count integer;
  v_org_count integer;
begin
  if p_action not in ('create', 'resend') then
    raise exception 'Invalid invitation action' using errcode = '22023';
  end if;
  delete from public.invitation_rate_limits where expires_at <= timezone('utc', now());
  insert into public.invitation_rate_limits (
    organization_id, email_hash, action, window_started_at, expires_at
  ) values (
    p_organization_id, v_email_hash, p_action, v_window, v_window + interval '2 hours'
  ) on conflict (organization_id, email_hash, action, window_started_at)
    do update set request_count = public.invitation_rate_limits.request_count + 1
  returning request_count into v_email_count;
  select coalesce(sum(request_count), 0) into v_org_count
  from public.invitation_rate_limits
  where organization_id = p_organization_id and window_started_at = v_window;
  if v_email_count > 5 or v_org_count > 30 then
    raise exception 'Invitation request limit reached' using errcode = 'P0001';
  end if;
end;
$$;

create function public.prepare_organization_invitation_v2(
  p_organization_id uuid,
  p_email text,
  p_role public.app_role,
  p_location_ids uuid[] default array[]::uuid[],
  p_expires_in interval default interval '7 days',
  p_personal_message text default null,
  p_locale public.locale_code default 'en'
)
returns table (invitation_id uuid, invitation_token text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_email text := lower(btrim(p_email));
  v_invitation_id uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expires_at timestamptz := timezone('utc', now()) + p_expires_in;
  v_scope public.membership_scope;
  v_location_id uuid;
begin
  p_location_ids := coalesce(p_location_ids, array[]::uuid[]);
  if v_actor_id is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  if p_role not in ('organization_admin', 'location_manager', 'analyst') then
    raise exception 'Invitation unavailable' using errcode = '22023';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(v_email) > 320 then
    raise exception 'Invitation unavailable' using errcode = '22023';
  end if;
  if p_expires_in <= interval '5 minutes' or p_expires_in > interval '30 days' then
    raise exception 'Invitation unavailable' using errcode = '22023';
  end if;
  if p_personal_message is not null and char_length(btrim(p_personal_message)) > 500 then
    raise exception 'Invitation unavailable' using errcode = '22023';
  end if;
  if p_role = 'location_manager' and cardinality(p_location_ids) = 0 then
    raise exception 'Location assignment required' using errcode = '22023';
  end if;
  if p_role = 'organization_admin' and cardinality(p_location_ids) > 0 then
    raise exception 'Organization administrators cannot be location scoped' using errcode = '22023';
  end if;
  if exists (
    select 1 from auth.users u join public.organization_memberships om on om.user_id = u.id
    where lower(u.email) = v_email and om.organization_id = p_organization_id and om.status = 'active'
  ) then
    raise exception 'Invitation unavailable' using errcode = '23505';
  end if;
  update public.organization_invitations oi set revoked_at = timezone('utc', now())
  where oi.organization_id = p_organization_id and oi.email = v_email
    and oi.accepted_at is null and oi.revoked_at is null and oi.expires_at <= timezone('utc', now());
  if exists (
    select 1 from public.organization_invitations oi
    where oi.organization_id = p_organization_id and oi.email = v_email
      and oi.accepted_at is null and oi.revoked_at is null
  ) then
    raise exception 'Invitation unavailable' using errcode = '23505';
  end if;
  if exists (
    select 1 from unnest(p_location_ids) requested(location_id)
    left join public.locations l on l.id = requested.location_id
      and l.organization_id = p_organization_id and l.status = 'active'
    where l.id is null
  ) then
    raise exception 'Location assignment unavailable' using errcode = '22023';
  end if;
  perform public.consume_invitation_rate_limit(p_organization_id, v_email, 'create');
  v_scope := case when p_role = 'organization_admin' then 'organization'::public.membership_scope
    when cardinality(p_location_ids) > 0 then 'locations'::public.membership_scope
    else 'organization'::public.membership_scope end;
  insert into public.organization_invitations (
    organization_id, email, role, scope, token_hash, expires_at, invited_by,
    personal_message, locale
  ) values (
    p_organization_id, v_email, p_role, v_scope, extensions.digest(v_token, 'sha256'),
    v_expires_at, v_actor_id, nullif(btrim(p_personal_message), ''), p_locale
  ) returning id into v_invitation_id;
  for v_location_id in select distinct location_id from unnest(p_location_ids) location_id loop
    insert into public.organization_invitation_locations (invitation_id, location_id, organization_id)
    values (v_invitation_id, v_location_id, p_organization_id);
  end loop;
  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    p_organization_id, v_actor_id, current_user, 'INSERT', 'organization_invitations', v_invitation_id,
    jsonb_build_object('role', p_role, 'scope', v_scope, 'locale', p_locale, 'expires_at', v_expires_at)
  );
  return query select v_invitation_id, v_token, v_expires_at;
end;
$$;

create function public.resend_organization_invitation(p_invitation_id uuid)
returns table (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz,
  invited_email text,
  invited_locale public.locale_code,
  invited_role public.app_role,
  personal_message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old public.organization_invitations%rowtype;
  v_new_id uuid;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
  v_expiry timestamptz := timezone('utc', now()) + interval '7 days';
begin
  select * into v_old from public.organization_invitations oi
  where oi.id = p_invitation_id for update;
  if not found or v_old.accepted_at is not null or auth.uid() is null
    or not public.can_manage_organization(v_old.organization_id) then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;
  perform public.consume_invitation_rate_limit(v_old.organization_id, v_old.email, 'resend');
  update public.organization_invitations set revoked_at = coalesce(revoked_at, timezone('utc', now())) where id = v_old.id;
  insert into public.organization_invitations (
    organization_id, email, role, scope, token_hash, expires_at, invited_by,
    personal_message, locale
  ) values (
    v_old.organization_id, v_old.email, v_old.role, v_old.scope,
    extensions.digest(v_token, 'sha256'), v_expiry, auth.uid(), v_old.personal_message, v_old.locale
  ) returning id into v_new_id;
  insert into public.organization_invitation_locations (invitation_id, location_id, organization_id)
  select v_new_id, oil.location_id, oil.organization_id
  from public.organization_invitation_locations oil where oil.invitation_id = v_old.id;
  update public.organization_invitations set superseded_by = v_new_id where id = v_old.id;
  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    v_old.organization_id, auth.uid(), current_user, 'UPDATE', 'organization_invitations', v_old.id,
    jsonb_build_object('event', 'resend', 'replacement_id', v_new_id)
  );
  return query select
    v_new_id,
    v_token,
    v_expiry,
    v_old.email,
    v_old.locale,
    v_old.role,
    v_old.personal_message;
end;
$$;

-- The first invitation RPC predates delivery controls and rate limits. Keep its
-- definition for migration compatibility, but remove direct application access.
revoke execute on function public.prepare_organization_invitation(uuid, text, public.app_role, uuid[], interval)
  from public, anon, authenticated;

create function public.record_invitation_delivery(
  p_invitation_id uuid,
  p_status public.invitation_delivery_status,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.organization_invitations
  where id = p_invitation_id and public.can_manage_organization(organization_id) for update;
  if not found or p_status not in ('captured', 'sent', 'failed') then
    raise exception 'Delivery update unavailable' using errcode = '42501';
  end if;
  if p_error_code is not null and p_error_code !~ '^[a-z0-9_]{1,50}$' then
    raise exception 'Invalid delivery error' using errcode = '22023';
  end if;
  update public.organization_invitations set
    delivery_status = p_status,
    delivery_attempts = delivery_attempts + 1,
    last_delivery_at = timezone('utc', now()),
    delivery_error_code = case when p_status = 'failed' then p_error_code end
  where id = p_invitation_id;
  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    v_org, auth.uid(), current_user, 'UPDATE', 'invitation_delivery', p_invitation_id,
    jsonb_build_object('status', p_status, 'error_code', case when p_status = 'failed' then p_error_code end)
  );
end;
$$;

create function public.record_invitation_acceptance_failure(p_token text, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_invitation public.organization_invitations%rowtype;
begin
  if auth.uid() is null or p_reason not in ('unavailable', 'email_mismatch', 'already_member') then
    raise exception 'Failure audit unavailable' using errcode = '42501';
  end if;
  select * into v_invitation from public.organization_invitations
  where token_hash = extensions.digest(p_token, 'sha256');
  if not found then return; end if;
  insert into public.audit_logs (
    organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data
  ) values (
    v_invitation.organization_id, auth.uid(), current_user, 'UPDATE',
    'invitation_acceptance_failure', v_invitation.id, jsonb_build_object('reason', p_reason)
  );
end;
$$;

create function public.list_team_members(
  p_organization_id uuid,
  p_search text default null,
  p_role public.app_role default null,
  p_location_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.can_read_organization(p_organization_id)
    or p_page not between 1 and 10000 or p_page_size not between 1 and 50
    or (p_location_id is not null and not public.can_access_location(p_location_id)) then
    raise exception 'Team unavailable' using errcode = '42501';
  end if;
  with visible as (
    select om.id, om.user_id, om.role, om.scope, om.status, om.created_at,
      p.display_name, p.preferred_locale, lower(u.email) email, u.last_sign_in_at,
      coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name_en', l.name_en, 'name_ar', l.name_ar) order by l.name_en)
        from public.location_memberships lm join public.locations l on l.id = lm.location_id
        where lm.organization_id = om.organization_id and lm.user_id = om.user_id and lm.status = 'active'), '[]'::jsonb) locations
    from public.organization_memberships om
    join public.profiles p on p.id = om.user_id
    join auth.users u on u.id = om.user_id
    where om.organization_id = p_organization_id
      and (p_role is null or om.role = p_role)
      and (p_location_id is null or exists (select 1 from public.location_memberships lm where lm.organization_id = om.organization_id and lm.user_id = om.user_id and lm.location_id = p_location_id and lm.status = 'active'))
      and (p_search is null or btrim(p_search) = '' or om.id::text = btrim(p_search) or p.display_name ilike '%' || left(btrim(p_search), 100) || '%' or lower(u.email) ilike '%' || lower(left(btrim(p_search), 100)) || '%')
      and (
        public.is_platform_admin()
        or public.can_manage_organization(p_organization_id)
        or exists (select 1 from public.organization_memberships me where me.organization_id = p_organization_id and me.user_id = auth.uid() and me.status = 'active' and me.role = 'analyst' and me.scope = 'organization')
        or om.role in ('organization_owner', 'organization_admin')
        or exists (
          select 1 from public.location_memberships mine join public.location_memberships theirs on theirs.location_id = mine.location_id
          where mine.organization_id = p_organization_id and mine.user_id = auth.uid() and mine.status = 'active'
            and theirs.organization_id = p_organization_id and theirs.user_id = om.user_id and theirs.status = 'active'
        )
      )
  ), counted as (select count(*) total from visible), paged as (
    select * from visible order by created_at desc, id limit p_page_size offset (p_page - 1) * p_page_size
  )
  select jsonb_build_object(
    'total', (select total from counted), 'page', p_page, 'page_size', p_page_size,
    'members', coalesce((select jsonb_agg(to_jsonb(paged) order by created_at desc) from paged), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create function public.list_team_invitations(p_organization_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Invitations unavailable' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', oi.id, 'email', oi.email, 'role', oi.role, 'scope', oi.scope,
      'locale', oi.locale, 'personal_message', oi.personal_message,
      'expires_at', oi.expires_at, 'accepted_at', oi.accepted_at, 'revoked_at', oi.revoked_at,
      'delivery_status', oi.delivery_status, 'delivery_attempts', oi.delivery_attempts,
      'last_delivery_at', oi.last_delivery_at, 'created_at', oi.created_at,
      'locations', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'name_en', l.name_en, 'name_ar', l.name_ar) order by l.name_en)
        from public.organization_invitation_locations oil join public.locations l on l.id = oil.location_id
        where oil.invitation_id = oi.id), '[]'::jsonb)
    ) order by oi.created_at desc)
    from public.organization_invitations oi where oi.organization_id = p_organization_id
  ), '[]'::jsonb);
end;
$$;

create function public.get_invitation_public(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_inv public.organization_invitations%rowtype; v_org public.organizations%rowtype; v_state text;
begin
  if p_token is null or char_length(p_token) <> 64 or p_token !~ '^[0-9a-f]+$' then
    return jsonb_build_object('state', 'unavailable');
  end if;
  select * into v_inv from public.organization_invitations oi
  where oi.token_hash = extensions.digest(p_token, 'sha256');
  if not found then return jsonb_build_object('state', 'unavailable'); end if;
  select * into v_org from public.organizations where id = v_inv.organization_id;
  v_state := case when v_inv.accepted_at is not null then 'used'
    when v_inv.revoked_at is not null then 'revoked'
    when v_inv.expires_at <= timezone('utc', now()) then 'expired'
    else 'valid' end;
  return jsonb_build_object(
    'state', v_state, 'role', v_inv.role, 'expires_at', v_inv.expires_at,
    'email_hint', left(v_inv.email, 2) || '***@' || split_part(v_inv.email, '@', 2),
    'organization', jsonb_build_object('name_en', v_org.name_en, 'name_ar', v_org.name_ar,
      'primary_color', v_org.primary_color, 'accent_color', v_org.accent_color,
      'logo_path', v_org.logo_path),
    'personal_message', v_inv.personal_message, 'locale', v_inv.locale
  );
end;
$$;

create function public.update_organization_member(
  p_membership_id uuid,
  p_role public.app_role,
  p_location_ids uuid[] default array[]::uuid[],
  p_status public.entity_status default 'active'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_target public.organization_memberships%rowtype; v_actor_role public.app_role;
begin
  select * into v_target from public.organization_memberships where id = p_membership_id for update;
  if not found or auth.uid() is null or v_target.user_id = auth.uid() then
    raise exception 'Member update unavailable' using errcode = '42501';
  end if;
  select public.organization_role(v_target.organization_id) into v_actor_role;
  if not public.is_platform_admin() and v_actor_role not in ('organization_owner', 'organization_admin') then
    raise exception 'Member update unavailable' using errcode = '42501';
  end if;
  if v_target.role = 'organization_owner' or p_role not in ('organization_admin', 'location_manager', 'analyst')
    or (v_actor_role = 'organization_admin' and v_target.role = 'organization_owner') then
    raise exception 'Member update unavailable' using errcode = '42501';
  end if;
  p_location_ids := coalesce(p_location_ids, array[]::uuid[]);
  if p_role = 'location_manager' and cardinality(p_location_ids) = 0 then
    raise exception 'Location assignment required' using errcode = '22023';
  end if;
  if p_role = 'organization_admin' and cardinality(p_location_ids) > 0 then
    raise exception 'Invalid organization scope' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(p_location_ids) x(id) left join public.locations l on l.id = x.id and l.organization_id = v_target.organization_id and l.status = 'active' where l.id is null) then
    raise exception 'Location assignment unavailable' using errcode = '22023';
  end if;
  update public.organization_memberships set role = p_role,
    scope = case when p_role = 'organization_admin' or cardinality(p_location_ids) = 0 then 'organization'::public.membership_scope else 'locations'::public.membership_scope end,
    status = p_status where id = p_membership_id;
  delete from public.location_memberships where organization_id = v_target.organization_id and user_id = v_target.user_id;
  if p_status = 'active' then
    insert into public.location_memberships (location_id, organization_id, user_id, role, created_by)
    select distinct x.id, v_target.organization_id, v_target.user_id, p_role, auth.uid() from unnest(p_location_ids) x(id);
  end if;
end;
$$;

create function public.remove_organization_member(p_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_target public.organization_memberships%rowtype; v_actor_role public.app_role;
begin
  select * into v_target from public.organization_memberships where id = p_membership_id for update;
  if not found or auth.uid() is null or v_target.user_id = auth.uid() or v_target.role = 'organization_owner' then
    raise exception 'Member removal unavailable' using errcode = '42501';
  end if;
  select public.organization_role(v_target.organization_id) into v_actor_role;
  if not public.is_platform_admin() and v_actor_role not in ('organization_owner', 'organization_admin') then
    raise exception 'Member removal unavailable' using errcode = '42501';
  end if;
  delete from public.location_memberships where organization_id = v_target.organization_id and user_id = v_target.user_id;
  delete from public.organization_memberships where id = p_membership_id;
end;
$$;

create function public.transfer_organization_ownership(p_organization_id uuid, p_target_membership_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_current public.organization_memberships%rowtype; v_target public.organization_memberships%rowtype;
begin
  select * into v_current from public.organization_memberships where organization_id = p_organization_id and user_id = auth.uid() and role = 'organization_owner' and status = 'active' for update;
  select * into v_target from public.organization_memberships where id = p_target_membership_id and organization_id = p_organization_id and status = 'active' for update;
  if v_current.id is null or v_target.id is null or v_target.user_id = auth.uid() or v_target.role = 'platform_admin' then
    raise exception 'Ownership transfer unavailable' using errcode = '42501';
  end if;
  perform set_config('app.ownership_transfer', '1', true);
  update public.organization_memberships set role = 'organization_admin', scope = 'organization' where id = v_current.id;
  delete from public.location_memberships where organization_id = p_organization_id and user_id = v_target.user_id;
  update public.organization_memberships set role = 'organization_owner', scope = 'organization' where id = v_target.id;
  insert into public.audit_logs (organization_id, actor_id, actor_database_role, action, table_name, record_id, changed_data)
  values (p_organization_id, auth.uid(), current_user, 'UPDATE', 'ownership_transfer', v_target.id,
    jsonb_build_object('previous_owner_membership_id', v_current.id, 'new_owner_membership_id', v_target.id));
end;
$$;

create function public.protect_final_organization_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'organization_owner' and old.status = 'active'
    and (tg_op = 'DELETE' or new.role <> 'organization_owner' or new.status <> 'active')
    and current_setting('app.ownership_transfer', true) is distinct from '1'
    and (select count(*) from public.organization_memberships om where om.organization_id = old.organization_id and om.role = 'organization_owner' and om.status = 'active') <= 1
  then
    raise exception 'The final active owner cannot be removed or demoted' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger organization_memberships_protect_final_owner
before update or delete on public.organization_memberships
for each row execute function public.protect_final_organization_owner();

create function public.update_organization_settings(
  p_organization_id uuid, p_name_en text, p_name_ar text, p_slug text,
  p_business_category text, p_phone text, p_email text, p_website text,
  p_description_en text, p_description_ar text, p_default_locale public.locale_code,
  p_date_format text, p_number_format text, p_support_email text, p_support_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_old_slug text; v_last_sign_in timestamptz;
begin
  if auth.uid() is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Settings unavailable' using errcode = '42501';
  end if;
  select slug into v_old_slug from public.organizations where id = p_organization_id for update;
  if not found then raise exception 'Settings unavailable' using errcode = '42501'; end if;
  if lower(btrim(p_slug)) <> v_old_slug then
    select last_sign_in_at into v_last_sign_in from auth.users where id = auth.uid();
    if v_last_sign_in is null or v_last_sign_in < timezone('utc', now()) - interval '30 minutes' then
      raise exception 'Recent authentication required' using errcode = '42501';
    end if;
  end if;
  update public.organizations set
    name_en = btrim(p_name_en), name_ar = coalesce(nullif(btrim(p_name_ar), ''), btrim(p_name_en)),
    slug = lower(btrim(p_slug)), business_category = lower(btrim(p_business_category)),
    phone = nullif(btrim(p_phone), ''), email = nullif(lower(btrim(p_email)), ''),
    website = nullif(btrim(p_website), ''), description_en = nullif(btrim(p_description_en), ''),
    description_ar = nullif(btrim(p_description_ar), ''), default_locale = p_default_locale,
    date_format = p_date_format, number_format = p_number_format,
    support_email = nullif(lower(btrim(p_support_email)), ''), support_phone = nullif(btrim(p_support_phone), '')
  where id = p_organization_id;
end;
$$;

create function public.update_organization_branding(
  p_organization_id uuid, p_primary_color text, p_accent_color text,
  p_logo_path text, p_icon_logo_path text, p_dark_logo_path text,
  p_survey_header_style text, p_default_thank_you_en text, p_default_thank_you_ar text,
  p_footer_text_en text, p_footer_text_ar text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Branding unavailable' using errcode = '42501';
  end if;
  update public.organizations set primary_color = p_primary_color, accent_color = p_accent_color,
    logo_path = nullif(p_logo_path, ''), icon_logo_path = nullif(p_icon_logo_path, ''),
    dark_logo_path = nullif(p_dark_logo_path, ''), survey_header_style = p_survey_header_style,
    default_thank_you_en = nullif(btrim(p_default_thank_you_en), ''),
    default_thank_you_ar = nullif(btrim(p_default_thank_you_ar), ''),
    footer_text_en = nullif(btrim(p_footer_text_en), ''), footer_text_ar = nullif(btrim(p_footer_text_ar), '')
  where id = p_organization_id;
  if not found then raise exception 'Branding unavailable' using errcode = '42501'; end if;
end;
$$;

create function public.create_location_v2(
  p_organization_id uuid, p_slug text, p_name_en text, p_name_ar text,
  p_governorate text, p_area text, p_address_en text, p_address_ar text,
  p_phone text, p_email text, p_opening_hours jsonb, p_inherits_timezone boolean,
  p_timezone text default 'Asia/Kuwait'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.can_manage_organization(p_organization_id) then
    raise exception 'Location unavailable' using errcode = '42501';
  end if;
  insert into public.locations (
    organization_id, slug, name_en, name_ar, governorate, area, address_en, address_ar,
    phone, email, opening_hours, inherits_timezone, timezone, created_by
  ) values (
    p_organization_id, lower(btrim(p_slug)), btrim(p_name_en), coalesce(nullif(btrim(p_name_ar), ''), btrim(p_name_en)),
    p_governorate, btrim(p_area), nullif(btrim(p_address_en), ''), nullif(btrim(p_address_ar), ''),
    nullif(btrim(p_phone), ''), nullif(lower(btrim(p_email)), ''), coalesce(p_opening_hours, '{}'::jsonb),
    p_inherits_timezone, p_timezone, auth.uid()
  ) returning id into v_id;
  return v_id;
end;
$$;

create function public.update_location_v2(
  p_location_id uuid, p_slug text, p_name_en text, p_name_ar text,
  p_governorate text, p_area text, p_address_en text, p_address_ar text,
  p_phone text, p_email text, p_opening_hours jsonb, p_inherits_timezone boolean,
  p_timezone text, p_status public.entity_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_org uuid;
begin
  select organization_id into v_org from public.locations where id = p_location_id for update;
  if not found or auth.uid() is null or not public.can_manage_organization(v_org) then
    raise exception 'Location unavailable' using errcode = '42501';
  end if;
  update public.locations set slug = lower(btrim(p_slug)), name_en = btrim(p_name_en),
    name_ar = coalesce(nullif(btrim(p_name_ar), ''), btrim(p_name_en)), governorate = p_governorate,
    area = btrim(p_area), address_en = nullif(btrim(p_address_en), ''), address_ar = nullif(btrim(p_address_ar), ''),
    phone = nullif(btrim(p_phone), ''), email = nullif(lower(btrim(p_email)), ''),
    opening_hours = coalesce(p_opening_hours, '{}'::jsonb), inherits_timezone = p_inherits_timezone,
    timezone = p_timezone, status = p_status where id = p_location_id;
end;
$$;

create function public.update_own_profile(p_display_name text, p_locale public.locale_code)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or char_length(btrim(p_display_name)) not between 1 and 120 then
    raise exception 'Profile update unavailable' using errcode = '22023';
  end if;
  update public.profiles set display_name = btrim(p_display_name), preferred_locale = p_locale where id = auth.uid();
end;
$$;

create function public.deactivate_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '28000'; end if;
  if exists (select 1 from public.organization_memberships where user_id = auth.uid() and role = 'organization_owner' and status = 'active') then
    raise exception 'Transfer organization ownership before deactivating' using errcode = '23514';
  end if;
  update public.profiles set status = 'archived' where id = auth.uid();
  update public.organization_memberships set status = 'archived' where user_id = auth.uid();
  update public.location_memberships set status = 'archived' where user_id = auth.uid();
  insert into public.audit_logs (actor_id, actor_database_role, action, table_name, record_id, changed_data)
  values (auth.uid(), current_user, 'UPDATE', 'account_deactivation', auth.uid(), jsonb_build_object('status', 'archived'));
end;
$$;

create function public.get_platform_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'Platform access denied' using errcode = '42501'; end if;
  return jsonb_build_object(
    'organizations', coalesce((select jsonb_agg(jsonb_build_object(
      'id', o.id, 'slug', o.slug, 'name_en', o.name_en, 'name_ar', o.name_ar,
      'status', o.status, 'created_at', o.created_at,
      'member_count', (select count(*) from public.organization_memberships om where om.organization_id = o.id and om.status = 'active'),
      'location_count', (select count(*) from public.locations l where l.organization_id = o.id),
      'survey_count', (select count(*) from public.surveys s where s.organization_id = o.id),
      'response_count', (select count(*) from public.survey_responses sr where sr.organization_id = o.id),
      'storage_objects', (select count(*) from storage.objects so where so.bucket_id = 'organization-branding' and (storage.foldername(so.name))[1] = o.id::text)
    ) order by o.created_at desc) from public.organizations o), '[]'::jsonb),
    'active_organizations', (select count(*) from public.organizations where status = 'active'),
    'inactive_organizations', (select count(*) from public.organizations where status = 'archived')
  );
end;
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-branding', 'organization-branding', false, 2097152,
  array['image/png', 'image/jpeg', 'image/webp']
) on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy organization_branding_read_permitted
on storage.objects for select to authenticated
using (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_read_organization(((storage.foldername(name))[1])::uuid)
);

create policy organization_branding_public_referenced_read
on storage.objects for select to anon
using (
  bucket_id = 'organization-branding'
  and exists (
    select 1 from public.organizations o
    where o.status = 'active'
      and (storage.foldername(name))[1] = o.id::text
      and name in (o.logo_path, o.icon_logo_path, o.dark_logo_path)
  )
);

create policy organization_branding_insert_managed
on storage.objects for insert to authenticated
with check (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
  and coalesce(metadata ->> 'mimetype', '') in ('image/png', 'image/jpeg', 'image/webp')
  and coalesce((metadata ->> 'size')::bigint, 0) between 1 and 2097152
);

create policy organization_branding_update_managed
on storage.objects for update to authenticated
using (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$'
);

create policy organization_branding_delete_managed
on storage.objects for delete to authenticated
using (
  bucket_id = 'organization-branding'
  and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.can_manage_organization(((storage.foldername(name))[1])::uuid)
);

create or replace function public.get_public_survey(p_public_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  select jsonb_build_object(
    'public_slug', s.public_slug,
    'title', jsonb_build_object('en', s.title_en, 'ar', s.title_ar),
    'description', jsonb_build_object('en', s.description_en, 'ar', s.description_ar),
    'thank_you', jsonb_build_object('en', coalesce(s.thank_you_en, o.default_thank_you_en), 'ar', coalesce(s.thank_you_ar, o.default_thank_you_ar)),
    'default_locale', s.default_locale,
    'organization', jsonb_build_object(
      'name', jsonb_build_object('en', o.name_en, 'ar', o.name_ar),
      'branding', jsonb_build_object('primary_color', o.primary_color, 'accent_color', o.accent_color,
        'logo_path', o.logo_path, 'header_style', o.survey_header_style,
        'footer', jsonb_build_object('en', o.footer_text_en, 'ar', o.footer_text_ar))
    ),
    'location', jsonb_build_object('name', jsonb_build_object('en', l.name_en, 'ar', l.name_ar)),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'type', q.question_type, 'position', q.position,
      'prompt', jsonb_build_object('en', q.prompt_en, 'ar', q.prompt_ar),
      'help_text', jsonb_build_object('en', q.help_text_en, 'ar', q.help_text_ar),
      'required', q.is_required, 'rating_min', q.rating_min, 'rating_max', q.rating_max,
      'allow_multiple', false, 'text_max_length', q.text_max_length,
      'options', case when q.question_type = 'multiple_choice' then coalesce((
        select jsonb_agg(jsonb_build_object('id', so.id, 'position', so.position,
          'label', jsonb_build_object('en', so.label_en, 'ar', so.label_ar)) order by so.position)
        from public.survey_question_options so where so.question_id = q.id and so.is_active
      ), '[]'::jsonb) else '[]'::jsonb end
    ) order by q.position) from public.survey_questions q where q.survey_id = s.id and q.status = 'active'), '[]'::jsonb)
  ) into v_result
  from public.surveys s join public.locations l on l.id = s.location_id
  join public.organizations o on o.id = s.organization_id
  where s.public_slug = p_public_slug and s.status = 'active' and l.status = 'active' and o.status = 'active';
  if v_result is null then raise exception 'Published survey not found' using errcode = 'P0002'; end if;
  return v_result;
end;
$$;

revoke execute on function public.consume_invitation_rate_limit(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.prepare_organization_invitation_v2(uuid, text, public.app_role, uuid[], interval, text, public.locale_code) from public, anon;
revoke execute on function public.resend_organization_invitation(uuid) from public, anon;
revoke execute on function public.record_invitation_delivery(uuid, public.invitation_delivery_status, text) from public, anon;
revoke execute on function public.record_invitation_acceptance_failure(text, text) from public, anon;
revoke execute on function public.list_team_members(uuid, text, public.app_role, uuid, integer, integer) from public, anon;
revoke execute on function public.list_team_invitations(uuid) from public, anon;
revoke execute on function public.get_invitation_public(text) from public;
revoke execute on function public.update_organization_member(uuid, public.app_role, uuid[], public.entity_status) from public, anon;
revoke execute on function public.remove_organization_member(uuid) from public, anon;
revoke execute on function public.transfer_organization_ownership(uuid, uuid) from public, anon;
revoke execute on function public.update_organization_settings(uuid, text, text, text, text, text, text, text, text, text, public.locale_code, text, text, text, text) from public, anon;
revoke execute on function public.update_organization_branding(uuid, text, text, text, text, text, text, text, text, text, text) from public, anon;
revoke execute on function public.create_location_v2(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text) from public, anon;
revoke execute on function public.update_location_v2(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, public.entity_status) from public, anon;
revoke execute on function public.update_own_profile(text, public.locale_code) from public, anon;
revoke execute on function public.deactivate_own_account() from public, anon;
revoke execute on function public.get_platform_overview() from public, anon;

grant execute on function public.prepare_organization_invitation_v2(uuid, text, public.app_role, uuid[], interval, text, public.locale_code) to authenticated;
grant execute on function public.resend_organization_invitation(uuid) to authenticated;
grant execute on function public.record_invitation_delivery(uuid, public.invitation_delivery_status, text) to authenticated;
grant execute on function public.record_invitation_acceptance_failure(text, text) to authenticated;
grant execute on function public.list_team_members(uuid, text, public.app_role, uuid, integer, integer) to authenticated;
grant execute on function public.list_team_invitations(uuid) to authenticated;
grant execute on function public.get_invitation_public(text) to anon, authenticated;
grant execute on function public.update_organization_member(uuid, public.app_role, uuid[], public.entity_status) to authenticated;
grant execute on function public.remove_organization_member(uuid) to authenticated;
grant execute on function public.transfer_organization_ownership(uuid, uuid) to authenticated;
grant execute on function public.update_organization_settings(uuid, text, text, text, text, text, text, text, text, text, public.locale_code, text, text, text, text) to authenticated;
grant execute on function public.update_organization_branding(uuid, text, text, text, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.create_location_v2(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text) to authenticated;
grant execute on function public.update_location_v2(uuid, text, text, text, text, text, text, text, text, text, jsonb, boolean, text, public.entity_status) to authenticated;
grant execute on function public.update_own_profile(text, public.locale_code) to authenticated;
grant execute on function public.deactivate_own_account() to authenticated;
grant execute on function public.get_platform_overview() to authenticated;

comment on table public.invitation_rate_limits is 'Opaque hashed per-email invitation throttles. No client privileges.';
comment on function public.get_platform_overview is 'Read-only platform summary; intentionally excludes survey answer text.';
