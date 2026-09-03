
-- Drop the old 6-param overload that only checks today's fichajes (broken for night shifts)
-- The 7-param version (with p_device_key) correctly looks at the last event across all dates
-- within a 16-hour window, handling night shifts properly.
DROP FUNCTION IF EXISTS public.kiosk_register_fichaje(text, double precision, double precision, text, text, text);
