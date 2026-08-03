import { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2, XCircle, Clock, Download, FileText,
  RefreshCw, AlertCircle, Calendar, ChevronLeft, ChevronRight, X, Search, Archive
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useSociety } from '../context/SocietyContext';
import { writeAuditLog } from '../lib/auditLog';
import { uploadVacacionesLetter, downloadFromWasabi } from '../lib/wasabi';
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

interface VacationEmployeeData {
  nombre: string;
  dni: string | null;
  puesto: string | null;
  centro_trabajo: string | null;
}

function generateVacationPDF(req: VacationRequest, employeeData: VacationEmployeeData, isApproved = true): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const marginX = 20;
  let y = 20;
  const fechaGen = new Date().toLocaleDateString('es-ES');

  // ── Title ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('DOCUMENTO DE SOLICITUD Y APROBACIÓN DE VACACIONES', pageW / 2, y, { align: 'center' });
  y += 2;
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 2, pageW - marginX, y + 2);
  y += 10;

  // ── Section 1: Datos de la empresa y del trabajador ──
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('1. DATOS DE LA EMPRESA Y DEL TRABAJADOR', marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const lineH = 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Razón Social de la Empresa:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text('APEDECA', marginX + 55, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Nombre y Apellidos del Trabajador/a:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeData.nombre || req.employee_nombre, marginX + 70, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('DNI/NIE:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeData.dni || '—', marginX + 25, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Puesto de Trabajo:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeData.puesto || '—', marginX + 40, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Departamento / Centro:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(employeeData.centro_trabajo || '—', marginX + 50, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de generación del documento:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(fechaGen, marginX + 65, y);
  y += 10;

  // ── Section 2: Periodo de vacaciones ──
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('2. PERIODO DE VACACIONES SOLICITADO', marginX, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de inicio (primer día de disfrute):', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(req.fecha_inicio, marginX + 70, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de fin (último día de disfrute):', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(req.fecha_fin, marginX + 65, y);
  y += lineH;

  doc.setFont('helvetica', 'bold');
  doc.text('Número total de días laborables solicitados:', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${req.dias} días`, marginX + 75, y);
  y += lineH;

  if (req.motivo) {
    doc.setFont('helvetica', 'bold');
    doc.text('Observaciones / Comentarios:', marginX, y);
    y += lineH - 2;
    doc.setFont('helvetica', 'normal');
    const motivoLines = doc.splitTextToSize(req.motivo, pageW - marginX * 2);
    doc.text(motivoLines, marginX, y);
    y += motivoLines.length * 5 + 4;
  }
  y += 6;

  // ── Section 3: Conformidad y firmas ──
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('3. CONFORMIDAD Y FIRMAS', marginX, y);
  y += 8;

  // Worker declaration
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const declWorker = 'Por parte del Trabajador/a: Declaro haber solicitado el periodo vacacional indicado conforme a la normativa interna de la empresa y los acuerdos aplicables.';
  const declWorkerLines = doc.splitTextToSize(declWorker, pageW - marginX * 2);
  doc.text(declWorkerLines, marginX, y);
  y += declWorkerLines.length * 5 + 4;

  // Company declaration
  doc.setFontSize(9);
  const estadoText = isApproved ? 'APRUEBA' : 'DENIEGA';
  const declCompany = `Por parte de la Empresa (Recursos Humanos / Dirección): Se ${estadoText} el periodo de vacaciones solicitado por el trabajador en las fechas indicadas.`;
  const declCompanyLines = doc.splitTextToSize(declCompany, pageW - marginX * 2);
  doc.text(declCompanyLines, marginX, y);
  y += declCompanyLines.length * 5 + 8;

  // Side-by-side: Worker signature (left) | Company stamp + signature (right)
  const colW = (pageW - marginX * 2 - 10) / 2;
  const leftX = marginX;
  const rightX = marginX + colW + 10;
  const boxH = 35;

  // Left column — Worker signature
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Firma del Trabajador/a:', leftX, y);
  y += 2;
  doc.setLineWidth(0.3);
  doc.setDrawColor(0);
  doc.line(leftX, y + boxH - 2, leftX + colW, y + boxH - 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Firma', leftX, y + boxH + 3);

  // Right column — Company stamp + signature
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('Firma y Sello de la Empresa:', rightX, y);
  doc.setLineWidth(0.3);
  doc.setDrawColor(150);
  doc.roundedRect(rightX, y + 2, colW, boxH - 6, 2, 2);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(180);
  doc.text('[ Espacio reservado para sello ]', rightX + colW / 2, y + 2 + (boxH - 6) / 2, { align: 'center' });
  doc.setTextColor(0);
  doc.setDrawColor(0);
  doc.line(rightX, y + boxH - 2, rightX + colW, y + boxH - 2);
  doc.text('Firma', rightX, y + boxH + 3);

  y += boxH + 10;

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text('Documento generado automáticamente por el Portal del Empleado.', pageW / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
  doc.setTextColor(0);

  return doc.output('blob');
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

// ─── Mini month calendar ──────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAY_NAMES_SHORT = ['L','M','X','J','V','S','D'];

function MiniMonth({
  year, month, approvedDates, pendingDates, deniedDates,
  rangeStart, rangeEnd, hoverDate,
  onDayClick, onDayHover,
}: {
  year: number; month: number;
  approvedDates: Set<string>; pendingDates: Set<string>; deniedDates: Set<string>;
  rangeStart: string | null; rangeEnd: string | null; hoverDate: string | null;
  onDayClick: (d: string) => void; onDayHover: (d: string | null) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const days = daysInMonth(year, month);
  const firstDay = (firstDayOfMonth(year, month) + 6) % 7;

  const effectiveEnd = rangeEnd ?? hoverDate;

  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
      <p className="text-center text-xs font-bold mb-2" style={{ color: '#0F172A' }}>
        {MONTH_NAMES[month]}
      </p>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DAY_NAMES_SHORT.map((d) => (
          <div key={d} className="text-center" style={{ fontSize: '9px', color: '#94A3B8', fontWeight: 600 }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const d = dateStr(year, month, i + 1);
          const isPast = d < today;
          const isToday = d === today;
          const isApproved = approvedDates.has(d);
          const isPending = pendingDates.has(d);
          const isDenied = deniedDates.has(d);
          const isStart = d === rangeStart;
          const isEnd = d === rangeEnd;
          const inPreview = rangeStart && effectiveEnd && !rangeEnd
            ? (d > rangeStart && d <= effectiveEnd)
            : false;
          const inRange = rangeStart && rangeEnd
            ? (d > rangeStart && d < rangeEnd)
            : false;
          const isWeekend = [5, 6].includes((new Date(d + 'T12:00:00').getDay() + 6) % 7);

          let bg = 'transparent';
          let color = isPast ? '#D1D5DB' : isWeekend ? '#94A3B8' : '#374151';
          let borderColor = 'transparent';
          let borderRadius = '4px';

          if (isDenied && !isStart && !isEnd) { bg = '#FEE2E2'; color = '#EF4444'; }
          if (isApproved && !isStart && !isEnd) { bg = '#DCFCE7'; color = '#16A34A'; }
          if (isPending && !isStart && !isEnd) { bg = '#FEF9C3'; color = '#CA8A04'; }
          if (inRange) { bg = '#DBEAFE'; color = '#1D4ED8'; borderRadius = '0'; }
          if (inPreview) { bg = '#EFF6FF'; color = '#3B82F6'; borderRadius = '0'; }
          if (isStart) { bg = '#0369A1'; color = '#FFFFFF'; borderRadius = rangeEnd || effectiveEnd ? '4px 0 0 4px' : '4px'; }
          if (isEnd) { bg = '#0369A1'; color = '#FFFFFF'; borderRadius = '0 4px 4px 0'; }
          if (isToday && !isStart && !isEnd) { borderColor = '#0369A1'; }

          return (
            <button
              key={d}
              onClick={() => !isPast && onDayClick(d)}
              onMouseEnter={() => !isPast && onDayHover(d)}
              onMouseLeave={() => onDayHover(null)}
              disabled={isPast}
              className="flex items-center justify-center transition-all duration-75 disabled:cursor-default cursor-pointer"
              style={{
                height: '18px',
                fontSize: '9px',
                fontWeight: isStart || isEnd ? 700 : 500,
                backgroundColor: bg,
                color,
                border: `1px solid ${borderColor}`,
                borderRadius,
              }}
            >
              {i + 1}
            </button>
          );
        })}
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
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [rangeEnd, setRangeEnd] = useState<string | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [submitError, setSubmitError] = useState('');

  const approvedDates = new Set<string>();
  const pendingDates = new Set<string>();
  const deniedDates = new Set<string>();
  requests.forEach((r) => {
    const cur = new Date(r.fecha_inicio + 'T12:00:00');
    const end = new Date(r.fecha_fin + 'T12:00:00');
    while (cur <= end) {
      const s = cur.toISOString().slice(0, 10);
      if (r.estado === 'aprobada') approvedDates.add(s);
      else if (r.estado === 'pendiente') pendingDates.add(s);
      else if (r.estado === 'denegada') deniedDates.add(s);
      cur.setDate(cur.getDate() + 1);
    }
  });

  const approvedDays = requests.filter(r => r.estado === 'aprobada').reduce((acc, r) => acc + r.dias, 0);
  const pendingDays = requests.filter(r => r.estado === 'pendiente').reduce((acc, r) => acc + r.dias, 0);

  const handleDayClick = (d: string) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(d);
      setRangeEnd(null);
      setHoverDate(null);
    } else {
      if (d < rangeStart) { setRangeStart(d); setRangeEnd(null); }
      else setRangeEnd(d);
    }
  };

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
      setHoverDate(null);
      setMotivo('');
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al enviar');
    }
  };

  return (
    <div className="space-y-5">
      {/* Header: year nav + stats */}
      <div className="rounded-2xl px-5 py-4 flex flex-wrap items-center justify-between gap-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setYear(y => y - 1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            <ChevronLeft size={15} style={{ color: '#64748B' }} />
          </button>
          <span className="text-xl font-bold" style={{ color: '#0F172A' }}>{year}</span>
          <button
            onClick={() => setYear(y => y + 1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors"
            style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
          >
            <ChevronRight size={15} style={{ color: '#64748B' }} />
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {[
            { label: 'Aprobados', days: approvedDays, bg: '#DCFCE7', color: '#16A34A', dot: '#16A34A' },
            { label: 'Pendientes', days: pendingDays, bg: '#FEF9C3', color: '#CA8A04', dot: '#CA8A04' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ backgroundColor: s.bg }}>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.dot }} />
              <span className="text-xs font-semibold" style={{ color: s.color }}>{s.days}d {s.label}</span>
            </div>
          ))}

          <div className="flex items-center gap-3 text-xs flex-wrap">
            {[
              { label: 'Aprobada', bg: '#DCFCE7', border: '#BBF7D0', color: '#16A34A' },
              { label: 'Pendiente', bg: '#FEF9C3', border: '#FDE68A', color: '#CA8A04' },
              { label: 'Seleccion', bg: '#DBEAFE', border: '#BFDBFE', color: '#1D4ED8' },
            ].map(l => (
              <div key={l.label} className="flex items-center gap-1">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: l.bg, border: `1px solid ${l.border}` }} />
                <span style={{ color: '#64748B' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 12 mini calendars */}
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(165px, 1fr))' }}>
        {Array.from({ length: 12 }).map((_, m) => (
          <MiniMonth
            key={m}
            year={year}
            month={m}
            approvedDates={approvedDates}
            pendingDates={pendingDates}
            deniedDates={deniedDates}
            rangeStart={rangeStart}
            rangeEnd={rangeEnd}
            hoverDate={!rangeEnd ? hoverDate : null}
            onDayClick={handleDayClick}
            onDayHover={setHoverDate}
          />
        ))}
      </div>

      {/* Request form — appears when a range is selected */}
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
              <button
                onClick={() => { setRangeStart(null); setRangeEnd(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}
              >
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

      {/* My requests list */}
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
                ? { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0', Icon: CheckCircle2 }
                : r.estado === 'pendiente'
                ? { bg: '#FEF9C3', text: '#CA8A04', border: '#FDE68A', Icon: Clock }
                : { bg: '#FEE2E2', text: '#DC2626', border: '#FECACA', Icon: XCircle };
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
                      <button
                        onClick={() => downloadFromWasabi(r.documento_path!, `vacaciones_${r.employee_nombre}_${r.fecha_inicio}.pdf`)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: '#DCFCE7', border: '1px solid #BBF7D0' }}
                        title="Descargar carta de vacaciones"
                      >
                        <Download size={13} style={{ color: '#16A34A' }} />
                      </button>
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

// ─── Historial de cartas firmadas ─────────────────────────────────────────────

function VacationsHistoryView({ requests }: { requests: VacationRequest[] }) {
  const [search, setSearch] = useState('');
  const [downloading, setDownloading] = useState<string | null>(null);

  const approved = requests.filter((r) => r.estado === 'aprobada' && r.documento_path);
  const lower = search.toLowerCase();
  const filtered = approved.filter((r) => !lower || r.employee_nombre.toLowerCase().includes(lower));

  // Group by employee name
  const byEmployee: Record<string, VacationRequest[]> = {};
  for (const r of filtered) {
    if (!byEmployee[r.employee_nombre]) byEmployee[r.employee_nombre] = [];
    byEmployee[r.employee_nombre].push(r);
  }

  const handleDownload = async (r: VacationRequest) => {
    if (!r.documento_path) return;
    setDownloading(r.id);
    const ext = r.documento_path.split('/').pop() ?? `vacaciones_${r.fecha_inicio}.pdf`;
    await downloadFromWasabi(r.documento_path, ext);
    setDownloading(null);
  };

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar empleado..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
          style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
        />
      </div>

      {Object.keys(byEmployee).length === 0 ? (
        <div className="text-center py-12">
          <Archive size={24} className="mx-auto mb-2" style={{ color: '#CBD5E1' }} />
          <p className="text-sm" style={{ color: '#94A3B8' }}>
            {search ? 'No se encontraron resultados' : 'No hay cartas firmadas aún'}
          </p>
        </div>
      ) : (
        Object.entries(byEmployee).sort(([a], [b]) => a.localeCompare(b)).map(([nombre, reqs]) => (
          <div key={nombre} className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
            <div className="px-5 py-3 flex items-center gap-2" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                {nombre.charAt(0)}
              </div>
              <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>{nombre}</span>
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E0F2FE', color: '#0369A1' }}>
                {reqs.length} carta{reqs.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {reqs.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio)).map((r) => {
                const anio = r.fecha_inicio.slice(0, 4);
                const isLoading = downloading === r.id;
                return (
                  <div key={r.id} className="px-5 py-3 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium" style={{ color: '#1E293B' }}>
                        {r.fecha_inicio} &rarr; {r.fecha_fin}
                      </p>
                      <p className="text-xs" style={{ color: '#64748B' }}>
                        {r.dias} días · Año {anio}
                        {r.revisado_por_nombre && ` · Aprobado por ${r.revisado_por_nombre}`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(r)}
                      disabled={isLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-60"
                      style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                      title="Descargar carta de vacaciones"
                    >
                      {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                      Descargar
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── HR manager ───────────────────────────────────────────────────────────────

function RRHHVacationsManager({ requests, onRefresh, role }: {
  requests: VacationRequest[];
  onRefresh: () => void;
  role: AppRole;
}) {
  const { profile } = useAuth();
  const [denyTarget, setDenyTarget] = useState<VacationRequest | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [tab, setTab] = useState<'solicitudes' | 'historial'>('solicitudes');

  const handleApprove = async (req: VacationRequest) => {
    if (!profile) return;
    setActionLoading(req.id);
    try {
      const { data: emp } = await supabase
        .from('empleados')
        .select('nombre, dni, puesto, centro_trabajo')
        .eq('user_id', req.employee_id)
        .single();

      const employeeData: VacationEmployeeData = {
        nombre: emp?.nombre || req.employee_nombre,
        dni: emp?.dni ?? null,
        puesto: emp?.puesto ?? null,
        centro_trabajo: emp?.centro_trabajo ?? null,
      };

      const pdfBlob = generateVacationPDF(req, employeeData, true);
      const anio = req.fecha_inicio.slice(0, 4);
      const pdfPath = await uploadVacacionesLetter(
        pdfBlob,
        emp?.dni || 'SINDNI',
        employeeData.nombre,
        anio,
        req.fecha_inicio,
      );

      await supabase.from('employee_documents').upsert({
        employee_id: req.employee_id,
        society_id: req.society_id,
        folder: 'privada',
        nombre: `Carta de Vacaciones ${req.fecha_inicio} - ${req.fecha_fin}`,
        storage_path: pdfPath,
        mime_type: 'application/pdf',
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
  const approvedWithDoc = requests.filter((r) => r.estado === 'aprobada' && r.documento_path).length;

  return (
    <>
      {denyTarget && (
        <DenyModal
          loading={actionLoading === denyTarget.id}
          onConfirm={(comment) => handleDeny(denyTarget, comment)}
          onClose={() => setDenyTarget(null)}
        />
      )}
      <div className="space-y-4">
        {/* Tab navigation */}
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: '#F1F5F9' }}>
          {([
            { key: 'solicitudes', label: 'Solicitudes', badge: pending },
            { key: 'historial', label: 'Historial de Cartas', badge: approvedWithDoc, Icon: Archive },
          ] as { key: 'solicitudes' | 'historial'; label: string; badge: number; Icon?: typeof Archive }[]).map(({ key, label, badge }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer"
                style={{
                  backgroundColor: active ? '#FFFFFF' : 'transparent',
                  color: active ? '#1E293B' : '#64748B',
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                {label}
                {badge > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: active ? '#DBEAFE' : '#E2E8F0', color: active ? '#1D4ED8' : '#64748B' }}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Solicitudes tab */}
        {tab === 'solicitudes' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex flex-wrap items-center justify-between gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Solicitudes de Vacaciones</h3>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-xs outline-none cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
              >
                <option value="">Todos los estados</option>
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
                          <button
                            onClick={() => downloadFromWasabi(r.documento_path!, r.documento_path!.split('/').pop() ?? `vacaciones_${r.fecha_inicio}.pdf`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer"
                            style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}
                            title="Descargar carta"
                          >
                            <FileText size={12} />
                            PDF
                          </button>
                        ) : r.estado !== 'pendiente' ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs opacity-30" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
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
        )}

        {/* Historial tab */}
        {tab === 'historial' && <VacationsHistoryView requests={requests} />}
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
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

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
    if (!profile) {
      showToast('error', 'No se pudo cargar tu perfil. Recarga la pagina e intenta de nuevo.');
      return;
    }
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

      writeAuditLog({
        evento: 'vacation_request_submitted',
        descripcion: `Solicitud de vacaciones enviada por ${profile.nombre}. ${from} - ${to} (${dias}d)`,
        autor: profile,
        entidad: 'vacation_request',
        metadata: { desde: from, hasta: to, dias, motivo },
        society_id: activeSocietyId,
      }).catch(() => { /* audit log is best-effort; never block submit */ });

      await loadRequests();
      showToast('success', 'Solicitud enviada. RRHH revisara tu peticion.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al enviar la solicitud';
      showToast('error', msg);
      throw err;
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
    return (
      <>
        {toast && (
          <div
            className="fixed top-4 right-4 z-[300] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-[slideIn_0.2s_ease-out]"
            style={{
              backgroundColor: toast.type === 'success' ? '#F0FDF4' : '#FEF2F2',
              border: `1px solid ${toast.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
              color: toast.type === 'success' ? '#15803D' : '#DC2626',
            }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            {toast.msg}
          </div>
        )}
        <EmployeeCalendar requests={requests} onSubmit={handleSubmitRequest} loading={submitting} />
      </>
    );
  }

  return (
    <>
      {toast && (
        <div
          className="fixed top-4 right-4 z-[300] px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-[slideIn_0.2s_ease-out]"
          style={{
            backgroundColor: toast.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${toast.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: toast.type === 'success' ? '#15803D' : '#DC2626',
          }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}
      <RRHHVacationsManager requests={requests} onRefresh={loadRequests} role={role} />
    </>
  );
}
