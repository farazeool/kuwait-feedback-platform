begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select plan(38);

create temporary table milestone_invitation (
  invitation_id uuid,
  invitation_token text,
  expires_at timestamptz
) on commit drop;
grant select, insert, update on milestone_invitation to authenticated;

create temporary table acceptance_invitation (
  scenario text primary key,
  email text not null,
  invitation_id uuid not null,
  invitation_token text not null,
  expires_at timestamptz not null
) on commit drop;
grant select, insert, update on acceptance_invitation to authenticated;

insert into auth.users (instance_id, id, aud, role, email, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000071', 'authenticated', 'authenticated', 'accept-invite@demo.kuwait-feedback.test', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Accept Invite"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000072', 'authenticated', 'authenticated', 'mismatch-invite@demo.kuwait-feedback.test', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Mismatch Invite"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000073', 'authenticated', 'authenticated', 'expired-invite@demo.kuwait-feedback.test', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Expired Invite"}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-4000-8000-000000000074', 'authenticated', 'authenticated', 'revoked-invite@demo.kuwait-feedback.test', now(), '{"provider":"email","providers":["email"]}', '{"display_name":"Revoked Invite"}', now(), now());

insert into public.organizations (id, slug, name_en, name_ar, status)
values ('20000000-0000-4000-8000-000000000099', 'settings-conflict', 'Settings conflict', 'تعارض الإعدادات', 'archived');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);

select lives_ok($$
  insert into milestone_invitation
  select * from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001',
    'new-manager@demo.kuwait-feedback.test',
    'location_manager',
    array['30000000-0000-4000-8000-000000000001'::uuid],
    interval '7 days', 'Welcome', 'ar'
  )
$$, 'owner may create a location-scoped invitation');

select throws_ok($$
  select * from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001',
    'new-manager@demo.kuwait-feedback.test', 'location_manager',
    array['30000000-0000-4000-8000-000000000001'::uuid]
  )
$$, '23505', 'Invitation unavailable', 'duplicate active invitations are rejected');

select throws_ok($$
  select * from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001',
    'no-location@demo.kuwait-feedback.test', 'location_manager', array[]::uuid[]
  )
$$, '22023', 'Location assignment required', 'location manager invitation requires a location');

select throws_ok($$
  select * from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001',
    'owner-role@demo.kuwait-feedback.test', 'organization_owner', array[]::uuid[]
  )
$$, '22023', 'Invitation unavailable', 'tenant invitations cannot create an owner');

reset role;
update auth.users set last_sign_in_at = timezone('utc', now()) where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
select throws_ok($$
  select * from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001',
    'platform-role@demo.kuwait-feedback.test', 'platform_admin', array[]::uuid[]
  )
$$, '22023', 'Invitation unavailable', 'organization admin cannot invite a platform admin');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok($$
  select * from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001',
    'analyst-invite@demo.kuwait-feedback.test', 'analyst', array[]::uuid[]
  )
$$, '42501', 'Invitation unavailable', 'analyst cannot invite members');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000003', true);
select throws_ok($$
  select public.update_organization_member(
    '21000000-0000-4000-8000-000000000003', 'location_manager',
    array['30000000-0000-4000-8000-000000000002'::uuid], 'active'
  )
$$, '42501', 'Member update unavailable', 'location manager cannot expand their own scope');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select throws_ok($$
  select public.update_organization_member(
    '21000000-0000-4000-8000-000000000001', 'organization_admin', array[]::uuid[], 'active'
  )
$$, '42501', 'Member update unavailable', 'owner cannot modify their own role');
reset role;
select throws_ok($$
  delete from public.organization_memberships where id = '21000000-0000-4000-8000-000000000001'
$$, '23514', 'The final active owner cannot be removed or demoted', 'final active owner cannot be removed');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok($$
  select * from public.resend_organization_invitation((select invitation_id from milestone_invitation))
$$, 'owner may resend an invitation');
reset role;
select ok((select revoked_at is not null and superseded_by is not null from public.organization_invitations where id = (select invitation_id from milestone_invitation)), 'resend revokes and supersedes the prior token');

select is((select count(*) from public.organization_invitations where email = 'new-manager@demo.kuwait-feedback.test' and revoked_at is null), 1::bigint, 'only one replacement invitation remains active');
select ok(not has_function_privilege('authenticated', 'public.prepare_organization_invitation(uuid,text,public.app_role,uuid[],interval)', 'EXECUTE'), 'legacy invitation RPC is not callable by clients');
select ok(not has_table_privilege('authenticated', 'public.invitation_rate_limits', 'SELECT'), 'invitation rate fingerprints cannot be listed by clients');
select is((select octet_length(email_hash) from public.invitation_rate_limits limit 1), 32, 'invitation rate limiting stores an email digest');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok($$
  insert into acceptance_invitation
  select 'valid', 'accept-invite@demo.kuwait-feedback.test', r.* from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001', 'accept-invite@demo.kuwait-feedback.test', 'location_manager',
    array['30000000-0000-4000-8000-000000000001'::uuid]
  ) r
  union all
  select 'expired', 'expired-invite@demo.kuwait-feedback.test', r.* from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001', 'expired-invite@demo.kuwait-feedback.test', 'analyst', array[]::uuid[]
  ) r
  union all
  select 'revoked', 'revoked-invite@demo.kuwait-feedback.test', r.* from public.prepare_organization_invitation_v2(
    '20000000-0000-4000-8000-000000000001', 'revoked-invite@demo.kuwait-feedback.test', 'analyst', array[]::uuid[]
  ) r
$$, 'owner can prepare isolated acceptance-state invitations');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000072', true);
select throws_ok(
  $$select public.accept_organization_invitation((select invitation_token from acceptance_invitation where scenario = 'valid'))$$,
  '22023', 'Invitation is invalid or unavailable', 'invitation email mismatch is rejected without revealing account state'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000071', true);
select lives_ok(
  $$select public.accept_organization_invitation((select invitation_token from acceptance_invitation where scenario = 'valid'))$$,
  'matching authenticated recipient can atomically accept an invitation'
);
select is((select role from public.organization_memberships where user_id = auth.uid()), 'location_manager'::public.app_role, 'acceptance creates the immutable invited role');
select is((select count(*) from public.location_memberships where user_id = auth.uid() and location_id = '30000000-0000-4000-8000-000000000001'), 1::bigint, 'acceptance atomically creates the invited location scope');
select throws_ok(
  $$select public.accept_organization_invitation((select invitation_token from acceptance_invitation where scenario = 'valid'))$$,
  '22023', 'Invitation is invalid or unavailable', 'single-use invitation replay is rejected'
);
select is((select count(*) from public.organization_memberships where user_id = auth.uid() and organization_id = '20000000-0000-4000-8000-000000000001'), 1::bigint, 'replay and concurrent uniqueness safeguards leave only one membership');

reset role;
update public.organization_invitations set created_at = timezone('utc', now()) - interval '2 days', expires_at = timezone('utc', now()) - interval '1 second'
where id = (select invitation_id from acceptance_invitation where scenario = 'expired');
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000073', true);
select throws_ok(
  $$select public.accept_organization_invitation((select invitation_token from acceptance_invitation where scenario = 'expired'))$$,
  '22023', 'Invitation is invalid or unavailable', 'expired invitation is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok(
  $$select public.revoke_organization_invitation((select invitation_id from acceptance_invitation where scenario = 'revoked'))$$,
  'owner may revoke an unused invitation'
);
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000074', true);
select throws_ok(
  $$select public.accept_organization_invitation((select invitation_token from acceptance_invitation where scenario = 'revoked'))$$,
  '22023', 'Invitation is invalid or unavailable', 'revoked invitation is rejected'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok($$
  select public.update_organization_settings(
    '20000000-0000-4000-8000-000000000001', 'Denied', '', 'demo-kuwait-hospitality',
    'hospitality', '', '', '', '', '', 'en', 'dd/MM/yyyy', 'en-KW', '', ''
  )
$$, '42501', 'Settings unavailable', 'analyst cannot mutate organization settings');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
select lives_ok($$
  select public.update_organization_settings(
    '20000000-0000-4000-8000-000000000001', 'Demo Kuwait Hospitality Updated',
    'ضيافة الكويت التجريبية', 'demo-kuwait-hospitality', 'hospitality', '+96522223333',
    'support@example.test', 'https://example.test', 'Description', 'وصف', 'ar',
    'dd/MM/yyyy', 'ar-KW', 'help@example.test', '+96522224444'
  )
$$, 'owner may update organization settings');
select ok((select count(*) from public.audit_logs where table_name = 'organizations' and organization_id = '20000000-0000-4000-8000-000000000001') > 0, 'organization settings changes are audited');
select throws_ok($$
  select public.update_organization_settings(
    '20000000-0000-4000-8000-000000000001', 'Duplicate slug', '', 'settings-conflict',
    'hospitality', '', '', '', '', '', 'en', 'dd/MM/yyyy', 'en-KW', '', ''
  )
$$, '23505', null, 'duplicate organization slug is rejected atomically');

select lives_ok($$
  select public.update_location_v2(
    '30000000-0000-4000-8000-000000000001', 'salmiya-marina', 'Salmiya Inactive',
    'السالمية', 'hawalli', 'Salmiya', '', '', '', '', '{}'::jsonb, true, 'Asia/Kuwait', 'archived'
  )
$$, 'owners may deactivate a location instead of deleting it');
select is((select count(*) from public.survey_responses where location_id = '30000000-0000-4000-8000-000000000001'), 3::bigint, 'location deactivation preserves historical responses');

select lives_ok($$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('organization-branding', '20000000-0000-4000-8000-000000000001/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.png', auth.uid()::text,
    '{"mimetype":"image/png","size":1024}'::jsonb)
$$, 'tenant owner may create a valid tenant-scoped branding object');
select throws_ok($$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('organization-branding', '20000000-0000-4000-8000-000000000001/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.svg', auth.uid()::text,
    '{"mimetype":"image/svg+xml","size":1024}'::jsonb)
$$, '42501', null, 'SVG branding upload is rejected');
select throws_ok($$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('organization-branding', '20000000-0000-4000-8000-000000000001/cccccccc-cccc-4ccc-8ccc-cccccccccccc.png', auth.uid()::text,
    '{"mimetype":"image/png","size":3000000}'::jsonb)
$$, '42501', null, 'oversized branding metadata is rejected');
select throws_ok($$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('organization-branding', '20000000-0000-4000-8000-000000000099/dddddddd-dddd-4ddd-8ddd-dddddddddddd.png', auth.uid()::text,
    '{"mimetype":"image/png","size":1024}'::jsonb)
$$, '42501', null, 'cross-tenant branding storage is denied');

reset role;
set local role anon;
select throws_ok($$
  insert into storage.objects (bucket_id, name, metadata)
  values ('organization-branding', '20000000-0000-4000-8000-000000000001/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee.png',
    '{"mimetype":"image/png","size":1024}'::jsonb)
$$, '42501', null, 'anonymous users cannot upload branding objects');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000005', true);
select is((public.get_platform_overview() ->> 'active_organizations')::integer, 1, 'platform admin can access operational organization counts');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000004', true);
select throws_ok($$select public.get_platform_overview()$$, '42501', 'Platform access denied', 'tenant analyst cannot access platform administration');

select * from finish();
rollback;
