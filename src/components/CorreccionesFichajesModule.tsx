import { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, RefreshCw, Check, X, FileText,
} from 'lucide-react';
import { supabase } from '../supabaseClient';

interface Correccion {
  id: string;
  fichaje_id: string | null;
  empleado_id: string | null;
  user_id: string;
  nombre_empleado: string;
  fecha: string;
  entrada_original: string | null;
  salida_original: string | null;
  entrada_propuesta: string | null;
  salida_propuesta: string | null;
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  validado_por: string | null;
  validado_por_nombre: string | null;
  respuesta_rrhh: string | null;
  validado_at: string | null;
  created_at: string;
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function CorreccionesFichajesModule() {
  const [correcciones, setCorrecciones] = useState<Correccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterEstado, setFilterEstado] = useState<'pendiente' | 'aprobada' | 'rechazada' | ''>('pendiente');
  const [respuestaModal, setRespuestaModal] = useState<{ correccion: Correccion; accion: 'aprobar' | 'rechazar' } | null>(null);
  const [respuesta, setRespuesta] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: dbErr } = await supabase
        .from('fichajes_correcciones')
        .select('*')
        .order('created_at', { ascending: false });
      if (dbErr) throw dbErr;
      setCorrecciones((data ?? []) as Correccion[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar correcciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = filterEstado ? correcciones.filter((c) => c.estado === filterEstado) : correcciones;
  const pendientes = correcciones.filter((c) => c.estado === 'pendiente').length;
  const aprobadas = correcciones.filter((c) => c.estado === 'aprobada').length;
  const rechazadas = correcciones.filter((c) => c.estado === 'rechazada').length;

  const openModal = (c: Correccion, accion: 'aprobar' | 'rechazar') => {
    setRespuestaModal({ correccion: c, accion });
    setRespuesta('');
  };

  const handleConfirm = async () => {
    if (!respuestaModal) return;
    setSaving(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión activa');
      const { data: profile } = await supabase.from('user_profiles').select('nombre').eq('id', user.id).maybeSingle();
      const validadorNombre = (profile as { nombre?: string } | null)?.nombre ?? user.email ?? '';

      const c = respuestaModal.correccion;
      const nuevoEstado = respuestaModal.accion === 'aprobar' ? 'aprobada' : 'rechazada';

      const { error: updErr } = await supabase
        .from('fichajes_correcciones')
        .update({
          estado: nuevoEstado,
          validado_por: user.id,
          validado_por_nombre: validadorNombre,
          respuesta_rrhh: respuesta.trim() || null,
          validado_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id);
      if (updErr) throw updErr;

      // If approved and there are proposed times, update the underlying fichaje(s)
      if (respuestaModal.accion === 'aprobar' && c.fichaje_id) {
        // Update the fichaje's nota_correccion with the approved correction
        await supabase
          .from('fichajes')
          .update({ nota_correccion: `Corrección aprobada por ${validadorNombre}: ${c.motivo}` })
          .eq('id', c.fichaje_id);
      }

      setRespuestaModal(null);
      setRespuesta('');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al validar la petición');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#FFFBEB' }}>
            <AlertTriangle size={18} style={{ color: '#D97706' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Peticiones de corrección de fichajes</h3>
            <p className="text-xs" style={{ color: '#64748B' }}>Valida las peticiones enviadas por los trabajadores</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pendientes', value: pendientes, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
          { label: 'Aprobadas', value: aprobadas, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
          { label: 'Rechazadas', value: rechazadas, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ backgroundColor: '#F1F5F9' }}>
        {[
          { id: 'pendiente', label: 'Pendientes' },
          { id: 'aprobada', label: 'Aprobadas' },
          { id: 'rechazada', label: 'Rechazadas' },
          { id: '', label: 'Todas' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterEstado(f.id as typeof filterEstado)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer"
            style={{
              backgroundColor: filterEstado === f.id ? '#FFFFFF' : 'transparent',
              color: filterEstado === f.id ? '#0F172A' : '#64748B',
              boxShadow: filterEstado === f.id ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* List */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Check size={32} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
            <p className="text-sm font-semibold" style={{ color: '#94A3B8' }}>No hay peticiones {filterEstado ? 'en este estado' : ''}</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
            {filtered.map((c) => {
              const estadoColor = c.estado === 'aprobada' ? '#16A34A' : c.estado === 'rechazada' ? '#DC2626' : '#D97706';
              const estadoBg = c.estado === 'aprobada' ? '#F0FDF4' : c.estado === 'rechazada' ? '#FEF2F2' : '#FFFBEB';
              const estadoBorder = c.estado === 'aprobada' ? '#BBF7D0' : c.estado === 'rechazada' ? '#FECACA' : '#FDE68A';
              const estadoLabel = c.estado.charAt(0).toUpperCase() + c.estado.slice(1);
              return (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{c.nombre_empleado || 'Empleado'}</p>
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: estadoBg, color: estadoColor, border: `1px solid ${estadoBorder}` }}>
                          {estadoLabel}
                        </span>
                        <span className="text-xs" style={{ color: '#94A3B8' }}>{c.fecha}</span>
                      </div>
                      <p className="text-xs" style={{ color: '#64748B' }}>
                        Solicitado: {formatDateTime(c.created_at)}
                      </p>
                    </div>
                    {c.estado === 'pendiente' && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => openModal(c, 'aprobar')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
                          style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}
                        >
                          <Check size={12} /> Aprobar
                        </button>
                        <button
                          onClick={() => openModal(c, 'rechazar')}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all hover:opacity-80"
                          style={{ backgroundColor: '#F8FAFC', color: '#DC2626', border: '1px solid #FECACA' }}
                        >
                          <X size={12} /> Rechazar
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#94A3B8' }}>Registro original</p>
                      <div className="flex gap-4 text-xs">
                        <span>Entrada: <strong style={{ color: '#16A34A' }}>{formatTime(c.entrada_original)}</strong></span>
                        <span>Salida: <strong style={{ color: '#DC2626' }}>{formatTime(c.salida_original)}</strong></span>
                      </div>
                    </div>
                    <div className="rounded-lg p-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: '#D97706' }}>Propuesta del trabajador</p>
                      <div className="flex gap-4 text-xs">
                        <span>Entrada: <strong style={{ color: '#D97706' }}>{formatTime(c.entrada_propuesta)}</strong></span>
                        <span>Salida: <strong style={{ color: '#D97706' }}>{formatTime(c.salida_propuesta)}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg p-3" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                    <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: '#94A3B8' }}>Motivo del trabajador</p>
                    <p className="text-sm" style={{ color: '#1E293B' }}>{c.motivo}</p>
                  </div>

                  {c.respuesta_rrhh && (
                    <div className="mt-2 rounded-lg p-3" style={{ backgroundColor: estadoBg, border: `1px solid ${estadoBorder}` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: estadoColor }}>Respuesta de RRHH</p>
                      <p className="text-sm" style={{ color: '#1E293B' }}>{c.respuesta_rrhh}</p>
                      {c.validado_por_nombre && (
                        <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                          Validado por {c.validado_por_nombre} · {formatDateTime(c.validado_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Response modal */}
      {respuestaModal && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                  {respuestaModal.accion === 'aprobar' ? <Check size={14} className="text-white" /> : <X size={14} className="text-white" />}
                </div>
                <h2 className="text-white font-semibold text-sm">
                  {respuestaModal.accion === 'aprobar' ? 'Aprobar' : 'Rechazar'} petición de corrección
                </h2>
              </div>
              <button onClick={() => setRespuestaModal(null)} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
                <X size={13} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <p style={{ color: '#64748B' }}>Trabajador: <strong style={{ color: '#1E293B' }}>{respuestaModal.correccion.nombre_empleado}</strong></p>
                <p style={{ color: '#64748B' }}>Fecha: <strong style={{ color: '#1E293B' }}>{respuestaModal.correccion.fecha}</strong></p>
                <p style={{ color: '#64748B', marginTop: 4 }}>Motivo: <span style={{ color: '#1E293B' }}>{respuestaModal.correccion.motivo}</span></p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                  Respuesta para el trabajador (opcional)
                </label>
                <textarea
                  value={respuesta}
                  onChange={(e) => setRespuesta(e.target.value)}
                  rows={3}
                  placeholder={respuestaModal.accion === 'aprobar' ? 'Ej: Corrección aplicada en el registro' : 'Ej: No se puede aprobar, contacta con tu responsable'}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setRespuestaModal(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Cancelar
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ backgroundColor: respuestaModal.accion === 'aprobar' ? '#16A34A' : '#DC2626' }}
                >
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : (respuestaModal.accion === 'aprobar' ? <Check size={14} /> : <X size={14} />)}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
