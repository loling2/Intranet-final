import { useState, useEffect } from 'react';
import {
  ShieldCheck, FileText, Search, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, Clock, Building2, Users, X, Download,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useSociety } from '../context/SocietyContext';

interface PrlFolder {
  id: string;
  nombre: string;
  society_id: string;
  society_nombre?: string;
  access_tag_id: string | null;
  access_tag_nombre?: string;
}

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
  const [expandedSocieties, setExpandedSocieties] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadDocs();
  }, [activeSocietyId]);

  async function loadDocs() {
    setLoading(true);
    setSelectedDoc(null);
    setTrace([]);
    try {
      let q = supabase
        .from('prl_documents')
        .select(`
          id, nombre_archivo, tipo, created_at, folder_id,
          prl_folders!inner(id, nombre, society_id, sociedades!inner(id, nombre))
        `)
        .order('created_at', { ascending: false });

      if (activeSocietyId) {
        q = q.eq('prl_folders.society_id', activeSocietyId);
      }

      const { data, error } = await q;
      if (error) throw error;

      const mapped: PrlDoc[] = (data ?? []).map((d: any) => ({
        id: d.id,
        nombre_archivo: d.nombre_archivo,
        tipo: d.tipo,
        created_at: d.created_at,
        folder_id: d.folder_id,
        folder_nombre: d.prl_folders?.nombre ?? '',
        society_id: d.prl_folders?.sociedades?.id ?? '',
        society_nombre: d.prl_folders?.sociedades?.nombre ?? '',
      }));

      setDocs(mapped);
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
    setExpandedSocieties(new Set());
    try {
      const { data, error } = await supabase.rpc('get_prl_document_trazabilidad', {
        p_document_id: doc.id,
      });
      if (error) throw error;
      const rows = (data ?? []) as EmpleadoTrace[];
      setTrace(rows);
      setExpandedSocieties(new Set(rows.map((r) => r.society_id)));
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

  // Group docs by society
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

  // Group trace by society
  const traceGroups = (() => {
    const map = new Map<string, { society_id: string; society_nombre: string; rows: EmpleadoTrace[] }>();
    for (const r of trace) {
      if (!map.has(r.society_id)) {
        map.set(r.society_id, { society_id: r.society_id, society_nombre: r.society_nombre, rows: [] });
      }
      map.get(r.society_id)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) => a.society_nombre.localeCompare(b.society_nombre));
  })();

  const toggleSociety = (id: string) => {
    setExpandedSocieties((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const downloadedCount = trace.filter((r) => r.downloaded).length;
  const pendingCount = trace.length - downloadedCount;

  return (
    <div className="flex gap-6 h-full" style={{ minHeight: 'calc(100vh - 260px)' }}>
      {/* Left: document list */}
      <div className="w-96 flex-shrink-0 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
            <FileText size={15} style={{ color: '#065F46' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: '#1E293B' }}>Documentos PRL</h3>
            <p className="text-xs" style={{ color: '#64748B' }}>Selecciona un documento para ver trazabilidad</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-xs rounded-xl outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Doc list */}
        <div className="flex-1 overflow-y-auto space-y-2" style={{ maxHeight: 'calc(100vh - 380px)' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : docGroups.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs" style={{ color: '#94A3B8' }}>Sin documentos</p>
            </div>
          ) : (
            docGroups.map((group) => (
              <div key={group.society_id}>
                <div className="flex items-center gap-1.5 px-2 py-1.5 mb-1">
                  <Building2 size={11} style={{ color: '#065F46' }} />
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#065F46' }}>{group.society_nombre}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>{group.docs.length}</span>
                </div>
                {group.docs.map((doc) => {
                  const isSelected = selectedDoc?.id === doc.id;
                  return (
                    <button
                      key={doc.id}
                      onClick={() => loadTrace(doc)}
                      className="w-full text-left px-3 py-2.5 rounded-xl mb-1 transition-all duration-150 cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? '#065F46' : '#FFFFFF',
                        border: `1px solid ${isSelected ? '#065F46' : '#E2E8F0'}`,
                        boxShadow: isSelected ? '0 2px 8px rgba(6,95,70,0.2)' : 'none',
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <FileText size={13} className="mt-0.5 flex-shrink-0" style={{ color: isSelected ? '#A7F3D0' : '#DC2626' }} />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate" style={{ color: isSelected ? '#FFFFFF' : '#1E293B' }}>
                            {doc.nombre_archivo}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: isSelected ? '#A7F3D0' : '#94A3B8' }}>
                            {doc.folder_nombre}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="w-px flex-shrink-0" style={{ backgroundColor: '#E2E8F0' }} />

      {/* Right: trace view */}
      <div className="flex-1 min-w-0">
        {!selectedDoc ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFDF5' }}>
              <ShieldCheck size={28} style={{ color: '#6EE7B7' }} />
            </div>
            <p className="text-sm font-semibold" style={{ color: '#475569' }}>Selecciona un documento</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Verás quién lo ha descargado y quién no</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Doc header */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <FileText size={18} style={{ color: '#DC2626' }} />
                </div>
                <div>
                  <h3 className="text-base font-bold" style={{ color: '#1E293B' }}>{selectedDoc.nombre_archivo}</h3>
                  <p className="text-xs" style={{ color: '#64748B' }}>
                    {selectedDoc.folder_nombre} · {selectedDoc.society_nombre} · {new Date(selectedDoc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {!traceLoading && trace.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}>
                    <CheckCircle2 size={13} style={{ color: '#065F46' }} />
                    <span className="text-xs font-semibold" style={{ color: '#065F46' }}>{downloadedCount} descargado{downloadedCount !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                    <Clock size={13} style={{ color: '#C2410C' }} />
                    <span className="text-xs font-semibold" style={{ color: '#C2410C' }}>{pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
              )}
            </div>

            {traceLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw size={18} className="animate-spin" style={{ color: '#94A3B8' }} />
              </div>
            ) : trace.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <Users size={28} className="mb-3" style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-semibold" style={{ color: '#475569' }}>Sin empleados asignados</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Ningún empleado tiene el tag de acceso de este documento</p>
              </div>
            ) : (
              <div className="space-y-3">
                {traceGroups.map((group) => {
                  const isOpen = expandedSocieties.has(group.society_id);
                  const gDownloaded = group.rows.filter((r) => r.downloaded).length;
                  return (
                    <div key={group.society_id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <button
                        onClick={() => toggleSociety(group.society_id)}
                        className="w-full flex items-center justify-between px-5 py-3 cursor-pointer hover:opacity-90 transition-opacity"
                        style={{ backgroundColor: '#F8FAFC', borderBottom: isOpen ? '1px solid #E2E8F0' : 'none' }}
                      >
                        <div className="flex items-center gap-2.5">
                          <Building2 size={14} style={{ color: '#475569' }} />
                          <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>{group.society_nombre}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#E2E8F0', color: '#475569' }}>
                            {group.rows.length} empleado{group.rows.length !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium" style={{ color: '#065F46' }}>{gDownloaded}/{group.rows.length}</span>
                          {isOpen ? <ChevronUp size={14} style={{ color: '#94A3B8' }} /> : <ChevronDown size={14} style={{ color: '#94A3B8' }} />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                          {group.rows.map((emp) => (
                            <div key={emp.empleado_id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors">
                              {/* Avatar */}
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                                style={{ backgroundColor: emp.downloaded ? '#065F46' : '#94A3B8' }}>
                                {emp.nombre.trim().charAt(0).toUpperCase()}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                                <p className="text-xs truncate" style={{ color: '#94A3B8' }}>{emp.email || '—'}</p>
                              </div>

                              {emp.downloaded ? (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}>
                                  <CheckCircle2 size={13} style={{ color: '#065F46' }} />
                                  <div className="text-right">
                                    <p className="text-xs font-semibold leading-tight" style={{ color: '#065F46' }}>Descargado</p>
                                    {emp.downloaded_at && (
                                      <p className="text-[10px] leading-tight" style={{ color: '#6EE7B7' }}>
                                        {new Date(emp.downloaded_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                  <Clock size={13} style={{ color: '#C2410C' }} />
                                  <p className="text-xs font-semibold" style={{ color: '#C2410C' }}>Pendiente</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
