import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Alert, SafeAreaView,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import type { User } from '../context/AuthContext';
import { colors, spacing, radius, font, shadow } from '../theme';
import {
  updateProfile, changePassword, setup2fa, disable2fa, getMe,
} from '../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type SubView = null | 'personal' | 'security';

// ─── Tier config ─────────────────────────────────────────────────────────────
const TIER_CONFIG: Record<number, { label: string; bg: string; text: string }> = {
  0: { label: 'Unverified', bg: colors.border,     text: colors.textSecondary },
  1: { label: 'Tier 1',     bg: '#1a3a6b',          text: '#60a5fa'            },
  2: { label: 'Tier 2',     bg: colors.accentMuted, text: colors.accent        },
  3: { label: 'Tier 3',     bg: '#2d1a6b',          text: '#a78bfa'            },
};

// ─── Small helpers ────────────────────────────────────────────────────────────
function FieldLabel({ label, required }: { label: string; required?: boolean }) {
  return (
    <Text style={styles.fieldLabel}>
      {label}
      {required && <Text style={{ color: colors.accent }}> *</Text>}
    </Text>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <View style={styles.sectionDivider}>
      <Text style={styles.sectionDividerText}>{label}</Text>
      <View style={styles.sectionDividerLine} />
    </View>
  );
}

function CardHeader({ iconName, label, badge, badgeColor }: {
  iconName: string; label: string; badge?: string; badgeColor?: string;
}) {
  return (
    <View style={styles.cardHeader}>
      <Ionicons name={iconName as any} size={14} color={colors.accent} />
      <Text style={styles.cardHeaderText}>{label}</Text>
      {badge && (
        <View style={[styles.cardBadge, { backgroundColor: (badgeColor ?? colors.accentMuted) }]}>
          <Text style={[styles.cardBadgeText, { color: badgeColor ? '#fff' : colors.accent }]}>{badge}</Text>
        </View>
      )}
    </View>
  );
}

function SubPageHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={styles.subHeader}>
      <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </TouchableOpacity>
      <Text style={styles.subHeaderTitle}>{title}</Text>
    </View>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }: { navigation: any }) {
  const { user, logout, refreshUser, setUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);
  const [subView, setSubView]       = useState<SubView>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await refreshUser(); } catch {}
    setRefreshing(false);
  }, [refreshUser]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // ── User display values ────────────────────────────────────────────────────
  const email     = user?.email ?? '';
  const tier      = typeof user?.account_tier === 'number' ? user.account_tier : 0;
  const balance   = typeof user?.balance_usdt === 'number' ? user.balance_usdt.toFixed(2) : '0.00';
  const tierCfg   = TIER_CONFIG[tier] ?? TIER_CONFIG[0];
  const initials  = (user?.first_name?.[0] ?? email[0] ?? '?').toUpperCase();
  const fullName  = [user?.first_name, user?.middle_name, user?.last_name].filter(Boolean).join(' ') || email;

  const prefs          = (user?.notification_preferences as Record<string, any>) ?? {};
  const emailVerified  = user?.is_mail_verified === true;
  const kycApproved    = user?.kyc_status === 'approved';
  const kycSubmitted   = user?.kyc_status === 'submitted';
  const tgVerified     = !!prefs.telegram_chat_id;
  const waVerified     = !!prefs.whatsapp_verified;
  const tfaEnabled     = !!prefs.tfa_enabled;

  // ── Sub-views ──────────────────────────────────────────────────────────────
  if (subView === 'personal') {
    return (
      <PersonalInfoView
        user={user}
        onBack={() => setSubView(null)}
        onSaved={(updated) => setUser(updated)}
      />
    );
  }
  if (subView === 'security') {
    return (
      <SecurityView
        user={user}
        onBack={() => setSubView(null)}
        onUserUpdated={(updated) => setUser(updated)}
      />
    );
  }

  // ── Nav rows ───────────────────────────────────────────────────────────────
  const navItems = [
    {
      iconName: 'person-outline',
      label: 'Personal Information',
      sub: 'Update your details',
      onPress: () => setSubView('personal'),
    },
    {
      iconName: 'shield-checkmark-outline',
      label: 'Security',
      sub: 'Password & Two-Factor Auth',
      onPress: () => setSubView('security'),
    },
    {
      iconName: 'star-outline',
      label: 'Pricing Plans',
      sub: 'Upgrade your account',
      onPress: () => navigation.navigate('Pricing'),
    },
    {
      iconName: 'settings-outline',
      label: 'Settings',
      sub: 'Notifications & preferences',
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero card ── */}
        <View style={styles.heroCard}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarCircle}>
              {user?.profile_photo ? (
                <Text style={styles.avatarText}>{initials}</Text>
              ) : (
                <Text style={styles.avatarText}>{initials}</Text>
              )}
            </View>
          </View>

          <Text style={styles.displayName}>{fullName}</Text>
          <Text style={styles.displayEmail}>{email}</Text>

          <View style={[styles.tierPill, { backgroundColor: tierCfg.bg }]}>
            <Ionicons name="star" size={11} color={tierCfg.text} />
            <Text style={[styles.tierPillText, { color: tierCfg.text }]}> {tierCfg.label}</Text>
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

        {/* ── Verification status strip ── */}
        <View style={styles.statusStrip}>
          <StatusDot label="Email" active={emailVerified} iconName="mail-outline" color="#0ecb81" />
          <StatusDot label="KYC"   active={kycApproved}  iconName="shield-outline"
            color={kycApproved ? '#0ecb81' : kycSubmitted ? '#f0b90b' : undefined} />
          <StatusDot label="2FA"   active={tfaEnabled}   iconName="lock-closed-outline" color="#0ecb81" />
          <StatusDot label="TG"    active={tgVerified}   iconName="send-outline"        color="#229ED9" />
          <StatusDot label="WA"    active={waVerified}   iconName="chatbubble-outline"  color="#25D366" />
        </View>

        {/* ── Navigation list ── */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.listCard}>
          {navItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.listRow, index < navItems.length - 1 && styles.listRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.iconBox}>
                <Ionicons name={item.iconName as any} size={16} color={colors.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                <Text style={styles.rowSub}>{item.sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Sign out ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={16} color={colors.red} style={{ marginRight: 8 }} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>FinAi v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Status dot component ───────────────────────────────────────────────────────
function StatusDot({ label, active, iconName, color }: {
  label: string; active: boolean; iconName: string; color?: string;
}) {
  const activeColor = color ?? colors.accent;
  return (
    <View style={styles.statusDotItem}>
      <Ionicons
        name={iconName as any}
        size={17}
        color={active ? activeColor : colors.border}
      />
      <Text style={[styles.statusDotLabel, active && { color: activeColor }]}>{label}</Text>
    </View>
  );
}

// ─── PERSONAL INFORMATION VIEW ────────────────────────────────────────────────
function PersonalInfoView({ user, onBack, onSaved }: {
  user: User | null; onBack: () => void; onSaved: (u: User) => void;
}) {
  const [form, setForm] = useState({
    first_name:  user?.first_name  ?? '',
    middle_name: user?.middle_name ?? '',
    last_name:   user?.last_name   ?? '',
    username:    user?.username    ?? '',
    phone:       user?.phone       ?? '',
    dob:         user?.dob         ?? '',
    sex:         user?.sex         ?? '',
    address:     user?.address     ?? '',
    country:     user?.country     ?? '',
  });
  const [saving, setSaving] = useState(false);
  const locked = !!user?.profile_locked;

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (locked) {
      Alert.alert('Locked', 'Your profile is locked by admin. Contact support to request changes.');
      return;
    }
    if (!form.first_name.trim()) { Alert.alert('Validation', 'First name is required.'); return; }
    if (!form.last_name.trim())  { Alert.alert('Validation', 'Last name is required.'); return; }
    if (!form.phone.trim())      { Alert.alert('Validation', 'Phone number is required.'); return; }
    if (!form.country.trim())    { Alert.alert('Validation', 'Country is required.'); return; }
    if (form.dob && !/^\d{4}-\d{2}-\d{2}$/.test(form.dob)) {
      Alert.alert('Validation', 'Date of birth must be in YYYY-MM-DD format.'); return;
    }
    setSaving(true);
    try {
      const res = await updateProfile(form as Record<string, unknown>);
      onSaved(res.data as User);
      Alert.alert('Success', 'Profile updated successfully.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || 'Failed to update profile.';
      Alert.alert('Error', msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SubPageHeader title="Personal Information" onBack={onBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: spacing.sm }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {locked && (
            <View style={styles.lockedBanner}>
              <Ionicons name="lock-closed" size={13} color={colors.red} />
              <Text style={styles.lockedText}>
                Profile is locked by admin. Contact support to request changes.
              </Text>
            </View>
          )}

          {/* ── Full Name ── */}
          <View style={styles.formCard}>
            <CardHeader iconName="person-outline" label="Personal Information" badge="Required for KYC" />
            <View style={styles.formBody}>

              <SectionDivider label="Full Name" />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="First Name" required />
                  <TextInput
                    style={[styles.input, locked && styles.inputDisabled]}
                    value={form.first_name} onChangeText={set('first_name')}
                    placeholder="First name" placeholderTextColor={colors.textMuted}
                    editable={!locked}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Middle Name" />
                  <TextInput
                    style={[styles.input, locked && styles.inputDisabled]}
                    value={form.middle_name} onChangeText={set('middle_name')}
                    placeholder="Optional" placeholderTextColor={colors.textMuted}
                    editable={!locked}
                  />
                </View>
              </View>
              <View style={{ marginTop: spacing.sm }}>
                <FieldLabel label="Last Name" required />
                <TextInput
                  style={[styles.input, locked && styles.inputDisabled]}
                  value={form.last_name} onChangeText={set('last_name')}
                  placeholder="Last name" placeholderTextColor={colors.textMuted}
                  editable={!locked}
                />
              </View>

              <SectionDivider label="Account Details" />
              <FieldLabel label="Username" />
              <TextInput
                style={[styles.input, locked && styles.inputDisabled]}
                value={form.username} onChangeText={set('username')}
                placeholder="@username" placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                editable={!locked}
              />

              <SectionDivider label="Contact & Identity" />
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Phone Number" required />
                  <TextInput
                    style={[styles.input, locked && styles.inputDisabled]}
                    value={form.phone} onChangeText={set('phone')}
                    placeholder="+1 234 567 8900" placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    editable={!locked}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Date of Birth" required />
                  <TextInput
                    style={[styles.input, locked && styles.inputDisabled]}
                    value={form.dob} onChangeText={set('dob')}
                    placeholder="YYYY-MM-DD" placeholderTextColor={colors.textMuted}
                    editable={!locked}
                  />
                </View>
              </View>

              <View style={[styles.row2, { marginTop: spacing.sm }]}>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Sex" />
                  <SexPicker value={form.sex} onChange={set('sex')} disabled={locked} />
                </View>
                <View style={{ flex: 1 }}>
                  <FieldLabel label="Country" required />
                  <TextInput
                    style={[styles.input, locked && styles.inputDisabled]}
                    value={form.country} onChangeText={set('country')}
                    placeholder="Country" placeholderTextColor={colors.textMuted}
                    editable={!locked}
                  />
                </View>
              </View>

              <View style={{ marginTop: spacing.sm }}>
                <FieldLabel label="Street Address" />
                <TextInput
                  style={[styles.input, locked && styles.inputDisabled]}
                  value={form.address} onChangeText={set('address')}
                  placeholder="Street address" placeholderTextColor={colors.textMuted}
                  editable={!locked}
                />
              </View>

              {!locked && (
                <TouchableOpacity
                  style={[styles.primaryBtn, saving && styles.btnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving
                    ? <ActivityIndicator size="small" color="#000" />
                    : <Text style={styles.primaryBtnText}>Save Changes</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Simple sex picker (segmented buttons)
function SexPicker({ value, onChange, disabled }: {
  value: string; onChange: (v: string) => void; disabled: boolean;
}) {
  const options = ['Male', 'Female', 'Other'];
  return (
    <View style={styles.sexPicker}>
      {options.map(opt => (
        <TouchableOpacity
          key={opt}
          style={[styles.sexOption, value === opt && styles.sexOptionActive]}
          onPress={() => !disabled && onChange(opt)}
          activeOpacity={0.7}
        >
          <Text style={[styles.sexOptionText, value === opt && styles.sexOptionTextActive]}>
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── SECURITY VIEW ────────────────────────────────────────────────────────────
function SecurityView({ user, onBack, onUserUpdated }: {
  user: User | null; onBack: () => void; onUserUpdated: (u: User) => void;
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <SubPageHeader title="Security" onBack={onBack} />
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: spacing.sm }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <ChangePasswordCard />
          <TwoFactorCard user={user} onUserUpdated={onUserUpdated} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Change Password ────────────────────────────────────────────────────────────
function ChangePasswordCard() {
  const [currentPw,  setCurrentPw]  = useState('');
  const [newPw,      setNewPw]      = useState('');
  const [confirmPw,  setConfirmPw]  = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [saving,     setSaving]     = useState(false);

  const handleSave = async () => {
    if (newPw !== confirmPw) { Alert.alert('Error', 'Passwords do not match.'); return; }
    if (newPw.length < 8)    { Alert.alert('Error', 'Password must be at least 8 characters.'); return; }
    setSaving(true);
    try {
      await changePassword({ current_password: currentPw, new_password: newPw });
      Alert.alert('Success', 'Password changed successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to change password.');
    } finally { setSaving(false); }
  };

  return (
    <View style={[styles.formCard, { marginBottom: spacing.md }]}>
      <CardHeader iconName="lock-closed-outline" label="Change Password" />
      <View style={styles.formBody}>

        <FieldLabel label="Current Password" />
        <View style={styles.pwRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginBottom: 0 }]}
            value={currentPw} onChangeText={setCurrentPw}
            secureTextEntry={!showPw}
            placeholder="••••••••" placeholderTextColor={colors.textMuted}
          />
          <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
            <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.row2, { marginTop: spacing.sm }]}>
          <View style={{ flex: 1 }}>
            <FieldLabel label="New Password" />
            <TextInput
              style={styles.input}
              value={newPw} onChangeText={setNewPw}
              secureTextEntry placeholder="Min 8 chars" placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={{ flex: 1 }}>
            <FieldLabel label="Confirm Password" />
            <TextInput
              style={styles.input}
              value={confirmPw} onChangeText={setConfirmPw}
              secureTextEntry placeholder="Repeat" placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, saving && styles.btnDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving
            ? <ActivityIndicator size="small" color="#000" />
            : <Text style={styles.primaryBtnText}>Update Password</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Two-Factor Authentication ─────────────────────────────────────────────────
function TwoFactorCard({ user, onUserUpdated }: {
  user: User | null; onUserUpdated: (u: User) => void;
}) {
  const prefs = (user?.notification_preferences ?? {}) as Record<string, unknown>;

  const [enabled,    setEnabled]    = useState<boolean>(!!prefs.tfa_enabled);
  const [method,     setMethod]     = useState<'telegram' | 'email'>((prefs.tfa_method as 'telegram' | 'email') || 'telegram');
  const [recovEmail, setRecovEmail] = useState<string>((prefs.recovery_email as string) || '');
  const [saving,     setSaving]     = useState(false);

  // Keep local state in sync whenever parent refreshes user data
  useEffect(() => {
    const p = (user?.notification_preferences ?? {}) as Record<string, unknown>;
    setEnabled(!!p.tfa_enabled);
    setMethod((p.tfa_method as 'telegram' | 'email') || 'telegram');
    setRecovEmail((p.recovery_email as string) || '');
  }, [user?.notification_preferences]);

  const hasTelegram   = !!(prefs.telegram_chat_id);
  const currentMethod = (prefs.tfa_method as string) || 'telegram';

  const handleEnable = async () => {
    if (method === 'telegram' && !hasTelegram) {
      Alert.alert('Telegram Required', 'You need to link your Telegram account first. Connect it via the FinAPI section on the web dashboard.');
      return;
    }
    setSaving(true);
    try {
      await setup2fa({ tfa_method: method, recovery_email: recovEmail || undefined });
      setEnabled(true);
      Alert.alert('2FA Enabled', 'Two-factor authentication is now active. You will receive a code via ' + (method === 'telegram' ? 'Telegram' : 'Email') + ' on each login.');
      // Refresh user to get updated prefs
      try { const res = await getMe(); onUserUpdated(res.data); } catch {}
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.detail || 'Failed to enable 2FA.');
    } finally { setSaving(false); }
  };

  const handleDisable = () => {
    Alert.alert(
      'Disable 2FA',
      'Are you sure you want to disable Two-Factor Authentication? This will reduce your account security.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disable', style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await disable2fa();
              setEnabled(false);
              Alert.alert('2FA Disabled', 'Two-factor authentication has been turned off.');
              try { const res = await getMe(); onUserUpdated(res.data); } catch {}
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.detail || 'Failed to disable 2FA.');
            } finally { setSaving(false); }
          },
        },
      ],
    );
  };

  const badgeStyle = enabled
    ? { backgroundColor: 'rgba(14,203,129,0.15)' }
    : { backgroundColor: colors.border };
  const badgeTextColor = enabled ? '#0ecb81' : colors.textSecondary;

  return (
    <View style={styles.formCard}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="cellphone-key" size={14} color={colors.accent} />
        <Text style={styles.cardHeaderText}>Two-Factor Authentication</Text>
        <View style={[styles.cardBadge, badgeStyle]}>
          <Text style={[styles.cardBadgeText, { color: badgeTextColor }]}>
            {enabled ? 'Enabled' : 'Disabled'}
          </Text>
        </View>
      </View>

      <View style={styles.formBody}>
        <Text style={styles.helpText}>
          Add an extra layer of security. A verification code will be sent to your chosen channel each time you log in.
        </Text>

        {enabled ? (
          /* ── Enabled state ── */
          <View style={styles.tfaEnabledBox}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <Ionicons name="checkmark-circle" size={16} color="#0ecb81" style={{ marginRight: 6 }} />
              <Text style={styles.tfaEnabledTitle}>2FA is active</Text>
            </View>
            <Text style={styles.tfaEnabledSub}>
              Method:{' '}
              <Text style={{ color: colors.text }}>
                {currentMethod === 'telegram' ? 'Telegram' : 'Email'}
              </Text>
              {prefs.recovery_email ? (
                <>
                  {'  ·  Recovery: '}
                  <Text style={{ color: colors.text }}>{prefs.recovery_email as string}</Text>
                </>
              ) : null}
            </Text>

            <TouchableOpacity
              style={[styles.dangerBtn, saving && styles.btnDisabled, { marginTop: spacing.md }]}
              onPress={handleDisable}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color={colors.red} />
                : (
                  <>
                    <Ionicons name="shield-outline" size={14} color={colors.red} style={{ marginRight: 6 }} />
                    <Text style={styles.dangerBtnText}>Disable 2FA</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        ) : (
          /* ── Setup state ── */
          <View style={{ gap: spacing.md }}>
            {/* Method selector */}
            <View>
              <Text style={[styles.fieldLabel, { marginBottom: spacing.xs }]}>Verification method</Text>
              <View style={styles.methodRow}>
                {([
                  { value: 'telegram' as const, label: 'Telegram', sub: 'Via your linked bot', iconName: 'send-outline' },
                  { value: 'email'    as const, label: 'Email',    sub: 'Via your account email', iconName: 'mail-outline' },
                ] as const).map(opt => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.methodOption, method === opt.value && styles.methodOptionActive]}
                    onPress={() => setMethod(opt.value)}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={opt.iconName as any}
                      size={16}
                      color={method === opt.value ? colors.accent : colors.textSecondary}
                    />
                    <Text style={[styles.methodLabel, method === opt.value && { color: colors.text }]}>
                      {opt.label}
                    </Text>
                    <Text style={styles.methodSub}>{opt.sub}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {method === 'telegram' && !hasTelegram && (
                <View style={styles.warningRow}>
                  <Ionicons name="alert-circle-outline" size={13} color={colors.red} />
                  <Text style={styles.warningText}>
                    Telegram not linked. Connect it via the web dashboard's FinAPI tab first.
                  </Text>
                </View>
              )}
            </View>

            {/* Recovery email */}
            <View>
              <FieldLabel label="Recovery Email (optional)" />
              <TextInput
                style={styles.input}
                value={recovEmail}
                onChangeText={setRecovEmail}
                placeholder="backup@example.com"
                placeholderTextColor={colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text style={styles.helpText}>
                Used for account recovery if you lose access to your 2FA method.
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, (saving || (method === 'telegram' && !hasTelegram)) && styles.btnDisabled]}
              onPress={handleEnable}
              disabled={saving || (method === 'telegram' && !hasTelegram)}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator size="small" color="#000" />
                : (
                  <>
                    <Ionicons name="shield-checkmark-outline" size={15} color="#000" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryBtnText}>Enable 2FA</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safeArea:   { flex: 1, backgroundColor: colors.bg },
  content:    { paddingBottom: spacing.xl * 2 },

  // Hero card
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
  avatarText:    { fontSize: font.xl, fontWeight: '700', color: '#000' },
  displayName:   { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: 3 },
  displayEmail:  { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.sm },
  tierPill: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20, marginBottom: spacing.md,
  },
  tierPillText:  { fontSize: font.xs, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  balanceRow:    { flexDirection: 'row', justifyContent: 'center' },
  balanceItem:   { alignItems: 'center' },
  balanceLabel:  { fontSize: font.xs, color: colors.textSecondary, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
  balanceValue:  { fontSize: font.xl, fontWeight: '800', color: colors.text },
  balanceCurrency: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // Status strip
  statusStrip: {
    flexDirection: 'row', justifyContent: 'space-around',
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginHorizontal: spacing.md, marginBottom: spacing.sm,
    paddingVertical: spacing.sm, ...shadow.card,
  },
  statusDotItem:  { alignItems: 'center', gap: 4 },
  statusDotLabel: { fontSize: 9, fontWeight: '600', color: colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Section & nav list
  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    marginHorizontal: spacing.md, marginBottom: spacing.sm, marginTop: spacing.lg,
  },
  listCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginHorizontal: spacing.md, overflow: 'hidden', ...shadow.card,
  },
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: spacing.md,
  },
  listRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: colors.accentMuted,
    alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm,
  },
  rowLabel:  { fontSize: font.md, color: colors.text, marginBottom: 2 },
  rowSub:    { fontSize: font.xs, color: colors.textMuted },

  // Sign out / version
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.redMuted, borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.lg, paddingVertical: 15,
    marginTop: spacing.xl, marginHorizontal: spacing.md,
  },
  logoutText:   { color: colors.red, fontSize: font.md, fontWeight: '700' },
  versionText:  { textAlign: 'center', fontSize: font.xs, color: colors.textMuted, marginTop: spacing.md },

  // Sub-page header
  subHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  backBtn:        { marginRight: spacing.sm, padding: 4 },
  subHeaderTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text },

  // Form card
  formCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, marginHorizontal: spacing.md, overflow: 'hidden', ...shadow.card,
    marginBottom: spacing.md,
  },
  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  cardHeaderText: { flex: 1, fontSize: font.sm, fontWeight: '600', color: colors.text },
  cardBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  cardBadgeText:  { fontSize: 10, fontWeight: '700' },
  formBody:       { padding: spacing.md, gap: spacing.sm },

  // Section divider inside form
  sectionDivider: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: spacing.sm, marginBottom: 4,
  },
  sectionDividerText: {
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1.2, color: colors.textMuted,
  },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: colors.border },

  // Field label
  fieldLabel: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: 6,
  },

  // Inputs
  input: {
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: font.sm, color: colors.text, marginBottom: 0,
  },
  inputDisabled: { opacity: 0.5 },
  row2: { flexDirection: 'row', gap: spacing.sm },

  // Sex picker
  sexPicker:          { flexDirection: 'row', gap: 4 },
  sexOption: {
    flex: 1, paddingVertical: 9, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', backgroundColor: colors.bg,
  },
  sexOptionActive:     { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  sexOptionText:       { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  sexOptionTextActive: { color: colors.accent },

  // Buttons
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 13, marginTop: spacing.sm,
  },
  primaryBtnText: { fontSize: font.sm, fontWeight: '700', color: '#000' },
  btnDisabled:    { opacity: 0.5 },
  dangerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.redMuted, borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.sm, paddingVertical: 11,
  },
  dangerBtnText: { fontSize: font.sm, fontWeight: '700', color: colors.red },

  // Password row
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyeBtn: {
    width: 40, height: 42, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm,
  },

  // 2FA
  tfaEnabledBox: {
    backgroundColor: 'rgba(14,203,129,0.06)', borderWidth: 1, borderColor: 'rgba(14,203,129,0.2)',
    borderRadius: radius.sm, padding: spacing.md,
  },
  tfaEnabledTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text },
  tfaEnabledSub:   { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  methodRow:    { flexDirection: 'row', gap: spacing.sm },
  methodOption: {
    flex: 1, alignItems: 'center', gap: 4, paddingVertical: 12,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.sm, backgroundColor: colors.bg,
  },
  methodOptionActive: { borderColor: colors.accent, backgroundColor: colors.accentMuted },
  methodLabel:        { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary },
  methodSub:          { fontSize: 10, color: colors.textMuted, textAlign: 'center' },

  warningRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    marginTop: 6,
  },
  warningText:   { flex: 1, fontSize: font.xs, color: colors.red, lineHeight: 17 },
  helpText:      { fontSize: font.xs, color: colors.textSecondary, lineHeight: 18, marginTop: 4 },

  // Locked banner
  lockedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.redMuted, borderWidth: 1, borderColor: colors.red,
    borderRadius: radius.sm, padding: 12,
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
  },
  lockedText: { flex: 1, fontSize: font.xs, color: colors.textSecondary },
});
