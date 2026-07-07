import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font, shadow } from '../theme';

const TIER_CONFIG: Record<number, { label: string; bg: string; text: string; icon: string }> = {
  0: { label: 'Unverified', bg: colors.border,    text: colors.textSecondary, icon: '○' },
  1: { label: 'Verified',   bg: '#1a3a6b',         text: '#60a5fa',            icon: '✓' },
  2: { label: 'Pro',        bg: colors.accentMuted, text: colors.accent,       icon: '⚡' },
  3: { label: 'Elite',      bg: '#2d1a6b',         text: '#a78bfa',            icon: '♛' },
};

export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { user, logout, refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshUser(); } catch { }
    setRefreshing(false);
  }, [refreshUser]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  const comingSoon = () => Alert.alert('Coming Soon', 'This feature is coming soon.');

  const email    = user?.email ?? '';
  const username = user?.username ?? '';
  const balance  = typeof user?.balance_usdt === 'number' ? user.balance_usdt.toFixed(2) : '0.00';
  const tier     = typeof user?.tier === 'number' ? user.tier : 0;
  const initials = email ? email.charAt(0).toUpperCase() : '?';
  const tierCfg  = TIER_CONFIG[tier] ?? TIER_CONFIG[0];

  const accountItems = [
    { icon: '🔐', label: 'Security Settings',  onPress: comingSoon },
    { icon: '📧', label: 'Email Verification',  onPress: comingSoon },
    { icon: '📱', label: 'Two-Factor Auth',     onPress: comingSoon },
    { icon: '🪪', label: 'KYC Verification',    onPress: comingSoon },
    { icon: '📸', label: 'Profile Photo',       onPress: comingSoon },
  ];

  const preferenceItems = [
    { icon: '🔔', label: 'Notifications', onPress: comingSoon },
    { icon: '👑', label: 'Pricing Plans', onPress: () => navigation.navigate('Pricing') },
    { icon: '⚙️', label: 'Settings',      onPress: () => navigation.navigate('Settings') },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Card */}
        <View style={styles.heroCard}>
          {/* Avatar */}
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>

          <Text style={styles.displayName}>{username || email}</Text>
          <Text style={styles.displayEmail}>{email}</Text>

          {/* Tier badge */}
          <View style={[styles.tierPill, { backgroundColor: tierCfg.bg }]}>
            <Text style={[styles.tierPillText, { color: tierCfg.text }]}>
              {tierCfg.icon}  {tierCfg.label}
            </Text>
          </View>

          {/* Balance */}
          <View style={styles.balanceRow}>
            <View style={styles.balanceItem}>
              <Text style={styles.balanceLabel}>BALANCE</Text>
              <Text style={styles.balanceValue}>${balance}</Text>
              <Text style={styles.balanceCurrency}>USDT</Text>
            </View>
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

        {/* Sign Out */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>FinAi v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl * 2 },

  heroCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, margin: spacing.md, padding: spacing.lg,
    alignItems: 'center', ...shadow.card,
  },
  avatarRing: {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 2, borderColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm, padding: 3,
  },
  avatarCircle: {
    width: 76, height: 76, borderRadius: 38,
    backgroundColor: colors.accent,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { fontSize: font.xl, fontWeight: '700', color: '#000' },
  displayName: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: 3 },
  displayEmail: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  tierPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: spacing.md },
  tierPillText: { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },

  balanceRow: { flexDirection: 'row', justifyContent: 'center' },
  balanceItem: { alignItems: 'center' },
  balanceLabel: { fontSize: font.xs, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  balanceValue: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  balanceCurrency: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  listCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginHorizontal: spacing.md, overflow: 'hidden', ...shadow.card,
  },
  listRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.md },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  iconEmoji: { fontSize: 15 },
  rowLabel: { flex: 1, fontSize: font.md, color: colors.text },
  chevron: { fontSize: font.xl, color: colors.textMuted, lineHeight: font.xl + 4 },

  logoutBtn: {
    backgroundColor: colors.redMuted, borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.lg, paddingVertical: 15,
    marginTop: spacing.xl, marginHorizontal: spacing.md, alignItems: 'center',
  },
  logoutText: { color: colors.red, fontSize: font.md, fontWeight: '700' },
  versionText: { textAlign: 'center', fontSize: font.xs, color: colors.textMuted, marginTop: spacing.md },
});
