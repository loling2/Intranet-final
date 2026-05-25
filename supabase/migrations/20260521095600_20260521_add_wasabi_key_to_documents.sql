/*
  # Add wasabi_key column to documents table

  Adds a nullable `wasabi_key` text column to store the exact Wasabi object key
  (e.g. "privado/1779357169068-Screenshot_1.png") so the app can match DB records
  to Wasabi objects without relying on filename string matching.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'wasabi_key'
  ) THEN
    ALTER TABLE documents ADD COLUMN wasabi_key text;
  END IF;
END $$;
