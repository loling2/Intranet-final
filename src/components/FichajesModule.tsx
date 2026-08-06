import { useState, useEffect, useCallback } from 'react';
import {
  Clock, Search, RefreshCw, Download, FileText, Calendar,
  AlertTriangle, LogIn, LogOut, ChevronDown, ChevronUp, MapPin,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Pagination, paginate, totalPages as calcTotalPages } from './Pagination';
import { getOrCreateDeviceKey, getDeviceInfo } from '../lib/deviceKey';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Fichaje {
  id: string;
  empleado_id: string | null;
  nombre_empleado: string;
  fecha: string;
  timestamp: string;
  tipo_evento: 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin' | 'permiso' | 'permiso_fin';
  metodo: string | null;
  es_manual: boolean;
  nota_correccion: string | null;
  ubicacion: string | null;
  dispositivo: string | null;
  user_agent: string | null;
  timestamp_corregido: string | null;
  motivo_correccion: string | null;
  corregido_por: string | null;
  corregido_at: string | null;
}

interface JornadaResumen {
  nombre: string;
  fecha: string;
  entrada: string | null;
  salida: string | null;
  entrada_original: string | null;
  salida_original: string | null;
  entrada_corregida: boolean;
  salida_corregida: boolean;
  motivo_correccion: string | null;
  pausa_inicio: string | null;
  pausa_fin: string | null;
  permiso: string | null;
  permiso_fin: string | null;
  duracion_permiso: number | null;
  duracion_bruta: number | null;
  duracion_neta: number | null;
  dispositivo: string | null;
  ubicacion: string | null;
  empleado_id: string | null;
}

interface Empleado {
  id: string;
  user_id: string | null;
  nombre: string;
  id_sociedad: string | null;
  centro_trabajo: string | null;
}

interface Sociedad { id: string; nombre: string; }
interface Centro { id: string; nombre: string; id_sociedad: string; }

// ── Constants ────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, { label: string; color: string; bg: string; border: string }> = {
  entrada:      { label: 'Entrada',       color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  salida:       { label: 'Salida',        color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  pausa_inicio: { label: 'Descanso',      color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  pausa_fin:    { label: 'Fin descanso',  color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
  permiso:      { label: 'Permiso',       color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  permiso_fin:  { label: 'Fin permiso',   color: '#6D28D9', bg: '#EDE9FE', border: '#C4B5FD' },
};

// Returns the effective timestamp: corrected time if it exists, else original
function effectiveTs(f: Fichaje): string {
  return f.timestamp_corregido ?? f.timestamp;
}

const NORMAL_HOURS_MIN = 6 * 60;  // 6 hours in minutes
const NORMAL_HOURS_MAX = 8 * 60;  // 8 hours in minutes

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number | null) {
  if (minutes === null || minutes < 0) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function isIncident(minutes: number | null) {
  if (minutes === null) return false;
  return minutes > NORMAL_HOURS_MAX || minutes < NORMAL_HOURS_MIN;
}

function incidentType(minutes: number | null): 'excess' | 'deficit' | null {
  if (minutes === null) return null;
  if (minutes > NORMAL_HOURS_MAX) return 'excess';
  if (minutes < NORMAL_HOURS_MIN) return 'deficit';
  return null;
}

function buildResumenes(fichajes: Fichaje[]): JornadaResumen[] {
  const map = new Map<string, JornadaResumen>();
  const sorted = [...fichajes].sort((a, b) => effectiveTs(a).localeCompare(effectiveTs(b)));
  for (const f of sorted) {
    const key = `${f.nombre_empleado}|${f.fecha}`;
    if (!map.has(key)) {
      map.set(key, {
        nombre: f.nombre_empleado, fecha: f.fecha,
        entrada: null, salida: null, entrada_original: null, salida_original: null,
        entrada_corregida: false, salida_corregida: false, motivo_correccion: null,
        pausa_inicio: null, pausa_fin: null, permiso: null, permiso_fin: null, duracion_permiso: null,
        duracion_bruta: null, duracion_neta: null,
        dispositivo: f.dispositivo ?? null, ubicacion: f.ubicacion ?? null,
        empleado_id: f.empleado_id,
      });
    }
    const r = map.get(key)!;
    const eff = effectiveTs(f);
    const corregida = !!f.timestamp_corregido;
    if (f.tipo_evento === 'pausa_inicio' && !r.pausa_inicio) r.pausa_inicio = eff;
    if (f.tipo_evento === 'pausa_fin' && !r.pausa_fin) r.pausa_fin = eff;
    if (f.tipo_evento === 'permiso' && !r.permiso) r.permiso = eff;
    if (f.tipo_evento === 'permiso_fin' && !r.permiso_fin) r.permiso_fin = eff;
    if (corregida && f.motivo_correccion && !r.motivo_correccion) r.motivo_correccion = f.motivo_correccion;
    if (!r.dispositivo && f.dispositivo) r.dispositivo = f.dispositivo;
    if (!r.ubicacion && f.ubicacion) r.ubicacion = f.ubicacion;
  }

  for (const [key, r] of map.entries()) {
    const dayEvents = sorted
      .filter((f) => `${f.nombre_empleado}|${f.fecha}` === key && (f.tipo_evento === 'entrada' || f.tipo_evento === 'salida'))
      .map((f) => ({ tipo: f.tipo_evento, eff: effectiveTs(f), orig: f.timestamp, id: f.id, corregida: !!f.timestamp_corregido }));

    const entradas = dayEvents.filter((ev) => ev.tipo === 'entrada').sort((a, b) => a.eff.localeCompare(b.eff));
    const salidas = dayEvents.filter((ev) => ev.tipo === 'salida').sort((a, b) => b.eff.localeCompare(a.eff));

    const firstEntrada = entradas[0] ?? null;
    const lastSalida = salidas[0] ?? null; // sorted desc → [0] is latest

    if (firstEntrada) {
      r.entrada = firstEntrada.eff;
      r.entrada_original = firstEntrada.corregida ? firstEntrada.orig : null;
      r.entrada_corregida = firstEntrada.corregida;
    }
    if (lastSalida) {
      r.salida = lastSalida.eff;
      r.salida_original = lastSalida.corregida ? lastSalida.orig : null;
      r.salida_corregida = lastSalida.corregida;
    }
    if (firstEntrada && lastSalida) {
      const diff = new Date(lastSalida.eff).getTime() - new Date(firstEntrada.eff).getTime();
      r.duracion_neta = diff > 0 ? Math.round(diff / 60000) : null;
    }
    r.duracion_bruta = r.duracion_neta;
    if (r.permiso && r.permiso_fin) {
      const pDiff = new Date(r.permiso_fin).getTime() - new Date(r.permiso).getTime();
      r.duracion_permiso = pDiff > 0 ? Math.round(pDiff / 60000) : 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => {
    const d = b.fecha.localeCompare(a.fecha);
    return d !== 0 ? d : a.nombre.localeCompare(b.nombre);
  });
}

function getWeekRange(date: string): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
  };
}

function getMonthRange(date: string): { start: string; end: string } {
  const d = new Date(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return {
    start: first.toISOString().split('T')[0],
    end: last.toISOString().split('T')[0],
  };
}

// ── Export helpers ───────────────────────────────────────────────────────────

function exportCSV(resumenes: JornadaResumen[]) {
  const header = ['Empleado', 'Fecha', 'Entrada', 'Salida', 'Pausa inicio', 'Pausa fin', 'Permiso', 'Horas Totales', 'Incidencia', 'Dispositivo', 'Ubicación'];
  const rows = resumenes.map((r) => {
    const inc = incidentType(r.duracion_neta);
    return [
      r.nombre, r.fecha,
      formatTime(r.entrada), formatTime(r.salida),
      formatTime(r.pausa_inicio), formatTime(r.pausa_fin),
      r.permiso ? formatTime(r.permiso) : '—',
      formatDuration(r.duracion_neta),
      inc === 'excess' ? 'Exceso (>8h)' : inc === 'deficit' ? 'Déficit (<6h)' : '—',
      r.dispositivo ?? '—', r.ubicacion ?? '—',
    ];
  });
  const csv = [header, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `fichajes_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

function exportIncidentReport(resumenes: JornadaResumen[], desde: string, hasta: string) {
  const incidents = resumenes.filter((r) => isIncident(r.duracion_neta));
  const rows = incidents.map((r) => {
    const inc = incidentType(r.duracion_neta);
    return `
      <tr>
        <td>${r.nombre}</td><td>${r.fecha}</td>
        <td style="color:#16A34A">${formatTime(r.entrada)}</td>
        <td style="color:#DC2626">${formatTime(r.salida)}</td>
        <td style="font-weight:bold;color:${inc === 'excess' ? '#DC2626' : '#D97706'}">${formatDuration(r.duracion_neta)}</td>
        <td style="font-weight:bold;color:${inc === 'excess' ? '#DC2626' : '#D97706'}">${inc === 'excess' ? 'Exceso (>8h)' : 'Déficit (<6h)'}</td>
      </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe de Incidencias</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#1E293B}
  h1{font-size:18px;margin-bottom:4px}
  p{color:#64748B;margin-bottom:16px}
  table{width:100%;border-collapse:collapse}
  th{background:#0F172A;color:#fff;padding:6px 8px;text-align:left;font-size:11px}
  td{padding:5px 8px;border-bottom:1px solid #E2E8F0}
  tr:nth-child(even){background:#F8FAFC}
  @media print{body{padding:0}}
</style></head><body>
<h1>Informe de Incidencias de Fichaje</h1>
<p>Periodo: ${desde || '—'} / ${hasta || '—'} &nbsp;·&nbsp; Generado: ${new Date().toLocaleString('es-ES')}</p>
<p style="color:#DC2626;font-weight:bold">Total incidencias: ${incidents.length}</p>
<table>
<thead><tr>
  <th>Empleado</th><th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas Totales</th><th>Tipo Incidencia</th>
</tr></thead><tbody>${rows}</tbody>
</table>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ── Clock In/Out Panel ───────────────────────────────────────────────────────

interface ClockPanelProps {
  profile: { id: string; nombre: string };
  onChanged: () => void;
}

function ClockPanel({ profile, onChanged }: ClockPanelProps) {
  const [todayLogs, setTodayLogs] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [deviceAuthorized, setDeviceAuthorized] = useState(true);

  const loadToday = useCallback(async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('fichajes')
      .select('*')
      .eq('nombre_empleado', profile.nombre)
      .eq('fecha', today)
      .order('timestamp', { ascending: true });
    setTodayLogs((data ?? []) as Fichaje[]);
  }, [profile.nombre]);

  useEffect(() => { loadToday(); }, [loadToday]);

  // Check device authorization on mount
  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc('kiosk_check_device_by_profile', {
        p_device_key: getOrCreateDeviceKey(),
        p_user_profile_id: profile.id,
      });
      setDeviceAuthorized(data?.authorized ?? false);
    })();
  }, [profile.id]);

  const relevantLogs = todayLogs.filter((f) => f.tipo_evento === 'entrada' || f.tipo_evento === 'salida');
  const lastEvent = relevantLogs.length > 0 ? relevantLogs[relevantLogs.length - 1].tipo_evento : null;
  const canEntrada = !lastEvent || lastEvent === 'salida';
  const canSalida = lastEvent === 'entrada';

  // Permiso state: if the last permiso event has no matching permiso_fin, we're "in permiso"
  const permisoLogs = todayLogs.filter((f) => f.tipo_evento === 'permiso' || f.tipo_evento === 'permiso_fin');
  const inPermiso = permisoLogs.length > 0 && permisoLogs[permisoLogs.length - 1].tipo_evento === 'permiso';

  // Calculate total worked minutes from pairs (using corrected time if available)
  const entradas = relevantLogs.filter((f) => f.tipo_evento === 'entrada').map((f) => f.timestamp_corregido ?? f.timestamp);
  const salidas = relevantLogs.filter((f) => f.tipo_evento === 'salida').map((f) => f.timestamp_corregido ?? f.timestamp);
  let totalMinHoy = 0;
  const pairs = Math.min(entradas.length, salidas.length);
  for (let i = 0; i < pairs; i++) {
    const diff = new Date(salidas[i]).getTime() - new Date(entradas[i]).getTime();
    if (diff > 0) totalMinHoy += Math.round(diff / 60000);
  }

  // Calculate permiso minutes if both start and end exist
  let totalMinPermiso = 0;
  const permisoInicio = permisoLogs.find((f) => f.tipo_evento === 'permiso');
  const permisoFin = permisoLogs.find((f) => f.tipo_evento === 'permiso_fin');
  if (permisoInicio && permisoFin) {
    const effInicio = permisoInicio.timestamp_corregido ?? permisoInicio.timestamp;
    const effFin = permisoFin.timestamp_corregido ?? permisoFin.timestamp;
    const pDiff = new Date(effFin).getTime() - new Date(effInicio).getTime();
    if (pDiff > 0) totalMinPermiso = Math.round(pDiff / 60000);
  }

  const handleClock = async (tipo: 'entrada' | 'salida' | 'permiso' | 'permiso_fin') => {
    setError(''); setSuccess('');
    if (tipo === 'entrada' && !canEntrada) {
      setError('Debes fichar la salida antes de registrar una nueva entrada.');
      return;
    }
    if (tipo === 'salida' && !canSalida) {
      setError('Debes fichar la entrada antes de registrar la salida.');
      return;
    }
    if (tipo === 'permiso' && inPermiso) {
      setError('Ya tienes un permiso en curso. Ficha el fin del permiso primero.');
      return;
    }
    if (tipo === 'permiso_fin' && !inPermiso) {
      setError('No hay un permiso en curso para finalizar.');
      return;
    }
    setLoading(true);
    try {
      const { data: emp } = await supabase
        .from('empleados')
        .select('id')
        .eq('user_id', profile.id)
        .maybeSingle();

      const [ubicacion] = await Promise.all([getGeolocation()]);
      // For entrada, require GPS location before attempting to register
      if (tipo === 'entrada' && !ubicacion) {
        setError('No se pudo obtener tu ubicación GPS. Sin ubicación no se puede registrar la entrada.');
        setLoading(false);
        return;
      }

      const { data: rpcData, error: rpcErr } = await supabase.rpc('web_register_fichaje', {
        p_tipo_evento: tipo,
        p_ubicacion: ubicacion,
        p_dispositivo: getDeviceInfo(),
        p_user_agent: navigator.userAgent,
        p_device_key: getOrCreateDeviceKey(),
        p_es_manual: false,
      });
      if (rpcErr || !rpcData || rpcData.length === 0) {
        const msg = rpcData?.[0]?.error_msg || rpcErr?.message || 'Error al fichar';
        throw new Error(msg);
      }
      const rpcResult = rpcData[0] as { success: boolean; error_msg: string };
      if (!rpcResult.success) {
        const msg = rpcResult.error_msg || 'Error al fichar';
        if (msg === 'DEVICE_NOT_AUTHORIZED') {
          throw new Error('Dispositivo no autorizado. Contacta con RRHH para registrar este dispositivo.');
        } else if (msg === 'LOCATION_REQUIRED') {
          throw new Error('No se pudo obtener tu ubicación GPS. Sin ubicación no se puede registrar la entrada.');
        } else if (msg === 'PIN_INCORRECTO') {
          throw new Error('PIN incorrecto.');
        } else {
          throw new Error(msg);
        }
      }
      const tipoLabel = tipo === 'entrada' ? 'entrada' : tipo === 'salida' ? 'salida' : tipo === 'permiso' ? 'inicio de permiso' : 'fin de permiso';
      setSuccess(`Fichaje de ${tipoLabel} registrado.`);
      await loadToday();
      onChanged();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al fichar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: '#0F172A' }}>Mi Fichaje de Hoy</h3>
        <div className="flex gap-2">
          {totalMinPermiso > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
              {formatDuration(totalMinPermiso)} permiso
            </span>
          )}
          {totalMinHoy > 0 && (
            <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
              {formatDuration(totalMinHoy)} trabajadas
            </span>
          )}
        </div>
      </div>

      {/* Timeline of today's fichajes */}
      {relevantLogs.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {relevantLogs.map((f, i) => (
            <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{
                backgroundColor: f.tipo_evento === 'entrada' ? '#F0FDF4' : '#FEF2F2',
                border: `1px solid ${f.tipo_evento === 'entrada' ? '#BBF7D0' : '#FECACA'}`,
              }}>
              {f.tipo_evento === 'entrada'
                ? <LogIn size={11} style={{ color: '#16A34A' }} />
                : <LogOut size={11} style={{ color: '#DC2626' }} />}
              <span className="text-xs font-mono font-bold"
                style={{ color: f.tipo_evento === 'entrada' ? '#16A34A' : '#DC2626' }}>
                {formatTime(f.timestamp_corregido ?? f.timestamp)}
                {f.timestamp_corregido && (
                  <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }} title={`Original: ${formatTime(f.timestamp)}`}>corr.</span>
                )}
              </span>
              {i > 0 && i % 2 === 1 && (
                <span className="text-xs ml-1" style={{ color: '#94A3B8' }}>
                  ({formatDuration(Math.round((new Date(f.timestamp_corregido ?? f.timestamp).getTime() - new Date(relevantLogs[i - 1].timestamp_corregido ?? relevantLogs[i - 1].timestamp).getTime()) / 60000))})
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={13} style={{ color: '#DC2626' }} />
          <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <Clock size={13} style={{ color: '#16A34A' }} />
          <p className="text-xs" style={{ color: '#16A34A' }}>{success}</p>
        </div>
      )}

      {!deviceAuthorized && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg mb-3" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={13} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
          <p className="text-xs" style={{ color: '#DC2626' }}>Este dispositivo no está autorizado para fichar. Contacta con RRHH para registrar este dispositivo.</p>
        </div>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => handleClock('entrada')}
          disabled={loading || !canEntrada || !deviceAuthorized}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: canEntrada && deviceAuthorized ? '#16A34A' : '#E2E8F0', color: canEntrada && deviceAuthorized ? '#FFFFFF' : '#94A3B8' }}
        >
          <LogIn size={14} />
          Fichar Entrada
        </button>
        <button
          onClick={() => handleClock('salida')}
          disabled={loading || !canSalida || !deviceAuthorized}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: canSalida && deviceAuthorized ? '#DC2626' : '#E2E8F0', color: canSalida && deviceAuthorized ? '#FFFFFF' : '#94A3B8' }}
        >
          <LogOut size={14} />
          Fichar Salida
        </button>
      </div>
      <button
        onClick={() => handleClock(inPermiso ? 'permiso_fin' : 'permiso')}
        disabled={loading || !deviceAuthorized}
        className="w-full mt-2 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: deviceAuthorized ? (inPermiso ? '#6D28D9' : '#7C3AED') : '#E2E8F0',
          color: deviceAuthorized ? '#FFFFFF' : '#94A3B8',
        }}
      >
        {inPermiso ? 'Finalizar Permiso' : 'Fichar Permiso'}
      </button>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

function UbicacionCell({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: '#CBD5E1' }}>—</span>;
  const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(value)}`;
  return (
    <span className="flex items-center gap-1.5">
      <span className="truncate max-w-[130px]" title={value} style={{ color: '#64748B' }}>{value}</span>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        title="Ver en Google Maps"
        className="flex-shrink-0 rounded p-0.5 transition-colors hover:bg-blue-50"
        style={{ color: '#3B82F6' }}
        onClick={(e) => e.stopPropagation()}
      >
        <MapPin size={14} />
      </a>
    </span>
  );
}

type ViewMode = 'resumen' | 'eventos';
type PeriodFilter = 'hoy' | 'semana' | 'mes' | 'personalizado';

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

export default function FichajesModule() {
  const { profile } = useAuth();
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDesde, setFilterDesde] = useState('');
  const [filterHasta, setFilterHasta] = useState('');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('hoy');
  const [filterEmpleado, setFilterEmpleado] = useState('');
  const [filterSociedad, setFilterSociedad] = useState('');
  const [filterCentro, setFilterCentro] = useState('');
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [centros, setCentros] = useState<Centro[]>([]);
  const [deviceNames, setDeviceNames] = useState<Map<string, string>>(new Map());
  const [page, setPage] = useState(1);
  const [viewMode, setViewMode] = useState<ViewMode>('resumen');
  const [showIncidentOnly, setShowIncidentOnly] = useState(false);

  // Load reference data
  useEffect(() => {
    (async () => {
      const [{ data: empData }, { data: socData }, { data: cenData }] = await Promise.all([
        supabase.from('empleados').select('id, user_id, nombre, id_sociedad, centro_trabajo').order('nombre'),
        supabase.from('sociedades').select('id, nombre').order('nombre'),
        supabase.from('centros').select('id, nombre, id_sociedad').order('nombre'),
      ]);
      setEmpleados((empData ?? []) as Empleado[]);
      setSociedades((socData ?? []) as Sociedad[]);
      setCentros((cenData ?? []) as Centro[]);

      // Fetch kiosk + corporate device names for display
      const [{ data: kioskDevs }, { data: corpDevs }] = await Promise.all([
        supabase.from('kiosk_devices').select('device_key, site_name'),
        supabase.from('employee_registered_devices').select('device_key, device_label'),
      ]);
      const map = new Map<string, string>();
      for (const d of (kioskDevs ?? []) as { device_key: string; site_name: string }[]) {
        map.set(d.device_key, d.site_name);
      }
      for (const d of (corpDevs ?? []) as { device_key: string; device_label: string }[]) {
        map.set(d.device_key, d.device_label);
      }
      setDeviceNames(map);
    })();
  }, []);

  // Load fichajes
  const loadFichajes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('fichajes')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(5000);
      setFichajes((data ?? []) as Fichaje[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadFichajes(); }, [loadFichajes]);

  // Apply period filter to date range
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    if (periodFilter === 'hoy') {
      setFilterDesde(today); setFilterHasta(today);
    } else if (periodFilter === 'semana') {
      const { start, end } = getWeekRange(today);
      setFilterDesde(start); setFilterHasta(end);
    } else if (periodFilter === 'mes') {
      const { start, end } = getMonthRange(today);
      setFilterDesde(start); setFilterHasta(end);
    }
  }, [periodFilter]);

  useEffect(() => { setPage(1); }, [search, filterTipo, filterDesde, filterHasta, viewMode, filterEmpleado, filterSociedad, filterCentro, showIncidentOnly]);

  // Build a lookup from empleado nombre -> empleado info for sociedad/centro filtering
  const empleadoByName = new Map<string, Empleado>();
  for (const e of empleados) empleadoByName.set(e.nombre, e);

  const applyDateRange = (f: Fichaje) => {
    if (filterDesde && f.fecha < filterDesde) return false;
    if (filterHasta && f.fecha > filterHasta) return false;
    return true;
  };

  const applyEmpleadoSociedadCentro = (f: Fichaje) => {
    if (filterEmpleado && f.nombre_empleado !== filterEmpleado) return false;
    if (filterSociedad || filterCentro) {
      const emp = empleadoByName.get(f.nombre_empleado);
      if (!emp) return false;
      if (filterSociedad && emp.id_sociedad !== filterSociedad) return false;
      if (filterCentro) {
        const centro = centros.find((c) => c.id === filterCentro);
        if (centro && emp.centro_trabajo !== centro.nombre) return false;
      }
    }
    return true;
  };

  const filteredFichajes = fichajes.filter((f) => {
    if (search && !f.nombre_empleado.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipo && f.tipo_evento !== filterTipo) return false;
    if (!applyDateRange(f)) return false;
    if (!applyEmpleadoSociedadCentro(f)) return false;
    return true;
  });

  const resumenesBase = fichajes.filter((f) => {
    if (search && !f.nombre_empleado.toLowerCase().includes(search.toLowerCase())) return false;
    if (!applyDateRange(f)) return false;
    if (!applyEmpleadoSociedadCentro(f)) return false;
    return true;
  });

  let resumenes = buildResumenes(resumenesBase);
  if (showIncidentOnly) {
    resumenes = resumenes.filter((r) => isIncident(r.duracion_neta));
  }

  const tp = viewMode === 'eventos'
    ? calcTotalPages(filteredFichajes.length, 25)
    : calcTotalPages(resumenes.length, 25);
  const safePage = Math.min(page, tp);
  const pagedEventos = paginate(filteredFichajes, safePage, 25);
  const pagedResumenes = paginate(resumenes, safePage, 25);

  const totalDuracion = resumenes.reduce((acc, r) => acc + (r.duracion_neta ?? 0), 0);
  const incidentCount = resumenes.filter((r) => isIncident(r.duracion_neta)).length;
  const today = new Date().toISOString().split('T')[0];

  const filteredCentros = filterSociedad
    ? centros.filter((c) => c.id_sociedad === filterSociedad)
    : centros;

  const deviceLabel = (key: string | null): string => {
    if (!key) return '—';
    return deviceNames.get(key) ?? key;
  };

  return (
    <div className="space-y-4">
      {/* Clock panel for the current user */}
      {profile && (
        <ClockPanel profile={{ id: profile.id, nombre: profile.nombre }} onChanged={loadFichajes} />
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total eventos', value: fichajes.length, color: '#0369A1', bg: '#EFF6FF' },
          { label: 'Hoy', value: fichajes.filter((f) => f.fecha === today).length, color: '#16A34A', bg: '#F0FDF4' },
          { label: 'Jornadas completas', value: buildResumenes(fichajes).filter((r) => r.entrada && r.salida).length, color: '#7C3AED', bg: '#F5F3FF' },
          { label: 'Incidencias', value: incidentCount, color: '#DC2626', bg: '#FEF2F2' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>

        {/* Controls */}
        <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9' }}>
          {/* Search */}
          <div className="flex items-center gap-2 flex-1 min-w-[160px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <Search size={13} style={{ color: '#94A3B8' }} />
            <input
              type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empleado..."
              className="flex-1 text-sm outline-none bg-transparent" style={{ color: '#1E293B' }}
            />
          </div>

          {/* Period filter */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            {(['hoy', 'semana', 'mes', 'personalizado'] as PeriodFilter[]).map((p) => (
              <button key={p} onClick={() => setPeriodFilter(p)}
                className="px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: periodFilter === p ? '#0F172A' : '#F8FAFC', color: periodFilter === p ? '#FFFFFF' : '#475569' }}>
                {p === 'hoy' ? 'Hoy' : p === 'semana' ? 'Semana' : p === 'mes' ? 'Mes' : 'Personalizado'}
              </button>
            ))}
          </div>

          {/* Custom date range (only visible when personalizado) */}
          {periodFilter === 'personalizado' && (
            <div className="flex items-center gap-1">
              <Calendar size={13} style={{ color: '#94A3B8' }} />
              <input type="date" value={filterDesde} onChange={(e) => setFilterDesde(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }} />
              <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
              <input type="date" value={filterHasta} onChange={(e) => setFilterHasta(e.target.value)}
                className="px-2 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }} />
            </div>
          )}

          {/* Worker filter */}
          <select value={filterEmpleado} onChange={(e) => setFilterEmpleado(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer max-w-[180px]"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
            <option value="">Todos los trabajadores</option>
            {empleados.map((e) => (
              <option key={e.id} value={e.nombre}>{e.nombre}</option>
            ))}
          </select>

          {/* Empresa filter */}
          <select value={filterSociedad} onChange={(e) => { setFilterSociedad(e.target.value); setFilterCentro(''); }}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
            <option value="">Todas las empresas</option>
            {sociedades.map((s) => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>

          {/* Centro filter */}
          <select value={filterCentro} onChange={(e) => setFilterCentro(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
            <option value="">Todos los centros</option>
            {filteredCentros.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>

          {/* Tipo filter (eventos only) */}
          {viewMode === 'eventos' && (
            <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-sm outline-none cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#475569' }}>
              <option value="">Todos los tipos</option>
              <option value="entrada">Entrada</option>
              <option value="salida">Salida</option>
              <option value="pausa_inicio">Descanso</option>
              <option value="pausa_fin">Fin descanso</option>
              <option value="permiso">Permiso (inicio)</option>
              <option value="permiso_fin">Permiso (fin)</option>
            </select>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            {(['resumen', 'eventos'] as ViewMode[]).map((v) => (
              <button key={v} onClick={() => setViewMode(v)}
                className="px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: viewMode === v ? '#0F172A' : '#F8FAFC', color: viewMode === v ? '#FFFFFF' : '#475569' }}>
                {v === 'resumen' ? 'Resumen diario' : 'Todos los eventos'}
              </button>
            ))}
          </div>

          {/* Incident-only toggle */}
          {viewMode === 'resumen' && (
            <button onClick={() => setShowIncidentOnly(!showIncidentOnly)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              style={{
                backgroundColor: showIncidentOnly ? '#FEF2F2' : '#F8FAFC',
                color: showIncidentOnly ? '#DC2626' : '#475569',
                border: `1px solid ${showIncidentOnly ? '#FECACA' : '#E2E8F0'}`,
              }}>
              <AlertTriangle size={12} />
              {showIncidentOnly ? 'Solo incidencias' : 'Filtrar incidencias'}
            </button>
          )}

          {/* Export buttons */}
          <button
            onClick={() => viewMode === 'resumen' ? exportCSV(resumenes) : null}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
            <Download size={12} />
            Excel / CSV
          </button>
          <button
            onClick={() => exportIncidentReport(resumenes, filterDesde, filterHasta)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors hover:opacity-80"
            style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            <FileText size={12} />
            Informe Incidencias
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
          </div>

        ) : viewMode === 'resumen' ? (
          <>
            {pagedResumenes.length === 0 ? (
              <div className="py-12 text-center">
                <Clock size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No hay jornadas registradas</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '1000px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Empleado', 'Fecha', 'Entrada', 'Salida', 'Pausa', 'Permiso', 'Horas Totales', 'Estado', 'Corr.', 'Dispositivo', 'Ubicación'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                    {pagedResumenes.map((r, i) => {
                      const pausaMin = (r.pausa_inicio && r.pausa_fin)
                        ? Math.round((new Date(r.pausa_fin).getTime() - new Date(r.pausa_inicio).getTime()) / 60000)
                        : null;
                      const inc = incidentType(r.duracion_neta);
                      return (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold" style={{ color: '#1E293B' }}>{r.nombre}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#475569' }}>{r.fecha}</td>
                          <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.entrada ? '#16A34A' : '#CBD5E1' }}>
                            <div className="flex flex-col gap-0.5">
                              <span>{formatTime(r.entrada)}</span>
                              {r.entrada_corregida && (
                                <span className="text-[10px] font-normal" style={{ color: '#94A3B8' }}>
                                  <s>{formatTime(r.entrada_original)}</s>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.salida ? '#DC2626' : '#CBD5E1' }}>
                            <div className="flex flex-col gap-0.5">
                              <span>{formatTime(r.salida)}</span>
                              {r.salida_corregida && (
                                <span className="text-[10px] font-normal" style={{ color: '#94A3B8' }}>
                                  <s>{formatTime(r.salida_original)}</s>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-mono" style={{ color: '#D97706' }}>{formatDuration(pausaMin)}</td>
                          <td className="px-4 py-3">
                            {r.permiso ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                                  {formatTime(r.permiso)}
                                </span>
                                {r.permiso_fin && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#EDE9FE', color: '#6D28D9', border: '1px solid #C4B5FD' }}>
                                    → {formatTime(r.permiso_fin)}
                                  </span>
                                )}
                                {r.duracion_permiso != null && (
                                  <span className="text-[10px]" style={{ color: '#7C3AED' }}>{formatDuration(r.duracion_permiso)}</span>
                                )}
                              </div>
                            ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-sm font-bold" style={{ color: r.duracion_neta !== null ? (inc ? '#DC2626' : '#0369A1') : '#CBD5E1' }}>
                            {formatDuration(r.duracion_neta)}
                          </td>
                          <td className="px-4 py-3">
                            {inc === 'excess' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                                <ChevronUp size={10} /> Exceso
                              </span>
                            )}
                            {inc === 'deficit' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>
                                <ChevronDown size={10} /> Déficit
                              </span>
                            )}
                            {!inc && r.duracion_neta !== null && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                                Normal
                              </span>
                            )}
                            {r.duracion_neta === null && <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}>
                            {(r.entrada_corregida || r.salida_corregida) ? (
                              <span title={r.motivo_correccion ?? ''} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                                Sí
                              </span>
                            ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[140px] truncate" style={{ color: '#64748B' }} title={deviceLabel(r.dispositivo)}>{deviceLabel(r.dispositivo)}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}><UbicacionCell value={r.ubicacion} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={safePage} totalPages={tp} totalItems={resumenes.length} pageSize={25} onPage={setPage} />
          </>

        ) : (
          <>
            {pagedEventos.length === 0 ? (
              <div className="py-12 text-center">
                <Clock size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>No hay eventos</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ minWidth: '900px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                      {['Empleado', 'Fecha / Hora', 'Tipo', 'Dispositivo', 'Ubicación', 'Notas'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#94A3B8' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: '#F1F5F9' }}>
                    {pagedEventos.map((f) => {
                      const tipo = TIPO_LABELS[f.tipo_evento] ?? { label: f.tipo_evento, color: '#475569', bg: '#F8FAFC', border: '#E2E8F0' };
                      return (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 font-semibold" style={{ color: '#1E293B' }}>
                            {f.nombre_empleado}
                            {f.es_manual && <span className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF9C3', color: '#713F12' }}>Manual</span>}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-mono" style={{ color: '#475569' }}>{f.fecha}</p>
                            <p className="text-xs font-mono font-bold" style={{ color: '#1E293B' }}>
                              {formatTime(f.timestamp_corregido ?? f.timestamp)}
                              {f.timestamp_corregido && (
                                <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }} title={`Original: ${formatTime(f.timestamp)}`}>corr.</span>
                              )}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-1 rounded-lg text-xs font-semibold"
                              style={{ backgroundColor: tipo.bg, color: tipo.color, border: `1px solid ${tipo.border}` }}>
                              {tipo.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs max-w-[160px] truncate" style={{ color: '#64748B' }} title={deviceLabel(f.dispositivo)}>{deviceLabel(f.dispositivo)}</td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#64748B' }}><UbicacionCell value={f.ubicacion} /></td>
                          <td className="px-4 py-3 text-xs" style={{ color: '#94A3B8' }}>{f.nota_correccion ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <Pagination page={safePage} totalPages={tp} totalItems={filteredFichajes.length} pageSize={25} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
}
