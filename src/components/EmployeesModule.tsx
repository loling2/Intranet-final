import { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, X, Save, ChevronDown, ChevronUp,
  Pencil, Trash2, AlertCircle, CheckCircle2, Building2, Tag, RefreshCw
} from 'lucide-react';
import { supabase, type Empleado, type Sociedad, type Centro, type Asignacion, type Tag as TagType } from '../supabaseClient';

interface Props {
  currentUserRole: 'admin' | 'rrhh';
}

const TIPOS_CONTRATO = ['Indefinido', 'Temporal', 'Practicas', 'Obra y Servicio', 'Formacion', 'Relevo', 'Interinidad'];
const TURNOS = ['Manana', 'Tarde', 'Noche', 'Partido', 'Flexible'];

const EMPTY_FORM: Omit<Empleado, 'id' | 'created_at' | 'updated_at'> = {
  user_id: null,
  id_sociedad: '',
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
  observaciones: null,
  activo: true,
};

function formFromEmpleado(e: Empleado): typeof EMPTY_FORM {
  return {
    user_id: e.user_id,
    id_sociedad: e.id_sociedad,
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
    observaciones: e.observaciones,
    activo: e.activo,
  };
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

  const [showForm, setShowForm] = useState(false);
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

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
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
        const { error: err } = await supabase.from('empleados').update(payload).eq('id', editingId);
        if (err) throw err;
        showSuccess('Empleado actualizado correctamente');
      } else {
        const { error: err } = await supabase.from('empleados').insert(payload);
        if (err) throw err;
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
              onClick={openNew}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
            >
              <Plus size={14} />
              Nuevo empleado
            </button>
          </div>
        </div>

        {/* Employee form (inline) */}
        {showForm && (
          <div className="px-6 py-5" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm" style={{ color: '#0F172A' }}>
                {editingId ? 'Editar empleado' : 'Nuevo empleado'}
              </h4>
              <button onClick={cancelForm} className="cursor-pointer" style={{ color: '#94A3B8' }}><X size={16} /></button>
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

            {/* Section: Observaciones + estado */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <FormField label="Observaciones generales" className="sm:col-span-2">
                <textarea value={form.observaciones ?? ''} onChange={(e) => f('observaciones', e.target.value)}
                  rows={2} className="form-input resize-none" placeholder="Notas adicionales..." />
              </FormField>
              <FormField label="Estado">
                <select value={form.activo ? 'activo' : 'inactivo'} onChange={(e) => f('activo', e.target.value === 'activo')} className="form-input">
                  <option value="activo">Activo</option>
                  <option value="inactivo">Inactivo</option>
                </select>
              </FormField>
            </div>

            <div className="flex items-center gap-2 justify-end">
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
            {filtered.map((emp) => {
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
