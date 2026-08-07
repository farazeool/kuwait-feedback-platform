-- Return explicit persistence outcome from record_rating
-- Addresses defect: API cannot distinguish successful persistence from safe rejection.
-- Forward-only additive migration. Depends on 20260729020000.

-- ==============================================================================
-- Rewrite public.record_rating to return {"ok": true, "recorded": boolean}
-- ==============================================================================

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
begin
  -- Safe rejection: never leak validity, return recorded=false
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

  -- Rate-limit check: safe rejection
  if p_fingerprint_hash is not null
    and p_fingerprint_hash ~ '^[0-9a-f]{64}$'
    and not public.consume_rating_rate_limit(v_assignment.id, p_fingerprint_hash, 5, 900)
  then
    raise exception 'Rate limit exceeded' using errcode = 'P0001';
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

  -- Nonce invalid/consumed/expired: safe rejection
  if v_consumed is null then
    return jsonb_build_object('ok', true, 'recorded', false);
  end if;

  -- Decode fingerprint to bytes for storage (ip_hash)
  if p_fingerprint_hash is not null and p_fingerprint_hash ~ '^[0-9a-f]{64}$' then
    v_ip_hash := decode(p_fingerprint_hash, 'hex');
  end if;

  -- Persist rating event
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

  -- Update assignment counters
  update public.distribution_assignments
  set response_count   = response_count + 1,
      last_response_at = timezone('utc', now())
  where id = v_assignment.id;

  -- Successful persistence: return recorded=true
  return jsonb_build_object('ok', true, 'recorded', true);
end;
$$;

comment on function public.record_rating(text, integer, text, text, text) is
  'Record emoji/star rating with explicit persistence outcome. Returns {ok:true, recorded:true} only when rating_events row inserted, nonce consumed, and response_count updated atomically. Returns {ok:true, recorded:false} for safe rejections (invalid token, consumed nonce, expired assignment). Raises P0001 for rate-limit violations. Never exposes internal security state.';
