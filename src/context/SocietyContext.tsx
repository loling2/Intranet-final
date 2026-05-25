import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { societies } from '../themes';

interface SocietyContextValue {
  activeSocietyId: string;
  setActiveSocietyId: (id: string) => void;
}

const STORAGE_KEY = 'portal-active-society';

const SocietyContext = createContext<SocietyContextValue>({
  activeSocietyId: societies[0].id,
  setActiveSocietyId: () => {},
});

export function SocietyProvider({ children, defaultSocietyId }: { children: ReactNode; defaultSocietyId?: string }) {
  const [activeSocietyId, setActiveSocietyIdState] = useState<string>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && societies.some((s) => s.id === stored)) return stored;
    return defaultSocietyId ?? societies[0].id;
  });

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
    <SocietyContext.Provider value={{ activeSocietyId, setActiveSocietyId }}>
      {children}
    </SocietyContext.Provider>
  );
}

export const useSociety = () => useContext(SocietyContext);
