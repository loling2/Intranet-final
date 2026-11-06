import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Pill, Sun, Sunset, Moon } from 'lucide-react';
import type { Medicacion, Pauta } from './CrmTratamientosModule';

interface TratamientoDiario {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: 'en_proceso' | 'finalizado';
  usuarios_servicios: { nombre: string; apellidos: string | null; activo: boolean | null } | null;
  crm_tratamiento_medicaciones: Medicacion[];
}

interface EntradaTurno {
  key: string;
  residente: string;
  tratamiento: string;
  medicacion: Medicacion;
}

const TURNOS: { id: Pauta; label: string; Icon: typeof Sun; color: string; bg: string; border: string }[] = [
  { id: 'manana', label: 'Mañana', Icon: Sun, color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
  { id: 'tarde', label: 'Tarde', Icon: Sunset, color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA' },
  { id: 'noche', label: 'Noche', Icon: Moon, color: '#1E3A8A', bg: '#EFF6FF', border: '#BFDBFE' },
];

const DIAS_SEMANA = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfWeek(date: Date): Date {
  const lunes = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  lunes.setDate(lunes.getDate() - ((lunes.getDay() + 6) % 7));
  return lunes;
}

function addDays(date: Date, dias: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + dias);
  return next;
}

function aplicaEnDia(tratamiento: TratamientoDiario, dia: string): boolean {
  const desdeOk = !tratamiento.fecha_inicio || tratamiento.fecha_inicio <= dia;
  const hastaOk = !tratamiento.fecha_fin || tratamiento.fecha_fin >= dia;
  return desdeOk && hastaOk;
}

export default function CrmTratamientosDiarioModule() {
  const [tratamientos, setTratamientos] = useState<TratamientoDiario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoy] = useState(() => new Date());
  const [seleccionado, setSeleccionado] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  const semanaInicio = useMemo(() => startOfWeek(seleccionado), [seleccionado]);
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)), [semanaInicio]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: err } = await supabase
      .from('crm_tratamientos')
      .select('id, nombre, fecha_inicio, fecha_fin, estado, usuarios_servicios(nombre, apellidos, activo), crm_tratamiento_medicaciones(*)')
      .eq('estado', 'en_proceso');
    if (err) {
      setError('No se pudieron cargar los tratamientos.');
      setTratamientos([]);
    } else {
      setTratamientos((data ?? []) as unknown as TratamientoDiario[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const diaIso = toIsoDate(seleccionado);

  const entradasPorTurno = useMemo(() => {
    const grupos: Record<Pauta, EntradaTurno[]> = { manana: [], tarde: [], noche: [] };
    for (const t of tratamientos) {
      if (!t.usuarios_servicios || t.usuarios_servicios.activo === false) continue;
      if (!aplicaEnDia(t, diaIso)) continue;
      const residente = `${t.usuarios_servicios.nombre} ${t.usuarios_servicios.apellidos ?? ''}`.trim();
      for (const med of t.crm_tratamiento_medicaciones) {
        grupos[med.pauta].push({ key: `${t.id}-${med.id}`, residente, tratamiento: t.nombre, medicacion: med });
      }
    }
    for (const turno of TURNOS) {
      grupos[turno.id].sort((a, b) => a.residente.localeCompare(b.residente) || a.medicacion.orden - b.medicacion.orden);
    }
    return grupos;
  }, [tratamientos, diaIso]);

  const esHoy = toIsoDate(hoy) === diaIso;
  const tituloDia = seleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Tratamientos del día</h2>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>Medicación que preparar por turno. Solo tratamientos en proceso.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSeleccionado(addDays(semanaInicio, -7))} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-100" aria-label="Semana anterior">
            <ChevronLeft size={16} style={{ color: '#475569' }} />
          </button>
          <button onClick={() => setSeleccionado(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()))} className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#334155' }}>Hoy</button>
          <button onClick={() => setSeleccionado(addDays(semanaInicio, 7))} className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-slate-100" aria-label="Semana siguiente">
            <ChevronRight size={16} style={{ color: '#475569' }} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {diasSemana.map((dia, index) => {
          const iso = toIsoDate(dia);
          const activo = iso === diaIso;
          const esDiaHoy = iso === toIsoDate(hoy);
          return (
            <button
              key={iso}
              onClick={() => setSeleccionado(dia)}
              className="flex flex-col items-center py-2.5 rounded-xl cursor-pointer transition-all"
              style={{
                backgroundColor: activo ? '#0369A1' : '#FFFFFF',
                border: `1px solid ${activo ? '#0369A1' : esDiaHoy ? '#7DD3FC' : '#E2E8F0'}`,
                color: activo ? '#FFFFFF' : '#0F172A',
              }}
            >
              <span className="text-[11px] font-medium" style={{ color: activo ? '#E0F2FE' : '#64748B' }}>{DIAS_SEMANA[index]}</span>
              <span className="text-base font-bold">{dia.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold capitalize" style={{ color: '#0F172A' }}>{tituloDia}{esHoy ? ' (hoy)' : ''}</h3>
      </div>

      {error && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} />{error}</p>}

      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin" style={{ color: '#0369A1' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TURNOS.map(turno => {
            const entradas = entradasPorTurno[turno.id];
            const TurnoIcon = turno.Icon;
            return (
              <div key={turno.id} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: turno.color }}>
                    <span className="p-1.5 rounded-lg" style={{ backgroundColor: turno.bg, border: `1px solid ${turno.border}` }}><TurnoIcon size={14} /></span>
                    {turno.label}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{entradas.length}</span>
                </div>
                {entradas.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>Sin medicación en este turno</p>
                ) : (
                  <div className="space-y-2">
                    {entradas.map(entrada => (
                      <div key={entrada.key} className="rounded-xl p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{entrada.residente}</p>
                        <p className="flex items-center gap-1.5 text-xs mt-1" style={{ color: '#1E293B' }}>
                          <Pill size={12} style={{ color: '#0369A1' }} />
                          <span className="font-medium">{entrada.medicacion.nombre}</span>
                          {entrada.medicacion.dosis && <span style={{ color: '#64748B' }}>· {entrada.medicacion.dosis}</span>}
                        </p>
                        <p className="text-xs mt-1" style={{ color: '#64748B' }}>
                          {entrada.tratamiento}
                          {entrada.medicacion.frecuencia_horas ? ` · cada ${entrada.medicacion.frecuencia_horas} h` : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
