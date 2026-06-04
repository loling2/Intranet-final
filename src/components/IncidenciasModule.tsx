import { useState, useEffect, useRef } from 'react';
import {
  AlertCircle, Plus, X, Send, Clock, CheckCircle2, Loader2,
  Upload, Image, User, Building2,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

// ─── Types ────────────────────────────────────────────────────────────────────

type Estado = 'pendiente' | 'en_proceso' | 'finalizada';

interface Incidencia {
  id: string;
  numero: number;
  titulo: string;
  descripcion: string;
  estado: Estado;
  foto_url: string | null;
  creado_por_id: string;
  creado_por_nombre: string;
  departamento_id: string | null;
  departamento_nombre: string;
  fecha_creacion: string;
  fecha_finalizacion: string | null;
}

interface Mensaje {
  id: string;
  incidencia_id: string;
  autor_id: string;
  autor_nombre: string;
  texto: string;
  estado_nuevo: Estado | null;
  created_at: string;
}

interface Departamento {
  id: string;
  nombre: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ESTADOS: Record<Estado, { label: string; color: string; bg: string; icon: React.FC<{ size?: number; className?: string }> }> = {
  pendiente:  { label: 'Pendiente',  color: '#D97706', bg: '#FEF3C7', icon: Clock },
  en_proceso: { label: 'En Proceso', color: '#2563EB', bg: '#EFF6FF', icon: Loader2 },
  finalizada: { label: 'Finalizada', color: '#059669', bg: '#ECFDF5', icon: CheckCircle2 },
};

function EstadoBadge({ estado }: { estado: Estado }) {
  const cfg = ESTADOS[estado];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ color: cfg.color, backgroundColor: cfg.bg }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── Create Incident Modal ────────────────────────────────────────────────────

interface CreateModalProps {
  currentUserId: string;
  currentUserNombre: string;
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ currentUserId, currentUserNombre, onClose, onCreated }: CreateModalProps) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [departamentoId, setDepartamentoId] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [departamentos, setDepartamentos] = useState<Departamento[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('departamentos').select('id, nombre').order('nombre')
      .then(({ data }) => setDepartamentos((data ?? []) as Departamento[]));
  }, []);

  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFoto(file);
    const reader = new FileReader();
    reader.onload = (ev) => setFotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!titulo.trim()) { setError('El nombre de la incidencia es obligatorio'); return; }
    if (!departamentoId) { setError('Selecciona el departamento destinatario'); return; }
    setSaving(true); setError('');

    let foto_url: string | null = null;

    if (foto) {
      const ext = foto.name.split('.').pop();
      const path = `incidencias/${currentUserId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('incidencias-fotos')
        .upload(path, foto, { upsert: true });
      if (!upErr) {
        const { data: pub } = supabase.storage.from('incidencias-fotos').getPublicUrl(path);
        foto_url = pub.publicUrl;
      } else {
        foto_url = fotoPreview;
      }
    }

    const dept = departamentos.find((d) => d.id === departamentoId);

    const { error: insErr } = await supabase.from('incidencias').insert({
      titulo: titulo.trim(),
      descripcion: descripcion.trim(),
      creado_por_id: currentUserId,
      creado_por_nombre: currentUserNombre,
      departamento_id: departamentoId,
      departamento_nombre: dept?.nombre ?? '',
      foto_url,
    });

    setSaving(false);
    if (insErr) { setError(insErr.message); return; }
    onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <AlertCircle size={18} style={{ color: '#0EA5E9' }} />
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Nueva Incidencia</h2>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="px-4 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>
              Nombre de la incidencia *
            </label>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Error de fichaje"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>
              Descripcion
            </label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Describe el problema con detalle..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>
              Enviar a *
            </label>
            {departamentos.length === 0 ? (
              <div className="px-3 py-2.5 rounded-xl text-sm" style={{ border: '1.5px solid #FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' }}>
                No hay departamentos creados. Pide al administrador que cree los departamentos primero.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {departamentos.map((dept) => (
                  <button
                    key={dept.id}
                    onClick={() => setDepartamentoId(dept.id)}
                    className="flex items-center gap-2.5 px-3 py-3 rounded-xl text-sm font-medium transition-all border-2"
                    style={{
                      borderColor: departamentoId === dept.id ? '#0EA5E9' : '#E2E8F0',
                      backgroundColor: departamentoId === dept.id ? '#EFF6FF' : '#F8FAFC',
                      color: departamentoId === dept.id ? '#0369A1' : '#475569',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        backgroundColor: departamentoId === dept.id ? '#BFDBFE' : '#E2E8F0',
                      }}
                    >
                      <Building2 size={13} style={{ color: departamentoId === dept.id ? '#1D4ED8' : '#94A3B8' }} />
                    </div>
                    <span className="truncate">{dept.nombre}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: '#475569' }}>
              Foto (opcional)
            </label>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFoto} />
            {fotoPreview ? (
              <div className="relative rounded-xl overflow-hidden" style={{ maxHeight: 160 }}>
                <img src={fotoPreview} alt="preview" className="w-full object-cover" style={{ maxHeight: 160 }} />
                <button
                  onClick={() => { setFoto(null); setFotoPreview(null); }}
                  className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
                >
                  <X size={12} className="text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full py-6 rounded-xl flex flex-col items-center gap-2 transition-colors hover:bg-slate-50"
                style={{ border: '1.5px dashed #CBD5E1' }}
              >
                <Upload size={20} style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#94A3B8' }}>Haz clic para adjuntar una imagen</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid #E2E8F0' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 disabled:opacity-60"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            Enviar Incidencia
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Incident Detail Drawer ───────────────────────────────────────────────────

interface DetailProps {
  incidencia: Incidencia;
  currentUserId: string;
  currentUserNombre: string;
  canManage: boolean;
  onClose: () => void;
  onUpdated: () => void;
}

function IncidenciaDetail({ incidencia, currentUserId, currentUserNombre, canManage, onClose, onUpdated }: DetailProps) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState('');
  const [nuevoEstado, setNuevoEstado] = useState<Estado | ''>('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadMensajes = async () => {
    const { data } = await supabase
      .from('incidencias_mensajes')
      .select('*')
      .eq('incidencia_id', incidencia.id)
      .order('created_at', { ascending: true });
    setMensajes((data ?? []) as Mensaje[]);
  };

  useEffect(() => { loadMensajes(); }, [incidencia.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const handleSend = async () => {
    if (!texto.trim() && !nuevoEstado) { setError('Escribe un mensaje o selecciona un nuevo estado'); return; }
    setSending(true); setError('');

    const msgTexto = texto.trim() || `Estado cambiado a ${nuevoEstado ? ESTADOS[nuevoEstado as Estado].label : ''}`;

    const { error: msgErr } = await supabase.from('incidencias_mensajes').insert({
      incidencia_id: incidencia.id,
      autor_id: currentUserId,
      autor_nombre: currentUserNombre,
      texto: msgTexto,
      estado_nuevo: nuevoEstado || null,
    });

    if (msgErr) { setError(msgErr.message); setSending(false); return; }

    if (nuevoEstado && canManage) {
      const update: Record<string, unknown> = { estado: nuevoEstado, updated_at: new Date().toISOString() };
      if (nuevoEstado === 'finalizada') update.fecha_finalizacion = new Date().toISOString();
      await supabase.from('incidencias').update(update).eq('id', incidencia.id);
      onUpdated();
    }

    setTexto(''); setNuevoEstado('');
    setSending(false);
    await loadMensajes();
  };

  const nextStates: Estado[] = incidencia.estado === 'pendiente'
    ? ['en_proceso', 'finalizada']
    : incidencia.estado === 'en_proceso'
    ? ['finalizada']
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ backgroundColor: '#FFFFFF', maxHeight: '90vh' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 flex-shrink-0" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: '#94A3B8' }}>INC-{String(incidencia.numero).padStart(4, '0')}</p>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>{incidencia.titulo}</h2>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <EstadoBadge estado={incidencia.estado} />
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                De <strong style={{ color: '#475569' }}>{incidencia.creado_por_nombre}</strong>
              </span>
              {incidencia.departamento_nombre && (
                <span className="flex items-center gap-1 text-xs" style={{ color: '#94A3B8' }}>
                  <Building2 size={10} />
                  <strong style={{ color: '#475569' }}>{incidencia.departamento_nombre}</strong>
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 flex-shrink-0 ml-3">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
        </div>

        {/* Description + photo */}
        {(incidencia.descripcion || incidencia.foto_url) && (
          <div className="px-6 py-4 flex-shrink-0" style={{ borderBottom: '1px solid #F1F5F9' }}>
            {incidencia.descripcion && (
              <p className="text-sm mb-3" style={{ color: '#475569' }}>{incidencia.descripcion}</p>
            )}
            {incidencia.foto_url && (
              <img
                src={incidencia.foto_url}
                alt="foto incidencia"
                className="rounded-xl max-h-40 object-contain"
                style={{ border: '1px solid #E2E8F0' }}
              />
            )}
            <div className="flex items-center gap-4 mt-2 text-xs" style={{ color: '#94A3B8' }}>
              <span>Creado: {formatDate(incidencia.fecha_creacion)}</span>
              {incidencia.fecha_finalizacion && (
                <span style={{ color: '#059669' }}>Finalizado: {formatDate(incidencia.fecha_finalizacion)}</span>
              )}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3" style={{ minHeight: 120 }}>
          {mensajes.length === 0 && (
            <p className="text-center text-sm py-6" style={{ color: '#CBD5E1' }}>Sin mensajes aun</p>
          )}
          {mensajes.map((m) => {
            const isMine = m.autor_id === currentUserId;
            return (
              <div key={m.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {m.estado_nuevo && (
                  <div className="w-full flex items-center gap-2 my-1">
                    <div className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
                    <EstadoBadge estado={m.estado_nuevo} />
                    <div className="h-px flex-1" style={{ backgroundColor: '#E2E8F0' }} />
                  </div>
                )}
                <div
                  className="max-w-xs sm:max-w-md px-4 py-2.5 rounded-2xl text-sm"
                  style={{
                    backgroundColor: isMine ? '#0EA5E9' : '#F1F5F9',
                    color: isMine ? '#FFFFFF' : '#1E293B',
                    borderBottomRightRadius: isMine ? 4 : undefined,
                    borderBottomLeftRadius: !isMine ? 4 : undefined,
                  }}
                >
                  {m.texto}
                </div>
                <span className="text-xs mt-0.5 px-1" style={{ color: '#94A3B8' }}>
                  {m.autor_nombre} · {formatDate(m.created_at)}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Reply area */}
        {incidencia.estado !== 'finalizada' && (
          <div className="px-6 py-4 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0' }}>
            {error && <p className="text-xs mb-2" style={{ color: '#EF4444' }}>{error}</p>}

            {canManage && nextStates.length > 0 && (
              <div className="flex gap-2 mb-3 flex-wrap">
                {nextStates.map((s) => {
                  const cfg = ESTADOS[s];
                  const Icon = cfg.icon;
                  return (
                    <button
                      key={s}
                      onClick={() => setNuevoEstado(nuevoEstado === s ? '' : s)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all"
                      style={{
                        borderColor: nuevoEstado === s ? cfg.color : '#E2E8F0',
                        backgroundColor: nuevoEstado === s ? cfg.bg : 'transparent',
                        color: nuevoEstado === s ? cfg.color : '#64748B',
                      }}
                    >
                      <Icon size={12} />
                      Mover a {cfg.label}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex gap-2">
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribe un mensaje..."
                rows={2}
                className="flex-1 px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              />
              <button
                onClick={handleSend}
                disabled={sending}
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 self-end disabled:opacity-50"
                style={{ backgroundColor: '#0EA5E9' }}
              >
                {sending ? <Loader2 size={16} className="text-white animate-spin" /> : <Send size={16} className="text-white" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Kanban Column ────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  estado: Estado;
  incidencias: Incidencia[];
  onSelect: (i: Incidencia) => void;
}

function KanbanColumn({ estado, incidencias, onSelect }: KanbanColumnProps) {
  const cfg = ESTADOS[estado];
  const Icon = cfg.icon;
  return (
    <div className="flex flex-col rounded-2xl overflow-hidden" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', minHeight: 200 }}>
      <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: cfg.bg, borderBottom: `2px solid ${cfg.color}30` }}>
        <Icon size={15} style={{ color: cfg.color }} />
        <span className="font-semibold text-sm" style={{ color: cfg.color }}>{cfg.label}</span>
        <span
          className="ml-auto text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: cfg.color, color: '#FFFFFF' }}
        >
          {incidencias.length}
        </span>
      </div>
      <div className="flex-1 p-3 space-y-2.5 overflow-y-auto" style={{ maxHeight: 480 }}>
        {incidencias.length === 0 && (
          <p className="text-center text-xs py-8" style={{ color: '#CBD5E1' }}>Sin incidencias</p>
        )}
        {incidencias.map((inc) => (
          <button
            key={inc.id}
            onClick={() => onSelect(inc)}
            className="w-full text-left rounded-xl p-3.5 transition-all hover:shadow-md"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <span className="text-xs font-mono font-semibold" style={{ color: '#94A3B8' }}>
                INC-{String(inc.numero).padStart(4, '0')}
              </span>
              {inc.foto_url && <Image size={12} style={{ color: '#94A3B8', flexShrink: 0 }} />}
            </div>
            <p className="text-sm font-semibold mb-2" style={{ color: '#1E293B' }}>{inc.titulo}</p>
            {inc.descripcion && (
              <p className="text-xs line-clamp-2 mb-2" style={{ color: '#64748B' }}>{inc.descripcion}</p>
            )}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                <User size={9} />
                {inc.creado_por_nombre}
              </span>
              {inc.departamento_nombre && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
                  <Building2 size={9} />
                  {inc.departamento_nombre}
                </span>
              )}
            </div>
            <p className="text-xs mt-2" style={{ color: '#CBD5E1' }}>{formatDate(inc.fecha_creacion)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  currentUserId: string;
  currentUserNombre: string;
  currentUserRole: string;
}

export default function IncidenciasModule({ currentUserId, currentUserNombre, currentUserRole }: Props) {
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState<Incidencia | null>(null);
  const [userDeptIds, setUserDeptIds] = useState<string[]>([]);

  const isAdminRole = ['admin', 'rrhh', 'supervisor'].includes(currentUserRole);
  const isEmployee = currentUserRole === 'employee';

  const loadUserDepts = async () => {
    const { data } = await supabase
      .from('departamento_miembros')
      .select('departamento_id')
      .eq('user_id', currentUserId);
    setUserDeptIds((data ?? []).map((r: { departamento_id: string }) => r.departamento_id));
  };

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('incidencias')
      .select('*')
      .order('numero', { ascending: false });
    setIncidencias((data ?? []) as Incidencia[]);
    setLoading(false);
  };

  useEffect(() => {
    loadUserDepts();
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const canManageIncidencia = (inc: Incidencia) =>
    isAdminRole || (inc.departamento_id != null && userDeptIds.includes(inc.departamento_id));

  const byEstado = (e: Estado) => incidencias.filter((i) => i.estado === e);

  const handleUpdated = async () => {
    await load();
    if (selected) {
      const { data } = await supabase
        .from('incidencias')
        .select('*')
        .eq('id', selected.id)
        .maybeSingle();
      if (data) setSelected(data as Incidencia);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold" style={{ color: '#0F172A' }}>Incidencias</h2>
          <p className="text-sm mt-0.5" style={{ color: '#64748B' }}>
            {isAdminRole
              ? 'Gestiona todas las incidencias del sistema'
              : 'Crea y consulta el estado de tus incidencias'}
          </p>
        </div>
        {isEmployee && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
          >
            <Plus size={16} />
            Nueva Incidencia
          </button>
        )}
        {!isEmployee && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
            style={{ backgroundColor: '#0EA5E9', color: '#FFFFFF' }}
          >
            <Plus size={16} />
            Nueva Incidencia
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin" style={{ color: '#0EA5E9' }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KanbanColumn estado="pendiente"  incidencias={byEstado('pendiente')}  onSelect={setSelected} />
          <KanbanColumn estado="en_proceso" incidencias={byEstado('en_proceso')} onSelect={setSelected} />
          <KanbanColumn estado="finalizada" incidencias={byEstado('finalizada')} onSelect={setSelected} />
        </div>
      )}

      {showCreate && (
        <CreateModal
          currentUserId={currentUserId}
          currentUserNombre={currentUserNombre}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}

      {selected && (
        <IncidenciaDetail
          incidencia={selected}
          currentUserId={currentUserId}
          currentUserNombre={currentUserNombre}
          canManage={canManageIncidencia(selected)}
          onClose={() => setSelected(null)}
          onUpdated={handleUpdated}
        />
      )}
    </div>
  );
}
