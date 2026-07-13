import { useState, useEffect, useRef, useCallback } from 'react';
import {
  ShieldCheck, FileText, LogOut, Upload, X, ChevronLeft,
  AlertCircle, CheckCircle2, Loader2, Download, Eye, Trash2,
  UploadCloud, FolderOpen, Globe, Building2, KeyRound,
} from 'lucide-react';
import { supabase, type Sociedad } from '../supabaseClient';
import ChangePasswordModal from './ChangePasswordModal';
import {
  uploadToWasabiKey, ensureCalidadFolder, getWasabiBlobUrl,
  downloadFromWasabi, deleteFromWasabi,
} from '../lib/wasabi';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
}

interface CalidadDoc {
  id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tipo: string | null;
  tamano_bytes: number | null;
  es_general: boolean;
  sociedad_ids: string[] | null;
  anio: string;
  mes: string;
  subido_por_nombre: string | null;
  created_at: string;
}

const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const monthNames: Record<string, string> = {
  '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
  '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
  '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CalidadPanel({ email, onLogout, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<'documentos' | 'subir'>('documentos');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [docs, setDocs] = useState<CalidadDoc[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CalidadDoc | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filterTipo, setFilterTipo] = useState<'todos' | 'general' | 'sociedad'>('todos');

  const [uploadMode, setUploadMode] = useState<'general' | 'sociedad'>('general');
  const [selectedSociedades, setSelectedSociedades] = useState<Set<string>>(new Set());
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from('sociedades').select('id, nombre').order('nombre')
      .then(({ data }) => setSociedades((data as Sociedad[]) ?? []));
  }, []);

  const loadDocs = useCallback(async () => {
    setLoadingDocs(true);
    try {
      const { data } = await supabase.from('calidad_documentos').select('*').order('created_at', { ascending: false });
      setDocs((data as CalidadDoc[]) ?? []);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  function addFilesToQueue(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    setUploadQueue(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  }

  function removeFromQueue(name: string) {
    setUploadQueue(prev => prev.filter(f => f.name !== name));
    setUploadProgress(prev => { const n = { ...prev }; delete n[name]; return n; });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFilesToQueue(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length) addFilesToQueue(e.dataTransfer.files);
  }, []);

  function toggleSociedad(id: string) {
    setSelectedSociedades(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function handleUpload() {
    if (!uploadQueue.length) return;
    if (uploadMode === 'sociedad' && selectedSociedades.size === 0) {
      setUploadError('Selecciona al menos una sociedad');
      return;
    }
    setUploading(true);
    setUploadError('');
    const progress: Record<string, 'pending' | 'done' | 'error'> = {};
    uploadQueue.forEach(f => { progress[f.name] = 'pending'; });
    setUploadProgress({ ...progress });

    const y = anio, m = mes;
    const folderKey = `calidad/${y}/${m}/`;
    await ensureCalidadFolder(folderKey);

    const esGeneral = uploadMode === 'general';
    const socIds = esGeneral ? [] : Array.from(selectedSociedades);

    const { data: { user } } = await supabase.auth.getUser();
    let uploaderName = email;
    if (user) {
      const { data: profile } = await supabase.from('user_profiles').select('nombre').eq('id', user.id).maybeSingle();
      if (profile?.nombre) uploaderName = profile.nombre;
    }

    let anyError = false;
    for (const file of uploadQueue) {
      try {
        const key = `${folderKey}${file.name}`;
        await uploadToWasabiKey(file, key);
        await supabase.from('calidad_documentos').insert({
          nombre_archivo: file.name, wasabi_key: key, tipo: file.type || null,
          tamano_bytes: file.size, es_general: esGeneral, sociedad_ids: socIds,
          anio: y, mes: m, subido_por: user?.id ?? null, subido_por_nombre: uploaderName,
        });
        setUploadProgress(prev => ({ ...prev, [file.name]: 'done' }));
      } catch {
        setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
        anyError = true;
      }
    }

    if (anyError) {
      setUploadError('Algunos archivos no se pudieron subir');
    } else {
      setUploadQueue([]); setUploadProgress({}); setActiveTab('documentos');
    }
    setUploading(false);
    await loadDocs();
  }

  async function handlePreview(doc: CalidadDoc) {
    setLoadingPreview(true); setPreviewName(doc.nombre_archivo);
    try { setPreviewUrl(await getWasabiBlobUrl(doc.wasabi_key)); }
    catch (e) { console.error(e); }
    finally { setLoadingPreview(false); }
  }

  async function handleDelete(doc: CalidadDoc) {
    setDeleting(true);
    try {
      await deleteFromWasabi(doc.wasabi_key);
      await supabase.from('calidad_documentos').delete().eq('id', doc.id);
      setConfirmDelete(null);
      await loadDocs();
    } catch (e) { console.error(e); }
    finally { setDeleting(false); }
  }

  const filteredDocs = docs.filter(d => {
    if (filterTipo === 'general' && !d.es_general) return false;
    if (filterTipo === 'sociedad' && d.es_general) return false;
    return true;
  });

  const tabs = [
    { id: 'documentos' as const, label: 'Documentos de Calidad', icon: FileText },
    { id: 'subir' as const, label: 'Subir Documentos', icon: Upload },
  ];

  return (
    <>
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      <header className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onNavigateEmployee ?? onLogout} title="Volver al panel de empleado"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', color: '#BAE6FD' }}>
              <ChevronLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)' }}>
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Panel de Calidad</h1>
              <p className="text-white/50 text-xs">Gestion de documentos de calidad</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}>
              <KeyRound size={14} /><span className="hidden sm:inline">Cambiar Contrasena</span>
            </button>
            <button onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.15)' }}>
              <LogOut size={14} /><span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 pt-6">
        <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {tabs.map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer"
                style={{ backgroundColor: isActive ? '#0369A1' : 'transparent', color: isActive ? '#FFFFFF' : '#475569' }}>
                <TabIcon size={15} />{tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-6 py-6">
        {activeTab === 'documentos' && (
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                {([{'id':'todos','label':'Todos'},{'id':'general','label':'General'},{'id':'sociedad','label':'Por Sociedad'}] as const).map(f => (
                  <button key={f.id} onClick={() => setFilterTipo(f.id)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer"
                    style={{ backgroundColor: filterTipo === f.id ? '#0369A1' : 'transparent', color: filterTipo === f.id ? '#FFFFFF' : '#64748B' }}>
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}>
                <Loader2 size={18} className="animate-spin" /> Cargando documentos...
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <FolderOpen size={32} style={{ color: '#CBD5E1' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No hay documentos de calidad</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocs.map(doc => {
                  const socNames = doc.es_general ? 'General' : (doc.sociedad_ids ?? [])
                    .map(sid => sociedades.find(s => s.id === sid)?.nombre ?? sid).join(', ');
                  return (
                    <div key={doc.id} className="rounded-xl p-4 transition-all duration-300"
                      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: doc.es_general ? '#EFF6FF' : '#F0FDF4' }}>
                          {doc.es_general ? <Globe size={16} style={{ color: '#0369A1' }} /> : <Building2 size={16} style={{ color: '#16A34A' }} />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{doc.nombre_archivo}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                            {monthNames[doc.mes] ?? doc.mes} {doc.anio} - {formatSize(doc.tamano_bytes ?? 0)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{ backgroundColor: doc.es_general ? '#EFF6FF' : '#F0FDF4', color: doc.es_general ? '#0369A1' : '#16A34A' }}>
                          {doc.es_general ? 'General' : 'Por Sociedad'}
                        </span>
                        <span className="text-xs truncate" style={{ color: '#64748B' }}>{socNames}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => handlePreview(doc)} title="Ver"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-blue-50" style={{ color: '#0369A1' }}>
                          <Eye size={15} />
                        </button>
                        <button onClick={() => downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo)} title="Descargar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-100" style={{ color: '#475569' }}>
                          <Download size={15} />
                        </button>
                        <button onClick={() => setConfirmDelete(doc)} title="Eliminar"
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}>
                          <Trash2 size={15} />
                        </button>
                        <span className="ml-auto text-xs" style={{ color: '#94A3B8' }}>{doc.subido_por_nombre ?? ''}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'subir' && (
          <div className="max-w-2xl mx-auto">
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: '#E2E8F0' }}>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Subir documentos de calidad</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                  Se guardaran en la carpeta calidad/{anio}/{mes} en Wasabi
                </p>
              </div>
              <div className="px-6 py-5 space-y-5">
                <div>
                  <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>Tipo de subida</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setUploadMode('general')}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer"
                      style={{ backgroundColor: uploadMode === 'general' ? '#0369A1' : '#F8FAFC', color: uploadMode === 'general' ? '#FFFFFF' : '#475569', border: `1.5px solid ${uploadMode === 'general' ? '#0369A1' : '#E2E8F0'}` }}>
                      <Globe size={16} /> Informacion General
                    </button>
                    <button onClick={() => setUploadMode('sociedad')}
                      className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all cursor-pointer"
                      style={{ backgroundColor: uploadMode === 'sociedad' ? '#16A34A' : '#F8FAFC', color: uploadMode === 'sociedad' ? '#FFFFFF' : '#475569', border: `1.5px solid ${uploadMode === 'sociedad' ? '#16A34A' : '#E2E8F0'}` }}>
                      <Building2 size={16} /> Informacion por Sociedad
                    </button>
                  </div>
                </div>

                {uploadMode === 'sociedad' && (
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: '#374151' }}>
                      Selecciona las sociedades ({selectedSociedades.size} seleccionadas)
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {sociedades.map(s => {
                        const sel = selectedSociedades.has(s.id);
                        return (
                          <button key={s.id} onClick={() => toggleSociedad(s.id)}
                            className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer"
                            style={{ backgroundColor: sel ? '#16A34A' : '#F0FDF4', color: sel ? '#FFFFFF' : '#16A34A', border: `1px solid ${sel ? '#16A34A' : '#BBF7D0'}` }}>
                            {sel && <CheckCircle2 size={11} className="inline mr-1" />}{s.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Ano</label>
                    <input type="number" value={anio} onChange={e => setAnio(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{ border: '1px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Mes</label>
                    <select value={mes} onChange={e => setMes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
                      style={{ border: '1px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}>
                      {months.map(m => <option key={m} value={m}>{monthNames[m]} ({m})</option>)}
                    </select>
                  </div>
                </div>

                <div ref={dropZoneRef} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
                  onClick={() => !uploading && fileInputRef.current?.click()}
                  className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all select-none"
                  style={{ border: `2px dashed ${isDragging ? '#0369A1' : '#CBD5E1'}`, backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC', padding: '28px 16px', minHeight: 130 }}>
                  <UploadCloud size={32} style={{ color: isDragging ? '#0369A1' : '#94A3B8' }} />
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: isDragging ? '#0369A1' : '#475569' }}>
                      {isDragging ? 'Suelta los archivos aqui' : 'Arrastra archivos o haz clic para seleccionar'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Multiples archivos permitidos</p>
                  </div>
                  <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} disabled={uploading} className="hidden" />
                </div>

                {uploadQueue.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {uploadQueue.map(file => {
                      const status = uploadProgress[file.name];
                      return (
                        <div key={file.name} className="flex items-center gap-3 px-3 py-2 rounded-lg"
                          style={{ backgroundColor: status === 'done' ? '#F0FDF4' : status === 'error' ? '#FEF2F2' : '#F8FAFC', border: `1px solid ${status === 'done' ? '#BBF7D0' : status === 'error' ? '#FECACA' : '#E2E8F0'}` }}>
                          <FileText size={14} style={{ color: status === 'done' ? '#16A34A' : status === 'error' ? '#DC2626' : '#64748B', flexShrink: 0 }} />
                          <span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{file.name}</span>
                          <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{(file.size / 1024).toFixed(0)} KB</span>
                          {status === 'pending' && uploading && <Loader2 size={13} className="animate-spin flex-shrink-0" style={{ color: '#0369A1' }} />}
                          {status === 'done' && <CheckCircle2 size={13} className="flex-shrink-0" style={{ color: '#16A34A' }} />}
                          {status === 'error' && <AlertCircle size={13} className="flex-shrink-0" style={{ color: '#DC2626' }} />}
                          {!uploading && !status && (
                            <button onClick={e => { e.stopPropagation(); removeFromQueue(file.name); }}
                              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 hover:bg-slate-200 cursor-pointer">
                              <X size={11} style={{ color: '#94A3B8' }} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                    <AlertCircle size={13} /> {uploadError}
                  </div>
                )}

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    {uploadQueue.length > 0 ? `${uploadQueue.length} archivo${uploadQueue.length !== 1 ? 's' : ''} seleccionado${uploadQueue.length !== 1 ? 's' : ''}` : 'Ningun archivo seleccionado'}
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => { setUploadQueue([]); setUploadProgress({}); setUploadError(''); }} disabled={uploading}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                      Limpiar
                    </button>
                    <button onClick={handleUpload} disabled={uploading || uploadQueue.length === 0 || (uploadMode === 'sociedad' && selectedSociedades.size === 0)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-all"
                      style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                      {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                      {uploading ? 'Subiendo...' : `Subir${uploadQueue.length > 1 ? ` (${uploadQueue.length})` : ''}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
                <Trash2 size={16} style={{ color: '#DC2626' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Eliminar documento</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Esta accion no se puede deshacer</p>
              </div>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm" style={{ color: '#475569' }}>
                Vas a eliminar <span className="font-semibold" style={{ color: '#0F172A' }}>{confirmDelete.nombre_archivo}</span> de forma permanente.
              </p>
              <div className="flex gap-2 mt-5 justify-end">
                <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                  Cancelar
                </button>
                <button onClick={() => handleDelete(confirmDelete)} disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>
                  {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {(previewUrl || loadingPreview) && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ backgroundColor: '#0F172A' }}>
            <p className="text-sm font-medium text-white truncate">{previewName}</p>
            <button onClick={() => { setPreviewUrl(null); setPreviewName(''); }}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/10">
              <X size={16} className="text-white" />
            </button>
          </div>
          {loadingPreview ? (
            <div className="flex-1 flex items-center justify-center gap-2 text-white">
              <Loader2 size={20} className="animate-spin" /> Cargando documento...
            </div>
          ) : (
            <iframe src={previewUrl!} className="flex-1 w-full" style={{ border: 'none' }} title={previewName} />
          )}
        </div>
      )}
    </>
  );
}
