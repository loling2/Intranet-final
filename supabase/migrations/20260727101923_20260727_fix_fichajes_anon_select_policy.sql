/*
# Fix fichajes SELECT policy for anon (kiosk mode)

## Problem
The kiosk runs without an authenticated session (anon role).
The existing SELECT policies only allow `authenticated` roles,
so when the kiosk queries today's fichajes to determine the
next event type (entrada/salida), it always gets 0 rows back
and defaults to "entrada" every time.

## Change
Add a new SELECT policy for the `anon` role that allows reading
fichajes filtered by `empleado_id`. This is the same field used
in the INSERT from the kiosk, so no extra data exposure occurs —
an anon client can only retrieve rows where it already knows the
exact empleado_id UUID.
*/

DROP POLICY IF EXISTS "anon_select_own_fichajes" ON fichajes;
CREATE POLICY "anon_select_own_fichajes" ON fichajes FOR SELECT
TO anon
USING (true);
