export interface SocietyTheme {
  id: string;
  name: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  accent: string;
  bg: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  border: string;
  gradientFrom: string;
  gradientTo: string;
  logoLetter: string;
  logoIcon: string;
}

// IDs sincronizados con la tabla `sociedades` de Supabase
export const societies: SocietyTheme[] = [
  {
    id: '85e3c3bc-a789-4b12-986c-ca91b8653f03',
    name: 'Apedeca',
    primary: '#0E7C6B',
    primaryDark: '#095E51',
    primaryLight: '#E6F5F2',
    accent: '#F59E0B',
    bg: '#F0FAF8',
    bgCard: '#FFFFFF',
    textPrimary: '#1A2E2A',
    textSecondary: '#5A7A74',
    border: '#B8DDD6',
    gradientFrom: '#0E7C6B',
    gradientTo: '#0A5E51',
    logoLetter: 'A',
    logoIcon: 'building-2',
  },
  {
    id: '78125129-dcb0-4f5a-b559-480379812b15',
    name: 'Eleda',
    primary: '#1D4ED8',
    primaryDark: '#1E3A8A',
    primaryLight: '#EFF6FF',
    accent: '#F97316',
    bg: '#F5F8FF',
    bgCard: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    border: '#BFDBFE',
    gradientFrom: '#1D4ED8',
    gradientTo: '#1E3A8A',
    logoLetter: 'E',
    logoIcon: 'landmark',
  },
  {
    id: 'fdb5114a-c6b4-4b3a-8eb9-420bd188ad52',
    name: 'Serca Gestion',
    primary: '#B45309',
    primaryDark: '#92400E',
    primaryLight: '#FFFBEB',
    accent: '#059669',
    bg: '#FFFAF0',
    bgCard: '#FFFFFF',
    textPrimary: '#2D1B06',
    textSecondary: '#92400E',
    border: '#FDE68A',
    gradientFrom: '#B45309',
    gradientTo: '#92400E',
    logoLetter: 'S',
    logoIcon: 'gem',
  },
  {
    id: '6632d8d1-c4e7-4540-aab7-515b9d7913f7',
    name: 'Gerontalia',
    primary: '#0F766E',
    primaryDark: '#115E59',
    primaryLight: '#F0FDFA',
    accent: '#E11D48',
    bg: '#F0FDFA',
    bgCard: '#FFFFFF',
    textPrimary: '#134E4A',
    textSecondary: '#0F766E',
    border: '#99F6E4',
    gradientFrom: '#0F766E',
    gradientTo: '#115E59',
    logoLetter: 'G',
    logoIcon: 'shield',
  },
];
