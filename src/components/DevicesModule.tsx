import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Laptop, Smartphone, Monitor, Headphones, Tablet, Phone,
  Plus, Search, Pencil, Trash2, X, RefreshCw, AlertCircle,
  CheckCircle2, ChevronDown, Settings, MapPin,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { Dispositivo, Empleado, Centro } from '../supabaseClient';
import { societies } from '../themes';

const TIPOS = ['Portatil', 'Sobremesa', 'Monitor', 'Movil', 'Tablet', 'Periferico', 'VoIP', 'Otro'];

function typeIcon(tipo: string) {
  switch (tipo) {
    case 'Portatil': return Laptop;
    case 'Sobremesa': return Settings;
    case 'Monitor': return Monitor;
    case 'Movil': return Smartphone;
    case 'Tablet': return Tablet;
    case 'VoIP': return Phone;
    default: return Headphones;
  }
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Form Modal ────────────────────────────────────────────────────────────────

interface FormState {
  tipo: string;
  marca_modelo: string;
  caracteristicas: string;
  centro_trabajo: string;
  numero_serie: string;
  estado_id: 1 | 2 | 3;
  society_id: string;
  empleado_id: string;
  usuario_asignado_nombre: string;
  fecha_asignacion: string;
  notas: string;
}

const EMPTY_FORM: FormState = {
  tipo: 'Portatil',
  marca_modelo: '',
  caracteristicas: '',
  centro_trabajo: '',
  numero_serie: '',
  estado_id: 1,
  society_id: '',
  empleado_id: '',
  usuario_asignado_nombre: '',
  fecha_asignacion: '',
  notas: '',
};

// ── Searchable Employee Picker ────────────────────────────────────────────────

function EmployeePicker({
  empleados,
  value,
  onChange,
}: {
  empleados: Empleado[];
  value: string;
  onChange: (empId: string, nombre: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = empleados.find((e) => e.id === value);
  const filtered = empleados
    .filter((e) => !search || e.nombre.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 10);

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      if (ref.current && !ref.current.contains(ev.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm cursor-pointer"
        style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
      >
        <span style={{ color: selected ? '#1E293B' : '#94A3B8' }}>
          {selected ? selected.nombre : 'Sin asignar'}
        </span>
        <ChevronDown size={13} style={{ color: '#94A3B8' }} />
      </button>
      {open && (
        <div
          className="absolute z-50 w-full mt-1 rounded-xl overflow-hidden shadow-xl"
          style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E2E8F0' }}
        >
          <div className="p-2" style={{ borderBottom: '1px solid #F1F5F9' }}>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre..."
                className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs outline-none"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange('', ''); setOpen(false); setSearch(''); }}
              className="w-full text-left px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors"
              style={{ color: '#94A3B8' }}
            >
              Sin asignar
            </button>
            {filtered.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => { onChange(e.id, e.nombre); setOpen(false); setSearch(''); }}
                className="w-full text-left px-3 py-2 text-xs cursor-pointer hover:bg-slate-50 transition-colors"
                style={{
                  backgroundColor: value === e.id ? '#F0F9FF' : undefined,
                  color: value === e.id ? '#0369A1' : '#1E293B',
                  fontWeight: value === e.id ? 600 : 400,
                }}
              >
                {e.nombre}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs" style={{ color: '#94A3B8' }}>Sin resultados</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Device Modal ──────────────────────────────────────────────────────────────

function DeviceModal({
  existing,
  empleados,
  centros,
  onClose,
  onSaved,
}: {
  existing?: Dispositivo | null;
  empleados: Empleado[];
  centros: Centro[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(
    existing
      ? {
          tipo: existing.tipo,
          marca_modelo: existing.marca_modelo,
          caracteristicas: existing.caracteristicas || '',
          centro_trabajo: existing.centro_trabajo || '',
          numero_serie: existing.numero_serie || '',
          estado_id: (existing.estado_id as 1 | 2 | 3) || 1,
          society_id: existing.society_id,
          empleado_id: existing.empleado_id ?? '',
          usuario_asignado_nombre: existing.usuario_asignado_nombre || '',
          fecha_asignacion: existing.fecha_asignacion ?? '',
          notas: existing.notas || '',
        }
      : { ...EMPTY_FORM, society_id: societies[0]?.id ?? '' }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof FormState, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const filteredEmpleados = empleados.filter(
    (e) => !form.society_id || e.id_sociedad === form.society_id
  );

  const filteredCentros = centros.filter(
    (c) => !c.id_sociedad || c.id_sociedad === form.society_id
  );

  const handleEmpleadoChange = (empId: string, nombre: string) => {
    set('empleado_id', empId);
    set('usuario_asignado_nombre', nombre);
    if (empId && form.estado_id === 3) {
  set('estado_id', 1);
}
  };

  const handleSave = async () => {
    if (!form.marca_modelo.trim()) { setError('La marca/modelo es obligatoria.'); return; }
    if (!form.society_id) { setError('Selecciona una sociedad.'); return; }
    setSaving(true); setError('');

    const payload = {
      tipo: form.tipo,
      marca_modelo: form.marca_modelo.trim(),
      caracteristicas: form.caracteristicas.trim(),
      centro_trabajo: form.centro_trabajo.trim(),
      numero_serie: form.numero_serie.trim(),
     estado_id: form.estado_id,
      society_id: form.society_id,
      empleado_id: form.estado_id === 3 ? null : (form.empleado_id || null),
      usuario_asignado_nombre: form.estado_id === 3 ? '' : form.usuario_asignado_nombre.trim(),
      fecha_asignacion: form.estado_id === 3 ? null : (form.fecha_asignacion || null),
      notas: form.notas.trim(),
    };

    try {
      if (existing) {
        const { error: err } = await supabase.from('dispositivos').update(payload).eq('id', existing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from('dispositivos').insert(payload);
        if (err) throw err;
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
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
              <Laptop size={15} className="text-white" />
            </div>
            <h2 className="text-white font-semibold text-sm">{existing ? 'Editar dispositivo' : 'Nuevo dispositivo'}</h2>
          </div>
          <button type="button" onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Row: Tipo + Activo */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Tipo *</label>
              <div className="relative">
                <select
                  value={form.tipo}
                  onChange={(e) => set('tipo', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                >
                  {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Estado</label>
              <div className="flex gap-2 pt-1">
                {[
  { id: 1, label: 'Activo' },
  { id: 2, label: 'Inactivo' },
  { id: 3, label: 'Stock' },
].map((estado) => {

  const isSelected = form.estado_id === estado.id;

                let bgColor = '#F8FAFC';
  let textColor = '#94A3B8';
  let borderColor = '#E2E8F0';

  if (isSelected) {
    if (estado.id === 1) {
      bgColor = '#ECFDF5';
      textColor = '#065F46';
      borderColor = '#6EE7B7';
    } else if (estado.id === 2) {
      bgColor = '#FEF2F2';
      textColor = '#DC2626';
      borderColor = '#FECACA';
    } else {
      bgColor = '#FEF9C3';
      textColor = '#854D0E';
      borderColor = '#FDE047';
    }
  }

            return (
    <button
      key={estado.id}
      type="button"
      onClick={() => {
        set('estado_id', estado.id);

        if (estado.id === 3) {
          set('empleado_id', '');
          set('usuario_asignado_nombre', '');
          set('fecha_asignacion', '');
        }
                      }}
                      className="flex-1 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all capitalize"
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                        border: `1.5px solid ${borderColor}`,
                      }}
                    >
                     {estado.label}
    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Marca/Modelo */}
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Marca / Modelo *</label>
            <input
              type="text"
              value={form.marca_modelo}
              onChange={(e) => { set('marca_modelo', e.target.value); setError(''); }}
              placeholder="Ej: Lenovo ThinkPad E15 Gen 4"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: `1.5px solid ${error && !form.marca_modelo ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          {/* Caracteristicas */}
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Caracteristicas tecnicas</label>
            <textarea
              value={form.caracteristicas}
              onChange={(e) => set('caracteristicas', e.target.value)}
              placeholder="Ej: Intel i5-12ª gen · 16 GB RAM · 512 GB SSD NVMe"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          {/* Row: Numero serie + Centro */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Numero de serie</label>
              <input
                type="text"
                value={form.numero_serie}
                onChange={(e) => set('numero_serie', e.target.value)}
                placeholder="Ej: LNV-2024-A1B2C3"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Centro de trabajo</label>
              <div className="relative">
                <select
                  value={form.centro_trabajo}
                  onChange={(e) => set('centro_trabajo', e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                  style={{ border: '1.5px solid #E2E8F0', color: form.centro_trabajo ? '#1E293B' : '#94A3B8', backgroundColor: '#F8FAFC' }}
                >
                  <option value="">Sin centro</option>
                  {filteredCentros.map((c) => (
                    <option key={c.id} value={c.nombre}>{c.nombre}</option>
                  ))}
                </select>
                <MapPin size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
              </div>
            </div>
          </div>

          {/* Sociedad */}
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Sociedad *</label>
            <div className="relative">
              <select
                value={form.society_id}
                onChange={(e) => { set('society_id', e.target.value); set('empleado_id', ''); set('usuario_asignado_nombre', ''); setError(''); }}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none appearance-none cursor-pointer"
                style={{ border: `1.5px solid ${error && !form.society_id ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
              >
                <option value="">Selecciona sociedad...</option>
                {societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            </div>
          </div>

          {/* Usuario asignado */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Usuario asignado</label>
              <EmployeePicker
                empleados={filteredEmpleados}
                value={form.empleado_id}
                onChange={handleEmpleadoChange}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Fecha asignacion</label>
              <input
                type="date"
                value={form.fecha_asignacion}
                onChange={(e) => set('fecha_asignacion', e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#64748B' }}>Notas / Observaciones</label>
            <textarea
              value={form.notas}
              onChange={(e) => set('notas', e.target.value)}
              placeholder="Incidencias, garantia, observaciones..."
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertCircle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0F172A' }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Laptop size={14} />}
              {existing ? 'Guardar cambios' : 'Crear dispositivo'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete Modal ──────────────────────────────────────────────────────

function ConfirmDelete({ name, onConfirm, onClose, loading }: {
  name: string; onConfirm: () => void; onClose: () => void; loading: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}>
            <Trash2 size={18} style={{ color: '#DC2626' }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Eliminar dispositivo</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>"{name}" sera eliminado permanentemente.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
          <button type="button" onClick={onConfirm} disabled={loading}
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

// ── Main DevicesModule ────────────────────────────────────────────────────────

export default function DevicesModule() {
  const [devices, setDevices] = useState<Dispositivo[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSociety, setFilterSociety] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterEstado, setFilterEstado] = useState<'all' | '1' | '2' | '3'>('all');

  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Dispositivo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Dispositivo | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const flash = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const loadDevices = useCallback(async () => {
    setLoading(true);
    const { data, error: err } = await supabase
      .from('dispositivos')
      .select('*')
      .order('created_at', { ascending: false });
    if (err) setError(err.message);
    else setDevices((data ?? []) as Dispositivo[]);
    setLoading(false);
  }, []);

  const loadEmpleados = useCallback(async () => {
    const { data } = await supabase
      .from('empleados')
      .select('id, nombre, id_sociedad')
      .eq('activo', true)
      .order('nombre');
    setEmpleados((data ?? []) as Empleado[]);
  }, []);

  const loadCentros = useCallback(async () => {
    const { data } = await supabase.from('centros').select('*').order('nombre');
    setCentros((data ?? []) as Centro[]);
  }, []);

  useEffect(() => { loadDevices(); loadEmpleados(); loadCentros(); }, [loadDevices, loadEmpleados, loadCentros]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error: err } = await supabase.from('dispositivos').delete().eq('id', deleteTarget.id);
    if (err) setError(err.message);
    else {
      flash(`Dispositivo "${deleteTarget.marca_modelo}" eliminado`);
      await loadDevices();
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const filtered = devices.filter((d) => {
    if (filterSociety && d.society_id !== filterSociety) return false;
    if (filterTipo && d.tipo !== filterTipo) return false;
    
    // Filtro basado en la cadena de texto exacta de la BD
   if (
  filterEstado !== 'all' &&
  d.estado_id !== Number(filterEstado)
)
  return false;

    if (search) {
      const q = search.toLowerCase();
      return (
        d.marca_modelo.toLowerCase().includes(q) ||
        d.tipo.toLowerCase().includes(q) ||
        (d.numero_serie && d.numero_serie.toLowerCase().includes(q)) ||
        (d.usuario_asignado_nombre && d.usuario_asignado_nombre.toLowerCase().includes(q)) ||
        (d.centro_trabajo && d.centro_trabajo.toLowerCase().includes(q))
      );
    }
    return true;
  });

const totalActivos =
  devices.filter((d) => d.estado_id === 1).length;

  return (
    <div className="space-y-4">
      {showCreate && (
        <DeviceModal empleados={empleados} centros={centros} onClose={() => setShowCreate(false)} onSaved={() => { loadDevices(); flash('Dispositivo creado correctamente'); }} />
      )}
      {editing && (
        <DeviceModal existing={editing} empleados={empleados} centros={centros} onClose={() => setEditing(null)} onSaved={() => { loadDevices(); flash('Dispositivo actualizado'); }} />
      )}
      {deleteTarget && (
        <ConfirmDelete name={deleteTarget.marca_modelo} onConfirm={handleDelete} onClose={() => setDeleteTarget(null)} loading={deleting} />
      )}

      {/* Header */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <h3 className="font-semibold" style={{ color: '#0F172A' }}>Gestion de Dispositivos</h3>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
              {devices.length} dispositivo{devices.length !== 1 ? 's' : ''} &middot; {totalActivos} activo{totalActivos !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all hover:opacity-90"
            style={{ backgroundColor: '#0F172A', boxShadow: '0 4px 12px rgba(15,23,42,0.3)' }}
          >
            <Plus size={15} /> Nuevo dispositivo
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 flex flex-wrap items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
          <div className="relative flex-1 min-w-[180px]">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por modelo, serie, usuario..."
              className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
            />
            {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}><X size={11} /></button>}
          </div>
          <select value={filterSociety} onChange={(e) => setFilterSociety(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
            <option value="">Todas las sociedades</option>
            {societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
            className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={filterActivo} onChange={(e) => setFilterActivo(e.target.value as any)}
            className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
            <option value="all">Todos los estados</option>
            <option value="activo">Activos</option>
            <option value="inactivo">Inactivos</option>
            <option value="stock">En Stock</option>
          </select>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mx-6 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
            <AlertCircle size={15} /><span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError('')} className="cursor-pointer"><X size={13} /></button>
          </div>
        )}
        {success && (
          <div className="mx-6 mt-3 flex items-center gap-3 px-4 py-3 rounded-xl text-sm" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7', color: '#065F46' }}>
            <CheckCircle2 size={15} /><span>{success}</span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
              <Laptop size={28} style={{ color: '#CBD5E1' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>
              {search || filterSociety || filterTipo || filterActivo !== 'all' ? 'Sin resultados' : 'Sin dispositivos registrados'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              {!search && !filterSociety && !filterTipo && filterActivo === 'all' && 'Pulsa "Nuevo dispositivo" para empezar'}
            </p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {/* Column headers */}
            <div className="px-6 py-2.5 grid grid-cols-12 gap-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8', backgroundColor: '#F8FAFC' }}>
              <div className="col-span-1">Tipo</div>
              <div className="col-span-3">Modelo</div>
              <div className="col-span-2">Serie</div>
              <div className="col-span-2">Asignado a</div>
              <div className="col-span-2">Centro / Sociedad</div>
              <div className="col-span-1">Estado</div>
              <div className="col-span-1 text-right">Acciones</div>
            </div>

            {filtered.map((dev) => {
              const Icon = typeIcon(dev.tipo);
              const society = societies.find((s) => s.id === dev.society_id);
              
              let labelEstado = 'Inactivo';
              let colorBg = '#FEF2F2';
              let colorTxt = '#DC2626';
              let colorDot = '#EF4444';
              let colorBorder = '#FECACA';

              if (dev.estado_id === 1){
                labelEstado = 'Activo';
                colorBg = '#ECFDF5';
                colorTxt = '#065F46';
                colorDot = '#22C55E';
                colorBorder = '#6EE7B7';
              } else if (dev.estado_id === 3) {
                labelEstado = 'Stock';
                colorBg = '#FEF9C3';
                colorTxt = '#854D0E';
                colorDot = '#EAB308';
                colorBorder = '#FDE047';
              }

              return (
                <div key={dev.id} className="px-6 py-3.5 grid grid-cols-12 gap-3 items-center hover:bg-slate-50 transition-colors duration-100">
                  {/* Tipo icon */}
                  <div className="col-span-1">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: dev.estado_id === 2 ? '#FEF2F2' : '#F0FDF4', border: `1px solid ${dev.estado_id === 2 ? '#FECACA' : '#BBF7D0'}` }}>
                      <Icon size={14} style={{ color: dev.estado_id === 2 ? '#DC2626' : '#16A34A' }} />
                    </div>
                  </div>

                  {/* Modelo */}
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E293B' }}>{dev.marca_modelo}</p>
                    {dev.caracteristicas && (
                      <p className="text-xs truncate mt-0.5" style={{ color: '#94A3B8' }}>{dev.caracteristicas}</p>
                    )}
                    <span className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{dev.tipo}</span>
                  </div>

                  {/* Serie */}
                  <div className="col-span-2 min-w-0">
                    <p className="text-xs font-mono truncate" style={{ color: dev.numero_serie ? '#1E293B' : '#CBD5E1' }}>
                      {dev.numero_serie || '—'}
                    </p>
                  </div>

                  {/* Asignado */}
                  <div className="col-span-2 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: dev.usuario_asignado_nombre ? '#1E293B' : '#CBD5E1' }}>
                      {dev.usuario_asignado_nombre || 'Sin asignar'}
                    </p>
                    {dev.fecha_asignacion && (
                      <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{formatDate(dev.fecha_asignacion)}</p>
                    )}
                  </div>

                  {/* Centro */}
                  <div className="col-span-2 min-w-0">
                    <p className="text-sm truncate" style={{ color: '#1E293B' }}>{dev.centro_trabajo || '—'}</p>
                    {society && (
                      <span className="inline-block text-xs px-1.5 py-0.5 rounded mt-0.5" style={{ backgroundColor: society.primaryLight, color: society.primary, border: `1px solid ${society.border}` }}>
                        {society.name}
                      </span>
                    )}
                  </div>

                  {/* Estado */}
                  <div className="col-span-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg"
                      style={{ backgroundColor: colorBg, border: `1px solid ${colorBorder}` }}>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colorDot }} />
                      <span className="text-xs font-semibold" style={{ color: colorTxt }}>
                        {labelEstado}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="col-span-1 flex items-center justify-end gap-1">
                    <button type="button" onClick={() => setEditing(dev)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors" style={{ color: '#CBD5E1' }}>
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(dev)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors" style={{ color: '#CBD5E1' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}