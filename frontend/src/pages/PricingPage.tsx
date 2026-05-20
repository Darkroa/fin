import { useNavigate } from 'react-router-dom'
import { Check, Zap, Crown, Star, Infinity, Phone } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const plans = [
  {
    name: 'Free',
    price: 0,
    period: 'Forever free',
    icon: Zap,
    color: '#848e9c',
    highlight: false,
    features: [
      '1 AI trading bot',
      '1 API key',
      'Basic market data',
      'Email alerts',
      'Community support',
      '$500/day withdrawal limit',
    ],
    cta: 'Current Plan',
    tier: 'free',
  },
  {
    name: 'Pro',
    price: 500,
    period: '/month',
    icon: Star,
    color: '#f0b90b',
    highlight: true,
    features: [
      '10 AI trading bots',
      '5 API keys',
      'Live market data',
      'Telegram & WhatsApp alerts',
      'Priority support',
      '$5,000/day withdrawal limit',
    ],
    cta: 'Upgrade to Pro',
    tier: 'pro',
  },
  {
    name: 'Elite',
    price: 1000,
    period: '/month',
    icon: Crown,
    color: '#0ecb81',
    highlight: false,
    features: [
      '20 AI trading bots',
      '20 API keys',
      'VPS hosting included',
      'Custom strategy builder',
      'Dedicated support manager',
      'Unlimited withdrawals',
    ],
    cta: 'Upgrade to Elite',
    tier: 'elite',
  },
  {
    name: 'Elite+',
    price: 2000,
    period: '/month',
    icon: Crown,
    color: '#a855f7',
    highlight: false,
    features: [
      '40 AI trading bots',
      '40 API keys',
      'All Elite features',
      'White-label option',
      'SLA guarantee (99.9%)',
      'Dedicated infrastructure',
    ],
    cta: 'Upgrade to Elite+',
    tier: 'elite_plus',
  },
  {
    name: 'Custom',
    price: -1,
    period: 'Contact us',
    icon: Infinity,
    color: '#4a5568',
    highlight: false,
    features: [
      'Unlimited bots & API keys',
      'Custom infrastructure',
      'On-premise deployment',
      'Enterprise SLA',
      'Dedicated engineering team',
      'Custom integrations',
    ],
    cta: 'Contact Sales',
    tier: 'custom',
  },
]

const comparisons = [
  { feature: 'AI Trading Bots',    free: '1',        pro: '10',        elite: '20',       eliteplus: '40',       custom: 'Unlimited' },
  { feature: 'API Keys',           free: '1',        pro: '5',         elite: '20',       eliteplus: '40',       custom: 'Unlimited' },
  { feature: 'Live Market Data',   free: 'Basic',    pro: '✓',         elite: '✓',        eliteplus: '✓',        custom: '✓' },
  { feature: 'Telegram Alerts',    free: '—',        pro: '✓',         elite: '✓',        eliteplus: '✓',        custom: '✓' },
  { feature: 'WhatsApp Alerts',    free: '—',        pro: '✓',         elite: '✓',        eliteplus: '✓',        custom: '✓' },
  { feature: 'VPS Hosting',        free: '—',        pro: '—',         elite: '✓',        eliteplus: '✓',        custom: '✓' },
  { feature: 'Custom Strategies',  free: '—',        pro: '—',         elite: '✓',        eliteplus: '✓',        custom: '✓' },
  { feature: 'White-label',        free: '—',        pro: '—',         elite: '—',        eliteplus: '✓',        custom: '✓' },
  { feature: 'Withdrawal Limit',   free: '$500/day', pro: '$5k/day',   elite: 'Unlimited',eliteplus: 'Unlimited', custom: 'Unlimited' },
  { feature: 'Support',            free: 'Community',pro: 'Priority',  elite: 'Dedicated',eliteplus: 'SLA',       custom: 'Dedicated Team' },
]

export default function PricingPage() {
  const navigate = useNavigate()
  const { user }  = useAuthStore()
  const userSub   = (user as unknown as { subscription?: string })?.subscription ?? 'free'

  const handleSelect = (tier: string) => {
    if (tier === 'custom') {
      navigate('/app/support')
    } else if (tier === userSub || tier === 'free') {
      // already on this plan or free
    } else {
      navigate('/app/subscribe')
    }
  }

  return (
    <div className="space-y-8 pb-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-xl font-bold text-[#eaecef]">Plans &amp; Pricing</h1>
        <p className="text-sm text-[#848e9c]">Choose the plan that fits your trading ambitions.</p>
      </div>

      {/* Current plan banner */}
      {userSub && userSub !== 'free' && (
        <div className="bg-[#f0b90b]/8 border border-[#f0b90b]/20 rounded-xl px-4 py-3 flex items-center gap-3">
          <Crown size={14} className="text-[#f0b90b] flex-shrink-0" />
          <p className="text-sm text-[#eaecef]">
            You are on the <span className="font-bold text-[#f0b90b]">{userSub.toUpperCase()}</span> plan.
          </p>
        </div>
      )}

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {plans.map(plan => {
          const Icon      = plan.icon
          const isCurrent = plan.tier === userSub
          return (
            <div key={plan.name} className={[
              'relative rounded-xl border flex flex-col overflow-hidden transition-all',
              plan.highlight
                ? 'bg-[#1a1f26] border-[#f0b90b]/50 shadow-lg shadow-[#f0b90b]/8'
                : 'bg-[#161a1e] border-[#2b3139] hover:border-[#3c4451]',
            ].join(' ')}>
              {plan.highlight && (
                <div className="bg-[#f0b90b]/15 border-b border-[#f0b90b]/30 text-[#f0b90b] text-[10px] font-extrabold tracking-widest py-1.5 text-center uppercase">
                  ★ Most Popular
                </div>
              )}
              {isCurrent && (
                <div className="bg-[#0ecb81]/10 border-b border-[#0ecb81]/25 text-[#0ecb81] text-[10px] font-bold tracking-widest py-1.5 text-center uppercase">
                  ✓ Your Current Plan
                </div>
              )}
              <div className="p-5 flex flex-col flex-1 gap-4">
                {/* Title */}
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${plan.color}18` }}>
                    <Icon size={14} style={{ color: plan.color }} />
                  </div>
                  <h3 className="font-bold text-sm text-[#eaecef]">{plan.name}</h3>
                </div>

                {/* Price */}
                <div>
                  {plan.price === -1 ? (
                    <span className="text-2xl font-extrabold font-mono text-[#eaecef]">Custom</span>
                  ) : plan.price === 0 ? (
                    <span className="text-2xl font-extrabold font-mono text-[#eaecef]">Free</span>
                  ) : (
                    <div className="flex items-end gap-1">
                      <span className="text-2xl font-extrabold font-mono text-[#eaecef]">${plan.price.toLocaleString()}</span>
                      <span className="text-xs mb-1 text-[#848e9c]">{plan.period}</span>
                    </div>
                  )}
                  {plan.price !== -1 && <p className="text-[10px] text-[#4a5568] mt-0.5">{plan.period === 'Forever free' ? 'Forever free' : 'Billed monthly'}</p>}
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs">
                      <Check size={10} className="mt-0.5 flex-shrink-0 text-[#0ecb81]" />
                      <span className="text-[#848e9c]">{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => handleSelect(plan.tier)}
                  disabled={isCurrent}
                  className={[
                    'w-full py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-60 disabled:cursor-default',
                    isCurrent
                      ? 'bg-[#0ecb81]/10 text-[#0ecb81] border border-[#0ecb81]/25'
                      : plan.highlight
                        ? 'bg-[#f0b90b] hover:bg-[#d4a30a] text-black shadow-md shadow-[#f0b90b]/20 active:scale-[0.98]'
                        : 'bg-[#f0b90b]/8 hover:bg-[#f0b90b]/15 text-[#f0b90b] border border-[#f0b90b]/20 active:scale-[0.98]',
                  ].join(' ')}>
                  {isCurrent ? 'Current Plan' : plan.tier === 'custom' ? <span className="flex items-center justify-center gap-1.5"><Phone size={10} /> {plan.cta}</span> : plan.cta}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Comparison table */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#2b3139]">
          <h2 className="text-sm font-bold text-[#eaecef]">Feature Comparison</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[600px]">
            <thead>
              <tr className="border-b border-[#2b3139] text-[#848e9c]">
                <th className="text-left px-5 py-3 font-medium">Feature</th>
                {['Free','Pro','Elite','Elite+','Custom'].map(h => (
                  <th key={h} className="text-center px-3 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b3139]/50">
              {comparisons.map(row => (
                <tr key={row.feature} className="hover:bg-[#1e2329] transition">
                  <td className="px-5 py-2.5 text-[#848e9c]">{row.feature}</td>
                  {[row.free, row.pro, row.elite, row.eliteplus, row.custom].map((v, i) => (
                    <td key={i} className={`text-center px-3 py-2.5 font-mono ${v === '—' ? 'text-[#2b3139]' : v === '✓' ? 'text-[#0ecb81]' : 'text-[#eaecef]'}`}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ / note */}
      <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl px-5 py-4 text-xs text-[#848e9c] space-y-1.5">
        <p className="font-semibold text-[#eaecef] mb-2">Frequently Asked Questions</p>
        <p><span className="text-[#eaecef] font-medium">Can I upgrade at any time?</span> — Yes, upgrades take effect immediately.</p>
        <p><span className="text-[#eaecef] font-medium">Are there any trading fees?</span> — FinAi does not charge per-trade fees. Exchange fees apply.</p>
        <p><span className="text-[#eaecef] font-medium">What happens if I downgrade?</span> — Running bots above your new limit will be paused gracefully.</p>
        <p><span className="text-[#eaecef] font-medium">Need help choosing?</span> — <button onClick={() => navigate('/app/support')} className="text-[#f0b90b] underline underline-offset-2">Open a support ticket</button> and our team will guide you.</p>
      </div>
    </div>
  )
}
