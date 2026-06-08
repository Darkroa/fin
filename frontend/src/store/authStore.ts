import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface NotificationPreferences {
  email: boolean;
  whatsapp: boolean;
  telegram: boolean;
}

export interface User {
  id: number;
  email: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  full_name?: string;
  username?: string;
  phone?: string;
  dob?: string;
  sex?: string;
  address?: string;
  country?: string;
  profile_photo?: string;
  is_admin: boolean;
  is_active: boolean;
  is_mail_verified?: boolean;
  is_banned?: boolean;
  profile_locked?: boolean;
  account_tier?: number;
  kyc_status?: string;
  balance_usdt?: number;
  exchange_connections?: { exchange: string; label: string; api_key_masked: string }[];
  default_capital?: number;
  risk_per_trade?: number;
  max_drawdown?: number;
  created_at?: string;

  // Improved notification preferences
  notification_preferences?: NotificationPreferences;

  subscription?: string;
  telegram_chat_id?: string;
  whatsapp_number?: string;
  telegram_connected?: boolean;
  whatsapp_connected?: boolean;
  trade_leverage?: number;
  buy_leverage?: number;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      setUser: (user) => set({ user }),
      logout: () => set({ token: null, user: null }),
    }),
    { name: 'finai-auth' }
  )
);