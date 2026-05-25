import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Upload, Search, Download, Eye, Trash2, X,
  AlertCircle, RefreshCw, File, Image, FileSpreadsheet,
  User, FolderOpen, FolderLock, Cloud, CloudOff, FolderPlus, CheckCircle2
} from 'lucide-react';
import { supabase, DocumentRecord, UserProfile } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';
import { saveBlob, getBlob, deleteBlob } from './lib/indexedDB';
import { writeAuditLog } from './lib/auditLog';
import { uploadToWasabi, listWasabiFolder, deleteFromWasabi, initWasabiFolder, WasabiObject } from './lib/wasabi';
import { AppRole } from './context/AuthContext';

const ACCEPTED_TYPES = [
  'application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

type Folder = 'publico' | 'privado';

// A unified file entry: either from Supabase DB or Wasabi-only
interface FileEntry {
  id: string;            // doc id or wasabi key
  nombre: string;
  tipo: string;
  size: number;
  fecha: Date;
  source: 'db' | 'wasabi';
  wasabiKey?: string;    // full wasabi object key e.g. "privado/1234-file.png"
  dbRecord?: DocumentRecord;
  idbKey?: string;
  uploaderNombre?: string;
  destinoEmail?: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function getFileIcon(tipo: string) {
  if (tipo.includes('pdf')) return { Icon: FileText, color: '#DC2626', bg: '#FEF2F2' };
  if (tipo.includes('image')) return { Icon: Image, color: '#0EA5E9', bg: '#F0F9FF' };
  if (tipo.includes('sheet') || tipo.includes('excel') || tipo.includes('spreadsheet'))
    return { Icon: FileSpreadsheet, color: '#16A34A', bg: '#F0FDF4' };
  return { Icon: File, color: '#64748B', bg: '#F8FAFC' };
}

function guessTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'application/pdf';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  if (['xlsx', 'xls'].includes(ext)) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (['docx', 'doc'].includes(ext)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/octet-stream';
}

// ─── Preview modal ────────────────────────────────────────────────────────────

function PreviewModal({ entry, onClose }: { entry: FileEntry; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let objectUrl: string | null = null;
    (async () => {
      if (entry.idbKey) {
        const blob = await getBlob(entry.idbKey);
        if (blob) { objectUrl = URL.createObjectURL(blob); setUrl(objectUrl); }
      }
      setLoading(false);
    })();
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [entry.idbKey]);

  const tipo = entry.tipo || guessTypeFromName(entry.nombre);
  const { Icon, color } = getFileIcon(tipo);
  const isPDF = tipo.includes('pdf');
  const isImage = tipo.includes('image');

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-3">
            <Icon size={18} style={{ color }} />
            <div>
              <h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{entry.nombre}</h2>
              <p className="text-xs" style={{ color: '#94A3B8' }}>
                {formatBytes(entry.size)} · {entry.fecha.toLocaleDateString('es-ES')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {url && (
              <a href={url} download={entry.nombre}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                <Download size={13} /> Descargar
              </a>
            )}
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              <X size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden flex items-center justify-center"
          style={{ backgroundColor: '#F8FAFC', minHeight: '400px' }}>
          {loading ? (
            <RefreshCw size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
          ) : !url ? (
            <div className="flex flex-col items-center gap-3 p-8">
              <CloudOff size={36} style={{ color: '#CBD5E1' }} />
              <p className="text-sm font-medium" style={{ color: '#64748B' }}>Archivo almacenado en Wasabi</p>
              <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
                La previsualización solo está disponible para archivos subidos en esta sesión.<br />
                Descarga el archivo para verlo.
              </p>
            </div>
          ) : isPDF ? (
            <iframe src={url} className="w-full h-full border-0" style={{ minHeight: '500px' }} title={entry.nombre} />
          ) : isImage ? (
            <img src={url} alt={entry.nombre} className="max-w-full max-h-full object-contain p-4" />
          ) : (
            <div className="flex flex-col items-center gap-3 p-8">
              <Icon size={48} style={{ color }} />
              <p className="text-sm font-medium" style={{ color: '#1E293B' }}>{entry.nombre}</p>
              <a href={url} download={entry.nombre}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer"
                style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                <Download size={14} /> Descargar archivo
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload modal ─────────────────────────────────────────────────────────────

function UploadModal({
  profile, societyId, allUsers, targetFolder, onClose, onUploaded,
}: {
  profile: UserProfile;
  societyId: string;
  allUsers: UserProfile[];
  targetFolder: Folder;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [folder, setFolder] = useState<Folder>(targetFolder);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const employees = allUsers.filter((u) => u.role === 'employee');
  const targetUser = allUsers.find((u) => u.id === targetUserId);

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    const valid = Array.from(fl).filter((f) => ACCEPTED_TYPES.includes(f.type));
    setFiles((prev) => [...prev, ...valid]);
  };

  const handleUpload = async () => {
    if (files.length === 0) { setError('Selecciona al menos un archivo'); return; }
    setLoading(true);
    setError('');
    try {
      for (const file of files) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const wasabiKey = `${folder}/${Date.now()}-${sanitized}`;

        await uploadToWasabi(file, wasabiKey);

        const idbKey = `doc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        await saveBlob(idbKey, file);

        const { error: dbErr } = await supabase.from('documents').insert({
          nombre_archivo: file.name,
          tipo: file.type || 'application/octet-stream',
          folder,
          usuario_destino_id: targetUserId || null,
          usuario_destino_email: targetUser?.email ?? '',
          society_id: societyId,
          subido_por: profile.id,
          subido_por_nombre: profile.nombre,
          tamano_bytes: file.size,
          indexeddb_key: idbKey,
          wasabi_key: wasabiKey,
        });
        if (dbErr) throw dbErr;

        await writeAuditLog({
          evento: 'document_uploaded',
          descripcion: `Documento subido en carpeta "${folder}": ${file.name}${targetUser ? ` para ${targetUser.email}` : ''}`,
          autor: profile,
          entidad: 'document',
          metadata: { nombre_archivo: file.name, folder, wasabi_key: wasabiKey, usuario_destino: targetUser?.email ?? null },
          society_id: societyId,
        });
      }
      onUploaded();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-lg w-full mx-4 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex items-center justify-between"
          style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-white" />
            <h2 className="text-white font-semibold">Subir Documentos</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
            style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Folder selector */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
              Carpeta de destino
            </label>
            <div className="flex gap-2">
              {(['publico', 'privado'] as Folder[]).map((f) => {
                const isActive = folder === f;
                const FolderIcon = f === 'privado' ? FolderLock : FolderOpen;
                return (
                  <button key={f} onClick={() => setFolder(f)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150"
                    style={{
                      backgroundColor: isActive ? (f === 'privado' ? '#FEF2F2' : '#F0FDF4') : '#F8FAFC',
                      color: isActive ? (f === 'privado' ? '#DC2626' : '#16A34A') : '#64748B',
                      border: `1.5px solid ${isActive ? (f === 'privado' ? '#FECACA' : '#BBF7D0') : '#E2E8F0'}`,
                    }}>
                    <FolderIcon size={15} />
                    {f === 'publico' ? 'Publico' : 'Privado'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Optional target user */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
              Usuario destino{' '}
              <span style={{ color: '#94A3B8', textTransform: 'none', fontWeight: 400 }}>(opcional)</span>
            </label>
            <div className="relative">
              <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer appearance-none"
                style={{ border: '1.5px solid #E2E8F0', color: targetUserId ? '#1E293B' : '#94A3B8', backgroundColor: '#F8FAFC' }}>
                <option value="">Toda la sociedad (sin usuario específico)</option>
                {employees.map((u) => <option key={u.id} value={u.id}>{u.nombre} — {u.email}</option>)}
              </select>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center py-8 rounded-xl cursor-pointer transition-all duration-200"
            style={{ border: `2px dashed ${dragging ? '#0F172A' : '#CBD5E1'}`, backgroundColor: dragging ? '#F8FAFC' : 'transparent' }}>
            <input ref={fileRef} type="file" multiple accept={ACCEPTED_TYPES.join(',')} className="hidden"
              onChange={(e) => addFiles(e.target.files)} />
            <Upload size={24} style={{ color: '#94A3B8' }} />
            <p className="text-sm font-medium mt-2" style={{ color: '#1E293B' }}>Arrastra archivos o haz clic aqui</p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>PDF, Imagenes, Excel, Word</p>
          </div>

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2 max-h-36 overflow-y-auto">
              {files.map((f, i) => {
                const { Icon, color, bg } = getFileIcon(f.type);
                return (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-xl"
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: bg }}>
                      <Icon size={13} style={{ color }} />
                    </div>
                    <p className="text-xs flex-1 truncate" style={{ color: '#1E293B' }}>{f.name}</p>
                    <p className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>{formatBytes(f.size)}</p>
                    <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="w-5 h-5 flex items-center justify-center cursor-pointer flex-shrink-0"
                      style={{ color: '#94A3B8' }}>
                      <X size={12} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button onClick={handleUpload} disabled={loading || files.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0F172A' }}>
              {loading
                ? <><RefreshCw size={14} className="animate-spin" /> Subiendo...</>
                : <><Upload size={14} /> Subir {files.length > 1 ? `${files.length} archivos` : 'archivo'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Folder panel ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

function FolderPanel({
  folder, dbEntries, canManage, wasabiError: parentWasabiError,
  onPreview, onDownload, onDelete, deleting, search, onUpload, onRefresh,
}: {
  folder: Folder;
  dbEntries: FileEntry[];        // already-loaded DB entries from parent
  canManage: boolean;
  wasabiError: boolean;
  onPreview: (e: FileEntry) => void;
  onDownload: (e: FileEntry) => void;
  onDelete: (e: FileEntry) => void;
  deleting: string | null;
  search: string;
  onUpload: () => void;
  onRefresh: () => void;
}) {
  const isPrivado = folder === 'privado';
  const FolderIcon = isPrivado ? FolderLock : FolderOpen;
  const folderColor = isPrivado ? '#DC2626' : '#16A34A';
  const folderBg = isPrivado ? '#FEF2F2' : '#F0FDF4';
  const folderBorder = isPrivado ? '#FECACA' : '#BBF7D0';

  const [expanded, setExpanded] = useState(false);
  const [wasabiObjs, setWasabiObjs] = useState<WasabiObject[]>([]);
  const [wasabiLoading, setWasabiLoading] = useState(false);
  const [wasabiError, setWasabiError] = useState(false);
  const [page, setPage] = useState(0);
  const loadedRef = useRef(false);

  const loadWasabi = async () => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    setWasabiLoading(true);
    setWasabiError(false);
    try {
      const objs = await listWasabiFolder(folder);
      setWasabiObjs(objs);
    } catch {
      setWasabiError(true);
    } finally {
      setWasabiLoading(false);
    }
  };

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadWasabi();
  };

  const handleRefresh = () => {
    loadedRef.current = false;
    setWasabiObjs([]);
    setPage(0);
    loadWasabi();
    onRefresh();
  };

  // Merge DB + Wasabi entries — deduplicate by wasabi_key (exact key match)
  const trackedKeys = new Set(dbEntries.map((d) => d.wasabiKey).filter(Boolean));
  const wasabiOnly: FileEntry[] = wasabiObjs
    .filter((w) => !trackedKeys.has(w.key) && w.nombre !== '.keep')
    .map((w) => ({
      id: w.key,
      nombre: w.nombre,
      tipo: guessTypeFromName(w.nombre),
      size: w.size,
      fecha: w.lastModified,
      source: 'wasabi' as const,
      wasabiKey: w.key,
    }));
  const allEntries = [...dbEntries, ...wasabiOnly].sort((a, b) => b.fecha.getTime() - a.fecha.getTime());

  const filtered = allEntries.filter(
    (e) => !search || e.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="rounded-2xl overflow-hidden flex flex-col"
      style={{ backgroundColor: '#FFFFFF', border: `1px solid ${folderBorder}` }}>
      {/* Folder header — click to expand */}
      <button
        onClick={handleExpand}
        className="px-5 py-4 flex items-center gap-3 w-full text-left cursor-pointer transition-opacity hover:opacity-90"
        style={{ backgroundColor: folderBg, borderBottom: expanded ? `1px solid ${folderBorder}` : 'none' }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${folderColor}15`, border: `1px solid ${folderBorder}` }}>
          <FolderIcon size={20} style={{ color: folderColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold" style={{ color: folderColor }}>
              {isPrivado ? 'Privado' : 'Publico'}
            </p>
            {expanded && (wasabiError || parentWasabiError) ? (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FDE68A' }}>
                <CloudOff size={10} /> sin conexion
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${folderColor}10`, color: folderColor, border: `1px solid ${folderBorder}` }}>
                <Cloud size={10} /> Wasabi
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: folderColor, opacity: 0.7 }}>
            {isPrivado ? 'Solo visible para Admin / RRHH' : 'Accesible para todos los empleados'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full"
            style={{ backgroundColor: `${folderColor}15`, color: folderColor, border: `1px solid ${folderBorder}` }}>
            {allEntries.length} archivo{allEntries.length !== 1 ? 's' : ''}
          </span>
          {expanded && (
            <button onClick={handleRefresh}
              className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity"
              style={{ backgroundColor: `${folderColor}15`, color: folderColor }}
              title="Actualizar carpeta">
              <RefreshCw size={13} />
            </button>
          )}
          {canManage && (
            <button onClick={(e) => { e.stopPropagation(); onUpload(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150 hover:opacity-80"
              style={{ backgroundColor: folderColor, color: '#FFFFFF' }}>
              <Upload size={12} /> Subir
            </button>
          )}
          <div className="w-5 h-5 flex items-center justify-center"
            style={{ color: folderColor, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
      </button>

      {/* File list — only visible when expanded */}
      {expanded && (
        wasabiLoading ? (
          <div className="flex items-center justify-center gap-2 py-10">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>Cargando archivos...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2">
            <FolderIcon size={32} style={{ color: '#E2E8F0' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {search ? 'Sin resultados' : 'Carpeta vacía'}
            </p>
            {!search && canManage && (
              <button onClick={onUpload}
                className="flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all duration-150"
                style={{ backgroundColor: folderBg, color: folderColor, border: `1px solid ${folderBorder}` }}>
                <Upload size={12} /> Subir primer archivo
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {paginated.map((entry) => {
                const tipo = entry.tipo || guessTypeFromName(entry.nombre);
                const { Icon, color, bg } = getFileIcon(tipo);
                const isDeleting = deleting === entry.id;
                return (
                  <div key={entry.id}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors duration-100">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: bg }}>
                      <Icon size={14} style={{ color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{entry.nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>
                        {formatBytes(entry.size)}
                        {entry.uploaderNombre && ` · ${entry.uploaderNombre}`}
                        {` · ${entry.fecha.toLocaleDateString('es-ES')}`}
                        {entry.destinoEmail && ` · ${entry.destinoEmail}`}
                      </p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{
                        backgroundColor: entry.source === 'db' ? '#F0F9FF' : '#F8FAFC',
                        color: entry.source === 'db' ? '#0EA5E9' : '#94A3B8',
                        border: `1px solid ${entry.source === 'db' ? '#BAE6FD' : '#E2E8F0'}`,
                      }}>
                      {entry.source === 'db' ? 'DB' : 'Wasabi'}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => onPreview(entry)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                        title="Previsualizar">
                        <Eye size={13} style={{ color: '#64748B' }} />
                      </button>
                      <button onClick={() => onDownload(entry)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                        title="Descargar">
                        <Download size={13} style={{ color: '#64748B' }} />
                      </button>
                      {canManage && (
                        <button onClick={() => onDelete(entry)} disabled={isDeleting}
                          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Eliminar">
                          {isDeleting
                            ? <RefreshCw size={12} className="animate-spin" style={{ color: '#DC2626' }} />
                            : <Trash2 size={13} style={{ color: '#DC2626' }} />}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-5 py-3 flex items-center justify-between"
                style={{ borderTop: `1px solid ${folderBorder}`, backgroundColor: folderBg }}>
                <span className="text-xs" style={{ color: folderColor }}>
                  {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: `${folderColor}15`, color: folderColor, border: `1px solid ${folderBorder}` }}>
                    Anterior
                  </button>
                  <span className="text-xs font-semibold" style={{ color: folderColor }}>
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="px-3 py-1 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 transition-opacity"
                    style={{ backgroundColor: `${folderColor}15`, color: folderColor, border: `1px solid ${folderBorder}` }}>
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  currentUserRole: AppRole;
  userEmail?: string;
}

export default function DocumentsModule({ currentUserRole, userEmail }: Props) {
  const { profile: authProfile } = useAuth();
  const { activeSocietyId } = useSociety();

  // Use real profile when available; otherwise build a synthetic one from the email prop
  const profile: UserProfile = authProfile ?? {
    id: 'local',
    nombre: userEmail?.split('@')[0] ?? currentUserRole,
    email: userEmail ?? `${currentUserRole}@empresa.com`,
    role: currentUserRole,
    activo: true,
    societies: [],
    invited_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const [dbDocs, setDbDocs] = useState<DocumentRecord[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [wasabiError] = useState(false);
  const [search, setSearch] = useState('');
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFolder, setUploadFolder] = useState<Folder>('publico');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [initializingFolders, setInitializingFolders] = useState(false);
  const [foldersInitialized, setFoldersInitialized] = useState(false);

  const canManage = currentUserRole === 'admin' || currentUserRole === 'rrhh';

  // Only loads DB records — Wasabi is fetched lazily per folder on expand
  const loadAll = useCallback(async () => {
    try {
      let query = supabase.from('documents').select('*').order('fecha_subida', { ascending: false });
      if (!canManage) {
        query = query.eq('society_id', activeSocietyId).eq('folder', 'publico');
      } else {
        query = query.eq('society_id', activeSocietyId);
      }
      const { data } = await query;
      setDbDocs((data ?? []) as DocumentRecord[]);
    } catch {
      // non-fatal
    }
  }, [activeSocietyId, canManage]);

  const loadUsers = useCallback(async () => {
    const { data } = await supabase.from('user_profiles').select('*').eq('role', 'employee');
    setAllUsers((data ?? []) as UserProfile[]);
  }, []);

  useEffect(() => {
    loadAll();
    if (canManage) loadUsers();
  }, [loadAll, loadUsers, canManage]);

  // Build DB-only entries per folder; Wasabi objects are merged inside FolderPanel
  function buildDbEntries(folder: Folder): FileEntry[] {
    return dbDocs
      .filter((d) => d.folder === folder)
      .map((d) => ({
        id: d.id,
        nombre: d.nombre_archivo,
        tipo: d.tipo,
        size: d.tamano_bytes,
        fecha: new Date(d.fecha_subida),
        source: 'db' as const,
        idbKey: d.indexeddb_key,
        wasabiKey: d.wasabi_key ?? undefined,
        dbRecord: d,
        uploaderNombre: d.subido_por_nombre,
        destinoEmail: d.usuario_destino_email || undefined,
      }));
  }

  const handleDelete = async (entry: FileEntry) => {
    if (!window.confirm(`¿Eliminar "${entry.nombre}"?`)) return;
    setDeleting(entry.id);
    try {
      if (entry.dbRecord) {
        if (entry.idbKey) await deleteBlob(entry.idbKey);
        await supabase.from('documents').delete().eq('id', entry.dbRecord.id);
      }
      // Also delete from Wasabi if we have the key
      const keyToDelete = entry.wasabiKey ?? (entry.dbRecord
        ? `${entry.dbRecord.folder}/${entry.dbRecord.indexeddb_key}` // fallback — may not match
        : null);
      if (keyToDelete && entry.source === 'wasabi') {
        await deleteFromWasabi(keyToDelete);
      }
      if (profile && entry.dbRecord) {
        await writeAuditLog({
          evento: 'document_deleted',
          descripcion: `Documento eliminado: ${entry.nombre}`,
          autor: profile,
          entidad: 'document',
          entidad_id: entry.dbRecord.id,
          metadata: { nombre_archivo: entry.nombre, folder: entry.dbRecord.folder },
          society_id: entry.dbRecord.society_id,
        });
      }
      await loadAll();
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (entry: FileEntry) => {
    // Try IndexedDB first (locally cached)
    if (entry.idbKey) {
      const blob = await getBlob(entry.idbKey);
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = entry.nombre; a.click();
        URL.revokeObjectURL(url);
        return;
      }
    }
    // Fall back to edge function proxy for Wasabi files
    const key = entry.wasabiKey ?? (entry.dbRecord ? `${entry.dbRecord.folder}/${entry.dbRecord.wasabi_key ?? entry.dbRecord.indexeddb_key}` : null);
    if (!key) { alert('No se puede descargar: clave de archivo desconocida.'); return; }
    const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wasabi-download?key=${encodeURIComponent(key)}`;
    const a = document.createElement('a');
    a.href = proxyUrl;
    a.download = entry.nombre;
    a.click();
  };

  const handleInitFolders = async () => {
    setInitializingFolders(true);
    try {
      await Promise.all([
        initWasabiFolder('publico'),
        initWasabiFolder('privado'),
      ]);
      setFoldersInitialized(true);
      await loadAll();
    } catch {
      // loadAll will set wasabiError if needed
      setFoldersInitialized(false);
    } finally {
      setInitializingFolders(false);
    }
  };

  const openUpload = (folder: Folder) => { setUploadFolder(folder); setShowUpload(true); };

  const publicDbEntries = buildDbEntries('publico');
  const privateDbEntries = buildDbEntries('privado');

  return (
    <>
      {previewEntry && <PreviewModal entry={previewEntry} onClose={() => setPreviewEntry(null)} />}
      {showUpload && (
        <UploadModal
          profile={profile}
          societyId={activeSocietyId}
          allUsers={allUsers}
          targetFolder={uploadFolder}
          onClose={() => setShowUpload(false)}
          onUploaded={loadAll}
        />
      )}

      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Documentos</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              Haz clic en una carpeta para cargar sus archivos
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canManage && (
              <button
                onClick={handleInitFolders}
                disabled={initializingFolders || foldersInitialized}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: foldersInitialized ? '#F0FDF4' : '#0F172A', color: foldersInitialized ? '#16A34A' : '#FFFFFF', border: foldersInitialized ? '1px solid #BBF7D0' : 'none' }}
                title="Crea las carpetas Publico y Privado en Wasabi"
              >
                {initializingFolders
                  ? <><RefreshCw size={14} className="animate-spin" /> Creando...</>
                  : foldersInitialized
                  ? <><CheckCircle2 size={14} /> Carpetas creadas</>
                  : <><FolderPlus size={14} /> Crear carpetas</>}
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar en todas las carpetas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>

        {/* Folder list */}
        <div className="flex flex-col gap-4">
          <FolderPanel
            folder="publico"
            dbEntries={publicDbEntries}
            canManage={canManage}
            wasabiError={wasabiError}
            onPreview={setPreviewEntry}
            onDownload={handleDownload}
            onDelete={handleDelete}
            deleting={deleting}
            search={search}
            onUpload={() => openUpload('publico')}
            onRefresh={loadAll}
          />
          {canManage && (
            <FolderPanel
              folder="privado"
              dbEntries={privateDbEntries}
              canManage={canManage}
              wasabiError={wasabiError}
              onPreview={setPreviewEntry}
              onDownload={handleDownload}
              onDelete={handleDelete}
              deleting={deleting}
              search={search}
              onUpload={() => openUpload('privado')}
              onRefresh={loadAll}
            />
          )}
        </div>
      </div>
    </>
  );
}
