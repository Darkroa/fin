import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';

const TIER_LABELS: Record<number, string> = {
  0: 'Unverified',
  1: 'Verified',
  2: 'Pro',
  3: 'Elite',
};

function getTierBadgeStyle(tier: number): { bg: string; text: string } {
  switch (tier) {
    case 1: return { bg: '#1a3a6b', text: '#fff' };
    case 2: return { bg: colors.accent, text: '#000' };
    case 3: return { bg: '#4a1a8b', text: '#fff' };
    default: return { bg: '#2b3139', text: colors.textSecondary };
  }
}

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { user, logout, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch (_) {}
    setRefreshing(false);
  }, [refreshUser]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const handleComingSoon = () => Alert.alert('Coming Soon', 'This feature is coming soon.');

  const email = user?.email ?? '';
  const username = user?.username ?? '';
  const balance = typeof user?.balance_usdt === 'number' ? user.balance_usdt.toFixed(2) : '0.00';
  const tier = typeof user?.tier === 'number' ? user.tier : 0;
  const initials = email ? email.charAt(0).toUpperCase() : '?';
  const tierLabel = TIER_LABELS[tier] ?? 'Unverified';
  const tierBadge = getTierBadgeStyle(tier);

  const accountItems = [
    { icon: '🔐', label: 'Security Settings', onPress: handleComingSoon },
    { icon: '📧', label: 'Email Verification', onPress: handleComingSoon },
    { icon: '📱', label: 'Two-Factor Auth', onPress: handleComingSoon },
    { icon: '🪪', label: 'KYC Verification', onPress: handleComingSoon },
  ];

  const preferenceItems = [
    { icon: '🔔', label: 'Notifications', onPress: handleComingSoon },
    { icon: '⚙️', label: 'Settings', onPress: () => navigation.navigate('Settings') },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.displayName}>{username || email}</Text>
          <View style={[styles.tierPill, { backgroundColor: tierBadge.bg }]}>
            <Text style={[styles.tierPillText, { color: tierBadge.text }]}>{tierLabel}</Text>
          </View>
          <View style={styles.balanceRow}>
            <Text style={styles.balanceAmount}>${balance}</Text>
            <Text style={styles.balanceCurrency}> USDT</Text>
          </View>
        </View>

        {/* ACCOUNT Section */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.listCard}>
          {accountItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.listRow, index < accountItems.length - 1 && styles.listRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Text style={styles.iconEmoji}>{item.icon}</Text>
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* PREFERENCES Section */}
        <Text style={styles.sectionHeader}>PREFERENCES</Text>
        <View style={styles.listCard}>
          {preferenceItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.listRow, index < preferenceItems.length - 1 && styles.listRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Text style={styles.iconEmoji}>{item.icon}</Text>
              </View>
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xl * 2,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  heroCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    margin: spacing.md,
    alignItems: 'center',
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: font.xl,
    fontWeight: '700',
    color: '#000',
  },
  displayName: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  tierPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: spacing.sm,
  },
  tierPillText: {
    fontSize: font.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
  },
  balanceAmount: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  balanceCurrency: {
    fontSize: font.md,
    color: colors.textSecondary,
  },
  sectionHeader: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  listCard: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    overflow: 'hidden',
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(240,185,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  iconEmoji: {
    fontSize: 16,
  },
  rowLabel: {
    flex: 1,
    fontSize: font.md,
    color: colors.text,
  },
  chevron: {
    fontSize: font.lg,
    color: colors.textMuted,
    lineHeight: font.lg + 4,
  },
  logoutBtn: {
    backgroundColor: colors.red,
    borderRadius: radius.lg,
    paddingVertical: 15,
    marginTop: spacing.xl,
    marginHorizontal: spacing.md,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontSize: font.md,
    fontWeight: '700',
  },
});
