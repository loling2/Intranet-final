import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen, FolderPlus, Folder, FileText, Upload, Trash2,
  RefreshCw, AlertCircle, CheckCircle2, X, Download,
  ChevronRight, Search, Plus, Tag, Lock, Globe, Building2, Eye,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { uploadToWasabiKey, downloadFromWasabi, getWasabiBlobUrl } from '../lib/wasabi';
import { useAuth } from '../context/AuthContext';
import { useSociety } from '../context/SocietyContext';

const MAX_TAGS = 5;

interface DeptRow {
  id: string;
  nombre: string;
}

interface PrlFolder {
  id: string;
  nombre: string;
  descripcion: string;
  society_id: string;
  created_by: string | null;
  access_tag_id: string | null;
  created_at: string;
  _docCount?: number;
  _tags?: TagRow[];
  _depts?: DeptRow[];
}

interface PrlDocument {
  id: string;
  folder_id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tipo: string;
  tamano_bytes: number;
  subido_por_nombre: string;
  society_id: string;
  created_at: string;
}

interface TagRow {
  id: string;
  nombre: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function fileIcon(tipo: string) {
  if (tipo.includes('pdf')) return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
  if (tipo.includes('word') || tipo.includes('document')) return { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
  if (tipo.includes('sheet') || tipo.includes('excel')) return { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
  if (tipo.includes('image')) return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
  return { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
}

// ─── Document Preview Modal ───────────────────────────────────────────────────

function PreviewModal({ doc, onClose }: { doc: PrlDocument; onClose: () => void }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let url: string | null = null;
    getWasabiBlobUrl(doc.wasabi_key)
      .then((u) => { url = u; setBlobUrl(u); })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error al cargar'))
      .finally(() => setLoading(false));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [doc.wasabi_key]);

  const isPdf = doc.tipo.includes('pdf');
  const isImage = doc.tipo.includes('image');

  return (
    <div className="fixed inset-0 z-[400] flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0" style={{ backgroundColor: '#0F172A', borderBottom: '1px solid #1E293B' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#1E293B' }}>
            <Eye size={15} style={{ color: '#94A3B8' }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{doc.nombre_archivo}</p>
            <p className="text-xs" style={{ color: '#64748B' }}>{doc.subido_por_nombre} &middot; {new Date(doc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-700 flex-shrink-0 ml-4"
          style={{ color: '#94A3B8' }}>
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center overflow-hidden p-4">
        {loading && (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>Cargando previa...</p>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle size={24} style={{ color: '#DC2626' }} />
            <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>
          </div>
        )}
        {blobUrl && isPdf && (
          <iframe
            src={blobUrl}
            title={doc.nombre_archivo}
            className="w-full h-full rounded-xl"
            style={{ maxWidth: '960px', border: 'none' }}
          />
        )}
        {blobUrl && isImage && (
          <img
            src={blobUrl}
            alt={doc.nombre_archivo}
            className="max-w-full max-h-full rounded-xl object-contain"
            style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
          />
        )}
        {blobUrl && !isPdf && !isImage && (
          <div className="flex flex-col items-center gap-4 text-center p-8 rounded-2xl" style={{ backgroundColor: '#1E293B' }}>
            <FileText size={48} style={{ color: '#64748B' }} />
            <p className="text-sm font-medium text-white">Este tipo de archivo no se puede previsualizar</p>
            <p className="text-xs" style={{ color: '#64748B' }}>{doc.tipo || 'Tipo desconocido'}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create / Edit Folder Modal ───────────────────────────────────────────────

function FolderModal({ onClose, onSaved, societyId, existing }: {
  onClose: () => void;
  onSaved: () => void;
  societyId: string;
  existing?: PrlFolder;
}) {
  const { profile } = useAuth();
  const [nombre, setNombre] = useState(existing?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(existing?.descripcion ?? '');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    existing?._tags?.map((t) => t.id) ?? (existing?.access_tag_id ? [existing.access_tag_id] : [])
  );
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>(
    existing?._depts?.map((d) => d.id) ?? []
  );
  const [tags, setTags] = useState<TagRow[]>([]);
  const [depts, setDepts] = useState<DeptRow[]>([]);
  const [tagsLoading, setTagsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEdit = !!existing;

  useEffect(() => {
    (async () => {
      const [tagsRes, deptsRes] = await Promise.all([
        supabase.from('tags').select('id, nombre').order('nombre'),
        supabase.from('departamentos_prl').select('id, nombre').order('nombre'),
      ]);
      setTags(tagsRes.data ?? []);
      setDepts(deptsRes.data ?? []);
      setTagsLoading(false);
    })();
  }, []);

  const toggleTag = (id: string) => {
    setSelectedTagIds((prev) => {
      if (prev.includes(id)) return prev.filter((t) => t !== id);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, id];
    });
  };

  const toggleDept = (id: string) => {
    setSelectedDeptIds((prev) => {
      if (prev.includes(id)) return prev.filter((d) => d !== id);
      if (prev.length >= MAX_TAGS) return prev;
      return [...prev, id];
    });
  };

  const handleSave = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return; }
    setSaving(true); setError('');

    try {
      let folderId = existing?.id;

      if (isEdit) {
        const { error: upErr } = await supabase
          .from('prl_folders')
          .update({ nombre: nombre.trim(), descripcion: descripcion.trim(), access_tag_id: selectedTagIds[0] ?? null })
          .eq('id', folderId!);
        if (upErr) throw upErr;
      } else {
        const { data, error: insErr } = await supabase
          .from('prl_folders')
          .insert({
            nombre: nombre.trim(),
            descripcion: descripcion.trim(),
            society_id: societyId,
            created_by: profile?.id ?? null,
            access_tag_id: selectedTagIds[0] ?? null,
          })
          .select('id')
          .single();
        if (insErr) throw insErr;
        folderId = data.id;
      }

      // Sync prl_folder_tags
      const { error: delTagErr } = await supabase.from('prl_folder_tags').delete().eq('folder_id', folderId!);
      if (delTagErr) throw delTagErr;
      if (selectedTagIds.length > 0) {
        const rows = selectedTagIds.slice(0, MAX_TAGS).map((tag_id) => ({ folder_id: folderId!, tag_id }));
        const { error: insTagErr } = await supabase.from('prl_folder_tags').insert(rows);
        if (insTagErr) throw insTagErr;
      }

      // Sync prl_folder_departamentos
      const { error: delDeptErr } = await supabase.from('prl_folder_departamentos').delete().eq('folder_id', folderId!);
      if (delDeptErr) throw delDeptErr;
      if (selectedDeptIds.length > 0) {
        const deptRows = selectedDeptIds.slice(0, MAX_TAGS).map((departamento_prl_id) => ({ folder_id: folderId!, departamento_prl_id }));
        const { error: insDeptErr } = await supabase.from('prl_folder_departamentos').insert(deptRows);
        if (insDeptErr) throw insDeptErr;
      }

      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-start sm:items-center justify-center overflow-y-auto py-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #064E3B, #065F46)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <FolderPlus size={16} className="text-white" />
            </div>
            <h2 className="text-white font-semibold text-sm">{isEdit ? 'Editar carpeta PRL' : 'Nueva carpeta PRL'}</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Nombre */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre *</label>
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              placeholder="Ej: Evaluaciones de Riesgo 2024"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: `1.5px solid ${error ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          {/* Descripcion */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Descripcion (opcional)</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Breve descripcion del contenido"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          {/* Tags de acceso */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                Tags de acceso
              </label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: selectedTagIds.length >= MAX_TAGS ? '#FEF2F2' : '#ECFDF5',
                  color: selectedTagIds.length >= MAX_TAGS ? '#DC2626' : '#065F46',
                  border: `1px solid ${selectedTagIds.length >= MAX_TAGS ? '#FECACA' : '#6EE7B7'}`,
                }}>
                {selectedTagIds.length}/{MAX_TAGS}
              </span>
            </div>
            <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>
              Solo trabajadores con alguno de estos tags podran ver esta carpeta. Sin tag = acceso libre.
            </p>

            {tagsLoading ? (
              <div className="flex items-center gap-2 py-3">
                <RefreshCw size={13} className="animate-spin" style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#94A3B8' }}>Cargando tags...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Sin restriccion */}
                <button
                  type="button"
                  onClick={() => setSelectedTagIds([])}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                  style={{
                    border: `1.5px solid ${selectedTagIds.length === 0 ? '#065F46' : '#E2E8F0'}`,
                    backgroundColor: selectedTagIds.length === 0 ? '#ECFDF5' : '#F8FAFC',
                  }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: selectedTagIds.length === 0 ? '#065F46' : '#E2E8F0' }}>
                    <Globe size={13} style={{ color: selectedTagIds.length === 0 ? '#FFFFFF' : '#94A3B8' }} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold" style={{ color: '#1E293B' }}>Sin restriccion</span>
                    <span className="block text-xs" style={{ color: '#94A3B8' }}>Todos los trabajadores pueden acceder</span>
                  </div>
                  {selectedTagIds.length === 0 && <CheckCircle2 size={14} className="ml-auto" style={{ color: '#065F46' }} />}
                </button>

                {/* Tags list */}
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {tags.length === 0 ? (
                    <p className="text-xs px-3 py-2" style={{ color: '#94A3B8' }}>No hay tags creados. Crea tags en Admin → Tags PRL.</p>
                  ) : tags.map((tag) => {
                    const selected = selectedTagIds.includes(tag.id);
                    const disabled = !selected && selectedTagIds.length >= MAX_TAGS;
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        disabled={disabled}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          border: `1.5px solid ${selected ? '#0369A1' : '#E2E8F0'}`,
                          backgroundColor: selected ? '#EFF6FF' : '#F8FAFC',
                        }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: selected ? '#0369A1' : '#E2E8F0' }}>
                          <Tag size={12} style={{ color: selected ? '#FFFFFF' : '#94A3B8' }} />
                        </div>
                        <span className="font-medium flex-1 text-left" style={{ color: '#1E293B' }}>{tag.nombre}</span>
                        {selected && <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: '#0369A1' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected tags preview */}
            {selectedTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedTagIds.map((id) => {
                  const tag = tags.find((t) => t.id === id);
                  if (!tag) return null;
                  return (
                    <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                      <Lock size={9} />
                      {tag.nombre}
                      <button
                        type="button"
                        onClick={() => toggleTag(id)}
                        className="ml-0.5 cursor-pointer hover:opacity-70"
                        style={{ color: '#1D4ED8' }}>
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {selectedTagIds.length >= MAX_TAGS && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={12} style={{ color: '#DC2626' }} />
                <p className="text-xs" style={{ color: '#DC2626' }}>Maximo {MAX_TAGS} tags por carpeta</p>
              </div>
            )}
          </div>

          {/* Departamentos PRL */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>
                Departamentos PRL
              </label>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: selectedDeptIds.length >= MAX_TAGS ? '#FEF2F2' : '#F0FDF4',
                  color: selectedDeptIds.length >= MAX_TAGS ? '#DC2626' : '#15803D',
                  border: `1px solid ${selectedDeptIds.length >= MAX_TAGS ? '#FECACA' : '#BBF7D0'}`,
                }}>
                {selectedDeptIds.length}/{MAX_TAGS}
              </span>
            </div>
            <p className="text-xs mb-2" style={{ color: '#94A3B8' }}>
              Solo empleados de estos departamentos podran ver esta carpeta. Sin departamento = sin filtro por departamento.
            </p>

            {tagsLoading ? (
              <div className="flex items-center gap-2 py-3">
                <RefreshCw size={13} className="animate-spin" style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#94A3B8' }}>Cargando departamentos...</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                {/* Sin restriccion */}
                <button
                  type="button"
                  onClick={() => setSelectedDeptIds([])}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer"
                  style={{
                    border: `1.5px solid ${selectedDeptIds.length === 0 ? '#15803D' : '#E2E8F0'}`,
                    backgroundColor: selectedDeptIds.length === 0 ? '#F0FDF4' : '#F8FAFC',
                  }}
                >
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: selectedDeptIds.length === 0 ? '#15803D' : '#E2E8F0' }}>
                    <Globe size={13} style={{ color: selectedDeptIds.length === 0 ? '#FFFFFF' : '#94A3B8' }} />
                  </div>
                  <div className="text-left">
                    <span className="font-semibold" style={{ color: '#1E293B' }}>Sin restriccion</span>
                    <span className="block text-xs" style={{ color: '#94A3B8' }}>Sin filtro por departamento</span>
                  </div>
                  {selectedDeptIds.length === 0 && <CheckCircle2 size={14} className="ml-auto" style={{ color: '#15803D' }} />}
                </button>

                {/* Dept list */}
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {depts.length === 0 ? (
                    <p className="text-xs px-3 py-2" style={{ color: '#94A3B8' }}>No hay departamentos PRL. Crealos en la pestaña Departamentos PRL.</p>
                  ) : depts.map((dept) => {
                    const selected = selectedDeptIds.includes(dept.id);
                    const disabled = !selected && selectedDeptIds.length >= MAX_TAGS;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => toggleDept(dept.id)}
                        disabled={disabled}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{
                          border: `1.5px solid ${selected ? '#15803D' : '#E2E8F0'}`,
                          backgroundColor: selected ? '#F0FDF4' : '#F8FAFC',
                        }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: selected ? '#15803D' : '#E2E8F0' }}>
                          <Building2 size={12} style={{ color: selected ? '#FFFFFF' : '#94A3B8' }} />
                        </div>
                        <span className="font-medium flex-1 text-left" style={{ color: '#1E293B' }}>{dept.nombre}</span>
                        {selected && <CheckCircle2 size={14} className="flex-shrink-0" style={{ color: '#15803D' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Selected depts preview */}
            {selectedDeptIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {selectedDeptIds.map((id) => {
                  const dept = depts.find((d) => d.id === id);
                  if (!dept) return null;
                  return (
                    <span key={id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                      <Building2 size={9} />
                      {dept.nombre}
                      <button
                        type="button"
                        onClick={() => toggleDept(id)}
                        className="ml-0.5 cursor-pointer hover:opacity-70"
                        style={{ color: '#15803D' }}>
                        <X size={10} />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {selectedDeptIds.length >= MAX_TAGS && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg mt-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={12} style={{ color: '#DC2626' }} />
                <p className="text-xs" style={{ color: '#DC2626' }}>Maximo {MAX_TAGS} departamentos por carpeta</p>
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1 sticky bottom-0 bg-white pb-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
            <button onClick={handleSave} disabled={saving || !nombre.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#065F46' }}>
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <FolderPlus size={14} />}
              {isEdit ? 'Guardar cambios' : 'Crear carpeta'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ────────────────────────────────────────────────────

function ConfirmDeleteModal({ title, description, onConfirm, onClose, loading }: {
  title: string; description: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
            <Trash2 size={18} style={{ color: '#DC2626' }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{title}</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{description}</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#DC2626' }}>
            {loading ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function PrlDocsModule() {
  const { profile } = useAuth();
  const { activeSocietyId } = useSociety();

  const [folders, setFolders] = useState<PrlFolder[]>([]);
  const [documents, setDocuments] = useState<Record<string, PrlDocument[]>>({});
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState<Record<string, boolean>>({});
  const [expandedFolder, setExpandedFolder] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [editingFolder, setEditingFolder] = useState<PrlFolder | null>(null);

  const [uploadingFolder, setUploadingFolder] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ type: 'folder' | 'doc'; id: string; name: string; folderId?: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<PrlDocument | null>(null);

  const canPreview = profile?.role === 'admin' || profile?.role === 'prevencion';

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    const { data, error: err } = await supabase
      .from('prl_folders')
      .select('*, prl_folder_tags(tag_id, tags(id, nombre)), prl_folder_departamentos(departamento_prl_id, departamentos_prl(id, nombre))')
      .eq('society_id', activeSocietyId)
      .order('nombre');
    if (err) { setError(err.message); setLoadingFolders(false); return; }

    const folderList = (data ?? []) as (PrlFolder & {
      prl_folder_tags: { tag_id: string; tags: { id: string; nombre: string } | null }[];
      prl_folder_departamentos: { departamento_prl_id: string; departamentos_prl: { id: string; nombre: string } | null }[];
    })[];

    const counts = await Promise.all(
      folderList.map((f) =>
        supabase.from('prl_documents').select('id', { count: 'exact', head: true }).eq('folder_id', f.id)
      )
    );

    const enriched: PrlFolder[] = folderList.map((f, i) => ({
      id: f.id,
      nombre: f.nombre,
      descripcion: f.descripcion,
      society_id: f.society_id,
      created_by: f.created_by,
      access_tag_id: f.access_tag_id,
      created_at: f.created_at,
      _docCount: counts[i].count ?? 0,
      _tags: (f.prl_folder_tags ?? [])
        .map((ft) => ft.tags)
        .filter((t): t is { id: string; nombre: string } => t !== null),
      _depts: (f.prl_folder_departamentos ?? [])
        .map((fd) => fd.departamentos_prl)
        .filter((d): d is { id: string; nombre: string } => d !== null),
    }));

    setFolders(enriched);
    setLoadingFolders(false);
  }, [activeSocietyId]);

  useEffect(() => { loadFolders(); }, [loadFolders]);

  const loadDocs = useCallback(async (folderId: string) => {
    setLoadingDocs((prev) => ({ ...prev, [folderId]: true }));
    const { data, error: err } = await supabase
      .from('prl_documents')
      .select('*')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });
    if (!err) setDocuments((prev) => ({ ...prev, [folderId]: (data ?? []) as PrlDocument[] }));
    setLoadingDocs((prev) => ({ ...prev, [folderId]: false }));
  }, []);

  const toggleFolder = (folderId: string) => {
    if (expandedFolder === folderId) { setExpandedFolder(null); return; }
    setExpandedFolder(folderId);
    if (!documents[folderId]) loadDocs(folderId);
  };

  const handleFilesSelected = async (files: FileList | File[], folderId: string) => {
    // Convert to Array immediately so the FileList isn't invalidated when the input is cleared
    const fileArray = Array.from(files);
    if (!fileArray.length) return;
    setUploadingFolder(folderId);
    setError('');
    let uploaded = 0;

    const folderObj = folders.find((f) => f.id === folderId);
    const resolvedSocietyId = folderObj?.society_id ?? activeSocietyId;

    for (let i = 0; i < fileArray.length; i++) {
      const file = fileArray[i];
      const ts = Date.now() + i; // +i guarantees unique key even if multiple files start same ms
      const key = `prevencion/${resolvedSocietyId}/${folderId}/${ts}-${file.name}`;
      try {
        setUploadProgress((p) => ({ ...p, [folderId]: Math.round((i / fileArray.length) * 100) }));
        await uploadToWasabiKey(file, key);
        const { error: insertErr } = await supabase.from('prl_documents').insert({
          folder_id: folderId,
          nombre_archivo: file.name,
          wasabi_key: key,
          tipo: file.type,
          tamano_bytes: file.size,
          subido_por: profile?.id ?? null,
          subido_por_nombre: profile?.nombre ?? '',
          society_id: resolvedSocietyId,
        });
        if (insertErr) throw new Error(`DB: ${insertErr.message}`);
        uploaded++;
      } catch (e: unknown) {
        setError(`Error al subir "${file.name}": ${e instanceof Error ? e.message : 'Error desconocido'}`);
      }
    }

    setUploadProgress((p) => ({ ...p, [folderId]: 100 }));
    setTimeout(() => setUploadProgress((p) => { const n = { ...p }; delete n[folderId]; return n; }), 1500);
    setUploadingFolder(null);
    await loadDocs(folderId);
    await loadFolders();
    if (uploaded > 0) {
      flash(`${uploaded} archivo${uploaded > 1 ? 's' : ''} subido${uploaded > 1 ? 's' : ''} correctamente`);
      // Notify employees in the folder's society
      const uploadedFolderObj = folders.find((f) => f.id === folderId);
      const societyId = uploadedFolderObj?.society_id ?? activeSocietyId;
      if (societyId) {
        const { data: emps } = await supabase
          .from('empleados')
          .select('user_id')
          .eq('id_sociedad', societyId)
          .eq('activo', true)
          .not('user_id', 'is', null);
        if (emps && emps.length > 0) {
          const folderName = uploadedFolderObj?.nombre ?? 'Documentos PRL';
          await supabase.from('notificaciones_empleado').insert(
            emps.map((e: { user_id: string }) => ({
              user_id: e.user_id,
              tipo: 'prl',
              titulo: 'Nuevo documento PRL',
              descripcion: `Se ha publicado un nuevo documento en la carpeta "${folderName}".`,
              leida: false,
            }))
          );
        }
      }
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.type === 'folder') {
        const { error: err } = await supabase.from('prl_folders').delete().eq('id', deleteTarget.id);
        if (err) throw err;
        setDocuments((prev) => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
        if (expandedFolder === deleteTarget.id) setExpandedFolder(null);
        await loadFolders();
        flash(`Carpeta "${deleteTarget.name}" eliminada`);
      } else {
        const { error: err } = await supabase.from('prl_documents').delete().eq('id', deleteTarget.id);
        if (err) throw err;
        setDocuments((prev) => ({
          ...prev,
          [deleteTarget.folderId!]: (prev[deleteTarget.folderId!] ?? []).filter((d) => d.id !== deleteTarget.id),
        }));
        await loadFolders();
        flash(`Archivo "${deleteTarget.name}" eliminado`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleDownload = async (doc: PrlDocument) => {
    try {
      await downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al descargar');
    }
  };

  const filtered = folders.filter((f) => !search || f.nombre.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-5">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files && uploadingFolder) {
            const fileArray = Array.from(e.target.files); // copy before clearing
            e.target.value = '';
            handleFilesSelected(fileArray, uploadingFolder);
          } else {
            e.target.value = '';
          }
        }}
      />

      {showCreateFolder && (
        <FolderModal
          onClose={() => setShowCreateFolder(false)}
          onSaved={loadFolders}
          societyId={activeSocietyId}
        />
      )}
      {editingFolder && (
        <FolderModal
          onClose={() => setEditingFolder(null)}
          onSaved={loadFolders}
          societyId={activeSocietyId}
          existing={editingFolder}
        />
      )}
      {previewDoc && (
        <PreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
      )}
      {deleteTarget && (
        <ConfirmDeleteModal
          title={deleteTarget.type === 'folder' ? 'Eliminar carpeta' : 'Eliminar archivo'}
          description={
            deleteTarget.type === 'folder'
              ? `Se eliminara "${deleteTarget.name}" y todos sus archivos. Esta accion no se puede deshacer.`
              : `Se eliminara "${deleteTarget.name}" permanentemente.`
          }
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteTarget(null)}
          loading={deleting}
        />
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Documentos PRL</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            {folders.length} carpeta{folders.length !== 1 ? 's' : ''} &middot; Haz clic en una carpeta para ver o subir archivos
          </p>
        </div>
        <button
          onClick={() => setShowCreateFolder(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90"
          style={{ backgroundColor: '#065F46', boxShadow: '0 4px 12px rgba(6,95,70,0.3)' }}
        >
          <FolderPlus size={15} /> Crear carpeta
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <AlertCircle size={15} /><span className="flex-1">{error}</span>
          <button onClick={() => setError('')} className="cursor-pointer"><X size={13} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46' }}>
          <CheckCircle2 size={15} /><span>{success}</span>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en todas las carpetas..."
          className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Folders list */}
      {loadingFolders ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-20 rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFDF5' }}>
            <Folder size={32} style={{ color: '#6EE7B7' }} />
          </div>
          <p className="text-base font-semibold" style={{ color: '#1E293B' }}>
            {search ? 'Sin resultados' : 'Sin carpetas creadas'}
          </p>
          <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>
            {search ? 'Prueba con otro termino' : 'Crea una carpeta para empezar a subir documentos'}
          </p>
          {!search && (
            <button onClick={() => setShowCreateFolder(true)}
              className="mt-5 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
              style={{ backgroundColor: '#065F46' }}>
              <Plus size={14} /> Crear primera carpeta
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((folder) => {
            const isOpen = expandedFolder === folder.id;
            const docs = documents[folder.id] ?? [];
            const isLoadingDocs = loadingDocs[folder.id];
            const progress = uploadProgress[folder.id];
            const folderTags = folder._tags ?? [];
            const folderDepts = folder._depts ?? [];
            const hasTag = folderTags.length > 0;
            const hasDept = folderDepts.length > 0;

            const isDragOver = dragOverFolder === folder.id;

            return (
              <div key={folder.id} className="rounded-2xl overflow-hidden transition-all duration-200"
                style={{ backgroundColor: '#FFFFFF', border: `1px solid ${isDragOver ? '#065F46' : isOpen ? '#6EE7B7' : '#E2E8F0'}` }}
                onDragOver={(e) => { e.preventDefault(); setDragOverFolder(folder.id); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverFolder(null); }}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverFolder(null);
                  if (e.dataTransfer.files.length) {
                    const fileArray = Array.from(e.dataTransfer.files);
                    if (!isOpen) {
                      setExpandedFolder(folder.id);
                      if (!documents[folder.id]) loadDocs(folder.id);
                    }
                    handleFilesSelected(fileArray, folder.id);
                  }
                }}
              >

                {/* Drag-over overlay hint */}
                {isDragOver && (
                  <div className="px-5 py-2 flex items-center gap-2 text-xs font-semibold"
                    style={{ backgroundColor: '#ECFDF5', borderBottom: '1px solid #6EE7B7', color: '#065F46' }}>
                    <Upload size={12} /> Suelta aqui para subir
                  </div>
                )}

                {/* Folder header row */}
                <div
                  className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 transition-colors duration-150"
                  onClick={() => toggleFolder(folder.id)}
                  style={{ backgroundColor: isDragOver ? '#F0FDF9' : isOpen ? '#F0FDF9' : undefined }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: isOpen ? '#065F46' : '#ECFDF5', border: `1px solid ${isOpen ? '#065F46' : '#6EE7B7'}` }}>
                    {isOpen
                      ? <FolderOpen size={18} className="text-white" />
                      : <Folder size={18} style={{ color: '#065F46' }} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{folder.nombre}</p>
                      {/* Tag badges */}
                      {hasTag && folderTags.map((tag) => (
                        <span key={tag.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                          <Lock size={9} />
                          {tag.nombre}
                        </span>
                      ))}
                      {/* Dept badges */}
                      {hasDept && folderDepts.map((dept) => (
                        <span key={dept.id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                          <Building2 size={9} />
                          {dept.nombre}
                        </span>
                      ))}
                      {!hasTag && !hasDept && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs"
                          style={{ backgroundColor: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                          <Globe size={9} />
                          Libre
                        </span>
                      )}
                    </div>
                    {folder.descripcion && (
                      <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{folder.descripcion}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
                      {folder._docCount ?? 0} archivo{folder._docCount !== 1 ? 's' : ''}
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setUploadingFolder(folder.id);
                        fileInputRef.current?.click();
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 hover:opacity-80"
                      style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}
                      title="Subir archivos"
                    >
                      <Upload size={12} /> Subir
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingFolder(folder); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-blue-50"
                      title="Editar carpeta"
                      style={{ color: '#CBD5E1' }}
                    >
                      <Tag size={13} />
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'folder', id: folder.id, name: folder.nombre });
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-red-50"
                      title="Eliminar carpeta"
                      style={{ color: '#CBD5E1' }}
                    >
                      <Trash2 size={13} />
                    </button>

                    <ChevronRight size={16} className="transition-transform duration-200"
                      style={{ color: '#94A3B8', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }} />
                  </div>
                </div>

                {/* Upload progress bar */}
                {progress !== undefined && (
                  <div className="px-5 pb-2">
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0' }}>
                      <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, backgroundColor: '#065F46' }} />
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#065F46' }}>Subiendo... {progress}%</p>
                  </div>
                )}

                {/* Folder contents */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                    {isLoadingDocs ? (
                      <div className="flex items-center justify-center py-8">
                        <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
                      </div>
                    ) : docs.length === 0 ? (
                      <div className="flex flex-col items-center py-10">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: '#ECFDF5' }}>
                          <FileText size={22} style={{ color: '#6EE7B7' }} />
                        </div>
                        <p className="text-sm font-medium" style={{ color: '#64748B' }}>Carpeta vacia</p>
                        <button
                          onClick={() => { setUploadingFolder(folder.id); fileInputRef.current?.click(); }}
                          className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
                          style={{ backgroundColor: '#065F46', color: '#FFFFFF' }}>
                          <Upload size={12} /> Subir primer archivo
                        </button>
                      </div>
                    ) : (
                      <div className="divide-y" style={{ borderColor: '#E2E8F0' }}>
                        <div className="px-5 py-2.5 flex items-center justify-between">
                          <p className="text-xs" style={{ color: '#94A3B8' }}>
                            {docs.length} archivo{docs.length !== 1 ? 's' : ''} &middot; Arrastra archivos a la carpeta o usa el boton Subir
                          </p>
                        </div>
                        {docs.map((doc) => {
                          const fc = fileIcon(doc.tipo);
                          return (
                            <div key={doc.id} className="px-5 py-3 flex items-center gap-3 hover:bg-white transition-colors duration-100">
                              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: fc.bg, border: `1px solid ${fc.border}` }}>
                                <FileText size={14} style={{ color: fc.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</p>
                                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                                  {formatBytes(doc.tamano_bytes)}
                                  {doc.subido_por_nombre && ` \u00b7 ${doc.subido_por_nombre}`}
                                  {` \u00b7 ${new Date(doc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}`}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {canPreview && (
                                  <button
                                    onClick={() => setPreviewDoc(doc)}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-blue-50"
                                    title="Previsualizar"
                                    style={{ color: '#94A3B8' }}>
                                    <Eye size={13} />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownload(doc)}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-green-50"
                                  title="Descargar"
                                  style={{ color: '#94A3B8' }}>
                                  <Download size={13} />
                                </button>
                                <button
                                  onClick={() => setDeleteTarget({ type: 'doc', id: doc.id, name: doc.nombre_archivo, folderId: folder.id })}
                                  className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:bg-red-50"
                                  title="Eliminar"
                                  style={{ color: '#CBD5E1' }}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
