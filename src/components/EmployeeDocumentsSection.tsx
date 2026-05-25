import { useState, useEffect, useRef } from 'react';
import { FolderOpen, FolderLock, Upload, Trash2, FileText, Image, FileSpreadsheet, File, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { uploadToWasabi } from '../lib/wasabi';
import { writeAuditLog } from '../lib/auditLog';

interface EmployeeDoc {
  id: string;
  employee_id: string;
  society_id: string;
  folder: 'publica' | 'privada';
  nombre: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  subido_por_nombre: string;
  created_at: string;
}

interface Props {
  employeeId: string;
  employeeNombre: string;
  societyId: string;
  viewerRole: 'admin' | 'rrhh' | 'employee';
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return Image;
  if (mime.includes('pdf')) return FileText;
  if (mime.includes('sheet') || mime.includes('excel') || mime.includes('csv')) return FileSpreadsheet;
  return File;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

type ActiveFolder = 'publica' | 'privada';

export default function EmployeeDocumentsSection({ employeeId, employeeNombre, societyId, viewerRole }: Props) {
  const { profile } = useAuth();
  const [docs, setDocs] = useState<EmployeeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<ActiveFolder>('publica');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canManage = viewerRole === 'admin' || viewerRole === 'rrhh';

  const loadDocs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('employee_documents')
      .select('*')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false });
    setDocs((data ?? []) as EmployeeDoc[]);
    setLoading(false);
  };

  useEffect(() => { loadDocs(); }, [employeeId]);

  const handleUpload = async (file: File) => {
    if (!profile) return;
    setUploading(true);
    setUploadError('');
    try {
      const path = `empleados/${employeeId}/${activeFolder}/${Date.now()}-${file.name}`;
      await uploadToWasabi(file, path);

      const { error } = await supabase.from('employee_documents').insert({
        employee_id: employeeId,
        society_id: societyId,
        folder: activeFolder,
        nombre: file.name,
        storage_path: path,
        mime_type: file.type || 'application/octet-stream',
        size_bytes: file.size,
        subido_por: profile.id,
        subido_por_nombre: profile.nombre,
      });
      if (error) throw error;

      await writeAuditLog({
        evento: 'employee_doc_upload',
        descripcion: `Documento "${file.name}" subido a carpeta ${activeFolder} de ${employeeNombre}`,
        autor: profile,
        entidad: 'employee_document',
        metadata: { empleado_id: employeeId, empleado: employeeNombre, folder: activeFolder, nombre: file.name },
        society_id: societyId,
      });

      await loadDocs();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (doc: EmployeeDoc) => {
    if (!profile) return;
    const { error } = await supabase.from('employee_documents').delete().eq('id', doc.id);
    if (!error) {
      await writeAuditLog({
        evento: 'employee_doc_delete',
        descripcion: `Documento "${doc.nombre}" eliminado de carpeta ${doc.folder} de ${employeeNombre}`,
        autor: profile,
        entidad: 'employee_document',
        metadata: { empleado_id: employeeId, empleado: employeeNombre, folder: doc.folder, nombre: doc.nombre },
        society_id: societyId,
      });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    }
  };

  const visibleFolders: ActiveFolder[] = canManage ? ['publica', 'privada'] : ['publica'];
  const folderDocs = docs.filter((d) => d.folder === activeFolder);

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
        <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Documentos del Empleado</h4>
        {canManage && (
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 hover:opacity-90"
            style={{ backgroundColor: uploading ? '#F1F5F9' : '#0F172A', color: uploading ? '#94A3B8' : '#FFFFFF' }}>
            {uploading ? <RefreshCw size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Subiendo...' : 'Subir'}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              disabled={uploading}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ''; }}
            />
          </label>
        )}
      </div>

      {/* Folder tabs */}
      <div className="flex gap-1 p-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
        {visibleFolders.map((folder) => {
          const isActive = activeFolder === folder;
          const FolderIcon = folder === 'privada' ? FolderLock : FolderOpen;
          const count = docs.filter((d) => d.folder === folder).length;
          return (
            <button
              key={folder}
              onClick={() => setActiveFolder(folder)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-200 cursor-pointer"
              style={{
                backgroundColor: isActive ? (folder === 'privada' ? '#FEF2F2' : '#F0FDF4') : 'transparent',
                color: isActive ? (folder === 'privada' ? '#DC2626' : '#16A34A') : '#64748B',
                border: isActive ? `1px solid ${folder === 'privada' ? '#FECACA' : '#BBF7D0'}` : '1px solid transparent',
              }}
            >
              <FolderIcon size={13} />
              {folder === 'publica' ? 'Publica' : 'Privada'}
              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold"
                style={{ backgroundColor: isActive ? (folder === 'privada' ? '#FECACA' : '#BBF7D0') : '#E2E8F0', color: isActive ? (folder === 'privada' ? '#991B1B' : '#15803D') : '#64748B' }}>
                {count}
              </span>
              {folder === 'privada' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: '#FEF3C7', color: '#B45309' }}>
                  Solo RRHH
                </span>
              )}
            </button>
          );
        })}
      </div>

      {uploadError && (
        <div className="mx-4 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertCircle size={13} style={{ color: '#DC2626' }} />
          <p className="text-xs" style={{ color: '#DC2626' }}>{uploadError}</p>
        </div>
      )}

      {/* Document list */}
      <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : folderDocs.length === 0 ? (
          <div className="px-5 py-8 text-center">
            <p className="text-xs" style={{ color: '#94A3B8' }}>No hay documentos en esta carpeta</p>
          </div>
        ) : (
          folderDocs.map((doc) => {
            const DocIcon = fileIcon(doc.mime_type);
            return (
              <div key={doc.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <DocIcon size={14} style={{ color: '#64748B' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{doc.nombre}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>
                    {formatBytes(doc.size_bytes)} &middot; {doc.subido_por_nombre} &middot; {new Date(doc.created_at).toLocaleDateString('es-ES')}
                  </p>
                </div>
                {canManage && (
                  <button
                    onClick={() => handleDelete(doc)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:opacity-80"
                    style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
                    title="Eliminar"
                  >
                    <Trash2 size={12} style={{ color: '#DC2626' }} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
