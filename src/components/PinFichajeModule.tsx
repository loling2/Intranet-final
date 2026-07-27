import { useState, useEffect, useCallback, useRef } from 'react';
import { Delete, Check, Fingerprint, LogIn, LogOut } from 'lucide-react';
import { supabase } from '../supabaseClient';

const PIN_LENGTH = 6;
const RESET_DELAY_MS = 2500;

type Status = 'idle' | 'submitting' | 'success' | 'error';

export default function PinFichajeModule({ onClose }: { onClose?: () => void } = {}) {
  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [lastEvent, setLastEvent] = useState<'entrada' | 'salida' | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const reset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPin('');
    setStatus('idle');
    setMessage('');
    setLastEvent(null);
  }, []);

  useEffect(() => () => { if (resetTimer.current) clearTimeout(resetTimer.current); }, []);

  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const tablet = /iPad|Android(?!.*Mobile)/i.test(ua);
    const type = tablet ? 'Tablet' : mobile ? 'Móvil' : 'Escritorio';
    const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : /Edge/i.test(ua) ? 'Edge' : 'Navegador';
    const os = /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Android/i.test(ua) ? 'Android' : /iOS|iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Sistema';
    return `${type} · ${browser} · ${os}`;
  };

  const submit = useCallback(async (pinValue: string) => {
    if (!pinValue) return;
    setStatus('submitting');
    setMessage('');
    try {
      const { data, error: rpcErr } = await supabase.rpc('validate_vehicle_pin', { p_pin: pinValue });
      if (rpcErr || !data?.[0]) {
        setStatus('error');
        setMessage('PIN incorrecto. Inténtalo de nuevo.');
        resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
        return;
      }
      const usuario = data[0] as { id: string; nombre: string };

      const today = new Date().toISOString().split('T')[0];
      const { data: todayLogs } = await supabase
        .from('fichajes')
        .select('tipo_evento, timestamp')
        .eq('nombre_empleado', usuario.nombre)
        .eq('fecha', today)
        .order('timestamp', { ascending: true });

      const logs = (todayLogs ?? []) as { tipo_evento: string; timestamp: string }[];
      const lastEvent = logs.length > 0 ? logs[logs.length - 1].tipo_evento : null;

      let tipo: 'entrada' | 'salida';
      if (!lastEvent || lastEvent === 'salida') {
        tipo = 'entrada';
      } else {
        tipo = 'salida';
      }

      const { data: emp } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', usuario.id)
        .maybeSingle();

      const { error: insErr } = await supabase.from('fichajes').insert({
        empleado_id: emp?.id ?? null,
        nombre_empleado: usuario.nombre,
        fecha: today,
        timestamp: new Date().toISOString(),
        tipo_evento: tipo,
        metodo: 'pin',
        user_agent: navigator.userAgent,
        dispositivo: getDeviceInfo(),
        es_manual: false,
      });
      if (insErr) throw new Error(insErr.message);

      setLastEvent(tipo);
      setStatus('success');
      setMessage(`¡Fichaje registrado, ${usuario.nombre}!`);
      resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
    } catch (err: unknown) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : 'Error al registrar el fichaje');
      resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
    }
  }, [reset]);

  const appendDigit = (d: string) => {
    if (status === 'submitting' || status === 'success') return;
    if (status === 'error') { setPin(d); setStatus('idle'); setMessage(''); return; }
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + d;
      if (next.length === PIN_LENGTH) {
        submit(next);
      }
      return next;
    });
  };

  const deleteDigit = () => {
    if (status === 'submitting' || status === 'success') return;
    if (status === 'error') { reset(); return; }
    setPin((prev) => prev.slice(0, -1));
  };

  const confirm = () => {
    if (pin.length < 4) return;
    submit(pin);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        appendDigit(e.key);
      } else if (e.key === 'Backspace') {
        deleteDigit();
      } else if (e.key === 'Enter') {
        confirm();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const displayDots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length);

  return (
    <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center px-4 py-6 overflow-y-auto" style={{ backgroundColor: '#000000' }}>
      {/* Close button (hidden in kiosk mode) */}
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#FFFFFF' }}
          title="Salir"
        >
          <span className="text-lg font-light">×</span>
        </button>
      )}

      {/* Header clock */}
      <div className="text-center mb-4 sm:mb-6 md:mb-8 select-none">
        <div className="flex items-center justify-center gap-2 sm:gap-3 mb-2">
          <Fingerprint size={18} style={{ color: '#22D3EE' }} />
          <h1 className="text-xs sm:text-lg font-semibold uppercase tracking-[0.2em] sm:tracking-[0.3em]" style={{ color: '#E2E8F0' }}>
            Control de Presencia
          </h1>
        </div>
        <p className="text-4xl sm:text-5xl md:text-6xl font-mono font-bold tracking-wider" style={{ color: '#FFFFFF', lineHeight: 1.1 }}>
          {timeStr}
        </p>
        <p className="text-xs sm:text-sm mt-1 sm:mt-2 capitalize" style={{ color: '#64748B' }}>
          {dateStr}
        </p>
      </div>

      {/* PIN display */}
      <div className="mb-4 sm:mb-6 md:mb-8 select-none">
        <div className="flex gap-3 sm:gap-4 justify-center">
          {displayDots.map((filled, i) => (
            <div
              key={i}
              className="w-4 h-4 sm:w-5 sm:h-5 rounded-full transition-all duration-150"
              style={{
                backgroundColor: filled ? '#22D3EE' : 'rgba(255,255,255,0.15)',
                boxShadow: filled ? '0 0 12px rgba(34,211,238,0.6)' : 'none',
                transform: filled ? 'scale(1.15)' : 'scale(1)',
              }}
            />
          ))}
        </div>
        <p className="text-center text-xs mt-2 sm:mt-3 uppercase tracking-widest" style={{ color: '#475569' }}>
          Introduce tu PIN
        </p>
      </div>

      {/* Status message */}
      <div className="h-12 sm:h-16 mb-4 sm:mb-6 flex items-center justify-center">
        {status === 'success' && (
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl animate-[fadeIn_0.2s_ease-out]" style={{ backgroundColor: 'rgba(22,163,74,0.15)', border: '1px solid rgba(22,163,74,0.4)' }}>
            {lastEvent === 'entrada' ? <LogIn size={20} style={{ color: '#22C55E' }} /> : <LogOut size={20} style={{ color: '#22C55E' }} />}
            <span className="text-base font-semibold" style={{ color: '#22C55E' }}>{message}</span>
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-3 px-6 py-3 rounded-2xl animate-[fadeIn_0.2s_ease-out]" style={{ backgroundColor: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)' }}>
            <span className="text-base font-semibold" style={{ color: '#EF4444' }}>{message}</span>
          </div>
        )}
        {status === 'submitting' && (
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'rgba(34,211,238,0.2)', borderTopColor: '#22D3EE' }} />
            <span className="text-sm" style={{ color: '#64748B' }}>Validando...</span>
          </div>
        )}
      </div>

      {/* Numeric keypad 3x4 */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <KeypadButton key={d} label={d} onClick={() => appendDigit(d)} disabled={status === 'submitting' || status === 'success'} />
        ))}
        <KeypadButton
          label=""
          icon={<Delete size={20} />}
          iconDesktop={<Delete size={26} />}
          onClick={deleteDigit}
          disabled={status === 'submitting' || status === 'success'}
          variant="secondary"
        />
        <KeypadButton
          label="0"
          onClick={() => appendDigit('0')}
          disabled={status === 'submitting' || status === 'success'}
        />
        <KeypadButton
          label=""
          icon={<Check size={20} />}
          iconDesktop={<Check size={26} />}
          onClick={confirm}
          disabled={status === 'submitting' || status === 'success' || pin.length < 4}
          variant="confirm"
        />
      </div>

      {/* Footer hint */}
      <p className="absolute bottom-3 sm:bottom-6 text-center text-[10px] sm:text-xs" style={{ color: '#334155' }}>
        Teclado físico habilitado{onClose ? ' · ESC para salir' : ''}
      </p>
    </div>
  );
}

function KeypadButton({
  label,
  icon,
  iconDesktop,
  onClick,
  disabled,
  variant = 'default',
}: {
  label: string;
  icon?: React.ReactNode;
  iconDesktop?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'secondary' | 'confirm';
}) {
  const base = 'w-14 h-14 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-150 select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed';
  let style: React.CSSProperties;
  if (variant === 'confirm') {
    style = { backgroundColor: 'rgba(22,163,74,0.18)', border: '1px solid rgba(22,163,74,0.5)', color: '#22C55E' };
  } else if (variant === 'secondary') {
    style = { backgroundColor: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#94A3B8' };
  } else {
    style = { backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF' };
  }
  return (
    <button
      className={base}
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? (
        <>
          <span className="sm:hidden">{icon}</span>
          <span className="hidden sm:flex">{iconDesktop ?? icon}</span>
        </>
      ) : (
        <span className="text-2xl sm:text-3xl font-light">{label}</span>
      )}
    </button>
  );
}
