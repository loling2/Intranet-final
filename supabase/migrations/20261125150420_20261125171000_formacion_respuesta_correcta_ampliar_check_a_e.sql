/*
# Ampliar CHECK de preguntas.respuesta_correcta a 'A'..'E'

## Contexto
1. Con el nuevo modelo de preguntas de Formación, una pregunta de tipo
   "Varias respuestas" guarda en `respuestas_correctas` las letras marcadas
   en el checklist (A..E) y en `respuesta_correcta` la primera de ellas
   (compatibilidad con el modelo antiguo).
2. El constraint existente `preguntas_respuesta_correcta_check` solo admitía
   'A'..'D', por lo que guardar una pregunta cuyo checklist empiece por 'E'
   fallaba la inserción.

## Cambios
1. Se elimina el constraint anterior y se crea uno nuevo que admite
   'A'..'E'. No se modifica ni se borra ninguna columna ni dato: las
   preguntas existentes (valores 'A'..'D') siguen cumpliendo el nuevo
   CHECK sin necesidad de backfill.

## Seguridad
- No se cambian políticas RLS ni grants: es solo una regla de validación
  sobre una columna existente. Las políticas vigentes siguen aplicando.

## Notas
- Operación idempotente (DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT).
- Segura para reconstrucciones de la base de datos: no referencia datos.
*/

ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_respuesta_correcta_check;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_respuesta_correcta_check
  CHECK (respuesta_correcta IN ('A','B','C','D','E'));