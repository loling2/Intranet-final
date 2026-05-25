/*
  # Fix empleado password for Supabase Auth native login

  El endpoint /auth/v1/token requiere que el campo encrypted_password use
  exactamente el formato que genera Supabase internamente. Los hashes bcrypt
  insertados manualmente a veces no funcionan con el endpoint REST.

  Solución: usar la función auth.encrypt_password (disponible en Supabase)
  o forzar un hash compatible regenerando con pgcrypto cost=10 en formato $2a$.

  También aseguramos que el usuario tenga todos los campos requeridos por Auth.
*/

UPDATE auth.users SET
  encrypted_password = crypt('empleado123', gen_salt('bf', 10)),
  updated_at = now(),
  email_confirmed_at = now(),
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change = '',
  aud = 'authenticated',
  role = 'authenticated'
WHERE email = 'empleado@empresa.com';
