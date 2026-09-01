import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, UserProfile, AppRole } from '../supabaseClient';

function getDeviceInfo(): string {
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod/i.test(ua);
  const tablet = /iPad|Android(?!.*Mobile)/i.test(ua);
  const type = tablet ? 'Tablet' : mobile ? 'Móvil' : 'Escritorio';
  const browser = /Edg/i.test(ua) ? 'Edge'
    : /Chrome/i.test(ua) ? 'Chrome'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Safari/i.test(ua) ? 'Safari'
    : 'Navegador';
  const os = /Windows/i.test(ua) ? 'Windows'
    : /Mac/i.test(ua) ? 'macOS'
    : /Android/i.test(ua) ? 'Android'
    : /iOS|iPhone|iPad/i.test(ua) ? 'iOS'
    : /Linux/i.test(ua) ? 'Linux'
    : 'Sistema';
  return `${type} · ${browser} · ${os}`;
}

let lastLoggedSessionId: string | null = null;

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      setProfile(data as UserProfile | null);
    } catch {
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          fetchProfile(s.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).catch(() => setProfile(null));
        if (event === 'SIGNED_IN' && lastLoggedSessionId !== s.access_token?.slice(0, 16)) {
          lastLoggedSessionId = s.access_token?.slice(0, 16) ?? null;
          const token = s.access_token?.slice(0, 16) ?? null;
          const deviceInfo = getDeviceInfo();
          const userAgent = navigator.userAgent;
          setTimeout(() => {
            (async () => {
              try {
                await supabase.rpc('log_access', {
                  p_ip_address: null,
                  p_device_info: deviceInfo,
                  p_user_agent: userAgent,
                  p_session_id: token,
                });
              } catch (e) {
                console.warn('log_access failed:', e);
              }
            })();
          }, 100);
        }
      } else {
        setProfile(null);
        lastLoggedSessionId = null;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export type { AppRole };
