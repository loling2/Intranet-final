import { useState, useEffect, useRef } from 'react';
import {
  Search, User, FolderOpen, FileText, Upload, Download, Eye,
  ChevronRight, X, Loader2, AlertCircle, Lock, Globe, Plus, Building2,
  UserX,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  listRrhhEmployeeFiles, ensureRrhhFolder, uploadToWasabiKey,
  getWasabiBlobUrl, downloadFromWasabi, listNominasForDni,
  listBajasEmployeeFiles,
  type RrhhFile,
} from '../lib/wasabi';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  nombre: string;
  dni: string | null;
  email: string;
  id_sociedad: string | null;
  activo: boolean;
}

interface Sociedad {
  id: string;
  nombre: string;
}

type FolderType = 'privado' | 'publico';
type ViewMode = 'activos' | 'bajas';

interface UploadModal {
  folder: FolderType;
  anio?: string;
  mes?: string;
}

// ─── Wasabi client (local for direct listing) ────────────────────────────────

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
  employeeDni?: string;
  isRrhh?: boolean;
}

export default function PersonalDocumentsPanel({ employeeDni, isRrhh = false }: Props) {
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [selectedSociedadId, setSelectedSociedadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('activos');
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

  // Load employees and societies
  useEffect(() => {
    if (!isRrhh) return;
    Promise.all([
      supabase.from('empleados').select('id, nombre, dni, email, id_sociedad, activo').order('nombre'),
      supabase.from('sociedades').select('id, nombre').order('nombre'),
    ]).then(([empRes, socRes]) => {
      setAllEmployees((empRes.data as Employee[]) ?? []);
      setSociedades((socRes.data as Sociedad[]) ?? []);
    });
  }, [isRrhh]);

  // Self-service mode
  useEffect(() => {
    if (employeeDni && !isRrhh) {
      setSelected({ id: '', nombre: '', dni: employeeDni, email: '', id_sociedad: null, activo: true });
    }
  }, [employeeDni, isRrhh]);

  // Load files when selection changes
  useEffect(() => {
    if (!selected?.dni) { setFiles([]); return; }
    loadFiles(selected, activeFolder);
  }, [selected, activeFolder]);

  function sanitizeName(nombre: string) {
    return nombre.replace(/[^a-zA-Z0-9ÁáÉéÍíÓóÚúÑñ ]/g, '').trim();
  }

  function slugify(text: string) {
    return text
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim().replace(/\s+/g, '_');
  }

  function getSociedadSlug(emp: Employee): string {
    const soc = sociedades.find(s => s.id === emp.id_sociedad);
    return soc ? slugify(soc.nombre) : 'sin_sociedad';
  }

  async function loadFiles(emp: Employee, folder: FolderType) {
    if (!emp.dni) { setFiles([]); return; }
    setLoadingFiles(true);
    setFiles([]);
    try {
      if (!emp.activo) {
        // Baja employee — files come from rrhh/bajas/<sociedad>/<dni>-<nombre>/
        const slug = getSociedadSlug(emp);
        const result = await listBajasEmployeeFiles(slug, emp.dni, sanitizeName(emp.nombre));
        setFiles(result);
      } else if (folder === 'privado') {
        const folderKey = `rrhh/privado/${emp.dni}-${sanitizeName(emp.nombre)}/`;
        await ensureRrhhFolder(folderKey);
        const result = await listRrhhEmployeeFiles(folderKey);
        setFiles(result);
      } else {
        const result = await listNominasForDni(emp.dni);
        setFiles(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
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
        const y = uploadModal.anio ?? anio;
        const m = uploadModal.mes ?? mes;
        for (const fk of [`rrhh/publico/${y}/`, `rrhh/publico/${y}/${m}/`]) {
          await ensureRrhhFolder(fk);
        }
        key = `rrhh/publico/${y}/${m}/${selected.dni}.pdf`;
        await uploadToWasabiKey(file, key);
      }
      setUploadModal(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadFiles(selected, activeFolder);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(false);
    }
  }

  // Filter employees based on view mode, society, and search
  const employees = allEmployees.filter(e => {
    if (viewMode === 'activos' && !e.activo) return false;
    if (viewMode === 'bajas' && e.activo) return false;
    if (selectedSociedadId && e.id_sociedad !== selectedSociedadId) return false;
    if (search && !e.nombre.toLowerCase().includes(search.toLowerCase()) && !(e.dni ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  const isBaja = selected && !selected.activo;

  return (
    <>
    <div className="flex gap-0 rounded-2xl overflow-hidden" translate="no" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', minHeight: 520 }}>

      {/* ── Left: employee list (RRHH only) ── */}
      {isRrhh && (
        <div className="w-72 flex-shrink-0 border-r flex flex-col" style={{ borderColor: '#E2E8F0' }}>

          {/* Society filter chips */}
          <div className="p-3 border-b flex flex-wrap gap-1.5" style={{ borderColor: '#E2E8F0' }}>
            <button
              onClick={() => { setSelectedSociedadId(null); setSelected(null); }}
              className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: selectedSociedadId === null ? '#0F172A' : '#F1F5F9',
                color: selectedSociedadId === null ? '#FFFFFF' : '#475569',
              }}
            >
              Todas
            </button>
            {sociedades.map(s => (
              <button
                key={s.id}
                onClick={() => { setSelectedSociedadId(s.id); setSelected(null); }}
                className="px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer"
                style={{
                  backgroundColor: selectedSociedadId === s.id ? '#DC2626' : '#FEF2F2',
                  color: selectedSociedadId === s.id ? '#FFFFFF' : '#DC2626',
                  border: `1px solid ${selectedSociedadId === s.id ? '#DC2626' : '#FECACA'}`,
                }}
              >
                {s.nombre}
              </button>
            ))}
          </div>

          {/* View mode toggle */}
          <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
            <button
              onClick={() => { setViewMode('activos'); setSelected(null); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: viewMode === 'activos' ? '#EFF6FF' : 'transparent',
                color: viewMode === 'activos' ? '#0369A1' : '#94A3B8',
                borderBottom: viewMode === 'activos' ? '2px solid #0369A1' : '2px solid transparent',
              }}
            >
              <User size={12} /> Activos
            </button>
            <button
              onClick={() => { setViewMode('bajas'); setSelected(null); }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{
                backgroundColor: viewMode === 'bajas' ? '#FFF7ED' : 'transparent',
                color: viewMode === 'bajas' ? '#EA580C' : '#94A3B8',
                borderBottom: viewMode === 'bajas' ? '2px solid #EA580C' : '2px solid transparent',
              }}
            >
              <UserX size={12} /> Bajas
            </button>
          </div>

          {/* Search */}
          <div className="p-3 border-b" style={{ borderColor: '#E2E8F0' }}>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Buscar trabajador..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
              />
            </div>
          </div>

          {/* Employee list */}
          <div className="flex-1 overflow-y-auto">
            {employees.map(emp => (
              <button
                key={emp.id}
                onClick={() => setSelected(emp)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-b"
                style={{
                  borderColor: '#F1F5F9',
                  backgroundColor: selected?.id === emp.id ? (viewMode === 'bajas' ? '#FFF7ED' : '#EFF6FF') : 'transparent',
                }}
              >
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: selected?.id === emp.id ? (viewMode === 'bajas' ? '#EA580C' : '#0369A1') : '#E2E8F0' }}>
                  {viewMode === 'bajas'
                    ? <UserX size={13} style={{ color: selected?.id === emp.id ? '#FFFFFF' : '#94A3B8' }} />
                    : <User size={13} style={{ color: selected?.id === emp.id ? '#FFFFFF' : '#64748B' }} />
                  }
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni ?? 'Sin DNI/NIE'}</p>
                </div>
                {selected?.id === emp.id && <ChevronRight size={13} className="ml-auto flex-shrink-0" style={{ color: viewMode === 'bajas' ? '#EA580C' : '#0369A1' }} />}
              </button>
            ))}
            {employees.length === 0 && (
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
          <div key={selected.id || selected.dni || 'self'} className="flex-1 flex flex-col min-w-0">
            {/* Employee header */}
            <div className="px-6 py-4 border-b flex items-center justify-between gap-4" style={{ borderColor: '#E2E8F0' }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: isBaja ? '#FFF7ED' : '#EFF6FF' }}>
                  {isBaja
                    ? <UserX size={18} style={{ color: '#EA580C' }} />
                    : <User size={18} style={{ color: '#0369A1' }} />
                  }
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{selected.nombre || 'Empleado'}</p>
                    {isBaja && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA' }}>
                        BAJA
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: '#64748B' }}>DNI/NIE: {selected.dni ?? '—'}</p>
                </div>
              </div>
              {isRrhh && !isBaja && (
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

            {/* Folder tabs — hidden for bajas (only show their privado docs) */}
            {!isBaja && (
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
                    {f === 'privado' ? 'Privado (documentos)' : 'Nominas'}
                  </button>
                ))}
              </div>
            )}

            {isBaja && (
              <div className="px-6 pt-4 pb-2">
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                  style={{ backgroundColor: '#FFF7ED', color: '#EA580C', border: '1px solid #FED7AA' }}>
                  <UserX size={13} />
                  Documentos archivados en carpeta de bajas
                </div>
              </div>
            )}

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
                    {isBaja ? 'No hay documentos archivados para este empleado' :
                     activeFolder === 'privado' ? 'No hay documentos en esta carpeta' : 'No hay nominas registradas'}
                  </p>
                  {isRrhh && selected.dni && !isBaja && (
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
                        style={{ backgroundColor: isBaja ? '#FFF7ED' : '#EFF6FF' }}>
                        <FileText size={16} style={{ color: isBaja ? '#EA580C' : '#0369A1' }} />
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
          </div>
        )}
      </div>

    </div>

      {/* ── Upload modal ── */}
      {uploadModal && selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#E2E8F0' }}>
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                Subir {uploadModal.folder === 'privado' ? 'documento privado' : 'nomina'} — {selected.nombre}
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
              )}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
                  {uploadModal.folder === 'publico' ? 'Archivo PDF de la nomina' : 'Documento'}
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
    </>
  );
}
