/*
# CRM: registro diario de tomas de medicación (Sí / No con anotación)

## Cambios
1. Nueva tabla `crm_tratamiento_tomas`: un registro por medicación y día.
   - `medicacion_id`: medicación a la que pertenece el registro (se borra con ella).
   - `fecha`: día al que corresponde la toma.
   - `tomada`: true = se tomó, false = no se tomó.
   - `anotacion`: motivo o nota cuando no se tomó.
   - Sin fila para un día = pendiente.
   - Restricción única (medicacion_id, fecha): una sola anotación por medicación y día.

## Seguridad
- RLS activado.
- Lectura y escritura permitidas a quien pueda ver el tratamiento del residente
  (admin/rrhh, o puesto con nivel ver/editar y residente asignado).
- Permisos concedidos a `authenticated` solo para las operaciones usadas (lectura, alta, actualización).

## Notas
- Migración idempotente (IF NOT EXISTS, DROP POLICY IF EXISTS).
- No modifica las tablas de tratamientos existentes.
*/

CREATE TABLE IF NOT EXISTS crm_tratamiento_tomas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medicacion_id uuid NOT NULL REFERENCES crm_tratamiento_medicaciones(id) ON DELETE CASCADE,
  fecha date NOT NULL,
  tomada boolean NOT NULL,
  anotacion text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (medicacion_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_crm_tratamiento_tomas_fecha ON crm_tratamiento_tomas (fecha);

ALTER TABLE crm_tratamiento_tomas ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON crm_tratamiento_tomas TO authenticated;

DROP POLICY IF EXISTS "crm_trat_tomas_select" ON crm_tratamiento_tomas;
CREATE POLICY "crm_trat_tomas_select" ON crm_tratamiento_tomas FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_tratamiento_medicaciones m
    JOIN crm_tratamientos t ON t.id = m.tratamiento_id
    WHERE m.id = crm_tratamiento_tomas.medicacion_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IS NOT NULL
  ));

DROP POLICY IF EXISTS "crm_trat_tomas_insert" ON crm_tratamiento_tomas;
CREATE POLICY "crm_trat_tomas_insert" ON crm_tratamiento_tomas FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM crm_tratamiento_medicaciones m
    JOIN crm_tratamientos t ON t.id = m.tratamiento_id
    WHERE m.id = crm_tratamiento_tomas.medicacion_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IS NOT NULL
  ));

DROP POLICY IF EXISTS "crm_trat_tomas_update" ON crm_tratamiento_tomas;
CREATE POLICY "crm_trat_tomas_update" ON crm_tratamiento_tomas FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM crm_tratamiento_medicaciones m
    JOIN crm_tratamientos t ON t.id = m.tratamiento_id
    WHERE m.id = crm_tratamiento_tomas.medicacion_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IS NOT NULL
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM crm_tratamiento_medicaciones m
    JOIN crm_tratamientos t ON t.id = m.tratamiento_id
    WHERE m.id = crm_tratamiento_tomas.medicacion_id
      AND get_crm_tratamiento_nivel(t.usuario_servicio_id) IS NOT NULL
  ));
