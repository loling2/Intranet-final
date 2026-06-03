/*
  # Add multi-tag support to prl_folders (up to 5 tags per folder)

  ## Changes
  1. New table `prl_folder_tags` - many-to-many between prl_folders and tags
     - Unique constraint on (folder_id, tag_id) to prevent duplicates
     - Max 5 tags per folder enforced via check constraint + trigger
  2. Migrate existing data: copy access_tag_id → prl_folder_tags
  3. RLS on prl_folder_tags

  ## Notes
  - access_tag_id column is kept for backwards compatibility but is no longer the primary mechanism
  - The new prl_folder_tags table is the source of truth for tag assignments
*/

-- 1. Create prl_folder_tags junction table
CREATE TABLE IF NOT EXISTS prl_folder_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id uuid NOT NULL REFERENCES prl_folders(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (folder_id, tag_id)
);

ALTER TABLE prl_folder_tags ENABLE ROW LEVEL SECURITY;

-- Prevencion, admin, rrhh can manage folder tags
CREATE POLICY "Prevencion can view folder tags"
  ON prl_folder_tags FOR SELECT
  TO authenticated
  USING (is_prevencion() OR is_admin_or_rrhh());

CREATE POLICY "Prevencion can insert folder tags"
  ON prl_folder_tags FOR INSERT
  TO authenticated
  WITH CHECK (is_prevencion() OR is_admin_or_rrhh());

CREATE POLICY "Prevencion can delete folder tags"
  ON prl_folder_tags FOR DELETE
  TO authenticated
  USING (is_prevencion() OR is_admin_or_rrhh());

-- 2. Trigger to enforce max 5 tags per folder
CREATE OR REPLACE FUNCTION check_folder_tag_limit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM prl_folder_tags WHERE folder_id = NEW.folder_id) >= 5 THEN
    RAISE EXCEPTION 'Una carpeta no puede tener mas de 5 tags';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_folder_tag_limit ON prl_folder_tags;
CREATE TRIGGER enforce_folder_tag_limit
  BEFORE INSERT ON prl_folder_tags
  FOR EACH ROW EXECUTE FUNCTION check_folder_tag_limit();

-- 3. Migrate existing single-tag data to the new table
INSERT INTO prl_folder_tags (folder_id, tag_id)
SELECT id, access_tag_id
FROM prl_folders
WHERE access_tag_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 4. Index for performance
CREATE INDEX IF NOT EXISTS idx_prl_folder_tags_folder_id ON prl_folder_tags(folder_id);
CREATE INDEX IF NOT EXISTS idx_prl_folder_tags_tag_id ON prl_folder_tags(tag_id);
