/*
# Fix vehicle check-out for PIN-based kiosk access (anon role)

## Problem
The "Acceso rápido sin login" modal validates users via PIN (RPC function) but
does NOT create a Supabase Auth session. All database operations run as the
`anon` role. The current RLS policies on `vehicles` and `vehicle_logs` require
`authenticated` + `is_staff()` for UPDATE, so:

  - `vehicle_logs` SELECT returns 0 rows for anon → the open log is never found
  - `vehicle_logs` UPDATE is blocked for anon → the log is never closed
  - `vehicles` UPDATE is blocked for anon → the vehicle stays "en_uso" forever

The frontend code in LoginPage.tsx does not check for errors from these
operations, so it shows "Uso finalizado" even though nothing was saved.

## Changes

### vehicles
- Add UPDATE policy for `anon, authenticated` so PIN-based kiosk can set
  vehicle state to libre/en_uso. The existing `is_staff()` policy remains for
  authenticated staff.

### vehicle_logs
- Add SELECT policy for `anon, authenticated` so the kiosk can find the open
  log for a vehicle.
- Add UPDATE policy for `anon, authenticated` so the kiosk can close the log
  (set fecha_fin, km_fin, duracion_minutos).

## Security
These policies are intentionally permissive for anon because the vehicle
check-in/check-out flow is designed to work without a full Supabase Auth
session (PIN-based identification). The PIN validation happens via the
`validate_vehicle_pin` RPC function before any vehicle operation is allowed
in the frontend.
*/

-- ── vehicles: allow anon to update (kiosk check-in/check-out) ──
DROP POLICY IF EXISTS "update_vehicles" ON vehicles;
DROP POLICY IF EXISTS "anon_update_vehicles" ON vehicles;
CREATE POLICY "update_vehicles"
  ON vehicles FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- ── vehicle_logs: allow anon to select (find open log) ──
DROP POLICY IF EXISTS "select_vehicle_logs" ON vehicle_logs;
DROP POLICY IF EXISTS "anon_select_vehicle_logs" ON vehicle_logs;
CREATE POLICY "select_vehicle_logs"
  ON vehicle_logs FOR SELECT
  TO anon, authenticated
  USING (true);

-- ── vehicle_logs: allow anon to update (close log) ──
DROP POLICY IF EXISTS "update_vehicle_logs" ON vehicle_logs;
DROP POLICY IF EXISTS "anon_update_vehicle_logs" ON vehicle_logs;
CREATE POLICY "update_vehicle_logs"
  ON vehicle_logs FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);
