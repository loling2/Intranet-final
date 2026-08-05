/*
# Fix: allow kiosk tablets to self-register without login

## Problem
Kiosk tablets use the anon key (no login session). The INSERT policy on
`kiosk_devices` was scoped to `TO authenticated` only, so any insert
attempt from an anon-key client failed with:
  "new row violates row-level security policy for table kiosk_devices"

## Changes
1. Drop the old `kiosk_devices_insert` policy (authenticated-only).
2. Create a new INSERT policy `TO anon, authenticated` so kiosk tablets
   can self-register their device_key + site_name.
3. Keep SELECT open to anon + authenticated (unchanged).
4. Keep UPDATE/DELETE on authenticated only (admin management, unchanged).

## Notes
- There is NO limit on the number of devices per site_name. Multiple
  tablets can share the same sede/centro name.
- The UNIQUE constraint on `device_key` prevents duplicate device codes.
- An admin still controls activation via `is_active` (UPDATE policy).
*/

DROP POLICY IF EXISTS "kiosk_devices_insert" ON kiosk_devices;
CREATE POLICY "kiosk_devices_insert" ON kiosk_devices FOR INSERT
  TO anon, authenticated WITH CHECK (true);
