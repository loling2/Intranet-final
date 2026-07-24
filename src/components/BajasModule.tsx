import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BedSingle, Plus, X, Trash2, Search, RefreshCw, Download, Calendar,
  AlertTriangle, UserCheck, CheckCircle2, Clock, ArrowRight,
  Sun, Moon, Sunset, Banknote, RotateCcw, MoreHorizontal, Star,
  FileCheck, CreditCard, Hash, FileSpreadsheet, FileText, ChevronDown,
  Timer, Upload, CheckSquare, Square, Pencil,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import SustitucionesModule from './SustitucionesModule';
import HorasExtrasModule from './HorasExtrasModule';
import * as XLSX from 'xlsx-js-style';
import { supabase } from '../supabaseClient';
import { uploadPnrJustificante, getWasabiBlobUrl } from '../lib/wasabi';
import { jsPDF } from 'jspdf';

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
  tipo_absentismo: string | null;
  reposo_duracion: string | null;
  justificante_estado: string | null;
  justificante_url: string | null;
  descontado: boolean;
  descripcion_descuento: string | null;
}

interface Sustitucion {
  id: string;
  baja_id: string | null;
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
  unidad_festivo: string | null;
  horas_festivas: number | null;
  es_nocturno: boolean | null;
}

interface LiquidacionHoras {
  id: string;
  sustituto_id: string;
  sustituto_nombre: string;
  horas_liquidadas: number;
  fecha: string;
  notas: string | null;
  created_by: string | null;
  created_by_nombre: string | null;
  created_at: string;
}

type TipoAbsentismo = 'IT' | 'AT' | 'PR' | 'PNR' | 'Reposo';

const TIPOS_ABSENTISMO: { value: TipoAbsentismo; label: string; color: string; bg: string; border: string }[] = [
  { value: 'IT', label: 'IT', color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'AT', label: 'AT', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  { value: 'PR', label: 'PR', color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
  { value: 'PNR', label: 'PNR', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'Reposo', label: 'Reposo', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE' },
];

const REPOSO_DURACIONES = ['24h', '48h', '72h'] as const;

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
  unidad_festivo: 'dias' | 'horas';
  horas_festivas: number;
  es_nocturno: boolean;
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
      if (s.es_festivo) diasFestivos += s.unidad_festivo === 'horas' ? 0 : (s.num_dias_festivos ?? s.num_dias);
      if (s.es_nocturno) horasNocturnas += s.horas_nocturnas ?? 0;
      if (s.es_festivo) horasFestivas += s.unidad_festivo === 'horas' ? (s.horas_festivas ?? 0) : s.num_dias * horasBase;
    } else {
      totalHoras += s.num_horas;
      if (s.es_nocturno) horasNocturnas += s.horas_nocturnas ?? 0;
      if (s.es_festivo) horasFestivas += s.unidad_festivo === 'horas' ? (s.horas_festivas ?? 0) : (s.num_horas ?? 0);
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
      if (s.es_festivo) diasFestivos += (s.unidad_festivo === 'horas') ? 0 : (s.num_dias_festivos ?? s.num_dias);
      if (s.es_nocturno) horasNocturnas += s.horas_nocturnas ?? 0;
      if (s.es_festivo) horasFestivas += (s.unidad_festivo === 'horas') ? (s.horas_festivas ?? 0) : s.num_dias * horasBase;
    } else {
      totalHoras += s.num_horas ?? 0;
      if (s.es_nocturno) horasNocturnas += s.horas_nocturnas ?? 0;
      if (s.es_festivo) horasFestivas += (s.unidad_festivo === 'horas') ? (s.horas_festivas ?? 0) : (s.num_horas ?? 0);
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
      const horasNoc = s.es_nocturno ? (s.horas_nocturnas ?? 0) : 0;
      const centro = empMap.get(b.empleado_id)?.centro_trabajo ?? '';
      const row: ReporteRow = { sustituido: b.empleado_nombre, fecha: s.fecha_inicio, centro, horas, horasNoc };
      const g = groups.get(s.sustituto_id);
      if (g) g.rows.push(row);
      else groups.set(s.sustituto_id, { nombre: s.sustituto_nombre, rows: [row] });
    }
  }
  return groups;
}

function exportExcel(
  bajas: BajaWithSustituciones[],
  empleados: Empleado[],
  fechaInicio: string,
  fechaFin: string,
  liquidaciones: LiquidacionHoras[],
  ausenciasPend: { id: string; nombre: string; fecha_inicio: string; fecha_fin: string | null; dias: number; tipo: string }[],
  ausenciasDesc: { id: string; nombre: string; fecha_inicio: string; dias: number; tipo: string }[],
) {
  const groups = buildReporteGroups(bajas, empleados);
  const wb = XLSX.utils.book_new();

  const titleStyle = { font: { bold: true, sz: 16, color: { rgb: '1E293B' } }, alignment: { horizontal: 'center' as const } };
  const subtitleStyle = { font: { bold: true, sz: 11, color: { rgb: '64748B' } }, alignment: { horizontal: 'center' as const } };
  const headerStyle = { font: { bold: true, sz: 11, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0F172A' } }, alignment: { horizontal: 'center' as const, vertical: 'center' as const }, border: { top: { style: 'thin', color: { rgb: '334155' } }, bottom: { style: 'thin', color: { rgb: '334155' } }, left: { style: 'thin', color: { rgb: '334155' } }, right: { style: 'thin', color: { rgb: '334155' } } } };
  const cellStyle = { font: { sz: 10, color: { rgb: '1E293B' } }, border: { top: { style: 'thin', color: { rgb: 'E2E8F0' } }, bottom: { style: 'thin', color: { rgb: 'E2E8F0' } }, left: { style: 'thin', color: { rgb: 'E2E8F0' } }, right: { style: 'thin', color: { rgb: 'E2E8F0' } } } };
  const totalStyle = { font: { bold: true, sz: 11, color: { rgb: '15803D' } }, fill: { fgColor: { rgb: 'ECFDF5' } }, border: { top: { style: 'medium', color: { rgb: '22C55E' } }, bottom: { style: 'thin', color: { rgb: 'BBF7D0' } }, left: { style: 'thin', color: { rgb: 'BBF7D0' } }, right: { style: 'thin', color: { rgb: 'BBF7D0' } } } };
  const nightStyle = { ...cellStyle, font: { sz: 10, color: { rgb: '6D28D9' } } };
  const ausenciaStyle = { ...cellStyle, font: { sz: 10, color: { rgb: 'DC2626' } }, fill: { fgColor: { rgb: 'FEF2F2' } } };
  const descontadaStyle = { ...cellStyle, font: { sz: 10, color: { rgb: '16A34A' } }, fill: { fgColor: { rgb: 'F0FDF4' } } };

  const rangoTexto = fechaInicio || fechaFin
    ? `Rango: ${fechaInicio ? formatDate(fechaInicio) : 'Inicio'} → ${fechaFin ? formatDate(fechaFin) : 'Hoy'}`
    : 'Rango: Todas las fechas';

  const liqMap = new Map<string, number>();
  for (const l of liquidaciones) liqMap.set(l.sustituto_id, (liqMap.get(l.sustituto_id) ?? 0) + l.horas_liquidadas);

  // ── Sheet 1: Resumen ──
  const summaryAoa: (string | number)[][] = [
    ['BALANCE DE SUSTITUCIONES'],
    [rangoTexto],
    [`Generado: ${new Date().toLocaleString('es-ES')}`],
    [],
    ['Sustituto', 'Horas realizadas', 'Horas nocturnas', 'Días festivos', 'Horas pagadas', 'Horas pendientes', 'Días compensados'],
  ];

  // Build per-sustituto totals from groups
  const sustitutoIds = new Map<string, string>(); // id → nombre
  for (const b of bajas) {
    for (const s of b.sustituciones) sustitutoIds.set(s.sustituto_id, s.sustituto_nombre);
  }

  for (const [sid, nombre] of sustitutoIds) {
    const g = groups.get(sid);
    const totHoras = g ? g.rows.reduce((s, r) => s + r.horas, 0) : 0;
    const totNoc = g ? g.rows.reduce((s, r) => s + r.horasNoc, 0) : 0;
    const totFest = g ? g.rows.length : 0;
    const liquidadas = liqMap.get(sid) ?? 0;
    const pendientes = Math.max(0, totHoras - liquidadas);
    summaryAoa.push([nombre, totHoras, totNoc, totFest, liquidadas, pendientes, 0]);
  }

  const wsSum = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSum['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }];
  wsSum['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
  ];
  wsSum['A1'].s = titleStyle;
  wsSum['A2'].s = subtitleStyle;
  wsSum['A3'].s = subtitleStyle;
  for (let c = 0; c < 7; c++) {
    const ref = XLSX.utils.encode_cell({ r: 4, c });
    if (wsSum[ref]) wsSum[ref].s = headerStyle;
  }
  for (let r = 5; r < 5 + sustitutoIds.size; r++) {
    for (let c = 0; c < 7; c++) {
      const ref = XLSX.utils.encode_cell({ r, c });
      if (wsSum[ref]) wsSum[ref].s = cellStyle;
    }
  }
  XLSX.utils.book_append_sheet(wb, wsSum, 'Resumen');

  // ── Sheet 2+: One per sustituto ──
  let hasData = false;
  for (const [sid, g] of groups) {
    const totHoras = g.rows.reduce((s, r) => s + r.horas, 0);
    const totNoc = g.rows.reduce((s, r) => s + r.horasNoc, 0);
    const liquidadas = liqMap.get(sid) ?? 0;
    const pendientes = Math.max(0, totHoras - liquidadas);
    const aoa: (string | number)[][] = [
      [`BALANCE DE SUSTITUCIONES — ${g.nombre}`],
      [rangoTexto],
      [],
      ['Persona sustituida', 'Fecha', 'Centro', 'Horas', 'H. Nocturnas', 'Festivo'],
      ...g.rows.map((r) => [r.sustituido, formatDate(r.fecha), r.centro, r.horas, r.horasNoc, '']),
      [],
      ['TOTAL HORAS', '', '', totHoras, totNoc, ''],
      ['HORAS PAGADAS', '', '', liquidadas, '', ''],
      ['HORAS PENDIENTES', '', '', pendientes, '', ''],
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 14 }, { wch: 10 }];
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ];
    ws['A1'].s = titleStyle;
    ws['A2'].s = subtitleStyle;
    for (let c = 0; c < 6; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      if (ws[ref]) ws[ref].s = headerStyle;
    }
    const dataStart = 4;
    const dataEnd = dataStart + g.rows.length;
    for (let r = dataStart; r < dataEnd; r++) {
      for (let c = 0; c < 6; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref]) {
          if (c === 4 && (ws[ref].v as number) > 0) ws[ref].s = nightStyle;
          else ws[ref].s = cellStyle;
        }
      }
    }
    for (let r = dataEnd; r < dataEnd + 3; r++) {
      for (let c = 0; c < 6; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (ws[ref]) ws[ref].s = totalStyle;
      }
    }
    const safeName = g.nombre.replace(/[\\/?*[\]:]/g, '_').slice(0, 28) || 'Hoja';
    XLSX.utils.book_append_sheet(wb, ws, safeName);
    hasData = true;
  }

  // ── Sheet: Ausencias PNR/Reposo ──
  if (ausenciasPend.length > 0 || ausenciasDesc.length > 0) {
    const ausAoa: (string | number)[][] = [
      ['AUSENCIAS QUE DESCUENTAN DÍAS (PNR / REPOSO)'],
      [rangoTexto],
      [],
      ['Trabajador', 'Tipo', 'Fecha inicio', 'Fecha fin', 'Días', 'Estado'],
    ];
    for (const b of ausenciasPend) {
      ausAoa.push([b.nombre, b.tipo, formatDate(b.fecha_inicio), b.fecha_fin ? formatDate(b.fecha_fin) : '—', b.dias, 'Pendiente']);
    }
    for (const b of ausenciasDesc) {
      ausAoa.push([b.nombre, b.tipo, formatDate(b.fecha_inicio), '—', 0, 'Descontada']);
    }
    const wsAus = XLSX.utils.aoa_to_sheet(ausAoa);
    wsAus['!cols'] = [{ wch: 28 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }];
    wsAus['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
    ];
    wsAus['A1'].s = { ...titleStyle, font: { bold: true, sz: 14, color: { rgb: 'DC2626' } } };
    wsAus['A2'].s = subtitleStyle;
    for (let c = 0; c < 6; c++) {
      const ref = XLSX.utils.encode_cell({ r: 3, c });
      if (wsAus[ref]) wsAus[ref].s = headerStyle;
    }
    const ausDataStart = 4;
    for (let r = ausDataStart; r < ausDataStart + ausenciasPend.length; r++) {
      for (let c = 0; c < 6; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsAus[ref]) wsAus[ref].s = ausenciaStyle;
      }
    }
    for (let r = ausDataStart + ausenciasPend.length; r < ausDataStart + ausenciasPend.length + ausenciasDesc.length; r++) {
      for (let c = 0; c < 6; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        if (wsAus[ref]) wsAus[ref].s = descontadaStyle;
      }
    }
    XLSX.utils.book_append_sheet(wb, wsAus, 'Ausencias');
    hasData = true;
  }

  if (!hasData && groups.size === 0) {
    const ws = XLSX.utils.aoa_to_sheet([['Sin datos para exportar']]);
    XLSX.utils.book_append_sheet(wb, ws, 'Sin datos');
  }
  XLSX.writeFile(wb, `balance_sustituciones_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportPDF(bajas: BajaWithSustituciones[], empleados: Empleado[]) {
  const groups = buildReporteGroups(bajas, empleados);
  const fechaGen = new Date().toLocaleString('es-ES');
  const groupsArr = Array.from(groups.values());

  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 12;
  const contentW = pageW - marginX * 2;

  let y = 14;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42);
  doc.text('Balance de Sustituciones', marginX, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generado el ${fechaGen}`, pageW - marginX, y, { align: 'right' });
  y += 3;
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.6);
  doc.line(marginX, y, pageW - marginX, y);
  y += 8;

  const colSust = 55;
  const colFecha = 25;
  const colCentro = 40;
  const colHoras = 20;
  const colNoc = contentW - colSust - colFecha - colCentro - colHoras;

  const drawHeader = () => {
    doc.setFillColor(15, 23, 42);
    doc.rect(marginX, y, contentW, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(255, 255, 255);
    doc.text('Persona sustituida', marginX + 2, y + 4.8);
    doc.text('Fecha', marginX + colSust + 2, y + 4.8);
    doc.text('Centro', marginX + colSust + colFecha + 2, y + 4.8);
    doc.text('Horas', marginX + colSust + colFecha + colCentro + colHoras - 2, y + 4.8, { align: 'right' });
    doc.text('H. Noct.', pageW - marginX - 2, y + 4.8, { align: 'right' });
    y += 7;
  };

  if (groupsArr.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(11);
    doc.setTextColor(148, 163, 184);
    doc.text('Sin datos para mostrar.', marginX, y + 6);
  } else {
    for (const g of groupsArr) {
      const totHoras = g.rows.reduce((s, r) => s + r.horas, 0);
      const totNoc = g.rows.reduce((s, r) => s + r.horasNoc, 0);

      // Group title bar
      if (y > pageH - 30) { doc.addPage(); y = 14; }
      doc.setFillColor(241, 245, 249);
      doc.rect(marginX, y, contentW, 7, 'F');
      doc.setFillColor(3, 105, 161);
      doc.rect(marginX, y, 1.5, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(g.nombre, marginX + 4, y + 4.8);
      doc.setTextColor(3, 105, 161);
      const totTxt = `TOTAL: ${totHoras}h${totNoc > 0 ? ' / ' + totNoc + 'h nocturnas' : ''}`;
      doc.text(totTxt, pageW - marginX - 2, y + 4.8, { align: 'right' });
      y += 7;

      drawHeader();

      g.rows.forEach((r, idx) => {
        if (y > pageH - 18) { doc.addPage(); y = 14; drawHeader(); }
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(marginX, y, contentW, 6, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(r.sustituido).slice(0, 32), marginX + 2, y + 4.2);
        doc.text(formatDate(r.fecha), marginX + colSust + 2, y + 4.2);
        doc.text(String(r.centro).slice(0, 22), marginX + colSust + colFecha + 2, y + 4.2);
        doc.text(String(r.horas), marginX + colSust + colFecha + colCentro + colHoras - 2, y + 4.2, { align: 'right' });
        doc.text(String(r.horasNoc), pageW - marginX - 2, y + 4.2, { align: 'right' });
        y += 6;
      });

      // Total row
      if (y > pageH - 14) { doc.addPage(); y = 14; }
      doc.setFillColor(236, 253, 245);
      doc.rect(marginX, y, contentW, 7, 'F');
      doc.setDrawColor(22, 163, 74);
      doc.setLineWidth(0.5);
      doc.line(marginX, y, pageW - marginX, y);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL', marginX + 2, y + 4.8);
      doc.setTextColor(22, 163, 74);
      doc.text(String(totHoras), marginX + colSust + colFecha + colCentro + colHoras - 2, y + 4.8, { align: 'right' });
      doc.text(String(totNoc), pageW - marginX - 2, y + 4.8, { align: 'right' });
      y += 10;
    }
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Documento generado automáticamente · ${fechaGen}`, pageW / 2, pageH - 8, { align: 'center' });
  }

  doc.save('Balance_Sustituciones.pdf');
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
        {/* Festivo toggle + unit selector */}
        <div className="rounded-lg p-2.5" style={{ backgroundColor: s.es_festivo ? '#FEF9C3' : '#F8FAFC', border: `1.5px solid ${s.es_festivo ? '#FDE047' : '#E2E8F0'}` }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => onUpdate(idx, 'es_festivo', !s.es_festivo)}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all"
              style={{ color: s.es_festivo ? '#854D0E' : '#94A3B8' }}>
              <Star size={12} />Festivo
            </button>
            {s.es_festivo && (
              <div className="flex gap-1">
                {(['dias', 'horas'] as const).map((u) => (
                  <button key={u} onClick={() => onUpdate(idx, 'unidad_festivo', u)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer transition-all"
                    style={{ backgroundColor: s.unidad_festivo === u ? '#854D0E' : '#FEF9C3', color: s.unidad_festivo === u ? '#FFFFFF' : '#854D0E' }}>
                    {u === 'dias' ? 'Días' : 'Horas'}
                  </button>
                ))}
              </div>
            )}
          </div>
          {s.es_festivo && (
            <input type="number" min={0} step={s.unidad_festivo === 'horas' ? 0.5 : 1}
              value={s.unidad_festivo === 'horas' ? s.horas_festivas : s.num_dias_festivos}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 0;
                if (s.unidad_festivo === 'horas') onUpdate(idx, 'horas_festivas', val);
                else onUpdate(idx, 'num_dias_festivos', val);
              }}
              className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#FDE047', color: '#854D0E', backgroundColor: '#FFFFFF', fontWeight: 700, fontSize: '14px' }}
              placeholder={s.unidad_festivo === 'horas' ? 'Nº horas festivas' : 'Nº días festivos'} />
          )}
        </div>
        {/* Nocturnidad toggle (independent of turno) */}
        <div className="rounded-lg p-2.5" style={{ backgroundColor: s.es_nocturno ? '#F5F3FF' : '#F8FAFC', border: `1.5px solid ${s.es_nocturno ? '#DDD6FE' : '#E2E8F0'}` }}>
          <div className="flex items-center justify-between mb-2">
            <button onClick={() => onUpdate(idx, 'es_nocturno', !s.es_nocturno)}
              className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer transition-all"
              style={{ color: s.es_nocturno ? '#7C3AED' : '#94A3B8' }}>
              <Moon size={12} />Nocturnidad
            </button>
          </div>
          {s.es_nocturno && (
            <input type="number" min={0} step={0.5} value={s.horas_nocturnas}
              onChange={(e) => onUpdate(idx, 'horas_nocturnas', parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-2 rounded-lg text-xs border outline-none"
              style={{ borderColor: '#DDD6FE', color: '#7C3AED', backgroundColor: '#FFFFFF', fontWeight: 700, fontSize: '14px' }}
              placeholder="Nº horas nocturnas" />
          )}
        </div>
        {/* Summary */}
        {s.turno && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: s.turno === 'noche' ? '#F5F3FF' : '#F8FAFC', border: '1px solid #E2E8F0' }}>
            {s.turno === 'noche' ? <Moon size={12} style={{ color: '#7C3AED' }} /> : s.turno === 'tarde' ? <Sunset size={12} style={{ color: '#EA580C' }} /> : <Sun size={12} style={{ color: '#D97706' }} />}
            <span className="text-xs" style={{ color: '#475569' }}>
              {s.unidad === 'dias' ? `${s.num_dias} día${s.num_dias !== 1 ? 's' : ''} × ${horasBase}h = ` : ''}
              <strong style={{ color: s.turno === 'noche' ? '#7C3AED' : '#0369A1' }}>
                {horasAuto}h {s.turno === 'noche' ? 'nocturnas' : s.turno === 'tarde' ? 'tarde' : 'mañana'}
              </strong>
              {s.es_festivo && <span style={{ color: '#854D0E' }}> · festivo ({s.unidad_festivo === 'horas' ? `${s.horas_festivas}h` : `${s.num_dias_festivos}d`})</span>}
              {s.es_nocturno && <span style={{ color: '#7C3AED' }}> · nocturnidad ({s.horas_nocturnas}h)</span>}
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
  const [tipoAbsentismo, setTipoAbsentismo] = useState<TipoAbsentismo | ''>('');
  const [reposoDuracion, setReposoDuracion] = useState<string>('');
  const [justificanteEstado, setJustificanteEstado] = useState<'pendiente' | 'entregado'>('pendiente');
  const [justificanteUrl, setJustificanteUrl] = useState<string | null>(null);
  const [uploadingJustificante, setUploadingJustificante] = useState(false);

  // Standalone sustituciones + liquidaciones
  const [standaloneSustituciones, setStandaloneSustituciones] = useState<Sustitucion[]>([]);
  const [liquidaciones, setLiquidaciones] = useState<LiquidacionHoras[]>([]);

  // Liquidar modal
  const [liquidarTarget, setLiquidarTarget] = useState<{ sustituto_id: string; sustituto_nombre: string; pendiente: number } | null>(null);
  const [liquidarHoras, setLiquidarHoras] = useState(0);
  const [liquidarNotas, setLiquidarNotas] = useState('');
  const [savingLiquidar, setSavingLiquidar] = useState(false);

  // Descontar modal
  const [descontarTarget, setDescontarTarget] = useState<{ bajaId: string; nombre: string; diasADescontar: number } | null>(null);
  const [descontarDescripcion, setDescontarDescripcion] = useState('');
  const [savingDescontar, setSavingDescontar] = useState(false);

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
    const [{ data: bajasData }, { data: sustData }, { data: liqData }] = await Promise.all([
      supabase.from('bajas_temporales').select('*').order('created_at', { ascending: false }),
      supabase.from('sustituciones').select('*').order('created_at', { ascending: false }),
      supabase.from('liquidaciones_horas').select('*').order('fecha', { ascending: false }),
    ]);
    const enriched: BajaWithSustituciones[] = (bajasData ?? []).map((b) => {
      const susts = (sustData ?? []).filter((s) => s.baja_id === b.id) as Sustitucion[];
      const stats = computeStatsFromDB(susts);
      return {
        ...b,
        tipo_absentismo: b.tipo_absentismo ?? null,
        reposo_duracion: b.reposo_duracion ?? null,
        justificante_estado: b.justificante_estado ?? 'pendiente',
        justificante_url: b.justificante_url ?? null,
        descontado: b.descontado ?? false,
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
    setStandaloneSustituciones((sustData ?? []).filter((s) => !s.baja_id) as Sustitucion[]);
    setLiquidaciones((liqData ?? []) as LiquidacionHoras[]);
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
    setTipoAbsentismo('');
    setReposoDuracion('');
    setJustificanteEstado('pendiente');
    setJustificanteUrl(null);
    setSustitucionesForm([]);
    setShowBajaModal(true);
    setError('');
  };

  const openEditBaja = async (baja: BajaWithSustituciones) => {
    setEditingBaja(baja);
    setBajaForm({ empleado_id: baja.empleado_id, empleado_nombre: baja.empleado_nombre, fecha_inicio: baja.fecha_inicio, fecha_fin: baja.fecha_fin ?? '', motivo: baja.motivo ?? '' });
    setLargaDuracion(baja.larga_duracion ?? false);
    setDiasNoCubiertos(baja.dias_no_cubiertos ?? 0);
    setTipoAbsentismo((baja.tipo_absentismo as TipoAbsentismo) ?? '');
    setReposoDuracion(baja.reposo_duracion ?? '');
    setJustificanteEstado((baja.justificante_estado as 'pendiente' | 'entregado') ?? 'pendiente');
    setJustificanteUrl(baja.justificante_url ?? null);
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
      unidad_festivo: (s.unidad_festivo as 'dias' | 'horas') ?? 'dias',
      horas_festivas: s.horas_festivas ?? 0,
      es_nocturno: s.es_nocturno ?? false,
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
    setSustitucionesForm([...sustitucionesForm, { sustituto_id: emp.id, sustituto_nombre: emp.nombre, fecha_inicio: bajaForm.fecha_inicio || '', num_dias: 1, notas: '', tipo_cobertura: '', turno: '', es_festivo: false, unidad: 'dias', num_horas: 8, horas_nocturnas: 0, motivo_otro: '', num_dias_festivos: 0, unidad_festivo: 'dias', horas_festivas: 0, es_nocturno: false }]);
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
        tipo_absentismo: tipoAbsentismo || null,
        reposo_duracion: tipoAbsentismo === 'Reposo' ? reposoDuracion : null,
        justificante_estado: tipoAbsentismo === 'PNR' ? justificanteEstado : null,
        justificante_url: tipoAbsentismo === 'PNR' && justificanteEstado === 'entregado' ? justificanteUrl : null,
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
          horas_nocturnas: s.es_nocturno ? s.horas_nocturnas : 0,
          motivo_otro: s.tipo_cobertura === 'otro' ? (s.motivo_otro.trim() || null) : null,
          num_dias_festivos: s.es_festivo ? (s.unidad_festivo === 'dias' ? s.num_dias_festivos : 0) : 0,
          unidad_festivo: s.unidad_festivo,
          horas_festivas: s.es_festivo ? (s.unidad_festivo === 'horas' ? s.horas_festivas : 0) : 0,
          es_nocturno: s.es_nocturno,
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

  const handleUploadJustificante = async (file: File) => {
    if (!bajaForm.empleado_id) { setError('Selecciona un trabajador primero.'); return; }
    setUploadingJustificante(true); setError('');
    try {
      const emp = empleados.find((e) => e.id === bajaForm.empleado_id);
      const dni = emp?.dni ?? 'sin-dni';
      const nombre = emp?.nombre ?? bajaForm.empleado_nombre;
      const anio = new Date().getFullYear().toString();
      const key = await uploadPnrJustificante(file, dni, nombre, anio);
      setJustificanteUrl(key);
      setJustificanteEstado('entregado');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir justificante');
    } finally {
      setUploadingJustificante(false);
    }
  };

  const handleViewJustificante = async (url: string) => {
    try {
      const blobUrl = await getWasabiBlobUrl(url);
      window.open(blobUrl, '_blank');
    } catch { setError('No se pudo abrir el justificante.'); }
  };

  const openLiquidarModal = (sustituto_id: string, sustituto_nombre: string, pendiente: number) => {
    setLiquidarTarget({ sustituto_id, sustituto_nombre, pendiente });
    setLiquidarHoras(pendiente);
    setLiquidarNotas('');
  };

  const handleConfirmLiquidar = async () => {
    if (!liquidarTarget) return;
    if (!liquidarHoras || liquidarHoras <= 0) { setError('Indica las horas a liquidar.'); return; }
    if (liquidarHoras > liquidarTarget.pendiente) { setError(`No puedes liquidar más de ${liquidarTarget.pendiente}h pendientes.`); return; }
    setSavingLiquidar(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;
      const { error: insErr } = await supabase.from('liquidaciones_horas').insert({
        sustituto_id: liquidarTarget.sustituto_id,
        sustituto_nombre: liquidarTarget.sustituto_nombre,
        horas_liquidadas: liquidarHoras,
        fecha: new Date().toISOString().slice(0, 10),
        notas: liquidarNotas.trim() || null,
        created_by: userId,
      });
      if (insErr) throw insErr;
      setLiquidarTarget(null);
      await loadBajas();
      setSuccessMsg(`${liquidarHoras}h liquidadas para ${liquidarTarget.sustituto_nombre}.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al liquidar');
    } finally {
      setSavingLiquidar(false);
    }
  };

  const openDescontarModal = (bajaId: string, nombre: string, diasADescontar: number) => {
    setDescontarTarget({ bajaId, nombre, diasADescontar });
    setDescontarDescripcion('');
    setError('');
  };

  const handleConfirmDescontar = async () => {
    if (!descontarTarget) return;
    if (!descontarDescripcion.trim()) { setError('Indica una descripción del descuento.'); return; }
    setSavingDescontar(true); setError('');
    try {
      const { error: updErr } = await supabase.from('bajas_temporales')
        .update({ descontado: true, descripcion_descuento: descontarDescripcion.trim(), updated_at: new Date().toISOString() })
        .eq('id', descontarTarget.bajaId);
      if (updErr) throw updErr;
      setDescontarTarget(null);
      await loadBajas();
      setSuccessMsg('Ausencia descontada del balance.'); setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al descontar');
    } finally {
      setSavingDescontar(false);
    }
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
      const horasNoc = s.es_nocturno ? (s.horas_nocturnas ?? 0) : 0;
      const diasFest = s.es_festivo ? (s.unidad_festivo === 'horas' ? 0 : (s.num_dias_festivos ?? s.num_dias)) : 0;
      if (existing) {
        existing.dias += s.num_dias; existing.horas += s.unidad === 'horas' ? (s.num_horas ?? 0) : 0;
        existing.horasNocturnas += horasNoc; existing.diasFestivos += diasFest; existing.count += 1;
      } else {
        balanceMap.set(s.sustituto_id, { nombre: s.sustituto_nombre, dias: s.num_dias, horas: s.unidad === 'horas' ? (s.num_horas ?? 0) : 0, horasNocturnas: horasNoc, diasFestivos: diasFest, count: 1 });
      }
    }
  }
  // Include standalone sustituciones in the balance
  for (const s of standaloneSustituciones) {
    if (reporteFechaInicio && s.fecha_inicio < reporteFechaInicio) continue;
    if (reporteFechaFin && s.fecha_inicio > reporteFechaFin) continue;
    const existing = balanceMap.get(s.sustituto_id);
    const horasBase = HORAS_POR_TURNO[s.turno ?? ''] ?? 8;
    const horasVal = s.unidad === 'horas' ? (s.num_horas ?? 0) : s.num_dias * horasBase;
    const horasNoc = s.es_nocturno ? (s.horas_nocturnas ?? 0) : 0;
    const diasFest = s.es_festivo ? (s.unidad_festivo === 'horas' ? 0 : (s.num_dias_festivos ?? s.num_dias)) : 0;
    if (existing) {
      existing.dias += s.num_dias; existing.horas += s.unidad === 'horas' ? (s.num_horas ?? 0) : 0;
      existing.horasNocturnas += horasNoc; existing.diasFestivos += diasFest; existing.count += 1;
    } else {
      balanceMap.set(s.sustituto_id, { nombre: s.sustituto_nombre, dias: s.num_dias, horas: s.unidad === 'horas' ? (s.num_horas ?? 0) : 0, horasNocturnas: horasNoc, diasFestivos: diasFest, count: 1 });
    }
  }
  // Apply liquidaciones (subtract liquidadas from horas)
  const liquidacionesPorSustituto = new Map<string, number>();
  for (const l of liquidaciones) {
    if (reporteFechaInicio && l.fecha < reporteFechaInicio) continue;
    if (reporteFechaFin && l.fecha > reporteFechaFin) continue;
    liquidacionesPorSustituto.set(l.sustituto_id, (liquidacionesPorSustituto.get(l.sustituto_id) ?? 0) + l.horas_liquidadas);
  }
  // Individual PNR/Reposo absences not yet descontado — shown with a Descontar button each
  const ausenciasIndividuales = bajas
    .filter((b) => b.estado === 'activa' && (b.tipo_absentismo === 'PNR' || b.tipo_absentismo === 'Reposo') && !b.descontado)
    .filter((b) => !reporteFechaInicio || b.fecha_inicio >= reporteFechaInicio)
    .filter((b) => !reporteFechaFin || !b.fecha_fin || b.fecha_fin <= reporteFechaFin)
    .map((b) => {
      const diasReposo = b.reposo_duracion === '72h' ? 3 : b.reposo_duracion === '48h' ? 2 : 1;
      const dias = b.tipo_absentismo === 'Reposo' ? diasReposo : (b.larga_duracion ? 1 : (b.total_dias ?? 1));
      return { id: b.id, nombre: b.empleado_nombre, fecha_inicio: b.fecha_inicio, fecha_fin: b.fecha_fin, dias, tipo: b.tipo_absentismo as string };
    });

  // Descontadas (compensated) absences — shown in a separate green section
  const ausenciasDescontadas = bajas
    .filter((b) => b.descontado)
    .filter((b) => !reporteFechaInicio || b.fecha_inicio >= reporteFechaInicio)
    .filter((b) => !reporteFechaFin || !b.fecha_fin || b.fecha_fin <= reporteFechaFin)
    .map((b) => {
      const diasReposo = b.reposo_duracion === '72h' ? 3 : b.reposo_duracion === '48h' ? 2 : 1;
      const dias = b.tipo_absentismo === 'Reposo' ? diasReposo : (b.larga_duracion ? 1 : (b.total_dias ?? 1));
      return { id: b.id, nombre: b.empleado_nombre, fecha_inicio: b.fecha_inicio, dias, tipo: b.tipo_absentismo as string, descripcion_descuento: b.descripcion_descuento };
    });
  const balanceData = Array.from(balanceMap.entries()).map(([id, val]) => {
    const liquidadas = liquidacionesPorSustituto.get(id) ?? 0;
    return { sustituto_id: id, ...val, horasLiquidadas: liquidadas, horasPendientes: Math.max(0, val.horas - liquidadas) };
  }).sort((a, b) => (b.dias + Math.ceil(b.horas / 8)) - (a.dias + Math.ceil(a.horas / 8)));


  // Finalizadas KPIs by modo
  const finalizadasByModo = {
    nomina: finalizadasBajas.filter((b) => b.modo_finalizacion === 'nomina').length,
    solicitud: finalizadasBajas.filter((b) => b.modo_finalizacion === 'solicitud').length,
    otro: finalizadasBajas.filter((b) => b.modo_finalizacion === 'otro').length,
    sin_modo: finalizadasBajas.filter((b) => !b.modo_finalizacion).length,
  };

  const modoConfig: Record<ModoFinalizacion, { label: string; color: string; bg: string; border: string; icon: LucideIcon }> = {
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
                  <button onClick={() => { exportExcel(reporteView === 'finalizadas' ? finalizadasBajas : activeBajas, empleados, reporteFechaInicio, reporteFechaFin, liquidaciones, ausenciasIndividuales, ausenciasDescontadas); setExportMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50"
                    style={{ color: '#16A34A' }}>
                    <FileSpreadsheet size={14} /> Excel (.xlsx)
                  </button>
                  <button onClick={() => { exportPDF(reporteView === 'finalizadas' ? finalizadasBajas : activeBajas, empleados); setExportMenuOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium cursor-pointer hover:bg-slate-50"
                    style={{ color: '#DC2626' }}>
                    <FileText size={14} /> PDF
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
                                  {s.es_nocturno && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>Nocturno</span>}
                                  {s.notas && <span className="text-xs truncate max-w-[80px]" style={{ color: '#94A3B8' }} title={s.notas}>{s.notas}</span>}
                                  {!s.es_festivo && !s.es_nocturno && !s.notas && <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}
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
                                <div className="flex items-center gap-1">{s.es_festivo && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}>Festivo</span>}{s.es_nocturno && <span className="text-xs px-1.5 py-0.5 rounded font-semibold" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>Nocturno</span>}{!s.es_festivo && !s.es_nocturno && <span className="text-xs" style={{ color: '#CBD5E1' }}>—</span>}</div>
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
        balanceData.length === 0 && ausenciasIndividuales.length === 0 && ausenciasDescontadas.length === 0 ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <UserCheck size={32} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="text-sm font-medium" style={{ color: '#64748B' }}>No hay sustituciones ni ausencias registradas</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Ausencias pendientes de descontar (PNR/Reposo) */}
            {ausenciasIndividuales.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #FECACA' }}>
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #FECACA', backgroundColor: '#FEF2F2' }}>
                  <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#DC2626' }}>Ausencias que descuentan días (PNR / Reposo) — pendientes de descontar</p>
                </div>
                <div className="divide-y" style={{ borderColor: '#FEE2E2' }}>
                  {ausenciasIndividuales.map((b) => (
                    <div key={b.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FEF2F2' }}>
                        <BedSingle size={14} style={{ color: '#DC2626' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{b.nombre}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{b.tipo} · {formatDate(b.fecha_inicio)}{b.fecha_fin ? ' → ' + formatDate(b.fecha_fin) : ''}</p>
                      </div>
                      <span className="text-sm px-3 py-1.5 rounded-lg font-bold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                        −{b.dias}d
                      </span>
                      <button onClick={() => openDescontarModal(b.id, b.nombre, b.dias)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#16A34A' }}>
                        <CheckCircle2 size={12} /> Descontar
                      </button>
                      <button
                        onClick={() => { const baja = bajas.find((bj) => bj.id === b.id); if (baja) openEditBaja(baja); }}
                        title="Editar baja"
                        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                        style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                        <Pencil size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ausencias ya descontadas (compensadas) */}
            {ausenciasDescontadas.length > 0 && (
              <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #BBF7D0' }}>
                <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #BBF7D0', backgroundColor: '#F0FDF4' }}>
                  <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#16A34A' }}>Ausencias descontadas / compensadas ({ausenciasDescontadas.length})</p>
                </div>
                <div className="divide-y" style={{ borderColor: '#DCFCE7' }}>
                  {ausenciasDescontadas.map((b) => (
                    <div key={b.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDF4' }}>
                        <CheckCircle2 size={14} style={{ color: '#16A34A' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{b.nombre}</p>
                        <p className="text-xs" style={{ color: '#94A3B8' }}>{b.tipo} · {formatDate(b.fecha_inicio)} · {b.dias}d compensados{b.descripcion_descuento ? ` · ${b.descripcion_descuento}` : ''}</p>
                      </div>
                      <span className="text-sm px-3 py-1.5 rounded-lg font-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                        0d
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Balance de sustitutos */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC' }}>
                <Banknote size={14} style={{ color: '#16A34A' }} />
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Balance de Sustitutos — Liquidar horas</p>
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
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {b.dias > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>{b.dias}d</span>}
                      {b.horas > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A' }}>{b.horas}h</span>}
                      {b.horasNocturnas > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}><Moon size={10} className="inline mr-0.5" />{b.horasNocturnas}h noct.</span>}
                      {b.diasFestivos > 0 && <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#FEF9C3', color: '#854D0E' }}><Star size={10} className="inline mr-0.5" />{b.diasFestivos}d fest.</span>}
                      {b.horas > 0 && (
                        <>
                          {b.horasLiquidadas > 0 && (
                            <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#F0FDF4', color: '#16A34A', border: '1px solid #BBF7D0' }}>
                              <CheckCircle2 size={10} className="inline mr-0.5" />{b.horasLiquidadas}h liq.
                            </span>
                          )}
                          {b.horasPendientes > 0 && (
                            <span className="text-xs px-2 py-1 rounded-lg font-bold" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
                              <Clock size={10} className="inline mr-0.5" />{b.horasPendientes}h pend.
                            </span>
                          )}
                          <button onClick={() => openLiquidarModal(b.sustituto_id, b.nombre, b.horasPendientes)}
                            disabled={b.horasPendientes <= 0}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-white cursor-pointer disabled:opacity-40 transition-opacity"
                            style={{ backgroundColor: '#D97706' }}>
                            <Banknote size={11} /> Liquidar
                          </button>
                          <button
                            onClick={() => { const baja = bajas.find((bj) => bj.estado === 'activa' && bj.sustituciones.some((s) => s.sustituto_id === b.sustituto_id)); if (baja) openEditBaja(baja); }}
                            title="Editar baja"
                            className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer"
                            style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                            <Pencil size={13} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
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

      {/* ── Liquidar Horas Modal ── */}
      {liquidarTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #92400E, #D97706)' }}>
              <h2 className="text-white font-semibold text-sm flex items-center gap-2"><Banknote size={15} /> Liquidar horas</h2>
              <button onClick={() => setLiquidarTarget(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                <p className="text-sm font-semibold" style={{ color: '#92400E' }}>{liquidarTarget.sustituto_nombre}</p>
                <p className="text-xs mt-0.5" style={{ color: '#D97706' }}>
                  Horas pendientes: <span className="font-bold">{liquidarTarget.pendiente.toFixed(1)}h</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Horas a liquidar *</label>
                <input type="number" min={0} max={liquidarTarget.pendiente} step={0.5} value={liquidarHoras || ''}
                  onChange={(e) => setLiquidarHoras(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#FDE68A', backgroundColor: '#FFFBEB', color: '#92400E', fontWeight: 700 }} />
                <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                  Pendientes restantes: <span className="font-semibold" style={{ color: '#DC2626' }}>{Math.max(0, liquidarTarget.pendiente - (liquidarHoras || 0)).toFixed(1)}h</span>
                  {' → '}
                  Finalizadas: <span className="font-semibold" style={{ color: '#16A34A' }}>{(liquidarHoras || 0).toFixed(1)}h</span>
                </p>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Notas (opcional)</label>
                <input type="text" value={liquidarNotas} onChange={(e) => setLiquidarNotas(e.target.value)}
                  placeholder="Ej. Pago noviembre 2026"
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#E2E8F0', color: '#1E293B' }} />
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setLiquidarTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
                  Cancelar
                </button>
                <button onClick={handleConfirmLiquidar} disabled={savingLiquidar || !liquidarHoras || liquidarHoras <= 0 || liquidarHoras > liquidarTarget.pendiente}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#D97706' }}>
                  {savingLiquidar ? <RefreshCw size={14} className="animate-spin" /> : <Banknote size={14} />}
                  {savingLiquidar ? 'Liquidando...' : 'Liquidar horas'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {descontarTarget && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
          <div className="bg-white rounded-2xl max-w-md w-full mx-4 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 flex items-center justify-between" style={{ background: 'linear-gradient(135deg, #15803D, #16A34A)' }}>
              <h2 className="text-white font-semibold text-sm flex items-center gap-2"><CreditCard size={15} /> Descontar ausencia</h2>
              <button onClick={() => setDescontarTarget(null)} className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#fff' }}>
                <X size={15} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="rounded-lg px-4 py-3" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                <p className="text-sm font-semibold" style={{ color: '#15803D' }}>{descontarTarget.nombre}</p>
                <p className="text-xs mt-0.5" style={{ color: '#16A34A' }}>
                  Se descontarán <strong>{descontarTarget.diasADescontar} día{descontarTarget.diasADescontar !== 1 ? 's' : ''}</strong> del balance del trabajador.
                </p>
              </div>

              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Descripción del descuento *</label>
                <input type="text" value={descontarDescripcion} onChange={(e) => setDescontarDescripcion(e.target.value)}
                  placeholder="Ej. Nómina de junio"
                  autoFocus
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ borderColor: '#BBF7D0', backgroundColor: '#F0FDF4', color: '#15803D', fontWeight: 600 }} />
                <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>
                  Indica el motivo o referencia del descuento. Se guardará junto al registro.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button onClick={() => setDescontarTarget(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B' }}>
                  Cancelar
                </button>
                <button onClick={handleConfirmDescontar} disabled={savingDescontar || !descontarDescripcion.trim()}
                  className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#16A34A' }}>
                  {savingDescontar ? <RefreshCw size={14} className="animate-spin" /> : <CreditCard size={14} />}
                  {savingDescontar ? 'Descontando...' : 'Descontar'}
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

              {/* Tipo de absentismo */}
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: '#64748B' }}>Tipo de absentismo</label>
                <div className="flex flex-wrap gap-2">
                  {TIPOS_ABSENTISMO.map((t) => {
                    const selected = tipoAbsentismo === t.value;
                    return (
                      <button key={t.value} type="button" onClick={() => {
                        setTipoAbsentismo(selected ? '' : t.value);
                        if (t.value !== 'PNR') { setJustificanteEstado('pendiente'); setJustificanteUrl(null); }
                        if (t.value !== 'Reposo') setReposoDuracion('');
                      }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all"
                        style={{
                          backgroundColor: selected ? t.bg : '#FFFFFF',
                          border: `1.5px solid ${selected ? t.color : '#E2E8F0'}`,
                          color: selected ? t.color : '#64748B',
                        }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reposo: duración dropdown */}
              {tipoAbsentismo === 'Reposo' && (
                <div className="rounded-xl p-3" style={{ backgroundColor: '#F5F3FF', border: '1px solid #DDD6FE' }}>
                  <label className="text-xs font-medium mb-1.5 block" style={{ color: '#7C3AED' }}>Duración del reposo *</label>
                  <div className="flex gap-2">
                    {REPOSO_DURACIONES.map((d) => {
                      const selected = reposoDuracion === d;
                      return (
                        <button key={d} type="button" onClick={() => setReposoDuracion(selected ? '' : d)}
                          className="flex-1 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                          style={{
                            backgroundColor: selected ? '#7C3AED' : '#FFFFFF',
                            border: `1.5px solid ${selected ? '#7C3AED' : '#DDD6FE'}`,
                            color: selected ? '#FFFFFF' : '#7C3AED',
                          }}>
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: '#7C3AED' }}>
                    Esta ausencia descontará 1 día del balance del trabajador.
                  </p>
                </div>
              )}

              {/* PNR: justificante */}
              {tipoAbsentismo === 'PNR' && (
                <div className="rounded-xl p-3 space-y-3" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                  <div>
                    <label className="text-xs font-medium mb-1.5 block" style={{ color: '#D97706' }}>Justificante</label>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => { setJustificanteEstado('pendiente'); setJustificanteUrl(null); }}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                        style={{
                          backgroundColor: justificanteEstado === 'pendiente' ? '#D97706' : '#FFFFFF',
                          border: `1.5px solid ${justificanteEstado === 'pendiente' ? '#D97706' : '#FDE68A'}`,
                          color: justificanteEstado === 'pendiente' ? '#FFFFFF' : '#D97706',
                        }}>
                        {justificanteEstado === 'pendiente' ? <CheckSquare size={14} /> : <Square size={14} />} Pendiente
                      </button>
                      <button type="button" onClick={() => setJustificanteEstado('entregado')}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all"
                        style={{
                          backgroundColor: justificanteEstado === 'entregado' ? '#16A34A' : '#FFFFFF',
                          border: `1.5px solid ${justificanteEstado === 'entregado' ? '#16A34A' : '#FDE68A'}`,
                          color: justificanteEstado === 'entregado' ? '#FFFFFF' : '#16A34A',
                        }}>
                        {justificanteEstado === 'entregado' ? <CheckSquare size={14} /> : <Square size={14} />} Entregado
                      </button>
                    </div>
                  </div>

                  {justificanteEstado === 'entregado' && (
                    <div>
                      {justificanteUrl ? (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                          <FileCheck size={14} style={{ color: '#16A34A' }} />
                          <span className="text-xs flex-1 truncate" style={{ color: '#16A34A' }}>Justificante subido</span>
                          <button type="button" onClick={() => handleViewJustificante(justificanteUrl)}
                            className="text-xs cursor-pointer" style={{ color: '#0369A1' }}>Ver</button>
                          <button type="button" onClick={() => { setJustificanteUrl(null); }}
                            className="text-xs cursor-pointer" style={{ color: '#DC2626' }}>Quitar</button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg cursor-pointer"
                          style={{ backgroundColor: '#FFFFFF', border: '1.5px dashed #FDE68A', color: '#D97706' }}>
                          <Upload size={14} />
                          <span className="text-xs font-semibold">
                            {uploadingJustificante ? 'Subiendo...' : 'Subir justificante'}
                          </span>
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
                            disabled={uploadingJustificante || !bajaForm.empleado_id}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadJustificante(f);
                              e.target.value = '';
                            }} />
                        </label>
                      )}
                      <p className="text-[10px] mt-1" style={{ color: '#D97706' }}>
                        Se guardará en Documentos personales / PNR / {new Date().getFullYear()}
                      </p>
                    </div>
                  )}

                  <p className="text-[10px]" style={{ color: '#D97706' }}>
                    Esta ausencia descontará {reposoDuracion === '72h' ? 3 : reposoDuracion === '48h' ? 2 : 1} día{(reposoDuracion === '72h' ? 3 : reposoDuracion === '48h' ? 2 : 1) !== 1 ? 's' : ''} del balance del trabajador.
                  </p>
                </div>
              )}

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
