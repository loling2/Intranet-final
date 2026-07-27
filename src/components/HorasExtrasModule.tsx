import { useState, useEffect, useCallback } from 'react';
import { Timer, Search, RefreshCw, Calendar, Banknote, ChevronDown, ChevronRight, UserCheck, Moon } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface SustRow {
  id: string;
  sustituto_id: string;
  sustituto_nombre: string;
  fecha_inicio: string;
  num_horas: number;
  num_dias: number;
  unidad: string;
  turno: string | null;
  horas_nocturnas: number | null;
  tipo_cobertura: string | null;
  empleado_nombre: string | null;
  baja_id: string | null;
}

interface LiquidacionRow {
  id: string;
  sustituto_id: string;
  sustituto_nombre: string;
  horas_liquidadas: number;
  fecha: string;
  notas: string | null;
}

const HORAS_POR_TURNO: Record<string, number> = { 'mañana': 8, tarde: 8, noche: 8 };

function yearOf(date: string): string {
  return date.slice(0, 4);
}

function formatDate(d: string): string {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function HorasExtrasModule() {
  const [rows, setRows] = useState<SustRow[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sData }, { data: lData }, { data: bData }] = await Promise.all([
      supabase.from('sustituciones').select('id, sustituto_id, sustituto_nombre, fecha_inicio, num_horas, num_dias, unidad, turno, horas_nocturnas, tipo_cobertura, baja_id').order('fecha_inicio', { ascending: false }).limit(5000),
      supabase.from('liquidaciones_horas').select('*').order('fecha', { ascending: false }),
      supabase.from('bajas_temporales').select('id, empleado_nombre'),
    ]);
    const bMap = new Map((bData ?? []).map((b) => [b.id as string, (b.empleado_nombre ?? '—') as string]));
    setRows((sData ?? []).map((s) => ({ ...s, empleado_nombre: s.baja_id ? (bMap.get(s.baja_id) ?? '—') : 'Sustitución directa' })) as SustRow[]);
    setLiquidaciones((lData ?? []) as LiquidacionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (id: string) => setExpanded((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  // Only paid substitutions (tipo_cobertura='pagar') count as paid overtime hours
  const paidRows = rows.filter((r) => r.tipo_cobertura === 'pagar');

  const yearsSet = new Set<string>();
  for (const r of paidRows) yearsSet.add(yearOf(r.fecha_inicio));
  for (const l of liquidaciones) yearsSet.add(yearOf(l.fecha));
  const years = Array.from(yearsSet).sort((a, b) => b.localeCompare(a));

  const filteredPaid = paidRows.filter((r) => {
    if (search && !r.sustituto_nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterYear && yearOf(r.fecha_inicio) !== filterYear) return false;
    return true;
  });

  const filteredLiq = liquidaciones.filter((l) => {
    if (search && !l.sustituto_nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterYear && yearOf(l.fecha) !== filterYear) return false;
    return true;
  });

  // Group by employee: all paid sustituciones + liquidaciones
  interface EmpAgg {
    sustituto_id: string;
    nombre: string;
    totalHoras: number;
    totalLiquidadas: number;
    detailRows: { id: string; fecha: string; empleado_nombre: string; horas: number; turno: string | null; horas_nocturnas: number | null; unidad: string; num_horas: number; num_dias: number }[];
    liquidaciones: { id: string; fecha: string; horas: number; notas: string | null }[];
  }
  const byEmployee = new Map<string, EmpAgg>();
  for (const r of filteredPaid) {
    let emp = byEmployee.get(r.sustituto_id);
    if (!emp) {
      emp = { sustituto_id: r.sustituto_id, nombre: r.sustituto_nombre, totalHoras: 0, totalLiquidadas: 0, detailRows: [], liquidaciones: [] };
      byEmployee.set(r.sustituto_id, emp);
    }
    const horasBase = HORAS_POR_TURNO[r.turno ?? ''] ?? 8;
    const horas = r.unidad === 'horas' ? (r.num_horas || 0) : (r.num_dias || 0) * horasBase;
    emp.totalHoras += horas;
    emp.detailRows.push({ id: r.id, fecha: r.fecha_inicio, empleado_nombre: r.empleado_nombre ?? '—', horas, turno: r.turno, horas_nocturnas: r.horas_nocturnas, unidad: r.unidad, num_horas: r.num_horas, num_dias: r.num_dias });
  }
  for (const l of filteredLiq) {
    let emp = byEmployee.get(l.sustituto_id);
    if (!emp) {
      emp = { sustituto_id: l.sustituto_id, nombre: l.sustituto_nombre, totalHoras: 0, totalLiquidadas: 0, detailRows: [], liquidaciones: [] };
      byEmployee.set(l.sustituto_id, emp);
    }
    emp.totalLiquidadas += l.horas_liquidadas;
    emp.liquidaciones.push({ id: l.id, fecha: l.fecha, horas: l.horas_liquidadas, notas: l.notas });
  }

  // Sort detail rows by date descending within each employee
  for (const emp of byEmployee.values()) {
    emp.detailRows.sort((a, b) => b.fecha.localeCompare(a.fecha));
    emp.liquidaciones.sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  const employeeList = Array.from(byEmployee.values()).sort((a, b) => b.totalHoras - a.totalHoras);

  const totalHorasPagadas = filteredPaid.reduce((acc, r) => {
    const horasBase = HORAS_POR_TURNO[r.turno ?? ''] ?? 8;
    return acc + (r.unidad === 'horas' ? (r.num_horas || 0) : (r.num_dias || 0) * horasBase);
  }, 0);
  const totalLiquidadas = filteredLiq.reduce((acc, l) => acc + l.horas_liquidadas, 0);
  const totalPendientes = Math.max(0, totalHorasPagadas - totalLiquidadas);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Horas pagadas', value: `${totalHorasPagadas.toFixed(1)}h`, color: '#D97706', bg: '#FFFBEB' },
          { label: 'Liquidadas', value: `${totalLiquidadas.toFixed(1)}h`, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Pendientes', value: `${totalPendientes.toFixed(1)}h`, color: '#DC2626', bg: '#FEF2F2' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input type="text" placeholder="Buscar trabajador..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }} />
        </div>
        <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}
          className="px-3 py-2 rounded-xl text-xs outline-none cursor-pointer"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
          <option value="">Todos los años</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer hover:opacity-70 transition-opacity"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Employee list with expandable detail */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Banknote size={14} style={{ color: '#D97706' }} />
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Horas extras pagadas por trabajador</h3>
          <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{employeeList.length} trabajadores · clic para ver detalle</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : employeeList.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Timer size={28} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No hay horas extras pagadas registradas</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {employeeList.map((emp) => {
              const isExpanded = expanded.has(emp.sustituto_id);
              const pendiente = Math.max(0, emp.totalHoras - emp.totalLiquidadas);
              return (
                <div key={emp.sustituto_id}>
                  {/* Summary row — clickable */}
                  <button onClick={() => toggleExpand(emp.sustituto_id)}
                    className="w-full px-5 py-3.5 flex items-center gap-3 cursor-pointer transition-colors hover:bg-slate-50 text-left">
                    <div className="flex-shrink-0">
                      {isExpanded ? <ChevronDown size={16} style={{ color: '#94A3B8' }} /> : <ChevronRight size={16} style={{ color: '#94A3B8' }} />}
                    </div>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.detailRows.length} sustitución(es)</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>{emp.totalHoras.toFixed(1)}h</span>
                      {emp.totalLiquidadas > 0 && (
                        <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>{emp.totalLiquidadas.toFixed(1)}h liq.</span>
                      )}
                      {pendiente > 0 && (
                        <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>{pendiente.toFixed(1)}h pend.</span>
                      )}
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="px-5 pb-4 pt-1" style={{ backgroundColor: '#FAFBFC' }}>
                      {/* Sustituciones detail */}
                      {emp.detailRows.length > 0 && (
                        <div className="rounded-lg overflow-hidden mb-3" style={{ border: '1px solid #E2E8F0' }}>
                          <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                            <UserCheck size={12} style={{ color: '#16A34A' }} />
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Sustituciones realizadas</p>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Sustituido a</th>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Fecha</th>
                                  <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Turno</th>
                                  <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Horas</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                                {emp.detailRows.map((d) => (
                                  <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-3 py-2 text-xs font-medium" style={{ color: '#1E293B' }}>{d.empleado_nombre}</td>
                                    <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>
                                      <span className="inline-flex items-center gap-1"><Calendar size={10} />{formatDate(d.fecha)}</span>
                                    </td>
                                    <td className="px-3 py-2">
                                      {d.turno ? (
                                        <span className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{d.turno}</span>
                                      ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <span className="text-xs font-bold" style={{ color: '#D97706' }}>{d.horas.toFixed(1)}h</span>
                                      {d.horas_nocturnas != null && d.horas_nocturnas > 0 && (
                                        <span className="ml-1 text-xs font-semibold" style={{ color: '#7C3AED' }}>
                                          <Moon size={9} className="inline" /> {d.horas_nocturnas}h
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                                  <td className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wide" colSpan={3} style={{ color: '#64748B' }}>Total horas</td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="text-sm font-bold" style={{ color: '#D97706' }}>{emp.totalHoras.toFixed(1)}h</span>
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Liquidaciones detail */}
                      {emp.liquidaciones.length > 0 && (
                        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #BBF7D0' }}>
                          <div className="px-3 py-2 flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', borderBottom: '1px solid #BBF7D0' }}>
                            <Banknote size={12} style={{ color: '#16A34A' }} />
                            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#16A34A' }}>Liquidaciones realizadas</p>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Fecha</th>
                                <th className="px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Horas liquidadas</th>
                                <th className="px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Notas</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                              {emp.liquidaciones.map((l) => (
                                <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                                  <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>
                                    <span className="inline-flex items-center gap-1"><Calendar size={10} />{formatDate(l.fecha)}</span>
                                  </td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="text-xs font-bold" style={{ color: '#16A34A' }}>{l.horas.toFixed(1)}h</span>
                                  </td>
                                  <td className="px-3 py-2 text-xs" style={{ color: '#64748B' }}>{l.notas ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
