/*
# CRM perfiles por puesto de trabajo

1. Nuevas tablas
- crm_perfiles: un perfil CRM por cada puesto de trabajo (puesto_tags). Se crea automáticamente al dar de alta un puesto.
- crm_perfil_pestanas: interruptor activo/inactivo de cada pestaña del CRM para cada perfil.

2. Datos existentes
- Se crea un perfil para cada puesto que ya existe, con todas las pestañas activas para no cambiar el acceso actual.

3. Seguridad
- RLS activo en ambas tablas.
- Lectura para usuarios con acceso al CRM (can_access_crm()).
- Escritura solo para admin y rrhh (función SECURITY DEFINER crm_es_admin_o_rrhh()).
*/

CREATE TABLE IF NOT EXISTS crm_perfiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  puesto_tag_id uuid NOT NULL UNIQUE REFERENCES puesto_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS crm_perfil_pestanas (
  perfil_id uuid NOT NULL REFERENCES crm_perfiles(id) ON DELETE CASCADE,
  pestana text NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (perfil_id, pestana)
);

ALTER TABLE crm_perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_perfil_pestanas ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.crm_es_admin_o_rrhh()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid()
      AND (role IN ('admin', 'rrhh') OR 'admin' = ANY(COALESCE(roles, ARRAY[]::text[])) OR 'rrhh' = ANY(COALESCE(roles, ARRAY[]::text[])))
  );
$$;

REVOKE EXECUTE ON FUNCTION public.crm_es_admin_o_rrhh() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_es_admin_o_rrhh() TO authenticated;

GRANT SELECT ON crm_perfiles TO authenticated;
GRANT INSERT, DELETE ON crm_perfiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON crm_perfil_pestanas TO authenticated;

DROP POLICY IF EXISTS "crm_perfiles_select" ON crm_perfiles;
CREATE POLICY "crm_perfiles_select" ON crm_perfiles FOR SELECT
  TO authenticated USING (public.can_access_crm());

DROP POLICY IF EXISTS "crm_perfiles_insert" ON crm_perfiles;
CREATE POLICY "crm_perfiles_insert" ON crm_perfiles FOR INSERT
  TO authenticated WITH CHECK (public.crm_es_admin_o_rrhh());

DROP POLICY IF EXISTS "crm_perfiles_delete" ON crm_perfiles;
CREATE POLICY "crm_perfiles_delete" ON crm_perfiles FOR DELETE
  TO authenticated USING (public.crm_es_admin_o_rrhh());

DROP POLICY IF EXISTS "crm_perfil_pestanas_select" ON crm_perfil_pestanas;
CREATE POLICY "crm_perfil_pestanas_select" ON crm_perfil_pestanas FOR SELECT
  TO authenticated USING (public.can_access_crm());

DROP POLICY IF EXISTS "crm_perfil_pestanas_insert" ON crm_perfil_pestanas;
CREATE POLICY "crm_perfil_pestanas_insert" ON crm_perfil_pestanas FOR INSERT
  TO authenticated WITH CHECK (public.crm_es_admin_o_rrhh());

DROP POLICY IF EXISTS "crm_perfil_pestanas_update" ON crm_perfil_pestanas;
CREATE POLICY "crm_perfil_pestanas_update" ON crm_perfil_pestanas FOR UPDATE
  TO authenticated USING (public.crm_es_admin_o_rrhh()) WITH CHECK (public.crm_es_admin_o_rrhh());

DROP POLICY IF EXISTS "crm_perfil_pestanas_delete" ON crm_perfil_pestanas;
CREATE POLICY "crm_perfil_pestanas_delete" ON crm_perfil_pestanas FOR DELETE
  TO authenticated USING (public.crm_es_admin_o_rrhh());

CREATE OR REPLACE FUNCTION public.crm_crear_perfil_puesto()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.crm_perfiles (puesto_tag_id) VALUES (NEW.id)
  ON CONFLICT (puesto_tag_id) DO NOTHING;
  INSERT INTO public.crm_perfil_pestanas (perfil_id, pestana, activo)
  SELECT p.id, k.pestana, true
  FROM public.crm_perfiles p
  CROSS JOIN (VALUES
    ('residentes'), ('incidencias'), ('actividades'), ('actas'), ('tratamientos'), ('estadisticas'), ('ayuda'),
    ('info'), ('contactos'), ('cuentas'), ('medico'), ('tratamiento'), ('calendario'), ('documentos'),
    ('seguimiento'), ('llamadas'), ('medicacion'), ('abvd'), ('inc_sanitarias'), ('pautas'), ('pai'), ('sesiones')
  ) AS k(pestana)
  WHERE p.puesto_tag_id = NEW.id
  ON CONFLICT (perfil_id, pestana) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.crm_crear_perfil_puesto() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_crm_crear_perfil_puesto ON puesto_tags;
CREATE TRIGGER trg_crm_crear_perfil_puesto
  AFTER INSERT ON puesto_tags
  FOR EACH ROW EXECUTE FUNCTION public.crm_crear_perfil_puesto();

INSERT INTO crm_perfiles (puesto_tag_id)
SELECT id FROM puesto_tags
ON CONFLICT (puesto_tag_id) DO NOTHING;

INSERT INTO crm_perfil_pestanas (perfil_id, pestana, activo)
SELECT p.id, k.pestana, true
FROM crm_perfiles p
CROSS JOIN (VALUES
  ('residentes'), ('incidencias'), ('actividades'), ('actas'), ('tratamientos'), ('estadisticas'), ('ayuda'),
  ('info'), ('contactos'), ('cuentas'), ('medico'), ('tratamiento'), ('calendario'), ('documentos'),
  ('seguimiento'), ('llamadas'), ('medicacion'), ('abvd'), ('inc_sanitarias'), ('pautas'), ('pai'), ('sesiones')
) AS k(pestana)
ON CONFLICT (perfil_id, pestana) DO NOTHING;
