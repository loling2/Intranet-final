/*
# Formacion RLS policies for preguntas and empleados

## Purpose
The `formacion` role needs to manage exam questions (CRUD on `preguntas`)
and view employee records (SELECT on `empleados`) to assign exams.
Previously only `admin` had CRUD on `preguntas`, and only admin/rrhh/prevencion
could select from `empleados`. This adds the same access for `formacion`.

## Changes
1. **preguntas** — 4 new policies (select/insert/update/delete) for `formacion` role
   using `get_my_role() = 'formacion'`.
2. **empleados** — 1 new SELECT policy for `formacion` role using `get_my_role() = 'formacion'`.

## Security
- `formacion` can only CRUD questions on `preguntas` (all questions, since
  questions belong to exams which formacion already manages).
- `formacion` can only SELECT from `empleados` (read-only, no insert/update/delete).
- All policies use `get_my_role()` which reads from `user_profiles` scoped to `auth.uid()`.
*/

-- ── preguntas: formacion CRUD ──
DROP POLICY IF EXISTS "formacion_select_preguntas" ON preguntas;
CREATE POLICY "formacion_select_preguntas"
ON preguntas FOR SELECT
TO authenticated
USING (get_my_role() = 'formacion');

DROP POLICY IF EXISTS "formacion_insert_preguntas" ON preguntas;
CREATE POLICY "formacion_insert_preguntas"
ON preguntas FOR INSERT
TO authenticated
WITH CHECK (get_my_role() = 'formacion');

DROP POLICY IF EXISTS "formacion_update_preguntas" ON preguntas;
CREATE POLICY "formacion_update_preguntas"
ON preguntas FOR UPDATE
TO authenticated
USING (get_my_role() = 'formacion')
WITH CHECK (get_my_role() = 'formacion');

DROP POLICY IF EXISTS "formacion_delete_preguntas" ON preguntas;
CREATE POLICY "formacion_delete_preguntas"
ON preguntas FOR DELETE
TO authenticated
USING (get_my_role() = 'formacion');

-- ── empleados: formacion SELECT (read-only) ──
DROP POLICY IF EXISTS "Formacion can view all empleados" ON empleados;
CREATE POLICY "Formacion can view all empleados"
ON empleados FOR SELECT
TO authenticated
USING (get_my_role() = 'formacion');
