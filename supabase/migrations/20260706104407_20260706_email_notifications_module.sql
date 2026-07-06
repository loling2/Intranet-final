/*
  # Email Notifications Module

  ## Tables

  ### `email_cuentas`
  SMTP sender account configurations.

  ### `email_notificaciones`
  Notification type definitions — maps an application event to a sender account
  and a list of recipient addresses.

  ## Security
  Both tables are restricted to admin / rrhh roles only (contain credentials).
*/

-- ─── SMTP Accounts ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_cuentas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL,
  email       text NOT NULL,
  password    text NOT NULL,
  smtp_host   text NOT NULL,
  smtp_port   integer NOT NULL DEFAULT 587,
  seguridad   text NOT NULL DEFAULT 'STARTTLS'
                CHECK (seguridad IN ('SSL', 'TLS', 'STARTTLS', 'NONE')),
  activo      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_cuentas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_rrhh_select_email_cuentas" ON email_cuentas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_insert_email_cuentas" ON email_cuentas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_update_email_cuentas" ON email_cuentas FOR UPDATE
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

CREATE POLICY "admin_rrhh_delete_email_cuentas" ON email_cuentas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

-- ─── Notification Types ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS email_notificaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  descripcion     text NOT NULL DEFAULT '',
  evento          text NOT NULL,
  cuenta_id       uuid REFERENCES email_cuentas(id) ON DELETE SET NULL,
  destinatarios   text[] NOT NULL DEFAULT '{}',
  activo          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE email_notificaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_rrhh_select_email_notificaciones" ON email_notificaciones FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_insert_email_notificaciones" ON email_notificaciones FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE POLICY "admin_rrhh_update_email_notificaciones" ON email_notificaciones FOR UPDATE
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

CREATE POLICY "admin_rrhh_delete_email_notificaciones" ON email_notificaciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
        AND user_profiles.role IN ('admin', 'rrhh')
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_notif_cuenta ON email_notificaciones(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_email_notif_evento ON email_notificaciones(evento);
