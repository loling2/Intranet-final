import { useState } from 'react';
import { X } from 'lucide-react';
import { TURNOS_PREDEFINIDOS, ETIQUETA_TURNO, aHoraCorta, type TurnoPlanificado } from '../lib/cuadrantes';
import { eliminarTurnoPlanificado, guardarTurnoPlanificado } from '../lib/cuadrantesData';

interface Props {
  empleadoId: string;
  empleadoNombre: string;
  centroId: string;
  fecha: string;
  planificado: TurnoPlanificado | undefined;
  onCerrar: () => void;
  onGuardado: () => void;
}

export default function TurnoAsignacionModal({ empleadoId, empleadoNombre, centroId, fecha, planificado, onCerrar, onGuardado }: Props) {
  const [inicio, setInicio] = useState(planificado ? aHoraCorta(planificado.inicio) : '07:00');
  const [fin, setFin] = useState(planificado ? aHoraCorta(planificado.fin) : '15:00');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const fechaLegible = new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

  const guardar = async () => {
    if (!inicio || !fin || inicio === fin) {
      setError('Indica una hora de inicio y de fin distintas.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      await guardarTurnoPlanificado({ empleado_id: empleadoId, centro_id: centroId, fecha, inicio, fin });
      onGuardado();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar el turno.');
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    setGuardando(true);
    setError('');
    try {
      await eliminarTurnoPlanificado(empleadoId, fecha);
      onGuardado();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'No se pudo quitar el turno.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCerrar}>
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold" style={{ color: '#0F172A' }}>
              {planificado ? 'Modificar turno' : 'Asignar turno'}
            </h3>
            <p className="text-sm" style={{ color: '#64748B' }}>{empleadoNombre}</p>
            <p className="text-xs capitalize" style={{ color: '#94A3B8' }}>{fechaLegible}</p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Cerrar">
            <X size={16} style={{ color: '#475569' }} />
          </button>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          {TURNOS_PREDEFINIDOS.map((t) => (
            <button
              key={t.tipo}
              type="button"
              onClick={() => { setInicio(t.inicio); setFin(t.fin); }}
              className="rounded-lg border px-3 py-2 text-left text-sm transition-colors hover:bg-slate-50"
              style={{ borderColor: inicio === t.inicio && fin === t.fin ? '#2563EB' : '#CBD5E1', color: '#0F172A' }}
            >
              <span className="block font-medium">{ETIQUETA_TURNO[t.tipo]}</span>
              <span className="block font-mono text-xs" style={{ color: '#64748B' }}>{t.inicio} - {t.fin}</span>
            </button>
          ))}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: '#475569' }}>
            Inicio
            <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#CBD5E1', color: '#0F172A' }} />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium" style={{ color: '#475569' }}>
            Fin
            <input type="time" value={fin} onChange={(e) => setFin(e.target.value)}
              className="rounded-lg border px-3 py-2 text-sm" style={{ borderColor: '#CBD5E1', color: '#0F172A' }} />
          </label>
        </div>

        {error && <p className="mb-3 text-sm" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex items-center justify-between gap-2">
          {planificado ? (
            <button type="button" onClick={quitar} disabled={guardando}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-red-50 disabled:opacity-50"
              style={{ color: '#DC2626' }}>
              Quitar turno
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} disabled={guardando}
              className="rounded-lg border px-4 py-2 text-sm font-medium transition-colors hover:bg-slate-50 disabled:opacity-50"
              style={{ borderColor: '#CBD5E1', color: '#334155' }}>
              Cancelar
            </button>
            <button type="button" onClick={guardar} disabled={guardando}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#1D4ED8' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
