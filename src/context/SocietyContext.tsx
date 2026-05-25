import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { societies as staticSocieties, type SocietyTheme } from '../themes';
import { supabase } from '../supabaseClient';

interface SocietyContextValue {
  activeSocietyId: string;
  setActiveSocietyId: (id: string) => void;
  societies: SocietyTheme[];
}

const STORAGE_KEY = 'portal-active-society';

// Merge DB society names into static theme definitions by matching ID
function mergeSocieties(dbRows: { id: string; nombre: string }[]): SocietyTheme[] {
  return staticSocieties.map((s) => {
    const dbRow = dbRows.find((r) => r.id === s.id);
    return dbRow ? { ...s, name: dbRow.nombre } : s;
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

  // Load real names from Supabase on mount
  useEffect(() => {
    supabase.from('sociedades').select('id, nombre').then(({ data }) => {
      if (data && data.length > 0) {
        setSocieties(mergeSocieties(data));
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
