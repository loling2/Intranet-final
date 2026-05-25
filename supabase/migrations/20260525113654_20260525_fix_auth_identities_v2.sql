/*
  # Añadir registros en auth.identities (con provider_id)

  provider_id es requerido y debe ser el email del usuario para el provider 'email'.
*/

INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT
  gen_random_uuid(),
  u.id,
  u.email,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email',
  now(),
  now(),
  now()
FROM auth.users u
WHERE u.email IN ('admin@empresa.com', 'rrhh@empresa.com', 'prevencion@empresa.com')
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities i WHERE i.user_id = u.id AND i.provider = 'email'
  );
