import { create } from 'zustand';

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

  notification_preferences?: NotificationPreferences;

  subscription?: string;
  telegram_chat_id?: string;
  whatsapp_number?: string;
  telegram_connected?: boolean;
  whatsapp_connected?: boolean;
  trade_leverage?: number;
  bot_leverage?: number;
}

interface AuthState {
  // Token is stored in memory only — never persisted to localStorage.
  // The browser session is authenticated via the httpOnly 'finai_access'
  // cookie set by the backend; this in-memory copy is used to send the JWT
  // over the WebSocket (which can't read httpOnly cookies) and is wiped
  // when the tab closes.
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => set({ token, user }),
  setUser: (user) => set({ user }),
  logout: () => set({ token: null, user: null }),
}));

// On full page load, re-hydrate the user from the cookie-authenticated API.
// The token stays null until /users/me succeeds, then we use the cookie
// for subsequent requests.
if (typeof window !== 'undefined') {
  // Lazy import to avoid circular deps in tests.
  import('../lib/api').then(({ getMe }) => {
    getMe()
      .then((res) => {
        const u = res.data as User;
        if (u && u.email) {
          useAuthStore.getState().setUser(u);
        }
      })
      .catch(() => { /* not logged in or cookie expired */ });
  });
}
