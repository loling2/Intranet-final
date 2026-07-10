import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { Server, Bell, FileText, Plus, Pencil, Trash2, X, Loader2, AlertCircle, Check, ChevronDown, Eye, EyeOff } from 'lucide-react';

/* ─── Types ─── */
interface Cuenta {
  id: string;
  nombre: string;
  email: string;
  smtp_host: string;
  smtp_port: number;
  seguridad: string;
  activo: boolean;
}

interface Notificacion {
  id: string;
  evento: string;
  plantilla_id: string | null;
  activo: boolean;
  email_cuentas?: { nombre: string } | null;
  email_plantillas?: { nombre: string } | null;
}

interface Plantilla {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  cuenta_id: string | null;
  activo: boolean;
  email_cuentas?: { nombre: string } | null;
}

/* ─── Shared styles ─── */
const inp = 'w-full px-3 py-2.5 rounded-xl text-sm outline-none';
const inpS: React.CSSProperties = { border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };
const labelS = 'block text-xs font-semibold mb-1.5 uppercase tracking-wide';
const btnPrimary: React.CSSProperties = { backgroundColor: '#0F172A', color: '#FFFFFF' };
const btnDanger: React.CSSProperties = { backgroundColor: '#FEF2F2', color: '#B91C1C' };

/* ─── Cuentas SMTP ─── */
function CuentasSection() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Cuenta | 'new' | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', smtp_host: '', smtp_port: 587, seguridad: 'TLS', activo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('email_cuentas').select('*').order('nombre');
    if (data) setCuentas(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ nombre: '', email: '', password: '', smtp_host: '', smtp_port: 587, seguridad: 'TLS', activo: true });
    setError('');
    setModal('new');
  };

  const openEdit = (c: Cuenta) => {
    setForm({ nombre: c.nombre, email: c.email, password: '', smtp_host: c.smtp_host, smtp_port: c.smtp_port, seguridad: c.seguridad, activo: c.activo });
    setError('');
    setModal(c);
  };

  const handleSave = async () => {
    setError('');
    if (!form.nombre || !form.email || !form.smtp_host) { setError('Nombre, email y host SMTP son obligatorios'); return; }
    setSaving(true);
    if (modal === 'new') {
      const { error: e } = await supabase.from('email_cuentas').insert({ ...form });
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const updates: Record<string, unknown> = { nombre: form.nombre, email: form.email, smtp_host: form.smtp_host, smtp_port: form.smtp_port, seguridad: form.seguridad, activo: form.activo };
      if (form.password) updates.password = form.password;
      const { error: e } = await supabase.from('email_cuentas').update(updates).eq('id', (modal as Cuenta).id);
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('email_cuentas').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Cuentas SMTP</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={btnPrimary}>
          <Plus size={14} /> Nueva Cuenta
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
      ) : cuentas.length === 0 ? (
        <div className="text-center py-12 text-sm rounded-2xl" style={{ color: '#94A3B8', border: '1px dashed #E2E8F0' }}>No hay cuentas configuradas</div>
      ) : (
        <div className="space-y-3">
          {cuentas.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{c.nombre}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{c.email} · {c.smtp_host}:{c.smtp_port} · {c.seguridad}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: c.activo ? '#D1FAE5' : '#FEE2E2', color: c.activo ? '#065F46' : '#991B1B' }}>{c.activo ? 'Activa' : 'Inactiva'}</span>
                <button onClick={() => openEdit(c)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}><Pencil size={13} style={{ color: '#F59E0B' }} /></button>
                <button onClick={() => handleDelete(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}><Trash2 size={13} style={{ color: '#EF4444' }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{modal === 'new' ? 'Nueva Cuenta SMTP' : 'Editar Cuenta SMTP'}</h3>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}><AlertCircle size={14} />{error}</div>}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelS} style={{ color: '#475569' }}>Nombre</label>
                  <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className={inp} style={inpS} />
                </div>
                <div>
                  <label className={labelS} style={{ color: '#475569' }}>Email remitente</label>
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inp} style={inpS} />
                </div>
              </div>
              <div>
                <label className={labelS} style={{ color: '#475569' }}>{modal === 'new' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)'}</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} className={`${inp} pr-10`} style={inpS} />
                  <button type="button" onClick={() => setShowPass((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showPass ? <EyeOff size={14} style={{ color: '#94A3B8' }} /> : <Eye size={14} style={{ color: '#94A3B8' }} />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className={labelS} style={{ color: '#475569' }}>Host SMTP</label>
                  <input value={form.smtp_host} onChange={(e) => setForm((f) => ({ ...f, smtp_host: e.target.value }))} className={inp} style={inpS} placeholder="smtp.gmail.com" />
                </div>
                <div>
                  <label className={labelS} style={{ color: '#475569' }}>Puerto</label>
                  <input type="number" value={form.smtp_port} onChange={(e) => setForm((f) => ({ ...f, smtp_port: parseInt(e.target.value) || 587 }))} className={inp} style={inpS} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelS} style={{ color: '#475569' }}>Seguridad</label>
                  <div className="relative">
                    <select value={form.seguridad} onChange={(e) => setForm((f) => ({ ...f, seguridad: e.target.value }))} className={`${inp} appearance-none pr-8`} style={inpS}>
                      <option value="TLS">TLS</option>
                      <option value="SSL">SSL</option>
                      <option value="NONE">Sin seguridad</option>
                    </select>
                    <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                  </div>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded" />
                    <span className="text-sm font-medium" style={{ color: '#374151' }}>Cuenta activa</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={btnPrimary}>
                {saving && <Loader2 size={14} className="animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Notificaciones ─── */
function NotificacionesSection() {
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    supabase.from('email_notificaciones').select('*, email_cuentas(nombre), email_plantillas(nombre)').order('evento').then(({ data }) => {
      if (data) setNotifs(data);
      setLoading(false);
    });
  }, []);

  const toggle = async (id: string, activo: boolean) => {
    await supabase.from('email_notificaciones').update({ activo: !activo }).eq('id', id);
    setNotifs((prev) => prev.map((n) => n.id === id ? { ...n, activo: !activo } : n));
  };

  return (
    <div>
      <h2 className="font-bold text-base mb-4" style={{ color: '#0F172A' }}>Notificaciones automáticas</h2>
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-12 text-sm rounded-2xl" style={{ color: '#94A3B8', border: '1px dashed #E2E8F0' }}>No hay notificaciones configuradas</div>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => (
            <div key={n.id} className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div>
                <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{n.evento}</p>
                <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>
                  {n.email_plantillas?.nombre ?? 'Sin plantilla'} · {n.email_cuentas?.nombre ?? 'Sin cuenta'}
                </p>
              </div>
              <button onClick={() => toggle(n.id, n.activo)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: n.activo ? '#D1FAE5' : '#F1F5F9', color: n.activo ? '#065F46' : '#64748B' }}>
                {n.activo ? <Check size={12} /> : null}
                {n.activo ? 'Activa' : 'Inactiva'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Plantillas ─── */
function PlantillasSection() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cuentas, setCuentas] = useState<{ id: string; nombre: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Plantilla | 'new' | null>(null);
  const [form, setForm] = useState({ nombre: '', asunto: '', cuerpo: '', cuenta_id: '', activo: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('email_plantillas').select('*, email_cuentas(nombre)').order('nombre'),
      supabase.from('email_cuentas').select('id, nombre').eq('activo', true),
    ]);
    if (p) setPlantillas(p);
    if (c) setCuentas(c);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm({ nombre: '', asunto: '', cuerpo: '', cuenta_id: cuentas[0]?.id ?? '', activo: true });
    setError('');
    setModal('new');
  };

  const openEdit = (p: Plantilla) => {
    setForm({ nombre: p.nombre, asunto: p.asunto, cuerpo: p.cuerpo, cuenta_id: p.cuenta_id ?? '', activo: p.activo });
    setError('');
    setModal(p);
  };

  const handleSave = async () => {
    setError('');
    if (!form.nombre || !form.asunto || !form.cuerpo) { setError('Nombre, asunto y cuerpo son obligatorios'); return; }
    setSaving(true);
    const payload = { nombre: form.nombre, asunto: form.asunto, cuerpo: form.cuerpo, cuenta_id: form.cuenta_id || null, activo: form.activo };
    if (modal === 'new') {
      const { error: e } = await supabase.from('email_plantillas').insert(payload);
      if (e) { setError(e.message); setSaving(false); return; }
    } else {
      const { error: e } = await supabase.from('email_plantillas').update(payload).eq('id', (modal as Plantilla).id);
      if (e) { setError(e.message); setSaving(false); return; }
    }
    setSaving(false);
    setModal(null);
    load();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('email_plantillas').delete().eq('id', id);
    load();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Plantillas de correo</h2>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={btnPrimary}>
          <Plus size={14} /> Nueva Plantilla
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2" style={{ color: '#94A3B8' }}><Loader2 size={16} className="animate-spin" /> Cargando...</div>
      ) : plantillas.length === 0 ? (
        <div className="text-center py-12 text-sm rounded-2xl" style={{ color: '#94A3B8', border: '1px dashed #E2E8F0' }}>No hay plantillas configuradas</div>
      ) : (
        <div className="space-y-3">
          {plantillas.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-5 py-4 rounded-2xl" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
              <div className="min-w-0 mr-4">
                <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{p.nombre}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{p.asunto}</p>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{p.email_cuentas?.nombre ?? 'Sin cuenta'}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ backgroundColor: p.activo ? '#D1FAE5' : '#FEE2E2', color: p.activo ? '#065F46' : '#991B1B' }}>{p.activo ? 'Activa' : 'Inactiva'}</span>
                <button onClick={() => openEdit(p)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}><Pencil size={13} style={{ color: '#F59E0B' }} /></button>
                <button onClick={() => handleDelete(p.id)} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#FEF2F2' }}><Trash2 size={13} style={{ color: '#EF4444' }} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="w-full max-w-lg rounded-2xl shadow-2xl bg-white overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <h3 className="font-bold text-base" style={{ color: '#0F172A' }}>{modal === 'new' ? 'Nueva Plantilla' : 'Editar Plantilla'}</h3>
              <button onClick={() => setModal(null)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100"><X size={15} style={{ color: '#64748B' }} /></button>
            </div>
            <div className="px-6 py-5 space-y-4">
              {error && <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}><AlertCircle size={14} />{error}</div>}
              <div>
                <label className={labelS} style={{ color: '#475569' }}>Nombre de la plantilla</label>
                <input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} className={inp} style={inpS} placeholder="Ej: Bienvenida al portal" />
              </div>
              <div>
                <label className={labelS} style={{ color: '#475569' }}>Cuenta SMTP</label>
                <div className="relative">
                  <select value={form.cuenta_id} onChange={(e) => setForm((f) => ({ ...f, cuenta_id: e.target.value }))} className={`${inp} appearance-none pr-8`} style={inpS}>
                    <option value="">Sin cuenta asignada</option>
                    {cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
                </div>
              </div>
              <div>
                <label className={labelS} style={{ color: '#475569' }}>Asunto</label>
                <input value={form.asunto} onChange={(e) => setForm((f) => ({ ...f, asunto: e.target.value }))} className={inp} style={inpS} placeholder="Ej: Bienvenido, {{nombre}}" />
              </div>
              <div>
                <label className={labelS} style={{ color: '#475569' }}>Cuerpo del mensaje</label>
                <textarea
                  value={form.cuerpo}
                  onChange={(e) => setForm((f) => ({ ...f, cuerpo: e.target.value }))}
                  rows={6}
                  className={`${inp} resize-none`}
                  style={inpS}
                  placeholder="Variables disponibles: {{nombre}}, {{empresa}}, {{fecha}}, {{link}}"
                />
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Variables: {'{{nombre}}'}, {'{{empresa}}'}, {'{{fecha}}'}, {'{{link}}'}</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={(e) => setForm((f) => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 rounded" />
                <span className="text-sm font-medium" style={{ color: '#374151' }}>Plantilla activa</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setModal(null)} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-50" style={btnPrimary}>
                {saving && <Loader2 size={14} className="animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main ─── */
export default function EmailModule() {
  const [tab, setTab] = useState<'smtp' | 'notificaciones' | 'plantillas'>('smtp');

  const tabStyle = (id: string): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 18px',
    fontSize: 13,
    fontWeight: tab === id ? 600 : 500,
    borderBottom: `2px solid ${tab === id ? '#0EA5E9' : 'transparent'}`,
    color: tab === id ? '#0EA5E9' : '#64748B',
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${tab === id ? '#0EA5E9' : 'transparent'}`,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  });

  return (
    <div style={{ padding: '24px', fontFamily: 'Inter, sans-serif' }}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold" style={{ color: '#0F172A' }}>Email</h1>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Configura cuentas SMTP, notificaciones y plantillas de correo</p>
      </div>

      <div className="mb-6" style={{ borderBottom: '1px solid #E2E8F0' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <button onClick={() => setTab('smtp')} style={tabStyle('smtp')}>
            <Server size={14} />
            <span>Cuentas SMTP</span>
          </button>
          <button onClick={() => setTab('notificaciones')} style={tabStyle('notificaciones')}>
            <Bell size={14} />
            <span>Notificaciones</span>
          </button>
          <button onClick={() => setTab('plantillas')} style={tabStyle('plantillas')}>
            <FileText size={14} />
            <span>Plantillas</span>
          </button>
        </div>
      </div>

      {tab === 'smtp' && <CuentasSection />}
      {tab === 'notificaciones' && <NotificacionesSection />}
      {tab === 'plantillas' && <PlantillasSection />}
    </div>
  );
}
