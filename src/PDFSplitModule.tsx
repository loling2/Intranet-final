import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, AlertCircle, RefreshCw, X,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  Trash2, Download, Search, Calendar, User, Info
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument, PDFName } from 'pdf-lib';
import { uploadBytesToWasabi, downloadFromWasabi } from './lib/wasabi';
import { supabase } from './supabaseClient';
import { writeAuditLog } from './lib/auditLog';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageInfo {
  pageNum: number;
  text: string;
  dni: string | null;
  anio: number | null;
  mes: number | null;
  mesNombre: string | null;
}

interface NominaRecord {
  id: string;
  dni: string;
  anio: number;
  mes: number;
  wasabi_key: string;
  nombre_archivo: string;
  tamano_bytes: number;
  subido_por_nombre: string;
  pdf_origen: string;
  created_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MESES: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  ene: 1, feb: 2, mar: 3, abr: 4, jun: 6, jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12,
};

const MES_NOMBRES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function extractDNI(text: string): string | null {
  const match = text.match(/\b([XYZxyz]?\d{7,8}[A-Za-z])\b/);
  if (!match) return null;
  return match[1].toUpperCase();
}

function extractMesAnio(text: string): { mes: number; nombre: string; anio: number } | null {
  const lower = text.toLowerCase();

  const periodoMatch = lower.match(
    /mensual\s*-\s*\d+\s+([a-záéíóúü]+)\s+(20\d{2})\s+a\s+\d+\s+([a-záéíóúü]+)\s+(20\d{2})/
  );
  if (periodoMatch) {
    const mesNombre = periodoMatch[1];
    const anio = parseInt(periodoMatch[4]);
    const endMes = periodoMatch[3];
    const num = MESES[endMes] ?? MESES[mesNombre];
    if (num) return { mes: num, nombre: MES_NOMBRES[num], anio };
  }

  const mesAnioMatches = [...lower.matchAll(/\b([a-záéíóúü]+)\s+(20\d{2})\b/g)];
  let best: { mes: number; nombre: string; anio: number } | null = null;
  for (const m of mesAnioMatches) {
    const num = MESES[m[1]];
    if (!num) continue;
    const anio = parseInt(m[2]);
    if (!best || anio > best.anio || (anio === best.anio && num > best.mes)) {
      best = { mes: num, nombre: MES_NOMBRES[num], anio };
    }
  }
  if (best) return best;

  const numMatches = [...lower.matchAll(/\b(0?[1-9]|1[0-2])[/\-](20\d{2})\b/g)];
  let bestNum: { mes: number; nombre: string; anio: number } | null = null;
  for (const m of numMatches) {
    const mes = parseInt(m[1]);
    const anio = parseInt(m[2]);
    if (!bestNum || anio > bestNum.anio) {
      bestNum = { mes, nombre: MES_NOMBRES[mes], anio };
    }
  }
  return bestNum;
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

async function mergePageBytes(srcBytes: Uint8Array, pageIndexes: number[]): Promise<Uint8Array> {
  const src = await PDFDocument.load(srcBytes, { ignoreEncryption: true });
  const dest = await PDFDocument.create();
  const copied = await dest.copyPages(src, pageIndexes);
  for (const page of copied) {
    dest.addPage(page);
    const node = page.node;
    node.delete(PDFName.of('CropBox'));
    node.delete(PDFName.of('BleedBox'));
    node.delete(PDFName.of('TrimBox'));
    node.delete(PDFName.of('ArtBox'));
  }
  return dest.save();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFSplitModule() {
  const { profile } = useAuth();
  const { activeSocietyId } = useSociety();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [separating, setSeparating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ step: '', done: 0, total: 0 });
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const [tab, setTab] = useState<'upload' | 'list'>('upload');
  const [nominas, setNominas] = useState<NominaRecord[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listSearch, setListSearch] = useState('');
  const [filterAnio, setFilterAnio] = useState('');
  const [filterMes, setFilterMes] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadNominas = useCallback(async () => {
    setListLoading(true);
    const { data } = await supabase
      .from('nominas')
      .select('*')
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .order('dni');
    setNominas(data ?? []);
    setListLoading(false);
  }, []);

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('Por favor selecciona un archivo PDF');
      return;
    }
    abortRef.current = true;
    await yieldToMain();
    abortRef.current = false;

    setError('');
    setPdfFile(file);
    setPdfBytes(null);
    setLoading(true);
    setLoadProgress(0);
    setPages([]);
    setCurrentPageIndex(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      setPdfBytes(bytes);

      // Use a separate copy for pdfjs text extraction (worker may transfer it)
      const bytesForScan = new Uint8Array(arrayBuffer.slice(0));
      const pdf = await pdfjsLib.getDocument({ data: bytesForScan }).promise;
      const total = pdf.numPages;
      const extractedPages: PageInfo[] = [];

      // TEXT-ONLY scan — no canvas rendering, no DOM interaction
      for (let i = 1; i <= total; i++) {
        if (abortRef.current) break;

        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');
        page.cleanup();

        const dni = extractDNI(text);
        const periodoInfo = extractMesAnio(text);

        extractedPages.push({
          pageNum: i,
          text,
          dni,
          anio: periodoInfo?.anio ?? null,
          mes: periodoInfo?.mes ?? null,
          mesNombre: periodoInfo?.nombre ?? null,
        });

        // Update progress every 5 pages to reduce re-renders
        if (i % 5 === 0 || i === total) {
          setLoadProgress(Math.round((i / total) * 100));
          await yieldToMain();
        }
      }

      if (!abortRef.current) setPages(extractedPages);
    } catch (err) {
      if (!abortRef.current) {
        setError(err instanceof Error ? err.message : 'Error al procesar PDF');
      }
    } finally {
      if (!abortRef.current) {
        setLoading(false);
        setLoadProgress(0);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const reset = () => {
    abortRef.current = true;
    setPdfFile(null);
    setPdfBytes(null);
    setPages([]);
    setCurrentPageIndex(0);
    setUploadProgress({ step: '', done: 0, total: 0 });
    setLoading(false);
    setLoadProgress(0);
    setError('');
  };

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 6000);
  };

  // ── Atomic upload: group pages by employee, merge, then upload ───────────────
  const handleSeparate = async () => {
    if (!pages.length || !pdfFile || !profile || !pdfBytes) return;
    setSeparating(true);
    setError('');

    const validPages = pages.filter((p) => p.dni && p.anio && p.mes);
    const skipped = pages.length - validPages.length;

    try {
      // Phase 1: Group pages by (dni, anio, mes) preserving document order
      setUploadProgress({ step: 'Agrupando paginas por empleado...', done: 0, total: validPages.length });
      const groups = new Map<string, { pageInfo: PageInfo; pageIndexes: number[] }>();

      for (let i = 0; i < validPages.length; i++) {
        const pageInfo = validPages[i];
        const safeDni = pageInfo.dni!.replace(/[^A-Z0-9]/g, '');
        const key = `${safeDni}|${pageInfo.anio}|${pageInfo.mes}`;
        if (!groups.has(key)) {
          groups.set(key, { pageInfo: { ...pageInfo, dni: safeDni }, pageIndexes: [] });
        }
        groups.get(key)!.pageIndexes.push(pageInfo.pageNum - 1);
        setUploadProgress({ step: 'Agrupando paginas por empleado...', done: i + 1, total: validPages.length });
        if ((i + 1) % 10 === 0) await yieldToMain();
      }

      // Phase 2: Merge pages per group into a single PDF
      setUploadProgress({ step: 'Generando PDFs por empleado...', done: 0, total: groups.size });
      type MergedEntry = { pageInfo: PageInfo; bytes: Uint8Array; wasabiKey: string; nombreArchivo: string; numPaginas: number };
      const merged: MergedEntry[] = [];
      let gi = 0;

      for (const [, { pageInfo, pageIndexes }] of groups) {
        const { dni, anio, mes } = pageInfo;
        const mesStr = String(mes!).padStart(2, '0');
        const wasabiKey = `rrhh/publico/${anio}/${mesStr}/${dni}-${mesStr}-${anio}.pdf`;
        const nombreArchivo = `${dni}-${mesStr}-${anio}.pdf`;
        const bytes = await mergePageBytes(pdfBytes, pageIndexes);
        merged.push({ pageInfo, bytes, wasabiKey, nombreArchivo, numPaginas: pageIndexes.length });
        gi++;
        setUploadProgress({ step: 'Generando PDFs por empleado...', done: gi, total: groups.size });
        if (gi % 5 === 0) await yieldToMain();
      }

      // Phase 3: Upload merged PDFs to Wasabi
      setUploadProgress({ step: 'Subiendo a Wasabi...', done: 0, total: merged.length });
      for (let i = 0; i < merged.length; i++) {
        const { bytes, wasabiKey } = merged[i];
        await uploadBytesToWasabi(bytes, wasabiKey, 'application/pdf');
        setUploadProgress({ step: 'Subiendo a Wasabi...', done: i + 1, total: merged.length });
        if ((i + 1) % 5 === 0) await yieldToMain();
      }

      // Phase 4: Save one DB record per employee-month
      setUploadProgress({ step: 'Guardando en base de datos...', done: 0, total: merged.length });
      const now = new Date().toISOString();
      for (let i = 0; i < merged.length; i++) {
        const { pageInfo, bytes, wasabiKey, nombreArchivo } = merged[i];
        const { error: dbError } = await supabase.from('nominas').upsert(
          {
            society_id: activeSocietyId ?? '',
            dni: pageInfo.dni!,
            anio: pageInfo.anio!,
            mes: pageInfo.mes!,
            wasabi_key: wasabiKey,
            nombre_archivo: nombreArchivo,
            tamano_bytes: bytes.byteLength,
            subido_por: profile.id,
            subido_por_nombre: profile.nombre,
            pdf_origen: pdfFile.name,
            created_at: now,
          },
          { onConflict: 'society_id,dni,anio,mes' }
        );
        if (dbError) throw new Error(dbError.message);
        setUploadProgress({ step: 'Guardando en base de datos...', done: i + 1, total: merged.length });
      }

      setUploadProgress({ step: '', done: merged.length, total: merged.length });

      const multiPage = merged.filter((m) => m.numPaginas > 1).length;
      await writeAuditLog({
        evento: 'nominas_separated',
        descripcion: `Nominas separadas: ${merged.length} empleados (${multiPage} con nomina de varias hojas), ${skipped} sin DNI/fecha`,
        autor: profile,
        entidad: 'nomina',
        metadata: { archivo_original: pdfFile.name, total_paginas: pages.length, skipped, multi_page: multiPage },
        society_id: activeSocietyId,
      });

      const multiMsg = multiPage > 0 ? `, ${multiPage} con nomina multipagina` : '';
      flashSuccess(`${merged.length} nominas subidas${multiMsg}${skipped > 0 ? ` (${skipped} paginas sin DNI/fecha ignoradas)` : ''}.`);
      reset();
      setTab('list');
      await loadNominas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al separar PDF');
    } finally {
      setSeparating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await supabase.from('nominas').delete().eq('id', id);
      setNominas((prev) => prev.filter((n) => n.id !== id));
    } catch { /* ignore */ }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const currentPage = pages[currentPageIndex];
  const detected = pages.filter((p) => p.dni && p.anio && p.mes).length;
  const undetected = pages.length - detected;
  const uniqueEmployees = new Set(
    pages.filter((p) => p.dni && p.anio && p.mes)
      .map((p) => `${p.dni!.replace(/[^A-Z0-9]/g, '')}|${p.anio}|${p.mes}`)
  ).size;

  const filteredNominas = nominas.filter((n) => {
    if (listSearch && !n.dni.toLowerCase().includes(listSearch.toLowerCase())) return false;
    if (filterAnio && String(n.anio) !== filterAnio) return false;
    if (filterMes && String(n.mes) !== filterMes) return false;
    return true;
  });

  const aniosDisponibles = [...new Set(nominas.map((n) => n.anio))].sort((a, b) => b - a);

  const uploadPct = uploadProgress.total > 0
    ? Math.round((uploadProgress.done / uploadProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>Nominas</h2>
          <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
            Sube un PDF masivo — se separa por trabajador y se organiza automaticamente
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setTab('upload')}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer"
            style={{
              backgroundColor: tab === 'upload' ? '#0F172A' : '#F1F5F9',
              color: tab === 'upload' ? '#FFFFFF' : '#64748B',
            }}
          >
            Subir PDF
          </button>
          <button
            onClick={() => { setTab('list'); loadNominas(); }}
            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer"
            style={{
              backgroundColor: tab === 'list' ? '#0F172A' : '#F1F5F9',
              color: tab === 'list' ? '#FFFFFF' : '#64748B',
            }}
          >
            Nominas ({nominas.length || '...'})
          </button>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <CheckCircle2 size={15} style={{ color: '#16A34A' }} />
          <p className="text-sm" style={{ color: '#15803D' }}>{success}</p>
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {tab === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left panel */}
          <div className="lg:col-span-1 space-y-4">
            {!pdfFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className="flex flex-col items-center justify-center py-12 rounded-2xl cursor-pointer transition-all duration-200"
                style={{
                  border: `2px dashed ${dragging ? '#0F172A' : '#CBD5E1'}`,
                  backgroundColor: dragging ? '#F8FAFC' : 'transparent',
                }}
              >
                <input ref={fileRef} type="file" accept=".pdf" className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])} />
                <Upload size={28} style={{ color: '#94A3B8' }} />
                <p className="text-sm font-medium mt-3" style={{ color: '#1E293B' }}>Arrastra el PDF de nominas</p>
                <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>o haz clic para seleccionar</p>
                <p className="text-xs mt-3 px-4 text-center" style={{ color: '#CBD5E1' }}>
                  Soporta PDFs masivos con cientos de nominas
                </p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="px-4 py-3 flex items-center justify-between" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={15} style={{ color: '#0369A1', flexShrink: 0 }} />
                    <span className="text-sm font-medium truncate" style={{ color: '#1E293B' }}>{pdfFile.name}</span>
                  </div>
                  <button onClick={reset} className="cursor-pointer ml-2 flex-shrink-0" style={{ color: '#94A3B8' }}>
                    <X size={14} />
                  </button>
                </div>
                <div className="px-4 py-3 space-y-2">
                  <div className="flex justify-between text-xs" style={{ color: '#64748B' }}>
                    <span>{pages.length} paginas totales</span>
                    <span>{detected} detectadas · <strong>{uniqueEmployees} empleados</strong></span>
                  </div>
                  {detected > uniqueEmployees && (
                    <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                      <Info size={12} style={{ color: '#1D4ED8', flexShrink: 0, marginTop: 1 }} />
                      <p className="text-xs" style={{ color: '#1E40AF' }}>
                        {detected - uniqueEmployees} paginas se agruparan con otra hoja del mismo empleado
                      </p>
                    </div>
                  )}
                  {undetected > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <Info size={12} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                      <p className="text-xs" style={{ color: '#92400E' }}>
                        {undetected} pagina{undetected > 1 ? 's' : ''} sin DNI/fecha — se ignoraran
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 rounded-xl flex items-start gap-2" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}>
                <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
                <p className="text-xs" style={{ color: '#DC2626' }}>{error}</p>
              </div>
            )}

            {loading && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <RefreshCw size={14} className="animate-spin" style={{ color: '#94A3B8' }} />
                  <span className="text-xs" style={{ color: '#94A3B8' }}>
                    Analizando paginas... {loadProgress}%
                  </span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0', height: 4 }}>
                  <div
                    className="h-full rounded-full transition-all duration-200"
                    style={{ width: `${loadProgress}%`, backgroundColor: '#0F172A' }}
                  />
                </div>
              </div>
            )}

            {pages.length > 0 && !loading && (
              <button
                onClick={handleSeparate}
                disabled={separating || detected === 0}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 transition-all"
                style={{ backgroundColor: '#0F172A' }}
              >
                {separating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {uploadProgress.step || 'Procesando...'} {uploadPct}%
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Separar y subir {uniqueEmployees} nominas
                  </>
                )}
              </button>
            )}

            {separating && (
              <div className="space-y-1.5">
                <div className="w-full rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0', height: 6 }}>
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{ width: `${uploadPct}%`, backgroundColor: '#0F172A' }}
                  />
                </div>
                <p className="text-xs text-center" style={{ color: '#94A3B8' }}>
                  {uploadProgress.step} ({uploadProgress.done}/{uploadProgress.total})
                </p>
              </div>
            )}
          </div>

          {/* Right panel: Preview + page list */}
          {pages.length > 0 && !loading && (
            <div className="lg:col-span-2 space-y-3">
              <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                {/* Page info bar */}
                <div className="px-4 py-3 flex items-center gap-4" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <div className="flex items-center gap-1.5">
                    <User size={12} style={{ color: currentPage?.dni ? '#16A34A' : '#DC2626' }} />
                    <span className="text-xs font-mono font-semibold" style={{ color: currentPage?.dni ? '#15803D' : '#DC2626' }}>
                      {currentPage?.dni ?? 'DNI no detectado'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} style={{ color: currentPage?.anio ? '#0369A1' : '#94A3B8' }} />
                    <span className="text-xs" style={{ color: currentPage?.anio ? '#0369A1' : '#94A3B8' }}>
                      {currentPage?.mesNombre ?? '?'} {currentPage?.anio ?? '?'}
                    </span>
                  </div>
                  <span className="text-xs ml-auto" style={{ color: '#94A3B8' }}>
                    Pagina {currentPageIndex + 1} / {pages.length}
                  </span>
                </div>

                {/* Text-based page info (no canvas rendering) */}
                <div className="p-6 space-y-4" style={{ backgroundColor: '#F8FAFC', minHeight: 200 }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl p-4" style={{ backgroundColor: currentPage?.dni ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${currentPage?.dni ? '#BBF7D0' : '#FECACA'}` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: currentPage?.dni ? '#166534' : '#991B1B' }}>DNI / NIE</p>
                      <p className="text-lg font-mono font-bold" style={{ color: currentPage?.dni ? '#15803D' : '#DC2626' }}>
                        {currentPage?.dni ?? 'No detectado'}
                      </p>
                    </div>
                    <div className="rounded-xl p-4" style={{ backgroundColor: currentPage?.anio ? '#EFF6FF' : '#F8FAFC', border: `1px solid ${currentPage?.anio ? '#BFDBFE' : '#E2E8F0'}` }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: currentPage?.anio ? '#1E40AF' : '#64748B' }}>Periodo</p>
                      <p className="text-lg font-bold" style={{ color: currentPage?.anio ? '#1D4ED8' : '#94A3B8' }}>
                        {currentPage?.mesNombre ?? '?'} {currentPage?.anio ?? '?'}
                      </p>
                    </div>
                  </div>
                  {currentPage && (
                    <div className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#64748B' }}>Texto extraido (primeras lineas)</p>
                      <p className="text-xs leading-relaxed line-clamp-4" style={{ color: '#475569', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                        {currentPage.text.slice(0, 400)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <div className="px-4 py-3 flex items-center justify-between" style={{ borderTop: '1px solid #E2E8F0' }}>
                  <button
                    onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                    disabled={currentPageIndex === 0}
                    className="px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-40 flex items-center gap-1"
                    style={{ backgroundColor: '#F1F5F9', color: '#0F172A' }}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <div className="flex gap-1">
                    {pages.slice(Math.max(0, currentPageIndex - 2), currentPageIndex + 3).map((p) => (
                      <button
                        key={p.pageNum}
                        onClick={() => setCurrentPageIndex(p.pageNum - 1)}
                        className="w-7 h-7 rounded-lg text-xs font-medium cursor-pointer transition-all"
                        style={{
                          backgroundColor: p.pageNum - 1 === currentPageIndex ? '#0F172A' : (p.dni ? '#F0FDF4' : '#FEF2F2'),
                          color: p.pageNum - 1 === currentPageIndex ? '#FFFFFF' : (p.dni ? '#15803D' : '#DC2626'),
                          border: `1px solid ${p.pageNum - 1 === currentPageIndex ? '#0F172A' : (p.dni ? '#BBF7D0' : '#FECACA')}`,
                        }}
                      >
                        {p.pageNum}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                    disabled={currentPageIndex === pages.length - 1}
                    className="px-3 py-1.5 rounded-lg text-sm cursor-pointer disabled:opacity-40 flex items-center gap-1"
                    style={{ backgroundColor: '#F1F5F9', color: '#0F172A' }}
                  >
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              </div>

              {/* Pages summary */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0' }}>
                <div className="px-4 py-2.5" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#64748B' }}>Resumen de paginas detectadas</p>
                </div>
                <div className="max-h-40 overflow-y-auto divide-y" style={{ borderColor: '#F1F5F9' }}>
                  {pages.map((p) => (
                    <button
                      key={p.pageNum}
                      onClick={() => setCurrentPageIndex(p.pageNum - 1)}
                      className="w-full px-4 py-2 flex items-center gap-3 text-left hover:bg-slate-50 transition-colors cursor-pointer"
                      style={{ backgroundColor: p.pageNum - 1 === currentPageIndex ? '#F8FAFC' : undefined }}
                    >
                      <span className="text-xs w-8 flex-shrink-0" style={{ color: '#94A3B8' }}>#{p.pageNum}</span>
                      <span className={`text-xs font-mono font-semibold flex-1 ${p.dni ? '' : 'opacity-40'}`} style={{ color: p.dni ? '#15803D' : '#DC2626' }}>
                        {p.dni ?? 'sin DNI'}
                      </span>
                      <span className="text-xs flex-shrink-0" style={{ color: '#94A3B8' }}>
                        {p.mesNombre} {p.anio}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── LIST TAB ── */}
      {tab === 'list' && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
          <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: '1px solid #F1F5F9', backgroundColor: '#F8FAFC' }}>
            <div className="relative flex-1 min-w-48">
              <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type="text"
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder="Buscar por DNI..."
                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
              />
            </div>
            <select
              value={filterAnio}
              onChange={(e) => setFilterAnio(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
            >
              <option value="">Todos los anos</option>
              {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <select
              value={filterMes}
              onChange={(e) => setFilterMes(e.target.value)}
              className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
              style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}
            >
              <option value="">Todos los meses</option>
              {MES_NOMBRES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <span className="text-xs ml-auto flex-shrink-0" style={{ color: '#94A3B8' }}>{filteredNominas.length} nominas</span>
          </div>

          {listLoading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin" style={{ color: '#94A3B8' }} />
            </div>
          ) : filteredNominas.length === 0 ? (
            <div className="flex flex-col items-center py-16">
              <FileText size={32} style={{ color: '#E2E8F0' }} />
              <p className="text-sm mt-3" style={{ color: '#94A3B8' }}>No hay nominas</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {filteredNominas.map((n) => (
                <div key={n.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
                    <FileText size={14} style={{ color: '#16A34A' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-mono font-bold" style={{ color: '#0F172A' }}>{n.dni}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                        {MES_NOMBRES[n.mes]} {n.anio}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: '#94A3B8' }}>
                      {n.pdf_origen} · {n.subido_por_nombre} · {(n.tamano_bytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => downloadFromWasabi(n.wasabi_key, n.nombre_archivo)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
                      title="Descargar"
                      style={{ color: '#CBD5E1' }}
                    >
                      <Download size={13} />
                    </button>
                    {confirmDeleteId === n.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs" style={{ color: '#DC2626' }}>Confirmar?</span>
                        <button
                          onClick={() => handleDelete(n.id)}
                          disabled={deletingId === n.id}
                          className="px-2 py-1 rounded-lg text-xs font-semibold text-white cursor-pointer"
                          style={{ backgroundColor: '#DC2626' }}
                        >
                          {deletingId === n.id ? <RefreshCw size={10} className="animate-spin" /> : 'Borrar'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-2 py-1 rounded-lg text-xs cursor-pointer"
                          style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}
                        >
                          No
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(n.id)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer hover:bg-red-50 transition-colors"
                        title="Eliminar"
                        style={{ color: '#CBD5E1' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
