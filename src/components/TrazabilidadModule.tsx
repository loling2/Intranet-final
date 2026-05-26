import { useState, useEffect } from 'react';
import {
  ShieldCheck, FileText, Search, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Building2, Users, X,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSociety } from '../context/SocietyContext';

interface PrlDoc {
  id: string;
  nombre_archivo: string;
  tipo: string | null;
  created_at: string;
  folder_id: string;
  folder_nombre: string;
  society_id: string;
  society_nombre: string;
}

interface EmpleadoTrace {
  empleado_id: string;
  nombre: string;
  email: string;
  society_id: string;
  society_nombre: string;
  downloaded: boolean;
  downloaded_at: string | null;
}

export default function TrazabilidadModule() {
  const { activeSocietyId } = useSociety();

  const [docs, setDocs] = useState<PrlDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<PrlDoc | null>(null);
  const [trace, setTrace] = useState<EmpleadoTrace[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [expandedDocSocieties, setExpandedDocSocieties] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDocs();
  }, [activeSocietyId]);

  async function loadDocs() {
    setLoading(true);
    setSelectedDoc(null);
    setTrace([]);
    try {
      // Fetch folders first (filtered by society if needed)
      let foldersQuery = supabase
        .from('prl_folders')
        .select('id, nombre, society_id, sociedades(id, nombre)');
      if (activeSocietyId) {
        foldersQuery = foldersQuery.eq('society_id', activeSocietyId);
      }
      const { data: folders, error: fErr } = await foldersQuery;
      if (fErr) throw fErr;

      if (!folders || folders.length === 0) {
        setDocs([]);
        setLoading(false);
        return;
      }

      const folderIds = folders.map((f: any) => f.id);
      const folderMap = new Map(folders.map((f: any) => [f.id, f]));

      const { data: docsData, error: dErr } = await supabase
        .from('prl_documents')
        .select('id, nombre_archivo, tipo, created_at, folder_id')
        .in('folder_id', folderIds)
        .order('created_at', { ascending: false });
      if (dErr) throw dErr;

      const mapped: PrlDoc[] = (docsData ?? []).map((d: any) => {
        const folder = folderMap.get(d.folder_id) as any;
        return {
          id: d.id,
          nombre_archivo: d.nombre_archivo,
          tipo: d.tipo,
          created_at: d.created_at,
          folder_id: d.folder_id,
          folder_nombre: folder?.nombre ?? '',
          society_id: folder?.society_id ?? '',
          society_nombre: (folder?.sociedades as any)?.nombre ?? '',
        };
      });

      setDocs(mapped);
      // Expand all societies in doc list by default
      setExpandedDocSocieties(new Set(mapped.map((d) => d.society_id)));
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadTrace(doc: PrlDoc) {
    setSelectedDoc(doc);
    setTrace([]);
    setTraceLoading(true);
    try {
      const { data, error } = await supabase.rpc('get_prl_document_trazabilidad', {
        p_document_id: doc.id,
      });
      if (error) throw error;
      setTrace((data ?? []) as EmpleadoTrace[]);
    } catch {
      setTrace([]);
    } finally {
      setTraceLoading(false);
    }
  }

  const filtered = search.trim()
    ? docs.filter(
        (d) =>
          d.nombre_archivo.toLowerCase().includes(search.toLowerCase()) ||
          d.folder_nombre.toLowerCase().includes(search.toLowerCase()) ||
          d.society_nombre.toLowerCase().includes(search.toLowerCase()),
      )
    : docs;

  // Group docs by society for left panel
  const docGroups = (() => {
    const map = new Map<string, { society_id: string; society_nombre: string; docs: PrlDoc[] }>();
    for (const d of filtered) {
      if (!map.has(d.society_id)) {
        map.set(d.society_id, { society_id: d.society_id, society_nombre: d.society_nombre, docs: [] });
      }
      map.get(d.society_id)!.docs.push(d);
    }
    return Array.from(map.values()).sort((a, b) => a.society_nombre.localeCompare(b.society_nombre));
  })();

  const toggleDocSociety = (id: string) => {
    setExpandedDocSocieties((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloaded = trace.filter((r) => r.downloaded);
  const pending = trace.filter((r) => !r.downloaded);

  return (
    <div className="flex gap-0 h-full" style={{ minHeight: 'calc(100vh - 260px)' }}>

      {/* ── Left: document list ─────────────────────────────────── */}
      <div className="flex flex-col gap-3 flex-shrink-0" style={{ width: '320px', paddingRight: '20px', borderRight: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#ECFDF5' }}>
            <FileText size={13} style={{ color: '#065F46' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>Documentos PRL</p>
            <p className="text-xs" style={{ color: '#64748B' }}>Selecciona para ver trazabilidad</p>
          </div>
        </div>

        <div className="relative">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-7 py-2 text-xs rounded-xl outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
              <X size={11} />
            </button>
          )}
        </div>

        <div className="overflow-y-auto space-y-1" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          {loading ? (
            <div className="flex justify-center py-10">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : docGroups.length === 0 ? (
            <p className="text-xs text-center py-8" style={{ color: '#94A3B8' }}>Sin documentos</p>
          ) : (
            docGroups.map((group) => {
              const isOpen = expandedDocSocieties.has(group.society_id);
              return (
                <div key={group.society_id}>
                  {/* Society header in doc list */}
                  <button
                    onClick={() => toggleDocSociety(group.society_id)}
                    className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors mb-0.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <Building2 size={11} style={{ color: '#065F46' }} />
                      <span className="text-xs font-semibold" style={{ color: '#065F46' }}>{group.society_nombre}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                        {group.docs.length}
                      </span>
                    </div>
                    {isOpen ? <ChevronUp size={11} style={{ color: '#94A3B8' }} /> : <ChevronDown size={11} style={{ color: '#94A3B8' }} />}
                  </button>

                  {isOpen && group.docs.map((doc) => {
                    const isSelected = selectedDoc?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        onClick={() => loadTrace(doc)}
                        className="w-full text-left px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-150 cursor-pointer"
                        style={{
                          backgroundColor: isSelected ? '#065F46' : '#FFFFFF',
                          border: `1px solid ${isSelected ? '#065F46' : '#E2E8F0'}`,
                        }}
                      >
                        <div className="flex items-start gap-2">
                          <FileText size={12} className="mt-0.5 flex-shrink-0" style={{ color: isSelected ? '#A7F3D0' : '#DC2626' }} />
                          <div className="min-w-0">
                            <p className="text-xs font-medium leading-tight" style={{ color: isSelected ? '#FFFFFF' : '#1E293B', wordBreak: 'break-word' }}>
                              {doc.nombre_archivo}
                            </p>
                            <p className="text-[10px] mt-0.5 truncate" style={{ color: isSelected ? '#A7F3D0' : '#94A3B8' }}>
                              {doc.folder_nombre}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right: trace split view ─────────────────────────────── */}
      <div className="flex-1 min-w-0 pl-6">
        {!selectedDoc ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFDF5' }}>
              <ShieldCheck size={28} style={{ color: '#6EE7B7' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#475569' }}>Selecciona un documento</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Verás quién lo ha descargado y quién no</p>
          </div>
        ) : (
          <div className="space-y-4 h-full">
            {/* Doc title */}
            <div className="flex items-start gap-3 pb-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <FileText size={17} style={{ color: '#DC2626' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold leading-tight" style={{ color: '#1E293B' }}>{selectedDoc.nombre_archivo}</h3>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  {selectedDoc.folder_nombre} · {selectedDoc.society_nombre} · {new Date(selectedDoc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                </p>
              </div>
              {!traceLoading && trace.length > 0 && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                    <CheckCircle2 size={12} /> {downloaded.length}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg" style={{ backgroundColor: '#FFF7ED', color: '#C2410C', border: '1px solid #FED7AA' }}>
                    <Clock size={12} /> {pending.length}
                  </span>
                </div>
              )}
            </div>

            {traceLoading ? (
              <div className="flex justify-center py-16">
                <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
              </div>
            ) : trace.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Users size={26} className="mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-semibold" style={{ color: '#475569' }}>Sin empleados asignados</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Ningún empleado tiene el tag de acceso de este documento</p>
              </div>
            ) : (
              /* Two-column split */
              <div className="grid grid-cols-2 gap-4" style={{ alignItems: 'start' }}>

                {/* Descargados */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #6EE7B7' }}>
                  <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#ECFDF5', borderBottom: '1px solid #6EE7B7' }}>
                    <CheckCircle2 size={14} style={{ color: '#065F46' }} />
                    <span className="text-sm font-semibold" style={{ color: '#065F46' }}>Descargados</span>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                      {downloaded.length}
                    </span>
                  </div>

                  {downloaded.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center" style={{ backgroundColor: '#FFFFFF' }}>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Ninguno ha descargado aún</p>
                    </div>
                  ) : (
                    <div className="divide-y bg-white" style={{ borderColor: '#ECFDF5' }}>
                      {downloaded.map((emp) => (
                        <div key={emp.empleado_id} className="flex items-center gap-2.5 px-4 py-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                            style={{ backgroundColor: '#065F46' }}>
                            {emp.nombre.trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                            {emp.downloaded_at && (
                              <p className="text-[10px]" style={{ color: '#6EE7B7' }}>
                                {new Date(emp.downloaded_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            )}
                          </div>
                          <CheckCircle2 size={14} style={{ color: '#10B981', flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Pendientes */}
                <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #FED7AA' }}>
                  <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#FFF7ED', borderBottom: '1px solid #FED7AA' }}>
                    <Clock size={14} style={{ color: '#C2410C' }} />
                    <span className="text-sm font-semibold" style={{ color: '#C2410C' }}>Pendientes</span>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FFEDD5', color: '#C2410C' }}>
                      {pending.length}
                    </span>
                  </div>

                  {pending.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-center" style={{ backgroundColor: '#FFFFFF' }}>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Todos han descargado</p>
                    </div>
                  ) : (
                    <div className="divide-y bg-white" style={{ borderColor: '#FFF7ED' }}>
                      {pending.map((emp) => (
                        <div key={emp.empleado_id} className="flex items-center gap-2.5 px-4 py-2.5">
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                            style={{ backgroundColor: '#94A3B8' }}>
                            {emp.nombre.trim().charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                            <p className="text-[10px]" style={{ color: '#94A3B8' }}>{emp.email || '—'}</p>
                          </div>
                          <Clock size={13} style={{ color: '#F97316', flexShrink: 0 }} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
