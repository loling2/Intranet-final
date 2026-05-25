import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, Download, FileText,
  RefreshCw, AlertCircle, Calendar, ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useSociety } from '../context/SocietyContext';
import { writeAuditLog } from '../lib/auditLog';
import { uploadToWasabi } from '../lib/wasabi';
import { AppRole } from '../context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VacationRequest {
  id: string;
  employee_id: string;
  employee_nombre: string;
  society_id: string;
  fecha_inicio: string;
  fecha_fin: string;
  dias: number;
  motivo: string;
  estado: 'pendiente' | 'aprobada' | 'denegada';
  comentario_rrhh: string | null;
  revisado_por: string | null;
  revisado_por_nombre: string | null;
  documento_path: string | null;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function dateStr(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function countWorkdays(from: string, to: string): number {
  const start = new Date(from);
  const end = new Date(to);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

function generateVacationPDF(req: VacationRequest): Blob {
  const content = `CARTA DE VACACIONES

Estimado/a ${req.employee_nombre},

Nos complace comunicarle que su solicitud de vacaciones ha sido APROBADA.

Periodo: ${req.fecha_inicio} a ${req.fecha_fin}
Dias laborables: ${req.dias}
Motivo: ${req.motivo}

Esta carta certifica la aprobacion formal de su periodo vacacional.

Firmado por: ${req.revisado_por_nombre ?? 'RRHH'}
Fecha de aprobacion: ${new Date().toLocaleDateString('es-ES')}

---
Documento generado automaticamente por el Portal del Empleado.
`;
  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

// ─── Denial modal ─────────────────────────────────────────────────────────────

function DenyModal({ onConfirm, onClose, loading }: { onConfirm: (comment: string) => void; onClose: () => void; loading: boolean }) {
  const [comment, setComment] = useState('');
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
        <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #DC2626, #B91C1C)' }}>
          <div>
            <h2 className="text-white font-semibold">Denegar Solicitud</h2>
            <p className="text-white/70 text-xs">Incluye un comentario para el empleado</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            <X size={14} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Motivo / Observacion</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Explica el motivo de la denegacion..."
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
            />
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Cancelar</button>
            <button
              onClick={() => onConfirm(comment)}
              disabled={!comment.trim() || loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#DC2626' }}
            >
              {loading && <RefreshCw size={13} className="animate-spin" />}
              Denegar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Employee calendar view ───────────────────────────────────────────────────

function EmployeeCalendar({ requests, onSubmit, loading }: {
  requests: VacationRequest[];
  onSubmit: (from: string, to: string, motivo: string, dias: number) => Promise<void>;
  loading: boolean;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [submitError, setSubmitError] = useState('');

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  const approvedDates = new Set<string>();
  const pendingDates = new Set<string>();
  requests.forEach((r) => {
    const cur = new Date(r.fecha_inicio);
    const end = new Date(r.fecha_fin);
    while (cur <= end) {
      const s = cur.toISOString().slice(0, 10);
      if (r.estado === 'aprobada') approvedDates.add(s);
      if (r.estado === 'pendiente') pendingDates.add(s);
      cur.setDate(cur.getDate() + 1);
    }
  });

  const days = daysInMonth(year, month);
  const firstDay = (firstDayOfMonth(year, month) + 6) % 7; // Monday-based

  const handleDayClick = (d: string) => {
    const today_str = new Date().toISOString().slice(0, 10);
    if (d < today_str) return;
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
    } else {
      if (d < rangeStart) { setRangeStart(d); setRangeEnd(null); }
      else setRangeEnd(d);
    }
  };

  const isInRange = (d: string) => rangeStart && rangeEnd && d >= rangeStart && d <= rangeEnd;
  const dias = rangeStart && rangeEnd ? countWorkdays(rangeStart, rangeEnd) : 0;

  const handleSubmit = async () => {
    setSubmitError('');
    if (!rangeStart || !rangeEnd) { setSubmitError('Selecciona un rango de fechas'); return; }
    if (!motivo.trim()) { setSubmitError('Introduce el motivo'); return; }
    if (dias === 0) { setSubmitError('El rango seleccionado no incluye dias laborables'); return; }
    try {
      await onSubmit(rangeStart, rangeEnd, motivo, dias);
      setRangeStart(null);
      setRangeEnd(null);
      setMotivo('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al enviar');
    }
  };

  const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const dayNames = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];

  return (
    <div className="space-y-6">
      {/* Calendar */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <Calendar size={16} style={{ color: '#0369A1' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Seleccionar Periodo de Vacaciones</h3>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <ChevronLeft size={14} style={{ color: '#64748B' }} />
            </button>
            <span className="text-sm font-semibold min-w-[120px] text-center" style={{ color: '#1E293B' }}>
              {monthNames[month]} {year}
            </span>
            <button onClick={nextMonth} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
              <ChevronRight size={14} style={{ color: '#64748B' }} />
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-7 gap-1 mb-2">
            {dayNames.map((d) => (
              <div key={d} className="text-center text-xs font-semibold py-1" style={{ color: '#94A3B8' }}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const d = dateStr(year, month, i + 1);
              const isToday = d === today.toISOString().slice(0, 10);
              const isPast = d < today.toISOString().slice(0, 10);
              const isStart = d === rangeStart;
              const isEnd = d === rangeEnd;
              const inRange = isInRange(d);
              const isApproved = approvedDates.has(d);
              const isPending = pendingDates.has(d);
              const isWeekend = [5, 6].includes((new Date(d).getDay() + 6) % 7);

              let bg = 'transparent';
              let color = isPast ? '#CBD5E1' : isWeekend ? '#94A3B8' : '#1E293B';
              let border = 'transparent';

              if (isApproved) { bg = '#F0FDF4'; color = '#16A34A'; border = '#BBF7D0'; }
              if (isPending) { bg = '#FFFBEB'; color = '#D97706'; border = '#FDE68A'; }
              if (isStart || isEnd) { bg = '#0369A1'; color = '#FFFFFF'; border = '#0369A1'; }
              else if (inRange) { bg = '#DBEAFE'; color = '#1E40AF'; border = '#BFDBFE'; }
              if (isToday && !isStart && !isEnd && !inRange) { border = '#0369A1'; }

              return (
                <button
                  key={d}
                  onClick={() => !isPast && handleDayClick(d)}
                  disabled={isPast}
                  className="aspect-square rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-100 cursor-pointer disabled:cursor-default"
                  style={{ backgroundColor: bg, color, border: `1px solid ${border}` }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 flex-wrap">
            {[
              { label: 'Aprobada', bg: '#F0FDF4', border: '#BBF7D0', color: '#16A34A' },
              { label: 'Pendiente', bg: '#FFFBEB', border: '#FDE68A', color: '#D97706' },
              { label: 'Seleccion', bg: '#DBEAFE', border: '#BFDBFE', color: '#1E40AF' },
            ].map((l) => (
              <div key={l.label} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded" style={{ backgroundColor: l.bg, border: `1px solid ${l.border}` }} />
                <span className="text-xs" style={{ color: '#64748B' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Request form */}
      {rangeStart && (
        <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <div className="px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Solicitar Vacaciones</h3>
          </div>
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                <p className="text-xs" style={{ color: '#0369A1' }}>Desde</p>
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{rangeStart}</p>
              </div>
              <div className="rounded-xl p-3" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
                <p className="text-xs" style={{ color: '#0369A1' }}>Hasta</p>
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{rangeEnd ?? '—'}</p>
              </div>
            </div>
            {rangeEnd && (
              <div className="px-4 py-2.5 rounded-xl" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                <span className="text-xs" style={{ color: '#64748B' }}>Dias laborables: </span>
                <span className="text-sm font-bold" style={{ color: '#0F172A' }}>{dias}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: '#64748B' }}>Motivo</label>
              <textarea
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                rows={2}
                placeholder="Motivo de la solicitud..."
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ border: '1.5px solid #E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }}
              />
            </div>
            {submitError && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={13} style={{ color: '#DC2626' }} />
                <p className="text-xs" style={{ color: '#DC2626' }}>{submitError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setRangeStart(null); setRangeEnd(null); }} className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !rangeEnd}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0369A1' }}
              >
                {loading && <RefreshCw size={13} className="animate-spin" />}
                Solicitar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* My requests */}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Mis Solicitudes</h3>
        </div>
        <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
          {requests.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-xs" style={{ color: '#94A3B8' }}>No tienes solicitudes de vacaciones</p>
            </div>
          ) : (
            requests.map((r) => {
              const sc = r.estado === 'aprobada'
                ? { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', Icon: CheckCircle2 }
                : r.estado === 'pendiente'
                ? { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A', Icon: Clock }
                : { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', Icon: XCircle };
              return (
                <div key={r.id} className="px-6 py-4 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sc.bg }}>
                    <sc.Icon size={14} style={{ color: sc.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{r.fecha_inicio} &rarr; {r.fecha_fin} &middot; {r.dias}d</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{r.motivo}</p>
                    {r.comentario_rrhh && (
                      <p className="text-xs mt-1 italic" style={{ color: '#DC2626' }}>RRHH: {r.comentario_rrhh}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold px-2 py-1 rounded-md" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                      {r.estado}
                    </span>
                    {r.estado === 'aprobada' && r.documento_path && (
                      <a
                        href={`${import.meta.env.VITE_WASABI_ENDPOINT}/${import.meta.env.VITE_WASABI_BUCKET_NAME}/${r.documento_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
                        title="Descargar carta de vacaciones"
                      >
                        <Download size={13} style={{ color: '#16A34A' }} />
                      </a>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RRHH management view ─────────────────────────────────────────────────────

function RRHHVacationsManager({ requests, onRefresh, role }: {
  requests: VacationRequest[];
  onRefresh: () => void;
  role: AppRole;
}) {
  const { profile } = useAuth();
  const [denyTarget, setDenyTarget] = useState<VacationRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');

  const handleApprove = async (req: VacationRequest) => {
    if (!profile) return;
    setActionLoading(req.id);
    try {
      const pdfBlob = generateVacationPDF(req);
      const pdfFile = new File([pdfBlob], `vacaciones_${req.employee_nombre}_${req.fecha_inicio}.txt`, { type: 'text/plain' });
      const pdfPath = `empleados/${req.employee_id}/privada/carta_vacaciones_${req.id}.txt`;
      await uploadToWasabi(pdfFile, pdfPath);

      await supabase.from('employee_documents').upsert({
        employee_id: req.employee_id,
        society_id: req.society_id,
        folder: 'privada',
        nombre: `Carta de Vacaciones ${req.fecha_inicio} - ${req.fecha_fin}`,
        storage_path: pdfPath,
        mime_type: 'text/plain',
        size_bytes: pdfBlob.size,
        subido_por: profile.id,
        subido_por_nombre: profile.nombre,
      });

      await supabase.from('vacation_requests').update({
        estado: 'aprobada',
        revisado_por: profile.id,
        revisado_por_nombre: profile.nombre,
        documento_path: pdfPath,
        updated_at: new Date().toISOString(),
      }).eq('id', req.id);

      await writeAuditLog({
        evento: 'vacation_approved',
        descripcion: `Vacaciones de ${req.employee_nombre} aprobadas por ${profile.nombre}. ${req.fecha_inicio} - ${req.fecha_fin}`,
        autor: profile,
        entidad: 'vacation_request',
        entidad_id: req.id,
        metadata: { employee_nombre: req.employee_nombre, desde: req.fecha_inicio, hasta: req.fecha_fin, dias: req.dias },
        society_id: req.society_id,
      });

      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (req: VacationRequest, comment: string) => {
    if (!profile) return;
    setActionLoading(req.id);
    try {
      await supabase.from('vacation_requests').update({
        estado: 'denegada',
        comentario_rrhh: comment,
        revisado_por: profile.id,
        revisado_por_nombre: profile.nombre,
        updated_at: new Date().toISOString(),
      }).eq('id', req.id);

      await writeAuditLog({
        evento: 'vacation_denied',
        descripcion: `Vacaciones de ${req.employee_nombre} denegadas por ${profile.nombre}. Motivo: ${comment}`,
        autor: profile,
        entidad: 'vacation_request',
        entidad_id: req.id,
        metadata: { employee_nombre: req.employee_nombre, desde: req.fecha_inicio, hasta: req.fecha_fin, comentario: comment },
        society_id: req.society_id,
      });

      setDenyTarget(null);
      onRefresh();
    } finally {
      setActionLoading(null);
    }
  };

  const filtered = requests.filter((r) => !filterStatus || r.estado === filterStatus);
  const pending = requests.filter((r) => r.estado === 'pendiente').length;

  return (
    <>
      {denyTarget && (
        <DenyModal
          loading={actionLoading === denyTarget.id}
          onConfirm={(comment) => handleDeny(denyTarget, comment)}
          onClose={() => setDenyTarget(null)}
        />
      )}
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Gestion de Vacaciones</h3>
            {pending > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
                {pending} pendiente{pending > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobada">Aprobada</option>
            <option value="denegada">Denegada</option>
          </select>
        </div>

        <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <CheckCircle2 size={24} className="mx-auto mb-2" style={{ color: '#16A34A' }} />
              <p className="text-sm" style={{ color: '#94A3B8' }}>No hay solicitudes</p>
            </div>
          ) : (
            filtered.map((r) => {
              const sc = r.estado === 'aprobada'
                ? { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0', Icon: CheckCircle2 }
                : r.estado === 'pendiente'
                ? { bg: '#DBEAFE', text: '#1D4ED8', border: '#BFDBFE', Icon: Clock }
                : { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', Icon: XCircle };
              const isLoading = actionLoading === r.id;
              return (
                <div key={r.id} className="px-6 py-4 flex flex-wrap items-center gap-4">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sc.bg }}>
                    <sc.Icon size={15} style={{ color: sc.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{r.employee_nombre}</p>
                    <p className="text-xs" style={{ color: '#64748B' }}>{r.fecha_inicio} &rarr; {r.fecha_fin} &middot; {r.dias} dias laborables</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{r.motivo}</p>
                    {r.comentario_rrhh && (
                      <p className="text-xs mt-0.5 italic" style={{ color: '#DC2626' }}>Motivo denegacion: {r.comentario_rrhh}</p>
                    )}
                  </div>
                  {/* Actions column */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-md" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                      {r.estado}
                    </span>
                    {r.estado === 'pendiente' && (
                      <>
                        <button
                          onClick={() => handleApprove(r)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                          style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        >
                          {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Aceptar
                        </button>
                        <button
                          onClick={() => setDenyTarget(r)}
                          disabled={isLoading}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
                        >
                          <XCircle size={12} />
                          Denegar
                        </button>
                      </>
                    )}
                    {r.estado === 'aprobada' && r.documento_path ? (
                      <a
                        href={`${import.meta.env.VITE_WASABI_ENDPOINT}/${import.meta.env.VITE_WASABI_BUCKET_NAME}/${r.documento_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                        style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                        title="Descargar carta"
                      >
                        <FileText size={12} />
                        PDF
                      </a>
                    ) : r.estado !== 'pendiente' ? (
                      <div
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs opacity-30"
                        style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
                      >
                        <Download size={12} />
                        PDF
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

interface Props {
  role: AppRole;
}

export default function VacationsModule({ role }: Props) {
  const { profile } = useAuth();
  const { activeSocietyId } = useSociety();
  const [requests, setRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('vacation_requests').select('*').order('created_at', { ascending: false });
    if (role === 'employee' && profile) {
      query = query.eq('employee_id', profile.id);
    } else {
      query = query.eq('society_id', activeSocietyId);
    }
    const { data } = await query;
    setRequests((data ?? []) as VacationRequest[]);
    setLoading(false);
  }, [role, profile, activeSocietyId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleSubmitRequest = async (from: string, to: string, motivo: string, dias: number) => {
    if (!profile) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('vacation_requests').insert({
        employee_id: profile.id,
        employee_nombre: profile.nombre,
        society_id: activeSocietyId,
        fecha_inicio: from,
        fecha_fin: to,
        dias,
        motivo,
        estado: 'pendiente',
      });
      if (error) throw error;

      await writeAuditLog({
        evento: 'vacation_request_submitted',
        descripcion: `Solicitud de vacaciones enviada por ${profile.nombre}. ${from} - ${to} (${dias}d)`,
        autor: profile,
        entidad: 'vacation_request',
        metadata: { desde: from, hasta: to, dias, motivo },
        society_id: activeSocietyId,
      });

      await loadRequests();
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
      </div>
    );
  }

  if (role === 'employee') {
    return <EmployeeCalendar requests={requests} onSubmit={handleSubmitRequest} loading={submitting} />;
  }

  return <RRHHVacationsManager requests={requests} onRefresh={loadRequests} role={role} />;
}
