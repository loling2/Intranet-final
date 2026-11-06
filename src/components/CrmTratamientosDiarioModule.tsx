import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { ChevronLeft, ChevronRight, Loader2, AlertCircle, Sun, Sunset, Moon, Building2 } from 'lucide-react';
import type { Medicacion, Pauta } from './CrmTratamientosModule';
import CrmMedicacionTomaRow, { CrmTomaRegistradaItem, type TomaRegistro } from './CrmMedicacionTomaRow';

interface TratamientoDiario {
  id: string;
  nombre: string;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: 'en_proceso' | 'finalizado';
  usuarios_servicios: {
    nombre: string;
    apellidos: string | null;
    activo: boolean | null;
    usuarios_servicios_centros: { centro_id: string }[] | null;
  } | null;
  crm_tratamiento_medicaciones: Medicacion[];
}

interface TomaDb {
  medicacion_id: string;
  tomada: boolean;
  anotacion: string;
  registrado_por_nombre: string;
  updated_at: string;
}

interface CentroOption { id: string; nombre: string; }

interface EntradaTurno {
  key: string;
  medicacionId: string;
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
  const [centros, setCentros] = useState<CentroOption[]>([]);
  const [filterCentro, setFilterCentro] = useState('');
  const [tomas, setTomas] = useState<Record<string, TomaRegistro>>({});
  const [guardandoId, setGuardandoId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoy] = useState(() => new Date());
  const [seleccionado, setSeleccionado] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()));

  const semanaInicio = useMemo(() => startOfWeek(seleccionado), [seleccionado]);
  const diasSemana = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(semanaInicio, i)), [semanaInicio]);
  const diaIso = toIsoDate(seleccionado);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [tratRes, centrosRes] = await Promise.all([
      supabase
        .from('crm_tratamientos')
        .select('id, nombre, fecha_inicio, fecha_fin, estado, usuarios_servicios(nombre, apellidos, activo, usuarios_servicios_centros(centro_id)), crm_tratamiento_medicaciones(*)')
        .eq('estado', 'en_proceso'),
      supabase.from('centros').select('id, nombre').order('nombre'),
    ]);
    if (tratRes.error) {
      setError('No se pudieron cargar los tratamientos.');
      setTratamientos([]);
    } else {
      setTratamientos((tratRes.data ?? []) as unknown as TratamientoDiario[]);
    }
    setCentros((centrosRes.data ?? []) as CentroOption[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let cancelado = false;
    setTomas({});
    supabase
      .from('crm_tratamiento_tomas')
      .select('medicacion_id, tomada, anotacion, registrado_por_nombre, updated_at')
      .eq('fecha', diaIso)
      .then(({ data, error: err }) => {
        if (cancelado) return;
        if (err) {
          setError('No se pudieron cargar los registros de tomas.');
          return;
        }
        const mapa: Record<string, TomaRegistro> = {};
        for (const fila of (data ?? []) as TomaDb[]) {
          mapa[fila.medicacion_id] = {
            medicacionId: fila.medicacion_id,
            tomada: fila.tomada,
            anotacion: fila.anotacion ?? '',
            registradoPorNombre: fila.registrado_por_nombre ?? '',
            updatedAt: fila.updated_at,
          };
        }
        setTomas(mapa);
      });
    return () => { cancelado = true; };
  }, [diaIso]);

  const guardarToma = async (medicacionId: string, tomada: boolean, anotacion: string) => {
    setGuardandoId(medicacionId);
    setError('');
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id ?? null;
    let nombre = auth.user?.email ?? '';
    if (userId) {
      const { data: empleado } = await supabase
        .from('empleados')
        .select('nombre, apellidos')
        .eq('user_id', userId)
        .maybeSingle();
      if (empleado) nombre = `${empleado.nombre} ${empleado.apellidos ?? ''}`.trim();
    }
    const updatedAt = new Date().toISOString();
    const textoAnotacion = tomada ? '' : anotacion;
    const { error: err } = await supabase
      .from('crm_tratamiento_tomas')
      .upsert(
        { medicacion_id: medicacionId, fecha: diaIso, tomada, anotacion: textoAnotacion, registrado_por: userId, registrado_por_nombre: nombre, updated_at: updatedAt },
        { onConflict: 'medicacion_id,fecha' },
      );
    setGuardandoId(null);
    if (err) {
      setError('No se pudo guardar el registro. Inténtalo de nuevo.');
      return;
    }
    setTomas((prev) => ({
      ...prev,
      [medicacionId]: { medicacionId, tomada, anotacion: textoAnotacion, registradoPorNombre: nombre, updatedAt },
    }));
  };

  const entradasPorTurno = useMemo(() => {
    const grupos: Record<Pauta, EntradaTurno[]> = { manana: [], tarde: [], noche: [] };
    for (const t of tratamientos) {
      if (!t.usuarios_servicios || t.usuarios_servicios.activo === false) continue;
      if (!aplicaEnDia(t, diaIso)) continue;
      const centrosResidente = (t.usuarios_servicios.usuarios_servicios_centros ?? []).map((c) => c.centro_id);
      if (filterCentro && !centrosResidente.includes(filterCentro)) continue;
      const residente = `${t.usuarios_servicios.nombre} ${t.usuarios_servicios.apellidos ?? ''}`.trim();
      for (const med of t.crm_tratamiento_medicaciones) {
        grupos[med.pauta].push({ key: `${t.id}-${med.id}`, medicacionId: med.id, residente, tratamiento: t.nombre, medicacion: med });
      }
    }
    for (const turno of TURNOS) {
      grupos[turno.id].sort((a, b) => a.residente.localeCompare(b.residente) || a.medicacion.orden - b.medicacion.orden);
    }
    return grupos;
  }, [tratamientos, diaIso, filterCentro]);

  const esHoy = toIsoDate(hoy) === diaIso;
  const tituloDia = seleccionado.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Tratamientos del día</h2>
          <p className="text-xs mt-1" style={{ color: '#64748B' }}>Medicación que preparar por turno. Solo tratamientos en proceso.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <Building2 size={16} style={{ color: '#64748B' }} />
            <select
              value={filterCentro}
              onChange={(e) => setFilterCentro(e.target.value)}
              aria-label="Filtrar por centro"
              className="bg-transparent text-sm outline-none cursor-pointer min-w-[140px]"
              style={{ color: '#0F172A' }}
            >
              <option value="">Todos los centros</option>
              {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
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
            const pendientes = entradas.filter((e) => !tomas[e.medicacionId]);
            const registradas = entradas.filter((e) => tomas[e.medicacionId]);
            const TurnoIcon = turno.Icon;
            return (
              <div key={turno.id} className="rounded-2xl p-4 space-y-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: turno.color }}>
                    <span className="p-1.5 rounded-lg" style={{ backgroundColor: turno.bg, border: `1px solid ${turno.border}` }}><TurnoIcon size={14} /></span>
                    {turno.label}
                  </span>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{pendientes.length}</span>
                </div>
                {pendientes.length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>
                    {registradas.length === 0 ? 'Sin medicación en este turno' : 'Todo registrado en este turno'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendientes.map(entrada => (
                      <CrmMedicacionTomaRow
                        key={entrada.key}
                        residente={entrada.residente}
                        tratamiento={entrada.tratamiento}
                        medicacion={entrada.medicacion}
                        guardando={guardandoId === entrada.medicacionId}
                        onGuardar={(tomada, anotacion) => guardarToma(entrada.medicacionId, tomada, anotacion)}
                      />
                    ))}
                  </div>
                )}
                {registradas.length > 0 && (
                  <details className="group">
                    <summary className="text-xs font-medium cursor-pointer select-none" style={{ color: '#475569' }}>
                      Registradas ({registradas.length})
                    </summary>
                    <div className="space-y-2 mt-2">
                      {registradas.map(entrada => (
                        <CrmTomaRegistradaItem
                          key={entrada.key}
                          residente={entrada.residente}
                          medicacion={entrada.medicacion}
                          registro={tomas[entrada.medicacionId]}
                        />
                      ))}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
