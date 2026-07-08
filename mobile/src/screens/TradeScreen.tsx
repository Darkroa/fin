import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, KeyboardAvoidingView,
  Platform, SafeAreaView, Modal, FlatList,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font, shadow } from '../theme';
import { executeTrade, getBotTrades, getOpenPositions, closeManualPosition, API_BASE } from '../lib/api';

// ── Pairs + mappings ─────────────────────────────────────────────────────────
const PAIRS = [
  'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT',
  'XRP/USDT', 'DOGE/USDT', 'ADA/USDT', 'AVAX/USDT',
  'LINK/USDT', 'DOT/USDT', 'LTC/USDT',
  'XAU/USD', 'XAG/USD', 'OIL/WTI',
  'AAPL', 'TSLA', 'NVDA', 'MSFT', 'SPY',
];

const CRYPTO_MAP: Record<string, string> = {
  'BTC/USDT': 'bitcoin',   'ETH/USDT': 'ethereum',    'BNB/USDT': 'binancecoin',
  'SOL/USDT': 'solana',    'XRP/USDT': 'ripple',       'DOGE/USDT': 'dogecoin',
  'ADA/USDT': 'cardano',   'AVAX/USDT': 'avalanche-2', 'LINK/USDT': 'chainlink',
  'DOT/USDT': 'polkadot',  'LTC/USDT': 'litecoin',
};

const FALLBACKS: Record<string, { price: number; change: number }> = {
  'BTC/USDT':  { price: 97000, change: 2.4  }, 'ETH/USDT':  { price: 3200, change: 1.8 },
  'BNB/USDT':  { price: 628,   change: 0.9  }, 'SOL/USDT':  { price: 155,  change: 1.2 },
  'XRP/USDT':  { price: 0.52,  change: 0.7  }, 'DOGE/USDT': { price: 0.12, change: 1.1 },
  'ADA/USDT':  { price: 0.45,  change: 0.5  }, 'AVAX/USDT': { price: 38,   change: 1.4 },
  'LINK/USDT': { price: 14,    change: 0.8  }, 'DOT/USDT':  { price: 7.2,  change: 0.6 },
  'LTC/USDT':  { price: 85,    change: 0.3  }, 'XAU/USD':   { price: 3290, change: 0.5 },
  'XAG/USD':   { price: 32.8,  change: 0.4  }, 'OIL/WTI':   { price: 78.4, change: -0.3 },
  'AAPL':      { price: 195,   change: 0.6  }, 'TSLA':      { price: 175,  change: 1.2 },
  'NVDA':      { price: 875,   change: 1.8  }, 'MSFT':      { price: 415,  change: 0.7 },
  'SPY':       { price: 526,   change: 0.4  },
};

const LEVERAGE_STEPS = [1, 2, 5, 10, 20, 50, 100, 125];
const METALS_MAP: Record<string, string> = { 'XAU/USD': 'gold', 'XAG/USD': 'silver' };

/** TradingView symbol map — must stay in sync with PAIRS above */
const TV_SYMBOLS: Record<string, string> = {
  // Crypto
  'BTC/USDT':  'BINANCE:BTCUSDT',
  'ETH/USDT':  'BINANCE:ETHUSDT',
  'BNB/USDT':  'BINANCE:BNBUSDT',
  'SOL/USDT':  'BINANCE:SOLUSDT',
  'XRP/USDT':  'BINANCE:XRPUSDT',
  'DOGE/USDT': 'BINANCE:DOGEUSDT',
  'ADA/USDT':  'BINANCE:ADAUSDT',
  'AVAX/USDT': 'BINANCE:AVAXUSDT',
  'MATIC/USDT':'BINANCE:MATICUSDT',
  'LINK/USDT': 'BINANCE:LINKUSDT',
  'DOT/USDT':  'BINANCE:DOTUSDT',
  'LTC/USDT':  'BINANCE:LTCUSDT',
  // Metals
  'XAU/USD':   'OANDA:XAUUSD',
  'XAG/USD':   'OANDA:XAGUSD',
  // Commodities
  'OIL/WTI':   'NYMEX:CL1!',
  // Stocks
  'AAPL':      'NASDAQ:AAPL',
  'TSLA':      'NASDAQ:TSLA',
  'GOOGL':     'NASDAQ:GOOGL',
  'AMZN':      'NASDAQ:AMZN',
  'NVDA':      'NASDAQ:NVDA',
  'MSFT':      'NASDAQ:MSFT',
  'SPY':       'AMEX:SPY',
};

function fmt(n: number, d = 2) {
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function makeOrderBook(base: number) {
  return {
    asks: Array.from({ length: 8 }, (_, i) => ({ price: base + (i + 1) * (base * 0.00012), size: +(Math.random() * 2).toFixed(4) })),
    bids: Array.from({ length: 8 }, (_, i) => ({ price: base - i * (base * 0.00012),        size: +(Math.random() * 2).toFixed(4) })),
  };
}

// ── Fin AI Chat ───────────────────────────────────────────────────────────────
interface FinMsg { id: string; role: 'user' | 'ai'; text: string; suggestion?: TradeSugg }
interface TradeSugg { side: 'buy' | 'sell'; entry: number; sl?: number; tp?: number; conf: number }

function parseSuggestion(text: string, livePrice: number): TradeSugg | null {
  const hasBuy  = /\b(buy|long|bullish)\b/i.test(text);
  const hasSell = /\b(sell|short|bearish)\b/i.test(text);
  const hasEntry = /entry|stop.loss|take.profit|\bsl\b|\btp\b|target/i.test(text);
  if ((!hasBuy && !hasSell) || !hasEntry) return null;
  const side: 'buy' | 'sell' = hasBuy ? 'buy' : 'sell';
  const getPrice = (t: string, patterns: RegExp[]) => {
    for (const re of patterns) {
      const m = re.exec(t);
      if (m) return parseFloat(m[1].replace(/,/g, ''));
    }
    return undefined;
  };
  const entry = getPrice(text, [/entry[:\s]+\$?([\d,]+\.?\d*)/i, /(?:buy|sell)\s+(?:at|@)\s+\$?([\d,]+\.?\d*)/i]) ?? livePrice;
  const sl  = getPrice(text, [/stop[- ]loss[:\s]+\$?([\d,]+\.?\d*)/i, /\bsl[:\s]+\$?([\d,]+\.?\d*)/i]);
  const tp  = getPrice(text, [/take[- ]profit[:\s]+\$?([\d,]+\.?\d*)/i, /\btp[:\s]+\$?([\d,]+\.?\d*)/i, /target[:\s]+\$?([\d,]+\.?\d*)/i]);
  const confMatch = /(\d{2,3})\s*%\s*conf/i.exec(text);
  return { side, entry, sl, tp, conf: confMatch ? parseInt(confMatch[1]) : 72 };
}

interface FinChatProps {
  pair: string; livePrice: number; liveChange: number;
  token: string | null; collapsed: boolean; onToggle: () => void;
  onExecute: (sugg: TradeSugg, lot: number, lev: number) => void;
}

function FinChatPanel({ pair, livePrice, liveChange, token, collapsed, onToggle, onExecute }: FinChatProps) {
  const [input, setInput]       = useState('');
  const [messages, setMessages] = useState<FinMsg[]>([]);
  const [loading, setLoading]   = useState(false);
  const [lot, setLot]           = useState('0.01');
  const [levIdx, setLevIdx]     = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const leverage  = LEVERAGE_STEPS[levIdx];
  const isUp = liveChange >= 0;

  useEffect(() => { setMessages([]); }, [pair]);

  const callAI = useCallback(async (text: string) => {
    if (loading || !text.trim()) return;
    const userMsg: FinMsg = { id: `u-${Date.now()}`, role: 'user', text };
    setMessages(p => [...p, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message: text, pair, price: livePrice || undefined, change_24h: liveChange || undefined }),
      });
      const data = await res.json();
      const replyText: string = data.reply ?? 'Fin is unavailable right now.';
      const suggestion = livePrice > 0 ? parseSuggestion(replyText, livePrice) : null;
      setMessages(p => [...p, { id: `a-${Date.now()}`, role: 'ai', text: replyText, suggestion: suggestion ?? undefined }]);
    } catch {
      setMessages(p => [...p, { id: `e-${Date.now()}`, role: 'ai', text: 'Connection error — please try again.' }]);
    } finally { setLoading(false); }
  }, [loading, token, pair, livePrice, liveChange]);

  if (collapsed) {
    return (
      <TouchableOpacity style={styles.chatCollapsed} onPress={onToggle} activeOpacity={0.85}>
        <View style={styles.chatCollapsedLeft}>
          <View style={styles.chatBotCircle}>
            <MaterialCommunityIcons name="robot-outline" size={16} color={colors.accent} />
          </View>
          <View>
            <Text style={styles.chatTitle}>Fin AI</Text>
            <Text style={styles.chatSub}>Trade assistant · tap to expand</Text>
          </View>
          <View style={styles.liveDot} />
        </View>
        <Ionicons name="chevron-up" size={14} color={colors.textMuted} />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.chatCard}>
      {/* Header */}
      <View style={styles.chatHeader}>
        <View style={styles.chatBotCircle}>
          <MaterialCommunityIcons name="robot-outline" size={16} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.chatTitle}>Fin AI</Text>
          <Text style={styles.chatSub}>Trade assistant · powered by FinAi</Text>
        </View>
        <View style={styles.chatLiveRow}>
          <View style={styles.liveDot} />
          <Text style={styles.chatLiveText}>Live</Text>
        </View>
        <TouchableOpacity onPress={onToggle} style={styles.chatClose}>
          <Ionicons name="close" size={16} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {/* Context bar */}
      <View style={styles.chatContextBar}>
        <Text style={styles.chatPairLabel}>{pair}</Text>
        <Text style={[styles.chatPriceText, { color: isUp ? colors.green : colors.red }]}>
          ${livePrice > 0 ? livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}
          {'  '}{isUp ? '+' : ''}{liveChange.toFixed(2)}%
        </Text>
        <TouchableOpacity
          style={styles.suggestBtn}
          onPress={() => callAI(`Suggest a trade for ${pair} right now at $${livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}. Give me a clear BUY or SELL with entry, stop-loss, and take-profit levels.`)}
          disabled={loading || livePrice <= 0}
        >
          <Ionicons name="sparkles-outline" size={10} color={colors.accent} />
          <Text style={styles.suggestBtnText}>Suggest trade</Text>
        </TouchableOpacity>
      </View>

      {/* Lot + Leverage controls */}
      <View style={styles.chatControls}>
        <Text style={styles.chatCtrlLabel}>Lot</Text>
        <TouchableOpacity onPress={() => { const n = Math.max(0.01, parseFloat(lot || '0.01') - 0.01); setLot(n.toFixed(2)); }} style={styles.ctrlBtn}><Text style={styles.ctrlBtnText}>−</Text></TouchableOpacity>
        <TextInput style={styles.ctrlInput} value={lot} onChangeText={setLot} keyboardType="decimal-pad" />
        <TouchableOpacity onPress={() => { const n = Math.min(100, parseFloat(lot || '0.01') + 0.01); setLot(n.toFixed(2)); }} style={styles.ctrlBtn}><Text style={styles.ctrlBtnText}>+</Text></TouchableOpacity>
        <View style={styles.ctrlDivider} />
        <Text style={styles.chatCtrlLabel}>Lev</Text>
        <TouchableOpacity onPress={() => setLevIdx(i => Math.max(0, i - 1))} style={styles.ctrlBtn}><Text style={styles.ctrlBtnText}>−</Text></TouchableOpacity>
        <Text style={styles.ctrlLevText}>{leverage}x</Text>
        <TouchableOpacity onPress={() => setLevIdx(i => Math.min(LEVERAGE_STEPS.length - 1, i + 1))} style={styles.ctrlBtn}><Text style={styles.ctrlBtnText}>+</Text></TouchableOpacity>
      </View>

      {/* Messages */}
      <ScrollView ref={scrollRef} style={styles.chatMessages} contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
        {messages.length === 0 && !loading && (
          <View style={styles.chatEmpty}>
            <View style={styles.chatEmptyIcon}>
              <MaterialCommunityIcons name="robot-outline" size={28} color={colors.accent} />
            </View>
            <Text style={styles.chatEmptyTitle}>Ask Fin about {pair}</Text>
            <Text style={styles.chatEmptyText}>Tap "Suggest trade" for an AI trade idea, or type a question below.</Text>
          </View>
        )}
        {messages.map(msg => (
          <View key={msg.id}>
            {msg.role === 'user' ? (
              <View style={styles.chatUserBubble}>
                <Text style={styles.chatUserText}>{msg.text}</Text>
              </View>
            ) : (
              <View style={styles.chatAiRow}>
                <View style={styles.chatAiAvatar}>
                  <MaterialCommunityIcons name="robot-outline" size={11} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatAiName}>Fin</Text>
                  <Text style={styles.chatAiText}>{msg.text}</Text>
                  {msg.suggestion && (
                    <View style={[styles.suggCard, { borderColor: msg.suggestion.side === 'buy' ? colors.green : colors.red, backgroundColor: msg.suggestion.side === 'buy' ? colors.greenMuted : colors.redMuted }]}>
                      <View style={styles.suggSideRow}>
                        <Ionicons
                          name={msg.suggestion.side === 'buy' ? 'trending-up' : 'trending-down'}
                          size={12}
                          color={msg.suggestion.side === 'buy' ? colors.green : colors.red}
                        />
                        <Text style={[styles.suggSide, { color: msg.suggestion.side === 'buy' ? colors.green : colors.red }]}>
                          {msg.suggestion.side === 'buy' ? 'BUY' : 'SELL'} SIGNAL · {pair}
                        </Text>
                      </View>
                      <View style={styles.suggStats}>
                        {[
                          { l: 'Entry', v: `$${msg.suggestion.entry.toLocaleString('en-US', { maximumFractionDigits: 4 })}`, c: colors.text },
                          msg.suggestion.sl ? { l: 'Stop-Loss', v: `$${msg.suggestion.sl.toLocaleString('en-US', { maximumFractionDigits: 4 })}`, c: colors.red } : null,
                          msg.suggestion.tp ? { l: 'Take-Profit', v: `$${msg.suggestion.tp.toLocaleString('en-US', { maximumFractionDigits: 4 })}`, c: colors.green } : null,
                        ].filter(Boolean).map((s: any) => (
                          <View key={s.l} style={styles.suggStat}>
                            <Text style={styles.suggStatLabel}>{s.l}</Text>
                            <Text style={[styles.suggStatValue, { color: s.c }]}>{s.v}</Text>
                          </View>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={[styles.suggExecBtn, { backgroundColor: msg.suggestion.side === 'buy' ? colors.green : colors.red }]}
                        onPress={() => onExecute(msg.suggestion!, parseFloat(lot) || 0.01, leverage)}
                      >
                        <Ionicons
                          name={msg.suggestion.side === 'buy' ? 'trending-up' : 'trending-down'}
                          size={12}
                          color="#000"
                        />
                        <Text style={styles.suggExecBtnText}>
                          {msg.suggestion.side === 'buy' ? 'Execute Buy' : 'Execute Sell'} · {pair}
                        </Text>
                      </TouchableOpacity>
                      <Text style={styles.suggMeta}>{lot} lot{leverage > 1 ? ` · ${leverage}x` : ''} · market</Text>
                    </View>
                  )}
                </View>
              </View>
            )}
          </View>
        ))}
        {loading && (
          <View style={styles.chatAiRow}>
            <View style={styles.chatAiAvatar}>
              <MaterialCommunityIcons name="robot-outline" size={11} color={colors.accent} />
            </View>
            <View style={styles.typingDots}>
              <View style={[styles.dot, { opacity: 1 }]} />
              <View style={[styles.dot, { opacity: 0.7 }]} />
              <View style={[styles.dot, { opacity: 0.4 }]} />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input */}
      <View style={styles.chatInputRow}>
        <TextInput
          style={styles.chatInput}
          value={input}
          onChangeText={setInput}
          placeholder={`Ask Fin about ${pair}…`}
          placeholderTextColor={colors.textMuted}
          onSubmitEditing={() => callAI(input)}
          returnKeyType="send"
          multiline={false}
        />
        <TouchableOpacity
          style={[styles.chatSendBtn, (!input.trim() || loading) && { opacity: 0.4 }]}
          onPress={() => callAI(input)}
          disabled={!input.trim() || loading}
        >
          {loading
            ? <ActivityIndicator color={colors.accent} size="small" />
            : <Ionicons name="arrow-forward" size={18} color={colors.accent} />
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main TradeScreen ─────────────────────────────────────────────────────────
export default function TradeScreen() {
  const { user, token } = useAuth() as { user: any; token: string | null };

  // Pair
  const [pair, setPair]           = useState('BTC/USDT');
  const [showPairs, setShowPairs] = useState(false);

  // Live price
  const [livePrice, setLivePrice]   = useState(FALLBACKS['BTC/USDT'].price);
  const [liveChange, setLiveChange] = useState(FALLBACKS['BTC/USDT'].change);
  const [isLive, setIsLive]         = useState(false);
  const pairRef = useRef(pair);
  pairRef.current = pair;

  // UI state
  const [chartTab, setChartTab]           = useState<'chart' | 'orderbook' | 'trades' | 'info'>('chart');
  const [chatCollapsed, setChatCollapsed] = useState(true);
  const [showOrderForm, setShowOrderForm] = useState(false);

  // Order form
  const [side, setSide]           = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [price, setPrice]         = useState('');
  const [amount, setAmount]       = useState('');
  const [lotSize, setLotSize]     = useState('0.01');
  const [leverageIdx, setLevIdx]  = useState(0);
  const [stopLoss, setSL]         = useState('');
  const [takeProfit, setTP]       = useState('');

  // Data
  const [tradeHistory, setHistory]      = useState<any[]>([]);
  const [openPositions, setOpenPos]     = useState<any[]>([]);
  const [orderLoading, setOrderLoading] = useState(false);
  const [closingId, setClosingId]       = useState<number | null>(null);

  const leverage   = LEVERAGE_STEPS[leverageIdx];
  const asset      = pair.split('/')[0];
  const numPrice   = parseFloat(price.replace(/,/g, '')) || livePrice;
  const qty        = parseFloat(amount) || 0;
  const orderTotal = numPrice && qty ? (numPrice * qty) / Math.max(leverage, 1) : 0;
  const high24     = livePrice > 0 ? livePrice * 1.022 : 0;
  const low24      = livePrice > 0 ? livePrice * 0.978 : 0;
  const orderBook  = makeOrderBook(livePrice);
  const balance    = user?.balance_usdt ?? 0;

  // Fetch live price
  const fetchPrice = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE}/public/prices`);
      if (!res.ok) return;
      const json = await res.json();
      const p    = pairRef.current;
      const coinId = CRYPTO_MAP[p];
      if (coinId && json[coinId]) {
        setLivePrice(json[coinId].usd);
        setLiveChange(json[coinId].usd_24h_change);
        setIsLive(true);
      } else if (METALS_MAP[p] && json.metals?.[METALS_MAP[p]]) {
        setLivePrice(json.metals[METALS_MAP[p]].usd);
        setLiveChange(json.metals[METALS_MAP[p]].usd_24h_change);
        setIsLive(true);
      } else if (json.stocks?.[p]) {
        setLivePrice(json.stocks[p].usd);
        setLiveChange(json.stocks[p].usd_24h_change);
        setIsLive(true);
      } else {
        const fb = FALLBACKS[p];
        if (fb) { setLivePrice(fb.price); setLiveChange(fb.change); }
        setIsLive(false);
      }
    } catch { /* keep previous */ }
  }, []);

  useEffect(() => {
    const fb = FALLBACKS[pair] ?? { price: 100, change: 0 };
    setLivePrice(fb.price); setLiveChange(fb.change); setIsLive(false);
    fetchPrice();
  }, [pair, fetchPrice]);

  useEffect(() => {
    const id = setInterval(fetchPrice, 8000);
    return () => clearInterval(id);
  }, [fetchPrice]);

  useEffect(() => {
    if (orderType === 'market' || !price) setPrice(livePrice.toFixed(2));
  }, [livePrice, orderType]);

  const fetchData = useCallback(async () => {
    const [posRes, tradesRes] = await Promise.allSettled([getOpenPositions(), getBotTrades(50)]);
    if (posRes.status === 'fulfilled') {
      const d = posRes.value.data;
      setOpenPos(Array.isArray(d?.positions) ? d.positions : Array.isArray(d) ? d : []);
    }
    if (tradesRes.status === 'fulfilled') {
      const d = tradesRes.value.data;
      setHistory(Array.isArray(d) ? d : d?.trades ?? []);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Quick trade
  const handleQuickTrade = async (quickSide: 'buy' | 'sell') => {
    if (orderLoading) return;
    const ls = parseFloat(lotSize) || 0.01;
    if (!livePrice) { Alert.alert('Error', 'Price not available'); return; }
    setOrderLoading(true);
    try {
      await executeTrade({ ticker: pair, side: quickSide, qty: ls, leverage: leverage > 1 ? leverage : undefined });
      Alert.alert('Order Placed', `${quickSide === 'buy' ? 'Buy' : 'Sell'} ${ls} ${asset} @ market`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Order Failed', e?.response?.data?.detail ?? e?.message ?? 'An error occurred');
    } finally { setOrderLoading(false); }
  };

  // Full order submit
  const handleTrade = async () => {
    if (orderLoading) return;
    const qtyNum = parseFloat(amount);
    if (!qtyNum || qtyNum <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
    setOrderLoading(true);
    try {
      await executeTrade({
        ticker: pair, side, qty: qtyNum,
        leverage: leverage > 1 ? leverage : undefined,
        stop_loss:   stopLoss   ? parseFloat(stopLoss)   : undefined,
        take_profit: takeProfit ? parseFloat(takeProfit) : undefined,
      });
      Alert.alert('Order Placed', `${side === 'buy' ? 'Buy' : 'Sell'} ${qtyNum} ${asset} @ $${numPrice.toLocaleString()}`);
      setAmount(''); setSL(''); setTP('');
      fetchData();
    } catch (e: any) {
      Alert.alert('Order Failed', e?.response?.data?.detail ?? e?.message ?? 'An error occurred');
    } finally { setOrderLoading(false); }
  };

  // Close open position
  const handleClosePosition = (id: number, ticker: string) => {
    Alert.alert('Close Position', `Close ${ticker} position?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close', style: 'destructive', onPress: async () => {
        setClosingId(id);
        try { await closeManualPosition(id); fetchData(); }
        catch (e: any) { Alert.alert('Error', e?.response?.data?.detail ?? 'Failed'); }
        finally { setClosingId(null); }
      }},
    ]);
  };

  // Fin AI execute
  const handleChatExecute = async (sugg: TradeSugg, lot: number, lev: number) => {
    setOrderLoading(true);
    try {
      await executeTrade({
        ticker: pair, side: sugg.side, qty: lot,
        leverage: lev > 1 ? lev : undefined,
        stop_loss:   sugg.sl,
        take_profit: sugg.tp,
      });
      Alert.alert('AI Trade Placed', `${sugg.side === 'buy' ? 'Buy' : 'Sell'} ${lot} lot @ market — ${pair}`);
      fetchData();
    } catch (e: any) {
      Alert.alert('Order Failed', e?.response?.data?.detail ?? e?.message ?? 'An error occurred');
    } finally { setOrderLoading(false); }
  };

  const isChangeUp = liveChange >= 0;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* ── Quick Buy/Sell Bar ─────────────────────────────────────── */}
          <View style={styles.quickBar}>
            <TouchableOpacity
              style={[styles.quickSellBtn, orderLoading && { opacity: 0.5 }]}
              onPress={() => handleQuickTrade('sell')} disabled={orderLoading}
            >
              {orderLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <>
                    <Ionicons name="trending-down" size={14} color="#fff" />
                    <Text style={styles.quickBtnText}>Sell</Text>
                  </>
              }
            </TouchableOpacity>

            <View style={styles.lotWrapper}>
              <Text style={styles.lotLabel}>LOT SIZE</Text>
              <View style={styles.lotRow}>
                <TouchableOpacity style={styles.lotBtn} onPress={() => { const n = Math.max(0.01, parseFloat(lotSize || '0.01') - 0.01); setLotSize(n.toFixed(2)); setAmount(n.toFixed(2)); }}>
                  <Text style={styles.lotBtnText}>−</Text>
                </TouchableOpacity>
                <TextInput
                  style={styles.lotInput}
                  value={lotSize}
                  onChangeText={v => { setLotSize(v); setAmount(v); }}
                  keyboardType="decimal-pad"
                />
                <TouchableOpacity style={styles.lotBtn} onPress={() => { const n = Math.min(100, parseFloat(lotSize || '0.01') + 0.01); setLotSize(n.toFixed(2)); setAmount(n.toFixed(2)); }}>
                  <Text style={styles.lotBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.quickBuyBtn, orderLoading && { opacity: 0.5 }]}
              onPress={() => handleQuickTrade('buy')} disabled={orderLoading}
            >
              {orderLoading
                ? <ActivityIndicator color="#000" size="small" />
                : <>
                    <Ionicons name="trending-up" size={14} color="#000" />
                    <Text style={[styles.quickBtnText, { color: '#000' }]}>Buy</Text>
                  </>
              }
            </TouchableOpacity>
          </View>

          {/* ── Pair Header ───────────────────────────────────────────── */}
          <View style={styles.pairCard}>
            {/* Row 1 */}
            <View style={styles.pairRow1}>
              <TouchableOpacity style={styles.pairSelector} onPress={() => setShowPairs(true)}>
                <Text style={styles.pairName}>{pair}</Text>
                <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
              </TouchableOpacity>

              <Text style={styles.pairPrice}>
                ${livePrice > 0 ? livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 }) : '—'}
              </Text>

              <View style={[styles.changePill, { backgroundColor: isChangeUp ? colors.greenMuted : colors.redMuted }]}>
                <Text style={[styles.changeText, { color: isChangeUp ? colors.green : colors.red }]}>
                  {isChangeUp ? '+' : ''}{liveChange.toFixed(2)}%
                </Text>
              </View>

              <View style={styles.liveIndicator}>
                <View style={[styles.liveDot, { backgroundColor: isLive ? colors.green : colors.textMuted }]} />
                <Text style={[styles.liveText, { color: isLive ? colors.green : colors.textMuted }]}>
                  {isLive ? 'live' : 'cached'}
                </Text>
              </View>

              <View style={{ flex: 1 }} />
              <Text style={styles.balanceBadge}>
                ${balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}
              </Text>
            </View>

            {/* Row 2: H/L + bid/ask */}
            <View style={styles.pairRow2}>
              <Text style={styles.pairStat}>H <Text style={styles.pairStatVal}>${high24 > 0 ? fmt(high24) : '—'}</Text></Text>
              <Text style={styles.pairStat}>L <Text style={styles.pairStatVal}>${low24 > 0 ? fmt(low24) : '—'}</Text></Text>
              <Text style={styles.pairDivider}>|</Text>
              <Text style={[styles.pairBidAsk, { color: colors.red }]}>
                {orderBook.bids[0] ? orderBook.bids[0].price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
              </Text>
              <Text style={styles.pairStat}>bid/ask</Text>
              <Text style={[styles.pairBidAsk, { color: colors.green }]}>
                {orderBook.asks[0] ? orderBook.asks[0].price.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
              </Text>
            </View>

            {/* Tab switcher */}
            <View style={styles.tabRow}>
              {(['chart', 'orderbook', 'trades', 'info'] as const).map(t => (
                <TouchableOpacity key={t} style={[styles.tabBtn, chartTab === t && styles.tabBtnActive]} onPress={() => setChartTab(t)}>
                  <Text style={[styles.tabBtnText, chartTab === t && styles.tabBtnTextActive]}>
                    {t === 'chart' ? 'Chart' : t === 'orderbook' ? 'Book' : t === 'trades' ? 'Trades' : 'Info'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* TradingView chart */}
            {chartTab === 'chart' && (
              <WebView
                source={{
                  uri: `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(TV_SYMBOLS[pair] ?? 'BINANCE:BTCUSDT')}&theme=dark&style=1&interval=60&locale=en&toolbar_bg=%230b0e11&withdateranges=1&hide_side_toolbar=1&hide_top_toolbar=0&hide_legend=0&allow_symbol_change=0&save_image=0&show_popup_button=0`,
                }}
                style={styles.tvChart}
                scrollEnabled={false}
                javaScriptEnabled
                originWhitelist={['*']}
              />
            )}

            {/* Tab content */}
            {chartTab === 'orderbook' && (
              <View style={styles.obContainer}>
                <View style={styles.obHeader}>
                  <Text style={styles.obHeaderText}>Price (USDT)</Text>
                  <Text style={styles.obHeaderText}>Amount ({asset})</Text>
                </View>
                {orderBook.asks.slice(0, 5).reverse().map((a, i) => (
                  <View key={i} style={styles.obRow}>
                    <View style={[styles.obBar, { right: 0, backgroundColor: colors.redMuted, width: `${Math.min(a.size / 2 * 100, 100)}%` }]} />
                    <Text style={[styles.obPrice, { color: colors.red }]}>${a.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.obSize}>{a.size.toFixed(4)}</Text>
                  </View>
                ))}
                <View style={styles.obMid}>
                  <Text style={styles.obMidPrice}>${livePrice > 0 ? livePrice.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}</Text>
                </View>
                {orderBook.bids.slice(0, 5).map((b, i) => (
                  <View key={i} style={styles.obRow}>
                    <View style={[styles.obBar, { left: 0, backgroundColor: colors.greenMuted, width: `${Math.min(b.size / 2 * 100, 100)}%` }]} />
                    <Text style={[styles.obPrice, { color: colors.green }]}>${b.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                    <Text style={styles.obSize}>{b.size.toFixed(4)}</Text>
                  </View>
                ))}
              </View>
            )}

            {chartTab === 'trades' && (
              <View style={styles.tradesContainer}>
                {tradeHistory.length === 0 ? (
                  <Text style={styles.emptyText}>No trades yet</Text>
                ) : (
                  tradeHistory.slice(0, 20).map((t: any, i: number) => {
                    const isBuy = (t.action ?? t.side ?? '').toUpperCase() === 'BUY';
                    const time  = t.created_at ? new Date(t.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';
                    return (
                      <View key={i} style={[styles.tradeRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                        <Text style={[styles.tradeSide, { color: isBuy ? colors.green : colors.red }]}>{isBuy ? 'Buy' : 'Sell'}</Text>
                        <Text style={styles.tradePrice}>{(t.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}</Text>
                        <Text style={styles.tradeQty}>{(t.qty ?? 0).toFixed(4)}</Text>
                        <Text style={styles.tradeTime}>{time}</Text>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {chartTab === 'info' && (
              <View style={styles.infoContainer}>
                {[
                  { l: 'Pair',       v: pair,                                                                    c: colors.text },
                  { l: 'Last Price', v: `$${livePrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}`,  c: colors.text },
                  { l: '24h Change', v: `${isChangeUp ? '+' : ''}${liveChange.toFixed(2)}%`,                    c: isChangeUp ? colors.green : colors.red },
                  { l: '24h High',   v: `$${high24 > 0 ? fmt(high24) : '—'}`,                                   c: colors.text },
                  { l: '24h Low',    v: `$${low24 > 0 ? fmt(low24) : '—'}`,                                     c: colors.text },
                  { l: 'Best Bid',   v: orderBook.bids[0] ? `$${fmt(orderBook.bids[0].price)}` : '—',           c: colors.green },
                  { l: 'Best Ask',   v: orderBook.asks[0] ? `$${fmt(orderBook.asks[0].price)}` : '—',           c: colors.red },
                  { l: 'Source',     v: isLive ? 'Live' : 'Cached',                                             c: isLive ? colors.green : colors.textMuted },
                ].map(row => (
                  <View key={row.l} style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{row.l}</Text>
                    <Text style={[styles.infoValue, { color: row.c }]}>{row.v}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* ── Fin AI Chat ───────────────────────────────────────────── */}
          <FinChatPanel
            pair={pair} livePrice={livePrice} liveChange={liveChange}
            token={token} collapsed={chatCollapsed}
            onToggle={() => setChatCollapsed(v => !v)}
            onExecute={handleChatExecute}
          />

          {/* ── Place Order ───────────────────────────────────────────── */}
          <TouchableOpacity style={styles.orderFormToggle} onPress={() => setShowOrderForm(v => !v)}>
            <Ionicons name="list-outline" size={16} color={colors.textSecondary} />
            <Text style={styles.orderFormToggleText}>Place Order</Text>
            <View style={[styles.sideTagSmall, { backgroundColor: side === 'buy' ? colors.greenMuted : colors.redMuted }]}>
              <Text style={[styles.sideTagSmallText, { color: side === 'buy' ? colors.green : colors.red }]}>
                {side.toUpperCase()} · {orderType.toUpperCase()}
              </Text>
            </View>
            <Ionicons name={showOrderForm ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
          </TouchableOpacity>

          {showOrderForm && (
            <View style={styles.orderCard}>
              {/* Buy/Sell + Market/Limit */}
              <View style={styles.orderTopRow}>
                <View style={styles.sideTabs}>
                  <TouchableOpacity style={[styles.sideTab, side === 'buy' && styles.sideTabBuy]} onPress={() => setSide('buy')}>
                    <Text style={[styles.sideTabText, side === 'buy' && { color: '#000' }]}>Buy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.sideTab, side === 'sell' && styles.sideTabSell]} onPress={() => setSide('sell')}>
                    <Text style={[styles.sideTabText, side === 'sell' && { color: '#fff' }]}>Sell</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.typeTabs}>
                  {(['market', 'limit'] as const).map(t => (
                    <TouchableOpacity key={t} style={[styles.typeTab, orderType === t && styles.typeTabActive]} onPress={() => setOrderType(t)}>
                      <Text style={[styles.typeTabText, orderType === t && styles.typeTabTextActive]}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Lot size + Leverage */}
              <View style={styles.orderRow2}>
                <View style={styles.orderFieldHalf}>
                  <Text style={styles.orderLabel}>Lot Size</Text>
                  <View style={styles.steppedInput}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => { const n = Math.max(0.01, parseFloat(lotSize || '0.01') - 0.01); const s = n.toFixed(2); setLotSize(s); setAmount(s); }}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                    <TextInput style={styles.stepVal} value={lotSize} onChangeText={v => { setLotSize(v); setAmount(v); }} keyboardType="decimal-pad" />
                    <TouchableOpacity style={styles.stepBtn} onPress={() => { const n = Math.min(100, parseFloat(lotSize || '0.01') + 0.01); const s = n.toFixed(2); setLotSize(s); setAmount(s); }}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>

                <View style={styles.orderFieldHalf}>
                  <View style={styles.orderLabelRow}>
                    <Ionicons name="flash-outline" size={11} color={colors.accent} />
                    <Text style={styles.orderLabel}>Leverage</Text>
                  </View>
                  <View style={styles.steppedInput}>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setLevIdx(i => Math.max(0, i - 1))}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                    <Text style={[styles.stepVal, { textAlign: 'center', paddingVertical: 12, color: colors.accent, fontWeight: '700' }]}>{leverage}x</Text>
                    <TouchableOpacity style={styles.stepBtn} onPress={() => setLevIdx(i => Math.min(LEVERAGE_STEPS.length - 1, i + 1))}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                  </View>
                </View>
              </View>

              {/* Price (limit only) + Amount */}
              <View style={styles.orderRow2}>
                <View style={styles.orderFieldHalf}>
                  <Text style={styles.orderLabel}>{orderType === 'limit' ? 'Price (USDT)' : 'Price'}</Text>
                  {orderType === 'limit' ? (
                    <TextInput style={styles.orderInput} value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} />
                  ) : (
                    <View style={[styles.orderInput, styles.orderInputDisabled]}>
                      <Text style={styles.orderInputDisabledText}>Market</Text>
                    </View>
                  )}
                </View>
                <View style={styles.orderFieldHalf}>
                  <Text style={styles.orderLabel}>Amount ({asset})</Text>
                  <TextInput style={styles.orderInput} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.0000" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              {/* SL + TP */}
              <View style={styles.orderRow2}>
                <View style={styles.orderFieldHalf}>
                  <Text style={styles.orderLabel}>Stop Loss $</Text>
                  <TextInput style={[styles.orderInput, { color: colors.red }]} value={stopLoss} onChangeText={setSL} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} />
                </View>
                <View style={styles.orderFieldHalf}>
                  <Text style={styles.orderLabel}>Take Profit $</Text>
                  <TextInput style={[styles.orderInput, { color: colors.green }]} value={takeProfit} onChangeText={setTP} keyboardType="decimal-pad" placeholder="optional" placeholderTextColor={colors.textMuted} />
                </View>
              </View>

              {/* Order summary */}
              {orderTotal > 0 && (
                <View style={styles.orderSummary}>
                  <Text style={styles.orderSummaryText}>Margin Required: <Text style={styles.orderSummaryVal}>${orderTotal.toFixed(2)}</Text></Text>
                  <Text style={styles.orderSummaryText}>Available: <Text style={[styles.orderSummaryVal, { color: balance >= orderTotal ? colors.green : colors.red }]}>${fmt(balance)}</Text></Text>
                </View>
              )}

              {/* Submit */}
              <TouchableOpacity
                style={[styles.orderSubmit, { backgroundColor: side === 'buy' ? colors.green : colors.red }, orderLoading && { opacity: 0.6 }]}
                onPress={handleTrade} disabled={orderLoading}
              >
                {orderLoading ? <ActivityIndicator color={side === 'buy' ? '#000' : '#fff'} size="small" /> : (
                  <View style={styles.orderSubmitInner}>
                    <Ionicons name={side === 'buy' ? 'trending-up' : 'trending-down'} size={16} color={side === 'buy' ? '#000' : '#fff'} />
                    <Text style={[styles.orderSubmitText, { color: side === 'buy' ? '#000' : '#fff' }]}>
                      {side === 'buy' ? 'Place Buy Order' : 'Place Sell Order'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* ── Open Positions ────────────────────────────────────────── */}
          {openPositions.length > 0 && (
            <View style={styles.positionsCard}>
              <Text style={styles.sectionHeader}>OPEN POSITIONS ({openPositions.length})</Text>
              {openPositions.map((pos: any, i: number) => {
                const posIsLong = (pos.side ?? pos.action ?? 'long').toUpperCase().startsWith('L') || (pos.action ?? '').toUpperCase() === 'BUY';
                const upnl = pos.unrealized_pnl ?? 0;
                return (
                  <View key={i} style={[styles.posRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
                    <View style={styles.posLeft}>
                      <View style={styles.posTopRow}>
                        <Text style={styles.posTicker}>{pos.ticker}</Text>
                        <View style={[styles.posSideBadge, { backgroundColor: posIsLong ? colors.greenMuted : colors.redMuted }]}>
                          <Text style={[styles.posSideBadgeText, { color: posIsLong ? colors.green : colors.red }]}>{posIsLong ? 'LONG' : 'SHORT'}</Text>
                        </View>
                        {pos.leverage > 1 && <Text style={styles.posLevTag}>{pos.leverage}x</Text>}
                      </View>
                      <Text style={styles.posMeta}>Entry ${(pos.price ?? 0).toLocaleString('en-US', { maximumFractionDigits: 4 })} · Qty {(pos.qty ?? 0).toFixed(6)}</Text>
                    </View>
                    <View style={styles.posRight}>
                      <Text style={[styles.posPnl, { color: upnl >= 0 ? colors.green : colors.red }]}>
                        {upnl >= 0 ? '+' : ''}${upnl.toFixed(2)}
                      </Text>
                      <TouchableOpacity
                        style={styles.posCloseBtn}
                        onPress={() => handleClosePosition(pos.id, pos.ticker)}
                        disabled={closingId === pos.id}
                      >
                        {closingId === pos.id ? <ActivityIndicator color={colors.accent} size="small" /> : <Text style={styles.posCloseBtnText}>Close</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pair selector modal */}
      <Modal visible={showPairs} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.pairSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.pairSheetTitle}>Select Pair</Text>
            <FlatList
              data={PAIRS}
              keyExtractor={p => p}
              renderItem={({ item }) => (
                <TouchableOpacity style={[styles.pairSheetRow, item === pair && styles.pairSheetRowActive]} onPress={() => { setPair(item); setShowPairs(false); setAmount(''); }}>
                  <Text style={[styles.pairSheetRowText, item === pair && { color: colors.accent }]}>{item}</Text>
                  {item === pair && <Ionicons name="checkmark" size={16} color={colors.accent} />}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.pairSheetCancel} onPress={() => setShowPairs(false)}>
              <Text style={styles.pairSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: 100 },

  // ── Quick Bar ────────────────────────────────────────────────────────────
  quickBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: 10,
  },
  quickSellBtn: { flex: 1, backgroundColor: colors.red, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  quickBuyBtn:  { flex: 1, backgroundColor: colors.green, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 },
  quickBtnText: { fontSize: font.md, fontWeight: '700', color: '#fff' },
  lotWrapper:   { alignItems: 'center', gap: 4 },
  lotLabel:     { fontSize: 9, color: colors.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  lotRow:       { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderRadius: radius.sm, overflow: 'hidden', borderWidth: 1, borderColor: colors.border },
  lotBtn:       { paddingHorizontal: 10, paddingVertical: 8 },
  lotBtnText:   { color: colors.textSecondary, fontSize: 16, lineHeight: 20 },
  lotInput:     { width: 52, textAlign: 'center', fontSize: font.xs, fontWeight: '700', color: colors.accent, paddingVertical: 8 },

  // ── Pair Card ───────────────────────────────────────────────────────────
  pairCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, ...shadow.card, overflow: 'hidden' },
  pairRow1: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, flexWrap: 'wrap' },
  pairSelector: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 6, backgroundColor: colors.cardAlt, borderRadius: radius.sm },
  pairName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  pairPrice: { fontSize: font.lg, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  changePill: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  changeText: { fontSize: font.xs, fontWeight: '700' },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.green },
  liveText: { fontSize: 10, fontWeight: '600' },
  balanceBadge: { fontSize: font.xs, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentMuted, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  pairRow2: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingBottom: 8 },
  pairStat: { fontSize: 10, color: colors.textSecondary },
  pairStatVal: { color: colors.text, fontWeight: '600' },
  pairBidAsk: { fontSize: 10, fontWeight: '600' },
  pairDivider: { color: colors.border, fontSize: 12 },
  tabRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: colors.accent },
  tabBtnText: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },
  tabBtnTextActive: { color: colors.accent },
  tvChart: { height: 320, backgroundColor: '#0b0e11' },

  // Order book
  obContainer: { padding: spacing.sm },
  obHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  obHeaderText: { fontSize: 9, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  obRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, position: 'relative' },
  obBar: { position: 'absolute', top: 0, bottom: 0, opacity: 0.5 },
  obPrice: { fontSize: 11, fontWeight: '600', zIndex: 1 },
  obSize: { fontSize: 11, color: colors.textSecondary, zIndex: 1 },
  obMid: { backgroundColor: colors.cardAlt, paddingVertical: 6, alignItems: 'center', marginVertical: 4, borderRadius: radius.sm },
  obMidPrice: { fontSize: font.md, fontWeight: '700', color: colors.text },

  // Trades tab
  tradesContainer: { maxHeight: 300 },
  tradeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: spacing.sm },
  tradeSide: { fontSize: font.xs, fontWeight: '700', width: 32 },
  tradePrice: { fontSize: 11, color: colors.text, fontWeight: '600', flex: 1, textAlign: 'center' },
  tradeQty: { fontSize: 11, color: colors.textSecondary, flex: 1, textAlign: 'center' },
  tradeTime: { fontSize: 10, color: colors.textMuted, width: 70, textAlign: 'right' },
  emptyText: { padding: spacing.xl, textAlign: 'center', color: colors.textMuted, fontSize: font.sm },

  // Info tab
  infoContainer: {},
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  infoLabel: { fontSize: font.xs, color: colors.textSecondary },
  infoValue: { fontSize: font.xs, fontWeight: '700' },

  // ── FinChat ─────────────────────────────────────────────────────────────
  chatCollapsed: {
    marginHorizontal: spacing.md, marginTop: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: spacing.md,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  chatCollapsedLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  chatBotCircle: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center',
  },
  chatCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  chatHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  chatTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  chatSub: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  chatLiveRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 4 },
  chatLiveText: { fontSize: 10, color: colors.green, fontWeight: '600' },
  chatClose: { marginLeft: 'auto', padding: 6 },
  chatContextBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, padding: spacing.sm, backgroundColor: colors.bg + '80', borderBottomWidth: 1, borderBottomColor: colors.border + '80' },
  chatPairLabel: { fontSize: font.xs, fontWeight: '700', color: colors.accent },
  chatPriceText: { fontSize: 10, fontWeight: '600' },
  suggestBtn: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + '40', borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5 },
  suggestBtnText: { fontSize: 10, fontWeight: '700', color: colors.accent },
  chatControls: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: spacing.xs, backgroundColor: colors.bg + '50', borderBottomWidth: 1, borderBottomColor: colors.border + '50' },
  chatCtrlLabel: { fontSize: 9, color: colors.textMuted, fontWeight: '600' },
  ctrlBtn: { width: 22, height: 22, borderRadius: 6, backgroundColor: colors.cardAlt, alignItems: 'center', justifyContent: 'center' },
  ctrlBtnText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  ctrlInput: { width: 44, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.accent, backgroundColor: colors.cardAlt, borderRadius: 6, paddingVertical: 4 },
  ctrlLevText: { width: 36, textAlign: 'center', fontSize: 11, fontWeight: '700', color: colors.accent },
  ctrlDivider: { width: 1, height: 20, backgroundColor: colors.border, marginHorizontal: 4 },
  chatMessages: { maxHeight: 320 },
  chatEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  chatEmptyIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center' },
  chatEmptyTitle: { fontSize: font.sm, fontWeight: '600', color: colors.text },
  chatEmptyText: { fontSize: 11, color: colors.textSecondary, textAlign: 'center', maxWidth: 260 },
  chatUserBubble: { alignSelf: 'flex-end', backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + '30', borderRadius: 12, borderTopRightRadius: 4, padding: spacing.sm, maxWidth: '85%' },
  chatUserText: { fontSize: 12, color: colors.text, lineHeight: 18 },
  chatAiRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  chatAiAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  chatAiName: { fontSize: 10, fontWeight: '700', color: colors.accent },
  chatAiText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginTop: 2, flex: 1 },
  typingDots: { flexDirection: 'row', gap: 4, paddingVertical: 8, paddingHorizontal: 12, backgroundColor: colors.cardAlt, borderRadius: 12, borderTopLeftRadius: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  suggCard: { marginTop: 8, borderRadius: 12, borderWidth: 1, padding: spacing.sm },
  suggSideRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
  suggSide: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  suggStats: { flexDirection: 'row', gap: spacing.sm, marginBottom: 8 },
  suggStat: { flex: 1 },
  suggStatLabel: { fontSize: 9, color: colors.textMuted, marginBottom: 2 },
  suggStatValue: { fontSize: 11, fontWeight: '700' },
  suggExecBtn: { borderRadius: radius.md, paddingVertical: 8, alignItems: 'center', marginBottom: 4, flexDirection: 'row', justifyContent: 'center', gap: 5 },
  suggExecBtnText: { fontSize: 12, fontWeight: '700', color: '#000' },
  suggMeta: { fontSize: 9, color: colors.textMuted, textAlign: 'center' },
  chatInputRow: { flexDirection: 'row', gap: spacing.sm, padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  chatInput: { flex: 1, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 10, fontSize: font.xs, color: colors.text },
  chatSendBtn: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: colors.accentMuted, borderWidth: 1, borderColor: colors.accent + '40', alignItems: 'center', justifyContent: 'center' },

  // ── Order Form ──────────────────────────────────────────────────────────
  orderFormToggle: { marginHorizontal: spacing.md, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  orderFormToggleText: { fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 },
  sideTagSmall: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  sideTagSmallText: { fontSize: 10, fontWeight: '700' },
  orderCard: { marginHorizontal: spacing.md, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, borderTopLeftRadius: 0, borderTopRightRadius: 0, padding: spacing.md, gap: spacing.md },
  orderTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sideTabs: { flex: 1, flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: 3 },
  sideTab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.sm },
  sideTabBuy: { backgroundColor: colors.green },
  sideTabSell: { backgroundColor: colors.red },
  sideTabText: { fontSize: font.sm, fontWeight: '700', color: colors.textSecondary },
  typeTabs: { flexDirection: 'row', backgroundColor: colors.bg, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, padding: 2 },
  typeTab: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.sm },
  typeTabActive: { backgroundColor: colors.cardAlt },
  typeTabText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },
  typeTabTextActive: { color: colors.text },
  orderRow2: { flexDirection: 'row', gap: spacing.sm },
  orderFieldHalf: { flex: 1 },
  orderLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  orderLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 6, fontWeight: '500' },
  steppedInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden' },
  stepBtn: { paddingHorizontal: 12, paddingVertical: 11, backgroundColor: colors.cardAlt },
  stepBtnText: { fontSize: 16, color: colors.textSecondary, lineHeight: 20 },
  stepVal: { flex: 1, textAlign: 'center', fontSize: font.xs, fontWeight: '700', color: colors.text, paddingVertical: 12 },
  orderInput: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: 12, fontSize: font.sm, color: colors.text },
  orderInputDisabled: { justifyContent: 'center' },
  orderInputDisabledText: { fontSize: font.sm, color: colors.textMuted },
  orderSummary: { backgroundColor: colors.cardAlt, borderRadius: radius.md, padding: spacing.sm, gap: 4 },
  orderSummaryText: { fontSize: font.xs, color: colors.textSecondary },
  orderSummaryVal: { fontWeight: '700', color: colors.text },
  orderSubmit: { borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center' },
  orderSubmitInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  orderSubmitText: { fontSize: font.md, fontWeight: '700' },

  // ── Positions ──────────────────────────────────────────────────────────
  positionsCard: { marginHorizontal: spacing.md, marginTop: spacing.sm, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  sectionHeader: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.sm },
  posRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, gap: spacing.sm },
  posLeft: { flex: 1 },
  posTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: 4 },
  posTicker: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  posSideBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  posSideBadgeText: { fontSize: 9, fontWeight: '700' },
  posLevTag: { fontSize: 9, fontWeight: '700', color: colors.accent, backgroundColor: colors.accentMuted, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1 },
  posMeta: { fontSize: 10, color: colors.textMuted },
  posRight: { alignItems: 'flex-end', gap: 6 },
  posPnl: { fontSize: font.md, fontWeight: '700' },
  posCloseBtn: { borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accent + '60', paddingHorizontal: 10, paddingVertical: 5 },
  posCloseBtnText: { fontSize: font.xs, fontWeight: '600', color: colors.accent },

  // ── Modal (pair selector) ───────────────────────────────────────────────
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
  pairSheet: { backgroundColor: colors.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, borderTopWidth: 1, borderColor: colors.border, paddingTop: spacing.sm, maxHeight: '80%' },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, alignSelf: 'center', marginBottom: spacing.md },
  pairSheetTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  pairSheetRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  pairSheetRowActive: { backgroundColor: colors.accentMuted },
  pairSheetRowText: { fontSize: font.md, color: colors.text, fontWeight: '600' },
  pairSheetCancel: { padding: spacing.lg, alignItems: 'center', borderTopWidth: 1, borderTopColor: colors.border },
  pairSheetCancelText: { fontSize: font.md, fontWeight: '600', color: colors.textSecondary },
});
