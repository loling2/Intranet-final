# MANUAL DE OPERACIONES Y FUNCIONALIDADES

## Sistema de Gestión de RRHH, Prevención y Operaciones

**Versión:** 1.0  
**Fecha:** Agosto 2026  

---

## ÍNDICE

1. [Visión General del Sistema](#1-visión-general-del-sistema)
2. [Perfiles de Acceso](#2-perfiles-de-acceso)
3. [Autenticación y Sesión](#3-autenticación-y-sesión)
4. [Conmutador de Sociedad](#4-conmutador-de-sociedad)
5. [Manual del Perfil ADMINISTRADOR](#5-manual-del-perfil-administrador)
6. [Manual del Perfil RRHH](#6-manual-del-perfil-rrhh)
7. [Manual del Perfil PREVENCIÓN](#7-manual-del-perfil-prevención)
8. [Manual del Perfil EMPLEADO](#8-manual-del-perfil-empleado)
9. [Manual del Perfil SUPERVISOR](#9-manual-del-perfil-supervisor)
10. [Manual del Perfil ADMINISTRACIÓN](#10-manual-del-perfil-administración)
11. [Manual del Perfil CALIDAD](#11-manual-del-perfil-calidad)
12. [Manual del Perfil FORMACIÓN](#12-manual-del-perfil-formación)
13. [Kiosco de Fichaje](#13-kiosco-de-fichaje)
14. [Flujos entre Perfiles](#14-flujos-entre-perfiles)
15. [Base de Datos y Tablas](#15-base-de-datos-y-tablas)

---

## 1. VISIÓN GENERAL DEL SISTEMA

El sistema es una plataforma web de gestión integral que cubre Recursos Humanos, Prevención de Riesgos Laborales (PRL), gestión documental, control horario mediante kiosco/tablets, gestión de dispositivos, formación y calidad.

La aplicación funciona como una SPA (Single Page Application) construida con React + Vite. El acceso a la aplicación se realiza mediante autenticación con correo y contraseña a través de Supabase Auth. Cada usuario accede únicamente a los módulos asignados a su perfil.

El almacenamiento de archivos se realiza en Wasabi S3 (documentos, fotos, justificantes), mientras que los datos estructurados se almacenan en Supabase (PostgreSQL).

---

## 2. PERFILES DE ACCESO

El sistema distingue los siguientes perfiles, cada uno con acceso a módulos distintos:

| Perfil | Color identificador | Panel principal |
|---|---|---|
| **Admin** | Rojo (#DC2626) | AdminPanel (20 pestañas) |
| **RRHH** | Azul (#2563EB) | RRHHPanel (21 pestañas) |
| **Prevención** | Ámbar (#D97706) | PrevencionPanel (7 pestañas) |
| **Supervisor** | Púrpura (#7C3AED) | RRHHPanel (vista limitada) |
| **Administración** | Naranja (#C2410C) | AdministracionPanel (2 pestañas) |
| **Calidad** | Azul cielo (#0369A1) | CalidadPanel (3 pestañas) |
| **Formación** | Verde azulado (#0D9488) | FormacionPanel (3 pestañas) |
| **Empleado** | Verde (#16A34A) | Dashboard de autoservicio |

Los permisos de cada pestaña son configurables mediante la tabla `role_tab_permissions` desde el panel de Admin. Si existen filas para un perfil, solo se muestran las pestañas habilitadas. Si no existen filas, se muestran todas las pestañas por defecto.

---

## 3. AUTENTICACIÓN Y SESIÓN

### 3.1 Inicio de sesión

**Propósito:** Verificar las credenciales del usuario y dirigirlo a su panel correspondiente.

**Campos obligatorios:**
- Email (validado con expresión regular)
- Contraseña

**Flujo de trabajo:**
1. El usuario introduce email y contraseña.
2. Se envía una petición POST a la función `admin-login` (Edge Function de Supabase) con las credenciales.
3. La función verifica las credenciales contra `auth.users` y devuelve `access_token`, `refresh_token` y el `profile` del usuario (email, role, societies).
4. Se establece la sesión en Supabase con `supabase.auth.setSession()`.
5. Según el `role` del perfil, se redirige al panel correspondiente:
   - `admin` → AdminPanel
   - `rrhh` → RRHHPanel
   - `prevencion` → PrevencionPanel
   - `supervisor` → RRHHPanel (con flag `isSupervisor=true`)
   - `administracion` → AdministracionPanel
   - `calidad` → CalidadPanel
   - `formacion` → FormacionPanel
   - `employee` (o cualquier otro) → Dashboard de empleado

**Permisos de acceso:** Público (cualquier usuario con cuenta puede iniciar sesión).

### 3.2 Cierre de sesión automático

**Propósito:** Cerrar la sesión por inactividad.

**Lógica:** Existe un temporizador de 15 minutos que se reinicia con cualquier actividad del usuario (mousemove, mousedown, keydown, touchstart, scroll). Si no hay actividad en 15 minutos, se ejecuta el cierre de sesión automáticamente.

### 3.3 Recuperación de contraseña

**Propósito:** Permitir a un usuario restablecer su contraseña si la ha olvidado.

**Flujo de trabajo:**
1. El usuario pulsa "¿Olvidaste tu contraseña?" en la pantalla de login.
2. Introduce su email y se envía una petición POST a la función `password-reset` con `action: 'request'`.
3. El sistema envía un correo con un enlace que contiene un token de reseteo.
4. Al abrir el enlace, la aplicación detecta los parámetros `reset_token` y `email` en la URL y abre el modal de restablecimiento.
5. El usuario introduce la nueva contraseña (debe cumplir: mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo).
6. Se envía `action: 'reset'` con el token, email y nueva contraseña.

### 3.4 Cambio de contraseña desde el panel

**Propósito:** Permitir al usuario cambiar su contraseña activamente.

**Disponibilidad:** Todos los perfiles tienen un botón "Cambiar contraseña" en la cabecera de su panel.

**Campos obligatorios:**
- Contraseña actual
- Nueva contraseña (mín 8, 1 mayúscula, 1 minúscula, 1 número, 1 símbolo)
- Confirmar nueva contraseña

### 3.5 Cambio de PIN

**Propósito:** Permitir al empleado cambiar su PIN de fichaje en kiosco.

**Campos obligatorios:**
- PIN actual (4-6 dígitos)
- Nuevo PIN (4-6 dígitos)
- Confirmar nuevo PIN

---

## 4. CONMUTADOR DE SOCIEDAD

**Propósito:** Permitir al usuario cambiar entre las sociedades/empresas del grupo para ver y gestionar datos específicos de cada una.

**Flujo de trabajo:**
- El selector de sociedad está disponible en la cabecera de todos los paneles.
- La sociedad activa se guarda en `localStorage` bajo la clave `portal-active-society`.
- Al cambiar de sociedad, todos los módulos filtran sus datos según la sociedad seleccionada.
- Los nombres y colores de las sociedades se cargan desde la base de datos (`sociedades` y `ui_settings`), combinándose con la configuración estática del tema.

**Permisos de acceso:** Todos los perfiles autenticados.

---

## 5. MANUAL DEL PERfil ADMINISTRADOR

El panel de Administrador (AdminPanel) tiene **20 pestañas**. Es el perfil con acceso más amplio: puede ver y gestionar todo el sistema.

### 5.1 Panel General (Overview)

**Propósito:** Dashboard con KPIs globales, acceso rápido a sociedades y registro de actividad reciente.

**Elementos:**
- Tarjetas de KPIs (total empleados, vacaciones pendientes, exámenes aprobados, certificados por vencer, contratos pendientes).
- Acceso rápido a sociedades (clic en una sociedad navega al portal de empleado de esa sociedad).
- Registro de actividad reciente.

**Permisos de acceso:** Admin.

### 5.2 Empleados

**Propósito:** Directorio completo de empleados con CRUD completo.

**Campos obligatorios:**
- Nombre
- Sociedad (id_sociedad)

**Campos opcionales:**
- Apellidos, DNI, email, teléfono, fecha de nacimiento, NSS, sexo, convenio, dirección, código postal
- Sociedad secundaria (id_sociedad_secundaria)
- Tipo de contrato (10 códigos de contrato españoles), fecha de alta, fin de periodo de prueba, observaciones de contrato
- Turno (Mañana/Tarde/Noche/Partido/Flexible), puesto, centro de trabajo, titulación habilitante, fecha de pago de tasas
- Observaciones generales

**Campos con valor por defecto:**
- `activo`: true
- `estado_contrato`: pendiente
- `reconocimiento_medico`: pendiente
- `prl_ficha_puesto`, `prl_evaluacion_riesgos`, `prl_medidas_emergencia`, `prl_plan_prevencion`: false
- `vitaly_estado`: inactivo (gestionado por Prevención, solo lectura aquí)

**Flujo de trabajo al guardar:**
1. Se inserta/actualiza la tabla `empleados`.
2. Si `activo` cambia de true a false: se mueve la carpeta del empleado en Wasabi a la ruta "bajas".
3. Si `activo` cambia de false a true: se restaura la carpeta a la ruta "activo".
4. Si `reconocimiento_medico` se establece en "acepta": el empleado aparece automáticamente en la bandeja de Prevención → Reconocimiento Médico.
5. Si `vitaly_estado` cambia: es gestionado desde Prevención (aquí es solo lectura).

**Cambio de estado de contrato:**
- Al cambiar `estado_contrato` se abre un modal que exige una justificación textual obligatoria.
- Se actualiza `empleados.estado_contrato`.
- Se inserta en `historial_contrato`: empleado_id, estado_anterior, estado_nuevo, justificacion, cambiado_por, cambiado_por_nombre.

**Creación de acceso de usuario:**
- Solo disponible si el empleado no tiene `user_id` y tiene email.
- Llama a la función `manage-user` con `action: 'create_user'`.
- Se enlaza el `userId` devuelto a `empleados.user_id`.
- Se muestra una contraseña temporal en un toast de éxito.

**Importación CSV:**
- Dos modos: HR (actualiza empleados por DNI en tabla `empleados`) y Auth (crea usuarios en lote vía `manage-user` con `action: 'bulk_import'`).
- Checkbox "Actualizar registros existentes" controla si se sobrescriben registros existentes.
- El modo HR parsea "APELLIDOS, NOMBRE" → "NOMBRE APELLIDOS" y convierte fechas dd/mm/yyyy → yyyy-mm-dd.

**Permisos de acceso:** Admin, RRHH (supervisor ve la pestaña pero con rol limitado).

### 5.3 Gestión de Usuarios

**Propósito:** Gestionar las cuentas de acceso al sistema (usuarios con login).

**Crear usuario (Invitar):**
- Campos obligatorios: nombre, email (validado), role.
- Campo opcional: sociedades asignadas.
- Si el usuario actual es admin, puede asignar el rol admin; el resto no puede.
- Llama a `manage-user` con `action: 'create_user'`.
- Escribe en audit_logs: evento `user_invited`.

**Editar usuario:**
- Rol y estado (activo/inactivo) y sociedades: actualiza `user_profiles`.
- Email: llama a `manage-user` con `action: 'set_email'`. Audit: `email_changed`.
- Contraseña: llama a `manage-user` con `action: 'set_password'`. Audit: `password_set`.
- PIN (4-6 dígitos): llama a `manage-user` con `action: 'set_pin'`. Audit: `pin_set`.
- Asignación de empleados a supervisor: inserta/borra en `supervisor_asignaciones`.

**Creación en lote:**
- Selecciona empleados sin cuenta.
- Filtra los que tienen email (los que no, se omiten con aviso).
- Crea usuarios con el rol seleccionado (no admin).
- Muestra tabla de resultados (ok/error por empleado).

**Envío de email de acceso:**
- Selecciona plantilla (de `email_plantillas` donde activo=true) y cuenta SMTP (de `email_cuentas` donde activo=true).
- Opción de generar contraseña automática o introducir manualmente.
- Envía via función `send-email` con variables {nombre, email, password, url_acceso, empresa}.

**Permisos de acceso:** Admin, RRHH.

### 5.4 Sociedades

**Propósito:** Gestionar las sociedades/empresas del grupo y sus centros de trabajo.

**Acciones:**
- Ver tarjetas de sociedades con botón "Ver portal" (navega al portal de empleado de esa sociedad).
- CRUD de centros de trabajo (tabla `centros`), opcionalmente asignados a una sociedad.

**Permisos de acceso:** Admin.

### 5.5 Vehículos

**Propósito:** Gestionar la flota de vehículos.

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 5.6 Documentos

**Propósito:** Gestión general de documentos almacenados en Wasabi.

**Permisos de acceso:** Admin, RRHH.

### 5.7 Dispositivos

**Propósito:** Gestión de activos de TI (portátiles, monitores, móviles, tablets, etc.) asignados a empleados.

**Campos obligatorios:**
- Tipo (Portátil/Sobremesa/Monitor/Móvil/Tablet/Periférico/VoIP/Otro)
- Marca/modelo
- Sociedad

**Campos opcionales:**
- Etiquetado, valor estimado (€), número de teléfono (solo si tipo=Móvil), características, número de serie, centro de trabajo, notas
- Empleado asignado (se limpia si estado=Stock)
- Fecha de asignación

**Campos con valor por defecto:**
- Estado: Activo (1) / Inactivo (2) / Stock (3), por defecto Activo.

**Flujo de trabajo al guardar (nuevo dispositivo):**
1. Se inserta en `dispositivos`.
2. Si se asigna a un empleado: se inserta en `dispositivos_historial` (accion: 'asignado').
3. Si el empleado tiene `user_id`: se inserta en `employee_pending_docs` (tipo: 'entrega_dispositivo') → crea una tarea pendiente para el empleado de subir el acta de entrega firmada.

**Flujo al editar (dispositivo existente):**
1. Se actualiza `dispositivos`.
2. Se detectan transiciones:
   - Liberado: pasa a Stock, antes no estaba en Stock.
   - Asignado: nuevo empleado, antes no tenía.
   - Transferido: cambia de empleado.
3. Se inserta en `dispositivos_historial` la accion correspondiente.
4. Si se libera/desasigna/transfiere: se borra el `employee_pending_docs` pendiente.
5. Si se asigna/transfiere a empleado con `user_id`: se crea nuevo `employee_pending_docs`.

**Acta de Entrega:**
- Documento imprimible con logo de sociedad, datos del trabajador, tabla de dispositivos, cláusula de responsabilidad y líneas de firma.
- Se imprime via `window.print()`.

**Historial de dispositivo:**
- Lee `dispositivos_historial` y muestra línea temporal de asignado/liberado/transferido.

**Permisos de acceso:** Admin, RRHH.

### 5.8 Fichaje y Tablets (KioskDevicesPanel)

**Propósito:** Gestionar los dispositivos de fichaje (tablets de kiosco y móviles corporativos).

#### A. Tablets de Kiosco
**Campos obligatorios:** Nombre del sitio, device_key (auto-generado).  
**Campos opcionales:** Notas.  
**Acciones:** CRUD, activar/desactivar. Detección online: `last_seen_at` en últimos 15 min.

#### B. Móviles Corporativos
**Campos obligatorios:** Empleado, device_key (auto-generado), etiqueta del dispositivo.  
**Acciones:** CRUD, activar/desactivar.

#### C. Permisos por Empleado
**Propósito:** Configurar el modo de fichaje de cada empleado.  
**Modos:**
| Modo | Descripción |
|---|---|
| `kiosk_only` | Solo kiosco, sin GPS |
| `kiosk_or_corporate` | Kiosco sin GPS; móvil corporativo requiere GPS |
| `any` | Cualquier dispositivo; móvil requiere GPS |

Al cambiar: se actualiza `empleados.fichaje_mode`.

#### D. Solicitudes de Emparejamiento
**Propósito:** Gestionar peticiones de registro de dispositivos.  
**Flujo:**
1. El dispositivo genera un código de emparejamiento de 8 caracteres.
2. Se inserta en `device_pairing_requests`.
3. El admin proporciona un código de confirmación.
4. Se llama al RPC `complete_device_pairing` para finalizar el registro.

#### E. Telemetría
**Propósito:** Vista de solo lectura con resumen de actividad.  
**Muestra:** Total tablets, tablets online, total móviles, móviles activos, fichajes recientes, tablets sin uso.

**Permisos de acceso:** Admin, RRHH.

### 5.9 Vacaciones

**Propósito:** Gestión de solicitudes de vacaciones.

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 5.10 Prevención/Calidad (placeholder)

**Propósito:** Módulo en desarrollo. Muestra 4 KPIs en cero y lista de funcionalidades planificadas (Evaluación de Riesgos, Registro de Incidencias, Auditorías Internas, Planes de Acción, Indicadores PRL, Documentación ISO).

**Permisos de acceso:** Admin, RRHH.

### 5.11 Tags PRL

**Propósito:** Crear y eliminar etiquetas/tags de Prevención usadas para clasificar documentos PRL y asignarlos a empleados por riesgo/departamento.

**Campos obligatorios:** Nombre (único, case-insensitive).

**Al guardar:** Inserta en `tags`. Al eliminar: borra de `tags`.

**Permisos de acceso:** Admin.

### 5.12 Roles

**Propósito:** Crear y eliminar roles personalizados (etiquetas con color).

**Campos obligatorios:** Nombre (único), color (paleta de 10 predefinidos).  
**Campo opcional:** Descripción.

**Al guardar:** Inserta en `custom_roles`. Eliminación en dos pasos (confirmar).

**Permisos de acceso:** Admin.

### 5.13 Departamentos

**Propósito:** Gestionar departamentos internos.

**Permisos de acceso:** Admin, RRHH.

### 5.14 Email

**Propósito:** Gestión de plantillas y cuentas de correo SMTP.

**Permisos de acceso:** Admin, RRHH.

### 5.15 Auditoría

**Propósito:** Visor de solo lectura del registro de auditoría del sistema.

**Filtros:** Búsqueda por texto (descripción o autor), filtro por tipo de evento, toggle de sociedades (todas vs sociedad activa).

**Eventos registrados:** `user_invited`, `user_role_changed`, `user_activated`, `user_deactivated`, `password_reset`, `vehicle_checkin`, `vehicle_checkout`, `vehicle_forced_release`, `document_uploaded`, `document_deleted`, `contrato_uploaded`, `email_changed`, `password_set`, `pin_set`, `user_meta_changed`.

**Límite:** 200 registros por consulta, ordenados por fecha descendente.

**Permisos de acceso:** Admin, RRHH.

### 5.16 CSS (Apariencia)

**Propósito:** Personalizar la apariencia visual de la aplicación.

**Secciones:**

#### A. Imagen de fondo de login
- Subir imagen (PNG/JPG/WEBP, recomendado 1920x1080).
- Se sube a Supabase Storage bucket `ui-assets` en `login-bg/`.
- Se guarda la URL en `ui_settings` con key `login_background`.

#### B. Imagen de fondo de kiosco
- Subir imagen (opcional, se puede eliminar para volver a fondo negro).
- Se guarda en `ui_settings` con key `kiosk_background`.

#### C. URL de la aplicación
- URL usada en correos de recuperación de contraseña.
- Validación: debe empezar por `http` si no está vacía.

#### D. Logos de sociedad
- Subir logo por sociedad a Storage en `logos/{societyId}.{ext}`.
- Se guarda en `ui_settings` con key `society_logo_{id}` (con cache-busting `?t=timestamp`).

#### E. Colores de sociedad
- Modal con color primario, color de gradiente desde/hasta.
- Se guarda en `ui_settings` con key `society_color_{id}` como JSON.
- El color de gradiente "desde" se sincroniza automáticamente con el primario.

**Permisos de acceso:** Admin.

### 5.17 Incidencias

**Propósito:** Gestión de incidencias/reportes de problemas.

**Permisos de acceso:** Admin, RRHH.

### 5.18 Fichajes

**Propósito:** Control horario y gestión de fichajes de empleados.

**Permisos de acceso:** Admin, RRHH.

### 5.19 Permisos de Perfiles (RoleTabPermissionsManager)

**Propósito:** Matriz que controla qué pestañas puede ver cada perfil.

**Roles integrados:** rrhh, supervisor, prevencion, administracion, employee (con colores fijos).  
**Roles personalizados:** Ilimitados, creados desde este panel.

**Pestañas configurables (20):** overview, employees, personal-docs, vacations, certificates, exams, users, vehicles, documents, pdf-split, audit, contratos, prevencion, facturas, incidencias, fichajes, devices, kiosk-devices, bajas, prl-docs, supervisor-empleados.

**Al alternar un permiso:** Upsert en `role_tab_permissions` (role, tab_id, enabled). Actualización optimista en la UI.

**Crear perfil personalizado:**
- Campos obligatorios: etiqueta, índice de color.
- Genera un slug: `label_lowercase + timestamp`.
- Inserta en `custom_profiles`.

**Eliminar perfil personalizado:**
- Borra sus permisos en `role_tab_permissions`.
- Borra el perfil en `custom_profiles`.

**Nota:** Los cambios aplican al recargar la página. Los perfiles personalizados deben asignarse a usuarios desde Gestión de Usuarios.

**Permisos de acceso:** Admin.

### 5.20 Ayuda

**Propósito:** Manual de ayuda integrado con documentación por perfil.

**Funcionalidades:**
- Acordeones colapsables por perfil.
- Genera PDFs descargables del manual por perfil o de todos a la vez (jsPDF).
- El perfil desde el que se accede se resalta con badge "TU PERFIL".

**Permisos de acceso:** Todos los perfiles.

---

## 6. MANUAL DEL PERfil RRHH

El panel de RRHH tiene **21 pestañas**. La visibilidad de cada pestaña se controla mediante `role_tab_permissions`. El supervisor tiene una lista fija de pestañas permitidas.

### 6.1 Resumen RRHH (Overview)

**Propósito:** Dashboard con KPIs y elementos pendientes.

**KPIs:**
1. Total Empleados.
2. Vacaciones pendientes (count de status='pendiente').
3. Exámenes aprobados (count de status='completado').
4. Certificados por vencer (caducidad ≤ 90 días).
5. Contratos pendientes (count de estado_contrato IN ('pendiente','avisado')) — clickeable, navega a Contratos.

**Paneles:** Lista de vacaciones pendientes (con botones aprobar/rechazar), certificados por vencer, desglose por sociedad.

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 6.2 Empleados

*(Ver sección 5.2 — misma funcionalidad que el Admin)*

**Diferencia:** RRHH recibe `currentUserRole: 'rrhh'`. Supervisor ve la pestaña pero con rol limitado.

### 6.3 Contratos

**Propósito:** Trazabilidad de cambios de estado de contrato por empleado. Vista de auditoría con subida de contratos firmados.

**Campos:** No hay formulario de creación. Es un módulo de seguimiento.

**Acciones:**
- Clic en fila de empleado → expande para ver entradas de `historial_contrato`.
- Si `estado_contrato === 'firmado'` → aparece botón "Subir contrato".

**Subir contrato firmado:**
- Campo obligatorio: archivo (PDF/DOC/DOCX).
- Se sube a Wasabi en `publico/{timestamp}-Contrato-{DNI}.{ext}`.
- Se inserta en `documents` con folder: 'publico', vinculado al user_id/email/society_id del empleado.
- Se escribe en audit_log: evento `contrato_uploaded`.
- El documento es visible para el empleado (carpeta publico).

**KPIs:** Contadores de pendiente / avisado / firmado (filtros clickeables).

**Permisos de acceso:** Admin, RRHH.

### 6.4 Bajas/Ausencias

**Propósito:** Gestionar bajas temporales, ausencias y sus coberturas con sustitutos. Es el módulo más complejo, con 5 sub-vistas: Bajas, Finalizadas, Balance Sustitutos, Sustituciones, Horas Extras.

#### Formulario de Baja

**Campos obligatorios:**
- Empleado (empleado_id / empleado_nombre)
- Fecha de inicio
- Fecha de fin (obligatorio salvo que se marque "larga duración" → entonces es null)

**Campos opcionales:**
- Motivo
- Larga duración (boolean, por defecto false)
- Días no cubiertos (numérico, por defecto 0)
- Tipo de absentismo: IT / AT / PR / PNR / Reposo
- Duración de reposo (24h/48h/72h) — solo si tipo=Reposo
- Estado del justificante (pendiente/entregado) — solo si tipo=PNR
- URL del justificante (se establece automáticamente al subir el archivo)

**Al guardar (nueva baja):**
1. Se inserta en `bajas_temporales` con estado: 'activa', created_by.
2. Si hay sustituciones: se borran las anteriores (si es edición) y se insertan nuevas en `sustituciones` con `baja_id` enlazado.

#### Bloque de Sustitución (embebido en la baja)

**Campos obligatorios:**
- Sustituto (sustituto_id / sustituto_nombre) — selector de empleados
- Fecha de inicio (mínimo = fecha_inicio de la baja)
- Número de días o número de horas (según unidad)

**Campos opcionales:**
- Unidad (días/horas, por defecto días)
- Tipo de cobertura (pagar/compensar/otro)
- Turno (mañana/tarde/noche)
- Es festivo + unidad_festivo + num_dias_festivos/horas_festivas
- Es nocturno + horas_nocturnas
- Motivo otro (solo si tipo_cobertura='otro')
- Días a descontar
- Tiene justificante (boolean)
- Notas

**Lógica de cálculo de horas:**
- Si unidad='días': `num_horas = num_dias × HORAS_POR_TURNO[turno]` (8h por turno).
- Horas festivas: si unidad_festivo='horas' usa horas_festivas; si no, `num_dias × horasBase`.
- Horas nocturnas: solo se cuentan si `es_nocturno` es true.

#### Finalizar Baja

**Propósito:** Cerrar una baja activa.  
**Campos:**
- Modo de finalización: 'nomina' (Pagadas en nómina) / 'solicitud' (Días/horas solicitados) / 'otro'.
- Si 'otro': notas de finalización es obligatorio.

**Al finalizar:**
- Actualiza `bajas_temporales`: estado='finalizada', modo_finalizacion, notas_finalizacion.
- Finalizar resetea el contador de horas del sustituto a 0 para el balance (solo las bajas activas cuentan).

#### Balance de Sustitutos

**Propósito:** Agregar horas por sustituto a lo largo de bajas activas + sustituciones independientes.  
**Muestra:** Días, horas, horas nocturnas, días festivos, horas liquidadas, horas pendientes.  
**Liquidar:** Modal para registrar pago → inserta en `liquidaciones_horas` (horas_liquidadas, fecha, notas, created_by). No se pueden liquidar más horas de las pendientes.

#### PNR/Reposo (Descontar)

- Las bajas con tipo_absentismo=PNR o Reposo y `descontado=false` aparecen en sección roja "pendientes de descontar".
- "Descontar" requiere un texto descriptivo obligatorio.
- Actualiza `bajas_temporales`: descontado=true, descripcion_descuento.
- Las descontadas aparecen en sección verde con balance 0d.

**Exportación:** Excel (xlsx-js-style, multi-hoja: Resumen + por sustituto + Ausencias) y PDF (jsPDF, balance por sustituto).

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 6.5 Sustituciones

**Propósito:** Registro de sustituciones independientes (no vinculadas a una baja).

**Nueva sustitución:**
- Campos obligatorios: Sustituto (selector), número de horas (>0), fecha.
- Campos opcionales: motivo, días a descontar, tiene justificante.

**Al guardar:** Inserta en `sustituciones` con baja_id=null, unidad='horas', tipo_cobertura='pagar', created_by.

**Finalizar sustitución (modal unificado por fila):**
- Sección 1: "Pagar horas a sustituta" → inserta en `liquidaciones_horas`, marca `sustituciones.horas_liquidadas=true`.
- Sección 2: "Descontar días al sustituido" (si días>0) → requiere descripcion_descuento, marca `sustituciones.dias_descontados=true`.
- Botón "Finalizar" solo se habilita cuando ambas secciones están completas → marca `sustituciones.finalizado=true`, `finalizado_at`.

**KPIs:** Sustitutos únicos, H. a pagar, H. a compensar, Días a descontar.

**Permisos de acceso:** Admin, RRHH.

### 6.6 Horas Extras

**Propósito:** Registro de horas extraordinarias (sub-pestaña dentro de Bajas).

**Permisos de acceso:** Admin, RRHH.

### 6.7 Vacaciones

**Propósito:** Gestión de solicitudes de vacaciones.

**Estados:** pendiente → aprobada / rechazada.

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 6.8 Fichajes y Correcciones

**Propósito:** Control horario. La pestaña renderiza dos módulos apilados: Correcciones de Fichajes (cola de aprobación de correcciones solicitadas por empleados) y Fichajes (registros de entrada/salida por empleado con filtros).

**Permisos de acceso:** Admin, RRHH.

### 6.9 Incidencias

**Propósito:** Reporte y gestión de incidencias.

**Permisos de acceso:** Admin, RRHH.

### 6.10 Facturas

**Propósito:** Gestión de facturas. Desde RRHH se renderiza con `isAdmin={false}`.

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 6.11 Nominas (PDFSplitModule)

**Propósito:** Utilidad para dividir PDFs (típicamente nóminas multi-página) en documentos individuales por empleado.

**Permisos de acceso:** Admin, RRHH.

### 6.12 Documentos Personales

**Propósito:** Gestión de documentos personales de empleados.

**Permisos de acceso:** Admin, RRHH.

### 6.13 Vehículos

**Propósito:** Gestión de flota de vehículos.

**Permisos de acceso:** Admin, RRHH, Supervisor.

### 6.14 Documentos

**Propósito:** Gestión general de documentos.

**Permisos de acceso:** Admin, RRHH.

### 6.15 Dispositivos

*(Ver sección 5.7)*

### 6.16 Gestión de Usuarios

*(Ver sección 5.3)*

### 6.17 Auditoría

*(Ver sección 5.15)*

### 6.18 Departamentos

*(Ver sección 5.13)*

### 6.19 Email

*(Ver sección 5.14)*

### 6.20 Empleados Asignados (SupervisorEmpleados)

**Propósito:** Vista de solo lectura para supervisores de sus empleados asignados.

**Acciones:** Búsqueda por nombre, DNI, puesto, centro. Tarjetas expandibles con detalle (email, teléfono, puesto, centro, localidad, DNI, observaciones).

**Permisos de acceso:** Solo Supervisor.

### 6.21 Ayuda

*(Ver sección 5.20)*

---

## 7. MANUAL DEL PERfil PREVENCIÓN

El panel de Prevención (PrevencionPanel) tiene **7 pestañas**. Usa tema verde (#065F46). Incluye conmutador de sociedad.

### 7.1 Empleados y Tags

**Propósito:** Gestionar asignaciones de tags de PRL por empleado y subir documentos a carpetas individuales de Prevención.

**Acciones:**

**Asignación de tags:**
- Búsqueda por nombre/email/puesto, filtro por sociedad.
- Panel expandible por empleado con tags asignados + multi-select para asignar nuevos.
- Al asignar: inserta en `etiquetado` (entidad_id = empleado, tag_id = tag seleccionado).
- Al desasignar: borra de `etiquetado`.

**Subida de documentos:**
- Botón de subida (solo PDF/imágenes).
- Se sube a Wasabi en `empleados/{user_id}/prevencion/{timestamp}-{filename}`.
- Se inserta en `employee_documents` con folder='prevencion', subido_por_nombre='Prevencion'.
- Botón "Ver carpeta Prevención" abre modal con todos los documentos donde folder='prevencion' de ese empleado.

**Categorías de tags (color-coded):** Oficina, Electricista, Obras/Construcción, Almacén/Logística, Conducción, Trabajo en Altura, Espacios Confinados, Manipulación de Cargas, Exposición a Químicos, Pantallas de Visualización.

**Permisos de acceso:** Prevención.

### 7.2 Documentos PRL

**Propósito:** Gestión documental PRL basada en carpetas con control de acceso por tags y departamentos.

#### Crear/Editar Carpeta

**Campos obligatorios:** Nombre.  
**Campos opcionales:** Descripción, Tags de acceso (máx 5, "Sin restricción" = abierto a todos), Departamentos PRL (máx 5).

**Al guardar carpeta:**
- Inserta/actualiza en `prl_folders` (con society_id, created_by).
- Sincroniza `prl_folder_tags` (borrar + reinsertar).
- Sincroniza `prl_folder_departamentos` (borrar + reinsertar).

#### Subir documento a carpeta

**Flujo:**
1. Se sube a Wasabi en `prevencion/{society_id}/{folder_id}/{timestamp}-{filename}`.
2. Se inserta en `prl_documents` (folder_id, nombre_archivo, wasabi_key, tipo, tamano_bytes, subido_por, subido_por_nombre, society_id).
3. **Automatización — Notificaciones:** Se consultan todos los empleados activos (`activo=true`, `user_id NOT NULL`) de la sociedad y se inserta en `notificaciones_empleado` filas con tipo='prl', titulo='Nuevo documento PRL', descripcion referenciando la carpeta, leida=false. → Esto envía una notificación a la bandeja de entrada de todos los empleados activos de esa sociedad.

#### Vista previa y descarga
- Vista previa (Eye): solo para roles admin o prevención.
- Descarga: disponible para todos.
- Eliminación: via modal de confirmación.

**Permisos de acceso:** Prevención (CRUD completo). Admin y Prevención pueden previsualizar.

### 7.3 Trazabilidad

**Propósito:** Rastrear qué empleados han descargado cada documento PRL, con estadísticas agregadas. Tiene 2 sub-pestañas.

#### Sub-pestaña "Trazabilidad"
- Panel izquierdo: lista de documentos agrupados por sociedad (de `prl_folders` + `prl_documents`).
- Panel derecho: al seleccionar un documento, llama al RPC `get_prl_document_trazabilidad({ p_document_id })` → devuelve lista de empleados con flag `downloaded` (boolean) y `downloaded_at`.
- Vista dividida: Descargados (verde) vs Pendientes (naranja), con contadores.

#### Sub-pestaña "Estadísticas"
- Llama al RPC `get_prl_trazabilidad_stats` con opcional `p_society_id`, `p_centro`.
- Devuelve por empleado: total_asignados, total_descargados, total_pendientes, docs_pendientes[].
- **KPIs globales:** Empleados, Asignados, Descargados, Pendientes, % cumplimiento.
- **Gráficos:** Donut (SVG, % cumplimiento), Barras (descargados vs pendientes).
- **Filtros:** Sociedad, Centro (cascada desde `centros`), búsqueda de empleado.
- **Exportación:** Excel (2 hojas: Resumen + Pendientes detalle) y PDF (jsPDF, apaisado, con gráfico de tarta dibujado).
- Filas expandibles muestran documentos pendientes por empleado con tiempo transcurrido.

**Permisos de acceso:** Prevención.

### 7.4 Departamentos PRL

**Propósito:** Agrupar empleados en departamentos PRL para filtrar el acceso a carpetas.

**Crear/Editar departamento:**
- Campos obligatorios: Nombre, Sociedad.
- Campo opcional: Descripción.
- Al guardar: inserta/actualiza en `departamentos_prl`.
- Eliminar: propaga el borrado a las vinculaciones de empleados.

**Asignación de empleados:**
- Modal con búsqueda (nombre/email/DNI), multi-select.
- Inserta en `empleados_departamentos_prl` (empleado_id, departamento_prl_id).
- Eliminar: borra de `empleados_departamentos_prl`.

**Permisos de acceso:** Prevención.

### 7.5 Reconocimiento Médico

**Propósito:** Gestionar el estado de reconocimientos médicos de empleados que lo han aceptado.

**Origen de datos:** Carga empleados donde `reconocimiento_medico = 'acepta'` (flag establecido por RRHH desde el módulo de Empleados).

**Estados:** `pendiente` (null/por defecto) → `en_proceso` → `finalizado`.

**Formulario de edición:**
- **Estado** (obligatorio): en_proceso | finalizado.
- **Fecha de cita** (opcional, input de fecha).
- **Anotación** (opcional, textarea).

**Al guardar:**
1. Actualiza `empleados.reconocimiento_medico_estado` = nuevo estado.
2. Si `finalizado`: también establece `empleados.reconocimiento_medico_fecha` = ahora (ISO).
3. Inserta en `reconocimiento_medico_historial`: empleado_id, estado_anterior, estado_nuevo, anotacion, fecha_cita, created_by_email (email del usuario de prevención).

**Vista de historial:**
- Expandible por empleado. Línea temporal con todas las transiciones de estado.
- Muestra: transición (anterior → nuevo), fecha/hora, anotación (o "Sin anotacion" si está vacía), fecha de cita, autor.

**Flujo entre perfiles:**
1. RRHH marca `reconocimiento_medico = 'acepta'` en el módulo de Empleados.
2. El empleado aparece automáticamente en la bandeja de Prevención → Reconocimiento Médico.
3. Prevención gestiona el ciclo de vida (pendiente → en_proceso → finalizado) y registra el historial.

**Permisos de acceso:** Prevención.

### 7.6 Vitaly

**Propósito:** Gestionar el estado de onboarding Vitaly por empleado.

**Origen de datos:** Carga empleados donde `vitaly_estado IN ('inactivo', 'pendiente')`. Los empleados activos desaparecen de la lista.

**Estados:** `inactivo` → `pendiente` → `activo`.

**Formulario de edición:**
- **Estado** (obligatorio): inactivo | pendiente | activo.
- **Motivo** (condicionalmente obligatorio — requerido cuando estado=pendiente; textarea).

**Al guardar:**
- Actualiza `empleados.vitaly_estado` y `empleados.vitaly_motivo`.
- Si `pendiente`: guarda motivo (trimado o null).
- Si `activo` o `inactivo`: establece `vitaly_motivo = null`.
- Si `activo`: elimina la fila de la lista local (el empleado "se gradúa").

**Permisos de acceso:** Prevención.

### 7.7 Ayuda

*(Ver sección 5.20)*

---

## 8. MANUAL DEL PERfil EMPLEADO

El Dashboard de empleado es el portal de autoservicio. Incluye las siguientes tarjetas/secciones:

### 8.1 Documentos

**Propósito:** Ver y descargar documentos asignados al empleado.

**Permisos de acceso:** Empleado (y admin/rrhh/supervisor pueden navegar aquí).

### 8.2 Documentos Personales

**Propósito:** Gestión de documentos personales del empleado (subida, descarga).

### 8.3 Documentos de Prevención (PrevencionDocsCard)

**Propósito:** Ver documentos PRL asignados al empleado según sus tags y departamentos.

**Flujo:**
- Llama al RPC `get_my_prl_documents` → devuelve documentos que el empleado puede ver (filtrados por sus tags/departamentos en el servidor).
- Agrupa por sociedad, muestra los 3 documentos más recientes por sociedad, expandible.
- Vista previa (PDF/imagen) + descarga.
- Aviso: "Tus tags de prevención determinan los documentos que recibes".

### 8.4 Documentos de Calidad (CalidadDocsCard)

**Propósito:** Ver documentos de calidad/gestión (ISO, procedimientos, manuales).

**Flujo:**
- Lee `calidad_documentos` (todas las filas, filtra en cliente).
- Dos secciones: General (es_general=true, todas las sociedades) y por Sociedad (sociedad_ids contiene la sociedad del usuario).
- Filtros por año/mes. Vista previa (PDF/imagen via blob URL) + descarga.
- Modo mini: muestra los 3 documentos más recientes en tarjeta compacta.
- Sin capacidad de subida/escritura — puramente visualizador.

### 8.5 Dispositivos

**Propósito:** Ver los dispositivos asignados al empleado y gestionar entregas pendientes.

**Tareas pendientes:** Si hay entradas en `employee_pending_docs` (tipo='entrega_dispositivo'), el empleado debe subir el acta de entrega firmada.

### 8.6 Vehículos

**Propósito:** Ver y gestionar el vehículo asignado al empleado.

### 8.7 Certificaciones

**Propósito:** Seguimiento de certificados del empleado (control de caducidad).

### 8.8 Exámenes

**Propósito:** Realizar exámenes de formación asignados.

**Estados:** pendiente → completado / suspendido.  
**Lógica:** Puntuación ≥60% → verde (aprobado), <60% → rodo (suspendido).

### 8.9 Mis Fichajes

**Propósito:** Ver el historial de fichajes propios del empleado.

### 8.10 Vacaciones

**Propósito:** Solicitar y consultar el estado de las vacaciones propias.

### 8.11 Incidencias

**Propósito:** Reportar incidencias.

### 8.12 Cambiar Contraseña / Cambiar PIN

**Propósito:** Autogestión de credenciales.

---

## 9. MANUAL DEL PERfil SUPERVISOR

El supervisor reutiliza el `RRHHPanel` con `isSupervisor=true`. Tiene una lista fija de pestañas permitidas:

| Pestaña | Acceso |
|---|---|
| Overview | ✅ |
| Empleados | ✅ (vista) |
| Vehículos | ✅ |
| Vacaciones | ✅ |
| Certificaciones | ✅ |
| Exámenes | ✅ |
| Facturas | ✅ |
| Bajas/Ausencias | ✅ |
| Empleados Asignados | ✅ (exclusivo supervisor) |
| Ayuda | ✅ |

El resto de pestañas (Contratos, Fichajes, Incidencias, Dispositivos, Prevención, Usuarios, Documentos, Nominas, Auditoría) **no son visibles** para el supervisor.

**Empleados Asignados:** El supervisor solo ve los empleados que le han sido asignados desde Gestión de Usuarios (tabla `supervisor_asignaciones`). Vista de solo lectura con búsqueda y tarjetas expandibles.

---

## 10. MANUAL DEL PERfil ADMINISTRACIÓN

El panel de Administración tiene **2 pestañas**. Es un perfil enfocado en tareas administrativas/billing.

### 10.1 Facturas

**Propósito:** Gestión de facturas con permisos de admin.  
**Renderiza:** `<FacturasModule isAdmin={true} />`

### 10.2 Ayuda

*(Ver sección 5.20)*

---

## 11. MANUAL DEL PERfil CALIDAD

El panel de Calidad tiene **3 pestañas**.

### 11.1 Documentos

**Propósito:** Listar, previsualizar, descargar y eliminar documentos de calidad/gestión.

**Filtros:** Todos / General / Por sociedad. Búsqueda.  
**Acciones:** Vista previa (PDF/imagen via iframe), descarga, eliminar (con confirmación → borra de Wasabi + `calidad_documentos`).

### 11.2 Subir

**Propósito:** Subir documentos de calidad a Wasabi.

**Campos obligatorios:**
- Modo de subida: general o por sociedad.
- Al menos 1 archivo.
- Año (lista: 2024-2027).
- Mes (01-12).
- Si modo=sociedad: al menos 1 sociedad seleccionada.

**Al guardar:**
1. Obtiene el usuario actual via `supabase.auth.getUser()` → subido_por (id), subido_por_nombre (email).
2. Por cada archivo:
   - Construye clave Wasabi: `calidad/{year}/{month}/{filename}`.
   - Sube a Wasabi.
   - Inserta en `calidad_documentos`: nombre_archivo, wasabi_key, tipo, tamano_bytes, es_general, sociedad_ids, anio, mes, subido_por, subido_por_nombre.

### 11.3 Ayuda

*(Ver sección 5.20)*

---

## 12. MANUAL DEL PERfil FORMACIÓN

El panel de Formación tiene **3 pestañas**.

### 12.1 Exámenes

**Propósito:** Crear, editar y eliminar exámenes de formación con preguntas de opción múltiple.

#### Editor de Examen

**Campos obligatorios:** Nombre.  
**Campos opcionales:** Descripción, duración minutos (min 1, por defecto 30), validez meses (min 1, por defecto 12), ratio de penalización (min 0, por defecto 3).

**Al guardar:** Inserta/actualiza en `examenes`.

#### Editor de Preguntas

**Campos obligatorios:** Texto de la pregunta, las 4 opciones (A/B/C/D).  
**Campo con valor por defecto:** Respuesta correcta (por defecto A).  
**Campo automático:** Orden (auto-incremental según número de preguntas).

**Al guardar:** Inserta/actualiza en `preguntas` con examen_id y orden.

#### Asignar Examen

**Campo obligatorio:** Al menos 1 empleado seleccionado (solo empleados activos).  
**Al guardar:** Inserta en `examen_asignaciones` con estado='pendiente', nombre_empleado, dni.

#### Estados de asignación
| Estado | Color | Descripción |
|---|---|---|
| `pendiente` | Naranja | Sin realizar |
| `completado` | Verde | Aprobado (≥60%) |
| `suspendido` | Rojo | No aprobado (<60%) |

**Eliminaciones:** Examen (cascada a preguntas/asignaciones), Pregunta, Asignación — todas con confirmación.

### 12.2 Asignaciones Globales

**Propósito:** Vista global de todas las asignaciones de exámenes con enriquecimiento de nombre de examen via join en memoria con caché de `examenes`.

### 12.3 Ayuda

*(Ver sección 5.20)*

---

## 13. KIOSCO DE FICHAJE

**Propósito:** Terminal de fichaje para empleados mediante PIN numérico. No requiere login.

**Acceso:** Navegando a `#kiosco` en la URL. Es accesible desde la pantalla de login ("REGISTRO DE JORNADA") y desde el botón "Modo Kiosco" en el panel de Admin.

### Flujo de fichaje:

1. El empleado introduce su PIN numérico.
2. Se valida via RPC `validate_vehicle_pin({ p_pin })`.
3. Se comprueba la autorización del dispositivo via RPC `kiosk_check_device_by_profile({ p_device_key, p_user_profile_id })`.
4. Devuelve `authorized` (bool) y `mode` ('kiosk_only' | 'kiosk_or_corporate' | 'any').
5. Si no autorizado: las acciones de fichaje (entrada/descanso/fin_descanso/salida/permiso) se ocultan; las acciones de vehículo e incidencia permanecen disponibles.
6. El fichaje se registra via RPC `web_register_fichaje` que valida en servidor:
   - `DEVICE_NOT_AUTHORIZED` si el dispositivo no está autorizado.
   - `LOCATION_REQUIRED` si se requiere GPS.
   - `PIN_INCORRECTO` si el PIN no coincide.

### Emparejamiento de dispositivos:

1. El dispositivo genera un código de emparejamiento de 8 caracteres.
2. Se inserta en `device_pairing_requests`.
3. El admin proporciona un código de confirmación.
4. Se llama al RPC `complete_device_pairing` para finalizar el registro.

### Tipos de acciones de fichaje:
| Acción | Descripción |
|---|---|
| Entrada | Inicio de jornada |
| Descanso | Pausa para descanso |
| Fin descanso | Retorno del descanso |
| Salida | Fin de jornada |
| Permiso | Salida con permiso |

### Cierre automático:
El sistema cierra automáticamente fichajes sin salida al final del día (configurable por hora).

---

## 14. FLUJOS ENTRE PERFILES

### 14.1 Flujo de Reconocimiento Médico (RRHH → Prevención)

```
RRHH (Empleados)
  └─ Marca reconocimiento_medico = 'acepta'
     └─ Base de datos: empleados.reconocimiento_medico = 'acepta'
        └─ Prevención (Reconocimiento Médico)
           ├─ Ve al empleado en su bandeja (filtro: reconocimiento_medico='acepta')
           ├─ Cambia estado: pendiente → en_proceso → finalizado
           ├─ Opcionalmente registra fecha de cita y anotación
           └─ Cada cambio se registra en reconocimiento_medico_historial
              con estado_anterior, estado_nuevo, anotacion, fecha_cita, created_by_email
```

### 14.2 Flujo de Vitaly (Prevención)

```
Nuevo empleado (RRHH)
  └─ vitaly_estado = 'inactivo' (por defecto)
     └─ Prevención (Vitaly)
        ├─ Cambia a 'pendiente' (motivo obligatorio)
        ├─ Cambia a 'activo' (motivo se borra, empleado desaparece de la lista)
        └─ RRHH ve vitaly_estado como solo lectura en Empleados
```

### 14.3 Flujo de Documentos PRL (Prevención → Empleado)

```
Prevención (Documentos PRL)
  └─ Sube documento a carpeta PRL
     ├─ Se sube a Wasabi: prevencion/{society_id}/{folder_id}/{timestamp}-{filename}
     ├─ Se inserta en prl_documents
     └─ Automáticamente: se insertan notificaciones en notificaciones_empleado
        para todos los empleados activos de esa sociedad
        (tipo='prl', titulo='Nuevo documento PRL', leida=false)
           └─ Empleado (Documentos de Prevención)
              ├─ Ve la notificación en su bandeja
              ├─ RPC get_my_prl_documents filtra según sus tags/departamentos
              └─ Al descargar: se registra en prl_download_logs
                 └─ Prevención (Trazabilidad)
                    ├─ Ve quién ha descargado y quién no
                    └─ Estadísticas de cumplimiento
```

### 14.4 Flujo de Dispositivos (RRHH/Admin → Empleado)

```
RRHH/Admin (Dispositivos)
  └─ Asigna dispositivo a empleado
     ├─ Inserta en dispositivos
     ├─ Inserta en dispositivos_historial (accion='asignado')
     └─ Si empleado tiene user_id:
        inserta en employee_pending_docs (tipo='entrega_dispositivo')
           └─ Empleado (Dispositivos)
              ├─ Ve tarea pendiente de subir acta de entrega firmada
              └─ Sube el documento firmado
```

### 14.5 Flujo de Contratos (RRHH)

```
RRHH (Empleados)
  └─ Cambia estado_contrato (pendiente → avisado → firmado)
     ├─ Modal exige justificación textual obligatoria
     ├─ Actualiza empleados.estado_contrato
     └─ Inserta en historial_contrato (estado_anterior, estado_nuevo, justificacion)
        └─ RRHH (Contratos)
           ├─ Ve historial de cambios por empleado
           └─ Si estado=firmado: puede subir contrato firmado
              ├─ Se sube a Wasabi: publico/{timestamp}-Contrato-{DNI}.{ext}
              ├─ Se inserta en documents (folder='publico')
              ├─ Se escribe en audit_log (evento='contrato_uploaded')
              └─ El documento es visible para el empleado
```

### 14.6 Flujo de Bajas y Sustituciones (RRHH)

```
RRHH (Bajas/Ausencias)
  └─ Crea baja temporal
     ├─ Inserta en bajas_temporales (estado='activa')
     ├─ Crea sustituciones vinculadas (baja_id)
     │  └─ Calcula horas automáticamente: num_dias × 8h por turno
     └─ Balance de sustitutos: agrega horas por sustituto
        └─ Liquidar horas: inserta en liquidaciones_horas
           └─ Marca sustituciones.horas_liquidadas=true
  └─ Finalizar baja:
     ├─ estado='finalizada', modo_finalizacion, notas
     └─ Resetea contador de horas del sustituto a 0
  └─ PNR/Reposo:
     ├─ Descontar: requiere descripcion
     └─ bajas_temporales.descontado=true, descripcion_descuento
```

### 14.7 Flujo de Fichaje (Kiosco → RRHH)

```
Empleado (Kiosco)
  └─ Introduce PIN
     ├─ validate_vehicle_pin → identifica al empleado
     ├─ kiosk_check_device_by_profile → verifica dispositivo
     └─ web_register_fichaje → registra fichaje en fichajes
        └─ RRHH (Fichajes)
           ├─ Ve registros de entrada/salida
           ├─ Correcciones: aprueba/rechaza correcciones solicitadas
           └─ Auditoría de fichajes
```

### 14.8 Flujo de Formación (Formación → Empleado)

```
Formación (Exámenes)
  └─ Crea examen con preguntas de opción múltiple
     └─ Asigna a empleados (examen_asignaciones, estado='pendiente')
        └─ Empleado (Exámenes)
           ├─ Realiza examen
           ├─ Estado cambia a 'completado' (≥60%) o 'suspendido' (<60%)
           └─ Se registra puntuacion y fecha_realizacion
```

### 14.9 Flujo de Baja de Empleado (RRHH → Wasabi)

```
RRHH (Empleados)
  └─ Marca empleado como inactivo (activo=false)
     ├─ Actualiza empleados.activo
     ├─ Sincroniza a user_profiles (trigger de BD)
     └─ Mueve carpeta del empleado en Wasabi a ruta "bajas"
  └─ Si se reactiva (activo=true):
     └─ Restaura carpeta a ruta "activo"
```

---

## 15. BASE DE DATOS Y TABLAS

### 15.1 Tablas principales

| Tabla | Propósito | Perfiles con acceso |
|---|---|---|
| `user_profiles` | Perfiles de usuario (nombre, email, role, societies, PIN, activo) | Admin (CRUD), RRHH (CRUD limitado) |
| `empleados` | Registros de empleados (datos personales, contractuales, PRL, Vitaly) | Admin (CRUD), RRHH (CRUD), Prevención (R/U limitado), Supervisor (R) |
| `sociedades` | Definiciones de sociedades | Todos (R) |
| `centros` | Centros de trabajo | Admin (CRUD), RRHH, Prevención (R) |
| `user_roles` | Roles de usuario | Admin |
| `app_roles` | Roles disponibles en la app | Admin |
| `custom_roles` | Roles personalizados | Admin (CRUD) |
| `custom_profiles` | Perfiles personalizados | Admin (CRUD) |
| `role_tab_permissions` | Permisos de pestañas por perfil | Admin (CRUD), App (R) |
| `supervisor_asignaciones` | Asignaciones de empleados a supervisores | Admin/RRHH (CRUD), Supervisor (R) |
| `vehicles` | Flota de vehículos | Admin, RRHH, Supervisor |
| `vehicle_logs` | Registro de uso de vehículos | Admin, RRHH |
| `documents` | Documentos generales (Wasabi) | Admin, RRHH |
| `personal_documents` | Documentos personales de empleados | Admin, RRHH, Empleado |
| `employee_documents` | Documentos por empleado (carpetas: prevencion, etc.) | Admin, RRHH, Prevención |
| `employee_pending_docs` | Tareas pendientes de documentos para empleados | Admin, RRHH (crean), Empleado (ve/sube) |
| `dispositivos` | Dispositivos de TI asignados | Admin, RRHH |
| `dispositivos_historial` | Historial de asignaciones de dispositivos | Admin, RRHH |
| `kiosk_devices` | Tablets de kiosco | Admin, RRHH |
| `employee_registered_devices` | Móviles corporativos registrados | Admin, RRHH |
| `device_pairing_requests` | Solicitudes de emparejamiento de dispositivos | Admin, RRHH |
| `fichajes` | Registros de fichaje | Admin, RRHH, Empleado (propios) |
| `bajas_temporales` | Bajas/ausencias temporales | Admin, RRHH, Supervisor |
| `sustituciones` | Sustituciones (vinculadas o no a bajas) | Admin, RRHH |
| `liquidaciones_horas` | Liquidaciones de horas de sustitutos | Admin, RRHH |
| `vacaciones` | Solicitudes de vacaciones | Admin, RRHH, Supervisor, Empleado (propias) |
| `incidencias` | Reportes de incidencias | Admin, RRHH, Empleado |
| `examenes` | Exámenes de formación | Formación (CRUD) |
| `preguntas` | Preguntas de exámenes | Formación (CRUD) |
| `examen_asignaciones` | Asignaciones de exámenes a empleados | Formación (CRUD), Empleado (R) |
| `calidad_documentos` | Documentos de calidad/gestión | Calidad (CRUD), Empleado (R) |
| `prl_folders` | Carpetas de documentos PRL | Prevención (CRUD) |
| `prl_documents` | Documentos PRL | Prevención (CRUD), Empleado (R via RPC) |
| `prl_folder_tags` | Tags de acceso por carpeta PRL | Prevención |
| `prl_folder_departamentos` | Departamentos con acceso a carpeta PRL | Prevención |
| `prl_download_logs` | Registro de descargas de documentos PRL | Prevención |
| `tags` | Tags de Prevención | Admin (CRUD), Prevención (R) |
| `etiquetado` | Asignación de tags a entidades | Prevención (CRUD) |
| `departamentos_prl` | Departamentos PRL | Prevención (CRUD) |
| `empleados_departamentos_prl` | Vinculación empleados-departamentos PRL | Prevención |
| `reconocimiento_medico_historial` | Historial de cambios de estado de reconocimiento médico | Prevención (CRUD) |
| `notificaciones_empleado` | Notificaciones para empleados | Prevención (crea), Empleado (R) |
| `historial_contrato` | Historial de cambios de estado de contrato | RRHH (CRUD) |
| `audit_logs` | Registro de auditoría | Admin, RRHH (R) |
| `ui_settings` | Configuración de apariencia (key/value) | Admin (CRUD), App (R) |
| `facturas` | Facturas | Admin, RRHH, Administración, Supervisor |
| `email_plantillas` | Plantillas de correo | Admin, RRHH |
| `email_cuentas` | Cuentas SMTP | Admin, RRHH |
| `tab_last_seen` | Última visualización de pestañas por usuario | App |

### 15.2 Edge Functions

| Función | Propósito | Acciones |
|---|---|---|
| `admin-login` | Autenticación de usuarios | Verifica credenciales, devuelve tokens + profile |
| `manage-user` | Gestión de usuarios | `create_user`, `set_email`, `set_password`, `set_pin`, `bulk_import` |
| `password-reset` | Recuperación de contraseña | `request` (enviar token), `reset` (cambiar contraseña) |
| `send-email` | Envío de correos | Envía email con plantilla via SMTP |
| `incidence-report` | Reporte diario de incidencias | Cron job, envía resumen por email |
| `prl-report` | Reporte PRL | Genera reporte de trazabilidad PRL |
| `wasabi-download` | Descarga de archivos Wasabi | Proxy de descarga segura |
| `wasabi-manage` | Gestión de archivos Wasabi | Subida, borrado, movimiento de archivos |

### 15.3 RPCs principales

| RPC | Propósito |
|---|---|
| `validate_vehicle_pin` | Validar PIN de empleado |
| `kiosk_check_device_by_profile` | Verificar autorización de dispositivo |
| `web_register_fichaje` | Registrar fichaje (entrada/salida/descanso) |
| `complete_device_pairing` | Finalizar emparejamiento de dispositivo |
| `get_my_prl_documents` | Obtener documentos PRL del empleado actual |
| `get_prl_document_trazabilidad` | Obtener trazabilidad de un documento PRL |
| `get_prl_trazabilidad_stats` | Estadísticas de trazabilidad PRL |
| `get_employees_fichaje_modes` | Listar empleados con su modo de fichaje |
| `kiosk_next_fichaje` | Determinar siguiente acción de fichaje en kiosco |
| `kiosk_daily_effective_total` | Total efectivo diario de fichaje en kiosco |

### 15.4 Almacenamiento de archivos

| Destino | Contenido | Estructura de rutas |
|---|---|---|
| Wasabi S3 | Documentos PRL | `prevencion/{society_id}/{folder_id}/{timestamp}-{filename}` |
| Wasabi S3 | Documentos de empleado (Prevención) | `empleados/{user_id}/prevencion/{timestamp}-{filename}` |
| Wasabi S3 | Documentos de calidad | `calidad/{year}/{month}/{filename}` |
| Wasabi S3 | Contratos firmados | `publico/{timestamp}-Contrato-{DNI}.{ext}` |
| Wasabi S3 | Fotos de incidencias | Ruta de incidencias |
| Wasabi S3 | Justificantes PNR | Ruta de justificantes |
| Wasabi S3 | Carpetas de empleado (RRHH) | `privado/activo/...` o `bajas/...` |
| Supabase Storage | Assets de UI (logos, fondos) | `ui-assets/logos/`, `ui-assets/login-bg/`, `ui-assets/kiosk-bg/` |

### 15.5 Roles y jerarquía

```
Admin (acceso total, puede asignar rol admin)
├── RRHH (gestión de empleados, bajas, contratos, fichajes, usuarios, etc.)
├── Supervisor (vista limitada de RRHH + empleados asignados)
├── Prevención (PRL, reconocimiento médico, Vitaly, trazabilidad)
├── Administración (facturas)
├── Calidad (documentos de calidad)
├── Formación (exámenes y asignaciones)
└── Empleado (autoservicio: documentos, fichajes, vacaciones, exámenes, dispositivos)
```

### 15.6 Seguridad (RLS)

Todas las tablas tienen Row Level Security (RLS) habilitado. Las políticas controlan:
- **Admin:** acceso total a todas las tablas.
- **RRHH:** CRUD sobre empleados, bajas, sustituciones, fichajes, documentos, etc.
- **Prevención:** SELECT sobre empleados (para PRL), UPDATE limitado (reconocimiento_medico_estado, vitaly_estado), CRUD sobre tablas PRL.
- **Supervisor:** SELECT sobre empleados asignados via `supervisor_asignaciones`.
- **Empleado:** SELECT sobre sus propios datos (documentos, fichajes, vacaciones, dispositivos asignados).
- **Anon:** acceso limitado para fichaje en kiosco (INSERT en fichajes, SELECT para validación de PIN).

---

**Fin del Manual de Operaciones y Funcionalidades**
