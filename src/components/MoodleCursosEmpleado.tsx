import { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileText, FileVideo, Presentation, Link as LinkIcon, Type, Layers, Clock, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Download, Lock, Play, AlertCircle, LayoutDashboard, ListChecks, ArrowUpRight } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { downloadFromWasabi, getWasabiBlobUrl } from '../lib/wasabi';
import type { SocietyTheme } from '../themes';
import PptxPreview from './PptxPreview';

interface Curso {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  duracion_estimada: string | null;
  visible_empleado: boolean;
  examen_id: string | null;
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
  tipo: 'texto' | 'pdf' | 'word' | 'powerpoint' | 'video' | 'diapositivas' | 'enlace';
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

interface Asignacion {
  id: string;
  curso_id: string;
  estado: string;
  progreso: number;
  examen_desbloqueado: boolean;
  fecha_asignacion: string;
  fecha_completado: string | null;
}

interface ProgresoItem {
  contenido_id: string;
  iniciado_at: string | null;
  completado_at: string | null;
}

const tipoConfig: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  texto: { label: 'Texto', icon: Type, color: '#2563EB', bg: '#EFF6FF' },
  pdf: { label: 'PDF', icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  word: { label: 'Word', icon: FileText, color: '#2563EB', bg: '#EFF6FF' },
  powerpoint: { label: 'PowerPoint', icon: Presentation, color: '#EA580C', bg: '#FFF7ED' },
  video: { label: 'Video', icon: FileVideo, color: '#7C3AED', bg: '#F5F3FF' },
  diapositivas: { label: 'Diapositivas', icon: Layers, color: '#0D9488', bg: '#F0FDFA' },
  enlace: { label: 'Enlace', icon: LinkIcon, color: '#0D9488', bg: '#F0FDFA' },
};

function normalizeExternalUrl(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try { const url = new URL(candidate); return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}

interface MoodleCursosEmpleadoProps {
  theme: SocietyTheme;
  onOpenExams?: () => void;
}

export default function MoodleCursosEmpleado({ theme, onOpenExams }: MoodleCursosEmpleadoProps) {
  const [cursos, setCursos] = useState<(Curso & { asignacion: Asignacion })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState<(Curso & { asignacion: Asignacion }) | null>(null);
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [contenidos, setContenidos] = useState<Contenido[]>([]);
  const [progreso, setProgreso] = useState<Map<string, ProgresoItem>>(new Map());
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState('');
  const [activeContenido, setActiveContenido] = useState<Contenido | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [slides, setSlides] = useState<string[]>([]);
  const [canComplete, setCanComplete] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [activeModuloId, setActiveModuloId] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const loadCursos = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: emp } = await supabase.from('empleados').select('id').eq('user_id', user.id).maybeSingle();
    if (!emp?.id) { setLoading(false); return; }
    const { data: asignaciones } = await supabase.from('moodle_asignaciones').select('id, curso_id, estado, progreso, examen_desbloqueado, fecha_asignacion, fecha_completado').eq('empleado_id', emp.id).order('fecha_asignacion', { ascending: false });
    if (!asignaciones || asignaciones.length === 0) { setLoading(false); return; }
    const cursoIds = asignaciones.map((a: any) => a.curso_id);
    const { data: cursosData } = await supabase.from('moodle_cursos').select('id, nombre, descripcion, categoria, duracion_estimada, visible_empleado, examen_id, activo').in('id', cursoIds).eq('activo', true).eq('visible_empleado', true);
    const enriched = (cursosData ?? []).map((c: any) => ({ ...c, asignacion: asignaciones.find((a: any) => a.curso_id === c.id) })).filter((c: any) => c.asignacion);
    setCursos(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadCursos(); }, [loadCursos]);

  const loadDetail = useCallback(async (curso: Curso & { asignacion: Asignacion }) => {
    setLoadingDetail(true);
    const { data: mods } = await supabase.from('moodle_modulos').select('*').eq('curso_id', curso.id).order('orden', { ascending: true });
    const modList = mods ?? [];
    setModulos(modList);
    const { data: conts } = await supabase.from('moodle_contenido').select('*').eq('curso_id', curso.id).eq('visible_empleado', true).order('orden', { ascending: true });
    setContenidos(conts ?? []);
    const { data: prog } = await supabase.from('moodle_progreso').select('contenido_id, iniciado_at, completado_at').eq('asignacion_id', curso.asignacion.id);
    const progMap = new Map<string, ProgresoItem>();
    (prog ?? []).forEach((p: any) => progMap.set(p.contenido_id, { contenido_id: p.contenido_id, iniciado_at: p.iniciado_at, completado_at: p.completado_at }));
    setProgreso(progMap);
    if (modList.length > 0) setActiveModuloId(modList[0].id);
    setLoadingDetail(false);
  }, []);

  const handleOpenCurso = (curso: Curso & { asignacion: Asignacion }) => {
    setSelectedCurso(curso);
    setActiveContenido(null);
    loadDetail(curso);
  };

  const handleBack = () => { setSelectedCurso(null); setActiveContenido(null); setModulos([]); setContenidos([]); setProgreso(new Map()); setActiveModuloId(null); };

  const handleSelectModulo = (modulo: Modulo, index: number) => {
    if (!isModuloUnlocked(index)) return;
    setActiveModuloId(modulo.id);
  };

  const isModuloUnlocked = (idx: number): boolean => {
    if (idx === 0) return true;
    const prevMod = modulos[idx - 1];
    const prevObligatorios = contenidos.filter((c) => c.modulo_id === prevMod.id && c.es_obligatorio);
    if (prevObligatorios.length === 0) return true;
    return prevObligatorios.every((c) => progreso.get(c.id)?.completado_at);
  };

  const isContenidoUnlocked = (contenido: Contenido, modulo: Modulo): boolean => {
    if (!isModuloUnlocked(modulos.findIndex((m) => m.id === modulo.id))) return false;
    const modContenidos = contenidos.filter((c) => c.modulo_id === modulo.id && c.es_obligatorio).sort((a, b) => a.orden - b.orden);
    const idx = modContenidos.findIndex((c) => c.id === contenido.id);
    if (idx <= 0) return true;
    return modContenidos.slice(0, idx).every((c) => progreso.get(c.id)?.completado_at);
  };

  useEffect(() => {
    if (!activeContenido || activeContenido.tipo !== 'pdf' || !activeContenido.wasabi_key) {
      setPdfUrl(null);
      setPdfLoading(false);
      return;
    }
    let cancelled = false;
    let loadedUrl: string | null = null;
    setPdfLoading(true);
    getWasabiBlobUrl(activeContenido.wasabi_key)
      .then((url) => {
        loadedUrl = url;
        if (cancelled) URL.revokeObjectURL(url);
        else setPdfUrl(url);
      })
      .catch(() => { if (!cancelled) setError('No se pudo cargar la vista previa del PDF.'); })
      .finally(() => { if (!cancelled) setPdfLoading(false); });
    return () => {
      cancelled = true;
      if (loadedUrl) URL.revokeObjectURL(loadedUrl);
      setPdfUrl(null);
    };
  }, [activeContenido]);

  useEffect(() => {
    if (!activeContenido) return;
    const startedAt = progreso.get(activeContenido.id)?.iniciado_at;
    if (!startedAt || activeContenido.duracion_minutos <= 0) {
      setRemainingSeconds(0);
      setCanComplete(true);
      return;
    }

    const updateRemaining = () => {
      const elapsedSeconds = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      const remaining = Math.max(0, activeContenido.duracion_minutos * 60 - elapsedSeconds);
      setRemainingSeconds(remaining);
      setCanComplete(remaining === 0);
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(interval);
  }, [activeContenido, progreso]);

  const handleOpenContenido = async (contenido: Contenido) => {
    setActiveContenido(contenido);
    setCanComplete(false);
    setError('');
    if (contenido.tipo === 'diapositivas' && contenido.contenido_texto) {
      const parts = contenido.contenido_texto.split('---').map((s) => s.trim()).filter(Boolean);
      setSlides(parts.length > 0 ? parts : [contenido.contenido_texto]);
      setSlideIndex(0);
    } else {
      setSlides([]);
    }

    if (progreso.get(contenido.id)?.iniciado_at) return;
    const { data: startedProgress, error: startError } = await supabase.rpc('moodle_marcar_inicio', { p_contenido_id: contenido.id });
    if (startError || !startedProgress) {
      setError('No se pudo iniciar este recurso.');
      setActiveContenido(null);
      return;
    }
    setProgreso((prev) => {
      const next = new Map(prev);
      next.set(contenido.id, {
        contenido_id: contenido.id,
        iniciado_at: startedProgress.iniciado_at,
        completado_at: startedProgress.completado_at,
      });
      return next;
    });
  };

  const handleComplete = async () => {
    if (!activeContenido || !selectedCurso) return;
    setCompleting(true);
    const { data: percentage, error: err } = await supabase.rpc('moodle_marcar_completado', { p_contenido_id: activeContenido.id });
    setCompleting(false);
    if (err) {
      setError(err.message.includes('tiempo mínimo') ? 'Aún no ha pasado el tiempo mínimo requerido.' : err.message.includes('anterior') ? 'Debes completar primero el contenido anterior.' : 'Error al completar.');
      return;
    }
    setProgreso((prev) => { const next = new Map(prev); next.set(activeContenido.id, { contenido_id: activeContenido.id, iniciado_at: next.get(activeContenido.id)?.iniciado_at ?? new Date().toISOString(), completado_at: new Date().toISOString() }); return next; });
    if (selectedCurso) {
      setCursos((prev) => prev.map((c) => c.id === selectedCurso.id ? { ...c, asignacion: { ...c.asignacion, progreso: percentage ?? 0, estado: (percentage ?? 0) >= 100 ? 'completado' : 'en_curso', examen_desbloqueado: (percentage ?? 0) >= 100 } } : c));
      setSelectedCurso((prev) => prev ? { ...prev, asignacion: { ...prev.asignacion, progreso: percentage ?? 0, estado: (percentage ?? 0) >= 100 ? 'completado' : 'en_curso', examen_desbloqueado: (percentage ?? 0) >= 100 } } : prev);
    }
    setActiveContenido(null);
    setError('');
  };

  const handleDownload = async (c: Contenido) => {
    if (!c.wasabi_key || !c.descargable) return;
    try { await downloadFromWasabi(c.wasabi_key, c.nombre_archivo ?? 'archivo'); } catch { setError('No se pudo descargar.'); }
  };

  const formatSize = (bytes: number | null): string => { if (!bytes) return '-'; if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; };
  const formatRemaining = (seconds: number): string => `${Math.floor(seconds / 60)} min ${seconds % 60}s`;

  if (loading) return <div className="flex flex-col items-center justify-center py-12"><Loader2 size={28} className="animate-spin" style={{ color: theme.primary }} /><p className="text-sm mt-3" style={{ color: theme.textSecondary }}>Cargando cursos...</p></div>;

  // Contenido viewer
  if (activeContenido) {
    const cfg = tipoConfig[activeContenido.tipo] ?? tipoConfig.texto;
    const Icon = cfg.icon;
    const prog = progreso.get(activeContenido.id);
    const isDone = !!prog?.completado_at;
    return (
      <div className="space-y-4">
        <button onClick={() => setActiveContenido(null)} className="flex items-center gap-1.5 text-sm font-medium cursor-pointer" style={{ color: theme.primary }}><ChevronLeft size={16} /> Volver al curso</button>
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom: `1px solid ${theme.border}`, background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}><Icon size={20} style={{ color: '#FFFFFF' }} /></div>
            <div className="flex-1 min-w-0"><h3 className="text-sm font-bold" style={{ color: '#FFFFFF' }}>{activeContenido.titulo}</h3><p className="text-xs" style={{ color: 'rgba(255,255,255,0.72)' }}>{cfg.label}{activeContenido.duracion_minutos > 0 ? ` - Minimo ${activeContenido.duracion_minutos} min` : ''}</p></div>
            {isDone && <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}><CheckCircle2 size={14} style={{ color: '#FFFFFF' }} /><span className="text-xs font-medium" style={{ color: '#FFFFFF' }}>Completado</span></div>}
          </div>
          <div className="p-6">
            {activeContenido.duracion_minutos > 0 && !isDone && (
              <div className="mb-5 rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: canComplete ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${canComplete ? '#BBF7D0' : '#FDE68A'}` }}>
                <Clock size={17} style={{ color: canComplete ? '#16A34A' : '#D97706' }} />
                <div><p className="text-xs font-semibold" style={{ color: canComplete ? '#15803D' : '#92400E' }}>{canComplete ? 'Tiempo mínimo completado' : 'Tiempo mínimo de visualización'}</p><p className="text-[11px] mt-0.5" style={{ color: canComplete ? '#16A34A' : '#A16207' }}>{canComplete ? 'Ya puedes marcar este recurso como completado.' : `Debes permanecer ${formatRemaining(remainingSeconds)} antes de continuar.`}</p></div>
              </div>
            )}
            {activeContenido.tipo === 'texto' && activeContenido.contenido_texto && (
              <div className="rounded-xl p-5 text-sm whitespace-pre-wrap leading-relaxed" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}>{activeContenido.contenido_texto}</div>
            )}
            {activeContenido.tipo === 'diapositivas' && slides.length > 0 && (
              <div>
                <div className="rounded-xl p-6 min-h-[200px] flex items-center justify-center text-center" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
                  <p className="text-sm leading-relaxed" style={{ color: theme.textPrimary }}>{slides[slideIndex]}</p>
                </div>
                <div className="flex items-center justify-between mt-4">
                  <button onClick={() => setSlideIndex((i) => Math.max(0, i - 1))} disabled={slideIndex === 0} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40" style={{ backgroundColor: theme.primaryLight, color: theme.primary, border: `1px solid ${theme.border}` }}><ChevronLeft size={14} /> Anterior</button>
                  <span className="text-xs" style={{ color: theme.textSecondary }}>{slideIndex + 1} / {slides.length}</span>
                  {slideIndex < slides.length - 1 ? (
                    <button onClick={() => setSlideIndex((i) => i + 1)} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}>Siguiente <ChevronRight size={14} /></button>
                  ) : (
                    <button onClick={handleComplete} disabled={!canComplete || completing || isDone} className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50" style={{ backgroundColor: canComplete ? '#16A34A' : '#94A3B8', color: '#FFFFFF' }}>{completing ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} {isDone ? 'Completado' : canComplete ? 'Finalizar' : 'Espera...'}</button>
                  )}
                </div>
              </div>
            )}
            {activeContenido.tipo === 'enlace' && activeContenido.url_externa && (
              <a href={normalizeExternalUrl(activeContenido.url_externa) ?? '#'} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}><LinkIcon size={16} /> Abrir enlace externo</a>
            )}
            {activeContenido.tipo === 'pdf' && activeContenido.wasabi_key && (
              <div className="space-y-3">
                {pdfLoading && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin" style={{ color: theme.primary }} /></div>}
                {pdfUrl && <iframe title={activeContenido.nombre_archivo ?? activeContenido.titulo} src={pdfUrl} className="w-full h-[min(72vh,720px)] rounded-xl" style={{ border: `1px solid ${theme.border}` }} />}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{activeContenido.nombre_archivo ?? activeContenido.titulo} · {formatSize(activeContenido.tamano_bytes)}</p>
                  {activeContenido.descargable && <button onClick={() => handleDownload(activeContenido)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}><Download size={16} /> Descargar</button>}
                </div>
              </div>
            )}
            {activeContenido.tipo === 'powerpoint' && activeContenido.wasabi_key && (
              <div className="space-y-3">
                <PptxPreview wasabiKey={activeContenido.wasabi_key} filename={activeContenido.nombre_archivo} allowDownload={activeContenido.descargable} />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-xs" style={{ color: theme.textSecondary }}>{activeContenido.nombre_archivo ?? activeContenido.titulo} · {formatSize(activeContenido.tamano_bytes)}</p>
                  {activeContenido.descargable && <button onClick={() => handleDownload(activeContenido)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}><Download size={16} /> Descargar</button>}
                </div>
              </div>
            )}
            {(activeContenido.tipo === 'word' || activeContenido.tipo === 'video') && activeContenido.wasabi_key && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: cfg.bg }}><Icon size={32} style={{ color: cfg.color }} /></div>
                <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>{activeContenido.nombre_archivo ?? activeContenido.titulo}</p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>{formatSize(activeContenido.tamano_bytes)}</p>
                {activeContenido.descargable ? <button onClick={() => handleDownload(activeContenido)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}><Download size={16} /> Descargar</button> : <p className="text-xs" style={{ color: theme.textSecondary }}>Este recurso no es descargable.</p>}
              </div>
            )}
            {activeContenido.tipo !== 'diapositivas' && (
              <div className="mt-6 flex justify-end">
                <button onClick={handleComplete} disabled={!canComplete || completing || isDone} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50" style={{ backgroundColor: canComplete ? '#16A34A' : '#94A3B8', color: '#FFFFFF' }}>
                  {completing ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} {isDone ? 'Completado' : canComplete ? 'Marcar como completado' : activeContenido.duracion_minutos > 0 ? 'Espera el tiempo minimo' : 'Marcar como completado'}
                </button>
              </div>
            )}
            {error && <div className="mt-4 rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}><AlertCircle size={14} style={{ color: '#DC2626' }} /><p className="text-xs" style={{ color: '#DC2626' }}>{error}</p></div>}
          </div>
        </div>
      </div>
    );
  }

  // Course detail
  if (selectedCurso) {
    const progresoPct = selectedCurso.asignacion.progreso;
    const examenDesbloqueado = selectedCurso.asignacion.examen_desbloqueado;
    return (
      <div className="space-y-5">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm font-medium cursor-pointer" style={{ color: theme.primary }}><ChevronLeft size={16} /> Volver a cursos</button>

        <div className="rounded-2xl p-5 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`, boxShadow: `0 12px 30px ${theme.primary}20` }}>
          <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
          <div className="relative flex flex-col sm:flex-row items-start gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}><BookOpen size={28} style={{ color: '#FFFFFF' }} /></div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold" style={{ color: '#FFFFFF' }}>{selectedCurso.nombre}</h3>
              {selectedCurso.descripcion && <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.82)' }}>{selectedCurso.descripcion}</p>}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {selectedCurso.categoria && <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: '#FFFFFF', backgroundColor: 'rgba(255,255,255,0.2)' }}>{selectedCurso.categoria}</span>}
                {selectedCurso.duracion_estimada && <span className="flex items-center gap-1 text-xs" style={{ color: 'rgba(255,255,255,0.82)' }}><Clock size={12} /> {selectedCurso.duracion_estimada}</span>}
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.82)' }}>Progreso del curso</span>
                  <span className="text-sm font-bold" style={{ color: '#FFFFFF' }}>{progresoPct}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progresoPct}%`, backgroundColor: '#FFFFFF' }} />
                </div>
              </div>
            </div>
            {selectedCurso.examen_id && examenDesbloqueado && onOpenExams && <button onClick={onOpenExams} className="relative flex items-center gap-2 mt-4 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}><ListChecks size={16} /> Realizar examen <ArrowUpRight size={14} /></button>}
          </div>
        </div>

        {loadingDetail ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: theme.primary }} /></div> : (
          <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)] items-start">
            <aside className="rounded-2xl p-3 lg:sticky lg:top-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <div className="px-2 pb-3 border-b" style={{ borderColor: theme.border }}><p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: theme.textSecondary }}>Contenido del curso</p><p className="text-xs mt-1" style={{ color: theme.textPrimary }}>{modulos.length} módulos · {contenidos.length} recursos</p></div>
              <button onClick={() => setActiveModuloId(null)} className="w-full flex items-center gap-2 px-3 py-2.5 mt-2 rounded-xl text-left cursor-pointer" style={{ backgroundColor: activeModuloId === null ? `${theme.primary}12` : 'transparent', color: activeModuloId === null ? theme.primary : theme.textSecondary }}><LayoutDashboard size={14} /><span className="text-xs font-semibold">Inicio del curso</span></button>
              <nav className="mt-1 space-y-1">
                {modulos.map((m, mi) => { const unlocked = isModuloUnlocked(mi); const required = contenidos.filter((c) => c.modulo_id === m.id && c.es_obligatorio); const done = required.filter((c) => progreso.get(c.id)?.completado_at).length; return <button key={m.id} onClick={() => handleSelectModulo(m, mi)} disabled={!unlocked} className="w-full flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer disabled:cursor-not-allowed" style={{ backgroundColor: activeModuloId === m.id ? `${theme.primary}12` : 'transparent', color: unlocked ? (activeModuloId === m.id ? theme.primary : theme.textPrimary) : '#94A3B8', opacity: unlocked ? 1 : 0.6 }}>{unlocked ? <Layers size={14} className="mt-0.5 flex-shrink-0" /> : <Lock size={14} className="mt-0.5 flex-shrink-0" />}<span className="min-w-0"><span className="block text-xs font-semibold truncate">{mi + 1}. {m.titulo}</span><span className="block text-[10px] mt-0.5" style={{ color: theme.textSecondary }}>{done}/{required.length} completados</span></span></button>; })}
              </nav>
              {selectedCurso.examen_id && <button onClick={onOpenExams} disabled={!onOpenExams} className="w-full flex items-center gap-2 px-3 py-2.5 mt-2 rounded-xl text-left cursor-pointer disabled:cursor-default" style={{ backgroundColor: examenDesbloqueado ? '#F0FDF4' : '#F8FAFC', color: examenDesbloqueado ? '#15803D' : theme.textSecondary, border: `1px solid ${examenDesbloqueado ? '#BBF7D0' : theme.border}` }}><ListChecks size={14} /><span className="flex-1 text-xs font-semibold">Mini-test</span>{examenDesbloqueado && <ArrowUpRight size={13} />}</button>}
            </aside>

            <section className="min-w-0">
              {activeModuloId === null ? <div className="rounded-2xl p-6" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}><div className="flex items-start gap-3"><div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.primary}12` }}><BookOpen size={22} style={{ color: theme.primary }} /></div><div><p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: theme.primary }}>Bienvenido al curso</p><h3 className="text-xl font-bold mt-1" style={{ color: theme.textPrimary }}>{selectedCurso.nombre}</h3><p className="text-sm mt-2 leading-relaxed" style={{ color: theme.textSecondary }}>{selectedCurso.descripcion ?? 'Explora los módulos del curso desde el menú lateral.'}</p></div></div><div className="grid gap-3 sm:grid-cols-3 mt-6"><div className="rounded-xl p-3" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}><p className="text-lg font-bold" style={{ color: theme.primary }}>{progresoPct}%</p><p className="text-xs" style={{ color: theme.textSecondary }}>Progreso</p></div><div className="rounded-xl p-3" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}><p className="text-lg font-bold" style={{ color: theme.textPrimary }}>{modulos.length}</p><p className="text-xs" style={{ color: theme.textSecondary }}>Módulos</p></div><div className="rounded-xl p-3" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}><p className="text-lg font-bold" style={{ color: theme.textPrimary }}>{contenidos.length}</p><p className="text-xs" style={{ color: theme.textSecondary }}>Recursos</p></div></div><p className="text-xs mt-6" style={{ color: theme.textSecondary }}>Selecciona un módulo para comenzar.</p></div> : (() => { const activeModulo = modulos.find((m) => m.id === activeModuloId); const activeIndex = modulos.findIndex((m) => m.id === activeModuloId); if (!activeModulo) return null; const moduleContents = contenidos.filter((c) => c.modulo_id === activeModulo.id); return <div className="space-y-4"><div className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`, boxShadow: `0 10px 25px ${theme.primary}18` }}><p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: 'rgba(255,255,255,0.72)' }}>Módulo {activeIndex + 1}</p><h3 className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>{activeModulo.titulo}</h3>{activeModulo.descripcion && <p className="text-sm mt-2" style={{ color: 'rgba(255,255,255,0.82)' }}>{activeModulo.descripcion}</p>}</div><div className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}><div className="flex items-center justify-between mb-4"><div><h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>Recursos del módulo</h4><p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Abre cada recurso para avanzar en tu formación.</p></div><span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ color: theme.primary, backgroundColor: `${theme.primary}12` }}>{moduleContents.length} recursos</span></div>{moduleContents.length === 0 ? <p className="text-sm text-center py-8" style={{ color: theme.textSecondary }}>Este módulo todavía no tiene contenido.</p> : <div className="space-y-2">{moduleContents.map((c) => { const cfg = tipoConfig[c.tipo] ?? tipoConfig.texto; const Icon = cfg.icon; const cUnlocked = isContenidoUnlocked(c, activeModulo); const cDone = !!progreso.get(c.id)?.completado_at; return <button key={c.id} onClick={() => cUnlocked && handleOpenContenido(c)} disabled={!cUnlocked} className="w-full rounded-xl p-3 flex items-center gap-3 text-left transition-all cursor-pointer disabled:cursor-not-allowed" style={{ backgroundColor: cDone ? '#F0FDF4' : theme.bg, border: `1px solid ${cDone ? '#BBF7D0' : theme.border}`, opacity: cUnlocked ? 1 : 0.5 }}><div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cDone ? '#DCFCE7' : cfg.bg }}>{cDone ? <CheckCircle2 size={17} style={{ color: '#16A34A' }} /> : cUnlocked ? <Icon size={17} style={{ color: cfg.color }} /> : <Lock size={17} style={{ color: '#94A3B8' }} />}</div><span className="flex-1 min-w-0"><span className="block text-sm font-semibold truncate" style={{ color: theme.textPrimary }}>{c.titulo}</span><span className="block text-xs mt-0.5" style={{ color: theme.textSecondary }}>{cfg.label}{c.duracion_minutos > 0 ? ` · ${c.duracion_minutos} min` : ''}{c.es_obligatorio ? ' · Obligatorio' : ''}</span></span>{cUnlocked && <ChevronRight size={16} style={{ color: theme.primary }} />}</button>; })}</div>}</div><div className="flex items-center justify-between gap-3"><button onClick={() => { const prev = modulos[activeIndex - 1]; if (prev) handleSelectModulo(prev, activeIndex - 1); }} disabled={activeIndex <= 0} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40" style={{ color: theme.textSecondary, border: `1px solid ${theme.border}`, backgroundColor: theme.bgCard }}><ChevronLeft size={14} /> Anterior</button><button onClick={() => { const next = modulos[activeIndex + 1]; if (next) handleSelectModulo(next, activeIndex + 1); }} disabled={activeIndex >= modulos.length - 1 || !isModuloUnlocked(activeIndex + 1)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-40" style={{ backgroundColor: theme.primary }}>Siguiente <ChevronRight size={14} /></button></div></div>; })()}
              {selectedCurso.examen_id && <div className="rounded-2xl p-4 sm:p-5 mt-4" style={{ backgroundColor: examenDesbloqueado ? '#F0FDF4' : theme.bgCard, border: `1px solid ${examenDesbloqueado ? '#BBF7D0' : theme.border}` }}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: examenDesbloqueado ? '#DCFCE7' : '#F1F5F9' }}>{examenDesbloqueado ? <ListChecks size={20} style={{ color: '#16A34A' }} /> : <Lock size={20} style={{ color: '#94A3B8' }} />}</div><div className="flex-1"><h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>Mini-test del curso</h4><p className="text-xs mt-1" style={{ color: theme.textSecondary }}>{examenDesbloqueado ? 'Ya puedes comprobar lo aprendido con el examen asociado.' : `Completa el 100% del contenido para desbloquearlo. (${progresoPct}%)`}</p></div>{examenDesbloqueado && onOpenExams && <button onClick={onOpenExams} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer" style={{ backgroundColor: '#16A34A' }}>Realizar <ArrowUpRight size={13} /></button>}</div></div>}
            </section>
          </div>
        )}
      </div>
    );
  }

  // Course list
  if (cursos.length === 0) return (
    <div className="rounded-2xl p-8 text-center" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
      <BookOpen size={32} style={{ color: theme.textSecondary }} />
      <p className="text-sm font-medium mt-3" style={{ color: theme.textPrimary }}>No tienes cursos asignados</p>
      <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Cuando se te asigne un curso, aparecera aqui.</p>
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 sm:p-6 overflow-hidden relative" style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`, boxShadow: `0 12px 30px ${theme.primary}20` }}>
        <div className="absolute -right-8 -top-10 w-36 h-36 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }} />
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.25)' }}><BookOpen size={28} style={{ color: '#FFFFFF' }} /></div>
          <div><p className="text-xs font-medium uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.72)' }}>Formacion online</p><h3 className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>Moodle</h3><p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.82)' }}>Accede a tus cursos y materiales de aprendizaje.</p></div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {cursos.map((curso) => {
          const estado = curso.asignacion.estado;
          const pct = curso.asignacion.progreso;
          const cfg = estado === 'completado' ? { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Completado', icon: CheckCircle2 } : estado === 'en_curso' ? { color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', label: 'En curso', icon: Play } : { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', label: 'Pendiente', icon: Clock };
          const EstadoIcon = cfg.icon;
          return (
            <div key={curso.id} onClick={() => handleOpenCurso(curso)} className="rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-lg" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cfg.color}15` }}><BookOpen size={20} style={{ color: cfg.color }} /></div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold leading-tight" style={{ color: theme.textPrimary }}>{curso.nombre}</h4>
                  {curso.descripcion && <p className="text-xs mt-1 line-clamp-2" style={{ color: theme.textSecondary }}>{curso.descripcion}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {curso.categoria && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}>{curso.categoria}</span>}
                    {curso.duracion_estimada && <span className="flex items-center gap-1 text-[10px]" style={{ color: theme.textSecondary }}><Clock size={9} /> {curso.duracion_estimada}</span>}
                  </div>
                  {pct > 0 && (
                    <div className="mt-2">
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: `${cfg.color}20` }}><div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color }} /></div>
                      <p className="text-[9px] mt-0.5" style={{ color: cfg.color }}>{pct}% completado</p>
                    </div>
                  )}
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded flex-shrink-0" style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.border}` }}><EstadoIcon size={10} /> {cfg.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
