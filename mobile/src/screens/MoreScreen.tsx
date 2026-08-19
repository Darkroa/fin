import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font, shadow } from '../theme';

interface MenuItem {
  label: string;
  emoji: string;
  screen: string;
  color: string;
}

const MENU_ITEMS: MenuItem[] = [
  { label: 'AI Chat',        emoji: '⚡', screen: 'Chat',         color: colors.accent },
  { label: 'Bots',           emoji: '🤖', screen: 'Bots',         color: '#a78bfa' },
  { label: 'Open Positions', emoji: '📈', screen: 'Positions',    color: colors.green },
  { label: 'Transactions',   emoji: '📋', screen: 'Transactions', color: '#60a5fa' },
  { label: 'News & Events',  emoji: '📰', screen: 'News',         color: '#0ea5e9' },
  { label: 'Price Alerts',   emoji: '🔔', screen: 'Alerts',       color: colors.accent },
  { label: 'Notifications',  emoji: '💬', screen: 'Notifications', color: '#0ea5e9' },
  { label: 'Calendar',       emoji: '📅', screen: 'Calendar',     color: '#8b5cf6' },
  { label: 'Pricing Plans',  emoji: '👑', screen: 'Pricing',      color: colors.accent },
  { label: 'Profile',        emoji: '👤', screen: 'Profile',      color: colors.textSecondary },
  { label: 'Settings',       emoji: '⚙️', screen: 'Settings',     color: colors.textSecondary },
  { label: 'Support',        emoji: '🆘', screen: 'Support',      color: colors.red },
];

const TIER_CONFIG: Record<number, { label: string; color: string }> = {
  0: { label: 'Unverified', color: colors.textMuted },
  1: { label: 'Verified',   color: '#60a5fa' },
  2: { label: 'Pro',        color: colors.accent },
  3: { label: 'Elite',      color: '#a78bfa' },
};

export default function MoreScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const tier     = user?.tier ?? 0;
  const tierCfg  = TIER_CONFIG[tier] ?? TIER_CONFIG[0];
  const initials = (user?.email ?? 'U')[0].toUpperCase();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* User card */}
        <View style={styles.userCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>{user?.username ?? user?.email?.split('@')[0] ?? 'Trader'}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.tierRow}>
              <View style={[styles.tierBadge, { backgroundColor: tierCfg.color + '22' }]}>
                <Text style={[styles.tierText, { color: tierCfg.color }]}>● {tierCfg.label}</Text>
              </View>
              <Text style={styles.balanceText}>${Number(user?.balance_usdt ?? 0).toFixed(2)} USDT</Text>
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
              <View style={[styles.tileIconBox, { backgroundColor: item.color + '22' }]}>
                <Text style={styles.tileEmoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.tileLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  userCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  avatarRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center', padding: 2,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: font.lg, fontWeight: '700', color: '#000' },
  userName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  userEmail: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 6 },
  tierBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  tierText: { fontSize: font.xs, fontWeight: '600' },
  balanceText: { fontSize: font.xs, color: colors.textMuted },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '31%',
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, alignItems: 'center', justifyContent: 'center',
    minHeight: 90, gap: 8,
  },
  tileIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tileEmoji: { fontSize: 20 },
  tileLabel: { fontSize: font.xs, color: colors.textSecondary, textAlign: 'center', fontWeight: '600' },
});
