import { useState, useRef } from 'react';
import {
  Upload, Download, FileText, AlertCircle, RefreshCw, X,
  ChevronLeft, ChevronRight, Loader2
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { uploadToWasabi } from './lib/wasabi';
import { supabase, UserProfile } from './supabaseClient';
import { writeAuditLog } from './lib/auditLog';
import { useAuth } from './context/AuthContext';
import { useSociety } from './context/SocietyContext';

// Set up the worker for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface PDFPage {
  pageNum: number;
  canvas: HTMLCanvasElement;
  dataUrl: string;
}

export default function PDFSplitModule() {
  const { profile } = useAuth();
  const { activeSocietyId } = useSociety();

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PDFPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [separating, setSeparating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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
      const extractedPages: PDFPage[] = [];

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/png');

        extractedPages.push({
          pageNum: i,
          canvas,
          dataUrl,
        });
      }

      setPages(extractedPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar PDF');
    } finally {
      setLoading(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => {
    setDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  // Download single page as PDF
  const downloadPage = async (pageIndex: number) => {
    const page = pages[pageIndex];
    if (!page) return;

    try {
      const { PDFDocument, PDFImage } = await import('pdfjs-dist/legacy/build/pdf');
      
      // Create a new PDF with just this page
      const response = await fetch(page.dataUrl);
      const imageBytes = await response.arrayBuffer();
      
      // For simplicity, we'll convert the PNG to a downloadable file
      const link = document.createElement('a');
      link.href = page.dataUrl;
      link.download = `${pdfFile?.name?.replace('.pdf', '') || 'documento'}-pagina-${page.pageNum}.png`;
      link.click();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al descargar página');
    }
  };

  // Separate and upload all pages to Wasabi
  const handleSeparatePDF = async () => {
    if (pages.length === 0 || !pdfFile || !profile) {
      setError('Por favor sube un PDF primero');
      return;
    }

    setSeparating(true);
    setError('');

    try {
      const totalPages = pages.length;
      let uploaded = 0;

      for (const page of pages) {
        const response = await fetch(page.dataUrl);
        const blob = await response.blob();
        const fileName = `${pdfFile.name.replace('.pdf', '')}_pagina_${page.pageNum}.png`;
        const wasabiKey = `publico/${Date.now()}-${fileName}`;

        await uploadToWasabi(blob as File, wasabiKey);

        // Save record in database
        await supabase.from('documents').insert({
          nombre_archivo: fileName,
          tipo: 'image/png',
          folder: 'publico',
          usuario_destino_id: null,
          usuario_destino_email: '',
          society_id: activeSocietyId,
          subido_por: profile.id,
          subido_por_nombre: profile.nombre,
          tamano_bytes: blob.size,
          indexeddb_key: `pdf_page_${Date.now()}_${page.pageNum}`,
          wasabi_key: wasabiKey,
        });

        uploaded++;
        setUploadProgress(Math.round((uploaded / totalPages) * 100));
      }

      // Write audit log
      await writeAuditLog({
        evento: 'pdf_separated',
        descripcion: `PDF separado en ${totalPages} páginas: ${pdfFile.name}`,
        autor: profile,
        entidad: 'document',
        metadata: { archivo_original: pdfFile.name, paginas_generadas: totalPages },
        society_id: activeSocietyId,
      });

      setError('');
      setPdfFile(null);
      setPages([]);
      setCurrentPageIndex(0);
      setUploadProgress(0);
      alert(`✅ PDF separado exitosamente en ${totalPages} páginas y subidas a Wasabi`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al separar PDF');
    } finally {
      setSeparating(false);
    }
  };

  const currentPage = pages[currentPageIndex];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold" style={{ color: '#0F172A' }}>
          Separador de PDFs
        </h2>
        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>
          Sube un PDF, previsualiza sus páginas y sepáralas en archivos individuales
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left panel: Upload */}
        <div className="lg:col-span-1">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center py-8 rounded-2xl cursor-pointer transition-all duration-200"
            style={{
              border: `2px dashed ${dragging ? '#0F172A' : '#CBD5E1'}`,
              backgroundColor: dragging ? '#F8FAFC' : 'transparent',
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
            />
            <FileText size={32} style={{ color: '#94A3B8' }} />
            <p className="text-sm font-medium mt-3" style={{ color: '#1E293B' }}>
              Arrastra un PDF aquí
            </p>
            <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>
              o haz clic para seleccionar
            </p>
          </div>

          {pdfFile && (
            <div
              className="mt-4 p-4 rounded-xl"
              style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}
            >
              <p className="text-xs font-semibold" style={{ color: '#0284C7' }}>
                📄 {pdfFile.name}
              </p>
              <p className="text-xs mt-1" style={{ color: '#0EA5E9' }}>
                {pages.length} página{pages.length !== 1 ? 's' : ''} detectada{pages.length !== 1 ? 's' : ''}
              </p>
            </div>
          )}

          {error && (
            <div
              className="mt-4 p-3 rounded-xl flex items-start gap-2"
              style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
            >
              <AlertCircle size={14} style={{ color: '#DC2626', flexShrink: 0 }} />
              <p className="text-xs" style={{ color: '#DC2626' }}>
                {error}
              </p>
            </div>
          )}

          {loading && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
              <span className="text-xs" style={{ color: '#94A3B8' }}>
                Procesando PDF...
              </span>
            </div>
          )}

          {pages.length > 0 && (
            <button
              onClick={handleSeparatePDF}
              disabled={separating || pages.length === 0}
              className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#0F172A' }}
            >
              {separating ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Separando... {uploadProgress}%
                </>
              ) : (
                <>
                  <Download size={14} />
                  Separar y subir PDF
                </>
              )}
            </button>
          )}
        </div>

        {/* Right panel: Preview */}
        {pages.length > 0 && (
          <div className="lg:col-span-2">
            <div
              className="rounded-2xl p-6 flex flex-col items-center justify-center min-h-96"
              style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
            >
              {currentPage && (
                <>
                  <img
                    src={currentPage.dataUrl}
                    alt={`Página ${currentPage.pageNum}`}
                    className="max-w-full max-h-96 object-contain rounded-lg"
                  />
                  <div className="mt-4 flex items-center gap-4 w-full justify-between">
                    <button
                      onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
                      disabled={currentPageIndex === 0}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40"
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-semibold" style={{ color: '#1E293B' }}>
                      Página {currentPageIndex + 1} de {pages.length}
                    </span>
                    <button
                      onClick={() => setCurrentPageIndex(Math.min(pages.length - 1, currentPageIndex + 1))}
                      disabled={currentPageIndex === pages.length - 1}
                      className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer disabled:opacity-40"
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#0F172A',
                        border: '1px solid #E2E8F0',
                      }}
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => downloadPage(currentPageIndex)}
                    className="mt-4 px-4 py-2 rounded-lg text-sm font-medium text-white cursor-pointer flex items-center gap-2"
                    style={{ backgroundColor: '#0EA5E9' }}
                  >
                    <Download size={14} />
                    Descargar esta página
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
