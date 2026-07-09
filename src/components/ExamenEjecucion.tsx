import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Play, CheckCircle2, XCircle, AlertCircle, ChevronLeft, ChevronRight,
  Clock, ClipboardCheck, RefreshCw, Award,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { SocietyTheme } from '../themes';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Pregunta {
  id: string;
  texto: string;
  opcion_a: string;
  opcion_b: string;
  opcion_c: string;
  opcion_d: string;
  respuesta_correcta: 'a' | 'b' | 'c' | 'd';
}

interface ShuffledPregunta extends Pregunta {
  shuffledOptions: { label: string; text: string; originalKey: 'a' | 'b' | 'c' | 'd' }[];
  correctShuffledIndex: number;
}

interface Asignacion {
  id: string;
  examen_id: string;
  estado: string;
  intentos_realizados: number;
  intentos_permitidos: number | null;
}

interface ExamenInfo {
  id: string;
  nombre: string;
  descripcion: string | null;
  duracion_minutos: number;
  validez_meses: number;
  ratio_penalizacion: number;
}

interface Props {
  asignacionId: string;
  theme: SocietyTheme;
  onClose: () => void;
  onComplete: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExamenEjecucion({ asignacionId, theme, onClose, onComplete }: Props) {
  const [phase, setPhase] = useState<'loading' | 'preview' | 'running' | 'result' | 'error'>('loading');
  const [examen, setExamen] = useState<ExamenInfo | null>(null);
  const [asignacion, setAsignacion] = useState<Asignacion | null>(null);
  const [preguntas, setPreguntas] = useState<ShuffledPregunta[]>([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({}); // pregunta.id → shuffled option index
  const [timeLeft, setTimeLeft] = useState(0);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ nota: number; aciertos: number; errores: number; sinResponder: number; aprobado: boolean } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load data ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: asig } = await supabase
        .from('asignaciones_examenes')
        .select('*')
        .eq('id', asignacionId)
        .maybeSingle();

      if (!asig) { setErrorMsg('No se encontró la asignación.'); setPhase('error'); return; }
      setAsignacion(asig as Asignacion);

      const sinIntentos = asig.intentos_permitidos !== null && asig.intentos_realizados >= asig.intentos_permitidos;
      if (sinIntentos && asig.estado !== 'aprobado') {
        setErrorMsg('No te quedan intentos disponibles para este examen.');
        setPhase('error');
        return;
      }

      const { data: ex } = await supabase.from('examenes').select('*').eq('id', asig.examen_id).maybeSingle();
      if (!ex) { setErrorMsg('Examen no encontrado.'); setPhase('error'); return; }
      setExamen(ex as ExamenInfo);

      const { data: pqs } = await supabase.from('preguntas').select('*').eq('examen_id', asig.examen_id);
      if (!pqs || pqs.length === 0) { setErrorMsg('Este examen no tiene preguntas todavía.'); setPhase('error'); return; }

      // Shuffle questions order
      const shuffled = shuffleArray(pqs as Pregunta[]).map((p): ShuffledPregunta => {
        const opts: { label: string; text: string; originalKey: 'a' | 'b' | 'c' | 'd' }[] = shuffleArray([
          { label: 'A', text: p.opcion_a, originalKey: 'a' as const },
          { label: 'B', text: p.opcion_b, originalKey: 'b' as const },
          { label: 'C', text: p.opcion_c, originalKey: 'c' as const },
          { label: 'D', text: p.opcion_d, originalKey: 'd' as const },
        ]);
        const correctIdx = opts.findIndex((o) => o.originalKey === p.respuesta_correcta);
        return { ...p, shuffledOptions: opts, correctShuffledIndex: correctIdx };
      });

      setPreguntas(shuffled);
      setTimeLeft(ex.duracion_minutos * 60);
      setPhase('preview');
    };
    load();
  }, [asignacionId]);

  // ── Timer ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'running') return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current!);
          handleSubmit(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Submit exam ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (!examen || !asignacion) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setSaving(true);

    // Calculate score
    let aciertos = 0;
    let errores = 0;
    let sinResponder = 0;

    preguntas.forEach((p) => {
      const selectedIdx = answers[p.id];
      if (selectedIdx === undefined || selectedIdx === null) {
        sinResponder++;
      } else if (selectedIdx === p.correctShuffledIndex) {
        aciertos++;
      } else {
        errores++;
      }
    });

    const rawNota = aciertos - errores / examen.ratio_penalizacion;
    const nota = Math.max(0, rawNota);
    const aprobado = nota >= 5;

    // Calculate certificate expiry if approved
    let fechaCaducidad: string | null = null;
    if (aprobado && examen.validez_meses > 0) {
      const d = new Date();
      d.setMonth(d.getMonth() + examen.validez_meses);
      fechaCaducidad = d.toISOString().split('T')[0];
    }

    const nuevosIntentos = asignacion.intentos_realizados + 1;

    await supabase.from('asignaciones_examenes').update({
      estado: aprobado ? 'aprobado' : 'suspendido',
      nota: Number(nota.toFixed(2)),
      fecha_realizacion: new Date().toISOString(),
      fecha_caducidad_certificado: fechaCaducidad,
      intentos_realizados: nuevosIntentos,
    }).eq('id', asignacionId);

    // Create certificate record if approved
    if (aprobado) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await supabase.from('certificados_examenes').insert({
          usuario_id: session.user.id,
          examen_id: examen.id,
        });
      }
    }

    setResult({ nota: Number(nota.toFixed(2)), aciertos, errores, sinResponder, aprobado });
    setSaving(false);
    setPhase('result');
  }, [examen, asignacion, preguntas, answers, asignacionId]);

  const timerColor = timeLeft <= 60 ? '#DC2626' : timeLeft <= 300 ? '#EA580C' : theme.primary;
  const progress = preguntas.length > 0 ? ((current + 1) / preguntas.length) * 100 : 0;
  const answeredCount = Object.keys(answers).length;

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div
        className="rounded-2xl w-full max-w-2xl mx-4 max-h-[92vh] flex flex-col overflow-hidden"
        style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, boxShadow: '0 24px 64px rgba(0,0,0,0.2)' }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              <ClipboardCheck size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm leading-tight">
                {examen?.nombre ?? 'Cargando...'}
              </h3>
              {phase === 'running' && (
                <p className="text-white/70 text-xs">Pregunta {current + 1} de {preguntas.length}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {phase === 'running' && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <Clock size={13} className="text-white" />
                <span className="text-white font-mono text-sm font-bold" style={{ color: timeLeft <= 60 ? '#FCA5A5' : 'white' }}>
                  {formatTime(timeLeft)}
                </span>
              </div>
            )}
            {(phase === 'preview' || phase === 'error' || phase === 'result') && (
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <X size={16} className="text-white" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Loading */}
          {phase === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw size={28} className="animate-spin mb-4" style={{ color: theme.primary }} />
              <p className="text-sm font-medium" style={{ color: theme.textPrimary }}>Cargando examen...</p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#FEF2F2' }}>
                <AlertCircle size={28} style={{ color: '#DC2626' }} />
              </div>
              <p className="text-base font-semibold text-[#1E293B] mb-2">No se puede iniciar el examen</p>
              <p className="text-sm text-[#64748B] mb-6">{errorMsg}</p>
              <button onClick={onClose} className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer" style={{ backgroundColor: theme.primary }}>Cerrar</button>
            </div>
          )}

          {/* Preview */}
          {phase === 'preview' && examen && (
            <div className="flex flex-col items-center text-center py-6">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-5" style={{ backgroundColor: `${theme.primary}12` }}>
                <ClipboardCheck size={36} style={{ color: theme.primary }} />
              </div>
              <h2 className="text-lg font-bold mb-1.5" style={{ color: theme.textPrimary }}>{examen.nombre}</h2>
              {examen.descripcion && <p className="text-sm mb-5 max-w-md" style={{ color: theme.textSecondary }}>{examen.descripcion}</p>}

              <div className="w-full max-w-xs rounded-2xl p-4 mb-6 text-left space-y-3" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: theme.textSecondary }}>Duración</span>
                  <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>{examen.duracion_minutos} minutos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: theme.textSecondary }}>Preguntas</span>
                  <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>{preguntas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: theme.textSecondary }}>Nota mínima para aprobar</span>
                  <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>5 / {preguntas.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: theme.textSecondary }}>Penalización</span>
                  <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>-1/{examen.ratio_penalizacion} por error</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-xs" style={{ color: theme.textSecondary }}>Certificado válido</span>
                  <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>{examen.validez_meses} meses</span>
                </div>
                {asignacion && (
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: theme.textSecondary }}>Intentos</span>
                    <span className="text-xs font-semibold" style={{ color: theme.textPrimary }}>
                      {asignacion.intentos_realizados + 1}/{asignacion.intentos_permitidos ?? '∞'}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-6" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <AlertCircle size={14} style={{ color: '#EA580C' }} />
                <span className="text-xs font-medium" style={{ color: '#C2410C' }}>
                  Las preguntas y opciones se presentan en orden aleatorio
                </span>
              </div>

              <button
                onClick={() => setPhase('running')}
                className="flex items-center gap-2 px-10 py-3.5 rounded-xl text-white font-semibold text-sm cursor-pointer transition-all duration-300"
                style={{ backgroundColor: theme.primary, boxShadow: `0 4px 18px ${theme.primary}40` }}
              >
                <Play size={16} />
                Comenzar examen
              </button>
            </div>
          )}

          {/* Running — question screen */}
          {phase === 'running' && preguntas.length > 0 && (
            <div>
              {/* Progress bar */}
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: theme.textSecondary }}>
                  Pregunta {current + 1} de {preguntas.length}
                </span>
                <span className="text-xs font-medium" style={{ color: timerColor }}>
                  <Clock size={11} className="inline mr-1" />{formatTime(timeLeft)}
                </span>
              </div>
              <div className="h-1.5 rounded-full mb-1.5" style={{ backgroundColor: `${theme.primary}15` }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: theme.primary }} />
              </div>
              <div className="flex items-center justify-between mb-5">
                <span className="text-xs" style={{ color: theme.textSecondary }}>{answeredCount} respondida{answeredCount !== 1 ? 's' : ''}</span>
                <span className="text-xs" style={{ color: theme.textSecondary }}>{preguntas.length - answeredCount} sin responder</span>
              </div>

              <h3 className="text-base font-semibold mb-5 leading-relaxed" style={{ color: theme.textPrimary }}>
                {preguntas[current].texto}
              </h3>

              <div className="space-y-2.5 mb-8">
                {preguntas[current].shuffledOptions.map((opt, i) => {
                  const isSelected = answers[preguntas[current].id] === i;
                  return (
                    <button
                      key={i}
                      onClick={() => setAnswers((prev) => ({ ...prev, [preguntas[current].id]: i }))}
                      className="w-full text-left px-4 py-3.5 rounded-xl text-sm transition-all duration-200 cursor-pointer"
                      style={{
                        backgroundColor: isSelected ? theme.primaryLight : theme.bg,
                        border: `2px solid ${isSelected ? theme.primary : theme.border}`,
                        color: isSelected ? theme.primary : theme.textPrimary,
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all duration-200"
                          style={{
                            backgroundColor: isSelected ? theme.primary : 'transparent',
                            color: isSelected ? '#FFFFFF' : theme.textSecondary,
                            border: `2px solid ${isSelected ? theme.primary : theme.border}`,
                          }}
                        >
                          {opt.label}
                        </div>
                        <span className="flex-1">{opt.text}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center justify-between">
                <button
                  onClick={() => setCurrent((p) => Math.max(0, p - 1))}
                  disabled={current === 0}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                  style={{ backgroundColor: theme.primaryLight, color: theme.primary, border: `1px solid ${theme.border}` }}
                >
                  <ChevronLeft size={16} /> Anterior
                </button>

                {current < preguntas.length - 1 ? (
                  <button
                    onClick={() => setCurrent((p) => p + 1)}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-all duration-200"
                    style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}
                  >
                    Siguiente <ChevronRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const sinResponder = preguntas.length - answeredCount;
                      if (sinResponder > 0 && !confirm(`Tienes ${sinResponder} pregunta${sinResponder > 1 ? 's' : ''} sin responder. ¿Enviar igualmente?`)) return;
                      handleSubmit();
                    }}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60 transition-all duration-200"
                    style={{ backgroundColor: theme.primary, color: '#FFFFFF', boxShadow: `0 4px 14px ${theme.primary}40` }}
                  >
                    {saving ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={16} />}
                    Enviar examen
                  </button>
                )}
              </div>

              {/* Question dots navigator */}
              <div className="flex flex-wrap gap-1.5 mt-6 justify-center">
                {preguntas.map((p, idx) => (
                  <button
                    key={p.id}
                    onClick={() => setCurrent(idx)}
                    className="w-7 h-7 rounded-lg text-xs font-bold cursor-pointer transition-all duration-200"
                    style={{
                      backgroundColor: idx === current ? theme.primary : answers[p.id] !== undefined ? `${theme.primary}25` : '#F1F5F9',
                      color: idx === current ? '#FFFFFF' : answers[p.id] !== undefined ? theme.primary : '#94A3B8',
                      border: `1.5px solid ${idx === current ? theme.primary : answers[p.id] !== undefined ? `${theme.primary}50` : '#E2E8F0'}`,
                    }}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Result */}
          {phase === 'result' && result && examen && (
            <div className="flex flex-col items-center text-center py-4">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center mb-5"
                style={{
                  backgroundColor: result.aprobado ? '#F0FDF4' : '#FEF2F2',
                  border: `4px solid ${result.aprobado ? '#22C55E' : '#EF4444'}`,
                }}
              >
                {result.aprobado
                  ? <CheckCircle2 size={40} style={{ color: '#22C55E' }} />
                  : <XCircle size={40} style={{ color: '#EF4444' }} />}
              </div>

              <h2 className="text-xl font-bold mb-1" style={{ color: theme.textPrimary }}>
                {result.aprobado ? '¡Enhorabuena!' : 'Examen no superado'}
              </h2>
              <p className="text-sm mb-5" style={{ color: theme.textSecondary }}>
                {result.aprobado
                  ? `Has aprobado. El certificado será válido ${examen.validez_meses} meses.`
                  : 'No has alcanzado la puntuación mínima de 5.'}
              </p>

              <div
                className="w-full max-w-xs rounded-2xl p-5 mb-5"
                style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}
              >
                <p className="text-4xl font-bold mb-1" style={{ color: result.aprobado ? '#16A34A' : '#DC2626' }}>
                  {result.nota.toFixed(2)}
                </p>
                <p className="text-xs mb-4" style={{ color: theme.textSecondary }}>Nota final (mínimo 5)</p>

                <div className="space-y-2 text-left">
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textSecondary }}>
                      <CheckCircle2 size={12} style={{ color: '#16A34A' }} /> Aciertos
                    </span>
                    <span className="text-xs font-bold text-[#16A34A]">{result.aciertos}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textSecondary }}>
                      <XCircle size={12} style={{ color: '#DC2626' }} /> Errores
                    </span>
                    <span className="text-xs font-bold text-[#DC2626]">{result.errores}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5 text-xs" style={{ color: theme.textSecondary }}>
                      <AlertCircle size={12} style={{ color: '#94A3B8' }} /> Sin responder
                    </span>
                    <span className="text-xs font-bold text-[#94A3B8]">{result.sinResponder}</span>
                  </div>
                  <div className="flex justify-between pt-2" style={{ borderTop: `1px solid ${theme.border}` }}>
                    <span className="text-xs" style={{ color: theme.textSecondary }}>Fórmula</span>
                    <span className="text-xs font-medium" style={{ color: theme.textPrimary }}>
                      {result.aciertos} − {result.errores}/{examen.ratio_penalizacion} = {result.nota.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {result.aprobado && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl mb-5" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                  <Award size={14} style={{ color: '#16A34A' }} />
                  <span className="text-xs font-medium" style={{ color: '#15803D' }}>Certificado generado correctamente</span>
                </div>
              )}

              <button
                onClick={onComplete}
                className="px-10 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-300"
                style={{ backgroundColor: theme.primary, boxShadow: `0 4px 14px ${theme.primary}40` }}
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
