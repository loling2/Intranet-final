/*
  # Corregir tag de carpeta "electricidad" en Eleda

  La carpeta "electricidad" de Eleda tenía asignado el tag "Electricista"
  en lugar de "Electricidad". El empleado test tiene el tag "Electricidad"
  por lo que no veía los documentos de Eleda.

  También se elimina el documento de prueba vacío (wasabi_key = '') 
  insertado previamente como seed de verificación.
*/

-- Corregir la carpeta de Eleda: cambiar de "Electricista" a "Electricidad"
UPDATE prl_folders
SET access_tag_id = '53d52084-895b-4fc6-a6ed-d0888670eddb'  -- Electricidad
WHERE id = 'fe477ef7-f35e-4e57-895d-a72820559cbf';

-- Eliminar el documento de prueba vacío (sin archivo real en Wasabi)
DELETE FROM prl_documents
WHERE id = '0f02ddd6-5c2d-406d-bbbb-17978f2ef740'
  AND wasabi_key = '';
