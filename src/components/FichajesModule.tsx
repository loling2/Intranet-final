import { useState, useEffect } from 'react';
import { Clock, Search, RefreshCw, Download, Calendar, ChevronDown } from 'lucide-react';
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
}

interface JornadaResumen {
  nombre: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  pausa_inicio: string | null;
  pausa_fin: string | null;
  duracion_bruta: number | null; // minutos
  duracion_neta: number | null;  // minutos sin pausa
}

const TIPO_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  entrada:     { label: 'Entrada',      color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  salida:      { label: 'Salida',       color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  pausa_inicio:{ label: 'Descanso',     color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  pausa_fin:   { label: 'Fin descanso', color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
  permiso:     { label: 'Permiso',      color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
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
      map.set(key, { nombre: f.nombre_empleado, fecha: f.fecha, entrada: null, salida: null, pausa_inicio: null, pausa_fin: null, duracion_bruta: null, duracion_neta: null });
    }
    const r = map.get(key)!;
    if (f.tipo_evento === 'entrada' && !r.entrada) r.entrada = f.timestamp;
    if (f.tipo_evento === 'salida') r.salida = f.timestamp;
    if (f.tipo_evento === 'pausa_inicio' && !r.pausa_inicio) r.pausa_inicio = f.timestamp;
    if (f.tipo_evento === 'pausa_fin' && !r.pausa_fin) r.pausa_fin = f.timestamp;
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
    const dateDiff = b.fecha.localeCompare(a.fecha);
    if (dateDiff !== 0) return dateDiff;
    return a.nombre.localeCompare(b.nombre);
  });
}

type ViewMode = 'eventos' | 'resumen';

export default function FichajesModule() {
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterFecha, setFilterFecha] = useState('');
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
          .limit(2000);
        setFichajes((data ?? []) as Fichaje[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => { setPage(1); }, [search, filterTipo, filterFecha, viewMode]);

  const filteredFichajes = fichajes.filter((f) => {
    if (search && !f.nombre_empleado.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipo && f.tipo_evento !== filterTipo) return false;
    if (filterFecha && f.fecha !== filterFecha) return false;
    return true;
  });

  const resumenes = buildResumenes(fichajes.filter((f) => {
    if (search && !f.nombre_empleado.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterFecha && f.fecha !== filterFecha) return false;
    return true;
  }));

  const tp = viewMode === 'eventos'
    ? calcTotalPages(filteredFichajes.length, 25)
    : calcTotalPages(resumenes.length, 25);

  const safePage = Math.min(page, tp);
  const pagedEventos = paginate(filteredFichajes, safePage, 25);
  const pagedResumenes = paginate(resumenes, safePage, 25);

  const totalHorasFichadas = resumenes.reduce((acc, r) => acc + (r.duracion_neta ?? 0), 0);

  return (
    <div className="space-y-4">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total eventos', value: fichajes.length, color: '#0369A1', bg: '#EFF6FF' },
          { label: 'Hoy', value: fichajes.filter((f) => f.fecha === new Date().toISOString().split('T')[0]).length, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Jornadas completas', value: resumenes.filter((r) => r.entrada && r.salida).length, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Total horas fichadas', value: formatDuration(totalHorasFichadas), color: '#D97706', bg: '#FFFBEB' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          <div className="flex items-center gap-2 flex-1 min-w-[180px]">
            <Search size={14} style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado..."
              className="flex-1 text-sm outline-none bg-transparent"
              style={{ color: '#1E293B' }}
            />
          </div>

          <input
            type="date"
            value={filterFecha}
            onChange={(e) => setFilterFecha(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}
          />

          {viewMode === 'eventos' && (
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}
            >
              <option value="">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="pausa_inicio">Descanso</option>
              <option value="pausa_fin">Fin descanso</option>
              <option value="permiso">Permiso</option>
            </select>
          )}

          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            {(['resumen', 'eventos'] as ViewMode[]).map((v) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className="px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                style={{
                  backgroundColor: viewMode === v ? '#0F172A' : '#F8FAFC',
                  color: viewMode === v ? '#FFFFFF' : '#475569',
                }}
              >
                {v === 'resumen' ? 'Resumen diario' : 'Todos los eventos'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : viewMode === 'resumen' ? (
          <>
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {pagedResumenes.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                  <p className="text-sm" style={{ color: '#94A3B8' }}>No hay jornadas registradas</p>
                </div>
              ) : (
                <>
                  {/* Table header */}
                  <div className="grid grid-cols-7 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', backgroundColor: '#F8FAFC' }}>
                    <span className="col-span-2">Empleado</span>
                    <span>Fecha</span>
                    <span>Entrada</span>
                    <span>Salida</span>
                    <span>Pausa</span>
                    <span>Horas netas</span>
                  </div>
                  {pagedResumenes.map((r, i) => {
                    const pausaMin = (r.pausa_inicio && r.pausa_fin)
                      ? Math.round((new Date(r.pausa_fin).getTime() - new Date(r.pausa_inicio).getTime()) / 60000)
                      : null;
                    return (
                      <div key={i} className="grid grid-cols-7 px-5 py-3 items-center hover:bg-slate-50 transition-colors">
                        <span className="col-span-2 text-sm font-semibold" style={{ color: '#1E293B' }}>{r.nombre}</span>
                        <span className="text-xs" style={{ color: '#475569' }}>{r.fecha}</span>
                        <span className="text-xs font-mono" style={{ color: '#16A34A' }}>{formatTime(r.entrada)}</span>
                        <span className="text-xs font-mono" style={{ color: '#DC2626' }}>{formatTime(r.salida)}</span>
                        <span className="text-xs font-mono" style={{ color: '#D97706' }}>{formatDuration(pausaMin)}</span>
                        <span className="text-sm font-bold" style={{ color: r.duracion_neta !== null ? '#0369A1' : '#CBD5E1' }}>
                          {formatDuration(r.duracion_neta)}
                        </span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <Pagination
              page={safePage}
              totalPages={tp}
              totalItems={resumenes.length}
              pageSize={25}
              onPage={setPage}
            />
          </>
        ) : (
          <>
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {pagedEventos.length === 0 ? (
                <div className="py-12 text-center">
                  <Clock size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                  <p className="text-sm" style={{ color: '#94A3B8' }}>No hay eventos</p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-5 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', backgroundColor: '#F8FAFC' }}>
                    <span className="col-span-2">Empleado</span>
                    <span>Fecha / Hora</span>
                    <span>Tipo</span>
                    <span>Notas</span>
                  </div>
                  {pagedEventos.map((f) => {
                    const tipo = TIPO_LABELS[f.tipo_evento] ?? { label: f.tipo_evento, color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
                    return (
                      <div key={f.id} className="grid grid-cols-5 px-5 py-3 items-center hover:bg-slate-50 transition-colors">
                        <span className="col-span-2 text-sm font-semibold" style={{ color: '#1E293B' }}>
                          {f.nombre_empleado}
                          {f.es_manual && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF9C3', color: '#713F12' }}>Manual</span>}
                        </span>
                        <div>
                          <p className="text-xs font-mono" style={{ color: '#475569' }}>{f.fecha}</p>
                          <p className="text-xs font-mono" style={{ color: '#94A3B8' }}>{formatTime(f.timestamp)}</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold w-fit" style={{ backgroundColor: tipo.bg, color: tipo.color, border: `1px solid ${tipo.border}` }}>
                          {tipo.label}
                        </span>
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{f.nota_correccion ?? '—'}</span>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
            <Pagination
              page={safePage}
              totalPages={tp}
              totalItems={filteredFichajes.length}
              pageSize={25}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
