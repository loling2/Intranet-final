import { useState, useEffect, useCallback } from 'react';
import { Timer, Search, RefreshCw, Calendar, Clock } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface ExtraRow {
  id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  break_time: number;
  log_date: string;
  nombre: string;
  email: string;
  duracion_min: number;
}

function duracionMin(start: string, end: string | null, breakMin: number): number {
  if (!end) return 0;
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000) - (breakMin ?? 0));
}

function formatDuration(min: number): string {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

export default function HorasExtrasModule() {
  const [rows, setRows] = useState<ExtraRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: wData }, { data: pData }] = await Promise.all([
      supabase.from('work_logs').select('*').eq('is_extra', true).order('log_date', { ascending: false }).limit(500),
      supabase.from('user_profiles').select('id, nombre, email'),
    ]);
    const profMap = new Map((pData ?? []).map((p) => [p.id as string, p as { id: string; nombre: string; email: string }]));
    setRows(
      (wData ?? []).map((w) => {
        const prof = profMap.get(w.user_id);
        return {
          ...w,
          nombre: prof?.nombre ?? '—',
          email: prof?.email ?? '',
          duracion_min: duracionMin(w.start_time, w.end_time, w.break_time ?? 0),
        };
      })
    );
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = rows.filter((r) => {
    if (search && !r.nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterDesde && r.log_date < filterDesde) return false;
    if (filterHasta && r.log_date > filterHasta) return false;
    return true;
  });

  const totalMin = filtered.reduce((acc, r) => acc + r.duracion_min, 0);
  const empleadosUnicos = new Set(filtered.map((r) => r.user_id)).size;

  // Group by employee for summary
  const byEmployee = new Map<string, { nombre: string; count: number; totalMin: number }>();
  for (const r of filtered) {
    const ex = byEmployee.get(r.user_id);
    if (ex) { ex.count++; ex.totalMin += r.duracion_min; }
    else byEmployee.set(r.user_id, { nombre: r.nombre, count: 1, totalMin: r.duracion_min });
  }
  const employeeSummary = Array.from(byEmployee.values()).sort((a, b) => b.totalMin - a.totalMin);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Registros', value: filtered.length, color: '#64748B', bg: '#F8FAFC' },
          { label: 'Empleados', value: empleadosUnicos, color: '#0369A1', bg: '#EFF6FF' },
          { label: 'Total horas extra', value: formatDuration(totalMin), color: '#D97706', bg: '#FFFBEB' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text" placeholder="Buscar empleado..."
            value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar size={13} style={{ color: '#94A3B8' }} />
          <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)}
            className="px-2 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }} />
          <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
          <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)}
            className="px-2 py-2 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }} />
        </div>
        <button onClick={load}
          className="w-8 h-8 flex items-center justify-center rounded-xl cursor-pointer hover:opacity-70 transition-opacity"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Employee summary cards */}
      {employeeSummary.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {employeeSummary.map((emp) => (
            <div key={emp.nombre} className="rounded-xl p-3.5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ backgroundColor: '#F59E0B', color: '#FFFFFF' }}>
                  {emp.nombre.charAt(0).toUpperCase()}
                </div>
                <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
              </div>
              <p className="text-xl font-bold" style={{ color: '#D97706' }}>{formatDuration(emp.totalMin)}</p>
              <p className="text-xs mt-0.5" style={{ color: '#92400E' }}>{emp.count} registro{emp.count !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}

      {/* Detail table */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <Timer size={14} style={{ color: '#D97706' }} />
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Detalle de Horas Extras</h3>
          <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{filtered.length} registros</span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12">
            <Clock size={28} style={{ color: '#E2E8F0' }} />
            <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No hay horas extras registradas</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '700px' }}>
              <thead>
                <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  {['Empleado', 'Fecha', 'Hora inicio', 'Hora fin', 'Pausa', 'Duración total'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
                          {r.nombre.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{r.nombre}</p>
                          {r.email && <p className="text-xs" style={{ color: '#94A3B8' }}>{r.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs font-mono" style={{ color: '#64748B' }}>{r.log_date}</td>
                    <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: '#16A34A' }}>
                      {formatTime(r.start_time)}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.end_time ? '#DC2626' : '#CBD5E1' }}>
                      {r.end_time ? formatTime(r.end_time) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>
                      {r.break_time ? `${r.break_time}m` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-bold" style={{ color: r.duracion_min > 0 ? '#D97706' : '#CBD5E1' }}>
                        {formatDuration(r.duracion_min)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
