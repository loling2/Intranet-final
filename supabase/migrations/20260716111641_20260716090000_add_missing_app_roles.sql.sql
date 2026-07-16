/*
# Add missing app roles

## Summary
The `app_roles` table was missing several roles that the frontend already supports:
`formacion`, `supervisor`, and `administracion`. Because `user_profiles.role` has
a foreign key to `app_roles.name`, assigning any of these roles silently failed,
and the user fell back to `employee` (dashboard view) instead of seeing their
panel (e.g. the Formacion panel).

## Changes
- Insert `formacion`, `supervisor`, and `administracion` into `app_roles`.
- Idempotent via `ON CONFLICT (name) DO NOTHING`.
*/

INSERT INTO app_roles (name, description) VALUES
  ('formacion', 'Access to the Formacion panel — manage exams and assignments'),
  ('supervisor', 'Supervisor role with limited HR panel access'),
  ('administracion', 'Access to the Administracion panel')
ON CONFLICT (name) DO NOTHING;
