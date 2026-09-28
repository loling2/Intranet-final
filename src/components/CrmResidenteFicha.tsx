import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  User, Mail, Phone, Building2, Calendar, FolderOpen, FileText,
  Heart, Pill, Users, CreditCard, Plus, X, Trash2, Save, MapPin,
  Contact, Stethoscope, Activity, ClipboardList, Phone as PhoneIcon, Ambulance, FileSignature,
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
  notasDisplay: { id: string; fecha: string; autor_nombre: string; contenido: string; created_at: string }[];
  MONTH_NAMES: string[];
  DAY_NAMES: string[];
  formatDateDisplay: (iso: string) => string;
  onEdit: () => void;
  autorNombre?: string;
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
  const [detailTab, setDetailTab] = useState<DetailTab>('info');

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

  const [medico, setMedico] = useState<Medico>({ alergias: '', diagnosticos: '', movilidad: '', dependencia: '', notas: '' });
  const [medicoEditing, setMedicoEditing] = useState(false);
  const [medicoSaving, setMedicoSaving] = useState(false);

  const [tratamiento, setTratamiento] = useState<Tratamiento>({ tratamiento: '', medicacion: '', pautas: '', seguimiento: '' });
  const [tratamientoEditing, setTratamientoEditing] = useState(false);
  const [tratamientoSaving, setTratamientoSaving] = useState(false);

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

  const loadMedico = useCallback(async () => {
    const { data } = await supabase.from('crm_residente_medico').select('*').eq('usuario_servicio_id', usuario.id).maybeSingle();
    setMedico((data ?? { alergias: '', diagnosticos: '', movilidad: '', dependencia: '', notas: '' }) as Medico);
  }, [usuario.id]);

  const loadTratamiento = useCallback(async () => {
    const { data } = await supabase.from('crm_residente_tratamiento').select('*').eq('usuario_servicio_id', usuario.id).maybeSingle();
    setTratamiento((data ?? { tratamiento: '', medicacion: '', pautas: '', seguimiento: '' }) as Tratamiento);
  }, [usuario.id]);

  useEffect(() => { loadExtra(); loadContactos(); loadCuentas(); loadMedico(); loadTratamiento(); }, [loadExtra, loadContactos, loadCuentas, loadMedico, loadTratamiento]);

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

  const tabs: { id: DetailTab; label: string; icon: typeof User }[] = [
    { id: 'info', label: 'Información', icon: User },
    { id: 'contactos', label: 'Contactos', icon: Users },
    { id: 'cuentas', label: 'Cuentas', icon: CreditCard },
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

      {/* === Tab: Cuentas === */}
      {detailTab === 'cuentas' && (
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
                      <span className="text-xs font-bold px-2 py-1 rounded-md" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{props.formatDateDisplay(n.fecha)}</span>
                      <span className="text-xs" style={{ color: '#94A3B8' }}>{new Date(n.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
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
