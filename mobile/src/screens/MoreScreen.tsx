import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, SafeAreaView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

const TIER_CONFIG: Record<number, { label: string; bg: string; text: string }> = {
  0: { label: 'Unverified', bg: colors.border,     text: colors.textSecondary },
  1: { label: 'Tier 1',     bg: '#1a3a6b',          text: '#60a5fa'            },
  2: { label: 'Tier 2',     bg: colors.accentMuted, text: colors.accent        },
  3: { label: 'Tier 3',     bg: '#2d1a6b',          text: '#a78bfa'            },
};

export default function MoreScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const tier     = typeof user?.account_tier === 'number' ? user.account_tier : (user?.tier ?? 0);
  const tierCfg  = TIER_CONFIG[tier] ?? TIER_CONFIG[0];
  const initials = (user?.first_name?.[0] ?? user?.email?.[0] ?? 'U').toUpperCase();
  const username = user?.username ?? user?.email?.split('@')[0] ?? 'Trader';
  const balance  = Number(user?.balance_usdt ?? 0).toFixed(2);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Profile card — same style as ProfileScreen heroCard */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{username}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.tierRow}>
              <View style={[styles.tierPill, { backgroundColor: tierCfg.bg }]}>
                <Ionicons name="ellipse" size={7} color={tierCfg.text} />
                <Text style={[styles.tierPillText, { color: tierCfg.text }]}> {tierCfg.label}</Text>
              </View>
              <Text style={styles.balanceText}>${balance} USDT</Text>
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

  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    padding: spacing.md, marginBottom: spacing.lg,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  avatarRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarCircle: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: font.lg, fontWeight: '700', color: '#000' },
  profileInfo: { flex: 1, gap: 2 },
  profileName: { fontSize: font.md, fontWeight: '700', color: colors.text },
  profileEmail: { fontSize: font.xs, color: colors.textSecondary },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
  tierPill: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  tierPillText: { fontSize: font.xs, fontWeight: '600' },
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
