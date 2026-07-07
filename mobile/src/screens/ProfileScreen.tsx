import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';

const TIER_COLORS: Record<number, string> = {
  0: colors.textSecondary,
  1: colors.accent,
  2: colors.green,
  3: '#a78bfa',
};

const TIER_LABELS: Record<number, string> = {
  0: 'Unverified',
  1: 'Tier 1',
  2: 'Tier 2',
  3: 'Tier 3',
};

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
  const tierColor = TIER_COLORS[tier] ?? colors.textSecondary;
  const tierLabel = TIER_LABELS[tier] ?? 'Unverified';

  const menuItems = [
    { label: 'Personal Info', onPress: handleComingSoon },
    { label: 'Security & 2FA', onPress: handleComingSoon },
    { label: 'KYC Verification', onPress: handleComingSoon },
    { label: 'API Keys', onPress: handleComingSoon },
    { label: 'Referral Program', onPress: handleComingSoon },
    { label: 'Change Password', onPress: handleComingSoon },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
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
        <TouchableOpacity onPress={handleSignOut} style={styles.signOutBtn}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.emailText}>{email}</Text>
        {!!username && <Text style={styles.usernameText}>@{username}</Text>}
        <Text style={styles.balanceText}>${balance} USDT</Text>
        <View style={[styles.tierBadge, { borderColor: tierColor }]}>
          <Text style={[styles.tierText, { color: tierColor }]}>{tierLabel}</Text>
        </View>
      </View>

      {/* Menu */}
      <View style={styles.menuCard}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.menuRow, index < menuItems.length - 1 && styles.menuRowBorder]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Text style={styles.menuLabel}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  signOutBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.red,
  },
  signOutText: {
    color: colors.red,
    fontSize: font.sm,
    fontWeight: '600',
  },
  profileCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.bg,
  },
  emailText: {
    fontSize: font.md,
    color: colors.text,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  usernameText: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  balanceText: {
    fontSize: font.lg,
    color: colors.accent,
    fontWeight: '700',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  tierBadge: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
  },
  tierText: {
    fontSize: font.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  menuCard: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  menuRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  menuLabel: {
    fontSize: font.md,
    color: colors.text,
  },
  chevron: {
    fontSize: font.lg,
    color: colors.textSecondary,
    lineHeight: font.lg + 4,
  },
});
