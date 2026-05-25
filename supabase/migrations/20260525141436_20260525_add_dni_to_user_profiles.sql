/*
  # Añadir DNI/NIE a user_profiles

  1. Cambios
    - Añade columna `dni` (text, nullable) a user_profiles
    - Los empleados podrán tener su DNI/NIE registrado para filtrar nóminas

  2. Seguridad
    - No cambia RLS existente de user_profiles
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'dni'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN dni text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS user_profiles_dni_idx ON user_profiles (dni);
