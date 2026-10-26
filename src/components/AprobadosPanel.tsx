import { useCallback, useEffect, useMemo, useState } from 'react';
import { Award, CheckCircle2, Download, Eye, Loader2, Search, Users, XCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { getSocietyLogo } from '../lib/societyLogos';
import { generateCertificatePDF } from '../lib/certificate';

interface Curso {
  id: string;
  nombre: string;
  duracion_estimada: string | null;
  certificado_contenidos: string | null;
}

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  id_sociedad: string | null;
}

interface Asignacion {
  id: string;
  empleado_id: string;
  estado: string;
  progreso: number;
  fecha_asignacion: string;
  fecha_completado: string | null;
}

interface Fila extends Asignacion {
  empleado: Empleado | null;
}

interface Sociedad {
  id: string;
  nombre: string;
}

async function imageToDataUrl(source: string | null): Promise<string | null> {
  if (!source) return null;
  if (source.startsWith('data:image/')) return source;
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function createVerificationCode(assignmentId: string, courseId: string, employeeId: string): string {
  const input = `${assignmentId}:${courseId}:${employeeId}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `CSV-${(hash >>> 0).toString(36).toUpperCase().padStart(26, '0').slice(0, 26)}`;
}

export default function AprobadosPanel(): JSX.Element {
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [selectedCurso, setSelectedCurso] = useState<Curso | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const loadCursos = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [{ data: courseData, error: courseError }, { data: societyData }] = await Promise.all([
      supabase.from('moodle_cursos').select('id, nombre, duracion_estimada, certificado_contenidos').order('nombre'),
      supabase.from('sociedades').select('id, nombre').order('nombre'),
    ]);
    if (courseError) setError(courseError.message);
    setCursos(courseData ?? []);
    setSociedades(societyData ?? []);
    setLoading(false);
  }, []);

  const loadAssignments = useCallback(async (courseId: string): Promise<void> => {
    setLoadingRows(true);
    setError('');
    const { data: assignmentData, error: assignmentError } = await supabase
      .from('moodle_asignaciones')
      .select('id, empleado_id, estado, progreso, fecha_asignacion, fecha_completado')
      .eq('curso_id', courseId)
      .order('estado', { ascending: true });
    if (assignmentError) {
      setError(assignmentError.message);
      setFilas([]);
      setLoadingRows(false);
      return;
    }
    const employeeIds = (assignmentData ?? []).map((assignment) => assignment.empleado_id);
    const { data: employeeData, error: employeeError } = employeeIds.length > 0
      ? await supabase.from('empleados').select('id, nombre, dni, id_sociedad').in('id', employeeIds)
      : { data: [], error: null };
    if (employeeError) setError(employeeError.message);
    const employeeMap = new Map<string, Empleado>((employeeData ?? []).map((employee) => [employee.id, employee]));
    setFilas((assignmentData ?? []).map((assignment) => ({ ...assignment, empleado: employeeMap.get(assignment.empleado_id) ?? null })));
    setLoadingRows(false);
  }, []);

  useEffect(() => { void loadCursos(); }, [loadCursos]);

  const filteredRows = useMemo(() => filas.filter((row) => {
    const value = `${row.empleado?.nombre ?? ''} ${row.empleado?.dni ?? ''}`.toLowerCase();
    return value.includes(search.toLowerCase());
  }), [filas, search]);

  const selectCourse = (course: Curso): void => {
    setSelectedCurso(course);
    void loadAssignments(course.id);
  };

  const handleDownload = async (row: Fila): Promise<void> => {
    if (!selectedCurso || !row.empleado || row.estado !== 'completado') return;
    setDownloadingId(row.id);
    setError('');
    const society = sociedades.find((item) => item.id === row.empleado?.id_sociedad);
    const logoSource = row.empleado.id_sociedad ? await getSocietyLogo(row.empleado.id_sociedad) : null;
    const logoDataUrl = await imageToDataUrl(logoSource);
    const customTopics = (selectedCurso.certificado_contenidos ?? '').split(/\r?\n/).map((topic) => topic.trim()).filter(Boolean);
    let topics = customTopics;
    if (topics.length === 0) {
      const { data: modules, error: moduleError } = await supabase.from('moodle_modulos').select('titulo').eq('curso_id', selectedCurso.id).order('orden');
      if (moduleError) {
        setError(moduleError.message);
        setDownloadingId(null);
        return;
      }
      topics = (modules ?? []).map((module) => module.titulo).filter(Boolean);
    }
    generateCertificatePDF({
      nombreEmpleado: row.empleado.nombre,
      dniEmpleado: row.empleado.dni,
      nombreCurso: selectedCurso.nombre,
      duracionCurso: selectedCurso.duracion_estimada,
      fechaAprobacion: row.fecha_completado ?? new Date().toISOString(),
      puntuacion: 100,
      temas: topics,
      nombreEmpresa: society?.nombre ?? 'Empresa',
      logoDataUrl,
      codigoVerificacion: createVerificationCode(row.id, selectedCurso.id, row.empleado.id),
    });
    setDownloadingId(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#0D9488' }} /></div>;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5 sm:p-6" style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)', boxShadow: '0 12px 30px rgba(13,148,136,0.2)' }}>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}><Award size={28} style={{ color: '#FFFFFF' }} /></div>
          <div><p className="text-xs uppercase tracking-[0.18em]" style={{ color: 'rgba(255,255,255,0.72)' }}>Seguimiento</p><h3 className="text-xl font-bold mt-1" style={{ color: '#FFFFFF' }}>Aprobados</h3><p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.82)' }}>Consulta el resultado por curso y descarga los certificados.</p></div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        <section className="rounded-2xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2 mb-3"><BookIcon /><h4 className="text-sm font-bold" style={{ color: '#0F172A' }}>Cursos disponibles</h4></div>
          <div className="space-y-2 max-h-[520px] overflow-y-auto">
            {cursos.map((course) => <button key={course.id} onClick={() => selectCourse(course)} className="w-full text-left rounded-xl p-3 cursor-pointer transition-all" style={{ backgroundColor: selectedCurso?.id === course.id ? '#F0FDFA' : '#F8FAFC', border: `1px solid ${selectedCurso?.id === course.id ? '#99F6E4' : '#E2E8F0'}` }}><p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{course.nombre}</p><p className="text-[10px] mt-1" style={{ color: '#64748B' }}>{course.duracion_estimada ?? 'Duración no indicada'}</p></button>)}
            {cursos.length === 0 && <p className="text-xs py-4 text-center" style={{ color: '#94A3B8' }}>No hay cursos creados.</p>}
          </div>
        </section>

        <section className="rounded-2xl p-4 sm:p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {!selectedCurso ? <div className="py-16 text-center"><Users size={30} className="mx-auto" style={{ color: '#94A3B8' }} /><p className="text-sm font-medium mt-3" style={{ color: '#0F172A' }}>Selecciona un curso</p><p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Aquí verás quién lo ha superado y quién lo tiene pendiente.</p></div> : <>
            <div className="flex items-center justify-between gap-3 flex-wrap mb-4"><div><h4 className="text-base font-bold" style={{ color: '#0F172A' }}>{selectedCurso.nombre}</h4><p className="text-xs mt-1" style={{ color: '#64748B' }}>{filas.filter((row) => row.estado === 'completado').length} superado(s) de {filas.length} asignado(s)</p></div><div className="relative w-full sm:w-56"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Filtrar empleado..." className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none" style={{ border: '1px solid #E2E8F0', color: '#0F172A' }} /></div></div>
            {error && <p className="mb-3 rounded-lg px-3 py-2 text-xs" style={{ color: '#B91C1C', backgroundColor: '#FEF2F2' }}>{error}</p>}
            {loadingRows ? <div className="flex justify-center py-10"><Loader2 size={22} className="animate-spin" style={{ color: '#0D9488' }} /></div> : <div className="space-y-2">{filteredRows.map((row) => { const passed = row.estado === 'completado'; return <div key={row.id} className="rounded-xl p-3 flex items-center gap-3 flex-wrap" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: passed ? '#DCFCE7' : '#F1F5F9' }}>{passed ? <CheckCircle2 size={18} style={{ color: '#16A34A' }} /> : <XCircle size={18} style={{ color: '#64748B' }} />}</div><div className="flex-1 min-w-[150px]"><p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{row.empleado?.nombre ?? 'Empleado no disponible'}</p><p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>{row.empleado?.dni ?? 'Sin DNI'} · Progreso {row.progreso}%</p></div><span className="text-[10px] font-semibold px-2 py-1 rounded-lg" style={{ color: passed ? '#15803D' : '#64748B', backgroundColor: passed ? '#F0FDF4' : '#F1F5F9' }}>{passed ? 'Superado' : 'Pendiente'}</span>{passed && <button onClick={() => void handleDownload(row)} disabled={downloadingId === row.id} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-semibold cursor-pointer disabled:opacity-50" style={{ color: '#FFFFFF', backgroundColor: '#0D9488' }}>{downloadingId === row.id ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />} Descargar certificado</button>}</div>; })}{filteredRows.length === 0 && <p className="text-xs text-center py-8" style={{ color: '#94A3B8' }}>No hay empleados que coincidan con el filtro.</p>}</div>}
          </>}
        </section>
      </div>
    </div>
  );
}

function BookIcon(): JSX.Element {
  return <Eye size={16} style={{ color: '#0D9488' }} />;
}
