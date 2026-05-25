/*
  # Fix bcrypt cost factor for all system users

  All system users were created with gen_salt('bf') which defaults to cost 6.
  Supabase Auth's token endpoint requires cost factor 10 ($2a$10$).
  This migration rehashes all affected passwords with the correct cost factor.

  Users fixed:
    - informatica@apedeca.es  / Admin1234!
    - rrhh@empresa.com        / Rrhh1234!
    - prevencion@empresa.com  / Prev1234!
    - pruebas@empresa.com     / Pruebas1234!
*/

UPDATE auth.users SET encrypted_password = crypt('Admin1234!',  gen_salt('bf', 10)), updated_at = now() WHERE email = 'informatica@apedeca.es';
UPDATE auth.users SET encrypted_password = crypt('Rrhh1234!',   gen_salt('bf', 10)), updated_at = now() WHERE email = 'rrhh@empresa.com';
UPDATE auth.users SET encrypted_password = crypt('Prev1234!',   gen_salt('bf', 10)), updated_at = now() WHERE email = 'prevencion@empresa.com';
UPDATE auth.users SET encrypted_password = crypt('Pruebas1234!', gen_salt('bf', 10)), updated_at = now() WHERE email = 'pruebas@empresa.com';
