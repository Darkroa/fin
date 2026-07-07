import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
  SafeAreaView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { login, verify2fa } from '../lib/api';
import { colors, spacing, radius, font } from '../theme';

type Props = { navigation: NativeStackNavigationProp<any> };

export default function LoginScreen({ navigation }: Props) {
  const { login: doLogin } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // 2FA state
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [partialToken, setPartialToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      const data = res.data;
      if (data.requires_2fa) {
        setPartialToken(data.partial_token);
        setTwoFaRequired(true);
      } else {
        await doLogin(data.access_token);
      }
    } catch (err: any) {
      Alert.alert('Login Failed', err?.response?.data?.detail ?? 'Invalid credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handle2FA = async () => {
    if (!twoFaCode.trim()) return;
    setLoading(true);
    try {
      const res = await verify2fa(partialToken, twoFaCode.trim());
      await doLogin(res.data.access_token);
    } catch (err: any) {
      Alert.alert('Invalid Code', err?.response?.data?.detail ?? 'Wrong 2FA code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.kav}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Logo section ── */}
          <View style={styles.logoSection}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
            <Text style={styles.logoText}>FinAi</Text>
            <Text style={styles.logoSub}>AI-Powered Trading Platform</Text>
          </View>

          {/* ── Card ── */}
          <View style={styles.card}>
            {twoFaRequired ? (
              <>
                {/* Back link */}
                <TouchableOpacity onPress={() => setTwoFaRequired(false)} style={styles.backRow}>
                  <Text style={styles.backLink}>← Back to login</Text>
                </TouchableOpacity>

                <Text style={styles.cardTitle}>Two-Factor Auth</Text>
                <Text style={styles.cardSubtitle}>
                  Enter the 6-digit code from your authenticator app or email.
                </Text>

                {/* 2FA code input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>VERIFICATION CODE</Text>
                  <TextInput
                    style={[styles.input, styles.codeInput]}
                    placeholder="000000"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="number-pad"
                    maxLength={6}
                    value={twoFaCode}
                    onChangeText={setTwoFaCode}
                    autoFocus
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handle2FA}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.primaryBtnText}>Verify</Text>}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendRow}>
                  <Text style={styles.resendText}>Didn't get a code? </Text>
                  <Text style={styles.accentLink}>Resend</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Welcome back</Text>
                <Text style={styles.cardSubtitle}>Sign in to your trading account</Text>

                {/* Email */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="you@example.com"
                    placeholderTextColor={colors.textMuted}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                {/* Password */}
                <View style={styles.inputGroup}>
                  <View style={styles.passwordLabelRow}>
                    <Text style={styles.inputLabel}>PASSWORD</Text>
                    <TouchableOpacity>
                      <Text style={styles.forgotLink}>Forgot password?</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={[styles.input, styles.inputWithToggle]}
                      placeholder="••••••••"
                      placeholderTextColor={colors.textMuted}
                      secureTextEntry={!showPw}
                      value={password}
                      onChangeText={setPassword}
                      onSubmitEditing={handleLogin}
                    />
                    <TouchableOpacity
                      style={styles.eyeBtn}
                      onPress={() => setShowPw(v => !v)}
                    >
                      <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Sign In button */}
                <TouchableOpacity
                  style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.primaryBtnText}>Sign In</Text>}
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                  <View style={styles.dividerLine} />
                </View>

                {/* Social buttons */}
                <View style={styles.socialRow}>
                  <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.75}>
                    <Text style={styles.ghostBtnText}>🌐  Google</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.ghostBtn} activeOpacity={0.75}>
                    <Text style={styles.ghostBtnText}>🍎  Apple</Text>
                  </TouchableOpacity>
                </View>

                {/* Sign up link */}
                <TouchableOpacity
                  onPress={() => navigation.navigate('Signup')}
                  style={styles.linkRow}
                >
                  <Text style={styles.linkText}>Don't have an account? </Text>
                  <Text style={styles.accentLink}>Sign up</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  kav: {
    flex: 1,
  },
  inner: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },

  /* ── Logo ── */
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: { fontSize: 36 },
  logoText: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  logoSub: {
    fontSize: font.xs,
    color: colors.textSecondary,
    letterSpacing: 0.4,
  },

  /* ── Card ── */
  card: {
    width: '100%',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  cardTitle: {
    fontSize: font.lg,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  cardSubtitle: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 19,
  },

  /* ── Back link ── */
  backRow: {
    marginBottom: spacing.md,
  },
  backLink: {
    fontSize: font.sm,
    color: colors.accent,
    fontWeight: '600',
  },

  /* ── Inputs ── */
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  forgotLink: {
    fontSize: font.xs,
    color: colors.accent,
    fontWeight: '600',
  },
  inputWrapper: {
    position: 'relative',
  },
  input: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    color: colors.text,
    fontSize: font.md,
  },
  inputWithToggle: {
    paddingRight: 50,
  },
  eyeBtn: {
    position: 'absolute',
    right: spacing.md,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  eyeIcon: {
    fontSize: 16,
  },
  codeInput: {
    letterSpacing: 10,
    textAlign: 'center',
    fontSize: font.xl,
    fontVariant: ['tabular-nums'],
  },

  /* ── Primary button ── */
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: {
    color: '#000',
    fontWeight: '700',
    fontSize: font.md,
  },

  /* ── Divider ── */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: font.xs,
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  /* ── Social buttons ── */
  socialRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  ghostBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ghostBtnText: {
    color: colors.textSecondary,
    fontSize: font.sm,
    fontWeight: '600',
  },

  /* ── Bottom links ── */
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkText: {
    color: colors.textSecondary,
    fontSize: font.sm,
  },
  accentLink: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: font.sm,
  },
  resendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  resendText: {
    color: colors.textSecondary,
    fontSize: font.sm,
  },
});
