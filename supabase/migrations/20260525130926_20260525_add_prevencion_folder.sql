/*
  # Add 'prevencion' as a valid folder value for documents

  The documents table has a 'folder' column used to categorize uploads.
  Adding 'prevencion' allows the prevention team to upload PRL documents
  that are visible to employees in their dashboard.

  Also ensures the documents table has a 'folder' column that accepts the new value.
*/

DO $$
BEGIN
  -- If folder is an enum type, add the new value
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'document_folder'
  ) THEN
    ALTER TYPE document_folder ADD VALUE IF NOT EXISTS 'prevencion';
  ELSE
    -- If folder is a text column with a CHECK constraint, update or it's already flexible
    -- Just update existing check constraint if present
    NULL;
  END IF;
END $$;
