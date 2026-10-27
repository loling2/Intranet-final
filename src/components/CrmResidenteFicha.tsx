import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import {
  User, Mail, Phone, Building2, Calendar, FolderOpen, FileText,
  Heart, Pill, Users, CreditCard, Plus, X, Trash2, Save, MapPin,
  Contact, Stethoscope, Activity, ClipboardList, Phone as PhoneIcon, Ambulance, FileSignature,
  Upload, Download, Loader2, AlertCircle,
} from 'lucide-react';
import CrmDocumentosModule from './CrmDocumentosModule';
import CrmSeguimientoModule from './CrmSeguimientoModule';
import CrmLlamadasModule from './CrmLlamadasModule';
import CrmMedicacionModule from './CrmMedicacionModule';
import CrmAbvdModule from './CrmAbvdModule';
import CrmIncidenciasSanitariasModule from './CrmIncidenciasSanitariasModule';
import CrmPautasModule from './CrmPautasModule';
import CrmPaiModule from './CrmPaiModule';
import CrmSesionesModule from './CrmSesionesModule';
import { ensureCrmFolder, uploadCrmFile, downloadFromWasabi, getWasabiBlobUrl, deleteFromWasabi } from '../lib/wasabi';

interface Props {
  usuario: {
    id: string;
    nombre: string;
    apellidos: string | null;
    email: string | null;
    telefono: string | null;
    observaciones: string | null;
    activo: boolean;
    centros?: { id: string; nombre: string }[];
  };
  isAdmin: boolean;
  notas: unknown[];
  notasLoading: boolean;
  calendarCells: { date: Date | null; iso: string | null }[];
  notasByDate: Record<string, number>;
  todayISO: string;
  month: number;
  year: number;
  filterFecha: string;
  setFilterFecha: (v: string) => void;
  prevMonth: () => void;
  nextMonth: () => void;
  goToday: () => void;
  openNotaModal: (iso: string) => void;
  openEditNotaModal: (nota: { id: string; fecha: string; autor_nombre: string; contenido: string }) => void;
  onDeleteNota: (id: string) => void;
  notasDisplay: { id: string; fecha: string | null; autor_nombre: string; contenido: string; created_at: string }[];
  MONTH_NAMES: string[];
  DAY_NAMES: string[];
  formatDateDisplay: (iso: string) => string;
  onEdit: () => void;
  autorNombre?: string;
  initialTab?: DetailTab;
}

type DetailTab = 'info' | 'contactos' | 'cuentas' | 'medico' | 'tratamiento' | 'calendario' | 'documentos' | 'seguimiento' | 'llamadas' | 'medicacion' | 'abvd' | 'inc_sanitarias' | 'pautas' | 'pai' | 'sesiones';

interface Contacto {
  id: string;
  nombre: string;
  parentesco: string;
  relacion_juridica: string;
  telefono: string;
  email: string;
  es_principal: boolean;
}
interface Cuenta {
  id: string;
  tipo_cuenta: string;
  titular: string;
  identificacion_titular: string;
  iban: string;
  entidad: string;
  observaciones: string;
}
interface PrestacionDocumento {
  id: string;
  usuario_servicio_id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tamano_bytes: number;
  created_at: string;
}
interface TratamientoDocumento {
  id: string;
  usuario_servicio_id: string;
  nombre_archivo: string;
  wasabi_key: string;
  tamano_bytes: number;
  created_at: string;
}
interface Medico {
  alergias: string;
  diagnosticos: string;
  movilidad: string;
  dependencia: string;
  notas: string;
}
interface Tratamiento {
  tratamiento: string;
  medicacion: string;
  pautas: string;
  seguimiento: string;
}
interface ResidenteExtra {
  tipo_identificacion: string;
  identificacion: string;
  genero: string;
  tipo_direccion: string;
  direccion: string;
  localidad: string;
  provincia: string;
  codigo_postal: string;
  pais: string;
  fecha_nacimiento: string | null;
  estado_civil: string;
  foto_url: string | null;
}

export default function CrmResidenteFicha(props: Props) {
  const { usuario, isAdmin } = props;
  const [detailTab, setDetailTab] = useState<DetailTab>(props.initialTab ?? 'info');

  const [extra, setExtra] = useState<ResidenteExtra | null>(null);
  const [extraEditing, setExtraEditing] = useState(false);
  const [extraForm, setExtraForm] = useState<ResidenteExtra | null>(null);
  const [extraSaving, setExtraSaving] = useState(false);

  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [showContactoForm, setShowContactoForm] = useState(false);
  const [contactoForm, setContactoForm] = useState<Omit<Contacto, 'id'>>({ nombre: '', parentesco: '', relacion_juridica: '', telefono: '', email: '', es_principal: false });
  const [editingContactoId, setEditingContactoId] = useState<string | null>(null);

  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [showCuentaForm, setShowCuentaForm] = useState(false);
  const [cuentaForm, setCuentaForm] = useState<Omit<Cuenta, 'id'>>({ tipo_cuenta: '', titular: '', identificacion_titular: '', iban: '', entidad: '', observaciones: '' });
  const [editingCuentaId, setEditingCuentaId] = useState<string | null>(null);
  const [prestacionesTab, setPrestacionesTab] = useState<'informacion' | 'cuenta'>('informacion');
  const [prestacionDocumentos, setPrestacionDocumentos] = useState<PrestacionDocumento[]>([]);
  const [prestacionFiles, setPrestacionFiles] = useState<File[]>([]);
  const [prestacionUploading, setPrestacionUploading] = useState(false);
  const [prestacionUploadError, setPrestacionUploadError] = useState('');
  const [prestacionDragOver, setPrestacionDragOver] = useState(false);
  const prestacionFileInputRef = useRef<HTMLInputElement>(null);

  const [medico, setMedico] = useState<Medico>({ alergias: '', diagnosticos: '', movilidad: '', dependencia: '', notas: '' });
  const [medicoEditing, setMedicoEditing] = useState(false);
  const [medicoSaving, setMedicoSaving] = useState(false);

  const [tratamiento, setTratamiento] = useState<Tratamiento>({ tratamiento: '', medicacion: '', pautas: '', seguimiento: '' });
  const [tratamientoEditing, setTratamientoEditing] = useState(false);
  const [tratamientoSaving, setTratamientoSaving] = useState(false);
  const [tratamientoDocumentos, setTratamientoDocumentos] = useState<TratamientoDocumento[]>([]);
  const [tratamientoFiles, setTratamientoFiles] = useState<File[]>([]);
  const [tratamientoUploading, setTratamientoUploading] = useState(false);
  const [tratamientoUploadError, setTratamientoUploadError] = useState('');
  const [tratamientoDragOver, setTratamientoDragOver] = useState(false);
  const tratamientoFileInputRef = useRef<HTMLInputElement>(null);

  const selectedUserLabel = `${usuario.nombre} ${usuario.apellidos ?? ''}`.trim();

  const loadExtra = useCallback(async () => {
    const { data } = await supabase
      .from('usuarios_servicios')
      .select('tipo_identificacion, identificacion, genero, tipo_direccion, direccion, localidad, provincia, codigo_postal, pais, fecha_nacimiento, estado_civil, foto_url')
      .eq('id', usuario.id)
      .maybeSingle();
    setExtra((data ?? {}) as ResidenteExtra);
  }, [usuario.id]);

  const loadContactos = useCallback(async () => {
    const { data } = await supabase.from('crm_residente_contactos').select('*').eq('usuario_servicio_id', usuario.id).order('es_principal', { ascending: false });
    setContactos((data ?? []) as Contacto[]);
  }, [usuario.id]);

  const loadCuentas = useCallback(async () => {
    const { data } = await supabase.from('crm_residente_cuentas').select('*').eq('usuario_servicio_id', usuario.id).order('created_at', { ascending: false });
    setCuentas((data ?? []) as Cuenta[]);
  }, [usuario.id]);

  const loadPrestacionDocumentos = useCallback(async () => {
    const { data } = await supabase.from('crm_prestaciones_documentos').select('*').eq('usuario_servicio_id', usuario.id).order('created_at', { ascending: false });
    setPrestacionDocumentos((data ?? []) as PrestacionDocumento[]);
  }, [usuario.id]);

  const loadMedico = useCallback(async () => {
    const { data } = await supabase.from('crm_residente_medico').select('*').eq('usuario_servicio_id', usuario.id).maybeSingle();
    setMedico((data ?? { alergias: '', diagnosticos: '', movilidad: '', dependencia: '', notas: '' }) as Medico);
  }, [usuario.id]);

  const loadTratamiento = useCallback(async () => {
    const { data } = await supabase.from('crm_residente_tratamiento').select('*').eq('usuario_servicio_id', usuario.id).maybeSingle();
    setTratamiento((data ?? { tratamiento: '', medicacion: '', pautas: '', seguimiento: '' }) as Tratamiento);
  }, [usuario.id]);

  const loadTratamientoDocumentos = useCallback(async () => {
    const { data } = await supabase.from('crm_tratamiento_documentos').select('*').eq('usuario_servicio_id', usuario.id).order('created_at', { ascending: false });
    setTratamientoDocumentos((data ?? []) as TratamientoDocumento[]);
  }, [usuario.id]);

  useEffect(() => { loadExtra(); loadContactos(); loadCuentas(); loadPrestacionDocumentos(); loadMedico(); loadTratamiento(); loadTratamientoDocumentos(); }, [loadExtra, loadContactos, loadCuentas, loadPrestacionDocumentos, loadMedico, loadTratamiento, loadTratamientoDocumentos]);

  async function saveExtra() {
    if (!extraForm) return;
    setExtraSaving(true);
    const { error } = await supabase.from('usuarios_servicios').update({
      tipo_identificacion: extraForm.tipo_identificacion || null,
      identificacion: extraForm.identificacion || null,
      genero: extraForm.genero || null,
      tipo_direccion: extraForm.tipo_direccion || null,
      direccion: extraForm.direccion || null,
      localidad: extraForm.localidad || null,
      provincia: extraForm.provincia || null,
      codigo_postal: extraForm.codigo_postal || null,
      pais: extraForm.pais || null,
      fecha_nacimiento: extraForm.fecha_nacimiento || null,
      estado_civil: extraForm.estado_civil || null,
      foto_url: extraForm.foto_url || null,
      updated_at: new Date().toISOString(),
    }).eq('id', usuario.id);
    if (!error) { setExtra(extraForm); setExtraEditing(false); }
    setExtraSaving(false);
  }

  async function saveContacto() {
    if (!contactoForm.nombre.trim()) return;
    if (editingContactoId) {
      await supabase.from('crm_residente_contactos').update({ ...contactoForm, updated_at: new Date().toISOString() }).eq('id', editingContactoId);
    } else {
      await supabase.from('crm_residente_contactos').insert({ ...contactoForm, usuario_servicio_id: usuario.id });
    }
    setShowContactoForm(false);
    setEditingContactoId(null);
    setContactoForm({ nombre: '', parentesco: '', relacion_juridica: '', telefono: '', email: '', es_principal: false });
    await loadContactos();
  }

  async function deleteContacto(id: string) {
    await supabase.from('crm_residente_contactos').delete().eq('id', id);
    await loadContactos();
  }

  async function saveCuenta() {
    if (!cuentaForm.titular.trim() && !cuentaForm.iban.trim()) return;
    if (editingCuentaId) {
      await supabase.from('crm_residente_cuentas').update({ ...cuentaForm, updated_at: new Date().toISOString() }).eq('id', editingCuentaId);
    } else {
      await supabase.from('crm_residente_cuentas').insert({ ...cuentaForm, usuario_servicio_id: usuario.id });
    }
    setShowCuentaForm(false);
    setEditingCuentaId(null);
    setCuentaForm({ tipo_cuenta: '', titular: '', identificacion_titular: '', iban: '', entidad: '', observaciones: '' });
    await loadCuentas();
  }

  async function deleteCuenta(id: string) {
    await supabase.from('crm_residente_cuentas').delete().eq('id', id);
    await loadCuentas();
  }

  function addPrestacionFiles(incoming: FileList | File[]) {
    const pdfs = Array.from(incoming).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    setPrestacionFiles(previous => {
      const names = new Set(previous.map(file => file.name));
      return [...previous, ...pdfs.filter(file => !names.has(file.name))];
    });
  }

  async function uploadPrestacionFiles() {
    if (!prestacionFiles.length) return;
    setPrestacionUploading(true); setPrestacionUploadError('');
    const prefix = `crm/prestaciones/${usuario.id}/`;
    try {
      await ensureCrmFolder(prefix);
      const { data: authData } = await supabase.auth.getUser();
      const failed: File[] = [];
      for (const file of prestacionFiles) {
        try {
          const key = `${prefix}${Date.now()}-${file.name}`;
          await uploadCrmFile(file, key);
          const { error: insertError } = await supabase.from('crm_prestaciones_documentos').insert({
            usuario_servicio_id: usuario.id,
            nombre_archivo: file.name,
            wasabi_key: key,
            tamano_bytes: file.size,
            uploaded_by: authData.user?.id ?? null,
          });
          if (insertError) throw insertError;
        } catch {
          failed.push(file);
        }
      }
      setPrestacionFiles(failed);
      if (failed.length) setPrestacionUploadError(`${failed.length} archivo(s) no se pudieron subir.`);
      await loadPrestacionDocumentos();
    } catch {
      setPrestacionUploadError('No se pudieron subir los documentos.');
    } finally {
      setPrestacionUploading(false);
    }
  }

  async function deletePrestacionDocumento(documento: PrestacionDocumento) {
    try {
      await deleteFromWasabi(documento.wasabi_key);
      await supabase.from('crm_prestaciones_documentos').delete().eq('id', documento.id);
      await loadPrestacionDocumentos();
    } catch {
      setPrestacionUploadError('No se pudo eliminar el documento.');
    }
  }

  async function previewPrestacionDocumento(documento: PrestacionDocumento) {
    try {
      const url = await getWasabiBlobUrl(documento.wasabi_key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setPrestacionUploadError('No se pudo abrir el documento.');
    }
  }

  async function downloadPrestacionDocumento(documento: PrestacionDocumento) {
    try {
      await downloadFromWasabi(documento.wasabi_key, documento.nombre_archivo);
    } catch {
      setPrestacionUploadError('No se pudo descargar el documento.');
    }
  }

  async function saveMedico() {
    setMedicoSaving(true);
    await supabase.from('crm_residente_medico').upsert({ usuario_servicio_id: usuario.id, ...medico, updated_at: new Date().toISOString() });
    setMedicoEditing(false);
    setMedicoSaving(false);
  }

  async function saveTratamiento() {
    setTratamientoSaving(true);
    await supabase.from('crm_residente_tratamiento').upsert({ usuario_servicio_id: usuario.id, ...tratamiento, updated_at: new Date().toISOString() });
    setTratamientoEditing(false);
    setTratamientoSaving(false);
  }

  function addTratamientoFiles(incoming: FileList | File[]) {
    const pdfs = Array.from(incoming).filter(file => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    setTratamientoFiles(previous => {
      const names = new Set(previous.map(file => file.name));
      return [...previous, ...pdfs.filter(file => !names.has(file.name))];
    });
  }

  async function uploadTratamientoFiles() {
    if (!tratamientoFiles.length) return;
    setTratamientoUploading(true); setTratamientoUploadError('');
    const prefix = `crm/tratamiento/${usuario.id}/`;
    try {
      await ensureCrmFolder(prefix);
      const { data: authData } = await supabase.auth.getUser();
      const failed: File[] = [];
      for (const file of tratamientoFiles) {
        try {
          const key = `${prefix}${Date.now()}-${file.name}`;
          await uploadCrmFile(file, key);
          const { error: insertError } = await supabase.from('crm_tratamiento_documentos').insert({ usuario_servicio_id: usuario.id, nombre_archivo: file.name, wasabi_key: key, tamano_bytes: file.size, uploaded_by: authData.user?.id ?? null });
          if (insertError) throw insertError;
        } catch {
          failed.push(file);
        }
      }
      setTratamientoFiles(failed);
      if (failed.length) setTratamientoUploadError(`${failed.length} archivo(s) no se pudieron subir.`);
      await loadTratamientoDocumentos();
    } catch {
      setTratamientoUploadError('No se pudieron subir los documentos.');
    } finally {
      setTratamientoUploading(false);
    }
  }

  async function deleteTratamientoDocumento(documento: TratamientoDocumento) {
    try {
      await deleteFromWasabi(documento.wasabi_key);
      await supabase.from('crm_tratamiento_documentos').delete().eq('id', documento.id);
      await loadTratamientoDocumentos();
    } catch {
      setTratamientoUploadError('No se pudo eliminar el documento.');
    }
  }

  async function previewTratamientoDocumento(documento: TratamientoDocumento) {
    try {
      const url = await getWasabiBlobUrl(documento.wasabi_key);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setTratamientoUploadError('No se pudo abrir el documento.');
    }
  }

  async function downloadTratamientoDocumento(documento: TratamientoDocumento) {
    try {
      await downloadFromWasabi(documento.wasabi_key, documento.nombre_archivo);
    } catch {
      setTratamientoUploadError('No se pudo descargar el documento.');
    }
  }

  const tabs: { id: DetailTab; label: string; icon: typeof User }[] = [
    { id: 'info', label: 'Información', icon: User },
    { id: 'contactos', label: 'Contactos', icon: Users },
    { id: 'cuentas', label: 'Prestaciones', icon: CreditCard },
    { id: 'medico', label: 'Información médica', icon: Stethoscope },
    { id: 'tratamiento', label: 'Tratamiento', icon: Pill },
    { id: 'seguimiento', label: 'Seguimiento diario', icon: Activity },
    { id: 'llamadas', label: 'Llamadas y visitas', icon: PhoneIcon },
    { id: 'medicacion', label: 'Medicación', icon: Pill },
    { id: 'abvd', label: 'ABVD', icon: Heart },
    { id: 'inc_sanitarias', label: 'Inc. sanitarias', icon: Ambulance },
    { id: 'pautas', label: 'Pautas', icon: ClipboardList },
    { id: 'pai', label: 'PAI / PIE', icon: FileSignature },
    { id: 'sesiones', label: 'Sesiones', icon: FileText },
    { id: 'calendario', label: 'Calendario y Notas', icon: Calendar },
    { id: 'documentos', label: 'Documentos', icon: FolderOpen },
  ];

  const inputStyle = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#0F172A' } as const;
  const labelStyle = { color: '#475569' } as const;
  const cardStyle = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' } as const;

  return (
    <div className="space-y-6">
      {/* Header with back */}
      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
            <User size={20} style={{ color: '#0369A1' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>{selectedUserLabel}</h2>
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: usuario.activo ? '#F0FDF4' : '#FEF2F2', color: usuario.activo ? '#16A34A' : '#DC2626' }}>{usuario.activo ? 'Activo' : 'Inactivo'}</span>
              {usuario.centros && usuario.centros.map((c) => <span key={c.id} className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{c.nombre}</span>)}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="flex flex-wrap gap-1 p-1 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = detailTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setDetailTab(tab.id)}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap flex-shrink-0"
              style={{ backgroundColor: isActive ? '#0369A1' : 'transparent', color: isActive ? '#FFFFFF' : '#64748B' }}>
              <TabIcon size={13} />{tab.label}
            </button>
          );
        })}
        {isAdmin && (
          <button onClick={props.onEdit}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all ml-auto"
            style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
            Editar
          </button>
        )}
      </div>

      {/* === Tab: Información === */}
      {detailTab === 'info' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-6" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Datos personales</h3>
              {isAdmin && !extraEditing && <button onClick={() => { setExtraForm(extra ?? {} as ResidenteExtra); setExtraEditing(true); }} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Editar</button>}
            </div>
            {extraEditing && extraForm ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Tipo identificación</label>
                    <select value={extraForm.tipo_identificacion ?? ''} onChange={e => setExtraForm({ ...extraForm, tipo_identificacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                      <option value="">-</option><option>DNI</option><option>NIE</option><option>Pasaporte</option>
                    </select></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Identificación</label><input type="text" value={extraForm.identificacion ?? ''} onChange={e => setExtraForm({ ...extraForm, identificacion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Género</label>
                    <select value={extraForm.genero ?? ''} onChange={e => setExtraForm({ ...extraForm, genero: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                      <option value="">-</option><option>Hombre</option><option>Mujer</option><option>Otro</option>
                    </select></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Fecha nacimiento</label><input type="date" value={extraForm.fecha_nacimiento ?? ''} onChange={e => setExtraForm({ ...extraForm, fecha_nacimiento: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                </div>
                <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Estado civil</label>
                  <select value={extraForm.estado_civil ?? ''} onChange={e => setExtraForm({ ...extraForm, estado_civil: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="">-</option><option>Soltero/a</option><option>Casado/a</option><option>Viudo/a</option><option>Divorciado/a</option><option>Separado/a</option>
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Tipo de dirección</label>
                  <select value={extraForm.tipo_direccion ?? ''} onChange={e => setExtraForm({ ...extraForm, tipo_direccion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none cursor-pointer" style={inputStyle}>
                    <option value="">-</option><option>Domicilio habitual</option><option>Residencia</option><option>Otra</option>
                  </select></div>
                <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Dirección</label><input type="text" value={extraForm.direccion ?? ''} onChange={e => setExtraForm({ ...extraForm, direccion: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Localidad</label><input type="text" value={extraForm.localidad ?? ''} onChange={e => setExtraForm({ ...extraForm, localidad: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Provincia</label><input type="text" value={extraForm.provincia ?? ''} onChange={e => setExtraForm({ ...extraForm, provincia: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Código postal</label><input type="text" value={extraForm.codigo_postal ?? ''} onChange={e => setExtraForm({ ...extraForm, codigo_postal: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>País</label><input type="text" value={extraForm.pais ?? ''} onChange={e => setExtraForm({ ...extraForm, pais: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={saveExtra} disabled={extraSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}><Save size={14} /> {extraSaving ? 'Guardando...' : 'Guardar'}</button>
                  <button onClick={() => setExtraEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Contact size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Identificación</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{extra?.tipo_identificacion ? `${extra.tipo_identificacion}: ${extra.identificacion || '-'}` : 'Sin datos'}</p></div></div>
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><User size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Género / Estado civil</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{[extra?.genero, extra?.estado_civil].filter(Boolean).join(' · ') || 'Sin datos'}</p></div></div>
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Calendar size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Fecha nacimiento</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{extra?.fecha_nacimiento ? new Date(extra.fecha_nacimiento).toLocaleDateString('es-ES') : 'Sin datos'}</p></div></div>
                <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><MapPin size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Dirección</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{[extra?.direccion, extra?.localidad, extra?.provincia, extra?.codigo_postal].filter(Boolean).join(', ') || 'Sin dirección'}</p></div></div>
              </div>
            )}
          </div>
          <div className="rounded-2xl p-6" style={cardStyle}>
            <h3 className="font-semibold text-sm mb-4" style={{ color: '#0F172A' }}>Contacto y observaciones</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Mail size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Email</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{usuario.email || 'Sin email'}</p></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Phone size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Teléfono</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{usuario.telefono || 'Sin teléfono'}</p></div></div>
              <div className="flex items-center gap-3"><div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><Building2 size={16} style={{ color: '#0369A1' }} /></div><div><p className="text-xs" style={{ color: '#94A3B8' }}>Centros</p><p className="text-sm font-medium" style={{ color: '#0F172A' }}>{usuario.centros && usuario.centros.length > 0 ? usuario.centros.map(c => c.nombre).join(', ') : 'Sin centros'}</p></div></div>
            </div>
            <div className="mt-4 pt-4" style={{ borderTop: '1px solid #F1F5F9' }}>
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Observaciones</p>
              {usuario.observaciones ? <p className="text-sm" style={{ color: '#475569', lineHeight: 1.6 }}>{usuario.observaciones}</p> : <p className="text-sm" style={{ color: '#94A3B8' }}>Sin observaciones</p>}
            </div>
          </div>
        </div>
      )}

      {/* === Tab: Contactos === */}
      {detailTab === 'contactos' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Familiares y contactos de emergencia</h3>
            <button onClick={() => { setEditingContactoId(null); setContactoForm({ nombre: '', parentesco: '', relacion_juridica: '', telefono: '', email: '', es_principal: false }); setShowContactoForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              <Plus size={14} /> Añadir contacto
            </button>
          </div>
          {contactos.length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={cardStyle}><Users size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} /><p className="text-sm font-medium" style={{ color: '#475569' }}>Sin contactos registrados</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contactos.map(c => (
                <div key={c.id} className="rounded-xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: c.es_principal ? '#F0FDF4' : '#EFF6FF' }}><Users size={18} style={{ color: c.es_principal ? '#16A34A' : '#0369A1' }} /></div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{c.nombre}</p>
                        {c.parentesco && <p className="text-xs" style={{ color: '#94A3B8' }}>{c.parentesco}</p>}
                      </div>
                    </div>
                    {c.es_principal && <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>Principal</span>}
                  </div>
                  <div className="space-y-1.5 mb-3">
                    {c.telefono && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Phone size={12} /> {c.telefono}</div>}
                    {c.email && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Mail size={12} /> {c.email}</div>}
                    {c.relacion_juridica && <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}><Contact size={12} /> {c.relacion_juridica}</div>}
                  </div>
                  <div className="flex gap-2 pt-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                    <button onClick={() => { setEditingContactoId(c.id); setContactoForm({ nombre: c.nombre, parentesco: c.parentesco, relacion_juridica: c.relacion_juridica, telefono: c.telefono, email: c.email, es_principal: c.es_principal }); setShowContactoForm(true); }} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Editar</button>
                    <button onClick={() => deleteContacto(c.id)} className="flex items-center gap-1 ml-auto text-xs font-medium cursor-pointer" style={{ color: '#DC2626' }}><Trash2 size={12} /> Eliminar</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {showContactoForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingContactoId ? 'Editar contacto' : 'Nuevo contacto'}</h3>
                  <button onClick={() => setShowContactoForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                </div>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Nombre *</label><input type="text" value={contactoForm.nombre} onChange={e => setContactoForm({ ...contactoForm, nombre: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} autoFocus /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Parentesco</label><input type="text" value={contactoForm.parentesco} onChange={e => setContactoForm({ ...contactoForm, parentesco: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Hijo/a, Sobrino/a..." /></div>
                    <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Relación jurídica</label><input type="text" value={contactoForm.relacion_juridica} onChange={e => setContactoForm({ ...contactoForm, relacion_juridica: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Tutor/a, Representante..." /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Teléfono</label><input type="text" value={contactoForm.telefono} onChange={e => setContactoForm({ ...contactoForm, telefono: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                    <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Email</label><input type="email" value={contactoForm.email} onChange={e => setContactoForm({ ...contactoForm, email: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={contactoForm.es_principal} onChange={e => setContactoForm({ ...contactoForm, es_principal: e.target.checked })} className="cursor-pointer" /><span className="text-sm" style={labelStyle}>Contacto principal de emergencia</span></label>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveContacto} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}><Save size={14} /> Guardar</button>
                    <button onClick={() => setShowContactoForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Tab: Prestaciones === */}
      {detailTab === 'cuentas' && (
        <div className="space-y-4">
          <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F1F5F9' }}>
            <button onClick={() => setPrestacionesTab('informacion')} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: prestacionesTab === 'informacion' ? '#FFFFFF' : 'transparent', color: prestacionesTab === 'informacion' ? '#0369A1' : '#64748B' }}>Información</button>
            <button onClick={() => setPrestacionesTab('cuenta')} className="px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer" style={{ backgroundColor: prestacionesTab === 'cuenta' ? '#FFFFFF' : 'transparent', color: prestacionesTab === 'cuenta' ? '#0369A1' : '#64748B' }}>Cuenta</button>
          </div>
          {prestacionesTab === 'informacion' && (
            <div className="rounded-2xl p-6 space-y-4" style={cardStyle}>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Información de prestaciones</h3>
                <p className="text-xs mt-1" style={{ color: '#64748B' }}>Sube aquí resoluciones, certificados y documentación relacionada con las prestaciones.</p>
              </div>
              <div
                onClick={() => !prestacionUploading && prestacionFileInputRef.current?.click()}
                onDrop={e => { e.preventDefault(); setPrestacionDragOver(false); if (e.dataTransfer.files.length) addPrestacionFiles(e.dataTransfer.files); }}
                onDragOver={e => { e.preventDefault(); setPrestacionDragOver(true); }}
                onDragLeave={e => { e.preventDefault(); setPrestacionDragOver(false); }}
                className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer select-none transition-all"
                style={{ border: `2px dashed ${prestacionDragOver ? '#0369A1' : '#CBD5E1'}`, backgroundColor: prestacionDragOver ? '#EFF6FF' : '#F8FAFC', padding: '28px 16px', minHeight: 130 }}
              >
                <Upload size={26} style={{ color: prestacionDragOver ? '#0369A1' : '#94A3B8' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>Arrastra documentos aquí o haz clic para seleccionar</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>Solo archivos PDF</p>
                <input ref={prestacionFileInputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" disabled={prestacionUploading} onChange={e => { if (e.target.files?.length) addPrestacionFiles(e.target.files); if (prestacionFileInputRef.current) prestacionFileInputRef.current.value = ''; }} />
              </div>
              {prestacionFiles.length > 0 && (
                <div className="space-y-2">
                  {prestacionFiles.map(file => <div key={file.name} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}><FileText size={14} style={{ color: '#DC2626' }} /><span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{file.name}</span><span className="text-xs" style={{ color: '#94A3B8' }}>{(file.size / 1024).toFixed(0)} KB</span><button onClick={() => setPrestacionFiles(previous => previous.filter(item => item.name !== file.name))} className="text-xs cursor-pointer" style={{ color: '#DC2626' }}>Quitar</button></div>)}
                  {prestacionUploadError && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} />{prestacionUploadError}</p>}
                  <button onClick={uploadPrestacionFiles} disabled={prestacionUploading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{prestacionUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{prestacionUploading ? 'Subiendo...' : 'Subir documentos'}</button>
                </div>
              )}
              <div className="space-y-2">
                {prestacionDocumentos.length === 0 ? <p className="text-sm text-center py-4" style={{ color: '#94A3B8' }}>Sin documentos de prestaciones</p> : prestacionDocumentos.map(documento => <div key={documento.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}><FileText size={14} style={{ color: '#DC2626' }} /><span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{documento.nombre_archivo}</span><span className="text-xs" style={{ color: '#94A3B8' }}>{(documento.tamano_bytes / 1024).toFixed(0)} KB</span><button onClick={() => previewPrestacionDocumento(documento)} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Ver</button><button onClick={() => downloadPrestacionDocumento(documento)} className="p-1 cursor-pointer" title="Descargar"><Download size={13} style={{ color: '#475569' }} /></button>{isAdmin && <button onClick={() => deletePrestacionDocumento(documento)} className="p-1 cursor-pointer" title="Eliminar"><Trash2 size={13} style={{ color: '#DC2626' }} /></button>}</div>)}
              </div>
            </div>
          )}
          {prestacionesTab === 'cuenta' && (
          <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Cuentas y datos administrativos</h3>
            <button onClick={() => { setEditingCuentaId(null); setCuentaForm({ tipo_cuenta: '', titular: '', identificacion_titular: '', iban: '', entidad: '', observaciones: '' }); setShowCuentaForm(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              <Plus size={14} /> Añadir cuenta
            </button>
          </div>
          {cuentas.length === 0 ? (
            <div className="text-center py-12 rounded-xl" style={cardStyle}><CreditCard size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} /><p className="text-sm font-medium" style={{ color: '#475569' }}>Sin cuentas registradas</p></div>
          ) : (
            <div className="space-y-3">
              {cuentas.map(c => (
                <div key={c.id} className="rounded-xl p-5" style={cardStyle}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}><CreditCard size={18} style={{ color: '#0369A1' }} /></div>
                      <div>
                        <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{c.titular || 'Sin titular'}</p>
                        {c.tipo_cuenta && <p className="text-xs" style={{ color: '#94A3B8' }}>{c.tipo_cuenta}</p>}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingCuentaId(c.id); setCuentaForm({ tipo_cuenta: c.tipo_cuenta, titular: c.titular, identificacion_titular: c.identificacion_titular, iban: c.iban, entidad: c.entidad, observaciones: c.observaciones }); setShowCuentaForm(true); }} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Editar</button>
                      <button onClick={() => deleteCuenta(c.id)} className="flex items-center gap-1 text-xs font-medium cursor-pointer" style={{ color: '#DC2626' }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs" style={{ color: '#64748B' }}>
                    {c.iban && <div><span style={{ color: '#94A3B8' }}>IBAN: </span>{c.iban}</div>}
                    {c.entidad && <div><span style={{ color: '#94A3B8' }}>Entidad: </span>{c.entidad}</div>}
                    {c.identificacion_titular && <div><span style={{ color: '#94A3B8' }}>Identif. titular: </span>{c.identificacion_titular}</div>}
                  </div>
                  {c.observaciones && <p className="text-xs mt-2" style={{ color: '#475569' }}>{c.observaciones}</p>}
                </div>
              ))}
            </div>
          )}
          {showCuentaForm && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <div className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: '#FFFFFF' }}>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{editingCuentaId ? 'Editar cuenta' : 'Nueva cuenta'}</h3>
                  <button onClick={() => setShowCuentaForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#94A3B8' }}><X size={14} /></button>
                </div>
                <div className="space-y-3">
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Tipo de cuenta</label><input type="text" value={cuentaForm.tipo_cuenta} onChange={e => setCuentaForm({ ...cuentaForm, tipo_cuenta: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} placeholder="Bancaria, Pensiones..." /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Titular</label><input type="text" value={cuentaForm.titular} onChange={e => setCuentaForm({ ...cuentaForm, titular: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Identificación del titular</label><input type="text" value={cuentaForm.identificacion_titular} onChange={e => setCuentaForm({ ...cuentaForm, identificacion_titular: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>IBAN</label><input type="text" value={cuentaForm.iban} onChange={e => setCuentaForm({ ...cuentaForm, iban: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Entidad</label><input type="text" value={cuentaForm.entidad} onChange={e => setCuentaForm({ ...cuentaForm, entidad: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm outline-none" style={inputStyle} /></div>
                  <div><label className="block text-xs font-medium mb-1" style={labelStyle}>Observaciones</label><textarea value={cuentaForm.observaciones} onChange={e => setCuentaForm({ ...cuentaForm, observaciones: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} /></div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveCuenta} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}><Save size={14} /> Guardar</button>
                    <button onClick={() => setShowCuentaForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                  </div>
                </div>
              </div>
            </div>
          )}
          </div>
          )}
        </div>
      )}

      {/* === Tab: Información médica === */}
      {detailTab === 'medico' && (
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: '#0F172A' }}><Stethoscope size={16} style={{ color: '#0369A1' }} /> Información médica</h3>
            {!medicoEditing && <button onClick={() => setMedicoEditing(true)} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Editar</button>}
          </div>
          {medicoEditing ? (
            <div className="space-y-3">
              {(['alergias', 'diagnosticos', 'movilidad', 'dependencia', 'notas'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1 capitalize" style={labelStyle}>{field}</label>
                  <textarea value={medico[field]} onChange={e => setMedico({ ...medico, [field]: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={saveMedico} disabled={medicoSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}><Save size={14} /> {medicoSaving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setMedicoEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { label: 'Alergias', value: medico.alergias, icon: Heart },
                { label: 'Diagnósticos', value: medico.diagnosticos, icon: Activity },
                { label: 'Movilidad', value: medico.movilidad, icon: Activity },
                { label: 'Dependencia', value: medico.dependencia, icon: Activity },
              ] as const).map(item => {
                const Icon = item.icon;
                return (
                  <div key={item.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center gap-2 mb-2"><Icon size={14} style={{ color: '#0369A1' }} /><p className="text-xs font-semibold uppercase" style={{ color: '#475569' }}>{item.label}</p></div>
                    <p className="text-sm" style={{ color: item.value ? '#1E293B' : '#94A3B8' }}>{item.value || 'Sin datos'}</p>
                  </div>
                );
              })}
              <div className="rounded-xl p-4 md:col-span-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: '#475569' }}>Notas</p>
                <p className="text-sm" style={{ color: medico.notas ? '#1E293B' : '#94A3B8' }}>{medico.notas || 'Sin notas'}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === Tab: Tratamiento === */}
      {detailTab === 'tratamiento' && (
        <div className="rounded-2xl p-6" style={cardStyle}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm flex items-center gap-2" style={{ color: '#0F172A' }}><Pill size={16} style={{ color: '#0369A1' }} /> Tratamiento y seguimiento</h3>
            {!tratamientoEditing && <button onClick={() => setTratamientoEditing(true)} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Editar</button>}
          </div>
          {tratamientoEditing ? (
            <div className="space-y-3">
              {(['tratamiento', 'medicacion', 'pautas', 'seguimiento'] as const).map(field => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1 capitalize" style={labelStyle}>{field}</label>
                  <textarea value={tratamiento[field]} onChange={e => setTratamiento({ ...tratamiento, [field]: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none" style={inputStyle} />
                </div>
              ))}
              <div className="flex gap-2 pt-2">
                <button onClick={saveTratamiento} disabled={tratamientoSaving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}><Save size={14} /> {tratamientoSaving ? 'Guardando...' : 'Guardar'}</button>
                <button onClick={() => setTratamientoEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {([
                { label: 'Tratamiento', value: tratamiento.tratamiento },
                { label: 'Medicación', value: tratamiento.medicacion },
                { label: 'Pautas', value: tratamiento.pautas },
                { label: 'Seguimiento', value: tratamiento.seguimiento },
              ] as const).map(item => (
                <div key={item.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-semibold uppercase mb-1" style={{ color: '#475569' }}>{item.label}</p>
                  <p className="text-sm" style={{ color: item.value ? '#1E293B' : '#94A3B8' }}>{item.value || 'Sin datos'}</p>
                </div>
              ))}
            </div>
          )}
          <div className="mt-5 pt-5 space-y-4" style={{ borderTop: '1px solid #E2E8F0' }}>
            <div>
              <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Información adicional</h4>
              <p className="text-xs mt-1" style={{ color: '#64748B' }}>Añade documentos relacionados con el tratamiento y seguimiento.</p>
            </div>
            <div
              onClick={() => !tratamientoUploading && tratamientoFileInputRef.current?.click()}
              onDrop={e => { e.preventDefault(); setTratamientoDragOver(false); if (e.dataTransfer.files.length) addTratamientoFiles(e.dataTransfer.files); }}
              onDragOver={e => { e.preventDefault(); setTratamientoDragOver(true); }}
              onDragLeave={e => { e.preventDefault(); setTratamientoDragOver(false); }}
              className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer select-none transition-all"
              style={{ border: `2px dashed ${tratamientoDragOver ? '#0369A1' : '#CBD5E1'}`, backgroundColor: tratamientoDragOver ? '#EFF6FF' : '#F8FAFC', padding: '24px 16px', minHeight: 120 }}
            >
              <Upload size={24} style={{ color: tratamientoDragOver ? '#0369A1' : '#94A3B8' }} />
              <p className="text-sm font-medium" style={{ color: '#475569' }}>Arrastra documentos aquí o haz clic para seleccionar</p>
              <p className="text-xs" style={{ color: '#94A3B8' }}>Solo archivos PDF</p>
              <input ref={tratamientoFileInputRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" disabled={tratamientoUploading} onChange={e => { if (e.target.files?.length) addTratamientoFiles(e.target.files); if (tratamientoFileInputRef.current) tratamientoFileInputRef.current.value = ''; }} />
            </div>
            {tratamientoFiles.length > 0 && (
              <div className="space-y-2">
                {tratamientoFiles.map(file => <div key={file.name} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}><FileText size={14} style={{ color: '#DC2626' }} /><span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{file.name}</span><span className="text-xs" style={{ color: '#94A3B8' }}>{(file.size / 1024).toFixed(0)} KB</span><button onClick={() => setTratamientoFiles(previous => previous.filter(item => item.name !== file.name))} className="text-xs cursor-pointer" style={{ color: '#DC2626' }}>Quitar</button></div>)}
                {tratamientoUploadError && <p className="flex items-center gap-1.5 text-xs" style={{ color: '#DC2626' }}><AlertCircle size={12} />{tratamientoUploadError}</p>}
                <button onClick={uploadTratamientoFiles} disabled={tratamientoUploading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>{tratamientoUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{tratamientoUploading ? 'Subiendo...' : 'Subir documentos'}</button>
              </div>
            )}
            <div className="space-y-2">
              {tratamientoDocumentos.length === 0 ? <p className="text-sm text-center py-3" style={{ color: '#94A3B8' }}>Sin documentos adicionales</p> : tratamientoDocumentos.map(documento => <div key={documento.id} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}><FileText size={14} style={{ color: '#DC2626' }} /><span className="flex-1 text-xs truncate" style={{ color: '#1E293B' }}>{documento.nombre_archivo}</span><span className="text-xs" style={{ color: '#94A3B8' }}>{(documento.tamano_bytes / 1024).toFixed(0)} KB</span><button onClick={() => previewTratamientoDocumento(documento)} className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>Ver</button><button onClick={() => downloadTratamientoDocumento(documento)} className="p-1 cursor-pointer" title="Descargar"><Download size={13} style={{ color: '#475569' }} /></button>{isAdmin && <button onClick={() => deleteTratamientoDocumento(documento)} className="p-1 cursor-pointer" title="Eliminar"><Trash2 size={13} style={{ color: '#DC2626' }} /></button>}</div>)}
            </div>
          </div>
        </div>
      )}

      {/* === Tab: Calendario === */}
      {detailTab === 'calendario' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{props.MONTH_NAMES[props.month]} {props.year}</h3>
              <div className="flex items-center gap-1">
                <button onClick={props.prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>←</button>
                <button onClick={props.goToday} className="px-2 py-1 rounded-lg text-xs font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Hoy</button>
                <button onClick={props.nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}>→</button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-2">
              {props.DAY_NAMES.map(d => <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#94A3B8' }}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {props.calendarCells.map((cell, i) => {
                if (!cell.date || !cell.iso) return <div key={i} className="aspect-square" />;
                const isToday = cell.iso === props.todayISO;
                const notaCount = props.notasByDate[cell.iso] ?? 0;
                const isFiltered = props.filterFecha === cell.iso;
                return (
                  <button key={i} onClick={() => props.openNotaModal(cell.iso!)}
                    onContextMenu={e => { e.preventDefault(); props.setFilterFecha(isFiltered ? '' : cell.iso!); }}
                    className="aspect-square rounded-lg flex flex-col items-center justify-center text-xs cursor-pointer transition-all relative"
                    style={{ backgroundColor: isFiltered ? '#0369A1' : isToday ? '#EFF6FF' : '#F8FAFC', color: isFiltered ? '#FFFFFF' : isToday ? '#0369A1' : '#475569', border: isToday ? '1px solid #BFDBFE' : '1px solid transparent' }}>
                    <span className="font-medium">{cell.date.getDate()}</span>
                    {notaCount > 0 && <span className="absolute bottom-1 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: isFiltered ? '#FFFFFF' : '#0369A1' }} />}
                  </button>
                );
              })}
            </div>
            <p className="text-xs mt-3" style={{ color: '#94A3B8' }}>Click para añadir nota · Clic derecho para filtrar</p>
          </div>
          <div className="rounded-2xl p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><FileText size={16} style={{ color: '#0369A1' }} /><h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Historial de Notas</h3></div>
              {props.filterFecha && <button onClick={() => props.setFilterFecha('')} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs cursor-pointer" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><X size={10} />Quitar filtro</button>}
            </div>
            {props.notasLoading ? (
              <div className="text-center py-8"><p className="text-xs" style={{ color: '#64748B' }}>Cargando...</p></div>
            ) : props.notasDisplay.length === 0 ? (
              <div className="text-center py-8"><FileText size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} /><p className="text-xs font-medium" style={{ color: '#475569' }}>Sin notas</p></div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {props.notasDisplay.map(n => (
                  <div key={n.id} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{n.fecha ? props.formatDateDisplay(n.fecha) : 'Sin fecha'}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{new Date(n.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        <button onClick={() => props.openEditNotaModal(n)} title="Editar nota" className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:opacity-70" style={{ color: '#0369A1' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
                        <button onClick={() => { if (confirm('¿Eliminar esta nota?')) props.onDeleteNota(n.id); }} title="Eliminar nota" className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer transition-all hover:opacity-70" style={{ color: '#DC2626' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
                      </div>
                    </div>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#0369A1' }}>Autor: {n.autor_nombre}</p>
                    <p className="text-sm" style={{ color: '#1E293B' }}>{n.contenido}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Tab: Documentos === */}
      {detailTab === 'documentos' && (
        <CrmDocumentosModule usuarioServicioId={usuario.id} usuarioNombre={selectedUserLabel} isAdmin={isAdmin} />
      )}

      {/* === Tab: Seguimiento diario === */}
      {detailTab === 'seguimiento' && (
        <CrmSeguimientoModule usuarioId={usuario.id} usuarioNombre={selectedUserLabel} autorNombre={props.autorNombre ?? ''} isAdmin={isAdmin} />
      )}

      {/* === Tab: Llamadas y visitas === */}
      {detailTab === 'llamadas' && (
        <CrmLlamadasModule usuarioId={usuario.id} autorNombre={props.autorNombre ?? ''} isAdmin={isAdmin} />
      )}

      {/* === Tab: Medicación === */}
      {detailTab === 'medicacion' && (
        <CrmMedicacionModule usuarioId={usuario.id} isAdmin={isAdmin} />
      )}

      {/* === Tab: ABVD === */}
      {detailTab === 'abvd' && (
        <CrmAbvdModule usuarioId={usuario.id} isAdmin={isAdmin} />
      )}

      {/* === Tab: Incidencias sanitarias === */}
      {detailTab === 'inc_sanitarias' && (
        <CrmIncidenciasSanitariasModule usuarioId={usuario.id} isAdmin={isAdmin} />
      )}

      {/* === Tab: Pautas profesionales === */}
      {detailTab === 'pautas' && (
        <CrmPautasModule usuarioId={usuario.id} autorNombre={props.autorNombre ?? ''} isAdmin={isAdmin} />
      )}

      {/* === Tab: PAI / PIE === */}
      {detailTab === 'pai' && (
        <CrmPaiModule usuarioId={usuario.id} autorNombre={props.autorNombre ?? ''} isAdmin={isAdmin} />
      )}

      {/* === Tab: Sesiones === */}
      {detailTab === 'sesiones' && (
        <CrmSesionesModule usuarioId={usuario.id} autorNombre={props.autorNombre ?? ''} isAdmin={isAdmin} />
      )}
    </div>
  );
}
