import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search, User, FolderOpen, FileText, Upload, Download, Eye,
  ChevronRight, X, Loader2, AlertCircle, Lock, Globe,
  UserX, CheckCircle2, UploadCloud, Trash2, FolderPlus, Home,
  Folder, Square, CheckSquare, MinusSquare,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import {
  ensureRrhhFolder, uploadToWasabiKey,
  getWasabiBlobUrl, downloadFromWasabi, listNominasForDni,
  listBajasEmployeeFiles, deleteFromWasabi,
  listPrefixOneLevelDeep, listAllKeysUnderPrefix, createWasabiFolder,
  type RrhhFile,
} from '../lib/wasabi';
import EmployeeDocumentsSection from './EmployeeDocumentsSection';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Employee {
  id: string;
  nombre: string;
  dni: string | null;
  email: string;
  id_sociedad: string | null;
  user_id: string | null;
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

// A virtual folder entry shown in the file browser
interface FolderEntry {
  name: string;       // display name (last segment)
  prefix: string;     // full S3 prefix including trailing /
}

// ─── Component ──────────────────────────────────────────────────────────────

interface Props {
  employeeDni?: string;
  isRrhh?: boolean;
  initialEmployeeDni?: string;
}

export default function PersonalDocumentsPanel({ employeeDni, isRrhh = false, initialEmployeeDni }: Props) {
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [selectedSociedadId, setSelectedSociedadId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('activos');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Employee | null>(null);
  const [activeFolder, setActiveFolder] = useState<FolderType>('privado');

  // Subfolder navigation: array of {name, prefix} segments navigated into
  const [folderPath, setFolderPath] = useState<FolderEntry[]>([]);

  const [subFolders, setSubFolders] = useState<FolderEntry[]>([]);
  const [files, setFiles] = useState<RrhhFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState('');
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<RrhhFile | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadModal, setUploadModal] = useState<UploadModal | null>(null);
  const [uploadQueue, setUploadQueue] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState<Record<string, 'pending' | 'done' | 'error'>>({});
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [anio, setAnio] = useState(new Date().getFullYear().toString());
  const [mes, setMes] = useState(String(new Date().getMonth() + 1).padStart(2, '0'));

  // Multi-selection
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [confirmDeleteSelection, setConfirmDeleteSelection] = useState(false);
  const [deletingSelection, setDeletingSelection] = useState(false);

  // Create folder modal
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderGlobal, setNewFolderGlobal] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [createFolderError, setCreateFolderError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Load employees and societies
  useEffect(() => {
    if (!isRrhh) return;
    Promise.all([
      supabase.from('empleados').select('id, nombre, dni, email, id_sociedad, user_id, activo').order('nombre'),
      supabase.from('sociedades').select('id, nombre').order('nombre'),
    ]).then(([empRes, socRes]) => {
      const emps = (empRes.data as Employee[]) ?? [];
      setAllEmployees(emps);
      setSociedades((socRes.data as Sociedad[]) ?? []);
      if (initialEmployeeDni) {
        const found = emps.find(e => e.dni === initialEmployeeDni);
        if (found) setSelected(found);
      }
    });
  }, [isRrhh, initialEmployeeDni]);

  // Self-service mode
  useEffect(() => {
    if (employeeDni && !isRrhh) {
      setSelected({ id: '', nombre: '', dni: employeeDni, email: '', id_sociedad: null, user_id: null, activo: true });
    }
  }, [employeeDni, isRrhh]);

  // Reset subfolder navigation and selection when employee or tab changes
  useEffect(() => {
    setFolderPath([]);
    setSelectedKeys(new Set());
  }, [selected, activeFolder]);

  // Clear selection when folder content changes
  useEffect(() => {
    setSelectedKeys(new Set());
  }, [folderPath]);

  // Load files when selection, tab or subfolder changes
  useEffect(() => {
    if (!selected?.dni) { setFiles([]); setSubFolders([]); return; }
    loadCurrentLevel(selected, activeFolder, folderPath);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeFolder, folderPath]);

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

  /** Root prefix for a given employee in the privado folder. */
  function getRootPrefix(emp: Employee): string {
    return `rrhh/privado/${emp.dni}-${sanitizeName(emp.nombre)}/`;
  }

  async function loadCurrentLevel(emp: Employee, folder: FolderType, path: FolderEntry[]) {
    if (!emp.dni) { setFiles([]); setSubFolders([]); return; }
    setLoadingFiles(true);
    setFiles([]);
    setSubFolders([]);
    try {
      if (!emp.activo) {
        // Baja — flat list, no subfolder navigation
        const slug = getSociedadSlug(emp);
        const result = await listBajasEmployeeFiles(slug, emp.dni, sanitizeName(emp.nombre));
        setFiles(result);
      } else if (folder === 'privado') {
        const rootPrefix = getRootPrefix(emp);
        await ensureRrhhFolder(rootPrefix);

        const currentPrefix = path.length > 0
          ? path[path.length - 1].prefix
          : rootPrefix;

        const { folders, files: fls } = await listPrefixOneLevelDeep(currentPrefix);
        setSubFolders(folders);
        setFiles(fls);
      } else {
        // Nominas — flat list
        const result = await listNominasForDni(emp.dni);
        setFiles(result);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
  }

  function navigateInto(folder: FolderEntry) {
    setFolderPath(prev => [...prev, folder]);
  }

  function navigateTo(index: number) {
    // index === -1 means root
    if (index === -1) {
      setFolderPath([]);
    } else {
      setFolderPath(prev => prev.slice(0, index + 1));
    }
  }

  // ── Multi-selection helpers ─────────────────────────────────────────────

  function toggleKey(key: string) {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleAll() {
    const allKeys = [
      ...subFolders.map(f => `folder:${f.prefix}`),
      ...files.map(f => f.key),
    ];
    if (selectedKeys.size === allKeys.length) {
      setSelectedKeys(new Set());
    } else {
      setSelectedKeys(new Set(allKeys));
    }
  }

  async function handleDeleteSelection() {
    if (!selected || selectedKeys.size === 0) return;
    setDeletingSelection(true);
    try {
      for (const key of selectedKeys) {
        if (key.startsWith('folder:')) {
          // Delete all objects under this prefix
          const prefix = key.slice('folder:'.length);
          const allKeys = await listAllKeysUnderPrefix(prefix);
          for (const k of allKeys) {
            await deleteFromWasabi(k);
          }
        } else {
          await deleteFromWasabi(key);
        }
      }
      setSelectedKeys(new Set());
      setConfirmDeleteSelection(false);
      await loadCurrentLevel(selected, activeFolder, folderPath);
    } catch (e) {
      console.error(e);
    } finally {
      setDeletingSelection(false);
    }
  }

  // ── Create folder ────────────────────────────────────────────────────────

  async function handleCreateFolder() {
    if (!newFolderName.trim()) { setCreateFolderError('Introduce un nombre para la carpeta'); return; }
    if (!selected?.dni && !newFolderGlobal) { setCreateFolderError('Selecciona un empleado o marca como global'); return; }

    // Sanitize folder name for S3 key
    const safeName = newFolderName.trim().replace(/[^a-zA-Z0-9ÁáÉéÍíÓóÚúÑñ._\- ]/g, '').trim();
    if (!safeName) { setCreateFolderError('Nombre inválido para una carpeta'); return; }

    setCreatingFolder(true);
    setCreateFolderError('');

    try {
      if (newFolderGlobal) {
        // Create this folder (and full path) for every active employee with a DNI
        const targets = allEmployees.filter(e => e.activo && e.dni);
        for (const emp of targets) {
          const rootPrefix = getRootPrefix(emp);
          // Build the path up to and including the new folder
          const pathPrefix = folderPath.length > 0
            ? folderPath[folderPath.length - 1].prefix.replace(rootPrefix, '')
            : '';
          // Ensure all ancestor folders exist first
          if (pathPrefix) {
            const segments = pathPrefix.split('/').filter(Boolean);
            let accumulated = rootPrefix;
            for (const seg of segments) {
              accumulated += seg + '/';
              await createWasabiFolder(accumulated);
            }
          }
          const newPrefix = (folderPath.length > 0
            ? folderPath[folderPath.length - 1].prefix.replace(rootPrefix, '')
            : '') + safeName + '/';
          await createWasabiFolder(rootPrefix + newPrefix);
        }
        // Also create for the currently selected employee if not already included
        if (selected?.dni && !targets.find(e => e.dni === selected.dni)) {
          const rootPrefix = getRootPrefix(selected);
          const newPrefix = (folderPath.length > 0
            ? folderPath[folderPath.length - 1].prefix.replace(rootPrefix, '')
            : '') + safeName + '/';
          await createWasabiFolder(rootPrefix + newPrefix);
        }
      } else if (selected?.dni) {
        // Create only for the selected employee
        const rootPrefix = getRootPrefix(selected);
        const parentPrefix = folderPath.length > 0
          ? folderPath[folderPath.length - 1].prefix
          : rootPrefix;
        await createWasabiFolder(parentPrefix + safeName + '/');
      }

      setShowCreateFolder(false);
      setNewFolderName('');
      setNewFolderGlobal(false);
      // Reload current level
      if (selected) {
        await loadCurrentLevel(selected, activeFolder, folderPath);
      }
    } catch (e) {
      setCreateFolderError(e instanceof Error ? e.message : 'Error al crear la carpeta');
    } finally {
      setCreatingFolder(false);
    }
  }

  // ── Preview / delete / upload ─────────────────────────────────────────────

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

  async function handleDelete(file: RrhhFile) {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteFromWasabi(file.key);
      setConfirmDelete(null);
      await loadCurrentLevel(selected, activeFolder, folderPath);
    } catch (e) {
      console.error(e);
    } finally {
      setDeleting(false);
    }
  }

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files.length) addFilesToQueue(e.dataTransfer.files);
  }, []);

  async function handleUpload() {
    if (!uploadQueue.length || !selected?.dni || !uploadModal) return;
    setUploading(true);
    setUploadError('');
    const progress: Record<string, 'pending' | 'done' | 'error'> = {};
    uploadQueue.forEach(f => { progress[f.name] = 'pending'; });
    setUploadProgress({ ...progress });

    let destPrefix = '';
    if (uploadModal.folder === 'privado') {
      const rootPrefix = getRootPrefix(selected);
      destPrefix = folderPath.length > 0
        ? folderPath[folderPath.length - 1].prefix
        : rootPrefix;
      await ensureRrhhFolder(destPrefix);
    } else {
      const y = uploadModal.anio ?? anio;
      const m = uploadModal.mes ?? mes;
      for (const fk of [`rrhh/publico/${y}/`, `rrhh/publico/${y}/${m}/`]) {
        await ensureRrhhFolder(fk);
      }
    }

    let anyError = false;
    for (const file of uploadQueue) {
      try {
        let key: string;
        if (uploadModal.folder === 'privado') {
          key = `${destPrefix}${file.name}`;
        } else {
          const y = uploadModal.anio ?? anio;
          const m = uploadModal.mes ?? mes;
          key = `rrhh/publico/${y}/${m}/${selected.dni}_${file.name}`;
        }
        await uploadToWasabiKey(file, key);
        setUploadProgress(prev => ({ ...prev, [file.name]: 'done' }));
      } catch {
        setUploadProgress(prev => ({ ...prev, [file.name]: 'error' }));
        anyError = true;
      }
    }

    if (anyError) {
      setUploadError('Algunos archivos no se pudieron subir');
    } else {
      if (uploadModal.folder !== 'privado' && selected.dni) {
        const y = uploadModal.anio ?? anio;
        const m = uploadModal.mes ?? mes;
        const mNames: Record<string, string> = {
          '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
          '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
          '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre',
        };
        const { data: emp } = await supabase
          .from('empleados')
          .select('user_id')
          .eq('dni', selected.dni)
          .maybeSingle();
        if (emp?.user_id) {
          await supabase.from('notificaciones_empleado').insert({
            user_id: emp.user_id,
            tipo: 'nomina',
            titulo: 'Nomina disponible',
            descripcion: `Tu nomina de ${mNames[m] ?? m} ${y} ya esta disponible.`,
            leida: false,
          });
        }
      }
      setUploadModal(null);
      setUploadQueue([]);
      setUploadProgress({});
    }
    setUploading(false);
    if (selected) await loadCurrentLevel(selected, activeFolder, folderPath);
  }

  function closeUploadModal() {
    setUploadModal(null);
    setUploadQueue([]);
    setUploadProgress({});
    setUploadError('');
  }

  // ── Filters ───────────────────────────────────────────────────────────────

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
  const isPrivadoTab = activeFolder === 'privado' && !isBaja;

  // Current path label for breadcrumb
  const breadcrumbs: { label: string; index: number }[] = [
    { label: 'Raiz', index: -1 },
    ...folderPath.map((f, i) => ({ label: f.name, index: i })),
  ];

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
                <div className="flex items-center gap-2">
                  {/* Create folder button — only in privado tab */}
                  {isPrivadoTab && (
                    <button
                      onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setNewFolderGlobal(false); setCreateFolderError(''); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                      style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                    >
                      <FolderPlus size={14} />
                      Crear carpeta
                    </button>
                  )}
                  <button
                    onClick={() => setUploadModal({ folder: activeFolder, anio, mes })}
                    disabled={!selected.dni}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer disabled:opacity-50"
                    style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                  >
                    <Upload size={14} />
                    Subir documento
                  </button>
                </div>
              )}
            </div>

            {/* ── "Mis Documentos" del perfil del empleado (RRHH puede ver y eliminar) ── */}
            {isRrhh && !isBaja && (
              <div className="px-6 pt-4">
                {selected.user_id ? (
                  <EmployeeDocumentsSection
                    key={selected.user_id}
                    employeeId={selected.user_id}
                    employeeNombre={selected.nombre}
                    societyId={selected.id_sociedad ?? ''}
                    viewerRole="rrhh"
                  />
                ) : (
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA', color: '#C2410C' }}>
                    <AlertCircle size={14} /> Este trabajador no tiene una cuenta de empleado vinculada; sus documentos de &ldquo;Mis Documentos&rdquo; no pueden mostrarse todavía.
                  </div>
                )}
              </div>
            )}

            <div className="px-6 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#64748B' }}>Archivo de carpetas RRHH</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Documentos antiguos organizados por carpetas y nóminas almacenadas por DNI.</p>
            </div>

            {/* Folder tabs + delete selection button */}
            {!isBaja && (
              <div className="flex items-center justify-between px-6 pt-4 pb-2 gap-3">
                <div className="flex gap-1">
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
                {isRrhh && selectedKeys.size > 0 && (
                  <button
                    onClick={() => setConfirmDeleteSelection(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                    style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1.5px solid #FECACA' }}
                  >
                    <Trash2 size={14} />
                    Eliminar selección ({selectedKeys.size})
                  </button>
                )}
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

            {/* Breadcrumb — only in privado tab */}
            {isPrivadoTab && folderPath.length > 0 && (
              <div className="flex items-center gap-1 px-6 py-2 flex-wrap">
                {breadcrumbs.map((bc, i) => (
                  <div key={bc.index} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={12} style={{ color: '#CBD5E1' }} />}
                    <button
                      onClick={() => navigateTo(bc.index)}
                      className="flex items-center gap-1 text-xs font-medium cursor-pointer transition-colors rounded px-1.5 py-0.5 hover:bg-slate-100"
                      style={{
                        color: i === breadcrumbs.length - 1 ? '#0369A1' : '#64748B',
                        fontWeight: i === breadcrumbs.length - 1 ? 600 : 400,
                      }}
                    >
                      {bc.index === -1 && <Home size={11} />}
                      {bc.label}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Files + folders list */}
            <div className="flex-1 overflow-y-auto px-6 pb-6">
              {loadingFiles ? (
                <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}>
                  <Loader2 size={18} className="animate-spin" /> Cargando...
                </div>
              ) : subFolders.length === 0 && files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <FolderOpen size={32} style={{ color: '#CBD5E1' }} />
                  <p className="text-sm" style={{ color: '#94A3B8' }}>
                    {isBaja ? 'No hay documentos archivados' :
                     activeFolder === 'privado' ? 'Esta carpeta está vacía' : 'No hay nominas registradas'}
                  </p>
                  {isRrhh && selected.dni && !isBaja && activeFolder === 'privado' && (
                    <button
                      onClick={() => { setShowCreateFolder(true); setNewFolderName(''); setNewFolderGlobal(false); setCreateFolderError(''); }}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer mt-1"
                      style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                    >
                      <FolderPlus size={12} /> Crear primera carpeta
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5 pt-2">

                  {/* Select-all row — only in privado RRHH mode with items */}
                  {isRrhh && isPrivadoTab && (subFolders.length + files.length) > 0 && (
                    <div className="flex items-center gap-2 px-2 pb-1">
                      <button
                        onClick={toggleAll}
                        className="flex items-center gap-2 text-xs font-medium cursor-pointer transition-colors px-2 py-1 rounded-lg hover:bg-slate-100"
                        style={{ color: '#64748B' }}
                      >
                        {selectedKeys.size === 0
                          ? <Square size={14} style={{ color: '#CBD5E1' }} />
                          : selectedKeys.size === subFolders.length + files.length
                            ? <CheckSquare size={14} style={{ color: '#0369A1' }} />
                            : <MinusSquare size={14} style={{ color: '#0369A1' }} />}
                        {selectedKeys.size === 0 ? 'Seleccionar todo' : `${selectedKeys.size} seleccionado${selectedKeys.size !== 1 ? 's' : ''}`}
                      </button>
                    </div>
                  )}

                  {/* Subfolder rows */}
                  {subFolders.map(sf => {
                    const folderKey = `folder:${sf.prefix}`;
                    const isChecked = selectedKeys.has(folderKey);
                    return (
                      <div
                        key={sf.prefix}
                        className="flex items-center gap-2 rounded-xl transition-all"
                        style={{
                          backgroundColor: isChecked ? '#FEF9C3' : '#FFFBEB',
                          border: `1px solid ${isChecked ? '#FDE047' : '#FDE68A'}`,
                          outline: isChecked ? '2px solid #FDE047' : 'none',
                        }}
                      >
                        {isRrhh && isPrivadoTab && (
                          <button
                            onClick={() => toggleKey(folderKey)}
                            className="pl-3 py-3 flex-shrink-0 cursor-pointer"
                          >
                            {isChecked
                              ? <CheckSquare size={16} style={{ color: '#0369A1' }} />
                              : <Square size={16} style={{ color: '#CBD5E1' }} />}
                          </button>
                        )}
                        <button
                          onClick={() => navigateInto(sf)}
                          className="flex-1 flex items-center gap-3 px-3 py-3 text-left cursor-pointer min-w-0"
                        >
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: '#FEF3C7' }}>
                            <Folder size={17} style={{ color: '#D97706' }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold" style={{ color: '#92400E' }}>{sf.name}</p>
                            <p className="text-xs" style={{ color: '#B45309' }}>Carpeta</p>
                          </div>
                          <ChevronRight size={15} style={{ color: '#D97706' }} />
                        </button>
                      </div>
                    );
                  })}

                  {/* File rows */}
                  {files.map(file => {
                    const isChecked = selectedKeys.has(file.key);
                    return (
                      <div
                        key={file.key}
                        className="flex items-center gap-2 rounded-xl transition-all"
                        style={{
                          backgroundColor: isChecked ? '#EFF6FF' : '#F8FAFC',
                          border: `1px solid ${isChecked ? '#BFDBFE' : '#E2E8F0'}`,
                          outline: isChecked ? '2px solid #BFDBFE' : 'none',
                        }}
                      >
                        {isRrhh && (
                          <button
                            onClick={() => toggleKey(file.key)}
                            className="pl-3 py-3 flex-shrink-0 cursor-pointer"
                          >
                            {isChecked
                              ? <CheckSquare size={16} style={{ color: '#0369A1' }} />
                              : <Square size={16} style={{ color: '#CBD5E1' }} />}
                          </button>
                        )}
                        <div className="flex-1 flex items-center gap-3 px-3 py-3 min-w-0">
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
                            {isRrhh && (
                              <button
                                onClick={() => setConfirmDelete(file)}
                                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer hover:bg-red-50"
                                title="Eliminar"
                                style={{ color: '#DC2626' }}
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* ── Create Folder Modal ── */}
    {showCreateFolder && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <div className="w-full max-w-md mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F0FDF4' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#DCFCE7' }}>
                <FolderPlus size={18} style={{ color: '#16A34A' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Crear carpeta</h3>
                {folderPath.length > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                    Dentro de: {folderPath.map(f => f.name).join(' / ')}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowCreateFolder(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-green-100"
              style={{ color: '#64748B' }}
            >
              <X size={16} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Folder name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#475569' }}>
                Nombre de la carpeta
              </label>
              <input
                type="text"
                value={newFolderName}
                onChange={e => { setNewFolderName(e.target.value); setCreateFolderError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                placeholder="Ej: Vacaciones, Contratos, 2026..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: `1.5px solid ${createFolderError ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
                autoFocus
              />
            </div>

            {/* Global toggle */}
            <div
              className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all select-none"
              style={{
                backgroundColor: newFolderGlobal ? '#EFF6FF' : '#F8FAFC',
                border: `1.5px solid ${newFolderGlobal ? '#BFDBFE' : '#E2E8F0'}`,
              }}
              onClick={() => setNewFolderGlobal(v => !v)}
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                style={{
                  backgroundColor: newFolderGlobal ? '#0369A1' : '#FFFFFF',
                  border: `2px solid ${newFolderGlobal ? '#0369A1' : '#CBD5E1'}`,
                }}
              >
                {newFolderGlobal && <CheckCircle2 size={12} style={{ color: '#FFFFFF' }} />}
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: newFolderGlobal ? '#0369A1' : '#1E293B' }}>
                  Crear en todos los empleados (Global)
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  {folderPath.length > 0
                    ? `Se creará la ruta "${folderPath.map(f => f.name).join(' / ')} / ${newFolderName || '...'}" en todos los empleados activos con DNI.`
                    : `Se creará la carpeta "${newFolderName || '...'}" en todos los empleados activos con DNI.`
                  }
                </p>
                {newFolderGlobal && (
                  <div className="flex items-center gap-1.5 mt-2 text-xs" style={{ color: '#0369A1' }}>
                    <Globe size={11} />
                    {allEmployees.filter(e => e.activo && e.dni).length} empleados afectados
                  </div>
                )}
              </div>
            </div>

            {createFolderError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={13} style={{ color: '#DC2626' }} />
                <p className="text-xs" style={{ color: '#DC2626' }}>{createFolderError}</p>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowCreateFolder(false)}
                disabled={creatingFolder}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreateFolder}
                disabled={creatingFolder || !newFolderName.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#16A34A' }}
              >
                {creatingFolder ? <Loader2 size={14} className="animate-spin" /> : <FolderPlus size={14} />}
                {creatingFolder
                  ? (newFolderGlobal ? 'Creando en todos...' : 'Creando...')
                  : 'Crear carpeta'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Delete selection confirmation modal ── */}
    {confirmDeleteSelection && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="px-6 py-4 flex items-center gap-3 border-b" style={{ borderColor: '#FEE2E2', backgroundColor: '#FEF2F2' }}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEE2E2' }}>
              <Trash2 size={16} style={{ color: '#DC2626' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Eliminar selección</h3>
              <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>Esta acción no se puede deshacer</p>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm" style={{ color: '#475569' }}>
              Vas a eliminar <span className="font-semibold" style={{ color: '#0F172A' }}>{selectedKeys.size} elemento{selectedKeys.size !== 1 ? 's' : ''}</span> de forma permanente.
              {Array.from(selectedKeys).some(k => k.startsWith('folder:')) && (
                <span className="block mt-1 text-xs" style={{ color: '#DC2626' }}>
                  Las carpetas seleccionadas se eliminarán junto con todo su contenido.
                </span>
              )}
            </p>
            <div className="mt-4 max-h-32 overflow-y-auto space-y-1">
              {subFolders.filter(f => selectedKeys.has(`folder:${f.prefix}`)).map(f => (
                <div key={f.prefix} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: '#FFFBEB', color: '#92400E' }}>
                  <Folder size={11} /> {f.name}
                </div>
              ))}
              {files.filter(f => selectedKeys.has(f.key)).map(f => (
                <div key={f.key} className="flex items-center gap-2 text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F8FAFC', color: '#475569' }}>
                  <FileText size={11} /> {f.name}
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setConfirmDeleteSelection(false)}
                disabled={deletingSelection}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteSelection}
                disabled={deletingSelection}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
              >
                {deletingSelection ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deletingSelection ? 'Eliminando...' : `Eliminar (${selectedKeys.size})`}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Delete confirmation modal ── */}
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
              Vas a eliminar <span className="font-semibold" style={{ color: '#0F172A' }}>{confirmDelete.name}</span> de forma permanente.
            </p>
            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#F1F5F9', color: '#475569' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#DC2626', color: '#FFFFFF' }}
              >
                {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                {deleting ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* ── Upload modal ── */}
    {uploadModal && selected && (
      <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
        <div className="w-full max-w-lg mx-4 rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: '#E2E8F0' }}>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                Subir {uploadModal.folder === 'privado' ? 'documentos' : 'nominas'} — {selected.nombre}
              </h3>
              {uploadModal.folder === 'privado' && folderPath.length > 0 && (
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  En: {folderPath.map(f => f.name).join(' / ')}
                </p>
              )}
            </div>
            <button onClick={closeUploadModal} disabled={uploading}
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

            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !uploading && fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer transition-all select-none"
              style={{
                border: `2px dashed ${isDragging ? '#0369A1' : '#CBD5E1'}`,
                backgroundColor: isDragging ? '#EFF6FF' : '#F8FAFC',
                padding: '28px 16px',
                minHeight: 130,
              }}
            >
              <UploadCloud size={32} style={{ color: isDragging ? '#0369A1' : '#94A3B8' }} />
              <div className="text-center">
                <p className="text-sm font-medium" style={{ color: isDragging ? '#0369A1' : '#475569' }}>
                  {isDragging ? 'Suelta los archivos aqui' : 'Arrastra archivos o haz clic para seleccionar'}
                </p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  {uploadModal.folder === 'publico' ? 'Solo PDF' : 'Cualquier tipo de archivo'} · Multiples archivos permitidos
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={uploadModal.folder === 'publico' ? 'application/pdf' : undefined}
                onChange={handleFileInput}
                disabled={uploading}
                className="hidden"
              />
            </div>

            {uploadQueue.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {uploadQueue.map(file => {
                  const status = uploadProgress[file.name];
                  return (
                    <div key={file.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{
                        backgroundColor: status === 'done' ? '#F0FDF4' : status === 'error' ? '#FEF2F2' : '#F8FAFC',
                        border: `1px solid ${status === 'done' ? '#BBF7D0' : status === 'error' ? '#FECACA' : '#E2E8F0'}`,
                      }}>
                      <FileText size={14} style={{ color: status === 'done' ? '#16A34A' : status === 'error' ? '#DC2626' : '#64748B', flexShrink: 0 }} />
                      <span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{file.name}</span>
                      <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>
                        {(file.size / 1024).toFixed(0)} KB
                      </span>
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
              <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
                style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                <AlertCircle size={13} /> {uploadError}
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                {uploadQueue.length > 0 ? `${uploadQueue.length} archivo${uploadQueue.length !== 1 ? 's' : ''} seleccionado${uploadQueue.length !== 1 ? 's' : ''}` : 'Ningun archivo seleccionado'}
              </span>
              <div className="flex gap-2">
                <button onClick={closeUploadModal} disabled={uploading}
                  className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50"
                  style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || uploadQueue.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-50 transition-all"
                  style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                >
                  {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                  {uploading ? 'Subiendo...' : `Subir${uploadQueue.length > 1 ? ` (${uploadQueue.length})` : ''}`}
                </button>
              </div>
            </div>
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
