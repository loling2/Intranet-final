/*
# Fix formacion: preguntas CHECK constraint, unique asignaciones, fechas y tiempo

## Problemas detectados
1. La columna `preguntas.respuesta_correcta` tiene un CHECK que solo admite
   valores en MINUSCULAS ('a','b','c','d'), pero el frontend envia MAYUSCULAS
   ('A','B','C','D'). Por eso al guardar una pregunta nueva siempre falla la
   insercion con "new row violates row-level security policy" (el mensaje
   real es una violacion del CHECK, pero el cliente lo muestra como error
   generico). No existen preguntas guardadas (la tabla esta vacia), asi que
   no hay datos que perder al cambiar el constraint.
2. `examen_asignaciones` no tiene una restriccion UNIQUE sobre
   (examen_id, empleado_id), por lo que se puede asignar el mismo examen a la
   misma persona varias veces. Ya existe al menos un duplicado en produccion.
3. No se guarda la fecha de asignacion (created_at ya existe pero no se
   muestra), ni la fecha de aprobacion, ni el tiempo empleado en la
   resolucion del examen.

## Cambios
### 1. preguntas.respuesta_correcta — CHECK en mayusculas
- Se elimina el constraint `preguntas_respuesta_correcta_check` (solo
  admitia 'a'..'d').
- Se crea uno nuevo que admite 'A'..'D' (lo que el frontend ya envia).
- Como la tabla esta vacia, no hay datos que migrar.

### 2. examen_asignaciones — UNIQUE (examen_id, empleado_id)
- Se anade un UNIQUE parcial sobre (examen_id, empleado_id) WHERE
  empleado_id IS NOT NULL. Asi no se puede asignar el mismo examen dos veces
  a la misma persona. Las asignaciones con empleado_id NULL (asignaciones
  genericas por DNI) no se ven afectadas.
- Se eliminan los duplicados existentes antes de crear el constraint,
  conservando la asignacion mas antigua (la primera creada).

### 3. Nuevas columnas en examen_asignaciones
- `fecha_asignacion` (timestamptz, default now()): fecha en la que se
  asigna el examen al empleado. Se rellena automaticamente al insertar.
- `fecha_aprobacion` (timestamptz, nullable): fecha en la que el empleado
  aprueba el examen (estado = 'completado').
- `tiempo_empleado_segundos` (integer, nullable): tiempo en segundos que
  el empleado tardo en resolver el examen.

### 4. RLS
- No se cambian politicas. Las columnas nuevas heredan las politicas
  existentes de la tabla (RLS ya activado). Las politicas de
  insert/update/select/delete ya cubren todas las columnas.

## Notas
- `created_at` ya existe y sigue siendo la fecha de creacion del registro.
  `fecha_asignacion` es equivalente en la practica pero se expone como
  columna propia para mostrarla en la UI sin ambiguedad.
- El frontend seguira enviando 'A'..'D' (mayusculas). El CHECK nuevo lo
  admite. No hay que cambiar el frontend por el CHECK.
- Para los duplicados existentes: se borran los mas recientes y se queda
  el mas antiguo, que es la primera asignacion intencionada.
*/

-- ── 1. Fix preguntas.respuesta_correcta CHECK (minusculas -> mayusculas) ──
ALTER TABLE public.preguntas DROP CONSTRAINT IF EXISTS preguntas_respuesta_correcta_check;
ALTER TABLE public.preguntas ADD CONSTRAINT preguntas_respuesta_correcta_check
  CHECK (respuesta_correcta IN ('A','B','C','D'));

-- ── 2. Eliminar duplicados existentes en examen_asignaciones ──
--     Conservar la asignacion mas antigua (MIN(created_at)) por cada par.
DELETE FROM public.examen_asignaciones a
USING public.examen_asignaciones b
WHERE a.empleado_id IS NOT NULL
  AND b.empleado_id IS NOT NULL
  AND a.examen_id = b.examen_id
  AND a.empleado_id = b.empleado_id
  AND a.id <> b.id
  AND a.created_at > b.created_at;

-- ── 3. UNIQUE parcial (examen_id, empleado_id) donde empleado_id no es NULL ──
CREATE UNIQUE INDEX IF NOT EXISTS examen_asignaciones_examen_empleado_uniq
  ON public.examen_asignaciones (examen_id, empleado_id)
  WHERE empleado_id IS NOT NULL;

-- ── 4. Nuevas columnas de fechas y tiempo ──
ALTER TABLE public.examen_asignaciones
  ADD COLUMN IF NOT EXISTS fecha_asignacion timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS fecha_aprobacion timestamptz,
  ADD COLUMN IF NOT EXISTS tiempo_empleado_segundos integer;

-- Backfill fecha_asignacion para registros existentes (usa created_at si existe)
UPDATE public.examen_asignaciones
SET fecha_asignacion = COALESCE(fecha_asignacion, created_at)
WHERE fecha_asignacion IS NULL;
