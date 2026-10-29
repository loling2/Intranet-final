/*
# Crear perfil Coordinador copiando los permisos del Supervisor

## Resumen
Añade un perfil de acceso llamado "Coordinador" en Ajustes > Permisos de Perfiles.
Sus pestañas activas y desactivadas son una copia de las del perfil Supervisor en el
momento de aplicar esta migración. A partir de ahí se pueden activar o desactivar
pestañas del Coordinador sin afectar al Supervisor.

## Cambios
1. custom_profiles: nueva fila id 'coordinador', etiqueta 'Coordinador', color teal.
2. role_tab_permissions: copia de todas las filas del rol 'supervisor' para 'coordinador'.

## Seguridad
- Sin cambios de RLS ni de permisos: la tabla ya restringe escritura a administradores.
- Idempotente: ON CONFLICT evita duplicados si se vuelve a aplicar.
*/

INSERT INTO custom_profiles (id, label, color)
VALUES ('coordinador', 'Coordinador', '#0F766E')
ON CONFLICT (id) DO NOTHING;

INSERT INTO role_tab_permissions (role, tab_id, enabled)
SELECT 'coordinador', tab_id, enabled
FROM role_tab_permissions
WHERE role = 'supervisor'
ON CONFLICT (role, tab_id) DO NOTHING;
