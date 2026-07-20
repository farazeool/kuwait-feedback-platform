-- Plain SQL policy verification that fails immediately on an incorrect result.
-- The file runs in one transaction and leaves the database unchanged.

begin;

do $$
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'Seed must contain exactly one demo organization';
  end if;
  if (select count(*) from public.locations) <> 2 then
    raise exception 'Seed must contain exactly two locations';
  end if;
  if (select count(*) from public.surveys where status = 'active') <> 1 then
    raise exception 'Seed must contain exactly one active survey';
  end if;
  if (select count(*) from public.survey_responses) <> 3 then
    raise exception 'Seed must contain representative responses';
  end if;
  if not exists (select 1 from public.audit_logs) then
    raise exception 'Administrative seed mutations must be audited';
  end if;
end;
$$;

insert into public.organizations (
  id,
  slug,
  name_en,
  name_ar,
  created_by
) values (
  '20000000-0000-4000-8000-000000000099',
  'rls-isolation-control',
  'RLS Isolation Control',
  'اختبار عزل الصلاحيات',
  '10000000-0000-4000-8000-000000000005'
);

insert into public.locations (
  id,
  organization_id,
  slug,
  name_en,
  name_ar,
  created_by
) values (
  '30000000-0000-4000-8000-000000000099',
  '20000000-0000-4000-8000-000000000099',
  'hidden-control-location',
  'Hidden Control Location',
  'موقع اختبار مخفي',
  '10000000-0000-4000-8000-000000000005'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000001',
  true
);

do $$
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'Organization owner crossed a tenant boundary';
  end if;
  if (select count(*) from public.locations) <> 2 then
    raise exception 'Organization owner cannot see all owned locations';
  end if;
  if (select count(*) from public.survey_responses) <> 3 then
    raise exception 'Organization owner cannot read owned responses';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);

do $$
begin
  if (select count(*) from public.locations) <> 1 then
    raise exception 'Location manager escaped an explicit location assignment';
  end if;
  if (select count(*) from public.survey_responses) <> 3 then
    raise exception 'Location manager cannot read assigned-location responses';
  end if;
  if (select count(*) from public.organization_memberships) <> 1 then
    raise exception 'Location manager can read unrelated organization memberships';
  end if;
  if exists (select 1 from public.audit_logs) then
    raise exception 'Location manager can read organization-wide audit logs';
  end if;
end;
$$;

update public.locations
set name_en = 'Unauthorized manager mutation'
where id = '30000000-0000-4000-8000-000000000001';

reset role;

do $$
begin
  if (
    select name_en
    from public.locations
    where id = '30000000-0000-4000-8000-000000000001'
  ) = 'Unauthorized manager mutation' then
    raise exception 'Location manager unexpectedly changed location data';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

do $$
begin
  if (select count(*) from public.locations) <> 2 then
    raise exception 'Organization analyst cannot read permitted locations';
  end if;
  if (select count(*) from public.survey_responses) <> 3 then
    raise exception 'Organization analyst cannot read permitted responses';
  end if;
end;
$$;

update public.organization_memberships
set role = 'organization_admin'
where user_id = auth.uid();

update public.organizations
set name_en = 'Unauthorized analyst mutation'
where id = '20000000-0000-4000-8000-000000000001';

reset role;

do $$
begin
  if (
    select role
    from public.organization_memberships
    where user_id = '10000000-0000-4000-8000-000000000004'
  ) <> 'analyst' then
    raise exception 'User promoted their own tenant role';
  end if;
  if (
    select name_en
    from public.organizations
    where id = '20000000-0000-4000-8000-000000000001'
  ) = 'Unauthorized analyst mutation' then
    raise exception 'Analyst obtained write access';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000002',
  true
);

update public.organization_memberships
set role = 'analyst'
where user_id = '10000000-0000-4000-8000-000000000001';

update public.locations
set address_en = 'Organization admin policy verification'
where id = '30000000-0000-4000-8000-000000000002';

reset role;

do $$
begin
  if (
    select role
    from public.organization_memberships
    where user_id = '10000000-0000-4000-8000-000000000001'
  ) <> 'organization_owner' then
    raise exception 'Organization admin modified an owner role';
  end if;
  if (
    select address_en
    from public.locations
    where id = '30000000-0000-4000-8000-000000000002'
  ) <> 'Organization admin policy verification' then
    raise exception 'Organization admin could not manage an owned location';
  end if;
end;
$$;

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000005',
  true
);

do $$
begin
  if (select count(*) from public.organizations) <> 2 then
    raise exception 'Platform admin cannot access all organizations';
  end if;
end;
$$;

reset role;

do $$
begin
  if has_table_privilege('anon', 'public.surveys', 'SELECT') then
    raise exception 'Anonymous role received direct survey-table reads';
  end if;
  if has_table_privilege('anon', 'public.survey_responses', 'INSERT') then
    raise exception 'Anonymous role received direct response-table inserts';
  end if;
  if has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE') then
    raise exception 'Ordinary users can edit audit logs';
  end if;
  if not has_function_privilege(
    'anon',
    'public.get_public_survey(text)',
    'EXECUTE'
  ) then
    raise exception 'Anonymous role cannot read the narrow public survey shape';
  end if;
end;
$$;

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  v_public_survey jsonb;
begin
  v_public_survey := public.get_public_survey(
    'demo-salmiya-customer-satisfaction-2026'
  );

  if jsonb_array_length(v_public_survey -> 'questions') <> 3 then
    raise exception 'Public survey shape is incomplete';
  end if;

  if v_public_survey ? 'organization_id' then
    raise exception 'Public survey shape leaks internal organization identity';
  end if;
end;
$$;

select public.submit_protected_survey_response(
  'demo-salmiya-customer-satisfaction-2026',
  'en',
  '[
    {
      "question_id":"50000000-0000-4000-8000-000000000001",
      "rating":5
    },
    {
      "question_id":"50000000-0000-4000-8000-000000000002",
      "option_ids":["60000000-0000-4000-8000-000000000001"]
    }
  ]'::jsonb,
  'policy-test-idempotency-0001',
  repeat('a', 64)
);

do $$
begin
  begin
    perform public.submit_protected_survey_response(
      'demo-salmiya-customer-satisfaction-2026',
      'en',
      '[
        {
          "question_id":"50000000-0000-4000-8000-000000000001",
          "rating":99
        },
        {
          "question_id":"50000000-0000-4000-8000-000000000002",
          "option_ids":["60000000-0000-4000-8000-000000000001"]
        }
      ]'::jsonb,
      'policy-test-invalid-0001',
      repeat('b', 64)
    );
    raise exception 'Invalid public rating unexpectedly succeeded';
  exception
    when check_violation or invalid_parameter_value then
      null;
  end;
end;
$$;

reset role;

do $$
begin
  if (
    select count(*)
    from public.survey_responses
    where idempotency_key = 'policy-test-idempotency-0001'
  ) <> 1 then
    raise exception 'Valid anonymous submission was not inserted exactly once';
  end if;
end;
$$;

rollback;
