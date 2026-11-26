/*
# Optimización del histórico de fichajes: índices para consultas por rango y prevalencia de correcciones aprobadas

## 1. Contexto

La pantalla de histórico de fichajes consultaba la tabla `fichajes` completa
(bucle paginado sin filtro de fecha) y filtraba fechas, trabajador, sociedad y
centro en el navegador. A partir de ahora el frontend consulta únicamente el
rango de fechas visible y deja el alcance por rol en manos de las políticas RLS
ya existentes (admin/rrhh ven todo; supervisor/coordinador solo sus asignados;
rrhh_gerontalia por sociedad).

## 2. Cambios

### Nuevos índices
- `idx_fichajes_fecha_empleado` en `fichajes (fecha, empleado_id)`: acelera las
  consultas por rango de fechas (`fecha >= desde AND fecha <= hasta`) cuando el
  cliente además filtra por trabajador.
- `idx_correcciones_aprobadas_empleado_fecha` en
  `fichajes_correcciones (empleado_id, fecha)` parcial (`WHERE estado = 'aprobada'`):
  acelera la carga de correcciones aprobadas usadas para resolver la hora
  efectiva (la hora corregida aprobada prevalece sobre la original).

### Sin cambios de esquema ni de políticas
- No se crean tablas ni vistas nuevas; no se modifica RLS.
- No se crean RPC nuevas: los totales de semana/mes/año de las tarjetas se
  calculan con una consulta acotada al trabajador seleccionado y al año en
  curso, que con estos índices ya es eficiente.

## 3. Seguridad
- Los índices no alteran privilegios ni visibilidad de datos.
*/

CREATE INDEX IF NOT EXISTS idx_fichajes_fecha_empleado
  ON public.fichajes (fecha, empleado_id);

CREATE INDEX IF NOT EXISTS idx_correcciones_aprobadas_empleado_fecha
  ON public.fichajes_correcciones (empleado_id, fecha)
  WHERE estado = 'aprobada';
