import { useState } from 'react';
import { Pill, Check, X, Loader2 } from 'lucide-react';
import type { Medicacion } from './CrmTratamientosModule';

export interface TomaRegistro {
  medicacionId: string;
  tomada: boolean;
  anotacion: string;
  registradoPorNombre: string;
  updatedAt: string;
}

interface Props {
  residente: string;
  tratamiento: string;
  medicacion: Medicacion;
  guardando: boolean;
  onGuardar: (tomada: boolean, anotacion: string) => void;
}

export default function CrmMedicacionTomaRow({ residente, tratamiento, medicacion, guardando, onGuardar }: Props) {
  const [enNo, setEnNo] = useState(false);
  const [anotacion, setAnotacion] = useState('');
  const anotacionValida = anotacion.trim().length > 0;

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
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

      {!enNo ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onGuardar(true, '')}
            disabled={guardando}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: '#FFFFFF', color: '#15803D', border: '1px solid #BBF7D0' }}
          >
            {guardando ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Sí
          </button>
          <button
            type="button"
            onClick={() => setEnNo(true)}
            disabled={guardando}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            style={{ backgroundColor: '#FFFFFF', color: '#B91C1C', border: '1px solid #FECACA' }}
          >
            <X size={12} /> No
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            autoFocus
            value={anotacion}
            onChange={(e) => setAnotacion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && anotacionValida && !guardando) onGuardar(false, anotacion.trim()); }}
            maxLength={300}
            placeholder="Anotación: motivo por el que no se toma"
            className="w-full px-3 py-2 rounded-lg text-xs outline-none"
            style={{ border: '1px solid #FECACA', backgroundColor: '#FFFFFF', color: '#0F172A' }}
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onGuardar(false, anotacion.trim())}
              disabled={!anotacionValida || guardando}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              style={{ backgroundColor: '#B91C1C', color: '#FFFFFF', border: '1px solid #B91C1C' }}
            >
              {guardando && <Loader2 size={12} className="animate-spin" />} Guardar
            </button>
            <button
              type="button"
              onClick={() => { setEnNo(false); setAnotacion(''); }}
              disabled={guardando}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:cursor-not-allowed"
              style={{ backgroundColor: '#F1F5F9', color: '#334155' }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CrmTomaRegistradaItem({ residente, medicacion, registro }: { residente: string; medicacion: Medicacion; registro: TomaRegistro }) {
  const hora = new Date(registro.updatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{residente}</p>
        <span
          className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
          style={registro.tomada
            ? { backgroundColor: '#F0FDF4', color: '#15803D' }
            : { backgroundColor: '#FEF2F2', color: '#B91C1C' }}
        >
          {registro.tomada ? 'Tomada' : 'No tomada'}
        </span>
      </div>
      <p className="text-xs" style={{ color: '#1E293B' }}>{medicacion.nombre}{medicacion.dosis ? ` · ${medicacion.dosis}` : ''}</p>
      {!registro.tomada && registro.anotacion && <p className="text-xs" style={{ color: '#B91C1C' }}>{registro.anotacion}</p>}
      <p className="text-[11px]" style={{ color: '#64748B' }}>
        Registrado por {registro.registradoPorNombre || 'usuario'} a las {hora}
      </p>
    </div>
  );
}
