import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { login as apiLogin, verify2fa } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

export default function LoginScreen({ navigation }: { navigation: any }) {
  const { login: storeToken } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);

  // 2FA state
  const [step, setStep]             = useState<'credentials' | '2fa'>('credentials');
  const [twoFaCode, setTwoFaCode]   = useState('');
  const [partialToken, setPartialToken] = useState('');

  const handleLogin = async () => {
    const e = email.trim();
    if (!e || !password) { Alert.alert('Missing Fields', 'Please enter your email and password.'); return; }
    setLoading(true);
    try {
      const res = await apiLogin(e, password);
      const data = res.data;
      if (data.requires_2fa && data.partial_token) {
        // Need 2FA
        setPartialToken(data.partial_token);
        setStep('2fa');
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

  const handle2fa = async () => {
    if (!twoFaCode.trim()) { Alert.alert('Error', 'Enter your 2FA code.'); return; }
    setLoading(true);
    try {
      const res = await verify2fa(partialToken, twoFaCode.trim());
      const data = res.data;
      if (data.access_token) {
        await storeToken(data.access_token);
      } else {
        Alert.alert('Error', 'Invalid 2FA code.');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.detail ?? 'Invalid 2FA code.';
      Alert.alert('2FA Failed', msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Background glow */}
          <View style={styles.glowLayer} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="loginGlow" cx="50%" cy="30%" r="60%">
                  <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.12" />
                  <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="30%" rx="80%" ry="50%" fill="url(#loginGlow)" />
            </Svg>
          </View>

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
            <Text style={styles.logoText}>FinAi</Text>
          </View>

          {step === 'credentials' ? (
            <>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to your trading account</Text>

              <View style={styles.card}>
                <Text style={styles.inputLabel}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email} onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none" keyboardType="email-address"
                  returnKeyType="next" autoCorrect={false}
                />

                <Text style={styles.inputLabel}>Password</Text>
                <View style={styles.passwordRow}>
                  <TextInput
                    style={styles.passwordInput}
                    value={password} onChangeText={setPassword}
                    placeholder="Your password"
                    placeholderTextColor={colors.textMuted}
                    secureTextEntry={!showPw}
                    returnKeyType="done"
                    onSubmitEditing={handleLogin}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(p => !p)}>
                    <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.forgotRow}>
                  <Text style={styles.forgotText}>Forgot password?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handleLogin} disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.loginBtnText}>Sign In</Text>}
                </TouchableOpacity>
              </View>

              <View style={styles.signupRow}>
                <Text style={styles.signupPrompt}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
                  <Text style={styles.signupLink}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.title}>Two-Factor Auth</Text>
              <Text style={styles.subtitle}>Enter the code sent to your email</Text>

              <View style={styles.card}>
                <View style={styles.twoFaIconBox}>
                  <Text style={styles.twoFaIcon}>🔐</Text>
                </View>
                <Text style={styles.inputLabel}>Verification Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={twoFaCode} onChangeText={setTwoFaCode}
                  placeholder="000000"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  maxLength={8}
                  returnKeyType="done"
                  onSubmitEditing={handle2fa}
                />
                <TouchableOpacity
                  style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
                  onPress={handle2fa} disabled={loading}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={styles.loginBtnText}>Verify →</Text>}
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setStep('credentials')} style={{ marginTop: spacing.sm, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, fontSize: font.sm }}>← Back to login</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Trust row */}
          <View style={styles.trustRow}>
            {['🔐 Encrypted', '⚡ Instant Access', '🛡️ Secure'].map(item => (
              <View key={item} style={styles.trustChip}>
                <Text style={styles.trustText}>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xl * 2, flexGrow: 1 },
  glowLayer: { position: 'absolute', top: 0, left: 0, right: 0, height: 400 },

  logoArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xl, marginTop: spacing.sm },
  logoBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.accent,
  },
  logoIcon: { fontSize: 20, color: '#000' },
  logoText: { fontSize: font.xl, fontWeight: '800', color: colors.text },

  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xl },

  card: {
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card,
  },
  inputLabel: { fontSize: font.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.xs },
  input: {
    backgroundColor: colors.cardAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md, marginBottom: spacing.sm,
  },
  codeInput: { textAlign: 'center', letterSpacing: 4, fontSize: font.lg },
  passwordRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.cardAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm,
  },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md },
  eyeBtn: { paddingRight: spacing.md, paddingVertical: spacing.sm },
  eyeIcon: { fontSize: 16 },
  forgotRow: { alignItems: 'flex-end', marginBottom: spacing.md },
  forgotText: { fontSize: font.sm, color: colors.accent, fontWeight: '500' },
  loginBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', ...shadow.accent },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },

  twoFaIconBox: { alignItems: 'center', marginBottom: spacing.md },
  twoFaIcon: { fontSize: 48 },

  signupRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  signupPrompt: { fontSize: font.sm, color: colors.textSecondary },
  signupLink: { fontSize: font.sm, color: colors.accent, fontWeight: '700' },

  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  trustChip: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  trustText: { fontSize: font.xs, color: colors.textMuted },
});
