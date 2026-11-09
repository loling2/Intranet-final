import { useState } from 'react';
import CrmAsignacionPanel from './CrmAsignacionPanel';
import CrmPermisosModule from './CrmPermisosModule';
import {
  alternarCentroTrabajador,
  alternarCoordinadorSupervisor,
  alternarEmpleadoCoordinador,
  cargarCentrosPorTrabajador,
  cargarCoordinadoresPorSupervisor,
  cargarEmpleadosPorCoordinador,
} from '../lib/crmAsignaciones';

type SeccionId = 'admin' | 'supervisor' | 'coordinador' | 'empleado';

const SECCIONES: { id: SeccionId; label: string }[] = [
  { id: 'admin', label: 'Admin / RRHH' },
  { id: 'supervisor', label: 'Supervisor' },
  { id: 'coordinador', label: 'Coordinador' },
  { id: 'empleado', label: 'Empleado' },
];

export default function CrmAsignacionesTabs() {
  const [seccion, setSeccion] = useState<SeccionId>('empleado');

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F1F5F9' }}>
        {SECCIONES.map((s) => {
          const activa = s.id === seccion;
          return (
            <button key={s.id} onClick={() => setSeccion(s.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{
                backgroundColor: activa ? '#FFFFFF' : 'transparent',
                color: activa ? '#0369A1' : '#475569',
                boxShadow: activa ? '0 1px 2px rgba(15, 23, 42, 0.08)' : 'none',
              }}>
              {s.label}
            </button>
          );
        })}
      </div>

      {seccion === 'admin' && (
        <div className="rounded-xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Admin / RRHH</h2>
          <p className="text-sm mt-2" style={{ color: '#64748B' }}>
            Los perfiles de Admin y RRHH ven todas las pestañas y todos los residentes, por lo que no necesitan asignaciones.
          </p>
        </div>
      )}

      {seccion !== 'admin' && <CrmPermisosModule />}

      {seccion === 'supervisor' && (
        <CrmAsignacionPanel
          key="supervisor"
          titulo="Supervisores"
          descripcion="Asigna a cada supervisor los coordinadores que tiene a su cargo."
          tituloIzquierda="Supervisores"
          tituloDerecha="Coordinadores"
          textoVacioIzquierda="No hay supervisores dados de alta"
          unidad={{ singular: 'coordinador', plural: 'coordinadores' }}
          cargar={cargarCoordinadoresPorSupervisor}
          alternar={alternarCoordinadorSupervisor}
        />
      )}

      {seccion === 'coordinador' && (
        <CrmAsignacionPanel
          key="coordinador"
          titulo="Coordinadores"
          descripcion="Asigna a cada coordinador los empleados que debe controlar."
          tituloIzquierda="Coordinadores"
          tituloDerecha="Empleados"
          textoVacioIzquierda="No hay coordinadores dados de alta"
          unidad={{ singular: 'empleado', plural: 'empleados' }}
          cargar={cargarEmpleadosPorCoordinador}
          alternar={alternarEmpleadoCoordinador}
        />
      )}

      {seccion === 'empleado' && (
        <CrmAsignacionPanel
          key="empleado"
          titulo="Empleados"
          descripcion="Asigna los centros donde trabaja cada empleado. Verá los residentes de esos centros y todas las pestañas."
          tituloIzquierda="Empleados"
          tituloDerecha="Centros"
          textoVacioIzquierda="No hay empleados que coincidan"
          unidad={{ singular: 'centro', plural: 'centros' }}
          cargar={cargarCentrosPorTrabajador}
          alternar={alternarCentroTrabajador}
        />
      )}
    </div>
  );
}
