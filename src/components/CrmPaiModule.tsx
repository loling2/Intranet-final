import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  Plus, X, Trash2, Clock, FileText, CheckCircle2,
  Upload, Download, Loader2, AlertCircle,
} from 'lucide-react';
import {
  ensureCrmFolder, uploadCrmFile, downloadFromWasabi, getWasabiBlobUrl, deleteFromWasabi,
} from '../lib/wasabi';

interface Props {
  usuarioId: string;
  autorNombre: string;
  isAdmin: boolean;
}

interface Pai {
  id: string;
  tipo: string;
  version: number;
  fecha_creacion: string;
  fecha_revision: string | null;
  fecha_cierre: string | null;
  objetivos: string;
  areas_intervencion: string;
  profesionales_involucrados: string;
  evaluacion: string;
  estado: string;
  creado_por_nombre: string;
}

interface PaiDoc {
  id: string;
  pai_id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tamano_bytes: number;
  created_at: string;
}

const ESTADO_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  borrador: { label: 'Borrador', color: '#475569', bg: '#F1F5F9' },
  activo: { label: 'Activo', color: '#16A34A', bg: '#F0FDF4' },
  revisado: { label: 'Revisado', color: '#D97706', bg: '#FFFBEB' },
  cerrado: { label: 'Cerrado', color: '#94A3B8', bg: '#F1F5F9' },
};

export default function CrmPaiModule({ usuarioId, autorNombre, isAdmin }: Props) {
  const [planes, setPlanes] = useState<Pai[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipo, setTipo] = useState('PAI');
  const [objetivos, setObjetivos] = useState('');
  const [areas, setAreas] = useState('');
  const [profesionales, setProfesionales] = useState('');
  const [evaluacion, setEvaluacion] = useState('');
  const [estado, setEstado] = useState('borrador');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Documents per plan
  const [docsByPlan, setDocsByPlan] = useState<Record<string, PaiDoc[]>>({});
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('crm_pai')
      .select('*')
      .eq('usuario_servicio_id', usuarioId)
      .order('fecha_creacion', { ascending: false });
    setPlanes((data ?? []) as Pai[]);
    setLoading(false);
  }, [usuarioId]);

  useEffect(() => { load(); }, [load]);

  async function loadDocs(paiId: string) {
    const { data } = await supabase
      .from('crm_pai_documentos')
      .select('id, pai_id, nombre_archivo, wasabi_key, tamano_bytes, created_at')
      .eq('pai_id', paiId)
      .order('created_at', { ascending: false });
    setDocsByPlan(prev => ({ ...prev, [paiId]: (data ?? []) as PaiDoc[] }));
  }

  async function handleSave() {
    if (!objetivos.trim() && !areas.trim()) { setError('Indica objetivos o áreas de intervención'); return; }
    setSaving(true); setError('');
    if (editingId) {
      await supabase.from('crm_pai').update({
        tipo, objetivos: objetivos.trim(), areas_intervencion: areas.trim(),
        profesionales_involucrados: profesionales.trim(), evaluacion: evaluacion.trim(),
        estado, updated_at: new Date().toISOString(),
      }).eq('id', editingId);
    } else {
      const { data: existing } = await supabase.from('crm_pai').select('version').eq('usuario_servicio_id', usuarioId).order('version', { ascending: false }).limit(1);
      const nextVersion = ((existing?.[0] as { version: number } | undefined)?.version ?? 0) + 1;
      await supabase.from('crm_pai').insert({
        usuario_servicio_id: usuarioId, tipo, version: nextVersion,
        objetivos: objetivos.trim(), areas_intervencion: areas.trim(),
        profesionales_involucrados: profesionales.trim(), evaluacion: evaluacion.trim(),
        estado, creado_por_nombre: autorNombre,
      });
    }
    setShowForm(false); setEditingId(null); setObjetivos(''); setAreas(''); setProfesionales(''); setEvaluacion(''); setEstado('borrador');
    await load();
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await supabase.from('crm_pai').delete().eq('id', id);
    await load();
  }

  function openEdit(p: Pai) {
    setEditingId(p.id); setTipo(p.tipo); setObjetivos(p.objetivos); setAreas(p.areas_intervencion);
    setProfesionales(p.profesionales_involucrados); setEvaluacion(p.evaluacion); setEstado(p.estado);
    setShowForm(true);
  }

  function togglePlanDocs(paiId: string) {
    if (expandedPlan === paiId) {
      setExpandedPlan(null);
    } else {
      setExpandedPlan(paiId);
      if (!docsByPlan[paiId]) loadDocs(paiId);
    }
  }

  function addFilesToQueue(incoming: FileList | File[]) {
    const arr = Array.from(incoming).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    setUploadQueue(prev => {
      const names = new Set(prev.map(f => f.name));
      return [...prev, ...arr.filter(f => !names.has(f.name))];
    });
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) addFilesToQueue(e.target.files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); e.stopPropagation();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFilesToQueue(e.dataTransfer.files);
  }

  async function handleUpload(paiId: string) {
    if (!uploadQueue.length) return;
    setUploading(true); setUploadError('');
    const prefix = `crm/pai/${paiId}/`;
    try {
      await ensureCrmFolder(prefix);
      const { data: userData } = await supabase.auth.getUser();
      const uploadedBy = userData.user?.id ?? null;
      const failed: File[] = [];
      for (const file of uploadQueue) {
        try {
          const key = `${prefix}${Date.now()}-${file.name}`;
          await uploadCrmFile(file, key);
          await supabase.from('crm_pai_documentos').insert({
            pai_id: paiId,
            nombre_archivo: file.name,
            wasabi_key: key,
            tamano_bytes: file.size,
            uploaded_by: uploadedBy,
          });
        } catch { failed.push(file); }
      }
      if (failed.length) {
        setUploadQueue(failed);
        setUploadError(`${failed.length} archivo(s) no se pudieron subir.`);
      } else {
        setUploadQueue([]);
      }
      await loadDocs(paiId);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'Error al subir archivos');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteDoc(doc: PaiDoc, paiId: string) {
    try {
      await deleteFromWasabi(doc.wasabi_key);
      await supabase.from('crm_pai_documentos').delete().eq('id', doc.id);
      await loadDocs(paiId);
    } catch (e) {
      console.error(e);
    }
  }

  async function handlePreviewDoc(doc: PaiDoc) {
    try {
      const url = await getWasabiBlobUrl(doc.wasabi_key);
      window.open(url, '_blank');
    } catch (e) { console.error(e); }
  }

  async function handleDownloadDoc(doc: PaiDoc) {
    try {
      await downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo);
    } catch (e) { console.error(e); }
  }

  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;
  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Planes de Atención Individualizada (PAI/PIE)</h3>
        <button onClick={() => { setEditingId(null); setTipo('PAI'); setObjetivos(''); setAreas(''); setProfesionales(''); setEvaluacion(''); setEstado('borrador'); setShowForm(true); }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
          <Plus size={12} />Nuevo plan
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8"><Clock size={20} className="mx-auto mb-2 animate-spin" style={{ color: '#0369A1' }} /></div>
      ) : planes.length === 0 ? (
        <div className="text-center py-8 rounded-xl" style={cardStyle}>
          <FileText size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>No hay planes creados</p>
        </div>
      ) : (
        <div className="space-y-3">
          {planes.map((p) => {
            const ec = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.borrador;
            const isExpanded = expandedPlan === p.id;
            const docs = docsByPlan[p.id] ?? [];
            return (
              <div key={p.id} className="rounded-xl p-4" style={cardStyle}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{p.tipo} v{p.version}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md" style={{ backgroundColor: ec.bg, color: ec.color }}>{ec.label}</span>
                    <span className="text-xs" style={{ color: '#94A3B8' }}>{p.fecha_creacion}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => togglePlanDocs(p.id)} className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md flex items-center gap-1" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
                      <FileText size={11} /> {docs.length > 0 ? `${docs.length} doc(s)` : 'Documentos'}
                    </button>
                    <button onClick={() => openEdit(p)} className="text-xs font-medium cursor-pointer px-2 py-1 rounded-md" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>Editar</button>
                    {isAdmin && <button onClick={() => handleDelete(p.id)} className="w-6 h-6 rounded-md flex items-center justify-center cursor-pointer hover:bg-red-50" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>}
                  </div>
                </div>
                {p.objetivos && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Objetivos</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.objetivos}</p></div>}
                {p.areas_intervencion && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Áreas de intervención</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.areas_intervencion}</p></div>}
                {p.profesionales_involucrados && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Profesionales involucrados</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.profesionales_involucrados}</p></div>}
                {p.evaluacion && <div className="mb-2"><p className="text-xs font-semibold mb-0.5" style={{ color: '#475569' }}>Evaluación</p><p className="text-sm" style={{ color: '#1E293B' }}>{p.evaluacion}</p></div>}
                {(p.fecha_revision || p.fecha_cierre) && (
                  <div className="flex gap-3 mt-2 pt-2 text-xs" style={{ borderTop: '1px solid #F1F5F9', color: '#94A3B8' }}>
                    {p.fecha_revision && <span>Revisión: {p.fecha_revision}</span>}
                    {p.fecha_cierre && <span>Cierre: {p.fecha_cierre}</span>}
                  </div>
                )}

                {/* Documents section */}
                {isExpanded && (
                  <div className="mt-3 pt-3" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <p className="text-xs font-semibold mb-2" style={{ color: '#475569' }}>Documentos PDF</p>

                    {/* Drag-and-drop zone */}
                    <div
                      onClick={() => !uploading && fileInputRef.current?.click()}
                      onDrop={handleDrop}
                      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); }}
                      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); }}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-all select-none mb-3"
                      style={{
                        border: `2px dashed ${dragOver ? '#0369A1' : '#CBD5E1'}`,
                        backgroundColor: dragOver ? '#EFF6FF' : '#F8FAFC',
                        padding: '20px 16px', minHeight: 90,
                      }}
                    >
                      <Upload size={22} style={{ color: dragOver ? '#0369A1' : '#94A3B8' }} />
                      <div className="text-center">
                        <p className="text-xs font-medium" style={{ color: '#475569' }}>Arrastra PDF aquí o haz clic para seleccionar</p>
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Solo archivos PDF</p>
                      </div>
                      <input ref={fileInputRef} type="file" accept="application/pdf,.pdf" multiple onChange={handleFileInput} disabled={uploading} className="hidden" />
                    </div>

                    {/* Upload queue */}
                    {uploadQueue.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        {uploadQueue.map(f => (
                          <div key={f.name} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <FileText size={13} style={{ color: '#DC2626', flexShrink: 0 }} />
                            <span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{f.name}</span>
                            <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{(f.size / 1024).toFixed(0)} KB</span>
                            {!uploading && (
                              <button onClick={e => { e.stopPropagation(); setUploadQueue(prev => prev.filter(x => x.name !== f.name)); }}
                                className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-slate-200">
                                <X size={11} style={{ color: '#94A3B8' }} />
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="flex items-center justify-between">
                          {uploadError ? (
                            <div className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} /> {uploadError}</div>
                          ) : <span className="text-xs" style={{ color: '#94A3B8' }}>{uploadQueue.length} archivo(s) listo(s)</span>}
                          <button onClick={() => handleUpload(p.id)} disabled={uploading}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all"
                            style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                            {uploading ? 'Subiendo...' : 'Subir'}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Existing documents */}
                    {docs.length === 0 ? (
                      <p className="text-xs text-center py-2" style={{ color: '#94A3B8' }}>No hay documentos adjuntos</p>
                    ) : (
                      <div className="space-y-1.5">
                        {docs.map(doc => (
                          <div key={doc.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <FileText size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                            <span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</span>
                            <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{(doc.tamano_bytes / 1024).toFixed(0)} KB</span>
                            <button onClick={() => handlePreviewDoc(doc)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-slate-200" title="Ver">
                              <FileText size={12} style={{ color: '#0369A1' }} />
                            </button>
                            <button onClick={() => handleDownloadDoc(doc)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-slate-200" title="Descargar">
                              <Download size={12} style={{ color: '#475569' }} />
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDeleteDoc(doc, p.id)} className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-red-50" title="Eliminar">
                                <Trash2 size={12} style={{ color: '#DC2626' }} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingId ? 'Editar plan' : 'Nuevo plan PAI/PIE'}</h3>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Tipo</label>
                  <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="PAI">PAI</option><option value="PIE">PIE</option>
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Estado</label>
                  <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    {Object.entries(ESTADO_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
              </div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Objetivos</label>
                <textarea value={objetivos} onChange={(e) => setObjetivos(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Objetivos generales y específicos..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Áreas de intervención</label>
                <textarea value={areas} onChange={(e) => setAreas(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} placeholder="Áreas a trabajar..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Profesionales involucrados</label>
                <input type="text" value={profesionales} onChange={(e) => setProfesionales(e.target.value)} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Ej: Psicología, Enfermería, Trabajo Social..." /></div>
              <div><label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>Evaluación</label>
                <textarea value={evaluacion} onChange={(e) => setEvaluacion(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{saving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
