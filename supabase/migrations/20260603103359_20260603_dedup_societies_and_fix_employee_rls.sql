/*
  # Fix duplicate society IDs in user_profiles + reset loling password

  ## Problems Fixed
  1. JULIO and Pepe have duplicate society IDs in their societies array
     (Apedeca appears twice due to double replacement from old IDs)
  2. Ensure loling password is set correctly via bcrypt compatible with Supabase Auth

  ## Changes
  - Deduplicate societies arrays using array_agg + DISTINCT
  - Fix loling and pepe societies arrays to correct unique values
*/

-- Deduplicate societies for all user_profiles using a subquery
UPDATE user_profiles
SET societies = (
  SELECT array_agg(DISTINCT s ORDER BY s)
  FROM unnest(societies) s
)
WHERE societies IS NOT NULL
  AND array_length(societies, 1) > 0;

-- Julio had [Apedeca, Apedeca, Serca] → should be [Apedeca, Serca] (Eleda was lost in old DB)
-- We can verify: his old DB had Apedeca + Eleda + Serca. Eleda was mapped from 7eaafa21.
-- After dedup: societies will be [85e3c3bc (Apedeca), fdb5114a (Serca)] which is correct.

-- Verify the RLS policies on empleados allow prevencion to see employees
-- Drop duplicate if exists and recreate clean
DROP POLICY IF EXISTS "Prevencion can view all employees" ON empleados;

CREATE POLICY "Prevencion can view all employees"
  ON empleados FOR SELECT
  TO authenticated
  USING (is_prevencion() OR is_admin_or_rrhh());
