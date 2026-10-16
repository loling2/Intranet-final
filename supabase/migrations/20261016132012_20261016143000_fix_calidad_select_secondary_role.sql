/*
# Permitir a Calidad leer documentos de todas las sociedades

1. Cambios de seguridad
- Actualiza la política de lectura de `calidad_documentos`.
- Reconoce tanto el rol principal `calidad` como el rol adicional `calidad` guardado en `user_profiles.roles`.

2. Motivo
- Algunos usuarios acceden al perfil Calidad mediante un rol secundario.
- Sin esta comprobación, solo podían ver documentos de su propia sociedad, aunque administrasen Calidad.

3. Datos
- No se crean, eliminan ni modifican documentos.
- No se cambian columnas ni tablas.
*/

DROP POLICY IF EXISTS "select_calidad_documentos" ON public.calidad_documentos;

CREATE POLICY "select_calidad_documentos"
ON public.calidad_documentos
FOR SELECT
TO anon, authenticated
USING (
  es_general = true
  OR sociedad_ids = '{}'
  OR EXISTS (
    SELECT 1
    FROM public.empleados e
    WHERE e.user_id = auth.uid()
      AND e.id_sociedad::text = ANY (calidad_documentos.sociedad_ids)
  )
  OR EXISTS (
    SELECT 1
    FROM public.user_profiles up
    WHERE up.id = auth.uid()
      AND (
        up.role = ANY (ARRAY['admin'::text, 'calidad'::text])
        OR 'calidad' = ANY (COALESCE(up.roles, ARRAY[]::text[]))
      )
  )
);