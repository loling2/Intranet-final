/*
# Allow Supervisor to read dispositivos (SELECT only)

1. Security changes
- Adds a SELECT policy on `dispositivos` for users whose `user_profiles.role = 'supervisor'`.
- Supervisors can VIEW devices but cannot INSERT, UPDATE, or DELETE — those remain restricted to admin/rrhh by existing policies.
- The DELETE policy ("Admin can delete dispositivos") already restricts deletion to admin/rrhh only, so no change is needed there.

2. Notes
- This is an additive policy: it does not modify or drop any existing policies.
- The frontend will additionally hide the create/edit/delete buttons for supervisors.
*/

DROP POLICY IF EXISTS "Supervisor can select dispositivos" ON dispositivos;

CREATE POLICY "Supervisor can select dispositivos"
ON dispositivos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.role = 'supervisor'
  )
);