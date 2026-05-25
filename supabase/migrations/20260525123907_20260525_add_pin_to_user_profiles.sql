/*
  # Add PIN column to user_profiles

  1. Changes
    - `user_profiles`: add `pin` column (text, nullable) — stores a numeric PIN for future clock-in/out feature

  2. Notes
    - PIN is stored as plain text (short numeric code). For production consider hashing.
    - Nullable because not all users will have a PIN assigned initially.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'pin'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN pin text DEFAULT NULL;
  END IF;
END $$;
