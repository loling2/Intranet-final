-- Email templates table
CREATE TABLE IF NOT EXISTS email_plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  descripcion text NOT NULL DEFAULT '',
  asunto      text NOT NULL,
  cuerpo      text NOT NULL,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_rrhh_select_plantillas" ON email_plantillas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_insert_plantillas" ON email_plantillas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_update_plantillas" ON email_plantillas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_delete_plantillas" ON email_plantillas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );
