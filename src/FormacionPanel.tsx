import { useState, useEffect, useCallback } from 'react';
import { ClipboardCheck, Plus, X, Trash2, CreditCard as Edit2, Users, Clock, CheckCircle2, XCircle, Search, ChevronLeft, KeyRound, AlertCircle, Save, RefreshCw, ListChecks, UserCheck, HelpCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from './supabaseClient';
import ChangePasswordModal from './components/ChangePasswordModal';
import HelpPanel from './components/HelpPanel';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
}

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
}

interface Pregunta {
  id: string;
  examen_id: string;
  texto: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: 'A' | 'B' | 'C' | 'D';
  orden: number;
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  email: string | null;
  id_sociedad: string | null;
  activo: boolean;
}

interface Asignacion {
  id: string;
  examen_id: string;
  empleado_id: string | null;
  nombre_empleado: string;
  dni: string | null;
  estado: string;
  puntuacion: number | null;
  fecha_realizacion: string | null;
}

type Tab = 'examenes' | 'asignaciones' | 'ayuda';

const estadoConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pendiente: { label: 'Pendiente', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
  completado: { label: 'Completado', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  suspendido: { label: 'Suspendido', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
};

export default function FormacionPanel({ email, onLogout, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('examenes');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentUserNombre, setCurrentUserNombre] = useState('');

  // Exam list
  const [examenes, setExamenes] = useState<Examen[]>([]);
  const [loadingExamenes, setLoadingExamenes] = useState(true);

  // Selected exam
  const [selectedExamen, setSelectedExamen] = useState<Examen | null>(null);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [loadingPreguntas, setLoadingPreguntas] = useState(false);

  // Exam editor modal
  const [showExamModal, setShowExamModal] = useState(false);
  const [editingExamen, setEditingExamen] = useState<Examen | null>(null);
  const [examForm, setExamForm] = useState({ nombre: '', descripcion: '', duracion_minutos: 30, validez_meses: 12, ratio_penalizacion: 3 });
  const [savingExam, setSavingExam] = useState(false);

  // Question editor modal
  const [showPreguntaModal, setShowPreguntaModal] = useState(false);
  const [editingPregunta, setEditingPregunta] = useState<Pregunta | null>(null);
  const [preguntaForm, setPreguntaForm] = useState({ texto: '', opcion_a: '', opcion_b: '', opcion_c: '', opcion_d: '', respuesta_correcta: 'A' as 'A' | 'B' | 'C' | 'D' });
  const [savingPregunta, setSavingPregunta] = useState(false);

  // Asignaciones
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [selectedEmpleados, setSelectedEmpleados] = useState<Set<string>>(new Set());
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignExamen, setAssignExamen] = useState<Examen | null>(null);
  const [assigning, setAssigning] = useState(false);

  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id;
      if (uid) {
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      }
    });
  }, [email]);

  const loadExamenes = useCallback(async () => {
    setLoadingExamenes(true);
    const { data, error } = await supabase.from('examenes').select('*').order('created_at', { ascending: false });
    if (error) { setError(error.message); }
    else { setExamenes(data ?? []); }
    setLoadingExamenes(false);
  }, []);

  useEffect(() => { loadExamenes(); }, [loadExamenes]);

  const loadPreguntas = useCallback(async (examenId: string) => {
    setLoadingPreguntas(true);
    const { data, error } = await supabase.from('preguntas').select('*').eq('examen_id', examenId).order('orden', { ascending: true });
    if (error) { setError(error.message); }
    else { setPreguntas(data ?? []); }
    setLoadingPreguntas(false);
  }, []);

  const loadAsignaciones = useCallback(async (examenId: string) => {
    setLoadingAsignaciones(true);
    const { data, error } = await supabase.from('examen_asignaciones').select('*').eq('examen_id', examenId).order('created_at', { ascending: false });
    if (error) { setError(error.message); }
    else { setAsignaciones(data ?? []); }
    setLoadingAsignaciones(false);
  }, []);

  const loadEmpleados = useCallback(async () => {
    const { data, error } = await supabase.from('empleados').select('id, nombre, dni, email, id_sociedad, activo').eq('activo', true).order('nombre', { ascending: true });
    if (error) { setError(error.message); }
    else { setEmpleados(data ?? []); }
  }, []);

  const handleSelectExamen = (exam: Examen) => {
    if (selectedExamen?.id === exam.id) {
      setSelectedExamen(null);
      setPreguntas([]);
      setAsignaciones([]);
      return;
    }
    setSelectedExamen(exam);
    loadPreguntas(exam.id);
    loadAsignaciones(exam.id);
  };

  const openNewExam = () => {
    setEditingExamen(null);
    setExamForm({ nombre: '', descripcion: '', duracion_minutos: 30, validez_meses: 12, ratio_penalizacion: 3 });
    setShowExamModal(true);
    setError('');
  };

  const openEditExam = (exam: Examen) => {
    setEditingExamen(exam);
    setExamForm({
      nombre: exam.nombre,
      descripcion: exam.descripcion ?? '',
      duracion_minutos: exam.duracion_minutos,
      validez_meses: exam.validez_meses,
      ratio_penalizacion: exam.ratio_penalizacion,
    });
    setShowExamModal(true);
    setError('');
  };

  const handleSaveExam = async () => {
    if (!examForm.nombre.trim()) { setError('El nombre del examen es obligatorio.'); return; }
    setSavingExam(true); setError('');
    try {
      const payload = {
        nombre: examForm.nombre.trim(),
        descripcion: examForm.descripcion.trim() || null,
        duracion_minutos: examForm.duracion_minutos,
        validez_meses: examForm.validez_meses,
        ratio_penalizacion: examForm.ratio_penalizacion,
      };
      if (editingExamen) {
        const { error: err } = await supabase.from('examenes').update(payload).eq('id', editingExamen.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('examenes').insert(payload);
        if (err) throw err;
      }
      setShowExamModal(false);
      await loadExamenes();
      setSuccessMsg('Examen guardado correctamente.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingExam(false); }
  };

  const handleDeleteExam = async (exam: Examen) => {
    if (!confirm(`Eliminar el examen "${exam.nombre}" y todas sus preguntas y asignaciones?`)) return;
    try {
      const { error: err } = await supabase.from('examenes').delete().eq('id', exam.id);
      if (err) throw err;
      if (selectedExamen?.id === exam.id) { setSelectedExamen(null); setPreguntas([]); setAsignaciones([]); }
      await loadExamenes();
      setSuccessMsg('Examen eliminado.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const openNewPregunta = () => {
    if (!selectedExamen) return;
    setEditingPregunta(null);
    setPreguntaForm({ texto: '', opcion_a: '', opcion_b: '', opcion_c: '', opcion_d: '', respuesta_correcta: 'A' });
    setShowPreguntaModal(true);
    setError('');
  };

  const openEditPregunta = (p: Pregunta) => {
    setEditingPregunta(p);
    setPreguntaForm({ texto: p.texto, opcion_a: p.opcion_a, opcion_b: p.opcion_b, opcion_c: p.opcion_c, opcion_d: p.opcion_d, respuesta_correcta: p.respuesta_correcta });
    setShowPreguntaModal(true);
    setError('');
  };

  const handleSavePregunta = async () => {
    if (!selectedExamen) return;
    if (!preguntaForm.texto.trim()) { setError('El texto de la pregunta es obligatorio.'); return; }
    if (!preguntaForm.opcion_a.trim() || !preguntaForm.opcion_b.trim() || !preguntaForm.opcion_c.trim() || !preguntaForm.opcion_d.trim()) {
      setError('Las 4 opciones son obligatorias.'); return;
    }
    setSavingPregunta(true); setError('');
    try {
      const payload = {
        examen_id: selectedExamen.id,
        texto: preguntaForm.texto.trim(),
        opcion_a: preguntaForm.opcion_a.trim(),
        opcion_b: preguntaForm.opcion_b.trim(),
        opcion_c: preguntaForm.opcion_c.trim(),
        opcion_d: preguntaForm.opcion_d.trim(),
        respuesta_correcta: preguntaForm.respuesta_correcta,
        orden: editingPregunta ? editingPregunta.orden : preguntas.length,
      };
      if (editingPregunta) {
        const { error: err } = await supabase.from('preguntas').update(payload).eq('id', editingPregunta.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('preguntas').insert(payload);
        if (err) throw err;
      }
      setShowPreguntaModal(false);
      await loadPreguntas(selectedExamen.id);
      setSuccessMsg('Pregunta guardada.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingPregunta(false); }
  };

  const handleDeletePregunta = async (p: Pregunta) => {
    if (!confirm('Eliminar esta pregunta?')) return;
    try {
      const { error: err } = await supabase.from('preguntas').delete().eq('id', p.id);
      if (err) throw err;
      if (selectedExamen) await loadPreguntas(selectedExamen.id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const openAssignModal = (exam: Examen) => {
    setAssignExamen(exam);
    setSelectedEmpleados(new Set());
    setSearchEmpleado('');
    setShowAssignModal(true);
    setError('');
    if (empleados.length === 0) loadEmpleados();
  };

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!assignExamen || selectedEmpleados.size === 0) { setError('Selecciona al menos un empleado.'); return; }
    setAssigning(true); setError('');
    try {
      const rows = Array.from(selectedEmpleados).map((empId) => {
        const emp = empleados.find((e) => e.id === empId);
        return {
          examen_id: assignExamen.id,
          empleado_id: empId,
          nombre_empleado: emp?.nombre ?? 'Desconocido',
          dni: emp?.dni ?? null,
          estado: 'pendiente',
        };
      });
      const { error: err } = await supabase.from('examen_asignaciones').insert(rows);
      if (err) throw err;
      setShowAssignModal(false);
      await loadAsignaciones(assignExamen.id);
      setSuccessMsg(`Examen asignado a ${rows.length} empleado(s).`);
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al asignar'); }
    finally { setAssigning(false); }
  };

  const handleDeleteAsignacion = async (a: Asignacion) => {
    if (!confirm('Eliminar esta asignacion?')) return;
    try {
      const { error: err } = await supabase.from('examen_asignaciones').delete().eq('id', a.id);
      if (err) throw err;
      if (selectedExamen) await loadAsignaciones(selectedExamen.id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const filteredExamenes = examenes.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (e.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredEmpleados = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
    (e.dni ?? '').toLowerCase().includes(searchEmpleado.toLowerCase())
  );

  const tabs: { id: Tab; label: string; icon: LucideIcon }[] = [
    { id: 'examenes', label: 'Examenes', icon: ClipboardCheck },
    { id: 'asignaciones', label: 'Asignaciones', icon: UserCheck },
    { id: 'ayuda', label: 'Ayuda', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #134E4A, #0D9488)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={onNavigateEmployee ?? onLogout}
              title="Volver al panel de empleado"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#A7F3D0' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <ClipboardCheck size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight">Panel de Formacion</h1>
              <p className="text-white/50 text-xs hidden sm:block">Gestion de examenes y asignaciones</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {onNavigateEmployee && (
              <button
                onClick={onNavigateEmployee}
                className="hidden md:flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#A7F3D0', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <Users size={12} />
                <span>Mi perfil empleado</span>
              </button>
            )}
            <button
              onClick={() => setShowChangePassword(true)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#A7F3D0' }}
              title="Cambiar contrasena"
            >
              <KeyRound size={14} />
            </button>
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-white text-xs font-medium truncate max-w-[160px]">{currentUserNombre || email}</span>
              <span className="text-white/40 text-[10px]">Formacion</span>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <X size={14} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-200 cursor-pointer"
                style={{
                  borderColor: activeTab === t.id ? '#5EEAD4' : 'transparent',
                  color: activeTab === t.id ? '#FFFFFF' : 'rgba(255,255,255,0.5)',
                }}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
            <AlertCircle size={16} style={{ color: '#DC2626' }} />
            <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="mb-4 rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
            <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
            <p className="text-xs font-medium" style={{ color: '#16A34A' }}>{successMsg}</p>
          </div>
        )}

        {/* ── Tab: Examenes ── */}
        {activeTab === 'ayuda' && (
          <HelpPanel currentProfileName="Formación" accentColor="#0D9488" />
        )}
        {activeTab === 'examenes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar examen..."
                className="w-full pl-9 pr-3 py-2 rounded-lg text-xs border outline-none transition-all"
                style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
              />
            </div>
            <button
              onClick={openNewExam}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#0D9488' }}
            >
              <Plus size={14} />
              Nuevo Examen
            </button>
          </div>

          {loadingExamenes ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : filteredExamenes.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <ClipboardCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
              <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay examenes creados</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea tu primer examen con el boton de arriba</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredExamenes.map((exam) => (
                <div key={exam.id} className="rounded-xl overflow-hidden transition-all duration-200" style={{ backgroundColor: '#FFFFFF', border: `1px solid ${selectedExamen?.id === exam.id ? '#0D9488' : '#E2E8F0'}` }}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDFA' }}>
                        <ClipboardCheck size={16} style={{ color: '#0D9488' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{exam.nombre}</h4>
                        {exam.descripcion && <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{exam.descripcion}</p>}
                        <div className="flex items-center gap-4 mt-2 flex-wrap">
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
                            <Clock size={11} /> {exam.duracion_minutos} min
                          </span>
                          <span className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
                            <CheckCircle2 size={11} /> Validez: {exam.validez_meses} meses
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => openEditExam(exam)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150"
                          style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                          title="Editar examen"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => openAssignModal(exam)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150"
                          style={{ backgroundColor: '#F0FDFA', color: '#0D9488', border: '1px solid #99F6E4' }}
                          title="Asignar a empleados"
                        >
                          <UserCheck size={13} />
                          <span className="hidden sm:inline">Asignar</span>
                        </button>
                        <button
                          onClick={() => handleDeleteExam(exam)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                          title="Eliminar examen"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSelectExamen(exam)}
                      className="mt-3 w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-150"
                      style={{ backgroundColor: selectedExamen?.id === exam.id ? '#F0FDFA' : '#F8FAFC', color: '#0D9488', border: '1px solid #E2E8F0' }}
                    >
                      <ListChecks size={12} />
                      {selectedExamen?.id === exam.id ? 'Ocultar preguntas' : `Ver preguntas (${preguntas.length})`}
                    </button>
                  </div>

                  {/* Expanded: questions + asignaciones */}
                  {selectedExamen?.id === exam.id && (
                    <div className="border-t" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                      {/* Questions section */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Preguntas ({preguntas.length})</p>
                          <button
                            onClick={openNewPregunta}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer transition-all duration-150"
                            style={{ backgroundColor: '#0D9488' }}
                          >
                            <Plus size={12} />
                            Nueva Pregunta
                          </button>
                        </div>

                        {loadingPreguntas ? (
                          <div className="flex items-center justify-center py-6">
                            <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
                          </div>
                        ) : preguntas.length === 0 ? (
                          <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>No hay preguntas. Crea la primera.</p>
                        ) : (
                          <div className="space-y-2">
                            {preguntas.map((p, idx) => (
                              <div key={p.id} className="rounded-lg p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="flex items-start gap-2">
                                  <span className="text-xs font-bold flex-shrink-0 mt-0.5" style={{ color: '#0D9488' }}>{idx + 1}.</span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{p.texto}</p>
                                    <div className="grid grid-cols-2 gap-1 mt-2">
                                      {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                                        const optionText = letter === 'A' ? p.opcion_a : letter === 'B' ? p.opcion_b : letter === 'C' ? p.opcion_c : p.opcion_d;
                                        const isCorrect = p.respuesta_correcta === letter;
                                        return (
                                          <div key={letter} className="flex items-center gap-1.5 text-xs px-2 py-1 rounded"
                                            style={{ backgroundColor: isCorrect ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${isCorrect ? '#BBF7D0' : '#E2E8F0'}` }}>
                                            <span className="font-bold" style={{ color: isCorrect ? '#16A34A' : '#94A3B8' }}>{letter})</span>
                                            <span style={{ color: isCorrect ? '#15803D' : '#64748B' }}>{optionText}</span>
                                            {isCorrect && <CheckCircle2 size={11} style={{ color: '#16A34A', marginLeft: 'auto' }} />}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                  <div className="flex flex-col gap-1 flex-shrink-0">
                                    <button onClick={() => openEditPregunta(p)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                                      <Edit2 size={11} />
                                    </button>
                                    <button onClick={() => handleDeletePregunta(p)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Asignaciones section */}
                      <div className="p-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Asignaciones ({asignaciones.length})</p>
                          <button
                            onClick={() => openAssignModal(exam)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer transition-all duration-150"
                            style={{ backgroundColor: '#0D9488' }}
                          >
                            <Plus size={12} />
                            Asignar a empleados
                          </button>
                        </div>

                        {loadingAsignaciones ? (
                          <div className="flex items-center justify-center py-6">
                            <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
                          </div>
                        ) : asignaciones.length === 0 ? (
                          <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>No hay asignaciones. Asigna el examen a empleados.</p>
                        ) : (
                          <div className="space-y-2">
                            {asignaciones.map((a) => {
                              const cfg = estadoConfig[a.estado] ?? estadoConfig.pendiente;
                              return (
                                <div key={a.id} className="rounded-lg p-3 flex items-center gap-3" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium" style={{ color: '#0F172A' }}>{a.nombre_empleado}</p>
                                    <p className="text-xs" style={{ color: '#94A3B8' }}>{a.dni ?? 'Sin DNI'}</p>
                                  </div>
                                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.border}` }}>
                                    {cfg.label}
                                  </span>
                                  {a.puntuacion !== null && (
                                    <span className="text-xs font-bold" style={{ color: a.puntuacion >= 60 ? '#16A34A' : '#DC2626' }}>{a.puntuacion}%</span>
                                  )}
                                  <button onClick={() => handleDeleteAsignacion(a)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          </div>
        )}

        {/* ── Tab: Asignaciones (global) ── */}
        {activeTab === 'asignaciones' && (
          <AsignacionesGlobales examenes={examenes} />
        )}
      </main>

      {/* ── Exam Editor Modal ── */}
      {showExamModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #134E4A, #0D9488)' }}>
              <h2 className="text-white font-semibold text-sm">{editingExamen ? 'Editar Examen' : 'Nuevo Examen'}</h2>
              <button onClick={() => setShowExamModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Nombre *</label>
                <input
                  type="text" value={examForm.nombre}
                  onChange={(e) => setExamForm({ ...examForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all"
                  style={{ borderColor: '#E2E8F0' }}
                  placeholder="Ej. Prevencion de riesgos nivel basico"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Descripcion</label>
                <textarea
                  value={examForm.descripcion}
                  onChange={(e) => setExamForm({ ...examForm, descripcion: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none transition-all resize-none"
                  style={{ borderColor: '#E2E8F0' }}
                  placeholder="Descripcion del examen..."
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Duracion (min)</label>
                  <input
                    type="number" min={1} value={examForm.duracion_minutos}
                    onChange={(e) => setExamForm({ ...examForm, duracion_minutos: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Validez (meses)</label>
                  <input
                    type="number" min={1} value={examForm.validez_meses}
                    onChange={(e) => setExamForm({ ...examForm, validez_meses: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Penalizacion</label>
                  <input
                    type="number" min={0} step={0.5} value={examForm.ratio_penalizacion}
                    onChange={(e) => setExamForm({ ...examForm, ratio_penalizacion: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0' }}
                  />
                </div>
              </div>
              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <button
                onClick={handleSaveExam}
                disabled={savingExam}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-all duration-150"
                style={{ backgroundColor: '#0D9488' }}
              >
                {savingExam ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {savingExam ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Question Editor Modal ── */}
      {showPreguntaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-lg w-full mx-4 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #134E4A, #0D9488)' }}>
              <h2 className="text-white font-semibold text-sm">{editingPregunta ? 'Editar Pregunta' : 'Nueva Pregunta'}</h2>
              <button onClick={() => setShowPreguntaModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Enunciado *</label>
                <textarea
                  value={preguntaForm.texto}
                  onChange={(e) => setPreguntaForm({ ...preguntaForm, texto: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                  style={{ borderColor: '#E2E8F0' }}
                  placeholder="Escribe la pregunta..."
                />
              </div>
              {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                const key = `opcion_${letter.toLowerCase()}` as 'opcion_a' | 'opcion_b' | 'opcion_c' | 'opcion_d';
                return (
                  <div key={letter}>
                    <label className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: '#64748B' }}>
                      <button
                        onClick={() => setPreguntaForm({ ...preguntaForm, respuesta_correcta: letter })}
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-all"
                        style={{
                          backgroundColor: preguntaForm.respuesta_correcta === letter ? '#16A34A' : '#F1F5F9',
                          color: preguntaForm.respuesta_correcta === letter ? '#fff' : '#94A3B8',
                          border: `1.5px solid ${preguntaForm.respuesta_correcta === letter ? '#16A34A' : '#E2E8F0'}`,
                        }}
                      >
                        {letter}
                      </button>
                      <span>Respuesta {letter}{preguntaForm.respuesta_correcta === letter ? ' (correcta)' : ''}</span>
                    </label>
                    <input
                      type="text" value={preguntaForm[key]}
                      onChange={(e) => setPreguntaForm({ ...preguntaForm, [key]: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                      style={{ borderColor: '#E2E8F0' }}
                      placeholder={`Opcion ${letter}...`}
                    />
                  </div>
                );
              })}
              <p className="text-xs" style={{ color: '#94A3B8' }}>Haz clic en la letra para marcar la respuesta correcta.</p>
              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <button
                onClick={handleSavePregunta}
                disabled={savingPregunta}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-all duration-150"
                style={{ backgroundColor: '#0D9488' }}
              >
                {savingPregunta ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {savingPregunta ? 'Guardando...' : 'Guardar Pregunta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Modal ── */}
      {showAssignModal && assignExamen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #134E4A, #0D9488)' }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Asignar examen</h2>
                <p className="text-white/70 text-xs">{assignExamen.nombre}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-4 flex flex-col flex-1 overflow-hidden">
              <div className="relative mb-3 flex-shrink-0">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  type="text" value={searchEmpleado}
                  onChange={(e) => setSearchEmpleado(e.target.value)}
                  placeholder="Buscar empleado..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border outline-none"
                  style={{ borderColor: '#E2E8F0' }}
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px]">
                {filteredEmpleados.length === 0 ? (
                  <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>No se encontraron empleados</p>
                ) : filteredEmpleados.map((emp) => {
                  const sel = selectedEmpleados.has(emp.id);
                  return (
                    <button
                      key={emp.id}
                      onClick={() => toggleEmpleado(emp.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: sel ? '#F0FDFA' : '#F8FAFC',
                        border: `1px solid ${sel ? '#99F6E4' : '#E2E8F0'}`,
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                        style={{
                          backgroundColor: sel ? '#0D9488' : '#FFFFFF',
                          border: `1.5px solid ${sel ? '#0D9488' : '#CBD5E1'}`,
                        }}
                      >
                        {sel && <CheckCircle2 size={12} className="text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{emp.nombre}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni ?? 'Sin DNI'}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
              {error && <p className="text-xs mt-2" style={{ color: '#DC2626' }}>{error}</p>}
              <button
                onClick={handleAssign}
                disabled={assigning || selectedEmpleados.size === 0}
                className="mt-3 w-full py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2 transition-all duration-150 flex-shrink-0"
                style={{ backgroundColor: '#0D9488' }}
              >
                {assigning ? <RefreshCw size={14} className="animate-spin" /> : <UserCheck size={14} />}
                {assigning ? 'Asignando...' : `Asignar a ${selectedEmpleados.size} empleado(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Global asignaciones view ──
function AsignacionesGlobales({ examenes }: { examenes: Examen[] }) {
  const [allAsignaciones, setAllAsignaciones] = useState<(Asignacion & { examen_nombre: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('examen_asignaciones')
        .select('*, examen_id')
        .order('created_at', { ascending: false });
      if (!error && data) {
        const enriched = data.map((a) => ({
          ...a,
          examen_nombre: examenes.find((e) => e.id === a.examen_id)?.nombre ?? 'Examen eliminado',
        }));
        setAllAsignaciones(enriched);
      }
      setLoading(false);
    })();
  }, [examenes]);

  const filtered = allAsignaciones.filter((a) =>
    a.nombre_empleado.toLowerCase().includes(search.toLowerCase()) ||
    a.examen_nombre.toLowerCase().includes(search.toLowerCase()) ||
    (a.dni ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const pendientes = allAsignaciones.filter((a) => a.estado === 'pendiente').length;
  const completados = allAsignaciones.filter((a) => a.estado === 'completado').length;
  const suspendidos = allAsignaciones.filter((a) => a.estado === 'suspendido').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-lg font-bold" style={{ color: '#64748B' }}>{pendientes}</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>Pendientes</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <p className="text-lg font-bold" style={{ color: '#16A34A' }}>{completados}</p>
          <p className="text-xs" style={{ color: '#15803D' }}>Completados</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <p className="text-lg font-bold" style={{ color: '#DC2626' }}>{suspendidos}</p>
          <p className="text-xs" style={{ color: '#B91C1C' }}>Suspendidos</p>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input
          type="text" value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por empleado, examen o DNI..."
          className="w-full pl-9 pr-3 py-2 rounded-lg text-xs border outline-none"
          style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <UserCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay asignaciones</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => {
            const cfg = estadoConfig[a.estado] ?? estadoConfig.pendiente;
            return (
              <div key={a.id} className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                  {a.estado === 'completado' ? <CheckCircle2 size={14} style={{ color: cfg.color }} /> :
                   a.estado === 'suspendido' ? <XCircle size={14} style={{ color: cfg.color }} /> :
                   <Clock size={14} style={{ color: cfg.color }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{a.nombre_empleado}</p>
                  <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{a.examen_nombre}{a.dni ? ` - ${a.dni}` : ''}</p>
                </div>
                {a.puntuacion !== null && (
                  <span className="text-sm font-bold" style={{ color: a.puntuacion >= 60 ? '#16A34A' : '#DC2626' }}>{a.puntuacion}%</span>
                )}
                <span className="text-xs font-medium px-2 py-0.5 rounded flex-shrink-0" style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.border}` }}>
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
