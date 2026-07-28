-- ── vehicles: anon can read/select (kiosk), authenticated staff can modify ──
DROP POLICY IF EXISTS "Allow all select on vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow all inserts on vehicles" ON vehicles;
DROP POLICY IF EXISTS "Allow all updates on vehicles" ON vehicles;
CREATE POLICY "select_vehicles" ON vehicles FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_vehicles" ON vehicles FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "update_vehicles" ON vehicles FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── vehicle_logs: anon can insert (kiosk), authenticated staff can read/update ──
DROP POLICY IF EXISTS "Allow all inserts on vehicle_logs" ON vehicle_logs;
DROP POLICY IF EXISTS "Allow all select on vehicle_logs" ON vehicle_logs;
DROP POLICY IF EXISTS "Allow all updates on vehicle_logs" ON vehicle_logs;
CREATE POLICY "select_vehicle_logs" ON vehicle_logs FOR SELECT
  TO authenticated USING (public.is_staff());
CREATE POLICY "insert_vehicle_logs" ON vehicle_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_vehicle_logs" ON vehicle_logs FOR UPDATE
  TO authenticated USING (public.is_staff()) WITH CHECK (public.is_staff());

-- ── documents: anon can read (public docs via wasabi), authenticated staff can manage ──
DROP POLICY IF EXISTS "Allow all select on documents" ON documents;
DROP POLICY IF EXISTS "Allow all inserts on documents" ON documents;
DROP POLICY IF EXISTS "Allow all deletes on documents" ON documents;
CREATE POLICY "select_documents" ON documents FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_documents" ON documents FOR INSERT
  TO authenticated WITH CHECK (public.is_staff());
CREATE POLICY "delete_documents" ON documents FOR DELETE
  TO authenticated USING (public.is_staff());

-- ── fichajes: anon can insert (kiosk PIN), authenticated staff can read ──
DROP POLICY IF EXISTS "insert_fichajes_public" ON fichajes;
CREATE POLICY "insert_fichajes_public" ON fichajes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

-- ── personal_documents: employees can read their own, admin/rrhh can manage ──
DROP POLICY IF EXISTS "Ver mis documentos" ON personal_documents;
CREATE POLICY "select_personal_documents" ON personal_documents FOR SELECT
  TO authenticated USING (
    public.is_admin_or_rrhh()
    OR empleado_id IN (SELECT id FROM empleados WHERE user_id = auth.uid())
  );
CREATE POLICY "insert_personal_documents" ON personal_documents FOR INSERT
  TO authenticated WITH CHECK (
    public.is_admin_or_rrhh()
    OR empleado_id IN (SELECT id FROM empleados WHERE user_id = auth.uid())
  );
CREATE POLICY "delete_personal_documents" ON personal_documents FOR DELETE
  TO authenticated USING (
    public.is_admin_or_rrhh()
    OR empleado_id IN (SELECT id FROM empleados WHERE user_id = auth.uid())
  );
