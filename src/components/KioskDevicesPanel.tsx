import { useState, useEffect } from 'react';
import {
  Tablet, Plus, Power, PowerOff, RefreshCw, Pencil, X, Check,
  Loader2, AlertCircle, Clock, MapPin, ShieldCheck, ShieldOff,
  Copy, CheckCircle2, Search,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface KioskDevice {
  id: string;
  device_key: string;
  site_name: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  last_seen_at: string | null;
}

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
  const days = Math.floor(h / 24);
  return `hace ${days}d`;
}

interface FormState {
  device_key: string;
  site_name: string;
  notes: string;
}

const EMPTY_FORM: FormState = { device_key: '', site_name: '', notes: '' };

function generateKey(siteName: string) {
  const slug = siteName.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `tablet_${slug}_${Math.random().toString(36).slice(2, 6)}`;
}

export default function KioskDevicesPanel() {
  const [devices, setDevices] = useState<KioskDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [toggling, setToggling] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  async function loadDevices() {
    setLoading(true);
    const { data } = await supabase
      .from('kiosk_devices')
      .select('*')
      .order('created_at', { ascending: false });
    setDevices((data as KioskDevice[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { loadDevices(); }, []);

  function openNew() {
    setForm(EMPTY_FORM);
    setEditId(null);
    setSaveError('');
    setShowForm(true);
  }

  function openEdit(d: KioskDevice) {
    setForm({ device_key: d.device_key, site_name: d.site_name, notes: d.notes ?? '' });
    setEditId(d.id);
    setSaveError('');
    setShowForm(true);
  }

  function autoFillKey() {
    if (form.site_name.trim()) {
      setForm(f => ({ ...f, device_key: generateKey(f.site_name) }));
    }
  }

  async function save() {
    if (!form.device_key.trim() || !form.site_name.trim()) {
      setSaveError('El código y el nombre del centro son obligatorios');
      return;
    }
    setSaving(true);
    setSaveError('');
    if (editId) {
      const { error } = await supabase.from('kiosk_devices')
        .update({ site_name: form.site_name.trim(), notes: form.notes.trim() || null })
        .eq('id', editId);
      if (error) { setSaveError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('kiosk_devices').insert({
        device_key: form.device_key.trim(),
        site_name: form.site_name.trim(),
        notes: form.notes.trim() || null,
      });
      if (error) { setSaveError(error.message); setSaving(false); return; }
    }
    setSaving(false);
    setShowForm(false);
    await loadDevices();
  }

  async function toggleActive(device: KioskDevice) {
    setToggling(device.id);
    await supabase.from('kiosk_devices')
      .update({ is_active: !device.is_active })
      .eq('id', device.id);
    await loadDevices();
    setToggling(null);
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
  }

  const filtered = devices.filter(d =>
    !search ||
    d.site_name.toLowerCase().includes(search.toLowerCase()) ||
    d.device_key.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = devices.filter(d => d.is_active).length;
  const recentThreshold = 15 * 60 * 1000; // 15 minutes
  const onlineCount = devices.filter(d => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < recentThreshold).length;

  return (
    <>
    <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>

      {/* Header */}
      <div className="px-6 py-5 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#0F172A' }}>
            <Tablet size={18} style={{ color: '#22D3EE' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Tablets de fichaje</h2>
            <p className="text-xs" style={{ color: '#64748B' }}>
              {activeCount} activa{activeCount !== 1 ? 's' : ''} · {onlineCount} en línea ahora
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadDevices} title="Actualizar"
            className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-200 transition-colors"
            style={{ color: '#64748B' }}>
            <RefreshCw size={15} />
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
            style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
            <Plus size={14} /> Registrar tablet
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3 border-b" style={{ borderColor: '#E2E8F0' }}>
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por sede o código..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
          />
        </div>
      </div>

      {/* Device list */}
      <div className="divide-y" style={{ divideColor: '#F1F5F9' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2" style={{ color: '#94A3B8' }}>
            <Loader2 size={18} className="animate-spin" /> Cargando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Tablet size={32} style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>
              {devices.length === 0 ? 'No hay tablets registradas todavía' : 'Sin resultados'}
            </p>
            {devices.length === 0 && (
              <button onClick={openNew}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer mt-1"
                style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
                <Plus size={13} /> Registrar primera tablet
              </button>
            )}
          </div>
        ) : (
          filtered.map(device => {
            const isOnline = device.last_seen_at ? Date.now() - new Date(device.last_seen_at).getTime() < recentThreshold : false;
            return (
              <div key={device.id} className="px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4"
                style={{ backgroundColor: device.is_active ? '#FFFFFF' : '#FAFAFA' }}>

                {/* Status dot */}
                <div className="flex-shrink-0 flex items-center">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center relative"
                    style={{ backgroundColor: device.is_active ? '#0F172A' : '#F1F5F9' }}>
                    <Tablet size={18} style={{ color: device.is_active ? '#22D3EE' : '#94A3B8' }} />
                    <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2"
                      style={{
                        backgroundColor: isOnline ? '#22C55E' : device.is_active ? '#F59E0B' : '#E2E8F0',
                        borderColor: '#FFFFFF',
                      }} />
                  </div>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <span className="font-semibold text-sm" style={{ color: device.is_active ? '#0F172A' : '#94A3B8' }}>
                      {device.site_name}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                      style={{
                        backgroundColor: device.is_active ? (isOnline ? '#DCFCE7' : '#FEF9C3') : '#F1F5F9',
                        color: device.is_active ? (isOnline ? '#16A34A' : '#CA8A04') : '#94A3B8',
                      }}>
                      {device.is_active ? (isOnline ? 'En línea' : 'Activa') : 'Inactiva'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs font-mono px-2 py-0.5 rounded"
                      style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                      {device.device_key}
                    </span>
                    <button onClick={() => copyKey(device.device_key)}
                      className="w-6 h-6 rounded flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors flex-shrink-0"
                      title="Copiar código">
                      {copiedKey === device.device_key
                        ? <CheckCircle2 size={12} style={{ color: '#16A34A' }} />
                        : <Copy size={12} style={{ color: '#94A3B8' }} />}
                    </button>
                  </div>
                  {device.notes && (
                    <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>{device.notes}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-1.5">
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
                      <Clock size={10} /> Registrada: {formatDate(device.created_at)}
                    </span>
                    {device.last_seen_at && (
                      <span className="flex items-center gap-1 text-xs" style={{ color: isOnline ? '#16A34A' : '#94A3B8' }}>
                        <MapPin size={10} /> Último fichaje: {relativeTime(device.last_seen_at)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => openEdit(device)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-slate-100"
                    title="Editar" style={{ color: '#475569' }}>
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => toggleActive(device)}
                    disabled={toggling === device.id}
                    title={device.is_active ? 'Desactivar tablet' : 'Activar tablet'}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-50 transition-all"
                    style={{
                      backgroundColor: device.is_active ? '#FEF2F2' : '#F0FDF4',
                      color: device.is_active ? '#DC2626' : '#16A34A',
                      border: `1px solid ${device.is_active ? '#FECACA' : '#BBF7D0'}`,
                    }}
                  >
                    {toggling === device.id
                      ? <Loader2 size={12} className="animate-spin" />
                      : device.is_active ? <PowerOff size={12} /> : <Power size={12} />
                    }
                    {device.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      {devices.length > 0 && (
        <div className="px-6 py-3 border-t flex flex-wrap gap-4 text-xs" style={{ borderColor: '#E2E8F0', color: '#94A3B8' }}>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#22C55E' }} /> En línea (fichaje en los últimos 15 min)
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#F59E0B' }} /> Activa (sin fichajes recientes)
          </span>
          <span className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: '#E2E8F0' }} /> Desactivada
          </span>
        </div>
      )}
    </div>

    {/* ── Form modal ── */}
    {showForm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF' }}>
          <div className="px-6 py-4 border-b flex items-center justify-between"
            style={{ borderColor: '#E2E8F0', backgroundColor: '#0F172A' }}>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(34,211,238,0.15)' }}>
                <Tablet size={17} style={{ color: '#22D3EE' }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: '#F1F5F9' }}>
                  {editId ? 'Editar tablet' : 'Registrar nueva tablet'}
                </h3>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                  {editId ? 'Actualiza la información del dispositivo' : 'Vincula una tablet al sistema de fichaje'}
                </p>
              </div>
            </div>
            <button onClick={() => setShowForm(false)}
              className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
              style={{ color: '#475569' }}>
              <X size={16} />
            </button>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Site name */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#475569' }}>
                Nombre del centro / sede *
              </label>
              <input
                type="text"
                value={form.site_name}
                onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))}
                onBlur={() => !editId && !form.device_key && autoFillKey()}
                placeholder="ej: Oficina Madrid, Almacén Sur..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                autoFocus
              />
            </div>

            {/* Device key */}
            {!editId && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#475569' }}>
                    Código único del dispositivo *
                  </label>
                  <button onClick={autoFillKey} className="text-xs cursor-pointer hover:underline" style={{ color: '#0369A1' }}>
                    Generar automático
                  </button>
                </div>
                <input
                  type="text"
                  value={form.device_key}
                  onChange={e => setForm(f => ({ ...f, device_key: e.target.value }))}
                  placeholder="ej: tablet_oficina_madrid_1"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
                  style={{ border: '1.5px solid #E2E8F0', color: '#0369A1', backgroundColor: '#F8FAFC' }}
                />
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                  Este código se guardará en el localStorage de la tablet. Solo letras, números y guiones bajos.
                </p>
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#475569' }}>
                Notas (opcional)
              </label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Modelo, ubicación física, planta..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
              />
            </div>

            {!editId && (
              <div className="flex items-start gap-2 px-3 py-3 rounded-xl text-xs"
                style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#0369A1' }}>
                <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  Una vez registrada, abre la web en la tablet y el sistema detectará automáticamente el dispositivo.
                  Si la tablet ya tiene un código guardado, introdúcelo manualmente.
                </span>
              </div>
            )}

            {saveError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
                <AlertCircle size={12} /> {saveError}
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button onClick={() => setShowForm(false)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                Cancelar
              </button>
              <button onClick={save} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0F172A', color: '#22D3EE' }}>
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Guardando...' : (editId ? 'Guardar cambios' : 'Registrar')}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
