import { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileText, FileVideo, Presentation, Link as LinkIcon, Type, Layers, Clock, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Download, Lock, Play, Award, AlertCircle, FileQuestion, ChevronDown, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { downloadFromWasabi } from '../lib/wasabi';
import { generateCertificatePDF } from '../lib/certificate';
import type { SocietyTheme } from '../themes';

interface Curso {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  duracion_estimada: string | null;
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
  powerpoint: { label: 'PowerPoint', icon: Presentation, color: '#EA580C', bg: '#FFF7ED' },
  video: { label: 'Video', icon: FileVideo, color: '#7C3AED', bg: '#F5F3FF' },
  diapositivas: { label: 'Diapositivas', icon: Layers, color: '#0D9488', bg: '#F0FDFA' },
  enlace: { label: 'Enlace', icon: LinkIcon, color: '#0D9488', bg: '#F0FDFA' },
};

function normalizeExternalUrl(value: string): string | null {
  const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
  try { const url = new URL(candidate); return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null; } catch { return null; }
}

export default function MoodleCursosEmpleado({ theme }: { theme: SocietyTheme }) {
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
  const [completing, setCompleting] = useState(false);
  const [expandedModulos, setExpandedModulos] = useState<Set<string>>(new Set());
  const [empleadoNombre, setEmpleadoNombre] = useState('');
  const [empleadoDni, setEmpleadoDni] = useState<string | null>(null);

  const loadCursos = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: emp } = await supabase.from('empleados').select('id, nombre, dni').eq('user_id', user.id).maybeSingle();
    if (!emp?.id) { setLoading(false); return; }
    setEmpleadoNombre(emp.nombre);
    setEmpleadoDni(emp.dni ?? null);
    const { data: asignaciones } = await supabase.from('moodle_asignaciones').select('id, curso_id, estado, progreso, examen_desbloqueado, fecha_asignacion, fecha_completado').eq('empleado_id', emp.id).order('fecha_asignacion', { ascending: false });
    if (!asignaciones || asignaciones.length === 0) { setLoading(false); return; }
    const cursoIds = asignaciones.map((a: any) => a.curso_id);
    const { data: cursosData } = await supabase.from('moodle_cursos').select('id, nombre, descripcion, categoria, duracion_estimada, examen_id, activo').in('id', cursoIds).eq('activo', true);
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
    if (modList.length > 0) setExpandedModulos(new Set([modList[0].id]));
    setLoadingDetail(false);
  }, []);

  const handleOpenCurso = (curso: Curso & { asignacion: Asignacion }) => {
    setSelectedCurso(curso);
    setActiveContenido(null);
    loadDetail(curso);
  };

  const handleBack = () => { setSelectedCurso(null); setActiveContenido(null); setModulos([]); setContenidos([]); setProgreso(new Map()); };

  const isModuloUnlocked = (modulo: Modulo, idx: number): boolean => {
    if (idx === 0) return true;
    const prevMod = modulos[idx - 1];
    const prevObligatorios = contenidos.filter((c) => c.modulo_id === prevMod.id && c.es_obligatorio);
    if (prevObligatorios.length === 0) return true;
    return prevObligatorios.every((c) => progreso.get(c.id)?.completado_at);
  };

  const isContenidoUnlocked = (contenido: Contenido, modulo: Modulo): boolean => {
    if (!isModuloUnlocked(modulo, modulos.findIndex((m) => m.id === modulo.id))) return false;
    const modContenidos = contenidos.filter((c) => c.modulo_id === modulo.id && c.es_obligatorio).sort((a, b) => a.orden - b.orden);
    const idx = modContenidos.findIndex((c) => c.id === contenido.id);
    if (idx <= 0) return true;
    return modContenidos.slice(0, idx).every((c) => progreso.get(c.id)?.completado_at);
  };

  const handleOpenContenido = async (contenido: Contenido) => {
    setActiveContenido(contenido);
    setCanComplete(false);
    if (contenido.tipo === 'diapositivas' && contenido.contenido_texto) {
      const parts = contenido.contenido_texto.split('---').map((s) => s.trim()).filter(Boolean);
      setSlides(parts.length > 0 ? parts : [contenido.contenido_texto]);
      setSlideIndex(0);
    } else {
      setSlides([]);
    }
    if (!progreso.get(contenido.id)?.iniciado_at) {
      await supabase.rpc('moodle_marcar_inicio', { p_contenido_id: contenido.id });
    }
    if (contenido.duracion_minutos > 0) {
      const started = progreso.get(contenido.id)?.iniciado_at;
      if (started) {
        const elapsed = (Date.now() - new Date(started).getTime()) / 1000 / 60;
        setCanComplete(elapsed >= contenido.duracion_minutos);
      }
      const interval = setInterval(() => {
        const start = progreso.get(contenido.id)?.iniciado_at ?? new Date().toISOString();
        const elapsed = (Date.now() - new Date(start).getTime()) / 1000 / 60;
        setCanComplete(elapsed >= contenido.duracion_minutos);
      }, 5000);
      return () => clearInterval(interval);
    } else {
      setCanComplete(true);
    }
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

  const handleGenerateCertificate = async () => {
    if (!selectedCurso) return;
    const { data: mods } = await supabase.from('moodle_modulos').select('titulo, descripcion').eq('curso_id', selectedCurso.id).order('orden', { ascending: true });
    generateCertificatePDF({
      nombreEmpleado: empleadoNombre,
      dniEmpleado: empleadoDni,
      nombreCurso: selectedCurso.nombre,
      fechaAprobacion: selectedCurso.asignacion.fecha_completado ?? new Date().toISOString(),
      puntuacion: selectedCurso.asignacion.progreso,
      modulos: (mods ?? []).map((m: any) => ({ titulo: m.titulo, descripcion: m.descripcion })),
      nombreEmpresa: 'Grupo Empresarial',
    });
  };

  const toggleExpand = (id: string) => { setExpandedModulos((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; }); };

  const formatSize = (bytes: number | null): string => { if (!bytes) return '-'; if (bytes < 1024) return `${bytes} B`; if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1048576).toFixed(1)} MB`; };

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
            {(activeContenido.tipo === 'pdf' || activeContenido.tipo === 'powerpoint' || activeContenido.tipo === 'video') && activeContenido.wasabi_key && (
              <div className="flex flex-col items-center gap-3 py-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: cfg.bg }}><Icon size={32} style={{ color: cfg.color }} /></div>
                <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>{activeContenido.nombre_archivo ?? activeContenido.titulo}</p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>{formatSize(activeContenido.tamano_bytes)}</p>
                {activeContenido.descargable ? (
                  <button onClick={() => handleDownload(activeContenido)} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}><Download size={16} /> Descargar</button>
                ) : (
                  <p className="text-xs" style={{ color: theme.textSecondary }}>Este recurso no es descargable. Consulta con tu responsable.</p>
                )}
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
          <div className="relative flex items-start gap-4">
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
          </div>
        </div>

        {loadingDetail ? <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin" style={{ color: theme.primary }} /></div> : (
          <div className="space-y-3">
            {modulos.map((m, mi) => {
              const unlocked = isModuloUnlocked(m, mi);
              const expanded = expandedModulos.has(m.id);
              const modContenidos = contenidos.filter((c) => c.modulo_id === m.id);
              const modDone = modContenidos.filter((c) => c.es_obligatorio && progreso.get(c.id)?.completado_at).length;
              const modTotal = modContenidos.filter((c) => c.es_obligatorio).length;
              return (
                <div key={m.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, opacity: unlocked ? 1 : 0.6 }}>
                  <div className="p-4 flex items-center gap-3 cursor-pointer" onClick={() => unlocked && toggleExpand(m.id)}>
                    {unlocked ? (expanded ? <ChevronDown size={16} style={{ color: theme.textSecondary }} /> : <ChevronRightIcon size={16} style={{ color: theme.textSecondary }} />) : <Lock size={16} style={{ color: '#94A3B8' }} />}
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: unlocked ? `${theme.primary}12` : '#F1F5F9' }}><Layers size={18} style={{ color: unlocked ? theme.primary : '#94A3B8' }} /></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Modulo {mi + 1}: {m.titulo}</h4>
                      <p className="text-xs" style={{ color: theme.textSecondary }}>{unlocked ? `${modDone}/${modTotal} completados` : 'Bloqueado - completa el modulo anterior'}</p>
                    </div>
                    {modTotal > 0 && modDone === modTotal && <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: '#F0FDF4' }}><CheckCircle2 size={12} style={{ color: '#16A34A' }} /><span className="text-[10px] font-semibold" style={{ color: '#16A34A' }}>Completo</span></div>}
                  </div>
                  {expanded && unlocked && (
                    <div className="px-4 pb-4 space-y-2">
                      {modContenidos.length === 0 ? <p className="text-xs text-center py-3" style={{ color: theme.textSecondary }}>Sin contenido en este modulo.</p> : modContenidos.map((c) => {
                        const cfg = tipoConfig[c.tipo] ?? tipoConfig.texto;
                        const Icon = cfg.icon;
                        const cUnlocked = isContenidoUnlocked(c, m);
                        const cDone = !!progreso.get(c.id)?.completado_at;
                        return (
                          <div key={c.id} onClick={() => cUnlocked && handleOpenContenido(c)} className="rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all" style={{ backgroundColor: cDone ? '#F0FDF4' : cUnlocked ? theme.bg : '#F8FAFC', border: `1px solid ${cDone ? '#BBF7D0' : cUnlocked ? theme.border : '#E2E8F0'}`, opacity: cUnlocked ? 1 : 0.5 }}>
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>{cDone ? <CheckCircle2 size={16} style={{ color: '#16A34A' }} /> : cUnlocked ? <Icon size={16} style={{ color: cfg.color }} /> : <Lock size={16} style={{ color: '#94A3B8' }} />}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium truncate" style={{ color: theme.textPrimary }}>{c.titulo}</p>
                              <p className="text-[10px]" style={{ color: theme.textSecondary }}>{cfg.label}{c.duracion_minutos > 0 ? ` - ${c.duracion_minutos}min` : ''}{!c.descargable && c.wasabi_key ? ' - No descargable' : ''}</p>
                            </div>
                            {cUnlocked && !cDone && <Play size={14} style={{ color: theme.primary }} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Examen */}
            {selectedCurso.examen_id && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: examenDesbloqueado ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${examenDesbloqueado ? '#BBF7D0' : '#E2E8F0'}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: examenDesbloqueado ? '#DCFCE7' : '#F1F5F9' }}>{examenDesbloqueado ? <FileQuestion size={24} style={{ color: '#16A34A' }} /> : <Lock size={24} style={{ color: '#94A3B8' }} />}</div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>Examen del curso</h4>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>{examenDesbloqueado ? 'El examen esta disponible. Ve a la pestana "Mis Examenes" para realizarlo.' : `Completa el 100% del curso para desbloquear el examen. (${progresoPct}%)`}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Certificate */}
            {selectedCurso.asignacion.estado === 'completado' && progresoPct >= 100 && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}><Award size={24} style={{ color: '#D97706' }} /></div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold" style={{ color: theme.textPrimary }}>Certificado disponible</h4>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>Has completado el curso. Descarga tu diploma.</p>
                  </div>
                  <button onClick={handleGenerateCertificate} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer" style={{ backgroundColor: '#D97706', color: '#FFFFFF' }}><Download size={14} /> Descargar diploma</button>
                </div>
              </div>
            )}
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
