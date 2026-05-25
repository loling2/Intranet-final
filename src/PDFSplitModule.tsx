import { useState, useRef, useCallback } from 'react';
import {
  Upload, FileText, AlertCircle, RefreshCw, X,
  ChevronLeft, ChevronRight, Loader2, CheckCircle2,
  Eye, Trash2, Download, Search, Calendar, User, Info
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { uploadBytesToWasabi, downloadFromWasabi } from './lib/wasabi';
import { supabase } from './supabaseClient';
import { writeAuditLog } from './lib/auditLog';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';

pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageInfo {
  pageNum: number;
  dataUrl: string;
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
  // Matches DNI (8 digits + letter) and NIE (X/Y/Z + 7 digits + letter)
  const match = text.match(/\b([XYZxyz]?\d{7,8}[A-Za-z])\b/);
  if (!match) return null;
  return match[1].toUpperCase();
}

function extractAnio(text: string): number | null {
  const match = text.match(/\b(20\d{2})\b/);
  return match ? parseInt(match[1]) : null;
}

function extractMes(text: string): { mes: number; nombre: string } | null {
  const lower = text.toLowerCase();
  // Try "mes/año" pattern like "03/2024" or "3/2024"
  const numMatch = lower.match(/\b(0?[1-9]|1[0-2])[/\-](20\d{2})\b/);
  if (numMatch) {
    const m = parseInt(numMatch[1]);
    return { mes: m, nombre: MES_NOMBRES[m] };
  }
  // Try named month
  for (const [name, num] of Object.entries(MESES)) {
    if (lower.includes(name)) {
      return { mes: num, nombre: MES_NOMBRES[num] };
    }
  }
  return null;
}

// Extracts a single-page PDF as Uint8Array using pdfjs rendered to canvas then re-encoded
// We use the PDF copy approach: copy the original bytes for the specific page range
// Since pdf-lib isn't available, we store the rendered page as a PDF-wrapped image
async function renderPageToPdfBytes(page: pdfjsLib.PDFPageProxy): Promise<Uint8Array> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;

  // Convert canvas to PNG blob, then wrap in a minimal PDF
  const pngDataUrl = canvas.toDataURL('image/jpeg', 0.92);
  const base64 = pngDataUrl.split(',')[1];
  const imgBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));

  // Build a minimal PDF with the image embedded
  const w = Math.round(viewport.width / 2);  // back to pt (96dpi → 72pt ratio ~0.75)
  const h = Math.round(viewport.height / 2);
  const pdfBytes = buildMinimalPDF(imgBytes, w, h);
  return pdfBytes;
}

function buildMinimalPDF(jpegBytes: Uint8Array, widthPx: number, heightPx: number): Uint8Array {
  const encoder = new TextEncoder();

  const imageObj = jpegBytes;
  const imageLen = imageObj.length;

  // PDF structure
  const header = '%PDF-1.4\n';
  const obj1 = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  const obj2 = `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`;
  const obj3 = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPx} ${heightPx}] /Contents 4 0 R /Resources << /XObject << /Im1 5 0 R >> >> >>\nendobj\n`;
  const streamContent = `q\n${widthPx} 0 0 ${heightPx} 0 0 cm\n/Im1 Do\nQ\n`;
  const obj4 = `4 0 obj\n<< /Length ${streamContent.length} >>\nstream\n${streamContent}\nendstream\nendobj\n`;
  const obj5Header = `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${widthPx} /Height ${heightPx} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageLen} >>\nstream\n`;
  const obj5Footer = '\nendstream\nendobj\n';

  const parts: (string | Uint8Array)[] = [header, obj1, obj2, obj3, obj4, obj5Header];
  let offset = 0;
  const offsets: number[] = [];

  // Calculate cross-reference offsets
  const headerBytes = encoder.encode(header);
  const obj1Bytes = encoder.encode(obj1);
  const obj2Bytes = encoder.encode(obj2);
  const obj3Bytes = encoder.encode(obj3);
  const obj4Bytes = encoder.encode(obj4);
  const obj5HeaderBytes = encoder.encode(obj5Header);
  const obj5FooterBytes = encoder.encode(obj5Footer);

  offsets[1] = headerBytes.length;
  offsets[2] = offsets[1] + obj1Bytes.length;
  offsets[3] = offsets[2] + obj2Bytes.length;
  offsets[4] = offsets[3] + obj3Bytes.length;
  offsets[5] = offsets[4] + obj4Bytes.length;

  const xrefOffset = offsets[5] + obj5HeaderBytes.length + imageLen + obj5FooterBytes.length;

  const xref = `xref\n0 6\n0000000000 65535 f \n${String(offsets[1]).padStart(10, '0')} 00000 n \n${String(offsets[2]).padStart(10, '0')} 00000 n \n${String(offsets[3]).padStart(10, '0')} 00000 n \n${String(offsets[4]).padStart(10, '0')} 00000 n \n${String(offsets[5]).padStart(10, '0')} 00000 n \n`;
  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  // Assemble all parts into a single Uint8Array
  const allParts: Uint8Array[] = [
    headerBytes, obj1Bytes, obj2Bytes, obj3Bytes, obj4Bytes,
    obj5HeaderBytes, imageObj, obj5FooterBytes,
    encoder.encode(xref), encoder.encode(trailer),
  ];
  const totalLen = allParts.reduce((s, p) => s + p.length, 0);
  const result = new Uint8Array(totalLen);
  offset = 0;
  for (const p of allParts) {
    result.set(p, offset);
    offset += p.length;
  }
  return result;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PDFSplitModule() {
  const { profile } = useAuth();
  const { activeSocietyId } = useSociety();

  // Upload state
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [rawPdf, setRawPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [separating, setSeparating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // List state
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

  // Handle PDF file selection
  const handleFileSelect = async (file: File) => {
    if (!file.type.includes('pdf')) {
      setError('Por favor selecciona un archivo PDF');
      return;
    }
    setError('');
    setPdfFile(file);
    setLoading(true);
    setPages([]);
    setCurrentPageIndex(0);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setRawPdf(pdf);
      const extractedPages: PageInfo[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);

        // Render preview
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

        // Extract text for DNI/año/mes detection
        const textContent = await page.getTextContent();
        const text = textContent.items.map((item) => ('str' in item ? item.str : '')).join(' ');

        const dni = extractDNI(text);
        const anio = extractAnio(text);
        const mesInfo = extractMes(text);

        extractedPages.push({
          pageNum: i,
          dataUrl,
          text,
          dni,
          anio,
          mes: mesInfo?.mes ?? null,
          mesNombre: mesInfo?.nombre ?? null,
        });
      }

      setPages(extractedPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFileSelect(files[0]);
  };

  const reset = () => {
    setPdfFile(null);
    setPages([]);
    setRawPdf(null);
    setCurrentPageIndex(0);
    setUploadProgress(0);
    setError('');
  };

  const flashSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  };

  // Separate and upload
  const handleSeparate = async () => {
    if (!pages.length || !pdfFile || !profile || !rawPdf) return;
    setSeparating(true);
    setError('');
    let uploaded = 0;
    let skipped = 0;

    try {
      for (const pageInfo of pages) {
        const { dni, anio, mes, pageNum } = pageInfo;

        if (!dni || !anio || !mes) {
          skipped++;
          uploaded++;
          setUploadProgress(Math.round((uploaded / pages.length) * 100));
          continue;
        }

        // Render page to PDF bytes
        const page = await rawPdf.getPage(pageNum);
        const pdfBytes = await renderPageToPdfBytes(page);

        const safeDni = dni.replace(/[^A-Z0-9]/g, '');
        const wasabiKey = `rrhh/publico/${anio}/${String(mes).padStart(2, '0')}/${safeDni}-${String(mes).padStart(2, '0')}-${anio}.pdf`;
        const nombreArchivo = `${safeDni}-${String(mes).padStart(2, '0')}-${anio}.pdf`;

        await uploadBytesToWasabi(pdfBytes, wasabiKey, 'application/pdf');

        await supabase.from('nominas').insert({
          society_id: activeSocietyId ?? '',
          dni: safeDni,
          anio,
          mes,
          wasabi_key: wasabiKey,
          nombre_archivo: nombreArchivo,
          tamano_bytes: pdfBytes.byteLength,
          subido_por: profile.id,
          subido_por_nombre: profile.nombre,
          pdf_origen: pdfFile.name,
        });

        uploaded++;
        setUploadProgress(Math.round((uploaded / pages.length) * 100));
      }

      await writeAuditLog({
        evento: 'nominas_separated',
        descripcion: `Nóminas separadas: ${uploaded - skipped} procesadas, ${skipped} sin DNI/fecha`,
        autor: profile,
        entidad: 'nomina',
        metadata: { archivo_original: pdfFile.name, total_paginas: pages.length, skipped },
        society_id: activeSocietyId,
      });

      flashSuccess(`${uploaded - skipped} nominas subidas correctamente${skipped > 0 ? ` (${skipped} paginas sin DNI/fecha ignoradas)` : ''}.`);
      reset();
      setTab('list');
      await loadNominas();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al separar PDF');
    } finally {
      setSeparating(false);
    }
  };

  // Delete nomina
  const handleDelete = async (id: string, key: string) => {
    setDeletingId(id);
    try {
      await supabase.from('nominas').delete().eq('id', id);
      setNominas((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // ignore
    }
    setDeletingId(null);
    setConfirmDeleteId(null);
  };

  const currentPage = pages[currentPageIndex];

  const filteredNominas = nominas.filter((n) => {
    if (listSearch && !n.dni.toLowerCase().includes(listSearch.toLowerCase())) return false;
    if (filterAnio && String(n.anio) !== filterAnio) return false;
    if (filterMes && String(n.mes) !== filterMes) return false;
    return true;
  });

  const aniosDisponibles = [...new Set(nominas.map((n) => n.anio))].sort((a, b) => b - a);

  // Detected info summary
  const detected = pages.filter((p) => p.dni && p.anio && p.mes).length;
  const undetected = pages.length - detected;

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
                  Se subira a rrhh/privado y se separara automaticamente por DNI
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
                    <span>{detected} detectadas</span>
                  </div>
                  {undetected > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg" style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A' }}>
                      <Info size={12} style={{ color: '#D97706', flexShrink: 0, marginTop: 1 }} />
                      <p className="text-xs" style={{ color: '#92400E' }}>
                        {undetected} pagina{undetected > 1 ? 's' : ''} sin DNI/fecha — se ignoraran al separar
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
              <div className="flex items-center justify-center gap-2 py-4">
                <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
                <span className="text-xs" style={{ color: '#94A3B8' }}>Analizando PDF...</span>
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
                    Procesando... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Separar y subir {detected} nominas
                  </>
                )}
              </button>
            )}

            {separating && (
              <div className="w-full rounded-full overflow-hidden" style={{ backgroundColor: '#E2E8F0', height: 6 }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%`, backgroundColor: '#0F172A' }}
                />
              </div>
            )}
          </div>

          {/* Right panel: Preview + page data */}
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

                {/* Image */}
                <div className="p-4 flex items-center justify-center min-h-64 max-h-[500px] overflow-hidden" style={{ backgroundColor: '#F1F5F9' }}>
                  {currentPage && (
                    <img
                      src={currentPage.dataUrl}
                      alt={`Pagina ${currentPage.pageNum}`}
                      className="max-w-full max-h-[460px] object-contain rounded shadow-sm"
                    />
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
          {/* Filters */}
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
                          onClick={() => handleDelete(n.id, n.wasabi_key)}
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
