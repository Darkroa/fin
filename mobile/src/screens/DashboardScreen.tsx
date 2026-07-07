import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, FlatList, RefreshControl,
  TouchableOpacity, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getTodayPnl, getOpenPositions, getEvents, getBotStatus } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user, refreshUser } = useAuth();
  const [pnl, setPnl] = useState<any>(null);
  const [positions, setPositions] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [botStatus, setBotStatus] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [pnlRes, posRes, evRes, botRes] = await Promise.allSettled([
        getTodayPnl(),
        getOpenPositions(),
        getEvents(5),
        getBotStatus(),
      ]);
      if (pnlRes.status === 'fulfilled') setPnl(pnlRes.value.data);
      if (posRes.status === 'fulfilled') setPositions(posRes.value.data ?? []);
      if (evRes.status === 'fulfilled') setEvents(evRes.value.data ?? []);
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

  // Recent activity from positions (last 5)
  const recentActivity = positions.slice(0, 5);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const quickActions = [
    { label: 'Trade', icon: '💱', onPress: () => navigation.navigate('More', { screen: 'Trade' }) },
    { label: 'Bots', icon: '🤖', onPress: () => navigation.navigate('More', { screen: 'Bots' }) },
    { label: 'Wallet', icon: '💰', onPress: () => navigation.navigate('Wallet') },
    { label: 'Markets', icon: '📊', onPress: () => navigation.navigate('Markets') },
    { label: 'Chat', icon: '💬', onPress: () => navigation.navigate('More', { screen: 'Chat' }) },
    { label: 'More', icon: '···', onPress: () => navigation.navigate('More') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('More', { screen: 'Notifications' })}
            style={styles.bellBtn}
          >
            <Text style={styles.bellIcon}>🔔</Text>
          </TouchableOpacity>
        </View>

        {/* Hero Balance Card */}
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>TOTAL BALANCE</Text>
          <Text style={styles.heroBalance}>
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </Text>
          <View style={styles.pnlRow}>
            <Text style={[styles.pnlArrow, { color: pnlPositive ? colors.green : colors.red }]}>
              {pnlPositive ? '▲' : '▼'}
            </Text>
            <Text style={[styles.pnlText, { color: pnlPositive ? colors.green : colors.red }]}>
              {pnlPositive ? '+' : ''}${Math.abs(todayPnl).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%) Today
            </Text>
          </View>
        </View>

        {/* 3-column stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>P&L %</Text>
            <Text style={[styles.statValue, { color: pnlPositive ? colors.green : colors.red }]}>
              {pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Active Bots</Text>
            <Text style={[styles.statValue, { color: activeBots > 0 ? colors.green : colors.textSecondary }]}>
              {activeBots}
            </Text>
          </View>
          <View style={styles.statTile}>
            <Text style={styles.statLabel}>Markets</Text>
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
              <Text style={styles.actionIcon}>{action.icon}</Text>
              <Text style={styles.actionLabel}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Recent Activity */}
        <Text style={styles.sectionHeader}>RECENT ACTIVITY</Text>
        <View style={styles.activityCard}>
          {recentActivity.length === 0 ? (
            <Text style={styles.emptyText}>No recent activity</Text>
          ) : (
            recentActivity.map((p: any, i: number) => {
              const positionPnl = toNum(p.pnl);
              const posPositive = positionPnl >= 0;
              return (
                <View
                  key={i}
                  style={[styles.activityRow, i < recentActivity.length - 1 && styles.activityRowBorder]}
                >
                  <View>
                    <Text style={styles.activitySymbol}>{p.pair ?? p.ticker ?? '—'}</Text>
                    <Text style={styles.activityDate}>
                      {p.side ? (p.side as string).toUpperCase() : 'TRADE'}
                    </Text>
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
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  bellBtn: {
    padding: spacing.xs,
  },
  bellIcon: {
    fontSize: 22,
  },

  // Hero card
  heroCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  heroLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  heroBalance: {
    fontSize: 36,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  pnlArrow: {
    fontSize: font.sm,
  },
  pnlText: {
    fontSize: font.sm,
    fontWeight: '600',
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: font.xs,
    color: colors.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: font.md,
    fontWeight: '700',
    color: colors.text,
  },

  // Section header
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginHorizontal: spacing.md,
  },

  // Quick actions grid
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  actionTile: {
    width: '30.5%',
    height: 60,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionIcon: {
    fontSize: 16,
  },
  actionLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.text,
  },

  // Recent activity
  activityCard: {
    marginHorizontal: spacing.md,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
  },
  activityRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activitySymbol: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
  },
  activityDate: {
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  activityPnl: {
    fontSize: font.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: font.sm,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
