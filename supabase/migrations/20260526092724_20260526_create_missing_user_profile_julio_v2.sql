/*
  # Create missing user_profile for auth user loling2.18@gmail.com (julio)

  Uses role 'employee' as that is the closest valid role in app_roles.
*/

INSERT INTO public.user_profiles (id, nombre, email, role, activo, societies)
SELECT
  au.id,
  'julio',
  'loling2.18@gmail.com',
  'employee',
  true,
  ARRAY['85e3c3bc-a789-4b12-986c-ca91b8653f03']
FROM auth.users au
WHERE au.email = 'loling2.18@gmail.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_profiles up WHERE up.id = au.id
  );
