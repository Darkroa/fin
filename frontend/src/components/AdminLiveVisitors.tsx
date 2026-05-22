import { useEffect, useState, useCallback } from "react"
import { Radio, MapPin, Clock, Monitor } from "lucide-react"
import api from "../lib/api"

type LiveSession = {
  sessionId: string
  ip: string | null
  country: string | null
  city: string | null
  currentPage: string
  firstSeen: string
  lastSeen: string
  timeSpentMs: number
  pagesVisited: string[]
}

type LiveData = {
  count: number
  sessions: LiveSession[]
}

function countryFlag(raw: string | null): { flag: string; name: string } {
  if (!raw) return { flag: "🌐", name: "Unknown" }
  const [code, ...nameParts] = raw.split("|")
  const name = nameParts.join("|") || code || "Unknown"
  const flag =
    (code ?? "").length === 2
      ? (code ?? "")
          .toUpperCase()
          .replace(/./g, (c) =>
            String.fromCodePoint((c.codePointAt(0) ?? 65) + 127397)
          )
      : "🌐"
  return { flag, name }
}

function formatDuration(ms: number): string {
  if (ms < 5000) return "just arrived"
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`
  if (ms < 3_600_000)
    return `${Math.round(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
  return `${Math.round(ms / 3_600_000)}h ${Math.round((ms % 3_600_000) / 60_000)}m`
}

function pageLabel(page: string): string {
  if (!page || page === "/") return "Home"
  return page
    .split("/")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" › ")
}

function pageBadgeClass(page: string): string {
  if (!page || page === "/") return "bg-[#f0b90b]/10 text-[#f0b90b]"
  if (page.includes("trade")) return "bg-[#0ecb81]/10 text-[#0ecb81]"
  if (page.includes("wallet")) return "bg-[#627eea]/10 text-[#627eea]"
  if (page.includes("bot")) return "bg-[#a78bfa]/10 text-[#a78bfa]"
  if (page.includes("admin")) return "bg-[#f6465d]/10 text-[#f6465d]"
  return "bg-[#2b3139] text-[#848e9c]"
}

export function AdminLiveVisitors() {
  const [data, setData] = useState<LiveData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await api.get("/admin/visitors/live")
      if (res.data) {
        setData(res.data as LiveData)
        setLastUpdated(new Date())
      }
    } catch {
      /* silent */
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const count = data?.count ?? 0
  const sessions = data?.sessions ?? []

  return (
    <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#2b3139]">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span
              className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                count > 0 ? "bg-[#0ecb81]" : "bg-[#848e9c]"
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                count > 0 ? "bg-[#0ecb81]" : "bg-[#848e9c]"
              }`}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#eaecef]">Live Visitors</p>
            <p className="text-xs text-[#848e9c]">active in the last 5 minutes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-[#848e9c]">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <div
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold ${
              count > 0
                ? "bg-[#0ecb81]/10 text-[#0ecb81]"
                : "bg-[#2b3139] text-[#848e9c]"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            {count} online
          </div>
        </div>
      </div>

      {/* Sessions */}
      {sessions.length === 0 ? (
        <div className="py-10 text-center">
          <Monitor className="h-8 w-8 text-[#4a5568] mx-auto mb-2" />
          <p className="text-sm text-[#848e9c]">No active visitors right now</p>
          <p className="text-xs text-[#4a5568] mt-0.5">Refreshes every 30 seconds</p>
        </div>
      ) : (
        <div className="divide-y divide-[#2b3139]/50">
          {sessions.map((s) => {
            const geo = countryFlag(s.country)
            return (
              <div
                key={s.sessionId}
                className="px-5 py-3 flex flex-wrap items-center gap-x-5 gap-y-2 hover:bg-[#1e2329] transition"
              >
                {/* Flag + location */}
                <div className="flex items-center gap-2 w-36 shrink-0">
                  <span className="text-2xl leading-none" title={geo.name}>
                    {geo.flag}
                  </span>
                  <div>
                    <p className="text-xs font-medium text-[#eaecef] leading-tight">
                      {geo.name}
                    </p>
                    {s.city && (
                      <p className="text-[10px] text-[#848e9c] flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {s.city}
                      </p>
                    )}
                  </div>
                </div>

                {/* Current page badge */}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${pageBadgeClass(
                    s.currentPage
                  )}`}
                >
                  {pageLabel(s.currentPage)}
                </span>

                {/* Pages trail */}
                {s.pagesVisited.length > 1 && (
                  <div className="flex items-center gap-1 text-[10px] text-[#848e9c]">
                    {s.pagesVisited.slice(-5).map((p, i) => (
                      <span key={i} className="flex items-center gap-0.5">
                        {i > 0 && <span>›</span>}
                        <span className="font-mono">
                          {!p || p === "/" ? "Home" : p.split("/").filter(Boolean)[0] || "?"}
                        </span>
                      </span>
                    ))}
                  </div>
                )}

                {/* IP */}
                <span className="text-[10px] text-[#4a5568] font-mono">{s.ip}</span>

                {/* Time spent */}
                <div className="ml-auto flex items-center gap-1 text-xs text-[#848e9c] shrink-0">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(s.timeSpentMs)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
