/*
# Historial de Accesos de Usuario

## Propósito
Registrar cada vez que un usuario inicia sesión en el portal web, guardando
fecha, IP, dispositivo, navegador y sistema operativo. Permite generar informes
filtrables por trabajador para auditar quién accede y desde dónde.

## Nueva tabla: access_logs
- `id` (uuid, PK) — identificador único del registro
- `user_id` (uuid, NOT NULL) — referencia al usuario en auth.users
- `user_email` (text, NOT NULL) — email del usuario (desnormalizado para informes)
- `user_nombre` (text) — nombre del usuario (desnormalizado para informes)
- `user_role` (text) — rol del usuario en el momento del acceso
- `ip_address` (text) — dirección IP desde la que se accede
- `device_info` (text) — tipo de dispositivo, navegador y SO
- `user_agent` (text) — user-agent completo del navegador
- `session_id` (text) — identificador de sesión de Supabase
- `created_at` (timestamptz) — fecha y hora del acceso

## Seguridad (RLS)
- Cada usuario puede insertar su propio registro de acceso (al iniciar sesión).
- Solo admin y rrhh pueden consultar el historial completo (para informes).
- Los usuarios normales no pueden ver los registros de otros usuarios.
- No se permite UPDATE ni DELETE desde el cliente (los registros son inmutables).

## Función: log_access
- Función SECURITY DEFINER que inserta un registro de acceso.
- Toma ip_address, device_info, user_agent como parámetros.
- Obtiene user_id, email, nombre, role de auth.uid() y user_profiles.
- Es callable por cualquier usuario autenticado.
*/

-- ─── Tabla de accesos ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS access_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  text NOT NULL,
  user_nombre text,
  user_role   text,
  ip_address  text,
  device_info text,
  user_agent  text,
  session_id  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

-- Índices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_access_logs_user_id ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user_email ON access_logs(user_email);

-- ─── Políticas RLS ────────────────────────────────────────────────────────────

-- SELECT: admin y rrhh pueden ver todos los registros; cada usuario los suyos
DROP POLICY IF EXISTS "select_access_logs" ON access_logs;
CREATE POLICY "select_access_logs" ON access_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles up
      WHERE up.id = auth.uid()
        AND up.role IN ('admin', 'rrhh')
        AND up.activo = true
    )
    OR user_id = auth.uid()
  );

-- INSERT: cada usuario puede insertar su propio registro
DROP POLICY IF EXISTS "insert_own_access_log" ON access_logs;
CREATE POLICY "insert_own_access_log" ON access_logs
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- No se permite UPDATE ni DELETE desde el cliente

-- ─── Función para registrar el acceso ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_access(
  p_ip_address text DEFAULT NULL,
  p_device_info text DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_nombre text;
  v_role text;
  v_log_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no autenticado';
  END IF;

  SELECT email, nombre, role INTO v_email, v_nombre, v_role
  FROM user_profiles
  WHERE id = v_user_id;

  IF v_email IS NULL THEN
    v_email := v_user_id::text;
  END IF;

  INSERT INTO access_logs (user_id, user_email, user_nombre, user_role, ip_address, device_info, user_agent, session_id)
  VALUES (v_user_id, v_email, v_nombre, v_role, p_ip_address, p_device_info, p_user_agent, p_session_id)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_access(text, text, text, text) TO authenticated;
