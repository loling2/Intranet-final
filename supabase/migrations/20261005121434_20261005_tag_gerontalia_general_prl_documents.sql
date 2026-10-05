/*
# Mark the two Gerontalia-wide PRL documents as General

## Purpose
The two documents shown in the Gerontalia folder as common documents were uploaded without a category tag. Without an explicit General tag, the corrected visibility rule cannot distinguish them from uncategorized position documents.

## Data changes
- Adds the existing `General` position tag to:
  - `Gerontalia Evaluación de riesgos laborales.pdf`
  - `Gerontalia Medidas de emergencia.pdf`
- Does not alter files, folders, employees, or existing position tags.
- Does not add the General tag to the unclassified documents in the Tierra de Oro folder.

## Security
- No RLS changes.
- Access remains restricted by the employee's society and center/folder access rules.
*/

INSERT INTO public.prl_document_puesto_tags (document_id, puesto_tag_id)
SELECT d.id, 'f5a1971e-7d6f-4571-8dfd-4dba59434711'::uuid
FROM public.prl_documents d
WHERE lower(d.nombre_archivo) IN (
  'gerontalia evaluación de riesgos laborales.pdf',
  'gerontalia medidas de emergencia.pdf'
)
ON CONFLICT DO NOTHING;
