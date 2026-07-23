import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import {
  Mail, Plus, X, Loader2, Pencil, Trash2, Eye, EyeOff,
  Server, Shield, Bell, Check, AlertCircle, ToggleLeft, ToggleRight,
  FileText, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type Seguridad = 'SSL' | 'TLS' | 'STARTTLS' | 'NONE';

interface EmailCuenta {
  id: string;
  nombre: string;
  email: string;
  password: string;
  smtp_host: string;
  smtp_port: number;
  seguridad: Seguridad;
  activo: boolean;
  created_at: string;
}

interface EmailNotificacion {
  id: string;
  nombre: string;
  descripcion: string;
  evento: string;
  cuenta_id: string | null;
  destinatarios: string[];
  activo: boolean;
  created_at: string;
}

export interface EmailPlantilla {
  id: string;
  nombre: string;
  descripcion: string;
  asunto: string;
  cuerpo: string;
  activo: boolean;
  tipo: string | null;
  created_at: string;
}

const TIPO_OPTIONS: { value: string; label: string; color: string; bg: string; border: string }[] = [
  { value: 'password_reset', label: 'Recuperacion de contrasena', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'usuario_nuevo',  label: 'Nuevo usuario',              color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'notificacion',   label: 'Notificacion general',       color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'generico',       label: 'Generica',                    color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
];

function getTipoBadge(tipo: string | null): { label: string; color: string; bg: string; border: string } | null {
  if (!tipo) return null;
  return TIPO_OPTIONS.find((t) => t.value === tipo) ?? { label: tipo, color: '#475569', bg: '#F1F5F9', border: '#E2E8F0' };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGURIDAD_OPTIONS: { value: Seguridad; label: string; port: number }[] = [
  { value: 'STARTTLS', label: 'STARTTLS (recomendado)', port: 587 },
  { value: 'SSL',      label: 'SSL',                   port: 465 },
  { value: 'TLS',      label: 'TLS',                   port: 587 },
  { value: 'NONE',     label: 'Sin cifrado',            port: 25  },
];

const EVENTOS_PREDEFINIDOS = [
  { value: 'incidencia_nueva',         label: 'Nueva incidencia creada' },
  { value: 'incidencia_estado_cambio', label: 'Cambio de estado en incidencia' },
  { value: 'incidencia_finalizada',    label: 'Incidencia finalizada' },
  { value: 'vacacion_solicitud',       label: 'Nueva solicitud de vacaciones' },
  { value: 'vacacion_aprobada',        label: 'Vacaciones aprobadas' },
  { value: 'vacacion_rechazada',       label: 'Vacaciones rechazadas' },
  { value: 'contrato_pendiente',       label: 'Contrato pendiente de firma' },
  { value: 'usuario_nuevo',            label: 'Nuevo usuario creado' },
  { value: 'certificado_expira',       label: 'Certificado próximo a vencer' },
  { value: 'dispositivo_asignado',     label: 'Dispositivo asignado a empleado' },
  { value: 'personalizado',            label: 'Evento personalizado' },
];

export const PLANTILLA_VARIABLES = [
  { var: '{{nombre}}',     desc: 'Nombre completo del usuario' },
  { var: '{{email}}',      desc: 'Correo electronico del usuario' },
  { var: '{{password}}',   desc: 'Contraseña temporal asignada' },
  { var: '{{url_acceso}}', desc: 'URL de acceso al portal' },
  { var: '{{empresa}}',    desc: 'Nombre de la empresa/sociedad' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SEGURIDAD_COLORS: Record<Seguridad, { color: string; bg: string }> = {
  SSL:      { color: '#059669', bg: '#ECFDF5' },
  TLS:      { color: '#2563EB', bg: '#EFF6FF' },
  STARTTLS: { color: '#D97706', bg: '#FEF3C7' },
  NONE:     { color: '#64748B', bg: '#F1F5F9' },
};

function SeguridadBadge({ s }: { s: Seguridad }) {
  const c = SEGURIDAD_COLORS[s];
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold" style={{ color: c.color, backgroundColor: c.bg }}>
      {s}
    </span>
  );
}

// ─── Tag Input for recipients ─────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const addTag = () => {
    const val = input.trim().toLowerCase();
    if (!val) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { setError('Email no válido'); return; }
    if (tags.includes(val)) { setError('Ya añadido'); return; }
    onChange([...tags, val]);
    setInput('');
    setError('');
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
    if (e.key === 'Backspace' && !input && tags.length) onChange(tags.slice(0, -1));
  };

  return (
    <div>
      <div
        className="w-full min-h-[44px] px-2 py-1.5 rounded-xl flex flex-wrap gap-1.5 cursor-text"
        style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC' }}
        onClick={() => document.getElementById('tag-input-field')?.focus()}
      >
        {tags.map((t) => (
          <span key={t} className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))}>
              <X size={10} />
            </button>
          </span>
        ))}
        <input
          id="tag-input-field"
          value={input}
          onChange={(e) => { setInput(e.target.value); setError(''); }}
          onKeyDown={handleKey}
          onBlur={addTag}
          placeholder={tags.length === 0 ? 'correo@ejemplo.com — Enter para añadir' : ''}
          className="flex-1 min-w-[160px] text-sm outline-none bg-transparent py-0.5"
          style={{ color: '#1E293B' }}
        />
      </div>
      {error && <p className="text-xs mt-1" style={{ color: '#EF4444' }}>{error}</p>}
    </div>
  );
}

// ─── SMTP Account Modal ───────────────────────────────────────────────────────

const BLANK_CUENTA = (): Omit<EmailCuenta, 'id' | 'created_at'> => ({
  nombre: '', email: '', password: '', smtp_host: '',
  smtp_port: 587, seguridad: 'STARTTLS', activo: true,
});

interface CuentaModalProps {
  initial?: EmailCuenta | null;
  onClose: () => void;
  onSaved: () => void;
}

function CuentaModal({ initial, onClose, onSaved }: CuentaModalProps) {
  const [form, setForm] = useState<Omit<EmailCuenta, 'id' | 'created_at'>>(
    initial ? { nombre: initial.nombre, email: initial.email, password: initial.password,
      smtp_host: initial.smtp_host, smtp_port: initial.smtp_port, seguridad: initial.seguridad, activo: initial.activo }
      : BLANK_CUENTA()
  );
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const handleSecurity = (s: Seguridad) => {
    const opt = SEGURIDAD_OPTIONS.find((o) => o.value === s)!;
    setForm((p) => ({ ...p, seguridad: s, smtp_port: opt.port }));
  };

  const validate = () => {
    if (!form.nombre.trim()) return 'El nombre es obligatorio';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return 'Email no válido';
    if (!form.password.trim()) return 'La contraseña es obligatoria';
    if (!form.smtp_host.trim()) return 'El servidor SMTP es obligatorio';
    if (!form.smtp_port || form.smtp_port < 1) return 'Puerto no válido';
    return '';
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error: dbErr } = initial
      ? await supabase.from('email_cuentas').update(payload).eq('id', initial.id)
      : await supabase.from('email_cuentas').insert(payload);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <Server size={17} style={{ color: '#0EA5E9' }} />
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>
              {initial ? 'Editar cuenta SMTP' : 'Nueva cuenta SMTP'}
            </h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={15} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '70vh' }}>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Nombre de la cuenta *</label>
              <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
                placeholder="Ej: Notificaciones RRHH"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Email emisor *</label>
              <input value={form.email} onChange={(e) => set('email', e.target.value)}
                type="email" placeholder="notif@empresa.com"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Contraseña *</label>
              <div className="relative">
                <input value={form.password} onChange={(e) => set('password', e.target.value)}
                  type={showPass ? 'text' : 'password'} placeholder="Contraseña de aplicacion"
                  className="w-full px-3 py-2.5 pr-10 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
                <button type="button" onClick={() => setShowPass((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPass ? <EyeOff size={15} style={{ color: '#94A3B8' }} /> : <Eye size={15} style={{ color: '#94A3B8' }} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Servidor SMTP *</label>
              <input value={form.smtp_host} onChange={(e) => set('smtp_host', e.target.value)}
                placeholder="smtp.gmail.com"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Puerto *</label>
              <input value={form.smtp_port} onChange={(e) => set('smtp_port', parseInt(e.target.value) || 587)}
                type="number" min={1} max={65535}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Tipo de seguridad *</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SEGURIDAD_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSecurity(opt.value)}
                    className="px-3 py-2.5 rounded-xl text-xs font-semibold border-2 transition-all flex flex-col items-center gap-0.5"
                    style={{
                      borderColor: form.seguridad === opt.value ? SEGURIDAD_COLORS[opt.value].color : '#E2E8F0',
                      backgroundColor: form.seguridad === opt.value ? SEGURIDAD_COLORS[opt.value].bg : '#F8FAFC',
                      color: form.seguridad === opt.value ? SEGURIDAD_COLORS[opt.value].color : '#64748B',
                    }}
                  >
                    <span>{opt.value}</span>
                    <span className="text-xs opacity-70 font-normal">:{opt.port}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center gap-3">
              <button type="button" onClick={() => set('activo', !form.activo)}>
                {form.activo
                  ? <ToggleRight size={28} style={{ color: '#0EA5E9' }} />
                  : <ToggleLeft size={28} style={{ color: '#94A3B8' }} />}
              </button>
              <span className="text-sm font-medium" style={{ color: '#475569' }}>
                Cuenta {form.activo ? 'activa' : 'inactiva'}
              </span>
            </div>
          </div>

          <div className="rounded-xl px-4 py-3 text-xs" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E' }}>
            <strong>Nota de seguridad:</strong> Usa una contraseña de aplicacion (no la contraseña principal de tu cuenta de correo). En Gmail/Outlook puedes generarla en Configuracion de seguridad.
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? 'Guardar cambios' : 'Crear cuenta'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Notification Modal ───────────────────────────────────────────────────────

const BLANK_NOTIF = (): Omit<EmailNotificacion, 'id' | 'created_at'> => ({
  nombre: '', descripcion: '', evento: '', cuenta_id: null, destinatarios: [], activo: true,
});

interface NotifModalProps {
  initial?: EmailNotificacion | null;
  cuentas: EmailCuenta[];
  onClose: () => void;
  onSaved: () => void;
}

function NotifModal({ initial, cuentas, onClose, onSaved }: NotifModalProps) {
  const [form, setForm] = useState<Omit<EmailNotificacion, 'id' | 'created_at'>>(
    initial
      ? { nombre: initial.nombre, descripcion: initial.descripcion, evento: initial.evento,
          cuenta_id: initial.cuenta_id, destinatarios: initial.destinatarios, activo: initial.activo }
      : BLANK_NOTIF()
  );
  const [eventoCustom, setEventoCustom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const eventoFinal = form.evento === 'personalizado' ? eventoCustom.trim() : form.evento;

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!eventoFinal) { setError('Selecciona o define un evento'); return; }
    setSaving(true); setError('');
    const payload = { ...form, evento: eventoFinal, updated_at: new Date().toISOString() };
    const { error: dbErr } = initial
      ? await supabase.from('email_notificaciones').update(payload).eq('id', initial.id)
      : await supabase.from('email_notificaciones').insert(payload);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <Bell size={17} style={{ color: '#0EA5E9' }} />
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>
              {initial ? 'Editar notificacion' : 'Nueva notificacion'}
            </h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={15} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '72vh' }}>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Nombre *</label>
            <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
              placeholder="Ej: Aviso nueva incidencia"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Descripcion</label>
            <textarea value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)}
              placeholder="Descripcion opcional del uso de esta notificacion"
              rows={2} className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Evento que la dispara *</label>
            <select value={form.evento} onChange={(e) => set('evento', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: form.evento ? '#1E293B' : '#94A3B8' }}>
              <option value="">Selecciona un evento...</option>
              {EVENTOS_PREDEFINIDOS.map((ev) => (
                <option key={ev.value} value={ev.value}>{ev.label}</option>
              ))}
            </select>
            {form.evento === 'personalizado' && (
              <input value={eventoCustom} onChange={(e) => setEventoCustom(e.target.value)}
                placeholder="Nombre del evento personalizado (ej: factura_emitida)"
                className="w-full mt-2 px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Cuenta emisora</label>
            {cuentas.length === 0 ? (
              <div className="px-3 py-2.5 rounded-xl text-sm" style={{ backgroundColor: '#FEF3C7', border: '1px solid #FDE68A', color: '#92400E' }}>
                No hay cuentas SMTP configuradas. Crea una primero en la seccion "Cuentas SMTP".
              </div>
            ) : (
              <select value={form.cuenta_id ?? ''} onChange={(e) => set('cuenta_id', e.target.value || null)}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: form.cuenta_id ? '#1E293B' : '#94A3B8' }}>
                <option value="">Sin cuenta asignada</option>
                {cuentas.filter((c) => c.activo).map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre} ({c.email})</option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>
              Destinatarios
              <span className="ml-1 normal-case font-normal text-slate-400">(Enter para añadir)</span>
            </label>
            <TagInput tags={form.destinatarios} onChange={(t) => set('destinatarios', t)} />
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set('activo', !form.activo)}>
              {form.activo
                ? <ToggleRight size={28} style={{ color: '#0EA5E9' }} />
                : <ToggleLeft size={28} style={{ color: '#94A3B8' }} />}
            </button>
            <span className="text-sm font-medium" style={{ color: '#475569' }}>
              Notificacion {form.activo ? 'activa' : 'inactiva'}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? 'Guardar cambios' : 'Crear notificacion'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plantilla Modal ──────────────────────────────────────────────────────────

const BLANK_PLANTILLA = (): Omit<EmailPlantilla, 'id' | 'created_at'> => ({
  nombre: '', descripcion: '', asunto: '', cuerpo: '', activo: true, tipo: null,
});

interface PlantillaModalProps {
  initial?: EmailPlantilla | null;
  onClose: () => void;
  onSaved: () => void;
}

function PlantillaModal({ initial, onClose, onSaved }: PlantillaModalProps) {
  const [form, setForm] = useState<Omit<EmailPlantilla, 'id' | 'created_at'>>(
    initial
      ? { nombre: initial.nombre, descripcion: initial.descripcion, asunto: initial.asunto, cuerpo: initial.cuerpo, activo: initial.activo, tipo: initial.tipo }
      : BLANK_PLANTILLA()
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showVars, setShowVars] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const set = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const insertVar = (v: string) => {
    const el = bodyRef.current;
    if (!el) { setForm((p) => ({ ...p, cuerpo: p.cuerpo + v })); return; }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + v + el.value.slice(end);
    setForm((p) => ({ ...p, cuerpo: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + v.length;
      el.selectionEnd = start + v.length;
    });
  };

  const handleSave = async () => {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return; }
    if (!form.asunto.trim()) { setError('El asunto es obligatorio'); return; }
    if (!form.cuerpo.trim()) { setError('El cuerpo del mensaje es obligatorio'); return; }
    setSaving(true); setError('');
    const payload = { ...form, updated_at: new Date().toISOString() };
    const { error: dbErr } = initial
      ? await supabase.from('email_plantillas').update(payload).eq('id', initial.id)
      : await supabase.from('email_plantillas').insert(payload);
    setSaving(false);
    if (dbErr) { setError(dbErr.message); return; }
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden bg-white">
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <FileText size={17} style={{ color: '#0EA5E9' }} />
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>
              {initial ? 'Editar plantilla' : 'Nueva plantilla'}
            </h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={15} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto" style={{ maxHeight: '75vh' }}>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Nombre de la plantilla *</label>
              <input value={form.nombre} onChange={(e) => set('nombre', e.target.value)}
                placeholder="Ej: Bienvenida al portal"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Descripcion</label>
              <input value={form.descripcion} onChange={(e) => set('descripcion', e.target.value)}
                placeholder="Uso previsto de esta plantilla"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Asunto del correo *</label>
              <input value={form.asunto} onChange={(e) => set('asunto', e.target.value)}
                placeholder="Ej: Bienvenido a {{empresa}} — tus credenciales de acceso"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>
                Tipo de plantilla
                <span className="ml-1 normal-case font-normal text-slate-400">(asignala a un flujo del sistema, ej: recuperacion de contrasena)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => set('tipo', null)}
                  className="px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                  style={{
                    borderColor: form.tipo === null ? '#475569' : '#E2E8F0',
                    backgroundColor: form.tipo === null ? '#F1F5F9' : '#F8FAFC',
                    color: form.tipo === null ? '#475569' : '#94A3B8',
                  }}
                >
                  Sin asignar
                </button>
                {TIPO_OPTIONS.map((opt) => {
                  const isActive = form.tipo === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('tipo', opt.value)}
                      className="px-3 py-2 rounded-xl text-xs font-semibold border-2 transition-all"
                      style={{
                        borderColor: isActive ? opt.color : '#E2E8F0',
                        backgroundColor: isActive ? opt.bg : '#F8FAFC',
                        color: isActive ? opt.color : '#94A3B8',
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Variable picker */}
          <div>
            <button
              type="button"
              onClick={() => setShowVars((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold mb-2 cursor-pointer"
              style={{ color: '#0EA5E9' }}
            >
              {showVars ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
              Variables disponibles — haz clic para insertar en el cuerpo
            </button>
            {showVars && (
              <div className="flex flex-wrap gap-2 p-3 rounded-xl mb-2" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                {PLANTILLA_VARIABLES.map((pv) => (
                  <button
                    key={pv.var}
                    type="button"
                    onClick={() => insertVar(pv.var)}
                    title={pv.desc}
                    className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold cursor-pointer transition-all hover:opacity-80"
                    style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}
                  >
                    {pv.var}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>Cuerpo del mensaje *</label>
            <textarea
              ref={bodyRef}
              value={form.cuerpo}
              onChange={(e) => set('cuerpo', e.target.value)}
              placeholder={`Hola {{nombre}},\n\nTu cuenta en el portal ha sido creada.\n\nEmail: {{email}}\nContraseña: {{password}}\n\nAccede en: {{url_acceso}}\n\nSaludos,\nEl equipo de {{empresa}}`}
              rows={10}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-y font-mono"
              style={{ border: '1.5px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B', lineHeight: '1.6' }}
            />
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              Texto plano con variables entre llaves dobles. El salto de linea se respeta al enviar.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" onClick={() => set('activo', !form.activo)}>
              {form.activo
                ? <ToggleRight size={28} style={{ color: '#0EA5E9' }} />
                : <ToggleLeft size={28} style={{ color: '#94A3B8' }} />}
            </button>
            <span className="text-sm font-medium" style={{ color: '#475569' }}>
              Plantilla {form.activo ? 'activa' : 'inactiva'}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}>
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial ? 'Guardar cambios' : 'Crear plantilla'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SMTP Accounts Section ────────────────────────────────────────────────────

function CuentasSection() {
  const [cuentas, setCuentas] = useState<EmailCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailCuenta | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('email_cuentas').select('*').order('nombre');
    setCuentas((data ?? []) as EmailCuenta[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('email_cuentas').delete().eq('id', id);
    setDeleting(null);
    load();
  };

  const toggleReveal = (id: string) =>
    setRevealedPasswords((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleToggleActivo = async (c: EmailCuenta) => {
    await supabase.from('email_cuentas').update({ activo: !c.activo }).eq('id', c.id);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: '#64748B' }}>
          Configura las cuentas de correo que enviarán las notificaciones del sistema.
        </p>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
        >
          <Plus size={15} /> Nueva Cuenta
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: '#0EA5E9' }} />
        </div>
      ) : cuentas.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Server size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Sin cuentas SMTP configuradas</p>
          <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Añade la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-3">
          {cuentas.map((c) => (
            <div key={c.id} className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: c.activo ? '#EFF6FF' : '#F1F5F9', border: `1px solid ${c.activo ? '#BFDBFE' : '#E2E8F0'}` }}>
                    <Mail size={17} style={{ color: c.activo ? '#2563EB' : '#94A3B8' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{c.nombre}</p>
                      <SeguridadBadge s={c.seguridad} />
                      {!c.activo && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8' }}>Inactiva</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{c.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleToggleActivo(c)} title={c.activo ? 'Desactivar' : 'Activar'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50">
                    {c.activo
                      ? <ToggleRight size={20} style={{ color: '#0EA5E9' }} />
                      : <ToggleLeft size={20} style={{ color: '#94A3B8' }} />}
                  </button>
                  <button onClick={() => { setEditing(c); setShowModal(true); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50">
                    <Pencil size={14} style={{ color: '#64748B' }} />
                  </button>
                  <button onClick={() => handleDelete(c.id)} disabled={deleting === c.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 disabled:opacity-50">
                    {deleting === c.id
                      ? <Loader2 size={14} className="animate-spin" style={{ color: '#EF4444' }} />
                      : <Trash2 size={14} style={{ color: '#EF4444' }} />}
                  </button>
                </div>
              </div>

              <div className="mt-3 pt-3 flex items-center gap-4 flex-wrap" style={{ borderTop: '1px solid #F1F5F9' }}>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                  <Server size={12} />
                  <span>{c.smtp_host}:{c.smtp_port}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#64748B' }}>
                  <Shield size={12} />
                  <span>{c.seguridad}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs ml-auto">
                  <span style={{ color: '#94A3B8' }}>
                    {revealedPasswords.has(c.id) ? c.password : '••••••••'}
                  </span>
                  <button onClick={() => toggleReveal(c.id)} className="opacity-60 hover:opacity-100">
                    {revealedPasswords.has(c.id)
                      ? <EyeOff size={12} style={{ color: '#64748B' }} />
                      : <Eye size={12} style={{ color: '#64748B' }} />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <CuentaModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}

// ─── Notifications Section ────────────────────────────────────────────────────

function NotificacionesSection() {
  const [notifs, setNotifs] = useState<EmailNotificacion[]>([]);
  const [cuentas, setCuentas] = useState<EmailCuenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailNotificacion | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [{ data: n }, { data: c }] = await Promise.all([
      supabase.from('email_notificaciones').select('*').order('nombre'),
      supabase.from('email_cuentas').select('*').order('nombre'),
    ]);
    setNotifs((n ?? []) as EmailNotificacion[]);
    setCuentas((c ?? []) as EmailCuenta[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('email_notificaciones').delete().eq('id', id);
    setDeleting(null);
    load();
  };

  const handleToggleActivo = async (n: EmailNotificacion) => {
    await supabase.from('email_notificaciones').update({ activo: !n.activo }).eq('id', n.id);
    load();
  };

  const getCuenta = (id: string | null) => cuentas.find((c) => c.id === id);
  const getEventoLabel = (ev: string) => EVENTOS_PREDEFINIDOS.find((e) => e.value === ev)?.label ?? ev;

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: '#64748B' }}>
          Define qué eventos del sistema disparan un correo y a qué destinatarios.
        </p>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
        >
          <Plus size={15} /> Nueva Notificacion
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: '#0EA5E9' }} />
        </div>
      ) : notifs.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <Bell size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Sin notificaciones configuradas</p>
          <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Añade la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifs.map((n) => {
            const cuenta = getCuenta(n.cuenta_id);
            return (
              <div key={n.id} className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                      style={{ backgroundColor: n.activo ? '#F0FDF4' : '#F1F5F9', border: `1px solid ${n.activo ? '#BBF7D0' : '#E2E8F0'}` }}>
                      <Bell size={17} style={{ color: n.activo ? '#059669' : '#94A3B8' }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{n.nombre}</p>
                        {!n.activo && (
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8' }}>Inactiva</span>
                        )}
                      </div>
                      {n.descripcion && (
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{n.descripcion}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleToggleActivo(n)} title={n.activo ? 'Desactivar' : 'Activar'}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50">
                      {n.activo
                        ? <ToggleRight size={20} style={{ color: '#0EA5E9' }} />
                        : <ToggleLeft size={20} style={{ color: '#94A3B8' }} />}
                    </button>
                    <button onClick={() => { setEditing(n); setShowModal(true); }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50">
                      <Pencil size={14} style={{ color: '#64748B' }} />
                    </button>
                    <button onClick={() => handleDelete(n.id)} disabled={deleting === n.id}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 disabled:opacity-50">
                      {deleting === n.id
                        ? <Loader2 size={14} className="animate-spin" style={{ color: '#EF4444' }} />
                        : <Trash2 size={14} style={{ color: '#EF4444' }} />}
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-3 space-y-2" style={{ borderTop: '1px solid #F1F5F9' }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: '#475569' }}>Evento:</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
                      {getEventoLabel(n.evento)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold" style={{ color: '#475569' }}>Emisor:</span>
                    {cuenta ? (
                      <span className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                        <Mail size={10} />
                        {cuenta.nombre} — {cuenta.email}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#CBD5E1' }}>Sin cuenta asignada</span>
                    )}
                  </div>
                  {n.destinatarios.length > 0 && (
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className="text-xs font-semibold flex-shrink-0 mt-0.5" style={{ color: '#475569' }}>Para:</span>
                      <div className="flex flex-wrap gap-1.5">
                        {n.destinatarios.map((d) => (
                          <span key={d} className="text-xs px-2 py-0.5 rounded-lg"
                            style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <NotifModal
          initial={editing}
          cuentas={cuentas}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}

// ─── Plantillas Section ───────────────────────────────────────────────────────

function PlantillasSection() {
  const [plantillas, setPlantillas] = useState<EmailPlantilla[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<EmailPlantilla | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('email_plantillas').select('*').order('nombre');
    setPlantillas((data ?? []) as EmailPlantilla[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await supabase.from('email_plantillas').delete().eq('id', id);
    setDeleting(null);
    load();
  };

  const handleToggleActivo = async (p: EmailPlantilla) => {
    await supabase.from('email_plantillas').update({ activo: !p.activo }).eq('id', p.id);
    load();
  };

  return (
    <>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm" style={{ color: '#64748B' }}>
          Crea plantillas de correo reutilizables con variables dinamicas para enviar credenciales y comunicaciones a usuarios.
        </p>
        <button
          onClick={() => { setEditing(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 flex-shrink-0"
          style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
        >
          <Plus size={15} /> Nueva Plantilla
        </button>
      </div>

      <div className="rounded-xl px-4 py-3 mb-5 text-xs" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
        <strong>Variables disponibles:</strong>{' '}
        {PLANTILLA_VARIABLES.map((v) => (
          <code key={v.var} className="mx-1 px-1.5 py-0.5 rounded font-mono" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{v.var}</code>
        ))}
        — se sustituyen al enviar el correo.
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={26} className="animate-spin" style={{ color: '#0EA5E9' }} />
        </div>
      ) : plantillas.length === 0 ? (
        <div className="text-center py-16 rounded-2xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <FileText size={36} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
          <p className="text-sm font-medium" style={{ color: '#94A3B8' }}>Sin plantillas creadas</p>
          <p className="text-xs mt-1" style={{ color: '#CBD5E1' }}>Crea la primera con el botón de arriba</p>
        </div>
      ) : (
        <div className="space-y-3">
          {plantillas.map((p) => (
            <div key={p.id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="flex items-start justify-between gap-3 p-5">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                    style={{ backgroundColor: p.activo ? '#EFF6FF' : '#F1F5F9', border: `1px solid ${p.activo ? '#BFDBFE' : '#E2E8F0'}` }}>
                    <FileText size={17} style={{ color: p.activo ? '#2563EB' : '#94A3B8' }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm" style={{ color: '#0F172A' }}>{p.nombre}</p>
                      {(() => {
                        const badge = getTipoBadge(p.tipo);
                        return badge ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: badge.bg, color: badge.color, border: `1px solid ${badge.border}` }}>
                            {badge.label}
                          </span>
                        ) : null;
                      })()}
                      {!p.activo && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8' }}>Inactiva</span>
                      )}
                    </div>
                    {p.descripcion && <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{p.descripcion}</p>}
                    <p className="text-xs mt-1 font-medium truncate" style={{ color: '#475569' }}>
                      Asunto: {p.asunto}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50"
                    title="Ver cuerpo"
                  >
                    {expanded === p.id
                      ? <ChevronUp size={14} style={{ color: '#64748B' }} />
                      : <ChevronDown size={14} style={{ color: '#64748B' }} />}
                  </button>
                  <button onClick={() => handleToggleActivo(p)} title={p.activo ? 'Desactivar' : 'Activar'}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50">
                    {p.activo
                      ? <ToggleRight size={20} style={{ color: '#0EA5E9' }} />
                      : <ToggleLeft size={20} style={{ color: '#94A3B8' }} />}
                  </button>
                  <button onClick={() => { setEditing(p); setShowModal(true); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-50">
                    <Pencil size={14} style={{ color: '#64748B' }} />
                  </button>
                  <button onClick={() => handleDelete(p.id)} disabled={deleting === p.id}
                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-red-50 disabled:opacity-50">
                    {deleting === p.id
                      ? <Loader2 size={14} className="animate-spin" style={{ color: '#EF4444' }} />
                      : <Trash2 size={14} style={{ color: '#EF4444' }} />}
                  </button>
                </div>
              </div>
              {expanded === p.id && (
                <div className="px-5 pb-5 pt-0">
                  <pre className="text-xs whitespace-pre-wrap rounded-xl px-4 py-3 font-mono leading-relaxed"
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#334155' }}>
                    {p.cuerpo}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <PlantillaModal
          initial={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSaved={load}
        />
      )}
    </>
  );
}

// ─── Main Module ──────────────────────────────────────────────────────────────

type Section = 'cuentas' | 'notificaciones' | 'plantillas';

export default function EmailModule() {
  const [section, setSection] = useState<Section>('cuentas');

  const tabs: { id: Section; label: string; icon: LucideIcon }[] = [
    { id: 'cuentas',        label: 'Cuentas SMTP',   icon: Server   },
    { id: 'notificaciones', label: 'Notificaciones', icon: Bell     },
    { id: 'plantillas',     label: 'Plantillas',     icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>Notificaciones por Email</h2>
        <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
          Configura cuentas SMTP emisoras, eventos del sistema y plantillas de correo.
        </p>
      </div>

      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F1F5F9' }}>
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = section === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setSection(t.id)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{
                backgroundColor: isActive ? '#FFFFFF' : 'transparent',
                color: isActive ? '#0F172A' : '#64748B',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      {section === 'cuentas' && <CuentasSection />}
      {section === 'notificaciones' && <NotificacionesSection />}
      {section === 'plantillas' && <PlantillasSection />}
    </div>
  );
}
