import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  construirTurnos,
  formatHora,
  getWeekDays,
  getWeekStart,
  toFechaISO,
  type FichajeEvento,
  type TurnoRealizado,
} from '../lib/cuadrantes';

interface CentroOpcion {
  id: string;
  nombre: string;
}

interface EmpleadoCuadrante {
  id: string;
  nombre: string;
  apellidos: string | null;
  puesto: string | null;
}

interface ColorPuesto {
  bg: string;
  border: string;
  text: string;
}

const PALETA: ColorPuesto[] = [
  { bg: '#DBEAFE', border: '#2563EB', text: '#1E3A8A' },
  { bg: '#DCFCE7', border: '#16A34A', text: '#14532D' },
  { bg: '#FEF3C7', border: '#D97706', text: '#78350F' },
  { bg: '#FCE7F3', border: '#DB2777', text: '#831843' },
  { bg: '#CCFBF1', border: '#0D9488', text: '#134E4A' },
  { bg: '#FFEDD5', border: '#EA580C', text: '#7C2D12' },
  { bg: '#E0F2FE', border: '#0284C7', text: '#075985' },
  { bg: '#ECFCCB', border: '#65A30D', text: '#365314' },
  { bg: '#FEE2E2', border: '#DC2626', text: '#7F1D1D' },
  { bg: '#E2E8F0', border: '#475569', text: '#1E293B' },
];

const SIN_PUESTO = 'Sin puesto';
const DIAS_SEMANA = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

const formatoRango = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });

const nombreCompleto = (e: EmpleadoCuadrante) => [e.apellidos, e.nombre].filter(Boolean).join(', ');

export default function CuadrantesModule() {
  const [centros, setCentros] = useState<CentroOpcion[]>([]);
  const [centroId, setCentroId] = useState('');
  const [semana, setSemana] = useState(() => getWeekStart(new Date()));
  const [empleados, setEmpleados] = useState<EmpleadoCuadrante[]>([]);
  const [turnos, setTurnos] = useState<Map<string, TurnoRealizado[]>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const dias = useMemo(() => getWeekDays(semana), [semana]);
  const hoyISO = toFechaISO(new Date());

  useEffect(() => {
    supabase
      .from('centros')
      .select('id, nombre')
      .order('nombre')
      .then(({ data, error: err }) => {
        if (err) {
          console.error('cuadrantes: centros', err);
          setError('No se pudieron cargar los centros.');
          return;
        }
        setCentros((data as CentroOpcion[]) ?? []);
      });
  }, []);

  useEffect(() => {
    if (!centroId) {
      setEmpleados([]);
      setTurnos(new Map());
      return;
    }
    let cancelado = false;

    const cargar = async () => {
      setLoading(true);
      setError('');
      const desde = toFechaISO(semana);
      const hasta = toFechaISO(dias[6]);
      const hastaConMargen = toFechaISO(new Date(dias[6].getTime() + 24 * 60 * 60 * 1000));

      const { data: fichajesData, error: fichajesErr } = await supabase
        .from('fichajes')
        .select('empleado_id, fecha, timestamp, tipo_evento')
        .eq('centro_id', centroId)
        .gte('fecha', desde)
        .lte('fecha', hastaConMargen)
        .in('tipo_evento', ['entrada', 'salida'])
        .order('timestamp', { ascending: true })
        .limit(10000);

      if (cancelado) return;
      if (fichajesErr) {
        console.error('cuadrantes: fichajes', fichajesErr);
        setError('No se pudieron cargar los fichajes del centro.');
        setLoading(false);
        return;
      }

      const eventos = (fichajesData as FichajeEvento[]) ?? [];
      const idsConFichajes = [...new Set(eventos.map((e) => e.empleado_id))];

      const { data: asignadosData, error: asignadosErr } = await supabase
        .from('empleados')
        .select('id, nombre, apellidos, puesto')
        .eq('centro_id', centroId)
        .eq('activo', true);

      if (cancelado) return;

      let fichadosData: EmpleadoCuadrante[] = [];
      if (idsConFichajes.length > 0) {
        const { data, error: fichadosErr } = await supabase
          .from('empleados')
          .select('id, nombre, apellidos, puesto')
          .in('id', idsConFichajes);
        if (cancelado) return;
        if (fichadosErr) {
          console.error('cuadrantes: empleados fichados', fichadosErr);
          setError('No se pudieron cargar los empleados.');
          setLoading(false);
          return;
        }
        fichadosData = (data as EmpleadoCuadrante[]) ?? [];
      }

      if (asignadosErr) {
        console.error('cuadrantes: empleados', asignadosErr);
        setError('No se pudieron cargar los empleados.');
        setLoading(false);
        return;
      }

      const porId = new Map<string, EmpleadoCuadrante>();
      [...((asignadosData as EmpleadoCuadrante[]) ?? []), ...fichadosData].forEach((e) => porId.set(e.id, e));

      setEmpleados([...porId.values()]);
      setTurnos(construirTurnos(eventos));
      setLoading(false);
    };

    cargar();
    return () => {
      cancelado = true;
    };
  }, [centroId, semana, dias]);

  const coloresPorPuesto = useMemo(() => {
    const puestos = [...new Set(empleados.map((e) => e.puesto || SIN_PUESTO))].sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    return new Map(puestos.map((p, i) => [p, PALETA[i % PALETA.length]]));
  }, [empleados]);

  const filas = useMemo(
    () =>
      [...empleados].sort((a, b) => {
        const pa = a.puesto || SIN_PUESTO;
        const pb = b.puesto || SIN_PUESTO;
        return pa.localeCompare(pb, 'es') || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');
      }),
    [empleados]
  );

  const turnosDelDia = (empleadoId: string, fecha: string) =>
    (turnos.get(empleadoId) ?? []).filter((t) => t.fecha === fecha);

  const irASemana = (dias_: number) => {
    const nueva = new Date(semana);
    nueva.setDate(semana.getDate() + dias_);
    setSemana(nueva);
  };

  const rangoSemana = `${formatoRango.format(dias[0])} - ${formatoRango.format(dias[6])} ${dias[6].getFullYear()}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Cuadrantes</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Horarios fichados por centro y semana</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={centroId}
            onChange={(e) => setCentroId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
          >
            <option value="">Selecciona un centro</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => irASemana(-7)}
              className="rounded-lg border p-2 transition-colors hover:bg-slate-100"
              style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
              aria-label="Semana anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium" style={{ color: '#0F172A' }}>
              {rangoSemana}
            </span>
            <button
              type="button"
              onClick={() => irASemana(7)}
              className="rounded-lg border p-2 transition-colors hover:bg-slate-100"
              style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
              aria-label="Semana siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setSemana(getWeekStart(new Date()))}
              className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-slate-100"
              style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Hoy
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: '#FCA5A5', backgroundColor: '#FEF2F2', color: '#991B1B' }}>
          {error}
        </div>
      )}

      {!centroId ? (
        <div className="rounded-xl border border-dashed bg-white px-6 py-16 text-center" style={{ borderColor: '#CBD5E1' }}>
          <p className="text-sm" style={{ color: '#64748B' }}>Selecciona un centro para ver su cuadrante.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-white" style={{ borderColor: '#E2E8F0' }}>
          {coloresPorPuesto.size > 0 && (
            <div className="flex flex-wrap gap-2 border-b px-4 py-3" style={{ borderColor: '#E2E8F0' }}>
              {[...coloresPorPuesto.entries()].map(([puesto, color]) => (
                <span
                  key={puesto}
                  className="rounded-md border px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                >
                  {puesto}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <p className="px-4 py-12 text-center text-sm" style={{ color: '#64748B' }}>Cargando cuadrante...</p>
          ) : filas.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm" style={{ color: '#64748B' }}>
              No hay fichajes ni empleados asignados a este centro en la semana seleccionada.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    <th className="sticky left-0 z-10 border-b px-3 py-2 text-left text-xs font-semibold uppercase" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#475569' }}>
                      Empleado
                    </th>
                    {dias.map((dia, i) => {
                      const esHoy = toFechaISO(dia) === hoyISO;
                      return (
                        <th
                          key={i}
                          className="border-b px-2 py-2 text-center text-xs font-semibold"
                          style={{ borderColor: '#E2E8F0', color: esHoy ? '#1D4ED8' : '#475569', backgroundColor: esHoy ? '#EFF6FF' : '#F8FAFC' }}
                        >
                          {DIAS_SEMANA[i]} {dia.getDate()}
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {filas.map((emp) => {
                    const puesto = emp.puesto || SIN_PUESTO;
                    const color = coloresPorPuesto.get(puesto) ?? PALETA[0];
                    return (
                      <tr key={emp.id} className="transition-colors hover:bg-slate-50">
                        <td className="sticky left-0 z-10 border-b px-3 py-2 align-middle" style={{ borderColor: '#F1F5F9', backgroundColor: '#FFFFFF' }}>
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color.border }} />
                            <div>
                              <p className="font-medium" style={{ color: '#0F172A' }}>{nombreCompleto(emp)}</p>
                              <p className="text-xs" style={{ color: '#64748B' }}>{puesto}</p>
                            </div>
                          </div>
                        </td>
                        {dias.map((dia, i) => {
                          const fecha = toFechaISO(dia);
                          const lista = turnosDelDia(emp.id, fecha);
                          return (
                            <td key={i} className="border-b px-1.5 py-1.5 text-center" style={{ borderColor: '#F1F5F9' }}>
                              {lista.length === 0 ? (
                                <span className="text-xs" style={{ color: '#CBD5E1' }}>-</span>
                              ) : (
                                <div className="space-y-1">
                                  {lista.map((t, idx) => (
                                    <div
                                      key={idx}
                                      className="whitespace-nowrap rounded-md border px-2 py-1 font-mono text-xs"
                                      style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                                    >
                                      {formatHora(t.inicio)} - {t.fin ? formatHora(t.fin) : '...'}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
