import { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Download, FileText } from 'lucide-react';
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
    profileDescription: 'El panel principal del empleado. Aquí cada trabajador puede ver sus documentos, nóminas, formación, incidencias y fichajes.',
    tabs: [
      { id: 'resumen', label: 'Resumen', description: 'Pantalla de inicio con un resumen rápido de tus documentos, dispositivos asignados, documentos de prevención, certificados y vehículo asignado. Muestra tarjetas con accesos directos a cada sección.' },
      { id: 'nominas', label: 'Mis Nóminas', description: 'Lista todas tus nóminas disponibles. Puedes descargar cada nómina en PDF. Las nóminas se asocian a tu DNI, por lo que aparecen automáticamente cuando RRHH las sube al sistema.' },
      { id: 'misdocumentos', label: 'Mis Documentos', description: 'Documentos personales que RRHH o administración han subido para ti (contratos, certificados, comunicados). Puedes descargarlos y verlos. Los documentos nuevos se destacan con un badge.' },
      { id: 'calidad', label: 'Calidad', description: 'Documentos del sistema de gestión de calidad (ISO, procedimientos, manuales). Documentos generales disponibles para consulta.' },
      { id: 'prevencion', label: 'Documentos PRL', description: 'Documentos de Prevención de Riesgos Laborales asignados a tu puesto, departamento o etiquetas. Incluye planes de prevención, evaluaciones de riesgos, protocolos de seguridad y entregas de EPIs.' },
      { id: 'formacion', label: 'Formación', description: 'Tus exámenes de formación y certificados obtenidos. Puedes ver el estado de cada examen (pendiente, completado) y consultar tus certificados de formación.' },
      { id: 'incidencias', label: 'Incidencias', description: 'Puedes reportar incidencias (problemas con vehículos, equipos, fichajes, etc.) con título, descripción y fotos. También puedes ver el historial de incidencias que has creado y su estado.' },
      { id: 'fichajes', label: 'Fichajes', description: 'Historial de tus fichajes de entrada y salida. Puedes ver los registros de jornada con fecha, hora y tipo de evento (entrada, pausa, salida).' },
    ],
  },
  {
    profileName: 'RRHH',
    profileDescription: 'Panel de Recursos Humanos. Gestión completa de empleados, contratos, vacaciones, certificaciones, documentos y más.',
    tabs: [
      { id: 'overview', label: 'Resumen RRHH', description: 'Panel de control con KPIs: total empleados, vacaciones pendientes, exámenes aprobados, certificados por vencer. Accesos directos a las secciones más usadas.' },
      { id: 'employees', label: 'Empleados', description: 'Gestión completa del catálogo de empleados. Puedes crear, editar y dar de baja empleados. Incluye filtros por sociedad, estado y búsqueda. Cada empleado tiene datos personales, contrato, departamento y documentación.' },
      { id: 'users', label: 'Gestión de Usuarios', description: 'Administración de usuarios del sistema con acceso al panel. Puedes crear usuarios, asignar roles, sociedades y reiniciar contraseñas. Los usuarios son las cuentas que acceden a la web; los empleados son los registros de personal.' },
      { id: 'prevencion', label: 'Prevención/Calidad', description: 'Acceso al panel de Prevención de Riesgos Laborales y Calidad. Permite gestionar documentos PRL, etiquetas, trazabilidad y departamentos.' },
      { id: 'vehicles', label: 'Vehículos', description: 'Gestión de la flota de vehículos. Puedes registrar vehículos (matrícula, marca, modelo, kilometraje), ver su estado (libre/en uso), historial de uso por empleado e incidencias.' },
      { id: 'documents', label: 'Documentos', description: 'Gestor de documentos generales. Puedes subir, organizar en carpetas y asignar documentos a empleados o sociedades. Incluye documentos públicos y privados.' },
      { id: 'personal-docs', label: 'Documentos Personales', description: 'Documentos personales de cada empleado (DNI, contrato, Seguridad Social). Organizados por empleado con historial de versiones.' },
      { id: 'pdf-split', label: 'Nóminas', description: 'Herramienta para subir un PDF con múltiples nóminas y dividirlo automáticamente en archivos individuales por empleado. El sistema detecta el DNI en cada página y asigna la nómina al empleado correspondiente.' },
      { id: 'contratos', label: 'Contratos', description: 'Gestión de contratos de empleados. Muestra contratos pendientes de revisión o aviso. Puedes cambiar estados (pendiente, avisado, firmado, finalizado) y llevar el historial de cambios de estado.' },
      { id: 'vacations', label: 'Vacaciones', description: 'Aprobación y gestión de solicitudes de vacaciones. Puedes ver solicitudes pendientes, aprobarlas o rechazarlas, y consultar el historial de vacaciones por empleado y sociedad.' },
      { id: 'certificates', label: 'Certificaciones', description: 'Gestión de certificados de empleados (cursos, habilitaciones, permisos). Puedes ver certificados por vencer, añadir nuevos y llevar el seguimiento de renovaciones.' },
      { id: 'exams', label: 'Exámenes', description: 'Gestión de exámenes de formación. Puedes crear exámenes, asignarlos a empleados, ver resultados y estados (pendiente, completado, suspendido).' },
      { id: 'facturas', label: 'Facturas', description: 'Gestión de facturas. Puedes registrar facturas con proveedor, número, fecha, importe e IVA. Incluye filtros y exportación.' },
      { id: 'audit', label: 'Auditoría', description: 'Registro de auditoría del sistema. Muestra quién hizo qué acción, cuándo y desde dónde. Útil para trazabilidad y cumplimiento normativo.' },
      { id: 'incidencias', label: 'Incidencias', description: 'Gestión de incidencias reportadas por empleados o supervisores. Puedes ver todas las incidencias, cambiar su estado (pendiente, en proceso, resuelta) y asignarlas a departamentos.' },
      { id: 'fichajes', label: 'Fichajes', description: 'Gestión de fichajes de todos los empleados. Puedes ver registros, filtrar por fecha y empleado, y gestionar correcciones solicitadas por los empleados.' },
      { id: 'bajas', label: 'Bajas/Ausencias', description: 'Gestión de bajas médicas y ausencias de empleados. Puedes registrar bajas con fechas, motivo, justificante y llevar el seguimiento de ausencias y absentismo.' },
      { id: 'supervisor-empleados', label: 'Empleados Asignados', description: 'Solo visible para supervisores. Muestra los empleados asignados a tu supervisión con sus datos básicos y estado.' },
    ],
  },
  {
    profileName: 'Supervisor',
    profileDescription: 'Panel de Supervisor. Variante del panel RRHH con acceso limitado a las pestañas asignadas a supervisores.',
    tabs: [
      { id: 'overview', label: 'Resumen RRHH', description: 'Panel de control con KPIs de los empleados bajo tu supervisión.' },
      { id: 'employees', label: 'Empleados', description: 'Lista de empleados. Como supervisor puedes consultar datos de los empleados asignados a ti.' },
      { id: 'vehicles', label: 'Vehículos', description: 'Consulta del estado de vehículos de la flota. Puedes ver qué vehículos están libres o en uso.' },
      { id: 'vacations', label: 'Vacaciones', description: 'Aprobación de solicitudes de vacaciones de tus empleados. Puedes aprobar o rechazar solicitudes pendientes.' },
      { id: 'certificates', label: 'Certificaciones', description: 'Consulta de certificados de empleados a tu cargo y seguimiento de vencimientos.' },
      { id: 'exams', label: 'Exámenes', description: 'Consulta de exámenes de formación asignados a tus empleados.' },
      { id: 'facturas', label: 'Facturas', description: 'Consulta de facturas registradas en el sistema.' },
      { id: 'bajas', label: 'Bajas/Ausencias', description: 'Consulta de bajas y ausencias de tus empleados.' },
      { id: 'supervisor-empleados', label: 'Empleados Asignados', description: 'Lista de los empleados específicamente asignados a tu supervisión.' },
    ],
  },
  {
    profileName: 'Admin',
    profileDescription: 'Panel de Administración del sistema. Acceso total a todas las funcionalidades, configuración y gestión de sociedades.',
    tabs: [
      { id: 'overview', label: 'Panel General', description: 'Dashboard con estadísticas globales del sistema: sociedades, empleados, documentos, certificados y vacaciones pendientes. Acceso rápido a cada sociedad.' },
      { id: 'employees', label: 'Empleados', description: 'Gestión completa de todos los empleados del sistema, independientemente de la sociedad. Crear, editar, dar de baja y consultar.' },
      { id: 'users', label: 'Gestión de Usuarios', description: 'Administración de usuarios del sistema. Crear cuentas, asignar roles (admin, RRHH, prevención, etc.), sociedades y permisos. Reiniciar contraseñas.' },
      { id: 'societies', label: 'Sociedades', description: 'Gestión de sociedades/empresas del grupo. Puedes crear sociedades, configurar temas (colores, logo), asignar centros de trabajo y gestionar la estructura empresarial.' },
      { id: 'vehicles', label: 'Vehículos', description: 'Gestión completa de la flota de vehículos de todas las sociedades.' },
      { id: 'documents', label: 'Documentos', description: 'Gestor central de documentos del sistema. Subir, organizar y distribuir documentos a empleados y sociedades.' },
      { id: 'devices', label: 'Dispositivos', description: 'Gestión de dispositivos asignados a empleados (móviles, tablets, portátiles). Puedes registrar dispositivos, asignarlos a empleados y llevar el seguimiento de estado.' },
      { id: 'vacations', label: 'Vacaciones', description: 'Gestión global de solicitudes de vacaciones de todas las sociedades.' },
      { id: 'prevencion', label: 'Prevención/Calidad', description: 'Acceso al panel de Prevención de Riesgos Laborales y Calidad con todas sus herramientas.' },
      { id: 'tags', label: 'Tags PRL', description: 'Gestión de etiquetas de PRL (Prevención de Riesgos Laborales). Las etiquetas permiten clasificar documentos PRL por tipo, riesgo, departamento, etc. y asignarlos a los empleados correspondientes.' },
      { id: 'roles', label: 'Roles', description: 'Gestión de roles personalizados del sistema. Puedes crear roles, asignar permisos y configurar qué pestañas ve cada rol.' },
      { id: 'departamentos', label: 'Departamentos', description: 'Gestión de departamentos de la empresa. Los departamentos se usan para enrutar incidencias y organizar documentos PRL.' },
      { id: 'email', label: 'Email', description: 'Módulo de envío de emails. Puedes configurar plantillas de email y enviar comunicaciones a empleados, recordatorios de formación, notificaciones de nóminas, etc.' },
      { id: 'audit', label: 'Auditoría', description: 'Registro completo de auditoría del sistema. Todas las acciones realizadas por todos los usuarios quedan registradas para trazabilidad.' },
      { id: 'css', label: 'CSS', description: 'Editor de estilos CSS personalizados. Puedes modificar la apariencia visual del portal del empleado (colores, tipografías, espaciados) sin tocar el código.' },
      { id: 'incidencias', label: 'Incidencias', description: 'Gestión global de todas las incidencias del sistema, de todas las sociedades y departamentos.' },
      { id: 'fichajes', label: 'Fichajes', description: 'Gestión global de fichajes de todos los empleados del sistema.' },
      { id: 'permissions', label: 'Permisos de Perfiles', description: 'Configuración de permisos por pestaña y por rol. Puedes decidir qué pestañas ve cada perfil (RRHH, supervisor, etc.) activando o desactivando cada pestaña individualmente.' },
    ],
  },
  {
    profileName: 'Prevención',
    profileDescription: 'Panel de Prevención de Riesgos Laborales. Gestión de documentos PRL, trazabilidad, reconocimientos médicos y departamentos.',
    tabs: [
      { id: 'empleados', label: 'Empleados y Tags', description: 'Lista de empleados con sus etiquetas PRL asignadas. Puedes asignar o quitar etiquetas a empleados para que reciban los documentos PRL correspondientes a su puesto y riesgos.' },
      { id: 'documentos', label: 'Documentos PRL', description: 'Gestión de documentos de Prevención de Riesgos Laborales. Puedes subir documentos, organizarlos en carpetas, asignar etiquetas y controlar qué empleados tienen acceso a cada documento.' },
      { id: 'trazabilidad', label: 'Trazabilidad', description: 'Seguimiento de la entrega y descarga de documentos PRL por parte de los empleados. Puedes ver quién ha descargado cada documento, cuándo, y generar estadísticas de cumplimiento.' },
      { id: 'departamentos', label: 'Departamentos PRL', description: 'Gestión de departamentos desde la perspectiva PRL. Permite asignar documentos y protocolos de prevención a departamentos específicos.' },
      { id: 'reconocimiento', label: 'Reconocimiento Médico', description: 'Gestión de reconocimientos médicos de empleados. Puedes registrar fechas de reconocimiento, estado (pendiente, completado, vencido) y programar renovaciones.' },
      { id: 'vitaly', label: 'Vitaly', description: 'Módulo de gestión de la plataforma Vitaly para el seguimiento de la salud laboral y bienestar de los empleados.' },
    ],
  },
  {
    profileName: 'Calidad',
    profileDescription: 'Panel de Calidad. Gestión de documentos del sistema de gestión de calidad.',
    tabs: [
      { id: 'documentos', label: 'Documentos', description: 'Lista de documentos de calidad disponibles en el sistema. Puedes consultar, descargar y organizar documentos del sistema de gestión (procedimientos, manuales, instrucciones, registros).' },
      { id: 'subir', label: 'Subir', description: 'Herramienta para subir nuevos documentos de calidad al sistema. Puedes arrastrar archivos, asignar categorías y descripciones.' },
    ],
  },
  {
    profileName: 'Formación',
    profileDescription: 'Panel de Formación. Gestión de exámenes y asignaciones de formación a empleados.',
    tabs: [
      { id: 'examenes', label: 'Exámenes', description: 'Gestión de exámenes de formación. Puedes crear exámenes con preguntas, asignarlos a empleados o grupos, y consultar resultados y estadísticas de aprobación.' },
      { id: 'asignaciones', label: 'Asignaciones', description: 'Gestión de asignaciones de formación. Puedes asignar exámenes o cursos a empleados específicos, ver el progreso y enviar recordatorios a quienes no hayan completado la formación.' },
    ],
  },
  {
    profileName: 'Administración',
    profileDescription: 'Panel de Administración. Gestión de facturas y tareas administrativas.',
    tabs: [
      { id: 'facturas', label: 'Facturas', description: 'Gestión de facturas. Puedes registrar facturas con todos sus datos (proveedor, número, fecha, base imponible, IVA, total), filtrar por sociedad y periodo, y exportar listados. Como administración tienes permisos extendidos sobre el módulo.' },
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
                Guía de todas las pestañas disponibles según el perfil. Descarga el manual en PDF de cada perfil para saber cómo funciona la web.
              </p>
            </div>
          </div>
          <button
            onClick={generateAllPDFs}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:opacity-80 flex-shrink-0"
            style={{ backgroundColor: accentColor, color: '#FFFFFF' }}
          >
            <Download size={16} />
            Descargar todos los manuales
          </button>
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
