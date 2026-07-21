import { useState, useEffect, useCallback } from 'react';
import { Timer, Search, RefreshCw, Calendar, Banknote, TrendingUp } from 'lucide-react';
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

export default function HorasExtrasModule() {
  const [rows, setRows] = useState<SustRow[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterYear, setFilterYear] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: sData }, { data: lData }] = await Promise.all([
      supabase.from('sustituciones').select('id, sustituto_id, sustituto_nombre, fecha_inicio, num_horas, num_dias, unidad, turno, horas_nocturnas, tipo_cobertura').order('fecha_inicio', { ascending: false }).limit(5000),
      supabase.from('liquidaciones_horas').select('*').order('fecha', { ascending: false }),
    ]);
    setRows((sData ?? []) as SustRow[]);
    setLiquidaciones((lData ?? []) as LiquidacionRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  // Compute per-employee, per-year totals
  const byEmployee = new Map<string, { sustituto_id: string; nombre: string; porAnio: Map<string, { horas: number; liquidadas: number }> }>();
  for (const r of filteredPaid) {
    const y = yearOf(r.fecha_inicio);
    let emp = byEmployee.get(r.sustituto_id);
    if (!emp) {
      emp = { sustituto_id: r.sustituto_id, nombre: r.sustituto_nombre, porAnio: new Map() };
      byEmployee.set(r.sustituto_id, emp);
    }
    let yv = emp.porAnio.get(y);
    if (!yv) { yv = { horas: 0, liquidadas: 0 }; emp.porAnio.set(y, yv); }
    const horasBase = HORAS_POR_TURNO[r.turno ?? ''] ?? 8;
    yv.horas += r.unidad === 'horas' ? (r.num_horas || 0) : (r.num_dias || 0) * horasBase;
  }
  for (const l of filteredLiq) {
    const y = yearOf(l.fecha);
    let emp = byEmployee.get(l.sustituto_id);
    if (!emp) {
      emp = { sustituto_id: l.sustituto_id, nombre: l.sustituto_nombre, porAnio: new Map() };
      byEmployee.set(l.sustituto_id, emp);
    }
    let yv = emp.porAnio.get(y);
    if (!yv) { yv = { horas: 0, liquidadas: 0 }; emp.porAnio.set(y, yv); }
    yv.liquidadas += l.horas_liquidadas;
  }

  const employeeList = Array.from(byEmployee.values()).sort((a, b) => {
    const aTotal = Array.from(a.porAnio.values()).reduce((s, v) => s + v.horas, 0);
    const bTotal = Array.from(b.porAnio.values()).reduce((s, v) => s + v.horas, 0);
    return bTotal - aTotal;
  });

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

      {/* Balance table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Banknote size={14} style={{ color: '#D97706' }} />
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Balance de horas extras pagadas por trabajador</h3>
          <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{employeeList.length} trabajadores</span>
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Trabajador</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Año</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Horas pagadas</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Liquidadas</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Pendientes</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                {employeeList.flatMap((emp) => {
                  const anios = Array.from(emp.porAnio.keys()).sort((a, b) => b.localeCompare(a));
                  return anios.map((y, idx) => {
                    const v = emp.porAnio.get(y)!;
                    const pendiente = Math.max(0, v.horas - v.liquidadas);
                    return (
                      <tr key={`${emp.sustituto_id}-${y}`} className="hover:bg-slate-50 transition-colors">
                        {idx === 0 ? (
                          <td className="px-4 py-3" rowSpan={anios.length}>
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
                                {emp.nombre.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>{emp.nombre}</span>
                            </div>
                          </td>
                        ) : null}
                        <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{y}</td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold" style={{ color: '#D97706' }}>{v.horas.toFixed(1)}h</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-semibold" style={{ color: v.liquidadas > 0 ? '#16A34A' : '#CBD5E1' }}>
                            {v.liquidadas.toFixed(1)}h
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-sm font-bold" style={{ color: pendiente > 0 ? '#DC2626' : '#16A34A' }}>
                            {pendiente.toFixed(1)}h
                          </span>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor: '#F8FAFC', borderTop: '2px solid #E2E8F0' }}>
                  <td className="px-4 py-3 text-xs font-semibold uppercase tracking-wider" colSpan={2} style={{ color: '#64748B' }}>Total</td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold" style={{ color: '#D97706' }}>{totalHorasPagadas.toFixed(1)}h</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold" style={{ color: '#16A34A' }}>{totalLiquidadas.toFixed(1)}h</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold" style={{ color: '#DC2626' }}>{totalPendientes.toFixed(1)}h</span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Liquidaciones detail */}
      {filteredLiq.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F0FDF4' }}>
            <TrendingUp size={14} style={{ color: '#16A34A' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Liquidaciones realizadas</h3>
            <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{filteredLiq.length} registros</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '600px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Trabajador', 'Fecha', 'Horas liquidadas', 'Notas'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                {filteredLiq.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#1E293B' }}>{l.sustituto_nombre}</td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>
                      <span className="inline-flex items-center gap-1"><Calendar size={11} />{l.fecha}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: '#16A34A' }}>{l.horas_liquidadas}h</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>{l.notas ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
