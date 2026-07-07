import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_BASE = 'https://fin--aifin.replit.app/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('finai_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => Promise.reject(err)
);

export default api;

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password });
export const signup = (email: string, password: string, referral_code?: string) =>
  api.post('/auth/signup', { email, password, ...(referral_code ? { referral_code } : {}) });
export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email });
export const verify2fa = (partial_token: string, code: string) =>
  api.post('/auth/verify-2fa', { partial_token, code });

// ── User ──────────────────────────────────────────────────────────────────────
export const getMe = () => api.get('/users/me');
export const updateProfile = (data: Record<string, unknown>) =>
  api.post('/users/update-profile', data);

// ── Wallet ────────────────────────────────────────────────────────────────────
export const getMyTransactions = () => api.get('/wallet/transactions');
export const getMyDepositConfig = () => api.get('/wallet/my-deposit-config');
export const requestDeposit = (data: Record<string, unknown>) =>
  api.post('/wallet/deposit', data);
export const requestWithdrawal = (data: Record<string, unknown>) =>
  api.post('/wallet/withdraw', data);
export const p2pSend = (data: Record<string, unknown>) =>
  api.post('/wallet/p2p', data);

// ── Stats ────────────────────────────────────────────────────────────────────
export const getTodayPnl = () => api.get('/stats/today-pnl');
export const getBotPnlHistory = (days = 30) =>
  api.get(`/bots/pnl-history?days=${days}`);

// ── Bots ──────────────────────────────────────────────────────────────────────
export const getBotStatus = () => api.get('/bots/status');
export const startBot = (params: {
  ticker?: string;
  paper?: boolean;
  initial_capital?: number;
  strategy?: string;
  take_profit_pct?: number;
  stop_loss_pct?: number;
  bot_name?: string;
}) =>
  api.post('/bots/start', {
    ticker: params.ticker ?? 'BTC-USD',
    paper: params.paper ?? true,
    initial_capital: params.initial_capital ?? 200,
    strategy: params.strategy ?? 'finlux',
    take_profit_pct: params.take_profit_pct ?? 50.0,
    stop_loss_pct: params.stop_loss_pct ?? 30.0,
    bot_name: params.bot_name,
  });
export const stopBot = (botId = 'ALL') =>
  api.post(`/bots/stop?ticker=${encodeURIComponent(botId)}`);
export const getBotTrades = (limit = 20) =>
  api.get(`/bots/trades?limit=${limit}`);

// FinEvent bots
export const finEventListBots = () => api.get('/bots/finevent/list');
export const finEventStart = (data: {
  bot_name?: string;
  capital_per_trade?: number;
}) => api.post('/bots/finevent/start', data);
export const finEventStop = (botName = 'default') =>
  api.post(`/bots/finevent/stop?bot_name=${encodeURIComponent(botName)}`);
export const finEventStatus = (botName = 'default') =>
  api.get(`/bots/finevent/status?bot_name=${encodeURIComponent(botName)}`);

// ── Positions ────────────────────────────────────────────────────────────────
export const getOpenPositions = () => api.get('/trade/open-positions');
export const closePosition = (position_id: number) =>
  api.post(`/trade/close/${position_id}`);

// ── Events ────────────────────────────────────────────────────────────────────
export const getEvents = (limit = 20) => api.get(`/events?limit=${limit}`);

// ── Markets ───────────────────────────────────────────────────────────────────
export const getMacroOverview = () => api.get('/public/macro/overview');

// ── AI Chat ───────────────────────────────────────────────────────────────────
export const chatWithAI = (message: string, history: unknown[]) =>
  api.post('/ai/chat', { message, history });

// ── Notifications ─────────────────────────────────────────────────────────────
export const getUserNotifications = () => api.get('/notifications');
export const markAllNotificationsRead = () =>
  api.post('/notifications/read-all');

// ── Health ───────────────────────────────────────────────────────────────────
export const getHealth = () => api.get('/health');
