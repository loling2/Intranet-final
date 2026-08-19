/*
# Restrict PISO ZEUS manual to TECNICO DE SISTEMAS

## Problem
The document "Manual_PISO_ZEUS.pdf" in the "PISO ZEUS - Documentos" folder had
no puesto_tags assigned. The `get_my_prl_documents()` function grants access to
any document without puesto tags to ALL employees who can see the folder. Since
the folder is scoped to centro "PISO ZEUS", every employee assigned to that
centro saw the document, regardless of their role.

## Fix
Assign the "TECNICO DE SISTEMAS" puesto tag to this document so only employees
whose `empleados.puesto` matches "TECNICO DE SISTEMAS" will receive it. The
`get_my_prl_documents()` function already enforces this: when a document has
puesto tags, the employee's puesto must match one of them.

## Tables affected
- `prl_document_puesto_tags` — one new row linking the PISO ZEUS manual to the
  "TECNICO DE SISTEMAS" puesto tag.

## Security
No RLS policy changes. No schema changes. This is a data-only fix that makes
the existing puesto-tag filter in `get_my_prl_documents()` actually take effect
for this document.
*/

DELETE FROM prl_document_puesto_tags
WHERE document_id = 'ad3aea73-f0b3-41eb-991a-618eaaeab2b1'
  AND puesto_tag_id = 'c7f1cced-622f-445f-ba21-c81b8ba07412';

INSERT INTO prl_document_puesto_tags (document_id, puesto_tag_id)
VALUES ('ad3aea73-f0b3-41eb-991a-618eaaeab2b1', 'c7f1cced-622f-445f-ba21-c81b8ba07412');
