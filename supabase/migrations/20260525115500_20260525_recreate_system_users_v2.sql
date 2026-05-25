/*
  # Recreate system users v2 — include provider_id in identities

  Fresh recreation of admin, rrhh, prevencion users with correct schema.
  New passwords:
    - admin@empresa.com / Admin1234!
    - rrhh@empresa.com / Rrhh1234!
    - prevencion@empresa.com / Prev1234!
*/

DELETE FROM auth.identities WHERE user_id IN (
  SELECT id FROM auth.users WHERE email IN ('admin@empresa.com','rrhh@empresa.com','prevencion@empresa.com')
);
DELETE FROM auth.users WHERE email IN ('admin@empresa.com','rrhh@empresa.com','prevencion@empresa.com');

-- admin
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES (
  '2c86e12f-0435-49c9-ab53-3d4726e0054c',
  '00000000-0000-0000-0000-000000000000',
  'admin@empresa.com',
  crypt('Admin1234!', gen_salt('bf')),
  now(), 'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Administrador"}',
  now(), now(), '', '', '', ''
);
INSERT INTO auth.identities (id, provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '2c86e12f-0435-49c9-ab53-3d4726e0054c',
  '2c86e12f-0435-49c9-ab53-3d4726e0054c',
  'email',
  '{"sub":"2c86e12f-0435-49c9-ab53-3d4726e0054c","email":"admin@empresa.com","email_verified":true}',
  now(), now(), now()
);

-- rrhh
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES (
  '0b64ee2e-1b8d-4552-bd26-08abacaf3a2b',
  '00000000-0000-0000-0000-000000000000',
  'rrhh@empresa.com',
  crypt('Rrhh1234!', gen_salt('bf')),
  now(), 'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Responsable RRHH"}',
  now(), now(), '', '', '', ''
);
INSERT INTO auth.identities (id, provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '0b64ee2e-1b8d-4552-bd26-08abacaf3a2b',
  '0b64ee2e-1b8d-4552-bd26-08abacaf3a2b',
  'email',
  '{"sub":"0b64ee2e-1b8d-4552-bd26-08abacaf3a2b","email":"rrhh@empresa.com","email_verified":true}',
  now(), now(), now()
);

-- prevencion
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  aud, role, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change
) VALUES (
  '7c1a9a41-0ffa-413c-aba5-b8b736675797',
  '00000000-0000-0000-0000-000000000000',
  'prevencion@empresa.com',
  crypt('Prev1234!', gen_salt('bf')),
  now(), 'authenticated', 'authenticated',
  '{"provider":"email","providers":["email"]}',
  '{"nombre":"Gestor Prevencion"}',
  now(), now(), '', '', '', ''
);
INSERT INTO auth.identities (id, provider_id, user_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  '7c1a9a41-0ffa-413c-aba5-b8b736675797',
  '7c1a9a41-0ffa-413c-aba5-b8b736675797',
  'email',
  '{"sub":"7c1a9a41-0ffa-413c-aba5-b8b736675797","email":"prevencion@empresa.com","email_verified":true}',
  now(), now(), now()
);
