/*
# Add employee visibility control to Moodle courses

1. Modified Tables
- `moodle_cursos`
- Adds `visible_empleado`, a boolean that controls whether an assigned course appears in the employee course area.
- Existing and newly created courses start hidden until a staff member activates visibility.

2. Security
- No new tables, policies, or grants are introduced.
- Existing access rules for `moodle_cursos` remain unchanged; this field only controls the employee-facing course list.

3. Important Notes
- Course assignments are preserved when visibility is turned off.
- Making a course visible or hidden does not delete course content, progress, or assignments.
*/

ALTER TABLE public.moodle_cursos
  ADD COLUMN IF NOT EXISTS visible_empleado boolean NOT NULL DEFAULT false;