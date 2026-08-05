import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { loadToken, saveToken, clearToken, SECURE_STORE_OK } from '../lib/api';
import { getMe } from '../lib/api';

export interface User {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  full_name?: string;
  phone?: string;
  dob?: string;
  sex?: string;
  address?: string;
  country?: string;
  balance_usdt?: number;
  tier?: number;
  account_tier?: number;
  is_admin?: boolean;
  avatar_url?: string;
  profile_photo?: string;
  is_mail_verified?: boolean;
  kyc_status?: string;
  profile_locked?: boolean;
  notification_preferences?: Record<string, unknown>;
  created_at?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (u: User) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await loadToken();
        if (stored) {
          setToken(stored);
          const res = await getMe();
          setUser(res.data);
        }
      } catch {
        await clearToken();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (newToken: string) => {
    await saveToken(newToken);
    setToken(newToken);
    const res = await getMe();
    setUser(res.data);
  };

  const logout = async () => {
    await clearToken();
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const res = await getMe();
      setUser(res.data);
    } catch {}
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
