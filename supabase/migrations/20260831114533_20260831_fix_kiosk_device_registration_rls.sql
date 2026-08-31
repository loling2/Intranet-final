/*
# Restore anonymous kiosk-device registration

1. Problem
- New kiosk tablets register from the kiosk screen using the public client key,
  without an authenticated staff session.
- A later scope policy replaced the original anonymous INSERT policy, causing
  PostgreSQL to reject the registration with a row-level security error.

2. Security change
- Recreate the `kiosk_devices_insert` policy for `anon` and `authenticated`.
- The policy permits creating a device registration only; it does not grant
  anonymous permission to edit, activate, deactivate, or delete devices.
- Existing SELECT, UPDATE, and DELETE policies remain unchanged.

3. Data safety
- No tables, columns, or existing rows are removed or modified.
- The existing unique constraint on `device_key` continues to prevent duplicate
  device registrations.
*/

DROP POLICY IF EXISTS "kiosk_devices_insert" ON public.kiosk_devices;

CREATE POLICY "kiosk_devices_insert"
ON public.kiosk_devices
FOR INSERT
TO anon, authenticated
WITH CHECK (true);