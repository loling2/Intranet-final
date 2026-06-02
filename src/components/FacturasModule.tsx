import { useState, useRef, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Receipt, Upload, FileText, CheckCircle2, AlertCircle, X, Eye, Loader2, Building2, Hash, Calendar, Euro, Search, Filter, ChevronDown, Download, RefreshCw } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import { useSociety } from '../context/SocietyContext';
import { uploadToWasabi, downloadFromWasabi } from '../lib/wasabi';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href;

interface InvoiceData {
  proveedor: string;
  numero_factura: string;
  fecha_factura: string;
  importe: string;
  concepto: string;
}

interface SupplierInvoice {
  id: string;
  uploaded_by: string;
  sociedad_id: string;
  proveedor: string;
  numero_factura: string;
  fecha_factura: string | null;
  importe: number | null;
  concepto: string;
  wasabi_key: string;
  file_name: string;
  estado: string;
  notas: string;
  created_at: string;
  uploader?: { nombre: string; email: string };
}

// ─── PDF text extractor ───────────────────────────────────────────────────────
async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= Math.min(pdf.numPages, 3); i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: unknown) => (item as { str: string }).str).join(' ') + '\n';
  }
  return text;
}

// ─── Heuristic parser ─────────────────────────────────────────────────────────
function parseInvoiceFields(text: string): InvoiceData {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ');

  // Número de factura
  const numMatch = text.match(/(?:factura|invoice|fra\.?|n[uú]m(?:ero)?\.?)\s*[:#.\-]?\s*([A-Z0-9\/\-]{3,20})/i);
  const numero_factura = numMatch ? clean(numMatch[1]) : '';

  // Fecha
  const dateMatch = text.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  let fecha_factura = '';
  if (dateMatch) {
    const [, d, m, y] = dateMatch;
    const year = y.length === 2 ? '20' + y : y;
    fecha_factura = `${year}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Importe total
  const importeMatch = text.match(/(?:total|importe|amount|base\s+imponible)[^\d]*(\d[\d.,]+\s*€?)/i)
    || text.match(/(\d[\d.,]+)\s*€/);
  let importe = '';
  if (importeMatch) {
    importe = importeMatch[1].replace(/[€\s]/g, '').replace(',', '.');
    if (importe.includes('.') && importe.split('.').length > 2) {
      importe = importe.replace('.', '').replace(',', '.');
    }
  }

  // Proveedor — first meaningful line or after "de:" / "emisor"
  const provMatch = text.match(/(?:(?:de|from|emisor|proveedor|empresa)\s*[:\-]?\s*)([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s,\.]{3,60})/i)
    || text.match(/^([A-ZÁÉÍÓÚÑ][A-Za-záéíóúñ\s,\.S\.L\.]{4,60})/m);
  const proveedor = provMatch ? clean(provMatch[1]).slice(0, 80) : '';

  // Concepto — description lines
  const conceptoMatch = text.match(/(?:concepto|descripci[oó]n|services?)[^\n]*\n([^\n]{5,100})/i);
  const concepto = conceptoMatch ? clean(conceptoMatch[1]).slice(0, 120) : '';

  return { proveedor, numero_factura, fecha_factura, importe, concepto };
}

// ─── Upload step ──────────────────────────────────────────────────────────────
function UploadStep({ onParsed }: { onParsed: (file: File, data: InvoiceData) => void }) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
      setError('Solo se admiten archivos PDF.');
      return;
    }
    setParsing(true);
    setError('');
    try {
      const text = await extractPdfText(file);
      const data = parseInvoiceFields(text);
      onParsed(file, data);
    } catch {
      setError('No se pudo leer el PDF. Intenta de nuevo.');
    } finally {
      setParsing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
        onClick={() => inputRef.current?.click()}
        className="relative flex flex-col items-center justify-center gap-4 p-12 rounded-2xl cursor-pointer transition-all duration-200"
        style={{
          border: `2px dashed ${dragging ? '#0369A1' : '#CBD5E1'}`,
          backgroundColor: dragging ? '#EFF6FF' : '#F8FAFC',
        }}
      >
        {parsing ? (
          <>
            <Loader2 size={40} className="animate-spin" style={{ color: '#0369A1' }} />
            <p className="text-sm font-medium" style={{ color: '#0369A1' }}>Leyendo factura...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <Upload size={28} style={{ color: '#0369A1' }} />
            </div>
            <div className="text-center">
              <p className="font-semibold text-sm" style={{ color: '#1E293B' }}>Arrastra el PDF aquí o haz clic para seleccionar</p>
              <p className="text-xs mt-1" style={{ color: '#94A3B8' }}>Solo archivos .pdf — el sistema leerá los datos automáticamente</p>
            </div>
          </>
        )}
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
      </div>
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}
    </div>
  );
}

// ─── Confirm step ─────────────────────────────────────────────────────────────
function ConfirmStep({ file, data, onConfirm, onBack, saving }: {
  file: File;
  data: InvoiceData;
  onConfirm: (d: InvoiceData) => void;
  onBack: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<InvoiceData>(data);
  const f = (k: keyof InvoiceData, v: string) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 p-4 rounded-xl" style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
        <FileText size={18} style={{ color: '#16A34A' }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate" style={{ color: '#15803D' }}>{file.name}</p>
          <p className="text-xs" style={{ color: '#94A3B8' }}>{(file.size / 1024).toFixed(0)} KB</p>
        </div>
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#94A3B8' }}>Datos detectados — revisa y corrige si es necesario</p>

      <div className="grid grid-cols-1 gap-4">
        {([
          { key: 'proveedor', label: 'Proveedor', icon: Building2, placeholder: 'Nombre del proveedor' },
          { key: 'numero_factura', label: 'Número de factura', icon: Hash, placeholder: 'Ej: FAC-2024-001' },
          { key: 'fecha_factura', label: 'Fecha', icon: Calendar, placeholder: '', type: 'date' },
          { key: 'importe', label: 'Importe (€)', icon: Euro, placeholder: 'Ej: 1250.00' },
          { key: 'concepto', label: 'Concepto', icon: FileText, placeholder: 'Descripción del servicio' },
        ] as { key: keyof InvoiceData; label: string; icon: React.FC<{ size?: number }>; placeholder: string; type?: string }[]).map(({ key, label, icon: Icon, placeholder, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium mb-1" style={{ color: '#475569' }}>{label}</label>
            <div className="relative">
              <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
              <input
                type={type ?? 'text'}
                value={form[key]}
                onChange={e => f(key, e.target.value)}
                placeholder={placeholder}
                className="w-full pl-8 pr-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="flex-1 py-2.5 rounded-xl text-sm cursor-pointer" style={{ backgroundColor: '#F1F5F9', color: '#475569' }}>
          Atrás
        </button>
        <button
          onClick={() => onConfirm(form)}
          disabled={saving || !form.proveedor}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold cursor-pointer disabled:opacity-60"
          style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
        >
          {saving ? <><Loader2 size={14} className="animate-spin" /> Enviando...</> : <><CheckCircle2 size={14} /> Confirmar envío</>}
        </button>
      </div>
    </div>
  );
}

// ─── Invoice row ──────────────────────────────────────────────────────────────
function InvoiceRow({ inv, isAdmin, onView }: { inv: SupplierInvoice; isAdmin: boolean; onView: (key: string) => void }) {
  const statusColors: Record<string, { bg: string; text: string }> = {
    pendiente: { bg: '#FFFBEB', text: '#D97706' },
    revisada: { bg: '#EFF6FF', text: '#2563EB' },
    aprobada: { bg: '#F0FDF4', text: '#16A34A' },
    rechazada: { bg: '#FEF2F2', text: '#DC2626' },
  };
  const sc = statusColors[inv.estado] ?? statusColors.pendiente;

  return (
    <div className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors" style={{ borderBottom: '1px solid #F1F5F9' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
        <Receipt size={16} style={{ color: '#0369A1' }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate" style={{ color: '#0F172A' }}>{inv.proveedor || '—'}</p>
        <p className="text-xs" style={{ color: '#94A3B8' }}>
          {inv.numero_factura && <span className="font-mono">{inv.numero_factura} · </span>}
          {inv.fecha_factura ? new Date(inv.fecha_factura).toLocaleDateString('es-ES') : 'Sin fecha'}
          {isAdmin && inv.uploader && <span> · {inv.uploader.nombre}</span>}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        {inv.importe != null && (
          <p className="text-sm font-bold" style={{ color: '#0F172A' }}>
            {inv.importe.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €
          </p>
        )}
        <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text }}>
          {inv.estado}
        </span>
      </div>
      <button
        onClick={() => onView(inv.wasabi_key)}
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-blue-50 transition-colors"
        title="Ver PDF"
      >
        <Eye size={15} style={{ color: '#0369A1' }} />
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  isAdmin?: boolean;
}

export default function FacturasModule({ isAdmin = false }: Props) {
  const { profile } = useAuth();
  const { activeSocietyId, societies } = useSociety();

  const [step, setStep] = useState<'list' | 'upload' | 'confirm' | 'done'>('list');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<InvoiceData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterEstado, setFilterEstado] = useState('');
  const [search, setSearch] = useState('');

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('supplier_invoices').select('*').order('created_at', { ascending: false });
    if (!isAdmin && profile?.id) q = q.eq('uploaded_by', profile.id);
    const { data } = await q;
    if (!data) { setLoading(false); return; }

    if (isAdmin) {
      const uploaderIds = [...new Set(data.map((i: SupplierInvoice) => i.uploaded_by))];
      const { data: profiles } = await supabase.from('user_profiles').select('id,nombre,email').in('id', uploaderIds);
      const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; nombre: string; email: string }) => [p.id, p]));
      setInvoices(data.map((i: SupplierInvoice) => ({ ...i, uploader: profileMap[i.uploaded_by] })));
    } else {
      setInvoices(data as SupplierInvoice[]);
    }
    setLoading(false);
  }, [isAdmin, profile?.id]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  async function handleConfirm(form: InvoiceData) {
    if (!pendingFile || !profile) return;
    setSaving(true);
    setSaveError('');
    try {
      const key = `facturas/${profile.id}/${Date.now()}_${pendingFile.name.replace(/\s+/g, '_')}`;
      await uploadToWasabi(pendingFile, key);

      const { error } = await supabase.from('supplier_invoices').insert({
        uploaded_by: profile.id,
        sociedad_id: activeSocietyId ?? '',
        proveedor: form.proveedor.trim(),
        numero_factura: form.numero_factura.trim(),
        fecha_factura: form.fecha_factura || null,
        importe: form.importe ? parseFloat(form.importe) : null,
        concepto: form.concepto.trim(),
        wasabi_key: key,
        file_name: pendingFile.name,
        estado: 'pendiente',
      });

      if (error) throw error;
      setStep('done');
      loadInvoices();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleViewPdf(key: string) {
    try {
      const url = await downloadFromWasabi(key);
      window.open(url, '_blank');
    } catch {
      alert('No se pudo abrir el PDF.');
    }
  }

  async function handleChangeEstado(id: string, estado: string) {
    await supabase.from('supplier_invoices').update({ estado, updated_at: new Date().toISOString() }).eq('id', id);
    loadInvoices();
  }

  const filtered = invoices.filter(i =>
    (!filterEstado || i.estado === filterEstado) &&
    (!search || i.proveedor.toLowerCase().includes(search.toLowerCase()) || i.numero_factura.toLowerCase().includes(search.toLowerCase()))
  );

  // ── list view ──
  if (step === 'list') {
    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
              <Receipt size={20} style={{ color: '#0369A1' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>
                {isAdmin ? 'Facturas recibidas' : 'Mis facturas'}
              </h2>
              <p className="text-xs" style={{ color: '#64748B' }}>{filtered.length} factura(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadInvoices} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:bg-slate-100">
              <RefreshCw size={14} style={{ color: '#64748B' }} />
            </button>
            {!isAdmin && (
              <button
                onClick={() => setStep('upload')}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer"
                style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}
              >
                <Upload size={14} /> Subir factura
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1" style={{ minWidth: '180px' }}>
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
            <input
              type="text" placeholder="Buscar proveedor, número..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded-xl text-xs outline-none"
              style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}
            />
          </div>
          <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs outline-none cursor-pointer"
            style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', color: '#1E293B' }}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="revisada">Revisada</option>
            <option value="aprobada">Aprobada</option>
            <option value="rechazada">Rechazada</option>
          </select>
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin" style={{ color: '#0369A1' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Receipt size={32} style={{ color: '#CBD5E1' }} />
              <p className="text-sm" style={{ color: '#94A3B8' }}>
                {isAdmin ? 'No hay facturas registradas' : 'Aún no has subido ninguna factura'}
              </p>
              {!isAdmin && (
                <button onClick={() => setStep('upload')} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium cursor-pointer"
                  style={{ backgroundColor: '#EFF6FF', color: '#0369A1' }}>
                  <Upload size={13} /> Subir primera factura
                </button>
              )}
            </div>
          ) : (
            filtered.map(inv => (
              <div key={inv.id}>
                <InvoiceRow inv={inv} isAdmin={isAdmin} onView={handleViewPdf} />
                {isAdmin && (
                  <div className="px-5 pb-3 flex items-center gap-2">
                    <span className="text-xs" style={{ color: '#94A3B8' }}>Cambiar estado:</span>
                    {['pendiente', 'revisada', 'aprobada', 'rechazada'].map(e => (
                      <button key={e} onClick={() => handleChangeEstado(inv.id, e)}
                        className="px-2 py-0.5 rounded-full text-xs cursor-pointer transition-opacity"
                        style={{
                          backgroundColor: inv.estado === e ? '#0369A1' : '#F1F5F9',
                          color: inv.estado === e ? '#FFFFFF' : '#475569',
                          opacity: inv.estado === e ? 1 : 0.7,
                        }}>
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── upload step ──
  if (step === 'upload') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => setStep('list')} className="w-8 h-8 flex items-center justify-center rounded-lg cursor-pointer hover:bg-slate-100">
            <X size={16} style={{ color: '#64748B' }} />
          </button>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Subir factura</h2>
            <p className="text-xs" style={{ color: '#64748B' }}>El sistema leerá los datos del PDF automáticamente</p>
          </div>
        </div>
        <UploadStep onParsed={(file, data) => { setPendingFile(file); setParsedData(data); setStep('confirm'); }} />
      </div>
    );
  }

  // ── confirm step ──
  if (step === 'confirm' && pendingFile && parsedData) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#EFF6FF' }}>
            <CheckCircle2 size={20} style={{ color: '#0369A1' }} />
          </div>
          <div>
            <h2 className="font-bold text-base" style={{ color: '#0F172A' }}>Confirmar factura</h2>
            <p className="text-xs" style={{ color: '#64748B' }}>Revisa los datos detectados y confirma el envío</p>
          </div>
        </div>
        {saveError && (
          <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            <AlertCircle size={14} /> {saveError}
          </div>
        )}
        <ConfirmStep file={pendingFile} data={parsedData} onConfirm={handleConfirm} onBack={() => setStep('upload')} saving={saving} />
      </div>
    );
  }

  // ── done step ──
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-5">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#F0FDF4' }}>
        <CheckCircle2 size={32} style={{ color: '#16A34A' }} />
      </div>
      <div className="text-center">
        <h3 className="font-bold text-lg" style={{ color: '#0F172A' }}>Factura enviada</h3>
        <p className="text-sm mt-1" style={{ color: '#64748B' }}>La factura ha sido registrada correctamente.</p>
      </div>
      <button onClick={() => { setStep('list'); setPendingFile(null); setParsedData(null); }}
        className="px-6 py-2.5 rounded-xl text-sm font-semibold cursor-pointer"
        style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
        Ver mis facturas
      </button>
    </div>
  );
}
