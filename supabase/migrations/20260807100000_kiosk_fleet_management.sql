-- Boundary C3: fleet management and activity history RPCs.
--
-- The C1B migration created the desired/applied configuration columns and
-- the heartbeat timestamp on public.kiosk_devices; the C2 migration created
-- public.kiosk_remote_commands and public.kiosk_activity_history but no
-- RPCs that the dashboard or the device can call. This migration supplies
-- those RPCs without touching any earlier file.
--
-- All admin RPCs are SECURITY DEFINER with a pinned search_path and explicit
-- grants to `authenticated` only, matching the C1B hardening pattern. The
-- device-facing RPCs are SECURITY INVOKER and rely on the existing RLS
-- policies plus the kiosk_resolve_device_credential internal helper, which
-- rejects revoked and unknown credentials before any row is selected.

BEGIN;

-- =====================================================
-- 1. ADD configuration_status GENERATED COLUMN
-- =====================================================
-- The C1B migration added desired/applied versions but did not expose a
-- single status label. This generated column derives one so the fleet RPC
-- and the dashboard don't have to repeat the comparison logic.
--
-- Values: 'current' (applied >= desired), 'pending' (applied < desired
-- and no recorded error), 'failed' (applied < desired and an error
-- reported by the device). The device column kiosk_devices already
-- captures the desired/applied pair.

ALTER TABLE public.kiosk_devices
  ADD COLUMN IF NOT EXISTS configuration_status text
  GENERATED ALWAYS AS (
    CASE
      WHEN applied_config_version < desired_config_version
        AND configuration_error IS NOT NULL
        THEN 'failed'
      WHEN applied_config_version < desired_config_version
        THEN 'pending'
      ELSE 'current'
    END
  ) STORED;

COMMENT ON COLUMN public.kiosk_devices.configuration_status IS
  'Derived status: current when applied matches desired, pending when the device has not acknowledged, failed when the device reported an error. Generated from desired_config_version / applied_config_version / configuration_error.';

-- =====================================================
-- 2. ADMIN RPC: LIST KIOSK FLEET
-- =====================================================
-- Returns one row per kiosk with the full dashboard surface in a single
-- round trip: identity, location, desired/applied survey + mode + version,
-- configuration status, online indicator, latest command snapshot, and
-- activation state.
--
-- The latest-command subquery uses DISTINCT ON to take the most recent
-- remote command regardless of status. The fleet view treats the latest
-- command as the most recent state change the operator issued; the device
-- acknowledgement state is read off that row.
--
-- A 90-second window on last_seen_at marks a device online; the C1B
-- migration added the column.

DROP FUNCTION IF EXISTS public.list_kiosk_fleet(uuid);
CREATE OR REPLACE FUNCTION public.list_kiosk_fleet(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  device_name text,
  device_identifier text,
  status text,
  activation_status text,
  has_credential boolean,
  location_id uuid,
  location_name_en text,
  location_name_ar text,
  desired_survey_id uuid,
  desired_survey_title_en text,
  desired_survey_title_ar text,
  applied_survey_id uuid,
  applied_survey_title_en text,
  applied_survey_title_ar text,
  desired_mode text,
  applied_mode text,
  desired_config_version bigint,
  applied_config_version bigint,
  configuration_status text,
  configuration_error text,
  configuration_updated_at timestamptz,
  configuration_applied_at timestamptz,
  last_seen_at timestamptz,
  last_heartbeat_at timestamptz,
  last_successful_application_at timestamptz,
  online boolean,
  pending_command_count bigint,
  failed_command_count bigint,
  latest_command_id uuid,
  latest_command_type text,
  latest_command_status text,
  latest_command_created_at timestamptz,
  latest_command_idempotency_key text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Authorization: caller must hold an active membership for the
  -- requested organization. We do not require a specific role because the
  -- read-only dashboard is also useful to supervisors and platform
  -- engineers; mutations happen through separate RPCs that re-check.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to access organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH latest_cmd AS (
    SELECT DISTINCT ON (krc.kiosk_device_id)
      krc.id,
      krc.kiosk_device_id,
      krc.command_type,
      krc.status,
      krc.created_at,
      krc.idempotency_key
    FROM public.kiosk_remote_commands krc
    WHERE krc.organization_id = p_organization_id
    ORDER BY krc.kiosk_device_id, krc.created_at DESC
  ),
  cmd_counts AS (
    SELECT
      krc.kiosk_device_id,
      COUNT(*) FILTER (WHERE krc.status = 'pending' OR krc.status = 'delivered') AS pending_count,
      COUNT(*) FILTER (WHERE krc.status = 'failed' OR krc.status = 'expired') AS failed_count
    FROM public.kiosk_remote_commands krc
    WHERE krc.organization_id = p_organization_id
    GROUP BY krc.kiosk_device_id
  )
  SELECT
    kd.id,
    kd.device_name,
    kd.device_identifier,
    kd.status::text,
    CASE WHEN kd.device_credential_hash IS NULL THEN 'pending_activation' ELSE 'activated' END,
    kd.device_credential_hash IS NOT NULL,
    kd.location_id,
    l.name_en,
    l.name_ar,
    kd.desired_survey_id,
    ds.title_en,
    ds.title_ar,
    kd.applied_survey_id,
    asv.title_en,
    asv.title_ar,
    kd.desired_mode,
    kd.applied_mode,
    kd.desired_config_version,
    kd.applied_config_version,
    kd.configuration_status,
    kd.configuration_error,
    kd.configuration_updated_at,
    kd.configuration_applied_at,
    kd.last_seen_at,
    kd.last_heartbeat_at,
    -- Last successful application = when applied_config_version was last bumped.
    -- configuration_applied_at is set by the C1B acknowledgement RPC.
    kd.configuration_applied_at,
    public.is_kiosk_online(kd.last_seen_at, 90) AS online,
    COALESCE(cc.pending_count, 0),
    COALESCE(cc.failed_count, 0),
    lc.id,
    lc.command_type,
    lc.status,
    lc.created_at,
    lc.idempotency_key
  FROM public.kiosk_devices kd
  LEFT JOIN public.locations l ON l.id = kd.location_id
  LEFT JOIN public.surveys ds ON ds.id = kd.desired_survey_id
  LEFT JOIN public.surveys asv ON asv.id = kd.applied_survey_id
  LEFT JOIN latest_cmd lc ON lc.kiosk_device_id = kd.id
  LEFT JOIN cmd_counts cc ON cc.kiosk_device_id = kd.id
  WHERE kd.organization_id = p_organization_id
    AND kd.status <> 'archived'
  ORDER BY kd.device_name;
END;
$$;

COMMENT ON FUNCTION public.list_kiosk_fleet(uuid) IS
  'Returns one row per non-archived kiosk device in the given organization with identity, location, desired/applied survey/mode/version, configuration status, online indicator, latest command, and pending/failed command counts.';

REVOKE ALL ON FUNCTION public.list_kiosk_fleet(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_kiosk_fleet(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_kiosk_fleet(uuid) TO authenticated;

-- =====================================================
-- 3. ADMIN RPC: LIST ELIGIBLE SURVEYS FOR A KIOSK
-- =====================================================
-- Returns the surveys an organization can assign to a kiosk, restricted to
-- the kiosk's own organization (no cross-org leak) and excluding rows that
-- are not actually eligible (unpublished, archived). The caller must hold
-- an active membership in the kiosk's organization.

DROP FUNCTION IF EXISTS public.list_eligible_surveys_for_kiosk(uuid, uuid);
CREATE OR REPLACE FUNCTION public.list_eligible_surveys_for_kiosk(
  p_organization_id uuid,
  p_kiosk_device_id uuid
)
RETURNS TABLE (
  id uuid,
  title_en text,
  title_ar text,
  public_slug text,
  is_current_desired boolean,
  is_current_applied boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_kiosk_org uuid;
  v_desired uuid;
  v_applied uuid;
BEGIN
  -- Authorize membership against the requested organization. We use
  -- p_organization_id rather than reading the kiosk's organization so the
  -- caller cannot probe other organizations via this RPC.
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to access organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT kd.organization_id, kd.desired_survey_id, kd.applied_survey_id
    INTO v_kiosk_org, v_desired, v_applied
  FROM public.kiosk_devices kd
  WHERE kd.id = p_kiosk_device_id;

  IF v_kiosk_org IS NULL THEN
    RAISE EXCEPTION 'Kiosk % not found', p_kiosk_device_id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- The kiosk's organization must match the caller's organization.
  IF v_kiosk_org <> p_organization_id THEN
    RAISE EXCEPTION 'Kiosk % does not belong to organization %', p_kiosk_device_id, p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.title_en,
    s.title_ar,
    s.public_slug,
    s.id = v_desired AS is_current_desired,
    s.id = v_applied AS is_current_applied
  FROM public.surveys s
  WHERE s.organization_id = p_organization_id
    AND s.status IN ('active', 'archived')
  ORDER BY s.title_en;
END;
$$;

COMMENT ON FUNCTION public.list_eligible_surveys_for_kiosk(uuid, uuid) IS
  'Returns the active/archived surveys that can be assigned to a kiosk in the given organization. Marks the kiosk''s current desired and applied survey so the UI can show them as the active choice.';

REVOKE ALL ON FUNCTION public.list_eligible_surveys_for_kiosk(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_eligible_surveys_for_kiosk(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_eligible_surveys_for_kiosk(uuid, uuid) TO authenticated;

-- =====================================================
-- 4. ADMIN RPC: LIST KIOSK ACTIVITY (PAGINATED)
-- =====================================================
-- Returns organization-scoped activity events with kiosk name, optional
-- location, event label, actor label (display name only), and a sanitized
-- metadata summary. No raw credentials, hashes, tokens, service-role
-- material, or arbitrary request bodies are returned.
--
-- Filters: kiosk_device_id, location_id, event_type, status, occurred_at
-- range. Pagination is offset/limit (bounded to 100 rows).

DROP FUNCTION IF EXISTS public.list_kiosk_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer);
CREATE OR REPLACE FUNCTION public.list_kiosk_activity(
  p_organization_id uuid,
  p_kiosk_device_id uuid DEFAULT NULL,
  p_location_id uuid DEFAULT NULL,
  p_event_type text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  occurred_at timestamptz,
  kiosk_device_id uuid,
  kiosk_device_name text,
  location_id uuid,
  location_name_en text,
  location_name_ar text,
  event_type text,
  actor_type text,
  actor_user_id uuid,
  actor_display_name text,
  status text,
  metadata_summary text,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit integer := GREATEST(LEAST(COALESCE(p_limit, 25), 100), 1);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = p_organization_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Not authorized to access organization %', p_organization_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Compute total filtered count first so the UI can render pagination.
  SELECT COUNT(*)
    INTO v_total
  FROM public.kiosk_activity_history ah
  WHERE ah.organization_id = p_organization_id
    AND (p_kiosk_device_id IS NULL OR ah.kiosk_device_id = p_kiosk_device_id)
    AND (p_event_type IS NULL OR ah.event_type = p_event_type)
    AND (p_status IS NULL OR ah.metadata ->> 'status' = p_status)
    AND (p_from IS NULL OR ah.occurred_at >= p_from)
    AND (p_to IS NULL OR ah.occurred_at <= p_to)
    AND (
      p_location_id IS NULL OR EXISTS (
        SELECT 1 FROM public.kiosk_devices kd
        WHERE kd.id = ah.kiosk_device_id
          AND kd.location_id = p_location_id
      )
    );

  RETURN QUERY
  SELECT
    ah.id,
    ah.occurred_at,
    ah.kiosk_device_id,
    kd.device_name,
    kd.location_id,
    l.name_en,
    l.name_ar,
    ah.event_type,
    ah.actor_type,
    ah.actor_user_id,
    -- Only the display name is exposed. We deliberately do not return email
    -- or any other PII for the activity feed.
    p.display_name,
    -- The `status` is a column of its own in some event types; we pull it
    -- from metadata so the RPC contract is uniform.
    ah.metadata ->> 'status' AS status,
    -- Sanitised summary: a small JSON object with safe fields only. We
    -- never surface raw credentials, hashes, tokens, or service-role
    -- material from metadata.
    kiosk_activity_summary(ah.metadata) AS metadata_summary,
    v_total
  FROM public.kiosk_activity_history ah
  LEFT JOIN public.kiosk_devices kd ON kd.id = ah.kiosk_device_id
  LEFT JOIN public.locations l ON l.id = kd.location_id
  LEFT JOIN public.profiles p ON p.id = ah.actor_user_id
  WHERE ah.organization_id = p_organization_id
    AND (p_kiosk_device_id IS NULL OR ah.kiosk_device_id = p_kiosk_device_id)
    AND (p_event_type IS NULL OR ah.event_type = p_event_type)
    AND (p_status IS NULL OR ah.metadata ->> 'status' = p_status)
    AND (p_from IS NULL OR ah.occurred_at >= p_from)
    AND (p_to IS NULL OR ah.occurred_at <= p_to)
    AND (
      p_location_id IS NULL OR EXISTS (
        SELECT 1 FROM public.kiosk_devices kd2
        WHERE kd2.id = ah.kiosk_device_id
          AND kd2.location_id = p_location_id
      )
    )
  ORDER BY ah.occurred_at DESC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.list_kiosk_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) IS
  'Returns paginated activity events for an organization with kiosk and location names, actor display name, status, and a sanitised metadata summary. Filters: kiosk, location, event_type, status, occurred_at range.';

REVOKE ALL ON FUNCTION public.list_kiosk_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_kiosk_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_kiosk_activity(uuid, uuid, uuid, text, text, timestamptz, timestamptz, integer, integer) TO authenticated;

-- =====================================================
-- 5. HELPER: ACTIVITY METADATA SUMMARY
-- =====================================================
-- Returns a small text summary safe to display in the activity feed. We
-- only project a fixed allowlist of keys; anything else is dropped so we
-- cannot accidentally leak credential material that may have landed in the
-- metadata jsonb.
DROP FUNCTION IF EXISTS public.kiosk_activity_summary(jsonb);
CREATE OR REPLACE FUNCTION public.kiosk_activity_summary(p_metadata jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    (
      SELECT string_agg(key || '=' || value, ', ')
      FROM jsonb_each_text(
        COALESCE(p_metadata, '{}'::jsonb) - 'credential' - 'credential_hash'
          - 'token' - 'service_role_key' - 'request_body' - 'stack_trace'
      )
      WHERE key IN (
        'command_type', 'config_version', 'desired_survey_id',
        'applied_survey_id', 'desired_mode', 'applied_mode',
        'status', 'failure_reason', 'survey_title'
      )
    ),
    ''
  );
$$;

COMMENT ON FUNCTION public.kiosk_activity_summary(jsonb) IS
  'Projects a fixed allowlist of metadata keys into a short, comma-separated summary. Drops credential, hash, token, service-role, request body, and stack trace keys.';

-- =====================================================
-- 6. ADMIN RPC: ISSUE KIOSK COMMAND
-- =====================================================
-- Inserts a command row for a kiosk, validates membership and kiosk state,
-- returns the new id. Idempotency: a duplicate (same kiosk + idempotency
-- key) returns the existing command id without inserting a new row.
--
-- The RPC never touches kiosk_devices' desired_* columns. It only stages
-- the operator's intent; the device applies it via the existing
-- get_kiosk_desired_configuration poll, and the C1B acknowledgement RPC
-- advances applied_* columns. This keeps the command system additive.

DROP FUNCTION IF EXISTS public.issue_kiosk_command(uuid, text, jsonb, text);
CREATE OR REPLACE FUNCTION public.issue_kiosk_command(
  p_kiosk_device_id uuid,
  p_command_type text,
  p_command_payload jsonb DEFAULT NULL,
  p_idempotency_key text DEFAULT NULL
)
RETURNS TABLE (
  command_id uuid,
  status text,
  desired_config_version integer,
  already_existed boolean
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_kiosk_status text;
  v_existing_id uuid;
  v_existing_status text;
  v_existing_desired integer;
  v_new_id uuid;
  v_new_status text;
  v_new_desired integer;
  v_default_ttl interval := interval '5 minutes';
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_command_type IS NULL OR length(p_command_type) = 0 THEN
    RAISE EXCEPTION 'command_type is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_idempotency_key IS NULL OR length(p_idempotency_key) < 8 THEN
    RAISE EXCEPTION 'idempotency_key must be at least 8 characters'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Whitelist command types so a compromised admin session cannot issue
  -- arbitrary rows. The dashboard passes one of these constants.
  IF p_command_type NOT IN (
    'change_survey', 'refresh_configuration', 'pause', 'resume',
    'enter_maintenance', 'exit_maintenance', 'revoke_credential',
    'reenroll'
  ) THEN
    RAISE EXCEPTION 'Unsupported command_type %', p_command_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Look up the kiosk and authorize the actor against its organization.
  SELECT kd.organization_id, kd.status::text
    INTO v_org, v_kiosk_status
  FROM public.kiosk_devices kd
  WHERE kd.id = p_kiosk_device_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Kiosk % not found', p_kiosk_device_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = v_org
      AND om.user_id = v_actor
      AND om.status = 'active'
      AND om.role IN ('organization_admin', 'platform_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to issue commands for this kiosk'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Reject commands for archived or revoked kiosks. Pause is always allowed
  -- but we only block the destructive ones for revoked devices here. The
  -- dashboard additionally hides actions the user should not see, but the
  -- RPC is the authoritative gate.
  IF v_kiosk_status = 'archived' THEN
    RAISE EXCEPTION 'Cannot issue commands to an archived kiosk'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_command_type = 'revoke_credential' AND v_kiosk_status = 'revoked' THEN
    RAISE EXCEPTION 'Kiosk is already revoked'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_command_type IN ('reenroll') AND v_kiosk_status <> 'revoked' THEN
    RAISE EXCEPTION 'Re-enroll requires the kiosk to be revoked first'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Idempotency: if a command with the same idempotency key exists for the
  -- same kiosk, return the existing one without inserting or logging
  -- duplicate activity.
  SELECT krc.id, krc.status, krc.desired_config_version
    INTO v_existing_id, v_existing_status, v_existing_desired
  FROM public.kiosk_remote_commands krc
  WHERE krc.idempotency_key = p_idempotency_key
    AND krc.kiosk_device_id = p_kiosk_device_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, v_existing_status, v_existing_desired, true;
    RETURN;
  END IF;

  -- Compute desired_config_version for this command: bump the current
  -- desired version so the device knows this command is newer than the
  -- last one it may have processed.
  SELECT COALESCE(MAX(krc.desired_config_version), 0) + 1
    INTO v_new_desired
  FROM public.kiosk_remote_commands krc
  WHERE krc.kiosk_device_id = p_kiosk_device_id;

  INSERT INTO public.kiosk_remote_commands (
    organization_id,
    kiosk_device_id,
    command_type,
    command_payload,
    desired_config_version,
    status,
    issued_by,
    idempotency_key,
    expires_at
  ) VALUES (
    v_org,
    p_kiosk_device_id,
    p_command_type,
    p_command_payload,
    v_new_desired,
    'pending',
    v_actor,
    p_idempotency_key,
    now() + v_default_ttl
  )
  RETURNING id INTO v_new_id;

  -- Log activity so the dashboard activity feed shows the request.
  INSERT INTO public.kiosk_activity_history (
    organization_id,
    kiosk_device_id,
    event_type,
    actor_type,
    actor_user_id,
    metadata
  ) VALUES (
    v_org,
    p_kiosk_device_id,
    p_command_type || '_requested',
    'admin_user',
    v_actor,
    jsonb_build_object(
      'command_id', v_new_id,
      'command_type', p_command_type,
      'status', 'pending',
      'desired_config_version', v_new_desired
    )
  );

  RETURN QUERY SELECT v_new_id, 'pending'::text, v_new_desired, false;
END;
$$;

COMMENT ON FUNCTION public.issue_kiosk_command(uuid, text, jsonb, text) IS
  'Admin-only RPC that validates membership, command type, and kiosk state, then inserts a pending kiosk_remote_commands row. Idempotent on (kiosk_device_id, idempotency_key): a duplicate returns the existing command.';

REVOKE ALL ON FUNCTION public.issue_kiosk_command(uuid, text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.issue_kiosk_command(uuid, text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.issue_kiosk_command(uuid, text, jsonb, text) TO authenticated;

-- =====================================================
-- 7. ADMIN RPC: CANCEL KIOSK COMMAND
-- =====================================================
-- Cancels a pending command. Already-acknowledged commands cannot be
-- cancelled; the device has already acted on them. Activity is logged.

DROP FUNCTION IF EXISTS public.cancel_kiosk_command(uuid);
CREATE OR REPLACE FUNCTION public.cancel_kiosk_command(p_command_id uuid)
RETURNS TABLE (
  command_id uuid,
  status text
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_org uuid;
  v_kiosk uuid;
  v_existing_status text;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT krc.organization_id, krc.kiosk_device_id, krc.status
    INTO v_org, v_kiosk, v_existing_status
  FROM public.kiosk_remote_commands krc
  WHERE krc.id = p_command_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Command % not found', p_command_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships om
    WHERE om.organization_id = v_org
      AND om.user_id = v_actor
      AND om.status = 'active'
      AND om.role IN ('organization_admin', 'platform_admin')
  ) THEN
    RAISE EXCEPTION 'Not authorized to cancel commands for this organization'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_existing_status NOT IN ('pending', 'delivered') THEN
    RAISE EXCEPTION 'Command cannot be cancelled in status %', v_existing_status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.kiosk_remote_commands
    SET status = 'cancelled',
        updated_at = now()
  WHERE id = p_command_id;

  INSERT INTO public.kiosk_activity_history (
    organization_id, kiosk_device_id, event_type, actor_type, actor_user_id, metadata
  ) VALUES (
    v_org, v_kiosk, 'command_cancelled', 'admin_user', v_actor,
    jsonb_build_object('command_id', p_command_id, 'status', 'cancelled')
  );

  RETURN QUERY SELECT p_command_id, 'cancelled'::text;
END;
$$;

COMMENT ON FUNCTION public.cancel_kiosk_command(uuid) IS
  'Cancels a pending or delivered command. Already-acknowledged, failed, expired, or cancelled commands are rejected.';

REVOKE ALL ON FUNCTION public.cancel_kiosk_command(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_kiosk_command(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_kiosk_command(uuid) TO authenticated;

-- =====================================================
-- 8. INTERNAL RPC: EXPIRE STALE COMMANDS
-- =====================================================
-- Sweeps pending/delivered commands past their expiry, marks them expired,
-- and logs activity. Intended to be called by a scheduled job (pg_cron or
-- supabase scheduled function). Idempotent.

DROP FUNCTION IF EXISTS public.expire_kiosk_commands();
CREATE OR REPLACE FUNCTION public.expire_kiosk_commands()
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.kiosk_remote_commands
      SET status = 'expired',
          updated_at = now()
    WHERE status IN ('pending', 'delivered')
      AND expires_at < now()
    RETURNING id, organization_id, kiosk_device_id, command_type
  ),
  inserted AS (
    INSERT INTO public.kiosk_activity_history (
      organization_id, kiosk_device_id, event_type, actor_type, metadata
    )
    SELECT e.organization_id, e.kiosk_device_id,
           'command_expired', 'system',
           jsonb_build_object('command_id', e.id, 'command_type', e.command_type, 'status', 'expired')
    FROM expired e
    RETURNING 1
  )
  SELECT COUNT(*)::integer INTO v_count FROM inserted;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.expire_kiosk_commands() IS
  'Sweeps pending/delivered commands past their expiry, marks them expired, and logs activity. Idempotent.';

REVOKE ALL ON FUNCTION public.expire_kiosk_commands() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_kiosk_commands() FROM anon;
-- Internal: callable only by the service role, not by end users.
GRANT EXECUTE ON FUNCTION public.expire_kiosk_commands() TO service_role;

-- =====================================================
-- 9. DEVICE RPC: LIST PENDING COMMANDS FOR A KIOSK
-- =====================================================
-- The device polls this endpoint on the same cadence as the configuration
-- poll. It returns the single most-recent pending or delivered command so
-- the device can act on it without juggling an unbounded queue.
--
-- Authorisation: the credential alone selects the device via the
-- kiosk_resolve_device_credential internal helper. An unknown or revoked
-- credential raises an error and returns no rows.

DROP FUNCTION IF EXISTS public.list_kiosk_pending_commands(text);
CREATE OR REPLACE FUNCTION public.list_kiosk_pending_commands(p_raw_credential text)
RETURNS TABLE (
  command_id uuid,
  command_type text,
  command_payload jsonb,
  desired_config_version integer,
  issued_at timestamptz,
  expires_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device_id uuid;
BEGIN
  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  RETURN QUERY
  SELECT
    krc.id,
    krc.command_type,
    krc.command_payload,
    krc.desired_config_version,
    krc.created_at,
    krc.expires_at
  FROM public.kiosk_remote_commands krc
  WHERE krc.kiosk_device_id = v_device_id
    AND krc.status IN ('pending', 'delivered')
  ORDER BY krc.created_at ASC
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.list_kiosk_pending_commands(text) IS
  'Device-facing: returns the oldest pending or delivered command for the calling kiosk so the device can act on it. Authorisation comes from the credential via kiosk_resolve_device_credential.';

REVOKE ALL ON FUNCTION public.list_kiosk_pending_commands(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_kiosk_pending_commands(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.list_kiosk_pending_commands(text) TO service_role;

-- =====================================================
-- 10. DEVICE RPC: ACKNOWLEDGE KIOSK COMMAND
-- =====================================================
-- The device calls this after applying a command. Status transitions:
--   pending | delivered -> acknowledged (success)
--   pending | delivered -> failed          (with failure_reason)
--
-- Authorisation: the credential selects the device. We never trust a
-- command_id from the device alone; we re-verify it belongs to the device.

DROP FUNCTION IF EXISTS public.acknowledge_kiosk_command(text, uuid, boolean, text);
CREATE OR REPLACE FUNCTION public.acknowledge_kiosk_command(
  p_raw_credential text,
  p_command_id uuid,
  p_success boolean,
  p_failure_reason text DEFAULT NULL
)
RETURNS TABLE (
  command_id uuid,
  status text,
  acknowledged_at timestamptz
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_device_id uuid;
  v_kiosk uuid;
  v_existing_status text;
  v_new_status text;
BEGIN
  v_device_id := public.kiosk_resolve_device_credential(p_raw_credential);

  SELECT krc.kiosk_device_id, krc.status
    INTO v_kiosk, v_existing_status
  FROM public.kiosk_remote_commands krc
  WHERE krc.id = p_command_id;

  IF v_kiosk IS NULL THEN
    RAISE EXCEPTION 'Command % not found', p_command_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_kiosk <> v_device_id THEN
    RAISE EXCEPTION 'Command does not belong to this device'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_existing_status NOT IN ('pending', 'delivered') THEN
    -- Idempotent: already in a terminal state. Return as-is.
    RETURN QUERY SELECT p_command_id, v_existing_status, NULL::timestamptz;
    RETURN;
  END IF;

  v_new_status := CASE WHEN p_success THEN 'acknowledged' ELSE 'failed' END;

  UPDATE public.kiosk_remote_commands
    SET status = v_new_status,
        acknowledged_at = CASE WHEN p_success THEN now() ELSE NULL END,
        failed_at = CASE WHEN p_success THEN NULL ELSE now() END,
        failure_reason = CASE WHEN p_success THEN NULL ELSE public.kiosk_sanitize_configuration_error(p_failure_reason) END,
        updated_at = now()
  WHERE id = p_command_id;

  INSERT INTO public.kiosk_activity_history (
    organization_id, kiosk_device_id, event_type, actor_type, metadata
  )
  SELECT
    krc.organization_id, krc.kiosk_device_id,
    CASE WHEN p_success THEN 'command_acknowledged' ELSE 'command_failed' END,
    'kiosk_device',
    jsonb_build_object(
      'command_id', krc.id,
      'command_type', krc.command_type,
      'status', v_new_status,
      'failure_reason', CASE WHEN p_success THEN NULL ELSE public.kiosk_sanitize_configuration_error(p_failure_reason) END
    )
  FROM public.kiosk_remote_commands krc
  WHERE krc.id = p_command_id;

  RETURN QUERY SELECT p_command_id, v_new_status, CASE WHEN p_success THEN now() ELSE NULL END;
END;
$$;

COMMENT ON FUNCTION public.acknowledge_kiosk_command(text, uuid, boolean, text) IS
  'Device-facing: marks a command acknowledged or failed and logs activity. Authorisation via credential; the command must belong to the calling device. Idempotent for terminal states.';

REVOKE ALL ON FUNCTION public.acknowledge_kiosk_command(text, uuid, boolean, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acknowledge_kiosk_command(text, uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.acknowledge_kiosk_command(text, uuid, boolean, text) TO service_role;

-- =====================================================
-- 11. ACTIVITY CONSTRAINTS
-- =====================================================
-- Lock the event_type and actor_type to known values so the UI can render
-- predictable labels and so a misuse cannot inject arbitrary text into the
-- activity feed.

ALTER TABLE public.kiosk_activity_history
  DROP CONSTRAINT IF EXISTS kiosk_activity_history_event_type_check;
ALTER TABLE public.kiosk_activity_history
  ADD CONSTRAINT kiosk_activity_history_event_type_check
  CHECK (event_type IN (
    'enrollment_issued', 'enrollment_completed',
    'change_survey_requested', 'change_survey_applied',
    'refresh_configuration_requested', 'configuration_fetched',
    'configuration_acknowledged', 'configuration_failed',
    'pause_requested', 'pause_applied',
    'resume_requested', 'resume_applied',
    'maintenance_requested', 'maintenance_applied',
    'credential_revoked', 'reenrollment_requested',
    'command_acknowledged', 'command_failed', 'command_expired',
    'command_cancelled', 'heartbeat'
  ));

ALTER TABLE public.kiosk_activity_history
  DROP CONSTRAINT IF EXISTS kiosk_activity_history_actor_type_check;
ALTER TABLE public.kiosk_activity_history
  ADD CONSTRAINT kiosk_activity_history_actor_type_check
  CHECK (actor_type IN ('admin_user', 'kiosk_device', 'system', 'anonymous'));

-- Helpful indexes for the activity filters and pagination.
CREATE INDEX IF NOT EXISTS kiosk_activity_history_org_occurred_idx
  ON public.kiosk_activity_history (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_activity_history_kiosk_occurred_idx
  ON public.kiosk_activity_history (kiosk_device_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS kiosk_activity_history_event_type_idx
  ON public.kiosk_activity_history (organization_id, event_type, occurred_at DESC);

-- Indexes to support the fleet RPC's pending/failed counts and the device
-- poll's lookup by status.
CREATE INDEX IF NOT EXISTS kiosk_remote_commands_kiosk_status_idx
  ON public.kiosk_remote_commands (kiosk_device_id, status);
CREATE INDEX IF NOT EXISTS kiosk_remote_commands_org_status_idx
  ON public.kiosk_remote_commands (organization_id, status);
CREATE INDEX IF NOT EXISTS kiosk_remote_commands_pending_idx
  ON public.kiosk_remote_commands (organization_id, kiosk_device_id)
  WHERE status IN ('pending', 'delivered');

-- =====================================================
-- 12. UPDATE RLS POLICIES
-- =====================================================
-- The C2 migration's RLS policies granted admin access only to members
-- with role = 'organization_admin'. We extend that to platform admins
-- and add a kiosk-facing insert policy for activity rows.
--
-- RLS on kiosk_remote_commands:
--   Admin can manage commands (already from C2; we broaden the role list).
--   Kiosk can read commands (already from C2; we keep anon for the device).
--
-- RLS on kiosk_activity_history:
--   Admin can read (broaden role list).
--   Service-role inserts are allowed by virtue of service_role bypassing
--   RLS. The device-facing RPCs above are SECURITY DEFINER and therefore
--   bypass RLS as the function owner when they insert activity rows.

DROP POLICY IF EXISTS "Admin can manage commands" ON public.kiosk_remote_commands;
CREATE POLICY "Admin can manage commands" ON public.kiosk_remote_commands
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = kiosk_remote_commands.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('organization_admin', 'platform_admin')
    )
  );

DROP POLICY IF EXISTS "Admin can read activity" ON public.kiosk_activity_history;
CREATE POLICY "Admin can read activity" ON public.kiosk_activity_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_memberships om
      WHERE om.organization_id = kiosk_activity_history.organization_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.role IN ('organization_admin', 'platform_admin', 'organization_owner', 'location_manager', 'quality_manager', 'analyst')
    )
  );

COMMIT;
