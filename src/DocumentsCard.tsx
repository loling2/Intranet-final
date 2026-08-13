import { useEffect, useState, useCallback, useRef } from 'react';
import { FileText, Download, ChevronRight, RefreshCw, File, Image, FileSpreadsheet, Eye, X, Upload, AlertCircle, Clock } from 'lucide-react';
import { SocietyTheme } from './themes';
import { supabase, type DocumentRecord } from './supabaseClient';
import { getWasabiBlobUrl, uploadToWasabi } from './lib/wasabi';

interface PendingDoc {
  id: string;
  tipo: string;
  titulo: string;
  descripcion: string;
  ref_id: string | null;
  created_at: string;
}

interface Props {
  theme: SocietyTheme;
  userEmail: string;
  userId?: string | null;
  societyId: string;
  fullView?: boolean;
}

function getFileIcon(tipo: string) {
  if (tipo.includes('pdf')) return { Icon: FileText, color: '#DC2626' };
  if (tipo.includes('image')) return { Icon: Image, color: '#0EA5E9' };
  if (tipo.includes('sheet') || tipo.includes('excel') || tipo.includes('spreadsheet'))
    return { Icon: FileSpreadsheet, color: '#16A34A' };
  return { Icon: File, color: '#64748B' };
}

function formatBytes(bytes: number): string {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function DocumentsCard({ theme, userEmail, userId, societyId, fullView }: Props) {
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [pendingDocs, setPendingDocs] = useState<PendingDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState<string>('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadingPending, setUploadingPending] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      // Only show documents explicitly assigned to this employee (by id or email)
      // Never include documents with no specific recipient
      const orParts: string[] = [];
      if (userId) orParts.push(`usuario_destino_id.eq.${userId}`);
      if (userEmail) orParts.push(`usuario_destino_email.ilike.${userEmail}`);

      if (!orParts.length) {
        setDocs([]);
        return;
      }

      const [docsRes, empDocsRes, pendingRes] = await Promise.all([
        supabase
          .from('documents')
          .select('*')
          .eq('folder', 'publico')
          .or(orParts.join(','))
          .order('fecha_subida', { ascending: false }),
        userId
          ? supabase
              .from('employee_documents')
              .select('*')
              .eq('employee_id', userId)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: null, error: null }),
        userId
          ? supabase
              .from('employee_pending_docs')
              .select('*')
              .eq('employee_id', userId)
              .is('completed_at', null)
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: null, error: null }),
      ]);

      const fromDocs = (docsRes.data ?? []) as DocumentRecord[];
      const fromEmp = (empDocsRes.data ?? []) as unknown as {
        id: string;
        nombre: string;
        storage_path: string;
        mime_type: string;
        size_bytes: number;
        created_at: string;
      }[];

      const empMapped: DocumentRecord[] = fromEmp.map((d) => ({
        id: d.id,
        nombre_archivo: d.nombre,
        tipo: d.mime_type || '',
        usuario_destino_id: userId ?? null,
        usuario_destino_email: '',
        society_id: societyId,
        fecha_subida: d.created_at,
        subido_por: null,
        subido_por_nombre: '',
        tamano_bytes: d.size_bytes ?? 0,
        indexeddb_key: '',
        wasabi_key: d.storage_path,
        folder: 'publico',
      }));

      const merged = [...fromDocs, ...empMapped].sort(
        (a, b) => new Date(b.fecha_subida).getTime() - new Date(a.fecha_subida).getTime()
      );

      setDocs(merged);
      setPendingDocs((pendingRes.data ?? []) as PendingDoc[]);
    } finally {
      setLoading(false);
    }
  }, [userId, userEmail, societyId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handlePreview = async (doc: DocumentRecord) => {
    if (previewing === doc.id) return;
    setPreviewing(doc.id);
    setPreviewName(doc.nombre_archivo);
    setPreviewLoading(true);
    setPreviewUrl(null);
    try {
      const key = doc.wasabi_key ?? `publico/${doc.indexeddb_key}`;
      const url = await getWasabiBlobUrl(key);
      setPreviewUrl(url);
    } catch {
      setPreviewing(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewing(null);
    setPreviewUrl(null);
    setPreviewName('');
  };

  const handleDownload = async (doc: DocumentRecord) => {
    setDownloading(doc.id);
    try {
      const key = doc.wasabi_key ?? `publico/${doc.indexeddb_key}`;
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wasabi-download?key=${encodeURIComponent(key)}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.nombre_archivo;
      a.click();
    } finally {
      setTimeout(() => setDownloading(null), 1500);
    }
  };

  const handleUploadPending = async (pending: PendingDoc, file: File) => {
    setUploadingPending(pending.id);
    setUploadError('');
    try {
      const path = `empleados/${userId}/publica/${Date.now()}-${file.name}`;
      await uploadToWasabi(file, path);

      const { error } = await supabase.rpc('employee_upload_pending_doc', {
        p_pending_id: pending.id,
        p_storage_path: path,
        p_nombre: file.name,
        p_mime_type: file.type || 'application/octet-stream',
        p_size_bytes: file.size,
      });

      if (error) throw error;
      await loadDocs();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir el documento');
    } finally {
      setUploadingPending(null);
    }
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-500 flex flex-col"
      style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.primary}12` }}
          >
            <FileText size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
              Mis Documentos
            </h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {loading ? 'Cargando...' : `${docs.length} documentos disponibles`}
            </p>
          </div>
        </div>
        <button
          onClick={loadDocs}
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer hover:opacity-80"
          style={{ color: theme.primary, backgroundColor: theme.primaryLight }}
        >
          Ver todos
        </button>
      </div>

      {/* Pending Documents */}
      {pendingDocs.length > 0 && (
        <div style={{ borderBottom: `1px solid ${theme.border}` }}>
          <div className="px-6 py-3 flex items-center gap-2" style={{ backgroundColor: '#FEF3C7' }}>
            <AlertCircle size={14} style={{ color: '#B45309' }} />
            <span className="text-xs font-semibold" style={{ color: '#B45309' }}>
              Documentos pendientes de subir ({pendingDocs.length})
            </span>
          </div>
          {uploadError && (
            <div className="mx-6 mt-2 mb-2 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{uploadError}</p>
            </div>
          )}
          {pendingDocs.map((pending) => (
            <div key={pending.id} className="px-6 py-3.5 flex items-center justify-between" style={{ borderBottom: `1px solid ${theme.border}` }}>
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF3C7' }}>
                  <Clock size={14} style={{ color: '#B45309' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>
                    {pending.titulo}
                  </p>
                  <p className="text-xs truncate" style={{ color: theme.textSecondary }}>
                    {pending.descripcion}
                  </p>
                </div>
              </div>
              <label
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200 ${uploadingPending === pending.id ? 'opacity-60 pointer-events-none' : 'hover:opacity-80'}`}
                style={{
                  backgroundColor: uploadingPending === pending.id ? '#FDE68A' : '#FEF3C7',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                }}
              >
                {uploadingPending === pending.id ? (
                  <RefreshCw size={12} className="animate-spin" />
                ) : (
                  <Upload size={12} />
                )}
                {uploadingPending === pending.id ? 'Subiendo...' : 'Subir'}
                <input
                  ref={(el) => { fileInputRefs.current[pending.id] = el; }}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  disabled={uploadingPending === pending.id}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadPending(pending, f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Document List */}
      <div className="flex-1 divide-y" style={{ borderColor: theme.border }}>
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8">
            <RefreshCw size={14} className="animate-spin" style={{ color: theme.primary }} />
            <span className="text-xs" style={{ color: theme.textSecondary }}>Cargando documentos...</span>
          </div>
        ) : docs.length === 0 && pendingDocs.length === 0 ? (
          <div className="flex flex-col items-center py-8 gap-2">
            <FileText size={28} style={{ color: `${theme.primary}30` }} />
            <p className="text-xs" style={{ color: theme.textSecondary }}>Sin documentos disponibles</p>
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center py-6 gap-2">
            <FileText size={24} style={{ color: `${theme.primary}30` }} />
            <p className="text-xs" style={{ color: theme.textSecondary }}>Sin documentos subidos aún</p>
          </div>
        ) : (
          (fullView ? docs : docs.slice(0, 3)).map((doc) => {
            const { Icon, color } = getFileIcon(doc.tipo);
            return (
              <div
                key={doc.id}
                className="px-6 py-3.5 flex items-center justify-between group transition-colors duration-200"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${theme.primary}0A` }}
                  >
                    <Icon size={14} style={{ color }} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: theme.textPrimary }}>
                      {doc.nombre_archivo}
                    </p>
                    <p className="text-xs" style={{ color: theme.textSecondary }}>
                      {new Date(doc.fecha_subida).toLocaleDateString('es-ES')}
                      {doc.tamano_bytes ? ` · ${formatBytes(doc.tamano_bytes)}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handlePreview(doc)}
                    title="Previsualizar"
                    className="flex items-center justify-center w-8 h-8 rounded-lg transition-all duration-200 cursor-pointer hover:opacity-80"
                    style={{ backgroundColor: theme.primaryLight, color: theme.primary }}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    onClick={() => handleDownload(doc)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
                    style={{
                      backgroundColor: downloading === doc.id ? theme.primary : theme.primaryLight,
                      color: downloading === doc.id ? '#FFFFFF' : theme.primary,
                    }}
                  >
                    {downloading === doc.id ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Descargando
                      </span>
                    ) : (
                      <>
                        <Download size={12} />
                        Descargar
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {docs.length > 0 && !fullView && (
        <div
          className="px-6 py-3 flex items-center justify-center gap-1 text-xs font-medium cursor-pointer transition-colors duration-200 hover:opacity-80"
          style={{
            color: theme.primary,
            backgroundColor: theme.primaryLight,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          {docs.length > 3 ? `Ver todos (${docs.length})` : 'Descargar todos'}
          <ChevronRight size={14} />
        </div>
      )}

      {/* Preview Modal */}
      {previewing && (
        <div
          className="fixed inset-0 z-50 flex flex-col"
          style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}
        >
          <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ backgroundColor: '#1e293b' }}>
            <span className="text-white font-medium text-sm truncate max-w-lg">{previewName}</span>
            <button
              onClick={closePreview}
              className="text-white hover:text-gray-300 transition-colors ml-4 flex-shrink-0"
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 relative">
            {previewLoading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="animate-spin h-8 w-8 text-white" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-white text-sm">Cargando documento...</span>
                </div>
              </div>
            ) : previewUrl ? (
              <iframe
                src={previewUrl}
                className="w-full h-full border-0"
                title={previewName}
              />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
