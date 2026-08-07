-- Feedback follow-up workflow for InstaView email-signature ratings.
-- Adds opaque continuation tokens, optional follow-up details, and
-- sentiment reporting without exposing PII through public identifiers.

-- ============================================================================
-- Rating follow-up session state
-- ============================================================================

create table public.rating_followup_sessions (
  id uuid primary key default gen_random_uuid(),
  rating_event_id uuid not null unique references public.rating_events (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  assignment_id uuid not null references public.distribution_assignments (id) on delete cascade,
  original_rating integer not null check (original_rating between 1 and 5),
  original_label text not null check (original_label in ('Bad', 'Poor', 'Average', 'Good', 'Excellent')),
  original_emoji text not null check (original_emoji in ('😡', '😞', '😐', '🙂', '😊')),
  current_rating integer not null check (current_rating between 1 and 5),
  rating_label text not null check (rating_label in ('Bad', 'Poor', 'Average', 'Good', 'Excellent')),
  rating_emoji text not null check (rating_emoji in ('😡', '😞', '😐', '🙂', '😊')),
  identity_status text not null default 'anonymous' check (identity_status in ('anonymous', 'self_reported', 'verified_recipient', 'authenticated_customer')),
  follow_up_status text not null default 'open' check (follow_up_status in ('open', 'submitted', 'skipped', 'abandoned')),
  contact_status text not null default 'new' check (contact_status in ('new', 'contact_pending', 'contacted', 'resolved', 'closed')),
  contact_requested boolean not null default false,
  follow_up_submitted_at timestamptz,
  contact_requested_at timestamptz,
  contact_notified_at timestamptz,
  notification_state text not null default 'pending' check (notification_state in ('pending', 'sent', 'failed', 'suppressed')),
  continuation_token_hash bytea not null unique,
  continuation_token_expires_at timestamptz not null,
  continuation_token_consumed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index rating_followup_sessions_org_created_idx on public.rating_followup_sessions (organization_id, created_at desc);
create index rating_followup_sessions_assignment_idx on public.rating_followup_sessions (assignment_id, created_at desc);
create index rating_followup_sessions_contact_idx on public.rating_followup_sessions (organization_id, contact_status, created_at desc)
  where contact_requested;
create index rating_followup_sessions_follow_up_status_idx on public.rating_followup_sessions (organization_id, follow_up_status, created_at desc);

alter table public.rating_followup_sessions enable row level security;
alter table public.rating_followup_sessions force row level security;

create policy rfs_platform_admin_all on public.rating_followup_sessions for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy rfs_read_permitted on public.rating_followup_sessions for select to authenticated
  using (public.can_read_organization(organization_id));
create policy rfs_insert_via_rpc on public.rating_followup_sessions for insert to authenticated
  with check (false);
create policy rfs_update_via_rpc on public.rating_followup_sessions for update to authenticated
  using (false) with check (false);

revoke all on public.rating_followup_sessions from anon;

-- Optional PII lives in a separate table so retention and access can stay narrow.
create table public.rating_followup_details (
  rating_session_id uuid primary key references public.rating_followup_sessions (id) on delete cascade,
  customer_name text check (customer_name is null or char_length(btrim(customer_name)) between 1 and 120),
  customer_email text check (customer_email is null or char_length(btrim(customer_email)) between 3 and 320),
  comment text check (comment is null or char_length(btrim(comment)) <= 2000),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.rating_followup_details enable row level security;
alter table public.rating_followup_details force row level security;

create policy rfd_platform_admin_all on public.rating_followup_details for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy rfd_read_permitted on public.rating_followup_details for select to authenticated
  using (
    exists (
      select 1
      from public.rating_followup_sessions rfs
      where rfs.id = rating_session_id
        and public.can_read_organization(rfs.organization_id)
    )
  );
create policy rfd_write_via_rpc on public.rating_followup_details for insert to authenticated
  with check (false);
create policy rfd_update_via_rpc on public.rating_followup_details for update to authenticated
  using (false) with check (false);

revoke all on public.rating_followup_details from anon;

-- ============================================================================
-- Shared helpers
-- ============================================================================

create or replace function public.rating_label_from_value(p_rating integer)
returns text
language sql
immutable
as $$
  select case p_rating
    when 1 then 'Bad'
    when 2 then 'Poor'
    when 3 then 'Average'
    when 4 then 'Good'
    when 5 then 'Excellent'
  end;
$$;

create or replace function public.rating_emoji_from_value(p_rating integer)
returns text
language sql
immutable
as $$
  select case p_rating
    when 1 then '😡'
    when 2 then '😞'
    when 3 then '😐'
    when 4 then '🙂'
    when 5 then '😊'
  end;
$$;

-- ============================================================================
-- Extend nonce issuance with safe public context
-- ============================================================================

create or replace function public.issue_rating_nonce(
  p_public_token     text,
  p_fingerprint_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
  v_nonce      text;
  v_nonce_hash bytea;
begin
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found
    or v_assignment.status in ('revoked', 'expired')
    or (v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()))
  then
    return jsonb_build_object('ok', true);
  end if;

  if p_fingerprint_hash is not null
    and p_fingerprint_hash ~ '^[0-9a-f]{64}$'
    and not public.consume_rating_rate_limit(v_assignment.id, p_fingerprint_hash, 10, 900)
  then
    return jsonb_build_object('ok', true);
  end if;

  v_nonce := encode(extensions.gen_random_bytes(18), 'hex');
  v_nonce_hash := extensions.digest(v_nonce, 'sha256');

  insert into public.feedback_rating_nonces (nonce_hash, assignment_id, expires_at)
  values (v_nonce_hash, v_assignment.id, timezone('utc', now()) + interval '30 minutes');

  return jsonb_build_object(
    'ok', true,
    'nonce', v_nonce,
    'rating_style', (
      select render_config->>'ratingStyle'
      from public.distribution_templates
      where id = v_assignment.template_id
    ),
    'organization_name_en', (select name_en from public.organizations where id = v_assignment.organization_id),
    'organization_name_ar', (select name_ar from public.organizations where id = v_assignment.organization_id),
    'employee_name_en', (
      select p.display_name
      from public.profiles p
      where p.id = v_assignment.assigned_employee_id
    ),
    'employee_name_ar', (
      select p.display_name
      from public.profiles p
      where p.id = v_assignment.assigned_employee_id
    ),
    'location_name_en', (
      select l.name_en
      from public.locations l
      where l.id = v_assignment.assigned_location_id
    ),
    'location_name_ar', (
      select l.name_ar
      from public.locations l
      where l.id = v_assignment.assigned_location_id
    ),
    'template_name_en', (select t.template_name from public.distribution_templates t where t.id = v_assignment.template_id)
  );
end;
$$;

-- ============================================================================
-- Persist initial rating and create follow-up session
-- ============================================================================

create or replace function public.record_rating(
  p_public_token     text,
  p_rating           integer,
  p_nonce            text,
  p_fingerprint_hash text default null,
  p_user_agent       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment  public.distribution_assignments%rowtype;
  v_nonce_hash  bytea;
  v_consumed    bytea;
  v_ip_hash     bytea;
  v_rating_event_id uuid;
  v_followup_token text;
  v_followup_token_hash bytea;
  v_current_label text;
  v_current_emoji text;
begin
  if p_rating not between 1 and 5 then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;

  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found
    or v_assignment.status not in ('active', 'paused')
    or (v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()))
  then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;

  if p_fingerprint_hash is not null
    and p_fingerprint_hash ~ '^[0-9a-f]{64}$'
    and not public.consume_rating_rate_limit(v_assignment.id, p_fingerprint_hash, 5, 900)
  then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
  end if;

  v_nonce_hash := extensions.digest(p_nonce, 'sha256');

  update public.feedback_rating_nonces
  set consumed_at = timezone('utc', now())
  where nonce_hash = v_nonce_hash
    and assignment_id = v_assignment.id
    and consumed_at is null
    and expires_at > timezone('utc', now())
  returning nonce_hash into v_consumed;

  if v_consumed is null then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;

  if p_fingerprint_hash is not null and p_fingerprint_hash ~ '^[0-9a-f]{64}$' then
    v_ip_hash := decode(p_fingerprint_hash, 'hex');
  end if;

  insert into public.rating_events (
    assignment_id, organization_id, rating, ip_hash, user_agent, nonce_ref
  ) values (
    v_assignment.id,
    v_assignment.organization_id,
    p_rating,
    v_ip_hash,
    left(p_user_agent, 200),
    v_consumed
  )
  returning id into v_rating_event_id;

  v_followup_token := encode(extensions.gen_random_bytes(18), 'hex');
  v_followup_token_hash := extensions.digest(v_followup_token, 'sha256');
  v_current_label := public.rating_label_from_value(p_rating);
  v_current_emoji := public.rating_emoji_from_value(p_rating);

  insert into public.rating_followup_sessions (
    rating_event_id,
    organization_id,
    assignment_id,
    original_rating,
    original_label,
    original_emoji,
    current_rating,
    rating_label,
    rating_emoji,
    continuation_token_hash,
    continuation_token_expires_at
  ) values (
    v_rating_event_id,
    v_assignment.organization_id,
    v_assignment.id,
    p_rating,
    v_current_label,
    v_current_emoji,
    p_rating,
    v_current_label,
    v_current_emoji,
    v_followup_token_hash,
    timezone('utc', now()) + interval '24 hours'
  );

  update public.distribution_assignments
  set response_count = response_count + 1,
      last_response_at = timezone('utc', now())
  where id = v_assignment.id;

  return jsonb_build_object(
    'ok', true,
    'recorded', true,
    'continuation_token', v_followup_token,
    'rating_value', p_rating,
    'rating_label', v_current_label,
    'rating_emoji', v_current_emoji
  );
end;
$$;

-- ============================================================================
-- Follow-up lookup + update
-- ============================================================================

create or replace function public.get_rating_followup_context(
  p_public_token text,
  p_continuation_token text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
  v_session public.rating_followup_sessions%rowtype;
begin
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  select * into v_session
  from public.rating_followup_sessions
  where assignment_id = v_assignment.id
    and continuation_token_hash = extensions.digest(p_continuation_token, 'sha256')
    and continuation_token_expires_at > timezone('utc', now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  return jsonb_build_object(
    'ok', true,
    'organization_name_en', (select name_en from public.organizations where id = v_assignment.organization_id),
    'organization_name_ar', (select name_ar from public.organizations where id = v_assignment.organization_id),
    'employee_name_en', (
      select p.display_name from public.profiles p where p.id = v_assignment.assigned_employee_id
    ),
    'employee_name_ar', (
      select p.display_name from public.profiles p where p.id = v_assignment.assigned_employee_id
    ),
    'location_name_en', (
      select l.name_en from public.locations l where l.id = v_assignment.assigned_location_id
    ),
    'location_name_ar', (
      select l.name_ar from public.locations l where l.id = v_assignment.assigned_location_id
    ),
    'rating_value', v_session.current_rating,
    'rating_label', v_session.rating_label,
    'rating_emoji', v_session.rating_emoji,
    'identity_status', v_session.identity_status,
    'follow_up_status', v_session.follow_up_status,
    'contact_status', v_session.contact_status,
    'contact_requested', v_session.contact_requested,
    'follow_up_submitted_at', v_session.follow_up_submitted_at,
    'contact_requested_at', v_session.contact_requested_at,
    'notification_state', v_session.notification_state,
    'customer_name', (
      select d.customer_name from public.rating_followup_details d where d.rating_session_id = v_session.id
    ),
    'customer_email', (
      select d.customer_email from public.rating_followup_details d where d.rating_session_id = v_session.id
    ),
    'comment', (
      select d.comment from public.rating_followup_details d where d.rating_session_id = v_session.id
    )
  );
end;
$$;

create or replace function public.submit_rating_followup(
  p_public_token text,
  p_continuation_token text,
  p_rating integer default null,
  p_customer_name text default null,
  p_customer_email text default null,
  p_comment text default null,
  p_contact_requested boolean default false,
  p_skip boolean default false,
  p_fingerprint_hash text default null,
  p_user_agent text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
  v_session public.rating_followup_sessions%rowtype;
  v_token_hash bytea;
  v_label text;
  v_emoji text;
begin
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  v_token_hash := extensions.digest(p_continuation_token, 'sha256');

  select * into v_session
  from public.rating_followup_sessions
  where assignment_id = v_assignment.id
    and continuation_token_hash = v_token_hash
    and continuation_token_expires_at > timezone('utc', now())
  limit 1;

  if not found then
    return jsonb_build_object('ok', false);
  end if;

  if p_rating is not null then
    if p_rating not between 1 and 5 then
      raise exception 'Invalid rating' using errcode = '22023';
    end if;
    v_label := public.rating_label_from_value(p_rating);
    v_emoji := public.rating_emoji_from_value(p_rating);
    update public.rating_followup_sessions
    set current_rating = p_rating,
        rating_label = v_label,
        rating_emoji = v_emoji,
        updated_at = timezone('utc', now())
    where id = v_session.id;
  end if;

  if p_skip then
    update public.rating_followup_sessions
    set follow_up_status = 'skipped',
        contact_status = case when contact_requested then 'contact_pending' else contact_status end,
        updated_at = timezone('utc', now())
    where id = v_session.id;

    return jsonb_build_object('ok', true, 'follow_up_status', 'skipped', 'rating_value', coalesce(p_rating, v_session.current_rating));
  end if;

  if p_contact_requested and coalesce(btrim(p_customer_email), '') = '' then
    raise exception 'Email required when contact is requested' using errcode = '22023';
  end if;

  insert into public.rating_followup_details (
    rating_session_id,
    customer_name,
    customer_email,
    comment
  ) values (
    v_session.id,
    nullif(btrim(p_customer_name), ''),
    nullif(btrim(p_customer_email), ''),
    nullif(btrim(p_comment), '')
  )
  on conflict (rating_session_id) do update
    set customer_name = excluded.customer_name,
        customer_email = excluded.customer_email,
        comment = excluded.comment,
        updated_at = timezone('utc', now());

  update public.rating_followup_sessions
  set identity_status = case
        when coalesce(btrim(p_customer_name), '') <> '' or coalesce(btrim(p_customer_email), '') <> '' then 'self_reported'
        else 'anonymous'
      end,
      contact_requested = p_contact_requested,
      follow_up_status = 'submitted',
      contact_status = case
        when p_contact_requested then 'contact_pending'
        else contact_status
      end,
      follow_up_submitted_at = coalesce(follow_up_submitted_at, timezone('utc', now())),
      contact_requested_at = case
        when p_contact_requested and contact_requested_at is null then timezone('utc', now())
        else contact_requested_at
      end,
      notification_state = case
        when p_contact_requested then 'pending'
        else notification_state
      end,
      updated_at = timezone('utc', now())
  where id = v_session.id;

  return jsonb_build_object(
    'ok', true,
    'follow_up_status', 'submitted',
    'contact_status', case when p_contact_requested then 'contact_pending' else v_session.contact_status end,
    'identity_status', case when coalesce(btrim(p_customer_name), '') <> '' or coalesce(btrim(p_customer_email), '') <> '' then 'self_reported' else 'anonymous' end,
    'rating_value', coalesce(p_rating, v_session.current_rating),
    'rating_label', coalesce(public.rating_label_from_value(p_rating), v_session.rating_label),
    'rating_emoji', coalesce(public.rating_emoji_from_value(p_rating), v_session.rating_emoji)
  );
end;
$$;

create or replace function public.get_signature_sentiment_report(
  p_organization_id uuid,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_employee_id uuid default null,
  p_location_id uuid default null,
  p_sentiment text default null,
  p_identity_status text default null,
  p_contact_requested boolean default null,
  p_follow_up_completed boolean default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform public.assert_analytics_scope(p_organization_id, p_start_at, p_end_at, p_location_id);

  with scoped as (
    select
      rfs.*,
      da.assigned_employee_id,
      da.assigned_location_id,
      da.channel,
      da.template_id,
      coalesce(d.customer_name, '') as customer_name,
      coalesce(d.customer_email, '') as customer_email,
      coalesce(d.comment, '') as comment,
      case when coalesce(d.comment, '') <> '' then true else false end as has_comment
    from public.rating_followup_sessions rfs
    join public.rating_events re on re.id = rfs.rating_event_id
    join public.distribution_assignments da on da.id = rfs.assignment_id
    left join public.rating_followup_details d on d.rating_session_id = rfs.id
    where rfs.organization_id = p_organization_id
      and re.created_at >= p_start_at and re.created_at < p_end_at
      and (p_employee_id is null or da.assigned_employee_id = p_employee_id)
      and (p_location_id is null or da.assigned_location_id = p_location_id)
      and (p_sentiment is null or rfs.rating_label = p_sentiment)
      and (p_identity_status is null or rfs.identity_status = p_identity_status)
      and (p_contact_requested is null or rfs.contact_requested = p_contact_requested)
      and (p_follow_up_completed is null or (p_follow_up_completed and rfs.follow_up_status in ('submitted', 'skipped')) or (not p_follow_up_completed and rfs.follow_up_status not in ('submitted', 'skipped')))
  )
  select jsonb_build_object(
    'total_responses', count(*),
    'average_rating', round(avg(current_rating)::numeric, 2),
    'rating_counts', jsonb_build_object(
      'bad', count(*) filter (where current_rating = 1),
      'poor', count(*) filter (where current_rating = 2),
      'average', count(*) filter (where current_rating = 3),
      'good', count(*) filter (where current_rating = 4),
      'excellent', count(*) filter (where current_rating = 5)
    ),
    'identity_counts', jsonb_build_object(
      'anonymous', count(*) filter (where identity_status = 'anonymous'),
      'self_reported', count(*) filter (where identity_status = 'self_reported')
    ),
    'comment_rate', case when count(*) > 0 then round(count(*) filter (where has_comment)::numeric / count(*) * 100, 2) else null end,
    'contact_requested_count', count(*) filter (where contact_requested),
    'unresolved_contact_requests', count(*) filter (where contact_requested and contact_status in ('new', 'contact_pending')),
    'follow_up_completion_rate', case when count(*) > 0 then round(count(*) filter (where follow_up_status in ('submitted', 'skipped'))::numeric / count(*) * 100, 2) else null end,
    'by_location', coalesce((
      select jsonb_agg(location_row order by (location_row->>'count')::int desc)
      from (
        select jsonb_build_object(
          'location_id', assigned_location_id,
          'location_name_en', (select l.name_en from public.locations l where l.id = assigned_location_id),
          'location_name_ar', (select l.name_ar from public.locations l where l.id = assigned_location_id),
          'count', count(*)
        ) as location_row
        from scoped
        group by assigned_location_id
      ) as location_rows
    ), '[]'::jsonb),
    'by_employee', coalesce((
      select jsonb_agg(employee_row order by (employee_row->>'count')::int desc)
      from (
        select jsonb_build_object(
          'employee_id', assigned_employee_id,
          'employee_name', (select p.display_name from public.profiles p where p.id = assigned_employee_id),
          'count', count(*)
        ) as employee_row
        from scoped
        group by assigned_employee_id
      ) as employee_rows
    ), '[]'::jsonb),
    'by_channel', coalesce((
      select jsonb_agg(channel_row order by (channel_row->>'count')::int desc)
      from (
        select jsonb_build_object('channel', channel, 'count', count(*)) as channel_row
        from scoped
        group by channel
      ) as channel_rows
    ), '[]'::jsonb)
  ) into v_result
  from scoped;

  return coalesce(v_result, jsonb_build_object(
    'total_responses', 0,
    'average_rating', null,
    'rating_counts', jsonb_build_object('bad', 0, 'poor', 0, 'average', 0, 'good', 0, 'excellent', 0),
    'identity_counts', jsonb_build_object('anonymous', 0, 'self_reported', 0),
    'comment_rate', null,
    'contact_requested_count', 0,
    'unresolved_contact_requests', 0,
    'follow_up_completion_rate', null,
    'by_location', '[]'::jsonb,
    'by_employee', '[]'::jsonb,
    'by_channel', '[]'::jsonb
  ));
end;
$$;

grant execute on function public.rating_label_from_value(integer) to anon, authenticated;
grant execute on function public.rating_emoji_from_value(integer) to anon, authenticated;
grant execute on function public.issue_rating_nonce(text, text) to anon, authenticated;
grant execute on function public.record_rating(text, integer, text, text, text) to anon, authenticated;
grant execute on function public.get_rating_followup_context(text, text) to anon, authenticated;
grant execute on function public.submit_rating_followup(text, text, integer, text, text, text, boolean, boolean, text, text) to anon, authenticated;
grant execute on function public.get_signature_sentiment_report(uuid, timestamptz, timestamptz, uuid, uuid, text, text, boolean, boolean) to authenticated;

comment on table public.rating_followup_sessions is 'Opaque follow-up state for public signature ratings. Stores the current score, journey state, and continuation token hash; no optional PII lives here.';
comment on table public.rating_followup_details is 'Optional customer PII for a public rating follow-up. Kept separate from the core response for tighter retention and access control.';
