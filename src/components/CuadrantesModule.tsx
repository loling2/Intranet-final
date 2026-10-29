import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  aHoraCorta,
  construirTurnos,
  ETIQUETA_TURNO,
  etiquetaDiaSemana,
  formatHora,
  getMonthDays,
  getWeekDays,
  getWeekStart,
  toFechaISO,
  type TurnoPlanificado,
  type TurnoRealizado,
  type VistaCuadrante,
} from '../lib/cuadrantes';
import { cargarDatosCuadrante, type EmpleadoCuadrante } from '../lib/cuadrantesData';
import CuadrantesAnioView from './CuadrantesAnioView';
import TurnoAsignacionModal from './TurnoAsignacionModal';

interface CentroOpcion {
  id: string;
  nombre: string;
}

interface ColorPuesto {
  bg: string;
  border: string;
  text: string;
}

interface DatosCargados {
  empleados: EmpleadoCuadrante[];
  turnos: Map<string, TurnoRealizado[]>;
  planificados: Map<string, TurnoPlanificado>;
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
const VISTAS: { valor: VistaCuadrante; etiqueta: string }[] = [
  { valor: 'semana', etiqueta: 'Semana' },
  { valor: 'mes', etiqueta: 'Mes' },
  { valor: 'anio', etiqueta: 'Año' },
];

const formatoRango = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const nombreCompleto = (e: EmpleadoCuadrante) => [e.apellidos, e.nombre].filter(Boolean).join(', ');
const claveTurno = (empleadoId: string, fecha: string) => `${empleadoId}|${fecha}`;

export default function CuadrantesModule() {
  const [centros, setCentros] = useState<CentroOpcion[]>([]);
  const [centroId, setCentroId] = useState('');
  const [puestoFiltro, setPuestoFiltro] = useState('');
  const [vista, setVista] = useState<VistaCuadrante>('semana');
  const [ancla, setAncla] = useState(() => new Date());
  const [datos, setDatos] = useState<DatosCargados | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresco, setRefresco] = useState(0);
  const [editando, setEditando] = useState<{ empleado: EmpleadoCuadrante; fecha: string } | null>(null);

  const periodo = useMemo(() => {
    if (vista === 'semana') {
      const dias = getWeekDays(getWeekStart(ancla));
      return { dias, desde: toFechaISO(dias[0]), hasta: toFechaISO(dias[6]) };
    }
    if (vista === 'mes') {
      const dias = getMonthDays(ancla);
      return { dias, desde: toFechaISO(dias[0]), hasta: toFechaISO(dias[dias.length - 1]) };
    }
    const anio = ancla.getFullYear();
    return { dias: [] as Date[], desde: `${anio}-01-01`, hasta: `${anio}-12-31` };
  }, [vista, ancla]);

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
      setDatos(null);
      return;
    }
    let cancelado = false;
    setLoading(true);
    setError('');
    cargarDatosCuadrante(centroId, periodo.desde, periodo.hasta)
      .then((res) => {
        if (cancelado) return;
        setDatos({
          empleados: res.empleados,
          turnos: construirTurnos(res.eventos),
          planificados: new Map(res.planificados.map((p) => [claveTurno(p.empleado_id, p.fecha), p])),
        });
      })
      .catch((err: unknown) => {
        if (cancelado) return;
        console.error('cuadrantes: carga', err);
        setDatos(null);
        setError('No se pudo cargar el cuadrante.');
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [centroId, periodo.desde, periodo.hasta, refresco]);

  const todosEmpleados = useMemo(() => datos?.empleados ?? [], [datos]);

  const coloresPorPuesto = useMemo(() => {
    const puestos = [...new Set(todosEmpleados.map((e) => e.puesto || SIN_PUESTO))].sort((a, b) =>
      a.localeCompare(b, 'es')
    );
    return new Map(puestos.map((p, i) => [p, PALETA[i % PALETA.length]]));
  }, [todosEmpleados]);

  const filas = useMemo(
    () =>
      todosEmpleados
        .filter((e) => !puestoFiltro || (e.puesto || SIN_PUESTO) === puestoFiltro)
        .sort((a, b) => {
          const pa = a.puesto || SIN_PUESTO;
          const pb = b.puesto || SIN_PUESTO;
          return pa.localeCompare(pb, 'es') || nombreCompleto(a).localeCompare(nombreCompleto(b), 'es');
        }),
    [todosEmpleados, puestoFiltro]
  );

  const desplazar = (sentido: 1 | -1) => {
    setAncla((previa) => {
      const nueva = new Date(previa);
      if (vista === 'semana') nueva.setDate(previa.getDate() + 7 * sentido);
      else if (vista === 'mes') nueva.setMonth(previa.getMonth() + sentido, 1);
      else nueva.setFullYear(previa.getFullYear() + sentido, 0, 1);
      return nueva;
    });
  };

  const seleccionarMes = (mes: number) => {
    setAncla(new Date(ancla.getFullYear(), mes, 1));
    setVista('mes');
  };

  const etiquetaPeriodo = (() => {
    if (vista === 'anio') return String(ancla.getFullYear());
    if (vista === 'mes') return ancla.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const dias = periodo.dias;
    return `${formatoRango.format(dias[0])} - ${formatoRango.format(dias[6])} ${dias[6].getFullYear()}`;
  })();

  const turnosDelDia = (empleadoId: string, fecha: string) =>
    (datos?.turnos.get(empleadoId) ?? []).filter((t) => t.fecha === fecha);

  const planificadoDelDia = (empleadoId: string, fecha: string) =>
    datos?.planificados.get(claveTurno(empleadoId, fecha));

  const editandoPlanificado = editando
    ? planificadoDelDia(editando.empleado.id, editando.fecha)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: '#0F172A' }}>Cuadrantes</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Horarios fichados y turnos asignados por centro</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={centroId}
            onChange={(e) => { setCentroId(e.target.value); setPuestoFiltro(''); }}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
          >
            <option value="">Selecciona un centro</option>
            {centros.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          <select
            value={puestoFiltro}
            onChange={(e) => setPuestoFiltro(e.target.value)}
            disabled={!centroId}
            className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
            aria-label="Filtrar por puesto de trabajo"
          >
            <option value="">Todos los puestos</option>
            {[...coloresPorPuesto.keys()].map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => desplazar(-1)}
              className="rounded-lg border p-2 transition-colors hover:bg-slate-100"
              style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
              aria-label="Periodo anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[10rem] text-center text-sm font-medium capitalize" style={{ color: '#0F172A' }}>
              {etiquetaPeriodo}
            </span>
            <button
              type="button"
              onClick={() => desplazar(1)}
              className="rounded-lg border p-2 transition-colors hover:bg-slate-100"
              style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
              aria-label="Periodo siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setAncla(new Date())}
              className="rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-slate-100"
              style={{ borderColor: '#CBD5E1', color: '#0F172A', backgroundColor: '#FFFFFF' }}
            >
              Hoy
            </button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <div className="inline-flex rounded-lg border p-1" style={{ borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }}>
          {VISTAS.map((v) => (
            <button
              key={v.valor}
              type="button"
              onClick={() => setVista(v.valor)}
              className="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
              style={{
                backgroundColor: vista === v.valor ? '#1D4ED8' : 'transparent',
                color: vista === v.valor ? '#FFFFFF' : '#334155',
              }}
            >
              {v.etiqueta}
            </button>
          ))}
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
          ) : !datos ? null : vista === 'anio' ? (
            filas.length === 0 ? (
              <p className="px-4 py-12 text-center text-sm" style={{ color: '#64748B' }}>No hay empleados en este centro.</p>
            ) : (
              <CuadrantesAnioView
                anio={ancla.getFullYear()}
                empleados={filas}
                turnos={datos.turnos}
                onSeleccionarMes={seleccionarMes}
              />
            )
          ) : filas.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm" style={{ color: '#64748B' }}>
              No hay fichajes ni empleados asignados a este centro en el periodo seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className="w-full border-collapse text-sm"
                style={{ minWidth: vista === 'semana' ? 900 : 260 + periodo.dias.length * 120 }}
              >
                <thead>
                  <tr style={{ backgroundColor: '#F8FAFC' }}>
                    <th className="sticky left-0 z-10 border-b px-3 py-2 text-left text-xs font-semibold uppercase" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#475569' }}>
                      Empleado
                    </th>
                    {periodo.dias.map((dia) => {
                      const esHoy = toFechaISO(dia) === hoyISO;
                      return (
                        <th
                          key={toFechaISO(dia)}
                          className="border-b px-2 py-2 text-center text-xs font-semibold"
                          style={{ borderColor: '#E2E8F0', color: esHoy ? '#1D4ED8' : '#475569', backgroundColor: esHoy ? '#EFF6FF' : '#F8FAFC' }}
                        >
                          {etiquetaDiaSemana(dia)} {dia.getDate()}
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
                        {periodo.dias.map((dia) => {
                          const fecha = toFechaISO(dia);
                          const lista = turnosDelDia(emp.id, fecha);
                          const planificado = planificadoDelDia(emp.id, fecha);
                          return (
                            <td
                              key={fecha}
                              onClick={() => setEditando({ empleado: emp, fecha })}
                              className="cursor-pointer border-b px-1.5 py-1.5 text-center transition-colors hover:bg-blue-50"
                              style={{ borderColor: '#F1F5F9' }}
                            >
                              <div className="space-y-1">
                                {planificado && (
                                  <div
                                    className="whitespace-nowrap rounded-md border border-dashed px-2 py-1 font-mono text-[11px]"
                                    style={{ borderColor: '#94A3B8', color: '#475569', backgroundColor: '#FFFFFF' }}
                                  >
                                    Plan {aHoraCorta(planificado.inicio)} - {aHoraCorta(planificado.fin)}
                                  </div>
                                )}
                                {lista.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className="whitespace-nowrap rounded-md border px-2 py-1 font-mono text-xs"
                                    style={{ backgroundColor: color.bg, borderColor: color.border, color: color.text }}
                                  >
                                    <div>{formatHora(t.inicio)} - {t.fin ? formatHora(t.fin) : '...'}</div>
                                    <div className="font-sans text-[10px] font-semibold uppercase tracking-wide">{ETIQUETA_TURNO[t.tipo]}</div>
                                  </div>
                                ))}
                                {!planificado && lista.length === 0 && (
                                  <span className="text-xs" style={{ color: '#CBD5E1' }}>-</span>
                                )}
                              </div>
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

      {editando && centroId && (
        <TurnoAsignacionModal
          empleadoId={editando.empleado.id}
          empleadoNombre={nombreCompleto(editando.empleado)}
          centroId={centroId}
          fecha={editando.fecha}
          planificado={editandoPlanificado}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            setRefresco((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}
