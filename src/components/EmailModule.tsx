import { useState, useEffect, useCallback } from 'react';
import {
  Server, Bell, FileText, Plus, X, Loader2, Pencil, Trash2,
  AlertCircle, Check, Eye, EyeOff,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Cuenta {
  id: string;
  nombre: string;
  email: string;
  password: string;
  smtp_host: string;
  smtp_port: number;
  seguridad: string;
  activo: boolean;
  created_at: string;
}

interface Notificacion {
  id: string;
  nombre: string;
  descripcion: string;
  evento: string;
  cuenta_id: string;
  destinatarios: string[];
  activo: boolean;
}

interface Plantilla {
  id: string;
  nombre: string;
  asunto: string;
  cuerpo: string;
  cuenta_id: string | null;
  activo: boolean;
}

const EVENTOS = [
  { value: 'nueva_nomina',        label: 'Nueva nómina disponible' },
  { value: 'nuevo_documento',     label: 'Nuevo documento PRL' },
  { value: 'vacacion_aprobada',   label: 'Vacación aprobada' },
  { value: 'vacacion_rechazada',  label: 'Vacación rechazada' },
  { value: 'incidencia_creada',   label: 'Incidencia creada' },
  { value: 'incidencia_resuelta', label: 'Incidencia resuelta' },
  { value: 'bienvenida',          label: 'Bienvenida empleado' },
];

const inp  = 'w-full px-3 py-2 rounded-lg text-sm outline-none';
const inpS = { border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' };
const lbl  = 'block text-xs font-medium mb-1';
const lblS = { color: '#64748B' };

// ─── SMTP Section ───────────────────────────────────────────────────────────────

function CuentasSection() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Cuenta | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('email_cuentas').select('*').order('created_at');
    setCuentas((data ?? []) as Cuenta[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#64748B' }}>
          Configura las cuentas de correo que enviarán las notificaciones del sistema.
        </p>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ backgroundColor: '#0EA5E9', color: '#fff' }}>
          <Plus size={14} /> Nueva Cuenta
        </button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: '#0EA5E9' }} /></div>
        ) : cuentas.length === 0 ? (
          <div className="text-center py-12">
            <Server size={30} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
            <p className="text-sm" style={{ color: '#94A3B8' }}>Sin cuentas SMTP configuradas</p>
            <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Añade la primera con el botón de arriba</p>
          </div>
        ) : (
          <div className="bg-white divide-y" style={{ borderColor: '#F1F5F9' }}>
            {cuentas.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: c.activo ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${c.activo ? '#86EFAC' : '#E2E8F0'}` }}>
                  <Server size={14} style={{ color: c.activo ? '#16A34A' : '#94A3B8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{c.nombre}</p>
                  <p className="text-xs truncate" style={{ color: '#64748B' }}>{c.email} · {c.smtp_host}:{c.smtp_port}</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full"
                  style={{ backgroundColor: c.activo ? '#F0FDF4' : '#F8FAFC', color: c.activo ? '#16A34A' : '#94A3B8' }}>
                  {c.activo ? 'Activa' : 'Inactiva'}
                </span>
                <div className="flex gap-1">
                  <button onClick={() => { setEditing(c); setShowModal(true); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100">
                    <Pencil size={12} style={{ color: '#64748B' }} />
                  </button>
                  <button onClick={async () => { await supabase.from('email_cuentas').delete().eq('id', c.id); load(); }}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50">
                    <Trash2 size={12} style={{ color: '#EF4444' }} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showModal && <CuentaModal initial={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSaved={load} />}
    </div>
  );
}

function CuentaModal({ initial, onClose, onSaved }: { initial: Cuenta | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '', email: initial?.email ?? '', password: initial?.password ?? '',
    smtp_host: initial?.smtp_host ?? '', smtp_port: initial?.smtp_port ?? 587,
    seguridad: initial?.seguridad ?? 'TLS', activo: initial?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre || !form.email || !form.smtp_host) { setError('Nombre, email y host son obligatorios'); return; }
    setSaving(true);
    const { error: e } = initial
      ? await supabase.from('email_cuentas').update({ ...form, updated_at: new Date().toISOString() }).eq('id', initial.id)
      : await supabase.from('email_cuentas').insert(form);
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2"><Server size={15} style={{ color: '#0EA5E9' }} /><h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{initial ? 'Editar cuenta SMTP' : 'Nueva cuenta SMTP'}</h2></div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"><X size={14} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}><AlertCircle size={12} /> {error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><label className={lbl} style={lblS}>Nombre *</label><input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className={inp} style={inpS} /></div>
            <div className="col-span-2"><label className={lbl} style={lblS}>Email emisor *</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className={inp} style={inpS} /></div>
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Contraseña</label>
              <div className="relative"><input type={showPwd ? 'text' : 'password'} value={form.password} onChange={(e) => set('password', e.target.value)} className={`${inp} pr-9`} style={inpS} />
                <button type="button" onClick={() => setShowPwd((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2">{showPwd ? <EyeOff size={13} style={{ color: '#94A3B8' }} /> : <Eye size={13} style={{ color: '#94A3B8' }} />}</button>
              </div>
            </div>
            <div><label className={lbl} style={lblS}>Host SMTP *</label><input value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value)} placeholder="smtp.gmail.com" className={inp} style={inpS} /></div>
            <div><label className={lbl} style={lblS}>Puerto</label><input type="number" value={form.smtp_port} onChange={(e) => set('smtp_port', parseInt(e.target.value))} className={inp} style={inpS} /></div>
            <div><label className={lbl} style={lblS}>Seguridad</label><select value={form.seguridad} onChange={(e) => set('seguridad', e.target.value)} className={inp} style={inpS}><option value="TLS">TLS</option><option value="SSL">SSL</option><option value="NONE">Sin seguridad</option></select></div>
            <div className="flex items-center gap-2 pt-4"><input type="checkbox" id="cactivo" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /><label htmlFor="cactivo" className="text-sm" style={{ color: '#475569' }}>Activa</label></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ backgroundColor: '#0EA5E9', color: '#fff' }}>
            {saving && <Loader2 size={13} className="animate-spin" />}{initial ? 'Guardar' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notificaciones Section ─────────────────────────────────────────────────────

function NotificacionesSection() {
  const [items, setItems] = useState<Notificacion[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Notificacion | null>(null);
  const eventoLabel = (v: string) => EVENTOS.find((e) => e.value === v)?.label ?? v;

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: n }, { data: c }] = await Promise.all([
      supabase.from('email_notificaciones').select('*').order('created_at'),
      supabase.from('email_cuentas').select('id, nombre').eq('activo', true),
    ]);
    setItems((n ?? []) as Notificacion[]);
    setCuentas((c ?? []) as Cuenta[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#64748B' }}>Configura qué eventos del sistema disparan notificaciones por email.</p>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#0EA5E9', color: '#fff' }}><Plus size={14} /> Nueva Notificación</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: '#0EA5E9' }} /></div>
          : items.length === 0 ? (
            <div className="text-center py-12"><Bell size={30} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} /><p className="text-sm" style={{ color: '#94A3B8' }}>Sin reglas de notificación</p></div>
          ) : (
            <div className="bg-white divide-y" style={{ borderColor: '#F1F5F9' }}>
              {items.map((n) => (
                <div key={n.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: n.activo ? '#FFF7ED' : '#F8FAFC' }}><Bell size={14} style={{ color: n.activo ? '#EA580C' : '#94A3B8' }} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{n.nombre}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{eventoLabel(n.evento)}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: n.activo ? '#F0FDF4' : '#F8FAFC', color: n.activo ? '#16A34A' : '#94A3B8' }}>{n.activo ? 'Activa' : 'Inactiva'}</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(n); setShowModal(true); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100"><Pencil size={12} style={{ color: '#64748B' }} /></button>
                    <button onClick={async () => { await supabase.from('email_notificaciones').delete().eq('id', n.id); load(); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"><Trash2 size={12} style={{ color: '#EF4444' }} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      {showModal && <NotificacionModal initial={editing} cuentas={cuentas} onClose={() => { setShowModal(false); setEditing(null); }} onSaved={load} />}
    </div>
  );
}

function NotificacionModal({ initial, cuentas, onClose, onSaved }: { initial: Notificacion | null; cuentas: Cuenta[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '', descripcion: initial?.descripcion ?? '', evento: initial?.evento ?? EVENTOS[0].value,
    cuenta_id: initial?.cuenta_id ?? cuentas[0]?.id ?? '', destinatarios: (initial?.destinatarios ?? []).join(', '), activo: initial?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre || !form.cuenta_id) { setError('Nombre y cuenta son obligatorios'); return; }
    setSaving(true);
    const destinatarios = form.destinatarios.split(',').map((s) => s.trim()).filter(Boolean);
    const { error: e } = initial
      ? await supabase.from('email_notificaciones').update({ nombre: form.nombre, descripcion: form.descripcion, evento: form.evento, cuenta_id: form.cuenta_id, destinatarios, activo: form.activo, updated_at: new Date().toISOString() }).eq('id', initial.id)
      : await supabase.from('email_notificaciones').insert({ nombre: form.nombre, descripcion: form.descripcion, evento: form.evento, cuenta_id: form.cuenta_id, destinatarios, activo: form.activo });
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-md rounded-2xl shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2"><Bell size={15} style={{ color: '#EA580C' }} /><h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{initial ? 'Editar' : 'Nueva notificación'}</h2></div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"><X size={14} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}><AlertCircle size={12} /> {error}</div>}
          <div><label className={lbl} style={lblS}>Nombre *</label><input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} className={inp} style={inpS} /></div>
          <div><label className={lbl} style={lblS}>Evento</label><select value={form.evento} onChange={(e) => set('evento', e.target.value)} className={inp} style={inpS}>{EVENTOS.map((ev) => <option key={ev.value} value={ev.value}>{ev.label}</option>)}</select></div>
          <div><label className={lbl} style={lblS}>Cuenta emisora *</label><select value={form.cuenta_id} onChange={(e) => set('cuenta_id', e.target.value)} className={inp} style={inpS}><option value="">Selecciona...</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          <div><label className={lbl} style={lblS}>Destinatarios (coma)</label><input value={form.destinatarios} onChange={(e) => set('destinatarios', e.target.value)} placeholder="admin@empresa.com, rrhh@empresa.com" className={inp} style={inpS} /></div>
          <div><label className={lbl} style={lblS}>Descripción</label><textarea value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)} rows={2} className={`${inp} resize-none`} style={inpS} /></div>
          <div className="flex items-center gap-2"><input type="checkbox" id="nactivo" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /><label htmlFor="nactivo" className="text-sm" style={{ color: '#475569' }}>Activa</label></div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ backgroundColor: '#0EA5E9', color: '#fff' }}>{saving && <Loader2 size={13} className="animate-spin" />}{initial ? 'Guardar' : 'Crear'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Plantillas Section ─────────────────────────────────────────────────────────

function PlantillasSection() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Plantilla | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from('email_plantillas').select('*').order('created_at'),
      supabase.from('email_cuentas').select('id, nombre').eq('activo', true),
    ]);
    setPlantillas((p ?? []) as Plantilla[]);
    setCuentas((c ?? []) as Cuenta[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm" style={{ color: '#64748B' }}>Gestiona las plantillas de correo que se envían a los empleados.</p>
        <button onClick={() => { setEditing(null); setShowModal(true); }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold" style={{ backgroundColor: '#0EA5E9', color: '#fff' }}><Plus size={14} /> Nueva Plantilla</button>
      </div>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
        {loading ? <div className="flex justify-center py-10"><Loader2 size={20} className="animate-spin" style={{ color: '#0EA5E9' }} /></div>
          : plantillas.length === 0 ? (
            <div className="text-center py-12"><FileText size={30} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} /><p className="text-sm" style={{ color: '#94A3B8' }}>Sin plantillas configuradas</p><p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Añade la primera con el botón de arriba</p></div>
          ) : (
            <div className="bg-white divide-y" style={{ borderColor: '#F1F5F9' }}>
              {plantillas.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: p.activo ? '#F0F9FF' : '#F8FAFC' }}><FileText size={14} style={{ color: p.activo ? '#0EA5E9' : '#94A3B8' }} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{p.nombre}</p>
                    <p className="text-xs truncate" style={{ color: '#64748B' }}>Asunto: {p.asunto}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: p.activo ? '#F0FDF4' : '#F8FAFC', color: p.activo ? '#16A34A' : '#94A3B8' }}>{p.activo ? 'Activa' : 'Inactiva'}</span>
                  <div className="flex gap-1">
                    <button onClick={() => { setEditing(p); setShowModal(true); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-slate-100"><Pencil size={12} style={{ color: '#64748B' }} /></button>
                    <button onClick={async () => { await supabase.from('email_plantillas').delete().eq('id', p.id); load(); }} className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-50"><Trash2 size={12} style={{ color: '#EF4444' }} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
      </div>
      {showModal && <PlantillaModal initial={editing} cuentas={cuentas} onClose={() => { setShowModal(false); setEditing(null); }} onSaved={load} />}
    </div>
  );
}

function PlantillaModal({ initial, cuentas, onClose, onSaved }: { initial: Plantilla | null; cuentas: Cuenta[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    nombre: initial?.nombre ?? '', asunto: initial?.asunto ?? '', cuerpo: initial?.cuerpo ?? '',
    cuenta_id: initial?.cuenta_id ?? cuentas[0]?.id ?? null as string | null, activo: initial?.activo ?? true,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.nombre || !form.asunto || !form.cuerpo) { setError('Nombre, asunto y cuerpo son obligatorios'); return; }
    setSaving(true);
    const payload = { ...form, cuenta_id: form.cuenta_id || null, updated_at: new Date().toISOString() };
    const { error: e } = initial
      ? await supabase.from('email_plantillas').update(payload).eq('id', initial.id)
      : await supabase.from('email_plantillas').insert(payload);
    setSaving(false);
    if (e) { setError(e.message); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl bg-white overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2"><FileText size={15} style={{ color: '#0EA5E9' }} /><h2 className="font-semibold text-sm" style={{ color: '#0F172A' }}>{initial ? 'Editar plantilla' : 'Nueva plantilla de correo'}</h2></div>
          <button onClick={onClose} className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"><X size={14} style={{ color: '#64748B' }} /></button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}><AlertCircle size={12} /> {error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className={lbl} style={lblS}>Nombre de la plantilla *</label><input value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Bienvenida empleado" className={inp} style={inpS} /></div>
            <div><label className={lbl} style={lblS}>Cuenta emisora (opcional)</label><select value={form.cuenta_id ?? ''} onChange={(e) => set('cuenta_id', e.target.value || null)} className={inp} style={inpS}><option value="">Sin cuenta específica</option>{cuentas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
            <div className="col-span-2"><label className={lbl} style={lblS}>Asunto del correo *</label><input value={form.asunto} onChange={(e) => set('asunto', e.target.value)} placeholder="Bienvenido/a a {{empresa}}" className={inp} style={inpS} /></div>
            <div className="col-span-2">
              <label className={lbl} style={lblS}>Cuerpo del correo *</label>
              <p className="text-xs mb-1" style={{ color: '#94A3B8' }}>Variables: {'{{nombre}}'} {'{{empresa}}'} {'{{fecha}}'} {'{{link}}'}</p>
              <textarea value={form.cuerpo} onChange={(e) => set('cuerpo', e.target.value)} rows={10} placeholder={'Hola {{nombre}},\n\nTe damos la bienvenida a {{empresa}}...'} className={`${inp} resize-none font-mono text-xs`} style={inpS} />
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="pactivo" checked={form.activo} onChange={(e) => set('activo', e.target.checked)} /><label htmlFor="pactivo" className="text-sm" style={{ color: '#475569' }}>Activa</label></div>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3.5" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60" style={{ backgroundColor: '#0EA5E9', color: '#fff' }}>{saving && <Loader2 size={13} className="animate-spin" />}{initial ? 'Guardar cambios' : 'Crear plantilla'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────────

type TabId = 'smtp' | 'notificaciones' | 'plantillas';

export default function EmailModule() {
  const [tab, setTab] = useState<TabId>('smtp');

  const tabStyle = (t: TabId) => ({
    backgroundColor: tab === t ? '#FFFFFF' : 'transparent',
    color:           tab === t ? '#0F172A'  : '#64748B',
    boxShadow:       tab === t ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>Notificaciones por Email</h2>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>Configura cuentas SMTP emisoras y los eventos del sistema que disparan correos automáticos.</p>
      </div>

      {/* Tab bar — explicit rendering, no array mapping to avoid type issues */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F1F5F9' }}>
        <button onClick={() => setTab('smtp')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tabStyle('smtp')}>
          <Server size={14} />
          <span>Cuentas SMTP</span>
        </button>
        <button onClick={() => setTab('notificaciones')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tabStyle('notificaciones')}>
          <Bell size={14} />
          <span>Notificaciones</span>
        </button>
        <button onClick={() => setTab('plantillas')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={tabStyle('plantillas')}>
          <FileText size={14} />
          <span>Plantillas</span>
        </button>
      </div>

      {tab === 'smtp'           && <CuentasSection />}
      {tab === 'notificaciones' && <NotificacionesSection />}
      {tab === 'plantillas'     && <PlantillasSection />}
    </div>
  );
}
