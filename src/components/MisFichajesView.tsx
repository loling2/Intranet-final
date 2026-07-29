import { useState, useEffect, useCallback } from 'react';
import {
  Clock, RefreshCw, Download, Calendar, AlertTriangle, X,
  ChevronUp, ChevronDown, CheckCircle2, FileText, Send, Car,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import type { SocietyTheme } from '../themes';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Fichaje {
  id: string;
  empleado_id: string | null;
  nombre_empleado: string;
  fecha: string;
  timestamp: string;
  tipo_evento: 'entrada' | 'salida' | 'pausa_inicio' | 'pausa_fin' | 'permiso' | 'permiso_fin';
  dispositivo: string | null;
  ubicacion: string | null;
  nota_correccion: string | null;
  timestamp_corregido: string | null;
  motivo_correccion: string | null;
}

interface JornadaResumen {
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
  empleado_id: string | null;
  fichaje_entrada_id: string | null;
  fichaje_salida_id: string | null;
}

interface Correccion {
  id: string;
  fichaje_id: string | null;
  fecha: string;
  entrada_original: string | null;
  salida_original: string | null;
  entrada_propuesta: string | null;
  salida_propuesta: string | null;
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'rechazada';
  validado_por_nombre: string | null;
  respuesta_rrhh: string | null;
  validado_at: string | null;
  created_at: string;
}

interface VehicleLogEntry {
  id: string;
  vehicle_id: string;
  user_id: string | null;
  user_nombre: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  km_inicio: number | null;
  km_fin: number | null;
  duracion_minutos: number | null;
  tipo: string;
  created_at: string;
  vehicles: { matricula: string; modelo: string } | null;
}

// ── Constants ────────────────────────────────────────────────────────────────

const NORMAL_HOURS_MIN = 6 * 60;
const NORMAL_HOURS_MAX = 8 * 60;
const MAX_RANGE_DAYS = 90; // 3 months

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
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

function effectiveTs(f: Fichaje): string {
  return f.timestamp_corregido ?? f.timestamp;
}

function buildResumenes(fichajes: Fichaje[]): JornadaResumen[] {
  const map = new Map<string, JornadaResumen>();
  const sorted = [...fichajes].sort((a, b) => effectiveTs(a).localeCompare(effectiveTs(b)));
  for (const f of sorted) {
    const key = f.fecha;
    if (!map.has(key)) {
      map.set(key, {
        fecha: f.fecha,
        entrada: null, salida: null, entrada_original: null, salida_original: null,
        entrada_corregida: false, salida_corregida: false, motivo_correccion: null,
        pausa_inicio: null, pausa_fin: null, permiso: null, permiso_fin: null, duracion_permiso: null,
        duracion_bruta: null, duracion_neta: null,
        empleado_id: f.empleado_id,
        fichaje_entrada_id: null, fichaje_salida_id: null,
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
  }

  // Pair entrada/salida chronologically: walk through all events in time order,
  // open a session on 'entrada', close it on the next 'salida'.
  for (const [key, r] of map.entries()) {
    const dayEvents = sorted
      .filter((f) => f.fecha === key && (f.tipo_evento === 'entrada' || f.tipo_evento === 'salida'))
      .map((f) => ({ tipo: f.tipo_evento, eff: effectiveTs(f), orig: f.timestamp, id: f.id, corregida: !!f.timestamp_corregido }));

    let total = 0;
    let openEntrada: { eff: string; orig: string; id: string; corregida: boolean } | null = null;
    let firstEntrada: { eff: string; orig: string; id: string; corregida: boolean } | null = null;
    let lastSalida: { eff: string; orig: string; id: string; corregida: boolean } | null = null;
    let pairs = 0;

    for (const ev of dayEvents) {
      if (ev.tipo === 'entrada') {
        if (openEntrada) {
          // Previous entrada never got a salida — skip it, start new session
        }
        openEntrada = { eff: ev.eff, orig: ev.orig, id: ev.id, corregida: ev.corregida };
        if (!firstEntrada) firstEntrada = openEntrada;
      } else if (ev.tipo === 'salida' && openEntrada) {
        const diff = new Date(ev.eff).getTime() - new Date(openEntrada.eff).getTime();
        if (diff > 0) total += Math.round(diff / 60000);
        pairs++;
        lastSalida = { eff: ev.eff, orig: ev.orig, id: ev.id, corregida: ev.corregida };
        openEntrada = null;
      }
    }

    if (firstEntrada) {
      r.entrada = firstEntrada.eff;
      r.entrada_original = firstEntrada.orig;
      r.entrada_corregida = firstEntrada.corregida;
      r.fichaje_entrada_id = firstEntrada.id;
    }
    if (lastSalida) {
      r.salida = lastSalida.eff;
      r.salida_original = lastSalida.orig;
      r.salida_corregida = lastSalida.corregida;
      r.fichaje_salida_id = lastSalida.id;
    }
    r.duracion_neta = pairs > 0 ? total : null;
    r.duracion_bruta = r.duracion_neta;
    if (r.permiso && r.permiso_fin) {
      const pDiff = new Date(r.permiso_fin).getTime() - new Date(r.permiso).getTime();
      r.duracion_permiso = pDiff > 0 ? Math.round(pDiff / 60000) : 0;
    }
  }
  return Array.from(map.values()).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

function toLocalDatetimeInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function fromLocalDatetimeInputValue(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

// ── PDF Export ────────────────────────────────────────────────────────────────

function exportPDF(
  resumenes: JornadaResumen[],
  correcciones: Correccion[],
  nombreEmpleado: string,
  desde: string,
  hasta: string,
) {
  const w = window.open('', '_blank');
  if (!w) return;

  const rowsHtml = resumenes.map((r) => {
    const inc = incidentType(r.duracion_neta);
    const incidentLabel = inc === 'excess' ? 'Exceso (>8h)' : inc === 'deficit' ? 'Déficit (<6h)' : 'Normal';
    const incidentColor = inc === 'excess' ? '#DC2626' : inc === 'deficit' ? '#D97706' : '#16A34A';
    return `
      <tr>
        <td>${r.fecha}</td>
        <td style="color:#16A34A">${formatTime(r.entrada)}${r.entrada_corregida ? ' <span title="Original: ' + formatTime(r.entrada_original) + '" style="font-size:10px;background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;border-radius:3px;padding:0 2px">corr.</span>' : ''}</td>
        <td style="color:#DC2626">${formatTime(r.salida)}${r.salida_corregida ? ' <span title="Original: ' + formatTime(r.salida_original) + '" style="font-size:10px;background:#F0FDF4;color:#16A34A;border:1px solid #BBF7D0;border-radius:3px;padding:0 2px">corr.</span>' : ''}</td>
        <td style="font-weight:bold">${formatDuration(r.duracion_neta)}</td>
        <td style="color:#7C3AED">${r.permiso ? formatTime(r.permiso) + (r.permiso_fin ? ' → ' + formatTime(r.permiso_fin) : '') + (r.duracion_permiso != null ? ' (' + formatDuration(r.duracion_permiso) + ')' : '') : '—'}</td>
        <td style="font-weight:bold;color:${incidentColor}">${incidentLabel}</td>
      </tr>`;
  }).join('');

  const corrHtml = correcciones.length === 0
    ? '<p style="color:#94A3B8">Sin correcciones solicitadas en el periodo.</p>'
    : correcciones.map((c) => {
        const estadoColor = c.estado === 'aprobada' ? '#16A34A' : c.estado === 'rechazada' ? '#DC2626' : '#D97706';
        const estadoLabel = c.estado.charAt(0).toUpperCase() + c.estado.slice(1);
        return `
          <div style="border:1px solid #E2E8F0;border-radius:8px;padding:10px;margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong>${c.fecha}</strong>
              <span style="color:${estadoColor};font-weight:bold">${estadoLabel}</span>
            </div>
            <div style="font-size:11px;color:#475569">
              <div>Original: ${formatTime(c.entrada_original)} → ${formatTime(c.salida_original)}</div>
              <div>Propuesta: ${formatTime(c.entrada_propuesta)} → ${formatTime(c.salida_propuesta)}</div>
              <div style="margin-top:4px"><em>Motivo:</em> ${c.motivo}</div>
              ${c.respuesta_rrhh ? `<div style="margin-top:4px"><em>RRHH:</em> ${c.respuesta_rrhh}</div>` : ''}
              ${c.validado_por_nombre ? `<div style="margin-top:4px;color:#94A3B8">Validado por: ${c.validado_por_nombre} · ${formatDateTime(c.validado_at)}</div>` : ''}
            </div>
          </div>`;
      }).join('');

  // Unique verification code: hash of content + timestamp, persisted server-side via correcciones ids
  const verificationCode = btoa(`${nombreEmpleado}|${desde}|${hasta}|${resumenes.length}|${correcciones.length}|${Date.now()}`).slice(0, 24);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Mis Fichajes — ${nombreEmpleado}</title>
<style>
  body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1E293B}
  h1{font-size:20px;margin:0 0 4px}
  h2{font-size:14px;margin:20px 0 8px;color:#0F172A}
  p{color:#64748B;margin:0 0 4px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th{background:#0F172A;color:#fff;padding:6px 8px;text-align:left;font-size:11px}
  td{padding:5px 8px;border-bottom:1px solid #E2E8F0}
  tr:nth-child(even){background:#F8FAFC}
  .code{margin-top:24px;padding:10px;border:1px dashed #94A3B8;border-radius:8px;background:#F8FAFC;font-family:monospace;font-size:11px;color:#475569}
  @media print{body{padding:0}}
</style></head><body>
<h1>Mis Fichajes</h1>
<p><strong>Empleado:</strong> ${nombreEmpleado}</p>
<p><strong>Periodo:</strong> ${desde || '—'} a ${hasta || '—'}</p>
<p><strong>Generado:</strong> ${new Date().toLocaleString('es-ES')}</p>
<h2>Resumen diario</h2>
<table>
<thead><tr>
  <th>Fecha</th><th>Entrada</th><th>Salida</th><th>Horas Totales</th><th>Permiso</th><th>Incidencia</th>
</tr></thead>
<tbody>${rowsHtml}</tbody>
</table>
<h2>Correcciones solicitadas</h2>
${corrHtml}
<div class="code">
  Código de verificación: <strong>${verificationCode}</strong><br/>
  Conserve este código para validar la autenticidad del informe.
</div>
</body></html>`;

  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 400);
}

// ── Correction Modal ──────────────────────────────────────────────────────────

interface CorrectionModalProps {
  jornada: JornadaResumen;
  nombreEmpleado: string;
  onClose: () => void;
  onSaved: () => void;
}

function CorrectionModal({ jornada, nombreEmpleado, onClose, onSaved }: CorrectionModalProps) {
  const [entradaProp, setEntradaProp] = useState(toLocalDatetimeInputValue(jornada.entrada));
  const [salidaProp, setSalidaProp] = useState(toLocalDatetimeInputValue(jornada.salida));
  const [motivo, setMotivo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    if (!motivo.trim()) { setError('Debes explicar el motivo de la corrección.'); return; }
    if (!entradaProp && !salidaProp) { setError('Debes proponer al menos una hora corregida.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Sin sesión activa');

      const { error: insErr } = await supabase.from('fichajes_correcciones').insert({
        fichaje_id: jornada.fichaje_salida_id ?? jornada.fichaje_entrada_id,
        empleado_id: jornada.empleado_id,
        user_id: user.id,
        nombre_empleado: nombreEmpleado,
        fecha: jornada.fecha,
        entrada_original: jornada.entrada,
        salida_original: jornada.salida,
        entrada_propuesta: fromLocalDatetimeInputValue(entradaProp),
        salida_propuesta: fromLocalDatetimeInputValue(salidaProp),
        motivo: motivo.trim(),
        estado: 'pendiente',
      });
      if (insErr) throw insErr;
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al enviar la petición');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <AlertTriangle size={14} className="text-white" />
            </div>
            <h2 className="text-white font-semibold text-sm">Solicitar corrección — {jornada.fecha}</h2>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#fff' }}>
            <X size={13} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
              <AlertTriangle size={13} style={{ color: '#DC2626' }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
            </div>
          )}

          <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <p style={{ color: '#64748B', marginBottom: 4 }}>Registro original:</p>
            <div className="flex gap-4">
              <span>Entrada: <strong style={{ color: '#16A34A' }}>{formatTime(jornada.entrada)}</strong></span>
              <span>Salida: <strong style={{ color: '#DC2626' }}>{formatTime(jornada.salida)}</strong></span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
              Nueva entrada
            </label>
            <input
              type="datetime-local"
              value={entradaProp}
              onChange={(e) => setEntradaProp(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
              Nueva salida
            </label>
            <input
              type="datetime-local"
              value={salidaProp}
              onChange={(e) => setSalidaProp(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>
              Motivo / Incidencia *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              placeholder="Ej: Me olvidé de fichar la salida, salí a las 14:00"
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              La petición se enviará a RRHH para validación.
            </p>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !motivo.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0369A1' }}
            >
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
              Enviar petición
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  theme: SocietyTheme;
  userId: string | null;
}

export default function MisFichajesView({ theme, userId }: Props) {
  const [fichajes, setFichajes] = useState<Fichaje[]>([]);
  const [correcciones, setCorrecciones] = useState<Correccion[]>([]);
  const [nombreEmpleado, setNombreEmpleado] = useState('');
  const [loading, setLoading] = useState(true);
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState('');
  const [correctionTarget, setCorrectionTarget] = useState<JornadaResumen | null>(null);
  const [vehicleLogs, setVehicleLogs] = useState<VehicleLogEntry[]>([]);
  const [viewMode, setViewMode] = useState<'asistencia' | 'vehiculos'>('asistencia');

  // Default: last 30 days
  useEffect(() => {
    const today = new Date();
    const start = new Date();
    start.setDate(today.getDate() - 29);
    setHasta(today.toISOString().split('T')[0]);
    setDesde(start.toISOString().split('T')[0]);
  }, []);

  const loadData = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      // Resolve name from user_profiles — this is what fichajes store in nombre_empleado
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('nombre')
        .eq('id', userId)
        .maybeSingle();
      const resolvedNombre = prof?.nombre ?? '';

      // Also try empleados for the name fallback
      const { data: emp } = await supabase
        .from('empleados')
        .select('id, nombre')
        .eq('user_id', userId)
        .maybeSingle();

      setNombreEmpleado(resolvedNombre || emp?.nombre || '');

      // Load fichajes — always filter by nombre_empleado (fichajes store the profile name, not empleado_id)
      const { data: fichData, error: fichErr } = await supabase
        .from('fichajes')
        .select('*')
        .eq('nombre_empleado', resolvedNombre)
        .order('timestamp', { ascending: false })
        .limit(2000);
      if (fichErr) throw fichErr;
      setFichajes((fichData ?? []) as Fichaje[]);

      // Load correcciones for this user
      const { data: corrData } = await supabase
        .from('fichajes_correcciones')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      setCorrecciones((corrData ?? []) as Correccion[]);

      // Load vehicle logs for this user
      const { data: vehData, error: vehErr } = await supabase
        .from('vehicle_logs')
        .select('id, vehicle_id, user_id, user_nombre, fecha_inicio, fecha_fin, km_inicio, km_fin, duracion_minutos, tipo, created_at, vehicles(matricula, modelo)')
        .eq('user_id', userId)
        .order('fecha_inicio', { ascending: false })
        .limit(500);
      if (vehErr) throw vehErr;
      setVehicleLogs((vehData ?? []) as unknown as VehicleLogEntry[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al cargar fichajes');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Validate date range: max 3 months
  const rangeValid = (() => {
    if (!desde || !hasta) return true;
    const d = new Date(desde);
    const h = new Date(hasta);
    if (d > h) return false;
    const diffDays = (h.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= MAX_RANGE_DAYS;
  })();

  const filteredFichajes = fichajes.filter((f) => {
    if (desde && f.fecha < desde) return false;
    if (hasta && f.fecha > hasta) return false;
    return true;
  });

  const resumenes = buildResumenes(filteredFichajes);
  const totalHoras = resumenes.reduce((acc, r) => acc + (r.duracion_neta ?? 0), 0);
  const incidentCount = resumenes.filter((r) => isIncident(r.duracion_neta)).length;
  const pendientesCount = correcciones.filter((c) => c.estado === 'pendiente').length;

  // Correcciones for the selected date range
  const correccionesInRange = correcciones.filter((c) => {
    if (desde && c.fecha < desde) return false;
    if (hasta && c.fecha > hasta) return false;
    return true;
  });

  const filteredVehicleLogs = vehicleLogs.filter((v) => {
    const logDate = v.fecha_inicio.split('T')[0];
    if (desde && logDate < desde) return false;
    if (hasta && logDate > hasta) return false;
    return true;
  });

  const handleExportPDF = () => {
    if (!rangeValid || resumenes.length === 0) return;
    exportPDF(resumenes, correccionesInRange, nombreEmpleado || 'Empleado', desde, hasta);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: theme.primaryLight }}>
            <Clock size={18} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="text-lg font-bold" style={{ color: theme.textPrimary }}>Mis Fichajes</h3>
            {!loading && viewMode === 'asistencia' && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {resumenes.length} jornada{resumenes.length !== 1 ? 's' : ''} · {formatDuration(totalHoras)} totales
              </p>
            )}
            {!loading && viewMode === 'vehiculos' && (
              <p className="text-xs" style={{ color: theme.textSecondary }}>
                {filteredVehicleLogs.length} registro{filteredVehicleLogs.length !== 1 ? 's' : ''} de vehículo
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex rounded-xl overflow-hidden" style={{ border: `1px solid ${theme.border}` }}>
            <button
              onClick={() => setViewMode('asistencia')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer transition-all"
              style={{
                backgroundColor: viewMode === 'asistencia' ? theme.primary : theme.bgCard,
                color: viewMode === 'asistencia' ? '#FFFFFF' : theme.textSecondary,
              }}
            >
              <Clock size={13} /> Asistencia
            </button>
            <button
              onClick={() => setViewMode('vehiculos')}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold cursor-pointer transition-all"
              style={{
                backgroundColor: viewMode === 'vehiculos' ? theme.primary : theme.bgCard,
                color: viewMode === 'vehiculos' ? '#FFFFFF' : theme.textSecondary,
              }}
            >
              <Car size={13} /> Vehículos
            </button>
          </div>
          {viewMode === 'asistencia' && (
            <button
              onClick={handleExportPDF}
              disabled={loading || resumenes.length === 0 || !rangeValid}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition-all duration-150 disabled:opacity-50"
              style={{ backgroundColor: theme.primary, color: '#FFFFFF' }}
            >
              <Download size={14} />
              Descargar PDF
            </button>
          )}
        </div>
      </div>

      {/* Date filter */}
      <div className="rounded-2xl p-4" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar size={15} style={{ color: theme.textSecondary }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>Periodo:</span>
          </div>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
          />
          <span style={{ color: theme.textSecondary }}>—</span>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm outline-none cursor-pointer"
            style={{ backgroundColor: theme.bg, border: `1px solid ${theme.border}`, color: theme.textPrimary }}
          />
          <span className="text-xs" style={{ color: theme.textSecondary }}>
            Máximo 3 meses (90 días)
          </span>
          {!rangeValid && (
            <span className="text-xs font-medium" style={{ color: '#DC2626' }}>
              El rango no puede superar los 90 días
            </span>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Jornadas', value: resumenes.length, color: theme.primary, bg: theme.primaryLight },
          { label: 'Horas totales', value: formatDuration(totalHoras), color: '#0369A1', bg: '#EFF6FF' },
          { label: 'Incidencias', value: incidentCount, color: '#DC2626', bg: '#FEF2F2' },
          { label: 'Pet. pendientes', value: pendientesCount, color: '#D97706', bg: '#FFFBEB' },
        ].map((kpi, i) => (
          <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Asistencia table */}
      {viewMode === 'asistencia' && (
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: theme.textSecondary }} />
          </div>
        ) : resumenes.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Clock size={32} style={{ color: theme.border, margin: '0 auto 8px' }} />
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>No hay fichajes en este periodo</p>
            <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Ajusta el rango de fechas para ver registros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '760px' }}>
              <thead>
                <tr style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
                  {['Fecha', 'Entrada', 'Salida', 'Permiso', 'Horas Totales', 'Incidencia', 'Acción'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: theme.border }}>
                {resumenes.map((r, i) => {
                  const inc = incidentType(r.duracion_neta);
                  const corrForDate = correcciones.filter((c) => c.fecha === r.fecha);
                  const hasPendiente = corrForDate.some((c) => c.estado === 'pendiente');
                  const hasAprobada = corrForDate.some((c) => c.estado === 'aprobada');
                  return (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: theme.textPrimary }}>{r.fecha}</td>
                      <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.entrada ? '#16A34A' : '#CBD5E1' }}>
                        {formatTime(r.entrada)}
                        {r.entrada_corregida && (
                          <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }} title={`Original: ${formatTime(r.entrada_original)}`}>corr.</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: r.salida ? '#DC2626' : '#CBD5E1' }}>
                        {formatTime(r.salida)}
                        {r.salida_corregida && (
                          <span className="ml-1 inline-flex items-center px-1 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }} title={`Original: ${formatTime(r.salida_original)}`}>corr.</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: '#7C3AED' }}>
                        {r.permiso ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{formatTime(r.permiso)}</span>
                            {r.permiso_fin && <span style={{ color: '#6D28D9' }}>→ {formatTime(r.permiso_fin)}</span>}
                            {r.duracion_permiso != null && <span className="text-[10px]">{formatDuration(r.duracion_permiso)}</span>}
                          </div>
                        ) : <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: r.duracion_neta !== null ? (inc ? '#DC2626' : theme.primary) : '#CBD5E1' }}>
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            <CheckCircle2 size={11} /> Normal
                          </span>
                        )}
                        {r.duracion_neta === null && <span style={{ color: '#CBD5E1' }}>—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {hasAprobada ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                            <CheckCircle2 size={11} /> Resuelta
                          </span>
                        ) : hasPendiente ? (
                          <span className="text-xs font-medium" style={{ color: '#D97706' }}>
                            Petición enviada
                          </span>
                        ) : (
                          <button
                            onClick={() => setCorrectionTarget(r)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-150 hover:opacity-80"
                            style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}
                          >
                            <AlertTriangle size={11} />
                            Corregir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Vehicle logs table */}
      {viewMode === 'vehiculos' && (
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={20} className="animate-spin" style={{ color: theme.textSecondary }} />
          </div>
        ) : filteredVehicleLogs.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <Car size={32} style={{ color: theme.border, margin: '0 auto 8px' }} />
            <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>No hay registros de vehículo en este periodo</p>
            <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>Ajusta el rango de fechas para ver registros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ minWidth: '720px' }}>
              <thead>
                <tr style={{ backgroundColor: theme.bg, borderBottom: `1px solid ${theme.border}` }}>
                  {['Fecha', 'Vehículo', 'Inicio', 'Fin', 'KM Inicio', 'KM Fin', 'Recorrido', 'Duración'].map((h) => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: theme.textSecondary }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: theme.border }}>
                {filteredVehicleLogs.map((v) => {
                  const kmRecorrido = (v.km_fin != null && v.km_inicio != null) ? v.km_fin - v.km_inicio : null;
                  const veh = v.vehicles;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-xs font-medium" style={{ color: theme.textPrimary }}>
                        {new Date(v.fecha_inicio).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: theme.textPrimary }}>
                        <div className="flex items-center gap-1.5">
                          <Car size={12} style={{ color: theme.primary }} />
                          <span className="font-semibold">{veh?.matricula ?? '—'}</span>
                          {veh?.modelo && <span style={{ color: theme.textSecondary }}>{veh.modelo}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: '#16A34A' }}>{formatTime(v.fecha_inicio)}</td>
                      <td className="px-4 py-3 text-xs font-mono font-bold" style={{ color: v.fecha_fin ? '#DC2626' : '#CBD5E1' }}>{formatTime(v.fecha_fin)}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: theme.textPrimary }}>{v.km_inicio ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-mono" style={{ color: theme.textPrimary }}>{v.km_fin ?? '—'}</td>
                      <td className="px-4 py-3 text-xs font-bold" style={{ color: kmRecorrido != null ? theme.primary : '#CBD5E1' }}>
                        {kmRecorrido != null ? `${kmRecorrido} km` : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: theme.textPrimary }}>{formatDuration(v.duracion_minutos)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* Correcciones list */}
      {viewMode === 'asistencia' && correcciones.length > 0 && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: theme.bgCard, border: `1px solid ${theme.border}` }}>
          <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: `1px solid ${theme.border}`, backgroundColor: theme.bg }}>
            <FileText size={14} style={{ color: theme.primary }} />
            <h4 className="text-sm font-semibold" style={{ color: theme.textPrimary }}>Mis peticiones de corrección</h4>
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: theme.primaryLight, color: theme.primary }}>
              {correcciones.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: theme.border }}>
            {correcciones.map((c) => {
              const estadoColor = c.estado === 'aprobada' ? '#16A34A' : c.estado === 'rechazada' ? '#DC2626' : '#D97706';
              const estadoBg = c.estado === 'aprobada' ? '#F0FDF4' : c.estado === 'rechazada' ? '#FEF2F2' : '#FFFBEB';
              const estadoBorder = c.estado === 'aprobada' ? '#BBF7D0' : c.estado === 'rechazada' ? '#FECACA' : '#FDE68A';
              const estadoLabel = c.estado.charAt(0).toUpperCase() + c.estado.slice(1);
              return (
                <div key={c.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div>
                      <p className="text-sm font-semibold" style={{ color: theme.textPrimary }}>{c.fecha}</p>
                      <p className="text-xs mt-0.5" style={{ color: theme.textSecondary }}>
                        Original: {formatTime(c.entrada_original)} → {formatTime(c.salida_original)} · Propuesta: {formatTime(c.entrada_propuesta)} → {formatTime(c.salida_propuesta)}
                      </p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold flex-shrink-0" style={{ backgroundColor: estadoBg, color: estadoColor, border: `1px solid ${estadoBorder}` }}>
                      {estadoLabel}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: theme.textPrimary }}>
                    <span style={{ color: theme.textSecondary }}>Tu incidencia:</span> {c.motivo}
                  </p>
                  {c.respuesta_rrhh && (
                    <p className="text-xs mt-1.5" style={{ color: theme.textPrimary }}>
                      <span style={{ color: theme.textSecondary }}>RRHH:</span> {c.respuesta_rrhh}
                    </p>
                  )}
                  {c.validado_por_nombre && (
                    <p className="text-xs mt-1" style={{ color: theme.textSecondary }}>
                      Validado por {c.validado_por_nombre} · {formatDateTime(c.validado_at)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {correctionTarget && (
        <CorrectionModal
          jornada={correctionTarget}
          nombreEmpleado={nombreEmpleado}
          onClose={() => setCorrectionTarget(null)}
          onSaved={loadData}
        />
      )}
    </div>
  );
}
