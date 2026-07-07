import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { getMe } from '../lib/api';

interface User {
  id: number;
  email: string;
  username?: string;
  first_name?: string;
  full_name?: string;
  balance_usdt?: number;
  tier?: number;
  account_tier?: number;
  is_admin?: boolean;
  avatar_url?: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync('finai_token');
        if (stored) {
          setToken(stored);
          const res = await getMe();
          setUser(res.data);
        }
      } catch {
        await SecureStore.deleteItemAsync('finai_token');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = async (newToken: string) => {
    await SecureStore.setItemAsync('finai_token', newToken);
    setToken(newToken);
    const res = await getMe();
    setUser(res.data);
  };

  const logout = async () => {
    await SecureStore.deleteItemAsync('finai_token');
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
    <AuthContext.Provider value={{ user, token, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
