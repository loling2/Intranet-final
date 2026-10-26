import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  Plus, X, Trash2, Clock, Calendar, ChevronLeft, ChevronRight, Users, Stethoscope,
  Heart, Activity, Brain, UserCog, Briefcase,
} from 'lucide-react';

interface Props {
  usuarioId: string;
  usuarioNombre: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Seguimiento {
  id: string;
  fecha: string;
  turno: string;
  descripcion: string;
  intervenciones: string;
  autor_nombre: string;
  created_at: string;
}

interface NotaProfesion {
  id: string;
  autor_id: string;
  profesion: string;
  fecha: string;
  contenido: string;
  autor_nombre: string | null;
  created_at: string;
}

const TURNO_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  mañana: { label: 'Mañana', color: '#D97706', bg: '#FFFBEB' },
  tarde: { label: 'Tarde', color: '#0369A1', bg: '#EFF6FF' },
  noche: { label: 'Noche', color: '#6D28D9', bg: '#F5F3FF' },
};

const PROFESIONES: { value: string; label: string; color: string; bg: string; icon: typeof Users }[] = [
  { value: 'psicologo', label: 'Psicología', color: '#7C3AED', bg: '#F5F3FF', icon: Brain },
  { value: 'gerocultor', label: 'Gerocultura', color: '#0891B2', bg: '#ECFEFF', icon: Heart },
  { value: 'enfermero', label: 'Enfermería', color: '#16A34A', bg: '#F0FDF4', icon: Stethoscope },
  { value: 'fisio', label: 'Fisioterapia', color: '#EA580C', bg: '#FFF7ED', icon: Activity },
  { value: 'trabajador_social', label: 'Trabajo social', color: '#2563EB', bg: '#EFF6FF', icon: Users },
  { value: 'medico', label: 'Medicina', color: '#DC2626', bg: '#FEF2F2', icon: Stethoscope },
  { value: 'terapeuta_ocupacional', label: 'Terapia ocupacional', color: '#0D9488', bg: '#F0FDFA', icon: UserCog },
  { value: 'auxiliar', label: 'Auxiliar', color: '#64748B', bg: '#F8FAFC', icon: Briefcase },
];

function profesionLabel(v: string): string {
  return PROFESIONES.find((p) => p.value === v)?.label ?? v.charAt(0).toUpperCase() + v.slice(1);
}
function profesionStyle(v: string): { color: string; bg: string } {
  const p = PROFESIONES.find((x) => x.value === v);
  return p ? { color: p.color, bg: p.bg } : { color: '#475569', bg: '#F1F5F9' };
}

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function formatISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function CrmSeguimientoModule({ usuarioId, autorNombre, isAdmin }: Props) {
  // --- Existing seguimiento diario state (unchanged) ---
  const [registros, setRegistros] = useState<Seguimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [turno, setTurno] = useState('mañana');
  const [descripcion, setDescripcion] = useState('');
  const [intervenciones, setIntervenciones] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // --- New: profession-based notes ---
  const [myProfesion, setMyProfesion] = useState<string | null>(null);
  const [notasProf, setNotasProf] = useState<NotaProfesion[]>([]);
  const [notasLoading, setNotasLoading] = useState(false);
  const [showNotaForm, setShowNotaForm] = useState(false);
  const [notaContenido, setNotaContenido] = useState('');
  const [notaFecha, setNotaFecha] = useState(new Date().toISOString().slice(0, 10));
  const [notaSaving, setNotaSaving] = useState(false);
  const [notaError, setNotaError] = useState('');
  const [editingNotaId, setEditingNotaId] = useState<string | null>(null);

  // Calendar
  const [calDate, setCalDate] = useState(new Date());
  const [filterFecha, setFilterFecha] = useState('');

  const year = calDate.getFullYear();
  const month = calDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();
  const todayISO = formatISO(new Date());
  const calendarCells: { date: Date | null; iso: string | null }[] = [];
  for (let i = 0; i < startOffset; i++) calendarCells.push({ date: null, iso: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    calendarCells.push({ date, iso: formatISO(date) });
  }
  const notasByDate: Record<string, number> = {};
  for (const n of notasProf) { if (n.fecha) notasByDate[n.fecha] = (notasByDate[n.fecha] ?? 0) + 1; }
  const prevMonth = () => setCalDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCalDate(new Date(year, month + 1, 1));
  const goToday = () => { setCalDate(new Date()); setFilterFecha(''); };

  // --- Load my profesion ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      if (!uid) return;
      supabase.from('user_profiles').select('profesion, role').eq('id', uid).maybeSingle()
        .then(({ data }) => {
          const prof = (data as { profesion: string | null; role: string } | null)?.profesion ?? null;
          const role = (data as { profesion: string | null; role: string } | null)?.role;
          setMyProfesion(prof ?? (role === 'admin' ? '__admin__' : null));
        });
    });
  }, []);

  // --- Load seguimiento diario (existing) ---
  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_seguimiento_diario')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    setRegistros((data ?? []) as Seguimiento[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  // --- Load profession notes ---
  const loadNotasProf = useCallback(async () => {
    setNotasLoading(true);
    const { data } = await supabase
      .from('crm_notas_profesion')
      .select('id, autor_id, profesion, fecha, contenido, created_at, autor_nombre')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false });
    setNotasProf((data ?? []) as NotaProfesion[]);
    setNotasLoading(false);
  }, [usuarioId]);

  useEffect(() => { loadNotasProf(); }, [loadNotasProf]);

  async function handleSave() {
    if (!descripcion.trim()) { setError('La descripción es obligatoria'); return; }
    setSaving(true); setError('');
    const { error: insErr } = await supabase.from('crm_seguimiento_diario').insert({
      usuario_servicio_id: usuarioId, fecha, turno, descripcion: descripcion.trim(),
      intervenciones: intervenciones.trim(), autor_nombre: autorNombre,
    });
    if (insErr) { setError('No se pudo guardar'); }
    else {
      setShowForm(false); setDescripcion(''); setIntervenciones('');
      await load();
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_seguimiento_diario').delete().eq('id', id);
    await load();
  }

  // --- Nota por profesión handlers ---
  const openNewNota = (iso?: string) => {
    setEditingNotaId(null);
    setNotaFecha(iso ?? todayISO);
    setNotaContenido('');
    setNotaError('');
    setShowNotaForm(true);
  };
  const openEditNota = (n: NotaProfesion) => {
    setEditingNotaId(n.id);
    setNotaFecha(n.fecha);
    setNotaContenido(n.contenido);
    setNotaError('');
    setShowNotaForm(true);
  };
  const handleSaveNota = async () => {
    if (!notaContenido.trim()) { setNotaError('El contenido es obligatorio'); return; }
    const prof = myProfesion === '__admin__' ? null : myProfesion;
    if (!prof) { setNotaError('Tu usuario no tiene profesión asignada. Pide al administrador que la configure.'); return; }
    setNotaSaving(true); setNotaError('');
    try {
      if (editingNotaId) {
        const { error: e } = await supabase.from('crm_notas_profesion')
          .update({ contenido: notaContenido.trim(), fecha: notaFecha }).eq('id', editingNotaId);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from('crm_notas_profesion').insert({
          usuario_servicio_id: usuarioId,
          profesion: prof,
          fecha: notaFecha,
          contenido: notaContenido.trim(),
          autor_nombre: autorNombre,
        });
        if (e) throw e;
      }
      setShowNotaForm(false); setNotaContenido(''); setEditingNotaId(null);
      await loadNotasProf();
    } catch {
      setNotaError('No se pudo guardar la nota.');
    } finally {
      setNotaSaving(false);
    }
  };
  const handleDeleteNota = async (id: string) => {
    await supabase.from('crm_notas_profesion').delete().eq('id', id);
    await loadNotasProf();
  };

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  // Group notasProf by profesion for display
  const profesionesPresentes = Array.from(new Set(notasProf.map((n) => n.profesion)));
  const notasFiltered = filterFecha ? notasProf.filter((n) => n.fecha === filterFecha) : notasProf;

  return (
    <div className="space-y-6">
      {/* ===================== Notas por profesión ===================== */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Notas por profesión</h3>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
              Registros diarios separados por profesión. Cada profesional ve solo las notas de su área.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {filterFecha && (
              <button onClick={() => setFilterFecha('')} className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                Ver todas
              </button>
            )}
            <button onClick={() => openNewNota()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              <Plus size={12} />Nueva nota
            </button>
          </div>
        </div>

        {/* Mi profesión badge */}
        {myProfesion && myProfesion !== '__admin__' && (
          <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: profesionStyle(myProfesion).bg, color: profesionStyle(myProfesion).color }}>
            Tu profesión: {profesionLabel(myProfesion)}
          </div>
        )}
        {myProfesion === '__admin__' && (
          <div className="mb-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
            Modo administrador: ves todas las profesiones
          </div>
        )}
        {!myProfesion && (
          <div className="mb-3 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
            No tienes profesión asignada. Contacta con administración para configurarla y poder escribir notas.
          </div>
        )}

        {/* Calendar */}
        <div className="rounded-xl p-3 mb-4" style={{ border: '1px solid #E2E8F0' }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><ChevronLeft size={14} /></button>
            <span className="text-xs font-semibold" style={{ color: '#0F172A' }}>{MONTH_NAMES[month]} {year}</span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><ChevronRight size={14} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => <div key={d} className="text-center text-[10px] font-medium" style={{ color: '#94A3B8' }}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((c, i) => {
              if (!c.iso) return <div key={i} />;
              const isToday = c.iso === todayISO;
              const isSelected = c.iso === filterFecha;
              const count = notasByDate[c.iso] ?? 0;
              return (
                <button key={i} onClick={() => setFilterFecha(isSelected ? '' : c.iso)}
                  className="relative aspect-square rounded-lg text-[11px] font-medium cursor-pointer transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: isSelected ? '#0369A1' : isToday ? '#F0F9FF' : 'transparent',
                    color: isSelected ? '#FFFFFF' : isToday ? '#0369A1' : '#475569',
                    border: isToday && !isSelected ? '1px solid #BAE6FD' : '1px solid transparent',
                  }}>
                  {c.date?.getDate()}
                  {count > 0 && (
                    <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isSelected ? '#FFFFFF' : '#0369A1' }} />
                  )}
                </button>
              );
            })}
          </div>
          <button onClick={goToday} className="mt-2 w-full py-1.5 rounded-lg text-[11px] font-medium cursor-pointer"
            style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Hoy</button>
        </div>

        {/* Notas grouped by profesion */}
        {notasLoading ? (
          <div className="text-center py-6"><Clock size={18} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
        ) : notasFiltered.length === 0 ? (
          <div className="text-center py-6">
            <Calendar size={24} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {filterFecha ? `No hay notas para el ${filterFecha.split('-').reverse().join('/')}` : 'No hay notas por profesión todavía'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {profesionesPresentes.map((prof) => {
              const notasOfProf = notasFiltered.filter((n) => n.profesion === prof);
              if (notasOfProf.length === 0) return null;
              const st = profesionStyle(prof);
              const PIcon = PROFESIONES.find((p) => p.value === prof)?.icon ?? Users;
              return (
                <div key={prof} className="rounded-xl p-3" style={{ border: `1px solid ${st.color}30`, backgroundColor: st.bg + '40' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: st.bg }}>
                      <PIcon size={13} style={{ color: st.color }} />
                    </div>
                    <span className="text-xs font-semibold" style={{ color: st.color }}>{profesionLabel(prof)}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>· {notasOfProf.length} nota{notasOfProf.length !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="space-y-2">
                    {notasOfProf.map((n) => (
                      <div key={n.id} className="rounded-lg p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium" style={{ color: '#475569' }}>
                              {n.fecha.split('-').reverse().join('/')}
                            </span>
                            {n.autor_nombre && <span className="text-xs" style={{ color: '#94A3B8' }}>· {n.autor_nombre}</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditNota(n)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>
                              <span className="text-[10px] font-semibold">EDITAR</span>
                            </button>
                            {(isAdmin || n.autor_id === undefined) && (
                              <button onClick={() => handleDeleteNota(n.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-sm" style={{ color: '#1E293B', lineHeight: 1.5 }}>{n.contenido}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== Seguimiento diario existente ===================== */}
      <div className="rounded-2xl p-5" style={cardStyle}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Seguimiento diario e intervenciones</h3>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
            style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
            <Plus size={12} />Nuevo registro
          </button>
        </div>

        {loading ? (
          <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
        ) : registros.length === 0 ? (
          <div className="text-center py-8 rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
            <Calendar size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>No hay registros de seguimiento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {registros.map((r) => {
              const t = TURNO_LABELS[r.turno] ?? { label: r.turno, color: '#475569', bg: '#F1F5F9' };
              return (
                <div key={r.id} className="rounded-xl p-4" style={{ border: '1px solid #E2E8F0' }}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: t.bg, color: t.color }}>{t.label}</span>
                      <span className="text-xs font-medium" style={{ color: '#475569' }}>{r.fecha}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>· {r.autor_nombre}</span>
                    </div>
                    {isAdmin && (
                      <button onClick={() => handleDelete(r.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                  <p className="text-sm" style={{ color: '#1E293B' }}>{r.descripcion}</p>
                  {r.intervenciones && (
                    <div className="mt-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                      <p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Intervenciones</p>
                      <p className="text-xs" style={{ color: '#64748B' }}>{r.intervenciones}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal nota por profesión */}
      {showNotaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingNotaId ? 'Editar nota' : 'Nueva nota diaria'}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  {usuarioNombre} · {myProfesion && myProfesion !== '__admin__' ? profesionLabel(myProfesion) : 'Profesión'}
                </p>
              </div>
              <button onClick={() => setShowNotaForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label>
                <input type="date" value={notaFecha} onChange={(e) => setNotaFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Nota *</label>
                <textarea value={notaContenido} onChange={(e) => setNotaContenido(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Escribe la información del día..." /></div>
              {notaError && <p className="text-xs" style={{ color: '#DC2626' }}>{notaError}</p>}
              <div className="flex gap-2">
                <button onClick={handleSaveNota} disabled={notaSaving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{notaSaving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setShowNotaForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal seguimiento diario (existing) */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nuevo registro de seguimiento</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Fecha</label>
                  <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Turno</label>
                  <select value={turno} onChange={(e) => setTurno(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="mañana">Mañana</option><option value="tarde">Tarde</option><option value="noche">Noche</option>
                  </select></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Descripción *</label>
                <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Describe la situación y observaciones del día..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Intervenciones realizadas</label>
                <textarea value={intervenciones} onChange={(e) => setIntervenciones(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Intervenciones, acciones, medidas tomadas..." /></div>
              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
