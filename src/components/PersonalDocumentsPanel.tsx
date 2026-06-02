import { useState, useEffect, useRef } from 'react';
import {
  Search, User, FolderOpen, FileText, Upload, Download, Eye,
  ChevronRight, X, Loader2, AlertCircle, Lock, Globe, Plus,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  listRrhhEmployeeFiles, ensureRrhhFolder, uploadToWasabiKey,
  getWasabiBlobUrl, downloadFromWasabi, listNominasForDni,
  type RrhhFile,
} from '../lib/wasabi';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  nombre: string;
  dni: string | null;
  email: string;
}

type FolderType = 'privado' | 'publico';

interface UploadModal {
  folder: FolderType;
  anio?: string;
  mes?: string;
}

// ─── Wasabi client (reused from lib but we need direct listing) ──────────────

const wasabiClient = new S3Client({
  endpoint: import.meta.env.VITE_WASABI_ENDPOINT as string,
  region: 'eu-central-2',
  credentials: {
    accessKeyId: import.meta.env.VITE_WASABI_ACCESS_KEY as string,
    secretAccessKey: import.meta.env.VITE_WASABI_SECRET_KEY as string,
  },
  forcePathStyle: true,
});

const BUCKET = import.meta.env.VITE_WASABI_BUCKET_NAME as string;

async function listPrefix(prefix: string): Promise<RrhhFile[]> {
  const resp = await wasabiClient.send(
    new ListObjectsV2Command({ Bucket: BUCKET, Prefix: prefix })
  );
  return (resp.Contents ?? [])
    .filter(o => o.Key && !o.Key.endsWith('/') && !o.Key.endsWith('.keep'))
    .map(o => ({
      key: o.Key!,
      name: o.Key!.replace(prefix, ''),
      size: o.Size ?? 0,
      lastModified: o.LastModified ?? new Date(),
    }));
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  /** If provided, panel acts in employee self-service mode (only shows that employee's docs) */
  employeeDni?: string;
  /** If provided, panel acts in RRHH admin mode showing all employees */
  isRrhh?: boolean;
}

export default function PersonalDocumentsPanel({ employeeDni, isRrhh = false }: Props) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderType>('privado');
  const [files, setFiles] = useState<RrhhFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [uploadModal, setUploadModal] = useState<UploadModal | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load employees list (RRHH mode)
  useEffect(() => {
    if (!isRrhh) return;
    supabase
      .from('empleados')
      .select('id, nombre, dni, email')
      .eq('activo', true)
      .order('nombre')
      .then(({ data }) => setEmployees((data as Employee[]) ?? []));
  }, [isRrhh]);

  // If employee self-service mode, auto-select by DNI
  useEffect(() => {
    if (employeeDni && !isRrhh) {
      setSelected({ id: '', nombre: '', dni: employeeDni, email: '' });
    }
  }, [employeeDni, isRrhh]);

  // Load files when employee or folder changes
  useEffect(() => {
    if (!selected?.dni) { setFiles([]); return; }
    loadFiles(selected.dni, activeFolder);
  }, [selected, activeFolder]);

  async function loadFiles(dni: string, folder: FolderType) {
    setLoadingFiles(true);
    setFiles([]);
    try {
      if (folder === 'privado') {
        const folderKey = `rrhh/privado/${dni}-${sanitizeName(selected?.nombre ?? '')}/`;
        await ensureRrhhFolder(folderKey);
        const result = await listRrhhEmployeeFiles(folderKey);
        setFiles(result);
      } else {
        // publico = nominas, list all matching DNI
        const result = await listNominasForDni(dni);
        setFiles(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
  }

  function sanitizeName(nombre: string) {
    return nombre.replace(/[^a-zA-Z0-9ÁáÉéÍíÓóÚúÑñ ]/g, '').trim();
  }

  async function handlePreview(file: RrhhFile) {
    setLoadingPreview(true);
    setPreviewName(file.name);
    try {
      const url = await getWasabiBlobUrl(file.key);
      setPreviewUrl(url);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !selected?.dni || !uploadModal) return;
    const file = e.target.files[0];
    setUploading(true);
    setUploadError('');
    try {
      let key: string;
      if (uploadModal.folder === 'privado') {
        const folderKey = `rrhh/privado/${selected.dni}-${sanitizeName(selected.nombre)}/`;
        await ensureRrhhFolder(folderKey);
        key = `${folderKey}${file.name}`;
        await uploadToWasabiKey(file, key);
      } else {
        // nomina
        const y = uploadModal.anio ?? anio;
        const m = uploadModal.mes ?? mes;
        // ensure year/month folders
        for (const fk of [`rrhh/publico/${y}/`, `rrhh/publico/${y}/${m}/`]) {
          await ensureRrhhFolder(fk);
        }
        key = `rrhh/publico/${y}/${m}/${selected.dni}.pdf`;
        await uploadToWasabiKey(file, key);
      }
      setUploadModal(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFiles(selected.dni, activeFolder);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  const filteredEmployees = employees.filter(e =>
    !search ||
    e.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (e.dni ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const months = [
    '01','02','03','04','05','06','07','08','09','10','11','12'
  ];
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

  return (
    <div className="flex gap-0 rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', minHeight: 520 }}>

      {/* ── Left: employee list (RRHH only) ── */}
      {isRrhh && (
        <div className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: '#E2E8F0' }}>
          <div className="p-4 border-b" style={{ borderColor: '#E2E8F0' }}>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 rounded-lg text-sm outline-none"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredEmployees.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelected(emp)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-b"
                style={{
                  borderColor: '#F1F5F9',
                  backgroundColor: selected?.id === emp.id ? '#EFF6FF' : 'transparent',
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: selected?.id === emp.id ? '#0369A1' : '#E2E8F0' }}>
                  <User size={14} style={{ color: selected?.id === emp.id ? '#FFFFFF' : '#64748B' }} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni ?? 'Sin DNI'}</p>
                </div>
                {selected?.id === emp.id && <ChevronRight size={14} className="ml-auto flex-shrink-0" style={{ color: '#0369A1' }} />}
              </button>
            ))}
            {filteredEmployees.length === 0 && (
              <p className="text-center text-sm py-8" style={{ color: '#94A3B8' }}>Sin resultados</p>
            )}
          </div>
        </div>
      )}

      {/* ── Right: document area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <FolderOpen size={40} style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>Selecciona un empleado para ver sus documentos</p>
          </div>
        ) : (
          <>
            {/* Employee header */}
            <div className="px-6 py-4 border-b flex items-center justify-between gap-4" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
                  <User size={18} style={{ color: '#0369A1' }} />
                </div>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{selected.nombre || 'Empleado'}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>DNI: {selected.dni ?? '—'}</p>
                </div>
              </div>
              {isRrhh && (
                <button
                  onClick={() => setUploadModal({ folder: activeFolder, anio, mes })}
                  disabled={!selected.dni}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                >
                  <Upload size={14} />
                  Subir documento
                </button>
              )}
            </div>

            {/* Folder tabs */}
            <div className="flex gap-1 px-6 pt-4 pb-2">
              {(['privado', 'publico'] as FolderType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setActiveFolder(f)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor: activeFolder === f ? (f === 'privado' ? '#0369A1' : '#0F172A') : '#F1F5F9',
                    color: activeFolder === f ? '#FFFFFF' : '#475569',
                  }}
                >
                  {f === 'privado' ? <Lock size={13} /> : <Globe size={13} />}
                  {f === 'privado' ? 'Privado (documentos)' : 'Nóminas'}
                </button>
              ))}
            </div>

            {/* Files list */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}>
                  <Loader2 size={18} className="animate-spin" /> Cargando...
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FolderOpen size={32} style={{ color: '#CBD5E1' }} />
                  <p className="text-sm" style={{ color: '#94A3B8' }}>
                    {activeFolder === 'privado' ? 'No hay documentos en esta carpeta' : 'No hay nóminas registradas'}
                  </p>
                  {isRrhh && selected.dni && (
                    <button
                      onClick={() => setUploadModal({ folder: activeFolder, anio, mes })}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer mt-1"
                      style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}
                    >
                      <Plus size={12} /> Subir primer documento
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-2">
                  {files.map(file => (
                    <div
                      key={file.key}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
                      style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: '#EFF6FF' }}>
                        <FileText size={16} style={{ color: '#0369A1' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{file.name}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>
                          {formatSize(file.size)} · {file.lastModified.toLocaleDateString('es-ES')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => handlePreview(file)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-blue-100"
                          title="Ver"
                          style={{ color: '#0369A1' }}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => downloadFromWasabi(file.key, file.name)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-slate-100"
                          title="Descargar"
                          style={{ color: '#475569' }}
                        >
                          <Download size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Upload modal ── */}
      {uploadModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#E2E8F0' }}>
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                Subir {uploadModal.folder === 'privado' ? 'documento privado' : 'nómina'} — {selected.nombre}
              </h3>
              <button onClick={() => { setUploadModal(null); setUploadError(''); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100">
                <X size={16} style={{ color: '#64748B' }} />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {uploadModal.folder === 'publico' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Año</label>
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
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  {uploadModal.folder === 'publico' ? 'Archivo PDF de la nómina' : 'Documento'}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={uploadModal.folder === 'publico' ? 'application/pdf' : undefined}
                  onChange={handleUpload}
                  disabled={uploading}
                  className="w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:cursor-pointer"
                  style={{ color: '#475569' }}
                />
              </div>
              {uploading && (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#0369A1' }}>
                  <Loader2 size={14} className="animate-spin" /> Subiendo...
                </div>
              )}
              {uploadError && (
                <div className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={14} /> {uploadError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── PDF Preview modal ── */}
      {(previewUrl || loadingPreview) && (
        <div className="fixed inset-0 z-50 flex flex-col" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div className="flex items-center justify-between px-6 py-3 flex-shrink-0"
            style={{ backgroundColor: '#0F172A' }}>
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
            <iframe
              src={previewUrl!}
              className="flex-1 w-full"
              style={{ border: 'none' }}
              title={previewName}
            />
          )}
        </div>
      )}
    </div>
  );
}
