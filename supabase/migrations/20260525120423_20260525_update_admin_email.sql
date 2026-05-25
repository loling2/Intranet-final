/*
  # Update admin email

  Changes admin@empresa.com to informatica@apedeca.es
  Updates both auth.users and auth.identities tables.
*/

UPDATE auth.identities
SET 
  identity_data = jsonb_set(
    jsonb_set(identity_data, '{email}', '"informatica@apedeca.es"'),
    '{sub}', identity_data->'sub'
  ),
  provider_id = '2c86e12f-0435-49c9-ab53-3d4726e0054c',
  updated_at = now()
WHERE user_id = '2c86e12f-0435-49c9-ab53-3d4726e0054c';

UPDATE auth.users
SET 
  email = 'informatica@apedeca.es',
  updated_at = now()
WHERE id = '2c86e12f-0435-49c9-ab53-3d4726e0054c';
