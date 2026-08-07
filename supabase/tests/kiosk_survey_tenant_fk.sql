-- Tenant-safety contract for kiosk_devices.survey_id.
--
-- Covers migration 20260731220000_kiosk_survey_tenant_fk.sql, which replaced
-- the single-column survey FK with the composite form
--   (survey_id, organization_id) -> surveys (id, organization_id)
--       ON DELETE SET NULL (survey_id)
--
-- Every write below goes through DIRECT SQL, deliberately bypassing
-- create_kiosk_device / update_kiosk_device. Those RPCs already validate
-- survey ownership procedurally; the point of these tests is that the
-- DATABASE refuses cross-tenant assignment even when the RPCs are not the
-- write path. A test that went through the RPCs would pass with or without
-- the migration and would prove nothing about the constraint.
--
-- Runs as one transaction and rolls back. Fixture ids use the 9xxx prefix so
-- they cannot collide with kiosk_authorization.sql's 1111/2222/3333 ids.

begin;

-- Keep notices visible: each check below reports its own PASS line.
set local client_min_messages = notice;


-- ---------------------------------------------------------------------------
-- Fixtures: two organizations, each with a location and an active survey.
-- ---------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email)
values
  ('99990000-0000-4000-8000-00000000000a', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fk-alpha@kiosk.test'),
  ('99990000-0000-4000-8000-00000000000b', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'fk-beta@kiosk.test');

insert into public.profiles (id, display_name, status)
values
  ('99990000-0000-4000-8000-00000000000a', 'FK Alpha Owner', 'active'),
  ('99990000-0000-4000-8000-00000000000b', 'FK Beta Owner', 'active')
on conflict (id) do update
set display_name = excluded.display_name,
    status = excluded.status;

insert into public.organizations (id, slug, name_en, name_ar, created_by)
values
  ('99991000-0000-4000-8000-00000000000a', 'fk-alpha', 'FK Alpha', 'إف كيه ألفا', '99990000-0000-4000-8000-00000000000a'),
  ('99991000-0000-4000-8000-00000000000b', 'fk-beta', 'FK Beta', 'إف كيه بيتا', '99990000-0000-4000-8000-00000000000b');

insert into public.locations (id, organization_id, slug, name_en, name_ar, created_by)
values
  ('99992000-0000-4000-8000-00000000000a', '99991000-0000-4000-8000-00000000000a', 'fk-alpha-branch', 'FK Alpha Branch', 'فرع ألفا', '99990000-0000-4000-8000-00000000000a'),
  ('99992000-0000-4000-8000-00000000000b', '99991000-0000-4000-8000-00000000000b', 'fk-beta-branch', 'FK Beta Branch', 'فرع بيتا', '99990000-0000-4000-8000-00000000000b');

-- alpha_1 and alpha_2 belong to Alpha; beta_1 belongs to Beta and is the
-- cross-tenant survey the constraint must reject.
-- surveys_active_published_check requires published_at to be set whenever
-- status is 'active', so these fixtures are published rather than bare.
insert into public.surveys (id, organization_id, location_id, title_en, title_ar, status, published_at)
values
  ('99993000-0000-4000-8000-00000000000a', '99991000-0000-4000-8000-00000000000a', '99992000-0000-4000-8000-00000000000a', 'FK Alpha Survey One', 'استبيان ألفا ١', 'active', now()),
  ('99993000-0000-4000-8000-00000000000c', '99991000-0000-4000-8000-00000000000a', '99992000-0000-4000-8000-00000000000a', 'FK Alpha Survey Two', 'استبيان ألفا ٢', 'active', now()),
  ('99993000-0000-4000-8000-00000000000b', '99991000-0000-4000-8000-00000000000b', '99992000-0000-4000-8000-00000000000b', 'FK Beta Survey', 'استبيان بيتا', 'active', now()),
  -- Reserved for the attribution check (T7): survey_responses has a
  -- validate_survey_response_scope trigger that only accepts responses against
  -- an ACTIVE survey, so T7 needs a survey the earlier checks never archive.
  ('99993000-0000-4000-8000-00000000000d', '99991000-0000-4000-8000-00000000000a', '99992000-0000-4000-8000-00000000000a', 'FK Alpha Survey Three', 'استبيان ألفا ٣', 'active', now());



do $$
declare
  v_alpha_org  constant uuid := '99991000-0000-4000-8000-00000000000a';
  v_alpha_loc  constant uuid := '99992000-0000-4000-8000-00000000000a';
  v_alpha_s1   constant uuid := '99993000-0000-4000-8000-00000000000a';
  v_alpha_s2   constant uuid := '99993000-0000-4000-8000-00000000000c';
  v_beta_s1    constant uuid := '99993000-0000-4000-8000-00000000000b';
  v_alpha_s3   constant uuid := '99993000-0000-4000-8000-00000000000d';
  v_owner      constant uuid := '99990000-0000-4000-8000-00000000000a';
  v_device     uuid;
  v_survey     uuid;
  v_org        uuid;
  v_count      int;
  v_response   uuid;

begin
  -- === 1. Same-organization survey assignment succeeds ======================
  insert into public.kiosk_devices (
    organization_id, location_id, device_name, access_token, survey_id, created_by
  ) values (
    v_alpha_org, v_alpha_loc, 'FK Device A', 'fk-token-a', v_alpha_s1, v_owner
  )
  returning id into v_device;

  select survey_id into v_survey from public.kiosk_devices where id = v_device;
  if v_survey is distinct from v_alpha_s1 then
    raise exception 'T1 FAILED: same-org survey assignment did not persist (got %)', v_survey;
  end if;
  raise notice 'T1 PASS: same-organization survey assignment succeeds';

  -- === 2. Cross-organization assignment fails through direct SQL ============
  -- Beta's survey onto an Alpha device. Pre-migration this succeeded.
  begin
    insert into public.kiosk_devices (
      organization_id, location_id, device_name, access_token, survey_id, created_by
    ) values (
      v_alpha_org, v_alpha_loc, 'FK Device Cross', 'fk-token-cross', v_beta_s1, v_owner
    );
    raise exception 'T2 FAILED: cross-organization survey assignment was ACCEPTED';
  exception
    when foreign_key_violation then
      raise notice 'T2 PASS: cross-organization assignment rejected by FK';
  end;

  -- === 3. Valid reassignment succeeds ======================================
  update public.kiosk_devices set survey_id = v_alpha_s2 where id = v_device;

  select survey_id into v_survey from public.kiosk_devices where id = v_device;
  if v_survey is distinct from v_alpha_s2 then
    raise exception 'T3 FAILED: same-org reassignment did not persist (got %)', v_survey;
  end if;
  raise notice 'T3 PASS: same-organization reassignment succeeds';

  -- === 4. Cross-tenant reassignment fails ==================================
  begin
    update public.kiosk_devices set survey_id = v_beta_s1 where id = v_device;
    raise exception 'T4 FAILED: cross-tenant reassignment was ACCEPTED';
  exception
    when foreign_key_violation then
      raise notice 'T4 PASS: cross-tenant reassignment rejected by FK';
  end;

  -- Confirm the rejected update left the prior value intact.
  select survey_id into v_survey from public.kiosk_devices where id = v_device;
  if v_survey is distinct from v_alpha_s2 then
    raise exception 'T4 FAILED: rejected reassignment mutated survey_id to %', v_survey;
  end if;

  -- === 5. NULL survey_id remains permitted =================================
  update public.kiosk_devices set survey_id = null where id = v_device;

  select survey_id, organization_id into v_survey, v_org
  from public.kiosk_devices where id = v_device;

  if v_survey is not null then
    raise exception 'T5 FAILED: survey_id could not be set to NULL';
  end if;
  if v_org is distinct from v_alpha_org then
    raise exception 'T5 FAILED: organization_id changed when survey_id was nulled';
  end if;
  raise notice 'T5 PASS: NULL survey_id permitted; organization_id preserved';

  -- === 6. Survey deletion: SET NULL scoped to survey_id =====================
  -- The composite FK must null ONLY survey_id. If the migration had omitted
  -- the column list, this would attempt to null organization_id too.
  update public.kiosk_devices set survey_id = v_alpha_s1 where id = v_device;

  delete from public.surveys where id = v_alpha_s1;

  select survey_id, organization_id into v_survey, v_org
  from public.kiosk_devices where id = v_device;

  if v_survey is not null then
    raise exception 'T6 FAILED: survey deletion left survey_id = %', v_survey;
  end if;
  if v_org is distinct from v_alpha_org then
    raise exception 'T6 FAILED: survey deletion nulled/changed organization_id (got %)', v_org;
  end if;

  select count(*) into v_count from public.kiosk_devices where id = v_device;
  if v_count <> 1 then
    raise exception 'T6 FAILED: survey deletion cascaded and removed the device';
  end if;
  raise notice 'T6 PASS: survey deletion nulls survey_id only; device and org intact';

  -- Deactivation (status change) must not detach the device at all.
  update public.kiosk_devices set survey_id = v_alpha_s2 where id = v_device;
  update public.surveys set status = 'archived' where id = v_alpha_s2;

  select survey_id into v_survey from public.kiosk_devices where id = v_device;
  if v_survey is distinct from v_alpha_s2 then
    raise exception 'T6b FAILED: archiving a survey detached it from the device';
  end if;
  raise notice 'T6b PASS: archiving a survey does not detach it (RPC-level concern)';

  -- === 7. Historical response attribution is not rewritten ==================
  -- survey_responses snapshots survey_id/organization_id/location_id at write
  -- time and holds no kiosk device reference, so detaching or reassigning a
  -- device's survey must leave past rows byte-identical.
  update public.kiosk_devices set survey_id = v_alpha_s3 where id = v_device;

  insert into public.survey_responses (
    survey_id, organization_id, location_id, locale, channel
  ) values (
    v_alpha_s3, v_alpha_org, v_alpha_loc, 'en'::locale_code, 'kiosk'::response_channel
  )
  returning id into v_response;

  -- Detach the device from the survey the response was attributed to.
  update public.kiosk_devices set survey_id = null where id = v_device;

  select count(*) into v_count
  from public.survey_responses
  where id = v_response
    and survey_id = v_alpha_s3
    and organization_id = v_alpha_org
    and location_id = v_alpha_loc;


  if v_count <> 1 then
    raise exception 'T7 FAILED: historical response attribution changed after device detach';
  end if;
  raise notice 'T7 PASS: historical response attribution unchanged';

  raise notice 'ALL KIOSK SURVEY FK TESTS PASSED';
end $$;

-- ---------------------------------------------------------------------------
-- Teardown verification: every fixture must vanish with the rollback.
-- ---------------------------------------------------------------------------
rollback;

select
  (select count(*) from public.kiosk_devices where organization_id::text like '99991000%') as devices,
  (select count(*) from public.surveys where organization_id::text like '99991000%')       as surveys,
  (select count(*) from public.locations where organization_id::text like '99991000%')     as locations,
  (select count(*) from public.organizations where id::text like '99991000%')              as orgs,
  (select count(*) from public.profiles where id::text like '99990000%')                   as profiles,
  (select count(*) from auth.users where id::text like '99990000%')                        as users;
