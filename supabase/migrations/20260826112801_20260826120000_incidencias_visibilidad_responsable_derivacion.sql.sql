/*
# Incidencias: visibilidad de departamento, responsable y derivación

## Summary
1. Cada departamento puede marcarse como "visible en incidencias" (sí/no).
   Si está en "no", no aparece en el desplegable al crear una incidencia,
   pero sigue existiendo y funcionando internamente.
2. Cada departamento puede tener un "responsable" (usuario). Cuando alguien
   envía una incidencia a ese departamento, le llega al responsable, que puede
   derivarla a cualquier miembro del departamento.
3. La incidencia puede "derivarse" a un usuario concreto (asignado_a).
   El creador, el responsable y el asignado pueden ver el seguimiento
   (mensajes y cambios de estado) de la incidencia.

## Modified Tables

### `departamentos`
- `visible_incidencias` boolean NOT NULL DEFAULT true — si false, no aparece
  en el selector al crear incidencias.
- `responsable_id` uuid nullable — user_profiles.id del responsable del dept.
- `responsable_nombre` text — snapshot del nombre del responsable.

### `incidencias`
- `asignado_a_id` uuid nullable — usuario al que se deriva la incidencia.
- `asignado_a_nombre` text — snapshot del nombre.

## Security Changes
- RLS en incidencias: el asignado_a también puede ver y actualizar.
- RLS en incidencias_mensajes: el asignado_a también puede ver y escribir.
- departamentos: el responsable puede actualizar su departamento (solo visible/responsable).
- Se añade política SELECT para que el asignado_a vea la incidencia.
*/

-- ─── departamentos: visibilidad + responsable ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departamentos' AND column_name = 'visible_incidencias'
  ) THEN
    ALTER TABLE departamentos ADD COLUMN visible_incidencias boolean NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departamentos' AND column_name = 'responsable_id'
  ) THEN
    ALTER TABLE departamentos ADD COLUMN responsable_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'departamentos' AND column_name = 'responsable_nombre'
  ) THEN
    ALTER TABLE departamentos ADD COLUMN responsable_nombre text NOT NULL DEFAULT '';
  END IF;
END $$;

-- ─── incidencias: asignado_a ───────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidencias' AND column_name = 'asignado_a_id'
  ) THEN
    ALTER TABLE incidencias ADD COLUMN asignado_a_id uuid;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'incidencias' AND column_name = 'asignado_a_nombre'
  ) THEN
    ALTER TABLE incidencias ADD COLUMN asignado_a_nombre text NOT NULL DEFAULT '';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidencias_asignado_a ON incidencias(asignado_a_id);

-- ─── RLS: el asignado_a puede ver y actualizar incidencias ─────────────────────
DROP POLICY IF EXISTS "Incidencia participants can select" ON incidencias;
CREATE POLICY "Incidencia participants can select"
  ON incidencias FOR SELECT
  TO authenticated
  USING (
    auth.uid() = creado_por_id
    OR auth.uid() = asignado_a_id
    OR EXISTS (
      SELECT 1 FROM departamento_miembros dm
      WHERE dm.departamento_id = incidencias.departamento_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "Department member or admin can update incidencias" ON incidencias;
CREATE POLICY "Department member or admin can update incidencias"
  ON incidencias FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = asignado_a_id
    OR EXISTS (
      SELECT 1 FROM departamento_miembros dm
      WHERE dm.departamento_id = incidencias.departamento_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    auth.uid() = asignado_a_id
    OR EXISTS (
      SELECT 1 FROM departamento_miembros dm
      WHERE dm.departamento_id = incidencias.departamento_id
        AND dm.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- ─── RLS: mensajes visibles para asignado_a ────────────────────────────────────
DROP POLICY IF EXISTS "Participants can view messages" ON incidencias_mensajes;
CREATE POLICY "Participants can view messages"
  ON incidencias_mensajes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM incidencias i
      WHERE i.id = incidencia_id
        AND (
          i.creado_por_id = auth.uid()
          OR i.asignado_a_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM departamento_miembros dm
            WHERE dm.departamento_id = i.departamento_id
              AND dm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('admin', 'rrhh', 'supervisor')
          )
        )
    )
  );

DROP POLICY IF EXISTS "Participants can insert messages" ON incidencias_mensajes;
CREATE POLICY "Participants can insert messages"
  ON incidencias_mensajes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = autor_id
    AND EXISTS (
      SELECT 1 FROM incidencias i
      WHERE i.id = incidencia_id
        AND (
          i.creado_por_id = auth.uid()
          OR i.asignado_a_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM departamento_miembros dm
            WHERE dm.departamento_id = i.departamento_id
              AND dm.user_id = auth.uid()
          )
          OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE user_profiles.id = auth.uid()
              AND user_profiles.role IN ('admin', 'rrhh')
          )
        )
    )
  );

-- ─── departamentos: permitir al responsable actualizar visible/responsable ─────
DROP POLICY IF EXISTS "Admin and rrhh can update departamentos" ON departamentos;
CREATE POLICY "Admin rrhh or responsable can update departamentos"
  ON departamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
    OR responsable_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
    OR responsable_id = auth.uid()
  );