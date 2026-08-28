import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Calendar, ChevronLeft, ChevronRight, Plus, Trash2, Search, Download,
  RefreshCw, X, AlertCircle, UserCheck, UserPlus, ToggleLeft, ToggleRight,
  Car, ShieldCheck,
} from 'lucide-react';
import { supabase, Vehicle, VehicleReservation, VehicleReservationAuthorizedUser, VehicleShift, UserProfile } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

const SHIFT_LABELS: Record<VehicleShift, string> = {
  turno_1: 'Turno 1 (07:00–15:00)',
  turno_2: 'Turno 2 (15:01–23:59)',
};

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

interface DayStatus {
  t1: VehicleReservation | null;
  t2: VehicleReservation | null;
}

function dayColor(status: DayStatus): { bg: string; border: string; label: string } {
  const occupied = (status.t1 ? 1 : 0) + (status.t2 ? 1 : 0);
  if (occupied === 0) return { bg: '#F0FDF4', border: '#BBF7D0', label: 'Libre' };
  if (occupied === 1) return { bg: '#FFFBEB', border: '#FDE68A', label: 'Parcial' };
  return { bg: '#F1F5F9', border: '#CBD5E1', label: 'Completo' };
}

interface Props {
  vehicles: Vehicle[];
  profile: UserProfile;
  canManage: boolean;
}

export default function VehicleReservationsModule({ vehicles, profile, canManage }: Props) {
  const [subTab, setSubTab] = useState<'calendar' | 'permissions'>('calendar');

  // Calendar state
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()));
  const [reservations, setReservations] = useState<VehicleReservation[]>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState<string>('');
  const [formShift, setFormShift] = useState<VehicleShift>('turno_1');
  const [formExtraordinary, setFormExtraordinary] = useState(false);
  const [formForced, setFormForced] = useState(false);
  const [formNota, setFormNota] = useState('');
  const [formError, setFormError] = useState('');
  const [formSaving, setFormSaving] = useState(false);

  // Authorization state
  const [authorizedUsers, setAuthorizedUsers] = useState<VehicleReservationAuthorizedUser[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ id: string; nombre: string; email: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Current user authorization
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [vehicles, selectedVehicleId]);

  // Check if current user is authorized
  useEffect(() => {
    if (canManage) {
      setIsAuthorized(true);
      return;
    }
    const checkAuth = async () => {
      const { data } = await supabase
        .from('vehicle_reservation_authorized_users')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();
      setIsAuthorized(!!data);
    };
    checkAuth();
  }, [profile.id, canManage]);

  const loadReservations = useCallback(async () => {
    if (!selectedVehicleId) return;
    setLoadingRes(true);
    const startDate = toISODate(weekStart);
    const endDate = toISODate(new Date(weekStart.getTime() + 6 * 86400000));
    const { data } = await supabase
      .from('vehicle_reservations')
      .select('*')
      .eq('vehicle_id', selectedVehicleId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true });
    setReservations((data ?? []) as VehicleReservation[]);
    setLoadingRes(false);
  }, [selectedVehicleId, weekStart]);

  const loadAuthorizedUsers = useCallback(async () => {
    setAuthLoading(true);
    const { data } = await supabase
      .from('vehicle_reservation_authorized_users')
      .select('*')
      .order('user_nombre', { ascending: true });
    setAuthorizedUsers((data ?? []) as VehicleReservationAuthorizedUser[]);
    setAuthLoading(false);
  }, []);

  useEffect(() => {
    if (subTab === 'calendar') loadReservations();
  }, [subTab, loadReservations]);

  useEffect(() => {
    if (subTab === 'permissions') loadAuthorizedUsers();
  }, [subTab, loadAuthorizedUsers]);

  // Build a map of date -> DayStatus
  const reservationsByDate = useMemo(() => {
    const map: Record<string, DayStatus> = {};
    for (const r of reservations) {
      if (!map[r.date]) map[r.date] = { t1: null, t2: null };
      if (r.shift === 'turno_1') map[r.date].t1 = r;
      else map[r.date].t2 = r;
    }
    return map;
  }, [reservations]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      days.push(new Date(weekStart.getTime() + i * 86400000));
    }
    return days;
  }, [weekStart]);

  const handleSearchUsers = async () => {
    const q = searchQuery.trim();
    if (q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    const { data } = await supabase
      .from('user_profiles')
      .select('id, nombre, email')
      .or(`nombre.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(10);
    setSearchResults((data ?? []) as { id: string; nombre: string; email: string }[]);
    setSearchLoading(false);
  };

  const handleAddAuthorized = async (userId: string, userName: string) => {
    const { error } = await supabase
      .from('vehicle_reservation_authorized_users')
      .insert({ user_id: userId, user_nombre: userName, added_by: profile.id });
    if (error) {
      // Already exists — ignore
    } else {
      await loadAuthorizedUsers();
    }
    setSearchResults((prev) => prev.filter((r) => r.id !== userId));
  };

  const handleRemoveAuthorized = async (id: string) => {
    await supabase.from('vehicle_reservation_authorized_users').delete().eq('id', id);
    await loadAuthorizedUsers();
  };

  const handleDeleteReservation = async (id: string) => {
    await supabase.from('vehicle_reservations').delete().eq('id', id);
    await loadReservations();
  };

  const openForm = (date: string, shift: VehicleShift) => {
    setFormDate(date);
    setFormShift(shift);
    setFormExtraordinary(false);
    setFormForced(false);
    setFormNota('');
    setFormError('');
    setShowForm(true);
  };

  const handleSaveReservation = async () => {
    if (!selectedVehicleId || !formDate) { setFormError('Faltan datos'); return; }
    setFormSaving(true);
    setFormError('');
    try {
      const { error } = await supabase.from('vehicle_reservations').insert({
        vehicle_id: selectedVehicleId,
        user_id: profile.id,
        user_nombre: profile.nombre,
        date: formDate,
        shift: formShift,
        is_extraordinary: formExtraordinary,
        is_forced: formForced,
        nota: formNota.trim() || null,
      });
      if (error) {
        if (error.code === '23505') {
          setFormError('Ya existe una reserva para ese turno. Activa "Forzar reserva" si necesitas solapar.');
        } else {
          setFormError('No se pudo crear la reserva. Verifica que tienes permiso.');
        }
        setFormSaving(false);
        return;
      }
      setShowForm(false);
      await loadReservations();
    } catch {
      setFormError('Error inesperado');
    } finally {
      setFormSaving(false);
    }
  };

  const handleExportCSV = () => {
    if (reservations.length === 0) return;
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    const plate = vehicle?.matricula ?? '';
    const header = ['Matricula', 'Fecha', 'Turno', 'Usuario', 'Extraoficial', 'Forzada', 'Nota'];
    const rows = reservations.map((r) => [
      plate,
      r.date,
      SHIFT_LABELS[r.shift],
      r.user_nombre,
      r.is_extraordinary ? 'Si' : 'No',
      r.is_forced ? 'Si' : 'No',
      (r.nota ?? '').replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${cell}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservas_${plate}_${toISODate(weekStart)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId);

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: '#F1F5F9' }}>
        <button
          onClick={() => setSubTab('calendar')}
          className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
          style={{
            backgroundColor: subTab === 'calendar' ? '#FFFFFF' : 'transparent',
            color: subTab === 'calendar' ? '#0F172A' : '#64748B',
            boxShadow: subTab === 'calendar' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          <Calendar size={13} className="inline mr-1.5" /> Calendario
        </button>
        {canManage && (
          <button
            onClick={() => setSubTab('permissions')}
            className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer"
            style={{
              backgroundColor: subTab === 'permissions' ? '#FFFFFF' : 'transparent',
              color: subTab === 'permissions' ? '#0F172A' : '#64748B',
              boxShadow: subTab === 'permissions' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            <ShieldCheck size={13} className="inline mr-1.5" /> Reserva de Vehículos
          </button>
        )}
      </div>

      {/* ===================== CALENDAR TAB ===================== */}
      {subTab === 'calendar' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Car size={15} style={{ color: '#64748B' }} />
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="px-3 py-2 rounded-xl text-sm outline-none cursor-pointer"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
              >
                {vehicles.length === 0 && <option value="">Sin vehículoss</option>}
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.matricula} — {v.marca} {v.modelo}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekStart(new Date(weekStart.getTime() - 7 * 86400000))}
                className="p-2 rounded-lg cursor-pointer"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}
                title="Semana anterior"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-sm font-semibold px-3" style={{ color: '#0F172A' }}>
                {weekDays[0].getDate()} {MONTHS[weekDays[0].getMonth()]} — {weekDays[6].getDate()} {MONTHS[weekDays[6].getMonth()]} {weekDays[6].getFullYear()}
              </span>
              <button
                onClick={() => setWeekStart(new Date(weekStart.getTime() + 7 * 86400000))}
                className="p-2 rounded-lg cursor-pointer"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}
                title="Semana siguiente"
              >
                <ChevronRight size={15} />
              </button>
              <button
                onClick={() => setWeekStart(getMonday(new Date()))}
                className="px-3 py-2 rounded-lg text-xs font-medium cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}
              >
                Hoy
              </button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={handleExportCSV}
                disabled={reservations.length === 0}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                style={{ backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }}
                title="Exportar reservas a CSV"
              >
                <Download size={13} /> Exportar CSV
              </button>
              {isAuthorized && (
                <button
                  onClick={() => {
                    setFormDate(toISODate(new Date()));
                    setFormShift('turno_1');
                    setFormExtraordinary(false);
                    setFormForced(false);
                    setFormNota('');
                    setFormError('');
                    setShowForm(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer transition-all"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  <Plus size={13} /> Reservar vehículo
                </button>
              )}
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-4 text-xs" style={{ color: '#64748B' }}>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }} /> Libre</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }} /> Un turno</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#F1F5F9', border: '1px solid #CBD5E1' }} /> Completo</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }} /> Forzada</span>
          </div>

          {/* Calendar grid */}
          {loadingRes ? (
            <div className="flex justify-center py-12"><RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
              {weekDays.map((day) => {
                const dateStr = toISODate(day);
                const status = reservationsByDate[dateStr] ?? { t1: null, t2: null };
                const colors = dayColor(status);
                const hasForced = status.t1?.is_forced || status.t2?.is_forced;
                const isToday = toISODate(new Date()) === dateStr;

                return (
                  <div
                    key={dateStr}
                    className="rounded-xl p-3 transition-all"
                    style={{
                      backgroundColor: colors.bg,
                      border: `1.5px solid ${hasForced ? '#FECACA' : colors.border}`,
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-xs font-bold" style={{ color: '#0F172A' }}>
                          {WEEKDAYS[(day.getDay() + 6) % 7]} {day.getDate()}
                        </p>
                        <p className="text-[10px]" style={{ color: '#94A3B8' }}>{MONTHS[day.getMonth()]}</p>
                      </div>
                      {isToday && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#0F172A', color: '#fff' }}>Hoy</span>
                      )}
                    </div>

                    {/* Turno 1 */}
                    <ShiftSlot
                      label="T1"
                      reservation={status.t1}
                      canBook={isAuthorized}
                      onBook={() => openForm(dateStr, 'turno_1')}
                      onDelete={() => status.t1 && handleDeleteReservation(status.t1.id)}
                    />

                    {/* Turno 2 */}
                    <ShiftSlot
                      label="T2"
                      reservation={status.t2}
                      canBook={isAuthorized}
                      onBook={() => openForm(dateStr, 'turno_2')}
                      onDelete={() => status.t2 && handleDeleteReservation(status.t2.id)}
                    />
                  </div>
                );
              })}
            </div>
          )}

          {!isAuthorized && !canManage && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
              <AlertCircle size={14} style={{ color: '#D97706' }} />
              <p className="text-xs" style={{ color: '#92400E' }}>No tienes permiso para reservar vehículo. Contacta con administración.</p>
            </div>
          )}
        </div>
      )}

      {/* ===================== PERMISSIONS TAB ===================== */}
      {subTab === 'permissions' && canManage && (
        <div className="space-y-4">
          {/* Search & add */}
          <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="flex items-center gap-2">
              <UserPlus size={15} style={{ color: '#0F172A' }} />
              <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Añadir usuario autorizado</h3>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre o email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>
              <button
                onClick={handleSearchUsers}
                disabled={searchLoading}
                className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer transition-all disabled:opacity-50"
                style={{ backgroundColor: '#0F172A' }}
              >
                {searchLoading ? <RefreshCw size={14} className="animate-spin" /> : 'Buscar'}
              </button>
            </div>

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {searchResults.map((u) => {
                  const alreadyAuth = authorizedUsers.some((a) => a.user_id === u.id);
                  return (
                    <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{u.nombre}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{u.email}</p>
                      </div>
                      <button
                        onClick={() => handleAddAuthorized(u.id, u.nombre)}
                        disabled={alreadyAuth}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
                        style={{ backgroundColor: alreadyAuth ? '#F1F5F9' : '#16A34A', color: alreadyAuth ? '#94A3B8' : '#FFFFFF', border: `1px solid ${alreadyAuth ? '#E2E8F0' : '#16A34A'}` }}
                      >
                        {alreadyAuth ? 'Ya autorizado' : 'Añadir'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Authorized list */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <UserCheck size={15} style={{ color: '#0F172A' }} />
              <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Usuarios autorizados</h3>
              <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                {authorizedUsers.length}
              </span>
            </div>
            {authLoading ? (
              <div className="flex justify-center py-8"><RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} /></div>
            ) : authorizedUsers.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs" style={{ color: '#94A3B8' }}>No hay usuarios autorizados todavía. Usa el buscador de arriba para añadir.</p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
                {authorizedUsers.map((a) => (
                  <div key={a.id} className="flex items-center justify-between px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{a.user_nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Añadido el {new Date(a.created_at).toLocaleDateString('es-ES')}</p>
                    </div>
                    <button
                      onClick={() => handleRemoveAuthorized(a.id)}
                      className="p-1.5 rounded-lg cursor-pointer transition-all"
                      style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                      title="Quitar autorización"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================== RESERVATION FORM MODAL ===================== */}
      {showForm && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 overflow-hidden shadow-2xl">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)' }}>
              <div>
                <h2 className="text-white font-semibold">Nueva Reserva</h2>
                <p className="text-white/70 text-xs">{selectedVehicle?.matricula} — {selectedVehicle?.marca} {selectedVehicle?.modelo}</p>
              </div>
              <button onClick={() => setShowForm(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Fecha</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Turno</label>
                <select
                  value={formShift}
                  onChange={(e) => setFormShift(e.target.value as VehicleShift)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none cursor-pointer"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }}
                >
                  <option value="turno_1">{SHIFT_LABELS.turno_1}</option>
                  <option value="turno_2">{SHIFT_LABELS.turno_2}</option>
                </select>
              </div>

              {/* Extraordinary toggle */}
              <button
                onClick={() => setFormExtraordinary((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all"
                style={{
                  backgroundColor: formExtraordinary ? '#EFF6FF' : '#F8FAFC',
                  border: `1.5px solid ${formExtraordinary ? '#2563EB' : '#E2E8F0'}`,
                }}
              >
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: formExtraordinary ? '#2563EB' : '#1E293B' }}>Extraoficial</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Marca el tipo de uso como no oficial</p>
                </div>
                {formExtraordinary
                  ? <ToggleRight size={28} style={{ color: '#2563EB' }} />
                  : <ToggleLeft size={28} style={{ color: '#CBD5E1' }} />}
              </button>

              {/* Forced toggle */}
              <button
                onClick={() => setFormForced((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer transition-all"
                style={{
                  backgroundColor: formForced ? '#FEF2F2' : '#F8FAFC',
                  border: `1.5px solid ${formForced ? '#EF4444' : '#E2E8F0'}`,
                }}
              >
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: formForced ? '#DC2626' : '#1E293B' }}>Forzar reserva</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Solapa puntual de 1–2 h dentro de un turno ya cogido</p>
                </div>
                {formForced
                  ? <ToggleRight size={28} style={{ color: '#EF4444' }} />
                  : <ToggleLeft size={28} style={{ color: '#CBD5E1' }} />}
              </button>

              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Nota (opcional)</label>
                <textarea
                  value={formNota}
                  onChange={(e) => setFormNota(e.target.value)}
                  rows={2}
                  placeholder="Motivo o detalle de la reserva..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                  style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                  <AlertCircle size={13} style={{ color: '#DC2626' }} />
                  <p className="text-xs" style={{ color: '#DC2626' }}>{formError}</p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveReservation}
                  disabled={formSaving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  {formSaving && <RefreshCw size={14} className="animate-spin" />}
                  Confirmar reserva
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ShiftSlot — renders one shift cell inside a calendar day
// ============================================================
function ShiftSlot({
  label,
  reservation,
  canBook,
  onBook,
  onDelete,
}: {
  label: string;
  reservation: VehicleReservation | null;
  canBook: boolean;
  onBook: () => void;
  onDelete: () => void;
}) {
  if (reservation) {
    return (
      <div
        className="rounded-lg px-2 py-1.5 mb-1.5 flex items-center justify-between"
        style={{
          backgroundColor: reservation.is_forced ? '#FEF2F2' : reservation.is_extraordinary ? '#EFF6FF' : '#F8FAFC',
          border: `1px solid ${reservation.is_forced ? '#FECACA' : reservation.is_extraordinary ? '#BFDBFE' : '#E2E8F0'}`,
        }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold" style={{ color: '#64748B' }}>{label}</p>
          <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{reservation.user_nombre}</p>
          {reservation.is_forced && <span className="text-[9px] font-bold" style={{ color: '#DC2626' }}>FORZADA</span>}
          {reservation.is_extraordinary && !reservation.is_forced && <span className="text-[9px] font-bold" style={{ color: '#2563EB' }}>EXTRA</span>}
        </div>
        <button
          onClick={onDelete}
          className="p-1 rounded cursor-pointer flex-shrink-0"
          style={{ color: '#94A3B8' }}
          title="Eliminar reserva"
        >
          <Trash2 size={11} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={canBook ? onBook : undefined}
      disabled={!canBook}
      className="w-full rounded-lg px-2 py-1.5 mb-1.5 text-left transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px dashed #E2E8F0',
      }}
      title={canBook ? `Reservar ${label}` : 'Sin permiso'}
    >
      <p className="text-[10px] font-bold" style={{ color: '#94A3B8' }}>{label}</p>
      <p className="text-xs" style={{ color: '#CBD5E1' }}>+ Reservar</p>
    </button>
  );
}
