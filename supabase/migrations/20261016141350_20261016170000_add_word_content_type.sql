/*
# Add Word course content type

1. Changes
- Extends `moodle_contenido.tipo` so course administrators can upload Word documents.
- Existing content types and rows remain unchanged.

2. Security
- Keeps the existing RLS policies on `moodle_contenido` unchanged.

3. Notes
- Word files are stored and downloaded through the existing Moodle file storage flow.
*/

ALTER TABLE public.moodle_contenido DROP CONSTRAINT IF EXISTS moodle_contenido_tipo_check;
ALTER TABLE public.moodle_contenido
  ADD CONSTRAINT moodle_contenido_tipo_check
  CHECK (tipo IN ('texto','pdf','word','powerpoint','video','diapositivas','enlace'));