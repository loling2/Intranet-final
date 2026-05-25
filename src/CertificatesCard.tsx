import { Award, Download, AlertTriangle } from 'lucide-react';
import { SocietyTheme } from './themes';
import { Certificate } from './mockData';

interface Props {
  certificates: Certificate[];
  theme: SocietyTheme;
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  Seguridad: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  Informatica: { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' },
  Gestion: { bg: '#F0FDF4', text: '#16A34A', border: '#BBF7D0' },
  Habilidades: { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' },
  Legal: { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
};

export default function CertificatesCard({ certificates, theme }: Props) {
  const isExpiringSoon = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const now = new Date();
    const diffDays = (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays <= 90 && diffDays > 0;
  };

  const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${theme.primary}12` }}
          >
            <Award size={20} style={{ color: theme.primary }} />
          </div>
          <div>
            <h3 className="font-semibold text-sm" style={{ color: theme.textPrimary }}>
              Mis Certificados
            </h3>
            <p className="text-xs" style={{ color: theme.textSecondary }}>
              {certificates.length} certificados obtenidos
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {certificates.map((cert) => {
          const catStyle = categoryColors[cert.category] ?? categoryColors.Habilidades;
          const expired = isExpired(cert.expiryDate);
          const expiring = isExpiringSoon(cert.expiryDate);

          return (
            <div
              key={cert.id}
              className="rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 group"
              style={{
                backgroundColor: theme.bgCard,
                border: `1px solid ${expired ? '#FECACA' : expiring ? '#FDE68A' : theme.border}`,
              }}
            >
              {/* Diploma Top Band */}
              <div
                className="h-2 transition-all duration-300"
                style={{
                  background: expired
                    ? 'linear-gradient(90deg, #EF4444, #DC2626)'
                    : expiring
                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                    : `linear-gradient(90deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                }}
              />

              <div className="p-5">
                {/* Category Badge */}
                <div className="flex items-center justify-between mb-4">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-md"
                    style={{
                      backgroundColor: catStyle.bg,
                      color: catStyle.text,
                      border: `1px solid ${catStyle.border}`,
                    }}
                  >
                    {cert.category}
                  </span>
                  {expired && (
                    <div className="flex items-center gap-1 text-xs font-medium text-red-500">
                      <AlertTriangle size={12} />
                      Expirado
                    </div>
                  )}
                  {expiring && !expired && (
                    <div className="flex items-center gap-1 text-xs font-medium text-amber-600">
                      <AlertTriangle size={12} />
                      Por expirar
                    </div>
                  )}
                </div>

                {/* Diploma Icon */}
                <div className="flex justify-center mb-4">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                    style={{
                      background: expired
                        ? 'linear-gradient(135deg, #FEE2E2, #FECACA)'
                        : `linear-gradient(135deg, ${theme.primaryLight}, ${theme.primary}20)`,
                      border: `2px solid ${expired ? '#FECACA' : theme.border}`,
                    }}
                  >
                    <Award
                      size={28}
                      style={{ color: expired ? '#DC2626' : theme.primary }}
                    />
                  </div>
                </div>

                {/* Title */}
                <h4
                  className="text-sm font-semibold text-center mb-1 leading-tight"
                  style={{ color: theme.textPrimary }}
                >
                  {cert.title}
                </h4>
                <p
                  className="text-xs text-center mb-4"
                  style={{ color: theme.textSecondary }}
                >
                  {cert.issuer}
                </p>

                {/* Details */}
                <div
                  className="space-y-1.5 mb-4 pt-3"
                  style={{ borderTop: `1px solid ${theme.border}` }}
                >
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: theme.textSecondary }}>
                      Expedicion
                    </span>
                    <span className="text-xs font-medium" style={{ color: theme.textPrimary }}>
                      {cert.date}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: theme.textSecondary }}>
                      Expiracion
                    </span>
                    <span
                      className="text-xs font-medium"
                      style={{ color: expired ? '#DC2626' : expiring ? '#D97706' : theme.textPrimary }}
                    >
                      {cert.expiryDate}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs" style={{ color: theme.textSecondary }}>
                      Codigo
                    </span>
                    <span
                      className="text-xs font-mono font-medium"
                      style={{ color: theme.primary }}
                    >
                      {cert.code}
                    </span>
                  </div>
                </div>

                {/* Download */}
                <button
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: expired ? '#FEF2F2' : theme.primaryLight,
                    color: expired ? '#DC2626' : theme.primary,
                    border: `1px solid ${expired ? '#FECACA' : theme.border}`,
                  }}
                >
                  <Download size={12} />
                  {expired ? 'Renovar certificado' : 'Descargar diploma'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
