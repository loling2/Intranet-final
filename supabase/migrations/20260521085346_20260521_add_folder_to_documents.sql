/*
  # Add folder column to documents table

  ## Changes
  - Adds `folder` column to `documents` table with values 'publico' or 'privado'
  - Default is 'publico' so all existing documents remain accessible
  - Employees only see 'publico' documents; admin/rrhh see both
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'folder'
  ) THEN
    ALTER TABLE documents ADD COLUMN folder text NOT NULL DEFAULT 'publico' CHECK (folder IN ('publico', 'privado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_documents_folder ON documents (folder);
CREATE INDEX IF NOT EXISTS idx_documents_society_folder ON documents (society_id, folder);
