-- Add quality_manager and senior_management to database authorization functions.
-- Forward-only additive migration.

-- ---------------------------------------------------------------------------
-- can_read_organization: quality_manager and senior_management can read
-- ---------------------------------------------------------------------------
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
          om.role in ('organization_owner', 'organization_admin', 'quality_manager', 'senior_management')
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

-- ---------------------------------------------------------------------------
-- can_manage_organization: quality_manager can manage (writes allowed)
-- senior_management stays read-only
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_organization(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_platform_admin()
    or public.organization_role(p_organization_id) in (
      'organization_owner',
      'organization_admin',
      'quality_manager'
    );
$$;

-- ---------------------------------------------------------------------------
-- can_access_location: both roles can access locations
-- ---------------------------------------------------------------------------
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
          om.role in ('organization_owner', 'organization_admin', 'quality_manager', 'senior_management')
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

-- ---------------------------------------------------------------------------
-- Update can_manage_response: quality_manager can manage responses
-- (preserves original location_manager access)
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_response(
  p_response_id uuid
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
      from public.survey_responses sr
      where sr.id = p_response_id
        and (
          public.can_manage_organization(sr.organization_id)
          or exists (
            select 1
            from public.location_memberships lm
            where lm.location_id = sr.location_id
              and lm.user_id = auth.uid()
              and lm.status = 'active'
              and lm.role = 'location_manager'
          )
        )
    );
$$;

-- ---------------------------------------------------------------------------
-- Update can_manage_alert: quality_manager can manage alerts
-- ---------------------------------------------------------------------------
create or replace function public.can_manage_alert(
  p_alert_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.alerts a
    where a.id = p_alert_id
      and (
        public.can_manage_organization(a.organization_id)
        or exists (
          select 1
          from public.organization_memberships om
          where om.organization_id = a.organization_id
            and om.user_id = auth.uid()
            and om.status = 'active'
            and om.role in ('organization_owner', 'organization_admin', 'quality_manager')
        )
      )
  );
$$;
