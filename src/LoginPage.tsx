import { useState, useEffect } from 'react';
import { Building2, Landmark, Gem, Shield, ChevronDown, ArrowRight, Eye, EyeOff, User, Lock, LogOut, Bell, FileText, Laptop, Palmtree, Award, ClipboardCheck, Car, QrCode, X, RefreshCw, AlertCircle } from 'lucide-react';
import { societies, SocietyTheme } from './themes';
import { validUsers, mockDocuments, mockDevices, mockVacations, mockCertificates, mockExams, UserRole } from './mockData';
import DocumentsCard from './DocumentsCard';
import DevicesCard from './DevicesCard';
import VacationsCard from './VacationsCard';
import CertificatesCard from './CertificatesCard';
import ExamsCard from './ExamsCard';
import AdminPanel from './AdminPanel';
import RRHHPanel from './RRHHPanel';
import { supabase } from './supabaseClient';

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
}

function VehicleRegisterModal({ onClose }: { onClose: () => void }) {
  // step: 'plate' → enter plate | 'id' → enter employee ID to check | 'action' → libre/en_uso_mismo/en_uso_otro
  const [step, setStep] = useState<'plate' | 'id' | 'action'>('plate');
  const [plate, setPlate] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');
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
        .select('id,matricula,marca,modelo,estado,current_user_nombre,current_km_inicio,kilometros_actuales')
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
  const handleCheckId = () => {
    if (!empleadoId.trim() || !vehicle) return;
    setError('');
    if (vehicle.estado === 'libre') {
      setVehicleStatus('libre');
    } else {
      // compare by empleado_id embedded in current_user_nombre
      const isSame = vehicle.current_user_nombre === `Empleado ${empleadoId.trim()}`;
      setVehicleStatus(isSame ? 'en_uso_mismo' : 'en_uso_otro');
    }
    setStep('action');
  };

  // Action: start use (libre)
  const handleStart = async () => {
    setError('');
    const kmVal = parseInt(km, 10);
    if (isNaN(kmVal) || kmVal < 0) { setError('Kilometraje inválido'); return; }
    if (!vehicle) return;
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { error: logErr } = await supabase.from('vehicle_logs').insert({
        vehicle_id: vehicle.id,
        user_id: null,
        user_nombre: `Empleado ${empleadoId.trim()}`,
        fecha_inicio: now,
        km_inicio: kmVal,
        tipo: 'normal',
        motivo: `Registro rápido. ID empleado: ${empleadoId.trim()}`,
      });
      if (logErr) throw new Error(logErr.message);
      const { error: vUpErr } = await supabase.from('vehicles').update({
        estado: 'en_uso',
        current_user_nombre: `Empleado ${empleadoId.trim()}`,
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
    if (isNaN(kmVal) || kmVal < 0) { setError('Kilometraje final inválido'); return; }
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
                {vehicle?.matricula} — Empleado {empleadoId} — {km} km
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
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>ID Empleado</label>
                <input
                  type="text"
                  value={empleadoId}
                  onChange={(e) => setEmpleadoId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckId()}
                  placeholder="88888888"
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
                  <p className="text-xs" style={{ color: '#64748B' }}>{vehicle?.marca} {vehicle?.modelo} — Empleado {empleadoId}</p>
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

type AppView = 'login' | 'admin' | 'rrhh' | 'dashboard';

interface SessionState {
  email: string;
  role: UserRole;
  societyId: string | null;
  view: AppView;
  activeSocietyId: string | null;
}

export default function LoginPage() {
  const [selectedId, setSelectedId] = useState<string>('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [session, setSession] = useState<SessionState | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.society-dropdown')) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogin = () => {
    setLoginError('');
    const user = validUsers.find(
      (u) => u.email === email.trim().toLowerCase() && u.password === password
    );
    if (!user) {
      setLoginError('Credenciales incorrectas. Verifica tu correo y contrasena.');
      return;
    }

    let initialView: AppView;
    if (user.role === 'admin') {
      initialView = 'admin';
    } else if (user.role === 'rrhh') {
      initialView = 'rrhh';
    } else {
      initialView = 'dashboard';
      setSelectedId(user.societyId ?? '');
    }

    setSession({
      email: user.email,
      role: user.role,
      societyId: user.societyId,
      view: initialView,
      activeSocietyId: user.societyId,
    });
  };

  const handleLogout = () => {
    setSession(null);
    setSelectedId('');
    setEmail('');
    setPassword('');
    setLoginError('');
  };

  const handleNavigate = (view: 'admin' | 'rrhh' | 'society', societyId?: string) => {
    if (!session) return;
    if (view === 'society' && societyId) {
      setSelectedId(societyId);
      setSession({ ...session, view: 'dashboard', activeSocietyId: societyId });
    } else if (view === 'admin') {
      setSession({ ...session, view: 'admin' });
    } else if (view === 'rrhh') {
      setSession({ ...session, view: 'rrhh' });
    }
  };

  // Route to the right panel
  if (session) {
    if (session.view === 'admin') {
      return (
        <AdminPanel
          email={session.email}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
        />
      );
    }

    if (session.view === 'rrhh') {
      return (
        <RRHHPanel
          email={session.email}
          onLogout={handleLogout}
          onNavigateAdmin={session.role === 'admin' ? () => handleNavigate('admin') : undefined}
          isAdmin={session.role === 'admin'}
        />
      );
    }

    if (session.view === 'dashboard') {
      const theme = societies.find((s) => s.id === session.activeSocietyId) ?? null;
      if (theme) {
        return (
          <Dashboard
            theme={theme}
            onLogout={handleLogout}
            email={session.email}
            isAdmin={session.role === 'admin'}
            onNavigateAdmin={session.role === 'admin' ? () => handleNavigate('admin') : undefined}
          />
        );
      }
    }
  }

  // Login form - admin/rrhh users don't need society selector
  const isPrivilegedUser = email.trim().toLowerCase() === 'admin@empresa.com' ||
    email.trim().toLowerCase() === 'rrhh@empresa.com';
  const canLogin = isPrivilegedUser ? (email.trim() && password) : (selected && email && password);

  return (
    <div
      className="min-h-screen flex transition-all duration-700 ease-out"
      style={{ backgroundColor: selected?.bg ?? '#F8FAFC' }}
    >
      {/* Left Panel */}
      <div
        className="hidden lg:flex lg:w-[45%] relative overflow-hidden transition-all duration-700 ease-out"
        style={{
          background: selected
            ? `linear-gradient(135deg, ${selected.gradientFrom}, ${selected.gradientTo})`
            : 'linear-gradient(135deg, #334155, #1E293B)',
        }}
      >
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full border-2 border-white/20" />
          <div className="absolute bottom-32 right-16 w-96 h-96 rounded-full border border-white/10" />
          <div className="absolute top-1/2 left-1/3 w-48 h-48 rounded-full border border-white/15" />
        </div>

        <div className="relative z-10 flex flex-col justify-center items-center w-full px-16">
          <div className={`transition-all duration-500 ${isTransitioning ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}>
            <div className="flex items-center justify-center mb-10">
              <div
                className="w-28 h-28 rounded-3xl flex items-center justify-center shadow-2xl"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                {selected ? (
                  <span className="text-5xl font-bold text-white tracking-tight">{selected.logoLetter}</span>
                ) : (
                  <Building2 size={56} className="text-white/60" />
                )}
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white text-center mb-3 tracking-tight">
              {selected ? selected.name : 'Portal del Empleado'}
            </h1>
            <p className="text-white/70 text-center text-lg max-w-sm mx-auto leading-relaxed">
              {selected ? 'Accede a tu espacio de trabajo y gestiona tus recursos empresariales' : 'Selecciona tu sociedad para comenzar'}
            </p>
          </div>

          <div className="mt-14 space-y-4 w-full max-w-sm">
            {['Gestion de nominas y documentos', 'Solicitudes y aprobaciones', 'Directorio y comunicados'].map((text, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-5 py-3 rounded-xl transition-all duration-300"
                style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: selected?.accent ?? '#F59E0B' }} />
                <span className="text-white/80 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center justify-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500"
              style={{
                backgroundColor: selected ? `${selected.primary}15` : '#F1F5F9',
                border: selected ? `2px solid ${selected.primary}30` : '2px solid #E2E8F0',
              }}
            >
              {selected ? (
                <span className="text-2xl font-bold transition-colors duration-500" style={{ color: selected.primary }}>{selected.logoLetter}</span>
              ) : (
                <Building2 size={28} className="text-gray-400" />
              )}
            </div>
          </div>

          <div className="text-center lg:text-left mb-8">
            <h2 className="text-2xl font-bold tracking-tight transition-colors duration-500" style={{ color: selected?.textPrimary ?? '#1E293B' }}>
              Iniciar Sesion
            </h2>
            <p className="mt-2 text-sm transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#64748B' }}>
              Introduce tus credenciales para acceder
            </p>
          </div>

          {/* Society Selector — hidden for admin/rrhh users */}
          {!isPrivilegedUser && (
            <div className="mb-6 relative society-dropdown">
              <label className="block text-xs font-semibold mb-2 uppercase tracking-wider transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#64748B' }}>
                Sociedad
              </label>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl text-left transition-all duration-300 cursor-pointer"
                style={{
                  backgroundColor: selected ? selected.primaryLight : '#F8FAFC',
                  border: `1.5px solid ${selected ? selected.border : '#E2E8F0'}`,
                  color: selected ? selected.textPrimary : '#334155',
                }}
              >
                <div className="flex items-center gap-3">
                  {selected ? (
                    <>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${selected.primary}18` }}>
                        {(() => { const Icon = iconMap[selected.logoIcon]; return Icon ? <Icon size={16} style={{ color: selected.primary }} /> : null; })()}
                      </div>
                      <span className="font-medium">{selected.name}</span>
                    </>
                  ) : (
                    <span className="text-gray-400">Selecciona una sociedad...</span>
                  )}
                </div>
                <ChevronDown size={18} className={`transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} style={{ color: selected?.textSecondary ?? '#94A3B8' }} />
              </button>

              {dropdownOpen && (
                <div className="absolute z-50 w-full mt-2 rounded-xl overflow-hidden shadow-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  {societies.map((society) => {
                    const Icon = iconMap[society.logoIcon];
                    return (
                      <button
                        key={society.id}
                        onClick={() => { setSelectedId(society.id); setDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all duration-200 hover:bg-gray-50 cursor-pointer"
                        style={{ backgroundColor: selectedId === society.id ? society.primaryLight : 'transparent' }}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${society.primary}15` }}>
                          {Icon ? <Icon size={18} style={{ color: society.primary }} /> : null}
                        </div>
                        <div>
                          <div className="font-medium text-sm" style={{ color: society.textPrimary }}>{society.name}</div>
                          <div className="text-xs" style={{ color: society.textSecondary }}>Portal {society.logoLetter}</div>
                        </div>
                        {selectedId === society.id && <div className="ml-auto w-2 h-2 rounded-full" style={{ backgroundColor: society.primary }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Admin access hint */}
          {isPrivilegedUser && (
            <div
              className="flex items-center gap-2 px-4 py-3 rounded-xl mb-6"
              style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
            >
              <Shield size={14} style={{ color: '#DC2626' }} />
              <span className="text-xs font-medium" style={{ color: '#DC2626' }}>
                Acceso privilegiado detectado &mdash; no se requiere sociedad
              </span>
            </div>
          )}

          {/* Email */}
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#64748B' }}>
              Correo electronico
            </label>
            <div className="relative">
              <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#94A3B8' }} />
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setLoginError(''); }}
                placeholder="tu@empresa.com"
                className="w-full pl-11 pr-4 py-3.5 rounded-xl text-sm outline-none transition-all duration-300"
                style={{
                  backgroundColor: selected ? selected.primaryLight : '#F8FAFC',
                  border: `1.5px solid ${loginError ? '#EF4444' : selected ? selected.border : '#E2E8F0'}`,
                  color: selected?.textPrimary ?? '#1E293B',
                }}
              />
            </div>
          </div>

          {/* Password */}
          <div className="mb-2">
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wider transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#64748B' }}>
              Contrasena
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#94A3B8' }} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                placeholder="Introduce tu contrasena"
                className="w-full pl-11 pr-12 py-3.5 rounded-xl text-sm outline-none transition-all duration-300"
                style={{
                  backgroundColor: selected ? selected.primaryLight : '#F8FAFC',
                  border: `1.5px solid ${loginError ? '#EF4444' : selected ? selected.border : '#E2E8F0'}`,
                  color: selected?.textPrimary ?? '#1E293B',
                }}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 cursor-pointer" style={{ color: selected?.textSecondary ?? '#94A3B8' }}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {loginError && (
            <p className="text-xs text-red-500 mb-4 mt-2 pl-1">{loginError}</p>
          )}

          {/* Remember + Forgot */}
          <div className="flex items-center justify-between mb-8 mt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="w-4 h-4 rounded border transition-all duration-300 flex items-center justify-center" style={{ borderColor: selected?.border ?? '#CBD5E1', backgroundColor: selected?.primaryLight ?? '#F8FAFC' }}>
                <input type="checkbox" className="sr-only" />
              </div>
              <span className="text-xs transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#64748B' }}>Recordarme</span>
            </label>
            <button className="text-xs font-medium transition-colors duration-500 cursor-pointer" style={{ color: selected?.primary ?? '#475569' }}>
              Olvidaste tu contrasena?
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleLogin}
            disabled={!canLogin}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-white font-semibold text-sm transition-all duration-300 cursor-pointer disabled:cursor-not-allowed"
            style={{
              backgroundColor: selected ? selected.primary : isPrivilegedUser && email && password ? '#0F172A' : '#CBD5E1',
              opacity: canLogin ? 1 : 0.6,
              boxShadow: selected ? `0 4px 14px ${selected.primary}40` : isPrivilegedUser ? '0 4px 14px rgba(0,0,0,0.3)' : 'none',
            }}
          >
            Entrar
            <ArrowRight size={16} />
          </button>

          <p className="text-center mt-6 text-xs transition-colors duration-500" style={{ color: selected?.textSecondary ?? '#94A3B8' }}>
            Problemas para acceder? Contacta al departamento de TI
          </p>

          {/* Quick vehicle registration — no login required */}
          <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${selected?.border ?? '#E2E8F0'}` }}>
            <button
              onClick={() => setShowVehicleModal(true)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer hover:opacity-90"
              style={{ backgroundColor: selected ? `${selected.primary}15` : '#F1F5F9', color: selected?.primary ?? '#334155', border: `1.5px solid ${selected?.border ?? '#E2E8F0'}` }}
            >
              <Car size={16} />
              REGISTRAR VEHÍCULO
            </button>
          </div>
        </div>
      </div>

      {showVehicleModal && <VehicleRegisterModal onClose={() => setShowVehicleModal(false)} />}
    </div>
  );
}

function Dashboard({
  theme,
  onLogout,
  email,
  isAdmin,
  onNavigateAdmin,
}: {
  theme: SocietyTheme;
  onLogout: () => void;
  email: string;
  isAdmin?: boolean;
  onNavigateAdmin?: () => void;
}) {
  const Icon = iconMap[theme.logoIcon];
  const [activeTab, setActiveTab] = useState('resumen');

  const docs = mockDocuments[theme.id] ?? [];
  const devices = mockDevices[theme.id] ?? [];
  const vacations = mockVacations[theme.id] ?? { balance: { total: 0, used: 0, pending: 0 }, requests: [] };
  const certificates = mockCertificates[theme.id] ?? [];
  const exams = mockExams[theme.id] ?? [];

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: FileText },
    { id: 'certificados', label: 'Mis Certificados', icon: Award },
    { id: 'examenes', label: 'Mis Examenes', icon: ClipboardCheck },
  ];

  return (
    <div className="min-h-screen transition-all duration-700" style={{ backgroundColor: theme.bg }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 transition-all duration-700"
        style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/15 backdrop-blur-sm border border-white/20">
              {Icon ? <Icon size={20} className="text-white" /> : null}
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">{theme.name}</h1>
              <p className="text-white/60 text-xs">Portal del Empleado</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isAdmin && onNavigateAdmin && (
              <button
                onClick={onNavigateAdmin}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.3)' }}
              >
                <Shield size={12} />
                Admin
              </button>
            )}
            <button className="relative p-2 rounded-lg cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
              <Bell size={18} className="text-white/80" />
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ backgroundColor: theme.accent }}>
                3
              </div>
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{email || 'empleado@empresa.com'}</p>
              <p className="text-white/60 text-xs">{isAdmin ? 'Administrador' : 'Empleado'}</p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-300"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.textPrimary }}>
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
          className="flex gap-1 p-1 rounded-xl mb-8"
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
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 cursor-pointer"
                style={{
                  backgroundColor: isActive ? theme.primary : 'transparent',
                  color: isActive ? '#FFFFFF' : theme.textSecondary,
                  boxShadow: isActive ? `0 2px 8px ${theme.primary}30` : 'none',
                }}
              >
                <TabIcon size={16} />
                <span className="hidden sm:inline">{tab.label}</span>
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
                { label: 'Documentos', value: docs.length, color: theme.primary },
                { label: 'Dispositivos', value: devices.filter((d) => d.active).length, color: '#22C55E' },
                { label: 'Dias usados', value: vacations.balance.used, color: '#F59E0B' },
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
              <DocumentsCard documents={docs} theme={theme} />
              <DevicesCard devices={devices} theme={theme} />
              <VacationsCard balance={vacations.balance} requests={vacations.requests} theme={theme} />
            </div>
          </>
        )}

        {activeTab === 'certificados' && (
          <CertificatesCard certificates={certificates} theme={theme} />
        )}

        {activeTab === 'examenes' && (
          <ExamsCard exams={exams} theme={theme} />
        )}
      </main>
    </div>
  );
}
