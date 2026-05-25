/*
  # Fix pruebas@empresa.com password hash

  The user was created via signUp which uses a non-standard bcrypt cost factor.
  This migration recreates the password hash with the standard cost (bf/10)
  so that Supabase Auth's token endpoint can verify it correctly.
  
  Password: Pruebas1234!
*/

UPDATE auth.users
SET 
  encrypted_password = crypt('Pruebas1234!', gen_salt('bf')),
  updated_at = now()
WHERE email = 'pruebas@empresa.com';
