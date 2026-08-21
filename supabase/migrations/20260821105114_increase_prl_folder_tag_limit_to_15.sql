-- Replace the tag-limit trigger function to allow up to 15 tags per folder
CREATE OR REPLACE FUNCTION enforce_folder_tag_limit_fn()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (SELECT count(*) FROM prl_folder_tags WHERE folder_id = NEW.folder_id) >= 15 THEN
    RAISE EXCEPTION 'A folder can have at most 15 tags';
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate the trigger to pick up the new function body
DROP TRIGGER IF EXISTS enforce_folder_tag_limit ON prl_folder_tags;

CREATE TRIGGER enforce_folder_tag_limit
  BEFORE INSERT ON prl_folder_tags
  FOR EACH ROW
  EXECUTE FUNCTION enforce_folder_tag_limit_fn();
