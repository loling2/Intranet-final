import { useState, useEffect, useMemo, useRef } from 'react';
import {
  BarChart3, RefreshCw, CheckCircle2, Clock, Building2, Users, FileText,
  ChevronDown, ChevronUp, Download, FileSpreadsheet, AlertTriangle, Search,
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import * as XLSX from 'xlsx-js-style';
import { jsPDF } from 'jspdf';

interface Sociedad { id: string; nombre: string; }
interface PendingDoc { doc_id: string; nombre_archivo: string; folder_nombre: string; created_at: string; }
interface StatRow {
  empleado_id: string; nombre: string; email: string; society_id: string;
  society_nombre: string; centro_trabajo: string;
  total_asignados: number; total_descargados: number; total_pendientes: number;
  docs_pendientes: PendingDoc[];
}

function mapRpcRow(r: any): StatRow {
  return {
    empleado_id: r.r_empleado_id ?? r.empleado_id ?? '',
    nombre: r.r_nombre ?? r.nombre ?? '',
    email: r.r_email ?? r.email ?? '',
    society_id: r.r_society_id ?? r.society_id ?? '',
    society_nombre: r.r_society_nombre ?? r.society_nombre ?? '',
    centro_trabajo: r.r_centro ?? r.centro_trabajo ?? '',
    total_asignados: Number(r.r_asignados ?? r.total_asignados ?? 0),
    total_descargados: Number(r.r_descargados ?? r.total_descargados ?? 0),
    total_pendientes: Number(r.r_pendientes ?? r.total_pendientes ?? 0),
    docs_pendientes: (r.r_docs_pend ?? r.docs_pendientes ?? []) as PendingDoc[],
  };
}

function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return 'hoy';
  if (days === 1) return 'desde ayer';
  if (days < 7) return `desde hace ${days} días`;
  if (days < 14) return 'desde hace 1 semana';
  if (days < 30) return `desde hace ${Math.floor(days / 7)} semanas`;
  if (days < 60) return 'desde hace 1 mes';
  const months = Math.floor(days / 30);
  if (months === 1) return 'desde hace 1 mes';
  return `desde hace ${months} meses`;
}

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TrazabilidadStats() {
  const [stats, setStats] = useState<StatRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sociedades, setSociedades] = useState<Sociedad[]>([]);
  const [centros, setCentros] = useState<string[]>([]);

  const [selSociety, setSelSociety] = useState<string>('');
  const [selCentro, setSelCentro] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => { loadFilters(); }, []);
  useEffect(() => { loadStats(); }, [selSociety, selCentro]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function loadFilters() {
    try {
      const { data: socs, error: sErr } = await supabase.from('sociedades').select('id, nombre').order('nombre');
      if (sErr) throw sErr;
      setSociedades((socs ?? []) as Sociedad[]);
    } catch { /* non-critical */ }
  }

  async function loadCentros(societyId: string) {
    try {
      let q = supabase.from('centros').select('nombre, id_sociedad');
      if (societyId) q = q.eq('id_sociedad', societyId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const cSet = new Set<string>();
      rows.forEach((r) => { if (r.nombre) cSet.add(r.nombre); });
      setCentros(Array.from(cSet).sort());
    } catch { setCentros([]); }
  }

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, any> = {};
      if (selSociety) params.p_society_id = selSociety;
      if (selCentro) params.p_centro = selCentro;
      const { data, error: rpcErr } = await supabase.rpc('get_prl_trazabilidad_stats', params);
      if (rpcErr) throw rpcErr;
      setStats((data ?? []).map(mapRpcRow));
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar estadísticas');
      setStats([]);
    } finally { setLoading(false); }
  }

  useEffect(() => {
    loadCentros(selSociety);
    setSelCentro('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selSociety]);

  // ── Global totals (only society/centro filtered, NOT text search) ──
  const globalTotals = useMemo(() => {
    let asignados = 0, descargados = 0, pendientes = 0;
    stats.forEach((r) => {
      asignados += r.total_asignados;
      descargados += r.total_descargados;
      pendientes += r.total_pendientes;
    });
    return { asignados, descargados, pendientes, empleados: stats.length };
  }, [stats]);

  const globalPct = globalTotals.asignados > 0 ? Math.round((globalTotals.descargados / globalTotals.asignados) * 100) : 0;

  // ── Autocomplete suggestions ──
  const suggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return stats
      .filter((r) => (r.nombre ?? '').toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [stats, searchQuery]);

  // ── Filtered stats for the individual table ──
  const filteredStats = useMemo(() => {
    if (selectedEmpId) return stats.filter((r) => r.empleado_id === selectedEmpId);
    if (!searchQuery.trim()) return stats;
    const q = searchQuery.toLowerCase();
    return stats.filter((r) => (r.nombre ?? '').toLowerCase().includes(q) || (r.email ?? '').toLowerCase().includes(q));
  }, [stats, searchQuery, selectedEmpId]);

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  function selectEmployee(emp: StatRow) {
    setSelectedEmpId(emp.empleado_id);
    setSearchQuery(emp.nombre);
    setShowDropdown(false);
  }

  function clearSearch() {
    setSearchQuery('');
    setSelectedEmpId(null);
    setShowDropdown(false);
  }

  // ── Export helpers ──────────────────────────────────────────
  function exportExcel() {
    const rows: any[][] = [];
    rows.push(['Empleado', 'Sociedad', 'Centro', 'Asignados', 'Descargados', 'Pendientes']);
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '065F46' } },
      alignment: { horizontal: 'center' as const, vertical: 'center' as const },
      border: {
        top: { style: 'thin', color: { rgb: '065F46' } }, bottom: { style: 'thin', color: { rgb: '065F46' } },
        left: { style: 'thin', color: { rgb: '065F46' } }, right: { style: 'thin', color: { rgb: '065F46' } },
      },
    };
    filteredStats.forEach((r) => {
      rows.push([r.nombre, r.society_nombre, r.centro_trabajo || '', r.total_asignados, r.total_descargados, r.total_pendientes]);
    });
    const detailRows: any[][] = [['Empleado', 'Documento', 'Carpeta', 'Fecha asignación', 'Tiempo pendiente']];
    filteredStats.forEach((r) => {
      r.docs_pendientes.forEach((d) => {
        detailRows.push([r.nombre, d.nombre_archivo, d.folder_nombre, fmtDate(d.created_at), timeAgo(d.created_at)]);
      });
    });
    const ws1 = XLSX.utils.aoa_to_sheet(rows);
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows);
    [ws1, ws2].forEach((ws) => {
      if (ws['!ref']) {
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
          if (cell) cell.s = headerStyle;
        }
      }
    });
    ws1['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    ws2['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 20 }, { wch: 18 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');
    XLSX.utils.book_append_sheet(wb, ws2, 'Pendientes detalle');
    XLSX.writeFile(wb, 'trazabilidad_estadisticas.xlsx');
  }

  function drawArcSlice(doc: jsPDF, cx: number, cy: number, radius: number, startPct: number, endPct: number) {
    const steps = 60;
    const startAngle = startPct * 2 * Math.PI - Math.PI / 2;
    const endAngle = endPct * 2 * Math.PI - Math.PI / 2;
    for (let i = 0; i < steps; i++) {
      const a1 = startAngle + (endAngle - startAngle) * (i / steps);
      const a2 = startAngle + (endAngle - startAngle) * ((i + 1) / steps);
      doc.triangle(cx, cy, cx + radius * Math.cos(a1), cy + radius * Math.sin(a1), cx + radius * Math.cos(a2), cy + radius * Math.sin(a2), 'F');
    }
  }

  function drawPieChart(doc: jsPDF, cx: number, cy: number, radius: number, descargados: number, pendientes: number, pctVal: number) {
    const total = descargados + pendientes;
    if (total === 0) return;
    if (descargados > 0) { doc.setFillColor(6, 95, 70); drawArcSlice(doc, cx, cy, radius, 0, descargados / total); }
    if (pendientes > 0) { doc.setFillColor(194, 65, 12); drawArcSlice(doc, cx, cy, radius, descargados / total, 1); }
    doc.setFillColor(255, 255, 255);
    doc.circle(cx, cy, radius * 0.55, 'F');
    doc.setFontSize(14); doc.setTextColor(6, 95, 70); doc.setFont('helvetica', 'bold');
    doc.text(`${pctVal}%`, cx, cy + 1, { align: 'center' });
    doc.setFontSize(7); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
    doc.text('cumplimiento', cx, cy + 5, { align: 'center' });
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 10;
    let y = margin;

    doc.setFontSize(16); doc.setTextColor(6, 95, 70); doc.setFont('helvetica', 'bold');
    doc.text('Estadísticas de Trazabilidad PRL', margin, y + 6);
    y += 12;
    doc.setFontSize(10); doc.setTextColor(100, 116, 139); doc.setFont('helvetica', 'normal');
    const fecha = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    doc.text(`Generado el ${fecha}`, margin, y);
    y += 4;
    doc.text(`Empleados: ${globalTotals.empleados}  |  Asignados: ${globalTotals.asignados}  |  Descargados: ${globalTotals.descargados}  |  Pendientes: ${globalTotals.pendientes}  |  Cumplimiento: ${globalPct}%`, margin, y);
    y += 8;

    const chartCx = pageW - 45;
    const chartCy = y + 25;
    drawPieChart(doc, chartCx, chartCy, 22, globalTotals.descargados, globalTotals.pendientes, globalPct);
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.setFillColor(6, 95, 70); doc.rect(chartCx - 35, chartCy + 30, 4, 4, 'F');
    doc.setTextColor(30, 41, 59); doc.text(`Descargados (${globalTotals.descargados})`, chartCx - 29, chartCy + 33);
    doc.setFillColor(194, 65, 12); doc.rect(chartCx - 35, chartCy + 36, 4, 4, 'F');
    doc.text(`Pendientes (${globalTotals.pendientes})`, chartCx - 29, chartCy + 39);

    const colW = [60, 40, 30, 25, 25, 25, 25];
    const headers = ['Empleado', 'Sociedad', 'Centro', 'Asignados', 'Descargados', 'Pendientes', '%'];
    doc.setFontSize(9); doc.setFont('helvetica', 'bold'); doc.setTextColor(255, 255, 255); doc.setFillColor(6, 95, 70);
    doc.rect(margin, y, pageW - margin * 2, 7, 'F');
    let x = margin + 2;
    headers.forEach((h, i) => { doc.text(h, x, y + 5); x += colW[i]; });
    y += 7;
    doc.setFont('helvetica', 'normal');
    filteredStats.forEach((r, idx) => {
      if (y > pageH - 15) { doc.addPage(); y = margin; }
      const rowPct = r.total_asignados > 0 ? Math.round((r.total_descargados / r.total_asignados) * 100) : 0;
      const vals = [r.nombre, r.society_nombre, r.centro_trabajo || '', String(r.total_asignados), String(r.total_descargados), String(r.total_pendientes), `${rowPct}%`];
      if (idx % 2 === 0) { doc.setFillColor(236, 253, 245); doc.rect(margin, y, pageW - margin * 2, 6, 'F'); }
      doc.setTextColor(30, 41, 59); x = margin + 2;
      vals.forEach((v, i) => { doc.text(String(v).substring(0, 28), x, y + 4.5); x += colW[i]; });
      y += 6;
    });

    doc.addPage(); y = margin;
    doc.setFontSize(14); doc.setTextColor(6, 95, 70); doc.setFont('helvetica', 'bold');
    doc.text('Documentos pendientes por empleado', margin, y + 6); y += 12;
    const dColW = [55, 60, 40, 35, 40];
    const dHeaders = ['Empleado', 'Documento', 'Carpeta', 'Fecha asignación', 'Pendiente desde'];
    doc.setFontSize(9); doc.setFillColor(194, 65, 12); doc.setTextColor(255, 255, 255);
    doc.rect(margin, y, pageW - margin * 2, 7, 'F'); x = margin + 2;
    dHeaders.forEach((h, i) => { doc.text(h, x, y + 5); x += dColW[i]; });
    y += 7; doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
    let rowIdx = 0;
    filteredStats.forEach((r) => {
      r.docs_pendientes.forEach((d) => {
        if (y > pageH - 15) { doc.addPage(); y = margin; }
        if (rowIdx % 2 === 0) { doc.setFillColor(255, 247, 237); doc.rect(margin, y, pageW - margin * 2, 6, 'F'); }
        const dvals = [r.nombre, d.nombre_archivo.substring(0, 32), d.folder_nombre, fmtDate(d.created_at), timeAgo(d.created_at)];
        x = margin + 2;
        dvals.forEach((v, i) => { doc.text(String(v), x, y + 4.5); x += dColW[i]; });
        y += 6; rowIdx++;
      });
    });
    doc.save('trazabilidad_estadisticas.pdf');
  }

  const maxBar = Math.max(globalTotals.descargados, globalTotals.pendientes, 1);
  const barH = 180;
  const socName = sociedades.find((s) => s.id === selSociety)?.nombre ?? 'Todas las sociedades';

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="rounded-2xl p-4 flex flex-wrap items-end gap-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold" style={{ color: '#64748B' }}>Sociedad</label>
          <select value={selSociety} onChange={(e) => setSelSociety(e.target.value)}
            className="text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B', minWidth: '160px' }}>
            <option value="">Todas</option>
            {sociedades.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-semibold" style={{ color: '#64748B' }}>Centro</label>
          <select value={selCentro} onChange={(e) => setSelCentro(e.target.value)}
            className="text-xs rounded-xl px-3 py-2 outline-none cursor-pointer"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B', minWidth: '140px' }}>
            <option value="">Todos</option>
            {centros.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Autocomplete search */}
        <div className="flex flex-col gap-1 flex-1" style={{ minWidth: '220px' }} ref={searchRef}>
          <label className="text-[11px] font-semibold" style={{ color: '#64748B' }}>Buscar empleado</label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#94A3B8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedEmpId(null); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Escribe el nombre del empleado..."
              className="text-xs rounded-xl pl-9 pr-7 py-2 outline-none w-full"
              style={{ border: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', color: '#1E293B' }}
            />
            {searchQuery && (
              <button onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full cursor-pointer flex items-center justify-center"
                style={{ color: '#94A3B8', width: '18px', height: '18px' }}>
                <span style={{ fontSize: '14px', lineHeight: 1 }}>×</span>
              </button>
            )}
            {/* Dropdown */}
            {showDropdown && suggestions.length > 0 && (
              <div className="absolute z-50 mt-1 w-full rounded-xl overflow-hidden shadow-lg"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', maxHeight: '280px', overflowY: 'auto' }}>
                {suggestions.map((emp) => (
                  <button key={emp.empleado_id} onClick={() => selectEmployee(emp)}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-left cursor-pointer transition-colors hover:bg-slate-50"
                    style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ backgroundColor: emp.total_pendientes > 0 ? '#94A3B8' : '#065F46' }}>
                      {(emp.nombre ?? '').trim().charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate" style={{ color: '#1E293B' }}>{emp.nombre}</p>
                      <p className="text-[10px] truncate" style={{ color: '#94A3B8' }}>
                        {emp.society_nombre}{emp.centro_trabajo ? ` · ${emp.centro_trabajo}` : ''}
                      </p>
                    </div>
                    {emp.total_pendientes > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: '#FFF7ED', color: '#C2410C' }}>
                        {emp.total_pendientes} pend.
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <button onClick={loadStats}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors"
          style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar
        </button>

        <div className="flex items-center gap-2">
          <button onClick={exportExcel} disabled={filteredStats.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #6EE7B7' }}>
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button onClick={exportPDF} disabled={filteredStats.length === 0}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-xs" style={{ backgroundColor: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
        </div>
      ) : (
        <>
          {/* ── GLOBAL CHARTS (top, only society/centro filtered) ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={16} style={{ color: '#065F46' }} />
              <h3 className="text-sm font-bold" style={{ color: '#1E293B' }}>Vista global</h3>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                {socName}{selCentro ? ` · ${selCentro}` : ''}
              </span>
            </div>

            {/* Global KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <KpiCard icon={<Users size={16} />} label="Empleados" value={globalTotals.empleados} bg="#F0F9FF" color="#0369A1" border="#7DD3FC" />
              <KpiCard icon={<FileText size={16} />} label="Asignados" value={globalTotals.asignados} bg="#F8FAFC" color="#475569" border="#CBD5E1" />
              <KpiCard icon={<CheckCircle2 size={16} />} label="Descargados" value={globalTotals.descargados} bg="#ECFDF5" color="#065F46" border="#6EE7B7" />
              <KpiCard icon={<Clock size={16} />} label="Pendientes" value={globalTotals.pendientes} bg="#FFF7ED" color="#C2410C" border="#FED7AA" />
            </div>

            {/* Global charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: '#1E293B' }}>Cumplimiento global</p>
                <div className="flex items-center justify-center">
                  <DonutChart descargados={globalTotals.descargados} pendientes={globalTotals.pendientes} pct={globalPct} />
                </div>
              </div>
              <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <p className="text-sm font-semibold mb-4" style={{ color: '#1E293B' }}>Descargados vs Pendientes</p>
                <div className="flex items-end justify-center gap-8" style={{ height: `${barH + 40}px` }}>
                  <BarColumn label="Descargados" value={globalTotals.descargados} max={maxBar} height={barH} color="#065F46" />
                  <BarColumn label="Pendientes" value={globalTotals.pendientes} max={maxBar} height={barH} color="#C2410C" />
                </div>
              </div>
            </div>
          </div>

          {/* ── INDIVIDUAL TABLE (text-search filtered) ── */}
          {filteredStats.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center rounded-2xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <Users size={32} className="mb-3" style={{ color: '#CBD5E1' }} />
              <p className="text-sm font-semibold" style={{ color: '#475569' }}>
                {searchQuery ? 'Sin resultados para tu búsqueda' : 'Sin datos para los filtros seleccionados'}
              </p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
                {searchQuery ? 'Prueba con otro nombre' : 'Prueba a cambiar la sociedad o centro'}
              </p>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Users size={16} style={{ color: '#065F46' }} />
                <h3 className="text-sm font-bold" style={{ color: '#1E293B' }}>Informe por empleado</h3>
                {selectedEmpId && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                    {filteredStats[0]?.nombre}
                  </span>
                )}
              </div>

              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <Users size={14} style={{ color: '#065F46' }} />
                  <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>Detalle individual</span>
                  <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                    {filteredStats.length}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#F8FAFC' }}>
                        <th className="text-left text-[11px] font-semibold px-4 py-2" style={{ color: '#64748B' }}>Empleado</th>
                        <th className="text-left text-[11px] font-semibold px-4 py-2" style={{ color: '#64748B' }}>Sociedad</th>
                        <th className="text-center text-[11px] font-semibold px-4 py-2" style={{ color: '#64748B' }}>Asignados</th>
                        <th className="text-center text-[11px] font-semibold px-4 py-2" style={{ color: '#64748B' }}>Descargados</th>
                        <th className="text-center text-[11px] font-semibold px-4 py-2" style={{ color: '#64748B' }}>Pendientes</th>
                        <th className="text-center text-[11px] font-semibold px-4 py-2" style={{ color: '#64748B' }}>%</th>
                        <th className="w-8" />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStats.map((r) => {
                        const isOpen = expandedRows.has(r.empleado_id);
                        const rowPct = r.total_asignados > 0 ? Math.round((r.total_descargados / r.total_asignados) * 100) : 0;
                        return (
                          <>
                            <tr key={r.empleado_id}
                              onClick={() => r.total_pendientes > 0 && toggleRow(r.empleado_id)}
                              className={r.total_pendientes > 0 ? 'cursor-pointer' : ''}
                              style={{ borderBottom: '1px solid #F1F5F9' }}>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                    style={{ backgroundColor: r.total_pendientes > 0 ? '#94A3B8' : '#065F46' }}>
                                    {(r.nombre ?? '').trim().charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>{r.nombre}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  <Building2 size={11} style={{ color: '#94A3B8' }} />
                                  <span className="text-xs" style={{ color: '#64748B' }}>{r.society_nombre}</span>
                                </div>
                              </td>
                              <td className="text-center px-4 py-2.5 text-xs font-semibold" style={{ color: '#475569' }}>{r.total_asignados}</td>
                              <td className="text-center px-4 py-2.5">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
                                  {r.total_descargados}
                                </span>
                              </td>
                              <td className="text-center px-4 py-2.5">
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: r.total_pendientes > 0 ? '#FFF7ED' : '#ECFDF5', color: r.total_pendientes > 0 ? '#C2410C' : '#065F46' }}>
                                  {r.total_pendientes}
                                </span>
                              </td>
                              <td className="text-center px-4 py-2.5">
                                <div className="flex items-center justify-center gap-1.5">
                                  <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                                    <div className="h-full rounded-full"
                                      style={{ width: `${rowPct}%`, backgroundColor: rowPct >= 75 ? '#065F46' : rowPct >= 50 ? '#F59E0B' : '#DC2626' }} />
                                  </div>
                                  <span className="text-[10px] font-semibold" style={{ color: '#64748B' }}>{rowPct}%</span>
                                </div>
                              </td>
                              <td className="px-2 py-2.5">
                                {r.total_pendientes > 0 && (isOpen ? <ChevronUp size={14} style={{ color: '#94A3B8' }} /> : <ChevronDown size={14} style={{ color: '#94A3B8' }} />)}
                              </td>
                            </tr>
                            {isOpen && r.total_pendientes > 0 && (
                              <tr style={{ backgroundColor: '#FFFBEB' }}>
                                <td colSpan={7} className="px-4 py-3">
                                  <div className="space-y-2">
                                    <p className="text-xs font-semibold mb-2" style={{ color: '#C2410C' }}>
                                      {(r.nombre ?? '').split(' ')[0]}, te faltan {r.total_pendientes} documento{r.total_pendientes > 1 ? 's' : ''} por descargar:
                                    </p>
                                    {r.docs_pendientes.map((d) => (
                                      <div key={d.doc_id} className="flex items-start gap-2 pl-2" style={{ borderLeft: '2px solid #FED7AA' }}>
                                        <FileText size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#C2410C' }} />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-medium" style={{ color: '#1E293B' }}>{d.nombre_archivo}</p>
                                          <p className="text-[10px]" style={{ color: '#94A3B8' }}>
                                            {d.folder_nombre} · asignado {fmtDate(d.created_at)} · pendiente {timeAgo(d.created_at)}
                                          </p>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────

function KpiCard({ icon, label, value, bg, color, border }: { icon: React.ReactNode; label: string; value: number; bg: string; color: string; border: string }) {
  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: bg, border: `1px solid ${border}` }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#FFFFFF' }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-[11px] font-semibold" style={{ color }}>{label}</p>
        <p className="text-xl font-bold" style={{ color }}>{value}</p>
      </div>
    </div>
  );
}

function DonutChart({ descargados, pendientes, pct }: { descargados: number; pendientes: number; pct: number }) {
  const total = descargados + pendientes;
  if (total === 0) return <p className="text-xs" style={{ color: '#94A3B8' }}>Sin datos</p>;
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dash = (descargados / total) * circumference;

  return (
    <div className="flex items-center gap-6">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#FFF7ED" strokeWidth="22" />
        <circle cx="90" cy="90" r={radius} fill="none" stroke="#065F46" strokeWidth="22"
          strokeDasharray={`${dash} ${circumference - dash}`}
          strokeDashoffset={circumference / 4}
          strokeLinecap="round"
          transform="rotate(-90 90 90)"
          style={{ transition: 'stroke-dasharray 0.6s ease' }} />
        <text x="90" y="85" textAnchor="middle" fill="#065F46" style={{ fontSize: '28px', fontWeight: 700 }}>{pct}%</text>
        <text x="90" y="105" textAnchor="middle" fill="#94A3B8" style={{ fontSize: '11px' }}>cumplimiento</text>
      </svg>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#065F46' }} />
          <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>Descargados</span>
          <span className="text-xs font-bold" style={{ color: '#065F46' }}>{descargados}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FED7AA' }} />
          <span className="text-xs font-semibold" style={{ color: '#1E293B' }}>Pendientes</span>
          <span className="text-xs font-bold" style={{ color: '#C2410C' }}>{pendientes}</span>
        </div>
      </div>
    </div>
  );
}

function BarColumn({ label, value, max, height, color }: { label: string; value: number; max: number; height: number; color: string }) {
  const h = max > 0 ? (value / max) * height : 0;
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-sm font-bold" style={{ color }}>{value}</span>
      <div className="rounded-t-xl flex items-end justify-center" style={{ width: '60px', height: `${height}px`, backgroundColor: '#F8FAFC' }}>
        <div className="w-full rounded-t-xl" style={{ height: `${h}px`, backgroundColor: color, transition: 'height 0.5s ease' }} />
      </div>
      <span className="text-xs font-semibold" style={{ color: '#64748B' }}>{label}</span>
    </div>
  );
}
