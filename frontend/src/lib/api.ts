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
export const signup = (email: string, password: string) =>
  api.post('/auth/signup', { email, password })
export const getMe = () => api.get('/users/me')

// Profile / KYC
export const updateProfile = (data: Record<string, unknown>) =>
  api.post('/users/update-profile', data)
export const uploadPhoto = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return api.post('/users/upload-photo', form, { headers: { 'Content-Type': 'multipart/form-data' } })
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

// Notifications
export const getUserNotifications = () => api.get('/notifications')
export const markNotificationRead = (id: number) => api.post(`/notifications/${id}/read`)
export const markAllNotificationsRead = () => api.post('/notifications/read-all')

// Support
export const createSupportTicket = (data: { subject: string; message: string; priority?: string }) =>
  api.post('/support/tickets', data)
export const getSupportTickets = () => api.get('/support/tickets')
export const getTicketMessages = (id: number) => api.get(`/support/tickets/${id}`)
export const replyToTicket = (ticket_id: number, message: string) =>
  api.post(`/support/tickets/${ticket_id}/reply`, { ticket_id, message })

// Bot (JWT-authenticated via /bots)
export const getBotStatus = () => api.get('/bots/status')
export const startBot = (ticker = 'BTC-USD') => api.post(`/bots/start?ticker=${encodeURIComponent(ticker)}`)
export const stopBot = () => api.post('/bots/stop')
export const getBotTrades = (limit = 20) => api.get(`/bots/trades?limit=${limit}`)

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

// Health
export const getHealth = () => api.get('/health')
