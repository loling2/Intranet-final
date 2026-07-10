import { useState, useEffect, useCallback, useRef } from 'react';
import { Pagination, paginate, totalPages as calcTotalPages } from './Pagination';
import { Users, Plus, Search, X, Save, ChevronDown, ChevronUp, Pencil, Trash2, AlertCircle, CheckCircle2, Building2, Tag, RefreshCw, UserPlus, Ligature as FileSignature, Clock, Bell, Upload, Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { supabase, type Empleado, type EstadoContrato, type HistorialContrato, type Sociedad, type Centro, type Asignacion, type Tag as TagType, type UserProfile } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { uploadToWasabi, moveRrhhFolderToBajas, moveRrhhFolderToActivo } from '../lib/wasabi';
import { writeAuditLog } from '../lib/auditLog';

interface Props {
  currentUserRole: 'admin' | 'rrhh';
}

const TIPOS_CONTRATO = ['Indefinido', 'Temporal', 'Practicas', 'Obra y Servicio', 'Formacion', 'Relevo', 'Interinidad'];
const TURNOS = ['Manana', 'Tarde', 'Noche', 'Partido', 'Flexible'];

const ESTADOS_CONTRATO: { value: EstadoContrato; label: string; color: string; bg: string; border: string; Icon: React.FC<{ size?: number }> }[] = [
  { value: 'pendiente', label: 'Pendiente', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', Icon: Clock },
  { value: 'avisado',   label: 'Avisado',   color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE', Icon: Bell },
  { value: 'firmado',   label: 'Firmado',   color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', Icon: FileSignature },
];

const EMPTY_FORM: Omit<Empleado, 'id' | 'created_at' | 'updated_at'> = {
  user_id: null,
  id_sociedad: '',
  id_sociedad_secundaria: null,
  nombre: '',
  email: '',
  dni: null,
  telefono: null,
  fecha_nacimiento: null,
  tipo_contrato: null,
  fecha_alta: null,
  fin_periodo_prueba: null,
  observaciones_contrato: null,
  turno: null,
  puesto: null,
  centro_trabajo: null,
  titulacion_habilitante: null,
  fecha_pago_tasas: null,
  nass: null,
  convenio: null,
  localidad: null,
  direccion: null,
  codigo_postal: null,
  sexo: null,
  doc_dni: false,
  doc_nass: false,
  doc_vitali: false,
  doc_numero_cuenta: false,
  doc_titulacion: false,
  observaciones: null,
  activo: true,
  estado_contrato: 'pendiente',
};

function formFromEmpleado(e: Empleado): typeof EMPTY_FORM {
  return {
    user_id: e.user_id,
    id_sociedad: e.id_sociedad,
    id_sociedad_secundaria: e.id_sociedad_secundaria ?? null,
    nombre: e.nombre,
    email: e.email,
    dni: e.dni,
    telefono: e.telefono,
    fecha_nacimiento: e.fecha_nacimiento,
    tipo_contrato: e.tipo_contrato,
    fecha_alta: e.fecha_alta,
    fin_periodo_prueba: e.fin_periodo_prueba,
    observaciones_contrato: e.observaciones_contrato,
    turno: e.turno,
    puesto: e.puesto,
    centro_trabajo: e.centro_trabajo,
    titulacion_habilitante: e.titulacion_habilitante,
    fecha_pago_tasas: e.fecha_pago_tasas,
    nass: e.nass ?? null,
    convenio: e.convenio ?? null,
    localidad: e.localidad ?? null,
    direccion: e.direccion ?? null,
    codigo_postal: e.codigo_postal ?? null,
    sexo: e.sexo ?? null,
    doc_dni: e.doc_dni ?? false,
    doc_nass: e.doc_nass ?? false,
    doc_vitali: e.doc_vitali ?? false,
    doc_numero_cuenta: e.doc_numero_cuenta ?? false,
    doc_titulacion: e.doc_titulacion ?? false,
    observaciones: e.observaciones,
    activo: e.activo,
    estado_contrato: e.estado_contrato ?? 'pendiente',
  };
}

// ─── CSV Import Modal ────────────────────────────────────────────────────────

// Template A: Auth users (email + password → creates login access)
const CSV_AUTH_HEADERS = ['email', 'nombre', 'dni', 'contrasena', 'rol', 'sociedad_id'];
const CSV_AUTH_EXAMPLE = [
  ['empleado@empresa.com', 'Juan Garcia Lopez', '12345678A', 'Contrasena123!', 'employee', ''],
  ['supervisor@empresa.com', 'Maria Perez Ruiz', '87654321B', 'Contrasena456!', 'supervisor', ''],
];

// Template B: HR data (apellidos + nombre → creates empleado record, no login)
const CSV_HR_HEADERS = ['apellidos', 'nombre', 'dni', 'telefono', 'fecha_alta', 'fecha_nacimiento', 'tipo_contrato', 'turno', 'puesto', 'centro_trabajo', 'nass', 'sexo', 'convenio', 'localidad', 'codigo_postal', 'direccion', 'emails'];
const CSV_HR_EXAMPLE = [
  ['Garcia Lopez', 'Juan', '12345678A', '600000001', '2024-01-15', '1990-05-20', 'Indefinido', 'Manana', 'Tecnico', 'Sede Central', '28/123456789', 'Hombre', 'Convenio General', 'Madrid', '28001', 'Calle Mayor 1', 'juan@empresa.com'],
  ['Perez Ruiz', 'Maria', '87654321B', '600000002', '2024-03-01', '1985-11-08', 'Temporal', 'Tarde', 'Administrativo', 'Oficina Norte', '08/987654321', 'Mujer', 'Convenio Comercio', 'Barcelona', '08001', 'Paseo Gracia 10', 'maria@empresa.com'],
];

function downloadTemplateCsv(type: 'auth' | 'hr') {
  const headers = type === 'auth' ? CSV_AUTH_HEADERS : CSV_HR_HEADERS;
  const examples = type === 'auth' ? CSV_AUTH_EXAMPLE : CSV_HR_EXAMPLE;
  const rows = [headers, ...examples];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = type === 'auth' ? 'plantilla_usuarios_acceso.csv' : 'plantilla_empleados_rrhh.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// Normalize accented/special chars for header matching
function normHeader(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function parseCsv(text: string): { rows: Record<string, string>[]; mode: 'auth' | 'hr' } {
  // Support semicolon or comma delimiter
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return { rows: [], mode: 'auth' };

  const delimiter = lines[0].includes(';') ? ';' : ',';
  const rawHeaders = lines[0].split(delimiter).map(h => h.replace(/^"|"$/g, '').trim());
  const headers = rawHeaders.map(normHeader);

  const rows = lines.slice(1).map(line => {
    const values = line.split(delimiter).map(v => v.replace(/^"|"$/g, '').trim());
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
    // Also store with original header keys for flexibility
    rawHeaders.forEach((h, i) => { obj[normHeader(h)] = values[i] ?? ''; });
    return obj;
  }).filter(r => Object.values(r).some(v => v.trim()));

  // Detect mode: HR format has 'apellidos' column
  const mode: 'auth' | 'hr' = headers.includes('apellidos') || headers.includes('apellido') ? 'hr' : 'auth';
  return { rows, mode };
}

// Map HR CSV row to empleado payload
function hrRowToEmpleado(r: Record<string, string>, societyId: string): Partial<Empleado> {
  const apellidos = r['apellidos'] ?? r['apellido'] ?? '';
  const nombre = r['nombre'] ?? '';
  const fullName = apellidos && nombre ? `${nombre} ${apellidos}` : nombre || apellidos;

  // Normalize date: accept DD/MM/YYYY or YYYY-MM-DD
  const parseDate = (s: string) => {
    if (!s?.trim()) return null;
    const dmyMatch = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2].padStart(2,'0')}-${dmyMatch[1].padStart(2,'0')}`;
    const ymatch = s.match(/^\d{4}-\d{2}-\d{2}$/);
    if (ymatch) return s;
    return null;
  };

  return {
    nombre: fullName,
    email: r['emails'] ?? r['email'] ?? r['correo'] ?? '',
    dni: r['dni'] ?? r['dni_nie'] ?? null,
    telefono: r['telefono'] ?? r['tel'] ?? null,
    fecha_alta: parseDate(r['fecha_alta'] ?? r['fechaalta'] ?? ''),
    fecha_nacimiento: parseDate(r['fecha_nacimiento'] ?? r['fechanacimiento'] ?? r['fecha_de_nacimiento'] ?? ''),
    tipo_contrato: r['tipo_contrato'] ?? r['tipocontrato'] ?? null,
    turno: r['turno'] ?? null,
    puesto: r['puesto'] ?? null,
    centro_trabajo: r['centro_trabajo'] ?? r['centrotrabajo'] ?? r['centro_de_trabajo'] ?? null,
    nass: r['nass'] ?? null,
    sexo: r['sexo'] ?? null,
    convenio: r['convenio'] ?? null,
    localidad: r['localidad'] ?? null,
    codigo_postal: r['codigo_postal'] ?? r['codigopostal'] ?? r['cp'] ?? null,
    direccion: r['direccion'] ?? null,
    id_sociedad: societyId,
    activo: true,
    estado_contrato: 'pendiente' as const,
    user_id: null,
  };
}

function ImportUsersModal({ sociedades, onClose, onImported }: {
  sociedades: Sociedad[];
  onClose: () => void;
  onImported: () => void;
}) {
  const [step, setStep] = useState<'upload' | 'society' | 'preview' | 'result'>('upload');
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mode, setMode] = useState<'auth' | 'hr'>('auth');
  const [selectedSociety, setSelectedSociety] = useState(sociedades[0]?.id ?? '');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState<Array<{ label: string; ok: boolean; error?: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const parsed = parseCsv(text);
      if (!parsed.rows.length) { setError('El archivo no contiene datos válidos o el formato es incorrecto.'); return; }
      setRows(parsed.rows);
      setMode(parsed.mode);
      setStep(parsed.mode === 'hr' ? 'society' : 'preview');
    };
    reader.readAsText(file, 'UTF-8');
  }

  async function handleImport() {
    setImporting(true);
    setError('');
    try {
      if (mode === 'hr') {
        if (!selectedSociety) throw new Error('Selecciona una sociedad antes de importar');

        // Fetch existing DNIs to skip duplicates
        const dniList = rows.map(r => (r['dni'] ?? r['dni_nie'] ?? '').trim().toUpperCase()).filter(Boolean);
        const { data: existingRows } = await supabase.from('empleados').select('dni').in('dni', dniList);
        const existingDnis = new Set((existingRows ?? []).map((e: { dni: string | null }) => (e.dni ?? '').toUpperCase()));

        const res: Array<{ label: string; ok: boolean; error?: string }> = [];
        for (const r of rows) {
          const payload = hrRowToEmpleado(r, selectedSociety);
          const dniNorm = (payload.dni ?? '').toUpperCase();
          if (!payload.nombre?.trim()) { res.push({ label: r['emails'] || r['nombre'] || '?', ok: false, error: 'Nombre vacío' }); continue; }
          if (dniNorm && existingDnis.has(dniNorm)) {
            res.push({ label: payload.email || payload.nombre || '?', ok: false, error: `DNI ${payload.dni} ya existe` });
            continue;
          }
          const { error: err } = await supabase.from('empleados').insert(payload);
          const label = payload.email || payload.nombre || '?';
          if (err) { res.push({ label, ok: false, error: err.message }); }
          else { res.push({ label, ok: true }); if (dniNorm) existingDnis.add(dniNorm); }
        }
        setResults(res);
      } else {
        // Auth import via edge function
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

        const payload = rows.map(r => ({
          email: r['email'] ?? r['correo'] ?? r['correo_electronico'] ?? '',
          nombre: r['nombre'] ?? r['nombre_completo'] ?? '',
          dni: r['dni'] ?? r['dni_nie'] ?? '',
          password: r['contrasena'] ?? r['contrasena'] ?? r['password'] ?? r['clave'] ?? '',
          role: (r['rol'] ?? r['role'] ?? 'employee').toLowerCase().trim(),
          societies: r['sociedad_id']?.trim() ? [r['sociedad_id'].trim()] : (selectedSociety ? [selectedSociety] : []),
        }));

        const resp = await fetch(`${supabaseUrl}/functions/v1/manage-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY as string,
          },
          body: JSON.stringify({ action: 'bulk_import', rows: payload }),
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.error ?? 'Error en la importación');
        setResults((data.results ?? []).map((r: { email: string; ok: boolean; error?: string }) => ({ label: r.email, ok: r.ok, error: r.error })));
      }
      setStep('result');
      onImported();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setImporting(false);
    }
  }

  const ROLES_LABEL: Record<string, string> = { admin: 'Admin', rrhh: 'RRHH', employee: 'Empleado', prevencion: 'Prevención', supervisor: 'Supervisor' };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-3xl mx-4 shadow-2xl overflow-hidden flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b flex-shrink-0" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <FileSpreadsheet size={18} style={{ color: '#0369A1' }} />
            </div>
            <div>
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Importar empleados</h3>
              <p className="text-xs" style={{ color: '#64748B' }}>
                {step === 'upload'
                  ? 'Sube un CSV con los datos'
                  : step === 'society'
                  ? `${rows.length} registro(s) · elige la empresa de destino`
                  : step === 'preview'
                  ? `${rows.length} registro(s) detectados · formato ${mode === 'hr' ? 'RRHH' : 'acceso'}`
                  : 'Resultado de la importación'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Step: upload */}
          {step === 'upload' && (
            <>
              {/* Two template options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* HR template */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#14532D' }}>Plantilla RRHH</p>
                  <p className="text-xs mb-2" style={{ color: '#166534' }}>
                    Importa ficha de empleado: apellidos, nombre, DNI, telefono, fechas, contrato, turno, puesto, centro...
                  </p>
                  <p className="text-xs mb-3" style={{ color: '#64748B' }}>
                    No crea acceso de login. Util para cargar datos de RRHH directamente.
                  </p>
                  <button
                    onClick={() => downloadTemplateCsv('hr')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}
                  >
                    <Download size={12} /> Descargar plantilla RRHH
                  </button>
                </div>
                {/* Auth template */}
                <div className="p-4 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: '#0C4A6E' }}>Plantilla Acceso Web</p>
                  <p className="text-xs mb-2" style={{ color: '#0369A1' }}>
                    Crea usuarios con login: email, nombre, DNI, contrasena, rol, sociedad...
                  </p>
                  <p className="text-xs mb-3" style={{ color: '#64748B' }}>
                    Roles validos: <em>employee, rrhh, prevencion, supervisor, admin</em>
                  </p>
                  <button
                    onClick={() => downloadTemplateCsv('auth')}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                    style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
                  >
                    <Download size={12} /> Descargar plantilla acceso
                  </button>
                </div>
              </div>

              {/* File upload */}
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: '#374151' }}>Sube el CSV relleno</p>
                <label
                  className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl cursor-pointer transition-colors"
                  style={{ border: '2px dashed #CBD5E1', backgroundColor: '#F8FAFC' }}
                >
                  <Upload size={28} style={{ color: '#94A3B8' }} />
                  <div className="text-center">
                    <p className="text-sm font-medium" style={{ color: '#475569' }}>Haz clic para seleccionar el archivo</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>Archivos .csv · separador coma o punto y coma · UTF-8</p>
                  </div>
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFileChange} className="hidden" />
                </label>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </>
          )}

          {/* Step: society selector (HR mode only) */}
          {step === 'society' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <FileSpreadsheet size={16} style={{ color: '#16A34A' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#14532D' }}>{rows.length} empleado(s) detectados en el CSV</p>
                  <p className="text-xs" style={{ color: '#166534' }}>Elige la empresa a la que se asociarán todos los registros</p>
                </div>
              </div>
              <div className="p-4 rounded-xl space-y-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <label className="block text-sm font-semibold" style={{ color: '#374151' }}>
                  Empresa destino <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <select
                  value={selectedSociety}
                  onChange={(e) => setSelectedSociety(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none cursor-pointer"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #CBD5E1', color: '#1E293B' }}
                >
                  <option value="">Seleccionar empresa...</option>
                  {sociedades.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
                <p className="text-xs" style={{ color: '#94A3B8' }}>
                  Si tienes empleados de varias empresas, importa cada empresa por separado.
                </p>
              </div>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </div>
          )}

          {/* Step: preview */}
          {step === 'preview' && (
            <>
              {/* Mode badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                style={{ backgroundColor: mode === 'hr' ? '#F0FDF4' : '#EFF6FF', color: mode === 'hr' ? '#166534' : '#0369A1', border: `1px solid ${mode === 'hr' ? '#BBF7D0' : '#BFDBFE'}` }}>
                <FileSpreadsheet size={13} />
                Formato detectado: <strong>{mode === 'hr' ? 'RRHH (ficha de empleado, sin login)' : 'Acceso Web (crea usuario con login)'}</strong>
                {mode === 'hr' && selectedSociety && (
                  <span className="ml-2" style={{ color: '#94A3B8' }}>· Sociedad: {sociedades.find(s => s.id === selectedSociety)?.nombre}</span>
                )}
              </div>

              <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #E2E8F0' }}>
                <table className="w-full text-xs">
                  <thead style={{ backgroundColor: '#F8FAFC' }}>
                    <tr>
                      {mode === 'hr'
                        ? ['Nombre', 'Apellidos', 'DNI', 'Telefono', 'Fecha Alta', 'F. Nacimiento', 'Contrato', 'Turno', 'Puesto', 'Centro', 'Email'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold whitespace-nowrap" style={{ color: '#374151', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                          ))
                        : ['Email', 'Nombre', 'DNI', 'Contraseña', 'Rol', 'Sociedad'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: '#374151', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                          ))
                      }
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        {mode === 'hr' ? (
                          <>
                            <td className="px-3 py-2 font-medium whitespace-nowrap" style={{ color: '#1E293B' }}>{r['nombre'] || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#475569' }}>{r['apellidos'] || r['apellido'] || '—'}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: '#475569' }}>{r['dni'] || '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#475569' }}>{r['telefono'] || r['tel'] || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#475569' }}>{r['fecha_alta'] || r['fechaalta'] || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#475569' }}>{r['fecha_nacimiento'] || r['fechanacimiento'] || r['fecha_de_nacimiento'] || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#475569' }}>{r['tipo_contrato'] || r['tipocontrato'] || '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#475569' }}>{r['turno'] || '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#475569' }}>{r['puesto'] || '—'}</td>
                            <td className="px-3 py-2 whitespace-nowrap" style={{ color: '#475569' }}>{r['centro_trabajo'] || r['centrotrabajo'] || r['centro_de_trabajo'] || '—'}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: '#0369A1' }}>{r['emails'] || r['email'] || r['correo'] || '—'}</td>
                          </>
                        ) : (
                          <>
                            <td className="px-3 py-2 font-mono" style={{ color: '#0369A1' }}>{r['email'] || r['correo'] || '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#1E293B' }}>{r['nombre'] || '—'}</td>
                            <td className="px-3 py-2 font-mono" style={{ color: '#475569' }}>{r['dni'] || '—'}</td>
                            <td className="px-3 py-2" style={{ color: '#94A3B8' }}>{'•'.repeat(Math.min(8, (r['contrasena'] || r['password'] || '').length)) || '—'}</td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
                                {ROLES_LABEL[(r['rol'] || r['role'] || 'employee').toLowerCase()] ?? 'Empleado'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs" style={{ color: '#94A3B8' }}>
                              {r['sociedad_id'] ? (sociedades.find(s => s.id === r['sociedad_id'])?.nombre ?? r['sociedad_id']) : (sociedades.find(s => s.id === selectedSociety)?.nombre ?? '—')}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                  <AlertCircle size={14} /> {error}
                </div>
              )}
            </>
          )}

          {/* Step: result */}
          {step === 'result' && (
            <div className="space-y-2">
              <div className="flex gap-4 p-4 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold" style={{ color: '#16A34A' }}>{results.filter(r => r.ok).length}</p>
                  <p className="text-xs" style={{ color: '#15803D' }}>Importados</p>
                </div>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold" style={{ color: results.filter(r => !r.ok).length > 0 ? '#DC2626' : '#94A3B8' }}>
                    {results.filter(r => !r.ok).length}
                  </p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Errores</p>
                </div>
              </div>
              {results.filter(r => !r.ok).map((r, i) => (
                <div key={i} className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle size={13} className="flex-shrink-0 mt-0.5" style={{ color: '#DC2626' }} />
                  <div>
                    <p className="font-medium" style={{ color: '#DC2626' }}>{r.label}</p>
                    <p style={{ color: '#9CA3AF' }}>{r.error}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex items-center justify-end gap-3 border-t flex-shrink-0" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
          {step === 'upload' && (
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
              Cancelar
            </button>
          )}
          {step === 'society' && (
            <>
              <button onClick={() => { setStep('upload'); setRows([]); if (fileRef.current) fileRef.current.value = ''; }}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
                Atras
              </button>
              <button
                onClick={() => {
                  if (!selectedSociety) { setError('Debes seleccionar una empresa'); return; }
                  setError('');
                  setStep('preview');
                }}
                disabled={!selectedSociety}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}
              >
                Continuar — ver previa
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button onClick={() => setStep(mode === 'hr' ? 'society' : 'upload')}
                className="px-4 py-2 rounded-lg text-sm cursor-pointer" style={{ color: '#475569', backgroundColor: '#F1F5F9' }}>
                Atras
              </button>
              <button
                onClick={handleImport}
                disabled={importing || (mode === 'hr' && !selectedSociety)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60"
                style={{ backgroundColor: mode === 'hr' ? '#16A34A' : '#0369A1', color: '#FFFFFF' }}
              >
                {importing ? <><Loader2 size={14} className="animate-spin" /> Importando...</> : <><Upload size={14} /> Importar {rows.length} {mode === 'hr' ? 'empleados' : 'usuarios'}</>}
              </button>
            </>
          )}
          {step === 'result' && (
            <button onClick={onClose} className="px-5 py-2 rounded-lg text-sm font-semibold cursor-pointer"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              Cerrar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function CreateCentroModal({ societyId, sociedades, onClose, onCreated }: {
  societyId: string;
  sociedades: Sociedad[];
  onClose: () => void;
  onCreated: (centro: Centro) => void;
}) {
  const [nombre, setNombre] = useState('');
  const [selectedSociety, setSelectedSociety] = useState(societyId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async () => {
    if (!nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!selectedSociety) { setError('Selecciona una sociedad'); return; }
    setSaving(true);
    const { data, error: err } = await supabase
      .from('centros')
      .insert({ nombre: nombre.trim(), id_sociedad: selectedSociety })
      .select()
      .single();
    if (err) { setError(err.message); setSaving(false); return; }
    onCreated(data as Centro);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm mx-4 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Building2 size={14} className="text-white" />
            </div>
            <h2 className="text-white font-semibold text-sm">Nuevo centro de trabajo</h2>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={13} />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre *</label>
            <input
              autoFocus
              type="text"
              value={nombre}
              onChange={(e) => { setNombre(e.target.value); setError(''); }}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Nombre del centro..."
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ border: `1.5px solid ${error && !nombre ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedad *</label>
            <select
              value={selectedSociety}
              onChange={(e) => setSelectedSociety(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
              style={{ border: `1.5px solid ${error && !selectedSociety ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
            >
              <option value="">Seleccionar...</option>
              {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={12} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving || !nombre.trim()}
              className="flex-1 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              style={{ backgroundColor: '#0369A1' }}>
              {saving ? <RefreshCw size={12} className="animate-spin" /> : <Plus size={12} />}
              Crear centro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickUploadModal({ empleado, onClose, onUploaded }: { empleado: Empleado; onClose: () => void; onUploaded: () => void }) {
  const { profile } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const ACCEPTED = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'];

  const addFiles = (fl: FileList | null) => {
    if (!fl) return;
    setFiles((prev) => [...prev, ...Array.from(fl).filter((f) => ACCEPTED.includes(f.type) || f.type === '')]);
  };

  const handleUpload = async () => {
    if (files.length === 0 || !profile) { setError('Selecciona al menos un archivo'); return; }
    setLoading(true);
    setError('');
    try {
      for (const file of files) {
        const sanitized = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const wasabiKey = `publico/${Date.now()}-${sanitized}`;
        await uploadToWasabi(file, wasabiKey);
        const { error: dbErr } = await supabase.from('documents').insert({
          nombre_archivo: file.name,
          tipo: file.type || 'application/octet-stream',
          folder: 'publico',
          usuario_destino_id: empleado.user_id ?? null,
          usuario_destino_email: empleado.email ?? '',
          society_id: empleado.id_sociedad,
          subido_por: profile.id,
          subido_por_nombre: profile.nombre,
          tamano_bytes: file.size,
          indexeddb_key: `pub_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          wasabi_key: wasabiKey,
        });
        if (dbErr) throw dbErr;
        await writeAuditLog({
          evento: 'document_uploaded',
          descripcion: `Documento subido en carpeta publica para ${empleado.nombre}: ${file.name}`,
          autor: profile as UserProfile,
          entidad: 'document',
          metadata: { nombre_archivo: file.name, folder: 'publico', empleado_id: empleado.id, wasabi_key: wasabiKey },
          society_id: empleado.id_sociedad,
        });
      }
      onUploaded();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al subir');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Upload size={14} className="text-white" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-sm">Subir a carpeta publica</h2>
              <p className="text-white/70 text-xs">{empleado.nombre} · visible para el empleado</p>
            </div>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={13} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center py-7 rounded-xl cursor-pointer transition-all duration-200"
            style={{ border: `2px dashed ${dragging ? '#0369A1' : '#CBD5E1'}`, backgroundColor: dragging ? '#EFF6FF' : '#F8FAFC' }}
          >
            <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
            <Upload size={22} style={{ color: '#94A3B8' }} />
            <p className="text-sm font-medium mt-2" style={{ color: '#1E293B' }}>Arrastra o haz clic</p>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>PDF, Imagenes, Excel, Word</p>
          </div>
          {files.length > 0 && (
            <div className="space-y-1.5 max-h-32 overflow-y-auto">
              {files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs flex-1 truncate" style={{ color: '#1E293B' }}>{f.name}</p>
                  <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="cursor-pointer flex-shrink-0" style={{ color: '#94A3B8' }}>
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button
              onClick={handleUpload}
              disabled={loading || files.length === 0}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0369A1' }}
            >
              {loading ? <><RefreshCw size={13} className="animate-spin" /> Subiendo...</> : <><Upload size={13} /> Subir {files.length > 1 ? `${files.length} archivos` : 'archivo'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EmployeesModule({ currentUserRole }: Props) {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [tags, setTags] = useState<TagType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');
  const [filterActivo, setFilterActivo] = useState('');
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);

  // Expanded employee detail panel
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [asignaciones, setAsignaciones] = useState<(Asignacion & { centro_nombre?: string })[]>([]);
  const [empleadoTags, setEmpleadoTags] = useState<(TagType & { etiquetado_id: string })[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Asignacion/tag management
  const [newCentroId, setNewCentroId] = useState('');
  const [newRol, setNewRol] = useState<'Empleado' | 'Supervisor' | 'Admin'>('Empleado');
  const [newTagId, setNewTagId] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);

  // Create centro modal
  const [showCreateCentro, setShowCreateCentro] = useState(false);

  // Create user access
  const [creatingAccess, setCreatingAccess] = useState(false);

  // Quick upload to public folder
  const [uploadEmpModal, setUploadEmpModal] = useState<Empleado | null>(null);

  // Estado contrato — change modal
  const [contratoModal, setContratoModal] = useState<{
    empleadoId: string;
    estadoActual: EstadoContrato;
    estadoNuevo: EstadoContrato;
  } | null>(null);
  const [contratoJustificacion, setContratoJustificacion] = useState('');
  const [savingContrato, setSavingContrato] = useState(false);
  const [historialContrato, setHistorialContrato] = useState<HistorialContrato[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Use getUser() to validate the token server-side (avoids stale localStorage sessions)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Sin sesion activa — vuelve a iniciar sesion');
        return;
      }
      const [empRes, socRes, cenRes, tagRes] = await Promise.all([
        supabase.from('empleados').select('*').order('nombre'),
        supabase.from('sociedades').select('*').order('nombre'),
        supabase.from('centros').select('*').order('nombre'),
        supabase.from('tags').select('*').order('nombre'),
      ]);
      if (empRes.error) throw empRes.error;
      if (socRes.error) throw socRes.error;
      if (cenRes.error) throw cenRes.error;
      if (tagRes.error) throw tagRes.error;
      setEmpleados(empRes.data ?? []);
      setSociedades(socRes.data ?? []);
      setCentros(cenRes.data ?? []);
      setTags(tagRes.data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setPage(1); }, [searchQuery, filterSociedad, filterActivo]);

  const loadDetail = useCallback(async (empleadoId: string) => {
    setLoadingDetail(true);
    try {
      const [aRes, etRes] = await Promise.all([
        supabase.from('asignaciones').select('*').eq('id_empleado', empleadoId),
        supabase.from('etiquetado').select('*, tags(id, nombre, created_at)').eq('entidad_id', empleadoId),
      ]);
      if (aRes.error) throw aRes.error;
      if (etRes.error) throw etRes.error;

      const asig = (aRes.data ?? []).map((a) => ({
        ...a,
        centro_nombre: centros.find((c) => c.id === a.id_centro)?.nombre,
      }));
      setAsignaciones(asig);

      const tgs = (etRes.data ?? []).map((et: { id: string; tag_id: string; entidad_id: string; created_at: string; tags: TagType | null }) => ({
        id: et.tags?.id ?? et.tag_id,
        nombre: et.tags?.nombre ?? '',
        created_at: et.tags?.created_at ?? '',
        etiquetado_id: et.id,
      }));
      setEmpleadoTags(tgs);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar detalle');
    } finally {
      setLoadingDetail(false);
    }
  }, [centros]);

  useEffect(() => {
    if (expandedId) loadDetail(expandedId);
  }, [expandedId, loadDetail]);

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  };

  const openNew = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };

  const openEdit = (emp: Empleado) => {
    setEditingId(emp.id);
    setForm(formFromEmpleado(emp));
    setShowForm(true);
    setExpandedId(null);
    setTimeout(() => {
      document.getElementById(`edit-form-${emp.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm({ ...EMPTY_FORM });
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.id_sociedad) { setError('Selecciona una sociedad'); return; }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        dni: form.dni?.trim() || null,
        telefono: form.telefono?.trim() || null,
        email: form.email?.trim() || '',
        puesto: form.puesto?.trim() || null,
        centro_trabajo: form.centro_trabajo?.trim() || null,
        titulacion_habilitante: form.titulacion_habilitante?.trim() || null,
        observaciones: form.observaciones?.trim() || null,
        observaciones_contrato: form.observaciones_contrato?.trim() || null,
      };
      if (editingId) {
        // Detect activo true → false to move Wasabi folder to bajas
        const original = empleados.find(e => e.id === editingId);
        const wasActivo = original?.activo ?? true;
        const nowInactivo = payload.activo === false;
        const { error: err } = await supabase.from('empleados').update(payload).eq('id', editingId);
        if (err) {
          if (err.code === '42501' || err.message?.includes('security')) throw new Error('Sin permiso para modificar empleados. Vuelve a iniciar sesion.');
          throw err;
        }
        if (original?.dni && original?.nombre) {
          const soc = sociedades.find(s => s.id === (payload.id_sociedad || original.id_sociedad));
          const sociedadSlug = soc
            ? soc.nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_')
            : 'sin_sociedad';
          const nombreSanitized = original.nombre.replace(/[^a-zA-Z0-9ÁáÉéÍíÓóÚúÑñ ]/g, '').trim();
          if (wasActivo && nowInactivo) {
            try {
              await moveRrhhFolderToBajas(original.dni, nombreSanitized, sociedadSlug);
            } catch (moveErr) {
              console.warn('No se pudo mover la carpeta a bajas:', moveErr);
            }
          } else if (!wasActivo && payload.activo === true) {
            try {
              await moveRrhhFolderToActivo(original.dni, nombreSanitized, sociedadSlug);
            } catch (moveErr) {
              console.warn('No se pudo restaurar la carpeta a privado:', moveErr);
            }
          }
        }
        showSuccess('Empleado actualizado correctamente');
      } else {
        const { error: err } = await supabase.from('empleados').insert(payload);
        if (err) {
          if (err.code === '42501' || err.message?.includes('security')) throw new Error('Sin permiso para crear empleados. Vuelve a iniciar sesion.');
          throw err;
        }
        showSuccess('Empleado creado correctamente');
      }
      cancelForm();
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: Empleado) => {
    if (!confirm(`Eliminar a "${emp.nombre}"? Esta accion no se puede deshacer.`)) return;
    setError(null);
    try {
      const { error: err } = await supabase.from('empleados').delete().eq('id', emp.id);
      if (err) throw err;
      showSuccess('Empleado eliminado');
      if (expandedId === emp.id) setExpandedId(null);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar');
    }
  };

  const handleCreateAccess = async () => {
    if (!editingId || !form.email?.trim()) {
      setError('El empleado debe tener un email para crear acceso');
      return;
    }
    setCreatingAccess(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/manage-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          action: 'create_user',
          email: form.email.trim(),
          nombre: form.nombre.trim(),
          role: 'employee',
          societies: form.id_sociedad ? [form.id_sociedad] : [],
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error ?? 'Error al crear acceso');
      // Link the auth user_id to this empleado record
      const { error: linkErr } = await supabase
        .from('empleados')
        .update({ user_id: result.userId })
        .eq('id', editingId);
      if (linkErr) throw linkErr;
      showSuccess(`Acceso creado. Contrasena temporal: ${result.tempPassword}`);
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear acceso');
    } finally {
      setCreatingAccess(false);
    }
  };

  const handleAddAsignacion = async (empleadoId: string) => {
    if (!newCentroId) { setError('Selecciona un centro'); return; }
    setSavingDetail(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('asignaciones').insert({
        id_empleado: empleadoId,
        id_centro: newCentroId,
        rol: newRol,
      });
      if (err) throw err;
      setNewCentroId('');
      setNewRol('Empleado');
      await loadDetail(empleadoId);
      showSuccess('Asignacion creada');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar centro');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleRemoveAsignacion = async (asignacionId: string, empleadoId: string) => {
    setSavingDetail(true);
    try {
      const { error: err } = await supabase.from('asignaciones').delete().eq('id', asignacionId);
      if (err) throw err;
      await loadDetail(empleadoId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar asignacion');
    } finally {
      setSavingDetail(false);
    }
  };

  const handleAddTag = async (empleadoId: string) => {
    if (!newTagId) { setError('Selecciona un tag'); return; }
    setSavingDetail(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('etiquetado').insert({
        entidad_id: empleadoId,
        tag_id: newTagId,
      });
      if (err) throw err;
      setNewTagId('');
      await loadDetail(empleadoId);
      showSuccess('Tag asignado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar tag');
    } finally {
      setSavingDetail(false);
    }
  };

  const loadHistorialContrato = useCallback(async (empleadoId: string) => {
    setLoadingHistorial(true);
    try {
      const { data } = await supabase
        .from('historial_contrato')
        .select('*')
        .eq('empleado_id', empleadoId)
        .order('created_at', { ascending: false });
      setHistorialContrato((data ?? []) as HistorialContrato[]);
    } finally {
      setLoadingHistorial(false);
    }
  }, []);

  const openContratoModal = (empleadoId: string, estadoActual: EstadoContrato, estadoNuevo: EstadoContrato) => {
    setContratoModal({ empleadoId, estadoActual, estadoNuevo });
    setContratoJustificacion('');
  };

  const handleContratoChange = async () => {
    if (!contratoModal) return;
    if (!contratoJustificacion.trim()) return;
    setSavingContrato(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: profile } = await supabase.from('user_profiles').select('nombre').eq('id', session?.user?.id ?? '').maybeSingle();
      await supabase.from('empleados').update({ estado_contrato: contratoModal.estadoNuevo }).eq('id', contratoModal.empleadoId);
      await supabase.from('historial_contrato').insert({
        empleado_id: contratoModal.empleadoId,
        estado_anterior: contratoModal.estadoActual,
        estado_nuevo: contratoModal.estadoNuevo,
        justificacion: contratoJustificacion.trim(),
        cambiado_por: session?.user?.id ?? null,
        cambiado_por_nombre: (profile as { nombre?: string } | null)?.nombre ?? session?.user?.email ?? '',
      });
      setContratoModal(null);
      setContratoJustificacion('');
      await loadData();
      await loadHistorialContrato(contratoModal.empleadoId);
      showSuccess('Estado de contrato actualizado');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cambiar estado');
    } finally {
      setSavingContrato(false);
    }
  };

  const handleRemoveTag = async (etiquetadoId: string, empleadoId: string) => {
    setSavingDetail(true);
    try {
      const { error: err } = await supabase.from('etiquetado').delete().eq('id', etiquetadoId);
      if (err) throw err;
      await loadDetail(empleadoId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar tag');
    } finally {
      setSavingDetail(false);
    }
  };

  const f = (field: keyof typeof EMPTY_FORM, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value === '' ? null : value }));

  const filtered = empleados.filter((e) => {
    if (filterSociedad && e.id_sociedad !== filterSociedad) return false;
    if (filterActivo === 'activo' && !e.activo) return false;
    if (filterActivo === 'inactivo' && e.activo) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        e.nombre.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        (e.dni?.toLowerCase().includes(q) ?? false) ||
        (e.puesto?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const EMP_PAGE_SIZE = 25;
  const empTotalPages = calcTotalPages(filtered.length, EMP_PAGE_SIZE);
  const empSafePage = Math.min(page, empTotalPages);
  const pagedEmpleados = paginate(filtered, empSafePage, EMP_PAGE_SIZE);

  const getSociedad = (id: string) => sociedades.find((s) => s.id === id);

  return (
    <div className="space-y-6">
      {/* Toast messages */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto cursor-pointer"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}>
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {showCreateCentro && (
        <CreateCentroModal
          societyId={form.id_sociedad}
          sociedades={sociedades}
          onClose={() => setShowCreateCentro(false)}
          onCreated={(centro) => {
            setCentros((prev) => [...prev, centro].sort((a, b) => a.nombre.localeCompare(b.nombre)));
            f('centro_trabajo', centro.nombre);
          }}
        />
      )}

      {showImport && (
        <ImportUsersModal
          sociedades={sociedades}
          onClose={() => setShowImport(false)}
          onImported={loadData}
        />
      )}

      {/* Quick upload to public folder */}
      {uploadEmpModal && (
        <QuickUploadModal
          empleado={uploadEmpModal}
          onClose={() => setUploadEmpModal(null)}
          onUploaded={() => showSuccess('Archivo subido y visible para el empleado')}
        />
      )}

      {/* Contrato change modal */}
      {contratoModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  <FileSignature size={14} className="text-white" />
                </div>
                <h2 className="text-white font-semibold text-sm">Cambiar estado del contrato</h2>
              </div>
              <button onClick={() => setContratoModal(null)} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <X size={13} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                {(() => {
                  const prev = ESTADOS_CONTRATO.find((e) => e.value === contratoModal.estadoActual);
                  const next = ESTADOS_CONTRATO.find((e) => e.value === contratoModal.estadoNuevo);
                  return (
                    <>
                      {prev && <span className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5" style={{ backgroundColor: prev.bg, color: prev.color, border: `1px solid ${prev.border}` }}><prev.Icon size={12} />{prev.label}</span>}
                      <span className="text-sm font-bold" style={{ color: '#94A3B8' }}>→</span>
                      {next && <span className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5" style={{ backgroundColor: next.bg, color: next.color, border: `1px solid ${next.border}` }}><next.Icon size={12} />{next.label}</span>}
                    </>
                  );
                })()}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Justificacion *</label>
                <textarea
                  value={contratoJustificacion}
                  onChange={(e) => setContratoJustificacion(e.target.value)}
                  rows={3}
                  placeholder={`Ej: Se avisa el dia ${new Date().toLocaleDateString('es-ES')}`}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setContratoModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleContratoChange}
                  disabled={savingContrato || !contratoJustificacion.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#0369A1' }}
                >
                  {savingContrato ? <><RefreshCw size={13} className="animate-spin" />Guardando...</> : 'Confirmar cambio'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header + filters */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: '#0369A1' }} />
            <h3 className="font-semibold" style={{ color: '#0F172A' }}>Directorio de Empleados</h3>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full ml-1" style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
              {filtered.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                placeholder="Buscar nombre, email, DNI..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '220px' }}
              />
            </div>
            <select
              value={filterSociedad}
              onChange={(e) => setFilterSociedad(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
            >
              <option value="">Todas las sociedades</option>
              {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
            <select
              value={filterActivo}
              onChange={(e) => setFilterActivo(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
            >
              <option value="">Todos</option>
              <option value="activo">Activos</option>
              <option value="inactivo">Inactivos</option>
            </select>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
            >
              <FileSpreadsheet size={14} />
              Importar usuarios
            </button>
            <button
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
            >
              <Plus size={14} />
              Nuevo empleado
            </button>
          </div>
        </div>

        {/* Employee form (new employee only) */}
        {showForm && !editingId && (
          <div className="px-6 py-5" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                {editingId ? 'Editar empleado' : 'Nuevo empleado'}
              </h4>
              <button onClick={cancelForm} className="cursor-pointer" style={{ color: '#94A3B8' }}><X size={16} /></button>
            </div>

            {/* Section: Documentacion + Estado (top) */}
            <div className="flex flex-wrap items-center gap-4 mb-5 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Estado:</span>
                <button
                  type="button"
                  onClick={() => f('activo', !form.activo)}
                  className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer"
                  style={{
                    backgroundColor: form.activo ? '#16A34A' : '#DC2626',
                    color: '#FFFFFF',
                    border: 'none',
                  }}
                >
                  {form.activo ? 'Activo' : 'Inactivo'}
                </button>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Documentacion:</span>
                {([
                  { key: 'doc_vitali', label: 'Vitali' },
                  { key: 'doc_titulacion', label: 'Titulación' },
                ] as const).map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form[key] as boolean}
                      onChange={(e) => f(key, e.target.checked)}
                      className="w-3.5 h-3.5 rounded cursor-pointer"
                      style={{ accentColor: '#16A34A' }}
                    />
                    <span className="text-xs font-medium" style={{ color: form[key] ? '#16A34A' : '#64748B' }}>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Section: Datos personales */}
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Datos personales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <FormField label="Nombre *">
                <input value={form.nombre} onChange={(e) => f('nombre', e.target.value)}
                  className="form-input" placeholder="Nombre completo" />
              </FormField>
              <FormField label="Email">
                <input value={form.email ?? ''} onChange={(e) => f('email', e.target.value)}
                  type="email" className="form-input" placeholder="correo@empresa.com" />
              </FormField>
              <FormField label="DNI / NIE">
                <input value={form.dni ?? ''} onChange={(e) => f('dni', e.target.value)}
                  className="form-input" placeholder="12345678A o X1234567A" />
              </FormField>
              <FormField label="Telefono">
                <input value={form.telefono ?? ''} onChange={(e) => f('telefono', e.target.value)}
                  className="form-input" placeholder="+34 600 000 000" />
              </FormField>
              <FormField label="Fecha de nacimiento">
                <input value={form.fecha_nacimiento ?? ''} onChange={(e) => f('fecha_nacimiento', e.target.value)}
                  type="date" className="form-input" />
              </FormField>
              <FormField label="Sociedad *">
                <select value={form.id_sociedad} onChange={(e) => f('id_sociedad', e.target.value)} className="form-input">
                  <option value="">Seleccionar...</option>
                  {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="Segunda sociedad (opcional)">
                <select value={form.id_sociedad_secundaria ?? ''} onChange={(e) => f('id_sociedad_secundaria', e.target.value || null)} className="form-input">
                  <option value="">Ninguna</option>
                  {sociedades.filter((s) => s.id !== form.id_sociedad).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </FormField>
              <FormField label="NASS">
                <input value={form.nass ?? ''} onChange={(e) => f('nass', e.target.value || null)}
                  type="text" className="form-input" placeholder="Nº Afiliación Seg. Social" />
              </FormField>
              <FormField label="Sexo">
                <select value={form.sexo ?? ''} onChange={(e) => f('sexo', e.target.value || null)} className="form-input">
                  <option value="">Seleccionar...</option>
                  <option value="Hombre">Hombre</option>
                  <option value="Mujer">Mujer</option>
                  <option value="Otro">Otro</option>
                </select>
              </FormField>
              <FormField label="Convenio">
                <input value={form.convenio ?? ''} onChange={(e) => f('convenio', e.target.value || null)}
                  type="text" className="form-input" placeholder="Convenio colectivo..." />
              </FormField>
              <FormField label="Localidad">
                <input value={form.localidad ?? ''} onChange={(e) => f('localidad', e.target.value || null)}
                  type="text" className="form-input" placeholder="Localidad..." />
              </FormField>
              <FormField label="Código Postal">
                <input value={form.codigo_postal ?? ''} onChange={(e) => f('codigo_postal', e.target.value || null)}
                  type="text" className="form-input" placeholder="00000" />
              </FormField>
              <FormField label="Dirección" className="sm:col-span-2 lg:col-span-3">
                <input value={form.direccion ?? ''} onChange={(e) => f('direccion', e.target.value || null)}
                  type="text" className="form-input" placeholder="Calle, número, piso..." />
              </FormField>
            </div>

            {/* Section: Datos contractuales */}
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Datos contractuales</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <FormField label="Tipo de contrato">
                <select value={form.tipo_contrato ?? ''} onChange={(e) => f('tipo_contrato', e.target.value)} className="form-input">
                  <option value="">Seleccionar...</option>
                  {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Fecha de alta">
                <input value={form.fecha_alta ?? ''} onChange={(e) => f('fecha_alta', e.target.value)}
                  type="date" className="form-input" />
              </FormField>
              <FormField label="Fin periodo de prueba">
                <input value={form.fin_periodo_prueba ?? ''} onChange={(e) => f('fin_periodo_prueba', e.target.value)}
                  type="date" className="form-input" />
              </FormField>
              <FormField label="Observaciones contrato" className="sm:col-span-2 lg:col-span-3">
                <textarea value={form.observaciones_contrato ?? ''} onChange={(e) => f('observaciones_contrato', e.target.value)}
                  rows={2} className="form-input resize-none" placeholder="Condiciones especiales, anexos..." />
              </FormField>
            </div>

            {/* Section: Datos operativos */}
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Datos operativos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <FormField label="Turno">
                <select value={form.turno ?? ''} onChange={(e) => f('turno', e.target.value)} className="form-input">
                  <option value="">Seleccionar...</option>
                  {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </FormField>
              <FormField label="Puesto">
                <input value={form.puesto ?? ''} onChange={(e) => f('puesto', e.target.value)}
                  className="form-input" placeholder="Tecnico, Operario..." />
              </FormField>
              <FormField label="Centro de trabajo">
                <div className="flex gap-1.5">
                  <select
                    value={form.centro_trabajo ?? ''}
                    onChange={(e) => f('centro_trabajo', e.target.value)}
                    className="form-input flex-1"
                  >
                    <option value="">Seleccionar...</option>
                    {centros
                      .filter((c) => !form.id_sociedad || c.id_sociedad === form.id_sociedad)
                      .map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowCreateCentro(true)}
                    title="Crear nuevo centro"
                    className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:opacity-80"
                    style={{ backgroundColor: '#0369A1', color: '#FFFFFF', marginTop: '0px' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </FormField>
              <FormField label="Titulacion habilitante" className="sm:col-span-2">
                <input value={form.titulacion_habilitante ?? ''} onChange={(e) => f('titulacion_habilitante', e.target.value)}
                  className="form-input" placeholder="Grado, Master, Certificacion..." />
              </FormField>
              <FormField label="Fecha pago tasas">
                <input value={form.fecha_pago_tasas ?? ''} onChange={(e) => f('fecha_pago_tasas', e.target.value)}
                  type="date" className="form-input" />
              </FormField>
            </div>

            {/* Section: Observaciones */}
            <div className="grid grid-cols-1 gap-3 mb-5">
              <FormField label="Observaciones generales">
                <textarea value={form.observaciones ?? ''} onChange={(e) => f('observaciones', e.target.value)}
                  rows={2} className="form-input resize-none" placeholder="Notas adicionales..." />
              </FormField>
            </div>

            {/* Section: Estado del contrato */}
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Estado del contrato</p>
            <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <div className="flex gap-2 flex-wrap mb-3">
                {ESTADOS_CONTRATO.map(({ value, label, color, bg, border, Icon }) => {
                  const isActive = (form.estado_contrato ?? 'pendiente') === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        const current = (form.estado_contrato ?? 'pendiente') as EstadoContrato;
                        if (value === current) return;
                        if (editingId) {
                          openContratoModal(editingId, current, value);
                        } else {
                          f('estado_contrato', value);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                      style={{
                        backgroundColor: isActive ? bg : '#FFFFFF',
                        color: isActive ? color : '#94A3B8',
                        border: `1.5px solid ${isActive ? border : '#E2E8F0'}`,
                      }}
                    >
                      <Icon size={13} />
                      {label}
                    </button>
                  );
                })}
              </div>
              {editingId && (
                <button
                  type="button"
                  onClick={() => loadHistorialContrato(editingId)}
                  className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: '#0369A1' }}
                >
                  {loadingHistorial ? 'Cargando...' : 'Ver historial de cambios'}
                </button>
              )}
              {historialContrato.length > 0 && (
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {historialContrato.map((h) => {
                    const estadoNew = ESTADOS_CONTRATO.find((e) => e.value === h.estado_nuevo);
                    return (
                      <div key={h.id} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                        <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: estadoNew?.bg ?? '#F8FAFC' }}>
                          {estadoNew && <estadoNew.Icon size={10} style={{ color: estadoNew.color }} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: '#1E293B' }}>
                            {h.estado_anterior} → {h.estado_nuevo}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{h.justificacion}</p>
                          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                            {h.cambiado_por_nombre} · {new Date(h.created_at).toLocaleString('es-ES')}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 justify-end flex-wrap">
              {editingId && !form.user_id && (
                <button onClick={handleCreateAccess} disabled={creatingAccess}
                  title="Crear usuario de login para este empleado"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                  style={{ backgroundColor: '#059669', color: '#FFFFFF' }}>
                  <UserPlus size={13} />
                  {creatingAccess ? 'Creando acceso...' : 'Crear acceso de usuario'}
                </button>
              )}
              <button onClick={cancelForm} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                <Save size={13} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {/* Employee list */}
        {loading ? (
          <div className="px-6 py-12 text-center">
            <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm" style={{ color: '#94A3B8' }}>Cargando empleados...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>No se encontraron empleados</p>
            <button onClick={openNew} className="mt-3 text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>
              Crear el primer empleado
            </button>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {pagedEmpleados.map((emp) => {
              const soc = getSociedad(emp.id_sociedad);
              const isExpanded = expandedId === emp.id;
              return (
                <div key={emp.id}>
                  <div className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors duration-150">
                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                      style={{ backgroundColor: emp.activo ? '#EFF6FF' : '#F1F5F9', color: emp.activo ? '#0369A1' : '#94A3B8' }}
                    >
                      {emp.nombre.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                        {!emp.activo && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>Inactivo</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {emp.email && <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.email}</p>}
                        {emp.puesto && <p className="text-xs font-medium" style={{ color: '#64748B' }}>{emp.puesto}</p>}
                        {emp.tipo_contrato && <p className="text-xs" style={{ color: '#94A3B8' }}>{emp.tipo_contrato}</p>}
                      </div>
                    </div>

                    {/* Contrato estado badge */}
                    {(() => {
                      const ec = ESTADOS_CONTRATO.find((e) => e.value === (emp.estado_contrato ?? 'pendiente'));
                      return ec ? (
                        <span className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md flex-shrink-0"
                          style={{ backgroundColor: ec.bg, color: ec.color, border: `1px solid ${ec.border}` }}>
                          <ec.Icon size={11} />
                          {ec.label}
                        </span>
                      ) : null;
                    })()}

                    {/* Society badge */}
                    {soc && (
                      <span className="hidden sm:inline text-xs font-medium px-2.5 py-1 rounded-md flex-shrink-0"
                        style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                        {soc.nombre}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setUploadEmpModal(emp); }}
                        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 hover:opacity-80"
                        style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#16A34A' }}
                        title="Subir archivo a carpeta publica del empleado"
                      >
                        <Upload size={13} />
                      </button>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : emp.id)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: isExpanded ? '#EFF6FF' : '#F8FAFC', border: '1px solid #E2E8F0', color: isExpanded ? '#0369A1' : '#94A3B8' }}
                        title="Ver detalle"
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      <button
                        onClick={() => openEdit(emp)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                        style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
                        title="Editar"
                      >
                        <Pencil size={13} />
                      </button>
                      {currentUserRole === 'admin' && (
                        <button
                          onClick={() => handleDelete(emp)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}
                          title="Eliminar"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Inline edit form for this employee */}
                  {showForm && editingId === emp.id && (
                    <div id={`edit-form-${emp.id}`} className="px-6 py-5" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Editar empleado</h4>
                        <button onClick={cancelForm} className="cursor-pointer" style={{ color: '#94A3B8' }}><X size={16} /></button>
                      </div>

                      {/* Section: Documentacion + Estado (top) */}
                      <div className="flex flex-wrap items-center gap-4 mb-5 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Estado:</span>
                          <button
                            type="button"
                            onClick={() => f('activo', !form.activo)}
                            className="px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer"
                            style={{
                              backgroundColor: form.activo ? '#16A34A' : '#DC2626',
                              color: '#FFFFFF',
                              border: 'none',
                            }}
                          >
                            {form.activo ? 'Activo' : 'Inactivo'}
                          </button>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Documentacion:</span>
                          {([
                            { key: 'doc_vitali', label: 'Vitali' },
                            { key: 'doc_titulacion', label: 'Titulación' },
                          ] as const).map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-1.5 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={form[key] as boolean}
                                onChange={(e) => f(key, e.target.checked)}
                                className="w-3.5 h-3.5 rounded cursor-pointer"
                                style={{ accentColor: '#16A34A' }}
                              />
                              <span className="text-xs font-medium" style={{ color: form[key] ? '#16A34A' : '#64748B' }}>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Section: Datos personales */}
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Datos personales</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        <FormField label="Nombre *">
                          <input value={form.nombre} onChange={(e) => f('nombre', e.target.value)}
                            className="form-input" placeholder="Nombre completo" />
                        </FormField>
                        <FormField label="Email">
                          <input value={form.email ?? ''} onChange={(e) => f('email', e.target.value)}
                            type="email" className="form-input" placeholder="correo@empresa.com" />
                        </FormField>
                        <FormField label="DNI / NIE">
                          <input value={form.dni ?? ''} onChange={(e) => f('dni', e.target.value)}
                            className="form-input" placeholder="12345678A o X1234567A" />
                        </FormField>
                        <FormField label="Telefono">
                          <input value={form.telefono ?? ''} onChange={(e) => f('telefono', e.target.value)}
                            className="form-input" placeholder="+34 600 000 000" />
                        </FormField>
                        <FormField label="Fecha de nacimiento">
                          <input value={form.fecha_nacimiento ?? ''} onChange={(e) => f('fecha_nacimiento', e.target.value)}
                            type="date" className="form-input" />
                        </FormField>
                        <FormField label="Sociedad *">
                          <select value={form.id_sociedad} onChange={(e) => f('id_sociedad', e.target.value)} className="form-input">
                            <option value="">Seleccionar...</option>
                            {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </FormField>
                        <FormField label="Segunda sociedad (opcional)">
                          <select value={form.id_sociedad_secundaria ?? ''} onChange={(e) => f('id_sociedad_secundaria', e.target.value || null)} className="form-input">
                            <option value="">Ninguna</option>
                            {sociedades.filter((s) => s.id !== form.id_sociedad).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                          </select>
                        </FormField>
                        <FormField label="NASS">
                          <input value={form.nass ?? ''} onChange={(e) => f('nass', e.target.value || null)}
                            type="text" className="form-input" placeholder="Nº Afiliación Seg. Social" />
                        </FormField>
                        <FormField label="Sexo">
                          <select value={form.sexo ?? ''} onChange={(e) => f('sexo', e.target.value || null)} className="form-input">
                            <option value="">Seleccionar...</option>
                            <option value="Hombre">Hombre</option>
                            <option value="Mujer">Mujer</option>
                            <option value="Otro">Otro</option>
                          </select>
                        </FormField>
                        <FormField label="Convenio">
                          <input value={form.convenio ?? ''} onChange={(e) => f('convenio', e.target.value || null)}
                            type="text" className="form-input" placeholder="Convenio colectivo..." />
                        </FormField>
                        <FormField label="Localidad">
                          <input value={form.localidad ?? ''} onChange={(e) => f('localidad', e.target.value || null)}
                            type="text" className="form-input" placeholder="Localidad..." />
                        </FormField>
                        <FormField label="Código Postal">
                          <input value={form.codigo_postal ?? ''} onChange={(e) => f('codigo_postal', e.target.value || null)}
                            type="text" className="form-input" placeholder="00000" />
                        </FormField>
                        <FormField label="Dirección" className="sm:col-span-2 lg:col-span-3">
                          <input value={form.direccion ?? ''} onChange={(e) => f('direccion', e.target.value || null)}
                            type="text" className="form-input" placeholder="Calle, número, piso..." />
                        </FormField>
                      </div>

                      {/* Section: Datos contractuales */}
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Datos contractuales</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        <FormField label="Tipo de contrato">
                          <select value={form.tipo_contrato ?? ''} onChange={(e) => f('tipo_contrato', e.target.value)} className="form-input">
                            <option value="">Seleccionar...</option>
                            {TIPOS_CONTRATO.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </FormField>
                        <FormField label="Fecha de alta">
                          <input value={form.fecha_alta ?? ''} onChange={(e) => f('fecha_alta', e.target.value)}
                            type="date" className="form-input" />
                        </FormField>
                        <FormField label="Fin periodo de prueba">
                          <input value={form.fin_periodo_prueba ?? ''} onChange={(e) => f('fin_periodo_prueba', e.target.value)}
                            type="date" className="form-input" />
                        </FormField>
                        <FormField label="Observaciones contrato" className="sm:col-span-2 lg:col-span-3">
                          <textarea value={form.observaciones_contrato ?? ''} onChange={(e) => f('observaciones_contrato', e.target.value)}
                            rows={2} className="form-input resize-none" placeholder="Condiciones especiales, anexos..." />
                        </FormField>
                      </div>

                      {/* Section: Datos operativos */}
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Datos operativos</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                        <FormField label="Turno">
                          <select value={form.turno ?? ''} onChange={(e) => f('turno', e.target.value)} className="form-input">
                            <option value="">Seleccionar...</option>
                            {TURNOS.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </FormField>
                        <FormField label="Puesto">
                          <input value={form.puesto ?? ''} onChange={(e) => f('puesto', e.target.value)}
                            className="form-input" placeholder="Tecnico, Operario..." />
                        </FormField>
                        <FormField label="Centro de trabajo">
                          <div className="flex gap-1.5">
                            <select
                              value={form.centro_trabajo ?? ''}
                              onChange={(e) => f('centro_trabajo', e.target.value)}
                              className="form-input flex-1"
                            >
                              <option value="">Seleccionar...</option>
                              {centros
                                .filter((c) => !form.id_sociedad || c.id_sociedad === form.id_sociedad)
                                .map((c) => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                            </select>
                            <button
                              type="button"
                              onClick={() => setShowCreateCentro(true)}
                              title="Crear nuevo centro"
                              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-150 hover:opacity-80"
                              style={{ backgroundColor: '#0369A1', color: '#FFFFFF', marginTop: '0px' }}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </FormField>
                        <FormField label="Titulacion habilitante" className="sm:col-span-2">
                          <input value={form.titulacion_habilitante ?? ''} onChange={(e) => f('titulacion_habilitante', e.target.value)}
                            className="form-input" placeholder="Grado, Master, Certificacion..." />
                        </FormField>
                        <FormField label="Fecha pago tasas">
                          <input value={form.fecha_pago_tasas ?? ''} onChange={(e) => f('fecha_pago_tasas', e.target.value)}
                            type="date" className="form-input" />
                        </FormField>
                      </div>

                      {/* Section: Observaciones */}
                      <div className="grid grid-cols-1 gap-3 mb-5">
                        <FormField label="Observaciones generales">
                          <textarea value={form.observaciones ?? ''} onChange={(e) => f('observaciones', e.target.value)}
                            rows={2} className="form-input resize-none" placeholder="Notas adicionales..." />
                        </FormField>
                      </div>

                      {/* Section: Estado del contrato */}
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Estado del contrato</p>
                      <div className="rounded-xl p-4 mb-5" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                        <div className="flex gap-2 flex-wrap mb-3">
                          {ESTADOS_CONTRATO.map(({ value, label, color, bg, border, Icon }) => {
                            const isActive = (form.estado_contrato ?? 'pendiente') === value;
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => {
                                  const current = (form.estado_contrato ?? 'pendiente') as EstadoContrato;
                                  if (value === current) return;
                                  openContratoModal(editingId!, current, value);
                                }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150"
                                style={{
                                  backgroundColor: isActive ? bg : '#FFFFFF',
                                  color: isActive ? color : '#94A3B8',
                                  border: `1.5px solid ${isActive ? border : '#E2E8F0'}`,
                                }}
                              >
                                <Icon size={13} />
                                {label}
                              </button>
                            );
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => loadHistorialContrato(editingId!)}
                          className="text-xs font-medium cursor-pointer transition-opacity hover:opacity-70"
                          style={{ color: '#0369A1' }}
                        >
                          {loadingHistorial ? 'Cargando...' : 'Ver historial de cambios'}
                        </button>
                        {historialContrato.length > 0 && (
                          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                            {historialContrato.map((h) => {
                              const estadoNew = ESTADOS_CONTRATO.find((e) => e.value === h.estado_nuevo);
                              return (
                                <div key={h.id} className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #F1F5F9' }}>
                                  <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ backgroundColor: estadoNew?.bg ?? '#F8FAFC' }}>
                                    {estadoNew && <estadoNew.Icon size={10} style={{ color: estadoNew.color }} />}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium" style={{ color: '#1E293B' }}>
                                      {h.estado_anterior} → {h.estado_nuevo}
                                    </p>
                                    <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{h.justificacion}</p>
                                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
                                      {h.cambiado_por_nombre} · {new Date(h.created_at).toLocaleString('es-ES')}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 justify-end flex-wrap">
                        {!form.user_id && (
                          <button onClick={handleCreateAccess} disabled={creatingAccess}
                            title="Crear usuario de login para este empleado"
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                            style={{ backgroundColor: '#059669', color: '#FFFFFF' }}>
                            <UserPlus size={13} />
                            {creatingAccess ? 'Creando acceso...' : 'Crear acceso de usuario'}
                          </button>
                        )}
                        <button onClick={cancelForm} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
                          style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                          Cancelar
                        </button>
                        <button onClick={handleSave} disabled={saving}
                          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-60"
                          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                          <Save size={13} />
                          {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Expanded detail: asignaciones + tags */}
                  {isExpanded && (
                    <div className="px-6 pb-5 pt-2" style={{ backgroundColor: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
                      {loadingDetail ? (
                        <div className="py-6 text-center">
                          <div className="w-6 h-6 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {/* Ficha completa */}
                          <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#64748B' }}>Ficha del empleado</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                              {emp.dni && <Detail label="DNI/NIE" value={emp.dni} />}
                              {emp.telefono && <Detail label="Telefono" value={emp.telefono} />}
                              {emp.fecha_nacimiento && <Detail label="Fecha nac." value={emp.fecha_nacimiento} />}
                              {emp.fecha_alta && <Detail label="Fecha alta" value={emp.fecha_alta} />}
                              {emp.fin_periodo_prueba && <Detail label="Fin prueba" value={emp.fin_periodo_prueba} />}
                              {emp.tipo_contrato && <Detail label="Contrato" value={emp.tipo_contrato} />}
                              {emp.turno && <Detail label="Turno" value={emp.turno} />}
                              {emp.puesto && <Detail label="Puesto" value={emp.puesto} />}
                              {emp.centro_trabajo && <Detail label="Centro" value={emp.centro_trabajo} />}
                              {emp.titulacion_habilitante && <Detail label="Titulacion" value={emp.titulacion_habilitante} className="col-span-2" />}
                              {emp.fecha_pago_tasas && <Detail label="Pago tasas" value={emp.fecha_pago_tasas} />}
                              {emp.observaciones && <Detail label="Observaciones" value={emp.observaciones} className="col-span-2" />}
                              {emp.observaciones_contrato && <Detail label="Obs. contrato" value={emp.observaciones_contrato} className="col-span-2" />}
                            </div>
                          </div>

                          <div className="space-y-4">
                            {/* Asignaciones */}
                            <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <div className="flex items-center gap-2 mb-3">
                                <Building2 size={13} style={{ color: '#0369A1' }} />
                                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Centros asignados</p>
                              </div>
                              <div className="space-y-1.5 mb-3">
                                {asignaciones.length === 0 && (
                                  <p className="text-xs" style={{ color: '#94A3B8' }}>Sin asignaciones</p>
                                )}
                                {asignaciones.map((a) => (
                                  <div key={a.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg"
                                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                    <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{a.centro_nombre ?? a.id_centro}</span>
                                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>{a.rol}</span>
                                    <button onClick={() => handleRemoveAsignacion(a.id, emp.id)} disabled={savingDetail}
                                      className="cursor-pointer flex-shrink-0" style={{ color: '#DC2626' }}>
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="flex gap-1.5">
                                <select value={newCentroId} onChange={(e) => setNewCentroId(e.target.value)}
                                  className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                                  <option value="">Centro...</option>
                                  {centros.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                                </select>
                                <select value={newRol} onChange={(e) => setNewRol(e.target.value as 'Empleado' | 'Supervisor' | 'Admin')}
                                  className="px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                                  <option>Empleado</option>
                                  <option>Supervisor</option>
                                  <option>Admin</option>
                                </select>
                                <button onClick={() => handleAddAsignacion(emp.id)} disabled={savingDetail || !newCentroId}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>

                            {/* Tags */}
                            <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                              <div className="flex items-center gap-2 mb-3">
                                <Tag size={13} style={{ color: '#16A34A' }} />
                                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Etiquetas (ABAC)</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 mb-3">
                                {empleadoTags.length === 0 && (
                                  <p className="text-xs" style={{ color: '#94A3B8' }}>Sin etiquetas</p>
                                )}
                                {empleadoTags.map((t) => (
                                  <span key={t.etiquetado_id} className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                                    style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                                    {t.nombre}
                                    <button onClick={() => handleRemoveTag(t.etiquetado_id, emp.id)} disabled={savingDetail}
                                      className="cursor-pointer" style={{ color: '#16A34A' }}>
                                      <X size={10} />
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <div className="flex gap-1.5">
                                <select value={newTagId} onChange={(e) => setNewTagId(e.target.value)}
                                  className="flex-1 px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}>
                                  <option value="">Etiqueta...</option>
                                  {tags
                                    .filter((t) => !empleadoTags.find((et) => et.id === t.id))
                                    .map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
                                </select>
                                <button onClick={() => handleAddTag(emp.id)} disabled={savingDetail || !newTagId}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-50"
                                  style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}>
                                  <Plus size={12} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <Pagination page={empSafePage} totalPages={empTotalPages} totalItems={filtered.length} pageSize={EMP_PAGE_SIZE} onPage={setPage} />
          </div>
        )}
      </div>

      <style>{`
        .form-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.75rem;
          outline: none;
          background-color: #FFFFFF;
          border: 1px solid #E2E8F0;
          color: #1E293B;
        }
        .form-input:focus {
          border-color: #93C5FD;
          box-shadow: 0 0 0 2px rgba(147,197,253,0.3);
        }
      `}</style>
    </div>
  );
}

function FormField({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium mb-1" style={{ color: '#64748B' }}>{label}</label>
      {children}
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <span style={{ color: '#94A3B8' }}>{label}: </span>
      <span className="font-medium" style={{ color: '#1E293B' }}>{value}</span>
    </div>
  );
}
