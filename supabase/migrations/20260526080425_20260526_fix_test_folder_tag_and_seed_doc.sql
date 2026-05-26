/*
  # Corregir carpeta de prueba y seed de documento PRL

  La carpeta "prueba" tenía el tag "Electricista" pero el empleado test
  tiene el tag "Electricidad". Se corrige la carpeta para usar el tag
  correcto y se añade la carpeta "Electricidad" bajo Apedeca con un
  documento de prueba para verificar que el flujo funciona.
*/

-- Actualizar la carpeta existente "prueba" para usar el tag "Electricidad"
UPDATE prl_folders
SET access_tag_id = '53d52084-895b-4fc6-a6ed-d0888670eddb',  -- Electricidad
    nombre = 'Electricidad'
WHERE id = 'dc776a95-2de6-476c-b51a-e55a11742a6e';

-- Insertar un documento de prueba en esa carpeta
INSERT INTO prl_documents (folder_id, nombre_archivo, wasabi_key, tipo, tamano_bytes, subido_por_nombre, society_id)
VALUES (
  'dc776a95-2de6-476c-b51a-e55a11742a6e',
  'Protocolo_Seguridad_Electrica.pdf',
  '',
  'application/pdf',
  0,
  'Sistema',
  '85e3c3bc-a789-4b12-986c-ca91b8653f03'
);
