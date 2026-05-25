import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Car, Search, Plus, QrCode, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, X, Activity, Unlock, Lock,
  Calendar, Gauge, AlertCircle, History, ToggleLeft, ToggleRight, Filter
} from 'lucide-react';
import { supabase, Vehicle, VehicleLog, UserProfile } from './supabaseClient';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';
import { writeAuditLog } from './lib/auditLog';
import { AppRole } from './context/AuthContext';

const isITVExpired = (fecha: string) => new Date(fecha) < new Date();
const isITVNearExpiry = (fecha: string) => {
  const diff = (new Date(fecha).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return diff <= 30 && diff > 0;
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface CheckInModalProps {
  vehicle: Vehicle;
  profile: UserProfile;
  onClose: () => void;
  onDone: () => void;
}

function CheckInModal({ vehicle, profile, onClose, onDone }: CheckInModalProps) {
  const [kmInicio, setKmInicio] = useState(String(vehicle.kilometros_actuales));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [manualPlate, setManualPlate] = useState('');

  const handleCheckIn = async () => {
    const km = parseInt(kmInicio, 10);
    if (isNaN(km) || km < vehicle.kilometros_actuales) {
      setError(`Los km de inicio deben ser >= ${vehicle.kilometros_actuales}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: logErr } = await supabase.from('vehicle_logs').insert({
        vehicle_id: vehicle.id,
        user_id: profile.id,
        user_nombre: profile.nombre,
        fecha_inicio: new Date().toISOString(),
        km_inicio: km,
        tipo: 'normal',
      });
      if (logErr) throw logErr;

      const { error: vErr } = await supabase
        .from('vehicles')
        .update({
          estado: 'en_uso',
          current_user_id: profile.id,
          current_user_nombre: profile.nombre,
          current_km_inicio: km,
          current_fecha_inicio: new Date().toISOString(),
          kilometros_actuales: km,
        })
        .eq('id', vehicle.id);
      if (vErr) throw vErr;

      await writeAuditLog({
        evento: 'vehicle_checkin',
        descripcion: `Check-in de ${vehicle.matricula} por ${profile.nombre}`,
        autor: profile,
        entidad: 'vehicle',
        entidad_id: vehicle.id,
        metadata: { matricula: vehicle.matricula, km_inicio: km },
        society_id: vehicle.society_id,
      });

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="Check-In de Vehículo" subtitle={`${vehicle.marca} ${vehicle.modelo} · ${vehicle.matricula}`} onClose={onClose} accentColor="#16A34A">
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#166534' }}>Vehiculo disponible</p>
            <p className="text-xs" style={{ color: '#4ADE80' }}>Km actuales: {vehicle.kilometros_actuales.toLocaleString()} km</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Km de Inicio</label>
          <div className="relative">
            <Gauge size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="number"
              value={kmInicio}
              onChange={(e) => setKmInicio(e.target.value)}
              min={vehicle.kilometros_actuales}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Minimo: {vehicle.kilometros_actuales.toLocaleString()} km</p>
        </div>

        {error && <ErrorBanner msg={error} />}

        <ModalActions onCancel={onClose} onConfirm={handleCheckIn} loading={loading} confirmLabel="Confirmar Check-In" confirmColor="#16A34A" />
      </div>
    </ModalWrapper>
  );
}

interface CheckOutModalProps {
  vehicle: Vehicle;
  profile: UserProfile;
  log: VehicleLog | null;
  onClose: () => void;
  onDone: () => void;
}

function CheckOutModal({ vehicle, profile, log, onClose, onDone }: CheckOutModalProps) {
  const [kmFin, setKmFin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCheckOut = async () => {
    const km = parseInt(kmFin, 10);
    const kmIni = vehicle.current_km_inicio ?? 0;
    if (isNaN(km) || km <= kmIni || km <= vehicle.kilometros_actuales) {
      setError(`Los km finales deben ser > ${Math.max(kmIni, vehicle.kilometros_actuales)}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const fechaFin = new Date();
      const fechaInicio = vehicle.current_fecha_inicio ? new Date(vehicle.current_fecha_inicio) : fechaFin;
      const duracion = Math.round((fechaFin.getTime() - fechaInicio.getTime()) / 60000);

      if (log) {
        const { error: logErr } = await supabase
          .from('vehicle_logs')
          .update({ fecha_fin: fechaFin.toISOString(), km_fin: km, duracion_minutos: duracion })
          .eq('id', log.id);
        if (logErr) throw logErr;
      }

      const { error: vErr } = await supabase
        .from('vehicles')
        .update({
          estado: 'libre',
          current_user_id: null,
          current_user_nombre: null,
          current_km_inicio: null,
          current_fecha_inicio: null,
          kilometros_actuales: km,
        })
        .eq('id', vehicle.id);
      if (vErr) throw vErr;

      await writeAuditLog({
        evento: 'vehicle_checkout',
        descripcion: `Check-out de ${vehicle.matricula} por ${profile.nombre}. Duracion: ${formatDuration(duracion)}`,
        autor: profile,
        entidad: 'vehicle',
        entidad_id: vehicle.id,
        metadata: { matricula: vehicle.matricula, km_fin: km, duracion_minutos: duracion },
        society_id: vehicle.society_id,
      });

      onDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="Check-Out de Vehículo" subtitle={`${vehicle.marca} ${vehicle.modelo} · ${vehicle.matricula}`} onClose={onClose} accentColor="#0EA5E9">
      <div className="space-y-4">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <Activity size={16} style={{ color: '#2563EB' }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#1E40AF' }}>En uso por ti</p>
            <p className="text-xs" style={{ color: '#3B82F6' }}>Inicio: {vehicle.current_fecha_inicio ? new Date(vehicle.current_fecha_inicio).toLocaleString('es-ES') : '—'}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Km Finales</label>
          <div className="relative">
            <Gauge size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="number"
              value={kmFin}
              onChange={(e) => setKmFin(e.target.value)}
              min={(vehicle.current_km_inicio ?? 0) + 1}
              placeholder={`> ${vehicle.current_km_inicio ?? vehicle.kilometros_actuales}`}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>
        </div>

        {error && <ErrorBanner msg={error} />}

        <ModalActions onCancel={onClose} onConfirm={handleCheckOut} loading={loading} confirmLabel="Confirmar Check-Out" confirmColor="#0EA5E9" />
      </div>
    </ModalWrapper>
  );
}

interface BlockedModalProps {
  vehicle: Vehicle;
  profile: UserProfile;
  canRelease: boolean;
  onClose: () => void;
  onReleased: () => void;
}

function BlockedModal({ vehicle, profile, canRelease, onClose, onReleased }: BlockedModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleForceRelease = async () => {
    setLoading(true);
    setError('');
    try {
      const fechaFin = new Date();
      // Create incident log
      const { error: logErr } = await supabase.from('vehicle_logs').insert({
        vehicle_id: vehicle.id,
        user_id: vehicle.current_user_id!,
        user_nombre: vehicle.current_user_nombre ?? 'Desconocido',
        fecha_inicio: vehicle.current_fecha_inicio ?? fechaFin.toISOString(),
        fecha_fin: fechaFin.toISOString(),
        km_inicio: vehicle.current_km_inicio ?? vehicle.kilometros_actuales,
        km_fin: null,
        duracion_minutos: vehicle.current_fecha_inicio
          ? Math.round((fechaFin.getTime() - new Date(vehicle.current_fecha_inicio).getTime()) / 60000)
          : null,
        tipo: 'incidencia',
        motivo: 'Liberacion manual por admin/RRHH',
        liberado_por: profile.id,
        liberado_por_nombre: profile.nombre,
      });
      if (logErr) throw logErr;

      const { error: vErr } = await supabase
        .from('vehicles')
        .update({
          estado: 'libre',
          current_user_id: null,
          current_user_nombre: null,
          current_km_inicio: null,
          current_fecha_inicio: null,
        })
        .eq('id', vehicle.id);
      if (vErr) throw vErr;

      await writeAuditLog({
        evento: 'vehicle_forced_release',
        descripcion: `Liberacion forzada de ${vehicle.matricula} por ${profile.nombre}. Estaba en uso por ${vehicle.current_user_nombre}`,
        autor: profile,
        entidad: 'vehicle',
        entidad_id: vehicle.id,
        metadata: {
          matricula: vehicle.matricula,
          usuario_anterior: vehicle.current_user_nombre,
          usuario_anterior_id: vehicle.current_user_id,
          motivo: 'Liberacion manual',
        },
        society_id: vehicle.society_id,
      });

      onReleased();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="Vehículo en Uso" subtitle={`${vehicle.marca} ${vehicle.modelo} · ${vehicle.matricula}`} onClose={onClose} accentColor="#EF4444">
      <div className="space-y-4">
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} style={{ color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
          <div>
            <p className="text-xs font-semibold" style={{ color: '#991B1B' }}>Este vehiculo ya esta siendo utilizado.</p>
            <p className="text-xs mt-1" style={{ color: '#DC2626' }}>Contacte con RRHH o Informatica para liberar el vehiculo.</p>
          </div>
        </div>

        <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <div className="flex justify-between text-xs">
            <span style={{ color: '#94A3B8' }}>Usuario actual</span>
            <span className="font-semibold" style={{ color: '#1E293B' }}>{vehicle.current_user_nombre ?? '—'}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: '#94A3B8' }}>Inicio de uso</span>
            <span className="font-semibold" style={{ color: '#1E293B' }}>
              {vehicle.current_fecha_inicio ? new Date(vehicle.current_fecha_inicio).toLocaleString('es-ES') : '—'}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: '#94A3B8' }}>Km al inicio</span>
            <span className="font-semibold" style={{ color: '#1E293B' }}>{vehicle.current_km_inicio?.toLocaleString() ?? '—'} km</span>
          </div>
        </div>

        {error && <ErrorBanner msg={error} />}

        {canRelease && (
          <div className="pt-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <AlertCircle size={13} style={{ color: '#D97706' }} />
              <p className="text-xs" style={{ color: '#92400E' }}>Como admin/RRHH puedes liberar forzosamente este vehiculo. Se generara un registro de incidencia.</p>
            </div>
            <button
              onClick={handleForceRelease}
              disabled={loading}
              className="w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#EF4444', color: '#FFFFFF', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
            >
              {loading ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={14} />}
              Liberar Vehiculo
            </button>
          </div>
        )}

        <button onClick={onClose} className="w-full py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
          Cerrar
        </button>
      </div>
    </ModalWrapper>
  );
}

interface AddVehicleModalProps {
  profile: UserProfile;
  societyId: string;
  onClose: () => void;
  onAdded: () => void;
}

function AddVehicleModal({ profile, societyId, onClose, onAdded }: AddVehicleModalProps) {
  const [form, setForm] = useState({ matricula: '', marca: '', modelo: '', kilometros_actuales: '', fecha_itv: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!form.matricula || !form.marca || !form.modelo || !form.fecha_itv) {
      setError('Rellena todos los campos obligatorios');
      return;
    }
    const km = parseInt(form.kilometros_actuales || '0', 10);
    if (isNaN(km) || km < 0) { setError('Kilometraje invalido'); return; }
    setLoading(true);
    setError('');
    try {
      const { data, error: err } = await supabase
        .from('vehicles')
        .insert({
          matricula: form.matricula.trim().toUpperCase(),
          marca: form.marca.trim(),
          modelo: form.modelo.trim(),
          kilometros_actuales: km,
          fecha_itv: form.fecha_itv,
          estado: 'libre',
          society_id: societyId,
        })
        .select()
        .single();

      if (err) throw err;
      if (!data) throw new Error('El vehículo no se pudo confirmar tras la inserción');

      await writeAuditLog({
        evento: 'vehicle_created',
        descripcion: `Vehículo creado: ${data.matricula} (${data.marca} ${data.modelo}) por ${profile.nombre}`,
        autor: profile,
        entidad: 'vehicle',
        entidad_id: data.id,
        metadata: { matricula: data.matricula, marca: data.marca, modelo: data.modelo, km },
        society_id: societyId,
      });

      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el vehículo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalWrapper title="Añadir Vehículo" subtitle="Registrar nuevo vehículo en el sistema" onClose={onClose} accentColor="#0F172A">
      <div className="space-y-4">
        {[
          { key: 'matricula', label: 'Matricula *', placeholder: '1234-ABC' },
          { key: 'marca', label: 'Marca *', placeholder: 'Volkswagen' },
          { key: 'modelo', label: 'Modelo *', placeholder: 'Golf' },
          { key: 'kilometros_actuales', label: 'Kilometros Actuales', placeholder: '0', type: 'number' },
          { key: 'fecha_itv', label: 'Fecha ITV *', type: 'date' },
        ].map((f) => (
          <div key={f.key}>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>{f.label}</label>
            <input
              type={f.type ?? 'text'}
              value={form[f.key as keyof typeof form]}
              onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>
        ))}
        {error && <ErrorBanner msg={error} />}
        <ModalActions onCancel={onClose} onConfirm={handleAdd} loading={loading} confirmLabel="Añadir Vehiculo" />
      </div>
    </ModalWrapper>
  );
}

// Shared modal components
function ModalWrapper({ title, subtitle, onClose, accentColor, children }: { title: string; subtitle: string; onClose: () => void; accentColor: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}>
          <div>
            <h2 className="text-white font-semibold">{title}</h2>
            <p className="text-white/70 text-xs">{subtitle}</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <X size={15} />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
      <AlertCircle size={13} style={{ color: '#DC2626' }} />
      <p className="text-xs" style={{ color: '#DC2626' }}>{msg}</p>
    </div>
  );
}

function ModalActions({ onCancel, onConfirm, loading, confirmLabel, confirmColor = '#0F172A' }: { onCancel: () => void; onConfirm: () => void; loading: boolean; confirmLabel: string; confirmColor?: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
        Cancelar
      </button>
      <button
        onClick={onConfirm}
        disabled={loading}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
        style={{ backgroundColor: confirmColor }}
      >
        {loading && <RefreshCw size={14} className="animate-spin" />}
        {confirmLabel}
      </button>
    </div>
  );
}

// QR / Plate scanner modal
interface ScanModalProps {
  profile: UserProfile;
  onFound: (plate: string) => void;
  onClose: () => void;
}

function ScanModal({ onFound, onClose }: ScanModalProps) {
  const [plate, setPlate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    const trimmed = plate.trim().toUpperCase();
    if (!trimmed) { setError('Introduce una matrícula'); return; }
    setLoading(true);
    setError('');
    // Verify vehicle exists in DB before proceeding
    const { data, error: dbErr } = await supabase
      .from('vehicles')
      .select('id')
      .eq('matricula', trimmed)
      .maybeSingle();
    setLoading(false);
    if (dbErr) { setError('Error al buscar el vehículo'); return; }
    if (!data) { setError(`No se encontró ningún vehículo con matrícula "${trimmed}"`); return; }
    onFound(trimmed);
  };

  return (
    <ModalWrapper title="Buscar Vehículo" subtitle="Introduce la matrícula del vehículo" onClose={onClose} accentColor="#0F172A">
      <div className="space-y-5">
        <div className="flex flex-col items-center py-6 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3" style={{ backgroundColor: '#F1F5F9' }}>
            <QrCode size={32} style={{ color: '#94A3B8' }} />
          </div>
          <p className="text-sm font-medium" style={{ color: '#1E293B' }}>Escaneo QR (simulado)</p>
          <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Introduce la matricula manualmente</p>
        </div>
        <div>
          <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Matricula</label>
          <input
            type="text"
            value={plate}
            onChange={(e) => { setPlate(e.target.value.toUpperCase()); setError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="1234-ABC"
            className="w-full px-4 py-2.5 rounded-xl text-sm outline-none text-center font-mono font-bold tracking-widest"
            style={{ border: `1.5px solid ${error ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC', fontSize: '16px' }}
          />
        </div>
        {error && <ErrorBanner msg={error} />}
        <ModalActions onCancel={onClose} onConfirm={handleSearch} loading={loading} confirmLabel="Buscar Vehículo" />
      </div>
    </ModalWrapper>
  );
}

interface Props {
  currentUserRole: AppRole;
  userEmail?: string;
}

type ActiveModal =
  | { type: 'scan' }
  | { type: 'checkin'; vehicle: Vehicle }
  | { type: 'checkout'; vehicle: Vehicle; log: VehicleLog | null }
  | { type: 'blocked'; vehicle: Vehicle }
  | { type: 'add' }
  | { type: 'logs'; vehicle: Vehicle };

export default function VehiclesModule({ currentUserRole, userEmail }: Props) {
  const { profile: authProfile } = useAuth();
  const { activeSocietyId } = useSociety();

  // Use real profile when available; otherwise build a synthetic one from the email prop
  const profile: UserProfile = authProfile ?? {
    id: 'local',
    nombre: userEmail?.split('@')[0] ?? currentUserRole,
    email: userEmail ?? `${currentUserRole}@empresa.com`,
    role: currentUserRole,
    activo: true,
    societies: [],
    invited_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [logs, setLogs] = useState<VehicleLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');
  const [logSearchPlate, setLogSearchPlate] = useState('');
  const [modal, setModal] = useState<ActiveModal | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const canManage = currentUserRole === 'admin' || currentUserRole === 'rrhh';

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('vehicles').select('*').order('matricula');
    if (activeSocietyId) query = query.eq('society_id', activeSocietyId);
    const { data } = await query;
    setVehicles((data ?? []) as Vehicle[]);
    setLoading(false);
  }, [activeSocietyId]);

  const loadLogs = useCallback(async () => {
    const { data } = await supabase
      .from('vehicle_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    setLogs((data ?? []) as VehicleLog[]);
  }, []);

  useEffect(() => {
    loadVehicles();
    loadLogs();
  }, [loadVehicles, loadLogs]);

  const handleScanFound = async (plate: string) => {
    setModal(null);
    // Always fetch fresh from DB to avoid stale-state misses (e.g. just-created vehicles)
    const { data: freshVehicle } = await supabase
      .from('vehicles')
      .select('*')
      .eq('matricula', plate.toUpperCase())
      .maybeSingle();

    if (!freshVehicle) return; // ScanModal already validated existence, so this shouldn't happen

    const vehicle = freshVehicle as Vehicle;

    // Refresh local state so the list stays in sync
    setVehicles((prev) =>
      prev.some((v) => v.id === vehicle.id)
        ? prev.map((v) => (v.id === vehicle.id ? vehicle : v))
        : [...prev, vehicle]
    );

    if (vehicle.estado === 'libre') {
      setModal({ type: 'checkin', vehicle });
    } else if (vehicle.estado === 'en_uso') {
      if (vehicle.current_user_id === profile?.id) {
        const { data: logData } = await supabase
          .from('vehicle_logs')
          .select('*')
          .eq('vehicle_id', vehicle.id)
          .is('fecha_fin', null)
          .eq('user_id', profile.id)
          .maybeSingle();
        setModal({ type: 'checkout', vehicle, log: (logData as VehicleLog | null) });
      } else {
        setModal({ type: 'blocked', vehicle });
      }
    }
  };

  const handleDone = () => {
    setModal(null);
    loadVehicles();
    loadLogs();
  };

  const handleToggleEstado = async (v: Vehicle) => {
    if (!profile) return;
    setTogglingId(v.id);
    const nuevoEstado = v.estado === 'libre' ? 'en_uso' : 'libre';
    const update: Record<string, unknown> = { estado: nuevoEstado };
    if (nuevoEstado === 'libre') {
      update.current_user_id = null;
      update.current_user_nombre = null;
      update.current_km_inicio = null;
      update.current_fecha_inicio = null;
    }
    await supabase.from('vehicles').update(update).eq('id', v.id);
    await writeAuditLog({
      evento: 'vehicle_manual_toggle',
      descripcion: `Estado de ${v.matricula} cambiado manualmente a "${nuevoEstado}" por ${profile.nombre}`,
      autor: profile,
      entidad: 'vehicle',
      entidad_id: v.id,
      metadata: { matricula: v.matricula, estado_anterior: v.estado, estado_nuevo: nuevoEstado },
      society_id: v.society_id,
    });
    setTogglingId(null);
    loadVehicles();
  };

  const filteredLogs = logs.filter((l) => {
    const v = vehicles.find((vv) => vv.id === l.vehicle_id);
    const plate = v?.matricula ?? '';
    const matchPlate = !logSearchPlate || plate.toLowerCase().includes(logSearchPlate.toLowerCase());
    const matchFrom = !logDateFrom || new Date(l.fecha_inicio) >= new Date(logDateFrom);
    const matchTo = !logDateTo || new Date(l.fecha_inicio) <= new Date(logDateTo + 'T23:59:59');
    return matchPlate && matchFrom && matchTo;
  });

  const filtered = vehicles.filter((v) => {
    const matchSearch = !search || v.matricula.toLowerCase().includes(search.toLowerCase()) || v.marca.toLowerCase().includes(search.toLowerCase()) || v.modelo.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || v.estado === filterStatus;
    return matchSearch && matchStatus;
  });

  const libres = vehicles.filter((v) => v.estado === 'libre').length;
  const enUso = vehicles.filter((v) => v.estado === 'en_uso').length;
  const itvAlert = vehicles.filter((v) => isITVExpired(v.fecha_itv) || isITVNearExpiry(v.fecha_itv)).length;

  return (
    <>
      {modal?.type === 'scan' && <ScanModal profile={profile} onFound={handleScanFound} onClose={() => setModal(null)} />}
      {modal?.type === 'checkin' && <CheckInModal vehicle={modal.vehicle} profile={profile} onClose={() => setModal(null)} onDone={handleDone} />}
      {modal?.type === 'checkout' && <CheckOutModal vehicle={modal.vehicle} profile={profile} log={modal.log} onClose={() => setModal(null)} onDone={handleDone} />}
      {modal?.type === 'blocked' && <BlockedModal vehicle={modal.vehicle} profile={profile} canRelease={canManage} onClose={() => setModal(null)} onReleased={handleDone} />}
      {modal?.type === 'add' && <AddVehicleModal profile={profile} societyId={activeSocietyId ?? 'global'} onClose={() => setModal(null)} onAdded={handleDone} />}

      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Modulo de Vehiculos</h2>
            <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{vehicles.length} vehiculos registrados</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setModal({ type: 'scan' })}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ backgroundColor: '#0F172A' }}
            >
              <QrCode size={15} />
              <span className="hidden sm:inline">Registrar</span>
            </button>
            {canManage && (
              <button
                onClick={() => setModal({ type: 'add' })}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-200 hover:opacity-90"
                style={{ backgroundColor: '#16A34A', color: '#FFFFFF' }}
              >
                <Plus size={15} />
                Crear Vehículo
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: vehicles.length, color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
            { label: 'Disponibles', value: libres, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
            { label: 'En uso', value: enUso, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
            { label: 'Alertas ITV', value: itvAlert, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
          ].map((stat, i) => (
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: stat.bg, border: `1px solid ${stat.border}` }}>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: stat.color, opacity: 0.7 }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              placeholder="Buscar por matricula, marca o modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 rounded-xl text-xs outline-none"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 rounded-xl text-xs outline-none cursor-pointer"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
          >
            <option value="">Todos</option>
            <option value="libre">Libres</option>
            <option value="en_uso">En uso</option>
          </select>
        </div>

        {/* Vehicle Grid */}
        {loading ? (
          <div className="flex justify-center py-16"><RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((v) => {
              const libre = v.estado === 'libre';
              const itvExpired = isITVExpired(v.fecha_itv);
              const itvNear = !itvExpired && isITVNearExpiry(v.fecha_itv);

              return (
                <div
                  key={v.id}
                  className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg"
                  style={{ backgroundColor: '#FFFFFF', border: `1px solid ${libre ? '#E2E8F0' : '#FECACA'}` }}
                >
                  {/* Status bar */}
                  <div className="h-1.5" style={{ backgroundColor: libre ? '#22C55E' : '#EF4444' }} />
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-bold text-base font-mono tracking-wider" style={{ color: '#1E293B' }}>{v.matricula}</h3>
                        <p className="text-sm" style={{ color: '#64748B' }}>{v.marca} {v.modelo}</p>
                      </div>
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: libre ? '#F0FDF4' : '#FEF2F2',
                          color: libre ? '#16A34A' : '#DC2626',
                          border: `1px solid ${libre ? '#BBF7D0' : '#FECACA'}`,
                        }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: libre ? '#22C55E' : '#EF4444' }} />
                        {libre ? 'Libre' : 'En uso'}
                      </div>
                    </div>

                    <div className="space-y-1.5 mb-4 text-xs" style={{ color: '#64748B' }}>
                      <div className="flex justify-between">
                        <span>Kilometros</span>
                        <span className="font-semibold" style={{ color: '#1E293B' }}>{v.kilometros_actuales.toLocaleString()} km</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span>ITV</span>
                        <span
                          className="font-semibold flex items-center gap-1"
                          style={{ color: itvExpired ? '#DC2626' : itvNear ? '#D97706' : '#1E293B' }}
                        >
                          {(itvExpired || itvNear) && <AlertTriangle size={11} />}
                          {v.fecha_itv}
                        </span>
                      </div>
                      {!libre && (
                        <div className="flex justify-between">
                          <span>En uso por</span>
                          <span className="font-semibold" style={{ color: '#1E293B' }}>{v.current_user_nombre ?? '—'}</span>
                        </div>
                      )}
                    </div>

                    {(itvExpired || itvNear) && (
                      <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-3" style={{ backgroundColor: itvExpired ? '#FEF2F2' : '#FFFBEB', border: `1px solid ${itvExpired ? '#FECACA' : '#FDE68A'}` }}>
                        <AlertTriangle size={12} style={{ color: itvExpired ? '#DC2626' : '#D97706' }} />
                        <span className="text-xs font-medium" style={{ color: itvExpired ? '#DC2626' : '#D97706' }}>
                          {itvExpired ? 'ITV vencida' : 'ITV proxima a vencer'}
                        </span>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          if (libre) {
                            setModal({ type: 'checkin', vehicle: v });
                          } else if (v.current_user_id === profile.id) {
                            const activeLog = logs.find((l) => l.vehicle_id === v.id && !l.fecha_fin && l.user_id === profile.id) ?? null;
                            setModal({ type: 'checkout', vehicle: v, log: activeLog });
                          } else {
                            setModal({ type: 'blocked', vehicle: v });
                          }
                        }}
                        className="flex-1 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all duration-200"
                        style={{
                          backgroundColor: libre ? '#0F172A' : v.current_user_id === profile.id ? '#EFF6FF' : '#FEF2F2',
                          color: libre ? '#FFFFFF' : v.current_user_id === profile.id ? '#2563EB' : '#DC2626',
                          border: libre ? 'none' : `1px solid ${v.current_user_id === profile.id ? '#BFDBFE' : '#FECACA'}`,
                        }}
                      >
                        {libre ? <><CheckCircle2 size={13} /> Check-In</> : v.current_user_id === profile.id ? <><Unlock size={13} /> Check-Out</> : <><Lock size={13} /> En uso por otro</>}
                      </button>
                      {canManage && (
                        <button
                          onClick={() => handleToggleEstado(v)}
                          disabled={togglingId === v.id}
                          className="px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-all duration-200 disabled:opacity-50"
                          title={libre ? 'Marcar como en uso' : 'Liberar vehículo'}
                          style={{
                            backgroundColor: libre ? '#FEF2F2' : '#F0FDF4',
                            color: libre ? '#DC2626' : '#16A34A',
                            border: `1px solid ${libre ? '#FECACA' : '#BBF7D0'}`,
                          }}
                        >
                          {togglingId === v.id
                            ? <RefreshCw size={12} className="animate-spin" />
                            : libre
                              ? <><Lock size={12} /> En uso</>
                              : <><Unlock size={12} /> Liberar</>}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Logs */}
        {canManage && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <History size={15} style={{ color: '#64748B' }} />
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Historial de Uso</h3>
                <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                  {filteredLogs.length} registros
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Filter size={13} style={{ color: '#94A3B8' }} />
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Matricula..."
                    value={logSearchPlate}
                    onChange={(e) => setLogSearchPlate(e.target.value)}
                    className="pl-7 pr-2 py-1.5 rounded-lg text-xs outline-none"
                    style={{ width: '110px', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                  />
                </div>
                <input
                  type="date"
                  value={logDateFrom}
                  onChange={(e) => setLogDateFrom(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                  title="Desde"
                />
                <span className="text-xs" style={{ color: '#94A3B8' }}>→</span>
                <input
                  type="date"
                  value={logDateTo}
                  onChange={(e) => setLogDateTo(e.target.value)}
                  className="px-2 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                  title="Hasta"
                />
                {(logSearchPlate || logDateFrom || logDateTo) && (
                  <button
                    onClick={() => { setLogSearchPlate(''); setLogDateFrom(''); setLogDateTo(''); }}
                    className="text-xs px-2 py-1.5 rounded-lg cursor-pointer"
                    style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {filteredLogs.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-xs" style={{ color: '#94A3B8' }}>No hay registros con los filtros aplicados</p>
                </div>
              ) : (
                filteredLogs.slice(0, 20).map((log) => {
                  const v = vehicles.find((vv) => vv.id === log.vehicle_id);
                  return (
                    <div key={log.id} className="px-6 py-3.5 flex items-center gap-4">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: log.tipo === 'incidencia' ? '#FEF2F2' : '#F0FDF4' }}>
                        <Car size={14} style={{ color: log.tipo === 'incidencia' ? '#DC2626' : '#16A34A' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: '#1E293B' }}>
                          {v?.matricula ?? '—'} &middot; {log.user_nombre}
                        </p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>
                          {new Date(log.fecha_inicio).toLocaleString('es-ES')}
                          {log.fecha_fin ? ` → ${new Date(log.fecha_fin).toLocaleTimeString('es-ES')}` : ' (en curso)'}
                          {log.duracion_minutos ? ` · ${formatDuration(log.duracion_minutos)}` : ''}
                        </p>
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        {log.km_inicio !== null && log.km_fin !== null && (
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            +{(log.km_fin - log.km_inicio).toLocaleString()} km
                          </span>
                        )}
                        {log.tipo === 'incidencia' && (
                          <span className="text-xs font-medium px-2 py-0.5 rounded" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                            Incidencia
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
