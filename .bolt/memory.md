# Project memory

## Product intent & audience

- Sistema de fichajes (control horario) y gestión de correcciones para **Gerontalia**.
- Usuarios internos con roles: `admin`, `rrhh`, `rrhh_gerontalia`, `supervisor`, `coordinador`.
- Supervisores y coordinadores aprueban/rechazan correcciones de fichajes de empleados asignados a ellos.
- Estructura multi-sociedad ("sociedades Gerontalia") que condiciona la lógica de permisos y acceso a datos.

## Brand personality & voice

- Comunicación interna en español, tono directo y profesional.
- Mensajes de UI claros sobre acciones (aprobar, rechazar, errores).

## Visual design & UX direction

- Frontend: Vite + React.
- Panel de peticiones de corrección accesible para supervisor y coordinador (no solo supervisor).
- Feedback visible en pantalla ante fallos de actualización (no fallar silenciosamente).
- Filtrado por empleados asignados según rol del usuario.

## Decisions, constraints & rationale

- Backend: Supabase con RLS (Row Level Security) mediante policies.
- Políticas UPDATE afectadas:
  - `fichajes_correcciones` (`update_own_or_admin_correcciones`): ampliada para permitir `supervisor` y `coordinador`.
  - `fichajes` (`admin_rrhh_update_fichajes`): ampliada para permitir `supervisor` y `coordinador`.
- La lógica de sociedades Gerontalia se preserva en todas las policies.
- Supervisores/coordinadores solo pueden actuar sobre empleados que tienen asignados.
- Migrations aplicadas vía archivos de migración; cambios verificados con build.

## Open questions & assumptions

- Se asume que la relación supervisor/coordinador → empleados está definida en una tabla o campo específico (no se ha confirmado el nombre exacto).
- No se ha documentado si `rrhh_gerontalia` tiene diferencias funcionales frente a `rrhh` más allá del alcance de sociedades.
- Pendiente: definir si se requieren tests automatizados para las policies de RLS.