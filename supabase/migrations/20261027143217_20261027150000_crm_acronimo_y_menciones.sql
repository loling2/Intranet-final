/*
# Añadir acrónimo de residente y registrar menciones en notas

1. Cambios en tablas existentes
- `usuarios_servicios.acronimo`: identificador corto opcional del residente.

2. Nueva tabla
- `crm_nota_menciones`: relaciona cada nota con los residentes mencionados usando `@nombre`.
- `nota_id`: nota donde aparece la mención.
- `mencionado_usuario_servicio_id`: residente identificado.
- `texto_mencion`: texto introducido después de `@`.
- `created_at`: fecha de registro.

3. Seguridad
- Se activa RLS en `crm_nota_menciones`.
- Solo usuarios autenticados con rol `admin` o `rrhh` pueden leer o crear menciones.
- Se conceden únicamente los permisos necesarios para consultar e insertar.

4. Notas importantes
- El contenido original de la nota se conserva sin cambios.
- Las menciones se guardan aparte para poder localizar y relacionar residentes de forma fiable.
- La operación es segura para volver a ejecutar.
*/

ALTER TABLE usuarios_servicios ADD COLUMN IF NOT EXISTS acronimo text DEFAULT '';

CREATE TABLE IF NOT EXISTS crm_nota_menciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_id uuid NOT NULL REFERENCES crm_notas(id) ON DELETE CASCADE,
  mencionado_usuario_servicio_id uuid NOT NULL REFERENCES usuarios_servicios(id) ON DELETE CASCADE,
  texto_mencion text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (nota_id, mencionado_usuario_servicio_id)
);

ALTER TABLE crm_nota_menciones ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON crm_nota_menciones TO authenticated;

DROP POLICY IF EXISTS "crm_nota_menciones_select_staff" ON crm_nota_menciones;
CREATE POLICY "crm_nota_menciones_select_staff"
  ON crm_nota_menciones FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh')));

DROP POLICY IF EXISTS "crm_nota_menciones_insert_staff" ON crm_nota_menciones;
CREATE POLICY "crm_nota_menciones_insert_staff"
  ON crm_nota_menciones FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'rrhh')));

CREATE INDEX IF NOT EXISTS idx_crm_nota_menciones_nota ON crm_nota_menciones (nota_id);
CREATE INDEX IF NOT EXISTS idx_crm_nota_menciones_residente ON crm_nota_menciones (mencionado_usuario_servicio_id);