/*
# Backfill: Create pending device delivery docs for existing device assignments

1. Purpose
   - 29 devices were assigned to employees BEFORE the pending-docs feature existed.
   - Only 6 of those employees have a linked auth.users account (empleados.user_id IS NOT NULL).
   - This migration creates a pending doc for each of those 6 employees so they see
     "Entrega de dispositivo" in their "Mis Documentos" panel.

2. What it does
   - Joins dispositivos → empleados (to get user_id) → only those with user_id IS NOT NULL
   - Inserts into employee_pending_docs with tipo='entrega_dispositivo'
   - ref_id = device id (text)
   - Skips if a pending doc already exists for (employee_id, ref_id, tipo)

3. Security
   - No schema changes, purely data backfill
   - RLS already enabled on employee_pending_docs
*/

INSERT INTO employee_pending_docs (employee_id, society_id, tipo, titulo, descripcion, ref_id)
SELECT
  e.user_id,
  d.society_id,
  'entrega_dispositivo',
  'Entrega de dispositivo: ' || d.marca_modelo,
  'Sube el acta de entrega firmada (PDF o foto)',
  d.id::text
FROM dispositivos d
JOIN empleados e ON e.id = d.empleado_id
WHERE d.empleado_id IS NOT NULL
  AND e.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM employee_pending_docs epd
    WHERE epd.employee_id = e.user_id
      AND epd.ref_id = d.id::text
      AND epd.tipo = 'entrega_dispositivo'
  );