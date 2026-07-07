import React, { useEffect, useState, useCallback } from 'react';
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
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';

export default function SettingsScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();

  // Notification toggles
  const [emailNotif, setEmailNotif] = useState(true);
  const [telegramNotif, setTelegramNotif] = useState(false);
  const [whatsappNotif, setWhatsappNotif] = useState(false);

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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      {/* NOTIFICATIONS Section */}
      <Text style={styles.sectionLabel}>NOTIFICATIONS</Text>
      <View style={styles.card}>
        <View style={styles.rowBorder}>
          <Text style={styles.rowLabel}>Email</Text>
          <TouchableOpacity
            style={[styles.toggle, emailNotif ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setEmailNotif(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, emailNotif ? styles.toggleTextOn : styles.toggleTextOff]}>
              {emailNotif ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.rowBorder}>
          <Text style={styles.rowLabel}>Telegram</Text>
          <TouchableOpacity
            style={[styles.toggle, telegramNotif ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setTelegramNotif(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, telegramNotif ? styles.toggleTextOn : styles.toggleTextOff]}>
              {telegramNotif ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>WhatsApp</Text>
          <TouchableOpacity
            style={[styles.toggle, whatsappNotif ? styles.toggleOn : styles.toggleOff]}
            onPress={() => setWhatsappNotif(v => !v)}
            activeOpacity={0.8}
          >
            <Text style={[styles.toggleText, whatsappNotif ? styles.toggleTextOn : styles.toggleTextOff]}>
              {whatsappNotif ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={handleSaveNotifications} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>Save Notification Preferences</Text>
      </TouchableOpacity>

      {/* TRADING Section */}
      <Text style={styles.sectionLabel}>TRADING</Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Default Leverage</Text>
          <TextInput
            style={styles.leverageInput}
            value={defaultLeverage}
            onChangeText={setDefaultLeverage}
            keyboardType="number-pad"
            placeholderTextColor={colors.textMuted}
            maxLength={4}
          />
        </View>
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTrading} activeOpacity={0.8}>
        <Text style={styles.saveBtnText}>Save Trading Settings</Text>
      </TouchableOpacity>

      {/* APP Section */}
      <Text style={styles.sectionLabel}>APP</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.rowBorder} onPress={handleClearCache} activeOpacity={0.7}>
          <Text style={styles.rowLabel}>Clear Cache</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <View style={styles.rowBorder}>
          <Text style={styles.rowLabel}>App Version</Text>
          <Text style={styles.rowValue}>1.0.0</Text>
        </View>
        <TouchableOpacity
          style={styles.rowBorder}
          onPress={() => Alert.alert('Privacy Policy', 'Privacy Policy coming soon.')}
          activeOpacity={0.7}
        >
          <Text style={styles.rowLabel}>Privacy Policy</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.row}
          onPress={() => Alert.alert('Terms of Service', 'Terms of Service coming soon.')}
          activeOpacity={0.7}
        >
          <Text style={styles.rowLabel}>Terms of Service</Text>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
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
    paddingBottom: spacing.xl * 2,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
  },
  sectionLabel: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.card,
    marginHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rowBorder: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
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
  chevron: {
    fontSize: font.lg,
    color: colors.textSecondary,
    lineHeight: font.lg + 4,
  },
  toggle: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    minWidth: 48,
    alignItems: 'center',
  },
  toggleOn: {
    backgroundColor: colors.accent,
  },
  toggleOff: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleText: {
    fontSize: font.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  toggleTextOn: {
    color: colors.bg,
  },
  toggleTextOff: {
    color: colors.textSecondary,
  },
  leverageInput: {
    backgroundColor: colors.cardAlt,
    color: colors.text,
    fontSize: font.md,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 64,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: colors.accent,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  saveBtnText: {
    color: colors.bg,
    fontSize: font.sm,
    fontWeight: '700',
  },
});
