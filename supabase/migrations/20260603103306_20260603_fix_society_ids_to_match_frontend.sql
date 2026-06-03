/*
  # Fix sociedades IDs to match frontend themes.ts

  ## Problem
  The frontend themes.ts has hardcoded society UUIDs that don't match
  the sociedades table. This causes FK violations and wrong data associations.

  ## Solution
  - Insert new sociedades rows with the correct frontend UUIDs
  - Update empleados FK references
  - Update user_profiles societies (text[] array) using string replacement
  - Remove old society rows

  ## Society ID mapping (old DB → frontend/themes.ts)
  - Apedeca:       680166e3 → 85e3c3bc
  - Eleda:         7eaafa21 → 78125129
  - Serca Gestion: 9ef1667b → fdb5114a
  - Gerontalia:    3962a0e3 → 6632d8d1
*/

-- Step 1: Insert new sociedades with correct frontend IDs
INSERT INTO sociedades (id, nombre)
VALUES ('85e3c3bc-a789-4b12-986c-ca91b8653f03', 'Apedeca')
ON CONFLICT (id) DO UPDATE SET nombre = 'Apedeca';

INSERT INTO sociedades (id, nombre)
VALUES ('78125129-dcb0-4f5a-b559-480379812b15', 'Eleda')
ON CONFLICT (id) DO UPDATE SET nombre = 'Eleda';

INSERT INTO sociedades (id, nombre)
VALUES ('fdb5114a-c6b4-4b3a-8eb9-420bd188ad52', 'Serca Gestion')
ON CONFLICT (id) DO UPDATE SET nombre = 'Serca Gestion';

INSERT INTO sociedades (id, nombre)
VALUES ('6632d8d1-c4e7-4540-aab7-515b9d7913f7', 'Gerontalia')
ON CONFLICT (id) DO UPDATE SET nombre = 'Gerontalia';

-- Step 2: Update empleados FK from old to new society IDs
UPDATE empleados SET id_sociedad = '85e3c3bc-a789-4b12-986c-ca91b8653f03'
  WHERE id_sociedad = '680166e3-6aee-4c1c-a5f7-8aa20df4311d';

UPDATE empleados SET id_sociedad = '78125129-dcb0-4f5a-b559-480379812b15'
  WHERE id_sociedad = '7eaafa21-e0aa-4a9c-b73e-07a2ec429187';

UPDATE empleados SET id_sociedad = 'fdb5114a-c6b4-4b3a-8eb9-420bd188ad52'
  WHERE id_sociedad = '9ef1667b-07c0-4ce0-bda6-e2351214f7fa';

UPDATE empleados SET id_sociedad = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'
  WHERE id_sociedad = '3962a0e3-f13e-4aeb-978f-c9fec810cdf3';

-- Step 3: Update user_profiles societies (text[] — replace each old ID string)
UPDATE user_profiles
SET societies = array_replace(societies, '680166e3-6aee-4c1c-a5f7-8aa20df4311d', '85e3c3bc-a789-4b12-986c-ca91b8653f03')
WHERE '680166e3-6aee-4c1c-a5f7-8aa20df4311d' = ANY(societies);

UPDATE user_profiles
SET societies = array_replace(societies, '7eaafa21-e0aa-4a9c-b73e-07a2ec429187', '78125129-dcb0-4f5a-b559-480379812b15')
WHERE '7eaafa21-e0aa-4a9c-b73e-07a2ec429187' = ANY(societies);

UPDATE user_profiles
SET societies = array_replace(societies, '9ef1667b-07c0-4ce0-bda6-e2351214f7fa', 'fdb5114a-c6b4-4b3a-8eb9-420bd188ad52')
WHERE '9ef1667b-07c0-4ce0-bda6-e2351214f7fa' = ANY(societies);

UPDATE user_profiles
SET societies = array_replace(societies, '3962a0e3-f13e-4aeb-978f-c9fec810cdf3', '6632d8d1-c4e7-4540-aab7-515b9d7913f7')
WHERE '3962a0e3-f13e-4aeb-978f-c9fec810cdf3' = ANY(societies);

-- Step 4: Remove old sociedades rows (FKs already updated)
DELETE FROM sociedades WHERE id IN (
  '680166e3-6aee-4c1c-a5f7-8aa20df4311d',
  '7eaafa21-e0aa-4a9c-b73e-07a2ec429187',
  '9ef1667b-07c0-4ce0-bda6-e2351214f7fa',
  '3962a0e3-f13e-4aeb-978f-c9fec810cdf3'
);
