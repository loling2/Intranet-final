/*
# Vehicle Reservations Module

## Purpose
Adds a full vehicle reservation system with two daily shifts, extraordinary/forced
reservation flags, and an authorization list controlling who can book vehicles.

## New Tables

### vehicle_reservation_authorized_users (created first — referenced by policies)
Whitelist of users allowed to see the "Reservar vehículo" button and create reservations.
- `id` (uuid PK)
- `user_id` (uuid FK → auth.users.id ON DELETE CASCADE, unique)
- `user_nombre` (text, denormalized)
- `added_by` (uuid, nullable)
- `created_at` (timestamptz)

### vehicle_reservations
Stores one reservation per vehicle/day/shift.
- `id` (uuid PK)
- `vehicle_id` (uuid FK → vehicles.id ON DELETE CASCADE)
- `user_id` (uuid FK → auth.users.id ON DELETE SET NULL, defaults to auth.uid())
- `user_nombre` (text, denormalized for display)
- `date` (date, NOT NULL) — the calendar day in YYYY-MM-DD
- `shift` (text, NOT NULL) — 'turno_1' (07:00–15:00) or 'turno_2' (15:01–23:59)
- `is_extraordinary` (boolean, default false) — marks extra-official use
- `is_forced` (boolean, default false) — marks a forced overlap for a short slot
- `nota` (text, nullable) — optional note
- `created_at` / `updated_at` (timestamptz)

## Security (RLS)

### vehicle_reservation_authorized_users
- SELECT: `TO authenticated` — any logged-in user can see who is authorized.
- INSERT: `TO authenticated` WITH CHECK that caller is admin or rrhh.
- DELETE: `TO authenticated` USING that caller is admin or rrhh.

### vehicle_reservations
- SELECT: `TO authenticated` — any authenticated user can see the calendar (read-only).
- INSERT: `TO authenticated` WITH CHECK that the caller is in the authorized list.
- UPDATE: `TO authenticated` USING + WITH CHECK that caller is authorized.
- DELETE: `TO authenticated` USING that caller is authorized OR is admin/rrhh.

## Indexes
- `vehicle_reservations_vehicle_date_shift_idx` on (vehicle_id, date, shift) for fast calendar lookups.
- `vehicle_reservation_authorized_users_user_idx` on (user_id).
- Partial unique index on (vehicle_id, date, shift) WHERE is_forced = false.

## Notes
1. The authorized-users list is the permission mechanism: the frontend shows the
   "Reservar vehículo" button only to users present in this table (or to admin/rrhh
   who always have access).
2. Shift values are constrained by a CHECK to exactly 'turno_1' or 'turno_2'.
3. Forced reservations (is_forced = true) are allowed to coexist with normal ones,
   implemented via a partial unique index that only applies to non-forced rows.
*/

-- ========================================================
-- 1) vehicle_reservation_authorized_users (must exist first)
-- ========================================================
CREATE TABLE IF NOT EXISTS vehicle_reservation_authorized_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_nombre text NOT NULL DEFAULT '',
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_reservation_authorized_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS vehicle_reservation_authorized_users_user_idx
  ON vehicle_reservation_authorized_users (user_id);

DROP POLICY IF EXISTS "authorized_users_select_all" ON vehicle_reservation_authorized_users;
CREATE POLICY "authorized_users_select_all"
  ON vehicle_reservation_authorized_users FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "authorized_users_insert_admin" ON vehicle_reservation_authorized_users;
CREATE POLICY "authorized_users_insert_admin"
  ON vehicle_reservation_authorized_users FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

DROP POLICY IF EXISTS "authorized_users_delete_admin" ON vehicle_reservation_authorized_users;
CREATE POLICY "authorized_users_delete_admin"
  ON vehicle_reservation_authorized_users FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );

-- ========================================================
-- 2) vehicle_reservations
-- ========================================================
CREATE TABLE IF NOT EXISTS vehicle_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  user_nombre text NOT NULL DEFAULT '',
  date date NOT NULL,
  shift text NOT NULL CHECK (shift IN ('turno_1', 'turno_2')),
  is_extraordinary boolean NOT NULL DEFAULT false,
  is_forced boolean NOT NULL DEFAULT false,
  nota text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE vehicle_reservations ENABLE ROW LEVEL SECURITY;

-- Normal (non-forced) reservations: one per vehicle/day/shift
CREATE UNIQUE INDEX IF NOT EXISTS vehicle_reservations_normal_unique
  ON vehicle_reservations (vehicle_id, date, shift)
  WHERE is_forced = false;

CREATE INDEX IF NOT EXISTS vehicle_reservations_vehicle_date_shift_idx
  ON vehicle_reservations (vehicle_id, date, shift);

DROP POLICY IF EXISTS "reservations_select_all_authenticated" ON vehicle_reservations;
CREATE POLICY "reservations_select_all_authenticated"
  ON vehicle_reservations FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "reservations_insert_authorized" ON vehicle_reservations;
CREATE POLICY "reservations_insert_authorized"
  ON vehicle_reservations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_reservation_authorized_users a
      WHERE a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reservations_update_authorized" ON vehicle_reservations;
CREATE POLICY "reservations_update_authorized"
  ON vehicle_reservations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM vehicle_reservation_authorized_users a
      WHERE a.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM vehicle_reservation_authorized_users a
      WHERE a.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "reservations_delete_authorized_or_admin" ON vehicle_reservations;
CREATE POLICY "reservations_delete_authorized_or_admin"
  ON vehicle_reservations FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM vehicle_reservation_authorized_users a
      WHERE a.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid() AND up.role IN ('admin', 'rrhh')
    )
  );