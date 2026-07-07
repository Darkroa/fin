import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Switch,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  // Notification toggles
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [botUpdates, setBotUpdates] = useState(true);
  const [newsFeed, setNewsFeed] = useState(false);
  const [emailDigests, setEmailDigests] = useState(true);

  // Trading
  const [defaultLeverage, setDefaultLeverage] = useState('10');

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  const handleSaveNotifications = () => {
    Alert.alert('Saved', 'Preferences saved');
  };

  const handleSaveTrading = () => {
    Alert.alert('Saved', 'Trading settings saved');
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'Are you sure you want to clear the app cache?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => Alert.alert('Done', 'Cache cleared') },
    ]);
  };

  const notifToggles = [
    { label: 'Price Alerts', value: priceAlerts, onToggle: setPriceAlerts },
    { label: 'Bot Updates', value: botUpdates, onToggle: setBotUpdates },
    { label: 'News Feed', value: newsFeed, onToggle: setNewsFeed },
    { label: 'Email Digests', value: emailDigests, onToggle: setEmailDigests },
  ];

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
          <Text style={styles.headerTitle}>Settings</Text>
        </View>

        {/* NOTIFICATIONS Section */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          {notifToggles.map((item, index) => (
            <View
              key={item.label}
              style={[styles.toggleRow, index < notifToggles.length - 1 && styles.rowBorder]}
            >
              <Text style={styles.rowLabel}>{item.label}</Text>
              <Switch
                value={item.value}
                onValueChange={item.onToggle}
                trackColor={{ false: '#2b3139', true: colors.accent }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>

        {/* TRADING Section */}
        <Text style={styles.sectionHeader}>TRADING</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.detailRow} activeOpacity={0.7}>
            <Text style={styles.rowLabel}>Default Leverage</Text>
            <View style={styles.rowRight}>
              <Text style={styles.rowValue}>{defaultLeverage}x</Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* APP Section */}
        <Text style={styles.sectionHeader}>APP</Text>
        <View style={styles.card}>
          <View style={[styles.detailRow, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Theme</Text>
            <Text style={styles.rowValue}>Dark Mode</Text>
          </View>
          <View style={[styles.detailRow, styles.rowBorder]}>
            <Text style={styles.rowLabel}>Version</Text>
            <Text style={styles.rowValue}>1.0.0</Text>
          </View>
          <TouchableOpacity
            style={[styles.detailRow, styles.rowBorder]}
            onPress={handleClearCache}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Clear Cache</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.detailRow, styles.rowBorder]}
            onPress={() => Alert.alert('Privacy Policy', 'Privacy Policy coming soon.')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => Alert.alert('Terms of Service', 'Terms of Service coming soon.')}
            activeOpacity={0.7}
          >
            <Text style={styles.rowLabel}>Terms of Service</Text>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
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
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingBottom: spacing.xl * 2,
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
  card: {
    backgroundColor: colors.cardAlt,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    fontSize: font.md,
    color: colors.text,
  },
  rowValue: {
    fontSize: font.md,
    color: colors.textSecondary,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  chevron: {
    fontSize: font.lg,
    color: colors.textMuted,
    lineHeight: font.lg + 4,
  },
});
