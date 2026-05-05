import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { login, signup } from '../lib/api'
import toast from 'react-hot-toast'
import { Zap, Eye, EyeOff, ArrowLeft } from 'lucide-react'
import axios from 'axios'

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'login') {
        const res = await login(email, password)
        const { access_token } = res.data
        const meRes = await axios.get('/api/users/me', {
          headers: { Authorization: `Bearer ${access_token}` }
        })
        setAuth(access_token, meRes.data)
        navigate('/app/dashboard')
      } else {
        await signup(email, password)
        toast.success('Account created — please sign in')
        setMode('login')
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined
      toast.error(msg ?? 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0b0e11] flex flex-col">
      {/* Back link */}
      <div className="p-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-[#848e9c] hover:text-[#eaecef] transition">
          <ArrowLeft size={13} /> Back to home
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        {/* Background grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(#f0b90b 1px, transparent 1px), linear-gradient(90deg, #f0b90b 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

        <div className="relative w-full max-w-sm">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#f0b90b]/10 border border-[#f0b90b]/30 flex items-center justify-center mb-3">
              <Zap size={28} className="text-[#f0b90b]" />
            </div>
            <h1 className="text-2xl font-bold text-[#eaecef] tracking-tight">FinAi</h1>
            <p className="text-[#848e9c] text-sm mt-1">AI-Powered Trading Platform</p>
          </div>

          {/* Card */}
          <div className="bg-[#161a1e] border border-[#2b3139] rounded-2xl p-6 shadow-2xl">
            {/* Tabs */}
            <div className="flex bg-[#0b0e11] rounded-xl p-1 mb-6">
              {(['login', 'signup'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === m ? 'bg-[#f0b90b] text-black' : 'text-[#848e9c] hover:text-[#eaecef]'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs text-[#848e9c] mb-1.5 font-medium">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition"
                />
              </div>
              <div>
                <label className="block text-xs text-[#848e9c] mb-1.5 font-medium">Password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    placeholder="••••••••"
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-4 py-3 pr-10 text-sm text-[#eaecef] placeholder-[#4a5568] focus:outline-none focus:border-[#f0b90b] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#eaecef]"
                  >
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold py-3 rounded-xl text-sm transition-all"
              >
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-[#2b3139]" />
              <span className="text-xs text-[#848e9c]">OR CONTINUE WITH</span>
              <div className="flex-1 h-px bg-[#2b3139]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {(['Google', 'Apple'] as const).map((provider) => (
                <button
                  key={provider}
                  onClick={() => toast('Coming soon')}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-[#2b3139] text-[#848e9c] hover:border-[#3c4451] hover:text-[#eaecef] text-sm transition"
                >
                  {provider === 'Google' ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                  )}
                  {provider}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
