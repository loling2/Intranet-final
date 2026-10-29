/*
# Rellenar centro en fichajes sin centro

1. Qué cambia
- Los fichajes con centro vacío (centro_id NULL) reciben el centro del último fichaje del mismo empleado que sí tenga centro.
- Si el empleado no tiene ningún fichaje con centro, se usa el centro actual que aparece en su ficha de empleado.

2. Tablas modificadas
- fichajes: solo se actualiza la columna centro_id de las filas que la tienen vacía. No se borran ni se modifican horas, tipos ni fechas.

3. Seguridad
- Sin cambios en RLS ni permisos.

4. Notas importantes
- La operación es idempotente: al volver a ejecutarla solo afecta a filas que sigan sin centro.
- Los fichajes ya rellenos no se tocan.
*/

UPDATE fichajes f
SET centro_id = COALESCE(
  (
    SELECT g.centro_id
    FROM fichajes g
    WHERE g.empleado_id = f.empleado_id
      AND g.centro_id IS NOT NULL
    ORDER BY g.timestamp DESC
    LIMIT 1
  ),
  (
    SELECT e.centro_id
    FROM empleados e
    WHERE e.id = f.empleado_id
  )
)
WHERE f.centro_id IS NULL;
