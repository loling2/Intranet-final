/*
# Add custom certificate contents to Moodle courses

1. Modified Tables
- `moodle_cursos`
- Adds `certificado_contenidos`, optional text written by the training manager for the second certificate page.
- When this field is empty, the certificate generator uses the course modules instead.

2. Security
- No new tables, policies, or grants are introduced.
- Existing access rules for `moodle_cursos` remain unchanged.

3. Important Notes
- Existing courses keep an empty value and therefore continue using their modules as certificate topics.
- The text is stored with the course and is reused for every employee certificate for that course.
*/

ALTER TABLE public.moodle_cursos
  ADD COLUMN IF NOT EXISTS certificado_contenidos text;