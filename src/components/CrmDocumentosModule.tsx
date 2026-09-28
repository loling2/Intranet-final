import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  FolderOpen, Folder, FileText, Upload, Download, Trash2, Plus, X,
  ChevronRight, Loader2, AlertCircle, Lock, Globe, Shield, Eye,
  FolderPlus, Home, Users, Settings,
} from 'lucide-react';
import {
  ensureCrmFolder, listCrmFolderFiles, uploadCrmFile,
  getWasabiBlobUrl, downloadFromWasabi, deleteFromWasabi,
  type RrhhFile,
} from '../lib/wasabi';

interface Props {
  usuarioServicioId: string;
  usuarioNombre: string;
  isAdmin: boolean;
}

interface Carpeta {
  id: string;
  usuario_servicio_id: string;
  categoria_id: string;
  nombre: string;
  wasabi_prefix: string;
  categoria_nombre: string;
  es_general: boolean;
  created_at: string;
}

interface Categoria {
  id: string;
  nombre: string;
  es_general: boolean;
}

interface AuthUser {
  id: string;
  nombre: string;
  email: string;
  role: string;
}

type View = 'carpetas' | 'archivos' | 'gestion_categorias' | 'gestion_usuarios';

export default function CrmDocumentosModule({ usuarioServicioId, usuarioNombre, isAdmin }: Props) {
  const [view, setView] = useState<View>('carpetas');
  const [carpetas, setCarpetas] = useState<Carpeta[]>([]);
  const [loadingCarpetas, setLoadingCarpetas] = useState(false);
  const [carpetaSeleccionada, setCarpetaSeleccionada] = useState<Carpeta | null>(null);
  const [files, setFiles] = useState<RrhhFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [showCreateCarpeta, setShowCreateCarpeta] = useState(false);
  const [newCarpetaNombre, setNewCarpetaNombre] = useState('');
  const [newCarpetaCategoria, setNewCarpetaCategoria] = useState<string>('');
  const [creatingCarpeta, setCreatingCarpeta] = useState(false);
  const [carpetaError, setCarpetaError] = useState('');
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<RrhhFile | null>(null);
  const [deletingFile, setDeletingFile] = useState(false);

  // Gestión de categorías (admin)
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [showCategoriaForm, setShowCategoriaForm] = useState(false);
  const [newCatNombre, setNewCatNombre] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  // Gestión de categorías de usuarios (admin)
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [userCategorias, setUserCategorias] = useState<Record<string, string[]>>({});
  const [editingUserCat, setEditingUserCat] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadCarpetas = useCallback(async () => {
    setLoadingCarpetas(true);
    const { data } = await supabase.rpc('get_visible_crm_carpetas', {
      p_usuario_servicio_id: usuarioServicioId,
    });
    setCarpetas((data ?? []) as Carpeta[]);
    setLoadingCarpetas(false);
  }, [usuarioServicioId]);

  useEffect(() => { loadCarpetas(); }, [loadCarpetas]);

  useEffect(() => {
    if (!carpetaSeleccionada) { setFiles([]); return; }
    setLoadingFiles(true);
    listCrmFolderFiles(carpetaSeleccionada.wasabi_prefix)
      .then((fls) => setFiles(fls))
      .catch(() => setFiles([]))
      .finally(() => setLoadingFiles(false));
  }, [carpetaSeleccionada]);

  const loadCategorias = useCallback(async () => {
    const { data } = await supabase.from('crm_categorias').select('id, nombre, es_general').order('es_general', { ascending: false }).order('nombre');
    setCategorias((data ?? []) as Categoria[]);
  }, []);

  const loadAuthUsers = useCallback(async () => {
    const { data } = await supabase.rpc('get_crm_authorizable_users');
    setAuthUsers((data ?? []) as AuthUser[]);
    // Cargar categorías asignadas a cada usuario
    const { data: ucData } = await supabase.from('crm_usuario_categorias').select('user_id, categoria_id');
    const map: Record<string, string[]> = {};
    for (const row of (ucData ?? []) as { user_id: string; categoria_id: string }[]) {
      if (!map[row.user_id]) map[row.user_id] = [];
      map[row.user_id].push(row.categoria_id);
    }
    setUserCategorias(map);
  }, []);

  useEffect(() => {
    if (isAdmin && (view === 'gestion_categorias' || view === 'gestion_usuarios')) {
      loadCategorias();
      if (view === 'gestion_usuarios') loadAuthUsers();
    }
  }, [isAdmin, view, loadCategorias, loadAuthUsers]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCarpeta(c: Carpeta) {
    setCarpetaSeleccionada(c);
    setView('archivos');
  }

  async function handleCreateCarpeta() {
    if (!newCarpetaNombre.trim()) { setCarpetaError('El nombre es obligatorio'); return; }
    if (!newCarpetaCategoria) { setCarpetaError('Selecciona una categoría'); return; }
    setCreatingCarpeta(true); setCarpetaError('');
    try {
      const safeName = newCarpetaNombre.trim().replace(/[^a-zA-Z0-9ÁáÉéÍíÓóÚúÑñ._\- ]/g, '').trim();
      if (!safeName) { setCarpetaError('Nombre inválido'); return; }
      const prefix = `crm/documentacion/${usuarioServicioId}/${safeName}/`;
      await ensureCrmFolder(prefix);
      const { error } = await supabase.from('crm_carpetas').insert({
        usuario_servicio_id: usuarioServicioId,
        categoria_id: newCarpetaCategoria,
        nombre: safeName,
        wasabi_prefix: prefix,
      });
      if (error) throw error;
      setShowCreateCarpeta(false);
      setNewCarpetaNombre('');
      setNewCarpetaCategoria('');
      await loadCarpetas();
    } catch (e) {
      setCarpetaError(e instanceof Error ? e.message : 'Error al crear la carpeta');
    } finally {
      setCreatingCarpeta(false);
    }
  }

  async function handleDeleteCarpeta(c: Carpeta) {
    if (!confirm(`¿Eliminar la carpeta "${c.nombre}" y todos sus archivos?`)) return;
    try {
      const allKeys = await listCrmFolderFiles(c.wasabi_prefix);
      for (const f of allKeys) await deleteFromWasabi(f.key);
      await deleteFromWasabi(`${c.wasabi_prefix}.keep`);
      await supabase.from('crm_carpetas').delete().eq('id', c.id);
      await loadCarpetas();
    } catch (e) {
      console.error(e);
    }
  }

  function addFilesToQueue(incoming: FileList | File[]) {
    const arr = Array.from(incoming);
    setUploadQueue(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFilesToQueue(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleUpload() {
    if (!uploadQueue.length || !carpetaSeleccionada) return;
    setUploading(true); setUploadError('');
    const prefix = carpetaSeleccionada.wasabi_prefix;
    await ensureCrmFolder(prefix);
    let anyError = false;
    const failed: File[] = [];
    for (const file of uploadQueue) {
      try {
        const key = `${prefix}${file.name}`;
        await uploadCrmFile(file, key);
      } catch {
        anyError = true; failed.push(file);
      }
    }
    if (anyError) {
      setUploadQueue(failed);
      setUploadError(`${failed.length} archivo(s) no se pudoieron subir.`);
    } else {
      setShowUpload(false);
      setUploadQueue([]);
    }
    setUploading(false);
    if (carpetaSeleccionada) {
      const fls = await listCrmFolderFiles(carpetaSeleccionada.wasabi_prefix);
      setFiles(fls);
    }
  }

  async function handlePreview(file: RrhhFile) {
    setLoadingPreview(true); setPreviewName(file.name);
    try {
      const url = await getWasabiBlobUrl(file.key);
      setPreviewUrl(url);
    } catch (e) { console.error(e); }
    finally { setLoadingPreview(false); }
  }

  async function handleDeleteFile(file: RrhhFile) {
    setDeletingFile(true);
    try {
      await deleteFromWasabi(file.key);
      setConfirmDeleteFile(null);
      if (carpetaSeleccionada) {
        const fls = await listCrmFolderFiles(carpetaSeleccionada.wasabi_prefix);
        setFiles(fls);
      }
    } catch (e) { console.error(e); }
    finally { setDeletingFile(false); }
  }

  async function handleSaveCategoria() {
    if (!newCatNombre.trim()) return;
    setSavingCat(true);
    try {
      const { error } = await supabase.from('crm_categorias').insert({
        nombre: newCatNombre.trim(),
        descripcion: newCatDesc.trim(),
      });
      if (error) throw error;
      setShowCategoriaForm(false);
      setNewCatNombre(''); setNewCatDesc('');
      await loadCategorias();
    } catch (e) {
      console.error(e);
    } finally { setSavingCat(false); }
  }

  async function handleDeleteCategoria(catId: string) {
    if (!confirm('¿Eliminar esta categoría? Las carpetas asociadas también se borrarán.')) return;
    await supabase.from('crm_categorias').delete().eq('id', catId);
    await loadCategorias();
  }

  async function toggleUserCategoria(userId: string, catId: string) {
    const current = userCategorias[userId] ?? [];
    if (current.includes(catId)) {
      await supabase.from('crm_usuario_categorias').delete()
        .eq('user_id', userId).eq('categoria_id', catId);
      setUserCategorias(prev => ({ ...prev, [userId]: current.filter(c => c !== catId) }));
    } else {
      await supabase.from('crm_usuario_categorias').insert({
        user_id: userId, categoria_id: catId,
      });
      setUserCategorias(prev => ({ ...prev, [userId]: [...current, catId] }));
    }
  }

  // Agrupar carpetas por categoría
  const carpetasByCategoria: Record<string, Carpeta[]> = {};
  for (const c of carpetas) {
    const key = c.categoria_nombre;
    if (!carpetasByCategoria[key]) carpetasByCategoria[key] = [];
    carpetasByCategoria[key].push(c);
  }

  return (
    <div className="space-y-6">
      {/* Toolbar superior */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {view !== 'carpetas' && (
            <button
              onClick={() => { setView('carpetas'); setCarpetaSeleccionada(null); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
              style={{ backgroundColor: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }}
            >
              <ChevronRight size={14} className="rotate-180" /> Volver
            </button>
          )}
          <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
            {view === 'carpetas' && `Documentos de ${usuarioNombre}`}
            {view === 'archivos' && carpetaSeleccionada?.nombre}
            {view === 'gestion_categorias' && 'Gestión de Categorías'}
            {view === 'gestion_usuarios' && 'Asignar Categorías a Usuarios'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && view === 'carpetas' && (
            <>
              <button
                onClick={() => setView('gestion_categorias')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
              >
                <Settings size={14} /> Categorías
              </button>
              <button
                onClick={() => setView('gestion_usuarios')}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}
              >
                <Users size={14} /> Asignar usuarios
              </button>
            </>
          )}
          {(view === 'carpetas') && (
            <button
              onClick={() => { setShowCreateCarpeta(true); setCarpetaError(''); setNewCarpetaNombre(''); setNewCarpetaCategoria(''); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
            >
              <FolderPlus size={14} /> Nueva carpeta
            </button>
          )}
          {view === 'archivos' && carpetaSeleccionada && (
            <button
              onClick={() => { setShowUpload(true); setUploadError(''); setUploadQueue([]); }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
            >
              <Upload size={14} /> Subir archivo
            </button>
          )}
        </div>
      </div>

      {/* Vista: carpetas agrupadas por categoría */}
      {view === 'carpetas' && (
        <>
          {loadingCarpetas ? (
            <div className="text-center py-12">
              <Loader2 size={24} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
              <p className="text-sm" style={{ color: '#64748B' }}>Cargando carpetas...</p>
            </div>
          ) : Object.keys(carpetasByCategoria).length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <FolderOpen size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
              <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay carpetas para este usuario</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Crea una carpeta con el botón "Nueva carpeta"</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(carpetasByCategoria).map(([catNombre, carpetasList]) => (
                <div key={catNombre}>
                  <div className="flex items-center gap-2 mb-3">
                    {catNombre === 'General' ? <Globe size={14} style={{ color: '#16A34A' }} /> : <Lock size={14} style={{ color: '#D97706' }} />}
                    <h4 className="text-sm font-bold uppercase tracking-wide" style={{ color: catNombre === 'General' ? '#16A34A' : '#D97706' }}>
                      {catNombre}
                    </h4>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>({carpetasList.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {carpetasList.map((c) => (
                      <div key={c.id} className="rounded-xl p-5 transition-all hover:shadow-md" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                        <button onClick={() => openCarpeta(c)} className="flex items-center gap-3 w-full text-left cursor-pointer">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: c.es_general ? '#F0FDF4' : '#FFFBEB' }}>
                            <Folder size={18} style={{ color: c.es_general ? '#16A34A' : '#D97706' }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{c.nombre}</p>
                            <p className="text-xs" style={{ color: '#94A3B8' }}>{c.es_general ? 'General' : c.categoria_nombre}</p>
                          </div>
                          <ChevronRight size={15} style={{ color: '#CBD5E1' }} />
                        </button>
                        {isAdmin && (
                          <div className="flex gap-2 pt-3 mt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                            <button onClick={() => handleDeleteCarpeta(c)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium cursor-pointer transition-all ml-auto"
                              style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                              <Trash2 size={12} /> Eliminar
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Vista: archivos de una carpeta */}
      {view === 'archivos' && carpetaSeleccionada && (
        <div className="rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 px-5 py-3 border-b" style={{ borderColor: '#F1F5F9' }}>
            <button onClick={() => { setView('carpetas'); setCarpetaSeleccionada(null); }}
              className="flex items-center gap-1 text-xs font-medium cursor-pointer hover:bg-slate-100 rounded px-1.5 py-0.5"
              style={{ color: '#64748B' }}>
              <Home size={11} /> Carpetas
            </button>
            <ChevronRight size={12} style={{ color: '#CBD5E1' }} />
            <span className="text-xs font-semibold" style={{ color: '#0369A1' }}>{carpetaSeleccionada.nombre}</span>
          </div>

          {loadingFiles ? (
            <div className="text-center py-12">
              <Loader2 size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} />
              <p className="text-xs" style={{ color: '#64748B' }}>Cargando archivos...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <FolderOpen size={28} style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={{ color: '#94A3B8' }}>Esta carpeta está vacía</p>
              <button onClick={() => { setShowUpload(true); setUploadError(''); setUploadQueue([]); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                <Upload size={12} /> Subir primer archivo
              </button>
            </div>
          ) : (
            <div className="p-4 space-y-1.5">
              {files.map(file => (
                <div key={file.key} className="flex items-center gap-3 rounded-xl px-3 py-3"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: '#EFF6FF' }}>
                    <FileText size={16} style={{ color: '#0369A1' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{file.name}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>
                      {file.size < 1024 ? `${file.size} B` : file.size < 1024 * 1024 ? `${(file.size / 1024).toFixed(1)} KB` : `${(file.size / 1024 / 1024).toFixed(1)} MB`}
                      {' · '}{file.lastModified.toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handlePreview(file)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-100 transition-colors"
                      title="Ver" style={{ color: '#0369A1' }}>
                      <Eye size={15} />
                    </button>
                    <button onClick={() => downloadFromWasabi(file.key, file.name)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                      title="Descargar" style={{ color: '#475569' }}>
                      <Download size={15} />
                    </button>
                    {isAdmin && (
                      <button onClick={() => setConfirmDeleteFile(file)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors"
                        title="Eliminar" style={{ color: '#DC2626' }}>
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Vista: gestión de categorías (admin) */}
      {view === 'gestion_categorias' && isAdmin && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: '#64748B' }}>Crea categorías profesionales (Psicólogo, Terapeuta, etc.). La categoría "General" es accesible para todos.</p>
            <button onClick={() => setShowCategoriaForm(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              <Plus size={14} /> Nueva categoría
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categorias.map(cat => (
              <div key={cat.id} className="rounded-xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: cat.es_general ? '#F0FDF4' : '#FFFBEB' }}>
                      {cat.es_general ? <Globe size={18} style={{ color: '#16A34A' }} /> : <Lock size={18} style={{ color: '#D97706' }} />}
                    </div>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{cat.nombre}</p>
                      {cat.es_general && <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>General</span>}
                    </div>
                  </div>
                  {!cat.es_general && (
                    <button onClick={() => handleDeleteCategoria(cat.id)}
                      className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer transition-all"
                      style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vista: asignar categorías a usuarios (admin) */}
      {view === 'gestion_usuarios' && isAdmin && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: '#64748B' }}>Asigna categorías a cada usuario del CRM. Solo verán las carpetas de sus categorías asignadas + la carpeta General.</p>
          <div className="space-y-3">
            {authUsers.map(u => {
              const userCats = userCategorias[u.id] ?? [];
              const isExpanded = editingUserCat === u.id;
              return (
                <div key={u.id} className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <button
                    onClick={() => setEditingUserCat(isExpanded ? null : u.id)}
                    className="w-full flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                        <Users size={16} style={{ color: '#0369A1' }} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{u.nombre}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{u.email} · {u.role}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {userCats.length > 0 ? (
                        <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                          {userCats.length} categoría{userCats.length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                          Sin categorías
                        </span>
                      )}
                      <ChevronRight size={14} className={`transition-transform ${isExpanded ? 'rotate-90' : ''}`} style={{ color: '#94A3B8' }} />
                    </div>
                  </button>
                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t flex flex-wrap gap-2" style={{ borderColor: '#F1F5F9' }}>
                      {categorias.filter(c => !c.es_general).map(cat => {
                        const sel = userCats.includes(cat.id);
                        return (
                          <button key={cat.id}
                            onClick={() => toggleUserCategoria(u.id, cat.id)}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all"
                            style={{
                              backgroundColor: sel ? '#0369A1' : '#F1F5F9',
                              color: sel ? '#FFFFFF' : '#475569',
                              border: `1px solid ${sel ? '#0369A1' : '#E2E8F0'}`,
                            }}>
                            {cat.nombre}
                          </button>
                        );
                      })}
                      {categorias.filter(c => !c.es_general).length === 0 && (
                        <p className="text-xs" style={{ color: '#94A3B8' }}>No hay categorías disponibles. Crea categorías primero.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Crear carpeta */}
      {showCreateCarpeta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva carpeta para {usuarioNombre}</h3>
              <button onClick={() => setShowCreateCarpeta(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre de la carpeta *</label>
                <input type="text" value={newCarpetaNombre} onChange={(e) => setNewCarpetaNombre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                  placeholder="Ej: Sesiones, Informes, Evaluación..." autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Categoría *</label>
                <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>La carpeta hereda los permisos de la categoría seleccionada. "General" es accesible para todos.</p>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {categorias.length === 0 ? (
                    <p className="text-xs" style={{ color: '#94A3B8' }}>No hay categorías. Crea una desde "Categorías".</p>
                  ) : categorias.map(cat => {
                    const sel = newCarpetaCategoria === cat.id;
                    return (
                      <button key={cat.id}
                        onClick={() => setNewCarpetaCategoria(cat.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all"
                        style={{
                          backgroundColor: sel ? '#0369A1' : '#F1F5F9',
                          color: sel ? '#FFFFFF' : '#475569',
                          border: `1px solid ${sel ? '#0369A1' : '#E2E8F0'}`,
                        }}>
                        {cat.es_general ? <Globe size={12} /> : <Lock size={12} />}
                        {cat.nombre}
                      </button>
                    );
                  })}
                </div>
              </div>
              {carpetaError && <p className="text-xs" style={{ color: '#DC2626' }}>{carpetaError}</p>}
              <div className="flex gap-2">
                <button onClick={handleCreateCarpeta} disabled={creatingCarpeta}
                  className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60"
                  style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                  {creatingCarpeta ? 'Creando...' : 'Crear carpeta'}
                </button>
                <button onClick={() => setShowCreateCarpeta(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Subir archivos */}
      {showUpload && carpetaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Subir archivos</h3>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>Carpeta: {carpetaSeleccionada.nombre}</p>
              </div>
              <button onClick={() => { setShowUpload(false); setUploadQueue([]); }} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all select-none"
                style={{ border: '2px dashed #CBD5E1', backgroundColor: '#F8FAFC', padding: '28px 16px', minHeight: 130 }}>
                <Upload size={28} style={{ color: '#94A3B8' }} />
                <div className="text-center">
                  <p className="text-sm font-medium" style={{ color: '#475569' }}>Arrastra archivos o haz clic para seleccionar</p>
                  <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Múltiples archivos permitidos</p>
                </div>
                <input ref={fileInputRef} type="file" multiple onChange={handleFileInput} disabled={uploading} className="hidden" />
              </div>
              {uploadQueue.length > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {uploadQueue.map(f => (
                    <div key={f.name} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <FileText size={14} style={{ color: '#64748B', flexShrink: 0 }} />
                      <span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{f.name}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{(f.size / 1024).toFixed(0)} KB</span>
                      {!uploading && (
                        <button onClick={(e) => { e.stopPropagation(); setUploadQueue(prev => prev.filter(x => x.name !== f.name)); }}
                          className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-slate-200">
                          <X size={11} style={{ color: '#94A3B8' }} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {uploadError && (
                <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={13} /> {uploadError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#94A3B8' }}>
                  {uploadQueue.length > 0 ? `${uploadQueue.length} archivo(s) seleccionado(s)` : 'Ningún archivo'}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => { setShowUpload(false); setUploadQueue([]); }} disabled={uploading}
                    className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                    Cancelar
                  </button>
                  <button onClick={handleUpload} disabled={uploading || uploadQueue.length === 0}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-50 transition-all"
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

      {/* Modal: Eliminar archivo */}
      {confirmDeleteFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: '#FEE2E2' }}>
                <Trash2 size={16} style={{ color: '#DC2626' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Eliminar archivo</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Esta acción no se puede deshacer</p>
              </div>
            </div>
            <p className="text-sm mb-4" style={{ color: '#475569' }}>
              Vas a eliminar <span className="font-semibold" style={{ color: '#0F172A' }}>{confirmDeleteFile.name}</span>
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDeleteFile(null)} disabled={deletingFile}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                Cancelar
              </button>
              <button onClick={() => handleDeleteFile(confirmDeleteFile)} disabled={deletingFile}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}>
                {deletingFile ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deletingFile ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Crear categoría */}
      {showCategoriaForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva categoría</h3>
              <button onClick={() => setShowCategoriaForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Nombre *</label>
                <input type="text" value={newCatNombre} onChange={(e) => setNewCatNombre(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                  placeholder="Ej: Psicólogo, Terapeuta, Trabajador Social..." autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: '#475569' }}>Descripción</label>
                <input type="text" value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' }}
                  placeholder="Descripción opcional" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSaveCategoria} disabled={savingCat}
                  className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                  {savingCat ? 'Guardando...' : 'Guardar'}
                </button>
                <button onClick={() => setShowCategoriaForm(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview modal */}
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
    </div>
  );
}
