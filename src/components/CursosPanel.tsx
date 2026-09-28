import { useState, useEffect, useCallback } from 'react';
import { BookOpen, Plus, X, Trash2, Search, FileText, FileVideo, Presentation, Link as LinkIcon, Type, Upload, Loader2, CheckCircle2, AlertCircle, Users, ChevronLeft, Clock, Save } from 'lucide-react';
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
  created_at: string;
}

interface Contenido {
  id: string;
  curso_id: string;
  titulo: string;
  tipo: 'texto' | 'pdf' | 'powerpoint' | 'video' | 'enlace';
  contenido_texto: string | null;
  wasabi_key: string | null;
  url_externa: string | null;
  nombre_archivo: string | null;
  tamano_bytes: number | null;
  orden: number;
  created_at: string;
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
}

function normalizeExternalUrl(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try {
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

interface AsignacionCurso {
  id: string;
  empleado_id: string;
  estado: string;
  nombre_empleado: string;
  dni: string | null;
}

const tipoConfig: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  texto: { label: 'Texto', icon: Type, color: '#2563EB', bg: '#EFF6FF' },
  pdf: { label: 'PDF', icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  powerpoint: { label: 'PowerPoint', icon: Presentation, color: '#EA580C', bg: '#FFF7ED' },
  video: { label: 'Video', icon: FileVideo, color: '#7C3AED', bg: '#F5F3FF' },
  enlace: { label: 'Enlace', icon: LinkIcon, color: '#0D9488', bg: '#F0FDFA' },
};

export default function CursosPanel() {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [loadingCursos, setLoadingCursos] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [showCursoModal, setShowCursoModal] = useState(false);
  const [editingCurso, setEditingCurso] = useState<Curso | null>(null);
  const [cursoForm, setCursoForm] = useState({ nombre: '', descripcion: '', categoria: '', duracion_estimada: '' });
  const [savingCurso, setSavingCurso] = useState(false);

  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);
  const [contenidos, setContenidos] = useState<Contenido[]>([]);
  const [loadingContenidos, setLoadingContenidos] = useState(false);

  const [showContenidoModal, setShowContenidoModal] = useState(false);
  const [contenidoForm, setContenidoForm] = useState<{ titulo: string; tipo: Contenido['tipo']; contenido_texto: string; url_externa: string }>({ titulo: '', tipo: 'texto', contenido_texto: '', url_externa: '' });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingContenido, setSavingContenido] = useState(false);

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [searchEmpleado, setSearchEmpleado] = useState('');
  const [selectedEmpleados, setSelectedEmpleados] = useState<Set<string>>(new Set());
  const [asignacionesCurso, setAsignacionesCurso] = useState<AsignacionCurso[]>([]);
  const [loadingAsignaciones, setLoadingAsignaciones] = useState(false);

  const loadCursos = useCallback(async () => {
    setLoadingCursos(true);
    const { data, error } = await supabase.from('moodle_cursos').select('*').order('created_at', { ascending: false });
    if (error) setError(error.message);
    else setCursos(data ?? []);
    setLoadingCursos(false);
  }, []);

  useEffect(() => { loadCursos(); }, [loadCursos]);

  const loadContenidos = useCallback(async (cursoId: string) => {
    setLoadingContenidos(true);
    const { data, error } = await supabase.from('moodle_contenido').select('*').eq('curso_id', cursoId).order('orden', { ascending: true });
    if (error) setError(error.message);
    else setContenidos(data ?? []);
    setLoadingContenidos(false);
  }, []);

  const loadEmpleados = useCallback(async () => {
    const { data } = await supabase.from('empleados').select('id, nombre, dni').eq('activo', true).order('nombre', { ascending: true });
    setEmpleados(data ?? []);
  }, []);

  const loadAsignacionesCurso = useCallback(async (cursoId: string) => {
    setLoadingAsignaciones(true);
    const { data } = await supabase.from('moodle_asignaciones').select('id, empleado_id, estado').eq('curso_id', cursoId);
    if (data) {
      const enriched: AsignacionCurso[] = await Promise.all(data.map(async (a: any) => {
        const { data: emp } = await supabase.from('empleados').select('nombre, dni').eq('id', a.empleado_id).maybeSingle();
        return { id: a.id, empleado_id: a.empleado_id, estado: a.estado, nombre_empleado: emp?.nombre ?? 'Desconocido', dni: emp?.dni ?? null };
      }));
      setAsignacionesCurso(enriched);
    }
    setLoadingAsignaciones(false);
  }, []);

  const handleSelectCurso = (curso: Curso) => {
    if (selectedCurso?.id === curso.id) {
      setSelectedCurso(null);
      setContenidos([]);
      setAsignacionesCurso([]);
      return;
    }
    setSelectedCurso(curso);
    loadContenidos(curso.id);
    loadAsignacionesCurso(curso.id);
  };

  const openNewCurso = () => {
    setEditingCurso(null);
    setCursoForm({ nombre: '', descripcion: '', categoria: '', duracion_estimada: '' });
    setShowCursoModal(true);
    setError('');
  };

  const openEditCurso = (c: Curso) => {
    setEditingCurso(c);
    setCursoForm({ nombre: c.nombre, descripcion: c.descripcion ?? '', categoria: c.categoria ?? '', duracion_estimada: c.duracion_estimada ?? '' });
    setShowCursoModal(true);
    setError('');
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
      };
      if (editingCurso) {
        const { error: err } = await supabase.from('moodle_cursos').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingCurso.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('moodle_cursos').insert(payload);
        if (err) throw err;
        await ensureMoodleCursoFolder(cursoForm.nombre);
      }
      setShowCursoModal(false);
      await loadCursos();
      setSuccessMsg('Curso guardado correctamente.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingCurso(false); }
  };

  const handleDeleteCurso = async (c: Curso) => {
    if (!confirm(`Eliminar el curso "${c.nombre}" y todo su contenido?`)) return;
    try {
      const { error: err } = await supabase.from('moodle_cursos').delete().eq('id', c.id);
      if (err) throw err;
      if (selectedCurso?.id === c.id) { setSelectedCurso(null); setContenidos([]); setAsignacionesCurso([]); }
      await loadCursos();
      setSuccessMsg('Curso eliminado.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const openNewContenido = () => {
    if (!selectedCurso) return;
    setContenidoForm({ titulo: '', tipo: 'texto', contenido_texto: '', url_externa: '' });
    setUploadFile(null);
    setShowContenidoModal(true);
    setError('');
  };

  const handleSaveContenido = async () => {
    if (!selectedCurso) return;
    if (!contenidoForm.titulo.trim()) { setError('El titulo del contenido es obligatorio.'); return; }
    const externalUrl = contenidoForm.tipo === 'enlace' ? normalizeExternalUrl(contenidoForm.url_externa) : null;
    if (contenidoForm.tipo === 'enlace' && !externalUrl) { setError('Escribe una URL válida, por ejemplo https://www.youtube.com/...'); return; }
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
      const payload = {
        curso_id: selectedCurso.id,
        titulo: contenidoForm.titulo.trim(),
        tipo: contenidoForm.tipo,
        contenido_texto: contenidoForm.tipo === 'texto' ? contenidoForm.contenido_texto.trim() : null,
        wasabi_key: wasabiKey,
        url_externa: externalUrl,
        nombre_archivo: nombreArchivo,
        tamano_bytes: tamanoBytes,
        orden: contenidos.length,
      };
      const { error: err } = await supabase.from('moodle_contenido').insert(payload);
      if (err) throw err;
      setShowContenidoModal(false);
      await loadContenidos(selectedCurso.id);
      setSuccessMsg('Contenido anadido.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al guardar'); }
    finally { setSavingContenido(false); setUploading(false); }
  };

  const handleDeleteContenido = async (c: Contenido) => {
    if (!confirm('Eliminar este contenido?')) return;
    try {
      const { error: err } = await supabase.from('moodle_contenido').delete().eq('id', c.id);
      if (err) throw err;
      if (selectedCurso) await loadContenidos(selectedCurso.id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const handleDownloadContenido = async (c: Contenido) => {
    if (!c.wasabi_key) return;
    try {
      await downloadFromWasabi(c.wasabi_key, c.nombre_archivo ?? 'archivo');
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al descargar'); }
  };

  const openAssignModal = () => {
    if (!selectedCurso) return;
    setShowAssignModal(true);
    setSelectedEmpleados(new Set());
    setSearchEmpleado('');
    loadEmpleados();
  };

  const toggleEmpleado = (id: string) => {
    setSelectedEmpleados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleAssignCurso = async () => {
    if (!selectedCurso || selectedEmpleados.size === 0) { setError('Selecciona al menos un empleado.'); return; }
    setError('');
    try {
      const rows = Array.from(selectedEmpleados).map((empId) => ({ curso_id: selectedCurso.id, empleado_id: empId }));
      const { error: err } = await supabase.from('moodle_asignaciones').insert(rows);
      if (err) {
        if (err.code === '23505') setError('Uno o mas empleados ya tienen este curso asignado.');
        else throw err;
      }
      setShowAssignModal(false);
      await loadAsignacionesCurso(selectedCurso.id);
      setSuccessMsg('Curso asignado.');
      setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al asignar'); }
  };

  const handleDeleteAsignacionCurso = async (a: AsignacionCurso) => {
    try {
      const { error: err } = await supabase.from('moodle_asignaciones').delete().eq('id', a.id);
      if (err) throw err;
      if (selectedCurso) await loadAsignacionesCurso(selectedCurso.id);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const filteredEmpleados = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(searchEmpleado.toLowerCase()) ||
    (e.dni ?? '').toLowerCase().includes(searchEmpleado.toLowerCase())
  );

  const filteredCursos = cursos.filter((c) =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.categoria ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-5">
      {/* Header banner */}
      <div className="rounded-2xl p-5 sm:p-6 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 12px 30px rgba(13,148,136,0.2)' }}>
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <div className="absolute -right-4 -bottom-12 w-24 h-24 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <BookOpen size={28} style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.72)' }}>Plataforma de cursos</p>
              <h3 className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>Moodle</h3>
              <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.82)' }}>Crea cursos y sube contenido formativo.</p>
            </div>
          </div>
          <button
            onClick={openNewCurso}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-200"
            style={{ backgroundColor: '#FFFFFF', color: '#0D9488', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          >
            <Plus size={14} />
            Nuevo Curso
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar curso..."
          className="w-full pl-9 pr-4 py-2 rounded-lg text-xs outline-none"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A' }}
        />
      </div>

      {loadingCursos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={24} className="animate-spin" style={{ color: '#0D9488' }} />
        </div>
      ) : filteredCursos.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#F0FDFA' }}>
            <BookOpen size={32} style={{ color: '#0D9488' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#0F172A' }}>No hay cursos creados todavia</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea tu primer curso con el boton "Nuevo Curso".</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCursos.map((curso) => (
            <div key={curso.id} className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div
                className="p-5 cursor-pointer"
                onClick={() => handleSelectCurso(curso)}
                style={{ background: selectedCurso?.id === curso.id ? 'linear-gradient(135deg, #F0FDFA, #ECFDF5)' : '#FFFFFF' }}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
                    <BookOpen size={20} style={{ color: '#FFFFFF' }} />
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={(e) => { e.stopPropagation(); openEditCurso(curso); }} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                      <Save size={12} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCurso(curso); }} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
                <h4 className="text-sm font-bold leading-tight" style={{ color: '#0F172A' }}>{curso.nombre}</h4>
                {curso.descripcion && <p className="text-xs mt-1.5 line-clamp-2" style={{ color: '#94A3B8' }}>{curso.descripcion}</p>}
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  {curso.categoria && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: '#0D9488', backgroundColor: '#F0FDFA', border: '1px solid #99F6E4' }}>{curso.categoria}</span>
                  )}
                  {curso.duracion_estimada && (
                    <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: '#94A3B8' }}>
                      <Clock size={9} /> {curso.duracion_estimada}
                    </span>
                  )}
                  {!curso.activo && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md" style={{ color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>Inactivo</span>
                  )}
                </div>
              </div>

              {selectedCurso?.id === curso.id && (
                <div className="border-t" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold" style={{ color: '#0F172A' }}>Contenido del curso</h5>
                      <button onClick={openNewContenido} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>
                        <Plus size={10} /> Anadir
                      </button>
                    </div>

                    {loadingContenidos ? (
                      <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: '#0D9488' }} /></div>
                    ) : contenidos.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>Sin contenido. Anade texto, PDFs, videos o enlaces.</p>
                    ) : (
                      <div className="space-y-2">
                        {contenidos.map((c) => {
                          const cfg = tipoConfig[c.tipo] ?? tipoConfig.texto;
                          const Icon = cfg.icon;
                          return (
                            <div key={c.id} className="rounded-lg p-3 flex items-center gap-3 transition-all hover:shadow-sm" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                                <Icon size={14} style={{ color: cfg.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{c.titulo}</p>
                                <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                                  {cfg.label}{c.nombre_archivo ? ` - ${c.nombre_archivo}` : ''}{c.tamano_bytes ? ` (${formatSize(c.tamano_bytes)})` : ''}
                                </p>
                              </div>
                              {c.wasabi_key && (
                                <button onClick={() => handleDownloadContenido(c)} className="text-[10px] font-medium px-2 py-1 rounded cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Descargar</button>
                              )}
                              {c.url_externa && (
                                <a href={normalizeExternalUrl(c.url_externa) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-[10px] font-medium px-2 py-1 rounded" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Abrir</a>
                              )}
                              <button onClick={() => handleDeleteContenido(c)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                                <Trash2 size={10} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="p-4 border-t" style={{ borderColor: '#E2E8F0' }}>
                    <div className="flex items-center justify-between mb-3">
                      <h5 className="text-xs font-bold" style={{ color: '#0F172A' }}>Empleados asignados ({asignacionesCurso.length})</h5>
                      <button onClick={openAssignModal} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>
                        <Users size={10} /> Asignar
                      </button>
                    </div>

                    {loadingAsignaciones ? (
                      <div className="flex justify-center py-4"><Loader2 size={18} className="animate-spin" style={{ color: '#0D9488' }} /></div>
                    ) : asignacionesCurso.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: '#94A3B8' }}>Sin asignaciones.</p>
                    ) : (
                      <div className="space-y-2">
                        {asignacionesCurso.map((a) => (
                          <div key={a.id} className="rounded-lg p-2.5 flex items-center gap-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{a.nombre_empleado}</p>
                              <p className="text-[10px]" style={{ color: '#94A3B8' }}>{a.dni ?? 'Sin DNI'}</p>
                            </div>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded" style={{ color: a.estado === 'completado' ? '#16A34A' : a.estado === 'en_curso' ? '#0D9488' : '#64748B', backgroundColor: a.estado === 'completado' ? '#F0FDF4' : a.estado === 'en_curso' ? '#F0FDFA' : '#F8FAFC' }}>
                              {a.estado}
                            </span>
                            <button onClick={() => handleDeleteAsignacionCurso(a)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
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
              <button onClick={() => setShowCursoModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}>
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Nombre *</label>
                <input type="text" value={cursoForm.nombre} onChange={(e) => setCursoForm({ ...cursoForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Descripcion</label>
                <textarea value={cursoForm.descripcion} onChange={(e) => setCursoForm({ ...cursoForm, descripcion: e.target.value })} rows={3}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Categoria</label>
                  <input type="text" value={cursoForm.categoria} onChange={(e) => setCursoForm({ ...cursoForm, categoria: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Duracion estimada</label>
                  <input type="text" value={cursoForm.duracion_estimada} onChange={(e) => setCursoForm({ ...cursoForm, duracion_estimada: e.target.value })} placeholder="ej. 2 horas"
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 sticky bottom-0" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <button onClick={() => setShowCursoModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSaveCurso} disabled={savingCurso} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>
                {savingCurso ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Anadir contenido */}
      {showContenidoModal && selectedCurso && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between sticky top-0" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Anadir contenido a "{selectedCurso.nombre}"</h3>
              <button onClick={() => setShowContenidoModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}>
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Titulo *</label>
                <input type="text" value={contenidoForm.titulo} onChange={(e) => setContenidoForm({ ...contenidoForm, titulo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Tipo de contenido *</label>
                <div className="grid grid-cols-5 gap-2">
                  {Object.entries(tipoConfig).map(([tipo, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button key={tipo} onClick={() => setContenidoForm({ ...contenidoForm, tipo: tipo as Contenido['tipo'] })}
                        className="flex flex-col items-center gap-1 p-2.5 rounded-lg cursor-pointer transition-all"
                        style={{ backgroundColor: contenidoForm.tipo === tipo ? cfg.bg : '#F8FAFC', border: `1.5px solid ${contenidoForm.tipo === tipo ? cfg.color : '#E2E8F0'}` }}>
                        <Icon size={16} style={{ color: cfg.color }} />
                        <span className="text-[9px] font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {contenidoForm.tipo === 'texto' && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Contenido de texto</label>
                  <textarea value={contenidoForm.contenido_texto} onChange={(e) => setContenidoForm({ ...contenidoForm, contenido_texto: e.target.value })} rows={6}
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none resize-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
              )}

              {(contenidoForm.tipo === 'pdf' || contenidoForm.tipo === 'powerpoint' || contenidoForm.tipo === 'video') && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>Archivo ({contenidoForm.tipo}) *</label>
                  <input type="file" onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                    accept={contenidoForm.tipo === 'pdf' ? '.pdf' : contenidoForm.tipo === 'powerpoint' ? '.ppt,.pptx' : contenidoForm.tipo === 'video' ? 'video/*' : '*/*'}
                    className="w-full text-xs" style={{ color: '#0F172A' }} />
                  {uploadFile && <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{uploadFile.name} ({formatSize(uploadFile.size)})</p>}
                </div>
              )}

              {contenidoForm.tipo === 'enlace' && (
                <div>
                  <label className="text-xs font-medium block mb-1" style={{ color: '#0F172A' }}>URL *</label>
                  <input type="text" value={contenidoForm.url_externa} onChange={(e) => setContenidoForm({ ...contenidoForm, url_externa: e.target.value })} placeholder="www.youtube.com o https://..."
                    className="w-full px-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
                </div>
              )}
            </div>
            <div className="px-6 py-4 flex items-center justify-end gap-2 sticky bottom-0" style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <button onClick={() => setShowContenidoModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSaveContenido} disabled={savingContenido || uploading} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>
                {uploading ? <Loader2 size={12} className="animate-spin" /> : savingContenido ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Subiendo...' : 'Anadir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Asignar curso */}
      {showAssignModal && selectedCurso && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="rounded-2xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#0F172A' }}>Asignar "{selectedCurso.nombre}"</h3>
              <button onClick={() => setShowAssignModal(false)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: '#F1F5F9' }}>
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>
            <div className="p-4 border-b" style={{ borderColor: '#E2E8F0' }}>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input type="text" value={searchEmpleado} onChange={(e) => setSearchEmpleado(e.target.value)} placeholder="Buscar empleado..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {filteredEmpleados.map((emp) => {
                const sel = selectedEmpleados.has(emp.id);
                const yaAsignado = asignacionesCurso.some((a) => a.empleado_id === emp.id);
                return (
                  <button key={emp.id} onClick={() => !yaAsignado && toggleEmpleado(emp.id)} disabled={yaAsignado}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-all"
                    style={{ backgroundColor: yaAsignado ? '#F1F5F9' : sel ? '#F0FDFA' : '#F8FAFC', border: `1px solid ${yaAsignado ? '#E2E8F0' : sel ? '#99F6E4' : '#E2E8F0'}`, cursor: yaAsignado ? 'not-allowed' : 'pointer', opacity: yaAsignado ? 0.6 : 1 }}>
                    <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sel ? '#0D9488' : '#FFFFFF', border: `1.5px solid ${sel ? '#0D9488' : '#CBD5E1'}` }}>
                      {sel && <CheckCircle2 size={12} className="text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#0F172A' }}>{emp.nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni ?? 'Sin DNI'}</p>
                    </div>
                    {yaAsignado && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: '#64748B', backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0' }}>Ya asignado</span>}
                  </button>
                );
              })}
            </div>
            <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #E2E8F0' }}>
              <span className="text-xs" style={{ color: '#94A3B8' }}>{selectedEmpleados.size} seleccionado(s)</span>
              <button onClick={handleAssignCurso} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#0D9488', color: '#FFFFFF' }}>
                <Users size={12} /> Asignar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
