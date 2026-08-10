/*
# Lock down kiosk_devices: remove anon INSERT

## Problem
The `kiosk_devices` table had an INSERT policy scoped to `TO anon, authenticated`,
which allowed kiosk tablets (using the anon key, no login) to self-register
directly into `kiosk_devices`, bypassing the entire pairing flow.

## Changes
1. Drop the existing `kiosk_devices_insert` policy.
2. Create a new INSERT policy TO authenticated only.
3. Keep SELECT open to anon + authenticated.
4. Keep UPDATE/DELETE on authenticated only.
*/

DROP POLICY IF EXISTS "kiosk_devices_insert" ON kiosk_devices;
CREATE POLICY "kiosk_devices_insert" ON kiosk_devices FOR INSERT
  TO authenticated WITH CHECK (true);
