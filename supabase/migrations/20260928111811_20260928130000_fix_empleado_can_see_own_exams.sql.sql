/*
# Fix: employees can see their own exam assignments

## Problem
The SELECT policy on `examen_asignaciones` only allows `is_staff()` (admin,
rrhh, prevencion, supervisor, etc.). Regular employees have role 'empleado'
which is NOT in the is_staff() list, so they get zero rows back — the
employee dashboard shows no exams even though assignments exist.

## Fix
Replace the single `select_examen_asignaciones` policy with one that allows
both staff AND the employee who owns the assignment. The ownership check
matches by `empleado_id` joined to `empleados.user_id = auth.uid()`, since
the assignment stores `empleado_id` (not `user_id` directly).

## Notes
- No data changes, no schema changes — only the SELECT policy is replaced.
- INSERT/UPDATE/DELETE policies are unchanged (still staff-only).
- The `empleados` table has a `user_id` column referencing `auth.users.id`.
*/

DROP POLICY IF EXISTS "select_examen_asignaciones" ON public.examen_asignaciones;

CREATE POLICY "select_examen_asignaciones" ON public.examen_asignaciones
  FOR SELECT
  TO authenticated USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.empleados e
      WHERE e.id = examen_asignaciones.empleado_id
        AND e.user_id = auth.uid()
    )
  );
