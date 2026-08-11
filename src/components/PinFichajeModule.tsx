import { useState, useEffect, useCallback, useRef } from 'react';
import { Delete, Check, Fingerprint, LogIn, LogOut, MapPin, Shield, Lock, Loader2, AlertCircle, Tablet, X, Smartphone } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useDeviceAuth } from '../hooks/useDeviceAuth';
import { loadSocietyLogos } from '../lib/societyLogos';

const PIN_LENGTH = 6;
const RESET_DELAY_MS = 2500;

type Status = 'idle' | 'submitting' | 'success' | 'error';

// ── Device setup modal ─────────────────────────────────────────────────────

function DeviceSetupModal({
  onSuccess,
  onCancel,
  registerDevice,
}: {
  onSuccess: () => void;
  onCancel?: () => void;
  registerDevice: (key: string, site: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [deviceKey, setDeviceKey] = useState('');
  const [siteName, setSiteName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    setDeviceKey(`tablet_${Date.now().toString(36)}`);
  }, []);

  async function save() {
    if (!deviceKey.trim() || !siteName.trim()) { setSaveError('Completa todos los campos'); return; }
    setSaving(true); setSaveError('');
    const { ok, error } = await registerDevice(deviceKey.trim(), siteName.trim());
    if (!ok) { setSaveError(error ?? 'Error al registrar el dispositivo'); setSaving(false); return; }
    onSuccess();
  }

  return (
    <div className="fixed inset-0 z-[400] flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#E2E8F0' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <Shield size={18} style={{ color: '#1D4ED8' }} />
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Registrar tablet kiosco</p>
              <p className="text-xs" style={{ color: '#64748B' }}>Vincula este dispositivo como terminal de fichaje</p>
            </div>
          </div>
          {onCancel && (
            <button onClick={onCancel} className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style={{ color: '#64748B' }}>
              <X size={16} />
            </button>
          )}
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Código del dispositivo</label>
            <input type="text" value={deviceKey} onChange={e => { setDeviceKey(e.target.value); setSaveError(''); }}
              placeholder="ej: tablet_oficina_1"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none font-mono"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }} autoFocus />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nombre del centro / sede</label>
            <input type="text" value={siteName} onChange={e => { setSiteName(e.target.value); setSaveError(''); }}
              placeholder="ej: Oficina La Laguna"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#0F172A' }} />
          </div>
          {saveError && (
            <div className="flex items-center gap-2 text-xs" style={{ color: '#DC2626' }}>
              <AlertCircle size={12} /> {saveError}
            </div>
          )}
          <button onClick={save} disabled={saving}
            className="w-full py-3 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
            style={{ backgroundColor: '#1D4ED8', color: '#FFFFFF' }}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Tablet size={14} />}
            {saving ? 'Registrando...' : 'Registrar dispositivo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main kiosk PIN module ──────────────────────────────────────────────────

function PinFichajeModule({ onClose }: { onClose?: () => void } = {}) {
  const { status: deviceStatus, deviceInfo, validate: validateDevice, registerDevice } = useDeviceAuth();

  // isKiosk = device is a registered, active kiosk tablet
  const isKiosk = deviceStatus === 'authorized';
  // GPS is only required for non-kiosk devices (mobile phones, unregistered devices)
  const gpsRequired = !isKiosk;

  const [pin, setPin] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [lastEvent, setLastEvent] = useState<'entrada' | 'salida' | null>(null);
  const [gpsStatus, setGpsStatus] = useState<'searching' | 'ready' | 'denied' | 'unsupported' | 'not_required'>('searching');
  const [kioskBg, setKioskBg] = useState<string>('/assets/kiosco/fondo.png');
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [showSetup, setShowSetup] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cachedGeo = useRef<{ latitud: number | null; longitud: number | null; ubicacion: string | null }>({
    latitud: null, longitud: null, ubicacion: null,
  });

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    supabase
      .from('ui_settings')
      .select('key, value')
      .eq('key', 'kiosk_background')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setKioskBg(data.value);
      });
    loadSocietyLogos().then(setLogos);
  }, []);

  // GPS: only fetch if this is NOT a kiosk device
  const fetchGeoRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (isKiosk) {
      setGpsStatus('not_required');
      return;
    }
    if (!navigator.geolocation) { setGpsStatus('unsupported'); return; }
    if (typeof window !== 'undefined' && !window.isSecureContext) { setGpsStatus('denied'); return; }
    let cancelled = false;
    const fetchGeo = () => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (cancelled) return;
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          let direccion: string | null = null;
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`,
              { headers: { 'Accept-Language': 'es' } },
            );
            if (res.ok) {
              const data = await res.json();
              const a = data.address || {};
              const parts = [a.road, a.house_number, a.postcode, a.village || a.town || a.city || a.municipality, a.state].filter(Boolean);
              direccion = parts.join(', ') || data.display_name || null;
            }
          } catch { direccion = null; }
          if (cancelled) return;
          cachedGeo.current = { latitud: lat, longitud: lon, ubicacion: direccion };
          setGpsStatus('ready');
        },
        () => { if (cancelled) return; setGpsStatus('denied'); },
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 },
      );
    };
    fetchGeoRef.current = fetchGeo;
    fetchGeo();
    const refreshInterval = setInterval(fetchGeo, 60000);
    return () => { cancelled = true; clearInterval(refreshInterval); };
  }, [isKiosk]);

  const retryGeo = useCallback(() => { fetchGeoRef.current(); }, []);

  const reset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setPin(''); setStatus('idle'); setMessage(''); setLastEvent(null);
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

    // GPS check: only required for non-kiosk devices
    if (gpsRequired) {
      if (gpsStatus !== 'ready') {
        setStatus('error');
        setMessage('Esperando ubicación GPS... Activa el permiso de ubicación para fichar.');
        resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
        return;
      }
      const geo = cachedGeo.current;
      if (geo.latitud === null || geo.longitud === null) {
        setStatus('error');
        setMessage('No se pudo obtener la ubicación. Activa el GPS e inténtalo de nuevo.');
        resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
        return;
      }
    }

    setStatus('submitting'); setMessage('');
    try {
      const geo = cachedGeo.current;
      const { data: rpcData, error: rpcErr } = await supabase.rpc('kiosk_register_fichaje', {
        p_pin: pinValue,
        p_latitud: gpsRequired ? geo.latitud : null,
        p_longitud: gpsRequired ? geo.longitud : null,
        p_ubicacion: gpsRequired ? geo.ubicacion : null,
        p_dispositivo: deviceInfo ? `${deviceInfo.site_name} · ${getDeviceInfo()}` : getDeviceInfo(),
        p_user_agent: navigator.userAgent,
        p_device_key: deviceInfo?.device_key ?? null,
      });
      if (rpcErr || !rpcData || rpcData.length === 0) {
        setStatus('error'); setMessage('Error al registrar el fichaje.');
        resetTimer.current = setTimeout(reset, RESET_DELAY_MS); return;
      }
      const result = rpcData[0] as { success: boolean; tipo: 'entrada' | 'salida'; nombre_empleado: string; error_msg: string | null };
      if (!result.success) {
        if (result.error_msg === 'DEVICE_NOT_AUTHORIZED') {
          // Show user-facing message instead of blocking the interface
          setStatus('error');
          setMessage('Tu modo de fichaje no permite usar este dispositivo. Contacta con RRHH.');
          resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
          return;
        }
        setStatus('error'); setMessage(result.error_msg ?? 'PIN incorrecto. Inténtalo de nuevo.');
        resetTimer.current = setTimeout(reset, RESET_DELAY_MS); return;
      }
      setLastEvent(result.tipo); setStatus('success');
      const tipoLabel = result.tipo === 'entrada' ? 'ENTRADA' : 'SALIDA';
      setMessage(`${tipoLabel} registrada correctamente, ${result.nombre_empleado}`);
      resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
    } catch (err: unknown) {
      setStatus('error'); setMessage(err instanceof Error ? err.message : 'Error al registrar el fichaje');
      resetTimer.current = setTimeout(reset, RESET_DELAY_MS);
    }
  }, [reset, gpsRequired, gpsStatus, deviceInfo]);

  const appendDigit = (d: string) => {
    if (status === 'submitting' || status === 'success') return;
    if (status === 'error') { setPin(d); setStatus('idle'); setMessage(''); return; }
    setPin((prev) => {
      if (prev.length >= PIN_LENGTH) return prev;
      const next = prev + d;
      if (next.length === PIN_LENGTH) submit(next);
      return next;
    });
  };

  const deleteDigit = () => {
    if (status === 'submitting' || status === 'success') return;
    if (status === 'error') { reset(); return; }
    setPin((prev) => prev.slice(0, -1));
  };

  const confirm = () => { if (pin.length >= 4) submit(pin); };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') appendDigit(e.key);
      else if (e.key === 'Backspace') deleteDigit();
      else if (e.key === 'Enter') confirm();
      else if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const displayDots = Array.from({ length: PIN_LENGTH }, (_, i) => i < pin.length);

  // Always show the PIN interface — even for unauthorized devices
  // (the server-side RPC enforces fichaje_mode restrictions)

  return (
    <>
      <div className="fixed inset-0 z-[300] flex flex-col" style={{
        backgroundImage: `url(${kioskBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundColor: '#EFF6FF',
      }}>
        {/* Main content area — takes all space above logo bar */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 overflow-y-auto relative">

          {/* Close button */}
          {onClose && (
            <button onClick={onClose}
              className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.6)', color: '#1E3A5F' }}
              title="Salir">
              <X size={16} />
            </button>
          )}

          {/* Device badge — shows kiosk name or "dispositivo móvil" */}
          <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{ backgroundColor: 'rgba(255,255,255,0.75)', color: '#1E3A5F', border: '1px solid rgba(30,58,95,0.15)' }}>
            {isKiosk ? (
              <>
                <Tablet size={11} />
                {deviceInfo?.site_name ?? 'Kiosco'}
              </>
            ) : (
              <>
                <Smartphone size={11} />
                Dispositivo móvil
              </>
            )}
          </div>

          {/* Header */}
          <div className="text-center mb-5 select-none">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Fingerprint size={22} style={{ color: '#1D4ED8' }} />
              <h1 className="text-sm font-bold uppercase tracking-[0.25em]" style={{ color: '#1D4ED8' }}>
                Control de Presencia
              </h1>
            </div>
            <p className="text-5xl sm:text-6xl font-bold tracking-wide" style={{ color: '#1E3A5F', lineHeight: 1.1 }}>
              {timeStr}
            </p>
            <p className="text-sm mt-1.5 capitalize font-medium" style={{ color: '#3B6494' }}>
              {dateStr}
            </p>
          </div>

          {/* PIN dots */}
          <div className="mb-4 select-none">
            <div className="flex gap-3 justify-center mb-2">
              {displayDots.map((filled, i) => (
                <div key={i} className="w-5 h-5 rounded-full border-2 transition-all duration-150"
                  style={{
                    borderColor: filled ? '#1D4ED8' : 'rgba(30,58,95,0.3)',
                    backgroundColor: filled ? '#1D4ED8' : 'transparent',
                    transform: filled ? 'scale(1.15)' : 'scale(1)',
                  }} />
              ))}
            </div>
            <p className="text-center text-xs uppercase tracking-widest font-semibold" style={{ color: '#3B6494' }}>
              Introduce tu PIN
            </p>
          </div>

          {/* Status message */}
          <div className="h-14 mb-3 flex items-center justify-center w-full max-w-xs">
            {status === 'success' && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl w-full justify-center"
                style={{ backgroundColor: 'rgba(22,163,74,0.12)', border: '1.5px solid rgba(22,163,74,0.35)' }}>
                {lastEvent === 'entrada' ? <LogIn size={18} style={{ color: '#16A34A' }} /> : <LogOut size={18} style={{ color: '#16A34A' }} />}
                <span className="text-sm font-semibold" style={{ color: '#15803D' }}>{message}</span>
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center gap-3 px-5 py-3 rounded-2xl w-full justify-center"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1.5px solid rgba(245,158,11,0.35)' }}>
                <AlertCircle size={18} style={{ color: '#B45309' }} />
                <span className="text-sm font-semibold" style={{ color: '#B45309' }}>{message}</span>
              </div>
            )}
            {status === 'submitting' && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full border-2 animate-spin"
                  style={{ borderColor: 'rgba(29,78,216,0.2)', borderTopColor: '#1D4ED8' }} />
                <span className="text-sm font-medium" style={{ color: '#3B6494' }}>Validando...</span>
              </div>
            )}
          </div>

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
              <KioskKey key={d} label={d} onClick={() => appendDigit(d)}
                disabled={status === 'submitting' || status === 'success'} />
            ))}
            <KioskKey label="" icon={<Delete size={22} />}
              onClick={deleteDigit} disabled={status === 'submitting' || status === 'success'} variant="secondary" />
            <KioskKey label="0" onClick={() => appendDigit('0')}
              disabled={status === 'submitting' || status === 'success'} />
            <KioskKey label="" icon={<Check size={24} />}
              onClick={confirm} disabled={status === 'submitting' || status === 'success' || pin.length < 4} variant="confirm" />
          </div>

          {/* GPS indicator — only for non-kiosk devices */}
          {gpsRequired && (
            <div className="mt-4 flex flex-col items-center gap-1 text-xs">
              {gpsStatus === 'ready' && cachedGeo.current.ubicacion && (
                <span className="flex items-center gap-1.5 font-medium" style={{ color: '#1E3A5F' }}>
                  <MapPin size={12} style={{ color: '#1D4ED8' }} />
                  Ubicación: <span style={{ color: '#1D4ED8' }}>{cachedGeo.current.ubicacion.split(',')[0]}</span>
                </span>
              )}
              {gpsStatus === 'ready' && !cachedGeo.current.ubicacion && (
                <span className="flex items-center gap-1.5" style={{ color: '#3B6494' }}>
                  <MapPin size={12} /> Ubicación lista
                </span>
              )}
              {gpsStatus === 'searching' && (
                <span className="flex items-center gap-1.5" style={{ color: '#3B6494' }}>
                  <div className="w-2.5 h-2.5 rounded-full border animate-spin"
                    style={{ borderColor: 'rgba(59,100,148,0.3)', borderTopColor: '#3B6494' }} />
                  Obteniendo ubicación...
                </span>
              )}
              {(gpsStatus === 'denied' || gpsStatus === 'unsupported') && (
                <button onClick={() => { setGpsStatus('searching'); retryGeo(); }}
                  className="flex items-center gap-1.5 cursor-pointer transition-opacity hover:opacity-70"
                  style={{ color: '#B45309' }}>
                  <MapPin size={12} /> Ubicación no disponible — pulsar para reintentar
                </button>
              )}
            </div>
          )}

          {/* Register kiosk button — only for non-registered devices */}
          {deviceStatus === 'unauthorized' && (
            <button onClick={() => setShowSetup(true)}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all"
              style={{ backgroundColor: 'rgba(255,255,255,0.7)', color: '#1D4ED8', border: '1px solid rgba(29,78,216,0.2)' }}>
              <Tablet size={14} /> Registrar como tablet kiosco
            </button>
          )}

          {/* Device disabled warning */}
          {deviceStatus === 'disabled' && deviceInfo && (
            <div className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-xs"
              style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
              <AlertCircle size={14} /> Tablet desactivada por el administrador
            </div>
          )}
        </div>

        {/* Logo bar — bottom strip */}
        <div className="flex-shrink-0 flex items-center justify-around px-8 py-4 gap-6"
          style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid rgba(30,58,95,0.1)', minHeight: 80 }}>
          {Object.entries(logos).map(([societyId, src]) => (
            <img key={societyId} src={src} alt="" className="h-10 object-contain max-w-[140px]"
              onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
          ))}
          {Object.keys(logos).length === 0 && (
            <span className="text-sm" style={{ color: '#94A3B8' }}>Cargando logos...</span>
          )}
        </div>
      </div>

      {showSetup && (
        <DeviceSetupModal
          registerDevice={registerDevice}
          onSuccess={() => { setShowSetup(false); validateDevice(); }}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </>
  );
}

function KioskKey({
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
    style = { backgroundColor: '#4CAF50', border: '1px solid #388E3C', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(76,175,80,0.35)' };
  } else if (variant === 'secondary') {
    style = { backgroundColor: 'rgba(255,255,255,0.65)', border: '1px solid rgba(30,58,95,0.18)', color: '#1E3A5F', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
  } else {
    style = { backgroundColor: 'rgba(255,255,255,0.75)', border: '1px solid rgba(30,58,95,0.15)', color: '#1E3A5F', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' };
  }
  return (
    <button
      className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-100 select-none active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
      style={style}
      onClick={onClick}
      disabled={disabled}
    >
      {icon
        ? icon
        : <span className="text-2xl sm:text-3xl font-semibold">{label}</span>
      }
    </button>
  );
}

export default PinFichajeModule;
