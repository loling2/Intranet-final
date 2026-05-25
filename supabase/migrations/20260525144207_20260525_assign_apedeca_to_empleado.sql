/*
  # Asignar sociedad Apedeca al empleado de prueba

  El empleado necesita tener asignada la sociedad Apedeca para que el
  portal le redirija correctamente al dashboard tras el login.
*/

UPDATE user_profiles
SET societies = ARRAY['85e3c3bc-a789-4b12-986c-ca91b8653f03']
WHERE email = 'empleado@empresa.com';
