/*
# Add clasificacion_ausencia to fichajes_correcciones

1. Purpose
   When RRHH approves a correction for a "no fichado" (missing day) case,
   they can classify the absence as one of:
   - "no_fichado" (default, keeps it as an incidence)
   - "dia_libre" (day off — not an incidence, blue badge)
   - "asuntos_propios" (personal matters — not an incidence, blue badge)

   This lets RRHH explain why there was no clock-in without requiring
   entrada/salida times, and the employee sees a blue badge instead of
   a red "no fichado" incidence.

2. Changes
   - Add column `clasificacion_ausencia text DEFAULT NULL` to `fichajes_correcciones`.
     CHECK constraint limits to the three allowed values.
   - NULL means the correction is a normal time correction, not an absence classification.

3. Safety
   - No data is modified or deleted. Only adds a nullable column with a CHECK constraint.
*/

ALTER TABLE fichajes_correcciones
  ADD COLUMN IF NOT EXISTS clasificacion_ausencia text DEFAULT NULL
  CHECK (clasificacion_ausencia IS NULL OR clasificacion_ausencia IN ('no_fichado', 'dia_libre', 'asuntos_propios'));
