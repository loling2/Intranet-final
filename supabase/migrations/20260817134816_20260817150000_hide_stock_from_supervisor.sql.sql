/*
# Hide stock devices from Supervisor

1. Security changes
- Modifies the "Supervisor can select dispositivos" policy to exclude devices in stock (estado_id = 3).
- Supervisors can only see devices that are Activo (1) or Inactivo (2), never Stock (3).
- This is enforced at the database level so a supervisor cannot bypass it via the API.

2. Notes
- Admin/RRHH policies are unchanged — they still see all devices including stock.
- The DROP + CREATE makes this idempotent.
*/

DROP POLICY IF EXISTS "Supervisor can select dispositivos" ON dispositivos;

CREATE POLICY "Supervisor can select dispositivos"
ON dispositivos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'supervisor'
  )
  AND dispositivos.estado_id != 3
);