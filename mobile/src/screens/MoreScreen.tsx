import React from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';

interface MenuItem {
  label: string;
  emoji: string;
  screen: string;
  color?: string;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'AI Chat',        emoji: '⚡', screen: 'Chat',               color: colors.accent },
  { label: 'Bots',           emoji: '🤖', screen: 'Bots',               color: '#a78bfa' },
  { label: 'Trade',          emoji: '📊', screen: 'Trade',              color: colors.green },
  { label: 'Open Positions', emoji: '📈', screen: 'Positions',          color: colors.green },
  { label: 'Transactions',   emoji: '📋', screen: 'Transactions',       color: colors.textSecondary },
  { label: 'News & Events',  emoji: '📰', screen: 'News',               color: '#3b82f6' },
  { label: 'Price Alerts',   emoji: '🔔', screen: 'Alerts',             color: colors.accent },
  { label: 'Notifications',  emoji: '💬', screen: 'Notifications',      color: '#0ea5e9' },
  { label: 'Calendar',       emoji: '📅', screen: 'Calendar',           color: '#8b5cf6' },
  { label: 'Pricing Plans',  emoji: '👑', screen: 'Pricing',            color: colors.accent },
  { label: 'Profile',        emoji: '👤', screen: 'Profile',            color: colors.textSecondary },
  { label: 'Settings',       emoji: '⚙️', screen: 'Settings',           color: colors.textSecondary },
  { label: 'Support',        emoji: '🆘', screen: 'Support',            color: colors.red },
];

export default function MoreScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  const tier = user?.tier ?? 0;
  const tierLabels: Record<number, { label: string; color: string }> = {
    0: { label: 'Unverified', color: colors.textMuted },
    1: { label: 'Tier 1',     color: colors.accent },
    2: { label: 'Tier 2',     color: colors.green },
    3: { label: 'Tier 3',     color: '#a78bfa' },
  };
  const tierInfo = tierLabels[tier] ?? tierLabels[0];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* User card */}
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user?.email ?? 'U')[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.userName}>
            {user?.username ?? user?.email?.split('@')[0] ?? 'Trader'}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
          <View style={styles.tierRow}>
            <Text style={[styles.tierBadge, { color: tierInfo.color }]}>
              ● {tierInfo.label}
            </Text>
            <Text style={styles.balanceText}>
              ${Number(user?.balance_usdt ?? 0).toFixed(2)} USDT
            </Text>
          </View>
        </View>
      </View>

      {/* Menu grid */}
      <View style={styles.grid}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.screen}
            style={styles.tile}
            activeOpacity={0.75}
            onPress={() => navigation.navigate(item.screen)}
          >
            <Text style={styles.tileEmoji}>{item.emoji}</Text>
            <Text style={styles.tileLabel}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content:   { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { fontSize: font.xl, fontWeight: '700', color: colors.bg },
  userName:    { fontSize: font.md, fontWeight: '700', color: colors.text },
  userEmail:   { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  tierRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 4 },
  tierBadge:   { fontSize: font.xs, fontWeight: '600' },
  balanceText: { fontSize: font.xs, color: colors.textMuted },

  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm,
  },
  tile: {
    width: '31%',
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center', justifyContent: 'center',
    minHeight: 80,
  },
  tileEmoji: { fontSize: 26, marginBottom: spacing.xs },
  tileLabel: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
});
