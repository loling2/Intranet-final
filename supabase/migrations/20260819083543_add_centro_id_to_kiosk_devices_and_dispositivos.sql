/*
# Link Tablets and Devices to Centros

## Purpose
Adds a `centro_id` foreign key column to `kiosk_devices` (fichaje tablets) and `dispositivos` (IT device inventory)
so that each tablet/device can be associated with a specific Centro de trabajo.

## Changes

### 1. kiosk_devices table
- Added column `centro_id` (uuid, nullable, FK → centros.id ON DELETE SET NULL)
- Added index on `centro_id` for faster filtering

### 2. dispositivos table
- Added column `centro_id` (uuid, nullable, FK → centros.id ON DELETE SET NULL)
- Added index on `centro_id` for faster filtering

### 3. RLS policies
- kiosk_devices: existing policies already allow staff CRUD; the new column is covered by existing USING/WITH CHECK predicates (role-based, not column-based).
- dispositivos: same — existing policies are role-based.

## Notes
- Both columns are nullable to avoid breaking existing rows that have no centro assigned.
- The existing `centro_trabajo` text column on `dispositivos` is preserved (stores the centro name as before).
- The existing `site_name` text column on `kiosk_devices` is preserved.
*/

-- 1. Add centro_id to kiosk_devices
ALTER TABLE kiosk_devices
  ADD COLUMN IF NOT EXISTS centro_id uuid
  REFERENCES centros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_kiosk_devices_centro_id
  ON kiosk_devices(centro_id);

-- 2. Add centro_id to dispositivos
ALTER TABLE dispositivos
  ADD COLUMN IF NOT EXISTS centro_id uuid
  REFERENCES centros(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dispositivos_centro_id
  ON dispositivos(centro_id);