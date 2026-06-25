import { useState, useEffect } from 'react';
import { Clock, Search, RefreshCw, Download, FileText, Calendar } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { Pagination, paginate, totalPages as calcTotalPages } from './Pagination';

interface Fichaje {
  id: string;
  empleado_id: string | null;
  nombre_empleado: string;
  fecha: string;
  timestamp: string;
  tipo_evento: 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin' | 'permiso';
  metodo: string | null;
  es_manual: boolean;
  nota_correccion: string | null;
  ubicacion: string | null;
  dispositivo: string | null;
  user_agent: string | null;
}

interface JornadaResumen {
  nombre: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  pausa_inicio: string | null;
  pausa_fin: string | null;
  permiso: string | null;
  duracion_bruta: number | null;
  duracion_neta: number | null;
  dispositivo: string | null;
  ubicacion: string | null;
}

const TIPO_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  entrada:      { label: 'Entrada',       color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  salida:       { label: 'Salida',        color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  pausa_inicio: { label: 'Descanso',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  pausa_fin:    { label: 'Fin descanso',  color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
  permiso:      { label: 'Permiso',       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
};

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null) {
  if (minutes === null || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function buildResumenes(fichajes: Fichaje[]): JornadaResumen[] {
  const map = new Map<string, JornadaResumen>();
  for (const f of fichajes) {
    const key = `${f.nombre_empleado}|${f.fecha}`;
    if (!map.has(key)) {
      map.set(key, {
        nombre: f.nombre_empleado, fecha: f.fecha,
        entrada: null, salida: null, pausa_inicio: null, pausa_fin: null, permiso: null,
        duracion_bruta: null, duracion_neta: null,
        dispositivo: f.dispositivo ?? null, ubicacion: f.ubicacion ?? null,
      });
    }
    const r = map.get(key)!;
    if (f.tipo_evento === 'entrada' && !r.entrada) r.entrada = f.timestamp;
    if (f.tipo_evento === 'salida') r.salida = f.timestamp;
    if (f.tipo_evento === 'pausa_inicio' && !r.pausa_inicio) r.pausa_inicio = f.timestamp;
    if (f.tipo_evento === 'pausa_fin' && !r.pausa_fin) r.pausa_fin = f.timestamp;
    if (f.tipo_evento === 'permiso' && !r.permiso) r.permiso = f.timestamp;
    if (!r.dispositivo && f.dispositivo) r.dispositivo = f.dispositivo;
    if (!r.ubicacion && f.ubicacion) r.ubicacion = f.ubicacion;
  }
  for (const r of map.values()) {
    if (r.entrada && r.salida) {
      r.duracion_bruta = Math.round((new Date(r.salida).getTime() - new Date(r.entrada).getTime()) / 60000);
      let pausa = 0;
      if (r.pausa_inicio && r.pausa_fin) {
        pausa = Math.round((new Date(r.pausa_fin).getTime() - new Date(r.pausa_inicio).getTime()) / 60000);
      }
      r.duracion_neta = Math.max(0, r.duracion_bruta - pausa);
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const d = b.fecha.localeCompare(a.fecha);
    return d !== 0 ? d : a.nombre.localeCompare(b.nombre);
  });
}

// ── Export helpers ────────────────────────────────────────────────────────────

function exportCSV(resumenes: JornadaResumen[]) {
  const header = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Pausa inicio', 'Pausa fin', 'Permiso', 'Duración', 'Dispositivo', 'Ubicación'];
  const rows = resumenes.map((r) => {
    const pausaMin = (r.pausa_inicio && r.pausa_fin)
      ? Math.round((new Date(r.pausa_fin).getTime() - new Date(r.pausa_inicio).getTime()) / 60000)
      : null;
    return [
      r.nombre, r.fecha,
      formatTime(r.entrada), formatTime(r.salida),
      formatTime(r.pausa_inicio), formatTime(r.pausa_fin),
      r.permiso ? formatTime(r.permiso) : '—',
      formatDuration(r.duracion_neta),
      r.dispositivo ?? '—', r.ubicacion ?? '—',
    ];
  });
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `fichajes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportEventosCSV(fichajes: Fichaje[]) {
  const header = ['Empleado', 'Fecha', 'Hora', 'Tipo', 'Metodo', 'Manual', 'Dispositivo', 'Ubicación', 'Nota'];
  const rows = fichajes.map((f) => [
    f.nombre_empleado, f.fecha, formatTime(f.timestamp),
    TIPO_LABELS[f.tipo_evento]?.label ?? f.tipo_evento,
    f.metodo ?? '—', f.es_manual ? 'Sí' : 'No',
    f.dispositivo ?? '—', f.ubicacion ?? '—',
    f.nota_correccion ?? '—',
  ]);
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `fichajes_eventos_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportPDF(resumenes: JornadaResumen[], desde: string, hasta: string) {
  const rows = resumenes.map((r) => {
    const pausaMin = (r.pausa_inicio && r.pausa_fin)
      ? Math.round((new Date(r.pausa_fin).getTime() - new Date(r.pausa_inicio).getTime()) / 60000)
      : null;
    return `
      <tr>
        <td>${r.nombre}</td><td>${r.fecha}</td>
        <td style="color:#16A34A">${formatTime(r.entrada)}</td>
        <td style="color:#DC2626">${formatTime(r.salida)}</td>
        <td style="color:#D97706">${formatDuration(pausaMin)}</td>
        <td style="color:#7C3AED">${r.permiso ? formatTime(r.permiso) : '—'}</td>
        <td style="font-weight:bold;color:#0369A1">${formatDuration(r.duracion_neta)}</td>
        <td style="font-size:11px">${r.dispositivo ?? '—'}</td>
        <td style="font-size:11px">${r.ubicacion ?? '—'}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Fichajes</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1E293B}
  h1{font-size:18px;margin-bottom:4px}
  p{color:#64748B;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#0F172A;color:#fff;padding:6px 8px;text-align:left;font-size:11px}
  td{padding:5px 8px;border-bottom:1px solid #E2E8F0}
  tr:nth-child(even){background:#F8FAFC}
  @media print{body{padding:0}}
</style></head><body>
<h1>Informe de Fichajes</h1>
<p>Periodo: ${desde || '—'} / ${hasta || '—'} &nbsp;·&nbsp; Generado: ${new Date().toLocaleString('es-ES')}</p>
<table>
<thead><tr>
  <th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th>
  <th>Pausa</th><th>Permiso</th><th>Duración</th><th>Dispositivo</th><th>Ubicación</th>
</tr></thead><tbody>${rows}</tbody>
</table>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ── Component ─────────────────────────────────────────────────────────────────

type ViewMode = 'resumen' | 'eventos';

export default function FichajesModule() {
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('resumen');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase
          .from('fichajes')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(5000);
        setFichajes((data ?? []) as Fichaje[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { setPage(1); }, [search, filterTipo, filterDesde, filterHasta, viewMode]);

  const applyDateRange = (f: Fichaje) => {
    if (filterDesde && f.fecha < filterDesde) return false;
    if (filterHasta && f.fecha > filterHasta) return false;
    return true;
  };

  const filteredFichajes = fichajes.filter((f) => {
    if (search && !f.nombre_empleado.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipo && f.tipo_evento !== filterTipo) return false;
    if (!applyDateRange(f)) return false;
    return true;
  });

  const resumenesBase = fichajes.filter((f) => {
    if (search && !f.nombre_empleado.toLowerCase().includes(search.toLowerCase())) return false;
    if (!applyDateRange(f)) return false;
    return true;
  });

  const resumenes = buildResumenes(resumenesBase);

  const tp = viewMode === 'eventos'
    ? calcTotalPages(filteredFichajes.length, 25)
    : calcTotalPages(resumenes.length, 25);
  const safePage = Math.min(page, tp);
  const pagedEventos = paginate(filteredFichajes, safePage, 25);
  const pagedResumenes = paginate(resumenes, safePage, 25);

  const totalDuracion = resumenes.reduce((acc, r) => acc + (r.duracion_neta ?? 0), 0);
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total eventos', value: fichajes.length, color: '#0369A1', bg: '#EFF6FF' },
          { label: 'Hoy', value: fichajes.filter((f) => f.fecha === today).length, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Jornadas completas', value: buildResumenes(fichajes).filter((r) => r.entrada && r.salida).length, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Duración total', value: formatDuration(totalDuracion), color: '#D97706', bg: '#FFFBEB' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>

        {/* Controls */}
        <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Search size={13} style={{ color: '#94A3B8' }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado..."
              className="flex-1 text-sm outline-none bg-transparent" style={{ color: '#1E293B' }}
            />
          </div>

          {/* Date range */}
          <div className="flex items-center gap-1">
            <Calendar size={13} style={{ color: '#94A3B8' }} />
            <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
            <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }} />
            {(filterDesde || filterHasta) && (
              <button onClick={() => { setFilterDesde(''); setFilterHasta(''); }}
                className="text-xs px-2 py-1 rounded-lg cursor-pointer"
                style={{ color: '#DC2626', backgroundColor: '#FEF2F2' }}>X</button>
            )}
          </div>

          {/* Tipo filter (eventos only) */}
          {viewMode === 'eventos' && (
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
              <option value="">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="pausa_inicio">Descanso</option>
              <option value="pausa_fin">Fin descanso</option>
              <option value="permiso">Permiso</option>
            </select>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            {(['resumen', 'eventos'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className="px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: viewMode === v ? '#0F172A' : '#F8FAFC', color: viewMode === v ? '#FFFFFF' : '#475569' }}>
                {v === 'resumen' ? 'Resumen diario' : 'Todos los eventos'}
              </button>
            ))}
          </div>

          {/* Export buttons */}
          <button
            onClick={() => viewMode === 'resumen' ? exportCSV(resumenes) : exportEventosCSV(filteredFichajes)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
            <Download size={12} />
            Excel / CSV
          </button>
          <button
            onClick={() => exportPDF(resumenes, filterDesde, filterHasta)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            <FileText size={12} />
            PDF
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>

        ) : viewMode === 'resumen' ? (
          <>
            {pagedResumenes.length === 0 ? (
              <div className="py-12 text-center">
                <Clock size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No hay jornadas registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Empleado', 'Fecha', 'Entrada', 'Salida', 'Pausa', 'Permiso', 'Duración', 'Dispositivo', 'Ubicación'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                    {pagedResumenes.map((r, i) => {
                      const pausaMin = (r.pausa_inicio && r.pausa_fin)
                        ? Math.round((new Date(r.pausa_fin).getTime() - new Date(r.pausa_inicio).getTime()) / 60000)
                        : null;
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold" style={{ color: '#1E293B' }}>{r.nombre}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>{r.fecha}</td>
                          <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.entrada ? '#16A34A' : '#CBD5E1' }}>{formatTime(r.entrada)}</td>
                          <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.salida ? '#DC2626' : '#CBD5E1' }}>{formatTime(r.salida)}</td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: '#D97706' }}>{formatDuration(pausaMin)}</td>
                          <td className="px-4 py-3">
                            {r.permiso ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                                {formatTime(r.permiso)}
                              </span>
                            ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: r.duracion_neta !== null ? '#0369A1' : '#CBD5E1' }}>
                            {formatDuration(r.duracion_neta)}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: '#64748B' }} title={r.dispositivo ?? ''}>{r.dispositivo ?? '—'}</td>
                          <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: '#64748B' }} title={r.ubicacion ?? ''}>{r.ubicacion ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={safePage} totalPages={tp} totalItems={resumenes.length} pageSize={25} onPage={setPage} />
          </>

        ) : (
          <>
            {pagedEventos.length === 0 ? (
              <div className="py-12 text-center">
                <Clock size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No hay eventos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Empleado', 'Fecha / Hora', 'Tipo', 'Dispositivo', 'Ubicación', 'Notas'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                    {pagedEventos.map((f) => {
                      const tipo = TIPO_LABELS[f.tipo_evento] ?? { label: f.tipo_evento, color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
                      return (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold" style={{ color: '#1E293B' }}>
                            {f.nombre_empleado}
                            {f.es_manual && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF9C3', color: '#713F12' }}>Manual</span>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-mono" style={{ color: '#475569' }}>{f.fecha}</p>
                            <p className="text-xs font-mono font-bold" style={{ color: '#1E293B' }}>{formatTime(f.timestamp)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold"
                              style={{ backgroundColor: tipo.bg, color: tipo.color, border: `1px solid ${tipo.border}` }}>
                              {tipo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: '#64748B' }} title={f.dispositivo ?? ''}>{f.dispositivo ?? '—'}</td>
                          <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: '#64748B' }} title={f.ubicacion ?? ''}>{f.ubicacion ?? '—'}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>{f.nota_correccion ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={safePage} totalPages={tp} totalItems={filteredFichajes.length} pageSize={25} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
