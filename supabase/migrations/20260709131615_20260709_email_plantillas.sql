
CREATE TABLE IF NOT EXISTS email_plantillas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  asunto      text NOT NULL DEFAULT '',
  cuerpo      text NOT NULL DEFAULT '',
  cuenta_id   uuid REFERENCES email_cuentas(id) ON DELETE SET NULL,
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_plantillas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_email_plantillas" ON email_plantillas FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_email_plantillas" ON email_plantillas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_email_plantillas" ON email_plantillas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_email_plantillas" ON email_plantillas FOR DELETE TO authenticated USING (true);
