/*
# Añadir tipos de respuesta para preguntas de Formación

1. Nuevas columnas en `preguntas`
- `opcion_e`: quinta opción opcional para preguntas de cinco respuestas o de respuestas múltiples.
- `tipo_respuesta`: formato de la pregunta: `2`, `3`, `4`, `5` o `multiple`.
- `respuestas_correctas`: lista de letras correctas. Se utiliza para admitir varias respuestas y conservar la respuesta principal de las preguntas antiguas.

2. Compatibilidad de datos existentes
- Las preguntas existentes se mantienen sin cambios visibles y se consideran preguntas de cuatro respuestas.
- `respuestas_correctas` se rellena usando el valor actual de `respuesta_correcta`.
- `respuesta_correcta` continúa guardando la primera respuesta correcta para no romper consultas o pantallas antiguas.

3. Seguridad e integridad
- Las columnas nuevas heredan el RLS y los permisos de la tabla `preguntas`.
- Se añade una comprobación para impedir tipos de pregunta desconocidos.
- No se eliminan columnas ni registros.

4. Puntuación
- La puntuación proporcional se calcula en la pantalla del examen a partir de `respuestas_correctas`.
- Para preguntas de respuesta única se conserva el resultado correcto/incorrecto completo.
*/

ALTER TABLE public.preguntas
  ADD COLUMN IF NOT EXISTS opcion_e text,
  ADD COLUMN IF NOT EXISTS tipo_respuesta text NOT NULL DEFAULT '4',
  ADD COLUMN IF NOT EXISTS respuestas_correctas text[] NOT NULL DEFAULT ARRAY['A']::text[];

UPDATE public.preguntas
SET tipo_respuesta = '4',
    respuestas_correctas = ARRAY[respuesta_correcta::text]
WHERE tipo_respuesta IS NULL
   OR tipo_respuesta NOT IN ('2', '3', '4', '5', 'multiple')
   OR respuestas_correctas IS NULL
   OR cardinality(respuestas_correctas) = 0;

ALTER TABLE public.preguntas
  DROP CONSTRAINT IF EXISTS preguntas_tipo_respuesta_check;

ALTER TABLE public.preguntas
  ADD CONSTRAINT preguntas_tipo_respuesta_check
  CHECK (tipo_respuesta IN ('2', '3', '4', '5', 'multiple'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.preguntas TO authenticated;
