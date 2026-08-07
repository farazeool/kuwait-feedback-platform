-- Get corrective action statistics for dashboard
create or replace function public.get_corrective_action_stats(
  p_organization_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_stats jsonb;
begin
  if not public.can_read_organization(p_organization_id) then
    raise exception 'Access denied' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total', count(*)::integer,
    'open', count(*) filter (where status = 'open')::integer,
    'in_progress', count(*) filter (where status = 'in_progress')::integer,
    'pending_verification', count(*) filter (where status = 'pending_verification')::integer,
    'verified', count(*) filter (where status = 'verified')::integer,
    'closed', count(*) filter (where status = 'closed')::integer,
    'overdue', count(*) filter (where status not in ('closed', 'verified') and due_date < current_date)::integer,
    'by_priority', coalesce((
      select jsonb_agg(jsonb_build_object('priority', priority, 'count', cnt) order by
        case priority when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end desc
      )
      from (
        select priority, count(*)::integer cnt
        from public.corrective_actions
        where organization_id = p_organization_id
        group by priority
      ) t
    ), '[]'::jsonb),
    'by_status', coalesce((
      select jsonb_agg(jsonb_build_object('status', status, 'count', cnt) order by status)
      from (
        select status, count(*)::integer cnt
        from public.corrective_actions
        where organization_id = p_organization_id
        group by status
      ) t
    ), '[]'::jsonb)
  ) into v_stats
  from public.corrective_actions
  where organization_id = p_organization_id;

  return v_stats;
end;
$$;

revoke execute on function public.get_corrective_action_stats(uuid) from public, anon;
grant execute on function public.get_corrective_action_stats(uuid) to authenticated;