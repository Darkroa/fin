import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar,
} from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getTodayPnl, getOpenPositions, getBotStatus } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, refreshUser } = useAuth();
  const [pnl, setPnl] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [botStatus, setBotStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pnlRes, posRes, botRes] = await Promise.allSettled([
        getTodayPnl(),
        getOpenPositions(),
        getBotStatus(),
      ]);
      if (pnlRes.status === 'fulfilled') setPnl(pnlRes.value.data);
      if (posRes.status === 'fulfilled') setPositions(posRes.value.data ?? []);
      if (botRes.status === 'fulfilled') {
        const d = botRes.value.data;
        setBotStatus(Array.isArray(d) ? d : Object.values(d?.bots ?? {}));
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); refreshUser(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); refreshUser(); };

  const toNum = (v: any) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const balance = toNum(user?.balance_usdt);
  const todayPnl = toNum(pnl?.today_pnl_usdt);
  const pnlPct = toNum(pnl?.today_pnl_pct);
  const activeBots = botStatus.filter((b: any) => b.running === true).length;
  const pnlPositive = todayPnl >= 0;

  const firstName = user?.username || user?.email?.split('@')[0] || 'Trader';

  const quickActions = [
    { label: 'Trade',   icon: '⚡', color: colors.accent,   onPress: () => navigation.navigate('Trade') },
    { label: 'Bots',    icon: '🤖', color: '#a78bfa',       onPress: () => navigation.navigate('More', { screen: 'Bots' }) },
    { label: 'Markets', icon: '📈', color: '#3b82f6',       onPress: () => navigation.navigate('Markets') },
    { label: 'Wallet',  icon: '💳', color: colors.green,    onPress: () => navigation.navigate('Wallet') },
    { label: 'Chat',    icon: '💬', color: '#0ea5e9',       onPress: () => navigation.navigate('More', { screen: 'Chat' }) },
    { label: 'More',    icon: '⊞',  color: colors.textSecondary, onPress: () => navigation.navigate('More') },
  ];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{getGreeting()}</Text>
            <Text style={styles.headerName}>{firstName} 👋</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('More', { screen: 'Notifications' })}
            style={styles.bellBtn}
          >
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Balance Card with glow */}
        <View style={styles.heroWrapper}>
          {/* Subtle gold glow behind card */}
          <View style={styles.glowLayer} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="heroGlow" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.18" />
                  <Stop offset="60%"  stopColor="#F0B90B" stopOpacity="0.05" />
                  <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="50%" rx="80%" ry="80%" fill="url(#heroGlow)" />
            </Svg>
          </View>

          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>TOTAL PORTFOLIO</Text>
            <Text style={styles.heroBalance}>
              ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            <View style={styles.pnlRow}>
              <View style={[styles.pnlBadge, { backgroundColor: pnlPositive ? colors.greenMuted : colors.redMuted }]}>
                <Text style={[styles.pnlBadgeText, { color: pnlPositive ? colors.green : colors.red }]}>
                  {pnlPositive ? '▲' : '▼'}{' '}
                  {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%{'  '}
                  {pnlPositive ? '+' : ''}${Math.abs(todayPnl).toFixed(2)} today
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* 3-column stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>P&L Today</Text>
            <Text style={[styles.statValue, { color: pnlPositive ? colors.green : colors.red }]}>
              {pnlPositive ? '+' : ''}{pnlPct.toFixed(2)}%
            </Text>
          </View>
          <View style={[styles.statTile, styles.statTileMid]}>
            <Text style={styles.statLabel}>Active Bots</Text>
            <Text style={[styles.statValue, { color: activeBots > 0 ? colors.green : colors.textSecondary }]}>
              {activeBots}
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Positions</Text>
            <Text style={styles.statValue}>{positions.length}</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionHeader}>QUICK ACTIONS</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={styles.actionTile}
              onPress={action.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.actionIconBox, { backgroundColor: action.color + '22' }]}>
                <Text style={styles.actionIcon}>{action.icon}</Text>
              </View>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Positions */}
        <Text style={styles.sectionHeader}>RECENT ACTIVITY</Text>
        <View style={styles.activityCard}>
          {positions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>📊</Text>
              <Text style={styles.emptyText}>No recent activity</Text>
              <Text style={styles.emptySubText}>Start trading to see your positions here</Text>
            </View>
          ) : (
            positions.slice(0, 5).map((p: any, i: number) => {
              const positionPnl = toNum(p.pnl ?? p.unrealized_pnl);
              const posPositive = positionPnl >= 0;
              return (
                <View
                  key={i}
                  style={[styles.activityRow, i < Math.min(positions.length, 5) - 1 && styles.activityRowBorder]}
                >
                  <View style={[styles.activityDot, { backgroundColor: posPositive ? colors.greenMuted : colors.redMuted }]}>
                    <Text style={[styles.activityDotText, { color: posPositive ? colors.green : colors.red }]}>
                      {(p.side || 'T')[0].toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.activityInfo}>
                    <Text style={styles.activitySymbol}>{p.pair ?? p.ticker ?? '—'}</Text>
                    <Text style={styles.activitySide}>{p.side ? (p.side as string).toUpperCase() : 'TRADE'}</Text>
                  </View>
                  <Text style={[styles.activityPnl, { color: posPositive ? colors.green : colors.red }]}>
                    {posPositive ? '+' : ''}${Math.abs(positionPnl).toFixed(2)}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  scrollView: { flex: 1 },
  content: { paddingBottom: spacing.xl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  greeting: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 },
  headerName: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginTop: 2 },
  bellBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  bellIcon: { fontSize: 17 },

  // Hero
  heroWrapper: { marginHorizontal: spacing.md, marginBottom: spacing.md, position: 'relative' },
  glowLayer: { ...StyleSheet.absoluteFillObject, borderRadius: radius.xl, overflow: 'hidden' },
  heroCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...shadow.card,
  },
  heroLabel: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: spacing.xs,
  },
  heroBalance: { fontSize: 38, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  pnlRow: { flexDirection: 'row' },
  pnlBadge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  pnlBadgeText: { fontSize: font.sm, fontWeight: '600' },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
    ...shadow.card,
  },
  statTile: { flex: 1, padding: spacing.md, alignItems: 'center' },
  statTileMid: { borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  statValue: { fontSize: font.lg, fontWeight: '700', color: colors.text },

  // Section header
  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginBottom: spacing.sm, marginHorizontal: spacing.md,
  },

  // Quick actions grid
  actionsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    marginHorizontal: spacing.md, marginBottom: spacing.md, gap: spacing.sm,
  },
  actionTile: {
    width: '30.5%',
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  actionIconBox: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  actionIcon: { fontSize: 16 },
  actionLabel: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },

  // Recent activity
  activityCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, overflow: 'hidden',
    ...shadow.card,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 13, paddingHorizontal: spacing.md, gap: spacing.sm,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  activityDot: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  activityDotText: { fontSize: font.sm, fontWeight: '700' },
  activityInfo: { flex: 1 },
  activitySymbol: { fontSize: font.md, fontWeight: '600', color: colors.text },
  activitySide: { fontSize: font.xs, color: colors.textMuted, marginTop: 1 },
  activityPnl: { fontSize: font.md, fontWeight: '700', fontVariant: ['tabular-nums'] },

  emptyState: { alignItems: 'center', paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 36, marginBottom: spacing.sm },
  emptyText: { fontSize: font.md, fontWeight: '600', color: colors.text, marginBottom: 4 },
  emptySubText: { fontSize: font.sm, color: colors.textSecondary },
});
