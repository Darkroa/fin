import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert, SafeAreaView,
} from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { useAuth } from '../context/AuthContext';
import { signup as apiSignup } from '../lib/api';
import { colors, spacing, radius, font, shadow } from '../theme';

export default function SignupScreen({ navigation }: { navigation: any }) {
  const { login: storeToken } = useAuth();
  const [email, setEmail]         = useState('');
  const [username, setUsername]   = useState('');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [loading, setLoading]     = useState(false);

  const handleSignup = async () => {
    const e = email.trim();
    const u = username.trim();
    if (!e || !password || !confirm) { Alert.alert('Missing Fields', 'Please fill in all required fields.'); return; }
    if (!e.includes('@')) { Alert.alert('Invalid Email', 'Enter a valid email address.'); return; }
    if (password.length < 8) { Alert.alert('Weak Password', 'Password must be at least 8 characters.'); return; }
    if (password !== confirm) { Alert.alert('Password Mismatch', 'Passwords do not match.'); return; }
    setLoading(true);
    try {
      const res = await apiSignup(e, password);
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
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          {/* Background glow */}
          <View style={styles.glowLayer} pointerEvents="none">
            <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
              <Defs>
                <RadialGradient id="signupGlow" cx="50%" cy="25%" r="60%">
                  <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.12" />
                  <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
                </RadialGradient>
              </Defs>
              <Ellipse cx="50%" cy="25%" rx="80%" ry="50%" fill="url(#signupGlow)" />
            </Svg>
          </View>

          {/* Logo */}
          <View style={styles.logoArea}>
            <View style={styles.logoBox}>
              <Text style={styles.logoIcon}>⚡</Text>
            </View>
            <Text style={styles.logoText}>FinAi</Text>
          </View>

          {/* Heading */}
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Join 50,000+ traders on FinAi</Text>

          {/* Card */}
          <View style={styles.card}>
            <Text style={styles.inputLabel}>Email <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input} value={email} onChangeText={setEmail}
              placeholder="you@example.com" placeholderTextColor={colors.textMuted}
              autoCapitalize="none" keyboardType="email-address" returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Username <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input} value={username} onChangeText={setUsername}
              placeholder="trader123" placeholderTextColor={colors.textMuted}
              autoCapitalize="none" returnKeyType="next"
            />

            <Text style={styles.inputLabel}>Password <Text style={styles.required}>*</Text></Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={styles.passwordInput} value={password} onChangeText={setPassword}
                placeholder="Min 8 characters" placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPw} returnKeyType="next"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPw(p => !p)}>
                <Text style={styles.eyeIcon}>{showPw ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Confirm Password <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input} value={confirm} onChangeText={setConfirm}
              placeholder="Repeat password" placeholderTextColor={colors.textMuted}
              secureTextEntry returnKeyType="done" onSubmitEditing={handleSignup}
            />

            {/* Password strength */}
            {password.length > 0 && (
              <View style={styles.strengthRow}>
                {[...Array(4)].map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      {
                        backgroundColor:
                          password.length >= (i + 1) * 3
                            ? (password.length >= 12 ? colors.green : password.length >= 8 ? colors.accent : colors.red)
                            : colors.border
                      }
                    ]}
                  />
                ))}
                <Text style={styles.strengthLabel}>
                  {password.length < 6 ? 'Too short' : password.length < 8 ? 'Weak' : password.length < 12 ? 'Good' : 'Strong'}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.signupBtn, loading && styles.signupBtnDisabled]}
              onPress={handleSignup} disabled={loading} activeOpacity={0.88}
            >
              {loading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={styles.signupBtnText}>Create Account →</Text>}
            </TouchableOpacity>

            <Text style={styles.termsNote}>
              By signing up you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text>
              {' '}and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>.
            </Text>
          </View>

          {/* Login link */}
          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')}>
              <Text style={styles.loginLink}>Sign In</Text>
            </TouchableOpacity>
          </View>

          {/* Trust row */}
          <View style={styles.trustRow}>
            {['🔐 Encrypted', '🎁 Free to Start', '🛡️ KYC Protected'].map(item => (
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

  logoArea: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg, marginTop: spacing.sm },
  logoBox: { width: 42, height: 42, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', ...shadow.accent },
  logoIcon: { fontSize: 20, color: '#000' },
  logoText: { fontSize: font.xl, fontWeight: '800', color: colors.text },

  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.lg },

  card: { backgroundColor: colors.card, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, marginBottom: spacing.lg, ...shadow.card },
  inputLabel: { fontSize: font.sm, fontWeight: '500', color: colors.textSecondary, marginBottom: spacing.xs, marginTop: spacing.xs },
  required: { color: colors.red },
  optional: { color: colors.textMuted, fontWeight: '400' },
  input: { backgroundColor: colors.cardAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md, marginBottom: spacing.sm },
  passwordRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardAlt, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  passwordInput: { flex: 1, paddingVertical: 14, paddingHorizontal: spacing.md, color: colors.text, fontSize: font.md },
  eyeBtn: { paddingRight: spacing.md, paddingVertical: spacing.sm },
  eyeIcon: { fontSize: 16 },

  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  strengthBar: { flex: 1, height: 3, borderRadius: 2 },
  strengthLabel: { fontSize: font.xs, color: colors.textMuted, minWidth: 48 },

  signupBtn: { backgroundColor: colors.accent, borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: spacing.sm, ...shadow.accent },
  signupBtnDisabled: { opacity: 0.6 },
  signupBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
  termsNote: { fontSize: font.xs, color: colors.textMuted, textAlign: 'center', marginTop: spacing.sm, lineHeight: 18 },
  termsLink: { color: colors.accent },

  loginRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: spacing.lg },
  loginPrompt: { fontSize: font.sm, color: colors.textSecondary },
  loginLink: { fontSize: font.sm, color: colors.accent, fontWeight: '700' },

  trustRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  trustChip: { backgroundColor: colors.card, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: colors.border },
  trustText: { fontSize: font.xs, color: colors.textMuted },
});
