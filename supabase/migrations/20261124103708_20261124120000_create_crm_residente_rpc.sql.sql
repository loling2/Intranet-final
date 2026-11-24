/*
# Función segura para crear residentes del CRM

1. Propósito
- Los gestores (admin, rrhh, supervisor, coordinador) creaban residentes desde el panel CRM
  con dos escrituras separadas (residente, luego centros). La política SELECT por centro
  ocultaba la fila recién insertada y el guardado fallaba en pantalla.
- Esta función hace las dos escrituras en una sola operación atómica y valida en el
  servidor que el gestor solo asigne centros que tiene asignados.

2. Nueva función
- `create_crm_residente(p_nombre, p_apellidos, p_email, p_telefono, p_observaciones, p_acronimo, p_centro_ids)`
  devuelve el id del residente creado.

3. Seguridad
- SECURITY DEFINER con search_path fijo.
- Rechaza a quien no sea gestor (`crm_es_gestor()`).
- Cada centro recibido debe estar en `crm_usuario_centros` del usuario que llama,
  salvo que sea admin o rrhh (`crm_es_admin_o_rrhh()`), que gestionan todos los centros.
- EXECUTE revocado a PUBLIC/anon y concedido solo a authenticated.

4. Notas
- No modifica tablas ni políticas existentes; el flujo de edición sigue igual.
*/

CREATE OR REPLACE FUNCTION public.create_crm_residente(
  p_nombre text,
  p_apellidos text DEFAULT '',
  p_email text DEFAULT '',
  p_telefono text DEFAULT '',
  p_observaciones text DEFAULT '',
  p_acronimo text DEFAULT '',
  p_centro_ids uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_centro uuid;
BEGIN
  IF NOT public.crm_es_gestor() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_nombre IS NULL OR length(btrim(p_nombre)) = 0 THEN
    RAISE EXCEPTION 'Nombre obligatorio';
  END IF;

  INSERT INTO public.usuarios_servicios (nombre, apellidos, email, telefono, observaciones, acronimo)
  VALUES (
    btrim(p_nombre),
    NULLIF(btrim(p_apellidos), ''),
    NULLIF(btrim(p_email), ''),
    NULLIF(btrim(p_telefono), ''),
    NULLIF(btrim(p_observaciones), ''),
    NULLIF(btrim(p_acronimo), '')
  )
  RETURNING id INTO v_id;

  IF p_centro_ids IS NOT NULL THEN
    FOREACH v_centro IN ARRAY p_centro_ids LOOP
      IF NOT public.crm_es_admin_o_rrhh()
         AND NOT EXISTS (
           SELECT 1 FROM public.crm_usuario_centros ucc
           WHERE ucc.user_id = auth.uid()
             AND ucc.centro_id = v_centro
         ) THEN
        RAISE EXCEPTION 'Centro no autorizado';
      END IF;

      INSERT INTO public.usuarios_servicios_centros (usuario_servicio_id, centro_id)
      VALUES (v_id, v_centro);
    END LOOP;
  END IF;

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_crm_residente(text, text, text, text, text, text, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_crm_residente(text, text, text, text, text, text, uuid[]) TO authenticated;
