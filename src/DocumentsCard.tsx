import { FileText, Download, ChevronRight } from 'lucide-react';
import { SocietyTheme } from './themes';
import { Document } from './mockData';
import { useState } from 'react';

interface Props {
  documents: Document[];
  theme: SocietyTheme;
}

export default function DocumentsCard({ documents, theme }: Props) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = (doc: Document) => {
    setDownloadingId(doc.id);
    setTimeout(() => setDownloadingId(null), 1500);
  };

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-500"
      style={{
        backgroundColor: theme.bgCard,
        border: `1px solid ${theme.border}`,
      }}
    >
      {/* Header */}
      <div
        className="px-6 py-5 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${theme.border}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.primary}12` }}
          >
            <FileText size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
              Mis Documentos
            </h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {documents.length} documentos disponibles
            </p>
          </div>
        </div>
        <button
          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all duration-200 cursor-pointer"
          style={{
            color: theme.primary,
            backgroundColor: theme.primaryLight,
          }}
        >
          Ver todos
        </button>
      </div>

      {/* Document List */}
      <div className="divide-y" style={{ borderColor: theme.border }}>
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="px-6 py-3.5 flex items-center justify-between group transition-colors duration-200"
            style={{ borderColor: theme.border }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${theme.primary}0A` }}
              >
                <FileText size={14} style={{ color: theme.primary }} />
              </div>
              <div className="min-w-0">
                <p
                  className="text-sm font-medium truncate"
                  style={{ color: theme.textPrimary }}
                >
                  {doc.name}
                </p>
                <p className="text-xs" style={{ color: theme.textSecondary }}>
                  {doc.date} &middot; {doc.size}
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDownload(doc)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex-shrink-0 cursor-pointer"
              style={{
                backgroundColor: downloadingId === doc.id ? theme.primary : theme.primaryLight,
                color: downloadingId === doc.id ? '#FFFFFF' : theme.primary,
              }}
            >
              {downloadingId === doc.id ? (
                <span className="flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Descargando
                </span>
              ) : (
                <>
                  <Download size={12} />
                  Descargar
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        className="px-6 py-3 flex items-center justify-center gap-1 text-xs font-medium cursor-pointer transition-colors duration-200"
        style={{
          color: theme.primary,
          backgroundColor: theme.primaryLight,
          borderTop: `1px solid ${theme.border}`,
        }}
      >
        Descargar todos
        <ChevronRight size={14} />
      </div>
    </div>
  );
}
