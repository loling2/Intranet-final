import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  AlertCircle, Plus, X, Clock, Search, Building2, Calendar,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Trash2,
} from 'lucide-react';

interface Props {
  isAdmin: boolean;
  centros: { id: string; nombre: string }[];
}

interface Incidencia {
  id: string;
  usuario_servicio_id: string;
  centro_id: string | null;
  titulo: string;
  descripcion: string;
  estado: string;
  prioridad: string;
  fecha: string;
  fecha_resolucion: string | null;
  creado_por_nombre: string;
  residente_nombre: string;
  centro_nombre: string | null;
}

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

function formatDateISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function formatDateDisplay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

const ESTADO_COLORS: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  pendiente: { bg: '#FEF3C7', text: '#92400E', dot: '#F59E0B', label: 'Pendiente' },
  urgente: { bg: '#FEE2E2', text: '#991B1B', dot: '#EF4444', label: 'Urgente' },
  resuelta: { bg: '#DCFCE7', text: '#166534', dot: '#22C55E', label: 'Resuelta' },
};

export default function CrmIncidenciasModule({ isAdmin, centros }: Props) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCentro, setFilterCentro] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Incidencia | null>(null);

  // Residentes para el modal
  const [residentes, setResidentes] = useState<{ id: string; nombre: string }[]>([]);

  // Form
  const [formResidente, setFormResidente] = useState('');
  const [formCentro, setFormCentro] = useState('');
  const [formTitulo, setFormTitulo] = useState('');
  const [formDescripcion, setFormDescripcion] = useState('');
  const [formEstado, setFormEstado] = useState('pendiente');
  const [formPrioridad, setFormPrioridad] = useState('normal');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadIncidencias = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('crm_incidencias').select(`
      id, usuario_servicio_id, centro_id, titulo, descripcion, estado, prioridad,
      fecha, fecha_resolucion, creado_por_nombre
    `);
    if (filterCentro) query = query.eq('centro_id', filterCentro);
    if (filterEstado) query = query.eq('estado', filterEstado);
    const { data } = await query.order('fecha', { ascending: false });
    const rows = (data ?? []) as Omit<Incidencia, 'residente_nombre' | 'centro_nombre'>[];

    // Fetch resident names
    const residentIds = [...new Set(rows.map(r => r.usuario_servicio_id))];
    let residentMap: Record<string, string> = {};
    if (residentIds.length > 0) {
      const { data: resData } = await supabase
        .from('usuarios_servicios')
        .select('id, nombre, apellidos')
        .in('id', residentIds);
      for (const r of (resData ?? []) as { id: string; nombre: string; apellidos: string | null }[]) {
        residentMap[r.id] = `${r.nombre} ${r.apellidos ?? ''}`.trim();
      }
    }

    // Fetch centro names
    const centroIds = [...new Set(rows.map(r => r.centro_id).filter(Boolean))] as string[];
    let centroMap: Record<string, string> = {};
    if (centroIds.length > 0) {
      const { data: centroData } = await supabase
        .from('centros')
        .select('id, nombre')
        .in('id', centroIds);
      for (const c of (centroData ?? []) as { id: string; nombre: string }[]) {
        centroMap[c.id] = c.nombre;
      }
    }

    const fullRows: Incidencia[] = rows.map(r => ({
      ...r,
      residente_nombre: residentMap[r.usuario_servicio_id] ?? 'Desconocido',
      centro_nombre: r.centro_id ? (centroMap[r.centro_id] ?? null) : null,
    }));
    setIncidencias(fullRows);
    setLoading(false);
  }, [filterCentro, filterEstado]);

  const loadResidentes = useCallback(async () => {
    const { data } = await supabase.rpc('get_my_crm_pacientes');
    setResidentes(((data ?? []) as { id: string; nombre: string; apellidos: string | null }[]).map(r => ({
      id: r.id,
      nombre: `${r.nombre} ${r.apellidos ?? ''}`.trim(),
    })));
  }, []);

  useEffect(() => { loadIncidencias(); }, [loadIncidencias]);
  useEffect(() => { loadResidentes(); }, [loadResidentes]);

  // Filter by year and search
  const filteredIncidencias = incidencias.filter(i => {
    const incYear = new Date(i.fecha).getFullYear();
    if (incYear !== filterYear) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!i.titulo.toLowerCase().includes(q) && !i.residente_nombre.toLowerCase().includes(q) && !i.descripcion.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Calendar
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const todayISO = formatDateISO(new Date());
  const calendarCells: { date: Date | null; iso: string | null }[] = [];
  for (let i = 0; i < startOffset; i++) calendarCells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    calendarCells.push({ date, iso: formatDateISO(date) });
  }

  // Map incidencias by date for calendar
  const incByDate: Record<string, Incidencia[]> = {};
  for (const inc of filteredIncidencias) {
    const iso = formatDateISO(new Date(inc.fecha));
    if (!incByDate[iso]) incByDate[iso] = [];
    incByDate[iso].push(inc);
  }

  // Determine dot color for a date (urgente > pendiente > resuelta)
  function dateDotColor(incs: Incidencia[]): string | null {
    if (incs.length === 0) return null;
    if (incs.some(i => i.estado === 'urgente')) return '#EF4444';
    if (incs.some(i => i.estado === 'pendiente')) return '#F59E0B';
    if (incs.some(i => i.estado === 'resuelta')) return '#22C55E';
    return null;
  }

  const prevMonth = () => setCalendarDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalendarDate(new Date(year, month + 1, 1));
  const goToday = () => setCalendarDate(new Date());

  // Stats
  const stats = {
    total: filteredIncidencias.length,
    pendientes: filteredIncidencias.filter(i => i.estado === 'pendiente').length,
    urgentes: filteredIncidencias.filter(i => i.estado === 'urgente').length,
    resueltas: filteredIncidencias.filter(i => i.estado === 'resuelta').length,
  noResueltas: filteredIncidencias.filter(i => i.estado !== 'resuelta').length,
  tasaResolucion: filteredIncidencias.length > 0
      ? Math.round((filteredIncidencias.filter(i => i.estado === 'resuelta').length / filteredIncidencias.length) * 100)
      : 0,
  };

  async function handleSave() {
    if (!formResidente) { setFormError('Selecciona un residente'); return; }
    if (!formTitulo.trim()) { setFormError('El título es obligatorio'); return; }
    setFormSaving(true); setFormError('');
    try {
      const { error } = await supabase.from('crm_incidencias').insert({
        usuario_servicio_id: formResidente,
        centro_id: formCentro || null,
        titulo: formTitulo.trim(),
        descripcion: formDescripcion.trim(),
        estado: formEstado,
        prioridad: formPrioridad,
        fecha: new Date().toISOString(),
      });
      if (error) throw error;
      setShowModal(false);
      setFormResidente(''); setFormCentro(''); setFormTitulo(''); setFormDescripcion('');
      setFormEstado('pendiente'); setFormPrioridad('normal');
      await loadIncidencias();
    } catch {
      setFormError('No se pudo guardar la incidencia.');
    } finally {
      setFormSaving(false);
    }
  }

  async function handleEstadoChange(inc: Incidencia, nuevoEstado: string) {
    const update: Record<string, unknown> = { estado: nuevoEstado, updated_at: new Date().toISOString() };
    if (nuevoEstado === 'resuelta') update.fecha_resolucion = new Date().toISOString();
    else update.fecha_resolucion = null;
    await supabase.from('crm_incidencias').update(update).eq('id', inc.id);
    await loadIncidencias();
  }

  async function handleDelete(inc: Incidencia) {
    await supabase.from('crm_incidencias').delete().eq('id', inc.id);
    setConfirmDelete(null);
    await loadIncidencias();
  }

  const availableYears = [...new Set(incidencias.map(i => new Date(i.fecha).getFullYear()))].sort((a, b) => b - a);
  if (!availableYears.includes(filterYear)) availableYears.unshift(filterYear);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Incidencias</h2>
          <p className="text-sm" style={{ color: '#64748B' }}>Incidencias de residentes por centro</p>
        </div>
        <button onClick={() => { setShowModal(true); setFormError(''); setFormResidente(''); setFormCentro(''); setFormTitulo(''); setFormDescripcion(''); setFormEstado('pendiente'); setFormPrioridad('normal'); }}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={14} /> Nueva incidencia
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Search size={16} style={{ color: '#64748B' }} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, residente o descripción..."
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: '#0F172A' }} />
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Building2 size={16} style={{ color: '#64748B' }} />
          <select value={filterCentro} onChange={e => setFilterCentro(e.target.value)}
            className="bg-transparent text-sm outline-none cursor-pointer min-w-[120px]" style={{ color: '#0F172A' }}>
            <option value="">Todos los centros</option>
            {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Calendar size={16} style={{ color: '#64748B' }} />
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="bg-transparent text-sm outline-none cursor-pointer min-w-[80px]" style={{ color: '#0F172A' }}>
            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <AlertCircle size={16} style={{ color: '#64748B' }} />
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
            className="bg-transparent text-sm outline-none cursor-pointer min-w-[100px]" style={{ color: '#0F172A' }}>
            <option value="">Todos</option>
            <option value="pendiente">Pendientes</option>
            <option value="urgente">Urgentes</option>
            <option value="resuelta">Resueltas</option>
          </select>
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Total</p>
          <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{stats.total}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A' }}>
          <p className="text-xs" style={{ color: '#92400E' }}>Pendientes</p>
          <p className="text-2xl font-bold" style={{ color: '#92400E' }}>{stats.pendientes}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#FEE2E2', border: '1px solid #FECACA' }}>
          <p className="text-xs" style={{ color: '#991B1B' }}>Urgentes</p>
          <p className="text-2xl font-bold" style={{ color: '#991B1B' }}>{stats.urgentes}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0' }}>
          <p className="text-xs" style={{ color: '#166534' }}>Resueltas</p>
          <p className="text-2xl font-bold" style={{ color: '#166534' }}>{stats.resueltas}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <p className="text-xs" style={{ color: '#1E40AF' }}>Tasa resolución</p>
          <p className="text-2xl font-bold" style={{ color: '#1E40AF' }}>{stats.tasaResolucion}%</p>
        </div>
      </div>

      {/* Calendar + List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Calendar */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{MONTH_NAMES[month]} {year}</h3>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><ChevronLeft size={16} /></button>
              <button onClick={goToday} className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Hoy</button>
              <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><ChevronRight size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#94A3B8' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell, i) => {
              if (!cell.date || !cell.iso) return <div key={i} className="aspect-square" />;
              const isToday = cell.iso === todayISO;
              const incs = incByDate[cell.iso] ?? [];
              const dotColor = dateDotColor(incs);
              return (
                <div key={i}
                  className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative"
                  style={{
                    backgroundColor: isToday ? '#EFF6FF' : '#F8FAFC',
                    color: isToday ? '#0369A1' : '#475569',
                    border: isToday ? '1px solid #BFDBFE' : '1px solid transparent',
                  }}
                  title={incs.length > 0 ? `${incs.length} incidencia(s)` : ''}>
                  <span className="font-medium">{cell.date!.getDate()}</span>
                  {dotColor && <span className="absolute bottom-1 w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />}
                  {incs.length > 1 && <span className="absolute top-0.5 right-1 text-[8px] font-bold" style={{ color: '#94A3B8' }}>{incs.length}</span>}
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} /><span className="text-xs" style={{ color: '#64748B' }}>Pendiente</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#EF4444' }} /><span className="text-xs" style={{ color: '#64748B' }}>Urgente</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22C55E' }} /><span className="text-xs" style={{ color: '#64748B' }}>Resuelta</span></div>
          </div>
        </div>

        {/* List */}
        <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Listado de incidencias ({filterYear})</h3>
            <span className="text-xs" style={{ color: '#94A3B8' }}>{filteredIncidencias.length} registro(s)</span>
          </div>
          {loading ? (
            <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /><p className="text-xs" style={{ color: '#64748B' }}>Cargando...</p></div>
          ) : filteredIncidencias.length === 0 ? (
            <div className="text-center py-8"><AlertCircle size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} /><p className="text-xs font-medium" style={{ color: '#475569' }}>Sin incidencias en {filterYear}</p></div>
          ) : (
            <div className="space-y-3 max-h-[450px] overflow-y-auto">
              {filteredIncidencias.map(inc => {
                const colors = ESTADO_COLORS[inc.estado] ?? ESTADO_COLORS.pendiente;
                return (
                  <div key={inc.id} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: colors.bg, color: colors.text }}>{colors.label}</span>
                          {inc.prioridad === 'alta' && <span className="text-xs font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: '#FEE2E2', color: '#991B1B' }}>Alta prioridad</span>}
                        </div>
                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{inc.titulo}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{inc.residente_nombre}{inc.centro_nombre && ` · ${inc.centro_nombre}`}</p>
                      </div>
                      <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{new Date(inc.fecha).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>
                    </div>
                    {inc.descripcion && <p className="text-xs mb-2" style={{ color: '#475569' }}>{inc.descripcion}</p>}
                    <div className="flex items-center gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                      <select value={inc.estado} onChange={e => handleEstadoChange(inc, e.target.value)}
                        className="text-xs px-2 py-1 rounded-lg outline-none cursor-pointer"
                        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}>
                        <option value="pendiente">Pendiente</option>
                        <option value="urgente">Urgente</option>
                        <option value="resuelta">Resuelta</option>
                      </select>
                      {inc.fecha_resolucion && <span className="text-xs flex items-center gap-1" style={{ color: '#22C55E' }}><CheckCircle2 size={12} /> {new Date(inc.fecha_resolucion).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' })}</span>}
                      {isAdmin && <button onClick={() => setConfirmDelete(inc)} className="ml-auto w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={13} /></button>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nueva incidencia */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva incidencia</h3>
              <button onClick={() => setShowModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Residente *</label>
                <select value={formResidente} onChange={e => setFormResidente(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}>
                  <option value="">Selecciona un residente...</option>
                  {residentes.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Centro</label>
                <select value={formCentro} onChange={e => setFormCentro(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}>
                  <option value="">Sin centro específico</option>
                  {centros.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Título *</label>
                <input type="text" value={formTitulo} onChange={e => setFormTitulo(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                  placeholder="Ej: Caída en la habitación..." autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Descripción</label>
                <textarea value={formDescripcion} onChange={e => setFormDescripcion(e.target.value)} rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                  placeholder="Describe la incidencia..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Estado</label>
                  <select value={formEstado} onChange={e => setFormEstado(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}>
                    <option value="pendiente">Pendiente</option>
                    <option value="urgente">Urgente</option>
                    <option value="resuelta">Resuelta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Prioridad</label>
                  <select value={formPrioridad} onChange={e => setFormPrioridad(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                  </select>
                </div>
              </div>
              {formError && <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={formSaving}
                  className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60"
                  style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                  {formSaving ? 'Guardando...' : 'Guardar incidencia'}
                </button>
                <button onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <AlertTriangle size={16} style={{ color: '#DC2626' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Eliminar incidencia</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: '#475569' }}>Vas a eliminar <span className="font-semibold" style={{ color: '#0F172A' }}>{confirmDelete.titulo}</span></p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
              <button onClick={() => handleDelete(confirmDelete)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>
                <Trash2 size={14} /> Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
