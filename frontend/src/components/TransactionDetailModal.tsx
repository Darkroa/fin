import { X, AlertTriangle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface TxDetail {
  id: number
  type: string
  label?: string
  fields: { key: string; value: string; color?: string }[]
  created_at?: string
}

function genTxId(id: number, createdAt?: string): string {
  try {
    const ts = createdAt ? Math.floor(new Date(createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000)
    const n = (BigInt(id) * 7919011n + BigInt(ts) * 1337n + 5662726000000n) % 10000000000000000n
    return n.toString().padStart(16, '0')
  } catch {
    return String(id * 7919011 + 5662726000000).slice(0, 16)
  }
}

interface Props {
  detail: TxDetail | null
  onClose: () => void
}

export default function TransactionDetailModal({ detail, onClose }: Props) {
  const navigate = useNavigate()
  if (!detail) return null

  const txId = genTxId(detail.id, detail.created_at)
  const dateStr = detail.created_at
    ? new Date(detail.created_at).toLocaleString('en-US', {
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
      }) + ' UTC'
    : '—'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#161a1e] border border-[#2b3139] rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

        {/* Close button */}
        <button onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-full bg-[#2b3139] flex items-center justify-center text-[#848e9c] hover:text-[#eaecef] hover:bg-[#3c4451] transition z-10">
          <X size={13} />
        </button>

        {/* Header */}
        <div className="flex flex-col items-center pt-7 pb-4 px-5 border-b border-[#2b3139]">
          <div className="w-12 h-12 rounded-2xl bg-[#f0b90b] flex items-center justify-center mb-3 shadow-lg shadow-[#f0b90b]/30">
            <span className="text-black text-2xl font-black leading-none">⚡</span>
          </div>
          <p className="text-[10px] text-[#848e9c] font-medium uppercase tracking-widest mb-1">ChatFin</p>
          <h2 className="text-base font-bold text-[#eaecef]">{detail.label ?? detail.type}</h2>
        </div>

        {/* Fields */}
        <div className="divide-y divide-[#2b3139]/60 px-5">
          {detail.fields.map(f => (
            <div key={f.key} className="flex items-center justify-between py-3">
              <span className="text-xs text-[#848e9c]">{f.key}</span>
              <span className={`text-xs font-semibold font-mono text-right max-w-[55%] break-all ${f.color ?? 'text-[#eaecef]'}`}>
                {f.value}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between py-3">
            <span className="text-xs text-[#848e9c]">Time / Date</span>
            <span className="text-xs font-semibold font-mono text-[#eaecef]">{dateStr}</span>
          </div>
          <div className="flex items-start justify-between py-3">
            <span className="text-xs text-[#848e9c]">Transaction ID</span>
            <span className="text-[10px] font-mono text-[#f0b90b] break-all text-right max-w-[60%]">{txId}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 pt-3">
          <button
            onClick={() => {
              onClose()
              navigate('/app/support')
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[#f6465d]/30 bg-[#f6465d]/5 text-[#f6465d] hover:bg-[#f6465d]/15 text-xs font-semibold transition">
            <AlertTriangle size={13} /> Report Issue
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Helper builders ──────────────────────────────────────────────────────────

export function buildTxDetail(tx: {
  id: number; tx_type: string; method?: string; asset?: string
  amount_usdt: number; status: string; note?: string
  tx_hash?: string; wallet_address?: string; created_at: string
  recipient_user_id?: number
}): TxDetail {
  const typeLabel: Record<string, string> = {
    deposit: 'Deposit', withdrawal: 'Withdrawal',
    p2p_send: 'P2P Transfer', p2p_receive: 'P2P Received',
    trade: 'Trade', vps: 'VPS Rental', asset: 'Asset Purchase',
  }
  const amtColor = ['deposit','p2p_receive'].includes(tx.tx_type) ? 'text-[#0ecb81]' : 'text-[#f6465d]'
  const fields: TxDetail['fields'] = [
    { key: 'Type', value: typeLabel[tx.tx_type] ?? tx.tx_type },
    { key: 'Amount', value: `$${tx.amount_usdt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT`, color: amtColor },
    { key: 'Asset', value: tx.asset ?? 'USDT' },
    { key: 'Method', value: (tx.method ?? '—').replace(/_/g, ' ').toUpperCase() },
    { key: 'Status', value: tx.status.toUpperCase(), color: tx.status === 'approved' || tx.status === 'completed' ? 'text-[#0ecb81]' : tx.status === 'pending' ? 'text-[#f0b90b]' : 'text-[#f6465d]' },
  ]
  if (tx.wallet_address) fields.push({ key: 'To Address', value: tx.wallet_address })
  if (tx.tx_hash) fields.push({ key: 'TX Hash', value: tx.tx_hash })
  if (tx.note) fields.push({ key: 'Note', value: tx.note })
  return { id: tx.id, type: typeLabel[tx.tx_type] ?? tx.tx_type, label: typeLabel[tx.tx_type], fields, created_at: tx.created_at }
}

export function buildBotTradeDetail(t: {
  id: number; ticker: string; action: string; price: number; qty: number
  pnl: number | null; reason?: string | null; exchange?: string; created_at: string
}): TxDetail {
  const isBuy  = t.action === 'BUY'
  const pnlStr = t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'
  const fields: TxDetail['fields'] = [
    { key: 'Type', value: isBuy ? 'Bot BUY' : 'Bot SELL', color: isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
    { key: 'Order', value: t.ticker },
    { key: 'Entry Price', value: `$${t.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}` },
    { key: 'Quantity', value: String(t.qty) },
    { key: 'Realized PnL', value: pnlStr, color: t.pnl !== null ? (t.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]') : undefined },
    { key: 'Strategy', value: (t.reason ?? 'AI Bot').replace(/_/g, ' ') },
    { key: 'Exchange', value: t.exchange ?? 'Platform' },
  ]
  return { id: t.id, type: 'Bot Trade', label: `${isBuy ? 'Bot BUY' : 'Bot SELL'} — ${t.ticker}`, fields, created_at: t.created_at }
}

export function buildTradeDetail(t: {
  id: number; ticker: string; action: string; price: number; qty: number
  pnl: number | null; reason?: string | null; exchange?: string
  leverage?: number; stop_loss?: number; take_profit?: number; created_at: string
}): TxDetail {
  const isBuy  = t.action === 'BUY'
  const pnlStr = t.pnl !== null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—'
  const fee    = (t.price * t.qty * 0.0005).toFixed(4)
  const fields: TxDetail['fields'] = [
    { key: 'Type', value: isBuy ? 'Buy' : 'Sell', color: isBuy ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
    { key: 'Order', value: t.ticker },
    { key: 'Entry', value: `$${t.price.toLocaleString('en-US', { maximumFractionDigits: 4 })}` },
    { key: 'Quantity', value: String(t.qty) },
    { key: 'Realized PnL', value: pnlStr, color: t.pnl !== null ? (t.pnl >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]') : undefined },
    { key: 'Leverage', value: t.leverage && t.leverage > 1 ? `${t.leverage}x` : '1x (Spot)' },
    { key: 'Transaction Fee', value: `$${fee} (0.05%)` },
    { key: 'Exchange', value: t.exchange ?? 'Platform' },
  ]
  if (t.stop_loss) fields.push({ key: 'Stop Loss', value: `$${t.stop_loss}` })
  if (t.take_profit) fields.push({ key: 'Take Profit', value: `$${t.take_profit}` })
  return { id: t.id, type: isBuy ? 'Buy' : 'Sell', label: `${isBuy ? 'Buy' : 'Sell'} — ${t.ticker}`, fields, created_at: t.created_at }
}
