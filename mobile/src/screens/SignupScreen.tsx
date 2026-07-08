import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { signup as apiSignup } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

export default function SignupScreen({ navigation }: { navigation: any }) {
  const { login: storeToken } = useAuth();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [referral, setReferral] = useState('');
  const [agreed, setAgreed]     = useState(false);
  const [loading, setLoading]   = useState(false);

  const pwStrength = (): { label: string; color: string; bars: number } => {
    const len = password.length;
    if (len === 0)   return { label: '', color: colors.border, bars: 0 };
    if (len < 6)     return { label: 'Too short', color: colors.red, bars: 1 };
    if (len < 8)     return { label: 'Weak', color: colors.red, bars: 2 };
    if (len < 12)    return { label: 'Good', color: colors.accent, bars: 3 };
    return { label: 'Strong', color: colors.green, bars: 4 };
  };
  const strength = pwStrength();

  const handleSignup = async () => {
    if (loading) return;
    const e = email.trim();
    if (!e || !password) { Alert.alert('Missing Fields', 'Please fill in all required fields.'); return; }
    if (!e.includes('@')) { Alert.alert('Invalid Email', 'Enter a valid email address.'); return; }
    if (password.length < 8) { Alert.alert('Weak Password', 'Password must be at least 8 characters.'); return; }
    if (!agreed) { Alert.alert('Terms Required', 'Please agree to the Terms & Conditions.'); return; }
    setLoading(true);
    try {
      const res = await apiSignup(e, password, referral.trim() || undefined);
      const data = res.data;
      if (data.access_token) {
        await storeToken(data.access_token);
      } else {
        Alert.alert('Success', 'Account created! Please sign in.');
        navigation.navigate('Login');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Registration failed. Please try again.';
      Alert.alert('Signup Failed', msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Logo — stacked, centered */}
          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Ionicons name="flash" size={28} color="#000" />
            </View>
            <Text style={styles.logoText}>FinAi</Text>
            <Text style={styles.logoSub}>AI-Powered Trading Platform</Text>
          </View>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Create account</Text>
            <Text style={styles.cardSubtitle}>Fill in your details to get started</Text>

            {/* Email */}
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
              autoCorrect={false}
            />

            {/* Password */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPw}
                returnKeyType="next"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(p => !p)}>
                <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Password strength */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[1, 2, 3, 4].map(i => (
                  <View
                    key={i}
                    style={[styles.strengthBar, { backgroundColor: i <= strength.bars ? strength.color : colors.border }]}
                  />
                ))}
                <Text style={styles.strengthLabel}>{strength.label}</Text>
              </View>
            )}

            {/* Referral code */}
            <Text style={styles.label}>
              Referral Code <Text style={styles.optional}>(optional)</Text>
            </Text>
            <View style={styles.referralRow}>
              <Ionicons name="gift-outline" size={15} color={colors.accent} style={styles.inputIcon} />
              <TextInput
                style={styles.referralInput}
                value={referral}
                onChangeText={t => setReferral(t.toUpperCase())}
                placeholder="e.g. AB3XY7KL"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="characters"
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
            </View>
            {referral.length > 0 && (
              <View style={styles.referralConfirm}>
                <Ionicons name="checkmark-circle" size={11} color={colors.green} />
                <Text style={styles.referralConfirmText}>Referral code applied — your referrer will earn a bonus!</Text>
              </View>
            )}

            {/* Terms */}
            <TouchableOpacity style={styles.termsRow} onPress={() => setAgreed(a => !a)} activeOpacity={0.8}>
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Ionicons name="checkmark" size={12} color="#000" />}
              </View>
              <Text style={styles.termsText}>
                I agree to the{' '}
                <Text style={styles.accentText}>Terms & Conditions</Text>
                {' '}and Privacy Policy
              </Text>
            </TouchableOpacity>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.primaryBtnText}>Create Account</Text>}
            </TouchableOpacity>

            {/* OR divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social buttons */}
            <View style={styles.socialRow}>
              {(['Google', 'Apple'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={styles.socialBtn}
                  onPress={() => Alert.alert('Coming Soon', `${p} sign-in is coming soon.`)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={p === 'Google' ? 'logo-google' : 'logo-apple'}
                    size={16}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.socialBtnText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Switch to login */}
          <View style={styles.switchRow}>
            <Text style={styles.switchPrompt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.switchLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Trust badges */}
          <View style={styles.trustRow}>
            {([
              { icon: 'lock-closed', label: 'Encrypted' },
              { icon: 'flash',       label: 'Instant Access' },
              { icon: 'shield',      label: 'Secure' },
            ] as const).map(({ icon, label }) => (
              <View key={label} style={styles.trustChip}>
                <Ionicons name={icon} size={11} color={colors.textMuted} />
                <Text style={styles.trustText}>{label}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.footer}>© {new Date().getFullYear()} FinAi Technologies. All rights reserved.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, flexGrow: 1, alignItems: 'center' },

  // Logo
  logoArea: { alignItems: 'center', marginBottom: spacing.xl },
  logoBox: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm, ...shadow.accent,
  },
  logoText: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  logoSub: { fontSize: font.xs, color: colors.textSecondary, marginTop: 2 },

  // Card
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: '#161a1e', borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card,
  },
  cardTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },

  label: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.xs },
  optional: { color: colors.textMuted, fontWeight: '400' },

  input: {
    backgroundColor: colors.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, paddingHorizontal: spacing.md,
    color: colors.text, fontSize: font.sm, marginBottom: spacing.sm,
  },

  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  passwordInput: { flex: 1, paddingVertical: 13, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.sm },
  eyeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: font.xs, color: colors.textMuted, minWidth: 52 },

  referralRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: 4,
  },
  inputIcon: { marginLeft: spacing.md },
  referralInput: { flex: 1, paddingVertical: 13, paddingHorizontal: spacing.sm, color: colors.text, fontSize: font.sm, letterSpacing: 1.5 },
  referralConfirm: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  referralConfirmText: { fontSize: 10, color: colors.green },

  termsRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginTop: spacing.sm, marginBottom: spacing.md },
  checkbox: {
    width: 16, height: 16, borderRadius: 4,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', marginTop: 1, flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: colors.accent, borderColor: colors.accent },
  termsText: { flex: 1, fontSize: font.xs, color: colors.textSecondary, lineHeight: 18 },
  accentText: { color: colors.accent, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.lg,
    paddingVertical: 14, alignItems: 'center', marginTop: 4, ...shadow.accent,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: font.sm },

  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.lg, gap: spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { fontSize: 9, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1.5 },

  socialRow: { flexDirection: 'row', gap: spacing.sm },
  socialBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
  },
  socialBtnText: { fontSize: font.xs, fontWeight: '500', color: colors.textSecondary },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  switchPrompt: { fontSize: font.sm, color: colors.textSecondary },
  switchLink: { fontSize: font.sm, color: colors.accent, fontWeight: '700' },

  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.lg },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#161a1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  trustText: { fontSize: font.xs, color: colors.textMuted },

  footer: { fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
