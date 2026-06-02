import { LogOut, Receipt, Building2, CircleUser as UserCircle } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { SocietyProvider } from './context/SocietyContext';
import FacturasModule from './components/FacturasModule';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
}

export default function AdministracionPanel({ email, onLogout, onNavigateEmployee }: Props) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50"
        style={{ background: 'linear-gradient(135deg, #0C4A6E, #0369A1)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div className="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <Building2 size={18} style={{ color: '#FFFFFF' }} />
            </div>
            <div>
              <h1 className="font-bold text-sm" style={{ color: '#FFFFFF' }}>Panel Administración</h1>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {onNavigateEmployee && (
              <button
                onClick={onNavigateEmployee}
                className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#6EE7B7', border: '1px solid rgba(16,185,129,0.2)' }}
              >
                <UserCircle size={14} />
                <span>Mi perfil empleado</span>
              </button>
            )}
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}
            >
              <LogOut size={14} /> Salir
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-screen-xl mx-auto px-6 py-8">
        <FacturasModule isAdmin={true} />
      </main>
    </div>
  );
}
