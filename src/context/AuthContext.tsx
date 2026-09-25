/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Authentication Context
   Manages analyst authorization, mock JWT token & session state
   ═══════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export interface AnalystUser {
  email: string;
  name: string;
  role: string;
  badge: string;
  token: string;
}

interface AuthContextType {
  isAdmin: boolean;
  user: AnalystUser | null;
  isLoginModalOpen: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => void;
  openLoginModal: () => void;
  closeLoginModal: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_TOKEN_KEY = 'admin_token';
const STORAGE_USER_KEY = 'admin_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [user, setUser] = useState<AnalystUser | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);

  // Rehydrate auth state on mount
  useEffect(() => {
    try {
      const storedToken = localStorage.getItem(STORAGE_TOKEN_KEY);
      const storedUser = localStorage.getItem(STORAGE_USER_KEY);
      if (storedToken && storedUser) {
        setIsAdmin(true);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.warn('Failed to parse cached auth state:', e);
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      localStorage.removeItem(STORAGE_USER_KEY);
    }
  }, []);

  const login = async (email: string, _password?: string): Promise<void> => {
    // Generate realistic mock JWT
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
      JSON.stringify({
        sub: email,
        iss: 'imd.gov.in/skysignal-auth',
        role: 'meteorological_analyst',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 86400,
      })
    );
    const signature = 'c2t5c2lnbmFsX3NpZ2hhdHVyZV8yMDI2';
    const mockToken = `${header}.${payload}.${signature}`;

    const userName = email.includes('sharma')
      ? 'Dr. Rajesh Sharma'
      : email.includes('priya')
      ? 'Priya Narang'
      : 'Duty Analyst';

    const userRole = email.includes('sharma')
      ? 'Senior Duty Forecaster'
      : 'Meteorological Triage Officer';

    const userProfile: AnalystUser = {
      email,
      name: userName,
      role: userRole,
      badge: 'IMD National Radar HQ',
      token: mockToken,
    };

    localStorage.setItem(STORAGE_TOKEN_KEY, mockToken);
    localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(userProfile));

    setIsAdmin(true);
    setUser(userProfile);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    localStorage.removeItem(STORAGE_USER_KEY);
    setIsAdmin(false);
    setUser(null);
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <AuthContext.Provider
      value={{
        isAdmin,
        user,
        isLoginModalOpen,
        login,
        logout,
        openLoginModal,
        closeLoginModal,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
