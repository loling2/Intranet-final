import { useState, useEffect, useCallback } from 'react';
import { BookOpen, FileText, FileVideo, Presentation, Link as LinkIcon, Type, Clock, CheckCircle2, Loader2, ChevronLeft, Download, Play } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { downloadFromWasabi } from '../lib/wasabi';
import type { SocietyTheme } from '../themes';

interface Curso {
  id: string;
  nombre: string;
  descripcion: string | null;
  categoria: string | null;
  duracion_estimada: string | null;
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
}

interface Asignacion {
  id: string;
  curso_id: string;
  estado: string;
  progreso: number;
  fecha_asignacion: string;
}

const tipoConfig: Record<string, { label: string; icon: typeof FileText; color: string; bg: string }> = {
  texto: { label: 'Texto', icon: Type, color: '#2563EB', bg: '#EFF6FF' },
  pdf: { label: 'PDF', icon: FileText, color: '#DC2626', bg: '#FEF2F2' },
  powerpoint: { label: 'PowerPoint', icon: Presentation, color: '#EA580C', bg: '#FFF7ED' },
  video: { label: 'Video', icon: FileVideo, color: '#7C3AED', bg: '#F5F3FF' },
  enlace: { label: 'Enlace', icon: LinkIcon, color: '#0D9488', bg: '#F0FDFA' },
};

export default function MoodleCursosEmpleado({ theme }: { theme: SocietyTheme }) {
  const [cursos, setCursos] = useState<(Curso & { asignacion: Asignacion })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCurso, setSelectedCurso] = useState<(Curso & { asignacion: Asignacion }) | null>(null);
  const [contenidos, setContenidos] = useState<Contenido[]>([]);
  const [loadingContenidos, setLoadingContenidos] = useState(false);
  const [error, setError] = useState('');

  const loadCursos = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: emp } = await supabase.from('empleados').select('id').eq('user_id', user.id).maybeSingle();
    if (!emp?.id) { setLoading(false); return; }
    const { data: asignaciones, error: err } = await supabase
      .from('moodle_asignaciones')
      .select('id, curso_id, estado, progreso, fecha_asignacion')
      .eq('empleado_id', emp.id)
      .order('fecha_asignacion', { ascending: false });
    if (err || !asignaciones || asignaciones.length === 0) { setLoading(false); return; }
    const cursoIds = asignaciones.map((a: any) => a.curso_id);
    const { data: cursosData } = await supabase
      .from('moodle_cursos')
      .select('id, nombre, descripcion, categoria, duracion_estimada, activo')
      .in('id', cursoIds)
      .eq('activo', true);
    const enriched = (cursosData ?? []).map((c: any) => {
      const asig = asignaciones.find((a: any) => a.curso_id === c.id);
      return { ...c, asignacion: asig };
    }).filter((c: any) => c.asignacion);
    setCursos(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadCursos(); }, [loadCursos]);

  const loadContenidos = useCallback(async (cursoId: string) => {
    setLoadingContenidos(true);
    const { data, error: err } = await supabase
      .from('moodle_contenido')
      .select('*')
      .eq('curso_id', cursoId)
      .order('orden', { ascending: true });
    if (err) setError('No se pudo cargar el contenido.');
    else setContenidos(data ?? []);
    setLoadingContenidos(false);
  }, []);

  const handleOpenCurso = (curso: Curso & { asignacion: Asignacion }) => {
    setSelectedCurso(curso);
    loadContenidos(curso.id);
  };

  const handleBack = () => {
    setSelectedCurso(null);
    setContenidos([]);
  };

  const handleDownload = async (c: Contenido) => {
    if (!c.wasabi_key) return;
    try { await downloadFromWasabi(c.wasabi_key, c.nombre_archivo ?? 'archivo'); }
    catch (e: unknown) { setError('No se pudo descargar el archivo.'); }
  };

  const formatSize = (bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 size={28} className="animate-spin" style={{ color: theme.primary }} />
        <p className="text-sm mt-3" style={{ color: theme.textSecondary }}>Cargando cursos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
      </div>
    );
  }

  // Course detail view
  if (selectedCurso) {
    return (
      <div className="space-y-4">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm font-medium cursor-pointer" style={{ color: theme.primary }}>
          <ChevronLeft size={16} /> Volver a cursos
        </button>

        <div className="rounded-xl p-5" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${theme.primary}12` }}>
              <BookOpen size={24} style={{ color: theme.primary }} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>{selectedCurso.nombre}</h3>
              {selectedCurso.descripcion && <p className="text-sm mt-1" style={{ color: theme.textSecondary }}>{selectedCurso.descripcion}</p>}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                {selectedCurso.categoria && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ color: theme.primary, backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>{selectedCurso.categoria}</span>
                )}
                {selectedCurso.duracion_estimada && (
                  <span className="flex items-center gap-1 text-xs" style={{ color: theme.textSecondary }}>
                    <Clock size={12} /> {selectedCurso.duracion_estimada}
                  </span>
                )}
                <span className="text-xs font-medium px-2 py-0.5 rounded" style={{
                  color: selectedCurso.asignacion.estado === 'completado' ? '#16A34A' : selectedCurso.asignacion.estado === 'en_curso' ? '#0D9488' : '#64748B',
                  backgroundColor: selectedCurso.asignacion.estado === 'completado' ? '#F0FDF4' : selectedCurso.asignacion.estado === 'en_curso' ? '#F0FDFA' : '#F8FAFC',
                }}>
                  {selectedCurso.asignacion.estado === 'completado' ? 'Completado' : selectedCurso.asignacion.estado === 'en_curso' ? 'En curso' : 'Pendiente'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-3" style={{ color: theme.textPrimary }}>Contenido del curso</h4>
          {loadingContenidos ? (
            <div className="flex justify-center py-8"><Loader2 size={22} className="animate-spin" style={{ color: theme.primary }} /></div>
          ) : contenidos.length === 0 ? (
            <div className="rounded-xl p-8 text-center" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
              <p className="text-sm" style={{ color: theme.textSecondary }}>Este curso no tiene contenido todavia.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contenidos.map((c) => {
                const cfg = tipoConfig[c.tipo] ?? tipoConfig.texto;
                const Icon = cfg.icon;
                return (
                  <div key={c.id} className="rounded-xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg }}>
                        <Icon size={18} style={{ color: cfg.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="text-sm font-medium" style={{ color: theme.textPrimary }}>{c.titulo}</h5>
                        <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                          {cfg.label}{c.nombre_archivo ? ` - ${c.nombre_archivo}` : ''}{c.tamano_bytes ? ` (${formatSize(c.tamano_bytes)})` : ''}
                        </p>
                        {c.tipo === 'texto' && c.contenido_texto && (
                          <div className="mt-3 rounded-lg p-3 text-sm whitespace-pre-wrap" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}>
                            {c.contenido_texto}
                          </div>
                        )}
                        {c.tipo === 'enlace' && c.url_externa && (
                          <a href={c.url_externa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}>
                            <LinkIcon size={12} /> Abrir enlace
                          </a>
                        )}
                        {c.wasabi_key && (
                          <button onClick={() => handleDownload(c)} className="inline-flex items-center gap-1.5 mt-3 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: theme.primaryLight, color: theme.primary, border: `1px solid ${theme.border}` }}>
                            <Download size={12} /> Descargar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Course list
  if (cursos.length === 0) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <BookOpen size={32} style={{ color: theme.textSecondary }} />
        <p className="text-sm font-medium mt-3" style={{ color: theme.textPrimary }}>No tienes cursos asignados</p>
        <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Cuando se te asigne un curso, aparecera aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.primary}12` }}>
          <BookOpen size={20} style={{ color: theme.primary }} />
        </div>
        <div>
          <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Mis Cursos</h3>
          <p className="text-xs" style={{ color: theme.textSecondary }}>{cursos.length} curso(s) asignado(s)</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {cursos.map((curso) => {
          const estado = curso.asignacion.estado;
          const cfg = estado === 'completado'
            ? { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', label: 'Completado', icon: CheckCircle2 }
            : estado === 'en_curso'
            ? { color: '#0D9488', bg: '#F0FDFA', border: '#99F6E4', label: 'En curso', icon: Play }
            : { color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0', label: 'Pendiente', icon: Clock };
          const EstadoIcon = cfg.icon;
          return (
            <div
              key={curso.id}
              onClick={() => handleOpenCurso(curso)}
              className="rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md"
              style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${cfg.color}15` }}>
                  <BookOpen size={18} style={{ color: cfg.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold leading-tight" style={{ color: theme.textPrimary }}>{curso.nombre}</h4>
                  {curso.descripcion && <p className="text-xs mt-0.5 line-clamp-2" style={{ color: theme.textSecondary }}>{curso.descripcion}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {curso.categoria && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: cfg.color, backgroundColor: `${cfg.color}15` }}>{curso.categoria}</span>
                    )}
                    {curso.duracion_estimada && (
                      <span className="flex items-center gap-1 text-[10px]" style={{ color: theme.textSecondary }}>
                        <Clock size={9} /> {curso.duracion_estimada}
                      </span>
                    )}
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded flex-shrink-0" style={{ color: cfg.color, backgroundColor: `${cfg.color}15`, border: `1px solid ${cfg.border}` }}>
                  <EstadoIcon size={10} /> {cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
