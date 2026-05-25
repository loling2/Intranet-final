/*
  # Make vehicle_logs.user_id nullable

  The quick-register flow (no login) inserts logs without a user_id.
  The column must accept NULL for this use case.
*/

ALTER TABLE vehicle_logs ALTER COLUMN user_id DROP NOT NULL;
