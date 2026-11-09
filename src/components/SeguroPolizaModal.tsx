import { useState } from 'react';
import { FileText, Upload, Eye, Download, RefreshCw, X, AlertCircle } from 'lucide-react';
import { supabase, type Seguro } from '../supabaseClient';
import { uploadPolizaPdf, downloadFromWasabi, getWasabiBlob } from '../lib/wasabi';

const polizaFileName = (key: string) => (key.split('/').pop() ?? key).replace(/^\d+-/, '');

interface SeguroPolizaModalProps {
  seguro: Seguro;
  onClose: () => void;
  onChanged: () => void;
}

export default function SeguroPolizaModal({ seguro, onClose, onChanged }: SeguroPolizaModalProps) {
  const [documentoKey, setDocumentoKey] = useState<string | null>(seguro.documento_key);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<'upload' | 'ver' | 'descargar' | null>(null);
  const [error, setError] = useState('');

  const handleUpload = async () => {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setError('Solo se admiten archivos PDF');
      return;
    }
    setBusy('upload');
    setError('');
    try {
      const key = await uploadPolizaPdf(file, seguro.numero_poliza);
      const { error: err } = await supabase.from('seguros').update({ documento_key: key }).eq('id', seguro.id);
      if (err) throw err;
      setDocumentoKey(key);
      setFile(null);
      onChanged();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al subir la poliza');
    } finally {
      setBusy(null);
    }
  };

  const handleVer = async () => {
    if (!documentoKey) return;
    const win = window.open('', '_blank');
    setBusy('ver');
    setError('');
    try {
      if (!win) throw new Error('El navegador bloqueo la ventana. Permite las ventanas emergentes para ver la poliza.');
      const blob = await getWasabiBlob(documentoKey);
      const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      win.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e: unknown) {
      win?.close();
      setError(e instanceof Error ? e.message : 'Error al abrir la poliza');
    } finally {
      setBusy(null);
    }
  };

  const handleDescargar = async () => {
    if (!documentoKey) return;
    setBusy('descargar');
    setError('');
    try {
      await downloadFromWasabi(documentoKey, polizaFileName(documentoKey));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al descargar la poliza');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
      <div className="w-full max-w-md rounded-2xl p-5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Poliza en PDF</h3>
            <p className="text-xs font-mono" style={{ color: '#94A3B8' }}>{seguro.numero_poliza}</p>
          </div>
          <button onClick={onClose} className="cursor-pointer" style={{ color: '#94A3B8' }} title="Cerrar"><X size={16} /></button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl text-xs" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
          <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>Documento actual</p>
          {documentoKey ? (
            <>
              <p className="text-sm flex items-center gap-2 mb-3" style={{ color: '#1E293B' }}>
                <FileText size={14} style={{ color: '#0369A1' }} /> {polizaFileName(documentoKey)}
              </p>
              <div className="flex gap-2">
                <button onClick={handleVer} disabled={busy !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
                  {busy === 'ver' ? <RefreshCw size={12} className="animate-spin" /> : <Eye size={12} />} Ver
                </button>
                <button onClick={handleDescargar} disabled={busy !== null}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                  {busy === 'descargar' ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />} Descargar
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm" style={{ color: '#94A3B8' }}>Esta poliza todavia no tiene PDF.</p>
          )}
        </div>

        <div>
          <p className="text-xs font-medium mb-2" style={{ color: '#64748B' }}>
            {documentoKey ? 'Reemplazar por otro PDF' : 'Subir PDF'}
          </p>
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer transition-all duration-200 hover:opacity-90 mb-3"
            style={{ border: '1px dashed #94A3B8', backgroundColor: '#FFFFFF', color: '#475569' }}>
            <Upload size={14} />
            <span className="truncate">{file ? file.name : 'Seleccionar archivo PDF'}</span>
            <input type="file" accept="application/pdf" className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <div className="flex items-center gap-2 justify-end">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: '#F1F5F9', color: '#64748B', border: '1px solid #E2E8F0' }}>
              Cerrar
            </button>
            <button onClick={handleUpload} disabled={!file || busy !== null}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all duration-200 hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#0369A1', color: '#FFFFFF' }}>
              {busy === 'upload' ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
              {busy === 'upload' ? 'Subiendo...' : 'Subir poliza'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
