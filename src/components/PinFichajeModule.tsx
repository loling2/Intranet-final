import { useState, useEffect, useCallback } from 'react';
import { Delete, Fingerprint, LogIn, LogOut, MapPin, CircleAlert as AlertCircle, Loader as Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

type Screen = 'pin' | 'action' | 'result';
type ActionResult = { ok: boolean; message: string; type?: string };

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export default function PinFichajeModule() {
  const [screen, setScreen] = useState<Screen>('pin');
  const [pin, setPin] = useState('');
  const [employee, setEmployee] = useState<{ id: string; nombre: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'idle' | 'searching' | 'ok' | 'denied' | 'unsupported'>('idle');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const now = useClock();

  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const getLocation = useCallback(() => {
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!navigator.geolocation) { setGpsStatus('unsupported'); resolve(null); return; }
      setGpsStatus('searching');
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setGpsStatus('ok'); resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
        () => { setGpsStatus('denied'); resolve(null); },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }, []);

  async function submitPin() {
    if (pin.length < 4) return;
    setLoading(true); setError('');
    const { data, error: rpcErr } = await supabase.rpc('verify_employee_pin', { p_pin: pin });
    setLoading(false);
    if (rpcErr || !data || data.length === 0) { setError('PIN no válido'); setPin(''); return; }
    const emp = data[0] as { id: string; nombre: string };
    setEmployee({ id: emp.id, nombre: emp.nombre });
    setScreen('action');
    setPin('');
  }

  async function doFichaje(tipo: 'entrada' | 'salida') {
    if (!employee) return;
    setLoading(true); setError('');
    let coords = gpsCoords;
    if (gpsStatus !== 'ok') coords = await getLocation();
    const { data, error: rpcErr } = await supabase.rpc('register_fichaje', {
      p_empleado_id: employee.id,
      p_tipo: tipo,
      p_lat: coords?.lat ?? null,
      p_lng: coords?.lng ?? null,
    });
    setLoading(false);
    if (rpcErr || !data || data.length === 0) {
      setResult({ ok: false, message: 'Error al registrar el fichaje' });
    } else {
      const r = data[0] as { ok: boolean; message: string; tipo: string };
      setResult({ ok: r.ok, message: r.message, type: r.tipo });
    }
    setScreen('result');
  }

  function reset() {
    setScreen('pin'); setPin(''); setEmployee(null); setError(''); setResult(null);
  }

  // ── PIN screen ──
  if (screen === 'pin') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F0FDF4 100%)' }}>

        {/* Decorative SVG backgrounds */}
        <DecorBackground />

        {/* Main card */}
        <div className="relative z-10 flex flex-col items-center gap-6 px-6">
          {/* Clock */}
          <div className="text-center">
            <p className="text-6xl sm:text-7xl font-bold tracking-tight tabular-nums" style={{ color: '#0F172A' }}>
              {timeStr}
            </p>
            <p className="text-base sm:text-lg mt-1 capitalize" style={{ color: '#475569' }}>
              {dateStr}
            </p>
          </div>

          {/* PIN dots */}
          <div className="flex items-center gap-4">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="w-4 h-4 rounded-full transition-all duration-200"
                style={{
                  backgroundColor: pin.length > i ? '#1D4ED8' : '#CBD5E1',
                  transform: pin.length > i ? 'scale(1.15)' : 'scale(1)',
                }} />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm" style={{ color: '#DC2626' }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(n => (
              <NumpadKey key={n} label={n} onClick={() => { if (pin.length < 4) setPin(pin + n); }} />
            ))}
            <NumpadKey label="" icon={<Delete size={22} />} onClick={() => setPin(pin.slice(0, -1))} variant="secondary" />
            <NumpadKey label="0" onClick={() => { if (pin.length < 4) setPin(pin + '0'); }} />
            <NumpadKey label="" icon={loading ? <Loader2 size={22} className="animate-spin" /> : <Fingerprint size={22} />}
              onClick={submitPin} variant="confirm" disabled={loading || pin.length < 4} />
          </div>

          {/* GPS status */}
          {gpsStatus === 'searching' && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#64748B' }}>
              <Loader2 size={12} className="animate-spin" /> Obteniendo ubicación...
            </div>
          )}
          {(gpsStatus === 'denied' || gpsStatus === 'unsupported') && (
            <button onClick={getLocation} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: '#B45309' }}>
              <MapPin size={12} /> Ubicación no disponible — pulsar para reintentar
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Action screen ──
  if (screen === 'action' && employee) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F0FDF4 100%)' }}>
        <DecorBackground />
        <div className="relative z-10 flex flex-col items-center gap-8 px-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: '#1D4ED8' }}>
              <Fingerprint size={28} style={{ color: '#FFFFFF' }} />
            </div>
            <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>Hola, {employee.nombre}</p>
            <p className="text-sm mt-1" style={{ color: '#64748B' }}>¿Qué quieres hacer?</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={() => doFichaje('entrada')} disabled={loading}
              className="flex items-center gap-3 px-8 py-5 rounded-2xl text-lg font-semibold cursor-pointer disabled:opacity-50 transition-all hover:scale-105"
              style={{ backgroundColor: '#16A34A', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(22,163,74,0.3)' }}>
              {loading ? <Loader2 size={22} className="animate-spin" /> : <LogIn size={22} />}
              Fichar entrada
            </button>
            <button onClick={() => doFichaje('salida')} disabled={loading}
              className="flex items-center gap-3 px-8 py-5 rounded-2xl text-lg font-semibold cursor-pointer disabled:opacity-50 transition-all hover:scale-105"
              style={{ backgroundColor: '#DC2626', color: '#FFFFFF', boxShadow: '0 4px 14px rgba(220,38,38,0.3)' }}>
              {loading ? <Loader2 size={22} className="animate-spin" /> : <LogOut size={22} />}
              Fichar salida
            </button>
          </div>
          <button onClick={reset} className="text-sm cursor-pointer" style={{ color: '#64748B' }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  // ── Result screen ──
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 40%, #F0FDF4 100%)' }}>
      <DecorBackground />
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ backgroundColor: result?.ok ? '#16A34A' : '#DC2626' }}>
          {result?.ok ? <LogIn size={36} style={{ color: '#FFFFFF' }} /> : <AlertCircle size={36} style={{ color: '#FFFFFF' }} />}
        </div>
        <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>
          {result?.ok ? 'Fichaje registrado' : 'Error'}
        </p>
        <p className="text-base" style={{ color: '#64748B' }}>{result?.message}</p>
        <button onClick={reset}
          className="mt-4 px-8 py-3 rounded-xl text-sm font-semibold cursor-pointer transition-all hover:scale-105"
          style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}>
          Volver al inicio
        </button>
      </div>
    </div>
  );
}

// ── Numpad key ──────────────────────────────────────────────────────────────

function NumpadKey({
  label, icon, onClick, disabled, variant = 'default',
}: {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'secondary' | 'confirm';
}) {
  let style: React.CSSProperties;
  if (variant === 'confirm') {
    style = { backgroundColor: '#1D4ED8', border: '1px solid #1E40AF', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(29,78,216,0.3)' };
  } else if (variant === 'secondary') {
    style = { backgroundColor: 'rgba(255,255,255,0.7)', border: '1px solid #E2E8F0', color: '#475569' };
  } else {
    style = { backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#0F172A', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
  }
  return (
    <button
      className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-100 select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      {icon ? icon : <span className="text-2xl font-semibold">{label}</span>}
    </button>
  );
}

// ── Decorative background ───────────────────────────────────────────────────

function DecorBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Left: green leaves */}
      <svg className="absolute -left-10 top-0 h-full w-64 opacity-30" viewBox="0 0 200 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M-20 100 Q60 50 80 150 Q60 250 -20 200 Z" fill="#86EFAC" />
        <path d="M-20 250 Q80 200 100 320 Q80 400 -20 350 Z" fill="#4ADE80" />
        <path d="M-20 400 Q60 380 70 480 Q50 550 -20 500 Z" fill="#22C55E" />
        <path d="M-20 50 Q40 20 50 80 Q30 120 -20 100 Z" fill="#BBF7D0" />
      </svg>

      {/* Right: blue wave shapes */}
      <svg className="absolute -right-10 top-0 h-full w-72 opacity-25" viewBox="0 0 200 600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M220 0 Q120 80 180 180 Q220 250 140 300 Q80 350 220 400 L220 0 Z" fill="#BFDBFE" />
        <path d="M220 300 Q140 350 180 450 Q220 520 160 600 L220 600 Z" fill="#60A5FA" />
        <path d="M220 100 Q160 150 200 220 Q230 280 170 320 L220 320 Z" fill="#3B82F6" />
      </svg>

      {/* Bottom-right: Canary Islands map silhouette */}
      <svg className="absolute bottom-4 right-4 w-32 h-32 opacity-20" viewBox="0 0 200 150" fill="none" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="40" cy="75" rx="18" ry="10" fill="#1E3A5F" />
        <ellipse cx="80" cy="80" rx="14" ry="8" fill="#1E3A5F" />
        <circle cx="110" cy="85" r="7" fill="#1E3A5F" />
        <circle cx="130" cy="90" r="5" fill="#1E3A5F" />
        <circle cx="145" cy="93" r="4" fill="#1E3A5F" />
        <circle cx="160" cy="96" r="6" fill="#1E3A5F" />
        <circle cx="175" cy="100" r="3" fill="#1E3A5F" />
      </svg>

      {/* Top-right: dot grid */}
      <div className="absolute top-8 right-8 grid grid-cols-5 gap-2 opacity-20">
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1D4ED8' }} />
        ))}
      </div>
    </div>
  );
}
