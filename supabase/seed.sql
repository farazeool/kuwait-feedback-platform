-- Local-only synthetic data. Demo password for every account is "Test1234!".
-- These identities are for a disposable local Supabase environment only.

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  email_confirmed_at,
  encrypted_password,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change_token,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'owner@demo.kuwait-feedback.test',
    timezone('utc', now()),
    crypt('Test1234!', gen_salt('bf')),
    '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo Organization Owner","preferred_locale":"en"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'admin@demo.kuwait-feedback.test',
    timezone('utc', now()),
    crypt('Test1234!', gen_salt('bf')),
    '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo Organization Admin","preferred_locale":"ar"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000003',
    'authenticated',
    'authenticated',
    'manager@demo.kuwait-feedback.test',
    timezone('utc', now()),
    crypt('Test1234!', gen_salt('bf')),
    '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo Salmiya Manager","preferred_locale":"en"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000004',
    'authenticated',
    'authenticated',
    'analyst@demo.kuwait-feedback.test',
    timezone('utc', now()),
    crypt('Test1234!', gen_salt('bf')),
    '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo Feedback Analyst","preferred_locale":"ar"}',
    timezone('utc', now()),
    timezone('utc', now())
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-4000-8000-000000000005',
    'authenticated',
    'authenticated',
    'platform-admin@demo.kuwait-feedback.test',
    timezone('utc', now()),
    crypt('Test1234!', gen_salt('bf')),
    '', '', '', '', '', '', '',
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Demo Platform Admin","preferred_locale":"en"}',
    timezone('utc', now()),
    timezone('utc', now())
  )
on conflict (id) do update set
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change_token_current = excluded.email_change_token_current,
  email_change = excluded.email_change,
  phone_change_token = excluded.phone_change_token,
  reauthentication_token = excluded.reauthentication_token,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = excluded.updated_at;

insert into auth.identities (
  id,
  user_id,
  provider_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  u.id,
  u.id,
  u.email,
  jsonb_build_object(
    'sub', u.id::text,
    'email', u.email,
    'email_verified', true
  ),
  'email',
  timezone('utc', now()),
  timezone('utc', now()),
  timezone('utc', now())
from auth.users u
where u.id in (
  '10000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000003',
  '10000000-0000-4000-8000-000000000004',
  '10000000-0000-4000-8000-000000000005'
)
on conflict (provider_id, provider) do update set
  identity_data = excluded.identity_data,
  updated_at = excluded.updated_at;

update public.profiles
set platform_role = 'platform_admin'
where id = '10000000-0000-4000-8000-000000000005';

insert into public.organizations (
  id,
  slug,
  name_en,
  name_ar,
  created_by,
  created_at,
  updated_at
) values (
  '20000000-0000-4000-8000-000000000001',
  'demo-kuwait-hospitality',
  'Demo Kuwait Hospitality',
  'ضيافة الكويت التجريبية',
  '10000000-0000-4000-8000-000000000001',
  '2026-07-01 08:00:00+03',
  '2026-07-01 08:00:00+03'
);

insert into public.organization_memberships (
  id,
  organization_id,
  user_id,
  role,
  scope,
  created_by
) values
  (
    '21000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'organization_owner',
    'organization',
    '10000000-0000-4000-8000-000000000005'
  ),
  (
    '21000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    'organization_admin',
    'organization',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '21000000-0000-4000-8000-000000000003',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000003',
    'location_manager',
    'locations',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '21000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000004',
    'analyst',
    'organization',
    '10000000-0000-4000-8000-000000000001'
  );

insert into public.locations (
  id,
  organization_id,
  slug,
  name_en,
  name_ar,
  address_en,
  address_ar,
  created_by
) values
  (
    '30000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'salmiya-marina',
    'Salmiya Marina',
    'مارينا السالمية',
    'Salem Al Mubarak Street, Salmiya, Kuwait',
    'شارع سالم المبارك، السالمية، الكويت',
    '10000000-0000-4000-8000-000000000001'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000001',
    'kuwait-city-sharq',
    'Kuwait City – Sharq',
    'مدينة الكويت – الشرق',
    'Ahmad Al Jaber Street, Sharq, Kuwait City',
    'شارع أحمد الجابر، الشرق، مدينة الكويت',
    '10000000-0000-4000-8000-000000000001'
  );

insert into public.location_memberships (
  id,
  location_id,
  organization_id,
  user_id,
  role,
  created_by
) values (
  '31000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000003',
  'location_manager',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.surveys (
  id,
  organization_id,
  location_id,
  public_slug,
  title_en,
  title_ar,
  description_en,
  description_ar,
  status,
  default_locale,
  published_at,
  created_by
) values (
  '40000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  'demo-salmiya-customer-satisfaction-2026',
  'Customer satisfaction survey',
  'استبيان رضا العملاء',
  'Tell us about your visit to our Salmiya location.',
  'أخبرنا عن زيارتك لفرع السالمية.',
  'active',
  'en',
  '2026-07-01 09:00:00+03',
  '10000000-0000-4000-8000-000000000001'
);

insert into public.survey_questions (
  id,
  survey_id,
  organization_id,
  position,
  question_type,
  status,
  prompt_en,
  prompt_ar,
  is_required,
  rating_min,
  rating_max,
  allow_multiple,
  text_max_length
) values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    1,
    'rating',
    'active',
    'How would you rate your visit?',
    'كيف تقيم زيارتك؟',
    true,
    1,
    5,
    false,
    null
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    2,
    'multiple_choice',
    'active',
    'What stood out during your visit?',
    'ما الذي تميز خلال زيارتك؟',
    true,
    null,
    null,
    true,
    null
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    3,
    'text',
    'active',
    'What could we improve?',
    'ما الذي يمكننا تحسينه؟',
    false,
    null,
    null,
    false,
    1000
  );

insert into public.survey_question_options (
  id,
  question_id,
  survey_id,
  organization_id,
  position,
  label_en,
  label_ar
) values
  (
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    1,
    'Friendly staff',
    'طاقم ودود'
  ),
  (
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    2,
    'Fast service',
    'خدمة سريعة'
  ),
  (
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    3,
    'Clean location',
    'نظافة المكان'
  );

insert into public.survey_responses (
  id,
  survey_id,
  organization_id,
  location_id,
  locale,
  overall_rating,
  submitted_at,
  created_at
) values
  (
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'en',
    5,
    '2026-07-10 18:15:00+03',
    '2026-07-10 18:15:00+03'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'ar',
    2,
    '2026-07-12 20:40:00+03',
    '2026-07-12 20:40:00+03'
  ),
  (
    '70000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    'en',
    4,
    '2026-07-15 13:05:00+03',
    '2026-07-15 13:05:00+03'
  );

insert into public.survey_answers (
  id,
  response_id,
  survey_id,
  organization_id,
  question_id,
  rating_value,
  text_value
) values
  (
    '80000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    5,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    null,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000003',
    '70000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000003',
    null,
    'Keep the excellent service.'
  ),
  (
    '80000000-0000-4000-8000-000000000004',
    '70000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    2,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000005',
    '70000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    null,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000006',
    '70000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000003',
    null,
    'الانتظار كان طويلاً قليلاً.'
  ),
  (
    '80000000-0000-4000-8000-000000000007',
    '70000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    4,
    null
  ),
  (
    '80000000-0000-4000-8000-000000000008',
    '70000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002',
    null,
    null
  );

insert into public.survey_answer_choices (answer_id, option_id, question_id)
values
  (
    '80000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000002'
  ),
  (
    '80000000-0000-4000-8000-000000000005',
    '60000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000002'
  ),
  (
    '80000000-0000-4000-8000-000000000008',
    '60000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000002'
  );

insert into public.alerts (
  id,
  organization_id,
  location_id,
  response_id,
  alert_type,
  status,
  rating_value,
  threshold_value,
  message
) values (
  '90000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  '30000000-0000-4000-8000-000000000001',
  '70000000-0000-4000-8000-000000000002',
  'low_score',
  'open',
  2,
  3,
  'Local demo alert generated for a rating below the configured threshold.'
);

insert into public.subscriptions (
  id,
  organization_id,
  status,
  plan_code,
  trial_ends_at,
  current_period_starts_at,
  current_period_ends_at
) values (
  'a0000000-0000-4000-8000-000000000001',
  '20000000-0000-4000-8000-000000000001',
  'trialing',
  'local_demo',
  '2026-08-01 00:00:00+03',
  '2026-07-01 00:00:00+03',
  '2026-08-01 00:00:00+03'
);
