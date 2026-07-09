import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck, Plus, Search, X, Save, Pencil, Trash2, Users,
  ChevronRight, ChevronLeft, CheckCircle2, XCircle, Clock, AlertCircle,
  BarChart2, BookOpen, Award, RefreshCw,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSociety } from '../context/SocietyContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Examen {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  duracion_minutos: number | null;
  puntuacion_minima: number;
  sociedad_id: string | null;
  estado: 'borrador' | 'activo' | 'finalizado';
  created_at: string;
}

interface Asignacion {
  id: string;
  examen_id: string;
  empleado_id: string | null;
  nombre_empleado: string;
  dni: string | null;
  estado: 'pendiente' | 'en_curso' | 'completado' | 'suspendido';
  puntuacion: number | null;
  fecha_realizacion: string | null;
  notas: string | null;
  created_at: string;
}

interface EmpleadoOption {
  id: string;
  nombre: string;
  dni: string | null;
}

const EMPTY_EXAMEN: Omit<Examen, 'id' | 'created_at'> = {
  titulo: '',
  descripcion: '',
  fecha_inicio: '',
  fecha_fin: '',
  duracion_minutos: null,
  puntuacion_minima: 60,
  sociedad_id: null,
  estado: 'activo',
};

const ESTADO_COLORS: Record<string, { bg: string; text: string; border: string; label: string }> = {
  borrador:    { bg: '#F8FAFC', text: '#64748B', border: '#CBD5E1', label: 'Borrador' },
  activo:      { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', label: 'Activo' },
  finalizado:  { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1', label: 'Finalizado' },
  pendiente:   { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', label: 'Pendiente' },
  en_curso:    { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE', label: 'En curso' },
  completado:  { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', label: 'Aprobado' },
  suspendido:  { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', label: 'Suspendido' },
};

// ─── Exam Form Modal ──────────────────────────────────────────────────────────

function ExamenFormModal({
  initial,
  onSave,
  onClose,
  societies,
}: {
  initial: Partial<Examen> | null;
  onSave: (data: Omit<Examen, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
  societies: { id: string; name: string }[];
}) {
  const [form, setForm] = useState<Omit<Examen, 'id' | 'created_at'>>(
    initial
      ? {
          titulo: initial.titulo ?? '',
          descripcion: initial.descripcion ?? '',
          fecha_inicio: initial.fecha_inicio ?? '',
          fecha_fin: initial.fecha_fin ?? '',
          duracion_minutos: initial.duracion_minutos ?? null,
          puntuacion_minima: initial.puntuacion_minima ?? 60,
          sociedad_id: initial.sociedad_id ?? null,
          estado: initial.estado ?? 'activo',
        }
      : { ...EMPTY_EXAMEN }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.titulo.trim()) { setError('El titulo es obligatorio'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        ...form,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion?.trim() || null,
        fecha_inicio: form.fecha_inicio || null,
        fecha_fin: form.fecha_fin || null,
        sociedad_id: form.sociedad_id || null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none transition-colors';
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };
  const labelCls = 'block text-xs font-medium mb-1.5';
  const labelStyle = { color: '#475569' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg,#0891B2,#0369A1)' }}>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={18} className="text-white" />
            <h3 className="font-bold text-white">{initial?.id ? 'Editar examen' : 'Nuevo examen'}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className={labelCls} style={labelStyle}>Titulo *</label>
            <input className={inputCls} style={inputStyle} value={form.titulo} onChange={e => set('titulo', e.target.value)} placeholder="Ej: Prevencion de Riesgos Laborales 2026" />
          </div>
          <div>
            <label className={labelCls} style={labelStyle}>Descripcion</label>
            <textarea className={inputCls} style={inputStyle} rows={3} value={form.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} placeholder="Descripcion del contenido del examen..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Fecha inicio</label>
              <input type="date" className={inputCls} style={inputStyle} value={form.fecha_inicio ?? ''} onChange={e => set('fecha_inicio', e.target.value)} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Fecha fin</label>
              <input type="date" className={inputCls} style={inputStyle} value={form.fecha_fin ?? ''} onChange={e => set('fecha_fin', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Duracion (minutos)</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.duracion_minutos ?? ''} onChange={e => set('duracion_minutos', e.target.value ? Number(e.target.value) : null)} placeholder="60" min={1} />
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Puntuacion minima (%)</label>
              <input type="number" className={inputCls} style={inputStyle} value={form.puntuacion_minima} onChange={e => set('puntuacion_minima', Number(e.target.value))} min={0} max={100} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls} style={labelStyle}>Sociedad</label>
              <select className={inputCls} style={inputStyle} value={form.sociedad_id ?? ''} onChange={e => set('sociedad_id', e.target.value || null)}>
                <option value="">Todas las sociedades</option>
                {societies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls} style={labelStyle}>Estado</label>
              <select className={inputCls} style={inputStyle} value={form.estado} onChange={e => set('estado', e.target.value)}>
                <option value="borrador">Borrador</option>
                <option value="activo">Activo</option>
                <option value="finalizado">Finalizado</option>
              </select>
            </div>
          </div>
          {error && <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{error}</p>}
        </div>

        <div className="px-6 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-slate-100" style={{ color: '#64748B' }}>
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-60"
            style={{ backgroundColor: '#0891B2' }}
          >
            <Save size={14} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign + Result Modal ────────────────────────────────────────────────────

function AsignacionModal({
  examen,
  asignacion,
  empleados,
  onSave,
  onClose,
}: {
  examen: Examen;
  asignacion: Asignacion | null;
  empleados: EmpleadoOption[];
  onSave: (data: Partial<Asignacion> & { nombre_empleado: string }) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!asignacion;
  const [selectedEmpleadoId, setSelectedEmpleadoId] = useState(asignacion?.empleado_id ?? '');
  const [nombreManual, setNombreManual] = useState(asignacion?.nombre_empleado ?? '');
  const [dniManual, setDniManual] = useState(asignacion?.dni ?? '');
  const [estado, setEstado] = useState(asignacion?.estado ?? 'pendiente');
  const [puntuacion, setPuntuacion] = useState<number | null>(asignacion?.puntuacion ?? null);
  const [notas, setNotas] = useState(asignacion?.notas ?? '');
  const [useManual, setUseManual] = useState(!asignacion?.empleado_id && !!asignacion?.nombre_empleado);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedEmp = empleados.find(e => e.id === selectedEmpleadoId);
  const displayNombre = useManual ? nombreManual : (selectedEmp?.nombre ?? '');
  const displayDni = useManual ? dniManual : (selectedEmp?.dni ?? '');

  const handleSave = async () => {
    const nombre = displayNombre.trim();
    if (!nombre) { setError('Introduce el nombre del empleado'); return; }
    if (!useManual && !selectedEmpleadoId) { setError('Selecciona un empleado o introduce el nombre manualmente'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({
        examen_id: examen.id,
        empleado_id: useManual ? null : (selectedEmpleadoId || null),
        nombre_empleado: nombre,
        dni: displayDni.trim() || null,
        estado,
        puntuacion: puntuacion,
        notas: notas.trim() || null,
        fecha_realizacion: (estado === 'completado' || estado === 'suspendido') && !asignacion?.fecha_realizacion
          ? new Date().toISOString()
          : (asignacion?.fecha_realizacion ?? null),
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none';
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0', background: 'linear-gradient(135deg,#0891B2,#0369A1)' }}>
          <div className="flex items-center gap-2">
            <Users size={16} className="text-white" />
            <h3 className="font-bold text-white text-sm">{isEdit ? 'Editar resultado' : 'Asignar empleado'}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs font-medium px-2 py-1 rounded-md" style={{ backgroundColor: '#F0F9FF', color: '#0891B2', border: '1px solid #BAE6FD' }}>
            {examen.titulo}
          </p>

          {!isEdit && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setUseManual(false)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: !useManual ? '#0891B2' : '#F8FAFC', color: !useManual ? '#fff' : '#64748B', border: `1px solid ${!useManual ? '#0891B2' : '#E2E8F0'}` }}
              >
                <Users size={12} /> Desde lista
              </button>
              <button
                onClick={() => setUseManual(true)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: useManual ? '#0891B2' : '#F8FAFC', color: useManual ? '#fff' : '#64748B', border: `1px solid ${useManual ? '#0891B2' : '#E2E8F0'}` }}
              >
                <Pencil size={12} /> Manual
              </button>
            </div>
          )}

          {!useManual && !isEdit ? (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Empleado *</label>
              <select className={inputCls} style={inputStyle} value={selectedEmpleadoId} onChange={e => setSelectedEmpleadoId(e.target.value)}>
                <option value="">Seleccionar empleado...</option>
                {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}{e.dni ? ` (${e.dni})` : ''}</option>)}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre *</label>
                <input className={inputCls} style={inputStyle} value={nombreManual} onChange={e => setNombreManual(e.target.value)} placeholder="Nombre completo" readOnly={isEdit && !useManual} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>DNI</label>
                <input className={inputCls} style={inputStyle} value={dniManual} onChange={e => setDniManual(e.target.value)} placeholder="00000000X" readOnly={isEdit && !useManual} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Estado</label>
            <select className={inputCls} style={inputStyle} value={estado} onChange={e => setEstado(e.target.value as Asignacion['estado'])}>
              <option value="pendiente">Pendiente</option>
              <option value="en_curso">En curso</option>
              <option value="completado">Aprobado</option>
              <option value="suspendido">Suspendido</option>
            </select>
          </div>

          {(estado === 'completado' || estado === 'suspendido') && (
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Puntuacion (%)</label>
              <input type="number" className={inputCls} style={inputStyle} value={puntuacion ?? ''} onChange={e => setPuntuacion(e.target.value ? Number(e.target.value) : null)} placeholder="0-100" min={0} max={100} />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Notas</label>
            <textarea className={inputCls} style={inputStyle} rows={2} value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observaciones..." />
          </div>

          {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
        </div>

        <div className="px-5 py-4 flex justify-end gap-2" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#0891B2' }}
          >
            <Save size={13} />
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Module ─────────────────────────────────────────────────────────────

export default function ExamenesModule() {
  const { societies } = useSociety();

  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [empleados, setEmpleados] = useState<EmpleadoOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterEstado, setFilterEstado] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');

  // Detail view
  const [selectedExamen, setSelectedExamen] = useState<Examen | null>(null);
  const [loadingAsig, setLoadingAsig] = useState(false);

  // Modals
  const [showExamenForm, setShowExamenForm] = useState(false);
  const [editingExamen, setEditingExamen] = useState<Examen | null>(null);
  const [showAsigModal, setShowAsigModal] = useState(false);
  const [editingAsig, setEditingAsig] = useState<Asignacion | null>(null);

  // Confirm delete
  const [confirmDeleteExamen, setConfirmDeleteExamen] = useState<string | null>(null);
  const [confirmDeleteAsig, setConfirmDeleteAsig] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadExamenes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('examenes').select('*').order('created_at', { ascending: false });
    setExamenes(data ?? []);
    setLoading(false);
  }, []);

  const loadEmpleados = useCallback(async () => {
    const { data } = await supabase.from('empleados').select('id, nombre, dni').eq('activo', true).order('nombre');
    setEmpleados((data ?? []).map(e => ({ id: e.id, nombre: e.nombre, dni: e.dni })));
  }, []);

  const loadAsignaciones = useCallback(async (examenId: string) => {
    setLoadingAsig(true);
    const { data } = await supabase.from('examen_asignaciones').select('*').eq('examen_id', examenId).order('created_at', { ascending: false });
    setAsignaciones(data ?? []);
    setLoadingAsig(false);
  }, []);

  useEffect(() => {
    loadExamenes();
    loadEmpleados();
  }, [loadExamenes, loadEmpleados]);

  useEffect(() => {
    if (selectedExamen) loadAsignaciones(selectedExamen.id);
  }, [selectedExamen, loadAsignaciones]);

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalActivos = examenes.filter(e => e.estado === 'activo').length;
  const totalAsignaciones = examenes.reduce((acc, _) => acc, 0);
  void totalAsignaciones;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSaveExamen = async (data: Omit<Examen, 'id' | 'created_at'>) => {
    if (editingExamen) {
      const { error } = await supabase.from('examenes').update(data).eq('id', editingExamen.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('examenes').insert(data);
      if (error) throw new Error(error.message);
    }
    await loadExamenes();
    if (selectedExamen && editingExamen?.id === selectedExamen.id) {
      const { data: updated } = await supabase.from('examenes').select('*').eq('id', editingExamen.id).maybeSingle();
      if (updated) setSelectedExamen(updated as Examen);
    }
    setEditingExamen(null);
  };

  const handleDeleteExamen = async (id: string) => {
    setDeleting(true);
    await supabase.from('examenes').delete().eq('id', id);
    setExamenes(prev => prev.filter(e => e.id !== id));
    if (selectedExamen?.id === id) setSelectedExamen(null);
    setConfirmDeleteExamen(null);
    setDeleting(false);
  };

  const handleSaveAsig = async (data: Partial<Asignacion> & { nombre_empleado: string }) => {
    if (editingAsig) {
      const { error } = await supabase.from('examen_asignaciones').update(data).eq('id', editingAsig.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from('examen_asignaciones').insert(data);
      if (error) throw new Error(error.message);
    }
    if (selectedExamen) await loadAsignaciones(selectedExamen.id);
    setEditingAsig(null);
  };

  const handleDeleteAsig = async (id: string) => {
    setDeleting(true);
    await supabase.from('examen_asignaciones').delete().eq('id', id);
    setAsignaciones(prev => prev.filter(a => a.id !== id));
    setConfirmDeleteAsig(null);
    setDeleting(false);
  };

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredExamenes = examenes.filter(e => {
    const matchSearch = !search || e.titulo.toLowerCase().includes(search.toLowerCase());
    const matchEstado = !filterEstado || e.estado === filterEstado;
    const matchSociedad = !filterSociedad || e.sociedad_id === filterSociedad || (!e.sociedad_id && filterSociedad === '');
    return matchSearch && matchEstado && matchSociedad;
  });

  const asigStats = {
    total: asignaciones.length,
    aprobados: asignaciones.filter(a => a.estado === 'completado').length,
    suspendidos: asignaciones.filter(a => a.estado === 'suspendido').length,
    pendientes: asignaciones.filter(a => a.estado === 'pendiente' || a.estado === 'en_curso').length,
    avgScore: (() => {
      const scored = asignaciones.filter(a => a.puntuacion !== null);
      if (!scored.length) return null;
      return Math.round(scored.reduce((s, a) => s + (a.puntuacion ?? 0), 0) / scored.length);
    })(),
  };

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' };

  // ── Detail View ────────────────────────────────────────────────────────────

  if (selectedExamen) {
    const est = ESTADO_COLORS[selectedExamen.estado] ?? ESTADO_COLORS.activo;
    const soc = societies.find(s => s.id === selectedExamen.sociedad_id);

    return (
      <div className="space-y-6">
        {/* Header detail */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div
            className="px-6 py-5 flex flex-wrap items-start justify-between gap-4"
            style={{ background: 'linear-gradient(135deg, #0C4A6E08, #0891B208)', borderBottom: '1px solid #E2E8F0' }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSelectedExamen(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100"
                style={{ color: '#64748B', border: '1px solid #E2E8F0' }}
              >
                <ChevronLeft size={15} />
              </button>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>{selectedExamen.titulo}</h2>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: est.bg, color: est.text, border: `1px solid ${est.border}` }}>
                    {est.label}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs" style={{ color: '#64748B' }}>
                  {selectedExamen.fecha_inicio && <span>Inicio: {selectedExamen.fecha_inicio}</span>}
                  {selectedExamen.fecha_fin && <span>Fin: {selectedExamen.fecha_fin}</span>}
                  {selectedExamen.duracion_minutos && <span>Duracion: {selectedExamen.duracion_minutos} min</span>}
                  <span>Minimo: {selectedExamen.puntuacion_minima}%</span>
                  {soc && <span>Sociedad: {soc.name}</span>}
                </div>
                {selectedExamen.descripcion && <p className="text-xs mt-1.5 max-w-xl" style={{ color: '#94A3B8' }}>{selectedExamen.descripcion}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditingExamen(selectedExamen); setShowExamenForm(true); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: '#F0F9FF', color: '#0891B2', border: '1px solid #BAE6FD' }}
              >
                <Pencil size={12} /> Editar
              </button>
              <button
                onClick={() => { setShowAsigModal(true); setEditingAsig(null); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
                style={{ backgroundColor: '#0891B2', color: '#fff' }}
              >
                <Plus size={12} /> Asignar empleado
              </button>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x" style={{ borderBottom: '1px solid #E2E8F0' }}>
            {[
              { label: 'Total asignados', value: asigStats.total, color: '#0891B2', bg: '#F0F9FF' },
              { label: 'Aprobados', value: asigStats.aprobados, color: '#16A34A', bg: '#F0FDF4' },
              { label: 'Suspendidos', value: asigStats.suspendidos, color: '#DC2626', bg: '#FEF2F2' },
              { label: 'Nota media', value: asigStats.avgScore !== null ? `${asigStats.avgScore}%` : '—', color: '#D97706', bg: '#FFFBEB' },
            ].map((stat, i) => (
              <div key={i} className="px-6 py-4 text-center">
                <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Asignaciones list */}
        <div className="rounded-2xl overflow-hidden" style={cardStyle}>
          <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-2">
              <Users size={15} style={{ color: '#0891B2' }} />
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Empleados asignados</h3>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#F0F9FF', color: '#0891B2', border: '1px solid #BAE6FD' }}>{asignaciones.length}</span>
            </div>
            <button
              onClick={() => loadAsignaciones(selectedExamen.id)}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100"
              style={{ color: '#94A3B8' }}
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {loadingAsig ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2" style={{ borderColor: '#0891B2' }} />
            </div>
          ) : asignaciones.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: '#F0F9FF' }}>
                <Users size={24} style={{ color: '#0891B2' }} />
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: '#1E293B' }}>Sin asignaciones</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Pulsa "Asignar empleado" para agregar participantes.</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {asignaciones.map(asig => {
                const s = ESTADO_COLORS[asig.estado] ?? ESTADO_COLORS.pendiente;
                const passed = asig.estado === 'completado';
                const failed = asig.estado === 'suspendido';
                return (
                  <div key={asig.id} className="px-6 py-3.5 flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: s.bg }}
                    >
                      {passed ? <CheckCircle2 size={16} style={{ color: s.text }} /> : failed ? <XCircle size={16} style={{ color: s.text }} /> : <Clock size={16} style={{ color: s.text }} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{asig.nombre_empleado}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {asig.dni && <span className="text-xs" style={{ color: '#94A3B8' }}>DNI: {asig.dni}</span>}
                        {asig.fecha_realizacion && <span className="text-xs" style={{ color: '#94A3B8' }}>{new Date(asig.fecha_realizacion).toLocaleDateString('es-ES')}</span>}
                        {asig.notas && <span className="text-xs truncate max-w-xs" style={{ color: '#94A3B8' }}>{asig.notas}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {asig.puntuacion !== null && (
                        <span className="text-sm font-bold" style={{ color: asig.puntuacion >= selectedExamen.puntuacion_minima ? '#16A34A' : '#DC2626' }}>
                          {asig.puntuacion}%
                        </span>
                      )}
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
                        {s.label}
                      </span>
                      <button
                        onClick={() => { setEditingAsig(asig); setShowAsigModal(true); }}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100"
                        style={{ color: '#64748B' }}
                        title="Editar resultado"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteAsig(asig.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
                        style={{ color: '#DC2626' }}
                        title="Eliminar asignacion"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modals */}
        {showExamenForm && (
          <ExamenFormModal
            initial={editingExamen}
            onSave={handleSaveExamen}
            onClose={() => { setShowExamenForm(false); setEditingExamen(null); }}
            societies={societies.map(s => ({ id: s.id, name: s.name }))}
          />
        )}
        {showAsigModal && selectedExamen && (
          <AsignacionModal
            examen={selectedExamen}
            asignacion={editingAsig}
            empleados={empleados}
            onSave={handleSaveAsig}
            onClose={() => { setShowAsigModal(false); setEditingAsig(null); }}
          />
        )}
        {confirmDeleteAsig && (
          <ConfirmModal
            message="Se eliminara esta asignacion. Esta accion no se puede deshacer."
            onConfirm={() => handleDeleteAsig(confirmDeleteAsig)}
            onCancel={() => setConfirmDeleteAsig(null)}
            loading={deleting}
          />
        )}
        {confirmDeleteExamen && (
          <ConfirmModal
            message="Se eliminara el examen y todas sus asignaciones. Esta accion no se puede deshacer."
            onConfirm={() => handleDeleteExamen(confirmDeleteExamen)}
            onCancel={() => setConfirmDeleteExamen(null)}
            loading={deleting}
          />
        )}
      </div>
    );
  }

  // ── List View ──────────────────────────────────────────────────────────────

  const statsTop = [
    { label: 'Examenes totales', value: examenes.length, color: '#0891B2', bg: '#F0F9FF', border: '#BAE6FD', icon: BookOpen },
    { label: 'Activos', value: totalActivos, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CheckCircle2 },
    { label: 'Finalizados', value: examenes.filter(e => e.estado === 'finalizado').length, color: '#64748B', bg: '#F1F5F9', border: '#CBD5E1', icon: Award },
    { label: 'Borradores', value: examenes.filter(e => e.estado === 'borrador').length, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: AlertCircle },
  ];

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statsTop.map((s, i) => {
          const Icon = s.icon;
          return (
            <div key={i} className="rounded-xl p-5" style={{ backgroundColor: s.bg, border: `1px solid ${s.border}` }}>
              <div className="flex items-center justify-between mb-2">
                <Icon size={16} style={{ color: s.color }} />
              </div>
              <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs font-medium mt-1" style={{ color: s.color, opacity: 0.8 }}>{s.label}</p>
            </div>
          );
        })}
      </div>

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={cardStyle}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <ClipboardCheck size={16} style={{ color: '#0891B2' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Examenes</h3>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#F0F9FF', color: '#0891B2', border: '1px solid #BAE6FD' }}>{filteredExamenes.length}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar..."
                className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '160px' }}
              />
            </div>
            <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}>
              <option value="">Todos los estados</option>
              <option value="borrador">Borrador</option>
              <option value="activo">Activo</option>
              <option value="finalizado">Finalizado</option>
            </select>
            <select value={filterSociedad} onChange={e => setFilterSociedad(e.target.value)} className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}>
              <option value="">Todas las sociedades</option>
              {societies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button
              onClick={() => { setEditingExamen(null); setShowExamenForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{ backgroundColor: '#0891B2', color: '#fff' }}
            >
              <Plus size={13} /> Nuevo examen
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2" style={{ borderColor: '#0891B2' }} />
          </div>
        ) : filteredExamenes.length === 0 ? (
          <div className="px-6 py-20 text-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F0F9FF' }}>
              <ClipboardCheck size={28} style={{ color: '#0891B2' }} />
            </div>
            <p className="text-sm font-semibold mb-1" style={{ color: '#1E293B' }}>Sin examenes</p>
            <p className="text-xs" style={{ color: '#94A3B8' }}>Crea el primer examen con el boton "Nuevo examen".</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
            {filteredExamenes.map(ex => {
              const est = ESTADO_COLORS[ex.estado] ?? ESTADO_COLORS.activo;
              const soc = societies.find(s => s.id === ex.sociedad_id);
              return (
                <div
                  key={ex.id}
                  className="px-6 py-4 flex items-center gap-4 cursor-pointer transition-colors hover:bg-slate-50"
                  onClick={() => setSelectedExamen(ex)}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: est.bg }}>
                    <ClipboardCheck size={18} style={{ color: est.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{ex.titulo}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {ex.fecha_inicio && <span className="text-xs" style={{ color: '#94A3B8' }}>{ex.fecha_inicio}</span>}
                      {ex.duracion_minutos && <span className="text-xs" style={{ color: '#94A3B8' }}>{ex.duracion_minutos} min</span>}
                      <span className="text-xs" style={{ color: '#94A3B8' }}>Min: {ex.puntuacion_minima}%</span>
                      {soc && <span className="text-xs px-1.5 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#F0F9FF', color: '#0891B2', border: '1px solid #BAE6FD' }}>{soc.name}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: est.bg, color: est.text, border: `1px solid ${est.border}` }}>
                      {est.label}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); setEditingExamen(ex); setShowExamenForm(true); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100"
                      style={{ color: '#64748B' }}
                      title="Editar"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteExamen(ex.id); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-red-50"
                      style={{ color: '#DC2626' }}
                      title="Eliminar"
                    >
                      <Trash2 size={12} />
                    </button>
                    <ChevronRight size={14} style={{ color: '#CBD5E1' }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modals */}
      {showExamenForm && (
        <ExamenFormModal
          initial={editingExamen}
          onSave={handleSaveExamen}
          onClose={() => { setShowExamenForm(false); setEditingExamen(null); }}
          societies={societies.map(s => ({ id: s.id, name: s.name }))}
        />
      )}
      {confirmDeleteExamen && (
        <ConfirmModal
          message="Se eliminara el examen y todas sus asignaciones. Esta accion no se puede deshacer."
          onConfirm={() => handleDeleteExamen(confirmDeleteExamen)}
          onCancel={() => setConfirmDeleteExamen(null)}
          loading={deleting}
        />
      )}
    </div>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function ConfirmModal({ message, onConfirm, onCancel, loading }: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
      <div className="w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="p-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FEF2F2' }}>
            <AlertCircle size={22} style={{ color: '#DC2626' }} />
          </div>
          <p className="text-sm text-center font-medium mb-1" style={{ color: '#1E293B' }}>Confirmar eliminacion</p>
          <p className="text-xs text-center" style={{ color: '#64748B' }}>{message}</p>
        </div>
        <div className="px-6 pb-5 flex gap-2 justify-center">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B', border: '1px solid #E2E8F0' }}>
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-60"
            style={{ backgroundColor: '#DC2626' }}
          >
            {loading ? 'Eliminando...' : 'Eliminar'}
          </button>
        </div>
      </div>
    </div>
  );
}
