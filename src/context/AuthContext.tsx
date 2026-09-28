/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Authentication Context
   Manages analyst authorization via real FastAPI backend JWT
   ═══════════════════════════════════════════════════════ */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { loginAdmin, getMe } from '../services/apiClient';

export interface AnalystUser {
  id: string;
  email: string;
  role: string;
  name: string;
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
      if (storedToken) {
        // Decode token to verify and restore user state
        const decoded = jwtDecode<{ sub: string; email: string; role: string; exp: number }>(storedToken);
        
        // Basic check if token is expired (jwt-decode gives exp in seconds)
        if (decoded.exp * 1000 < Date.now()) {
          throw new Error('Token expired');
        }

        const userName = decoded.email.includes('sharma')
          ? 'Dr. Rajesh Sharma'
          : decoded.email.includes('priya')
          ? 'Priya Narang'
          : 'Duty Analyst';

        const displayRole = decoded.role === 'senior_admin' || decoded.email.includes('sharma')
          ? 'Senior Duty Forecaster'
          : 'Meteorological Triage Officer';

        setIsAdmin(true);
        setUser({
          id: decoded.sub,
          email: decoded.email,
          role: displayRole,
          name: userName,
          badge: 'IMD National Radar HQ',
          token: storedToken,
        });

        // Optionally, verify token is still valid with backend
        getMe().catch(() => {
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          setIsAdmin(false);
          setUser(null);
        });
      }
    } catch (e) {
      console.warn('Failed to parse cached auth state:', e);
      localStorage.removeItem(STORAGE_TOKEN_KEY);
      setIsAdmin(false);
      setUser(null);
    }
  }, []);

  const login = async (email: string, password?: string): Promise<void> => {
    // Call real backend /v1/auth/login
    const response = await loginAdmin({
      email,
      password: password || '',
    });

    const decoded = jwtDecode<{ sub: string; email: string; role: string }>(response.token);

    const userName = decoded.email.includes('sharma')
      ? 'Dr. Rajesh Sharma'
      : decoded.email.includes('priya')
      ? 'Priya Narang'
      : 'Duty Analyst';

    const displayRole = decoded.role === 'senior_admin' || decoded.email.includes('sharma')
      ? 'Senior Duty Forecaster'
      : 'Meteorological Triage Officer';

    const userProfile: AnalystUser = {
      id: decoded.sub,
      email: decoded.email,
      role: displayRole,
      name: userName,
      badge: 'IMD National Radar HQ',
      token: response.token,
    };

    localStorage.setItem(STORAGE_TOKEN_KEY, response.token);

    setIsAdmin(true);
    setUser(userProfile);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_TOKEN_KEY);
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
