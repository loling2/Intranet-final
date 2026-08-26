/*
# Restrict Gerontalia device visibility to its society

1. Purpose
- Ensure Gerontalia profiles only see devices assigned to their society.
- Preserve full device visibility for global profiles.
- Keep anonymous kiosk operation compatible with the existing kiosk flow.

2. Modified tables
- `dispositivos`: remove the broad Gerontalia SELECT policy that allowed every
  device whenever a user had a scoped Gerontalia role.
- `kiosk_devices`: replace unrestricted SELECT, INSERT, UPDATE, and DELETE
  policies with predicates that scope authenticated Gerontalia users through the
  kiosk's assigned centre and society.

3. Security changes
- Gerontalia access requires `is_gerontalia_scoped()` and a centre whose
  `centros.id_sociedad` equals `my_scope_society_id()`.
- Global users retain their existing unrestricted access.
- Anonymous kiosk requests retain the existing public SELECT/operation behavior;
  the society restriction applies to authenticated Gerontalia profiles.
- No rows, columns, tables, or users are deleted or modified.

4. Important notes
- `dispositivos.society_id` is text, while `my_scope_society_id()` returns uuid;
  the comparison uses an explicit text cast.
- `kiosk_devices` has no society column and is scoped through `centro_id`.
- The previous broad Gerontalia policies are dropped because PostgreSQL combines
  policies with OR; leaving them in place would continue to expose all rows.
*/

-- Remove the broad policy that exposed every dispositivo to any Gerontalia role.
DROP POLICY IF EXISTS "gerontalia_prev_select_dispositivos" ON dispositivos;

-- Kiosk devices are scoped through the centre's society for Gerontalia users.
DROP POLICY IF EXISTS "kiosk_devices_select" ON kiosk_devices;
CREATE POLICY "kiosk_devices_select" ON kiosk_devices FOR SELECT
  TO anon, authenticated
  USING (
    NOT is_gerontalia_scoped()
    OR EXISTS (
      SELECT 1
      FROM centros c
      WHERE c.id = kiosk_devices.centro_id
        AND c.id_sociedad = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "kiosk_devices_insert" ON kiosk_devices;
CREATE POLICY "kiosk_devices_insert" ON kiosk_devices FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT is_gerontalia_scoped()
    OR EXISTS (
      SELECT 1
      FROM centros c
      WHERE c.id = kiosk_devices.centro_id
        AND c.id_sociedad = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "kiosk_devices_update" ON kiosk_devices;
CREATE POLICY "kiosk_devices_update" ON kiosk_devices FOR UPDATE
  TO authenticated
  USING (
    NOT is_gerontalia_scoped()
    OR EXISTS (
      SELECT 1
      FROM centros c
      WHERE c.id = kiosk_devices.centro_id
        AND c.id_sociedad = my_scope_society_id()
    )
  )
  WITH CHECK (
    NOT is_gerontalia_scoped()
    OR EXISTS (
      SELECT 1
      FROM centros c
      WHERE c.id = kiosk_devices.centro_id
        AND c.id_sociedad = my_scope_society_id()
    )
  );

DROP POLICY IF EXISTS "kiosk_devices_delete" ON kiosk_devices;
CREATE POLICY "kiosk_devices_delete" ON kiosk_devices FOR DELETE
  TO authenticated
  USING (
    NOT is_gerontalia_scoped()
    OR EXISTS (
      SELECT 1
      FROM centros c
      WHERE c.id = kiosk_devices.centro_id
        AND c.id_sociedad = my_scope_society_id()
    )
  );
