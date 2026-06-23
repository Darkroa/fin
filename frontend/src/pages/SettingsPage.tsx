import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import {
  updateNotificationPreferences,
  updateLeverage,
} from '../lib/api';
import toast from 'react-hot-toast';
import {
  Bell, Mail, MessageCircle, Send, Zap, Globe,
  Check, Activity, ChevronDown, BarChart2,
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { LangCode } from '../lib/i18n';

interface NotifPrefs extends Record<string, unknown> {
  email: boolean;
  whatsapp: boolean;
  telegram: boolean;
}

interface TradeAlertPrefs {
  trade_open_alert: boolean;
  trade_close_alert: boolean;
}

interface AppPrefs {
  confirm_before_trade: boolean;
  sound_alerts: boolean;
  compact_numbers: boolean;
}

interface LeverageForm {
  trade_leverage: number;
  bot_leverage: number;
}

const LEV_PRESETS = [1, 2, 5, 10, 25, 50, 100, 200]

const APP_PREFS_KEY = 'finai-app-prefs';

function loadAppPrefs(): AppPrefs {
  try {
    const raw = localStorage.getItem(APP_PREFS_KEY);
    if (raw) return JSON.parse(raw) as AppPrefs;
  } catch { /* ignore */ }
  return { confirm_before_trade: true, sound_alerts: false, compact_numbers: false };
}

function Toggle({
  on,
  onToggle,
  color = 'bg-[#f0b90b]',
}: {
  on: boolean;
  onToggle: () => void;
  color?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className={`relative inline-flex w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200 focus:outline-none ${
        on ? color : 'bg-[#3c4451]'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-200 ${
          on ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { user, setUser } = useAuthStore();

  const [notifs, setNotifs] = useState<NotifPrefs>({
    email: true,
    whatsapp: false,
    telegram: false,
  });
  const [saving, setSaving] = useState(false);
  const [tradeAlerts, setTradeAlerts] = useState<TradeAlertPrefs>({
    trade_open_alert: false,
    trade_close_alert: false,
  });
  const [savingAlerts, setSavingAlerts] = useState(false);

  const [appPrefs, setAppPrefs] = useState<AppPrefs>(loadAppPrefs);
  const [prefsSaved, setPrefsSaved] = useState(false);

  const { lang: language, currency, setLang, setCurrency: setCtxCurrency } = useLanguage();
  const [localeSaved, setLocaleSaved] = useState(false);

  const [leverage, setLeverage] = useState<LeverageForm>({ trade_leverage: 1, bot_leverage: 1 });
  const [savingLev, setSavingLev] = useState(false);

  useEffect(() => {
    if (user?.notification_preferences) {
      const prefs = user.notification_preferences;
      setNotifs(prefs as NotifPrefs);
      setTradeAlerts({
        trade_open_alert: !!((prefs as unknown as Record<string, unknown>).trade_open_alert),
        trade_close_alert: !!((prefs as unknown as Record<string, unknown>).trade_close_alert),
      });
    }
    if (user) {
      setLeverage({
        trade_leverage: user.trade_leverage ?? 1,
        bot_leverage: user.bot_leverage ?? 1,
      });
    }
  }, [user]);

  const handleSaveTradeAlerts = async () => {
    setSavingAlerts(true);
    try {
      const res = await updateNotificationPreferences(
        tradeAlerts as unknown as Record<string, unknown>
      );
      if (res.data) setUser(res.data);
      toast.success('Trade alert preferences saved');
    } catch {
      toast.error('Failed to save trade alert preferences');
    } finally {
      setSavingAlerts(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateNotificationPreferences(notifs);
      if (res.data) setUser(res.data);
      toast.success('Notification preferences saved');
    } catch {
      toast.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const saveAppPrefs = () => {
    localStorage.setItem(APP_PREFS_KEY, JSON.stringify(appPrefs));
    setPrefsSaved(true);
    toast.success('App preferences saved');
    setTimeout(() => setPrefsSaved(false), 2000);
  };

  const saveLocale = () => {
    setLocaleSaved(true);
    toast.success('Language & region saved');
    setTimeout(() => setLocaleSaved(false), 2000);
  };

  const handleSaveLeverage = async () => {
    if (leverage.trade_leverage < 1 || leverage.bot_leverage < 1) {
      toast.error('Leverage must be at least 1x');
      return;
    }
    setSavingLev(true);
    try {
      const res = await updateLeverage(leverage);
      if (res.data) setUser(res.data);
      toast.success('Leverage settings saved');
    } catch {
      toast.error('Failed to save leverage');
    } finally {
      setSavingLev(false);
    }
  };

  const notifItems = [
    {
      key: 'email' as const,
      label: 'Email Notifications',
      desc: 'Trade alerts, account updates, security events',
      icon: Mail,
      color: 'text-[#f0b90b]',
      bg: 'bg-[#f0b90b]/10',
    },
    {
      key: 'whatsapp' as const,
      label: 'WhatsApp Alerts',
      desc: 'Real-time trade signals and bot status',
      icon: MessageCircle,
      color: 'text-[#0ecb81]',
      bg: 'bg-[#0ecb81]/10',
    },
    {
      key: 'telegram' as const,
      label: 'Telegram Alerts',
      desc: 'Market events and trade notifications',
      icon: Send,
      color: 'text-[#3b82f6]',
      bg: 'bg-blue-500/10',
    },
  ];

  const appPrefItems: { key: keyof AppPrefs; label: string; desc: string }[] = [
    {
      key: 'confirm_before_trade',
      label: 'Confirm before orders',
      desc: 'Show confirmation dialog before placing orders',
    },
    {
      key: 'sound_alerts',
      label: 'Sound alerts',
      desc: 'Play audio when a trade executes or a bot signals',
    },
    {
      key: 'compact_numbers',
      label: 'Compact number format',
      desc: 'Display large numbers as 1.2M instead of 1,200,000',
    },
  ];

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-xl font-bold text-[#eaecef]">Settings</h1>

      {/* Notifications */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2b3139]">
          <div className="w-7 h-7 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
            <Bell size={14} className="text-[#f0b90b]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#eaecef]">Notifications</h2>
            <p className="text-[10px] text-[#848e9c]">Choose where to receive alerts</p>
          </div>
        </div>

        <div className="divide-y divide-[#2b3139]/60">
          {notifItems.map(({ key, label, desc, icon: Icon, color, bg }) => (
            <div key={key} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div
                  className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon size={15} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#eaecef] leading-tight">{label}</p>
                  <p className="text-xs text-[#848e9c] mt-0.5 leading-snug">{desc}</p>
                </div>
              </div>
              <Toggle on={notifs[key]} onToggle={() => setNotifs(p => ({ ...p, [key]: !p[key] }))} />
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-[#2b3139] bg-[#0b0e11]/30">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition w-full sm:w-auto"
          >
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>
      </div>

      {/* Trade Alerts */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2b3139]">
          <div className="w-7 h-7 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
            <Activity size={14} className="text-[#f0b90b]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#eaecef]">Trade Alerts</h2>
            <p className="text-[10px] text-[#848e9c]">
              Notify via Telegram · WhatsApp · In-app
            </p>
          </div>
        </div>
        <div className="divide-y divide-[#2b3139]/60">
          {(
            [
              {
                key: 'trade_open_alert' as const,
                label: 'Trade Opened',
                desc: 'Notify when a bot opens a new position',
              },
              {
                key: 'trade_close_alert' as const,
                label: 'Trade Closed',
                desc: 'Notify when a bot closes a position',
              },
            ] as const
          ).map(item => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#eaecef]">{item.label}</p>
                <p className="text-xs text-[#848e9c] mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                on={tradeAlerts[item.key]}
                onToggle={() =>
                  setTradeAlerts(p => ({ ...p, [item.key]: !p[item.key] }))
                }
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-[#2b3139] bg-[#0b0e11]/30">
          <button
            onClick={handleSaveTradeAlerts}
            disabled={savingAlerts}
            className="bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition w-full sm:w-auto"
          >
            {savingAlerts ? 'Saving…' : 'Save Trade Alerts'}
          </button>
        </div>
      </div>

      {/* App Preferences */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2b3139]">
          <div className="w-7 h-7 rounded-lg bg-[#0ecb81]/10 flex items-center justify-center">
            <Zap size={14} className="text-[#0ecb81]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#eaecef]">App Preferences</h2>
            <p className="text-[10px] text-[#848e9c]">Trading and display settings — saved to this device</p>
          </div>
        </div>
        <div className="divide-y divide-[#2b3139]/60">
          {appPrefItems.map(item => (
            <div key={item.key} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#eaecef]">{item.label}</p>
                <p className="text-xs text-[#848e9c] mt-0.5">{item.desc}</p>
              </div>
              <Toggle
                on={appPrefs[item.key]}
                onToggle={() => {
                  setAppPrefs(prev => {
                    const next = { ...prev, [item.key]: !prev[item.key] };
                    localStorage.setItem(APP_PREFS_KEY, JSON.stringify(next));
                    return next;
                  });
                  setPrefsSaved(false);
                }}
                color="bg-[#0ecb81]"
              />
            </div>
          ))}
        </div>
        <div className="px-5 py-4 border-t border-[#2b3139] bg-[#0b0e11]/30">
          <button
            onClick={saveAppPrefs}
            className="flex items-center gap-2 bg-[#0ecb81] hover:bg-[#0aaf6f] text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition w-full sm:w-auto"
          >
            {prefsSaved ? (
              <>
                <Check size={14} /> Saved!
              </>
            ) : (
              'Save App Preferences'
            )}
          </button>
        </div>
      </div>

      {/* Language & Region */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2b3139]">
          <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Globe size={14} className="text-blue-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#eaecef]">Language & Region</h2>
            <p className="text-[10px] text-[#848e9c]">Locale and display preferences</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Language</label>
            <div className="relative">
              <select
                value={language}
                onChange={e => setLang(e.target.value as LangCode)}
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition appearance-none pr-9 cursor-pointer"
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="fr">Français</option>
                <option value="es">Español</option>
                <option value="de">Deutsch</option>
                <option value="ar">العربية</option>
                <option value="zh">中文</option>
                <option value="pt">Português</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-xs text-[#848e9c] mb-1.5 block">Currency display</label>
            <div className="relative">
              <select
                value={currency}
                onChange={e => setCtxCurrency(e.target.value)}
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2.5 text-sm text-[#eaecef] focus:outline-none focus:border-[#f0b90b] transition appearance-none pr-9 cursor-pointer"
              >
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="BTC">BTC — Bitcoin</option>
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#848e9c] pointer-events-none" />
            </div>
          </div>
          <button
            onClick={saveLocale}
            className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] text-black font-semibold px-5 py-2.5 rounded-xl text-sm transition"
          >
            {localeSaved ? (
              <>
                <Check size={14} /> Saved!
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>

      {/* Trade Account Leverage */}
      <div className="bg-[#161a1e] border border-[#2b3139] rounded-xl overflow-hidden">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#2b3139]">
          <div className="w-7 h-7 rounded-lg bg-[#f0b90b]/10 flex items-center justify-center">
            <BarChart2 size={14} className="text-[#f0b90b]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#eaecef]">Trade Account Leverage</h2>
            <p className="text-[10px] text-[#848e9c]">Default leverage applied to manual trades and bots</p>
          </div>
        </div>
        <div className="p-5 space-y-5">
          {/* Trade Leverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#848e9c]">Trade Leverage</label>
              <span className="text-sm font-bold text-[#f0b90b] font-mono">{leverage.trade_leverage}×</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {LEV_PRESETS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLeverage(p => ({ ...p, trade_leverage: v }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    leverage.trade_leverage === v
                      ? 'bg-[#f0b90b] border-[#f0b90b] text-black'
                      : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/50 hover:text-[#eaecef]'
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                placeholder="Custom…"
                value={LEV_PRESETS.includes(leverage.trade_leverage) ? '' : leverage.trade_leverage}
                onChange={e => {
                  const v = Math.max(1, Math.min(500, Number(e.target.value)))
                  if (!isNaN(v)) setLeverage(p => ({ ...p, trade_leverage: v }))
                }}
                className="w-28 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] font-mono focus:outline-none focus:border-[#f0b90b] transition"
              />
              <span className="text-xs text-[#4a5568]">custom ×</span>
            </div>
          </div>

          {/* Bot Leverage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-[#848e9c]">Bot Leverage</label>
              <span className="text-sm font-bold text-[#f0b90b] font-mono">{leverage.bot_leverage}×</span>
            </div>
            <div className="flex flex-wrap gap-2 mb-2">
              {LEV_PRESETS.map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLeverage(p => ({ ...p, bot_leverage: v }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                    leverage.bot_leverage === v
                      ? 'bg-[#f0b90b] border-[#f0b90b] text-black'
                      : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:border-[#f0b90b]/50 hover:text-[#eaecef]'
                  }`}
                >
                  {v}×
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={500}
                step={1}
                placeholder="Custom…"
                value={LEV_PRESETS.includes(leverage.bot_leverage) ? '' : leverage.bot_leverage}
                onChange={e => {
                  const v = Math.max(1, Math.min(500, Number(e.target.value)))
                  if (!isNaN(v)) setLeverage(p => ({ ...p, bot_leverage: v }))
                }}
                className="w-28 bg-[#0b0e11] border border-[#2b3139] rounded-xl px-3 py-2 text-sm text-[#eaecef] font-mono focus:outline-none focus:border-[#f0b90b] transition"
              />
              <span className="text-xs text-[#4a5568]">custom ×</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-[#0b0e11] border border-[#f0b90b]/20 rounded-xl">
            <BarChart2 size={13} className="text-[#f0b90b] flex-shrink-0" />
            <p className="text-[10px] text-[#848e9c]">Higher leverage amplifies both gains and losses. Same setting as Profile → Personal Info.</p>
          </div>
          <button
            onClick={handleSaveLeverage}
            disabled={savingLev}
            className="flex items-center gap-2 bg-[#f0b90b] hover:bg-[#d4a30a] disabled:opacity-60 text-black font-semibold px-6 py-2.5 rounded-xl text-sm transition w-full sm:w-auto"
          >
            {savingLev ? 'Saving…' : <><Check size={14} /> Save Leverage</>}
          </button>
        </div>
      </div>
    </div>
  );
}
