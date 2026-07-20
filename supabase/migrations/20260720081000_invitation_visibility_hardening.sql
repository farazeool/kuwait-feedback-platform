-- Invitation tokens remain opaque to every ordinary database client.
-- Owners/admins operate invitations only through narrowly granted functions.

revoke select on public.organization_invitations from authenticated;
revoke select on public.organization_invitation_locations from authenticated;

drop policy if exists organization_invitations_platform_admin_read
  on public.organization_invitations;
drop policy if exists organization_invitations_tenant_admin_read
  on public.organization_invitations;
drop policy if exists organization_invitation_locations_platform_admin_read
  on public.organization_invitation_locations;
drop policy if exists organization_invitation_locations_tenant_admin_read
  on public.organization_invitation_locations;

comment on table public.organization_invitations is
  'Opaque invitation store. Ordinary clients use trusted functions and cannot read token digests.';
