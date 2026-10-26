/*
# Añadir autor_nombre a crm_notas_profesion

## Propósito
La tabla crm_notas_profesion necesitaba una columna autor_nombre para mostrar
quién escribió la nota sin necesidad de un JOIN a user_profiles (que puede no
tener un nombre legible para todos los roles).

## Cambios
- crm_notas_profesion: nueva columna autor_nombre (text, nullable, default '').
*/
ALTER TABLE crm_notas_profesion ADD COLUMN IF NOT EXISTS autor_nombre text DEFAULT '';
