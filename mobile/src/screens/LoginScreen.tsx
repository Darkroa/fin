import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={styles.logoRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.logoText}>FinAi</Text>
        </View>

        <Text style={styles.title}>
          {twoFaRequired ? 'Two-Factor Auth' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          {twoFaRequired
            ? 'Enter the code sent to your email or authenticator app.'
            : 'Sign in to your trading account'}
        </Text>

        {!twoFaRequired ? (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
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
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.linkRow}>
              <Text style={styles.linkText}>Don't have an account? </Text>
              <Text style={[styles.linkText, styles.linkAccent]}>Sign Up</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Verification Code</Text>
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
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={handle2FA}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.btnText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTwoFaRequired(false)} style={styles.linkRow}>
              <Text style={[styles.linkText, styles.linkAccent]}>← Back to login</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  inner: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xl, gap: spacing.sm },
  logoBox: {
    width: 44, height: 44, borderRadius: radius.sm,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { fontSize: 22 },
  logoText: { fontSize: font.xxl, fontWeight: '700', color: colors.text },
  title: { fontSize: font.xl, fontWeight: '700', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.lg },
  inputGroup: { marginBottom: spacing.md },
  label: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },
  input: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, padding: spacing.md, color: colors.text, fontSize: font.md,
  },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontSize: font.xl },
  btn: {
    backgroundColor: colors.accent, borderRadius: radius.md,
    padding: spacing.md, alignItems: 'center', marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: colors.bg, fontWeight: '700', fontSize: font.md },
  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
  linkText: { color: colors.textSecondary, fontSize: font.sm },
  linkAccent: { color: colors.accent, fontWeight: '600' },
});
