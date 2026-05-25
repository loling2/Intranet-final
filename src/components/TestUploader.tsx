import { useRef, useState } from 'react';
import { Upload, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { uploadToWasabi } from '../lib/wasabi';

type Status = 'idle' | 'uploading' | 'success' | 'error';

export default function TestUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [resultUrl, setResultUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleUpload() {
    if (!file) return;
    setStatus('uploading');
    setErrorMsg('');
    setResultUrl('');
    try {
      const path = `test/${Date.now()}-${file.name}`;
      const url = await uploadToWasabi(file, path);
      setResultUrl(url);
      setStatus('success');
    } catch (err: unknown) {
      const e = err as { message?: string };
      setErrorMsg(e.message ?? 'Error desconocido');
      setStatus('error');
    }
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
    >
      <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0', backgroundColor: '#FFFBEB' }}>
        <Upload size={15} style={{ color: '#D97706' }} />
        <h3 className="font-semibold text-sm" style={{ color: '#92400E' }}>
          Test Wasabi — temporal
        </h3>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-md font-medium"
          style={{ backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }}
        >
          Solo pruebas
        </span>
      </div>

      <div className="p-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <label
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-150 hover:opacity-90"
            style={{ backgroundColor: '#F1F5F9', border: '1px solid #E2E8F0', color: '#475569' }}
          >
            <Upload size={14} />
            {file ? file.name : 'Seleccionar archivo'}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setStatus('idle');
                setResultUrl('');
                setErrorMsg('');
              }}
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || status === 'uploading'}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            style={{ backgroundColor: '#0F172A', color: '#FFFFFF' }}
          >
            {status === 'uploading' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Upload size={14} />
            )}
            {status === 'uploading' ? 'Subiendo...' : 'Subir a Wasabi'}
          </button>
        </div>

        {status === 'success' && (
          <div
            className="flex flex-col gap-1 p-4 rounded-xl"
            style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 size={15} style={{ color: '#16A34A' }} />
              <span className="text-sm font-semibold" style={{ color: '#15803D' }}>
                Archivo subido correctamente al bucket!
              </span>
            </div>
            <p className="text-xs break-all pl-5" style={{ color: '#166534' }}>
              {resultUrl}
            </p>
          </div>
        )}

        {status === 'error' && (
          <div
            className="flex items-start gap-2 p-4 rounded-xl"
            style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
          >
            <XCircle size={15} style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#B91C1C' }}>Error al subir el archivo</p>
              <p className="text-xs mt-0.5" style={{ color: '#991B1B' }}>{errorMsg}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
