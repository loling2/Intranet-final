/*
  # HR Core — Politicas RLS completas (parte 2/2)

  Aplica todas las politicas de Row Level Security para las tablas HR.
  Esta migracion se ejecuta despues de 20260525_hr_core_tables para poder
  referenciar 'asignaciones' desde las politicas de 'centros' y 'documentos_centros'.

  ## Logica de acceso por rol

  ### admin
  - CRUD completo en todas las tablas

  ### rrhh
  - SELECT, INSERT, UPDATE en todas las tablas
  - Sin permiso de DELETE (solo admin puede eliminar)

  ### employee
  - sociedades:        Solo lectura (todas)
  - tags:              Solo lectura (todas)
  - empleados:         Solo su propio registro
  - centros:           Solo centros donde tiene asignacion
  - asignaciones:      Solo las propias
  - etiquetado:        Los de su entidad (empleado + centros asignados)
  - documentos_centros: Los del centro asignado O con tag compartido
*/

-- Helper: devuelve true si el usuario autenticado tiene rol admin o rrhh y esta activo
CREATE OR REPLACE FUNCTION is_admin_or_rrhh()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role IN ('admin', 'rrhh')
      AND user_profiles.activo = true
  );
$$;

-- Helper: devuelve true si el usuario autenticado es admin activo
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
      AND user_profiles.role = 'admin'
      AND user_profiles.activo = true
  );
$$;


-- ─────────────────────────────────────────────────────────────
-- SOCIEDADES
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Any authenticated can view sociedades"
  ON sociedades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or RRHH can insert sociedades"
  ON sociedades FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update sociedades"
  ON sociedades FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete sociedades"
  ON sociedades FOR DELETE
  TO authenticated
  USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- EMPLEADOS
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Admin or RRHH can view all empleados"
  ON empleados FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

CREATE POLICY "Employee can view own empleado record"
  ON empleados FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admin or RRHH can insert empleados"
  ON empleados FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update empleados"
  ON empleados FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete empleados"
  ON empleados FOR DELETE
  TO authenticated
  USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- CENTROS
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Admin or RRHH can view all centros"
  ON centros FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

-- Empleado ve solo centros a los que esta asignado
CREATE POLICY "Employee can view assigned centros"
  ON centros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM asignaciones a
      JOIN empleados e ON e.id = a.id_empleado
      WHERE e.user_id = auth.uid()
        AND a.id_centro = centros.id
    )
  );

CREATE POLICY "Admin or RRHH can insert centros"
  ON centros FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update centros"
  ON centros FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete centros"
  ON centros FOR DELETE
  TO authenticated
  USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- ASIGNACIONES
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Admin or RRHH can view all asignaciones"
  ON asignaciones FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

CREATE POLICY "Employee can view own asignaciones"
  ON asignaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM empleados e
      WHERE e.id = asignaciones.id_empleado
        AND e.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin or RRHH can insert asignaciones"
  ON asignaciones FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update asignaciones"
  ON asignaciones FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete asignaciones"
  ON asignaciones FOR DELETE
  TO authenticated
  USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- TAGS
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Any authenticated can view tags"
  ON tags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or RRHH can insert tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete tags"
  ON tags FOR DELETE
  TO authenticated
  USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- ETIQUETADO
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Admin or RRHH can view all etiquetado"
  ON etiquetado FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

-- Empleado ve su propio etiquetado y el de los centros asignados
CREATE POLICY "Employee can view own and assigned etiquetado"
  ON etiquetado FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM empleados e
      WHERE e.user_id = auth.uid()
        AND e.id = etiquetado.entidad_id
    )
    OR EXISTS (
      SELECT 1 FROM asignaciones a
      JOIN empleados e ON e.id = a.id_empleado
      WHERE e.user_id = auth.uid()
        AND a.id_centro = etiquetado.entidad_id
    )
  );

CREATE POLICY "Admin or RRHH can insert etiquetado"
  ON etiquetado FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update etiquetado"
  ON etiquetado FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete etiquetado"
  ON etiquetado FOR DELETE
  TO authenticated
  USING (is_admin());


-- ─────────────────────────────────────────────────────────────
-- DOCUMENTOS_CENTROS
-- ─────────────────────────────────────────────────────────────

CREATE POLICY "Admin or RRHH can view all documentos_centros"
  ON documentos_centros FOR SELECT
  TO authenticated
  USING (is_admin_or_rrhh());

-- Empleado ve documentos si esta asignado al centro O comparte el tag
CREATE POLICY "Employee can view documentos of assigned centros or shared tags"
  ON documentos_centros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM asignaciones a
      JOIN empleados e ON e.id = a.id_empleado
      WHERE e.user_id = auth.uid()
        AND a.id_centro = documentos_centros.id_centro
    )
    OR (
      documentos_centros.tag_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM etiquetado et
        JOIN empleados e ON e.id = et.entidad_id
        WHERE e.user_id = auth.uid()
          AND et.tag_id = documentos_centros.tag_id
      )
    )
  );

CREATE POLICY "Admin or RRHH can insert documentos_centros"
  ON documentos_centros FOR INSERT
  TO authenticated
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin or RRHH can update documentos_centros"
  ON documentos_centros FOR UPDATE
  TO authenticated
  USING (is_admin_or_rrhh())
  WITH CHECK (is_admin_or_rrhh());

CREATE POLICY "Admin can delete documentos_centros"
  ON documentos_centros FOR DELETE
  TO authenticated
  USING (is_admin());
