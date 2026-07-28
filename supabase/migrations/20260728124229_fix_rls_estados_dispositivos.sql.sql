-- ── estados_dispositivos: reference table, any authenticated can read ──
CREATE POLICY "select_estados_dispositivos" ON estados_dispositivos FOR SELECT
  TO authenticated USING (true);
