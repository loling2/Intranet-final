import { useState, useEffect } from 'react';
import { ShieldCheck, FileText, Download, Tag, RefreshCw, Folder, X, ZoomIn, ChevronDown, ChevronUp, Building2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import { downloadFromWasabi, getWasabiBlobUrl } from './lib/wasabi';
import type { SocietyTheme } from './themes';

interface PrevDoc {
  id: string;
  nombre_archivo: string;
  tipo: string | null;
  created_at: string;
  wasabi_key: string | null;
  folder_id: string;
  folder_nombre: string;
  society_id: string;
  society_nombre: string;
}

interface GroupedDocs {
  society_id: string;
  society_nombre: string;
  docs: PrevDoc[];
}

interface Props {
  theme: SocietyTheme;
  userEmail?: string;
}

// ── Preview Modal ─────────────────────────────────────────────────────────────

function PreviewModal({ doc, onClose, getUrl }: {
  doc: PrevDoc;
  onClose: () => void;
  getUrl: (key: string) => Promise<string>;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isImage = doc.tipo?.startsWith('image/') ?? /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.nombre_archivo);
  const isPdf = doc.tipo === 'application/pdf' || /\.pdf$/i.test(doc.nombre_archivo);

  useEffect(() => {
    if (!doc.wasabi_key) { setError('Sin archivo adjunto'); setLoading(false); return; }
    let blobUrl: string | null = null;
    getUrl(doc.wasabi_key)
      .then((u) => { blobUrl = u; setUrl(u); setLoading(false); })
      .catch((e: unknown) => { setError(`Error: ${e instanceof Error ? e.message : String(e)}`); setLoading(false); });
    return () => { if (blobUrl) URL.revokeObjectURL(blobUrl); };
  }, [doc.wasabi_key, getUrl]);

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxWidth: '90vw', maxHeight: '90vh', width: isPdf ? '800px' : 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={15} style={{ color: '#64748B', flexShrink: 0 }} />
            <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-3 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 cursor-pointer hover:bg-slate-100 transition-colors"
            style={{ color: '#64748B' }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-2" style={{ minHeight: '200px' }}>
          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <RefreshCw size={22} className="animate-spin" style={{ color: '#94A3B8' }} />
              <p className="text-xs" style={{ color: '#94A3B8' }}>Cargando...</p>
            </div>
          )}
          {error && !loading && (
            <p className="text-sm text-center px-8 py-12" style={{ color: '#DC2626' }}>{error}</p>
          )}
          {url && !loading && isImage && (
            <img
              src={url}
              alt={doc.nombre_archivo}
              className="max-w-full max-h-full rounded-lg object-contain"
              style={{ maxHeight: 'calc(90vh - 80px)' }}
            />
          )}
          {url && !loading && isPdf && (
            <iframe
              src={url}
              title={doc.nombre_archivo}
              className="w-full rounded-lg"
              style={{ height: 'calc(90vh - 80px)', minHeight: '500px', border: 'none' }}
            />
          )}
          {url && !loading && !isImage && !isPdf && (
            <div className="flex flex-col items-center gap-4 py-12">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F1F5F9' }}>
                <FileText size={32} style={{ color: '#94A3B8' }} />
              </div>
              <p className="text-sm" style={{ color: '#64748B' }}>Vista previa no disponible para este tipo de archivo</p>
              <a
                href={url}
                download={doc.nombre_archivo}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: '#065F46' }}
              >
                <Download size={14} /> Descargar
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Card ─────────────────────────────────────────────────────────────────

export default function PrevencionDocsCard({ theme }: Props) {
  const [groups, setGroups] = useState<GroupedDocs[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<PrevDoc | null>(null);
  const [expandedSocieties, setExpandedSocieties] = useState<Set<string>>(new Set());

  const totalDocs = groups.reduce((acc, g) => acc + g.docs.length, 0);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc('get_my_prl_documents');
        if (error) throw error;

        const docs = (data ?? []) as PrevDoc[];

        // Group by society
        const map = new Map<string, GroupedDocs>();
        for (const doc of docs) {
          if (!map.has(doc.society_id)) {
            map.set(doc.society_id, { society_id: doc.society_id, society_nombre: doc.society_nombre, docs: [] });
          }
          map.get(doc.society_id)!.docs.push(doc);
        }
        const grouped = Array.from(map.values()).sort((a, b) => a.society_nombre.localeCompare(b.society_nombre));
        setGroups(grouped);

        // Expand all by default
        setExpandedSocieties(new Set(grouped.map((g) => g.society_id)));
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const getPreviewUrl = (wasabiKey: string): Promise<string> => getWasabiBlobUrl(wasabiKey);

  const handleDownload = async (doc: PrevDoc) => {
    if (!doc.wasabi_key) return;
    try {
      await downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo);
    } catch { /* silent */ }
  };

  const toggleSociety = (id: string) => {
    setExpandedSocieties((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isImage = (doc: PrevDoc) =>
    doc.tipo?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.nombre_archivo);
  const isPdf = (doc: PrevDoc) =>
    doc.tipo === 'application/pdf' || /\.pdf$/i.test(doc.nombre_archivo);

  function fileColor(doc: PrevDoc) {
    if (isPdf(doc)) return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
    if (isImage(doc)) return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
    if (doc.tipo?.includes('word') || doc.tipo?.includes('document')) return { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
    if (doc.tipo?.includes('sheet') || doc.tipo?.includes('excel')) return { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
    return { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
  }

  return (
    <>
      {previewDoc && (
        <PreviewModal
          doc={previewDoc}
          onClose={() => setPreviewDoc(null)}
          getUrl={getPreviewUrl}
        />
      )}

      <div className="rounded-2xl overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        {/* Header */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
              <ShieldCheck size={16} style={{ color: '#065F46' }} />
            </div>
            <div>
              <h3 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Documentos Prevencion</h3>
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {loading ? '...' : `${totalDocs} documento${totalDocs !== 1 ? 's' : ''} disponible${totalDocs !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : groups.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFDF5' }}>
                <ShieldCheck size={22} style={{ color: '#6EE7B7' }} />
              </div>
              <p className="text-xs font-medium" style={{ color: theme.textSecondary }}>Sin documentos de prevencion</p>
              <p className="text-xs mt-0.5" style={{ color: theme.textSecondary, opacity: 0.6 }}>Tu responsable de PRL los subira aqui</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const isOpen = expandedSocieties.has(group.society_id);
                return (
                  <div key={group.society_id} className="rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
                    {/* Society header */}
                    <button
                      onClick={() => toggleSociety(group.society_id)}
                      className="w-full flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors duration-150 hover:opacity-90"
                      style={{ backgroundColor: '#ECFDF5' }}
                    >
                      <div className="flex items-center gap-2">
                        <Building2 size={13} style={{ color: '#065F46' }} />
                        <span className="text-xs font-semibold" style={{ color: '#065F46' }}>{group.society_nombre}</span>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                          {group.docs.length}
                        </span>
                      </div>
                      {isOpen ? <ChevronUp size={13} style={{ color: '#065F46' }} /> : <ChevronDown size={13} style={{ color: '#065F46' }} />}
                    </button>

                    {/* Docs list */}
                    {isOpen && (
                      <div className="divide-y" style={{ borderColor: theme.border }}>
                        {group.docs.map((doc) => {
                          const fc = fileColor(doc);
                          const canPreview = isImage(doc) || isPdf(doc);
                          return (
                            <div
                              key={doc.id}
                              className="flex items-center gap-3 px-3 py-2.5 transition-colors duration-100 hover:bg-slate-50"
                            >
                              {/* File icon — clickable if previewable */}
                              <button
                                onClick={() => canPreview && setPreviewDoc(doc)}
                                className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-150 ${canPreview ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
                                style={{ backgroundColor: fc.bg, border: `1px solid ${fc.border}` }}
                                title={canPreview ? 'Ver documento' : undefined}
                                disabled={!canPreview}
                              >
                                {canPreview ? <ZoomIn size={13} style={{ color: fc.color }} /> : <FileText size={13} style={{ color: fc.color }} />}
                              </button>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <button
                                  onClick={() => canPreview && setPreviewDoc(doc)}
                                  className={`text-left w-full ${canPreview ? 'cursor-pointer hover:underline' : 'cursor-default'}`}
                                  disabled={!canPreview}
                                >
                                  <p className="text-xs font-medium truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</p>
                                </button>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Folder size={9} style={{ color: '#94A3B8' }} />
                                  <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                                    {doc.folder_nombre} · {new Date(doc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </p>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {canPreview && (
                                  <button
                                    onClick={() => setPreviewDoc(doc)}
                                    className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                                    style={{ color: '#065F46', backgroundColor: '#ECFDF5' }}
                                    title="Ver"
                                  >
                                    <ZoomIn size={11} />
                                  </button>
                                )}
                                {doc.wasabi_key && (
                                  <button
                                    onClick={() => handleDownload(doc)}
                                    className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
                                    style={{ color: '#475569', backgroundColor: '#F1F5F9' }}
                                    title="Descargar"
                                  >
                                    <Download size={11} />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Tags info */}
          <div className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
            <Tag size={11} style={{ color: theme.textSecondary }} />
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              Tus tags de prevencion determinan los documentos que recibes
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
