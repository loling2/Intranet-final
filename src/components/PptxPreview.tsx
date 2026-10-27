import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { ReactPptxViewer } from '@extend-ai/react-pptx';
import '@extend-ai/react-pptx/styles.css';
import { getWasabiBlob } from '../lib/wasabi';

interface PptxPreviewProps {
  wasabiKey: string;
  filename: string | null;
}

export default function PptxPreview({ wasabiKey, filename }: PptxPreviewProps) {
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
        setFile(new File([blob], safeFilename, { type: blob.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }));
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
  if (error) return <div className="flex items-center justify-center gap-2 rounded-xl p-6 text-sm" style={{ backgroundColor: '#FEF2F2', color: '#B91C1C' }}><AlertCircle size={18} /> {error}</div>;
  if (!file) return null;

  return (
    <div className="pptx-preview h-[min(72vh,760px)] min-h-[420px] overflow-hidden rounded-xl" style={{ backgroundColor: '#E2E8F0' }}>
      <ReactPptxViewer
        source={file}
        mode="continuous"
        defaultZoom="fit-width"
        showToolbar
        showThumbnails
        renderError={() => <div className="p-6 text-sm" style={{ color: '#B91C1C' }}>Esta presentación no se puede previsualizar en el navegador.</div>}
      />
    </div>
  );
}
