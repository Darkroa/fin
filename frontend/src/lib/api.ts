import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url: string = err.config?.url ?? ''
    if (err.response?.status === 401 && !url.includes('/public/')) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export default api

// Auth
export const login = (email: string, password: string) =>
  api.post('/auth/login', { email, password })
export const signup = (email: string, password: string, referral_code?: string) =>
  api.post('/auth/signup', { email, password, ...(referral_code ? { referral_code } : {}) })
export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email })
export const resetPassword = (email: string, code: string, new_password: string) =>
  api.post('/auth/reset-password', { email, code, new_password })
export const getMe = () => api.get('/users/me')

// Profile / KYC
export const updateProfile = (data: Record<string, unknown>) =>
  api.post('/users/update-profile', data)
export const uploadPhoto = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/users/upload-photo', form)
}
export const sendVerifyEmail = () => api.post('/users/send-verify-email')
export const verifyEmail = (code: string) => api.post('/users/verify-email', { code })
export const submitKYC = () => api.post('/users/submit-kyc')
export const connectExchange = (data: Record<string, unknown>) =>
  api.post('/users/exchange-connect', data)
export const disconnectExchange = (exchange: string) =>
  api.delete(`/users/exchange-disconnect/${exchange}`)

// Wallet
export const getWalletConfig = () => api.get('/wallet/config')
export const requestDeposit = (data: Record<string, unknown>) =>
  api.post('/wallet/deposit', data)
export const requestWithdrawal = (data: Record<string, unknown>) =>
  api.post('/wallet/withdraw', data)
export const p2pSend = (data: Record<string, unknown>) =>
  api.post('/wallet/p2p', data)
export const getMyTransactions = () => api.get('/wallet/transactions')

// Events
export const getEvents = (limit = 20) => api.get(`/events?limit=${limit}`)

// API Keys
export const createApiKey = (key_name: string, purpose = 'bot', expires_days = 365) =>
  api.post(`/api-keys?key_name=${encodeURIComponent(key_name)}&purpose=${purpose}&expires_days=${expires_days}`)
export const listApiKeys = () => api.get('/api-keys')
export const revokeApiKey = (id: number) => api.delete(`/api-keys/${id}`)

// Admin
export const adminGetUsers = () => api.get('/admin/users')
export const adminUpdateUser = (data: Record<string, unknown>) =>
  api.post('/admin/update-user', data)
export const adminDeleteUser = (email: string) =>
  api.post('/admin/delete-user', null, { params: { email } })
export const adminGetTransactions = () => api.get('/admin/transactions')
export const adminApproveTransaction = (transaction_id: string, tx_hash?: string) =>
  api.post('/admin/approve-transaction', { transaction_id, tx_hash })
export const adminRejectTransaction = (transaction_id: string) =>
  api.post('/admin/reject-transaction', { transaction_id })
export const cancelDeposit = (txId: number) => api.delete(`/wallet/deposits/${txId}`)
export const getWithdrawalMethods = () => api.get('/users/withdrawal-methods')
export const saveWithdrawalMethods = (methods: object[]) => api.post('/users/withdrawal-methods', { methods })
export const adminGetWalletConfig = () => api.get('/admin/wallet-config')
export const adminUpdateWalletConfig = (data: { key: string; value: string; label?: string }) =>
  api.post('/admin/wallet-config', data)
export const adminGetApiKeyUsers = () => api.get('/admin/api-key-users')
export const adminPushNotification = (payload: {
  title: string; message: string; target_all: boolean; target_user_id?: number | null
}) => api.post('/admin/notifications', payload)
export const adminGetNotifications = () => api.get('/admin/notifications')
export const adminGetSupportTickets = () => api.get('/admin/support-tickets')
export const adminGetTicket = (id: number) => api.get(`/admin/support-tickets/${id}`)
export const adminReplyTicket = (ticket_id: number, message: string) =>
  api.post('/admin/support-reply', { ticket_id, message })
export const adminUpdateTicketStatus = (id: number, status: string) =>
  api.post(`/admin/support-tickets/${id}/status?new_status=${status}`)
export const adminHealthCheck = () => api.get('/admin/health')

// Admin — Subscription requests
export const adminGetSubscriptions = () => api.get('/admin/subscriptions')
export const adminApproveSubscription = (sub_id: number) =>
  api.post('/admin/approve-subscription', { sub_id })
export const adminRejectSubscription = (sub_id: number, note?: string) =>
  api.post('/admin/reject-subscription', { sub_id, note })

// Notifications
export const getUserNotifications = () => api.get('/notifications')
export const markNotificationRead = (id: number) => api.post(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.post('/notifications/read-all')
export const deleteNotification = (id: number) => api.delete(`/notifications/${id}`)
export const clearReadNotifications = () => api.delete('/notifications/clear-read')

// Support
export const createSupportTicket = (data: { subject: string; message: string; priority?: string }) =>
  api.post('/support/tickets', data)
export const getSupportTickets = () => api.get('/support/tickets')
export const getTicketMessages = (id: number) => api.get(`/support/tickets/${id}`)
export const replyToTicket = (ticket_id: number, message: string) =>
  api.post(`/support/tickets/${ticket_id}/reply`, { ticket_id, message })

// Bot (JWT-authenticated via /bots)
export const getBotStatus = () => api.get('/bots/status')
export const startBot = (params: {
  ticker?: string
  paper?: boolean
  initial_capital?: number
  risk_per_trade_pct?: number
  max_drawdown_pct?: number
  exchange_label?: string
  strategy?: string
  take_profit_pct?: number
  stop_loss_pct?: number
  direction?: string
  bot_name?: string
  leverage?: number
  lot_size?: number
  sl_usdt?: number
}) => api.post('/bots/start', {
  ticker:             params.ticker            ?? 'BTC-USD',
  paper:              params.paper             ?? false,
  initial_capital:    params.initial_capital   ?? 200,
  risk_per_trade_pct: params.risk_per_trade_pct ?? 100,
  max_drawdown_pct:   params.max_drawdown_pct  ?? 25.0,
  exchange_label:     params.exchange_label,
  strategy:           params.strategy          ?? 'finlux',
  take_profit_pct:    params.take_profit_pct   ?? 50.0,
  stop_loss_pct:      params.stop_loss_pct     ?? 30.0,
  direction:          params.direction         ?? 'auto',
  bot_name:           params.bot_name,
  leverage:           params.leverage          ?? 10,
  lot_size:           params.lot_size          ?? 1,
  sl_usdt:            params.sl_usdt,
})
export const stopBot = (botId = 'ALL') => api.post(`/bots/stop?ticker=${encodeURIComponent(botId)}`)
export const closeBotPosition = (bot_id: string) => api.post('/bots/close-position', { bot_id })
export const getBotTrades = (limit = 20) => api.get(`/bots/trades?limit=${limit}`)
export const updateBotParams = (data: {
  default_capital?: number
  risk_per_trade?: number
  max_drawdown?: number
  preferred_tickers?: string[]
}) => api.post('/bots/update-params', data)

export const getOpenPositions = () => api.get('/trade/open-positions')
export const closeManualTrade = (trade_id: number) => api.post(`/trade/close/${trade_id}`)

// Trade execution
export const executeTrade = (data: {
  pair: string
  side: string
  order_type: string
  price: number
  amount: number
  paper?: boolean
  exchange_label?: string
  stop_loss?: number
  take_profit?: number
  leverage?: number
  lot_size?: number
}) => api.post('/trade/execute', data)

// Security — change password / PIN / delete request
export const changePassword = (current_password: string, new_password: string) =>
  api.post('/users/change-password', { current_password, new_password })
export const setTransferPin = (pin: string) =>
  api.post('/users/set-transfer-pin', { pin })
export const requestDeleteAccount = () =>
  api.post('/users/request-delete')

// Webhook settings (Telegram / WhatsApp)
export const saveWebhookSettings = (data: {
  telegram_bot_token?: string
  telegram_chat_id?: string
  whatsapp_number?: string
}) => api.post('/users/save-webhook', data)

// WhatsApp — generate code (user sends code to +14155238886 on WhatsApp)
export const generateWhatsAppCode = () =>
  api.post('/users/whatsapp-generate-code')
export const disconnectTelegram = () =>
  api.post('/users/disconnect-telegram')
export const disconnectWhatsApp = () =>
  api.post('/users/disconnect-whatsapp')

// WhatsApp phone verification (legacy, kept for compat)
export const sendWhatsAppCode = (phone: string) =>
  api.post('/users/send-whatsapp-code', { phone })
export const verifyWhatsApp = (code: string) =>
  api.post('/users/verify-whatsapp', { code })

// Telegram — auto-detect chat ID from bot token
export const getTelegramChatId = (token: string) =>
  api.get(`/users/telegram-chatid?token=${encodeURIComponent(token)}`)

// Notification preferences
export const updateNotificationPreferences = (prefs: Record<string, unknown>) =>
  api.post('/users/notification-preferences', prefs)

// Health
export const getHealth = () => api.get('/health')

// Stats
export const getTodayPnl = () => api.get('/stats/today-pnl')
export const getBotPnlHistory = (days = 30) => api.get(`/bots/pnl-history?days=${days}`)
export const getSubscriptionLimits = () => api.get('/subscription/limits')

// Price Alerts
export const listAlerts = () => api.get('/alerts')
export const createAlert = (data: {
  symbol: string; target_price: number; direction: string;
  notify_browser?: boolean; notify_telegram?: boolean; notify_whatsapp?: boolean
}) => api.post('/alerts', data)
export const deleteAlert = (id: number) => api.delete(`/alerts/${id}`)
export const toggleAlert = (id: number) => api.post(`/alerts/${id}/toggle`)

// Telegram — generate link code for @FinAitradebot
export const generateTelegramCode = () => api.post('/users/telegram-generate-code')

// Subscription request
export const requestSubscription = (data: {
  plan: string
  period: string
  amount_usdt: number
  payment_method: string
  auto_renew: boolean
}) => api.post('/subscribe', data)

// Trade execute with SL/TP/leverage
export const executeTradeAdvanced = (data: {
  pair: string
  side: string
  order_type: string
  price: number
  amount: number
  paper?: boolean
  exchange_label?: string
  stop_loss?: number | null
  take_profit?: number | null
  leverage?: number
  lot_size?: number | null
}) => api.post('/trade/execute', data)

// Visitor tracking beacon
export const trackVisitor = (sessionId: string, page: string) =>
  api.post('/visitors/track', { sessionId, page }).catch(() => {})

// FinEventAI Bot
export const finEventListBots = () => api.get('/bots/finevent/list')
export const finEventStart = (data: {
  bot_name?: string
  min_impact_score?: number
  tickers?: string[]
  capital_per_trade?: number
  max_trades_per_day?: number
  paper?: boolean
  sentiment_filter?: string
}) => api.post('/bots/finevent/start', data)

export const finEventStop = (botName = 'default') => api.post(`/bots/finevent/stop?bot_name=${encodeURIComponent(botName)}`)
export const finEventStatus = (botName = 'default') => api.get(`/bots/finevent/status?bot_name=${encodeURIComponent(botName)}`)
export const finEventTrades = (limit = 50) => api.get(`/bots/finevent/trades?limit=${limit}`)

// Referral
export const getReferralStats = () => api.get('/referral/stats')

// Admin Bonuses
export const getAdminBonuses = () => api.get('/admin/bonuses')
export const adminGrantBonus = (data: {
  title: string
  bonus_type: string
  amount_usdt: number
  target: string
  target_user_email?: string
  tier_required?: number
  note?: string
  task_description?: string
  require_claim?: boolean
  grant_now?: boolean
}) => api.post('/admin/bonuses/grant', data)
export const toggleAdminBonus = (id: number) => api.patch(`/admin/bonuses/${id}/toggle`)
export const deleteAdminBonus = (id: number) => api.delete(`/admin/bonuses/${id}`)
export const adminGetBonusClaims = () => api.get('/admin/bonus-claims')
export const adminRevokeBonusClaim = (claimId: number) => api.delete(`/admin/bonus-claims/${claimId}`)

// Admin Referrals
export const getAdminReferrals = () => api.get('/admin/referrals')
export const adminUpdateReferralCode = (userId: number, code: string) =>
  api.patch(`/admin/referrals/${userId}/code`, { referral_code: code })
export const adminResetReferralCode = (userId: number) =>
  api.delete(`/admin/referrals/${userId}/code`)

// Ads
export const getActiveAd = () => api.get('/ads/active')
export const getAllActiveAds = () => api.get('/ads/active-all')
export const adminGetUserActivity = (limit = 200) => api.get(`/admin/user-activity?limit=${limit}`)
export const adminClearUserActivity = () => api.delete('/admin/user-activity/clear')
export const adminGetAds = () => api.get('/admin/ads')
export const adminCreateAd = (data: { title: string; description?: string; ad_type?: string; image_base64?: string; link_url?: string; is_active?: boolean }) =>
  api.post('/admin/ads', data)
export const adminToggleAd = (id: number) => api.patch(`/admin/ads/${id}/toggle`)
export const adminGetUserDepositConfig = (userId: number) =>
  api.get(`/admin/users/${userId}/deposit-config`)
export const adminSetUserDepositConfig = (userId: number, data: Record<string, string>) =>
  api.post(`/admin/users/${userId}/deposit-config`, data)
export const getMyDepositConfig = () => api.get('/wallet/my-deposit-config')
export const getMyBonusTasks = () => api.get('/wallet/my-tasks')
export const claimBonusTask = (bonusId: number) => api.post(`/wallet/my-tasks/${bonusId}/claim`)
export const adminUpdateAd = (id: number, data: any) => api.patch(`/admin/ads/${id}`, data)
export const adminDeleteAd = (id: number) => api.delete(`/admin/ads/${id}`)

// Testimonials
export const adminGetTestimonials = () => api.get('/testimonials')
export const adminCreateTestimonial = (data: { name: string; role?: string; content: string; rating: number; avatar_initials?: string; avatar_color?: string }) => api.post('/admin/testimonials', data)
export const adminUpdateTestimonial = (id: number, data: { name: string; role?: string; content: string; rating: number; avatar_initials?: string; avatar_color?: string }) => api.put(`/admin/testimonials/${id}`, data)
export const adminToggleTestimonial = (id: number) => api.patch(`/admin/testimonials/${id}/toggle`)
export const adminDeleteTestimonial = (id: number) => api.delete(`/admin/testimonials/${id}`)

// VPS Plans & Asset Products (public)
export const getVpsPlans = () => api.get('/wallet/vps-plans')
export const getAssetProducts = () => api.get('/wallet/asset-products')

// Admin — Products management (VPS plans, assets, pricing)
export const adminSaveVpsPlans = (plans: unknown[]) =>
  api.post('/admin/wallet-config', { key: 'vps_plans', value: JSON.stringify(plans), label: 'VPS Plans' })
export const adminSaveAssetProducts = (products: unknown[]) =>
  api.post('/admin/wallet-config', { key: 'asset_products', value: JSON.stringify(products), label: 'Asset Products' })
export const adminSavePricingPlans = (plans: unknown[]) =>
  api.post('/admin/wallet-config', { key: 'pricing_plans', value: JSON.stringify(plans), label: 'Pricing Plans' })
export const getPricingPlans = () => api.get('/wallet/pricing-plans')
export const buyAsset = (data: { asset_id: number; name: string; price: number; start_date?: string; end_date?: string; roi_percent?: number }) =>
  api.post('/wallet/buy-asset', data)
export const rentVps = (data: { plan_id: number; name: string; price: number; start_date?: string; end_date?: string; roi_percent?: number }) =>
  api.post('/wallet/rent-vps', data)
export const updateLeverage = (data: { trade_leverage: number; bot_leverage: number }) =>
  api.post('/users/update-leverage', data)

export const closePurchase = (tx_id: number) =>
  api.post(`/wallet/close-purchase/${tx_id}`)

// ── Two-Factor Authentication (2FA) ──────────────────────────────────────────
export const setup2fa = (data: { tfa_method: string; recovery_email?: string }) =>
  api.post('/users/setup-2fa', data)

export const disable2fa = () => api.post('/users/disable-2fa', {})

export const verify2fa = (partial_token: string, code: string) =>
  api.post('/auth/verify-2fa', { partial_token, code })

export const resend2faCode = (partial_token: string) =>
  api.post('/auth/resend-2fa', { partial_token })
