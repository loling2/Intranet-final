import { useState, useEffect } from 'react';
import {
  Shield, Users, Building2, Laptop, FileText, Palmtree, Award,
  ClipboardCheck, ChevronRight, BarChart2, LogOut,
  Search, Eye, CheckCircle2, XCircle, Clock,
  Activity, Lock, Unlock, Car, ScrollText, ChevronLeft
} from 'lucide-react';
import { societies } from './themes';
import { validUsers, mockDocuments, mockDevices, mockVacations, mockCertificates, mockExams } from './mockData';
import UserManagement from './UserManagement';
import VehiclesModule from './VehiclesModule';
import DocumentsModule from './DocumentsModule';
import AuditLogPanel from './AuditLogPanel';
import SocietySwitcher from './SocietySwitcher';
import TestUploader from './components/TestUploader';
import { useSociety } from './context/SocietyContext';
import VacationsModule from './components/VacationsModule';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigate: (view: 'admin' | 'rrhh' | 'society', societyId?: string) => void;
}

type AdminTab = 'overview' | 'users' | 'societies' | 'documents' | 'devices' | 'vacations' | 'vehicles' | 'audit';

export default function AdminPanel({ email, onLogout, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSociety, setSelectedSociety] = useState<string | null>(null);
  const { activeSocietyId } = useSociety();

  // Reload data when active society changes
  useEffect(() => {
    setSelectedSociety(activeSocietyId);
  }, [activeSocietyId]);

  const allDocuments = Object.entries(mockDocuments).flatMap(([sId, docs]) =>
    docs.map((d) => ({ ...d, societyId: sId }))
  );
  const allDevices = Object.entries(mockDevices).flatMap(([sId, devs]) =>
    devs.map((d) => ({ ...d, societyId: sId }))
  );
  const allVacations = Object.entries(mockVacations).flatMap(([sId, v]) =>
    v.requests.map((r) => ({ ...r, societyId: sId }))
  );
  const allCertificates = Object.entries(mockCertificates).flatMap(([sId, certs]) =>
    certs.map((c) => ({ ...c, societyId: sId }))
  );
  const allExams = Object.entries(mockExams).flatMap(([sId, exams]) =>
    exams.map((e) => ({ ...e, societyId: sId }))
  );

  const employees = validUsers.filter((u) => u.role === 'employee');

  const stats = [
    { label: 'Sociedades', value: societies.length, icon: Building2, color: '#0EA5E9', bg: '#F0F9FF' },
    { label: 'Empleados', value: employees.length, icon: Users, color: '#10B981', bg: '#F0FDF4' },
    { label: 'Documentos', value: allDocuments.length, icon: FileText, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Dispositivos activos', value: allDevices.filter((d) => d.active).length, icon: Laptop, color: '#6366F1', bg: '#EEF2FF' },
    { label: 'Certificados', value: allCertificates.length, icon: Award, color: '#EC4899', bg: '#FDF2F8' },
    { label: 'Vacaciones pendientes', value: allVacations.filter((v) => v.status === 'pendiente').length, icon: Palmtree, color: '#8B5CF6', bg: '#F5F3FF' },
  ];

  const tabs: { id: AdminTab; label: string; icon: React.FC<{ size?: number; className?: string }> }[] = [
    { id: 'overview', label: 'Panel General', icon: BarChart2 },
    { id: 'users', label: 'Usuarios', icon: Users },
    { id: 'societies', label: 'Sociedades', icon: Building2 },
    { id: 'vehicles', label: 'Vehiculos', icon: Car },
    { id: 'documents', label: 'Documentos', icon: FileText },
    { id: 'devices', label: 'Dispositivos', icon: Laptop },
    { id: 'vacations', label: 'Vacaciones', icon: Palmtree },
    { id: 'audit', label: 'Auditoria', icon: ScrollText },
  ];

  const filteredDocuments = allDocuments.filter((d) =>
    (!selectedSociety || d.societyId === selectedSociety) &&
    (!searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredDevices = allDevices.filter((d) =>
    (!selectedSociety || d.societyId === selectedSociety) &&
    (!searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase()))
  );
  const filteredVacations = allVacations.filter((v) =>
    (!selectedSociety || v.societyId === selectedSociety)
  );

  const getSocietyTheme = (id: string) => societies.find((s) => s.id === id);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F1F5F9' }}>
      {/* Header */}
      <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-screen-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onLogout}
              title="Volver al inicio"
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5E1' }}
            >
              <ChevronLeft size={18} />
            </button>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Shield size={20} style={{ color: '#EF4444' }} />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg tracking-tight">Panel de Administracion</h1>
              <p className="text-white/50 text-xs">Acceso completo al sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SocietySwitcher />
            <button
              onClick={() => onNavigate('rrhh')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Users size={14} />
              Panel RRHH
            </button>
            <div className="text-right hidden sm:block">
              <p className="text-white text-sm font-medium">{email}</p>
              <p className="text-white/50 text-xs flex items-center gap-1 justify-end">
                <Lock size={10} style={{ color: '#EF4444' }} /> Admin
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <LogOut size={14} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-6 py-8">
        {/* Admin Badge */}
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-xl mb-8 w-fit"
          style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA' }}
        >
          <Shield size={16} style={{ color: '#EF4444' }} />
          <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>
            Sesion con privilegios de administrador &mdash; acceso total al sistema
          </span>
        </div>

        {/* Tab Navigation */}
        <div
          className="flex gap-1 p-1 rounded-xl mb-8 overflow-x-auto"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? '#0F172A' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#64748B',
                }}
              >
                <TabIcon size={15} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              {stats.map((stat, i) => {
                const StatIcon = stat.icon;
                return (
                  <div
                    key={i}
                    className="rounded-xl p-4 transition-all duration-200 hover:shadow-md"
                    style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3" style={{ backgroundColor: stat.bg }}>
                      <StatIcon size={18} style={{ color: stat.color }} />
                    </div>
                    <p className="text-2xl font-bold" style={{ color: '#0F172A' }}>{stat.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{stat.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Societies quick access */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Acceso Rapido a Sociedades</h3>
                  <span className="text-xs px-2 py-1 rounded-md font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                    Admin
                  </span>
                </div>
                <div className="p-4 space-y-2">
                  {societies.map((s) => {
                    const empDocs = mockDocuments[s.id]?.length ?? 0;
                    const empDevs = mockDevices[s.id]?.length ?? 0;
                    return (
                      <button
                        key={s.id}
                        onClick={() => onNavigate('society', s.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:shadow-sm cursor-pointer text-left"
                        style={{ backgroundColor: s.primaryLight, border: `1px solid ${s.border}` }}
                      >
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${s.primary}20` }}>
                          <span className="text-sm font-bold" style={{ color: s.primary }}>{s.logoLetter}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ color: s.textPrimary }}>{s.name}</p>
                          <p className="text-xs" style={{ color: s.textSecondary }}>{empDocs} docs &middot; {empDevs} dispositivos</p>
                        </div>
                        <ChevronRight size={16} style={{ color: s.textSecondary }} />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Activity log */}
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="px-6 py-4 flex items-center gap-2" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <Activity size={16} style={{ color: '#0F172A' }} />
                  <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Actividad Reciente del Sistema</h3>
                </div>
                <div className="p-4 space-y-3">
                  {[
                    { action: 'Inicio de sesion', user: 'beta@empresa.com', time: 'Hace 5 min', icon: Unlock, color: '#10B981' },
                    { action: 'Solicitud de vacaciones', user: 'gamma@empresa.com', time: 'Hace 12 min', icon: Palmtree, color: '#F59E0B' },
                    { action: 'Descarga de documento', user: 'alfa@empresa.com', time: 'Hace 28 min', icon: FileText, color: '#0EA5E9' },
                    { action: 'Examen completado', user: 'delta@empresa.com', time: 'Hace 1h', icon: ClipboardCheck, color: '#8B5CF6' },
                    { action: 'Dispositivo inactivado', user: 'System', time: 'Hace 2h', icon: Laptop, color: '#EF4444' },
                    { action: 'Certificado emitido', user: 'gamma@empresa.com', time: 'Hace 3h', icon: Award, color: '#EC4899' },
                  ].map((item, i) => {
                    const ItemIcon = item.icon;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${item.color}15` }}>
                          <ItemIcon size={14} style={{ color: item.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium" style={{ color: '#1E293B' }}>{item.action}</p>
                          <p className="text-xs" style={{ color: '#94A3B8' }}>{item.user}</p>
                        </div>
                        <span className="text-xs" style={{ color: '#CBD5E1' }}>{item.time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Wasabi test uploader — remove once connection is verified */}
            <div className="mb-6">
              <TestUploader />
            </div>

            {/* Exam/vacation summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Estado de Examenes</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: 'Total', value: allExams.length, color: '#64748B', bg: '#F8FAFC' },
                      { label: 'Pendientes', value: allExams.filter((e) => e.status === 'pendiente').length, color: '#64748B', bg: '#F8FAFC' },
                      { label: 'Aprobados', value: allExams.filter((e) => e.status === 'completado').length, color: '#16A34A', bg: '#F0FDF4' },
                      { label: 'Suspendidos', value: allExams.filter((e) => e.status === 'suspendido').length, color: '#DC2626', bg: '#FEF2F2' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                        <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
                  <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Estado de Vacaciones</h3>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Aprobadas', value: allVacations.filter((v) => v.status === 'aprobada').length, color: '#16A34A', bg: '#F0FDF4' },
                      { label: 'Pendientes', value: allVacations.filter((v) => v.status === 'pendiente').length, color: '#D97706', bg: '#FFFBEB' },
                      { label: 'Rechazadas', value: allVacations.filter((v) => v.status === 'rechazada').length, color: '#DC2626', bg: '#FEF2F2' },
                    ].map((s, i) => (
                      <div key={i} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.bg }}>
                        <p className="text-xl font-bold" style={{ color: s.color }}>{s.value}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <UserManagement currentUserRole="admin" />
        )}

        {/* Societies Tab */}
        {activeTab === 'societies' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {societies.map((s) => {
              const docs = mockDocuments[s.id] ?? [];
              const devs = mockDevices[s.id] ?? [];
              const vacs = mockVacations[s.id] ?? { balance: { total: 0, used: 0, pending: 0 }, requests: [] };
              const certs = mockCertificates[s.id] ?? [];
              const exams = mockExams[s.id] ?? [];
              return (
                <div
                  key={s.id}
                  className="rounded-2xl overflow-hidden transition-all duration-200 hover:shadow-lg"
                  style={{ backgroundColor: '#FFFFFF', border: `1px solid ${s.border}` }}
                >
                  <div
                    className="px-6 py-4 flex items-center justify-between"
                    style={{ background: `linear-gradient(135deg, ${s.gradientFrom}, ${s.gradientTo})` }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                        <span className="text-white font-bold text-lg">{s.logoLetter}</span>
                      </div>
                      <div>
                        <h3 className="text-white font-bold">{s.name}</h3>
                        <p className="text-white/60 text-xs">ID: {s.id}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => onNavigate('society', s.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer"
                      style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                      <Eye size={12} />
                      Ver portal
                    </button>
                  </div>
                  <div className="p-5 grid grid-cols-5 gap-3">
                    {[
                      { label: 'Docs', value: docs.length, color: '#0EA5E9' },
                      { label: 'Devs', value: devs.length, color: '#10B981' },
                      { label: 'Vacaciones', value: vacs.requests.length, color: '#F59E0B' },
                      { label: 'Certificados', value: certs.length, color: '#EC4899' },
                      { label: 'Examenes', value: exams.length, color: '#8B5CF6' },
                    ].map((item, i) => (
                      <div key={i} className="text-center rounded-xl p-3" style={{ backgroundColor: s.primaryLight }}>
                        <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                        <p className="text-xs mt-0.5" style={{ color: s.textSecondary }}>{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Documents Tab - Supabase backed */}
        {activeTab === 'documents' && (
          <DocumentsModule currentUserRole="admin" userEmail={email} />
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
            <div className="px-6 py-4 flex items-center justify-between gap-4" style={{ borderBottom: '1px solid #E2E8F0' }}>
              <div>
                <h3 className="font-semibold" style={{ color: '#0F172A' }}>Gestion de Dispositivos</h3>
                <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{filteredDevices.length} dispositivos</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                  <input
                    type="text"
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-2 rounded-lg text-xs outline-none"
                    style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B', width: '200px' }}
                  />
                </div>
                <select
                  value={selectedSociety ?? ''}
                  onChange={(e) => setSelectedSociety(e.target.value || null)}
                  className="px-3 py-2 rounded-lg text-xs outline-none cursor-pointer"
                  style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', color: '#1E293B' }}
                >
                  <option value="">Todas las sociedades</option>
                  {societies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
            <div className="divide-y" style={{ borderColor: '#F1F5F9' }}>
              {filteredDevices.map((device, i) => {
                const s = getSocietyTheme(device.societyId);
                return (
                  <div key={i} className="px-6 py-4 flex items-center gap-4">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: device.active ? '#F0FDF4' : '#FEF2F2' }}>
                      <Laptop size={15} style={{ color: device.active ? '#16A34A' : '#DC2626' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{device.name}</p>
                      <p className="text-xs" style={{ color: '#94A3B8' }}>{device.type} &middot; {device.serial}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {s && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-md" style={{ backgroundColor: s.primaryLight, color: s.primary, border: `1px solid ${s.border}` }}>
                          {s.name}
                        </span>
                      )}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md" style={{ backgroundColor: device.active ? '#F0FDF4' : '#FEF2F2', border: `1px solid ${device.active ? '#BBF7D0' : '#FECACA'}` }}>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: device.active ? '#22C55E' : '#EF4444' }} />
                        <span className="text-xs font-medium" style={{ color: device.active ? '#16A34A' : '#DC2626' }}>
                          {device.active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Vehicles Tab - NEW */}
        {activeTab === 'vehicles' && (
          <VehiclesModule currentUserRole="admin" userEmail={email} />
        )}

        {/* Vacations Tab — Supabase-backed */}
        {activeTab === 'vacations' && (
          <VacationsModule role="admin" />
        )}

        {/* Audit Tab - NEW */}
        {activeTab === 'audit' && (
          <AuditLogPanel />
        )}
      </div>
    </div>
  );
}
