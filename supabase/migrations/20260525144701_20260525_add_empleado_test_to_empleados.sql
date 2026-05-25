/*
  # Añadir empleado de prueba a la tabla empleados

  El usuario empleado@empresa.com existe en user_profiles pero no en la tabla
  empleados, por lo que no aparece en el panel de Prevencion para asignar tags.
  Se añade aquí vinculado a la sociedad Apedeca.
*/

INSERT INTO empleados (nombre, email, id_sociedad, puesto, activo)
SELECT 'Empleado Test', 'empleado@empresa.com', '85e3c3bc-a789-4b12-986c-ca91b8653f03', 'Empleado', true
WHERE NOT EXISTS (
  SELECT 1 FROM empleados WHERE email = 'empleado@empresa.com'
);
