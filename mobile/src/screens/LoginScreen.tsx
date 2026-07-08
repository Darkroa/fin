import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, verify2fa, forgotPassword, resetPassword, resend2faCode } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

type Mode = 'login' | 'forgot-email' | 'forgot-code';
type Step = 'form' | '2fa';

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { login: storeToken } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [step, setStep] = useState<Step>('form');

  // Credentials
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  // 2FA
  const [twoFaCode, setTwoFaCode]       = useState('');
  const [partialToken, setPartialToken] = useState('');
  const [tfaMethod, setTfaMethod]       = useState('');
  const [tfaLoading, setTfaLoading]     = useState(false);
  const [tfaResending, setTfaResending] = useState(false);
  const [tfaCooldown, setTfaCooldown]   = useState(0);

  // Forgot password
  const [resetEmail, setResetEmail]       = useState('');
  const [resetCode, setResetCode]         = useState('');
  const [newPassword, setNewPassword]     = useState('');
  const [showNewPw, setShowNewPw]         = useState(false);

  // Countdown for resend
  useEffect(() => {
    if (tfaCooldown <= 0) return;
    const t = setTimeout(() => setTfaCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [tfaCooldown]);

  // ── Login ──────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (loading) return;
    const e = email.trim();
    if (!e || !password) { Alert.alert('Missing Fields', 'Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const res = await apiLogin(e, password);
      const data = res.data;
      if (data.requires_2fa && data.partial_token) {
        setPartialToken(data.partial_token);
        setTfaMethod(data.method || 'telegram');
        setStep('2fa');
        Alert.alert('Code Sent', `2FA code sent via ${data.method === 'email' ? 'email' : 'Telegram'}`);
      } else if (data.access_token) {
        await storeToken(data.access_token);
      } else {
        Alert.alert('Login Failed', 'Unexpected server response.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? err?.message ?? 'Login failed. Check your credentials.';
      Alert.alert('Login Failed', msg);
    } finally { setLoading(false); }
  };

  // ── 2FA verify ─────────────────────────────────────────────────────────────
  const handle2fa = async () => {
    if (twoFaCode.length < 6) { Alert.alert('Error', 'Enter the 6-digit code'); return; }
    setTfaLoading(true);
    try {
      const res = await verify2fa(partialToken, twoFaCode.trim());
      const data = res.data;
      if (data.access_token) {
        await storeToken(data.access_token);
      } else {
        Alert.alert('Error', 'Invalid 2FA code.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Invalid or expired code';
      Alert.alert('2FA Failed', msg);
    } finally { setTfaLoading(false); }
  };

  const handleResend2FA = async () => {
    if (tfaCooldown > 0 || tfaResending) return;
    setTfaResending(true);
    try {
      await resend2faCode(partialToken);
      Alert.alert('Code Sent', `New code sent via ${tfaMethod === 'email' ? 'email' : 'Telegram'}`);
      setTfaCooldown(30);
      setTwoFaCode('');
    } catch {
      Alert.alert('Error', 'Failed to resend. Please log in again.');
    } finally { setTfaResending(false); }
  };

  const backFromTFA = () => {
    setStep('form');
    setTwoFaCode('');
    setPartialToken('');
    setTfaCooldown(0);
  };

  // ── Forgot password ────────────────────────────────────────────────────────
  const handleForgotEmail = async () => {
    if (loading) return;
    const e = email.trim();
    if (!e) { Alert.alert('Enter Email', 'Enter your email address first.'); return; }
    setLoading(true);
    try {
      const res = await forgotPassword(e);
      setResetEmail(e);
      const devCode = res.data?.dev_code;
      if (devCode) Alert.alert('Code Sent', `Reset code sent! (dev: ${devCode})`);
      else Alert.alert('Code Sent', 'Reset code sent — check your email, Telegram or WhatsApp.');
      setMode('forgot-code');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Could not send reset code.';
      Alert.alert('Error', msg);
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (loading) return;
    if (resetCode.length < 6) { Alert.alert('Error', 'Enter the 6-digit code.'); return; }
    if (newPassword.length < 8) { Alert.alert('Error', 'Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await resetPassword(resetEmail || email.trim(), resetCode, newPassword);
      Alert.alert('Success', 'Password updated! Please sign in.');
      setMode('login');
      setResetCode('');
      setNewPassword('');
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Failed to reset password.';
      Alert.alert('Error', msg);
    } finally { setLoading(false); }
  };

  const goBackToLogin = () => {
    setMode('login');
    setResetCode('');
    setNewPassword('');
    setResetEmail('');
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* Logo — centred, stacked, like web */}
          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Ionicons name="flash" size={28} color="#000" />
            </View>
            <Text style={styles.logoText}>FinAi</Text>
            <Text style={styles.logoSub}>AI-Powered Trading Platform</Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>

            {/* ── 2FA step ── */}
            {step === '2fa' ? (
              <>
                <TouchableOpacity style={styles.backRow} onPress={backFromTFA}>
                  <Ionicons name="arrow-back" size={13} color={colors.textSecondary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <View style={styles.sectionHeader}>
                  <Ionicons name="shield-checkmark" size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>Two-Factor Authentication</Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  A 6-digit verification code was sent to your{' '}
                  <Text style={styles.highlight}>{tfaMethod === 'email' ? 'email' : 'Telegram'}</Text>.
                  {' '}Enter it below to complete login.
                </Text>

                <Text style={styles.label}>Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={twoFaCode}
                  onChangeText={t => setTwoFaCode(t.replace(/\D/g, ''))}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handle2fa}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, (tfaLoading || twoFaCode.length < 6) && styles.primaryBtnDisabled]}
                  onPress={handle2fa}
                  disabled={tfaLoading || twoFaCode.length < 6}
                  activeOpacity={0.88}
                >
                  {tfaLoading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.primaryBtnText}>Verify & Login</Text>}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <Text style={styles.mutedText}>Didn't receive the code? </Text>
                  {tfaCooldown > 0 ? (
                    <Text style={styles.dimText}>Resend in {tfaCooldown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend2FA} disabled={tfaResending}>
                      <Text style={[styles.accentText, tfaResending && { opacity: 0.6 }]}>
                        {tfaResending ? 'Sending…' : 'Resend'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </>

            ) : mode === 'forgot-email' ? (
              /* ── Forgot step 1: enter email ── */
              <>
                <TouchableOpacity style={styles.backRow} onPress={goBackToLogin}>
                  <Ionicons name="arrow-back" size={13} color={colors.textSecondary} />
                  <Text style={styles.backText}>Back to sign in</Text>
                </TouchableOpacity>
                <View style={styles.sectionHeader}>
                  <Ionicons name="mail" size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>Reset Password</Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  Enter your email and we'll send a 6-digit reset code to your email, Telegram, or WhatsApp.
                </Text>

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  returnKeyType="done"
                  onSubmitEditing={handleForgotEmail}
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleForgotEmail}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.primaryBtnText}>Send Reset Code</Text>}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <Text style={styles.mutedText}>Already have the code? </Text>
                  <TouchableOpacity onPress={() => { setResetEmail(email.trim()); setMode('forgot-code'); }}>
                    <Text style={styles.accentText}>Enter code</Text>
                  </TouchableOpacity>
                </View>
              </>

            ) : mode === 'forgot-code' ? (
              /* ── Forgot step 2: code + new password ── */
              <>
                <TouchableOpacity style={styles.backRow} onPress={() => setMode('forgot-email')}>
                  <Ionicons name="arrow-back" size={13} color={colors.textSecondary} />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <View style={styles.sectionHeader}>
                  <Ionicons name="key" size={16} color={colors.accent} />
                  <Text style={styles.cardTitle}>Enter Reset Code</Text>
                </View>
                <Text style={styles.cardSubtitle}>
                  Check your email, Telegram, or WhatsApp for the 6-digit code sent to{' '}
                  <Text style={styles.highlight}>{resetEmail || email}</Text>.
                </Text>

                <Text style={styles.label}>6-Digit Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={resetCode}
                  onChangeText={t => setResetCode(t.replace(/\D/g, ''))}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={6}
                  returnKeyType="next"
                  autoFocus
                />

                <Text style={styles.label}>New Password</Text>
                <View style={styles.passwordRow}>
                  <Ionicons name="lock-closed-outline" size={15} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.passwordInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Min 8 characters"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showNewPw}
                    returnKeyType="done"
                    onSubmitEditing={handleResetPassword}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowNewPw(p => !p)}>
                    <Ionicons name={showNewPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, (loading || resetCode.length < 6 || newPassword.length < 8) && styles.primaryBtnDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading || resetCode.length < 6 || newPassword.length < 8}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.primaryBtnText}>Reset Password</Text>}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <Text style={styles.mutedText}>Didn't receive a code? </Text>
                  <TouchableOpacity onPress={() => setMode('forgot-email')}>
                    <Text style={styles.accentText}>Resend</Text>
                  </TouchableOpacity>
                </View>
              </>

            ) : (
              /* ── Login ── */
              <>
                <Text style={styles.cardTitle}>Welcome back</Text>
                <Text style={styles.cardSubtitle}>Enter your credentials to access your account</Text>

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

                <View style={styles.labelRow}>
                  <Text style={styles.label}>Password</Text>
                  <TouchableOpacity onPress={() => setMode('forgot-email')}>
                    <Text style={styles.accentText}>Forgot password?</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="••••••••"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPw}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(p => !p)}>
                    <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.primaryBtnText}>Login</Text>}
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
              </>
            )}
          </View>

          {/* Switch mode */}
          {step === 'form' && mode === 'login' && (
            <View style={styles.switchRow}>
              <Text style={styles.switchPrompt}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                <Text style={styles.switchLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Trust badges */}
          {step === 'form' && mode === 'login' && (
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
          )}

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

  // Logo — stacked, centered
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

  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.lg },
  backText: { fontSize: font.xs, color: colors.textSecondary },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardTitle: { fontSize: font.lg, fontWeight: '700', color: colors.text, marginBottom: 4 },
  cardSubtitle: { fontSize: font.xs, color: colors.textSecondary, marginBottom: spacing.lg, lineHeight: 18 },
  highlight: { color: colors.text, fontWeight: '600' },

  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, marginTop: spacing.xs },
  label: { fontSize: font.xs, fontWeight: '600', color: colors.textSecondary, marginBottom: 6, marginTop: spacing.xs },

  input: {
    backgroundColor: colors.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    paddingVertical: 13, paddingHorizontal: spacing.md,
    color: colors.text, fontSize: font.sm, marginBottom: spacing.sm,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: font.lg },

  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  inputIcon: { marginLeft: spacing.md },
  passwordInput: { flex: 1, paddingVertical: 13, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.sm },
  eyeBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },

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

  resendRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: spacing.md },
  mutedText: { fontSize: font.xs, color: colors.textSecondary },
  dimText: { fontSize: font.xs, color: colors.textMuted },
  accentText: { fontSize: font.xs, color: colors.accent, fontWeight: '600' },

  switchRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  switchPrompt: { fontSize: font.sm, color: colors.textSecondary },
  switchLink: { fontSize: font.sm, color: colors.accent, fontWeight: '700' },

  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap', marginBottom: spacing.lg },
  trustChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#161a1e', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  trustText: { fontSize: font.xs, color: colors.textMuted },

  footer: { fontSize: 9, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm },
});
