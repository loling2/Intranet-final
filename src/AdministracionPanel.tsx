import { useState, useEffect } from 'react';
import { LogOut, Receipt, Building2, CircleUser as UserCircle, KeyRound, HelpCircle, CalendarDays, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { SocietyProvider } from './context/SocietyContext';
import FacturasModule from './components/FacturasModule';
import ChangePasswordModal from './components/ChangePasswordModal';
import HelpPanel from './components/HelpPanel';
import ProfileSwitcher, { type ProfileOption } from './components/ProfileSwitcher';
import CuadrantesModule from './components/CuadrantesModule';
import SegurosModule from './components/SegurosModule';
import { supabase } from './supabaseClient';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigateEmployee?: () => void;
  availableProfiles?: ProfileOption[];
  onNavigateProfile?: (view: string) => void;
}

type AdministracionTab = 'facturas' | 'cuadrantes' | 'seguros' | 'ayuda';

const PERMISSION_GATED_TABS: { id: 'cuadrantes' | 'seguros'; label: string; icon: LucideIcon }[] = [
  { id: 'cuadrantes', label: 'Cuadrantes', icon: CalendarDays },
  { id: 'seguros', label: 'Seguros', icon: ShieldCheck },
];

export default function AdministracionPanel({ email, onLogout, onNavigateEmployee, availableProfiles, onNavigateProfile }: Props) {
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeTab, setActiveTab] = useState<AdministracionTab>('facturas');
  const [enabledTabIds, setEnabledTabIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase
      .from('role_tab_permissions')
      .select('tab_id, enabled')
      .eq('role', 'administracion')
      .then(({ data, error }) => {
        if (error || !data) return;
        setEnabledTabIds(new Set(data.filter(r => r.enabled).map(r => r.tab_id as string)));
      });
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F8FAFC' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
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
            {availableProfiles && onNavigateProfile ? (
              <ProfileSwitcher currentLabel="Administracion" options={availableProfiles} onNavigate={onNavigateProfile} headerText="#E0F2FE" />
            ) : null}
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
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', color: '#FFFFFF' }}
            >
              <KeyRound size={14} />
              <span className="hidden sm:inline">Cambiar Contrasena</span>
            </button>
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
        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('facturas')}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
            style={{
              backgroundColor: activeTab === 'facturas' ? '#0C4A6E' : '#FFFFFF',
              color: activeTab === 'facturas' ? '#FFFFFF' : '#475569',
              border: `1px solid ${activeTab === 'facturas' ? '#0C4A6E' : '#E2E8F0'}`,
            }}
          >
            <Receipt size={14} className="inline mr-1.5" /> Facturas
          </button>
          {PERMISSION_GATED_TABS.filter(tab => enabledTabIds.has(tab.id)).map(tab => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
                style={{
                  backgroundColor: isActive ? '#0C4A6E' : '#FFFFFF',
                  color: isActive ? '#FFFFFF' : '#475569',
                  border: `1px solid ${isActive ? '#0C4A6E' : '#E2E8F0'}`,
                }}
              >
                <TabIcon size={14} className="inline mr-1.5" /> {tab.label}
              </button>
            );
          })}
          <button
            onClick={() => setActiveTab('ayuda')}
            className="px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
            style={{
              backgroundColor: activeTab === 'ayuda' ? '#0C4A6E' : '#FFFFFF',
              color: activeTab === 'ayuda' ? '#FFFFFF' : '#475569',
              border: `1px solid ${activeTab === 'ayuda' ? '#0C4A6E' : '#E2E8F0'}`,
            }}
          >
            <HelpCircle size={14} className="inline mr-1.5" /> Ayuda
          </button>
        </div>
        {activeTab === 'facturas' && <FacturasModule isAdmin={true} />}
        {activeTab === 'cuadrantes' && <CuadrantesModule />}
        {activeTab === 'seguros' && <SegurosModule />}
        {activeTab === 'ayuda' && <HelpPanel currentProfileName="Administración" accentColor="#0C4A6E" />}
      </main>
    </div>
  );
}
