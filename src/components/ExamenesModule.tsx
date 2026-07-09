import { useState, useEffect } from 'react';
import {
  ClipboardCheck, Plus, Trash2, Edit2, ChevronDown, ChevronUp,
  Users, HelpCircle, CheckCircle2, RefreshCw, X, AlertCircle,
  Clock, Calendar, Award, BookOpen, Search, BarChart2,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Examen {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  validez_meses: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  ratio_penalizacion: number;
  created_at: string;
  _preguntasCount?: number;
  _asignacionesCount?: number;
}

interface Pregunta {
  id: string;
  examen_id: string;
  texto: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: 'a' | 'b' | 'c' | 'd';
  orden: number;
}

interface UserProfile {
  id: string;
  nombre: string;
  email: string;
  role: string;
}

interface Asignacion {
  id: string;
  usuario_id: string;
  examen_id: string;
  estado: string;
  nota: number | null;
  intentos_realizados: number;
  intentos_permitidos: number | null;
  fecha_realizacion: string | null;
  fecha_caducidad_certificado: string | null;
  user_profiles?: { nombre: string; email: string };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 rounded-xl text-sm outline-none border border-[#E2E8F0] bg-white focus:border-[#1D4ED8] transition-colors';
const labelCls = 'block text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-1.5';

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExamenesModule() {
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'new_exam' | 'edit_exam' | 'questions' | 'assign' | 'assignments'>('list');
  const [selectedExamen, setSelectedExamen] = useState<Examen | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [search, setSearch] = useState('');

  // New/edit exam form
  const [form, setForm] = useState<Omit<Examen, 'id' | 'created_at' | '_preguntasCount' | '_asignacionesCount'>>({
    nombre: '', descripcion: '', duracion_minutos: 30, validez_meses: 12,
    fecha_inicio: null, fecha_fin: null, ratio_penalizacion: 3,
  });

  // Questions view
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [preguntaForm, setPreguntaForm] = useState<Omit<Pregunta, 'id' | 'examen_id' | 'orden'>>({
    texto: '', opcion_a: '', opcion_b: '', opcion_c: '', opcion_d: '', respuesta_correcta: 'a',
  });
  const [editingPregunta, setEditingPregunta] = useState<Pregunta | null>(null);
  const [showPreguntaForm, setShowPreguntaForm] = useState(false);

  // Assign view
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [newAssign, setNewAssign] = useState({ usuario_id: '', intentos_permitidos: '' });
  const [userSearch, setUserSearch] = useState('');

  // ── Load exams ──────────────────────────────────────────────────────────────
  const loadExamenes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('examenes')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { setErrorMsg(error.message); setLoading(false); return; }

    const exs = data as Examen[];

    // Count questions & assignments per exam
    const ids = exs.map((e) => e.id);
    const [pCounts, aCounts] = await Promise.all([
      ids.length ? supabase.from('preguntas').select('examen_id').in('examen_id', ids) : Promise.resolve({ data: [] }),
      ids.length ? supabase.from('asignaciones_examenes').select('examen_id').in('examen_id', ids) : Promise.resolve({ data: [] }),
    ]);

    const pMap: Record<string, number> = {};
    const aMap: Record<string, number> = {};
    (pCounts.data ?? []).forEach((r: any) => { pMap[r.examen_id] = (pMap[r.examen_id] ?? 0) + 1; });
    (aCounts.data ?? []).forEach((r: any) => { aMap[r.examen_id] = (aMap[r.examen_id] ?? 0) + 1; });

    setExamenes(exs.map((e) => ({ ...e, _preguntasCount: pMap[e.id] ?? 0, _asignacionesCount: aMap[e.id] ?? 0 })));
    setLoading(false);
  };

  useEffect(() => { loadExamenes(); }, []);

  // ── Save exam ───────────────────────────────────────────────────────────────
  const handleSaveExam = async () => {
    if (!form.nombre.trim()) { setErrorMsg('El nombre del examen es obligatorio.'); return; }
    setSaving(true); setErrorMsg('');
    const payload = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion?.trim() || null,
      duracion_minutos: Number(form.duracion_minutos),
      validez_meses: Number(form.validez_meses),
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      ratio_penalizacion: Number(form.ratio_penalizacion),
    };
    if (view === 'edit_exam' && selectedExamen) {
      const { error } = await supabase.from('examenes').update(payload).eq('id', selectedExamen.id);
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('examenes').insert(payload);
      if (error) { setErrorMsg(error.message); setSaving(false); return; }
    }
    setSaving(false);
    await loadExamenes();
    setView('list');
  };

  // ── Delete exam ─────────────────────────────────────────────────────────────
  const handleDeleteExam = async (id: string) => {
    if (!confirm('¿Eliminar este examen y todas sus preguntas y asignaciones?')) return;
    await supabase.from('examenes').delete().eq('id', id);
    await loadExamenes();
  };

  // ── Load questions ──────────────────────────────────────────────────────────
  const loadPreguntas = async (examenId: string) => {
    const { data } = await supabase.from('preguntas').select('*').eq('examen_id', examenId).order('orden');
    setPreguntas((data as Pregunta[]) ?? []);
  };

  const openQuestions = (exam: Examen) => {
    setSelectedExamen(exam);
    loadPreguntas(exam.id);
    setShowPreguntaForm(false);
    setEditingPregunta(null);
    setPreguntaForm({ texto: '', opcion_a: '', opcion_b: '', opcion_c: '', opcion_d: '', respuesta_correcta: 'a' });
    setView('questions');
  };

  // ── Save question ───────────────────────────────────────────────────────────
  const handleSavePregunta = async () => {
    if (!preguntaForm.texto.trim() || !preguntaForm.opcion_a.trim() || !preguntaForm.opcion_b.trim() || !preguntaForm.opcion_c.trim() || !preguntaForm.opcion_d.trim()) {
      setErrorMsg('Completa todos los campos de la pregunta.'); return;
    }
    setSaving(true); setErrorMsg('');
    const payload = { ...preguntaForm, examen_id: selectedExamen!.id, orden: editingPregunta?.orden ?? preguntas.length };
    if (editingPregunta) {
      await supabase.from('preguntas').update(payload).eq('id', editingPregunta.id);
    } else {
      await supabase.from('preguntas').insert(payload);
    }
    setSaving(false);
    await loadPreguntas(selectedExamen!.id);
    setPreguntaForm({ texto: '', opcion_a: '', opcion_b: '', opcion_c: '', opcion_d: '', respuesta_correcta: 'a' });
    setEditingPregunta(null);
    setShowPreguntaForm(false);
  };

  const handleDeletePregunta = async (id: string) => {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    await supabase.from('preguntas').delete().eq('id', id);
    await loadPreguntas(selectedExamen!.id);
  };

  const startEditPregunta = (p: Pregunta) => {
    setEditingPregunta(p);
    setPreguntaForm({ texto: p.texto, opcion_a: p.opcion_a, opcion_b: p.opcion_b, opcion_c: p.opcion_c, opcion_d: p.opcion_d, respuesta_correcta: p.respuesta_correcta });
    setShowPreguntaForm(true);
    setErrorMsg('');
  };

  // ── Assignments view ────────────────────────────────────────────────────────
  const openAssign = async (exam: Examen) => {
    setSelectedExamen(exam);
    const [{ data: ud }, { data: ad }] = await Promise.all([
      supabase.from('user_profiles').select('id, nombre, email, role').eq('activo', true).order('nombre'),
      supabase.from('asignaciones_examenes').select('*, user_profiles(nombre, email)').eq('examen_id', exam.id),
    ]);
    setUsers((ud as UserProfile[]) ?? []);
    setAsignaciones((ad as Asignacion[]) ?? []);
    setNewAssign({ usuario_id: '', intentos_permitidos: '' });
    setUserSearch('');
    setView('assign');
  };

  const openAssignments = async (exam: Examen) => {
    setSelectedExamen(exam);
    const { data } = await supabase
      .from('asignaciones_examenes')
      .select('*, user_profiles(nombre, email)')
      .eq('examen_id', exam.id)
      .order('created_at', { ascending: false });
    setAsignaciones((data as Asignacion[]) ?? []);
    setView('assignments');
  };

  const handleAddAsignacion = async () => {
    if (!newAssign.usuario_id) { setErrorMsg('Selecciona un empleado.'); return; }
    setSaving(true); setErrorMsg('');
    const intentos = newAssign.intentos_permitidos === '' || newAssign.intentos_permitidos === '0'
      ? null
      : Number(newAssign.intentos_permitidos);
    const { error } = await supabase.from('asignaciones_examenes').insert({
      usuario_id: newAssign.usuario_id,
      examen_id: selectedExamen!.id,
      estado: 'pendiente',
      intentos_permitidos: intentos,
    });
    if (error) { setErrorMsg(error.message); setSaving(false); return; }
    setSaving(false);
    await openAssign(selectedExamen!);
  };

  const handleDeleteAsignacion = async (id: string) => {
    if (!confirm('¿Eliminar esta asignación?')) return;
    await supabase.from('asignaciones_examenes').delete().eq('id', id);
    await openAssign(selectedExamen!);
  };

  const filteredExamenes = examenes.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = users.filter((u) =>
    u.nombre.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(userSearch.toLowerCase())
  ).filter((u) => !asignaciones.some((a) => a.usuario_id === u.id));

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Error banner ────────────────────────────────────────────────────────────
  const ErrorBanner = errorMsg ? (
    <div className="flex items-start gap-2 px-4 py-3 rounded-xl mb-4 text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
      <AlertCircle size={15} className="flex-shrink-0 mt-0.5" />
      <span>{errorMsg}</span>
      <button className="ml-auto cursor-pointer" onClick={() => setErrorMsg('')}><X size={14} /></button>
    </div>
  ) : null;

  // ── List view ───────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#1E293B]">Gestión de Exámenes</h2>
            <p className="text-sm text-[#64748B]">{examenes.length} exámenes en total</p>
          </div>
          <button
            onClick={() => {
              setForm({ nombre: '', descripcion: '', duracion_minutos: 30, validez_meses: 12, fecha_inicio: null, fecha_fin: null, ratio_penalizacion: 3 });
              setErrorMsg('');
              setView('new_exam');
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-200"
            style={{ backgroundColor: '#1D4ED8', boxShadow: '0 2px 8px #1D4ED820' }}
          >
            <Plus size={16} />
            Nuevo examen
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar examen..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none border border-[#E2E8F0] bg-white focus:border-[#1D4ED8] transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={22} className="animate-spin text-[#1D4ED8]" />
          </div>
        ) : filteredExamenes.length === 0 ? (
          <div className="text-center py-16 rounded-2xl border border-dashed border-[#E2E8F0]">
            <ClipboardCheck size={40} className="mx-auto mb-3 text-[#CBD5E1]" />
            <p className="text-sm font-medium text-[#64748B]">No hay exámenes creados</p>
            <p className="text-xs text-[#94A3B8] mt-1">Crea el primer examen con el botón superior</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredExamenes.map((exam) => (
              <div key={exam.id} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 hover:shadow-md transition-shadow duration-200">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                    <ClipboardCheck size={18} style={{ color: '#1D4ED8' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#1E293B] text-sm leading-tight">{exam.nombre}</h3>
                    {exam.descripcion && <p className="text-xs text-[#64748B] mt-0.5 line-clamp-1">{exam.descripcion}</p>}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5">
                      <span className="flex items-center gap-1 text-xs text-[#64748B]">
                        <Clock size={11} /> {exam.duracion_minutos} min
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#64748B]">
                        <Award size={11} /> Válido {exam.validez_meses} meses
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#64748B]">
                        <HelpCircle size={11} /> {exam._preguntasCount} preguntas
                      </span>
                      <span className="flex items-center gap-1 text-xs text-[#64748B]">
                        <Users size={11} /> {exam._asignacionesCount} asignados
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openAssignments(exam)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                    >
                      <BarChart2 size={12} /> Resultados
                    </button>
                    <button
                      onClick={() => openAssign(exam)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                    >
                      <Users size={12} /> Asignar
                    </button>
                    <button
                      onClick={() => openQuestions(exam)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}
                    >
                      <HelpCircle size={12} /> Preguntas
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExamen(exam);
                        setForm({
                          nombre: exam.nombre, descripcion: exam.descripcion ?? '',
                          duracion_minutos: exam.duracion_minutos, validez_meses: exam.validez_meses,
                          fecha_inicio: exam.fecha_inicio, fecha_fin: exam.fecha_fin,
                          ratio_penalizacion: exam.ratio_penalizacion,
                        });
                        setErrorMsg('');
                        setView('edit_exam');
                      }}
                      className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[#F8FAFC]"
                      style={{ color: '#64748B', border: '1px solid #E2E8F0' }}
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => handleDeleteExam(exam.id)}
                      className="p-2 rounded-lg cursor-pointer transition-colors hover:bg-[#FEF2F2]"
                      style={{ color: '#DC2626', border: '1px solid #FECACA' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── New / Edit exam form ────────────────────────────────────────────────────
  if (view === 'new_exam' || view === 'edit_exam') {
    return (
      <div className="p-6 max-w-2xl">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-[#64748B] mb-5 cursor-pointer hover:text-[#1E293B] transition-colors">
          <ChevronUp size={14} className="rotate-[-90deg]" /> Volver a la lista
        </button>
        <h2 className="text-xl font-bold text-[#1E293B] mb-6">{view === 'new_exam' ? 'Nuevo examen' : 'Editar examen'}</h2>
        {ErrorBanner}
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Nombre *</label>
            <input className={inputCls} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Seguridad en el trabajo" />
          </div>
          <div>
            <label className={labelCls}>Descripción</label>
            <textarea className={inputCls} rows={3} value={form.descripcion ?? ''} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción opcional del examen" style={{ resize: 'none' }} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Duración (minutos)</label>
              <input type="number" min={1} className={inputCls} value={form.duracion_minutos} onChange={(e) => setForm({ ...form, duracion_minutos: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Validez del certificado (meses)</label>
              <input type="number" min={1} className={inputCls} value={form.validez_meses} onChange={(e) => setForm({ ...form, validez_meses: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Fecha inicio</label>
              <input type="date" className={inputCls} value={form.fecha_inicio ?? ''} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value || null })} />
            </div>
            <div>
              <label className={labelCls}>Fecha fin</label>
              <input type="date" className={inputCls} value={form.fecha_fin ?? ''} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value || null })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ratio de penalización por respuesta incorrecta</label>
            <input type="number" min={1} step={0.5} className={inputCls} value={form.ratio_penalizacion} onChange={(e) => setForm({ ...form, ratio_penalizacion: Number(e.target.value) })} />
            <p className="text-xs text-[#94A3B8] mt-1">Nota = aciertos − (errores ÷ ratio). Valor 3 = penalización estándar.</p>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => setView('list')} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
            <button onClick={handleSaveExam} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#1D4ED8' }}>
              {saving && <RefreshCw size={13} className="animate-spin" />}
              {view === 'new_exam' ? 'Crear examen' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Questions view ──────────────────────────────────────────────────────────
  if (view === 'questions' && selectedExamen) {
    const letterMap: Record<string, string> = { a: 'A', b: 'B', c: 'C', d: 'D' };

    return (
      <div className="p-6">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-[#64748B] mb-2 cursor-pointer hover:text-[#1E293B] transition-colors">
          <ChevronUp size={14} className="rotate-[-90deg]" /> Volver
        </button>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-[#1E293B]">Preguntas</h2>
            <p className="text-sm text-[#64748B]">{selectedExamen.nombre} · {preguntas.length} pregunta{preguntas.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => { setShowPreguntaForm(true); setEditingPregunta(null); setPreguntaForm({ texto: '', opcion_a: '', opcion_b: '', opcion_c: '', opcion_d: '', respuesta_correcta: 'a' }); setErrorMsg(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: '#7C3AED' }}
          >
            <Plus size={16} /> Añadir pregunta
          </button>
        </div>

        {ErrorBanner}

        {/* Pregunta form */}
        {showPreguntaForm && (
          <div className="rounded-2xl border border-[#DDD6FE] bg-[#F5F3FF] p-5 mb-6">
            <h3 className="text-sm font-semibold text-[#7C3AED] mb-4">{editingPregunta ? 'Editar pregunta' : 'Nueva pregunta'}</h3>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Enunciado *</label>
                <textarea className={inputCls} rows={3} value={preguntaForm.texto} onChange={(e) => setPreguntaForm({ ...preguntaForm, texto: e.target.value })} placeholder="Escribe el enunciado de la pregunta..." style={{ resize: 'none' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                  <div key={opt}>
                    <label className={labelCls}>Opción {opt.toUpperCase()} *</label>
                    <input className={inputCls} value={preguntaForm[`opcion_${opt}` as keyof typeof preguntaForm] as string} onChange={(e) => setPreguntaForm({ ...preguntaForm, [`opcion_${opt}`]: e.target.value })} placeholder={`Opción ${opt.toUpperCase()}`} />
                  </div>
                ))}
              </div>
              <div>
                <label className={labelCls}>Respuesta correcta *</label>
                <div className="flex gap-2">
                  {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPreguntaForm({ ...preguntaForm, respuesta_correcta: opt })}
                      className="flex-1 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all duration-200"
                      style={{
                        backgroundColor: preguntaForm.respuesta_correcta === opt ? '#7C3AED' : '#FFFFFF',
                        color: preguntaForm.respuesta_correcta === opt ? '#FFFFFF' : '#64748B',
                        border: `2px solid ${preguntaForm.respuesta_correcta === opt ? '#7C3AED' : '#E2E8F0'}`,
                      }}
                    >
                      {opt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setShowPreguntaForm(false); setEditingPregunta(null); setErrorMsg(''); }} className="flex-1 py-2 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: '#FFFFFF', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleSavePregunta} disabled={saving} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#7C3AED' }}>
                  {saving && <RefreshCw size={13} className="animate-spin" />}
                  {editingPregunta ? 'Guardar' : 'Añadir pregunta'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Questions list */}
        {preguntas.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-[#E2E8F0]">
            <HelpCircle size={36} className="mx-auto mb-2 text-[#CBD5E1]" />
            <p className="text-sm font-medium text-[#64748B]">Sin preguntas todavía</p>
          </div>
        ) : (
          <div className="space-y-3">
            {preguntas.map((p, idx) => (
              <div key={p.id} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1E293B] mb-2">{p.texto}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(['a', 'b', 'c', 'd'] as const).map((opt) => (
                        <div
                          key={opt}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs"
                          style={{
                            backgroundColor: p.respuesta_correcta === opt ? '#F0FDF4' : '#F8FAFC',
                            border: `1px solid ${p.respuesta_correcta === opt ? '#BBF7D0' : '#E2E8F0'}`,
                            color: p.respuesta_correcta === opt ? '#16A34A' : '#64748B',
                          }}
                        >
                          <span className="font-bold">{letterMap[opt]}</span>
                          {p[`opcion_${opt}` as keyof Pregunta] as string}
                          {p.respuesta_correcta === opt && <CheckCircle2 size={11} className="ml-auto flex-shrink-0" />}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button onClick={() => startEditPregunta(p)} className="p-1.5 rounded-lg cursor-pointer hover:bg-[#F8FAFC] transition-colors" style={{ color: '#64748B', border: '1px solid #E2E8F0' }}><Edit2 size={13} /></button>
                    <button onClick={() => handleDeletePregunta(p.id)} className="p-1.5 rounded-lg cursor-pointer hover:bg-[#FEF2F2] transition-colors" style={{ color: '#DC2626', border: '1px solid #FECACA' }}><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Assign view ─────────────────────────────────────────────────────────────
  if (view === 'assign' && selectedExamen) {
    return (
      <div className="p-6">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-[#64748B] mb-2 cursor-pointer hover:text-[#1E293B] transition-colors">
          <ChevronUp size={14} className="rotate-[-90deg]" /> Volver
        </button>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#1E293B]">Asignar examen</h2>
          <p className="text-sm text-[#64748B]">{selectedExamen.nombre}</p>
        </div>
        {ErrorBanner}

        {/* Existing assignments */}
        {asignaciones.length > 0 && (
          <div className="mb-6">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B] mb-3">Asignados ({asignaciones.length})</h3>
            <div className="space-y-2">
              {asignaciones.map((a) => {
                const sinIntentos = a.intentos_permitidos !== null && a.intentos_realizados >= a.intentos_permitidos && a.estado !== 'aprobado';
                return (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-[#E2E8F0] bg-white">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#1E293B] truncate">{a.user_profiles?.nombre ?? a.usuario_id}</p>
                      <p className="text-xs text-[#94A3B8] truncate">{a.user_profiles?.email}</p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                      backgroundColor: a.estado === 'aprobado' ? '#F0FDF4' : a.estado === 'suspendido' ? '#FEF2F2' : '#F8FAFC',
                      color: a.estado === 'aprobado' ? '#16A34A' : a.estado === 'suspendido' ? '#DC2626' : '#64748B',
                    }}>{a.estado}</span>
                    {sinIntentos && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#FFF7ED', color: '#EA580C' }}>Sin intentos</span>}
                    <span className="text-xs text-[#94A3B8]">{a.intentos_realizados}/{a.intentos_permitidos ?? '∞'}</span>
                    <button onClick={() => handleDeleteAsignacion(a.id)} className="p-1.5 rounded-lg cursor-pointer hover:bg-[#FEF2F2] transition-colors flex-shrink-0" style={{ color: '#DC2626', border: '1px solid #FECACA' }}><Trash2 size={13} /></button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* New assignment */}
        <div className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-5">
          <h3 className="text-sm font-semibold text-[#1D4ED8] mb-4">Nueva asignación</h3>
          <div className="mb-3">
            <label className={labelCls}>Buscar empleado</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
              <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Buscar por nombre o email..." className={`${inputCls} pl-9`} />
            </div>
            <select
              value={newAssign.usuario_id}
              onChange={(e) => setNewAssign({ ...newAssign, usuario_id: e.target.value })}
              className={inputCls}
              size={Math.min(5, filteredUsers.length + 1)}
            >
              <option value="">— Seleccionar empleado —</option>
              {filteredUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.email})</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className={labelCls}>Intentos permitidos (0 o vacío = ilimitados)</label>
            <input type="number" min={0} className={inputCls} value={newAssign.intentos_permitidos} onChange={(e) => setNewAssign({ ...newAssign, intentos_permitidos: e.target.value })} placeholder="Dejar vacío para intentos ilimitados" />
          </div>
          <button onClick={handleAddAsignacion} disabled={saving} className="w-full py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#1D4ED8' }}>
            {saving && <RefreshCw size={13} className="animate-spin" />}
            Asignar examen
          </button>
        </div>
      </div>
    );
  }

  // ── Assignments results view ─────────────────────────────────────────────────
  if (view === 'assignments' && selectedExamen) {
    const aprobados = asignaciones.filter((a) => a.estado === 'aprobado').length;
    const suspendidos = asignaciones.filter((a) => a.estado === 'suspendido').length;
    const pendientes = asignaciones.filter((a) => a.estado === 'pendiente').length;

    return (
      <div className="p-6">
        <button onClick={() => setView('list')} className="flex items-center gap-1.5 text-sm text-[#64748B] mb-2 cursor-pointer hover:text-[#1E293B] transition-colors">
          <ChevronUp size={14} className="rotate-[-90deg]" /> Volver
        </button>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-[#1E293B]">Resultados</h2>
          <p className="text-sm text-[#64748B]">{selectedExamen.nombre}</p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <p className="text-2xl font-bold text-[#16A34A]">{aprobados}</p>
            <p className="text-xs text-[#15803D]">Aprobados</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <p className="text-2xl font-bold text-[#DC2626]">{suspendidos}</p>
            <p className="text-xs text-[#B91C1C]">Suspendidos</p>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p className="text-2xl font-bold text-[#64748B]">{pendientes}</p>
            <p className="text-xs text-[#94A3B8]">Pendientes</p>
          </div>
        </div>

        {asignaciones.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-[#E2E8F0]">
            <Users size={36} className="mx-auto mb-2 text-[#CBD5E1]" />
            <p className="text-sm text-[#64748B]">Sin asignaciones todavía</p>
          </div>
        ) : (
          <div className="space-y-2">
            {asignaciones.map((a) => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3 rounded-xl border border-[#E2E8F0] bg-white">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1E293B] truncate">{a.user_profiles?.nombre ?? a.usuario_id}</p>
                  <p className="text-xs text-[#94A3B8]">
                    {a.fecha_realizacion ? new Date(a.fecha_realizacion).toLocaleDateString('es-ES') : 'No realizado'}
                    {' · '}{a.intentos_realizados}/{a.intentos_permitidos ?? '∞'} intentos
                  </p>
                </div>
                {a.nota !== null && (
                  <span className="text-sm font-bold" style={{ color: Number(a.nota) >= 5 ? '#16A34A' : '#DC2626' }}>
                    {Number(a.nota).toFixed(2)}
                  </span>
                )}
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{
                  backgroundColor: a.estado === 'aprobado' ? '#F0FDF4' : a.estado === 'suspendido' ? '#FEF2F2' : '#F8FAFC',
                  color: a.estado === 'aprobado' ? '#16A34A' : a.estado === 'suspendido' ? '#DC2626' : '#64748B',
                }}>{a.estado}</span>
                {a.fecha_caducidad_certificado && (
                  <span className="flex items-center gap-1 text-xs text-[#64748B]">
                    <Calendar size={10} />
                    Caduca {new Date(a.fecha_caducidad_certificado).toLocaleDateString('es-ES')}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return null;
}
