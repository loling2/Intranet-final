/*
# Correct the Gerontalia PRL folder society

## Purpose
The folder named `GERONTALIA` and its three Tierra de Oro documents belong to Gerontalia workers, but the folder metadata currently points to Serca Gestion. This prevents the society-aware PRL filter from returning the documents to Gerontalia employees.

## Data change
- Moves only the existing `GERONTALIA` folder, currently linked to Serca Gestion and Tierra de Oro, to the Gerontalia society record.
- Keeps the folder, documents, center assignment, files, and position tags unchanged.

## Expected result
- Gerontalia workers at Tierra de Oro see only documents matching their position plus the two General documents.
- Serca Gestion workers no longer receive this Gerontalia folder through the society filter.

## Security
- No RLS policies are changed.
- Society and center filtering remains enforced by `get_my_prl_documents`.
*/

UPDATE public.prl_folders
SET society_id = '6632d8d1-c4e7-4540-aab7-515b9d7913f7'
WHERE id = '78daed68-983e-46d7-a2df-169311a9b85d'
  AND society_id = 'fdb5114a-c6b4-4b3a-8eb9-420bd188ad52'
  AND lower(trim(nombre)) = 'gerontalia';
