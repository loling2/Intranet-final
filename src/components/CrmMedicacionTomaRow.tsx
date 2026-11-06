import { useState, useEffect } from 'react';
import { Pill, Check, X, Loader2 } from 'lucide-react';
import type { Medicacion } from './CrmTratamientosModule';

export interface TomaRegistro {
  tomada: boolean;
  anotacion: string;
}

interface Props {
  residente: string;
  tratamiento: string;
  medicacion: Medicacion;
  registro: TomaRegistro | undefined;
  guardando: boolean;
  onGuardar: (tomada: boolean, anotacion: string) => void;
}

export default function CrmMedicacionTomaRow({ residente, tratamiento, medicacion, registro, guardando, onGuardar }: Props) {
  const [anotacion, setAnotacion] = useState(registro?.anotacion ?? '');

  useEffect(() => {
    setAnotacion(registro?.anotacion ?? '');
  }, [registro?.anotacion]);

  const tomada = registro?.tomada;
  const pendiente = registro === undefined;

  const guardarAnotacion = () => {
    if (tomada === false && anotacion !== (registro?.anotacion ?? '')) onGuardar(false, anotacion.trim());
  };

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{residente}</p>
          <p className="flex items-center gap-1.5 text-xs mt-1 flex-wrap" style={{ color: '#1E293B' }}>
            <Pill size={12} style={{ color: '#0369A1' }} />
            <span className="font-medium">{medicacion.nombre}</span>
            {medicacion.dosis && <span style={{ color: '#64748B' }}>· {medicacion.dosis}</span>}
          </p>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>
            {tratamiento}
            {medicacion.frecuencia_horas ? ` · cada ${medicacion.frecuencia_horas} h` : ''}
          </p>
        </div>
        {guardando && <Loader2 size={14} className="animate-spin shrink-0 mt-1" style={{ color: '#0369A1' }} />}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onGuardar(true, '')}
          disabled={guardando}
          aria-pressed={tomada === true}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed"
          style={{
            backgroundColor: tomada === true ? '#15803D' : '#FFFFFF',
            color: tomada === true ? '#FFFFFF' : '#15803D',
            border: `1px solid ${tomada === true ? '#15803D' : '#BBF7D0'}`,
          }}
        >
          <Check size={12} /> Sí
        </button>
        <button
          type="button"
          onClick={() => onGuardar(false, anotacion.trim())}
          disabled={guardando}
          aria-pressed={tomada === false}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed"
          style={{
            backgroundColor: tomada === false ? '#B91C1C' : '#FFFFFF',
            color: tomada === false ? '#FFFFFF' : '#B91C1C',
            border: `1px solid ${tomada === false ? '#B91C1C' : '#FECACA'}`,
          }}
        >
          <X size={12} /> No
        </button>
        {pendiente && <span className="text-xs" style={{ color: '#94A3B8' }}>Pendiente</span>}
      </div>

      {tomada === false && (
        <input
          type="text"
          value={anotacion}
          onChange={(e) => setAnotacion(e.target.value)}
          onBlur={guardarAnotacion}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          maxLength={300}
          placeholder="Anotación: motivo por el que no se toma"
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ border: '1px solid #FECACA', backgroundColor: '#FFFFFF', color: '#0F172A' }}
        />
      )}
    </div>
  );
}
