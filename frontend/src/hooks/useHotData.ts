import { useEffect } from 'react'
import { useAuthStore } from '../store/authStore'

export function useHotData(): void {
  const token = useAuthStore(s => s.token)

  useEffect(() => {
    if (!token) return

    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(
      `${proto}://${window.location.host}/ws/live`
    )

    // Send the JWT as the first message after open instead of in the URL.
    // Putting it in the URL leaks it to nginx/cloudflare access logs and
    // browser history. Backend auth handler must read it from the first
    // frame and reply AUTH_OK before any subscription messages.
    ws.onopen = () => {
      try {
        ws.send(JSON.stringify({ type: 'auth', token }))
      } catch {
        ws.close()
      }
    }

    let alive = true

    ws.onmessage = (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data as string) as {
          type: string
          balance_usdt?: number
        }
        if (data.type === 'balance' && data.balance_usdt !== undefined && alive) {
          const current = useAuthStore.getState().user
          if (current) {
            useAuthStore.getState().setUser({ ...current, balance_usdt: data.balance_usdt })
          }
        }
      } catch {
        /* ignore parse errors */
      }
    }

    ws.onerror = () => {
      alive = false
      ws.close()
    }

    return () => {
      alive = false
      ws.close()
    }
  }, [token])
}
