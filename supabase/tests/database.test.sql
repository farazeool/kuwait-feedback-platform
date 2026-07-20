begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(26);

create temporary table invitation_result (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
) on commit drop;
grant select, insert on invitation_result to authenticated;

select is(
  (select count(*) from public.organizations),
  1::bigint,
  'seed contains one demo organization'
);
select is(
  (select count(*) from public.locations),
  2::bigint,
  'seed contains two Kuwait locations'
);
select is(
  (select count(*) from public.survey_responses),
  3::bigint,
  'seed contains representative responses'
);
select ok(
  not has_table_privilege('anon', 'public.surveys', 'SELECT'),
  'anonymous users cannot read survey tables directly'
);
select ok(
  not has_table_privilege('anon', 'public.survey_responses', 'INSERT'),
  'anonymous users cannot insert response rows directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE'),
  'ordinary users cannot edit audit logs'
);
select ok(
  not has_table_privilege('authenticated', 'public.organization_invitations', 'SELECT'),
  'ordinary clients cannot read invitation token digests'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);

select is(
  jsonb_array_length(
    public.get_public_survey('demo-salmiya-customer-satisfaction-2026') -> 'questions'
  ),
  3,
  'anonymous survey RPC returns the published question structure'
);
select ok(
  public.submit_protected_survey_response(
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
    'pgtap-anonymous-0001',
    repeat('a', 64)
  ) ->> 'response_id' is not null,
  'anonymous users can submit a valid response through the narrow RPC'
);
select throws_ok(
  $$
    select public.submit_protected_survey_response(
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
      'pgtap-invalid-0001',
      repeat('b', 64)
    )
  $$,
  '23514',
  'Invalid rating answer',
  'anonymous invalid ratings are rejected'
);

reset role;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000090',
  'authenticated',
  'authenticated',
  'onboarding-user@demo.kuwait-feedback.test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Onboarding Test User"}',
  timezone('utc', now()),
  timezone('utc', now())
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000090',
  true
);

select lives_ok(
  $$
    select * from public.create_organization_with_first_location(
      'Atomic Test Organization',
      '',
      'atomic-test-organization',
      'restaurant',
      '+96522223333',
      'First Location',
      '',
      'first-location',
      'capital',
      'Sharq',
      'Block 1',
      'Asia/Kuwait'
    )
  $$,
  'atomic onboarding succeeds for an authenticated user without membership'
);
select is(
  (
    select count(*)
    from public.organization_memberships om
    join public.organizations o on o.id = om.organization_id
    where o.slug = 'atomic-test-organization'
      and om.user_id = auth.uid()
      and om.role = 'organization_owner'
      and om.scope = 'organization'
  ),
  1::bigint,
  'onboarding atomically creates the owner membership'
);
select is(
  (
    select count(*)
    from public.locations l
    join public.organizations o on o.id = l.organization_id
    where o.slug = 'atomic-test-organization'
      and l.governorate = 'capital'
      and l.area = 'Sharq'
  ),
  1::bigint,
  'onboarding atomically creates the first location'
);
select is(
  (
    select count(*)
    from public.audit_logs al
    join public.organizations o on o.id = al.organization_id
    where o.slug = 'atomic-test-organization'
  ) > 0,
  true,
  'onboarding administrative mutations are audited'
);

select lives_ok(
  $$
    insert into invitation_result
    select * from public.prepare_organization_invitation_v2(
      (select id from public.organizations where slug = 'atomic-test-organization'),
      'invited-manager@demo.kuwait-feedback.test',
      'location_manager',
      array[(
        select l.id
        from public.locations l
        join public.organizations o on o.id = l.organization_id
        where o.slug = 'atomic-test-organization'
      )],
      interval '1 day',
      'Welcome to the demo team',
      'en'
    )
  $$,
  'owners can prepare a location-scoped invitation'
);

reset role;

select is(
  (
    select octet_length(oi.token_hash)
    from public.organization_invitations oi
    join invitation_result ir on ir.invitation_id = oi.id
  ),
  32,
  'invitation tokens are persisted only as SHA-256 digests'
);
select is(
  (
    select oi.scope
    from public.organization_invitations oi
    join invitation_result ir on ir.invitation_id = oi.id
  ),
  'locations'::public.membership_scope,
  'location-manager invitations are explicitly location scoped'
);
select is(
  (
    select count(*)
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'organization_invitations'
      and column_name in ('token', 'invitation_token')
  ),
  0::bigint,
  'invitation tables have no plaintext token column'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000091',
  'authenticated',
  'authenticated',
  'duplicate-slug-user@demo.kuwait-feedback.test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Duplicate Slug Test User"}',
  timezone('utc', now()),
  timezone('utc', now())
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000091',
  true
);
select throws_ok(
  $$
    select * from public.create_organization_with_first_location(
      'Duplicate Slug Organization',
      '',
      'atomic-test-organization',
      'other',
      '',
      'Duplicate Location',
      '',
      'duplicate-location',
      'hawalli',
      'Salmiya',
      '',
      'Asia/Kuwait'
    )
  $$,
  '23505',
  'duplicate key value violates unique constraint "organizations_slug_key"',
  'duplicate organization slugs are rejected'
);
reset role;
select is(
  (
    select count(*) from public.organization_memberships
    where user_id = '10000000-0000-4000-8000-000000000091'
  ),
  0::bigint,
  'failed onboarding leaves no partial owner membership'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-4000-8000-000000000092',
  'authenticated',
  'authenticated',
  'invited-manager@demo.kuwait-feedback.test',
  timezone('utc', now()),
  '{"provider":"email","providers":["email"]}',
  '{"display_name":"Invited Manager Test User"}',
  timezone('utc', now()),
  timezone('utc', now())
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000092',
  true
);
select lives_ok(
  $$
    select public.accept_organization_invitation(
      (select invitation_token from invitation_result limit 1)
    )
  $$,
  'the invited identity can accept the one-time token'
);
select throws_ok(
  $$
    select public.accept_organization_invitation(
      (select invitation_token from invitation_result limit 1)
    )
  $$,
  '22023',
  'Invitation is invalid or unavailable',
  'an accepted invitation cannot be reused'
);
reset role;
select is(
  (
    select count(*)
    from public.organization_memberships om
    join public.location_memberships lm
      on lm.organization_id = om.organization_id
      and lm.user_id = om.user_id
    where om.user_id = '10000000-0000-4000-8000-000000000092'
      and om.role = 'location_manager'
      and om.scope = 'locations'
      and lm.role = 'location_manager'
  ),
  1::bigint,
  'acceptance applies the stored role and explicit location scope'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000003',
  true
);

select is(
  (select count(*) from public.locations),
  1::bigint,
  'location managers remain restricted to explicit location assignments'
);

reset role;
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '10000000-0000-4000-8000-000000000004',
  true
);

select is_empty(
  $$
    update public.organizations
    set name_en = 'Unauthorized analyst write'
    where id = '20000000-0000-4000-8000-000000000001'
    returning id
  $$,
  'analysts remain read-only'
);

select throws_ok(
  $$
    select * from public.prepare_organization_invitation_v2(
      '20000000-0000-4000-8000-000000000001',
      'forbidden@demo.kuwait-feedback.test',
      'platform_admin',
      array[]::uuid[],
      interval '1 day',
      null,
      'en'
    )
  $$,
  '42501',
  'Invitation unavailable',
  'analysts cannot prepare or promote through invitations'
);

select * from finish();
rollback;
