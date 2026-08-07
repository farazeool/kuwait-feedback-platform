-- Read-only badge lookup for the public signature-image route.
--
-- The image route runs as the anon role, which has no SELECT on
-- public.distribution_assignments (by design — anon must not enumerate
-- assignments). Without a privileged path the route's direct table query
-- returns null and every badge renders the inactive placeholder.
--
-- This SECURITY DEFINER RPC resolves an assignment by its public_token and
-- returns ONLY the fields the badge needs: whether it is currently active and
-- the template's render_config (branding). It never exposes the internal
-- assignment id, subject_id, or any other row. It has no side effects, so it is
-- safe to call on every email-client image prefetch (unlike issue_rating_nonce,
-- which mints a nonce).

create or replace function public.get_signature_badge(
  p_public_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
begin
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  -- Any invalid/inactive/expired state renders the neutral placeholder.
  if not found
    or v_assignment.status in ('revoked', 'expired')
    or (v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()))
  then
    return jsonb_build_object('active', false);
  end if;

  return jsonb_build_object(
    'active', true,
    'render_config', coalesce(
      (
        select render_config
        from public.distribution_templates
        where id = v_assignment.template_id
      ),
      '{}'::jsonb
    )
  );
end;
$$;

revoke all on function public.get_signature_badge(text) from public;
grant execute on function public.get_signature_badge(text) to anon, authenticated;
