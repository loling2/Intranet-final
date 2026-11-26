import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapPin, Navigation, Play, Square, RefreshCw, AlertTriangle, History, ChevronDown, ChevronUp, Users, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';

interface EmpleadoRow {
  id: string;
  nombre: string;
  user_id: string | null;
}

interface DomicilioRow {
  id: string;
  empleado_id: string;
  fecha: string;
  timestamp: string;
  tipo_evento: 'inicio_domicilio' | 'fin_domicilio';
  domicilio_nombre: string | null;
  ubicacion: string | null;
  dispositivo: string | null;
}

const SOCIEDAD_GERONTALIA = '6632d8d1-c4e7-4540-aab7-515b9d7913f7';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function MovilidadModule() {
  const { profile } = useAuth();
  const allRoles: string[] = [...(profile?.roles ?? []), ...(profile?.role ? [profile.role] : [])];
  const isSupervisor = allRoles.includes('supervisor') || allRoles.includes('coordinador');
  const isAdmin = allRoles.some((r) => ['admin', 'rrhh', 'rrhh_gerontalia'].includes(r));

  const [empleados, setEmpleados] = useState<EmpleadoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EmpleadoRow | null>(null);
  const [registros, setRegistros] = useState<DomicilioRow[]>([]);
  const [registrosLoading, setRegistrosLoading] = useState(false);
  const [saving, setSaving] = useState<'inicio_domicilio' | 'fin_domicilio' | null>(null);
  const [geoMsg, setGeoMsg] = useState('');
  const [showAll, setShowAll] = useState(false);

  const loadEmpleados = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (isAdmin) {
        const { data, error: dbErr } = await supabase
          .from('empleados')
          .select('id, nombre, user_id')
          .order('nombre', { ascending: true });
        if (dbErr) throw dbErr;
        setEmpleados((data ?? []) as EmpleadoRow[]);
      } else if (isSupervisor && profile) {
        const esCoordinador = allRoles.includes('coordinador');
        const esSupervisor = allRoles.includes('supervisor');
        const ids: string[] = [];
        if (esCoordinador) {
          const { data: supRows } = await supabase
            .from('coordinador_supervisores')
            .select('supervisor_id')
            .eq('coordinador_id', profile.id);
          const supervisorIds = ((supRows ?? []) as { supervisor_id: string }[]).map((r) => r.supervisor_id);
          if (esSupervisor) {
            const { data: ownIds } = await supabase.rpc('get_supervisor_empleados', { p_supervisor_id: profile.id });
            ids.push(...(((ownIds ?? []) as { empleado_id: string }[]).map((r) => r.empleado_id)));
          }
          for (const sid of supervisorIds) {
            const { data: moreIds } = await supabase.rpc('get_supervisor_empleados', { p_supervisor_id: sid });
            ids.push(...(((moreIds ?? []) as { empleado_id: string }[]).map((r) => r.empleado_id)));
          }
        } else {
          const { data: supEmpIds } = await supabase.rpc('get_supervisor_empleados', { p_supervisor_id: profile.id });
          ids.push(...(((supEmpIds ?? []) as { empleado_id: string }[]).map((r) => r.empleado_id)));
        }
        const uniqueIds = [...new Set(ids)];
        if (uniqueIds.length === 0) {
          setEmpleados([]);
          return;
        }
        const { data, error: dbErr } = await supabase
          .from('empleados')
          .select('id, nombre, user_id')
          .in('id', uniqueIds)
          .order('nombre', { ascending: true });
        if (dbErr) throw dbErr;
        setEmpleados((data ?? []) as EmpleadoRow[]);
      } else {
        // Trabajador: solo su propia ficha
        if (profile) {
          const { data, error: dbErr } = await supabase
            .from('empleados')
            .select('id, nombre, user_id')
            .eq('user_id', profile.id)
            .order('nombre', { ascending: true });
          if (dbErr) throw dbErr;
          setEmpleados((data ?? []) as EmpleadoRow[]);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar trabajadores');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isSupervisor, profile]);

  const loadRegistros = useCallback(async (empleadoId: string) => {
    setRegistrosLoading(true);
    try {
      const { data, error: dbErr } = await supabase
        .from('fichajes_domicilios')
        .select('id, empleado_id, fecha, timestamp, tipo_evento, domicilio_nombre, ubicacion, dispositivo')
        .eq('empleado_id', empleadoId)
        .order('timestamp', { ascending: false })
        .limit(60);
      if (dbErr) throw dbErr;
      setRegistros((data ?? []) as DomicilioRow[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar registros');
    } finally {
      setRegistrosLoading(false);
    }
  }, []);

  useEffect(() => { loadEmpleados(); }, [loadEmpleados]);
  useEffect(() => {
    if (selected) loadRegistros(selected.id);
    else setRegistros([]);
  }, [selected, loadRegistros]);

  const filteredEmpleados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return empleados;
    return empleados.filter((e) => e.nombre.toLowerCase().includes(q));
  }, [empleados, search]);

  const getGeolocation = (): Promise<{ ubicacion: string; lat: number; lon: number } | null> =>
    new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      const timer = setTimeout(() => resolve(null), 15000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timer);
          resolve({
            ubicacion: `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`,
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
          });
        },
        () => { clearTimeout(timer); resolve(null); },
        { timeout: 15000, maximumAge: 30000, enableHighAccuracy: true },
      );
    });

  const handleRegistrar = async (tipo: 'inicio_domicilio' | 'fin_domicilio') => {
    if (!selected || !profile) return;
    setError('');
    setGeoMsg('');
    setSaving(tipo);
    try {
      const geo = await getGeolocation();
      if (!geo) {
        setError('No se pudo obtener la ubicación GPS. Activa la ubicación en tu móvil e inténtalo de nuevo.');
        return;
      }
      const { error: insErr } = await supabase.from('fichajes_domicilios').insert({
        empleado_id: selected.id,
        user_id: profile.id,
        tipo_evento: tipo,
        latitud: geo.lat,
        longitud: geo.lon,
        ubicacion: geo.ubicacion,
        dispositivo: navigator.userAgent,
      });
      if (insErr) throw insErr;
      setGeoMsg(tipo === 'inicio_domicilio' ? 'Inicio de domicilio registrado con ubicación' : 'Fin de domicilio registrado con ubicación');
      await loadRegistros(selected.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al registrar el domicilio');
    } finally {
      setSaving(null);
    }
  };

  const openMap = (ubicacion: string | null) => {
    if (!ubicacion) return;
    window.open(`https://www.google.com/maps?q=${encodeURIComponent(ubicacion)}`, '_blank', 'noopener');
  };

  const hoy = new Date().toISOString().slice(0, 10);
  const registrosDelDia = registros.filter((r) => r.fecha.slice(0, 10) === hoy);
  const registrosMostrados = showAll ? registros : registrosDelDia;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#ECFEFF' }}>
          <Navigation size={18} style={{ color: '#0891B2' }} />
        </div>
        <div>
          <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>Movilidad</h3>
          <p className="text-xs" style={{ color: '#64748B' }}>Fichajes de inicio y fin en cada domicilio, con ubicación GPS</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 p-6 justify-center">
          <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
          <p className="text-sm" style={{ color: '#64748B' }}>Cargando trabajadores...</p>
        </div>
      ) : filteredEmpleados.length === 0 ? (
        <div className="flex flex-col items-center gap-2 p-8 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <Users size={24} style={{ color: '#94A3B8' }} />
          <p className="text-sm font-medium" style={{ color: '#475569' }}>No hay trabajadores disponibles</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>No tienes trabajadores asignados o visibles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Employee list */}
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <Search size={14} style={{ color: '#94A3B8' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar trabajador..."
                className="flex-1 text-sm outline-none bg-transparent"
                style={{ color: '#0F172A' }}
              />
            </div>
            <div className="max-h-[480px] overflow-y-auto divide-y" style={{ borderColor: '#F1F5F9' }}>
              {filteredEmpleados.map((emp) => {
                const isSelected = selected?.id === emp.id;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelected(emp)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-slate-50"
                    style={{ backgroundColor: isSelected ? '#ECFEFF' : 'transparent' }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ backgroundColor: isSelected ? '#0891B2' : '#F1F5F9', color: isSelected ? '#fff' : '#64748B' }}
                    >
                      {emp.nombre?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: isSelected ? '#0E7490' : '#0F172A' }}>{emp.nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{isSelected ? 'Seleccionado' : 'Tocar para ver'}</p>
                    </div>
                    <MapPin size={14} className="ml-auto flex-shrink-0" style={{ color: isSelected ? '#0891B2' : '#CBD5E1' }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-2 space-y-4">
            {!selected ? (
              <div className="flex flex-col items-center gap-2 p-10 rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <MapPin size={28} style={{ color: '#CBD5E1' }} />
                <p className="text-sm font-medium" style={{ color: '#475569' }}>Selecciona un trabajador</p>
                <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
                  Al marcar un trabajador podrás registrar su inicio y fin en cada domicilio, y ver dónde fichó cada vez.
                </p>
              </div>
            ) : (
              <>
                {/* Action card */}
                <div className="rounded-2xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: '#0891B2', color: '#fff' }}>
                      {selected.nombre?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: '#0F172A' }}>{selected.nombre}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Fichajes de domicilio de hoy</p>
                    </div>
                    <button
                      onClick={() => loadRegistros(selected.id)}
                      className="ml-auto w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors"
                      style={{ border: '1px solid #E2E8F0', color: '#64748B' }}
                      title="Actualizar"
                    >
                      <RefreshCw size={13} className={registrosLoading ? 'animate-spin' : ''} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleRegistrar('inicio_domicilio')}
                      disabled={saving !== null}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-60"
                      style={{ backgroundColor: '#F0FDF4', border: '1.5px solid #BBF7D0' }}
                    >
                      {saving === 'inicio_domicilio'
                        ? <RefreshCw size={18} className="animate-spin" style={{ color: '#16A34A' }} />
                        : <Play size={18} style={{ color: '#16A34A' }} />}
                      <span className="text-sm font-semibold" style={{ color: '#16A34A' }}>Inicio Domicilio</span>
                    </button>
                    <button
                      onClick={() => handleRegistrar('fin_domicilio')}
                      disabled={saving !== null}
                      className="flex flex-col items-center gap-1.5 py-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02] disabled:opacity-60"
                      style={{ backgroundColor: '#FEF2F2', border: '1.5px solid #FECACA' }}
                    >
                      {saving === 'fin_domicilio'
                        ? <RefreshCw size={18} className="animate-spin" style={{ color: '#DC2626' }} />
                        : <Square size={18} style={{ color: '#DC2626' }} />}
                      <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>Fin domicilio</span>
                    </button>
                  </div>

                  <p className="text-xs mt-3 text-center" style={{ color: '#94A3B8' }}>
                    Al pulsar, se pide la ubicación GPS del móvil y se guarda junto al fichaje del domicilio.
                  </p>

                  {geoMsg && (
                    <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg text-xs" style={{ backgroundColor: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0' }}>
                      <MapPin size={13} /> {geoMsg}
                    </div>
                  )}
                </div>

                {/* History */}
                <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <History size={14} style={{ color: '#64748B' }} />
                    <h4 className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                      {showAll ? 'Últimos registros' : 'Registros de hoy'}
                    </h4>
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="ml-auto flex items-center gap-1 text-xs font-medium cursor-pointer hover:underline"
                      style={{ color: '#0891B2' }}
                    >
                      {showAll ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      {showAll ? 'Ver solo hoy' : 'Ver histórico'}
                    </button>
                  </div>
                  {registrosLoading ? (
                    <div className="flex items-center justify-center gap-2 py-6">
                      <RefreshCw size={14} className="animate-spin" style={{ color: '#94A3B8' }} />
                      <p className="text-xs" style={{ color: '#94A3B8' }}>Cargando...</p>
                    </div>
                  ) : registrosMostrados.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-xs" style={{ color: '#94A3B8' }}>
                        {showAll ? 'Sin registros todavía.' : 'Sin registros de domicilio hoy.'}
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                      {registrosMostrados.map((r) => {
                        const esInicio = r.tipo_evento === 'inicio_domicilio';
                        return (
                          <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: esInicio ? '#F0FDF4' : '#FEF2F2' }}
                            >
                              {esInicio
                                ? <Play size={12} style={{ color: '#16A34A' }} />
                                : <Square size={12} style={{ color: '#DC2626' }} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold" style={{ color: esInicio ? '#15803D' : '#DC2626' }}>
                                {esInicio ? 'Inicio domicilio' : 'Fin domicilio'}
                                {r.domicilio_nombre ? ` · ${r.domicilio_nombre}` : ''}
                              </p>
                              <p className="text-xs" style={{ color: '#64748B' }}>{formatDateTime(r.timestamp)}</p>
                              {r.ubicacion && (
                                <p className="text-[11px] font-mono" style={{ color: '#94A3B8' }}>{r.ubicacion}</p>
                              )}
                            </div>
                            <button
                              onClick={() => openMap(r.ubicacion)}
                              className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors hover:opacity-80 flex-shrink-0"
                              style={{ backgroundColor: '#ECFEFF', color: '#0E7490', border: '1px solid #A5F3FC' }}
                              title="Ver ubicación en el mapa"
                            >
                              <MapPin size={12} /> Ver mapa
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
