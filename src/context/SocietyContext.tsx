import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { societies as staticSocieties, type SocietyTheme } from '../themes';
import { supabase } from '../supabaseClient';

interface SocietyContextValue {
  activeSocietyId: string;
  setActiveSocietyId: (id: string) => void;
  societies: SocietyTheme[];
}

const STORAGE_KEY = 'portal-active-society';

// Merge DB society names + color overrides into static theme definitions
function mergeSocieties(
  dbRows: { id: string; nombre: string }[],
  colorOverrides: Record<string, { primary: string; gradientFrom: string; gradientTo: string }>
): SocietyTheme[] {
  return staticSocieties.map((s) => {
    const dbRow = dbRows.find((r) => r.id === s.id);
    const colors = colorOverrides[s.id];
    return {
      ...s,
      ...(dbRow ? { name: dbRow.nombre } : {}),
      ...(colors ? {
        primary: colors.primary,
        primaryDark: colors.gradientTo,
        gradientFrom: colors.gradientFrom,
        gradientTo: colors.gradientTo,
      } : {}),
    };
  });
}

const SocietyContext = createContext<SocietyContextValue>({
  activeSocietyId: staticSocieties[0].id,
  setActiveSocietyId: () => {},
  societies: staticSocieties,
});

export function SocietyProvider({ children, defaultSocietyId }: { children: ReactNode; defaultSocietyId?: string }) {
  const [societies, setSocieties] = useState<SocietyTheme[]>(staticSocieties);
  const [activeSocietyId, setActiveSocietyIdState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
    return defaultSocietyId ?? staticSocieties[0].id;
  });

  // Load real names and color overrides from Supabase on mount
  useEffect(() => {
    Promise.all([
      supabase.from('sociedades').select('id, nombre'),
      supabase.from('ui_settings').select('key, value'),
    ]).then(([{ data: socData }, { data: uiData }]) => {
      const colorOverrides: Record<string, { primary: string; gradientFrom: string; gradientTo: string }> = {};
      for (const row of (uiData ?? [])) {
        const m = row.key.match(/^society_color_(.+)$/);
        if (m) {
          try { colorOverrides[m[1]] = JSON.parse(row.value); } catch { /* skip */ }
        }
      }
      if (socData && socData.length > 0) {
        setSocieties(mergeSocieties(socData, colorOverrides));
      } else if (Object.keys(colorOverrides).length > 0) {
        setSocieties(mergeSocieties([], colorOverrides));
      }
    });
  }, []);

  useEffect(() => {
    if (defaultSocietyId && !localStorage.getItem(STORAGE_KEY)) {
      setActiveSocietyIdState(defaultSocietyId);
    }
  }, [defaultSocietyId]);

  const setActiveSocietyId = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveSocietyIdState(id);
  };

  return (
    <SocietyContext.Provider value={{ activeSocietyId, setActiveSocietyId, societies }}>
      {children}
    </SocietyContext.Provider>
  );
}

export const useSociety = () => useContext(SocietyContext);
