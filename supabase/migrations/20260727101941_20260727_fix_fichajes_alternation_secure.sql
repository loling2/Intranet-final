/*
# Fix fichajes alternation + secure kiosk lookup

## Problem
The kiosk runs as `anon` (no session). The existing SELECT policies
on `fichajes` only allow `authenticated`, so the kiosk's query for
today's prior fichajes always returns 0 rows → it defaults to
"entrada" every time, producing two consecutive entradas.

## Solution
1. Remove the overly-broad anon SELECT policy added in the previous
   migration (USING true exposed all fichajes to anyone with the anon key).
2. Create a SECURITY DEFINER function `kiosk_get_next_fichaje_tipo(p_pin)`
   that:
   a. Validates the PIN against `validate_vehicle_pin`.
   b. Looks up today's fichajes for that employee ordered by timestamp.
   c. Returns the next event type ('entrada' if last was 'salida' or none,
      'salida' if last was 'entrada') plus the employee name and id.
   This keeps all read logic server-side — the anon client never touches
   the fichajes table directly.

## Security
- Drops the permissive `anon_select_own_fichajes` policy.
- The new function is SECURITY DEFINER with a fixed search path, so it
  bypasses RLS only within its own scope and returns just the one value
  the kiosk needs.
*/

DROP POLICY IF EXISTS "anon_select_own_fichajes" ON fichajes;

CREATE OR REPLACE FUNCTION public.kiosk_get_next_fichaje_tipo(p_pin text)
RETURNS TABLE (
  empleado_id uuid,
  nombre_empleado text,
  tipo text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario record;
  v_today date := current_date;
  v_last_event text;
  v_next_tipo text;
BEGIN
  -- Validate PIN
  SELECT * FROM validate_vehicle_pin(p_pin) INTO v_usuario;
  IF v_usuario IS NULL THEN
    RETURN;
  END IF;

  -- Find the employee record
  SELECT e.id INTO v_usuario.empleado_id_var
  FROM empleados e
  WHERE e.user_id = v_usuario.id
  LIMIT 1;

  -- Look up today's last fichaje event for this employee
  SELECT f.tipo_evento INTO v_last_event
  FROM fichajes f
  WHERE f.nombre_empleado = v_usuario.nombre
    AND f.fecha = v_today
  ORDER BY f.timestamp DESC
  LIMIT 1;

  -- Alternate: if last was 'entrada' → 'salida', otherwise 'entrada'
  IF v_last_event = 'entrada' THEN
    v_next_tipo := 'salida';
  ELSE
    v_next_tipo := 'entrada';
  END IF;

  RETURN QUERY
  SELECT
    (SELECT e.id FROM empleados e WHERE e.user_id = v_usuario.id LIMIT 1),
    v_usuario.nombre,
    v_next_tipo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.kiosk_get_next_fichaje_tipo(text) TO anon, authenticated;
