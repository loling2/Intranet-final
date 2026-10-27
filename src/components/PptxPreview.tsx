import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ReactPptxViewer } from '@extend-ai/react-pptx';
import '@extend-ai/react-pptx/styles.css';
import { downloadFromWasabi, getWasabiBlob } from '../lib/wasabi';

interface PptxPreviewProps {
  wasabiKey: string;
  filename: string | null;
  allowDownload?: boolean;
}

export default function PptxPreview({ wasabiKey, filename, allowDownload = false }: PptxPreviewProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setLoading(true);
    setError('');

    getWasabiBlob(wasabiKey)
      .then((blob) => {
        if (cancelled) return;
        const safeFilename = filename || 'presentacion.pptx';
        const isLegacyPowerPoint = /\.ppt$/i.test(safeFilename);
        const contentType = isLegacyPowerPoint
          ? 'application/vnd.ms-powerpoint'
          : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        setFile(new File([blob], safeFilename, { type: contentType }));
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar la presentación.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [wasabiKey, filename]);

  if (loading) return <div className="flex items-center justify-center gap-2 py-16 text-sm" style={{ color: '#64748B' }}><Loader2 size={20} className="animate-spin" /> Cargando presentación...</div>;
  if (error) return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl p-8 text-sm text-center" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}>
      <div className="flex items-center gap-2"><AlertCircle size={18} /> {error}</div>
      {allowDownload && <button onClick={() => void downloadFromWasabi(wasabiKey, filename || 'presentacion.pptx')} className="rounded-lg px-4 py-2 font-medium cursor-pointer" style={{ backgroundColor: '#B91C1C', color: '#FFFFFF' }}>Descargar presentación</button>}
    </div>
  );
  if (!file) return null;

  const formatHint = /\.ppt$/i.test(file.name) ? 'ppt' : 'pptx';

  return (
    <div className="pptx-preview h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-xl" style={{ backgroundColor: '#E2E8F0' }}>
      <ReactPptxViewer
        source={file}
        parseOptions={{ formatHint }}
        mode="continuous"
        defaultZoom="fit-width"
        showToolbar
        showThumbnails
        onError={(viewerError) => setError(`No se puede previsualizar este archivo (${viewerError.code}).`)}
        renderError={(viewerError) => <div className="p-6 text-sm" style={{ color: '#B91C1C' }}>No se puede previsualizar este archivo ({viewerError.code}). Puede que esté dañado, protegido con contraseña o use una función no compatible.</div>}
      />
    </div>
  );
}
