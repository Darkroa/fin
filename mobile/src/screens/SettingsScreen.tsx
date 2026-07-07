import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Alert, Switch, SafeAreaView,
} from 'react-native';
import { colors, spacing, radius, font, shadow } from '../theme';

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const [priceAlerts, setPriceAlerts]   = useState(true);
  const [botUpdates, setBotUpdates]     = useState(true);
  const [newsFeed, setNewsFeed]         = useState(false);
  const [emailDigests, setEmailDigests] = useState(true);
  const [refreshing, setRefreshing]     = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const comingSoon = () => Alert.alert('Coming Soon', 'This feature is coming soon.');

  const notifToggles = [
    { label: 'Price Alerts',  sub: 'Get alerted when prices hit targets',  value: priceAlerts,   onToggle: setPriceAlerts },
    { label: 'Bot Updates',   sub: 'Notifications when bots open/close',   value: botUpdates,    onToggle: setBotUpdates },
    { label: 'News Feed',     sub: 'Breaking market news and events',       value: newsFeed,      onToggle: setNewsFeed },
    { label: 'Email Digests', sub: 'Daily portfolio summary via email',     value: emailDigests,  onToggle: setEmailDigests },
  ];

  const appItems = [
    { label: 'Theme', value: 'Dark Mode', onPress: comingSoon },
    { label: 'Language', value: 'English', onPress: comingSoon },
    { label: 'Currency', value: 'USD', onPress: comingSoon },
  ];

  const legalItems = [
    { label: 'Privacy Policy',  onPress: () => Alert.alert('Privacy Policy', 'Available soon.') },
    { label: 'Terms of Service', onPress: () => Alert.alert('Terms of Service', 'Available soon.') },
    { label: 'Clear Cache',     onPress: () => Alert.alert('Clear Cache', 'Are you sure?', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Done', 'Cache cleared.') }]) },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}
        showsVerticalScrollIndicator={false}
      >
        {/* NOTIFICATIONS */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          {notifToggles.map((item, index) => (
            <View key={item.label} style={[styles.toggleRow, index < notifToggles.length - 1 && styles.rowBorder]}>
              <View style={{ flex: 1, marginRight: spacing.md }}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>{item.sub}</Text>
              </View>
              <Switch
                value={item.value}
                onValueChange={item.onToggle}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>

        {/* APP */}
        <Text style={styles.sectionHeader}>APP PREFERENCES</Text>
        <View style={styles.card}>
          {appItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.detailRow, index < appItems.length - 1 && styles.rowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{item.value}</Text>
                <Text style={styles.chevron}>›</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* LEGAL */}
        <Text style={styles.sectionHeader}>LEGAL & SUPPORT</Text>
        <View style={styles.card}>
          <View style={[styles.detailRow, styles.rowBorder]}>
            <Text style={styles.rowLabel}>App Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          {legalItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.detailRow, index < legalItems.length - 1 && styles.rowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <Text style={[styles.rowLabel, item.label === 'Clear Cache' && { color: colors.red }]}>{item.label}</Text>
              <Text style={styles.chevron}>›</Text>
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
  content: { paddingBottom: spacing.xl * 2 },
  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  card: {
    backgroundColor: colors.card, marginHorizontal: spacing.md,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    overflow: 'hidden', ...shadow.card,
  },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.md },
  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: spacing.md },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  rowLabel: { fontSize: font.md, color: colors.text },
  rowSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },
  rowValue: { fontSize: font.sm, color: colors.textSecondary },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chevron: { fontSize: font.xl, color: colors.textMuted, lineHeight: font.xl + 4 },
});
