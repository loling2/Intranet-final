import { useState, useEffect, useCallback } from 'react';
import {
  LogOut, ShieldCheck, Upload, FileText, Download, Trash2, RefreshCw,
  File, Image as ImageIcon, FileSpreadsheet, X, ZoomIn, Globe, Building2,
  CheckCircle2, AlertCircle, Calendar, User as UserIcon, HelpCircle,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import { uploadToWasabiKey, deleteFromWasabi, getWasabiBlobUrl, downloadFromWasabi } from './lib/wasabi';
import { SocietyProvider } from './context/SocietyContext';
import { AuthProvider } from './context/AuthContext';
import ChangePasswordModal from './components/ChangePasswordModal';
import HelpPanel from './components/HelpPanel';
import { societies } from './themes';

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

const months = [
  { value: '01', label: 'Enero' }, { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' }, { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' }, { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' }, { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' }, { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' }, { value: '12', label: 'Diciembre' },
];

const years = ['2024', '2025', '2026', '2027'];

function getFileIcon(tipo: string) {
  if (tipo?.includes('pdf')) return { Icon: FileText, color: '#DC2626' };
  if (tipo?.includes('image')) return { Icon: ImageIcon, color: '#0EA5E9' };
  if (tipo?.includes('sheet') || tipo?.includes('excel') || tipo?.includes('spreadsheet'))
    return { Icon: FileSpreadsheet, color: '#16A34A' };
  return { Icon: File, color: '#64748B' };
}

function formatSize(bytes: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function CalidadPanel({ email, onLogout, onNavigateEmployee }: Props) {
  const [activeTab, setActiveTab] = useState<'documentos' | 'subir' | 'ayuda'>('documentos');
  const [docs, setDocs] = useState<CalidadDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChangePassword, setShowChangePassword] = useState(false);

  // Upload form state
  const [uploadMode, setUploadMode] = useState<'general' | 'sociedad'>('general');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [selectedSocieties, setSelectedSocieties] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Preview modal
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Filter
  const [filterType, setFilterType] = useState<'all' | 'general' | 'sociedad'>('all');

  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('calidad_documentos')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDocs((data as CalidadDoc[]) ?? []);
    } catch (e) {
      console.error('Error loading calidad docs:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) setSelectedFiles(Array.from(e.target.files));
  }

  function toggleSociety(id: string) {
    setSelectedSocieties(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  async function handleUpload() {
    if (selectedFiles.length === 0) return;
    if (uploadMode === 'sociedad' && selectedSocieties.length === 0) {
      setUploadStatus({ type: 'error', msg: 'Selecciona al menos una sociedad' });
      return;
    }
    setUploading(true);
    setUploadStatus(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const uploaderName = user?.email ?? email;

      for (const file of selectedFiles) {
        const key = `calidad/${selectedYear}/${selectedMonth}/${file.name}`;
        await uploadToWasabiKey(file, key);

        const { error } = await supabase.from('calidad_documentos').insert({
          nombre_archivo: file.name,
          wasabi_key: key,
          tipo: file.type || null,
          tamano_bytes: file.size,
          es_general: uploadMode === 'general',
          sociedad_ids: uploadMode === 'sociedad' ? selectedSocieties : [],
          anio: selectedYear,
          mes: selectedMonth,
          subido_por: user?.id ?? null,
          subido_por_nombre: uploaderName,
        });
        if (error) throw error;
      }

      setUploadStatus({ type: 'success', msg: `${selectedFiles.length} documento(s) subido(s) correctamente` });
      setSelectedFiles([]);
      setSelectedSocieties([]);
      await loadDocs();
    } catch (e) {
      console.error('Upload error:', e);
      setUploadStatus({ type: 'error', msg: 'Error al subir los documentos' });
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: CalidadDoc) {
    if (!confirm(`¿Eliminar "${doc.nombre_archivo}"?`)) return;
    try {
      await deleteFromWasabi(doc.wasabi_key);
      await supabase.from('calidad_documentos').delete().eq('id', doc.id);
      await loadDocs();
    } catch (e) {
      console.error('Delete error:', e);
      alert('Error al eliminar el documento');
    }
  }

  async function handlePreview(doc: CalidadDoc) {
    setLoadingPreview(true);
    setPreviewName(doc.nombre_archivo);
    setPreviewUrl(null);
    try {
      setPreviewUrl(await getWasabiBlobUrl(doc.wasabi_key));
    } catch (e) { console.error(e); }
    finally { setLoadingPreview(false); }
  }

  function closePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreviewName('');
  }

  async function handleDownload(doc: CalidadDoc) {
    try { await downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo); }
    catch (e) { console.error(e); }
  }

  const filteredDocs = docs.filter(d => {
    if (filterType === 'general') return d.es_general;
    if (filterType === 'sociedad') return !d.es_general;
    return true;
  });

  return (
    <AuthProvider>
      <SocietyProvider>
        <div className="min-h-screen" style={{ backgroundColor: '#F0F9FF' }}>
          {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}

          {/* Header */}
          <header
            className="sticky top-0 z-50"
            style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
          >
            <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <ShieldCheck size={18} style={{ color: '#FFFFFF' }} />
                </div>
                <div>
                  <h1 className="font-bold text-sm" style={{ color: '#FFFFFF' }}>Panel de Calidad</h1>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {onNavigateEmployee && (
                  <button
                    onClick={onNavigateEmployee}
                    className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                    style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    <UserIcon size={14} />
                    <span>Mi perfil empleado</span>
                  </button>
                )}
                <button
                  onClick={() => setShowChangePassword(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}
                >
                  <ShieldCheck size={14} />
                  <span className="hidden sm:inline">Cambiar Contrasena</span>
                </button>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
                  style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}
                >
                  <LogOut size={14} /> Salir
                </button>
              </div>
            </div>
          </header>

          {/* Tabs */}
          <div className="max-w-screen-xl mx-auto px-6 pt-6">
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('documentos')}
                className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 flex items-center gap-2"
                style={{
                  backgroundColor: activeTab === 'documentos' ? '#0369A1' : '#FFFFFF',
                  color: activeTab === 'documentos' ? '#FFFFFF' : '#475569',
                  border: `1px solid ${activeTab === 'documentos' ? '#0369A1' : '#E2E8F0'}`,
                }}
              >
                <FileText size={14} /> Documentos de Calidad
              </button>
              <button
                onClick={() => setActiveTab('subir')}
                className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 flex items-center gap-2"
                style={{
                  backgroundColor: activeTab === 'subir' ? '#0369A1' : '#FFFFFF',
                  color: activeTab === 'subir' ? '#FFFFFF' : '#475569',
                  border: `1px solid ${activeTab === 'subir' ? '#0369A1' : '#E2E8F0'}`,
                }}
              >
                <Upload size={14} /> Subir Documentos
              </button>
              <button
                onClick={() => setActiveTab('ayuda')}
                className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 flex items-center gap-2"
                style={{
                  backgroundColor: activeTab === 'ayuda' ? '#0369A1' : '#FFFFFF',
                  color: activeTab === 'ayuda' ? '#FFFFFF' : '#475569',
                  border: `1px solid ${activeTab === 'ayuda' ? '#0369A1' : '#E2E8F0'}`,
                }}
              >
                <HelpCircle size={14} /> Ayuda
              </button>
            </div>
          </div>

          {/* Content */}
          <main className="max-w-screen-xl mx-auto px-6 py-6">
            {activeTab === 'ayuda' && (
              <HelpPanel currentProfileName="Calidad" accentColor="#0369A1" />
            )}
            {activeTab === 'documentos' && (
              <div>
                {/* Filters */}
                <div className="flex items-center gap-2 mb-4">
                  {(['all', 'general', 'sociedad'] as const).map(ft => (
                    <button
                      key={ft}
                      onClick={() => setFilterType(ft)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                      style={{
                        backgroundColor: filterType === ft ? '#0369A1' : '#FFFFFF',
                        color: filterType === ft ? '#FFFFFF' : '#64748B',
                        border: `1px solid ${filterType === ft ? '#0369A1' : '#E2E8F0'}`,
                      }}
                    >
                      {ft === 'all' ? 'Todos' : ft === 'general' ? 'Generales' : 'Por Sociedad'}
                    </button>
                  ))}
                  <button
                    onClick={loadDocs}
                    className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:opacity-70"
                    style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                  </button>
                </div>

                {/* Document list */}
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
                  </div>
                ) : filteredDocs.length === 0 ? (
                  <div className="flex flex-col items-center py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#E0F2FE' }}>
                      <ShieldCheck size={26} style={{ color: '#7DD3FC' }} />
                    </div>
                    <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay documentos de calidad</p>
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Sube el primer documento desde la pestana "Subir Documentos"</p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {filteredDocs.map(doc => {
                      const { Icon, color } = getFileIcon(doc.tipo ?? '');
                      const isImage = doc.tipo?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(doc.nombre_archivo);
                      const isPdf = doc.tipo === 'application/pdf' || /\.pdf$/i.test(doc.nombre_archivo);
                      const canPreview = isImage || isPdf;
                      const monthLabel = months.find(m => m.value === doc.mes)?.label ?? doc.mes;
                      return (
                        <div
                          key={doc.id}
                          className="rounded-2xl p-4 transition-all duration-200 hover:shadow-md"
                          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}0A` }}>
                              <Icon size={18} style={{ color }} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</p>
                              <div className="flex items-center gap-1.5 mt-1">
                                {doc.es_general ? (
                                  <Globe size={10} style={{ color: '#0369A1' }} />
                                ) : (
                                  <Building2 size={10} style={{ color: '#16A34A' }} />
                                )}
                                <span className="text-xs" style={{ color: '#64748B' }}>
                                  {doc.es_general ? 'General' : `${doc.sociedad_ids?.length ?? 0} sociedad(es)`}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-xs" style={{ color: '#94A3B8' }}>
                                <Calendar size={10} /> {monthLabel} {doc.anio}
                                {doc.tamano_bytes ? ` · ${formatSize(doc.tamano_bytes)}` : ''}
                              </div>
                              {doc.subido_por_nombre && (
                                <div className="flex items-center gap-1 mt-1 text-xs" style={{ color: '#94A3B8' }}>
                                  <UserIcon size={10} /> {doc.subido_por_nombre}
                                </div>
                              )}
                            </div>
                          </div>
                          {/* Society badges */}
                          {!doc.es_general && doc.sociedad_ids && doc.sociedad_ids.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-3">
                              {doc.sociedad_ids.map(sid => {
                                const soc = societies.find(s => s.id === sid);
                                return (
                                  <span key={sid} className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F0F9FF', color: '#0369A1', border: '1px solid #BAE6FD' }}>
                                    {soc?.name ?? sid.slice(0, 8)}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                          {/* Actions */}
                          <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                            {canPreview && (
                              <button onClick={() => handlePreview(doc)} title="Ver"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:opacity-70"
                                style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
                                <ZoomIn size={12} /> Ver
                              </button>
                            )}
                            <button onClick={() => handleDownload(doc)} title="Descargar"
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:opacity-70"
                              style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                              <Download size={12} /> Descargar
                            </button>
                            <button onClick={() => handleDelete(doc)} title="Eliminar"
                              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:opacity-70"
                              style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                              <Trash2 size={12} />
                            </button>
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
                <div className="rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <h2 className="text-lg font-semibold mb-1" style={{ color: '#1E293B' }}>Subir Documentos de Calidad</h2>
                  <p className="text-sm mb-6" style={{ color: '#64748B' }}>Sube documentos visibles para todos los empleados o por sociedad</p>

                  {/* Upload mode selector */}
                  <div className="flex gap-2 mb-6">
                    <button
                      onClick={() => setUploadMode('general')}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 flex items-center gap-2 justify-center"
                      style={{
                        backgroundColor: uploadMode === 'general' ? '#0369A1' : '#F8FAFC',
                        color: uploadMode === 'general' ? '#FFFFFF' : '#475569',
                        border: `1px solid ${uploadMode === 'general' ? '#0369A1' : '#E2E8F0'}`,
                      }}
                    >
                      <Globe size={14} /> Informacion General
                    </button>
                    <button
                      onClick={() => setUploadMode('sociedad')}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 flex items-center gap-2 justify-center"
                      style={{
                        backgroundColor: uploadMode === 'sociedad' ? '#0369A1' : '#F8FAFC',
                        color: uploadMode === 'sociedad' ? '#FFFFFF' : '#475569',
                        border: `1px solid ${uploadMode === 'sociedad' ? '#0369A1' : '#E2E8F0'}`,
                      }}
                    >
                      <Building2 size={14} /> Por Sociedad
                    </button>
                  </div>

                  {/* Period selector */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: '#475569' }}>Año</label>
                      <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                      >
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1.5 block" style={{ color: '#475569' }}>Mes</label>
                      <select
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                        style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
                      >
                        {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Society selector */}
                  {uploadMode === 'sociedad' && (
                    <div className="mb-6">
                      <label className="text-xs font-medium mb-2 block" style={{ color: '#475569' }}>Sociedades destinatarias</label>
                      <div className="grid grid-cols-2 gap-2">
                        {societies.map(s => (
                          <button
                            key={s.id}
                            onClick={() => toggleSociety(s.id)}
                            className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm cursor-pointer transition-all duration-200"
                            style={{
                              backgroundColor: selectedSocieties.includes(s.id) ? s.primaryLight : '#F8FAFC',
                              color: selectedSocieties.includes(s.id) ? s.primary : '#475569',
                              border: `1px solid ${selectedSocieties.includes(s.id) ? s.primary : '#E2E8F0'}`,
                            }}
                          >
                            <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: selectedSocieties.includes(s.id) ? s.primary : 'transparent' }}>
                              {selectedSocieties.includes(s.id) && <CheckCircle2 size={12} style={{ color: '#FFFFFF' }} />}
                            </div>
                            {s.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File selector */}
                  <div className="mb-6">
                    <label className="text-xs font-medium mb-2 block" style={{ color: '#475569' }}>Archivos</label>
                    <div
                      onClick={() => document.getElementById('calidad-file-input')?.click()}
                      className="rounded-xl p-8 text-center cursor-pointer transition-colors hover:opacity-80"
                      style={{ backgroundColor: '#F8FAFC', border: '2px dashed #CBD5E1' }}
                    >
                      <Upload size={24} style={{ color: '#94A3B8', margin: '0 auto' }} />
                      <p className="text-sm mt-2" style={{ color: '#475569' }}>
                        {selectedFiles.length > 0
                          ? `${selectedFiles.length} archivo(s) seleccionado(s)`
                          : 'Click para seleccionar archivos'}
                      </p>
                    </div>
                    <input
                      id="calidad-file-input"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {selectedFiles.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {selectedFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F1F5F9' }}>
                            <File size={12} style={{ color: '#64748B' }} />
                            <span className="text-xs truncate flex-1" style={{ color: '#475569' }}>{f.name}</span>
                            <span className="text-xs" style={{ color: '#94A3B8' }}>{formatSize(f.size)}</span>
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedFiles(prev => prev.filter((_, idx) => idx !== i)); }}
                              className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:opacity-70"
                            >
                              <X size={12} style={{ color: '#94A3B8' }} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Upload status */}
                  {uploadStatus && (
                    <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl text-sm"
                      style={{
                        backgroundColor: uploadStatus.type === 'success' ? '#F0FDF4' : '#FEF2F2',
                        color: uploadStatus.type === 'success' ? '#16A34A' : '#DC2626',
                        border: `1px solid ${uploadStatus.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
                      }}>
                      {uploadStatus.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      {uploadStatus.msg}
                    </div>
                  )}

                  {/* Upload button */}
                  <button
                    onClick={handleUpload}
                    disabled={uploading || selectedFiles.length === 0}
                    className="w-full py-3 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                  >
                    {uploading ? (
                      <><RefreshCw size={14} className="animate-spin" /> Subiendo...</>
                    ) : (
                      <><Upload size={14} /> Subir a Wasabi</>
                    )}
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Preview modal */}
          {(previewUrl || loadingPreview) && (
            <div className="fixed inset-0 z-[500] flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
              <div className="flex items-center justify-between px-6 py-3 flex-shrink-0" style={{ backgroundColor: '#0F172A' }}>
                <p className="text-sm font-medium text-white truncate">{previewName}</p>
                <button onClick={closePreview}
                  className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-white/10">
                  <X size={16} className="text-white" />
                </button>
              </div>
              {loadingPreview ? (
                <div className="flex-1 flex items-center justify-center gap-2 text-white">
                  <RefreshCw size={20} className="animate-spin" /> Cargando documento...
                </div>
              ) : (
                <iframe src={previewUrl!} className="flex-1 w-full" style={{ border: 'none' }} title={previewName} />
              )}
            </div>
          )}
        </div>
      </SocietyProvider>
    </AuthProvider>
  );
}
