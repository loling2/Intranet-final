-- CRM: Sistema de carpetas por usuario con permisos por categoría
--
-- Permite organizar documentos de cada usuario de servicio en carpetas
-- asignadas a categorías profesionales (Psicólogo, Terapeuta, General, etc.)
-- Cada usuario de la app (user_profiles) puede tener asignadas una o varias
-- categorías; al entrar al CRM solo verá las carpetas de sus categorías
-- (más la carpeta "General" que es accesible para todos).

-- ── Categorías ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL UNIQUE,
  descripcion text DEFAULT '',
  es_general boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_categorias_select_auth" ON crm_categorias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "crm_categorias_manage_admin" ON crm_categorias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sembrar categoría "General" por defecto
INSERT INTO crm_categorias (nombre, descripcion, es_general)
VALUES ('General', 'Carpeta accesible para todos los usuarios del CRM', true)
ON CONFLICT (nombre) DO NOTHING;

-- ── Asignación de categorías a usuarios de la app ────────────────────────────

CREATE TABLE IF NOT EXISTS crm_usuario_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  categoria_id uuid NOT NULL REFERENCES crm_categorias(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, categoria_id)
);

ALTER TABLE crm_usuario_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_usu_cat_select_auth" ON crm_usuario_categorias FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "crm_usu_cat_manage_admin" ON crm_usuario_categorias FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Carpetas por usuario de servicio ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crm_carpetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES crm_categorias(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  wasabi_prefix text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE crm_carpetas ENABLE ROW LEVEL SECURITY;

-- Admin/RRHH ven todas las carpetas
-- Usuarios con categoría ven carpetas de su categoría + General
CREATE POLICY "crm_carpetas_select_auth" ON crm_carpetas FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR
    EXISTS (
      SELECT 1 FROM crm_categorias c
      WHERE c.id = crm_carpetas.categoria_id AND c.es_general = true
    )
    OR
    EXISTS (
      SELECT 1 FROM crm_usuario_categorias uc
      WHERE uc.user_id = auth.uid() AND uc.categoria_id = crm_carpetas.categoria_id
    )
  );

CREATE POLICY "crm_carpetas_insert_staff" ON crm_carpetas FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
  );

CREATE POLICY "crm_carpetas_update_staff" ON crm_carpetas FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));

CREATE POLICY "crm_carpetas_delete_staff" ON crm_carpetas FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh')));

CREATE INDEX IF NOT EXISTS idx_crm_carpetas_usuario ON crm_carpetas (usuario_servicio_id);
CREATE INDEX IF NOT EXISTS idx_crm_carpetas_categoria ON crm_carpetas (categoria_id);

-- ── Función: obtener categorías del usuario actual ───────────────────────────

CREATE OR REPLACE FUNCTION get_my_crm_categorias()
RETURNS TABLE (id uuid, nombre text, es_general boolean)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT c.id, c.nombre, c.es_general
  FROM crm_categorias c
  WHERE c.es_general = true
     OR EXISTS (
       SELECT 1 FROM crm_usuario_categorias uc
       WHERE uc.user_id = auth.uid() AND uc.categoria_id = c.id
     )
  ORDER BY c.es_general DESC, c.nombre;
$$;

REVOKE EXECUTE ON FUNCTION get_my_crm_categorias FROM anon;
GRANT EXECUTE ON FUNCTION get_my_crm_categorias TO authenticated;

-- ── Función: ¿el usuario actual puede acceder al CRM? ────────────────────────

CREATE OR REPLACE FUNCTION can_access_crm()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
    OR
    EXISTS (SELECT 1 FROM crm_usuario_categorias WHERE user_id = auth.uid());
$$;

REVOKE EXECUTE ON FUNCTION can_access_crm FROM anon;
GRANT EXECUTE ON FUNCTION can_access_crm TO authenticated;

-- ── Función: obtener carpetas visibles para el usuario actual ─────────────────

CREATE OR REPLACE FUNCTION get_visible_crm_carpetas(p_usuario_servicio_id uuid)
RETURNS TABLE (
  id uuid,
  usuario_servicio_id uuid,
  categoria_id uuid,
  nombre text,
  wasabi_prefix text,
  categoria_nombre text,
  es_general boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    car.id, car.usuario_servicio_id, car.categoria_id, car.nombre,
    car.wasabi_prefix, cat.nombre AS categoria_nombre, cat.es_general,
    car.created_at
  FROM crm_carpetas car
  JOIN crm_categorias cat ON cat.id = car.categoria_id
  WHERE car.usuario_servicio_id = p_usuario_servicio_id
    AND (
      EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin','rrhh'))
      OR cat.es_general = true
      OR EXISTS (
        SELECT 1 FROM crm_usuario_categorias uc
        WHERE uc.user_id = auth.uid() AND uc.categoria_id = car.categoria_id
      )
    )
  ORDER BY cat.es_general DESC, cat.nombre, car.nombre;
$$;

REVOKE EXECUTE ON FUNCTION get_visible_crm_carpetas FROM anon;
GRANT EXECUTE ON FUNCTION get_visible_crm_carpetas TO authenticated;

-- ── Función: gestionar categorías de un usuario ──────────────────────────────

CREATE OR REPLACE FUNCTION set_crm_usuario_categorias(p_user_id uuid, p_categoria_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Solo admin puede gestionar categorías de usuarios';
  END IF;
  DELETE FROM crm_usuario_categorias WHERE user_id = p_user_id;
  IF p_categoria_ids IS NOT NULL AND array_length(p_categoria_ids, 1) > 0 THEN
    INSERT INTO crm_usuario_categorias (user_id, categoria_id)
    SELECT p_user_id, unnest(p_categoria_ids)
    ON CONFLICT (user_id, categoria_id) DO NOTHING;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION set_crm_usuario_categorias FROM anon;
GRANT EXECUTE ON FUNCTION set_crm_usuario_categorias TO authenticated;

-- ── Permisos CRM para RRHH en role_tab_permissions ───────────────────────────

INSERT INTO role_tab_permissions (role, tab_id, enabled)
VALUES ('rrhh', 'crm', true)
ON CONFLICT (role, tab_id) DO NOTHING;