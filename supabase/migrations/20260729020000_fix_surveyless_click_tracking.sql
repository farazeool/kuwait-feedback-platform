-- Fix surveyless distribution click tracking (employee email signatures)
--
-- ROOT CAUSE: record_distribution_click calls consume_public_submission_rate_limit
-- which requires a published survey. Employee signature assignments have survey_id=NULL,
-- causing the RPC to fail with "Published survey not found" before the redirect logic
-- in the route handler can execute.
--
-- FIX: Use token-based rate limiting for surveyless assignments instead of survey-based.
-- Survey-backed: 60 clicks per token+IP per 5 min (existing survey rate limiter)
-- Surveyless:    30 clicks per token+IP per 5 min (new token-based rate limiter)

-- Token-based click rate limiter for surveyless assignments (employee signatures)
-- Does not require a survey, uses assignment token as the rate-limit key
create or replace function public.consume_token_click_rate_limit(
  p_public_token text,
  p_fingerprint text,
  p_max_clicks integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_click_count integer;
begin
  v_window_start := timezone('utc', now()) - (p_window_seconds || ' seconds')::interval;

  -- Count clicks for this token+fingerprint in the current window
  select count(*) into v_click_count
  from public.distribution_link_events
  where assignment_id = (
    select id from public.distribution_assignments where public_token = p_public_token limit 1
  )
  and event_type = 'click'
  and created_at >= v_window_start;

  -- Reject if limit exceeded
  if v_click_count >= p_max_clicks then
    return false;
  end if;

  return true;
end;
$$;

comment on function public.consume_token_click_rate_limit is
  'Rate limit click tracking for assignment tokens. Used for surveyless assignments (employee signatures).';

-- Updated click tracking with proper rate limiting for both survey-backed and surveyless
create or replace function public.record_distribution_click(
  p_public_token text,
  p_ip_address text default null,
  p_user_agent text default null,
  p_referer text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment public.distribution_assignments%rowtype;
  v_rate_hash text;
  v_rate_ok boolean;
begin
  -- Compute rate-limit hash from token + IP to prevent click fraud
  v_rate_hash := encode(
    extensions.digest(
      coalesce(p_public_token, '') || coalesce(p_ip_address, ''),
      'sha256'
    ),
    'hex'
  );

  -- Fetch the assignment first to check if it has a survey
  select * into v_assignment
  from public.distribution_assignments
  where public_token = p_public_token;

  if not found then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (null, null, 'invalid_token', null, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', 'invalid_token');
  end if;

  -- Apply appropriate rate limiting based on assignment type
  if v_assignment.survey_id is not null then
    -- Survey-backed: use existing survey rate limiter (60 clicks/5min)
    v_rate_ok := public.consume_public_submission_rate_limit(
      p_public_token,
      v_rate_hash,
      60,       -- 60 clicks per window
      300       -- 5 minute window
    );
  else
    -- Surveyless: use token-based rate limiter (30 clicks/5min)
    v_rate_ok := public.consume_token_click_rate_limit(
      p_public_token,
      v_rate_hash,
      30,       -- 30 clicks per window (tighter for surveyless)
      300       -- 5 minute window
    );
  end if;

  if not v_rate_ok then
    return jsonb_build_object('found', false, 'rate_limited', true);
  end if;

  -- Status validation
  if v_assignment.status = 'revoked' or v_assignment.status = 'expired' then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (v_assignment.id, v_assignment.organization_id, 'expired_click', null, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', v_assignment.status);
  end if;

  -- Expiration validation
  if v_assignment.expires_at is not null and v_assignment.expires_at < timezone('utc', now()) then
    insert into public.distribution_link_events (assignment_id, organization_id, event_type, ip_address, user_agent, referer)
    values (v_assignment.id, v_assignment.organization_id, 'expired_click', null, p_user_agent, p_referer);
    return jsonb_build_object('found', false, 'reason', 'expired');
  end if;

  -- Record successful click
  update public.distribution_assignments
  set click_count = click_count + 1,
      last_clicked_at = timezone('utc', now())
  where id = v_assignment.id;

  insert into public.distribution_link_events (
    assignment_id, organization_id, event_type, ip_address, user_agent, referer
  ) values (
    v_assignment.id, v_assignment.organization_id, 'click', null, p_user_agent, p_referer
  );

  return jsonb_build_object(
    'found', true,
    'assignment_id', v_assignment.id,
    'survey_id', v_assignment.survey_id,
    'organization_id', v_assignment.organization_id,
    'location_id', v_assignment.assigned_location_id,
    'employee_id', v_assignment.assigned_employee_id,
    'touchpoint_id', v_assignment.assigned_touchpoint_id,
    'campaign_id', v_assignment.campaign_id,
    'channel', (select channel from public.distribution_templates where id = v_assignment.template_id)
  );
end;
$$;

comment on function public.record_distribution_click is
  'Record distribution link click with rate limiting. Survey-backed: 60 clicks/5min. Surveyless: 30 clicks/5min.';
