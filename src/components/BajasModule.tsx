import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BedSingle, Plus, X, Trash2, Search, RefreshCw, Download, Calendar,
  AlertTriangle, UserCheck, CheckCircle2, Clock, ArrowRight,
  Sun, Moon, Sunset, Banknote, RotateCcw, MoreHorizontal, Star,
  FileCheck, CreditCard, Hash, FileSpreadsheet, FileText, ChevronDown,
  Timer,
} from 'lucide-react';
import SustitucionesModule from './SustitucionesModule';
import HorasExtrasModule from './HorasExtrasModule';
import * as XLSX from 'xlsx';
import { supabase } from '../supabaseClient';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Empleado {
  id: string;
  nombre: string;
  dni: string | null;
  id_sociedad: string | null;
  activo: boolean;
  tipo_contrato: string | null;
  centro_trabajo: string | null;
}

interface Baja {
  id: string;
  empleado_id: string;
  empleado_nombre: string;
  fecha_inicio: string;
  fecha_fin: string | null;
  total_dias: number;
  motivo: string | null;
  estado: string;
  created_by: string | null;
  created_at: string;
  larga_duracion: boolean;
  dias_no_cubiertos: number;
  modo_finalizacion: string | null;
  notas_finalizacion: string | null;
}

interface Sustitucion {
  id: string;
  baja_id: string;
  sustituto_id: string;
  sustituto_nombre: string;
  fecha_inicio: string;
  num_dias: number;
  notas: string | null;
  tipo_cobertura: string | null;
  turno: string | null;
  es_festivo: boolean;
  unidad: string;
  num_horas: number;
  horas_nocturnas: number | null;
  motivo_otro: string | null;
  num_dias_festivos: number | null;
}

interface BajaWithSustituciones extends Baja {
  sustituciones: Sustitucion[];
  dias_asignados: number;
  horas_asignadas: number;
}

interface SustitucionForm {
  sustituto_id: string;
  sustituto_nombre: string;
  fecha_inicio: string;
  num_dias: number;
  notas: string;
  tipo_cobertura: 'pagar' | 'compensar' | 'otro' | '';
  turno: 'mañana' | 'tarde' | 'noche' | '';
  es_festivo: boolean;
  unidad: 'dias' | 'horas';
  num_horas: number;
  horas_nocturnas: number;
  motivo_otro: string;
  num_dias_festivos: number;
}

type ModoFinalizacion = 'nomina' | 'solicitud' | 'otro';

// ── Constants ─────────────────────────────────────────────────────────────────

const HORAS_POR_TURNO: Record<string, number> = { mañana: 8, tarde: 8, noche: 8 };

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
}

interface CoverageStats {
  totalDias: number;
  totalHoras: number;
  horasNocturnas: number;
  diasFestivos: number;
  horasFestivas: number;
}

function computeStats(susts: SustitucionForm[]): CoverageStats {
  let totalDias = 0, totalHoras = 0, horasNocturnas = 0, diasFestivos = 0, horasFestivas = 0;
  for (const s of susts) {
    const horasBase = HORAS_POR_TURNO[s.turno] ?? 8;
    if (s.unidad === 'dias') {
      totalDias += s.num_dias;
      if (s.es_festivo) diasFestivos += s.num_dias;
      if (s.turno === 'noche') horasNocturnas += s.num_dias * horasBase;
      if (s.es_festivo) horasFestivas += s.num_dias * horasBase;
    } else {
      totalHoras += s.num_horas;
      if (s.turno === 'noche') horasNocturnas += s.num_horas;
      if (s.es_festivo) horasFestivas += s.num_horas;
    }
  }
  return { totalDias, totalHoras, horasNocturnas, diasFestivos, horasFestivas };
}

function computeStatsFromDB(susts: Sustitucion[]): CoverageStats {
  let totalDias = 0, totalHoras = 0, horasNocturnas = 0, diasFestivos = 0, horasFestivas = 0;
  for (const s of susts) {
    const horasBase = HORAS_POR_TURNO[s.turno ?? ''] ?? 8;
    const unidad = s.unidad ?? 'dias';
    if (unidad === 'dias') {
      totalDias += s.num_dias;
      if (s.es_festivo) diasFestivos += s.num_dias_festivos ?? s.num_dias;
      if (s.turno === 'noche') horasNocturnas += s.horas_nocturnas ?? (s.num_dias * horasBase);
      if (s.es_festivo) horasFestivas += s.num_dias * horasBase;
    } else {
      totalHoras += s.num_horas ?? 0;
      if (s.turno === 'noche') horasNocturnas += s.horas_nocturnas ?? (s.num_horas ?? 0);
      if (s.es_festivo) horasFestivas += s.num_horas ?? 0;
    }
  }
  return { totalDias, totalHoras, horasNocturnas, diasFestivos, horasFestivas };
}

type ReporteRow = { sustituido: string; fecha: string; centro: string; horas: number; horasNoc: number };

function buildReporteGroups(bajas: BajaWithSustituciones[], empleados: Empleado[]) {
  const empMap = new Map(empleados.map((e) => [e.id, e]));
  const groups = new Map<string, { nombre: string; rows: ReporteRow[] }>();
  for (const b of bajas) {
    for (const s of b.sustituciones) {
      const horasBase = HORAS_POR_TURNO[s.turno ?? ''] ?? 8;
      const horas = s.unidad === 'horas' ? (s.num_horas ?? 0) : s.num_dias * horasBase;
      const horasNoc = s.turno === 'noche' ? horas : 0;
      const centro = empMap.get(b.empleado_id)?.centro_trabajo ?? '';
      const row: ReporteRow = { sustituido: b.empleado_nombre, fecha: s.fecha_inicio, centro, horas, horasNoc };
      const g = groups.get(s.sustituto_id);
      if (g) g.rows.push(row);
      else groups.set(s.sustituto_id, { nombre: s.sustituto_nombre, rows: [row] });
    }
  }
  return groups;
}

function exportExcel(bajas: BajaWithSustituciones[], empleados: Empleado[]) {
  const groups = buildReporteGroups(bajas, empleados);
  const wb = XLSX.utils.book_new();
  let hasData = false;
  for (const [, g] of groups) {
    const totHoras = g.rows.reduce((sum, r) => sum + r.horas, 0);
    const totNoc = g.rows.reduce((sum, r) => sum + r.horasNoc, 0);
    const aoa: (string | number)[][] = [
      [`BALANCE DE SUSTITUCIONES - ${g.nombre}`],
      [`TOTAL: ${totHoras}h${totNoc > 0 ? ' / ' + totNoc + 'h nocturnas' : ''}`],
      [],
      ['Persona sustituida', 'Fecha', 'Centro', 'Horas', 'H. Nocturnas'],
      ...g.rows.map((r) => [r.sustituido, r.fecha, r.centro, r.horas, r.horasNoc]),
      [],
      ['TOTAL HORAS', '', '', totHoras, totNoc],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 14 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } },
    ];
    const safeName = g.nombre.replace(/[\\/?*[\]:]/g, '_').slice(0, 28) || 'Hoja';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    hasData = true;
  }
  if (!hasData) {
    const ws = XLSX.utils.aoa_to_sheet([['Sin datos para exportar']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sin datos');
  }
  XLSX.writeFile(wb, `bajas_balance_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportPDF(bajas: BajaWithSustituciones[], empleados: Empleado[]) {
  const groups = buildReporteGroups(bajas, empleados);
  const fechaGen = new Date().toLocaleString('es-ES');
  const groupsArr = Array.from(groups.values());
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<title>Balance de Sustituciones</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px; }
  .header h1 { font-size: 18px; margin: 0; letter-spacing: -0.2px; }
  .header .meta { font-size: 11px; color: #64748b; text-align: right; }
  .group { margin-bottom: 18px; page-break-inside: avoid; }
  .group-title { font-size: 13px; font-weight: 700; background: #f1f5f9; padding: 6px 10px; border-left: 4px solid #0369a1; border-radius: 4px; margin-bottom: 6px; }
  .group-title .tot { color: #0369a1; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th { background: #0f172a; color: #fff; text-align: left; padding: 6px 8px; font-weight: 600; }
  th.num { text-align: right; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #f8fafc; }
  tr.tot td { font-weight: 700; background: #ecfdf5 !important; border-top: 2px solid #16a34a; }
  tr.tot td.num { color: #16a34a; }
  .empty { padding: 20px; text-align: center; color: #94a3b8; font-style: italic; }
  .footer { margin-top: 18px; font-size: 10px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 6px; }
</style></head><body>
<div class="header">
  <h1>Balance de Sustituciones</h1>
  <div class="meta">Generado el ${fechaGen}</div>
</div>
${groupsArr.length === 0 ? '<div class="empty">Sin datos para mostrar.</div>' : groupsArr.map((g) => {
  const totHoras = g.rows.reduce((s, r) => s + r.horas, 0);
  const totNoc = g.rows.reduce((s, r) => s + r.horasNoc, 0);
  return `<div class="group">
    <div class="group-title">${g.nombre} <span class="tot">· TOTAL: ${totHoras}h${totNoc > 0 ? ' / ' + totNoc + 'h nocturnas' : ''}</span></div>
    <table>
      <thead><tr><th>Persona sustituida</th><th>Fecha</th><th>Centro</th><th class="num">Horas</th><th class="num">H. Nocturnas</th></tr></thead>
      <tbody>
        ${g.rows.map((r) => `<tr><td>${escapeHtml(r.sustituido)}</td><td>${r.fecha}</td><td>${escapeHtml(r.centro)}</td><td class="num">${r.horas}</td><td class="num">${r.horasNoc}</td></tr>`).join('')}
        <tr class="tot"><td>TOTAL</td><td></td><td></td><td class="num">${totHoras}</td><td class="num">${totNoc}</td></tr>
      </tbody>
    </table>
  </div>`;
}).join('')}
<div class="footer">Documento generado automáticamente · ${fechaGen}</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);}</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) { alert('Por favor, permite las ventanas emergentes para exportar el PDF.'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

function escapeHtml(s: string) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ── Sustitucion Block (form) ──────────────────────────────────────────────────

interface SustitucionBlockProps {
  s: SustitucionForm;
  idx: number;
  bajaFechaInicio: string;
  tipoContrato: string | null;
  onUpdate: (idx: number, field: keyof SustitucionForm, value: string | number | boolean) => void;
  onRemove: (idx: number) => void;
}

function SustitucionBlock({ s, idx, bajaFechaInicio, tipoContrato, onUpdate, onRemove }: SustitucionBlockProps) {
  const tipoColors = {
    pagar: { active: '#16A34A', activeBg: '#F0FDF4', activeBorder: '#BBF7D0', icon: Banknote },
    compensar: { active: '#0369A1', activeBg: '#EFF6FF', activeBorder: '#BFDBFE', icon: RotateCcw },
    otro: { active: '#D97706', activeBg: '#FFFBEB', activeBorder: '#FDE68A', icon: MoreHorizontal },
  };
  const turnoConfig = {
    mañana: { label: 'Mañana', Icon: Sun, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
    tarde: { label: 'Tarde', Icon: Sunset, color: '#EA580C', bg: '#FFF7ED', border: '#FED7AA' },
    noche: { label: 'Noche', Icon: Moon, color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
  };
  const horasBase = HORAS_POR_TURNO[s.turno] ?? 8;
  const horasAuto = s.unidad === 'dias' ? s.num_dias * horasBase : s.num_horas;

  function handleTurnoChange(turno: string) {
    onUpdate(idx, 'turno', turno === s.turno ? '' : turno);
    if (s.unidad === 'dias' && turno !== s.turno) {
      onUpdate(idx, 'num_horas', s.num_dias * (HORAS_POR_TURNO[turno] ?? 8));
    }
  }

  function handleDiasChange(val: string) {
    const num = parseFloat(val) || 0;
    onUpdate(idx, 'num_dias', num);
    if (s.turno) onUpdate(idx, 'num_horas', num * horasBase);
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FAFBFC' }}>
      <div className="flex items-center justify-between px-4 py-2.5" style={{ backgroundColor: '#F1F5F9', borderBottom: '1px solid #E2E8F0' }}>
        <div className="flex items-center gap-2">
          <UserCheck size={13} style={{ color: '#0369A1' }} />
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#1E293B' }}>{s.sustituto_nombre}</span>
          {tipoContrato && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>{tipoContrato}</span>
          )}
        </div>
        <button onClick={() => onRemove(idx)} className="w-5 h-5 rounded flex items-center justify-center cursor-pointer hover:bg-red-100 transition-colors" style={{ color: '#DC2626' }}>
          <X size={12} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Fecha inicio</label>
            <input type="date" value={s.fecha_inicio} min={bajaFechaInicio}
              onChange={(e) => onUpdate(idx, 'fecha_inicio', e.target.value)}
              className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
          </div>
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>
              {s.unidad === 'horas' ? 'Num. horas' : 'Num. días'}
            </label>
            <input type="number" min={0} step={s.unidad === 'horas' ? 0.5 : 1}
              value={s.unidad === 'horas' ? s.num_horas : s.num_dias}
              onChange={(e) => {
                if (s.unidad === 'horas') onUpdate(idx, 'num_horas', parseFloat(e.target.value) || 0);
                else handleDiasChange(e.target.value);
              }}
              className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#BFDBFE', color: '#0369A1', backgroundColor: '#EFF6FF', fontWeight: 700, fontSize: '14px' }} />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Unidad de cobertura</label>
          <div className="flex gap-1.5">
            {(['dias', 'horas'] as const).map((u) => (
              <button key={u} onClick={() => onUpdate(idx, 'unidad', u)}
                className="flex-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                style={{ backgroundColor: s.unidad === u ? '#0F172A' : '#F1F5F9', color: s.unidad === u ? '#FFFFFF' : '#64748B' }}>
                {u === 'dias' ? 'Días' : 'Horas'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Tipo de retribución</label>
          <div className="flex gap-1.5">
            {(Object.entries(tipoColors) as [string, typeof tipoColors.pagar][]).map(([key, cfg]) => {
              const Icon = cfg.icon;
              const isActive = s.tipo_cobertura === key;
              return (
                <button key={key} onClick={() => onUpdate(idx, 'tipo_cobertura', isActive ? '' : key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all capitalize"
                  style={{ backgroundColor: isActive ? cfg.activeBg : '#F8FAFC', color: isActive ? cfg.active : '#94A3B8', border: `1.5px solid ${isActive ? cfg.activeBorder : '#E2E8F0'}` }}>
                  <Icon size={11} />
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#64748B' }}>Turno</label>
          <div className="flex gap-1.5 items-center">
            {(Object.entries(turnoConfig) as [string, typeof turnoConfig.mañana][]).map(([key, cfg]) => {
              const Icon = cfg.Icon;
              const isActive = s.turno === key;
              return (
                <button key={key} onClick={() => handleTurnoChange(key)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                  style={{ backgroundColor: isActive ? cfg.bg : '#F8FAFC', color: isActive ? cfg.color : '#94A3B8', border: `1.5px solid ${isActive ? cfg.border : '#E2E8F0'}` }}>
                  <Icon size={11} />{cfg.label}
                </button>
              );
            })}
            <button onClick={() => onUpdate(idx, 'es_festivo', !s.es_festivo)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all flex-shrink-0"
              style={{ backgroundColor: s.es_festivo ? '#FEF9C3' : '#F8FAFC', color: s.es_festivo ? '#854D0E' : '#94A3B8', border: `1.5px solid ${s.es_festivo ? '#FDE047' : '#E2E8F0'}` }}>
              <Star size={11} />Festivo
            </button>
          </div>
        </div>
        {s.tipo_cobertura === 'otro' && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Motivo (otro)</label>
            <input type="text" value={s.motivo_otro} onChange={(e) => onUpdate(idx, 'motivo_otro', e.target.value)}
              placeholder="Describe el motivo..."
              className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#FDE047', color: '#1E293B', backgroundColor: '#FEF9C3' }} />
          </div>
        )}
        {s.turno === 'noche' && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#7C3AED' }}>Horas nocturnas</label>
            <input type="number" min={0} step={0.5} value={s.horas_nocturnas}
              onChange={(e) => onUpdate(idx, 'horas_nocturnas', parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#DDD6FE', color: '#7C3AED', backgroundColor: '#F5F3FF', fontWeight: 700, fontSize: '14px' }} />
          </div>
        )}
        {s.es_festivo && (
          <div>
            <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#854D0E' }}>Nº días festivos</label>
            <input type="number" min={0} step={1} value={s.num_dias_festivos}
              onChange={(e) => onUpdate(idx, 'num_dias_festivos', parseInt(e.target.value) || 0)}
              className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#FDE047', color: '#854D0E', backgroundColor: '#FEF9C3', fontWeight: 700, fontSize: '14px' }} />
          </div>
        )}
        {s.turno && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: s.turno === 'noche' ? '#F5F3FF' : '#F8FAFC', border: '1px solid #E2E8F0' }}>
            {s.turno === 'noche' ? <Moon size={12} style={{ color: '#7C3AED' }} /> : s.turno === 'tarde' ? <Sunset size={12} style={{ color: '#EA580C' }} /> : <Sun size={12} style={{ color: '#D97706' }} />}
            <span className="text-xs" style={{ color: '#475569' }}>
              {s.unidad === 'dias' ? `${s.num_dias} día${s.num_dias !== 1 ? 's' : ''} × ${horasBase}h = ` : ''}
              <strong style={{ color: s.turno === 'noche' ? '#7C3AED' : '#0369A1' }}>
                {horasAuto}h {s.turno === 'noche' ? 'nocturnas' : s.turno === 'tarde' ? 'tarde' : 'mañana'}
              </strong>
              {s.es_festivo && <span style={{ color: '#854D0E' }}> · festivo ({s.num_dias_festivos}d)</span>}
            </span>
          </div>
        )}
        <div>
          <label className="text-[10px] font-semibold uppercase tracking-wide block mb-1" style={{ color: '#64748B' }}>Notas (opcional)</label>
          <input type="text" value={s.notas} onChange={(e) => onUpdate(idx, 'notas', e.target.value)}
            placeholder="Observaciones..."
            className="w-full px-2.5 py-1.5 rounded-lg text-xs border outline-none"
            style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#FFFFFF' }} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function BajasModule() {
  const [bajas, setBajas] = useState<BajaWithSustituciones[]>([]);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterTipoCobertura, setFilterTipoCobertura] = useState('');
  const [showBajaModal, setShowBajaModal] = useState(false);
  const [editingBaja, setEditingBaja] = useState<Baja | null>(null);
  const [savingBaja, setSavingBaja] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // View tabs: bajas | finalizadas | balance | sustituciones | horas-extras
  const [reporteView, setReporteView] = useState<'bajas' | 'finalizadas' | 'balance' | 'sustituciones' | 'horas-extras'>('bajas');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  // Finalizar modal
  const [finalizarTarget, setFinalizarTarget] = useState<BajaWithSustituciones | null>(null);
  const [modoFinalizacion, setModoFinalizacion] = useState<ModoFinalizacion | ''>('');
  const [notasFinalizacion, setNotasFinalizacion] = useState('');
  const [savingFinalizar, setSavingFinalizar] = useState(false);

  // Baja form
  const [bajaForm, setBajaForm] = useState({ empleado_id: '', empleado_nombre: '', fecha_inicio: '', fecha_fin: '', motivo: '' });
  const [largaDuracion, setLargaDuracion] = useState(false);
  const [diasNoCubiertos, setDiasNoCubiertos] = useState(0);

  // Sustituciones
  const [sustitucionesForm, setSustitucionesForm] = useState<SustitucionForm[]>([]);
  const [sustitutoSearch, setSustitutoSearch] = useState('');
  const [showSustitutoDropdown, setShowSustitutoDropdown] = useState(false);

  // Date range filter
  const [reporteFechaInicio, setReporteFechaInicio] = useState('');
  const [reporteFechaFin, setReporteFechaFin] = useState('');

  const loadEmpleados = useCallback(async () => {
    const { data } = await supabase.from('empleados').select('id, nombre, dni, id_sociedad, activo, tipo_contrato, centro_trabajo').order('nombre', { ascending: true });
    setEmpleados(data ?? []);
  }, []);

  const loadBajas = useCallback(async () => {
    setLoading(true);
    const { data: bajasData } = await supabase.from('bajas_temporales').select('*').order('created_at', { ascending: false });
    const { data: sustData } = await supabase.from('sustituciones').select('*').order('created_at', { ascending: false });
    const enriched: BajaWithSustituciones[] = (bajasData ?? []).map((b) => {
      const susts = (sustData ?? []).filter((s) => s.baja_id === b.id) as Sustitucion[];
      const stats = computeStatsFromDB(susts);
      return {
        ...b,
        larga_duracion: b.larga_duracion ?? false,
        dias_no_cubiertos: b.dias_no_cubiertos ?? 0,
        modo_finalizacion: b.modo_finalizacion ?? null,
        notas_finalizacion: b.notas_finalizacion ?? null,
        sustituciones: susts,
        dias_asignados: stats.totalDias,
        horas_asignadas: stats.totalHoras,
      };
    });
    setBajas(enriched);
    setLoading(false);
  }, []);

  useEffect(() => { loadEmpleados(); loadBajas(); }, [loadEmpleados, loadBajas]);

  const totalDiasBaja = !largaDuracion && bajaForm.fecha_inicio && bajaForm.fecha_fin
    ? daysBetween(bajaForm.fecha_inicio, bajaForm.fecha_fin) : 0;
  const diasACubrir = Math.max(0, totalDiasBaja - diasNoCubiertos);
  const stats = computeStats(sustitucionesForm);
  const totalCubierto = stats.totalDias + Math.ceil(stats.totalHoras / 8);

  const openNewBaja = () => {
    setEditingBaja(null);
    setBajaForm({ empleado_id: '', empleado_nombre: '', fecha_inicio: '', fecha_fin: '', motivo: '' });
    setLargaDuracion(false);
    setDiasNoCubiertos(0);
    setSustitucionesForm([]);
    setShowBajaModal(true);
    setError('');
  };

  const openEditBaja = async (baja: BajaWithSustituciones) => {
    setEditingBaja(baja);
    setBajaForm({ empleado_id: baja.empleado_id, empleado_nombre: baja.empleado_nombre, fecha_inicio: baja.fecha_inicio, fecha_fin: baja.fecha_fin ?? '', motivo: baja.motivo ?? '' });
    setLargaDuracion(baja.larga_duracion ?? false);
    setDiasNoCubiertos(baja.dias_no_cubiertos ?? 0);
    setSustitucionesForm(baja.sustituciones.map((s) => ({
      sustituto_id: s.sustituto_id, sustituto_nombre: s.sustituto_nombre,
      fecha_inicio: s.fecha_inicio, num_dias: s.num_dias, notas: s.notas ?? '',
      tipo_cobertura: (s.tipo_cobertura as SustitucionForm['tipo_cobertura']) ?? '',
      turno: (s.turno as SustitucionForm['turno']) ?? '',
      es_festivo: s.es_festivo ?? false,
      unidad: (s.unidad as SustitucionForm['unidad']) ?? 'dias',
      num_horas: s.num_horas ?? 0,
      horas_nocturnas: s.horas_nocturnas ?? 0,
      motivo_otro: s.motivo_otro ?? '',
      num_dias_festivos: s.num_dias_festivos ?? 0,
    })));
    setShowBajaModal(true);
    setError('');
  };

  const handleSelectEmpleado = (emp: Empleado) => {
    setBajaForm({ ...bajaForm, empleado_id: emp.id, empleado_nombre: emp.nombre });
    setSearch('');
  };

  const addSustitucionBlock = (emp: Empleado) => {
    if (sustitucionesForm.find((s) => s.sustituto_id === emp.id)) { setError(`${emp.nombre} ya está asignado.`); return; }
    setSustitucionesForm([...sustitucionesForm, { sustituto_id: emp.id, sustituto_nombre: emp.nombre, fecha_inicio: bajaForm.fecha_inicio || '', num_dias: 1, notas: '', tipo_cobertura: '', turno: '', es_festivo: false, unidad: 'dias', num_horas: 8, horas_nocturnas: 0, motivo_otro: '', num_dias_festivos: 0 }]);
    setShowSustitutoDropdown(false);
    setSustitutoSearch('');
    setError('');
  };

  const updateSustitucion = (idx: number, field: keyof SustitucionForm, value: string | number | boolean) => {
    setSustitucionesForm((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const removeSustitucion = (idx: number) => setSustitucionesForm((prev) => prev.filter((_, i) => i !== idx));

  const handleSaveBaja = async () => {
    if (!bajaForm.empleado_id) { setError('Selecciona un trabajador.'); return; }
    if (!bajaForm.fecha_inicio) { setError('La fecha de inicio es obligatoria.'); return; }
    if (!largaDuracion && !bajaForm.fecha_fin) { setError('La fecha de fin es obligatoria (o marca Larga duración).'); return; }
    setSavingBaja(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const bajaPayload = {
        empleado_id: bajaForm.empleado_id, empleado_nombre: bajaForm.empleado_nombre,
        fecha_inicio: bajaForm.fecha_inicio, fecha_fin: largaDuracion ? null : (bajaForm.fecha_fin || null),
        total_dias: largaDuracion ? 0 : totalDiasBaja, motivo: bajaForm.motivo.trim() || null,
        estado: 'activa', created_by: userId, updated_at: new Date().toISOString(),
        larga_duracion: largaDuracion, dias_no_cubiertos: diasNoCubiertos,
      };
      let bajaId: string;
      if (editingBaja) {
        const { error: updErr } = await supabase.from('bajas_temporales').update(bajaPayload).eq('id', editingBaja.id);
        if (updErr) throw updErr;
        bajaId = editingBaja.id;
        await supabase.from('sustituciones').delete().eq('baja_id', bajaId);
      } else {
        const { data: newBaja, error: insErr } = await supabase.from('bajas_temporales').insert(bajaPayload).select('id').single();
        if (insErr) throw insErr;
        bajaId = newBaja.id;
      }
      if (sustitucionesForm.length > 0) {
        const sustRows = sustitucionesForm.map((s) => ({
          baja_id: bajaId, sustituto_id: s.sustituto_id, sustituto_nombre: s.sustituto_nombre,
          fecha_inicio: s.fecha_inicio, num_dias: s.unidad === 'dias' ? s.num_dias : 0,
          notas: s.notas.trim() || null, tipo_cobertura: s.tipo_cobertura || null,
          turno: s.turno || null, es_festivo: s.es_festivo, unidad: s.unidad,
          num_horas: s.unidad === 'horas' ? s.num_horas : (s.turno ? s.num_dias * (HORAS_POR_TURNO[s.turno] ?? 8) : 0),
          horas_nocturnas: s.turno === 'noche' ? s.horas_nocturnas : 0,
          motivo_otro: s.tipo_cobertura === 'otro' ? (s.motivo_otro.trim() || null) : null,
          num_dias_festivos: s.es_festivo ? s.num_dias_festivos : 0,
        }));
        const { error: sustErr } = await supabase.from('sustituciones').insert(sustRows);
        if (sustErr) throw sustErr;
      }
      setShowBajaModal(false);
      await loadBajas();
      setSuccessMsg(editingBaja ? 'Baja actualizada correctamente.' : 'Baja registrada correctamente.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingBaja(false);
    }
  };

  const handleDeleteBaja = async (baja: BajaWithSustituciones) => {
    if (!confirm(`Eliminar la baja de ${baja.empleado_nombre}?`)) return;
    try {
      await supabase.from('bajas_temporales').delete().eq('id', baja.id);
      await loadBajas();
      setSuccessMsg('Baja eliminada.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Error al eliminar'); }
  };

  const openFinalizarModal = (baja: BajaWithSustituciones) => {
    setFinalizarTarget(baja);
    setModoFinalizacion('');
    setNotasFinalizacion('');
  };

  const handleConfirmFinalizar = async () => {
    if (!finalizarTarget || !modoFinalizacion) return;
    if (modoFinalizacion === 'otro' && !notasFinalizacion.trim()) { setError('Indica el motivo en el campo de notas.'); return; }
    setSavingFinalizar(true);
    try {
      await supabase.from('bajas_temporales').update({
        estado: 'finalizada',
        modo_finalizacion: modoFinalizacion,
        notas_finalizacion: notasFinalizacion.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', finalizarTarget.id);
      setFinalizarTarget(null);
      await loadBajas();
      setReporteView('finalizadas');
      setSuccessMsg('Baja finalizada.'); setTimeout(() => setSuccessMsg(''), 2500);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al finalizar');
    } finally {
      setSavingFinalizar(false);
    }
  };

  const filteredEmpleados = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(search.toLowerCase()) || (e.dni ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredSustitutos = empleados.filter((e) =>
    e.nombre.toLowerCase().includes(sustitutoSearch.toLowerCase()) &&
    e.id !== bajaForm.empleado_id &&
    !sustitucionesForm.some((s) => s.sustituto_id === e.id)
  );

  // Filter active bajas
  const activeBajas = bajas.filter((b) => {
    if (b.estado !== 'activa') return false;
    if (search && !b.empleado_nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterTipoCobertura && !b.sustituciones.some((s) => s.tipo_cobertura === filterTipoCobertura)) return false;
    if (reporteFechaInicio && b.fecha_inicio < reporteFechaInicio) return false;
    if (reporteFechaFin && b.fecha_fin && b.fecha_fin > reporteFechaFin) return false;
    return true;
  });

  // Filter finalized bajas
  const finalizadasBajas = bajas.filter((b) => {
    if (b.estado !== 'finalizada') return false;
    if (search && !b.empleado_nombre.toLowerCase().includes(search.toLowerCase())) return false;
    if (reporteFechaInicio && b.fecha_inicio < reporteFechaInicio) return false;
    if (reporteFechaFin && b.fecha_fin && b.fecha_fin > reporteFechaFin) return false;
    return true;
  });

  // Balance data — only active (non-finalized) bajas count toward the balance.
  // Finalizing a baja resets the sustitute's hour counter to 0.
  const balanceMap = new Map<string, { nombre: string; dias: number; horas: number; horasNocturnas: number; diasFestivos: number; count: number }>();
  for (const b of bajas) {
    if (b.estado !== 'activa') continue;
    for (const s of b.sustituciones) {
      if (reporteFechaInicio && s.fecha_inicio < reporteFechaInicio) continue;
      if (reporteFechaFin && s.fecha_inicio > reporteFechaFin) continue;
      const existing = balanceMap.get(s.sustituto_id);
      const horasBase = HORAS_POR_TURNO[s.turno ?? ''] ?? 8;
      const horasVal = s.unidad === 'horas' ? (s.num_horas ?? 0) : s.num_dias * horasBase;
      const horasNoc = s.turno === 'noche' ? (s.horas_nocturnas ?? horasVal) : 0;
      const diasFest = s.es_festivo ? (s.num_dias_festivos ?? s.num_dias) : 0;
      if (existing) {
        existing.dias += s.num_dias; existing.horas += s.unidad === 'horas' ? (s.num_horas ?? 0) : 0;
        existing.horasNocturnas += horasNoc; existing.diasFestivos += diasFest; existing.count += 1;
      } else {
        balanceMap.set(s.sustituto_id, { nombre: s.sustituto_nombre, dias: s.num_dias, horas: s.unidad === 'horas' ? (s.num_horas ?? 0) : 0, horasNocturnas: horasNoc, diasFestivos: diasFest, count: 1 });
      }
    }
  }
  const balanceData = Array.from(balanceMap.entries()).map(([id, val]) => ({ sustituto_id: id, ...val })).sort((a, b) => (b.dias + Math.ceil(b.horas / 8)) - (a.dias + Math.ceil(a.horas / 8)));

  // Finalizadas KPIs by modo
  const finalizadasByModo = {
    nomina: finalizadasBajas.filter((b) => b.modo_finalizacion === 'nomina').length,
    solicitud: finalizadasBajas.filter((b) => b.modo_finalizacion === 'solicitud').length,
    otro: finalizadasBajas.filter((b) => b.modo_finalizacion === 'otro').length,
    sin_modo: finalizadasBajas.filter((b) => !b.modo_finalizacion).length,
  };

  const modoConfig: Record<ModoFinalizacion, { label: string; color: string; bg: string; border: string; icon: React.FC<{ size?: number }> }> = {
    nomina: { label: 'Pagadas en nómina', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0', icon: CreditCard },
    solicitud: { label: 'Días/horas solicitados', color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE', icon: FileCheck },
    otro: { label: 'Otro', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', icon: Hash },
  };

  const turnoColors: Record<string, { color: string; bg: string }> = {
    mañana: { color: '#D97706', bg: '#FFFBEB' },
    tarde: { color: '#EA580C', bg: '#FFF7ED' },
    noche: { color: '#7C3AED', bg: '#F5F3FF' },
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
          <AlertTriangle size={16} style={{ color: '#DC2626' }} />
          <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{error}</p>
          <button onClick={() => setError('')} className="ml-auto cursor-pointer" style={{ color: '#DC2626' }}><X size={13} /></button>
        </div>
      )}
      {successMsg && (
        <div className="rounded-xl p-3 flex items-center gap-2" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={16} style={{ color: '#16A34A' }} />
          <p className="text-xs font-medium" style={{ color: '#16A34A' }}>{successMsg}</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* View tabs */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
            <button onClick={() => setReporteView('bajas')} className="px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{ backgroundColor: reporteView === 'bajas' ? '#0369A1' : '#FFFFFF', color: reporteView === 'bajas' ? '#FFFFFF' : '#64748B' }}>
              Bajas ({bajas.filter(b => b.estado === 'activa').length})
            </button>
            <button onClick={() => setReporteView('finalizadas')} className="px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{ backgroundColor: reporteView === 'finalizadas' ? '#0369A1' : '#FFFFFF', color: reporteView === 'finalizadas' ? '#FFFFFF' : '#64748B' }}>
              Finalizadas ({bajas.filter(b => b.estado === 'finalizada').length})
            </button>
            <button onClick={() => setReporteView('balance')} className="px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{ backgroundColor: reporteView === 'balance' ? '#0369A1' : '#FFFFFF', color: reporteView === 'balance' ? '#FFFFFF' : '#64748B' }}>
              Balance Sustitutos
            </button>
            <button onClick={() => setReporteView('sustituciones')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{ backgroundColor: reporteView === 'sustituciones' ? '#0369A1' : '#FFFFFF', color: reporteView === 'sustituciones' ? '#FFFFFF' : '#64748B' }}>
              <UserCheck size={12} />Sustituciones
            </button>
            <button onClick={() => setReporteView('horas-extras')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-all cursor-pointer"
              style={{ backgroundColor: reporteView === 'horas-extras' ? '#0369A1' : '#FFFFFF', color: reporteView === 'horas-extras' ? '#FFFFFF' : '#64748B' }}>
              <Timer size={12} />Horas Extras
            </button>
          </div>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar trabajador..."
              className="pl-8 pr-3 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B', width: '180px' }} />
          </div>

          {reporteView === 'bajas' && (
            <select value={filterTipoCobertura} onChange={(e) => setFilterTipoCobertura(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs border outline-none cursor-pointer"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
              <option value="">Todos los tipos</option>
              <option value="compensar">Compensar</option>
              <option value="pagar">Pagar</option>
              <option value="otro">Otro</option>
            </select>
          )}

          <div className="flex items-center gap-1.5">
            <Calendar size={14} style={{ color: '#94A3B8' }} />
            <input type="date" value={reporteFechaInicio} onChange={(e) => setReporteFechaInicio(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
            <span className="text-xs" style={{ color: '#94A3B8' }}>—</span>
            <input type="date" value={reporteFechaFin} onChange={(e) => setReporteFechaFin(e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }} />
            {(reporteFechaInicio || reporteFechaFin) && (
              <button onClick={() => { setReporteFechaInicio(''); setReporteFechaFin(''); }}
                className="px-2 py-1.5 rounded-lg text-xs cursor-pointer"
                style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setExportMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ backgroundColor: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
              <Download size={14} /> Exportar <ChevronDown size={12} />
            </button>
            {exportMenuOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                <div className="absolute right-0 mt-1 rounded-lg shadow-lg z-20 overflow-hidden min-w-[180px]"
                  style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <button onClick={() => { exportExcel(reporteView === 'finalizadas' ? finalizadasBajas : activeBajas, empleados); setExportMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50"
                    style={{ color: '#16A34A' }}>
                    <FileSpreadsheet size={14} /> Excel (.xlsx)
                  </button>
                  <button onClick={() => { exportPDF(reporteView === 'finalizadas' ? finalizadasBajas : activeBajas, empleados); setExportMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50"
                    style={{ color: '#DC2626' }}>
                    <FileText size={14} /> PDF (imprimir)
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={openNewBaja}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: '#0369A1' }}>
            <Plus size={14} /> Nueva Baja
          </button>
        </div>
      </div>

      {/* KPIs */}
      {reporteView === 'bajas' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Bajas Activas', value: bajas.filter((b) => b.estado === 'activa').length, color: '#D97706', bg: '#FFFBEB' },
            { label: 'Total Bajas', value: bajas.length, color: '#64748B', bg: '#F8FAFC' },
            { label: 'Larga Duración', value: bajas.filter((b) => b.larga_duracion && b.estado === 'activa').length, color: '#7C3AED', bg: '#F5F3FF' },
            { label: 'Sustituciones', value: bajas.filter(b => b.estado === 'activa').reduce((s, b) => s + b.sustituciones.length, 0), color: '#16A34A', bg: '#F0FDF4' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {reporteView === 'finalizadas' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Finalizadas', value: finalizadasBajas.length, color: '#64748B', bg: '#F8FAFC' },
            { label: 'Pagadas en nómina', value: finalizadasByModo.nomina, color: '#16A34A', bg: '#F0FDF4' },
            { label: 'Días/horas solicitados', value: finalizadasByModo.solicitud, color: '#0369A1', bg: '#EFF6FF' },
            { label: 'Otro', value: finalizadasByModo.otro + finalizadasByModo.sin_modo, color: '#D97706', bg: '#FFFBEB' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {reporteView === 'balance' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: 'Total Sustitutos', value: balanceData.length, color: '#16A34A', bg: '#F0FDF4' },
            { label: 'Días Cubiertos', value: balanceData.reduce((s, b) => s + b.dias, 0), color: '#0369A1', bg: '#EFF6FF' },
            { label: 'Horas Nocturnas', value: balanceData.reduce((s, b) => s + b.horasNocturnas, 0) + 'h', color: '#7C3AED', bg: '#F5F3FF' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
              <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-xs font-medium mt-0.5" style={{ color: kpi.color + 'AA' }}>{kpi.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sustituciones & Horas Extras subviews */}
      {reporteView === 'sustituciones' && <SustitucionesModule />}
      {reporteView === 'horas-extras' && <HorasExtrasModule />}

      {/* Content */}
      {(reporteView === 'sustituciones' || reporteView === 'horas-extras') ? null : loading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw size={24} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : reporteView === 'bajas' ? (
        activeBajas.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <BedSingle size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay bajas activas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activeBajas.map((baja) => {
              const dbStats = computeStatsFromDB(baja.sustituciones);
              const diasACubrirBaja = baja.larga_duracion ? null : Math.max(0, baja.total_dias - (baja.dias_no_cubiertos ?? 0));
              return (
                <div key={baja.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFBEB' }}>
                        <BedSingle size={16} style={{ color: '#D97706' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{baja.empleado_nombre}</h4>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#FFFBEB', color: '#D97706', border: '1px solid #FDE68A' }}>Activa</span>
                          {baja.larga_duracion && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>Larga duración</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: '#94A3B8' }}>
                          <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(baja.fecha_inicio)}</span>
                          <ArrowRight size={11} />
                          <span>{baja.larga_duracion ? 'Indefinido' : formatDate(baja.fecha_fin)}</span>
                          {!baja.larga_duracion && <span style={{ color: '#0369A1', fontWeight: 600 }}>{baja.total_dias} días totales</span>}
                          {(baja.dias_no_cubiertos ?? 0) > 0 && <span style={{ color: '#D97706' }}>{baja.dias_no_cubiertos} sin cubrir</span>}
                          {baja.motivo && <span>· {baja.motivo}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => openFinalizarModal(baja)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                          Finalizar
                        </button>
                        <button onClick={() => openEditBaja(baja)}
                          className="px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                          style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
                          Editar
                        </button>
                        <button onClick={() => handleDeleteBaja(baja)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer"
                          style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Sustituciones in column table */}
                    {baja.sustituciones.length > 0 && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                        {/* Coverage summary badges */}
                        <div className="flex flex-wrap gap-2 mb-2">
                          {dbStats.totalDias > 0 && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                              <UserCheck size={11} /> {dbStats.totalDias} días cubiertos
                            </span>
                          )}
                          {dbStats.totalHoras > 0 && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                              {dbStats.totalHoras}h cubiertas
                            </span>
                          )}
                          {dbStats.horasNocturnas > 0 && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                              <Moon size={11} /> {dbStats.horasNocturnas}h nocturnas
                            </span>
                          )}
                          {dbStats.diasFestivos > 0 && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#FEF9C3', color: '#854D0E', border: '1px solid #FDE047' }}>
                              <Star size={11} /> {dbStats.diasFestivos} días festivos
                            </span>
                          )}
                          {diasACubrirBaja !== null && (
                            <span className="ml-auto text-xs font-semibold" style={{ color: dbStats.totalDias === diasACubrirBaja ? '#16A34A' : '#D97706' }}>
                              {dbStats.totalDias}/{diasACubrirBaja}
                            </span>
                          )}
                        </div>

                        {/* Column table */}
                        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                          <div className="grid text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.8fr 0.7fr 1fr', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#94A3B8' }}>
                            <span>Sustituto</span>
                            <span>Cantidad</span>
                            <span>Retribución</span>
                            <span>Turno</span>
                            <span>Extras</span>
                          </div>
                          {baja.sustituciones.map((s) => {
                            const tc = s.turno ? turnoColors[s.turno] : null;
                            return (
                              <div key={s.id} className="grid items-center px-3 py-2" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.8fr 0.7fr 1fr', borderBottom: '1px solid #F8FAFC' }}>
                                <div className="flex items-center gap-1.5">
                                  <UserCheck size={11} style={{ color: '#16A34A', flexShrink: 0 }} />
                                  <span className="text-xs font-medium truncate" style={{ color: '#1E293B' }}>{s.sustituto_nombre}</span>
                                </div>
                                <span className="text-xs font-bold" style={{ color: '#0369A1' }}>
                                  {s.unidad === 'horas' ? `${s.num_horas}h` : `${s.num_dias}d`}
                                </span>
                                <span>
                                  {s.tipo_cobertura ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize"
                                      style={{ backgroundColor: s.tipo_cobertura === 'pagar' ? '#F0FDF4' : s.tipo_cobertura === 'compensar' ? '#EFF6FF' : '#FFFBEB', color: s.tipo_cobertura === 'pagar' ? '#16A34A' : s.tipo_cobertura === 'compensar' ? '#0369A1' : '#D97706' }}>
                                      {s.tipo_cobertura}
                                    </span>
                                  ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                                </span>
                                <span>
                                  {tc && s.turno ? (
                                    <span className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize" style={{ backgroundColor: tc.bg, color: tc.color }}>
                                      {s.turno}
                                    </span>
                                  ) : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                                </span>
                                <div className="flex items-center gap-1 flex-wrap">
                                  {s.es_festivo && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Festivo</span>}
                                  {s.notas && <span className="text-xs truncate max-w-[80px]" style={{ color: '#94A3B8' }} title={s.notas}>{s.notas}</span>}
                                  {!s.es_festivo && !s.notas && <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : reporteView === 'finalizadas' ? (
        finalizadasBajas.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <CheckCircle2 size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay bajas finalizadas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {finalizadasBajas.map((baja) => {
              const dbStats = computeStatsFromDB(baja.sustituciones);
              const modoCfg = baja.modo_finalizacion ? modoConfig[baja.modo_finalizacion as ModoFinalizacion] : null;
              const ModoIcon = modoCfg?.icon;
              return (
                <div key={baja.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F8FAFC' }}>
                        <BedSingle size={16} style={{ color: '#64748B' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold" style={{ color: '#0F172A' }}>{baja.empleado_nombre}</h4>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>Finalizada</span>
                          {modoCfg && ModoIcon && (
                            <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: modoCfg.bg, color: modoCfg.color, border: `1px solid ${modoCfg.border}` }}>
                              <ModoIcon size={10} />
                              {modoCfg.label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 flex-wrap text-xs" style={{ color: '#94A3B8' }}>
                          <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(baja.fecha_inicio)}</span>
                          <ArrowRight size={11} />
                          <span>{baja.larga_duracion ? 'Indefinido' : formatDate(baja.fecha_fin)}</span>
                          {!baja.larga_duracion && <span style={{ color: '#64748B', fontWeight: 600 }}>{baja.total_dias} días</span>}
                          {baja.motivo && <span>· {baja.motivo}</span>}
                        </div>
                        {baja.notas_finalizacion && (
                          <p className="text-xs mt-1.5 px-2 py-1 rounded-lg" style={{ backgroundColor: '#FFFBEB', color: '#92400E', border: '1px solid #FDE68A' }}>
                            {baja.notas_finalizacion}
                          </p>
                        )}
                      </div>
                    </div>

                    {baja.sustituciones.length > 0 && (
                      <div className="mt-3 pt-3 border-t" style={{ borderColor: '#F1F5F9' }}>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {dbStats.totalDias > 0 && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                              <UserCheck size={11} /> {dbStats.totalDias} días
                            </span>
                          )}
                          {dbStats.totalHoras > 0 && (
                            <span className="text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                              {dbStats.totalHoras}h
                            </span>
                          )}
                          {dbStats.horasNocturnas > 0 && (
                            <span className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE' }}>
                              <Moon size={11} /> {dbStats.horasNocturnas}h noc.
                            </span>
                          )}
                        </div>
                        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                          <div className="grid text-[10px] font-semibold uppercase tracking-wide px-3 py-1.5" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.8fr 0.7fr 1fr', backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#94A3B8' }}>
                            <span>Sustituto</span><span>Cantidad</span><span>Retribución</span><span>Turno</span><span>Extras</span>
                          </div>
                          {baja.sustituciones.map((s) => {
                            const tc = s.turno ? turnoColors[s.turno] : null;
                            return (
                              <div key={s.id} className="grid items-center px-3 py-2" style={{ gridTemplateColumns: '1.5fr 0.6fr 0.8fr 0.7fr 1fr', borderBottom: '1px solid #F8FAFC' }}>
                                <div className="flex items-center gap-1.5">
                                  <UserCheck size={11} style={{ color: '#94A3B8', flexShrink: 0 }} />
                                  <span className="text-xs font-medium truncate" style={{ color: '#475569' }}>{s.sustituto_nombre}</span>
                                </div>
                                <span className="text-xs font-bold" style={{ color: '#64748B' }}>{s.unidad === 'horas' ? `${s.num_horas}h` : `${s.num_dias}d`}</span>
                                <span>{s.tipo_cobertura ? <span className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>{s.tipo_cobertura}</span> : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}</span>
                                <span>{tc && s.turno ? <span className="text-xs px-1.5 py-0.5 rounded font-semibold capitalize" style={{ backgroundColor: tc.bg, color: tc.color }}>{s.turno}</span> : <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}</span>
                                <div className="flex items-center gap-1">{s.es_festivo && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Festivo</span>}{!s.es_festivo && <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        balanceData.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <UserCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay sustituciones registradas</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Balance de Cobertura por Sustituto</p>
            </div>
            <div className="divide-y" style={{ borderColor: '#F8FAFC' }}>
              {balanceData.map((b) => (
                <div key={b.sustituto_id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDF4' }}>
                    <UserCheck size={14} style={{ color: '#16A34A' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{b.nombre}</p>
                    <p className="text-xs" style={{ color: '#94A3B8' }}>{b.count} sustitucion(es)</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    {b.dias > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>{b.dias}d</span>}
                    {b.horas > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>{b.horas}h</span>}
                    {b.horasNocturnas > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}><Moon size={10} className="inline mr-0.5" />{b.horasNocturnas}h noct.</span>}
                    {b.diasFestivos > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}><Star size={10} className="inline mr-0.5" />{b.diasFestivos}d fest.</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      )}


      {/* ── Finalizar Modal ── */}
      {finalizarTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-sm w-full mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #064E3B, #065F46)' }}>
              <div>
                <h2 className="text-white font-semibold text-sm">Finalizar Baja</h2>
                <p className="text-white/70 text-xs">{finalizarTarget.empleado_nombre}</p>
              </div>
              <button onClick={() => setFinalizarTarget(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs" style={{ color: '#64748B' }}>¿Cómo se compensarán las sustituciones realizadas?</p>
              <div className="space-y-2">
                {(Object.entries(modoConfig) as [ModoFinalizacion, typeof modoConfig.nomina][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isActive = modoFinalizacion === key;
                  return (
                    <button key={key} onClick={() => setModoFinalizacion(key)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all"
                      style={{ backgroundColor: isActive ? cfg.bg : '#F8FAFC', border: `1.5px solid ${isActive ? cfg.border : '#E2E8F0'}` }}>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: isActive ? cfg.bg : '#FFFFFF', border: `1px solid ${isActive ? cfg.border : '#E2E8F0'}` }}>
                        <Icon size={15} style={{ color: isActive ? cfg.color : '#94A3B8' }} />
                      </div>
                      <span className="text-sm font-medium" style={{ color: isActive ? cfg.color : '#475569' }}>{cfg.label}</span>
                      {isActive && <CheckCircle2 size={14} className="ml-auto" style={{ color: cfg.color }} />}
                    </button>
                  );
                })}
              </div>

              {modoFinalizacion === 'otro' && (
                <div>
                  <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wide" style={{ color: '#64748B' }}>Notas / Motivo *</label>
                  <textarea value={notasFinalizacion} onChange={(e) => { setNotasFinalizacion(e.target.value); setError(''); }}
                    rows={3} placeholder="Describe el modo de compensación..."
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none"
                    style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                </div>
              )}

              {modoFinalizacion && modoFinalizacion !== 'otro' && (
                <div>
                  <label className="text-xs font-semibold mb-1.5 block uppercase tracking-wide" style={{ color: '#64748B' }}>Notas adicionales (opcional)</label>
                  <input type="text" value={notasFinalizacion} onChange={(e) => setNotasFinalizacion(e.target.value)}
                    placeholder="Observaciones..."
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                    style={{ borderColor: '#E2E8F0', color: '#1E293B', backgroundColor: '#F8FAFC' }} />
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button onClick={() => setFinalizarTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }}>
                  Cancelar
                </button>
                <button onClick={handleConfirmFinalizar} disabled={savingFinalizar || !modoFinalizacion}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#065F46' }}>
                  {savingFinalizar ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Baja Modal ── */}
      {showBajaModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-2xl w-full mx-4 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)' }}>
              <h2 className="text-white font-semibold text-sm">{editingBaja ? 'Editar Baja' : 'Nueva Baja Temporal'}</h2>
              <button onClick={() => setShowBajaModal(false)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Larga duración toggle */}
              <button onClick={() => { setLargaDuracion(!largaDuracion); if (!largaDuracion) setBajaForm({ ...bajaForm, fecha_fin: '' }); }}
                className="flex items-center gap-2.5 w-full px-4 py-3 rounded-xl cursor-pointer transition-all"
                style={{ backgroundColor: largaDuracion ? '#F5F3FF' : '#F8FAFC', border: `1.5px solid ${largaDuracion ? '#DDD6FE' : '#E2E8F0'}` }}>
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: largaDuracion ? '#7C3AED' : '#FFFFFF', border: `1.5px solid ${largaDuracion ? '#7C3AED' : '#CBD5E1'}` }}>
                  {largaDuracion && <CheckCircle2 size={12} style={{ color: '#FFFFFF' }} />}
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold" style={{ color: largaDuracion ? '#6D28D9' : '#1E293B' }}>Larga duración</p>
                  <p className="text-xs" style={{ color: '#94A3B8' }}>Sin fecha de fin definida — se finaliza manualmente</p>
                </div>
              </button>

              {/* Trabajador */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Trabajador *</label>
                {bajaForm.empleado_id ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: '#0369A1', color: '#fff' }}>
                      {bajaForm.empleado_nombre.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium flex-1" style={{ color: '#1E293B' }}>{bajaForm.empleado_nombre}</span>
                    {!editingBaja && <button onClick={() => setBajaForm({ ...bajaForm, empleado_id: '', empleado_nombre: '' })} className="text-xs cursor-pointer" style={{ color: '#64748B' }}>Cambiar</button>}
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                      <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar trabajador..."
                        className="w-full pl-8 pr-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
                    </div>
                    {search && (
                      <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg" style={{ border: '1px solid #E2E8F0' }}>
                        {filteredEmpleados.slice(0, 8).map((emp) => (
                          <button key={emp.id} onClick={() => handleSelectEmpleado(emp)}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                            style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                              {emp.nombre.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{emp.nombre}</span>
                            {emp.dni && <span className="text-xs" style={{ color: '#94A3B8' }}>{emp.dni}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Fecha Inicio *</label>
                  <input type="date" value={bajaForm.fecha_inicio} onChange={(e) => setBajaForm({ ...bajaForm, fecha_inicio: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B' }} />
                </div>
                {!largaDuracion ? (
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Fecha Fin *</label>
                    <input type="date" value={bajaForm.fecha_fin} min={bajaForm.fecha_inicio} onChange={(e) => setBajaForm({ ...bajaForm, fecha_fin: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B' }} />
                  </div>
                ) : (
                  <div className="flex flex-col justify-end">
                    <button type="button" onClick={() => { setShowSustitutoDropdown(true); setTimeout(() => (document.querySelector('input[placeholder="Buscar sustituto..."]') as HTMLInputElement | null)?.focus(), 50); }}
                      className="px-3 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer flex items-center justify-center gap-1.5"
                      style={{ backgroundColor: '#7C3AED' }}>
                      <UserCheck size={14} /> Asignar persona
                    </button>
                  </div>
                )}
              </div>

              {/* Días summary */}
              {!largaDuracion && totalDiasBaja > 0 && (
                <div className="space-y-2">
                  <div className="rounded-lg px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                    <Calendar size={14} style={{ color: '#0369A1' }} />
                    <span className="text-xs font-semibold" style={{ color: '#0369A1' }}>Total días de baja: {totalDiasBaja}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium mb-1 block" style={{ color: '#64748B' }}>Días no cubiertos</label>
                      <input type="number" min={0} max={totalDiasBaja} value={diasNoCubiertos}
                        onChange={(e) => setDiasNoCubiertos(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                        style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E' }} placeholder="0" />
                      <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>Días libres del trabajador que no se cubren</p>
                    </div>
                    <div className="flex flex-col justify-center">
                      <p className="text-xs font-medium mb-1" style={{ color: '#64748B' }}>Días a cubrir</p>
                      <div className="px-3 py-2 rounded-lg text-center" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                        <span className="text-xl font-bold" style={{ color: '#16A34A' }}>{diasACubrir}</span>
                        <p className="text-[10px]" style={{ color: '#16A34A' }}>días</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Motivo (opcional)</label>
                <input type="text" value={bajaForm.motivo} onChange={(e) => setBajaForm({ ...bajaForm, motivo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={{ borderColor: '#E2E8F0', color: '#1E293B' }}
                  placeholder="Ej. Baja médica, accidente, permiso..." />
              </div>

              {/* Sustituciones */}
              <div className="pt-2 border-t" style={{ borderColor: '#F1F5F9' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Sustituciones ({sustitucionesForm.length})</p>
                  {!largaDuracion && diasACubrir > 0 && (
                    <span className="text-xs font-semibold" style={{ color: totalCubierto === diasACubrir ? '#16A34A' : '#D97706' }}>
                      {totalCubierto}/{diasACubrir} días
                    </span>
                  )}
                </div>
                <div className="relative mb-3">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                    <input type="text" value={sustitutoSearch}
                      onChange={(e) => { setSustitutoSearch(e.target.value); setShowSustitutoDropdown(true); }}
                      onFocus={() => setShowSustitutoDropdown(true)}
                      placeholder="Buscar sustituto..."
                      className="w-full pl-8 pr-3 py-2 rounded-lg text-xs border outline-none"
                      style={{ borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }} />
                  </div>
                  {showSustitutoDropdown && sustitutoSearch && (
                    <div className="absolute z-10 top-full mt-1 w-full max-h-40 overflow-y-auto rounded-lg bg-white"
                      style={{ border: '1px solid #E2E8F0', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                      {filteredSustitutos.length === 0 ? (
                        <p className="text-xs text-center py-2" style={{ color: '#94A3B8' }}>No hay candidatos</p>
                      ) : filteredSustitutos.slice(0, 6).map((emp) => (
                        <button key={emp.id} onClick={() => addSustitucionBlock(emp)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 cursor-pointer"
                          style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <Plus size={12} style={{ color: '#0369A1' }} />
                          <span className="text-xs font-medium" style={{ color: '#1E293B' }}>{emp.nombre}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {sustitucionesForm.length === 0 ? (
                  <p className="text-xs text-center py-3" style={{ color: '#94A3B8' }}>Busca y añade sustitutos arriba</p>
                ) : (
                  <div className="space-y-3">
                    {sustitucionesForm.map((s, idx) => (
                      <SustitucionBlock key={s.sustituto_id} s={s} idx={idx} bajaFechaInicio={bajaForm.fecha_inicio} tipoContrato={empleados.find((e) => e.id === s.sustituto_id)?.tipo_contrato ?? null} onUpdate={updateSustitucion} onRemove={removeSustitucion} />
                    ))}
                    {/* Coverage summary */}
                    <div className="rounded-xl px-4 py-3 flex flex-wrap gap-2 items-center" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>Resumen cobertura:</span>
                      {stats.totalDias > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>{stats.totalDias} días</span>}
                      {stats.totalHoras > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>{stats.totalHoras}h</span>}
                      {stats.horasNocturnas > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}><Moon size={10} />{stats.horasNocturnas}h noc.</span>}
                      {stats.diasFestivos > 0 && <span className="text-xs font-bold px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}><Star size={10} />{stats.diasFestivos}d fest.</span>}
                      {!largaDuracion && diasACubrir > 0 && (
                        <span className="ml-auto">
                          {totalCubierto === diasACubrir ? (
                            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#16A34A' }}><CheckCircle2 size={13} /> Correcto ({totalCubierto}/{diasACubrir})</span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#D97706' }}><AlertTriangle size={13} /> {totalCubierto}/{diasACubrir}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>}
            </div>

            <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid #E2E8F0' }}>
              <button onClick={handleSaveBaja} disabled={savingBaja}
                className="w-full py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                style={{ backgroundColor: '#0369A1' }}>
                {savingBaja ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {savingBaja ? 'Guardando...' : editingBaja ? 'Actualizar Baja' : 'Registrar Baja'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
