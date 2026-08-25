/*
# Backfill approved fichajes_correcciones to fichajes.timestamp_corregido

## Problem
When RRHH approved a correction, the frontend searched for the matching
fichaje rows by `nombre_empleado`. However, the name stored in
`fichajes_correcciones.nombre_empleado` (copied from `user_profiles.nombre`)
often does NOT match the name stored in `fichajes.nombre_empleado` (which
comes from `empleados.nombre`). As a result, the update found zero rows
and `timestamp_corregido` was never set — the employee's resumen kept
showing the original times and the total hours were wrong.

## Fix
This migration backfills ALL approved corrections by joining on
`empleado_id` + `fecha` (reliable) instead of `nombre_empleado`:

1. For corrections where matching fichaje rows EXIST:
   - Set `timestamp_corregido` to the proposed time on the entrada/salida row.
   - Set `nota_correccion`, `motivo_correccion`, `corregido_por`, `corregido_at`.

2. For corrections where NO fichaje rows exist (employee never clocked in
   that day but the correction was approved):
   - INSERT new entrada and/or salida fichaje rows with both `timestamp`
     and `timestamp_corregido` set to the proposed time, so the day appears
     in the employee's resumen with the corrected hours.

## Safety
- Only touches corrections with `estado = 'aprobada'`.
- Never modifies the original `timestamp` of existing rows.
- Idempotent: uses `WHERE timestamp_corregido IS NULL` to avoid double-applying.
*/

-- ─── 1. Apply timestamp_corregido to EXISTING fichaje rows ───────────────────
UPDATE fichajes f
SET
  timestamp_corregido = CASE
    WHEN f.tipo_evento = 'entrada' THEN c.entrada_propuesta
    WHEN f.tipo_evento = 'salida'  THEN c.salida_propuesta
  END,
  nota_correccion    = 'Corrección aprobada (backfill): ' || c.motivo,
  motivo_correccion  = c.motivo,
  corregido_por      = COALESCE(c.validado_por_nombre, 'RRHH'),
  corregido_at       = COALESCE(c.validado_at, c.updated_at, now())
FROM fichajes_correcciones c
WHERE c.estado = 'aprobada'
  AND (c.entrada_propuesta IS NOT NULL OR c.salida_propuesta IS NOT NULL)
  AND f.empleado_id = c.empleado_id
  AND f.fecha = c.fecha
  AND f.tipo_evento IN ('entrada', 'salida')
  AND f.timestamp_corregido IS NULL
  AND (
    (f.tipo_evento = 'entrada' AND c.entrada_propuesta IS NOT NULL)
    OR
    (f.tipo_evento = 'salida'  AND c.salida_propuesta  IS NOT NULL)
  );

-- ─── 2. For corrections where NO fichaje rows exist, create them ─────────────
-- Insert entrada rows
INSERT INTO fichajes (empleado_id, nombre_empleado, fecha, timestamp, timestamp_corregido, tipo_evento, nota_correccion, motivo_correccion, corregido_por, corregido_at)
SELECT c.empleado_id, c.nombre_empleado, c.fecha, c.entrada_propuesta, c.entrada_propuesta,
       'entrada',
       'Corrección aprobada (backfill): ' || c.motivo,
       c.motivo,
       COALESCE(c.validado_por_nombre, 'RRHH'),
       COALESCE(c.validado_at, c.updated_at, now())
FROM fichajes_correcciones c
WHERE c.estado = 'aprobada'
  AND c.entrada_propuesta IS NOT NULL
  AND c.empleado_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fichajes f
    WHERE f.empleado_id = c.empleado_id AND f.fecha = c.fecha
      AND f.tipo_evento = 'entrada'
  );

-- Insert salida rows
INSERT INTO fichajes (empleado_id, nombre_empleado, fecha, timestamp, timestamp_corregido, tipo_evento, nota_correccion, motivo_correccion, corregido_por, corregido_at)
SELECT c.empleado_id, c.nombre_empleado, c.fecha, c.salida_propuesta, c.salida_propuesta,
       'salida',
       'Corrección aprobada (backfill): ' || c.motivo,
       c.motivo,
       COALESCE(c.validado_por_nombre, 'RRHH'),
       COALESCE(c.validado_at, c.updated_at, now())
FROM fichajes_correcciones c
WHERE c.estado = 'aprobada'
  AND c.salida_propuesta IS NOT NULL
  AND c.empleado_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM fichajes f
    WHERE f.empleado_id = c.empleado_id AND f.fecha = c.fecha
      AND f.tipo_evento = 'salida'
  );

-- ─── 3. For the one correction with empleado_id = NULL, match by nombre_empleado ─
UPDATE fichajes f
SET
  timestamp_corregido = CASE
    WHEN f.tipo_evento = 'entrada' THEN c.entrada_propuesta
    WHEN f.tipo_evento = 'salida'  THEN c.salida_propuesta
  END,
  nota_correccion    = 'Corrección aprobada (backfill): ' || c.motivo,
  motivo_correccion  = c.motivo,
  corregido_por      = COALESCE(c.validado_por_nombre, 'RRHH'),
  corregido_at       = COALESCE(c.validado_at, c.updated_at, now())
FROM fichajes_correcciones c
WHERE c.estado = 'aprobada'
  AND c.empleado_id IS NULL
  AND (c.entrada_propuesta IS NOT NULL OR c.salida_propuesta IS NOT NULL)
  AND f.nombre_empleado = c.nombre_empleado
  AND f.fecha = c.fecha
  AND f.tipo_evento IN ('entrada', 'salida')
  AND f.timestamp_corregido IS NULL
  AND (
    (f.tipo_evento = 'entrada' AND c.entrada_propuesta IS NOT NULL)
    OR
    (f.tipo_evento = 'salida'  AND c.salida_propuesta  IS NOT NULL)
  );
