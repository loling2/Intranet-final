/*
# Add pin_created_at to user_profiles

1. Purpose
   When an employee creates or changes their fichaje PIN, we want to record
   the date/time so the system knows from when the employee should be fichando.
   This is used to determine the "start date" for missing-day detection.

2. Changes
   - Add column `pin_created_at timestamptz DEFAULT NULL` to `user_profiles`.
     Set automatically when the PIN is first created or changed via the frontend.
     NULL means no PIN has been set yet.

3. Safety
   - No data is modified or deleted. Only adds a nullable column.
   - Existing rows keep NULL (no PIN creation date for legacy PINs).
*/

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS pin_created_at timestamptz DEFAULT NULL;
