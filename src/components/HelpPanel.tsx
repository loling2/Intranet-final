import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Download, FileText, BookOpen } from 'lucide-react';
import { jsPDF } from 'jspdf';

interface TabInfo {
  id: string;
  label: string;
  description: string;
}

interface ProfileManual {
  profileName: string;
  profileDescription: string;
  tabs: TabInfo[];
}

const ALL_MANUALS: ProfileManual[] = [
  {
    profileName: 'Empleado',
    profileDescription: 'Portal de autoservicio del empleado. Cada trabajador puede consultar sus documentos, fichajes, vacaciones, exámenes de formacion, dispositivos asignados e incidencias.',
    tabs: [
      { id: 'resumen', label: 'Resumen', description: 'Pantalla de inicio con tarjetas de acceso rapido a documentos, dispositivos asignados, documentos de prevencion, certificados y vehiculo asignado. Muestra un resumen visual de todo lo que tienes disponible.' },
      { id: 'documentos', label: 'Documentos', description: 'Ver y descargar documentos asignados a ti por RRHH o administracion (contratos, certificados, comunicados). Los documentos nuevos se destacan con un badge.' },
      { id: 'personal-docs', label: 'Documentos Personales', description: 'Gestion de tus documentos personales: subir, descargar y organizar documentos propios (DNI, contrato, Seguridad Social, etc.).' },
      { id: 'prevencion', label: 'Documentos de Prevencion', description: 'Documentos de Prevencion de Riesgos Laborales asignados a tu puesto segun tus tags y departamentos. El sistema filtra automaticamente los documentos que puedes ver. Incluye planes de prevencion, evaluaciones de riesgos, protocolos de seguridad y entregas de EPIs. Puedes previsualizar y descargar cada documento.' },
      { id: 'calidad', label: 'Documentos de Calidad', description: 'Documentos del sistema de gestion de calidad (ISO, procedimientos, manuales). Se muestran en dos secciones: General (aplica a todas las sociedades) y por Sociedad. Incluye filtros por ano y mes. Solo consulta y descarga, sin capacidad de subida.' },
      { id: 'dispositivos', label: 'Dispositivos', description: 'Ver los dispositivos de TI asignados a ti (portatil, movil, tablet, monitor, etc.). Si tienes una entrega pendiente, veras una tarea para subir el acta de entrega firmada. El acta es un documento imprimible con logo de sociedad, datos del trabajador, tabla de dispositivos, Clausula de responsabilidad y lineas de firma.' },
      { id: 'vehiculos', label: 'Vehiculos', description: 'Ver y gestionar el vehiculo asignado a ti. Puedes consultar el estado del vehiculo y su historial de uso.' },
      { id: 'certificaciones', label: 'Certificaciones', description: 'Seguimiento de tus certificados (cursos, habilitaciones, permisos). Control de caducidad con aviso de certificados proximos a vencer.' },
      { id: 'examenes', label: 'Examenes', description: 'Realizar examenes de formacion asignados. Estados: pendiente, completado (>=60%, verde) o suspendido (<60%, rojo). Puedes ver tus resultados y certificados obtenidos.' },
      { id: 'fichajes', label: 'Mis Fichajes', description: 'Historial de tus fichajes de entrada y salida. Puedes ver los registros de jornada con fecha, hora y tipo de evento (entrada, descanso, fin descanso, salida, permiso). Puedes solicitar correcciones de fichajes.' },
      { id: 'vacaciones', label: 'Vacaciones', description: 'Solicitar vacaciones y consultar el estado de tus solicitudes (pendiente, aprobada, rechazada). Puedes ver el historial de vacaciones solicitadas.' },
      { id: 'incidencias', label: 'Incidencias', description: 'Reportar incidencias (problemas con vehiculos, equipos, fichajes, etc.) con titulo, descripcion y fotos. Tambien puedes ver el historial de incidencias que has creado y su estado.' },
      { id: 'cuenta', label: 'Cambiar Contrasena / PIN', description: 'Autogestion de credenciales. Puedes cambiar tu contrasena de acceso (minimo 8 caracteres, 1 mayuscula, 1 minuscula, 1 numero, 1 simbolo) y tu PIN de fichaje en kiosco (4-6 digitos).' },
    ],
  },
  {
    profileName: 'RRHH',
    profileDescription: 'Panel de Recursos Humanos con 21 pestañas. Gestion completa de empleados, contratos, bajas, sustituciones, fichajes, vacaciones, documentos, dispositivos y usuarios. La visibilidad de cada pestaña se controla mediante permisos configurables.',
    tabs: [
      { id: 'overview', label: 'Resumen RRHH', description: 'Dashboard con KPIs: total empleados, vacaciones pendientes, examenes aprobados, certificados por vencer (caducidad <=90 dias) y contratos pendientes (pendiente/avisado). Incluye paneles de vacaciones pendientes con botones aprobar/rechazar, certificados por vencer y desglose por sociedad. El contador de contratos pendientes es clickeable y navega a la pestana Contratos.' },
      { id: 'employees', label: 'Empleados', description: 'CRUD completo del directorio de empleados. Campos: nombre, apellidos, DNI, email, telefono, NSS, sexo, convenio, direccion, sociedad (y sociedad secundaria), tipo de contrato (10 codigos espanoles), fechas de alta/prueba, turno (Manana/Tarde/Noche/Partido/Flexible), puesto, centro, titulacion, observaciones. Al marcar inactivo: mueve carpeta en Wasabi a "bajas". Al reactivar: restaura a "activo". Cambio de estado de contrato exige justificacion textual y se registra en historial_contrato. Importacion CSV en modo HR (actualiza por DNI) o Auth (crea usuarios en lote).' },
      { id: 'contratos', label: 'Contratos', description: 'Trazabilidad de cambios de estado de contrato por empleado. Vista de auditoria con KPIs de pendiente/avisado/firmado. Clic en fila expande el historial de cambios (historial_contrato). Si el estado es "firmado", aparece boton para subir contrato firmado: se sube a Wasabi en publico/{timestamp}-Contrato-{DNI}.{ext}, se inserta en documents (folder=publico) y se registra en audit_log.' },
      { id: 'bajas', label: 'Bajas/Ausencias', description: 'Modulo mas complejo con 5 sub-vistas: Bajas, Finalizadas, Balance Sustitutos, Sustituciones, Horas Extras. Formulario de baja: empleado, fechas inicio/fin (o larga duracion), motivo, tipo de absentismo (IT/AT/PR/PNR/Reposo), dias no cubiertos. Bloque de sustitucion embebido: sustituto, dias/horas, turno, festivo, nocturno, tipo de cobertura (pagar/compensar/otro). Calculo automatico de horas: num_dias x 8h por turno. Finalizar baja: modo nomina/solicitud/otro. PNR/Reposo: descontar requiere descripcion. Balance de sustitutos: agrega horas por sustituto, liquidacion inserta en liquidaciones_horas. Exportacion Excel y PDF.' },
      { id: 'sustituciones', label: 'Sustituciones', description: 'Registro de sustituciones independientes (no vinculadas a baja). Nueva sustitucion: sustituto, horas, fecha, motivo, dias a descontar, justificante. Finalizar sustitucion (modal unificado): seccion 1 pagar horas a sustituta (inserta en liquidaciones_horas, marca horas_liquidadas=true), seccion 2 descontar dias al sustituido (requiere descripcion, marca dias_descontados=true). Boton Finalizar solo se habilita cuando ambas secciones estan completas. KPIs: sustitutos unicos, H. a pagar, H. a compensar, dias a descontar.' },
      { id: 'horas-extras', label: 'Horas Extras', description: 'Registro de horas extraordinarias. Sub-pestana dentro de Bajas.' },
      { id: 'vacations', label: 'Vacaciones', description: 'Gestion de solicitudes de vacaciones. Estados: pendiente -> aprobada / rechazada. Puedes ver solicitudes pendientes, aprobarlas o rechazarlas, y consultar el historial por empleado y sociedad.' },
      { id: 'fichajes', label: 'Fichajes y Correcciones', description: 'Control horario. Renderiza dos modulos apilados: Correcciones de Fichajes (cola de aprobacion de correcciones solicitadas por empleados) y Fichajes (registros de entrada/salida por empleado con filtros por fecha y empleado).' },
      { id: 'incidencias', label: 'Incidencias', description: 'Gestion de incidencias reportadas por empleados o supervisores. Puedes ver todas las incidencias, cambiar su estado (pendiente, en proceso, resuelta) y asignarlas a departamentos.' },
      { id: 'facturas', label: 'Facturas', description: 'Gestion de facturas con permisos limitados (isAdmin=false). Registrar facturas con proveedor, numero, fecha, importe e IVA. Incluye filtros y exportacion.' },
      { id: 'pdf-split', label: 'Nominas', description: 'Utilidad para dividir PDFs (tipicamente nominas multi-pagina) en documentos individuales por empleado. El sistema detecta el DNI en cada pagina y asigna la nomina al empleado correspondiente.' },
      { id: 'personal-docs', label: 'Documentos Personales', description: 'Gestion de documentos personales de cada empleado (DNI, contrato, Seguridad Social). Organizados por empleado con historial de versiones.' },
      { id: 'vehicles', label: 'Vehiculos', description: 'Gestion de la flota de vehiculos. Registrar vehiculos (matricula, marca, modelo, kilometraje), ver su estado (libre/en uso), historial de uso por empleado e incidencias.' },
      { id: 'documents', label: 'Documentos', description: 'Gestor central de documentos generales. Subir, organizar en carpetas y asignar documentos a empleados o sociedades. Incluye documentos publicos y privados.' },
      { id: 'devices', label: 'Dispositivos', description: 'Gestion de activos de TI (portatiles, monitores, moviles, tablets, etc.) asignados a empleados. Campos: tipo, marca/modelo, sociedad, etiquetado, valor estimado, numero de telefono (si tipo=Movil), serie, centro, notas, empleado asignado, fecha de asignacion. Estados: Activo/Inactivo/Stock. Al asignar: inserta en dispositivos_historial y crea tarea pendiente en employee_pending_docs. Acta de entrega imprimible. Historial de dispositivo con linea temporal.' },
      { id: 'users', label: 'Gestion de Usuarios', description: 'Administracion de usuarios del sistema. Crear usuarios (invitar) con nombre, email, role y sociedades. Editar: rol, estado, sociedades, email, contrasena, PIN. Asignacion de empleados a supervisor (supervisor_asignaciones). Creacion en lote de usuarios por empleado. Envio de email de acceso con plantilla y cuenta SMTP. Los usuarios son las cuentas que acceden a la web; los empleados son los registros de personal.' },
      { id: 'audit', label: 'Auditoria', description: 'Visor de solo lectura del registro de auditoria. Filtros: busqueda por texto, tipo de evento, toggle de sociedades. Eventos: user_invited, user_role_changed, password_reset, vehicle_checkin, document_uploaded, contrato_uploaded, email_changed, password_set, pin_set, etc. Limite: 200 registros por consulta, ordenados por fecha descendente.' },
      { id: 'departamentos', label: 'Departamentos', description: 'Gestion de departamentos internos. Los departamentos se usan para enrutar incidencias y organizar documentos PRL.' },
      { id: 'email', label: 'Email', description: 'Gestion de plantillas de email y cuentas de correo SMTP. Configurar plantillas para comunicaciones a empleados, recordatorios de formacion, notificaciones de nominas, etc.' },
      { id: 'supervisor-empleados', label: 'Empleados Asignados', description: 'Solo visible para supervisores. Vista de solo lectura de los empleados asignados a tu supervision (supervisor_asignaciones). Busqueda por nombre, DNI, puesto, centro. Tarjetas expandibles con detalle: email, telefono, puesto, centro, localidad, DNI, observaciones.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil. Acordeones colapsables. Genera PDFs descargables del manual por perfil o de todos a la vez.' },
    ],
  },
  {
    profileName: 'Supervisor',
    profileDescription: 'Panel de Supervisor. Variante del panel RRHH con acceso limitado a las pestañas asignadas. El supervisor solo ve los empleados que le han sido asignados desde Gestion de Usuarios (tabla supervisor_asignaciones).',
    tabs: [
      { id: 'overview', label: 'Resumen RRHH', description: 'Panel de control con KPIs de los empleados bajo tu supervision: total empleados, vacaciones pendientes, examenes aprobados, certificados por vencer.' },
      { id: 'employees', label: 'Empleados', description: 'Lista de empleados. Como supervisor puedes consultar datos de los empleados asignados a ti. Vista de solo lectura.' },
      { id: 'vehicles', label: 'Vehiculos', description: 'Consulta del estado de vehiculos de la flota. Puedes ver que vehiculos estan libres o en uso.' },
      { id: 'vacations', label: 'Vacaciones', description: 'Aprobacion de solicitudes de vacaciones de tus empleados. Puedes aprobar o rechazar solicitudes pendientes.' },
      { id: 'certificates', label: 'Certificaciones', description: 'Consulta de certificados de empleados a tu cargo y seguimiento de vencimientos.' },
      { id: 'exams', label: 'Examenes', description: 'Consulta de examenes de formacion asignados a tus empleados.' },
      { id: 'facturas', label: 'Facturas', description: 'Consulta de facturas registradas en el sistema.' },
      { id: 'bajas', label: 'Bajas/Ausencias', description: 'Consulta de bajas y ausencias de tus empleados. Gestion de bajas medicas, sustituciones y balance de horas.' },
      { id: 'supervisor-empleados', label: 'Empleados Asignados', description: 'Lista de los empleados especificamente asignados a tu supervision. Vista de solo lectura con busqueda y tarjetas expandibles con detalle: email, telefono, puesto, centro, localidad, DNI, observaciones.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil.' },
    ],
  },
  {
    profileName: 'Admin',
    profileDescription: 'Panel de Administrador con 20 pestañas. Acceso total a todas las funcionalidades, configuracion y gestion de sociedades. Es el perfil con acceso mas amplio del sistema.',
    tabs: [
      { id: 'overview', label: 'Panel General', description: 'Dashboard con KPIs globales (total empleados, vacaciones pendientes, examenes aprobados, certificados por vencer, contratos pendientes), acceso rapido a sociedades (clic navega al portal de empleado de esa sociedad) y registro de actividad reciente.' },
      { id: 'employees', label: 'Empleados', description: 'CRUD completo de todos los empleados del sistema, independientemente de la sociedad. Campos: nombre, apellidos, DNI, email, telefono, NSS, sexo, convenio, direccion, sociedad (y secundaria), tipo de contrato, fechas, turno, puesto, centro, titulacion. Al marcar inactivo: mueve carpeta en Wasabi a "bajas". Cambio de estado de contrato exige justificacion y se registra en historial_contrato. Creacion de acceso de usuario para empleados sin cuenta. Importacion CSV (modo HR o Auth).' },
      { id: 'users', label: 'Gestion de Usuarios', description: 'Administracion de usuarios del sistema. Crear cuentas, asignar roles (admin, RRHH, prevencion, etc.), sociedades y permisos. Reiniciar contrasenas. Asignar PIN. Asignacion de empleados a supervisores. Creacion en lote. Envio de email de acceso con plantilla y cuenta SMTP. Solo admin puede asignar el rol admin.' },
      { id: 'societies', label: 'Sociedades', description: 'Gestion de sociedades/empresas del grupo. Ver tarjetas con boton "Ver portal" (navega al portal de empleado de esa sociedad). CRUD de centros de trabajo (tabla centros), opcionalmente asignados a una sociedad.' },
      { id: 'vehicles', label: 'Vehiculos', description: 'Gestion completa de la flota de vehiculos de todas las sociedades. Registrar vehiculos, ver estado, historial de uso e incidencias.' },
      { id: 'documents', label: 'Documentos', description: 'Gestor central de documentos del sistema. Subir, organizar en carpetas y distribuir documentos a empleados y sociedades. Incluye documentos publicos y privados.' },
      { id: 'devices', label: 'Dispositivos', description: 'Gestion de activos de TI asignados a empleados. Campos: tipo (Portatil/Sobremesa/Monitor/Movil/Tablet/Periferico/VoIP/Otro), marca/modelo, sociedad, etiquetado, valor estimado, numero de telefono (si Movil), serie, centro, notas, empleado, fecha asignacion. Estados: Activo/Inactivo/Stock. Al asignar: crea historial y tarea pendiente (employee_pending_docs). Acta de entrega imprimible. Historial con linea temporal.' },
      { id: 'kiosk-devices', label: 'Fichaje y Tablets', description: 'Gestion de dispositivos de fichaje. A) Tablets de Kiosco: CRUD, activar/desactivar, deteccion online (last_seen_at <15 min). B) Moviles Corporativos: CRUD, activar/desactivar. C) Permisos por Empleado: configurar modo de fichaje (kiosk_only, kiosk_or_corporate, any). D) Solicitudes de Emparejamiento: gestionar peticiones de registro de dispositivos. E) Telemetria: resumen de actividad (total tablets, online, moviles, fichajes recientes).' },
      { id: 'vacations', label: 'Vacaciones', description: 'Gestion global de solicitudes de vacaciones de todas las sociedades. Aprobar/rechazar solicitudes pendientes.' },
      { id: 'prevencion', label: 'Prevencion/Calidad', description: 'Modulo en desarrollo. Muestra 4 KPIs en cero y lista de funcionalidades planificadas (Evaluacion de Riesgos, Registro de Incidencias, Auditorias Internas, Planes de Accion, Indicadores PRL, Documentacion ISO).' },
      { id: 'tags', label: 'Tags PRL', description: 'Crear y eliminar etiquetas/tags de Prevencion usadas para clasificar documentos PRL y asignarlos a empleados por riesgo/departamento. Campo obligatorio: nombre (unico, case-insensitive). Categorias: Oficina, Electricista, Obras/Construccion, Almacen/Logistica, Conduccion, Trabajo en Altura, Espacios Confinados, Manipulacion de Cargas, Exposicion a Quimicos, Pantallas de Visualizacion.' },
      { id: 'roles', label: 'Roles', description: 'Gestion de roles personalizados (etiquetas con color). Campos: nombre (unico), color (paleta de 10 predefinidos), descripcion (opcional). Eliminacion en dos pasos (confirmar).' },
      { id: 'departamentos', label: 'Departamentos', description: 'Gestion de departamentos internos. Los departamentos se usan para enrutar incidencias y organizar documentos PRL.' },
      { id: 'email', label: 'Email', description: 'Modulo de envio de emails. Configurar plantillas de email y cuentas de correo SMTP. Enviar comunicaciones a empleados, recordatorios de formacion, notificaciones de nominas, etc.' },
      { id: 'audit', label: 'Auditoria', description: 'Registro completo de auditoria del sistema. Todas las acciones realizadas por todos los usuarios quedan registradas para trazabilidad. Filtros: busqueda por texto, tipo de evento, toggle de sociedades. Limite: 200 registros.' },
      { id: 'css', label: 'CSS (Apariencia)', description: 'Personalizacion visual de la aplicacion. A) Imagen de fondo de login (subir a Storage, ui_settings key=login_background). B) Imagen de fondo de kiosco (opcional). C) URL de la aplicacion (para correos de recuperacion). D) Logos de sociedad (subir a Storage por sociedad). E) Colores de sociedad (color primario, gradiente desde/hasta, se guarda en ui_settings como JSON).' },
      { id: 'incidencias', label: 'Incidencias', description: 'Gestion global de todas las incidencias del sistema, de todas las sociedades y departamentos.' },
      { id: 'fichajes', label: 'Fichajes', description: 'Gestion global de fichajes de todos los empleados del sistema. Ver registros, filtrar por fecha y empleado, y gestionar correcciones solicitadas.' },
      { id: 'permissions', label: 'Permisos de Perfiles', description: 'Matriz que controla que pestanas puede ver cada perfil. Roles integrados: rrhh, supervisor, prevencion, administracion, employee. Roles personalizados: ilimitados. 20 pestanas configurables. Al alternar: upsert en role_tab_permissions. Crear/eliminar perfiles personalizados (genera slug, inserta en custom_profiles). Los cambios aplican al recargar la pagina.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil. Acordeones colapsables. Genera PDFs descargables del manual por perfil, de todos a la vez, o el manual completo en un solo PDF.' },
    ],
  },
  {
    profileName: 'Prevencion',
    profileDescription: 'Panel de Prevencion de Riesgos Laborales con 7 pestañas. Gestion de documentos PRL, trazabilidad, reconocimientos medicos, Vitaly y departamentos. Usa tema verde.',
    tabs: [
      { id: 'empleados', label: 'Empleados y Tags', description: 'Gestionar asignaciones de tags de PRL por empleado y subir documentos a carpetas individuales de Prevencion. Busqueda por nombre/email/puesto, filtro por sociedad. Panel expandible por empleado con tags asignados y multi-select para asignar nuevos (inserta en etiquetado). Subida de documentos a Wasabi en empleados/{user_id}/prevencion/{timestamp}-{filename}, se inserta en employee_documents con folder=prevencion. Boton "Ver carpeta Prevencion" abre modal con todos los documentos del empleado.' },
      { id: 'documentos', label: 'Documentos PRL', description: 'Gestion documental PRL basada en carpetas con control de acceso por tags y departamentos. Crear/editar carpeta: nombre, descripcion, tags de acceso (max 5), departamentos PRL (max 5). Subir documento: se sube a Wasabi en prevencion/{society_id}/{folder_id}/{timestamp}-{filename}, se inserta en prl_documents. Automaticamente se insertan notificaciones en notificaciones_empleado para todos los empleados activos de esa sociedad (tipo=prl, titulo=Nuevo documento PRL). Vista previa (solo admin/prevencion) y descarga para todos.' },
      { id: 'trazabilidad', label: 'Trazabilidad', description: 'Rastrear que empleados han descargado cada documento PRL, con estadisticas agregadas. Sub-pestana Trazabilidad: lista de documentos agrupados por sociedad, al seleccionar documento llama al RPC get_prl_document_trazabilidad y muestra descargados (verde) vs pendientes (naranja). Sub-pestana Estadisticas: RPC get_prl_trazabilidad_stats con KPIs globales, graficos donut y barras, filtros por sociedad/centro/empleado, exportacion Excel y PDF apaisado.' },
      { id: 'departamentos', label: 'Departamentos PRL', description: 'Agrupar empleados en departamentos PRL para filtrar el acceso a carpetas. CRUD de departamentos (nombre, sociedad, descripcion). Asignacion de empleados via modal con busqueda y multi-select (inserta en empleados_departamentos_prl). Eliminar propaga el borrado a las vinculaciones.' },
      { id: 'reconocimiento', label: 'Reconocimiento Medico', description: 'Gestionar el estado de reconocimientos medicos de empleados que lo han aceptado (reconocimiento_medico=acepta, establecido por RRHH). Estados: pendiente -> en_proceso -> finalizado. Formulario: estado, fecha de cita, anotacion. Al finalizar: establece fecha automaticamente. Cada cambio se registra en reconocimiento_medico_historial con estado_anterior, estado_nuevo, anotacion, fecha_cita, autor. Vista de historial expandible por empleado.' },
      { id: 'vitaly', label: 'Vitaly', description: 'Gestionar el estado de onboarding Vitaly por empleado. Carga empleados donde vitaly_estado IN (inactivo, pendiente). Estados: inactivo -> pendiente -> activo. Formulario: estado (obligatorio), motivo (obligatorio si pendiente). Al activar: el empleado desaparece de la lista. RRHH ve vitaly_estado como solo lectura en Empleados.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil.' },
    ],
  },
  {
    profileName: 'Calidad',
    profileDescription: 'Panel de Calidad con 3 pestañas. Gestion de documentos del sistema de gestion de calidad (ISO, procedimientos, manuales).',
    tabs: [
      { id: 'documentos', label: 'Documentos', description: 'Listar, previsualizar, descargar y eliminar documentos de calidad/gestion. Filtros: Todos / General / Por sociedad. Busqueda. Vista previa (PDF/imagen via iframe), descarga, eliminar (con confirmacion: borra de Wasabi y calidad_documentos).' },
      { id: 'subir', label: 'Subir', description: 'Subir documentos de calidad a Wasabi. Campos obligatorios: modo de subida (general o por sociedad), al menos 1 archivo, ano (2024-2027), mes (01-12), sociedad (si modo=sociedad). Se sube a calida/{year}/{month}/{filename} y se inserta en calidad_documentos con nombre_archivo, wasabi_key, tipo, tamano_bytes, es_general, sociedad_ids, anio, mes, subido_por, subido_por_nombre.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil.' },
    ],
  },
  {
    profileName: 'Formacion',
    profileDescription: 'Panel de Formacion con 3 pestañas. Gestion de examenes y asignaciones de formacion a empleados.',
    tabs: [
      { id: 'examenes', label: 'Examenes', description: 'Crear, editar y eliminar examenes de formacion con preguntas de opcion multiple. Editor de examen: nombre, descripcion, duracion minutos (min 1, defecto 30), validez meses (min 1, defecto 12), ratio de penalizacion (min 0, defecto 3). Editor de preguntas: texto, 4 opciones (A/B/C/D), respuesta correcta (defecto A), orden auto-incremental. Asignar examen: seleccionar empleados activos, inserta en examen_asignaciones con estado=pendiente. Estados: pendiente (naranja), completado (verde, >=60%), suspendido (rojo, <60%). Eliminaciones en cascada con confirmacion.' },
      { id: 'asignaciones', label: 'Asignaciones Globales', description: 'Vista global de todas las asignaciones de examenes con enriquecimiento de nombre de examen via join en memoria con cache de examenes. Muestra estado, puntuacion y fecha de realizacion por asignacion.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil.' },
    ],
  },
  {
    profileName: 'Administracion',
    profileDescription: 'Panel de Administracion con 2 pestañas. Perfil enfocado en tareas administrativas y billing.',
    tabs: [
      { id: 'facturas', label: 'Facturas', description: 'Gestion de facturas con permisos de admin. Registrar facturas con todos sus datos (proveedor, numero, fecha, base imponible, IVA, total), filtrar por sociedad y periodo, y exportar listados. Como administracion tienes permisos extendidos sobre el modulo.' },
      { id: 'ayuda', label: 'Ayuda', description: 'Manual de ayuda integrado con documentacion por perfil.' },
    ],
  },
];

interface Props {
  currentProfileName?: string;
  accentColor?: string;
}

export default function HelpPanel({ currentProfileName, accentColor = '#0369A1' }: Props) {
  const [expandedProfile, setExpandedProfile] = useState<string | null>(currentProfileName ?? ALL_MANUALS[0].profileName);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);

  const toggleProfile = (profileName: string) => {
    setExpandedProfile(prev => prev === profileName ? null : profileName);
    setExpandedTab(null);
  };

  const toggleTab = (tabKey: string) => {
    setExpandedTab(prev => prev === tabKey ? null : tabKey);
  };

  const generatePDF = (manual: ProfileManual) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 74, 110);
    doc.text('Manual de Ayuda', margin, y);
    y += 10;

    doc.setFontSize(14);
    doc.text(`Perfil: ${manual.profileName}`, margin, y);
    y += 8;

    // Description
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const descLines = doc.splitTextToSize(manual.profileDescription, pageWidth - margin * 2);
    doc.text(descLines, margin, y);
    y += descLines.length * 5 + 6;

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    // Tabs
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 74, 110);
    doc.text('Pestañas disponibles:', margin, y);
    y += 8;

    manual.tabs.forEach((tab, index) => {
      ensureSpace(20);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`${index + 1}. ${tab.label}`, margin, y);
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(90, 90, 90);
      const lines = doc.splitTextToSize(tab.description, pageWidth - margin * 2);
      ensureSpace(lines.length * 4.5 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 4;
    });

    // Footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Manual de Ayuda - Perfil ${manual.profileName} - Pagina ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    doc.save(`Manual_${manual.profileName}.pdf`);
  };

  const generateAllPDFs = () => {
    ALL_MANUALS.forEach((manual) => generatePDF(manual));
  };

  const generateCompletePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let y = margin;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Cover page
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 74, 110);
    doc.text('Manual de Operaciones', pageWidth / 2, pageHeight / 2 - 20, { align: 'center' });
    doc.text('y Funcionalidades', pageWidth / 2, pageHeight / 2 - 10, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text('Sistema de Gestion de RRHH, Prevencion y Operaciones', pageWidth / 2, pageHeight / 2 + 10, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(150, 150, 150);
    doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')}`, pageWidth / 2, pageHeight / 2 + 25, { align: 'center' });

    doc.addPage();
    y = margin;

    // Table of contents
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(12, 74, 110);
    doc.text('Indice de Perfiles', margin, y);
    y += 10;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    ALL_MANUALS.forEach((manual, index) => {
      ensureSpace(8);
      doc.text(`${index + 1}. ${manual.profileName} (${manual.tabs.length} pestanas)`, margin + 5, y);
      y += 7;
    });
    y += 5;

    // Each profile manual
    ALL_MANUALS.forEach((manual, profileIndex) => {
      doc.addPage();
      y = margin;

      // Profile title
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(12, 74, 110);
      ensureSpace(15);
      doc.text(`${profileIndex + 1}. Perfil: ${manual.profileName}`, margin, y);
      y += 10;

      // Profile description
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(80, 80, 80);
      const descLines = doc.splitTextToSize(manual.profileDescription, pageWidth - margin * 2);
      ensureSpace(descLines.length * 5 + 6);
      doc.text(descLines, margin, y);
      y += descLines.length * 5 + 8;

      // Divider
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y, pageWidth - margin, y);
      y += 8;

      // Section header
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(12, 74, 110);
      ensureSpace(10);
      doc.text('Pestañas disponibles:', margin, y);
      y += 8;

      // Tabs
      manual.tabs.forEach((tab, index) => {
        ensureSpace(20);

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 30, 30);
        ensureSpace(8);
        doc.text(`${index + 1}. ${tab.label}`, margin, y);
        y += 6;

        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(90, 90, 90);
        const lines = doc.splitTextToSize(tab.description, pageWidth - margin * 2);
        ensureSpace(lines.length * 4.5 + 4);
        doc.text(lines, margin, y);
        y += lines.length * 4.5 + 4;
      });
    });

    // Footer on every page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Manual de Operaciones y Funcionalidades - Pagina ${i} de ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    doc.save('Manual_Completo_Operaciones.pdf');
  };

  const isAdmin = currentProfileName === 'Admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className="rounded-2xl p-6"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${accentColor}15` }}
            >
              <HelpCircle size={22} style={{ color: accentColor }} />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight" style={{ color: '#0F172A' }}>
                Manual de Ayuda
              </h2>
              <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
                Guia de todas las pestanas disponibles segun el perfil. Descarga el manual en PDF de cada perfil para saber como funciona la web.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            {isAdmin && (
              <button
                onClick={generateCompletePDF}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:opacity-80"
                style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
              >
                <BookOpen size={16} />
                Manual completo (PDF)
              </button>
            )}
            <button
              onClick={generateAllPDFs}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
            >
              <Download size={16} />
              Descargar todos los manuales
            </button>
          </div>
        </div>
      </div>

      {/* Profile manuals accordion */}
      <div className="space-y-3">
        {ALL_MANUALS.map((manual) => {
          const isExpanded = expandedProfile === manual.profileName;
          const isCurrent = manual.profileName === currentProfileName;

          return (
            <div
              key={manual.profileName}
              className="rounded-2xl overflow-hidden transition-all duration-200"
              style={{ backgroundColor: '#FFFFFF', border: `1px solid ${isCurrent ? accentColor : '#E2E8F0'}` }}
            >
              {/* Profile header */}
              <button
                onClick={() => toggleProfile(manual.profileName)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50"
              >
                <div className="flex items-center gap-3 text-left">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isCurrent ? `${accentColor}15` : '#F1F5F9' }}
                  >
                    <FileText size={16} style={{ color: isCurrent ? accentColor : '#64748B' }} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>
                        {manual.profileName}
                      </h3>
                      {isCurrent && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                        >
                          TU PERFIL
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                      {manual.tabs.length} pestaña{manual.tabs.length !== 1 ? 's' : ''} disponible{manual.tabs.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    onClick={(e) => { e.stopPropagation(); generatePDF(manual); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-80"
                    style={{ backgroundColor: `${accentColor}10`, color: accentColor }}
                  >
                    <Download size={13} />
                    PDF
                  </span>
                  {isExpanded
                    ? <ChevronUp size={18} style={{ color: '#94A3B8' }} />
                    : <ChevronDown size={18} style={{ color: '#94A3B8' }} />
                  }
                </div>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-5 pb-4">
                  <p className="text-sm mb-4 px-1" style={{ color: '#64748B' }}>
                    {manual.profileDescription}
                  </p>
                  <div className="space-y-2">
                    {manual.tabs.map((tab, index) => {
                      const tabKey = `${manual.profileName}-${tab.id}`;
                      const isTabExpanded = expandedTab === tabKey;

                      return (
                        <div
                          key={tab.id}
                          className="rounded-xl overflow-hidden"
                          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                        >
                          <button
                            onClick={() => toggleTab(tabKey)}
                            className="w-full flex items-center justify-between gap-2 px-4 py-3 cursor-pointer transition-colors hover:bg-slate-100"
                          >
                            <div className="flex items-center gap-2.5 text-left">
                              <span
                                className="w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                                style={{ backgroundColor: `${accentColor}15`, color: accentColor }}
                              >
                                {index + 1}
                              </span>
                              <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                {tab.label}
                              </span>
                            </div>
                            {isTabExpanded
                              ? <ChevronUp size={15} style={{ color: '#94A3B8' }} />
                              : <ChevronDown size={15} style={{ color: '#94A3B8' }} />
                            }
                          </button>
                          {isTabExpanded && (
                            <div className="px-4 pb-3 pl-12">
                              <p className="text-sm" style={{ color: '#64748B', lineHeight: 1.6 }}>
                                {tab.description}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
