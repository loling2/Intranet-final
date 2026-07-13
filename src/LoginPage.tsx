import { useState, useEffect } from 'react';
import { Building2, Landmark, Gem, Shield, ChevronDown, ChevronUp, ArrowRight, Eye, EyeOff, User, Lock, LogOut, Bell, FileText, Laptop, Award, ClipboardCheck, Car, QrCode, X, RefreshCw, AlertCircle, ShieldCheck, Search, Download, Folder, Tag, Zap, Users, KeyRound, Clock, Coffee, Play, Square, Plane, Wrench, Camera, Trash2, Hash, CheckCircle2 } from 'lucide-react';
import { societies as staticSocieties, SocietyTheme } from './themes';
import { mockDocuments, mockCertificates, mockExams } from './mockData';
import type { AppRole } from './supabaseClient';
type UserRole = AppRole;
import DocumentsCard from './DocumentsCard';
import DevicesCard from './DevicesCard';
import VehicleCard from './components/VehicleCard';
import CertificatesCard from './CertificatesCard';
import ExamsCard from './ExamsCard';
import PrevencionDocsCard from './PrevencionDocsCard';
import AdminPanel from './AdminPanel';
import RRHHPanel from './RRHHPanel';
import PrevencionPanel from './PrevencionPanel';
import AdministracionPanel from './AdministracionPanel';
import CalidadPanel from './CalidadPanel';
import CalidadDocsCard from './components/CalidadDocsCard';
import { supabase } from './supabaseClient';
import { AuthProvider } from './context/AuthContext';
import { SocietyProvider } from './context/SocietyContext';
import { downloadFromWasabi, uploadToWasabiKey } from './lib/wasabi';
import ChangePasswordModal from './components/ChangePasswordModal';
import ChangePinModal from './components/ChangePinModal';
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

type JornadaAction = 'entrada' | 'descanso' | 'fin_descanso' | 'salida' | 'permiso' | 'vehiculo' | 'incidencia_vehiculo' | 'incidencia_fichaje';

function JornadaModal({ onClose }: { onClose: () => void }) {
  // ── Global steps: pin → menu → sub-flow ──
  const [step, setStep] = useState<'pin' | 'menu' | 'vehiculo_plate' | 'vehiculo_action' | 'incidencia_vehiculo' | 'fichaje_form' | 'done'>('pin');
  const [pin, setPin] = useState('');
  const [usuarioPin, setUsuarioPin] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [doneMsg, setDoneMsg] = useState('');
  const [doneColor, setDoneColor] = useState('#16A34A');

  // ── Fichaje state ──
  const [fichajeAction, setFichajeAction] = useState<JornadaAction | null>(null);

  // ── Vehicle state ──
  const [plate, setPlate] = useState('');
  const [plateOptions, setPlateOptions] = useState<{ matricula: string; marca: string; modelo: string }[]>([]);
  const [plateDropdownOpen, setPlateDropdownOpen] = useState(false);
  const [vehicle, setVehicle] = useState<VehicleInfo | null>(null);
  const [vehicleStatus, setVehicleStatus] = useState<VehicleStatus>('libre');
  const [km, setKm] = useState('');
  const [numeroPersonas, setNumeroPersonas] = useState('1');
  const [motivoUso, setMotivoUso] = useState('');

  // ── Incident state ──
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentDescription, setIncidentDescription] = useState('');
  const [incidentPhotos, setIncidentPhotos] = useState<File[]>([]);
  const [incidentVehiclePlate, setIncidentVehiclePlate] = useState('');
  const [incidentPlateOptions, setIncidentPlateOptions] = useState<{ matricula: string; marca: string; modelo: string }[]>([]);
  const [incidentPlateDropdownOpen, setIncidentPlateDropdownOpen] = useState(false);
  const [fichajeNota, setFichajeNota] = useState('');

  // ── Plate search helper ──
  const searchPlates = async (query: string, setter: typeof setPlateOptions) => {
    if (!query.trim()) { setter([]); return; }
    const { data } = await supabase
      .from('vehicles')
      .select('matricula,marca,modelo')
      .ilike('matricula', `%${query.trim()}%`)
      .limit(6);
    setter((data ?? []) as { matricula: string; marca: string; modelo: string }[]);
  };

  const VEHICULOS_DEPARTAMENTO_ID = '172f43e7-f3dc-4207-98dc-b9c9bb6d3cfb';
  const inputStyle = { border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' };

  // ── PIN validation ──
  const handleValidatePin = async () => {
    if (!pin.trim()) return;
    setError('');
    setLoading(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc('validate_vehicle_pin', { p_pin: pin.trim() });
      if (rpcErr || !data?.[0]) { setError('PIN incorrecto o no encontrado'); return; }
      setUsuarioPin(data[0]);
      setStep('menu');
    } catch { setError('Error al validar PIN'); }
    finally { setLoading(false); }
  };

  // ── Device info helper ──
  const getDeviceInfo = () => {
    const ua = navigator.userAgent;
    const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
    const tablet = /iPad|Android(?!.*Mobile)/i.test(ua);
    const type = tablet ? 'Tablet' : mobile ? 'Móvil' : 'Escritorio';
    const browser = /Chrome/i.test(ua) ? 'Chrome' : /Firefox/i.test(ua) ? 'Firefox' : /Safari/i.test(ua) ? 'Safari' : /Edge/i.test(ua) ? 'Edge' : 'Navegador';
    const os = /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : /Android/i.test(ua) ? 'Android' : /iOS|iPhone|iPad/i.test(ua) ? 'iOS' : /Linux/i.test(ua) ? 'Linux' : 'Sistema';
    return `${type} · ${browser} · ${os}`;
  };

  const getGeolocation = (): Promise<string | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      const timer = setTimeout(() => resolve(null), 4000);
      navigator.geolocation.getCurrentPosition(
        (pos) => { clearTimeout(timer); resolve(`${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`); },
        () => { clearTimeout(timer); resolve(null); },
        { timeout: 4000, maximumAge: 60000 }
      );
    });

  // ── Fichaje save ──
  const handleSaveFichaje = async (tipo: JornadaAction) => {
    if (!usuarioPin) return;
    setError('');
    setLoading(true);
    try {
      const tipoEvento = tipo === 'entrada' ? 'entrada'
        : tipo === 'salida' ? 'salida'
        : tipo === 'descanso' ? 'pausa_inicio'
        : tipo === 'fin_descanso' ? 'pausa_fin'
        : 'permiso';

      const [ubicacion] = await Promise.all([getGeolocation()]);

      const { error: insErr } = await supabase.from('fichajes').insert({
        empleado_id: usuarioPin.empleado_id ?? null,
        nombre_empleado: usuarioPin.nombre,
        fecha: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        tipo_evento: tipoEvento,
        metodo: 'web',
        user_agent: navigator.userAgent,
        dispositivo: getDeviceInfo(),
        ubicacion,
        es_manual: false,
      });
      if (insErr) throw new Error(insErr.message);
      setDoneMsg(`${tipo === 'entrada' ? 'Entrada' : tipo === 'salida' ? 'Salida' : tipo === 'descanso' ? 'Descanso iniciado' : tipo === 'fin_descanso' ? 'Descanso finalizado' : 'Permiso'} registrado — ${usuarioPin.nombre}`);
      setDoneColor(tipo === 'salida' ? '#DC2626' : '#16A34A');
      setStep('done');
    } catch (err: any) { setError(err.message ?? 'Error al registrar'); }
    finally { setLoading(false); }
  };

  // ── Vehicle plate search ──
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
      const status: VehicleStatus = data.estado === 'libre' ? 'libre' : data.current_user_id === usuarioPin?.id ? 'en_uso_mismo' : 'en_uso_otro';
      setVehicleStatus(status);
      setStep('vehiculo_action');
    } catch (err: any) { setError(err.message ?? 'Error al buscar'); }
    finally { setLoading(false); }
  };

  // ── Vehicle start ──
  const handleVehicleStart = async () => {
    if (!vehicle || !usuarioPin) return;
    setError('');
    const kmVal = parseInt(km, 10);
    if (isNaN(kmVal)) { setError('Kilometraje inválido'); return; }
    if (kmVal < (vehicle.kilometros_actuales ?? 0)) { setError(`Los km no pueden ser inferiores a ${vehicle.kilometros_actuales}`); return; }
    if (!motivoUso.trim()) { setError('Debe indicar el motivo del uso'); return; }
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { error: logErr } = await supabase.from('vehicle_logs').insert({
        vehicle_id: vehicle.id, user_id: usuarioPin.id, user_nombre: usuarioPin.nombre,
        fecha_inicio: now, km_inicio: kmVal, numero_personas: Number(numeroPersonas),
        tipo: 'normal', motivo: motivoUso.trim(),
      });
      if (logErr) throw new Error(logErr.message);
      await supabase.from('vehicles').update({
        estado: 'en_uso', current_user_id: usuarioPin.id, current_user_nombre: usuarioPin.nombre,
        current_km_inicio: kmVal, current_fecha_inicio: now, kilometros_actuales: kmVal,
      }).eq('id', vehicle.id);
      setDoneMsg(`Uso iniciado — ${vehicle.matricula} · ${usuarioPin.nombre} · ${kmVal} km`);
      setDoneColor('#16A34A');
      setStep('done');
    } catch (err: any) { setError(err.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  // ── Vehicle finish ──
  const handleVehicleFinish = async () => {
    if (!vehicle || !usuarioPin) return;
    setError('');
    const kmVal = parseInt(km, 10);
    if (isNaN(kmVal)) { setError('Kilometraje inválido'); return; }
    if (kmVal < (vehicle.kilometros_actuales ?? 0)) { setError(`Los km no pueden ser inferiores a ${vehicle.kilometros_actuales}`); return; }
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const { data: openLog } = await supabase.from('vehicle_logs').select('id,km_inicio,fecha_inicio')
        .eq('vehicle_id', vehicle.id).is('fecha_fin', null)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (openLog) {
        const duracion = Math.round((new Date(now).getTime() - new Date(openLog.fecha_inicio).getTime()) / 60000);
        await supabase.from('vehicle_logs').update({ fecha_fin: now, km_fin: kmVal, duracion_minutos: duracion }).eq('id', openLog.id);
      }
      await supabase.from('vehicles').update({
        estado: 'libre', current_user_id: null, current_user_nombre: null,
        current_km_inicio: null, current_fecha_inicio: null, kilometros_actuales: kmVal,
      }).eq('id', vehicle.id);
      setDoneMsg(`Uso finalizado — ${vehicle.matricula} · ${kmVal} km`);
      setDoneColor('#2563EB');
      setStep('done');
    } catch (err: any) { setError(err.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  // ── Vehicle incident ──
  const handleVehicleIncident = async () => {
    const mat = (incidentVehiclePlate || vehicle?.matricula || '').trim().toUpperCase();
    if (!incidentTitle.trim() || !incidentDescription.trim()) { setError('Título y descripción requeridos'); return; }
    if (!mat) { setError('Indica la matrícula del vehículo'); return; }
    setError('');
    setLoading(true);
    try {
      // Upload photos to Wasabi under vehiculos/<matricula>/
      const photoKeys: string[] = [];
      for (const photo of incidentPhotos) {
        const ext = photo.name.split('.').pop() ?? 'jpg';
        const key = `vehiculos/${mat}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        await uploadToWasabiKey(photo, key);
        photoKeys.push(key);
      }

      const vehicleData = vehicle ?? (await supabase.from('vehicles').select('id').eq('matricula', mat).maybeSingle()).data;

      const { error: incErr } = await supabase.from('incidencias').insert({
        titulo: `[${mat}] ${incidentTitle.trim()}`,
        descripcion: incidentDescription.trim(),
        estado: 'pendiente',
        vehicle_id: vehicleData?.id ?? null,
        matricula: mat,
        creado_por_id: usuarioPin?.id ?? null,
        creado_por_nombre: usuarioPin?.nombre ?? 'Usuario',
        departamento_id: VEHICULOS_DEPARTAMENTO_ID,
        departamento_nombre: 'Vehiculos',
        fecha_creacion: new Date().toISOString(),
        fotos_urls: photoKeys,
      });
      if (incErr) throw new Error(incErr.message);
      setDoneMsg(`Incidencia registrada — ${mat} · ${photoKeys.length} foto(s)`);
      setDoneColor('#D97706');
      setStep('done');
    } catch (err: any) { setError(err.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  // ── Fichaje incident ──
  const handleFichajeIncident = async () => {
    if (!fichajeNota.trim()) { setError('Describe la incidencia'); return; }
    setError('');
    setLoading(true);
    try {
      const { error: insErr } = await supabase.from('fichajes').insert({
        empleado_id: usuarioPin?.empleado_id ?? null,
        nombre_empleado: usuarioPin?.nombre ?? 'Usuario',
        fecha: new Date().toISOString().split('T')[0],
        timestamp: new Date().toISOString(),
        tipo_evento: 'entrada',
        metodo: 'web',
        user_agent: navigator.userAgent,
        es_manual: true,
        nota_correccion: fichajeNota.trim(),
      });
      if (insErr) throw new Error(insErr.message);
      setDoneMsg('Incidencia de fichaje registrada correctamente');
      setDoneColor('#7C3AED');
      setStep('done');
    } catch (err: any) { setError(err.message ?? 'Error'); }
    finally { setLoading(false); }
  };

  

  const MENU_ACTIONS: { id: JornadaAction; label: string; icon: React.FC<{ size?: number }>; color: string; bg: string; border: string }[] = [
    { id: 'entrada',             label: 'Entrada',             icon: Play,        color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
    { id: 'descanso',            label: 'Descanso',            icon: Coffee,      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    { id: 'fin_descanso',        label: 'Fin descanso',        icon: Play,        color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
    { id: 'salida',              label: 'Salida',              icon: Square,      color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
    { id: 'permiso',             label: 'Permiso',             icon: Plane,       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
    { id: 'vehiculo',            label: 'Vehículo',            icon: Car,         color: '#0F172A', bg: '#F8FAFC', border: '#E2E8F0' },
    { id: 'incidencia_vehiculo', label: 'Incidencia Vehículo', icon: Wrench,      color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
    { id: 'incidencia_fichaje',  label: 'Incidencia Fichaje',  icon: AlertCircle, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  ];

  const errBox = error ? (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
      <AlertCircle size={13} style={{ color: '#DC2626' }} />
      <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-white" />
            <div>
              <h2 className="text-white font-semibold text-sm">Registro de Jornada</h2>
              <p className="text-white/60 text-xs">Acceso rápido sin login</p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.12)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">

          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${doneColor}18`, border: `2px solid ${doneColor}44` }}>
                <Clock size={24} style={{ color: doneColor }} />
              </div>
              <p className="font-semibold" style={{ color: doneColor }}>{doneMsg}</p>
              <button onClick={onClose} className="mt-5 w-full py-2.5 rounded-xl text-sm font-semibold cursor-pointer" style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}>
                Cerrar
              </button>
            </div>
          )}

          {step === 'pin' && (
            <>
              <div className="flex flex-col items-center py-5 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                  <KeyRound size={28} style={{ color: '#94A3B8' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#1E293B' }}>Introduce tu PIN de acceso</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>PIN</label>
                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  onKeyDown={(e) => e.key === 'Enter' && handleValidatePin()}
                  placeholder="••••••"
                  maxLength={6}
                  inputMode="numeric"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center font-mono font-bold tracking-widest"
                  style={{ ...inputStyle, fontSize: '18px' }}
                />
              </div>
              {errBox}
              <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
                <button onClick={handleValidatePin} disabled={loading || pin.length < 4} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A' }}>
                  {loading && <RefreshCw size={13} className="animate-spin" />}
                  Validar PIN
                </button>
              </div>
            </>
          )}

          {step === 'menu' && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: '#065F46', color: '#fff' }}>
                  {usuarioPin?.nombre?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{usuarioPin?.nombre}</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>Selecciona una acción</p>
              <div className="grid grid-cols-2 gap-2">
                {MENU_ACTIONS.map((action) => {
                  const Icon = action.icon;
                  const isFichaje = ['entrada', 'descanso', 'fin_descanso', 'salida', 'permiso'].includes(action.id);
                  return (
                    <button
                      key={action.id}
                      onClick={() => {
                        setError('');
                        if (isFichaje) {
                          handleSaveFichaje(action.id);
                        } else if (action.id === 'vehiculo') {
                          setStep('vehiculo_plate');
                        } else if (action.id === 'incidencia_vehiculo') {
                          setStep('incidencia_vehiculo');
                        } else if (action.id === 'incidencia_fichaje') {
                          setStep('fichaje_form');
                        }
                      }}
                      disabled={loading}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-60"
                      style={{ backgroundColor: action.bg, border: `1.5px solid ${action.border}` }}
                    >
                      <Icon size={20} style={{ color: action.color }} />
                      <span className="text-xs font-semibold" style={{ color: action.color }}>{action.label}</span>
                    </button>
                  );
                })}
              </div>
              {loading && <div className="flex items-center justify-center gap-2 py-2"><RefreshCw size={14} className="animate-spin" style={{ color: '#94A3B8' }} /><p className="text-xs" style={{ color: '#94A3B8' }}>Registrando...</p></div>}
              {errBox}
            </>
          )}

          {step === 'vehiculo_plate' && (
            <>
              <div className="flex flex-col items-center py-4 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
                  <QrCode size={28} style={{ color: '#94A3B8' }} />
                </div>
                <p className="text-sm font-medium" style={{ color: '#1E293B' }}>Introduce o selecciona la matrícula</p>
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matrícula</label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => { const v = e.target.value.toUpperCase(); setPlate(v); setPlateDropdownOpen(true); searchPlates(v, setPlateOptions); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchPlate()}
                  onFocus={() => { if (plate) { setPlateDropdownOpen(true); searchPlates(plate, setPlateOptions); } }}
                  placeholder="1234-ABC"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center font-mono font-bold tracking-widest"
                  style={{ ...inputStyle, fontSize: '16px' }}
                />
                {plateDropdownOpen && plateOptions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    {plateOptions.map((opt) => (
                      <button
                        key={opt.matricula}
                        onClick={() => { setPlate(opt.matricula); setPlateOptions([]); setPlateDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        <Car size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
                        <span className="font-mono font-bold text-sm" style={{ color: '#1E293B' }}>{opt.matricula}</span>
                        <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>{opt.marca} {opt.modelo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {errBox}
              <div className="flex gap-3">
                <button onClick={() => { setStep('menu'); setError(''); setPlateOptions([]); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Atrás</button>
                <button onClick={handleSearchPlate} disabled={loading || !plate.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#0F172A' }}>
                  {loading && <RefreshCw size={13} className="animate-spin" />}
                  Buscar
                </button>
              </div>
            </>
          )}

          {step === 'vehiculo_action' && vehicle && (
            <>
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <Car size={16} style={{ color: '#64748B' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{vehicle.matricula}</p>
                  <p className="text-xs" style={{ color: '#64748B' }}>{vehicle.marca} {vehicle.modelo} — {usuarioPin?.nombre}</p>
                </div>
                <button onClick={() => { setStep('vehiculo_plate'); setError(''); setVehicle(null); setKm(''); }} className="ml-auto text-xs cursor-pointer" style={{ color: '#94A3B8' }}>Cambiar</button>
              </div>

              {vehicleStatus === 'en_uso_otro' ? (
                <div className="rounded-xl p-4" style={{ backgroundColor: '#FEF2F2', border: '1.5px solid #FECACA' }}>
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Vehículo en uso por otro empleado</p>
                      <p className="text-xs mt-1" style={{ color: '#DC2626' }}>Asignado a: <strong>{vehicle.current_user_nombre ?? 'desconocido'}</strong></p>
                      <p className="text-xs mt-2" style={{ color: '#7F1D1D' }}>Contacta con RRHH o Informática para liberar el vehículo.</p>
                    </div>
                  </div>
                  <button onClick={() => { setStep('menu'); setError(''); }} className="mt-3 w-full py-2 rounded-lg text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Volver al menú</button>
                </div>
              ) : (
                <>
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
                    <input type="number" value={km} onChange={(e) => setKm(e.target.value)} placeholder={String(vehicle.kilometros_actuales ?? 0)} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                  </div>
                  {vehicleStatus === 'libre' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Número de personas</label>
                      <input type="number" min="1" max="9" value={numeroPersonas} onChange={(e) => setNumeroPersonas(e.target.value)} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
                    </div>
                  )}
                  {vehicleStatus === 'libre' && (
                    <div>
                      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Motivo del uso</label>
                      <textarea value={motivoUso} onChange={(e) => setMotivoUso(e.target.value)} placeholder="Ej: Salida de usuarios a la playa..." rows={2} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
                    </div>
                  )}
                  {errBox}
                  <div className="flex gap-3">
                    <button onClick={() => { setStep('vehiculo_plate'); setError(''); setKm(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Atrás</button>
                    {vehicleStatus === 'libre' ? (
                      <button onClick={handleVehicleStart} disabled={loading || !km} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#16A34A' }}>
                        {loading && <RefreshCw size={13} className="animate-spin" />}
                        Empezar uso
                      </button>
                    ) : (
                      <button onClick={handleVehicleFinish} disabled={loading || !km} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#2563EB' }}>
                        {loading && <RefreshCw size={13} className="animate-spin" />}
                        Terminar uso
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {step === 'incidencia_vehiculo' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}>
                <Wrench size={14} style={{ color: '#EA580C' }} />
                <p className="text-xs font-semibold" style={{ color: '#EA580C' }}>Incidencia de vehículo</p>
              </div>
              <div className="relative">
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matrícula</label>
                <input
                  type="text"
                  value={incidentVehiclePlate || vehicle?.matricula || ''}
                  onChange={(e) => { const v = e.target.value.toUpperCase(); setIncidentVehiclePlate(v); setIncidentPlateDropdownOpen(true); searchPlates(v, setIncidentPlateOptions); }}
                  onFocus={() => { const v = incidentVehiclePlate || vehicle?.matricula || ''; if (v) { setIncidentPlateDropdownOpen(true); searchPlates(v, setIncidentPlateOptions); } }}
                  placeholder="1234-ABC"
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none font-mono font-bold tracking-widest"
                  style={inputStyle}
                />
                {incidentPlateDropdownOpen && incidentPlateOptions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 rounded-xl overflow-hidden shadow-lg" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    {incidentPlateOptions.map((opt) => (
                      <button
                        key={opt.matricula}
                        onClick={() => { setIncidentVehiclePlate(opt.matricula); setIncidentPlateOptions([]); setIncidentPlateDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer text-left"
                      >
                        <Car size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />
                        <span className="font-mono font-bold text-sm" style={{ color: '#1E293B' }}>{opt.matricula}</span>
                        <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>{opt.marca} {opt.modelo}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Título de la incidencia</label>
                <input type="text" value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} placeholder="Ej: Luz de motor encendida" className="w-full px-4 py-2.5 rounded-xl text-sm outline-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Descripción</label>
                <textarea value={incidentDescription} onChange={(e) => setIncidentDescription(e.target.value)} placeholder="Describe el problema..." rows={3} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Fotos (opcional)</label>
                <label
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: incidentPhotos.length >= 5 ? '#F1F5F9' : '#F1F5F9',
                    border: '1.5px dashed #CBD5E1',
                    opacity: incidentPhotos.length >= 5 ? 0.5 : 1,
                    pointerEvents: incidentPhotos.length >= 5 ? 'none' : 'auto',
                  }}
                >
                  <Camera size={16} style={{ color: '#94A3B8' }} />
                  <span className="text-sm" style={{ color: '#64748B' }}>
                    {incidentPhotos.length >= 5 ? 'Máximo 5 fotos alcanzado' : `Añadir fotos (${incidentPhotos.length}/5)`}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const nuevas = Array.from(e.target.files ?? []);
                      setIncidentPhotos((prev) => [...prev, ...nuevas].slice(0, 5));
                    }}
                  />
                </label>
                {incidentPhotos.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {incidentPhotos.map((f, i) => (
                      <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                        <span>{f.name}</span>
                        <button onClick={() => setIncidentPhotos((prev) => prev.filter((_, j) => j !== i))} className="cursor-pointer"><Trash2 size={11} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {errBox}
              <div className="flex gap-3">
                <button onClick={() => { setStep('menu'); setError(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Atrás</button>
                <button onClick={handleVehicleIncident} disabled={loading || !incidentTitle.trim() || !incidentDescription.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#EA580C' }}>
                  {loading && <RefreshCw size={13} className="animate-spin" />}
                  Enviar incidencia
                </button>
              </div>
            </>
          )}

          {step === 'fichaje_form' && (
            <>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                <AlertCircle size={14} style={{ color: '#7C3AED' }} />
                <p className="text-xs font-semibold" style={{ color: '#7C3AED' }}>Incidencia de fichaje</p>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Describe la incidencia</label>
                <textarea value={fichajeNota} onChange={(e) => setFichajeNota(e.target.value)} placeholder="Ej: Olvidé fichar la entrada a las 8:00..." rows={4} className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none" style={inputStyle} />
              </div>
              {errBox}
              <div className="flex gap-3">
                <button onClick={() => { setStep('menu'); setError(''); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Atrás</button>
                <button onClick={handleFichajeIncident} disabled={loading || !fichajeNota.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2" style={{ backgroundColor: '#7C3AED' }}>
                  {loading && <RefreshCw size={13} className="animate-spin" />}
                  Guardar incidencia
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}


type AppView = 'login' | 'admin' | 'rrhh' | 'prevencion' | 'dashboard' | 'supervisor' | 'administracion' | 'calidad';

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
  const [impersonating, setImpersonating] = useState<{ nombre: string; email: string; userId: string } | null>(null);


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
      } else if (resolvedRole === 'calidad') {
        initialView = 'calidad';
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

  const handleImpersonate = async (userId: string, societyId: string | null) => {
    if (!session) return;
    const { data: targetProfile } = await supabase
      .from('user_profiles')
      .select('nombre, email, societies')
      .eq('id', userId)
      .maybeSingle();
    if (!targetProfile) return;
    const resolvedSociety = societyId ?? targetProfile.societies?.[0] ?? societies[0]?.id ?? null;
    setImpersonating({ nombre: targetProfile.nombre, email: targetProfile.email ?? '', userId });
    setSession({ ...session, view: 'dashboard', activeSocietyId: resolvedSociety });
    if (resolvedSociety) setSelectedId(resolvedSociety);
  };

  const handleStopImpersonating = () => {
    if (!session) return;
    setImpersonating(null);
    setSession({ ...session, view: 'admin' });
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
              onImpersonate={handleImpersonate}
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
              role={session.role}
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
              role="supervisor"
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

    if (session.view === 'calidad') {
      return (
        <AuthProvider>
          <SocietyProvider defaultSocietyId={session.activeSocietyId ?? undefined}>
            <CalidadPanel
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
          session.role === 'calidad'        ? { label: 'Volver a Calidad',        view: 'calidad',        color: '#7DD3FC', border: 'rgba(3,105,161,0.3)'   } :
          null;

        return (
          <>
            {impersonating && (
              <div
                className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium"
                style={{ backgroundColor: '#1E3A5F', color: '#BFDBFE', borderBottom: '1px solid #2563EB' }}
              >
                <div className="flex items-center gap-2">
                  <Eye size={14} style={{ color: '#60A5FA' }} />
                  <span>Viendo como: <strong style={{ color: '#fff' }}>{impersonating.nombre}</strong></span>
                </div>
                <button
                  onClick={handleStopImpersonating}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-80"
                  style={{ backgroundColor: '#2563EB', color: '#fff' }}
                >
                  <X size={12} />
                  Volver al Admin
                </button>
              </div>
            )}
            <div style={impersonating ? { paddingTop: '40px' } : undefined}>
              <Dashboard
                theme={theme}
                onLogout={handleLogout}
                email={impersonating ? impersonating.email : session.email}
                impersonatingUserId={impersonating?.userId}
                isAdmin={!impersonating && session.role === 'admin'}
                onNavigateAdmin={!impersonating && session.role === 'admin' ? () => handleNavigate('admin') : undefined}
                onNavigateRrhh={!impersonating && session.role === 'rrhh' ? () => handleNavigate('rrhh') : undefined}
                onNavigateSupervisor={!impersonating && session.role === 'supervisor' ? () => handleNavigate('supervisor') : undefined}
                onNavigateBack={!impersonating && backNav ? () => handleNavigate(backNav.view) : undefined}
                backLabel={backNav?.label}
                backColor={backNav?.color}
                backBorder={backNav?.border}
              />
            </div>
          </>
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
              <Clock size={15} />
              REGISTRO DE JORNADA
            </button>
          </div>
        </div>
      </div>

      {showVehicleModal && <JornadaModal onClose={() => setShowVehicleModal(false)} />}
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
  society_id: string;   // text (UUID string) from updated RPC
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
  sociedad_nombre: string;
}

function MisNominasView({ theme, userId: propUserId }: { theme: SocietyTheme; userId?: string | null }) {
  const [nominas, setNominas] = useState<NominaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const currentYear = new Date().getFullYear();
  const [filterAnio, setFilterAnio] = useState(String(currentYear));

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const resolvedUserId = propUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
        if (!resolvedUserId || cancelled) { setLoading(false); return; }

        const { data: empData } = await supabase
          .from('empleados')
          .select('dni')
          .eq('user_id', resolvedUserId)
          .maybeSingle();

        const resolvedDni = empData?.dni ?? (await supabase.from('user_profiles').select('dni').eq('id', resolvedUserId).maybeSingle()).data?.dni;
        if (!resolvedDni || cancelled) { setLoading(false); return; }

        const { data } = await supabase
          .from('nominas')
          .select('id, dni, anio, mes, wasabi_key, nombre_archivo, tamano_bytes, created_at, sociedad_nombre')
          .eq('dni', resolvedDni)
          .order('anio', { ascending: false })
          .order('mes', { ascending: false });

        if (!cancelled) setNominas((data ?? []) as NominaRow[]);
      } catch { /* silent */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [propUserId]);

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
        <select
          value={filterAnio}
          onChange={(e) => setFilterAnio(e.target.value)}
          className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
          style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
        >
          <option value={String(currentYear)}>{currentYear}</option>
          <option value={String(currentYear - 1)}>{currentYear - 1}</option>
        </select>
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
            return Array.from(byYear.entries())
              .sort(([a], [b]) => b - a)
              .map(([anio, rows]) => (
              <div key={anio}>
                <div className="px-5 py-2.5 flex items-center gap-2" style={{ backgroundColor: theme.primaryLight, borderBottom: `1px solid ${theme.border}` }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: theme.primary }}>{anio}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: theme.bg, color: theme.textSecondary }}>{rows.length}</span>
                </div>
                <div className="divide-y" style={{ borderColor: theme.border }}>
                  {[...rows].sort((a, b) => b.mes - a.mes).map((n) => {
                    const isInProgress = downloading.has(n.id);
                    return (
                      <div key={n.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: theme.primaryLight, border: `1px solid ${theme.border}` }}>
                          <FileText size={16} style={{ color: theme.primary }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>
                              {n.nombre_archivo || `Nomina ${MES_NOMBRES_EMP[n.mes]} ${n.anio}`}
                            </p>
                            {n.sociedad_nombre && (
                              <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
                                {n.sociedad_nombre}
                              </span>
                            )}
                          </div>
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
  impersonatingUserId,
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
  impersonatingUserId?: string;
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
  const [showChangePin, setShowChangePin] = useState(false);
  const [activeDeviceCount, setActiveDeviceCount] = useState<number | null>(null);
  const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
  const [notifications, setNotifications] = useState<{ id: string; tipo: string; titulo: string; descripcion: string; leida: boolean; created_at: string }[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  useEffect(() => {
    if (impersonatingUserId) {
      setCurrentUserId(impersonatingUserId);
      supabase.from('user_profiles').select('nombre').eq('id', impersonatingUserId).maybeSingle()
        .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      }
    });
  }, [email, impersonatingUserId]);

useEffect(() => {
  (async () => {
    const resolvedUserId = impersonatingUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!resolvedUserId) { setActiveDeviceCount(0); return; }

    const { data: empleadoData } = await supabase
      .from('empleados')
      .select('id')
      .eq('user_id', resolvedUserId)
      .maybeSingle();

    const realEmpleadoId = empleadoData?.id ?? resolvedUserId;

    const { count, error } = await supabase
      .from('dispositivos')
      .select('*', { count: 'exact', head: true })
      .eq('activo', true)
      .eq('empleado_id', realEmpleadoId);

    setActiveDeviceCount(!error && count !== null ? count : 0);
  })();
}, [impersonatingUserId]);

useEffect(() => {
  (async () => {
    const resolvedUserId = impersonatingUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!resolvedUserId) { setAssignedVehicle(null); return; }
    const { data } = await supabase.from('vehicles').select('*').eq('current_user_id', resolvedUserId).maybeSingle();
    setAssignedVehicle(data);
  })();
}, [impersonatingUserId]);

useEffect(() => {
  (async () => {
    const resolvedUserId = impersonatingUserId ?? (await supabase.auth.getUser()).data.user?.id ?? null;
    if (!resolvedUserId) return;
    const { data } = await supabase
      .from('notificaciones_empleado')
      .select('id, tipo, titulo, descripcion, leida, created_at')
      .eq('user_id', resolvedUserId)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications(data ?? []);
  })();
}, [impersonatingUserId]);

  
  const certificates = mockCertificates[theme.id] ?? [];
  const exams = mockExams[theme.id] ?? [];

  const tabs = [
    { id: 'resumen', label: 'Resumen', icon: FileText },
    { id: 'nominas', label: 'Mis Nominas', icon: Zap },
    { id: 'calidad', label: 'Calidad', icon: ShieldCheck },
    { id: 'prevencion', label: 'Documentos PRL', icon: ShieldCheck },
    { id: 'certificados', label: 'Mis Certificados', icon: Award },
    { id: 'examenes', label: 'Mis Examenes', icon: ClipboardCheck },
    { id: 'incidencias', label: 'Incidencias', icon: AlertCircle },
  ];

  return (
    <div className="min-h-screen transition-all duration-700" style={{ backgroundColor: theme.bg }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {showChangePin && <ChangePinModal onClose={() => setShowChangePin(false)} />}
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
            <div className="relative">
              <button
                onClick={() => {
                  setShowNotifDropdown((v) => !v);
                  if (!showNotifDropdown && notifications.some(n => !n.leida)) {
                    const unreadIds = notifications.filter(n => !n.leida).map(n => n.id);
                    supabase.from('notificaciones_empleado').update({ leida: true }).in('id', unreadIds).then(() => {
                      setNotifications(prev => prev.map(n => ({ ...n, leida: true })));
                    });
                  }
                }}
                className="relative p-2 rounded-lg cursor-pointer flex-shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
              >
                <Bell size={16} className="text-white/80" />
                {notifications.filter(n => !n.leida).length > 0 && (
                  <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: theme.accent }}>
                    {notifications.filter(n => !n.leida).length}
                  </div>
                )}
              </button>

              {showNotifDropdown && (
                <>
                  <div className="fixed inset-0 z-[90]" onClick={() => setShowNotifDropdown(false)} />
                  <div
                    className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-[100] overflow-hidden"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                  >
                    <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
                      <div className="flex items-center gap-2">
                        <Bell size={14} style={{ color: '#0F172A' }} />
                        <span className="text-sm font-semibold" style={{ color: '#0F172A' }}>Notificaciones</span>
                      </div>
                      <button onClick={() => setShowNotifDropdown(false)} className="cursor-pointer" style={{ color: '#94A3B8' }}>
                        <X size={14} />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="py-10 text-center">
                          <CheckCircle2 size={28} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
                          <p className="text-xs" style={{ color: '#94A3B8' }}>Sin notificaciones</p>
                        </div>
                      ) : (
                        notifications.map((n) => (
                          <div
                            key={n.id}
                            className="px-4 py-3 flex gap-3 items-start"
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: n.leida ? '#FFFFFF' : '#F0F9FF',
                            }}
                          >
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                              style={{ backgroundColor: n.tipo === 'nomina' ? '#DBEAFE' : '#D1FAE5' }}
                            >
                              {n.tipo === 'nomina'
                                ? <Zap size={12} style={{ color: '#1D4ED8' }} />
                                : <ShieldCheck size={12} style={{ color: '#065F46' }} />
                              }
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold truncate" style={{ color: '#0F172A' }}>{n.titulo}</p>
                              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: '#64748B' }}>{n.descripcion}</p>
                              <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                                {new Date(n.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
                              </p>
                            </div>
                            {!n.leida && (
                              <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: theme.accent }} />
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="text-right hidden md:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{email || 'empleado@empresa.com'}</p>
              <p className="text-white/60 text-xs">Empleado</p>
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
              onClick={() => setShowChangePin(true)}
              className="flex items-center gap-1.5 px-2 sm:px-3 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-300 flex-shrink-0"
              style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}
            >
              <Hash size={13} />
              <span className="hidden lg:inline">Cambiar PIN</span>
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
              Bienvenido, {currentUserNombre || email.split('@')[0]}
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
           <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
              <DocumentsCard theme={theme} userEmail={email} userId={currentUserId} societyId={theme.id} />
              <DevicesCard theme={theme} userId={currentUserId} />
              <PrevencionDocsCard theme={theme} userEmail={email} />
             <VehicleCard vehicle={assignedVehicle} />
            </div>
          </>
        )}

        {activeTab === 'nominas' && (
          <MisNominasView theme={theme} userId={currentUserId} />
        )}

        {activeTab === 'prevencion' && (
          <PrevencionDocsFullView theme={theme} />
        )}

        {activeTab === 'calidad' && (
          <div className="grid gap-6">
            <CalidadDocsCard theme={theme} societyId={session?.societyId ?? theme.id} />
          </div>
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
