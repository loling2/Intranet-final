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

export const societies: SocietyTheme[] = [
  {
    id: 'alfa',
    name: 'Sociedad Alfa',
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
    id: 'beta',
    name: 'Sociedad Beta',
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
    logoLetter: 'B',
    logoIcon: 'landmark',
  },
  {
    id: 'gamma',
    name: 'Sociedad Gamma',
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
    logoLetter: 'G',
    logoIcon: 'gem',
  },
  {
    id: 'delta',
    name: 'Sociedad Delta',
    primary: '#0F766E',
    primaryDark: '#115E59',
    primaryLight: '#F0FDFA',
    accent: '#E11D48',
    bg: '#F0FDFA',
    bgCard: '#FFFFFF',
    textPrimary: '#134E4A',
    textSecondary: '#5EEAD4',
    border: '#99F6E4',
    gradientFrom: '#0F766E',
    gradientTo: '#115E59',
    logoLetter: 'D',
    logoIcon: 'shield',
  },
];
