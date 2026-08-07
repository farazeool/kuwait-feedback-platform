-- Feedback Signature: Generic Subjects, Rating Events, Nonce/Rate-Limit Tables, RPCs
-- Forward-only additive migration. Depends on 20260725210000.

-- ==============================================================================
-- 1. Extend distribution_assignments: generic subject pair + revoked_at
--    survey_id made nullable (rating-only signatures have no survey).
--    Composite FK da_survey_org_fkey uses MATCH SIMPLE: NULL survey_id is accepted.
-- ==============================================================================

alter table public.distribution_assignments
  add column subject_type text
    check (subject_type is null or char_length(subject_type) between 1 and 64),
  add column subject_id text
    check (subject_id is null or char_length(subject_id) between 1 and 200),
  add column revoked_at timestamptz,
  add constraint da_generic_subject_pair_check check (
    (subject_type is null and subject_id is null)
    or (subject_type is not null and subject_id is not null)
  ),
  add constraint da_no_mixed_subject check (
    not (
      subject_type is not null
      and (
        assigned_employee_id is not null
        or assigned_location_id is not null
        or assigned_touchpoint_id is not null
      )
    )
  );

alter table public.distribution_assignments
  alter column survey_id drop not null;

-- ==============================================================================
-- 2. Rewrite validate_distribution_assignment() to understand generic subjects.
--    Same trigger object (distribution_assignments_validate) — no DROP needed.
-- ==============================================================================

create or replace function public.validate_distribution_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fk_count  integer;
  v_has_generic boolean;
begin
  v_fk_count := (new.assigned_employee_id   is not null)::integer
              + (new.assigned_location_id    is not null)::integer
              + (new.assigned_touchpoint_id  is not null)::integer;
  v_has_generic := new.subject_type is not null and new.subject_id is not null;

  -- Never more than one FK target
  if v_fk_count > 1 then
    raise exception 'Distribution assignment cannot have multiple FK targets'
      using errcode = '22023';
  end if;

  -- Cannot mix FK target with generic subject (also enforced by CHECK, belt-and-suspenders)
  if v_fk_count = 1 and v_has_generic then
    raise exception 'Assignment cannot have both an FK target and a generic subject'
      using errcode = '22023';
  end if;

  -- Active assignments need exactly one subject: one FK target OR one generic pair
  if new.status = 'active' and v_fk_count = 0 and not v_has_generic then
    if tg_op = 'UPDATE' then
      -- Target was removed by ON DELETE SET NULL — auto-revoke (preserve existing behavior)
      new.status := 'revoked';
    else
      raise exception 'Active assignments require one target (employee, location, touchpoint, or generic subject)'
        using errcode = '22023';
    end if;
  end if;

  -- Keep revoked_at in sync
  if new.status = 'revoked' and new.revoked_at is null then
    new.revoked_at := timezone('utc', now());
  end if;

  return new;
end;
$$;

comment on function public.validate_distribution_assignment is
  'Ensures active assignments have exactly one subject (FK or generic pair); auto-revokes orphans; stamps revoked_at.';

-- ==============================================================================
-- 3. Backfill generic subject pair from existing FK rows (idempotent)
-- ==============================================================================

update public.distribution_assignments
set
  subject_type = case
    when assigned_employee_id   is not null then 'employee'
    when assigned_location_id   is not null then 'location'
    when assigned_touchpoint_id is not null then 'touchpoint'
  end,
  subject_id = coalesce(
    assigned_employee_id::text,
    assigned_location_id::text,
    assigned_touchpoint_id::text
  )
where subject_type is null
  and (
    assigned_employee_id   is not null
    or assigned_location_id  is not null
    or assigned_touchpoint_id is not null
  );

-- Indexes for generic subject lookups and uniqueness
create index da_subject_idx
  on public.distribution_assignments (organization_id, subject_type, subject_id)
  where subject_id is not null;

create unique index da_template_generic_subject_uidx
  on public.distribution_assignments (template_id, subject_type, subject_id)
  where subject_id is not null;

-- ==============================================================================
-- 4. rating_events — append-only, SECURITY DEFINER RPC writes only
-- ==============================================================================

create table public.rating_events (
  id              uuid        primary key default gen_random_uuid(),
  assignment_id   uuid        not null references public.distribution_assignments (id) on delete cascade,
  organization_id uuid        not null references public.organizations (id) on delete cascade,
  rating          integer     not null check (rating between 1 and 5),
  ip_hash         bytea,
  user_agent      text,
  nonce_ref       bytea       not null,
  created_at      timestamptz not null default timezone('utc', now())
);

create index re_assignment_idx on public.rating_events (assignment_id, created_at desc);
create index re_org_idx        on public.rating_events (organization_id, created_at desc);

alter table public.rating_events enable row level security;
alter table public.rating_events force row level security;

create policy re_platform_admin_all on public.rating_events for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy re_read_permitted on public.rating_events for select to authenticated
  using (public.can_read_organization(organization_id));
create policy re_insert_via_rpc on public.rating_events for insert to authenticated
  with check (false);

-- ==============================================================================
-- 5. feedback_rating_nonces — RPC-only, no direct access
-- ==============================================================================

create table public.feedback_rating_nonces (
  nonce_hash    bytea        primary key,
  assignment_id uuid         not null references public.distribution_assignments (id) on delete cascade,
  issued_at     timestamptz  not null default timezone('utc', now()),
  expires_at    timestamptz  not null,
  consumed_at   timestamptz
);

create index frn_expiry_idx on public.feedback_rating_nonces (expires_at);

alter table public.feedback_rating_nonces enable row level security;
alter table public.feedback_rating_nonces force row level security;

revoke all on public.feedback_rating_nonces from anon, authenticated;

-- ==============================================================================
-- 6. feedback_rating_rate_limits — parallel to public_submission_rate_limits
--    (existing table is keyed by survey_id NOT NULL; cannot serve rating-only)
-- ==============================================================================

create table public.feedback_rating_rate_limits (
  assignment_id     uuid        not null references public.distribution_assignments (id) on delete cascade,
  fingerprint_hash  bytea       not null,
  window_started_at timestamptz not null,
  request_count     integer     not null default 0,
  expires_at        timestamptz not null,
  primary key (assignment_id, fingerprint_hash, window_started_at)
);

create index frrl_expiry_idx on public.feedback_rating_rate_limits (expires_at);

alter table public.feedback_rating_rate_limits enable row level security;
alter table public.feedback_rating_rate_limits force row level security;

revoke all on public.feedback_rating_rate_limits from anon, authenticated;

-- ==============================================================================
-- 7. RPC: consume_rating_rate_limit
-- ==============================================================================

create function public.consume_rating_rate_limit(
  p_assignment_id   uuid,
  p_fingerprint_hash text,
  p_limit           integer default 5,
  p_window_seconds  integer default 900
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_fingerprint bytea;
  v_window      timestamptz;
  v_count       integer;
begin
  if p_fingerprint_hash !~ '^[0-9a-f]{64}$'
    or p_limit not between 1 and 100
    or p_window_seconds not between 60 and 86400
  then
    raise exception 'Invalid rate-limit input' using errcode = '22023';
  end if;

  v_fingerprint := decode(p_fingerprint_hash, 'hex');
  v_window := to_timestamp(
    floor(extract(epoch from timezone('utc', now())) / p_window_seconds) * p_window_seconds
  );

  delete from public.feedback_rating_rate_limits
  where expires_at < timezone('utc', now());

  insert into public.feedback_rating_rate_limits (
    assignment_id, fingerprint_hash, window_started_at, request_count, expires_at
  ) values (
    p_assignment_id,
    v_fingerprint,
    v_window,
    1,
    v_window + make_interval(secs => p_window_seconds + 86400)
  )
  on conflict (assignment_id, fingerprint_hash, window_started_at)
  do update set request_count = public.feedback_rating_rate_limits.request_count + 1
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

-- ==============================================================================
-- 8. RPC: issue_rating_nonce
-- ==============================================================================

create function public.issue_rating_nonce(
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

  -- Generic response for any invalid/inactive state — never leak validity
  if not found
    or v_assignment.status in ('revoked', 'expired')
    or (v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()))
  then
    return jsonb_build_object('ok', true);
  end if;

  -- Optional issuance rate-limit
  if p_fingerprint_hash is not null
    and p_fingerprint_hash ~ '^[0-9a-f]{64}$'
    and not public.consume_rating_rate_limit(v_assignment.id, p_fingerprint_hash, 10, 900)
  then
    return jsonb_build_object('ok', true);
  end if;

  -- Generate nonce; store only its hash
  v_nonce      := encode(extensions.gen_random_bytes(18), 'hex');
  v_nonce_hash := extensions.digest(v_nonce, 'sha256');

  insert into public.feedback_rating_nonces (nonce_hash, assignment_id, expires_at)
  values (v_nonce_hash, v_assignment.id, timezone('utc', now()) + interval '30 minutes');

  return jsonb_build_object(
    'ok',           true,
    'nonce',        v_nonce,
    'rating_style', (
      select render_config->>'ratingStyle'
      from public.distribution_templates
      where id = v_assignment.template_id
    )
  );
end;
$$;

-- ==============================================================================
-- 9. RPC: record_rating
-- ==============================================================================

create function public.record_rating(
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
begin
  -- Always return generic ok — never leak validity
  if p_rating not between 1 and 5 then
    return jsonb_build_object('ok', true);
  end if;

  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found
    or v_assignment.status not in ('active', 'paused')
    or (v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()))
  then
    return jsonb_build_object('ok', true);
  end if;

  -- Rate-limit check
  if p_fingerprint_hash is not null
    and p_fingerprint_hash ~ '^[0-9a-f]{64}$'
    and not public.consume_rating_rate_limit(v_assignment.id, p_fingerprint_hash, 5, 900)
  then
    return jsonb_build_object('ok', true);
  end if;

  -- Atomic single-use nonce consumption
  v_nonce_hash := extensions.digest(p_nonce, 'sha256');

  update public.feedback_rating_nonces
  set consumed_at = timezone('utc', now())
  where nonce_hash   = v_nonce_hash
    and assignment_id = v_assignment.id
    and consumed_at  is null
    and expires_at   > timezone('utc', now())
  returning nonce_hash into v_consumed;

  if v_consumed is null then
    return jsonb_build_object('ok', true);
  end if;

  -- Decode fingerprint to bytes for storage (ip_hash)
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
  );

  update public.distribution_assignments
  set response_count   = response_count + 1,
      last_response_at = timezone('utc', now())
  where id = v_assignment.id;

  return jsonb_build_object('ok', true);
end;
$$;

-- ==============================================================================
-- 10. RPC: get_signature_subject_report
-- ==============================================================================

create function public.get_signature_subject_report(
  p_organization_id uuid,
  p_start_at        timestamptz,
  p_end_at          timestamptz,
  p_subject_type    text    default null,
  p_template_id     uuid    default null,
  p_location_id     uuid    default null
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

  select jsonb_build_object(
    'subjects', coalesce(jsonb_agg(s order by s->>'avg_rating' desc nulls last), '[]'::jsonb),
    'totals', jsonb_build_object(
      'count',      sum((s->>'count')::integer),
      'avg_rating', round(avg((s->>'avg_rating')::numeric), 2)
    )
  )
  into v_result
  from (
    select jsonb_build_object(
      'subject_type',  da.subject_type,
      'subject_id',    da.subject_id,
      'label',         coalesce(
                         da.metadata->>'label',
                         p.display_name,
                         loc.name_en,
                         tp.name_en,
                         da.subject_id
                       ),
      'template_id',   da.template_id,
      'count',         count(re.id),
      'avg_rating',    round(avg(re.rating), 2),
      'distribution',  jsonb_object_agg(re.rating::text, cnt),
      'trend',         jsonb_agg(
                         jsonb_build_object('date', day, 'avg', day_avg, 'count', day_cnt)
                         order by day
                       )
    ) as s
    from public.distribution_assignments da
    join public.rating_events re
      on re.assignment_id = da.id
     and re.created_at >= p_start_at
     and re.created_at <  p_end_at
    left join public.profiles p
      on da.subject_type = 'employee'
     and p.id = da.subject_id::uuid
    left join public.locations loc
      on da.subject_type = 'location'
     and loc.id = da.subject_id::uuid
    left join public.touchpoints tp
      on da.subject_type = 'touchpoint'
     and tp.id = da.subject_id::uuid
    -- per-rating distribution sub-agg
    join lateral (
      select re2.rating, count(*) as cnt
      from public.rating_events re2
      where re2.assignment_id = da.id
        and re2.created_at >= p_start_at
        and re2.created_at <  p_end_at
      group by re2.rating
    ) dist on true
    -- daily trend sub-agg
    join lateral (
      select
        date_trunc('day', re3.created_at) as day,
        round(avg(re3.rating), 2)         as day_avg,
        count(*)                          as day_cnt
      from public.rating_events re3
      where re3.assignment_id = da.id
        and re3.created_at >= p_start_at
        and re3.created_at <  p_end_at
      group by 1
    ) trend on true
    where da.organization_id = p_organization_id
      and (p_subject_type is null or da.subject_type = p_subject_type)
      and (p_template_id  is null or da.template_id  = p_template_id)
      and (
        p_location_id is null
        or da.assigned_location_id = p_location_id
        or (da.subject_type = 'location' and da.subject_id = p_location_id::text)
      )
    group by da.subject_type, da.subject_id, da.metadata, da.template_id,
             p.display_name, loc.name_en, tp.name_en,
             dist.rating, dist.cnt,
             trend.day, trend.day_avg, trend.day_cnt
  ) sub(s);

  return coalesce(v_result, jsonb_build_object('subjects', '[]'::jsonb, 'totals', '{}'::jsonb));
end;
$$;

-- ==============================================================================
-- 11. Grants
-- ==============================================================================

grant execute on function public.consume_rating_rate_limit(uuid, text, integer, integer)
  to anon, authenticated;

grant execute on function public.issue_rating_nonce(text, text)
  to anon, authenticated;

grant execute on function public.record_rating(text, integer, text, text, text)
  to anon, authenticated;

revoke execute on function public.get_signature_subject_report(uuid, timestamptz, timestamptz, text, uuid, uuid)
  from public, anon;
grant execute on function public.get_signature_subject_report(uuid, timestamptz, timestamptz, text, uuid, uuid)
  to authenticated;

-- ==============================================================================
-- 12. Comments
-- ==============================================================================

comment on table public.rating_events is
  'Append-only log of emoji/star ratings submitted via feedback signature links. Written only via record_rating RPC.';
comment on table public.feedback_rating_nonces is
  'Single-use nonces issued per landing-page load. Consumed atomically in record_rating. Raw nonce never stored.';
comment on table public.feedback_rating_rate_limits is
  'Per-assignment sliding-window rate limits for rating submissions. Parallel to public_submission_rate_limits (which requires survey_id NOT NULL).';
comment on column public.distribution_assignments.subject_type is
  'Generic subject type (employee, location, touchpoint, delivery, ticket, product, …). Mutually exclusive with FK target columns.';
comment on column public.distribution_assignments.subject_id is
  'Generic subject identifier (UUID or opaque string). Paired with subject_type.';
comment on column public.distribution_assignments.revoked_at is
  'Timestamp when status was set to revoked. Stamped automatically by validate_distribution_assignment trigger.';
