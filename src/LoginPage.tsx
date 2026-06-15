import { useState, useEffect } from 'react';
import { Building2, Landmark, Gem, Shield, ChevronDown, ChevronUp, ArrowRight, Eye, EyeOff, User, Lock, LogOut, Bell, FileText, Laptop, Award, ClipboardCheck, Car, QrCode, X, RefreshCw, AlertCircle, ShieldCheck, Search, Download, Folder, Tag, Zap, Users, KeyRound } from 'lucide-react';
import { societies as staticSocieties, SocietyTheme } from './themes';
import { mockDocuments, mockCertificates, mockExams } from './mockData';
import type { AppRole } from './supabaseClient';
type UserRole = AppRole;
import DocumentsCard from './DocumentsCard';
import DevicesCard from './DevicesCard';
import CertificatesCard from './CertificatesCard';
import ExamsCard from './ExamsCard';
import PrevencionDocsCard from './PrevencionDocsCard';
import AdminPanel from './AdminPanel';
import RRHHPanel from './RRHHPanel';
import PrevencionPanel from './PrevencionPanel';
import AdministracionPanel from './AdministracionPanel';
import { supabase } from './supabaseClient';
import { AuthProvider } from './context/AuthContext';
import { SocietyProvider } from './context/SocietyContext';
import { downloadFromWasabi } from './lib/wasabi';
import ChangePasswordModal from './components/ChangePasswordModal';
import IncidenciasModule from './components/IncidenciasModule';

const iconMap: Record<string, React.FC<{ size?: number; className?: string }>> = {
  'building-2': Building2,
  landmark: Landmark,
  gem: Gem,
  shield: Shield,
};

// ─── Quick Vehicle Register Modal ───────────────────────────────────────────
type VehicleStatus = 'libre' | 'en_uso_mismo' | 'en_uso_otro';

interface VehicleInfo {
  id: string;
  matricula: string;
  marca: string;
  modelo: string;
  estado: string;
  current_user_nombre: string | null;
  current_km_inicio: number | null;
  kilometros_actuales: number;
  current_user_id?: string | null;
}

function VehicleRegisterModal({ onClose }: { onClose: () => void }) {
// step: 'plate' → matrícula | 'id' → validación PIN to check | 'action' → libre/en_uso_mismo/en_uso_otro
  const [step, setStep] = useState<'plate' | 'id' | 'action'>('plate');
  const [plate, setPlate] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
  const [usuarioPin, setUsuarioPin] = useState<any>(null);
  const [km, setKm] = useState('');
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>('libre');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<'started' | 'finished' | null>(null);

  // Step 1: look up plate
  const handleSearchPlate = async () => {
    if (!plate.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data, error: vErr } = await supabase
        .from('vehicles')
        .select('id,matricula,marca,modelo,estado,current_user_id,current_user_nombre,current_km_inicio,kilometros_actuales')
        .eq('matricula', plate.trim().toUpperCase())
        .maybeSingle();
      if (vErr) throw new Error(vErr.message);
      if (!data) throw new Error(`Matrícula ${plate.trim().toUpperCase()} no encontrada`);
      setVehicle(data as VehicleInfo);
      setStep('id');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al buscar');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: enter employee ID → determine action
const handleCheckId = async () => {
  if (!empleadoId.trim() || !vehicle) return;

  setError('');

  try {
    const { data: usuario, error } = await supabase
      
  .from('user_profiles')
  .select('id,nombre,pin');

console.log('TODOS', data);
console.log('ERROR', error);

return;
  return;
}

    setUsuarioPin(usuario);

    if (vehicle.estado === 'libre') {
      setVehicleStatus('libre');
    } else {
      const isSame =
        vehicle.current_user_id === usuario.id;

      setVehicleStatus(
        isSame ? 'en_uso_mismo' : 'en_uso_otro'
      );
    }

    setStep('action');
  } catch {
    setError('Error al validar PIN');
  }
};

  // Action: start use (libre)
  const handleStart = async () => {
  setError('');

  if (!vehicle) return;

  const kmVal = parseInt(km, 10);

  if (isNaN(kmVal)) {
    setError('Debe introducir un kilometraje válido');
    return;
  }

  if (kmVal < (vehicle.kilometros_actuales ?? 0)) {
    setError(
      `Los kilómetros no pueden ser inferiores a ${vehicle.kilometros_actuales}`
    );
    return;
  }

  setLoading(true);
    try {
      const now = new Date().toISOString();
      const { error: logErr } = await supabase.from('vehicle_logs').insert({
        vehicle_id: vehicle.id,
        user_id: usuarioPin.id,
        user_nombre: usuarioPin.nombre,
        fecha_inicio: now,
        km_inicio: kmVal,
        tipo: 'normal',
       motivo: `Registro rápido. PIN validado (${usuarioPin.nombre})`,
      });
      if (logErr) throw new Error(logErr.message);
      const { error: vUpErr } = await supabase.from('vehicles').update({
        estado: 'en_uso',
        current_user_id: usuarioPin.id,
        current_user_nombre: usuarioPin.nombre,
        current_km_inicio: kmVal,
        current_fecha_inicio: now,
        kilometros_actuales: kmVal,
      }).eq('id', vehicle.id);
      if (vUpErr) throw new Error(vUpErr.message);
      setDone('started');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  // Action: finish use (en_uso_mismo)
  const handleFinish = async () => {
    setError('');
    const kmVal = parseInt(km, 10);
    if (isNaN(kmVal) || kmVal < 0) {
    setError('Kilometraje inválido');
    return;
  }
      if (kmVal < (vehicle.kilometros_actuales ?? 0)) {
    setError(
      `Los kilómetros no pueden ser inferiores a ${vehicle.kilometros_actuales}`
    );
    return;
  }
    if (!vehicle) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      // close the open log
      const { data: openLog } = await supabase
        .from('vehicle_logs')
        .select('id,km_inicio,fecha_inicio')
        .eq('vehicle_id', vehicle.id)
        .is('fecha_fin', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (openLog) {
        const inicio = new Date(openLog.fecha_inicio).getTime();
        const fin = new Date(now).getTime();
        const duracion = Math.round((fin - inicio) / 60000);
        const { error: logUpErr } = await supabase.from('vehicle_logs').update({
          fecha_fin: now,
          km_fin: kmVal,
          duracion_minutos: duracion,
        }).eq('id', openLog.id);
        if (logUpErr) throw new Error(logUpErr.message);
      }

      const { error: vUpErr } = await supabase.from('vehicles').update({
        estado: 'libre',
        current_user_id: null,
        current_user_nombre: null,
        current_km_inicio: null,
        current_fecha_inicio: null,
        kilometros_actuales: kmVal,
      }).eq('id', vehicle.id);
      if (vUpErr) throw new Error(vUpErr.message);
      setDone('finished');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al finalizar');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-2">
            <Car size={18} className="text-white" />
            <div>
              <h2 className="text-white font-semibold text-sm">Registrar Vehículo</h2>
              <p className="text-white/60 text-xs">Acceso rápido sin login</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* ── DONE ── */}
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: done === 'started' ? '#F0FDF4' : '#EFF6FF', border: `2px solid ${done === 'started' ? '#BBF7D0' : '#BFDBFE'}` }}>
                <Car size={24} style={{ color: done === 'started' ? '#16A34A' : '#2563EB' }} />
              </div>
              <p className="font-semibold" style={{ color: done === 'started' ? '#16A34A' : '#2563EB' }}>
                {done === 'started' ? 'Uso iniciado correctamente' : 'Uso finalizado correctamente'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                {vehicle?.matricula} — {usuarioPin?.nombre} — {km} km
              </p>
              <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                Cerrar
              </button>
            </div>

          /* ── STEP: PLATE ── */
          ) : step === 'plate' ? (
            <>
              <div className="flex flex-col items-center py-5 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                  <QrCode size={32} style={{ color: '#94A3B8' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#1E293B' }}>Introduce la matrícula</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matrícula</label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPlate()}
                  placeholder="1234-ABC"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center font-mono font-bold tracking-widest"
                  style={{ ...inputStyle, fontSize: '16px' }}
                />
              </div>
              {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}><AlertCircle size={13} style={{ color: '#DC2626' }} /><p className="text-xs" style={{ color: '#DC2626' }}>{error}</p></div>}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleSearchPlate} disabled={loading || !plate.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A' }}>
                  {loading && <RefreshCw size={13} className="animate-spin" />}
                  Buscar Vehículo
                </button>
              </div>
            </>

          /* ── STEP: ID EMPLEADO ── */
          ) : step === 'id' ? (
            <>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <Car size={16} style={{ color: '#16A34A' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{vehicle?.matricula}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{vehicle?.marca} {vehicle?.modelo}</p>
                </div>
                <button onClick={() => { setStep('plate'); setError(''); setVehicle(null); }} className="ml-auto text-xs cursor-pointer" style={{ color: '#94A3B8' }}>Cambiar</button>
              </div>
              <div>
               <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider">
  PIN DE ACCESO
</label>

<input
  type="password"
  value={empleadoId}
  onChange={(e) =>
    setEmpleadoId(e.target.value.replace(/\D/g, '').slice(0, 6))
  }
  onKeyDown={(e) => e.key === 'Enter' && handleCheckId()}
  placeholder="••••••"
  maxLength={6}
  inputMode="numeric"
  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
  style={inputStyle}
/>
              </div>
              {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}><AlertCircle size={13} style={{ color: '#DC2626' }} /><p className="text-xs" style={{ color: '#DC2626' }}>{error}</p></div>}
              <div className="flex gap-3">
                <button onClick={() => { setStep('plate'); setError(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Atrás</button>
                <button onClick={handleCheckId} disabled={!empleadoId.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ backgroundColor: '#0F172A' }}>
                  Continuar
                </button>
              </div>
            </>

          /* ── STEP: ACTION ── */
          ) : (
            <>
              {/* Vehicle badge */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Car size={16} style={{ color: '#64748B' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{vehicle?.matricula}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{vehicle?.marca} {vehicle?.modelo} — {usuarioPin?.nombre}</p>
                </div>
              </div>

              {/* EN USO POR OTRO → blocked */}
              {vehicleStatus === 'en_uso_otro' ? (
                <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#FEF2F2', border: '1.5px solid #FECACA' }}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Vehículo en uso por otro empleado</p>
                      <p className="text-xs mt-1" style={{ color: '#DC2626' }}>
                        Actualmente asignado a: <strong>{vehicle?.current_user_nombre ?? 'desconocido'}</strong>
                      </p>
                      <p className="text-xs mt-2" style={{ color: '#7F1D1D' }}>
                        No es posible registrar este vehículo. Llame a RRHH o Informática para que liberen el vehículo.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* Status banner */}
                  {vehicleStatus === 'libre' ? (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#16A34A' }} />
                      <p className="text-xs font-medium" style={{ color: '#15803D' }}>Vehículo libre — introduce los km actuales para empezar</p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#2563EB' }} />
                      <p className="text-xs font-medium" style={{ color: '#1D4ED8' }}>En uso por ti — introduce los km finales para terminar</p>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
                      {vehicleStatus === 'libre' ? 'Kilómetros actuales' : 'Kilómetros finales'}
                    </label>
                    <input
                      type="number"
                      value={km}
                      onChange={(e) => setKm(e.target.value)}
                      placeholder={String(vehicle?.kilometros_actuales ?? 0)}
                      className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                      style={inputStyle}
                    />
                  </div>

                  {error && <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}><AlertCircle size={13} style={{ color: '#DC2626' }} /><p className="text-xs" style={{ color: '#DC2626' }}>{error}</p></div>}

                  <div className="flex gap-3">
                    <button onClick={() => { setStep('id'); setError(''); setKm(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Atrás</button>
                    {vehicleStatus === 'libre' ? (
                      <button onClick={handleStart} disabled={loading || !km} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#16A34A' }}>
                        {loading && <RefreshCw size={13} className="animate-spin" />}
                        Empezar uso
                      </button>
                    ) : (
                      <button onClick={handleFinish} disabled={loading || !km} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#2563EB' }}>
                        {loading && <RefreshCw size={13} className="animate-spin" />}
                        Terminar uso
                      </button>
                    )}
                  </div>
                </>
              )}

              {vehicleStatus === 'en_uso_otro' && (
                <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cerrar</button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

type AppView = 'login' | 'admin' | 'rrhh' | 'prevencion' | 'dashboard' | 'supervisor' | 'administracion';

interface SessionState {
  email: string;
  role: UserRole;
  societyId: string | null;
  view: AppView;
  activeSocietyId: string | null;
}

export default function LoginPage() {
  const [selectedId, setSelectedId] = useState<string>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [session, setSession] = useState<SessionState | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [bgImage, setBgImage] = useState<string>('/foto1_(2).png');
  const [societies, setSocieties] = useState<SocietyTheme[]>(staticSocieties);

  useEffect(() => {
    supabase
      .from('ui_settings')
      .select('key, value')
      .then(({ data }) => {
        if (!data) return;
        const bg = data.find((r) => r.key === 'login_background');
        if (bg?.value) setBgImage(bg.value);

        const colorOverrides: Record<string, { primary: string; gradientFrom: string; gradientTo: string }> = {};
        for (const row of data) {
          const m = row.key.match(/^society_color_(.+)$/);
          if (m) {
            try { colorOverrides[m[1]] = JSON.parse(row.value); } catch { /* skip */ }
          }
        }
        if (Object.keys(colorOverrides).length > 0) {
          setSocieties(staticSocieties.map((s) => {
            const c = colorOverrides[s.id];
            if (!c) return s;
            return { ...s, primary: c.primary, primaryDark: c.gradientTo, gradientFrom: c.gradientFrom, gradientTo: c.gradientTo };
          }));
        }
      });
  }, []);

  const selected = societies.find((s) => s.id === selectedId) ?? null;

  useEffect(() => {
    if (selectedId) {
      setIsTransitioning(true);
      const timer = setTimeout(() => setIsTransitioning(false), 600);
      return () => clearTimeout(timer);
    }
  }, [selectedId]);

  // 15-minute inactivity timeout — resets on any user interaction
  useEffect(() => {
    if (!session) return;
    const TIMEOUT_MS = 15 * 60 * 1000;
    let timer = setTimeout(handleLogout, TIMEOUT_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(handleLogout, TIMEOUT_MS);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogin = async () => {
    setLoginError('');
    setLoginLoading(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      // Step 1: Verify credentials via edge function
      let resp: Response;
      try {
        resp = await fetch(`${supabaseUrl}/functions/v1/admin-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
            'Apikey': anonKey,
          },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
      } catch (fetchErr) {
        const errMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
        console.error('Login fetch error:', errMsg);
        setLoginError('Error de conexión. Verifica tu conexión de red.');
        return;
      }

      let body: Record<string, unknown> = {};
      try {
        body = await resp.json();
      } catch (jsonErr) {
        console.error('Invalid JSON response from login:', jsonErr);
        setLoginError('Error del servidor. Intenta de nuevo.');
        return;
      }

      if (!resp.ok) {
        const errorMsg = typeof body.error === 'string' ? body.error : 'Credenciales incorrectas';
        console.error('Login error:', errorMsg);
        setLoginError(errorMsg);
        return;
      }

      // Step 2: Validate response contains required tokens
      if (!body.access_token || !body.refresh_token) {
        console.error('Missing tokens in login response:', body);
        setLoginError('Error al crear sesión. Intenta de nuevo.');
        return;
      }

      // Step 3: Establish Supabase session
      try {
        await supabase.auth.setSession({
          access_token: body.access_token as string,
          refresh_token: body.refresh_token as string,
        });
      } catch (sessionErr) {
        const errMsg = sessionErr instanceof Error ? sessionErr.message : String(sessionErr);
        console.error('Session setup error:', errMsg);
        setLoginError('Error al iniciar sesión. Intenta de nuevo.');
        return;
      }

      // Step 4: Load profile with error handling
      let resolvedEmail: string = email.trim().toLowerCase();
      let resolvedRole: UserRole = 'employee';
      let resolvedSocietyId: string | null = null;

      try {
        const profile = body.profile as Record<string, unknown> | undefined;
        if (profile) {
          resolvedEmail = (profile.email as string) ?? resolvedEmail;
          resolvedRole = (profile.role as UserRole) ?? 'employee';
          const societies = profile.societies as unknown[];
          resolvedSocietyId = (societies && societies.length > 0) ? String(societies[0]) : null;
        }
      } catch (profileErr) {
        console.error('Profile parsing error:', profileErr);
        console.warn('Proceeding with default employee role');
      }

      // Step 5: For employees, look up their assigned society from the empleados table
      if (resolvedRole === 'employee') {
        try {
          const { data: emp } = await supabase
            .from('empleados')
            .select('id_sociedad')
            .eq('email', resolvedEmail)
            .maybeSingle();
          if (emp?.id_sociedad) {
            resolvedSocietyId = emp.id_sociedad;
          }
        } catch { /* fallback to profile society */ }
      }

      // Step 6: Determine view
      let initialView: AppView = 'dashboard';
      if (resolvedRole === 'admin') {
        initialView = 'admin';
      } else if (resolvedRole === 'rrhh') {
        initialView = 'rrhh';
      } else if (resolvedRole === 'prevencion') {
        initialView = 'prevencion';
      } else if (resolvedRole === 'supervisor') {
        initialView = 'supervisor';
      } else if (resolvedRole === 'administracion') {
        initialView = 'administracion';
      } else {
        if (resolvedSocietyId) setSelectedId(resolvedSocietyId);
      }

      setSession({
        email: resolvedEmail,
        role: resolvedRole,
        societyId: resolvedSocietyId,
        view: initialView,
        activeSocietyId: resolvedSocietyId,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error('Unexpected login error:', errMsg, err);
      setLoginError('Error inesperado. Intenta de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    supabase.auth.signOut();
    setSession(null);
    setSelectedId('');
    setEmail('');
    setPassword('');
    setLoginError('');
  };

  const handleNavigate = (view: AppView, societyId?: string) => {
    if (!session) return;
    if (view === 'society' as string && societyId) {
      setSelectedId(societyId);
      setSession({ ...session, view: 'dashboard', activeSocietyId: societyId });
    } else if (view === 'dashboard') {
      // Go to employee self-service panel
      const firstSociety = societies[0];
      if (firstSociety) setSelectedId(firstSociety.id);
      setSession({ ...session, view: 'dashboard', activeSocietyId: session.activeSocietyId ?? societies[0]?.id ?? null });
    } else {
      setSession({ ...session, view });
    }
  };

  // Route to the right panel
  if (session) {
    if (session.view === 'admin') {
      return (
        <AuthProvider>
          <SocietyProvider defaultSocietyId={session.activeSocietyId ?? undefined}>
            <AdminPanel
              email={session.email}
              onLogout={handleLogout}
              onNavigate={handleNavigate}
            />
          </SocietyProvider>
        </AuthProvider>
      );
    }

    if (session.view === 'prevencion') {
      return (
        <AuthProvider>
          <SocietyProvider defaultSocietyId={session.activeSocietyId ?? undefined}>
            <PrevencionPanel
              email={session.email}
              onLogout={handleLogout}
              onNavigateEmployee={() => handleNavigate('dashboard')}
            />
          </SocietyProvider>
        </AuthProvider>
      );
    }

    if (session.view === 'rrhh') {
      return (
        <AuthProvider>
          <SocietyProvider defaultSocietyId={session.activeSocietyId ?? undefined}>
            <RRHHPanel
              email={session.email}
              onLogout={handleLogout}
              onNavigateAdmin={session.role === 'admin' ? () => handleNavigate('admin') : undefined}
              isAdmin={session.role === 'admin'}
              onNavigateEmployee={() => handleNavigate('dashboard')}
            />
          </SocietyProvider>
        </AuthProvider>
      );
    }

    if (session.view === 'supervisor') {
      return (
        <AuthProvider>
          <SocietyProvider defaultSocietyId={session.activeSocietyId ?? undefined}>
            <RRHHPanel
              email={session.email}
              onLogout={handleLogout}
              isSupervisor={true}
              onNavigateEmployee={() => handleNavigate('dashboard')}
            />
          </SocietyProvider>
        </AuthProvider>
      );
    }

    if (session.view === 'administracion') {
      return (
        <AuthProvider>
          <SocietyProvider defaultSocietyId={session.activeSocietyId ?? undefined}>
            <AdministracionPanel
              email={session.email}
              onLogout={handleLogout}
              onNavigateEmployee={() => handleNavigate('dashboard')}
            />
          </SocietyProvider>
        </AuthProvider>
      );
    }

    if (session.view === 'dashboard') {
      const theme = societies.find((s) => s.id === session.activeSocietyId) ?? null;
      if (theme) {
        // Determine back-navigation based on the user's role
        const backNav: { label: string; view: AppView; color: string; border: string } | null =
          session.role === 'admin'          ? { label: 'Volver a Admin',          view: 'admin',          color: '#FCA5A5', border: 'rgba(239,68,68,0.3)'   } :
          session.role === 'rrhh'           ? { label: 'Volver a RRHH',           view: 'rrhh',           color: '#7DD3FC', border: 'rgba(3,105,161,0.3)'   } :
          session.role === 'supervisor'     ? { label: 'Volver a Supervisor',     view: 'supervisor',     color: '#7DD3FC', border: 'rgba(3,105,161,0.3)'   } :
          session.role === 'prevencion'     ? { label: 'Volver a Prevencion',     view: 'prevencion',     color: '#6EE7B7', border: 'rgba(5,150,105,0.3)'   } :
          session.role === 'administracion' ? { label: 'Volver a Administracion', view: 'administracion', color: '#93C5FD', border: 'rgba(37,99,235,0.3)'   } :
          null;

        return (
          <Dashboard
            theme={theme}
            onLogout={handleLogout}
            email={session.email}
            isAdmin={session.role === 'admin'}
            onNavigateAdmin={session.role === 'admin' ? () => handleNavigate('admin') : undefined}
            onNavigateRrhh={session.role === 'rrhh' ? () => handleNavigate('rrhh') : undefined}
            onNavigateSupervisor={session.role === 'supervisor' ? () => handleNavigate('supervisor') : undefined}
            onNavigateBack={backNav ? () => handleNavigate(backNav.view) : undefined}
            backLabel={backNav?.label}
            backColor={backNav?.color}
            backBorder={backNav?.border}
          />
        );
      }
    }
  }

  // Allow login attempt with just email + password
  const canLogin = !!(email.trim() && password);

  return (
    <div
      className="min-h-screen flex relative overflow-hidden"
      style={{
        backgroundImage: `url('${bgImage}')`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 15%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Full-page overlay */}
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(10, 30, 50, 0.55)' }} />

      {/* Left branding panel — visible only on large screens */}
      <div className="hidden lg:flex lg:w-[48%] relative z-10 flex-col justify-center items-center px-16">
        <div className={`transition-all duration-500 ${isTransitioning ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
          {/* Decorative circle */}
          <div className="flex items-center justify-center mb-10 relative">
            <div className="absolute w-52 h-52 rounded-full" style={{ border: '1.5px solid rgba(255,255,255,0.18)' }} />
            <div className="absolute w-36 h-36 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.1)' }} />
            <div
              className="w-24 h-24 rounded-3xl flex items-center justify-center shadow-2xl z-10"
              style={{ backgroundColor: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.22)' }}
            >
              {selected ? (
                <span className="text-4xl font-bold text-white tracking-tight">{selected.logoLetter}</span>
              ) : (
                <Building2 size={44} className="text-white/70" />
              )}
            </div>
          </div>

          <h1 className="text-4xl font-bold text-white text-center mb-3 tracking-tight drop-shadow-lg">
            {selected ? selected.name : 'Portal de Empleado'}
          </h1>
          <p className="text-white/75 text-center text-base max-w-xs mx-auto leading-relaxed">
            {selected ? 'Accede a tu espacio de trabajo y gestiona tus recursos empresariales' : 'Introduce tus credenciales para acceder'}
          </p>
        </div>

        <div className="mt-12 space-y-3 w-full max-w-xs">
          {['Gestion de nominas y documentos', 'Solicitudes y aprobaciones', 'Directorio y comunicados'].map((text, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-5 py-3 rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}
            >
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: selected?.accent ?? '#F59E0B' }} />
              <span className="text-white/85 text-sm">{text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Glass card form */}
      <div className="flex-1 relative z-10 flex items-center justify-center px-4 sm:px-8 py-10">
        <div
          className="w-full max-w-md rounded-3xl shadow-2xl px-8 py-9"
          style={{
            backgroundColor: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.6)',
          }}
        >
          {/* Mobile branding */}
          <div className="lg:hidden flex items-center justify-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: selected ? `${selected.primary}18` : '#EFF6FF', border: `2px solid ${selected ? selected.border : '#BFDBFE'}` }}
            >
              {selected ? (
                <span className="text-xl font-bold" style={{ color: selected.primary }}>{selected.logoLetter}</span>
              ) : (
                <Building2 size={24} style={{ color: '#0369A1' }} />
              )}
            </div>
          </div>

          <div className="mb-7">
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: '#0F172A' }}>
              Iniciar Sesion
            </h2>
            <p className="mt-1.5 text-sm" style={{ color: '#64748B' }}>
              Introduce tus credenciales para acceder
            </p>
          </div>

          {/* Email */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#475569' }}>
              Correo electronico
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLoginError(''); }}
                placeholder="tu@empresa.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: '#F8FAFC',
                  border: `1.5px solid ${loginError ? '#EF4444' : '#E2E8F0'}`,
                  color: '#1E293B',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-2">
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider" style={{ color: '#475569' }}>
              Contrasena
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                placeholder="Introduce tu contrasena"
                className="w-full pl-10 pr-11 py-3 rounded-xl text-sm outline-none transition-all duration-200"
                style={{
                  backgroundColor: '#F8FAFC',
                  border: `1.5px solid ${loginError ? '#EF4444' : '#E2E8F0'}`,
                  color: '#1E293B',
                }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: '#94A3B8' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {loginError && (
            <p className="text-xs text-red-500 mb-3 mt-2 pl-1">{loginError}</p>
          )}

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between mb-6 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="w-4 h-4 rounded border flex items-center justify-center" style={{ borderColor: '#CBD5E1', backgroundColor: '#F8FAFC' }}>
                <input type="checkbox" className="sr-only" />
              </div>
              <span className="text-xs" style={{ color: '#64748B' }}>Recordarme</span>
            </label>
            <button className="text-xs font-medium cursor-pointer" style={{ color: '#0369A1' }}>
              Olvidaste tu contrasena?
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={!canLogin || loginLoading}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            style={{
              background: canLogin
                ? (selected ? `linear-gradient(135deg, ${selected.gradientFrom}, ${selected.gradientTo})` : 'linear-gradient(135deg, #0C4A6E, #0369A1)')
                : '#CBD5E1',
              opacity: canLogin && !loginLoading ? 1 : 0.65,
              boxShadow: canLogin ? '0 4px 16px rgba(3,105,161,0.35)' : 'none',
            }}
          >
            {loginLoading ? <RefreshCw size={16} className="animate-spin" /> : <><span>Entrar</span><ArrowRight size={16} /></>}
          </button>

          <p className="text-center mt-5 text-xs" style={{ color: '#94A3B8' }}>
            Problemas para acceder? Contacta al departamento de TI
          </p>

          {/* Quick vehicle registration */}
          <div className="mt-5 pt-5" style={{ borderTop: '1px solid #E2E8F0' }}>
            <button
              onClick={() => setShowVehicleModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:opacity-80"
              style={{ backgroundColor: '#F1F5F9', color: '#334155', border: '1.5px solid #E2E8F0' }}
            >
              <Car size={15} />
              REGISTRAR VEHÍCULO
            </button>
          </div>
        </div>
      </div>

      {showVehicleModal && <VehicleRegisterModal onClose={() => setShowVehicleModal(false)} />}
    </div>
  );
}

// ─── PrevencionDocsFullView ───────────────────────────────────────────────────

interface PrevDoc {
  id: string;
  nombre_archivo: string;
  tipo: string | null;
  created_at: string;
  wasabi_key: string | null;
  folder_id: string;
  folder_nombre: string;
  society_id: string;
  society_nombre: string;
}

function PrevencionDocsFullView({ theme }: { theme: SocietyTheme }) {
  const [allDocs, setAllDocs] = useState<PrevDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [expandedSocieties, setExpandedSocieties] = useState<Set<string>>(new Set());
  // Set of document IDs already downloaded by this user
  const [downloadedIds, setDownloadedIds] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data: docs }, { data: logs }] = await Promise.all([
          supabase.rpc('get_my_prl_documents'),
          supabase.from('prl_download_logs').select('document_id'),
        ]);
        const d = (docs ?? []) as PrevDoc[];
        setAllDocs(d);
        setExpandedSocieties(new Set(d.map((x) => x.society_id)));
        setDownloadedIds(new Set((logs ?? []).map((l: { document_id: string }) => l.document_id)));
      } catch {
        setAllDocs([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = search.trim()
    ? allDocs.filter((d) =>
        d.nombre_archivo.toLowerCase().includes(search.toLowerCase()) ||
        d.folder_nombre.toLowerCase().includes(search.toLowerCase()) ||
        d.society_nombre.toLowerCase().includes(search.toLowerCase())
      )
    : allDocs;

  const groups = (() => {
    const map = new Map<string, { society_id: string; society_nombre: string; docs: PrevDoc[] }>();
    for (const doc of filtered) {
      if (!map.has(doc.society_id)) {
        map.set(doc.society_id, { society_id: doc.society_id, society_nombre: doc.society_nombre, docs: [] });
      }
      map.get(doc.society_id)!.docs.push(doc);
    }
    return Array.from(map.values()).sort((a, b) => a.society_nombre.localeCompare(b.society_nombre));
  })();

  const toggleSociety = (id: string) => {
    setExpandedSocieties((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isPdf = (d: PrevDoc) => d.tipo === 'application/pdf' || /\.pdf$/i.test(d.nombre_archivo);
  const isImage = (d: PrevDoc) => d.tipo?.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/i.test(d.nombre_archivo);

  const handleDownload = async (doc: PrevDoc) => {
    if (!doc.wasabi_key || downloading.has(doc.id)) return;
    setDownloading((prev) => new Set(prev).add(doc.id));
    try {
      await downloadFromWasabi(doc.wasabi_key, doc.nombre_archivo);
      // Log the download
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: emp } = await supabase
          .from('empleados')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();
        await supabase.from('prl_download_logs').insert({
          document_id: doc.id,
          user_id: user.id,
          empleado_id: emp?.id ?? null,
        });
        setDownloadedIds((prev) => new Set(prev).add(doc.id));
      }
    } catch { /* silent */ } finally {
      setDownloading((prev) => { const s = new Set(prev); s.delete(doc.id); return s; });
    }
  };

  function fileColor(d: PrevDoc) {
    if (isPdf(d)) return { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' };
    if (isImage(d)) return { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' };
    if (d.tipo?.includes('word') || d.tipo?.includes('document')) return { color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' };
    if (d.tipo?.includes('sheet') || d.tipo?.includes('excel')) return { color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' };
    return { color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
  }

  return (
    <div className="space-y-4">
      {/* Header + search */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ECFDF5' }}>
            <ShieldCheck size={18} style={{ color: '#065F46' }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>Documentos Prevención</h3>
            {!loading && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {allDocs.length} documento{allDocs.length !== 1 ? 's' : ''} disponible{allDocs.length !== 1 ? 's' : ''}
                {search.trim() && filtered.length !== allDocs.length && ` · ${filtered.length} resultado${filtered.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
          <input
            type="text"
            placeholder="Buscar documentos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl transition-all duration-200 outline-none"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer hover:opacity-70" style={{ color: '#94A3B8' }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center rounded-2xl" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#ECFDF5' }}>
            <ShieldCheck size={26} style={{ color: '#6EE7B7' }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
            {search.trim() ? 'Sin resultados para tu búsqueda' : 'Sin documentos de prevención'}
          </p>
          <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
            {search.trim() ? 'Prueba con otro término' : 'Tu responsable de PRL los subirá aquí'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isOpen = expandedSocieties.has(group.society_id);
            return (
              <div key={group.society_id} className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
                <button
                  onClick={() => toggleSociety(group.society_id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 cursor-pointer transition-colors duration-150 hover:opacity-90"
                  style={{ backgroundColor: '#ECFDF5', borderBottom: isOpen ? `1px solid ${theme.border}` : 'none' }}
                >
                  <div className="flex items-center gap-2.5">
                    <Building2 size={15} style={{ color: '#065F46' }} />
                    <span className="text-sm font-semibold" style={{ color: '#065F46' }}>{group.society_nombre}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}>
                      {group.docs.length}
                    </span>
                  </div>
                  {isOpen ? <ChevronUp size={15} style={{ color: '#065F46' }} /> : <ChevronDown size={15} style={{ color: '#065F46' }} />}
                </button>

                {isOpen && (
                  <div className="divide-y" style={{ borderColor: theme.border }}>
                    {group.docs.map((doc) => {
                      const fc = fileColor(doc);
                      const isDownloaded = downloadedIds.has(doc.id);
                      const isInProgress = downloading.has(doc.id);
                      return (
                        <div key={doc.id} className="flex items-center gap-3 px-5 py-3 transition-colors duration-100 hover:bg-slate-50">
                          {/* File type icon */}
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: fc.bg, border: `1px solid ${fc.border}` }}>
                            <FileText size={14} style={{ color: fc.color }} />
                          </div>

                          {/* Name + folder */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{doc.nombre_archivo}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Folder size={10} style={{ color: '#94A3B8' }} />
                              <p className="text-xs truncate" style={{ color: '#94A3B8' }}>
                                {doc.folder_nombre} · {new Date(doc.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                          </div>

                          {/* Downloaded badge */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {isDownloaded ? (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}>
                                <AlertCircle size={11} style={{ color: '#065F46' }} />
                                <span className="text-xs font-semibold" style={{ color: '#065F46' }}>Descargado</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                <AlertCircle size={11} style={{ color: '#C2410C' }} />
                                <span className="text-xs font-semibold" style={{ color: '#C2410C' }}>Pendiente</span>
                              </div>
                            )}

                            {/* Download button */}
                            {doc.wasabi_key && (
                              <button
                                onClick={() => handleDownload(doc)}
                                disabled={isInProgress}
                                className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:opacity-70 transition-opacity disabled:opacity-50"
                                style={{ color: '#065F46', backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7' }}
                                title="Descargar"
                              >
                                {isInProgress
                                  ? <RefreshCw size={13} className="animate-spin" />
                                  : <Download size={13} />}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
        <Tag size={11} style={{ color: theme.textSecondary }} />
        <p className="text-xs" style={{ color: theme.textSecondary }}>
          Tus tags de prevención determinan los documentos que recibes
        </p>
      </div>
    </div>
  );
}

// ─── Employee Nominas View ────────────────────────────────────────────────────

const MES_NOMBRES_EMP = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

interface NominaRow {
  id: string;
  dni: string;
  anio: number;
  mes: number;
  wasabi_key: string;
  nombre_archivo: string;
  tamano_bytes: number;
  created_at: string;
}

function MisNominasView({ theme }: { theme: SocietyTheme }) {
  const [nominas, setNominas] = useState<NominaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [filterAnio, setFilterAnio] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      // Wait until a real session is available (setSession may still be resolving)
      let session = (await supabase.auth.getSession()).data.session;
      if (!session) {
        await new Promise<void>((resolve) => {
          const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
            if (s) { subscription.unsubscribe(); resolve(); }
          });
          setTimeout(resolve, 3000); // fallback
        });
      }
      if (cancelled) return;
      const { data } = await supabase
        .from('nominas')
        .select('id, dni, anio, mes, wasabi_key, nombre_archivo, tamano_bytes, created_at')
        .order('anio', { ascending: false })
        .order('mes', { ascending: false });
      if (!cancelled) {
        setNominas((data ?? []) as NominaRow[]);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const aniosDisponibles = [...new Set(nominas.map((n) => n.anio))].sort((a, b) => b - a);
  const filtered = filterAnio ? nominas.filter((n) => String(n.anio) === filterAnio) : nominas;

  const handleDownload = async (nomina: NominaRow) => {
    if (downloading.has(nomina.id)) return;
    setDownloading((prev) => new Set(prev).add(nomina.id));
    try {
      await downloadFromWasabi(nomina.wasabi_key, nomina.nombre_archivo);
    } catch { /* silent */ } finally {
      setDownloading((prev) => { const s = new Set(prev); s.delete(nomina.id); return s; });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.primaryLight }}>
            <Zap size={18} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>Mis Nominas</h3>
            {!loading && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {filtered.length} nomina{filtered.length !== 1 ? 's' : ''} disponible{filtered.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>
        {aniosDisponibles.length > 0 && (
          <select
            value={filterAnio}
            onChange={(e) => setFilterAnio(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
            style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
          >
            <option value="">Todos los anos</option>
            {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 rounded-2xl text-center" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: theme.primaryLight }}>
            <Zap size={26} style={{ color: theme.primary, opacity: 0.4 }} />
          </div>
          <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>No hay nominas disponibles</p>
          <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Tu departamento de RRHH las subira aqui</p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          {/* Group by year */}
          {(() => {
            const byYear = new Map<number, NominaRow[]>();
            for (const n of filtered) {
              if (!byYear.has(n.anio)) byYear.set(n.anio, []);
              byYear.get(n.anio)!.push(n);
            }
            return Array.from(byYear.entries()).map(([anio, rows]) => (
              <div key={anio}>
                <div className="px-5 py-2.5 flex items-center gap-2" style={{ backgroundColor: theme.primaryLight, borderBottom: `1px solid ${theme.border}` }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.primary }}>{anio}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: theme.bg, color: theme.textSecondary }}>{rows.length}</span>
                </div>
                <div className="divide-y" style={{ borderColor: theme.border }}>
                  {rows.map((n) => {
                    const isInProgress = downloading.has(n.id);
                    return (
                      <div key={n.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
                          <FileText size={16} style={{ color: theme.primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                            Nomina {MES_NOMBRES_EMP[n.mes]} {n.anio}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                            {(n.tamano_bytes / 1024).toFixed(0)} KB · {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDownload(n)}
                          disabled={isInProgress}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 disabled:opacity-50"
                          style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}
                        >
                          {isInProgress
                            ? <RefreshCw size={13} className="animate-spin" />
                            : <Download size={13} />}
                          {isInProgress ? 'Descargando...' : 'Descargar'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ));
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({
  theme,
  onLogout,
  email,
  isAdmin,
  onNavigateAdmin,
  onNavigateRrhh,
  onNavigateSupervisor,
  onNavigateBack,
  backLabel,
  backColor,
  backBorder,
}: {
  theme: SocietyTheme;
  onLogout: () => void;
  email: string;
  isAdmin?: boolean;
  onNavigateAdmin?: () => void;
  onNavigateRrhh?: () => void;
  onNavigateSupervisor?: () => void;
  onNavigateBack?: () => void;
  backLabel?: string;
  backColor?: string;
  backBorder?: string;
}) {
  const Icon = iconMap[theme.logoIcon];
  const [activeTab, setActiveTab] = useState('resumen');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserNombre, setCurrentUserNombre] = useState('');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeDeviceCount, setActiveDeviceCount] = useState<number | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      }
    });
  }, [email]);

useEffect(() => {
  (async () => {
    // 1. Obtener el usuario autenticado (Auth)
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // 2. CONSULTA INTERMEDIA: Buscamos el ID real de empleado usando el ID de Auth o su Email
      // (Asegúrate de que la tabla se llame 'empleados'. Si se llama 'profiles' o 'usuarios', cámbialo aquí)
      const { data: empleadoData } = await supabase
        .from('empleados')
        .select('id')
        .or(`id.eq.${user.id},email.eq.${user.email}`)
        .single();

      // Usamos el ID de la tabla si existe, o el de auth como plan de respaldo
      const realEmpleadoId = empleadoData?.id || user.id;

      // 3. CONSULTA FINAL: Pedimos a Supabase el conteo exacto usando el empleado_id real
      const { count, error } = await supabase
        .from('dispositivos')
        .select('*', { count: 'exact', head: true })
       .eq('activo', true)
        .eq('empleado_id', realEmpleadoId);

      if (!error && count !== null) {
        setActiveDeviceCount(count);
      } else {
        setActiveDeviceCount(0);
      }
    } else {
      setActiveDeviceCount(0);
    }
  })();
}, []);

  const certificates = mockCertificates[theme.id] ?? [];
  const exams = mockExams[theme.id] ?? [];

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: FileText },
    { id: 'nominas', label: 'Mis Nominas', icon: Zap },
    { id: 'prevencion', label: 'Documentos PRL', icon: ShieldCheck },
    { id: 'certificados', label: 'Mis Certificados', icon: Award },
    { id: 'examenes', label: 'Mis Examenes', icon: ClipboardCheck },
    { id: 'incidencias', label: 'Incidencias', icon: AlertCircle },
  ];

  return (
    <div className="min-h-screen transition-all duration-700" style={{ backgroundColor: theme.bg }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {/* Header */}
      <header
        className="sticky top-0 z-50 transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {onNavigateBack && (
              <button
                onClick={onNavigateBack}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: backColor ?? '#FFFFFF', border: `1px solid ${backBorder ?? 'rgba(255,255,255,0.2)'}` }}
              >
                <ArrowRight size={12} style={{ transform: 'rotate(180deg)' }} />
                <span className="hidden sm:inline">{backLabel ?? 'Volver'}</span>
              </button>
            )}
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center bg-white/15 backdrop-blur-sm border border-white/20 flex-shrink-0">
              {Icon ? <Icon size={18} className="text-white" /> : null}
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-base sm:text-lg tracking-tight truncate">{theme.name}</h1>
              <p className="text-white/60 text-xs hidden sm:block">Portal del Empleado</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            {isAdmin && onNavigateAdmin && (
              <button
                onClick={onNavigateAdmin}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <Shield size={12} />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            {onNavigateRrhh && (
              <button
                onClick={onNavigateRrhh}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(3,105,161,0.2)', color: '#7DD3FC', border: '1px solid rgba(3,105,161,0.3)' }}
              >
                <Users size={12} />
                <span className="hidden sm:inline">Panel RRHH</span>
              </button>
            )}
            {onNavigateSupervisor && (
              <button
                onClick={onNavigateSupervisor}
                className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(3,105,161,0.2)', color: '#7DD3FC', border: '1px solid rgba(3,105,161,0.3)' }}
              >
                <Users size={12} />
                <span className="hidden sm:inline">Panel Supervisor</span>
              </button>
            )}
            <button className="relative p-2 rounded-lg cursor-pointer flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Bell size={16} className="text-white/80" />
              <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: theme.accent }}>
                3
              </div>
            </button>
            <div className="text-right hidden md:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{email || 'empleado@empresa.com'}</p>
              <p className="text-white/60 text-xs">{isAdmin ? 'Administrador' : 'Empleado'}</p>
            </div>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-300 flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <KeyRound size={13} />
              <span className="hidden lg:inline">Cambiar Contrasena</span>
            </button>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-300 flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Welcome */}
        <div className="mb-5 sm:mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
              Bienvenido, {email.split('@')[0]}
            </h2>
            <p className="mt-1 text-sm" style={{ color: theme.textSecondary }}>
              Resumen de tus recursos y solicitudes
            </p>
          </div>
          {isAdmin && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{ backgroundColor: theme.primaryLight, color: theme.primary, border: `1px solid ${theme.border}` }}
            >
              <Shield size={12} />
              Vista de admin
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-6 sm:mb-8 overflow-x-auto"
          style={{
            backgroundColor: theme.bgCard,
            border: `1px solid ${theme.border}`,
          }}
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-shrink-0 sm:flex-1 flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? theme.primary : 'transparent',
                  color: isActive ? '#FFFFFF' : theme.textSecondary,
                  boxShadow: isActive ? `0 2px 8px ${theme.primary}30` : 'none',
                }}
              >
                <TabIcon size={15} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'resumen' && (
          <>
            {/* Quick Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Documentos', value: '—', color: theme.primary },
                { label: 'Dispositivos', value: activeDeviceCount ?? '—', color: '#22C55E' },
                { label: 'Docs. Prevencion', value: '—', color: '#065F46' },
                { label: 'Certificados', value: certificates.length, color: theme.primary },
              ].map((stat, i) => (
                <div
                  key={i}
                  className="rounded-xl p-4 transition-all duration-300"
                  style={{
                    backgroundColor: theme.bgCard,
                    border: `1px solid ${theme.border}`,
                  }}
                >
                  <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
                  <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Main Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <DocumentsCard theme={theme} userEmail={email} userId={currentUserId} societyId={theme.id} />
              <DevicesCard theme={theme} />
              <PrevencionDocsCard theme={theme} userEmail={email} />
            </div>
          </>
        )}

        {activeTab === 'nominas' && (
          <MisNominasView theme={theme} />
        )}

        {activeTab === 'prevencion' && (
          <PrevencionDocsFullView theme={theme} />
        )}

        {activeTab === 'certificados' && (
          <CertificatesCard certificates={certificates} theme={theme} />
        )}

        {activeTab === 'examenes' && (
          <ExamsCard exams={exams} theme={theme} />
        )}

        {activeTab === 'incidencias' && currentUserId && (
          <IncidenciasModule
            currentUserId={currentUserId}
            currentUserNombre={currentUserNombre || email}
            currentUserRole="employee"
          />
        )}
      </main>
    </div>
  );
}
