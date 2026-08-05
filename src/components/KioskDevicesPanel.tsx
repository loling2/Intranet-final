import { useState, useEffect } from 'react';
import {
  Tablet, Smartphone, Plus, Power, PowerOff, RefreshCw, Pencil, X, Check,
  Loader2, AlertCircle, Clock, MapPin, ShieldCheck, Copy, CheckCircle2, Search,
  Users, Globe, MonitorSmartphone, Settings2, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// ── Types ──────────────────────────────────────────────────────────────────────

interface KioskDevice {
  id: string;
  device_key: string;
  site_name: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  last_seen_at: string | null;
}

interface CorporateDevice {
  id: string;
  empleado_id: string;
  device_key: string;
  device_label: string;
  is_active: boolean;
  created_at: string;
  last_seen_at: string | null;
  // joined
  empleado_nombre?: string;
}

interface Empleado {
  id: string;
  nombre: string;
  fichaje_mode: 'kiosk_only' | 'kiosk_or_corporate' | 'any';
}

type PanelTab = 'kiosk' | 'corporate' | 'permissions';

// ── Utils ──────────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function relativeTime(d: string | null) {
  if (!d) return null;
  const diff = Date.now() - new Date(d).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 2) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}
function generateKey(label: string) {
  const slug = label.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `${slug}_${Math.random().toString(36).slice(2, 6)}`;
}
const RECENT_MS = 15 * 60 * 1000;

const MODE_CONFIG = {
  kiosk_only: {
    label: 'Solo Kiosco',
    desc: 'Solo puede fichar desde tablets de kiosco autorizadas',
    bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', dot: '#3B82F6',
    icon: Tablet,
  },
  kiosk_or_corporate: {
    label: 'Kiosco o Móvil corporativo',
    desc: 'Puede fichar desde kiosco o desde su móvil corporativo registrado',
    bg: '#F0FDF4', text: '#166534', border: '#BBF7D0', dot: '#22C55E',
    icon: MonitorSmartphone,
  },
  any: {
    label: 'Cualquier dispositivo',
    desc: 'Sin restricción — puede fichar desde cualquier dispositivo',
    bg: '#F8FAFC', text: '#475569', border: '#E2E8F0', dot: '#94A3B8',
    icon: Globe,
  },
};

// ── Kiosk Tablets sub-panel ────────────────────────────────────────────────────

function KioskTab() {
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ device_key: '', site_name: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('kiosk_devices').select('*').order('created_at', { ascending: false });
    setDevices((data as KioskDevice[]) ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ device_key: '', site_name: '', notes: '' });
    setEditId(null); setSaveError(''); setShowForm(true);
  }
  function openEdit(d: KioskDevice) {
    setForm({ device_key: d.device_key, site_name: d.site_name, notes: d.notes ?? '' });
    setEditId(d.id); setSaveError(''); setShowForm(true);
  }
  async function save() {
    if (!form.device_key.trim() || !form.site_name.trim()) { setSaveError('Código y nombre son obligatorios'); return; }
    setSaving(true); setSaveError('');
    if (editId) {
      const { error } = await supabase.from('kiosk_devices').update({ site_name: form.site_name.trim(), notes: form.notes.trim() || null }).eq('id', editId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('kiosk_devices').insert({ device_key: form.device_key.trim(), site_name: form.site_name.trim(), notes: form.notes.trim() || null });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false); setShowForm(false); load();
  }
  async function toggleActive(d: KioskDevice) {
    setToggling(d.id);
    await supabase.from('kiosk_devices').update({ is_active: !d.is_active }).eq('id', d.id);
    await load(); setToggling(null);
  }
  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); });
  }

  const filtered = devices.filter(d =>
    !search || d.site_name.toLowerCase().includes(search.toLowerCase()) || d.device_key.toLowerCase().includes(search.toLowerCase())
  );
  const activeCount = devices.filter(d => d.is_active).length;
  const onlineCount = devices.filter(d => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < RECENT_MS).length;

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-sm font-medium" style={{ color: '#475569' }}>{activeCount} activa{activeCount !== 1 ? 's' : ''} · {onlineCount} en línea ahora</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-7 pr-3 py-1.5 rounded-lg text-sm outline-none" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: 180 }} />
          </div>
          <button onClick={load} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" title="Actualizar" style={{ color: '#64748B' }}><RefreshCw size={14} /></button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
            <Plus size={14} /> Registrar tablet
          </button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Tablet size={28} style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>{devices.length === 0 ? 'No hay tablets registradas' : 'Sin resultados'}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ divideColor: '#F1F5F9' }}>
            {filtered.map(device => {
              const isOnline = device.last_seen_at ? Date.now() - new Date(device.last_seen_at).getTime() < RECENT_MS : false;
              return (
                <div key={device.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3" style={{ backgroundColor: device.is_active ? '#FFFFFF' : '#FAFAFA' }}>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center relative" style={{ backgroundColor: device.is_active ? '#0F172A' : '#F1F5F9' }}>
                      <Tablet size={16} style={{ color: device.is_active ? '#22D3EE' : '#94A3B8' }} />
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2" style={{ backgroundColor: isOnline ? '#22C55E' : device.is_active ? '#F59E0B' : '#E2E8F0', borderColor: '#FFFFFF' }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm" style={{ color: device.is_active ? '#0F172A' : '#94A3B8' }}>{device.site_name}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: device.is_active ? (isOnline ? '#DCFCE7' : '#FEF9C3') : '#F1F5F9', color: device.is_active ? (isOnline ? '#16A34A' : '#CA8A04') : '#94A3B8' }}>
                        {device.is_active ? (isOnline ? 'En línea' : 'Activa') : 'Inactiva'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{device.device_key}</span>
                      <button onClick={() => copyKey(device.device_key)} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-slate-100" title="Copiar">
                        {copiedKey === device.device_key ? <CheckCircle2 size={11} style={{ color: '#16A34A' }} /> : <Copy size={11} style={{ color: '#94A3B8' }} />}
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: '#94A3B8' }}>
                      <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(device.created_at)}</span>
                      {device.last_seen_at && <span className="flex items-center gap-1" style={{ color: isOnline ? '#16A34A' : '#94A3B8' }}><MapPin size={10} /> {relativeTime(device.last_seen_at)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(device)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" title="Editar" style={{ color: '#475569' }}><Pencil size={13} /></button>
                    <button onClick={() => toggleActive(device)} disabled={toggling === device.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: device.is_active ? '#FEF2F2' : '#F0FDF4', color: device.is_active ? '#DC2626' : '#16A34A', border: `1px solid ${device.is_active ? '#FECACA' : '#BBF7D0'}` }}>
                      {toggling === device.id ? <Loader2 size={11} className="animate-spin" /> : device.is_active ? <PowerOff size={11} /> : <Power size={11} />}
                      {device.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-3 text-xs" style={{ color: '#94A3B8' }}>
        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#22C55E' }} /> En línea (últimos 15 min)</span>
        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#F59E0B' }} /> Activa sin actividad reciente</span>
        <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E2E8F0' }} /> Desactivada</span>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0', backgroundColor: '#0F172A' }}>
              <div className="flex items-center gap-2">
                <Tablet size={16} style={{ color: '#22D3EE' }} />
                <span className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{editId ? 'Editar tablet' : 'Registrar nueva tablet'}</span>
              </div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: '#475569' }}><X size={14} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#475569' }}>Nombre del centro / sede *</label>
                <input type="text" value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                  onBlur={() => !editId && !form.device_key && form.site_name && setForm(f => ({ ...f, device_key: generateKey(f.site_name) }))}
                  placeholder="ej: Oficina Madrid" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} autoFocus />
              </div>
              {!editId && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Código único *</label>
                    <button onClick={() => form.site_name && setForm(f => ({ ...f, device_key: generateKey(f.site_name) }))} className="text-xs cursor-pointer hover:underline" style={{ color: '#0369A1' }}>Generar</button>
                  </div>
                  <input type="text" value={form.device_key} onChange={e => setForm(f => ({ ...f, device_key: e.target.value }))} placeholder="ej: tablet_madrid_1" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono" style={{ border: '1.5px solid #E2E8F0', color: '#0369A1', backgroundColor: '#F8FAFC' }} />
                  <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Se guardará en localStorage de la tablet</p>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#475569' }}>Notas (opcional)</label>
                <input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Modelo, planta, ubicación..." className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              {!editId && (
                <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0369A1' }}>
                  <ShieldCheck size={12} className="flex-shrink-0 mt-0.5" />
                  Al abrir la web en la tablet, el sistema detectará el dispositivo automáticamente si el código coincide.
                </div>
              )}
              {saveError && <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><AlertCircle size={12} /> {saveError}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? 'Guardando...' : (editId ? 'Guardar' : 'Registrar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Corporate Devices sub-panel ────────────────────────────────────────────────

function CorporateTab() {
  const [devices, setDevices] = useState<CorporateDevice[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ empleado_id: '', device_key: '', device_label: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: devs }, { data: emps }] = await Promise.all([
      supabase.from('employee_registered_devices').select('*').order('created_at', { ascending: false }),
      supabase.rpc('get_employees_fichaje_modes'),
    ]);
    const empList = (emps ?? []) as Empleado[];
    const empMap = new Map(empList.map(e => [e.id, e.nombre]));
    setDevices(((devs ?? []) as CorporateDevice[]).map(d => ({ ...d, empleado_nombre: empMap.get(d.empleado_id) ?? d.empleado_id })));
    setEmpleados(empList);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function openNew() {
    setForm({ empleado_id: '', device_key: '', device_label: '' });
    setEditId(null); setSaveError(''); setShowForm(true);
  }
  function openEdit(d: CorporateDevice) {
    setForm({ empleado_id: d.empleado_id, device_key: d.device_key, device_label: d.device_label });
    setEditId(d.id); setSaveError(''); setShowForm(true);
  }
  async function save() {
    if (!form.empleado_id || !form.device_key.trim() || !form.device_label.trim()) { setSaveError('Todos los campos son obligatorios'); return; }
    setSaving(true); setSaveError('');
    if (editId) {
      const { error } = await supabase.from('employee_registered_devices').update({ device_label: form.device_label.trim() }).eq('id', editId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('employee_registered_devices').insert({ empleado_id: form.empleado_id, device_key: form.device_key.trim(), device_label: form.device_label.trim() });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false); setShowForm(false); load();
  }
  async function toggleActive(d: CorporateDevice) {
    setToggling(d.id);
    await supabase.from('employee_registered_devices').update({ is_active: !d.is_active }).eq('id', d.id);
    await load(); setToggling(null);
  }
  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => { setCopiedKey(key); setTimeout(() => setCopiedKey(null), 2000); });
  }

  const filtered = devices.filter(d =>
    !search ||
    (d.empleado_nombre ?? '').toLowerCase().includes(search.toLowerCase()) ||
    d.device_label.toLowerCase().includes(search.toLowerCase()) ||
    d.device_key.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <p className="text-sm font-medium" style={{ color: '#475569' }}>{devices.length} dispositivo{devices.length !== 1 ? 's' : ''} corporativo{devices.length !== 1 ? 's' : ''} registrado{devices.length !== 1 ? 's' : ''}</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="pl-7 pr-3 py-1.5 rounded-lg text-sm outline-none" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: 180 }} />
          </div>
          <button onClick={load} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#64748B' }}><RefreshCw size={14} /></button>
          <button onClick={openNew} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
            <Plus size={14} /> Registrar móvil
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Smartphone size={28} style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>{devices.length === 0 ? 'No hay dispositivos corporativos registrados' : 'Sin resultados'}</p>
            {devices.length === 0 && (
              <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer mt-1" style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
                <Plus size={13} /> Registrar primero
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y" style={{ divideColor: '#F1F5F9' }}>
            {filtered.map(device => {
              const isOnline = device.last_seen_at ? Date.now() - new Date(device.last_seen_at).getTime() < RECENT_MS : false;
              return (
                <div key={device.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3" style={{ backgroundColor: device.is_active ? '#FFFFFF' : '#FAFAFA' }}>
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center relative" style={{ backgroundColor: device.is_active ? '#0F172A' : '#F1F5F9' }}>
                      <Smartphone size={15} style={{ color: device.is_active ? '#22D3EE' : '#94A3B8' }} />
                      <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2" style={{ backgroundColor: isOnline ? '#22C55E' : device.is_active ? '#F59E0B' : '#E2E8F0', borderColor: '#FFFFFF' }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="font-semibold text-sm" style={{ color: device.is_active ? '#0F172A' : '#94A3B8' }}>{device.device_label}</span>
                      <span className="text-xs" style={{ color: '#64748B' }}>→ {device.empleado_nombre}</span>
                    </div>
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{device.device_key}</span>
                      <button onClick={() => copyKey(device.device_key)} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-slate-100">
                        {copiedKey === device.device_key ? <CheckCircle2 size={11} style={{ color: '#16A34A' }} /> : <Copy size={11} style={{ color: '#94A3B8' }} />}
                      </button>
                    </div>
                    {device.last_seen_at && (
                      <div className="flex items-center gap-1 text-xs" style={{ color: isOnline ? '#16A34A' : '#94A3B8' }}>
                        <MapPin size={10} /> Último fichaje: {relativeTime(device.last_seen_at)}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => openEdit(device)} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100" style={{ color: '#475569' }}><Pencil size={13} /></button>
                    <button onClick={() => toggleActive(device)} disabled={toggling === device.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50"
                      style={{ backgroundColor: device.is_active ? '#FEF2F2' : '#F0FDF4', color: device.is_active ? '#DC2626' : '#16A34A', border: `1px solid ${device.is_active ? '#FECACA' : '#BBF7D0'}` }}>
                      {toggling === device.id ? <Loader2 size={11} className="animate-spin" /> : device.is_active ? <PowerOff size={11} /> : <Power size={11} />}
                      {device.is_active ? 'Revocar' : 'Activar'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
            <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0', backgroundColor: '#0F172A' }}>
              <div className="flex items-center gap-2"><Smartphone size={15} style={{ color: '#22D3EE' }} /><span className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>{editId ? 'Editar dispositivo' : 'Registrar móvil corporativo'}</span></div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: '#475569' }}><X size={14} /></button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#475569' }}>Empleado *</label>
                <select value={form.empleado_id} onChange={e => setForm(f => ({ ...f, empleado_id: e.target.value }))}
                  disabled={!!editId}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}>
                  <option value="">Seleccionar empleado...</option>
                  {empleados.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#475569' }}>Etiqueta del dispositivo *</label>
                <input type="text" value={form.device_label} onChange={e => setForm(f => ({ ...f, device_label: e.target.value }))} placeholder="ej: iPhone 14 Pro corporativo" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none" style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
              </div>
              {!editId && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>Código único *</label>
                    <button onClick={() => form.device_label && setForm(f => ({ ...f, device_key: generateKey(f.device_label) }))} className="text-xs cursor-pointer hover:underline" style={{ color: '#0369A1' }}>Generar</button>
                  </div>
                  <input type="text" value={form.device_key} onChange={e => setForm(f => ({ ...f, device_key: e.target.value }))} placeholder="ej: iphone_juan_4f2a" className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono" style={{ border: '1.5px solid #E2E8F0', color: '#0369A1', backgroundColor: '#F8FAFC' }} />
                  <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>El empleado deberá introducir este código en su móvil corporativo</p>
                </div>
              )}
              {saveError && <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}><AlertCircle size={12} /> {saveError}</div>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>Cancelar</button>
                <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
                  {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  {saving ? 'Guardando...' : (editId ? 'Guardar' : 'Registrar')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Permissions sub-panel ──────────────────────────────────────────────────────

function PermissionsTab() {
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<string | null>(null);
  const [corpDevices, setCorpDevices] = useState<Record<string, CorporateDevice[]>>({});

  async function load() {
    setLoading(true);
    const [{ data: emps }, { data: devs }] = await Promise.all([
      supabase.rpc('get_employees_fichaje_modes'),
      supabase.from('employee_registered_devices').select('*').eq('is_active', true),
    ]);
    setEmpleados((emps ?? []) as Empleado[]);
    const grouped: Record<string, CorporateDevice[]> = {};
    for (const d of (devs ?? []) as CorporateDevice[]) {
      if (!grouped[d.empleado_id]) grouped[d.empleado_id] = [];
      grouped[d.empleado_id].push(d);
    }
    setCorpDevices(grouped);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function setMode(empId: string, mode: 'kiosk_only' | 'kiosk_or_corporate' | 'any') {
    setSaving(prev => ({ ...prev, [empId]: true }));
    await supabase.from('empleados').update({ fichaje_mode: mode }).eq('id', empId);
    setEmpleados(prev => prev.map(e => e.id === empId ? { ...e, fichaje_mode: mode } : e));
    setSaving(prev => ({ ...prev, [empId]: false }));
  }

  const filtered = empleados.filter(e =>
    !search || e.nombre.toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const counts = {
    kiosk_only: empleados.filter(e => e.fichaje_mode === 'kiosk_only').length,
    kiosk_or_corporate: empleados.filter(e => e.fichaje_mode === 'kiosk_or_corporate').length,
    any: empleados.filter(e => e.fichaje_mode === 'any').length,
  };

  return (
    <>
      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-5">
        {(Object.entries(counts) as [keyof typeof counts, number][]).map(([mode, count]) => {
          const cfg = MODE_CONFIG[mode];
          const Icon = cfg.icon;
          return (
            <div key={mode} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.text }}>
              <Icon size={14} />
              <span className="font-semibold">{count}</span>
              <span className="text-xs opacity-75">{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar empleado..." className="w-full pl-7 pr-3 py-2 rounded-lg text-sm outline-none" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }} />
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3"><Users size={28} style={{ color: '#CBD5E1' }} /><p className="text-sm" style={{ color: '#94A3B8' }}>Sin resultados</p></div>
        ) : (
          <div className="divide-y" style={{ divideColor: '#F1F5F9' }}>
            {paginated.map(emp => {
              const cfg = MODE_CONFIG[emp.fichaje_mode];
              const Icon = cfg.icon;
              const hasCorpDevices = (corpDevices[emp.id] ?? []).length > 0;
              const isExpanded = expanded === emp.id;
              return (
                <div key={emp.id} style={{ backgroundColor: '#FFFFFF' }}>
                  <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
                    {/* Employee */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                          {emp.nombre.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{emp.nombre}</p>
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: cfg.text }}>
                            <Icon size={10} />
                            <span>{cfg.label}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Mode selector */}
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {saving[emp.id] && <Loader2 size={12} className="animate-spin" style={{ color: '#94A3B8' }} />}
                      {(['kiosk_only', 'kiosk_or_corporate', 'any'] as const).map(mode => {
                        const mcfg = MODE_CONFIG[mode];
                        const MIcon = mcfg.icon;
                        const isSelected = emp.fichaje_mode === mode;
                        return (
                          <button key={mode} onClick={() => setMode(emp.id, mode)} disabled={saving[emp.id]}
                            title={mcfg.desc}
                            className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-50 transition-all"
                            style={{
                              backgroundColor: isSelected ? mcfg.bg : '#F8FAFC',
                              border: `1.5px solid ${isSelected ? mcfg.border : '#E2E8F0'}`,
                              color: isSelected ? mcfg.text : '#CBD5E1',
                            }}>
                            <MIcon size={15} />
                          </button>
                        );
                      })}

                      {/* Expand to show corporate devices */}
                      {(emp.fichaje_mode === 'kiosk_or_corporate') && (
                        <button onClick={() => setExpanded(isExpanded ? null : emp.id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-100"
                          title="Ver dispositivos corporativos"
                          style={{ color: hasCorpDevices ? '#16A34A' : '#94A3B8' }}>
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded: corporate devices for this employee */}
                  {isExpanded && (
                    <div className="px-4 pb-3">
                      <div className="ml-10 pl-3 border-l-2" style={{ borderColor: '#BBF7D0' }}>
                        {(corpDevices[emp.id] ?? []).length === 0 ? (
                          <p className="text-xs py-2" style={{ color: '#94A3B8' }}>Sin dispositivos corporativos registrados para este empleado.</p>
                        ) : (
                          <div className="space-y-1 py-1">
                            {(corpDevices[emp.id] ?? []).map(d => (
                              <div key={d.id} className="flex items-center gap-2 text-xs" style={{ color: '#475569' }}>
                                <Smartphone size={11} style={{ color: '#16A34A' }} />
                                <span className="font-medium">{d.device_label}</span>
                                <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>{d.device_key}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 px-1">
          <p className="text-xs" style={{ color: '#94A3B8' }}>
            {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} de {filtered.length} empleados
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors hover:bg-slate-100"
              style={{ border: '1px solid #E2E8F0', color: '#64748B', backgroundColor: '#F8FAFC' }}
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="w-8 h-8 flex items-center justify-center text-xs" style={{ color: '#94A3B8' }}>…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors"
                    style={{
                      backgroundColor: safePage === p ? '#0F172A' : '#F8FAFC',
                      color: safePage === p ? '#FFFFFF' : '#475569',
                      border: `1px solid ${safePage === p ? '#0F172A' : '#E2E8F0'}`,
                    }}
                  >
                    {p}
                  </button>
                )
              )
            }
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer disabled:opacity-40 transition-colors hover:bg-slate-100"
              style={{ border: '1px solid #E2E8F0', color: '#64748B', backgroundColor: '#F8FAFC' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 rounded-xl p-4 space-y-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#475569' }}>Leyenda de permisos</p>
        {(Object.entries(MODE_CONFIG) as [string, typeof MODE_CONFIG['any']][]).map(([mode, cfg]) => {
          const Icon = cfg.icon;
          return (
            <div key={mode} className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <Icon size={13} style={{ color: cfg.text }} />
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: cfg.text }}>{cfg.label}</p>
                <p className="text-xs" style={{ color: '#94A3B8' }}>{cfg.desc}</p>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Main panel ─────────────────────────────────────────────────────────────────

export default function KioskDevicesPanel() {
  const [activeTab, setActiveTab] = useState<PanelTab>('kiosk');

  const tabs: { id: PanelTab; label: string; icon: React.ElementType; desc: string }[] = [
    { id: 'kiosk',       label: 'Tablets de kiosco',      icon: Tablet,          desc: 'Terminales fijos autorizados' },
    { id: 'corporate',   label: 'Móviles corporativos',   icon: Smartphone,      desc: 'Dispositivos personales asignados' },
    { id: 'permissions', label: 'Permisos por empleado',  icon: Settings2,       desc: 'Control de acceso individual' },
  ];

  return (
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      {/* Header */}
      <div className="px-6 py-5 border-b" style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#0F172A' }}>
            <MonitorSmartphone size={18} style={{ color: '#22D3EE' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Control de dispositivos de fichaje</h2>
            <p className="text-xs" style={{ color: '#64748B' }}>Gestiona qué dispositivos pueden fichar y desde dónde</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b" style={{ borderColor: '#E2E8F0' }}>
        {tabs.map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className="flex items-center gap-2 px-5 py-3.5 text-sm font-medium cursor-pointer transition-all border-b-2 -mb-px"
              style={{
                borderBottomColor: isActive ? '#0369A1' : 'transparent',
                color: isActive ? '#0369A1' : '#64748B',
                backgroundColor: isActive ? '#F0F9FF' : 'transparent',
              }}>
              <Icon size={14} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'kiosk' && <KioskTab />}
        {activeTab === 'corporate' && <CorporateTab />}
        {activeTab === 'permissions' && <PermissionsTab />}
      </div>
    </div>
  );
}
