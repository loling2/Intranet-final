import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, X, Trash2, Search, FileText, FileVideo, Presentation, Link as LinkIcon, Type, Upload, Loader2, CheckCircle2, AlertCircle, Users, Clock, Save, Layers, Lock, Eye, EyeOff, ChevronDown, ChevronRight, GripVertical, FileQuestion } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { ensureMoodleCursoFolder, uploadMoodleFile, sanitizeSlug, downloadFromWasabi } from '../lib/wasabi';

interface Curso {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  duracion_estimada: string | null;
  wasabi_prefix: string;
  activo: boolean;
  examen_id: string | null;
  created_at: string;
}

interface Modulo {
  id: string;
  curso_id: string;
  titulo: string;
  descripcion: string | null;
  orden: number;
}

interface Contenido {
  id: string;
  curso_id: string;
  modulo_id: string | null;
  titulo: string;
  tipo: 'texto' | 'pdf' | 'powerpoint' | 'video' | 'diapositivas' | 'enlace';
  contenido_texto: string | null;
  wasabi_key: string | null;
  url_externa: string | null;
  nombre_archivo: string | null;
  tamano_bytes: number | null;
  orden: number;
  duracion_minutos: number;
  es_obligatorio: boolean;
  visible_empleado: boolean;
  descargable: boolean;
}

interface ExamenOption {
  id: string;
  nombre: string;
}

const tipoConfig: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  texto: { label: 'Texto', icon: Type, color: '#2563EB', bg: '#EFF6FF' },
  pdf: { label: 'PDF', icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  powerpoint: { label: 'PowerPoint', icon: Presentation, color: '#EA580C', bg: '#FFF7ED' },
  video: { label: 'Video', icon: FileVideo, color: '#7C3AED', bg: '#F5F3FF' },
  diapositivas: { label: 'Diapositivas', icon: Layers, color: '#0D9488', bg: '#F0FDFA' },
  enlace: { label: 'Enlace', icon: LinkIcon, color: '#0D9488', bg: '#F0FDFA' },
};

function normalizeExternalUrl(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch { return null; }
}

export default function CursosPanel() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showCursoModal, setShowCursoModal] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);
  const [cursoForm, setCursoForm] = useState({ nombre: '', descripcion: '', categoria: '', duracion_estimada: '', examen_id: '' });
  const [savingCurso, setSavingCurso] = useState(false);
  const [examenes, setExamenes] = useState<ExamenOption[]>([]);
  const [searchExamen, setSearchExamen] = useState('');
  const [showExamenDropdown, setShowExamenDropdown] = useState(false);

  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [contenidos, setContenidos] = useState<Contenido[]>([]);
  const [loadingModulos, setLoadingModulos] = useState(false);
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set());

  const [showModuloModal, setShowModuloModal] = useState(false);
  const [moduloForm, setModuloForm] = useState({ titulo: '', descripcion: '' });
  const [editingModulo, setEditingModulo] = useState<Modulo | null>(null);
  const [savingModulo, setSavingModulo] = useState(false);

  const [showContenidoModal, setShowContenidoModal] = useState(false);
  const [contenidoModuloId, setContenidoModuloId] = useState<string | null>(null);
  const [contenidoForm, setContenidoForm] = useState<{ titulo: string; tipo: Contenido['tipo']; contenido_texto: string; url_externa: string; duracion_minutos: string; es_obligatorio: boolean; visible_empleado: boolean; descargable: boolean }>({ titulo: '', tipo: 'texto', contenido_texto: '', url_externa: '', duracion_minutos: '0', es_obligatorio: true, visible_empleado: true, descargable: true });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingContenido, setSavingContenido] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [empleados, setEmpleados] = useState<{ id: string; nombre: string; dni: string | null }[]>([]);
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [selectedEmpleados, setSelectedEmpleados] = useState<Set<string>>(new Set());
  const [asignacionesCurso, setAsignacionesCurso] = useState<{ id: string; empleado_id: string; estado: string; nombre_empleado: string; dni: string | null }[]>([]);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);

  const loadCursos = useCallback(async () => {
    setLoadingCursos(true);
    const { data, error } = await supabase.from('moodle_cursos').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message); else setCursos(data ?? []);
    setLoadingCursos(false);
  }, []);

  const loadExamenes = useCallback(async () => {
    const { data } = await supabase.from('examenes').select('id, nombre').order('nombre');
    setExamenes(data ?? []);
  }, []);

  useEffect(() => { loadCursos(); loadExamenes(); }, [loadCursos, loadExamenes]);

  const loadModulos = useCallback(async (cursoId: string) => {
    setLoadingModulos(true);
    const { data: mods } = await supabase.from('moodle_modulos').select('*').eq('curso_id', cursoId).order('orden', { ascending: true });
    const modList = mods ?? [];
    setModulos(modList);
    if (modList.length > 0) {
      const { data: conts } = await supabase.from('moodle_contenido').select('*').eq('curso_id', cursoId).order('orden', { ascending: true });
      setContenidos(conts ?? []);
      setExpandedModulos(new Set([modList[0].id]));
    } else {
      setContenidos([]);
    }
    setLoadingModulos(false);
  }, []);

  const handleSelectCurso = (curso: Curso) => {
    if (selectedCurso?.id === curso.id) { setSelectedCurso(null); setModulos([]); setContenidos([]); return; }
    setSelectedCurso(curso);
    loadModulos(curso.id);
  };

  const openNewCurso = () => {
    setEditingCurso(null);
    setCursoForm({ nombre: '', descripcion: '', categoria: '', duracion_estimada: '', examen_id: '' });
    setShowCursoModal(true); setError('');
  };

  const openEditCurso = (c: Curso) => {
    setEditingCurso(c);
    setCursoForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', categoria: c.categoria ?? '', duracion_estimada: c.duracion_estimada ?? '', examen_id: c.examen_id ?? '' });
    setShowCursoModal(true); setError('');
  };

  const handleSaveCurso = async () => {
    if (!cursoForm.nombre.trim()) { setError('El nombre del curso es obligatorio.'); return; }
    setSavingCurso(true); setError('');
    try {
      const slug = sanitizeSlug(cursoForm.nombre);
      const prefix = `moodle/${slug}/`;
      const payload = {
        nombre: cursoForm.nombre.trim(),
        descripcion: cursoForm.descripcion.trim() || null,
        categoria: cursoForm.categoria.trim() || null,
        duracion_estimada: cursoForm.duracion_estimada.trim() || null,
        wasabi_prefix: prefix,
        examen_id: cursoForm.examen_id || null,
      };
      if (editingCurso) {
        const prevExamenId = editingCurso.examen_id;
        const { error: err } = await supabase.from('moodle_cursos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingCurso.id);
        if (err) throw err;
        if (cursoForm.examen_id !== prevExamenId) {
          const { data: existingAsig } = await supabase.from('moodle_asignaciones').select('empleado_id').eq('curso_id', editingCurso.id);
          const empleadoIds = (existingAsig ?? []).map((a: any) => a.empleado_id).filter(Boolean);
          if (prevExamenId && empleadoIds.length > 0) {
            await supabase.from('examen_asignaciones')
              .delete()
              .eq('examen_id', prevExamenId)
              .in('empleado_id', empleadoIds)
              .neq('estado', 'completado');
          }
          if (cursoForm.examen_id && empleadoIds.length > 0) {
            const { data: emps } = await supabase.from('empleados').select('id, nombre, dni').in('id', empleadoIds);
            const examRows = (emps ?? []).map((emp: any) => ({
              examen_id: cursoForm.examen_id,
              empleado_id: emp.id,
              nombre_empleado: emp.nombre ?? 'Empleado',
              dni: emp.dni ?? null,
              estado: 'pendiente' as const,
            }));
            await supabase.from('examen_asignaciones').upsert(examRows, { onConflict: 'examen_id,empleado_id' });
          }
        }
      } else {
        const { error: err } = await supabase.from('moodle_cursos').insert(payload);
        if (err) throw err;
        await ensureMoodleCursoFolder(cursoForm.nombre);
      }
      setShowCursoModal(false);
      await loadCursos();
      setSuccessMsg('Curso guardado.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingCurso(false); }
  };

  const handleDeleteCurso = async (c: Curso) => {
    if (!confirm(`Eliminar el curso "${c.nombre}" y todo su contenido?`)) return;
    try {
      const { error: err } = await supabase.from('moodle_cursos').delete().eq('id', c.id);
      if (err) throw err;
      if (selectedCurso?.id === c.id) { setSelectedCurso(null); setModulos([]); setContenidos([]); }
      await loadCursos();
      setSuccessMsg('Curso eliminado.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  // Modulos
  const openNewModulo = () => { setEditingModulo(null); setModuloForm({ titulo: '', descripcion: '' }); setShowModuloModal(true); };
  const openEditModulo = (m: Modulo) => { setEditingModulo(m); setModuloForm({ titulo: m.titulo, descripcion: m.descripcion ?? '' }); setShowModuloModal(true); };

  const handleSaveModulo = async () => {
    if (!selectedCurso || !moduloForm.titulo.trim()) { setError('El titulo del modulo es obligatorio.'); return; }
    setSavingModulo(true); setError('');
    try {
      if (editingModulo) {
        const { error: err } = await supabase.from('moodle_modulos').update({ titulo: moduloForm.titulo.trim(), descripcion: moduloForm.descripcion.trim() || null, updated_at: new Date().toISOString() }).eq('id', editingModulo.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('moodle_modulos').insert({ curso_id: selectedCurso.id, titulo: moduloForm.titulo.trim(), descripcion: moduloForm.descripcion.trim() || null, orden: modulos.length });
        if (err) throw err;
      }
      setShowModuloModal(false);
      await loadModulos(selectedCurso.id);
      setSuccessMsg('Modulo guardado.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingModulo(false); }
  };

  const handleDeleteModulo = async (m: Modulo) => {
    if (!confirm(`Eliminar el modulo "${m.titulo}" y su contenido?`)) return;
    try {
      const { error: err } = await supabase.from('moodle_modulos').delete().eq('id', m.id);
      if (err) throw err;
      if (selectedCurso) await loadModulos(selectedCurso.id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const toggleExpand = (id: string) => {
    setExpandedModulos((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  // Contenido
  const openNewContenido = (moduloId: string) => {
    setContenidoModuloId(moduloId);
    setContenidoForm({ titulo: '', tipo: 'texto', contenido_texto: '', url_externa: '', duracion_minutos: '0', es_obligatorio: true, visible_empleado: true, descargable: true });
    setUploadFile(null);
    setShowContenidoModal(true); setError('');
  };

  const handleSaveContenido = async () => {
    if (!selectedCurso || !contenidoModuloId) return;
    if (!contenidoForm.titulo.trim()) { setError('El titulo es obligatorio.'); return; }
    const externalUrl = contenidoForm.tipo === 'enlace' ? normalizeExternalUrl(contenidoForm.url_externa) : null;
    if (contenidoForm.tipo === 'enlace' && !externalUrl) { setError('Escribe una URL valida.'); return; }
    if ((contenidoForm.tipo === 'pdf' || contenidoForm.tipo === 'powerpoint' || contenidoForm.tipo === 'video') && !uploadFile) { setError('Debes seleccionar un archivo.'); return; }
    setSavingContenido(true); setError('');
    try {
      let wasabiKey: string | null = null;
      let nombreArchivo: string | null = null;
      let tamanoBytes: number | null = null;
      if ((contenidoForm.tipo === 'pdf' || contenidoForm.tipo === 'powerpoint' || contenidoForm.tipo === 'video') && uploadFile) {
        setUploading(true);
        wasabiKey = await uploadMoodleFile(uploadFile, selectedCurso.wasabi_prefix);
        setUploading(false);
        nombreArchivo = uploadFile.name;
        tamanoBytes = uploadFile.size;
      }
      const moduloContenidos = contenidos.filter((c) => c.modulo_id === contenidoModuloId);
      const payload = {
        curso_id: selectedCurso.id,
        modulo_id: contenidoModuloId,
        titulo: contenidoForm.titulo.trim(),
        tipo: contenidoForm.tipo,
        contenido_texto: contenidoForm.tipo === 'texto' || contenidoForm.tipo === 'diapositivas' ? contenidoForm.contenido_texto.trim() : null,
        wasabi_key: wasabiKey,
        url_externa: externalUrl,
        nombre_archivo: nombreArchivo,
        tamano_bytes: tamanoBytes,
        orden: moduloContenidos.length,
        duracion_minutos: parseInt(contenidoForm.duracion_minutos) || 0,
        es_obligatorio: contenidoForm.es_obligatorio,
        visible_empleado: contenidoForm.visible_empleado,
        descargable: contenidoForm.descargable,
      };
      const { error: err } = await supabase.from('moodle_contenido').insert(payload);
      if (err) throw err;
      setShowContenidoModal(false);
      await loadModulos(selectedCurso.id);
      setSuccessMsg('Contenido anadido.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingContenido(false); setUploading(false); }
  };

  const handleDeleteContenido = async (c: Contenido) => {
    if (!confirm('Eliminar este contenido?')) return;
    try {
      const { error: err } = await supabase.from('moodle_contenido').delete().eq('id', c.id);
      if (err) throw err;
      if (selectedCurso) await loadModulos(selectedCurso.id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const handleDownloadContenido = async (c: Contenido) => {
    if (!c.wasabi_key) return;
    try { await downloadFromWasabi(c.wasabi_key, c.nombre_archivo ?? 'archivo'); }
    catch { setError('Error al descargar'); }
  };

  // Asignaciones
  const openAssignModal = () => {
    if (!selectedCurso) return;
    setShowAssignModal(true); setSelectedEmpleados(new Set()); setSearchEmpleado('');
    const load = async () => {
      const { data } = await supabase.from('empleados').select('id, nombre, dni').eq('activo', true).order('nombre');
      setEmpleados(data ?? []);
    };
    load();
    const loadAsig = async () => {
      setLoadingAsignaciones(true);
      const { data } = await supabase.from('moodle_asignaciones').select('id, empleado_id, estado').eq('curso_id', selectedCurso.id);
      if (data) {
        const enriched = await Promise.all(data.map(async (a: any) => {
          const { data: emp } = await supabase.from('empleados').select('nombre, dni').eq('id', a.empleado_id).maybeSingle();
          return { id: a.id, empleado_id: a.empleado_id, estado: a.estado, nombre_empleado: emp?.nombre ?? 'Desconocido', dni: emp?.dni ?? null };
        }));
        setAsignacionesCurso(enriched);
      }
      setLoadingAsignaciones(false);
    };
    loadAsig();
  };

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const handleAssignCurso = async () => {
    if (!selectedCurso || selectedEmpleados.size === 0) { setError('Selecciona al menos un empleado.'); return; }
    setError('');
    try {
      const rows = Array.from(selectedEmpleados).map((empId) => ({ curso_id: selectedCurso.id, empleado_id: empId }));
      const { error: err } = await supabase.from('moodle_asignaciones').insert(rows);
      if (err) { if (err.code === '23505') setError('Uno o mas empleados ya tienen este curso.'); else throw err; }

      if (selectedCurso.examen_id) {
        const { data: emps } = await supabase.from('empleados').select('id, nombre, dni').in('id', Array.from(selectedEmpleados));
        const examRows = (emps ?? []).map((emp: any) => ({
          examen_id: selectedCurso.examen_id!,
          empleado_id: emp.id,
          nombre_empleado: emp.nombre ?? 'Empleado',
          dni: emp.dni ?? null,
          estado: 'pendiente' as const,
        }));
        await supabase.from('examen_asignaciones').upsert(examRows, { onConflict: 'examen_id,empleado_id' });
      }

      setShowAssignModal(false);
      openAssignModal();
      setSuccessMsg('Curso asignado.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al asignar'); }
  };

  const handleDeleteAsignacion = async (a: { id: string }) => {
    try {
      const { error: err } = await supabase.from('moodle_asignaciones').delete().eq('id', a.id);
      if (err) throw err;
      if (selectedCurso) openAssignModal();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error'); }
  };

  const filteredCursos = cursos.filter((c) => c.nombre.toLowerCase().includes(search.toLowerCase()) || (c.categoria ?? '').toLowerCase().includes(search.toLowerCase()));
  const filteredEmpleados = empleados.filter((e) => e.nombre.toLowerCase().includes(searchEmpleado.toLowerCase()) || (e.dni ?? '').toLowerCase().includes(searchEmpleado.toLowerCase()));
  const formatSize = (bytes: number | null): string => { if (!bytes) return '-'; if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 sm:p-6 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 12px 30px rgba(13,148,136,0.2)' }}>
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <BookOpen size={28} style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.72)' }}>Plataforma de cursos</p>
              <h3 className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>Moodle</h3>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.82)' }}>Crea cursos por modulos, sube contenido y asigna a empleados.</p>
            </div>
          </div>
          <button onClick={openNewCurso} className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all" style={{ backgroundColor: '#FFFFFF', color: '#0D9488', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Plus size={14} /> Nuevo Curso
          </button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar curso..." className="w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }} />
      </div>

      {loadingCursos ? (
        <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0D9488' }} /></div>
      ) : filteredCursos.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F0FDFA' }}><BookOpen size={32} style={{ color: '#0D9488' }} /></div>
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>No hay cursos creados todavia</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea tu primer curso con el boton "Nuevo Curso".</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCursos.map((curso) => (
            <div key={curso.id} className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="p-5 cursor-pointer" onClick={() => handleSelectCurso(curso)} style={{ background: selectedCurso?.id === curso.id ? 'linear-gradient(135deg, #F0FDFA, #ECFDF5)' : '#FFFFFF' }}>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}><BookOpen size={20} style={{ color: '#FFFFFF' }} /></div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEditCurso(curso); }} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}><Save size={12} /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCurso(curso); }} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><Trash2 size={12} /></button>
                  </div>
                </div>
                <h4 className="text-sm font-bold leading-tight" style={{ color: '#0F172A' }}>{curso.nombre}</h4>
                {curso.descripcion && <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#94A3B8' }}>{curso.descripcion}</p>}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {curso.categoria && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: '#0D9488', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4' }}>{curso.categoria}</span>}
                  {curso.duracion_estimada && <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#94A3B8' }}><Clock size={9} /> {curso.duracion_estimada}</span>}
                  {curso.examen_id && (
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: '#0D9488', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4' }}>
                      <FileQuestion size={9} /> {examenes.find((e) => e.id === curso.examen_id)?.nombre ?? 'Examen'}
                    </span>
                  )}
                  {!curso.activo && <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>Inactivo</span>}
                </div>
              </div>

              {selectedCurso?.id === curso.id && (
                <div className="border-t" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                  {loadingModulos ? (
                    <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin" style={{ color: '#0D9488' }} /></div>
                  ) : (
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h5 className="text-xs font-bold" style={{ color: '#0F172A' }}>Modulos del curso</h5>
                        <button onClick={openNewModulo} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}><Plus size={10} /> Modulo</button>
                      </div>

                      {modulos.length === 0 ? (
                        <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>Sin modulos. Crea el primero.</p>
                      ) : (
                        modulos.map((m, mi) => {
                          const expanded = expandedModulos.has(m.id);
                          const modContenidos = contenidos.filter((c) => c.modulo_id === m.id);
                          return (
                            <div key={m.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <div className="p-3 flex items-center gap-2 cursor-pointer" onClick={() => toggleExpand(m.id)}>
                                {expanded ? <ChevronDown size={14} style={{ color: '#64748B' }} /> : <ChevronRight size={14} style={{ color: '#64748B' }} />}
                                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDFA' }}><Layers size={14} style={{ color: '#0D9488' }} /></div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>Modulo {mi + 1}: {m.titulo}</p>
                                  <p className="text-[10px]" style={{ color: '#94A3B8' }}>{modContenidos.length} recurso(s)</p>
                                </div>
                                <button onClick={(e) => { e.stopPropagation(); openEditModulo(m); }} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}><Save size={10} /></button>
                                <button onClick={(e) => { e.stopPropagation(); handleDeleteModulo(m); }} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><Trash2 size={10} /></button>
                              </div>
                              {expanded && (
                                <div className="px-3 pb-3 space-y-2">
                                  {modContenidos.length === 0 ? (
                                    <p className="text-[10px] text-center py-2" style={{ color: '#94A3B8' }}>Sin contenido en este modulo.</p>
                                  ) : modContenidos.map((c) => {
                                    const cfg = tipoConfig[c.tipo] ?? tipoConfig.texto;
                                    const Icon = cfg.icon;
                                    return (
                                      <div key={c.id} className="rounded-lg p-2.5 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}><Icon size={12} style={{ color: cfg.color }} /></div>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[11px] font-medium truncate" style={{ color: '#0F172A' }}>{c.titulo}</p>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[9px]" style={{ color: '#94A3B8' }}>{cfg.label}{c.duracion_minutos > 0 ? ` - ${c.duracion_minutos}min` : ''}{c.tamano_bytes ? ` (${formatSize(c.tamano_bytes)})` : ''}</span>
                                            {c.es_obligatorio && <span className="text-[9px] font-medium" style={{ color: '#0D9488' }}>Obligatorio</span>}
                                            {!c.visible_empleado && <span className="flex items-center gap-0.5 text-[9px] font-medium" style={{ color: '#DC2626' }}><Lock size={8} /> Oculto</span>}
                                            {!c.descargable && c.wasabi_key && <span className="text-[9px] font-medium" style={{ color: '#64748B' }}>No descargable</span>}
                                          </div>
                                        </div>
                                        {c.wasabi_key && c.descargable && <button onClick={() => handleDownloadContenido(c)} className="text-[9px] font-medium px-1.5 py-0.5 rounded cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Ver</button>}
                                        {c.url_externa && <a href={normalizeExternalUrl(c.url_externa) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Abrir</a>}
                                        <button onClick={() => handleDeleteContenido(c)} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><Trash2 size={8} /></button>
                                      </div>
                                    );
                                  })}
                                  <button onClick={() => openNewContenido(m.id)} className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-medium cursor-pointer" style={{ backgroundColor: '#F0FDFA', color: '#0D9488', border: '1px dashed #99F6E4' }}><Plus size={10} /> Anadir contenido</button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}

                      {/* Sección Examen */}
                      <div className="rounded-xl p-3" style={{ backgroundColor: selectedCurso?.examen_id ? '#F0FDFA' : '#F8FAFC', border: `1px solid ${selectedCurso?.examen_id ? '#99F6E4' : '#E2E8F0'}` }}>
                        <div className="flex items-center gap-2 mb-1">
                          <FileQuestion size={14} style={{ color: selectedCurso?.examen_id ? '#0D9488' : '#94A3B8' }} />
                          <h5 className="text-xs font-bold" style={{ color: '#0F172A' }}>Examen del curso</h5>
                        </div>
                        {selectedCurso?.examen_id ? (
                          <div>
                            <p className="text-[11px] font-medium" style={{ color: '#0D9488' }}>{examenes.find((e) => e.id === selectedCurso.examen_id)?.nombre ?? 'Examen vinculado'}</p>
                            <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Al completar el 100% de la teoria, el examen se desbloquea automaticamente para los empleados asignados.</p>
                            <button onClick={() => openEditCurso(selectedCurso)} className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}><Save size={10} /> Cambiar examen</button>
                          </div>
                        ) : (
                          <div>
                            <p className="text-[10px]" style={{ color: '#94A3B8' }}>Este curso no tiene examen vinculado. Edita el curso para seleccionar uno.</p>
                            <button onClick={() => openEditCurso(selectedCurso)} className="mt-2 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}><FileQuestion size={10} /> Vincular examen</button>
                          </div>
                        )}
                      </div>

                      <div className="pt-3 border-t" style={{ borderColor: '#E2E8F0' }}>
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-xs font-bold" style={{ color: '#0F172A' }}>Empleados asignados ({asignacionesCurso.length})</h5>
                          <button onClick={openAssignModal} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}><Users size={10} /> Asignar</button>
                        </div>
                        {loadingAsignaciones ? <div className="flex justify-center py-3"><Loader2 size={16} className="animate-spin" style={{ color: '#0D9488' }} /></div>
                          : asignacionesCurso.length === 0 ? <p className="text-[10px] text-center py-3" style={{ color: '#94A3B8' }}>Sin asignaciones.</p>
                          : <div className="space-y-1.5">{asignacionesCurso.map((a) => (
                            <div key={a.id} className="rounded-lg p-2 flex items-center gap-2" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <div className="flex-1 min-w-0"><p className="text-[11px] font-medium truncate" style={{ color: '#0F172A' }}>{a.nombre_empleado}</p><p className="text-[9px]" style={{ color: '#94A3B8' }}>{a.dni ?? 'Sin DNI'}</p></div>
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded" style={{ color: a.estado === 'completado' ? '#16A34A' : a.estado === 'en_curso' ? '#0D9488' : '#64748B', backgroundColor: a.estado === 'completado' ? '#F0FDF4' : a.estado === 'en_curso' ? '#F0FDFA' : '#F8FAFC' }}>{a.estado}</span>
                              <button onClick={() => handleDeleteAsignacion(a)} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><Trash2 size={8} /></button>
                            </div>))}</div>}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Modal: Crear/Editar curso */}
      {showCursoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{editingCurso ? 'Editar curso' : 'Nuevo curso'}</h3>
              <button onClick={() => setShowCursoModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}><X size={16} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Nombre *</label>
                <input type="text" value={cursoForm.nombre} onChange={(e) => setCursoForm({ ...cursoForm, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Descripcion</label>
                <textarea value={cursoForm.descripcion} onChange={(e) => setCursoForm({ ...cursoForm, descripcion: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Categoria</label>
                  <input type="text" value={cursoForm.categoria} onChange={(e) => setCursoForm({ ...cursoForm, categoria: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Duracion estimada</label>
                  <input type="text" value={cursoForm.duracion_estimada} onChange={(e) => setCursoForm({ ...cursoForm, duracion_estimada: e.target.value })} placeholder="ej. 10 horas" className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Examen asociado (opcional)</label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 z-10" style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    value={cursoForm.examen_id ? (examenes.find((e) => e.id === cursoForm.examen_id)?.nombre ?? '') : ''}
                    onFocus={() => setShowExamenDropdown(true)}
                    onChange={(e) => { setSearchExamen(e.target.value); setShowExamenDropdown(true); if (!e.target.value) setCursoForm({ ...cursoForm, examen_id: '' }); }}
                    onBlur={() => setTimeout(() => setShowExamenDropdown(false), 200)}
                    placeholder="Buscar examen para vincular..."
                    className="w-full pl-9 pr-9 py-2 rounded-lg text-xs outline-none"
                    style={{ border: `1px solid ${cursoForm.examen_id ? '#0D9488' : '#E2E8F0'}`, color: '#0F172A', backgroundColor: cursoForm.examen_id ? '#F0FDFA' : '#FFFFFF' }}
                  />
                  {cursoForm.examen_id && (
                    <button type="button" onClick={() => { setCursoForm({ ...cursoForm, examen_id: '' }); setSearchExamen(''); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}><X size={12} style={{ color: '#64748B' }} /></button>
                  )}
                  {showExamenDropdown && (
                    <div className="absolute z-50 left-0 right-0 mt-1 rounded-lg max-h-48 overflow-y-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                      <button type="button" onClick={() => { setCursoForm({ ...cursoForm, examen_id: '' }); setSearchExamen(''); setShowExamenDropdown(false); }} className="w-full text-left px-3 py-2 text-xs cursor-pointer hover:bg-slate-50" style={{ color: '#94A3B8' }}>Sin examen</button>
                      {examenes
                        .filter((ex) => ex.nombre.toLowerCase().includes(searchExamen.toLowerCase()))
                        .slice(0, 20)
                        .map((ex) => (
                          <button key={ex.id} type="button" onClick={() => { setCursoForm({ ...cursoForm, examen_id: ex.id }); setSearchExamen(''); setShowExamenDropdown(false); }} className="w-full text-left px-3 py-2 text-xs cursor-pointer transition-all" style={{ backgroundColor: cursoForm.examen_id === ex.id ? '#F0FDFA' : '#FFFFFF', color: '#0F172A', border: cursoForm.examen_id === ex.id ? '1px solid #99F6E4' : 'none' }}>{ex.nombre}</button>
                        ))}
                      {examenes.filter((ex) => ex.nombre.toLowerCase().includes(searchExamen.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs" style={{ color: '#94A3B8' }}>No se encontraron examenes.</p>
                      )}
                    </div>
                  )}
                </div>
                {cursoForm.examen_id && (
                  <div className="mt-2 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: '#F0FDFA', border: '1px solid #99F6E4' }}>
                    <FileQuestion size={14} style={{ color: '#0D9488' }} />
                    <p className="text-[11px] font-medium" style={{ color: '#0D9488' }}>Examen vinculado: {examenes.find((e) => e.id === cursoForm.examen_id)?.nombre ?? 'Seleccionado'}</p>
                  </div>
                )}
                <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>Al vincular un examen, se asignara automaticamente a los empleados que tengan este curso. Cuando completen el 100% de la teoria, el examen se desbloqueara.</p>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 sticky bottom-0" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <button onClick={() => setShowCursoModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSaveCurso} disabled={savingCurso} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>{savingCurso ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Modulo */}
      {showModuloModal && selectedCurso && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl max-w-md w-full mx-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{editingModulo ? 'Editar modulo' : 'Nuevo modulo'}</h3>
              <button onClick={() => setShowModuloModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}><X size={16} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Titulo *</label>
                <input type="text" value={moduloForm.titulo} onChange={(e) => setModuloForm({ ...moduloForm, titulo: e.target.value })} placeholder="ej. Modulo 1: Introduccion" className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Descripcion</label>
                <textarea value={moduloForm.descripcion} onChange={(e) => setModuloForm({ ...moduloForm, descripcion: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <p className="text-[10px]" style={{ color: '#94A3B8' }}>El modulo {modulos.length + 1} estara bloqueado hasta que el empleado complete el modulo anterior.</p>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setShowModuloModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSaveModulo} disabled={savingModulo} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>{savingModulo ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Contenido */}
      {showContenidoModal && selectedCurso && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Anadir contenido</h3>
              <button onClick={() => setShowContenidoModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}><X size={16} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Titulo *</label>
                <input type="text" value={contenidoForm.titulo} onChange={(e) => setContenidoForm({ ...contenidoForm, titulo: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Tipo *</label>
                <div className="grid grid-cols-6 gap-2">
                  {Object.entries(tipoConfig).map(([tipo, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={tipo} onClick={() => setContenidoForm({ ...contenidoForm, tipo: tipo as Contenido['tipo'] })} className="flex flex-col items-center gap-1 p-2 rounded-lg cursor-pointer transition-all" style={{ backgroundColor: contenidoForm.tipo === tipo ? cfg.bg : '#F8FAFC', border: `1.5px solid ${contenidoForm.tipo === tipo ? cfg.color : '#E2E8F0'}` }}>
                        <Icon size={16} style={{ color: cfg.color }} /><span className="text-[8px] font-medium text-center" style={{ color: cfg.color }}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {(contenidoForm.tipo === 'texto' || contenidoForm.tipo === 'diapositivas') && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>{contenidoForm.tipo === 'diapositivas' ? 'Contenido (una diapositiva por linea, separadas por ---)' : 'Contenido de texto'}</label>
                  <textarea value={contenidoForm.contenido_texto} onChange={(e) => setContenidoForm({ ...contenidoForm, contenido_texto: e.target.value })} rows={6} className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
              )}
              {(contenidoForm.tipo === 'pdf' || contenidoForm.tipo === 'powerpoint' || contenidoForm.tipo === 'video') && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Archivo *</label>
                  <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} accept={contenidoForm.tipo === 'pdf' ? '.pdf' : contenidoForm.tipo === 'powerpoint' ? '.ppt,.pptx' : 'video/*'} className="w-full text-xs" style={{ color: '#0F172A' }} />
                  {uploadFile && <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{uploadFile.name} ({formatSize(uploadFile.size)})</p>}
                </div>
              )}
              {contenidoForm.tipo === 'enlace' && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>URL *</label>
                  <input type="text" value={contenidoForm.url_externa} onChange={(e) => setContenidoForm({ ...contenidoForm, url_externa: e.target.value })} placeholder="www.youtube.com o https://..." className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Duracion minima (minutos)</label>
                  <input type="number" min="0" value={contenidoForm.duracion_minutos} onChange={(e) => setContenidoForm({ ...contenidoForm, duracion_minutos: e.target.value })} className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                  <p className="text-[9px] mt-0.5" style={{ color: '#94A3B8' }}>El empleado no podra avanzar antes de este tiempo.</p>
                </div>
                <div className="flex flex-col justify-end gap-2 pt-4">
                  <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#0F172A' }}>
                    <input type="checkbox" checked={contenidoForm.es_obligatorio} onChange={(e) => setContenidoForm({ ...contenidoForm, es_obligatorio: e.target.checked })} />
                    Obligatorio
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#0F172A' }}>
                    <input type="checkbox" checked={contenidoForm.visible_empleado} onChange={(e) => setContenidoForm({ ...contenidoForm, visible_empleado: e.target.checked })} />
                    Visible para empleado
                  </label>
                  <label className="flex items-center gap-2 text-xs cursor-pointer" style={{ color: '#0F172A' }}>
                    <input type="checkbox" checked={contenidoForm.descargable} onChange={(e) => setContenidoForm({ ...contenidoForm, descargable: e.target.checked })} />
                    Descargable
                  </label>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 sticky bottom-0" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <button onClick={() => setShowContenidoModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSaveContenido} disabled={savingContenido || uploading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>{uploading ? <Loader2 size={12} className="animate-spin" /> : savingContenido ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}{uploading ? 'Subiendo...' : 'Anadir'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar */}
      {showAssignModal && selectedCurso && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Asignar "{selectedCurso.nombre}"</h3>
              <button onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}><X size={16} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="p-4 border-b" style={{ borderColor: '#E2E8F0' }}>
              <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} /><input type="text" value={searchEmpleado} onChange={(e) => setSearchEmpleado(e.target.value)} placeholder="Buscar empleado..." className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} /></div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredEmpleados.map((emp) => {
                const sel = selectedEmpleados.has(emp.id);
                const yaAsignado = asignacionesCurso.some((a) => a.empleado_id === emp.id);
                return (
                  <button key={emp.id} onClick={() => !yaAsignado && toggleEmpleado(emp.id)} disabled={yaAsignado} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all" style={{ backgroundColor: yaAsignado ? '#F1F5F9' : sel ? '#F0FDFA' : '#F8FAFC', border: `1px solid ${yaAsignado ? '#E2E8F0' : sel ? '#99F6E4' : '#E2E8F0'}`, cursor: yaAsignado ? 'not-allowed' : 'pointer', opacity: yaAsignado ? 0.6 : 1 }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sel ? '#0D9488' : '#FFFFFF', border: `1.5px solid ${sel ? '#0D9488' : '#CBD5E1'}` }}>{sel && <CheckCircle2 size={12} className="text-white" />}</div>
                    <div className="flex-1 min-w-0"><p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{emp.nombre}</p><p className="text-[10px]" style={{ color: '#94A3B8' }}>{emp.dni ?? 'Sin DNI'}</p></div>
                    {yaAsignado && <span className="text-[9px] font-medium px-1.5 py-0.5 rounded" style={{ color: '#64748B', backgroundColor: '#F1F5F9' }}>Ya asignado</span>}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #E2E8F0' }}>
              <span className="text-xs" style={{ color: '#94A3B8' }}>{selectedEmpleados.size} seleccionado(s)</span>
              <button onClick={handleAssignCurso} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}><Users size={12} /> Asignar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
