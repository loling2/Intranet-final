import { useState, useEffect } from 'react';
import {
  ClipboardCheck, Clock, CheckCircle2, XCircle, Play, AlertCircle,
  Timer, RefreshCw, Award, Ban,
} from 'lucide-react';
import { SocietyTheme } from './themes';
import { supabase } from './supabaseClient';
import ExamenEjecucion from './components/ExamenEjecucion';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Asignacion {
  id: string;
  examen_id: string;
  estado: 'pendiente' | 'aprobado' | 'suspendido';
  nota: number | null;
  fecha_realizacion: string | null;
  fecha_caducidad_certificado: string | null;
  intentos_realizados: number;
  intentos_permitidos: number | null;
  examenes: {
    nombre: string;
    descripcion: string | null;
    duracion_minutos: number;
    validez_meses: number;
  };
}

interface Props {
  theme: SocietyTheme;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExamsCard({ theme }: Props) {
  const [tab, setTab] = useState<'pendientes' | 'aprobados'>('pendientes');
  const [asignaciones, setAsignaciones] = useState<Asignacion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeAsignacionId, setActiveAsignacionId] = useState<string | null>(null);

  const loadAsignaciones = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('asignaciones_examenes')
      .select('*, examenes(nombre, descripcion, duracion_minutos, validez_meses)')
      .order('created_at', { ascending: false });
    setAsignaciones((data as Asignacion[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadAsignaciones(); }, []);

  const pendientes = asignaciones.filter((a) => a.estado === 'pendiente' || a.estado === 'suspendido');
  const aprobados  = asignaciones.filter((a) => a.estado === 'aprobado');
  const displayed  = tab === 'pendientes' ? pendientes : aprobados;

  const sinIntentos = (a: Asignacion) =>
    a.intentos_permitidos !== null && a.intentos_realizados >= a.intentos_permitidos;

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${theme.primary}12` }}>
            <ClipboardCheck size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>Mis Exámenes</h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {loading ? 'Cargando...' : `${asignaciones.length} examen${asignaciones.length !== 1 ? 'es' : ''} asignado${asignaciones.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
          {(['pendientes', 'aprobados'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="flex-1 py-2 rounded-lg text-xs font-semibold capitalize cursor-pointer transition-all duration-200"
              style={{
                backgroundColor: tab === t ? theme.primary : 'transparent',
                color: tab === t ? '#FFFFFF' : theme.textSecondary,
              }}
            >
              {t === 'pendientes' ? `Pendientes (${pendientes.length})` : `Aprobados (${aprobados.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
            <RefreshCw size={20} className="animate-spin mb-2" style={{ color: theme.primary }} />
            <p className="text-xs" style={{ color: theme.textSecondary }}>Cargando exámenes...</p>
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 rounded-xl" style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}` }}>
            <ClipboardCheck size={28} className="mb-2" style={{ color: `${theme.primary}50` }} />
            <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>
              {tab === 'pendientes' ? 'No tienes exámenes pendientes' : 'Aún no has aprobado ningún examen'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayed.map((a) => {
              const agotado = sinIntentos(a) && a.estado !== 'aprobado';
              const isAprobado = a.estado === 'aprobado';
              const isSuspendido = a.estado === 'suspendido';

              return (
                <div
                  key={a.id}
                  className="rounded-xl overflow-hidden transition-all duration-200 hover:shadow-md"
                  style={{
                    backgroundColor: isAprobado ? '#F0FDF4' : isSuspendido ? '#FEF9F0' : theme.bgCard,
                    border: `1px solid ${isAprobado ? '#BBF7D0' : isSuspendido ? '#FDE68A' : theme.border}`,
                  }}
                >
                  <div className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: isAprobado ? '#DCFCE7' : isSuspendido ? '#FEF3C7' : `${theme.primary}12` }}
                      >
                        {isAprobado
                          ? <Award size={16} style={{ color: '#16A34A' }} />
                          : isSuspendido
                            ? <AlertCircle size={16} style={{ color: '#D97706' }} />
                            : <ClipboardCheck size={16} style={{ color: theme.primary }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold leading-tight mb-0.5" style={{ color: theme.textPrimary }}>
                          {a.examenes?.nombre ?? 'Examen'}
                        </h4>
                        {a.examenes?.descripcion && (
                          <p className="text-xs line-clamp-1" style={{ color: theme.textSecondary }}>{a.examenes.descripcion}</p>
                        )}
                      </div>
                      {isAprobado && a.nota !== null && (
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: '#16A34A' }}>
                          {Number(a.nota).toFixed(2)}
                        </span>
                      )}
                      {isSuspendido && a.nota !== null && (
                        <span className="text-sm font-bold flex-shrink-0" style={{ color: '#DC2626' }}>
                          {Number(a.nota).toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-3" style={{ borderTop: `1px solid ${isAprobado ? '#BBF7D0' : isSuspendido ? '#FDE68A' : theme.border}` }}>
                      <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textSecondary }}>
                        <Timer size={11} /> {a.examenes?.duracion_minutos ?? '?'} min
                      </span>
                      {!isAprobado && (
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: agotado ? '#DC2626' : theme.textSecondary }}>
                          <RefreshCw size={11} />
                          {a.intentos_realizados}/{a.intentos_permitidos ?? '∞'} intentos
                        </span>
                      )}
                      {isAprobado && a.fecha_caducidad_certificado && (
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textSecondary }}>
                          <Clock size={11} /> Caduca {new Date(a.fecha_caducidad_certificado).toLocaleDateString('es-ES')}
                        </span>
                      )}
                      {a.fecha_realizacion && (
                        <span className="text-xs" style={{ color: theme.textSecondary }}>
                          Realizado {new Date(a.fecha_realizacion).toLocaleDateString('es-ES')}
                        </span>
                      )}

                      {/* Action button */}
                      {!isAprobado && (
                        <div className="ml-auto">
                          {agotado ? (
                            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#F1F5F9', color: '#94A3B8', border: '1px solid #E2E8F0' }}>
                              <Ban size={12} /> Sin intentos
                            </span>
                          ) : (
                            <button
                              onClick={() => setActiveAsignacionId(a.id)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white cursor-pointer transition-all duration-200"
                              style={{ backgroundColor: isSuspendido ? '#EA580C' : theme.primary, boxShadow: `0 2px 8px ${theme.primary}30` }}
                            >
                              <Play size={12} />
                              {isSuspendido ? 'Reintentar' : 'Realizar ahora'}
                            </button>
                          )}
                        </div>
                      )}

                      {isAprobado && (
                        <div className="ml-auto">
                          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium" style={{ backgroundColor: '#DCFCE7', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            <CheckCircle2 size={12} /> Aprobado
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Exam execution modal */}
      {activeAsignacionId && (
        <ExamenEjecucion
          asignacionId={activeAsignacionId}
          theme={theme}
          onClose={() => setActiveAsignacionId(null)}
          onComplete={() => { setActiveAsignacionId(null); loadAsignaciones(); }}
        />
      )}
    </>
  );
}
