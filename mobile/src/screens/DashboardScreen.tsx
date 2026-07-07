import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity,
  ActivityIndicator, SafeAreaView, StatusBar, Modal, Animated, Pressable,
  Dimensions, Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import {
  getTodayPnl, getOpenPositions, getBotStatus, finEventListBots,
  getBotTrades, getEvents, getMyBonusTasks, claimBonusTask,
  clearEvents, getMe, getUserNotifications,
} from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

const { width: W } = Dimensions.get('window');

/* ─── helpers ──────────────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Good Early Morning';
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  if (h < 22) return 'Good Evening';
  return 'Good Night';
}

function fmtCompact(n: number) {
  const abs = Math.abs(n), sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 10_000)    return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

const TIER_LABELS = ['Unverified', 'Tier 1', 'Tier 2', 'Tier 3'];
const TIER_COLORS = [colors.textSecondary, colors.accent, colors.green, '#a78bfa'];

const NAV_LINKS = [
  { label: 'Dashboard',    icon: '⌂',  screen: 'Dashboard' },
  { label: 'Wallet',       icon: '💳', screen: 'Wallet' },
  { label: 'History',      icon: '🧾', screen: 'Transactions' },
  { label: 'News',         icon: '📰', screen: 'News' },
  { label: 'Settings',     icon: '⚙️', screen: 'Settings' },
  { label: 'Support',      icon: '💬', screen: 'Support' },
];

/* ─── Drawer ─────────────────────────────────────────────── */
function DrawerMenu({
  open, onClose, user, onLogout, navigation,
}: {
  open: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
  navigation: any;
}) {
  const slideAnim = useRef(new Animated.Value(-W * 0.75)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: -W * 0.75, duration: 180, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);

  const tierIdx = Math.min(user?.account_tier ?? user?.tier ?? 0, 3);

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View style={[dr.backdrop, { opacity: opacityAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View style={[dr.panel, { transform: [{ translateX: slideAnim }] }]}>
        {/* User header */}
        <SafeAreaView style={dr.safeTop}>
          <View style={dr.userRow}>
            <View style={dr.avatarCircle}>
              <Text style={dr.avatarText}>
                {(user?.email?.[0] ?? 'U').toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={dr.userName} numberOfLines={1}>
                {user?.full_name || user?.first_name || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={dr.userEmail} numberOfLines={1}>{user?.email}</Text>
              <Text style={[dr.userTier, { color: TIER_COLORS[tierIdx] }]}>
                {TIER_LABELS[tierIdx]}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={dr.closeBtn}>
              <Text style={dr.closeIcon}>✕</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {/* Nav links */}
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={dr.navList}>
            {NAV_LINKS.map((link) => (
              <TouchableOpacity
                key={link.label}
                style={dr.navItem}
                onPress={() => {
                  onClose();
                  if (link.params) {
                    navigation.navigate(link.screen, link.params);
                  } else {
                    navigation.navigate(link.screen);
                  }
                }}
                activeOpacity={0.7}
              >
                <Text style={dr.navIcon}>{link.icon}</Text>
                <Text style={dr.navLabel}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Sign out */}
        <View style={dr.footer}>
          <TouchableOpacity style={dr.signOutBtn} onPress={onLogout} activeOpacity={0.7}>
            <Text style={dr.signOutIcon}>🚪</Text>
            <Text style={dr.signOutLabel}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

/* ─── Main Dashboard ─────────────────────────────────────── */
export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, refreshUser, logout } = useAuth();

  const [drawerOpen, setDrawerOpen]         = useState(false);
  const [hideBalance, setHideBalance]       = useState(false);
  const [refreshing, setRefreshing]         = useState(false);
  const [loading, setLoading]               = useState(true);

  /* Stats */
  const [todayPnl, setTodayPnl]             = useState(0);
  const [realizedPnl, setRealizedPnl]       = useState(0);
  const [unrealizedPnl, setUnrealizedPnl]   = useState(0);
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [openPositions, setOpenPositions]   = useState(0);
  const [manualOpen, setManualOpen]         = useState(0);
  const [finBotOpen, setFinBotOpen]         = useState(0);
  const [finEventOpen, setFinEventOpen]     = useState(0);

  /* Bot status */
  const [botRunning, setBotRunning]             = useState(false);
  const [finEventRunning, setFinEventRunning]   = useState(false);

  /* Counts */
  const [newsCount, setNewsCount]           = useState(0);
  const [tradeCount, setTradeCount]         = useState(0);
  const [unreadNotifs, setUnreadNotifs]     = useState(0);

  /* Events */
  const [events, setEvents]                 = useState<any[]>([]);
  const [showPastEvents, setShowPastEvents] = useState(false);
  const [clearingEvts, setClearingEvts]     = useState(false);

  /* Bonus tasks */
  const [bonusTasks, setBonusTasks]         = useState<any[]>([]);
  const [claimingId, setClaimingId]         = useState<number | null>(null);

  /* ── fetch ── */
  const load = useCallback(async () => {
    try {
      const [pnlRes, botRes, finEvRes, evRes] = await Promise.allSettled([
        getTodayPnl(),
        getBotStatus(),
        finEventListBots().catch(() => ({ data: { bots: [] } })),
        getEvents(20),
      ]);

      if (pnlRes.status === 'fulfilled') {
        setTodayPnl(pnlRes.value.data?.today_pnl ?? 0);
      }

      let portVal = 0, unreal = 0, fBotOpen = 0;
      if (botRes.status === 'fulfilled') {
        const bots: Record<string, any> = botRes.value.data?.bots ?? {};
        setBotRunning(botRes.value.data?.running ?? false);
        for (const b of Object.values(bots)) {
          portVal += b.portfolio_value ?? 0;
          if (b.position > 0) { unreal += b.unrealized_pnl ?? 0; fBotOpen++; }
        }
      }
      setFinBotOpen(fBotOpen);

      let feOpen = 0;
      if (finEvRes.status === 'fulfilled') {
        const feBots: any[] = finEvRes.value.data?.bots ?? [];
        feOpen = Array.isArray(feBots) ? feBots.filter((b) => b.running || (b.position ?? 0) > 0).length : 0;
        setFinEventOpen(feOpen);
        setFinEventRunning(Array.isArray(feBots) && feBots.some((b) => b.running));
      }

      if (evRes.status === 'fulfilled') {
        const evList = Array.isArray(evRes.value.data) ? evRes.value.data : evRes.value.data?.events ?? [];
        setEvents(evList);
      }

      /* Manual positions */
      let manOpen = 0;
      try {
        const posRes = await getOpenPositions();
        const mpos: any[] = Array.isArray(posRes.data) ? posRes.data : posRes.data?.positions ?? [];
        manOpen = mpos.length;
        for (const p of mpos) {
          unreal  += p.unrealized_pnl ?? 0;
          portVal += (p.qty ?? 0) * (p.current_price || p.price || 0);
        }
      } catch { /* silent */ }
      setManualOpen(manOpen);
      setUnrealizedPnl(unreal);
      setOpenPositions(fBotOpen + feOpen + manOpen);
      setPortfolioValue(portVal);

      /* Trades & realized P&L */
      try {
        const trRes = await getBotTrades(200);
        const trades: any[] = trRes.data?.trades ?? [];
        setTradeCount(trades.length);
        setRealizedPnl(trades.filter((t) => t.pnl !== null).reduce((s, t) => s + (t.pnl ?? 0), 0));
      } catch { /* silent */ }

      /* News count */
      try {
        const nr = await fetch('/api/public/news').then(r => r.json());
        if (Array.isArray(nr)) setNewsCount(nr.length);
      } catch { /* silent */ }

      /* Notifications */
      try {
        const notifRes = await getUserNotifications();
        const notifs: any[] = Array.isArray(notifRes.data) ? notifRes.data : [];
        setUnreadNotifs(notifs.filter((n) => !n.is_read).length);
      } catch { /* silent */ }

    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    refreshUser();
    /* Bonus tasks */
    getMyBonusTasks()
      .then((r) => setBonusTasks(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); refreshUser(); };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => { setDrawerOpen(false); logout(); } },
    ]);
  };

  const handleClaim = async (bonusId: number) => {
    setClaimingId(bonusId);
    try {
      const res = await claimBonusTask(bonusId);
      setBonusTasks((t) => t.filter((task) => task.bonus_id !== bonusId));
      await refreshUser();
      Alert.alert('🎉 Claimed!', `+$${res.data?.amount_usdt?.toFixed(2) ?? '0.00'} USDT added to your balance.`);
    } catch {
      Alert.alert('Error', 'Failed to claim bonus. Please try again.');
    } finally {
      setClaimingId(null);
    }
  };

  const handleClearEvents = async () => {
    setClearingEvts(true);
    try {
      await clearEvents();
      setEvents([]);
    } catch { /* silent */ }
    finally { setClearingEvts(false); }
  };

  const balance  = user?.balance_usdt ?? 0;
  const pnlPos   = todayPnl >= 0;
  const realPos  = realizedPnl >= 0;
  const unrPos   = unrealizedPnl >= 0;
  const firstName = user?.first_name || user?.full_name?.split(' ')[0] || user?.username || user?.email?.split('@')[0] || 'User';

  if (loading) {
    return (
      <View style={s.loadingCenter}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      <DrawerMenu
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        onLogout={handleLogout}
        navigation={navigation}
      />

      {/* ── Header ── */}
      <View style={s.header}>
        {/* Left: avatar + greeting */}
        <TouchableOpacity style={s.headerLeft} onPress={() => setDrawerOpen(true)} activeOpacity={0.7}>
          <View style={s.headerAvatar}>
            <Text style={s.headerAvatarText}>{(user?.email?.[0] ?? 'U').toUpperCase()}</Text>
          </View>
          <View>
            <Text style={s.headerHi}>Hi, {firstName}</Text>
            <Text style={s.headerGreeting}>{getGreeting()}</Text>
          </View>
        </TouchableOpacity>

        {/* Right: bell + chat */}
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.headerIconBtn}
            onPress={() => navigation.navigate('More', { screen: 'Notifications' })}
            activeOpacity={0.7}
          >
            <Text style={s.headerIconTxt}>🔔</Text>
            {unreadNotifs > 0 && (
              <View style={s.notifBadge}>
                <Text style={s.notifBadgeTxt}>{unreadNotifs > 9 ? '9+' : unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.headerIconBtn, { backgroundColor: colors.accentMuted, borderColor: colors.accent + '40' }]}
            onPress={() => navigation.navigate('More', { screen: 'Chat' })}
            activeOpacity={0.7}
          >
            <Text style={s.headerIconTxt}>💬</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero Balance ── */}
        <View style={s.heroCard}>
          <View style={s.heroGlow} pointerEvents="none" />
          <View style={s.heroInner}>
            {/* Label + eye toggle */}
            <View style={s.heroTopRow}>
              <Text style={s.heroLabel}>TOTAL BALANCE</Text>
              <TouchableOpacity onPress={() => setHideBalance((h) => !h)} style={s.eyeBtn}>
                <Text style={s.eyeIcon}>{hideBalance ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            {/* Balance */}
            <Text style={s.heroBalance}>
              {hideBalance ? '••••••' : `$${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>

            {/* BTC equiv placeholder */}
            <View style={s.btcRow}>
              <View style={s.btcBadge}><Text style={s.btcBadgeText}>BTC</Text></View>
              <Text style={s.btcText}>{hideBalance ? '••••••' : `≈ ${(balance / 97000).toFixed(6)} BTC`}</Text>
            </View>

            {/* Action buttons */}
            <View style={s.actionRow}>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.greenMuted }]}
                onPress={() => navigation.navigate('More', { screen: 'Wallet' })}
                activeOpacity={0.8}
              >
                <Text style={[s.actionBtnText, { color: colors.green }]}>Deposit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.redMuted }]}
                onPress={() => navigation.navigate('More', { screen: 'Wallet' })}
                activeOpacity={0.8}
              >
                <Text style={[s.actionBtnText, { color: colors.red }]}>Withdraw</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.actionBtn, { backgroundColor: colors.accentMuted }]}
                onPress={() => navigation.navigate('More', { screen: 'Wallet' })}
                activeOpacity={0.8}
              >
                <Text style={[s.actionBtnText, { color: colors.accent }]}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Portfolio Strip ── */}
        <View style={s.strip}>
          <View style={s.stripCol}>
            <Text style={s.stripLabel}>Portfolio Value</Text>
            <Text style={[s.stripValue, { color: colors.text }]}>
              ${portfolioValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
          </View>
          <View style={s.stripDivider} />
          <View style={s.stripCol}>
            <Text style={s.stripLabel}>{pnlPos ? '▲' : '▼'} Today's P&L</Text>
            <Text style={[s.stripValue, { color: pnlPos ? colors.green : colors.red }]}>
              {pnlPos ? '+' : ''}{fmtCompact(todayPnl)}
            </Text>
          </View>
          <View style={s.stripDivider} />
          <View style={s.stripCol}>
            <Text style={s.stripLabel}>💰 Realized P&L</Text>
            <Text style={[s.stripValue, { color: realPos ? colors.green : colors.red }]}>
              {realPos ? '+' : ''}{fmtCompact(realizedPnl)}
            </Text>
          </View>
        </View>

        {/* ── Open Positions (conditional) ── */}
        {openPositions > 0 && (
          <View style={s.posBox}>
            <View style={s.posLeft}>
              <View style={s.posIconBox}><Text style={{ fontSize: 13 }}>📊</Text></View>
              <View>
                <Text style={s.posTitle}>{openPositions} Position{openPositions !== 1 ? 's' : ''}</Text>
                <Text style={s.posSub}>
                  Trade <Text style={s.posCount}>{manualOpen}</Text>
                  {'  ·  '}FinBot <Text style={s.posCount}>{finBotOpen}</Text>
                  {'  ·  '}Event <Text style={s.posCount}>{finEventOpen}</Text>
                </Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={[s.posUnreal, { color: unrPos ? colors.green : colors.red }]}>
                {unrPos ? '+' : ''}{fmtCompact(unrealizedPnl)}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('More', { screen: 'Positions' })}>
                <Text style={s.posViewLink}>View →</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── Activity Center ── */}
        <Text style={s.sectionHeader}>Activity Center</Text>
        <View style={s.activityGrid}>
          {/* News */}
          <TouchableOpacity style={s.activityTile} onPress={() => navigation.navigate('More', { screen: 'News' })} activeOpacity={0.75}>
            {newsCount > 0 && (
              <View style={s.tileBadge}><Text style={s.tileBadgeText}>{newsCount > 99 ? '99+' : newsCount}</Text></View>
            )}
            <Text style={s.activityTileIcon}>📰</Text>
            <Text style={s.activityTileLabel}>News</Text>
          </TouchableOpacity>

          {/* FinBot */}
          <TouchableOpacity style={s.activityTile} onPress={() => navigation.navigate('Bots')} activeOpacity={0.75}>
            <View style={[s.botIconCircle, { backgroundColor: botRunning ? colors.greenMuted : colors.border }]}>
              <Text style={{ fontSize: 20 }}>🤖</Text>
            </View>
            <Text style={s.activityTileLabel}>FIN BOT</Text>
            <View style={s.botStatusRow}>
              <Text style={s.botStatusLabel}>AI Bot</Text>
              <View style={s.botPulseRow}>
                <View style={[s.botPulseDot, { backgroundColor: botRunning ? colors.green : colors.red }]} />
                <Text style={[s.botPulseText, { color: botRunning ? colors.green : colors.textSecondary }]}>
                  {botRunning ? 'Live' : 'Offline'}
                </Text>
              </View>
            </View>
            <View style={s.botDivider} />
            <View style={s.botStatusRow}>
              <Text style={s.botStatusLabel}>FinEvent</Text>
              <View style={s.botPulseRow}>
                <View style={[s.botPulseDot, { backgroundColor: finEventRunning ? colors.green : colors.red }]} />
                <Text style={[s.botPulseText, { color: finEventRunning ? colors.green : colors.textSecondary }]}>
                  {finEventRunning ? 'Live' : 'Offline'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Trade */}
          <TouchableOpacity style={s.activityTile} onPress={() => navigation.navigate('Trade')} activeOpacity={0.75}>
            {tradeCount > 0 && (
              <View style={[s.tileBadge, { backgroundColor: '#627eea' }]}>
                <Text style={s.tileBadgeText}>{tradeCount > 99 ? '99+' : tradeCount}</Text>
              </View>
            )}
            <Text style={s.activityTileIcon}>⚡</Text>
            <Text style={s.activityTileLabel}>Trade</Text>
          </TouchableOpacity>
        </View>

        {/* ── Quick Actions ── */}
        <Text style={s.sectionHeader}>Quick Actions</Text>
        <View style={s.quickGrid}>
          {[
            { label: 'Signals',  icon: '💡', onPress: () => navigation.navigate('More') },
            { label: 'History',  icon: '🧾', onPress: () => navigation.navigate('More', { screen: 'Transactions' }) },
            { label: 'Calendar', icon: '📅', onPress: () => navigation.navigate('More', { screen: 'Calendar' }) },
            { label: 'Alert',    icon: '🔔', onPress: () => navigation.navigate('More', { screen: 'Alerts' }) },
            { label: 'Pricing',  icon: '🛒', onPress: () => navigation.navigate('More', { screen: 'Pricing' }) },
            { label: 'More',     icon: '⊞',  onPress: () => navigation.navigate('More') },
          ].map(({ label, icon, onPress }) => (
            <TouchableOpacity key={label} style={s.quickTile} onPress={onPress} activeOpacity={0.75}>
              <Text style={s.quickIcon}>{icon}</Text>
              <Text style={s.quickLabel}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Bonus Tasks ── */}
        {bonusTasks.length > 0 && (
          <View>
            <View style={s.sectionHeaderRow}>
              <Text style={s.sectionHeader}>🎁 Pending Tasks</Text>
              <View style={s.sectionBadge}>
                <Text style={s.sectionBadgeText}>{bonusTasks.length} available</Text>
              </View>
            </View>
            {bonusTasks.map((task) => (
              <View key={task.claim_id} style={s.bonusCard}>
                <View style={s.bonusIconBox}><Text style={{ fontSize: 18 }}>🎁</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.bonusTitle}>{task.title}</Text>
                  {(task.task_description || task.note) && (
                    <Text style={s.bonusDesc}>{task.task_description || task.note}</Text>
                  )}
                  <Text style={s.bonusReward}>Reward: ${task.amount_usdt?.toFixed(2)} USDT</Text>
                </View>
                <TouchableOpacity
                  style={[s.claimBtn, claimingId === task.bonus_id && { opacity: 0.6 }]}
                  onPress={() => handleClaim(task.bonus_id)}
                  disabled={claimingId === task.bonus_id}
                  activeOpacity={0.8}
                >
                  <Text style={s.claimBtnText}>
                    {claimingId === task.bonus_id ? '…' : `Claim $${task.amount_usdt?.toFixed(2)}`}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* ── AI Market Events ── */}
        <View style={s.eventsSection}>
          <View style={s.eventsTitleRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.sectionHeader}>AI Market Events</Text>
              {finEventRunning && events.length > 0 && (
                <View style={s.greenBadge}><Text style={s.greenBadgeText}>{events.length}</Text></View>
              )}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {finEventRunning && (
                <>
                  <TouchableOpacity style={s.evtBtn} onPress={() => setShowPastEvents(true)}>
                    <Text style={s.evtBtnText}>Past</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.evtBtn, { borderColor: colors.red + '50' }]}
                    onPress={handleClearEvents}
                    disabled={clearingEvts}
                  >
                    <Text style={[s.evtBtnText, { color: colors.red }]}>Clear</Text>
                  </TouchableOpacity>
                </>
              )}
              <View style={[s.evtPulseDot, { backgroundColor: finEventRunning ? colors.green : colors.border }]} />
              <Text style={{ fontSize: 13 }}>⚡</Text>
            </View>
          </View>

          <View style={s.eventsCard}>
            {!finEventRunning ? (
              <View style={s.eventsEmpty}>
                <View style={s.lockCircle}><Text style={{ fontSize: 22 }}>🔒</Text></View>
                <Text style={s.eventsEmptyTitle}>FinEvent Bot not running</Text>
                <Text style={s.eventsEmptyDesc}>
                  Start the FinEvent Bot in the Bots page to detect AI market events
                </Text>
              </View>
            ) : events.length === 0 ? (
              <View style={s.eventsEmpty}>
                <Text style={s.eventsEmptyTitle}>No events detected yet</Text>
                <Text style={s.eventsEmptyDesc}>FinEvent Bot is running · events appear every 5 min</Text>
              </View>
            ) : (
              events.slice(0, 5).map((ev, i) => (
                <View key={i} style={[s.evtRow, i < Math.min(events.length, 5) - 1 && s.evtRowBorder]}>
                  <Text style={s.evtDesc} numberOfLines={2}>
                    {ev.description ?? ev.event_type}
                  </Text>
                  <View style={s.evtMeta}>
                    <View style={s.evtDot} />
                    <Text style={s.evtMetaText}>
                      {ev.tickers_affected?.[0] ?? 'Market'}
                      {ev.created_at ? ` · ${new Date(ev.created_at).toLocaleDateString()}` : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Past events modal */}
        <Modal
          visible={showPastEvents}
          transparent
          animationType="slide"
          onRequestClose={() => setShowPastEvents(false)}
        >
          <View style={s.modalBackdrop}>
            <View style={s.modalPanel}>
              <View style={s.modalHeader}>
                <Text style={s.modalTitle}>📋 Past AI Events ({events.length})</Text>
                <TouchableOpacity onPress={() => setShowPastEvents(false)}>
                  <Text style={{ color: colors.textSecondary, fontSize: 18 }}>✕</Text>
                </TouchableOpacity>
              </View>
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                {events.length === 0 ? (
                  <Text style={[s.eventsEmptyDesc, { textAlign: 'center', paddingVertical: 32 }]}>No past events</Text>
                ) : events.map((ev, i) => (
                  <View key={i} style={[s.evtRow, s.evtRowBorder]}>
                    <Text style={s.evtDesc}>{ev.description ?? ev.event_type}</Text>
                    <View style={s.evtMeta}>
                      <View style={s.evtDot} />
                      <Text style={s.evtMetaText}>
                        {ev.tickers_affected?.[0] ?? 'Market'}
                        {ev.created_at ? ` · ${new Date(ev.created_at).toLocaleString()}` : ''}
                      </Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
              <TouchableOpacity
                style={s.clearAllBtn}
                onPress={() => { handleClearEvents(); setShowPastEvents(false); }}
              >
                <Text style={s.clearAllBtnText}>🗑 Clear All Events</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
}

/* ─── Drawer styles ──────────────────────────────────────── */
const dr = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  panel: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: W * 0.75,
    backgroundColor: colors.cardAlt,
    borderRightWidth: 1, borderRightColor: colors.border,
    flexDirection: 'column',
  },
  safeTop: { backgroundColor: colors.cardAlt },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.accent + '60',
  },
  avatarText: { fontSize: font.md, fontWeight: '800', color: '#000' },
  userName: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: font.xs, color: colors.textSecondary, marginTop: 1 },
  userTier: { fontSize: font.xs, fontWeight: '700', marginTop: 2 },
  closeBtn: { padding: 4 },
  closeIcon: { fontSize: 16, color: colors.textSecondary },
  navList: { paddingHorizontal: spacing.sm, paddingTop: spacing.sm, gap: 2 },
  navItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.sm, paddingVertical: 11,
    borderRadius: radius.lg,
  },
  navIcon: { fontSize: 16, width: 22, textAlign: 'center' },
  navLabel: { fontSize: font.sm, fontWeight: '600', color: colors.textSecondary },
  footer: { padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 10, borderRadius: radius.lg,
  },
  signOutIcon: { fontSize: 16 },
  signOutLabel: { fontSize: font.sm, fontWeight: '600', color: colors.red },
});

/* ─── Dashboard styles ───────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loadingCenter: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  content: { paddingBottom: 32 },

  /* Header */
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    backgroundColor: colors.card, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerAvatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: colors.accent + '50',
  },
  headerAvatarText: { fontSize: font.sm, fontWeight: '800', color: '#000' },
  headerHi: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  headerGreeting: { fontSize: font.xs, color: colors.accent, fontWeight: '500' },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 0 },
  headerIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  headerIconTxt: { fontSize: 15 },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center',
  },
  notifBadgeTxt: { fontSize: 8, fontWeight: '800', color: '#fff' },

  /* Hero */
  heroCard: {
    margin: spacing.md, borderRadius: radius.xl, overflow: 'hidden',
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    ...shadow.card,
  },
  heroGlow: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    // Simulated radial glow with just background gradient
    backgroundColor: 'transparent',
  },
  heroInner: { padding: spacing.lg },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  heroLabel: { fontSize: font.xs, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase' },
  eyeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.bg + '99', borderWidth: 1, borderColor: colors.border + '99',
    alignItems: 'center', justifyContent: 'center',
  },
  eyeIcon: { fontSize: 13 },
  heroBalance: { fontSize: 36, fontWeight: '900', color: colors.text, fontVariant: ['tabular-nums'], marginBottom: spacing.xs },
  btcRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.lg },
  btcBadge: { backgroundColor: colors.accentMuted, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  btcBadgeText: { fontSize: font.xs, fontWeight: '700', color: colors.accent },
  btcText: { fontSize: font.xs, color: colors.textSecondary, fontVariant: ['tabular-nums'] },
  actionRow: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.lg, alignItems: 'center' },
  actionBtnText: { fontSize: font.xs, fontWeight: '700' },

  /* Portfolio strip */
  strip: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  stripCol: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  stripLabel: { fontSize: 9, color: colors.textSecondary, marginBottom: 3, textAlign: 'center' },
  stripValue: { fontSize: font.xs, fontWeight: '800', fontVariant: ['tabular-nums'], textAlign: 'center' },
  stripDivider: { width: 1, height: 32, backgroundColor: colors.border },

  /* Open positions */
  posBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: spacing.md, marginBottom: spacing.md,
    backgroundColor: colors.cardAlt, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent + '30', padding: spacing.md,
  },
  posLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  posIconBox: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center',
  },
  posTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  posSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 1 },
  posCount: { color: colors.text, fontWeight: '600' },
  posUnreal: { fontSize: font.md, fontWeight: '800', fontVariant: ['tabular-nums'] },
  posViewLink: { fontSize: font.xs, color: colors.accent, marginTop: 2 },

  /* Section header */
  sectionHeader: {
    fontSize: font.xs, fontWeight: '700', color: colors.text,
    marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: 4,
  },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: spacing.md, marginBottom: spacing.sm },
  sectionBadge: { backgroundColor: colors.accentMuted, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { fontSize: font.xs, color: colors.accent, fontWeight: '700' },

  /* Activity center */
  activityGrid: { flexDirection: 'row', marginHorizontal: spacing.md, marginBottom: spacing.md, gap: 8 },
  activityTile: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, alignItems: 'center', justifyContent: 'center',
    minHeight: 100, ...shadow.card,
  },
  activityTileIcon: { fontSize: 26, marginBottom: 6 },
  activityTileLabel: { fontSize: font.xs, fontWeight: '700', color: colors.text, textAlign: 'center' },
  tileBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  tileBadgeText: { fontSize: 8, fontWeight: '800', color: '#000' },
  botIconCircle: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  botStatusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', paddingHorizontal: 2 },
  botStatusLabel: { fontSize: 9, color: colors.textSecondary },
  botPulseRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  botPulseDot: { width: 5, height: 5, borderRadius: 3 },
  botPulseText: { fontSize: 9, fontWeight: '700' },
  botDivider: { width: '100%', height: 1, backgroundColor: colors.border, marginVertical: 4 },

  /* Quick actions */
  quickGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: spacing.md, marginBottom: spacing.md, gap: 6,
  },
  quickTile: {
    width: (W - spacing.md * 2 - 6 * 5) / 6,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  quickIcon: { fontSize: 16, color: colors.accent },
  quickLabel: { fontSize: 8, color: colors.textSecondary, fontWeight: '600', textAlign: 'center' },

  /* Bonus tasks */
  bonusCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    marginHorizontal: spacing.md, marginBottom: 8,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent + '30', padding: spacing.md,
  },
  bonusIconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bonusTitle: { fontSize: font.xs, fontWeight: '700', color: colors.text },
  bonusDesc: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2, lineHeight: 17 },
  bonusReward: { fontSize: font.xs, color: colors.green, fontWeight: '700', marginTop: 4 },
  claimBtn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    paddingHorizontal: 10, paddingVertical: 7, flexShrink: 0, alignSelf: 'flex-start',
  },
  claimBtnText: { fontSize: font.xs, fontWeight: '800', color: '#000' },

  /* AI Events */
  eventsSection: { marginHorizontal: spacing.md, marginBottom: spacing.md },
  eventsTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  greenBadge: {
    minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4,
  },
  greenBadgeText: { fontSize: 8, fontWeight: '800', color: '#000' },
  evtBtn: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
    borderWidth: 1, borderColor: colors.border,
  },
  evtBtnText: { fontSize: font.xs, color: colors.textSecondary },
  evtPulseDot: { width: 7, height: 7, borderRadius: 4 },
  eventsCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  eventsEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  lockCircle: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.cardAlt, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  eventsEmptyTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  eventsEmptyDesc: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center', lineHeight: 18, paddingHorizontal: spacing.lg },
  evtRow: { paddingHorizontal: spacing.md, paddingVertical: 12 },
  evtRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  evtDesc: { fontSize: font.xs, color: colors.text, lineHeight: 18 },
  evtMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  evtDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  evtMetaText: { fontSize: font.xs, color: colors.textSecondary },

  /* Past events modal */
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end', padding: spacing.md,
  },
  modalPanel: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  clearAllBtn: {
    padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, alignItems: 'center',
  },
  clearAllBtnText: { fontSize: font.sm, color: colors.red, fontWeight: '600' },
});
