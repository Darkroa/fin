import { useState } from "react";
import {
  Activity, Server, Wifi, WifiOff, AlertTriangle, Terminal,
  RefreshCw, Square, Play, ChevronDown, ChevronUp, Globe,
  Database, MessageSquare, Cpu, Zap, Clock, CheckCircle2,
  XCircle, Loader2
} from "lucide-react";

type ServiceStatus = "running" | "stopped" | "warning" | "building";

interface Service {
  id: string;
  name: string;
  description: string;
  port?: number;
  status: ServiceStatus;
  uptime?: string;
  icon: React.ReactNode;
  url?: string;
  logs: string[];
  cpu?: number;
  memory?: string;
}

const SERVICES: Service[] = [
  {
    id: "fastapi",
    name: "FastAPI Backend",
    description: "AI-powered trading API & WebSocket server",
    port: 8000,
    status: "running",
    uptime: "2h 14m",
    icon: <Zap className="w-5 h-5" />,
    url: "/api/docs",
    cpu: 12,
    memory: "148 MB",
    logs: [
      "INFO:     Application startup complete.",
      "✅ Admin seeded: AdminfinAi@gmail.com",
      "✅ VPS plans and asset products seeded",
      "⏰ Scheduler started — SL/TP check (30s), Price alerts (60s)",
      "INFO:     127.0.0.1 - POST /api/visitors/track 200",
      "INFO:     127.0.0.1 - GET /api/public/prices 200",
    ],
  },
  {
    id: "vite",
    name: "React Frontend",
    description: "Vite dev server — Binance-style trading dashboard",
    port: 5000,
    status: "running",
    uptime: "2h 14m",
    icon: <Globe className="w-5 h-5" />,
    url: "/",
    cpu: 4,
    memory: "92 MB",
    logs: [
      "VITE v8.0.16  ready in 383 ms",
      "➜  Local:   http://localhost:5000/",
      "➜  Network: http://0.0.0.0:5000/",
      "[vite] page reload src/components/Dashboard.tsx",
    ],
  },
  {
    id: "evolution",
    name: "Evolution API",
    description: "WhatsApp integration service via Baileys",
    port: 8080,
    status: "warning",
    icon: <MessageSquare className="w-5 h-5" />,
    cpu: 0,
    memory: "—",
    logs: [
      "⚠️  dist/main.js not found — build required",
      "Run: cd evolution-api && npm run build",
      "Then restart the application workflow.",
    ],
  },
  {
    id: "finapp",
    name: "Expo Mobile Web",
    description: "React Native web export served at /app",
    status: "stopped",
    icon: <Activity className="w-5 h-5" />,
    url: "/app",
    cpu: 0,
    memory: "—",
    logs: [
      "Run: cd finapp && npm run build:web",
      "Static export will be served at /app by FastAPI.",
    ],
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    description: "Primary database via Replit built-in DB",
    status: "running",
    uptime: "48h+",
    icon: <Database className="w-5 h-5" />,
    cpu: 2,
    memory: "64 MB",
    logs: [
      "LOG:  database system is ready to accept connections",
      "LOG:  autovacuum launcher started",
    ],
  },
  {
    id: "celery",
    name: "Celery Worker",
    description: "Async task queue — news ingestion & trading signals",
    status: "stopped",
    icon: <Cpu className="w-5 h-5" />,
    cpu: 0,
    memory: "—",
    logs: [
      "ℹ️  Celery running in EAGER (sync) mode — Redis not configured.",
      "Set REDIS_URL to enable async task processing.",
    ],
  },
];

const statusConfig: Record<ServiceStatus, { color: string; bg: string; badge: string; dot: string; label: string }> = {
  running: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    badge: "bg-emerald-500/20 text-emerald-300",
    dot: "bg-emerald-400 shadow-emerald-400/50",
    label: "Running",
  },
  stopped: {
    color: "text-slate-400",
    bg: "bg-slate-500/10 border-slate-500/20",
    badge: "bg-slate-500/20 text-slate-400",
    dot: "bg-slate-500",
    label: "Stopped",
  },
  warning: {
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    badge: "bg-amber-500/20 text-amber-300",
    dot: "bg-amber-400 shadow-amber-400/50",
    label: "Warning",
  },
  building: {
    color: "text-blue-400",
    bg: "bg-blue-500/10 border-blue-500/20",
    badge: "bg-blue-500/20 text-blue-300",
    dot: "bg-blue-400 shadow-blue-400/50",
    label: "Building",
  },
};

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === "running") return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  if (status === "warning") return <AlertTriangle className="w-4 h-4 text-amber-400" />;
  if (status === "building") return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
  return <XCircle className="w-4 h-4 text-slate-500" />;
}

function ServiceCard({ service }: { service: Service }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig[service.status];

  return (
    <div className={`rounded-xl border ${cfg.bg} transition-all duration-200`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${cfg.badge}`}>
              <span className={cfg.color}>{service.icon}</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-white text-sm">{service.name}</h3>
                {service.port && (
                  <span className="text-xs font-mono bg-white/5 text-slate-400 px-1.5 py-0.5 rounded">
                    :{service.port}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{service.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1.5 ${cfg.badge}`}>
              <span className={`w-1.5 h-1.5 rounded-full shadow-lg ${cfg.dot}`} />
              {cfg.label}
            </span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {service.uptime && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Clock className="w-3 h-3" />
                <span>{service.uptime}</span>
              </div>
            )}
            {service.cpu !== undefined && service.status === "running" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Cpu className="w-3 h-3" />
                <span>{service.cpu}%</span>
              </div>
            )}
            {service.memory && service.memory !== "—" && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Activity className="w-3 h-3" />
                <span>{service.memory}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {service.url && service.status === "running" && (
              <a
                href={service.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
              >
                Open
              </a>
            )}
            {service.status === "running" ? (
              <button className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-slate-300 transition-colors flex items-center gap-1">
                <Square className="w-3 h-3" /> Stop
              </button>
            ) : service.status === "warning" ? (
              <button className="text-xs px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition-colors flex items-center gap-1">
                <RefreshCw className="w-3 h-3" /> Rebuild
              </button>
            ) : (
              <button className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 hover:text-emerald-400 text-slate-300 transition-colors flex items-center gap-1">
                <Play className="w-3 h-3" /> Start
              </button>
            )}
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 transition-colors"
            >
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2 text-xs text-slate-500">
            <Terminal className="w-3 h-3" /> Logs
          </div>
          <div className="font-mono text-xs bg-black/30 rounded-lg p-3 space-y-0.5 max-h-36 overflow-y-auto">
            {service.logs.map((line, i) => (
              <div key={i} className="text-slate-400 leading-relaxed">{line}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard() {
  const running = SERVICES.filter((s) => s.status === "running").length;
  const total = SERVICES.length;
  const warnings = SERVICES.filter((s) => s.status === "warning").length;

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#0d1121]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center">
              <Server className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white text-sm">FinAi Server</h1>
              <p className="text-xs text-slate-500">Infrastructure Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-lg shadow-emerald-400/50" />
                {running}/{total} running
              </span>
              {warnings > 0 && (
                <span className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="w-3 h-3" />
                  {warnings} warning{warnings > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <button className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Summary bar */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Running", value: running, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            { label: "Stopped", value: SERVICES.filter(s => s.status === "stopped").length, color: "text-slate-400", bg: "bg-slate-500/10" },
            { label: "Warnings", value: warnings, color: "text-amber-400", bg: "bg-amber-500/10" },
            { label: "Total Services", value: total, color: "text-blue-400", bg: "bg-blue-500/10" },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl border border-white/5 ${stat.bg} p-4`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Services */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Services</h2>
          <div className="space-y-2.5">
            {SERVICES.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        </div>

        {/* Quick commands */}
        <div>
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Commands</h2>
          <div className="rounded-xl border border-white/5 bg-white/[0.02] p-4 space-y-2">
            {[
              { label: "Build Evolution API", cmd: "cd evolution-api && npm run build", color: "text-amber-400" },
              { label: "Build Expo Web", cmd: "cd finapp && npm run build:web", color: "text-blue-400" },
              { label: "Run DB Migrations", cmd: "alembic upgrade head", color: "text-violet-400" },
              { label: "Start Celery Worker", cmd: "celery -A src.tasks worker --loglevel=info", color: "text-emerald-400" },
            ].map((cmd) => (
              <div key={cmd.label} className="flex items-center justify-between gap-4 group">
                <span className="text-xs text-slate-400 shrink-0">{cmd.label}</span>
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <code className={`text-xs font-mono ${cmd.color} truncate`}>{cmd.cmd}</code>
                  <button className="opacity-0 group-hover:opacity-100 shrink-0 text-xs px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 transition-all">
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
