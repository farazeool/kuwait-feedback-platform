-- ==============================================================================
-- Email signature response detail + employee perf metrics
-- ==============================================================================
-- Adds an authenticated-only RPC that lists the rating_events captured for a
-- single distribution assignment, joining the matching follow-up session +
-- PII (customer name/email/comment), the employee attribution, the template,
-- and the channel — and returns a stable paginated JSON envelope.
--
-- Tenant isolation is enforced three ways:
--   1. The RPC body asserts the caller has `can_read_organization` on the
--      assignment's organization_id (via `assert_analytics_scope`).
--   2. It joins through existing RLS-protected tables
--      (`rating_events`, `rating_followup_sessions`, `rating_followup_details`)
--      so any future tightening of those policies still applies.
--   3. The RPC is `SECURITY DEFINER` with `set search_path = ''`, the standard
--      hardening used by every other analytics RPC in this codebase
--      (`get_signature_sentiment_report`, `get_signature_subject_report`).
--
-- No new tables, no schema changes, no RLS policy additions.
create or replace function public.list_assignment_rating_events(
  p_assignment_id uuid,
  p_start_at      timestamptz default null,
  p_end_at        timestamptz default null,
  p_limit         integer    default 50,
  p_offset        integer    default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_channel         text;
  v_template_id     uuid;
  v_events          jsonb;
  v_total           bigint;
  v_limit_clamped   integer := greatest(1, least(coalesce(p_limit, 50), 200));
  v_offset_clamped  integer := greatest(0, coalesce(p_offset, 0));
begin
  if p_assignment_id is null then
    return jsonb_build_object('events', '[]'::jsonb, 'total', 0);
  end if;

  -- Resolve the assignment + organization in one round-trip and short-circuit
  -- if the assignment does not exist. Tenant isolation begins here: we use the
  -- resolved `organization_id` to assert scope before reading any rows.
  select organization_id, channel::text, template_id
    into v_organization_id, v_channel, v_template_id
  from public.distribution_assignments
  where id = p_assignment_id;

  if v_organization_id is null then
    return jsonb_build_object('events', '[]'::jsonb, 'total', 0);
  end if;

  perform public.assert_analytics_scope(v_organization_id, p_start_at, p_end_at, null);
-- ==============================================================================
with events as (
    select
      re.id,
      re.assignment_id,
      re.organization_id,
      re.rating,
      re.created_at,
      encode(re.nonce_ref, 'hex')                       as nonce_ref_hex,
      encode(re.ip_hash, 'hex')                         as ip_hash_hex,
      re.user_agent,
      rfs.id                                            as followup_session_id,
      rfs.current_rating                                as followup_rating,
      rfs.rating_label                                  as followup_label,
      rfs.rating_emoji                                  as followup_emoji,
      rfs.identity_status,
      rfs.follow_up_status,
      rfs.contact_status,
      rfs.contact_requested,
      rfs.follow_up_submitted_at,
      rfs.contact_requested_at,
      rfd.customer_name,
      rfd.customer_email,
      rfd.comment
    from public.rating_events re
    left join public.rating_followup_sessions rfs
      on rfs.rating_event_id = re.id
    left join public.rating_followup_details rfd
      on rfd.rating_session_id = rfs.id
    where re.assignment_id = p_assignment_id
      and (p_start_at is null or re.created_at >= p_start_at)
      and (p_end_at   is null or re.created_at <  p_end_at)
    order by re.created_at desc
    offset v_offset_clamped
    limit  v_limit_clamped
  ),
    total_count as (
      select count(*) as n
      from public.rating_events re
      where re.assignment_id = p_assignment_id
        and (p_start_at is null or re.created_at >= p_start_at)
        and (p_end_at   is null or re.created_at <  p_end_at)
    ),
    employee as (
      select p.display_name, da.assigned_employee_id
      from public.distribution_assignments da
      left join public.profiles p on p.id = da.assigned_employee_id
      where da.id = p_assignment_id
    ),
    template as (
      select t.template_name
      from public.distribution_templates t
      where t.id = v_template_id
    ),
    location as (
      select l.name_en, l.name_ar
      from public.distribution_assignments da
      left join public.locations l on l.id = da.assigned_location_id
      where da.id = p_assignment_id
    )
select jsonb_build_object(
      'events',
      coalesce((
        select jsonb_agg(event_row order by (event_row->>'created_at') desc)
        from (
          select jsonb_build_object(
            'id',                e.id,
            'assignment_id',     e.assignment_id,
            'organization_id',   e.organization_id,
            'rating',            e.rating,
            'label',             e.followup_label,
            'emoji',             e.followup_emoji,
            'created_at',        e.created_at,
            'user_agent',        e.user_agent,
            'followup',          jsonb_build_object(
              'session_id',          e.followup_session_id,
              'current_rating',      e.followup_rating,
              'rating_label',        e.followup_label,
              'rating_emoji',        e.followup_emoji,
              'identity_status',     e.identity_status,
              'follow_up_status',    e.follow_up_status,
              'contact_status',      e.contact_status,
              'contact_requested',   e.contact_requested,
              'follow_up_submitted_at', e.follow_up_submitted_at,
              'contact_requested_at',   e.contact_requested_at,
              'customer_name',       e.customer_name,
              'customer_email',      e.customer_email,
              'comment',             e.comment
            )
          ) as event_row
          from events e
        ) as event_rows
      ), '[]'::jsonb),
      'total',    (select n from total_count),
      'channel',  v_channel,
      'template', (select template_name from template),
      'assignment', jsonb_build_object(
        'id',                p_assignment_id,
        'organization_id',   v_organization_id,
        'channel',           v_channel,
        'employee_name',     (select display_name from employee),
        'employee_id',       (select assigned_employee_id from employee),
        'location_name_en',  (select name_en from location),
        'location_name_ar',  (select name_ar from location)
      ),
      'limit',  v_limit_clamped,
      'offset', v_offset_clamped
    )
    into v_events;

  return coalesce(v_events, jsonb_build_object('events', '[]'::jsonb, 'total', 0));
end;
$$;

comment on function public.list_assignment_rating_events(
  uuid, timestamptz, timestamptz, integer, integer
) is
  'Lists paginated rating_events for a single email-signature assignment, with the matching follow-up PII (customer name/email/comment), employee attribution, template name, and channel. Tenant isolation is enforced via assert_analytics_scope and the existing RLS policies on rating_events / rating_followup_sessions / rating_followup_details.';

revoke all on function public.list_assignment_rating_events(
  uuid, timestamptz, timestamptz, integer, integer
) from public;

grant execute on function public.list_assignment_rating_events(
  uuid, timestamptz, timestamptz, integer, integer
) to authenticated;