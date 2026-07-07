import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getTodayPnl, getOpenPositions, getEvents, getBotStatus } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, color ? { color } : {}]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

function EventRow({ event }: { event: any }) {
  const impact = event.impact_score ?? 0;
  const impactColor = impact >= 7 ? colors.red : impact >= 4 ? colors.accent : colors.green;
  return (
    <View style={styles.eventRow}>
      <View style={[styles.eventDot, { backgroundColor: impactColor }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventTitle} numberOfLines={2}>{event.headline ?? event.title ?? 'Market Event'}</Text>
        <Text style={styles.eventMeta}>
          {event.ticker ?? ''}{event.ticker ? ' · ' : ''}{event.sentiment ?? 'neutral'} · impact {impact}/10
        </Text>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { user, refreshUser, logout } = useAuth();
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
        setBotStatus(Array.isArray(d) ? d : d?.bots ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); refreshUser(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); refreshUser(); };

  const balance = user?.balance_usdt ?? 0;
  const todayPnl = pnl?.today_pnl_usdt ?? 0;
  const pnlPct = pnl?.today_pnl_pct ?? 0;
  const activeBots = botStatus.filter((b: any) => b.status === 'running').length;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good day,</Text>
          <Text style={styles.username}>{user?.username ?? user?.email?.split('@')[0] ?? 'Trader'}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceValue}>${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
        <View style={styles.pnlRow}>
          <Text style={[styles.pnlBadge, { backgroundColor: todayPnl >= 0 ? '#0d2e1f' : '#2e0d0d' }]}>
            <Text style={{ color: todayPnl >= 0 ? colors.green : colors.red }}>
              {todayPnl >= 0 ? '▲' : '▼'} ${Math.abs(todayPnl).toFixed(2)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%) Today
            </Text>
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard
          label="Active Bots"
          value={String(activeBots)}
          sub={`${botStatus.length} total`}
          color={activeBots > 0 ? colors.green : colors.textSecondary}
        />
        <StatCard
          label="Open Positions"
          value={String(positions.length)}
          sub="live trades"
        />
        <StatCard
          label="Tier"
          value={`T${user?.tier ?? 0}`}
          sub="subscription"
          color={colors.accent}
        />
      </View>

      {/* Open Positions */}
      {positions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Open Positions</Text>
          {positions.slice(0, 4).map((p: any, i: number) => (
            <View key={i} style={styles.positionRow}>
              <View>
                <Text style={styles.positionPair}>{p.pair ?? p.ticker ?? '—'}</Text>
                <Text style={styles.positionSide}>{(p.side ?? 'BUY').toUpperCase()}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={[styles.positionPnl, { color: (p.pnl ?? 0) >= 0 ? colors.green : colors.red }]}>
                  {(p.pnl ?? 0) >= 0 ? '+' : ''}${(p.pnl ?? 0).toFixed(2)}
                </Text>
                <Text style={styles.positionMeta}>entry ${p.entry_price?.toFixed(2) ?? '—'}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Events */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Market Events</Text>
        {events.length === 0
          ? <Text style={styles.empty}>No recent events</Text>
          : events.map((e: any, i: number) => <EventRow key={i} event={e} />)
        }
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: spacing.lg },
  greeting: { fontSize: font.sm, color: colors.textSecondary },
  username: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  logoutBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.sm },
  logoutText: { color: colors.textMuted, fontSize: font.sm },

  balanceCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.lg, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  balanceLabel: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  balanceValue: { fontSize: font.xxl + 4, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  pnlRow: { flexDirection: 'row' },
  pnlBadge: { borderRadius: radius.sm, paddingVertical: 4, paddingHorizontal: 10, fontSize: font.sm },

  statsRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: radius.md,
    padding: spacing.md, borderWidth: 1, borderColor: colors.border,
  },
  statLabel: { fontSize: font.xs, color: colors.textSecondary, marginBottom: 4 },
  statValue: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  statSub: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  section: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: font.sm, textAlign: 'center', paddingVertical: spacing.md },

  positionRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  positionPair: { fontSize: font.md, fontWeight: '600', color: colors.text },
  positionSide: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  positionPnl: { fontSize: font.md, fontWeight: '700' },
  positionMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  eventRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.sm },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  eventTitle: { fontSize: font.sm, color: colors.text, fontWeight: '500' },
  eventMeta: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
});
