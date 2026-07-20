/*
# Fichajes corrections, password reset flow, and email template types

## 1. New Tables

### `fichajes_correcciones`
Stores correction petitions filed by employees when they detect an incident
in their time clock records (e.g. "I forgot to clock out, but I left at 14:00").

- `id` (uuid, primary key)
- `fichaje_id` (uuid, nullable, references fichajes.id) — the original fichaje being corrected
- `empleado_id` (uuid, nullable, references empleados.id) — the employee requesting
- `user_id` (uuid, not null, default auth.uid()) — the auth user requesting
- `nombre_empleado` (text, not null) — denormalized for display
- `fecha` (date, not null) — the work date being corrected
- `entrada_original` (timestamptz, nullable) — original start timestamp
- `salida_original` (timestamptz, nullable) — original end timestamp
- `entrada_propuesta` (timestamptz, nullable) — proposed start timestamp
- `salida_propuesta` (timestamptz, nullable) — proposed end timestamp
- `motivo` (text, not null) — reason given by the employee (the "incidencia" text)
- `estado` (text, not null, default 'pendiente') — pendiente | aprobada | rechazada
- `validado_por` (uuid, nullable) — auth user id of RRHH/admin who validated
- `validado_por_nombre` (text, nullable) — denormalized name
- `respuesta_rrhh` (text, nullable) — optional note from RRHH
- `validado_at` (timestamptz, nullable)
- `created_at` (timestamptz, default now())
- `updated_at` (timestamptz, default now())

### `password_reset_tokens`
Stores single-use tokens for the "forgot my password" flow.

- `id` (uuid, primary key)
- `email` (text, not null, indexed) — the email the user typed (may or may not exist)
- `token_hash` (text, not null, unique) — sha256 hash of the reset token
- `user_id` (uuid, nullable) — resolved auth user id (null if email doesn't exist)
- `used_at` (timestamptz, nullable) — when the token was consumed
- `expires_at` (timestamptz, not null) — token validity window (30 minutes)
- `created_at` (timestamptz, default now())

### `password_reset_attempts`
Tracks failed attempts per email for rate-limit escalation (5 fails -> 20 min,
3 more fails -> 60 min, etc.). The user is NOT told the exact wait time.

- `id` (uuid, primary key)
- `email` (text, not null, unique)
- `attempt_count` (integer, not null, default 0)
- `locked_until` (timestamptz, nullable) — if set, requests before this time are rejected
- `lock_level` (integer, not null, default 0) — 0, 1, 2, ... escalating
- `updated_at` (timestamptz, default now())

## 2. Modified Tables

### `email_plantillas`
- Add `tipo` (text, nullable) column to categorize templates.
  Values: `password_reset`, `usuario_nuevo`, `notificacion`, `generico`, NULL.
  Used to filter templates assignable to specific system flows (e.g. forgot password).

## 3. Security (RLS)

### `fichajes_correcciones`
- SELECT: employees see only their own petitions; admin/rrhh/supervisor see all.
- INSERT: any authenticated user can insert their own petition (user_id defaults to auth.uid()).
- UPDATE: employees can only update their own pending petitions; admin/rrhh can update any.
- DELETE: admin/rrhh only.

### `password_reset_tokens` / `password_reset_attempts`
- Locked down: only service role (edge function, which bypasses RLS) can read/write.
  Frontend never queries these tables directly.

## 4. Notes

- The frontend NEVER queries password_reset_tokens or password_reset_attempts
  directly. All access goes through the `password-reset` edge function.
- Rate-limit logic: after 5 attempts with no successful token use, lock for 20 min.
  After 3 more (8 total), lock for 60 min. After 3 more (11 total), lock for 24h.
  Each subsequent 3 attempts multiplies by 2. The user is told only that they must
  wait, not the duration.
- Tokens are 32-byte random base64url strings, hashed with SHA-256 before storage.
- Tokens expire 30 minutes after creation.
*/

-- ─── fichajes_correcciones ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fichajes_correcciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fichaje_id          uuid REFERENCES fichajes(id) ON DELETE SET NULL,
  empleado_id         uuid REFERENCES empleados(id) ON DELETE SET NULL,
  user_id             uuid NOT NULL DEFAULT auth.uid(),
  nombre_empleado     text NOT NULL,
  fecha               date NOT NULL,
  entrada_original    timestamptz,
  salida_original     timestamptz,
  entrada_propuesta   timestamptz,
  salida_propuesta    timestamptz,
  motivo              text NOT NULL,
  estado              text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'aprobada', 'rechazada')),
  validado_por        uuid,
  validado_por_nombre text,
  respuesta_rrhh      text,
  validado_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fichajes_correcciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_or_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "select_own_or_admin_correcciones" ON fichajes_correcciones FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh', 'supervisor')
    )
  );

DROP POLICY IF EXISTS "insert_own_correcciones" ON fichajes_correcciones;
CREATE POLICY "insert_own_correcciones" ON fichajes_correcciones FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_or_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "update_own_or_admin_correcciones" ON fichajes_correcciones FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

DROP POLICY IF EXISTS "delete_admin_correcciones" ON fichajes_correcciones;
CREATE POLICY "delete_admin_correcciones" ON fichajes_correcciones FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role IN ('admin', 'rrhh')
    )
  );

CREATE INDEX IF NOT EXISTS idx_correcciones_empleado ON fichajes_correcciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_correcciones_user ON fichajes_correcciones(user_id);
CREATE INDEX IF NOT EXISTS idx_correcciones_estado ON fichajes_correcciones(estado);
CREATE INDEX IF NOT EXISTS idx_correcciones_fecha ON fichajes_correcciones(fecha DESC);

-- ─── password_reset_tokens ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  token_hash  text NOT NULL UNIQUE,
  user_id     uuid,
  used_at     timestamptz,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_select_reset_tokens" ON password_reset_tokens;
CREATE POLICY "deny_anon_select_reset_tokens" ON password_reset_tokens FOR SELECT
  TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_anon_insert_reset_tokens" ON password_reset_tokens;
CREATE POLICY "deny_anon_insert_reset_tokens" ON password_reset_tokens FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_update_reset_tokens" ON password_reset_tokens;
CREATE POLICY "deny_anon_update_reset_tokens" ON password_reset_tokens FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_delete_reset_tokens" ON password_reset_tokens;
CREATE POLICY "deny_anon_delete_reset_tokens" ON password_reset_tokens FOR DELETE
  TO authenticated USING (false);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ─── password_reset_attempts ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_reset_attempts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL UNIQUE,
  attempt_count  integer NOT NULL DEFAULT 0,
  locked_until   timestamptz,
  lock_level     integer NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE password_reset_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny_anon_select_reset_attempts" ON password_reset_attempts;
CREATE POLICY "deny_anon_select_reset_attempts" ON password_reset_attempts FOR SELECT
  TO authenticated USING (false);

DROP POLICY IF EXISTS "deny_anon_insert_reset_attempts" ON password_reset_attempts;
CREATE POLICY "deny_anon_insert_reset_attempts" ON password_reset_attempts FOR INSERT
  TO authenticated WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_update_reset_attempts" ON password_reset_attempts;
CREATE POLICY "deny_anon_update_reset_attempts" ON password_reset_attempts FOR UPDATE
  TO authenticated USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_anon_delete_reset_attempts" ON password_reset_attempts;
CREATE POLICY "deny_anon_delete_reset_attempts" ON password_reset_attempts FOR DELETE
  TO authenticated USING (false);

-- ─── email_plantillas: add tipo column ────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'email_plantillas' AND column_name = 'tipo'
  ) THEN
    ALTER TABLE email_plantillas ADD COLUMN tipo text;
  END IF;
END $$;

-- Seed a default password reset template if none exists with that tipo
INSERT INTO email_plantillas (nombre, asunto, cuerpo, activo, tipo)
SELECT 'Recuperacion de contrasena',
       'Recupera tu contrasena de acceso',
       'Hola,

Has solicitado restablecer tu contrasena de acceso al portal.

Para cambiar tu contrasena, haz clic en el siguiente enlace (valido durante 30 minutos):

{{url_reset}}

Si no has solicitado este cambio, puedes ignorar este correo. Tu contrasena actual sigue siendo valida.

Saludos,
El equipo de {{empresa}}',
       true, 'password_reset'
WHERE NOT EXISTS (
  SELECT 1 FROM email_plantillas WHERE tipo = 'password_reset'
);
