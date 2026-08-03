import { useState, useEffect } from 'react';
import {
  Shield, Users, Building2, Laptop, FileText, Palmtree, Award,
  ClipboardCheck, ChevronRight, BarChart2, LogOut,
  Eye, Activity, Lock, Unlock, Car, ScrollText, ChevronLeft, ShieldCheck, KeyRound, Palette,
  MapPin, Plus, X, RefreshCw, Trash2, AlertCircle, Clock, Mail, Menu, HelpCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { validUsers } from './mockData';
import UserManagement from './UserManagement';
import VehiclesModule from './VehiclesModule';
import DocumentsModule from './DocumentsModule';
import AuditLogPanel from './AuditLogPanel';
import SocietySwitcher from './SocietySwitcher';
import ChangePasswordModal from './components/ChangePasswordModal';
import VacationsModule from './components/VacationsModule';
import EmployeesModule from './components/EmployeesModule';
import TagsManager from './components/TagsManager';
import RolesManager from './components/RolesManager';
import DevicesModule from './components/DevicesModule';
import CssPanel from './components/CssPanel';
import IncidenciasModule from './components/IncidenciasModule';
import DepartamentosModule from './components/DepartamentosModule';
import EmailModule from './components/EmailModule';
import FichajesModule from './components/FichajesModule';
import RoleTabPermissionsManager from './components/RoleTabPermissionsManager';
import HelpPanel from './components/HelpPanel';
import { useSociety } from './context/SocietyContext';
import { supabase } from './supabaseClient';
import type { Centro } from './supabaseClient';

interface Props {
  email: string;
  onLogout: () => void;
  onNavigate: (view: 'admin' | 'rrhh' | 'society' | 'dashboard', societyId?: string) => void;
  onImpersonate?: (userId: string, societyId: string | null) => void;
}

type AdminTab = 'overview' | 'employees' | 'users' | 'societies' | 'documents' | 'devices' | 'vacations' | 'vehicles' | 'prevencion' | 'tags' | 'roles' | 'departamentos' | 'email' | 'audit' | 'css' | 'incidencias' | 'fichajes' | 'permissions' | 'ayuda';

export default function AdminPanel({ email, onLogout, onNavigate, onImpersonate }: Props) {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [showChangePassword, setShowChangePassword] = useState(false);
  const { activeSocietyId, societies } = useSociety();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserNombre, setCurrentUserNombre] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const uid = session?.user?.id ?? null;
      setCurrentUserId(uid);
      if (uid) {
        supabase.from('user_profiles').select('nombre').eq('id', uid).maybeSingle()
          .then(({ data }) => setCurrentUserNombre(data?.nombre ?? email));
      }
    });
  }, [email]);

  // Centros de trabajo
  const [centros, setCentros] = useState<Centro[]>([]);
  const [centrosLoading, setCentrosLoading] = useState(false);
  const [newCentroName, setNewCentroName] = useState('');
  const [creatingCentro, setCreatingCentro] = useState(false);
  const [centroError, setCentroError] = useState('');
  const [deletingCentroId, setDeletingCentroId] = useState<string | null>(null);

  const loadCentros = async () => {
    setCentrosLoading(true);
    const { data } = await supabase.from('centros').select('*').order('nombre');
    setCentros((data ?? []) as Centro[]);
    setCentrosLoading(false);
  };

  useEffect(() => {
    if (activeTab === 'societies') loadCentros();
  }, [activeTab]);

  const handleCreateCentro = async () => {
    if (!newCentroName.trim()) { setCentroError('Introduce un nombre'); return; }
    setCreatingCentro(true); setCentroError('');
    const { error } = await supabase.from('centros').insert({ nombre: newCentroName.trim(), id_sociedad: null });
    if (error) setCentroError(error.message);
    else { setNewCentroName(''); await loadCentros(); }
    setCreatingCentro(false);
  };

  const handleAssignCentro = async (centroId: string, societyId: string | null) => {
    await supabase.from('centros').update({ id_sociedad: societyId }).eq('id', centroId);
    await loadCentros();
  };

  const handleDeleteCentro = async (centroId: string) => {
    setDeletingCentroId(centroId);
    await supabase.from('centros').delete().eq('id', centroId);
    await loadCentros();
    setDeletingCentroId(null);
  };

  // Reload data when active society changes
  useEffect(() => {}, [activeSocietyId]);

  const allDocuments: { status: string }[] = [];
  const allVacations: { status: string }[] = [];
  const allCertificates: { status: string }[] = [];
  const allExams: { status: string }[] = [];

  const employees = validUsers.filter((u) => u.role === 'employee');

  const stats = [
    { label: 'Sociedades', value: societies.length, icon: Building2, color: '#0EA5E9', bg: '#F0F9FF' },
    { label: 'Empleados', value: employees.length, icon: Users, color: '#10B981', bg: '#F0FDF4' },
    { label: 'Documentos', value: allDocuments.length, icon: FileText, color: '#F59E0B', bg: '#FFFBEB' },
    { label: 'Certificados', value: allCertificates.length, icon: Award, color: '#EC4899', bg: '#FDF2F8' },
    { label: 'Vacaciones pendientes', value: allVacations.filter((v) => v.status === 'pendiente').length, icon: Palmtree, color: '#8B5CF6', bg: '#F5F3FF' },
  ];

  const tabs: { id: AdminTab; label: string; icon: LucideIcon }[] = [
    { id: 'overview',   label: 'Panel General',      icon: BarChart2 },
    { id: 'employees',  label: 'Empleados',           icon: Users },
    { id: 'users',      label: 'Gestion de Usuarios', icon: Users },
    { id: 'societies',  label: 'Sociedades',          icon: Building2 },
    { id: 'vehicles',   label: 'Vehiculos',           icon: Car },
    { id: 'documents',  label: 'Documentos',          icon: FileText },
    { id: 'devices',    label: 'Dispositivos',        icon: Laptop },
    { id: 'vacations',  label: 'Vacaciones',          icon: Palmtree },
    { id: 'prevencion', label: 'Prevencion/Calidad',  icon: ShieldCheck },
    { id: 'tags',       label: 'Tags PRL',            icon: Activity },
    { id: 'roles',        label: 'Roles',               icon: ShieldCheck },
    { id: 'departamentos', label: 'Departamentos',       icon: Building2 },
    { id: 'email',         label: 'Email',               icon: Mail },
    { id: 'audit',        label: 'Auditoria',            icon: ScrollText },
    { id: 'css',        label: 'CSS',                 icon: Palette },
    { id: 'incidencias',  label: 'Incidencias',           icon: AlertCircle },
    { id: 'fichajes',     label: 'Fichajes',              icon: Clock },
    { id: 'permissions',  label: 'Permisos de Perfiles',  icon: Lock },
    { id: 'ayuda',         label: 'Ayuda',                 icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F1F5F9' }}>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #0F172A, #1E293B)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={() => onNavigate('dashboard')}
              title="Volver al panel de empleado"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 cursor-pointer transition-all duration-200 hover:opacity-80"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: '#CBD5E1' }}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <Shield size={18} style={{ color: '#EF4444' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-bold text-sm sm:text-lg tracking-tight">Panel de Administracion</h1>
              <p className="text-white/50 text-xs hidden sm:block">Acceso completo al sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <SocietySwitcher />
            <button
              onClick={() => onNavigate('rrhh')}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <Users size={13} />
              <span className="hidden sm:inline">Panel RRHH</span>
            </button>
            <button
              onClick={() => setActiveTab('prevencion')}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <ShieldCheck size={13} />
              <span className="hidden md:inline">Prevencion</span>
            </button>
            <div className="text-right hidden lg:block">
              <p className="text-white text-xs font-medium truncate max-w-[140px]">{email}</p>
              <p className="text-white/50 text-xs flex items-center gap-1 justify-end">
                <Lock size={10} style={{ color: '#EF4444' }} /> Admin
              </p>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">Cerrar Sesion</span>
            </button>
            <button
              onClick={() => setShowChangePassword(true)}
              className="flex items-center gap-1.5 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium cursor-pointer transition-all duration-200"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#CBD5E1', border: '1px solid rgba(255,255,255,0.1)' }}
            >
              <KeyRound size={13} />
              <span className="hidden lg:inline">Cambiar Contrasena</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
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
        {/* Mobile: Dropdown select */}
        <div className="md:hidden mb-6">
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
          >
            <Menu size={16} style={{ color: '#64748B' }} />
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as AdminTab)}
              className="flex-1 bg-transparent text-sm font-medium outline-none cursor-pointer"
              style={{ color: '#0F172A' }}
            >
              {tabs.map((tab) => (
                <option key={tab.id} value={tab.id}>{tab.label}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Desktop: Horizontal tabs */}
        <div
          className="hidden md:flex flex-wrap gap-1 p-1 rounded-xl mb-6 sm:mb-8"
          style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}
        >
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition-all duration-200 cursor-pointer whitespace-nowrap flex-shrink-0"
                style={{
                  backgroundColor: isActive ? '#0F172A' : 'transparent',
                  color: isActive ? '#FFFFFF' : '#64748B',
                }}
              >
                <TabIcon size={13} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Help Tab */}
        {activeTab === 'ayuda' && (
          <HelpPanel currentProfileName="Admin" accentColor="#0F172A" />
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
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
                    const empDocs = 0;
                    const empDevs = 0;
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

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <EmployeesModule currentUserRole="admin" />
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <UserManagement currentUserRole="admin" onImpersonate={onImpersonate} />
        )}

        {/* Societies Tab */}
        {activeTab === 'societies' && (
          <div className="space-y-6">
            {/* Society cards grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {societies.map((s) => {
                const societyCentros = centros.filter((c) => c.id_sociedad === s.id);
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
                        { label: 'Docs', value: 0, color: '#0EA5E9' },
                        { label: 'Devs', value: 0, color: '#10B981' },
                        { label: 'Vacaciones', value: 0, color: '#F59E0B' },
                        { label: 'Certificados', value: 0, color: '#EC4899' },
                        { label: 'Examenes', value: 0, color: '#8B5CF6' },
                      ].map((item, i) => (
                        <div key={i} className="text-center rounded-xl p-3" style={{ backgroundColor: s.primaryLight }}>
                          <p className="text-lg font-bold" style={{ color: item.color }}>{item.value}</p>
                          <p className="text-xs mt-0.5" style={{ color: s.textSecondary }}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* Centros assigned to this society */}
                    {societyCentros.length > 0 && (
                      <div className="px-5 pb-4" style={{ borderTop: `1px solid ${s.border}` }}>
                        <p className="text-xs font-semibold uppercase tracking-wider mt-3 mb-2" style={{ color: s.textSecondary }}>
                          Centros de trabajo
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {societyCentros.map((c) => (
                            <div
                              key={c.id}
                              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium"
                              style={{ backgroundColor: s.primaryLight, color: s.textPrimary, border: `1px solid ${s.border}` }}
                            >
                              <MapPin size={10} style={{ color: s.primary }} />
                              <span>{c.nombre}</span>
                              <button
                                onClick={() => handleAssignCentro(c.id, null)}
                                title="Desasignar"
                                className="ml-1 cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
                                style={{ color: s.primary }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Centros de trabajo section */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <MapPin size={16} style={{ color: '#0F172A' }} />
                <h3 className="font-semibold text-sm" style={{ color: '#0F172A' }}>Centros de trabajo</h3>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#F1F5F9', color: '#64748B' }}>
                  {centros.filter((c) => !c.id_sociedad).length} sin asignar
                </span>
              </div>

              {/* Create new centro */}
              <div className="px-6 py-4" style={{ borderBottom: '1px solid #F1F5F9' }}>
                <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#94A3B8' }}>Nuevo centro</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCentroName}
                    onChange={(e) => { setNewCentroName(e.target.value); setCentroError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateCentro()}
                    placeholder="Nombre del centro de trabajo..."
                    className="flex-1 px-3 py-2 rounded-xl text-sm outline-none"
                    style={{ border: `1.5px solid ${centroError ? '#FECACA' : '#E2E8F0'}`, color: '#1E293B', backgroundColor: '#F8FAFC' }}
                  />
                  <button
                    onClick={handleCreateCentro}
                    disabled={creatingCentro || !newCentroName.trim()}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white cursor-pointer disabled:opacity-50 transition-opacity"
                    style={{ backgroundColor: '#0F172A' }}
                  >
                    {creatingCentro ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
                    Crear
                  </button>
                </div>
                {centroError && (
                  <p className="text-xs mt-1" style={{ color: '#DC2626' }}>{centroError}</p>
                )}
              </div>

              {/* Unassigned centros */}
              <div className="px-6 py-4">
                {centrosLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <RefreshCw size={16} className="animate-spin" style={{ color: '#94A3B8' }} />
                  </div>
                ) : centros.filter((c) => !c.id_sociedad).length === 0 ? (
                  <p className="text-sm text-center py-6" style={{ color: '#CBD5E1' }}>No hay centros sin asignar</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#94A3B8' }}>Sin asignar — arrastra a una sociedad o usa el menu</p>
                    {centros.filter((c) => !c.id_sociedad).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0' }}
                      >
                        <MapPin size={14} style={{ color: '#94A3B8' }} />
                        <span className="flex-1 text-sm font-medium" style={{ color: '#1E293B' }}>{c.nombre}</span>
                        <div className="flex items-center gap-2">
                          <select
                            onChange={(e) => e.target.value && handleAssignCentro(c.id, e.target.value)}
                            defaultValue=""
                            className="px-2 py-1 rounded-lg text-xs outline-none cursor-pointer"
                            style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', color: '#64748B' }}
                          >
                            <option value="">Asignar a sociedad...</option>
                            {societies.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleDeleteCentro(c.id)}
                            disabled={deletingCentroId === c.id}
                            className="w-7 h-7 flex items-center justify-center rounded-lg cursor-pointer hover:bg-red-50 transition-colors disabled:opacity-50"
                            title="Eliminar"
                            style={{ color: '#CBD5E1' }}
                          >
                            {deletingCentroId === c.id ? <RefreshCw size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Documents Tab - Supabase backed */}
        {activeTab === 'documents' && (
          <DocumentsModule currentUserRole="admin" userEmail={email} />
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && (
          <DevicesModule />
        )}

        {/* Vehicles Tab - NEW */}
        {activeTab === 'vehicles' && (
          <VehiclesModule currentUserRole="admin" userEmail={email} />
        )}

        {/* Vacations Tab — Supabase-backed */}
        {activeTab === 'vacations' && (
          <VacationsModule role="admin" />
        )}

        {/* Prevencion/Calidad Tab */}
        {activeTab === 'prevencion' && (
          <div className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Evaluaciones activas', value: 0, color: '#0369A1', bg: '#EFF6FF', border: '#BFDBFE' },
                { label: 'Incidencias abiertas', value: 0, color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
                { label: 'Auditorias programadas', value: 0, color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
                { label: 'Acciones correctivas', value: 0, color: '#16A34A', bg: '#F0FDF4', border: '#BBF7D0' },
              ].map((kpi, i) => (
                <div key={i} className="rounded-xl p-5" style={{ backgroundColor: kpi.bg, border: `1px solid ${kpi.border}` }}>
                  <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-sm font-semibold mt-1" style={{ color: kpi.color }}>{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Placeholder content */}
            <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              <div className="px-6 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid #E2E8F0' }}>
                <ShieldCheck size={16} style={{ color: '#0369A1' }} />
                <h3 className="font-semibold" style={{ color: '#0F172A' }}>Modulo de Prevencion y Calidad</h3>
              </div>
              <div className="px-6 py-16 text-center">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#EFF6FF' }}>
                  <ShieldCheck size={32} style={{ color: '#0369A1' }} />
                </div>
                <p className="text-base font-semibold mb-2" style={{ color: '#1E293B' }}>Modulo en desarrollo</p>
                <p className="text-sm max-w-md mx-auto" style={{ color: '#94A3B8' }}>
                  Aqui se gestionaran evaluaciones de riesgos, registro de incidencias, auditorias internas
                  y acciones correctivas y preventivas (ACAP) para todas las sociedades.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {['Evaluacion de Riesgos', 'Registro de Incidencias', 'Auditorias Internas', 'Planes de Accion', 'Indicadores PRL', 'Documentacion ISO'].map((item) => (
                    <span key={item} className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: '#EFF6FF', color: '#0369A1', border: '1px solid #BFDBFE' }}>
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tags Tab */}
        {activeTab === 'tags' && (
          <TagsManager />
        )}

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <RolesManager />
        )}

        {/* Audit Tab */}
        {activeTab === 'audit' && (
          <AuditLogPanel />
        )}

        {activeTab === 'departamentos' && (
          <DepartamentosModule />
        )}

        {activeTab === 'email' && (
          <EmailModule />
        )}

        {activeTab === 'css' && (
          <CssPanel />
        )}

        {activeTab === 'incidencias' && currentUserId && (
          <IncidenciasModule
            currentUserId={currentUserId}
            currentUserNombre={currentUserNombre || email}
            currentUserRole="admin"
          />
        )}

        {activeTab === 'fichajes' && (
          <FichajesModule />
        )}

        {activeTab === 'permissions' && (
          <RoleTabPermissionsManager />
        )}
      </div>
    </div>
  );
}
