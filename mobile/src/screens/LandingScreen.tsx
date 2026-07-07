import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, Dimensions, SafeAreaView,
} from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { colors, spacing, radius, font, shadow } from '../theme';

const { width } = Dimensions.get('window');

const FEATURES = [
  { icon: '🤖', title: 'AI Trading Bots',    desc: 'Automated 24/7 strategies that adapt to live markets.' },
  { icon: '⚡', title: 'Instant Execution',   desc: 'Lightning-fast order routing with 1–25x leverage.' },
  { icon: '📈', title: 'Live Market Data',    desc: 'Real-time crypto, stocks, and forex price feeds.' },
  { icon: '🛡️', title: 'Secure & Insured',   desc: '256-bit encryption and multi-layer fund protection.' },
];

const STATS = [
  { value: '$2.4B+', label: 'Volume Traded' },
  { value: '50K+',   label: 'Active Traders' },
  { value: '98.9%',  label: 'Uptime' },
];

export default function LandingScreen({ navigation }: { navigation: any }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Background glow */}
        <View style={styles.glowContainer} pointerEvents="none">
          <Svg width={width} height={400} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="glow1" cx="50%" cy="40%" r="60%">
                <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.15" />
                <Stop offset="70%"  stopColor="#F0B90B" stopOpacity="0.03" />
                <Stop offset="100%" stopColor={colors.bg} stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Ellipse cx="50%" cy="40%" rx="70%" ry="50%" fill="url(#glow1)" />
          </Svg>
        </View>

        {/* Logo + Brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.logoText}>FinAi</Text>
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <View style={styles.heroBadgeDot} />
            <Text style={styles.heroBadgeText}>AI-Powered Trading Platform</Text>
          </View>
          <Text style={styles.heroTitle}>
            Trade Smarter,{'\n'}
            <Text style={styles.heroTitleAccent}>Earn More</Text>
          </Text>
          <Text style={styles.heroSub}>
            Combine algorithmic bots, real-time AI signals, and advanced analytics — all in one platform.
          </Text>
        </View>

        {/* CTA Buttons */}
        <View style={styles.ctaRow}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Signup')} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Get Started Free →</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
            <Text style={styles.ghostBtnText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {STATS.map((s, i) => (
            <View key={s.label} style={[styles.statItem, i > 0 && styles.statItemBorder]}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Features */}
        <Text style={styles.sectionHeader}>WHY FINAI</Text>
        <View style={styles.featuresGrid}>
          {FEATURES.map(f => (
            <View key={f.title} style={styles.featureCard}>
              <View style={styles.featureIconBox}>
                <Text style={styles.featureIcon}>{f.icon}</Text>
              </View>
              <Text style={styles.featureTitle}>{f.title}</Text>
              <Text style={styles.featureDesc}>{f.desc}</Text>
            </View>
          ))}
        </View>

        {/* Bottom CTA */}
        <View style={styles.bottomCta}>
          <Text style={styles.bottomCtaTitle}>Ready to start trading?</Text>
          <Text style={styles.bottomCtaSubtitle}>Join 50,000+ traders using FinAi</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => navigation.navigate('Signup')} activeOpacity={0.88}>
            <Text style={styles.primaryBtnText}>Create Free Account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          Trading involves risk. Only invest what you can afford to lose. FinAi is not a registered investment advisor.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xl * 2 },

  glowContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: 400 },

  // Brand
  brandRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md, gap: spacing.sm },
  logoBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    ...shadow.accent,
  },
  logoIcon: { fontSize: 18, color: '#000' },
  logoText: { fontSize: font.xl, fontWeight: '800', color: colors.text },

  // Hero
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.lg, alignItems: 'center' },
  heroBadge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    backgroundColor: colors.accentMuted, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: spacing.md,
    borderWidth: 1, borderColor: colors.accent + '40',
  },
  heroBadgeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent },
  heroBadgeText: { fontSize: font.xs, color: colors.accent, fontWeight: '600' },
  heroTitle: { fontSize: 36, fontWeight: '800', color: colors.text, textAlign: 'center', lineHeight: 44, marginBottom: spacing.md },
  heroTitleAccent: { color: colors.accent },
  heroSub: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, paddingHorizontal: spacing.sm },

  // CTA
  ctaRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, marginBottom: spacing.lg },
  primaryBtn: {
    backgroundColor: colors.accent, borderRadius: radius.xl, paddingVertical: 16,
    alignItems: 'center', ...shadow.accent,
  },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: font.md },
  ghostBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl,
    paddingVertical: 16, alignItems: 'center',
  },
  ghostBtnText: { color: colors.text, fontWeight: '600', fontSize: font.md },

  // Stats
  statsRow: {
    flexDirection: 'row', marginHorizontal: spacing.lg, marginBottom: spacing.xl,
    backgroundColor: colors.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, ...shadow.card,
  },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: spacing.md },
  statItemBorder: { borderLeftWidth: 1, borderLeftColor: colors.border },
  statValue: { fontSize: font.lg, fontWeight: '800', color: colors.accent, marginBottom: 3 },
  statLabel: { fontSize: font.xs, color: colors.textSecondary },

  // Features
  sectionHeader: {
    fontSize: font.xs, fontWeight: '600', color: colors.textSecondary,
    letterSpacing: 0.8, textTransform: 'uppercase',
    textAlign: 'center', marginBottom: spacing.md,
  },
  featuresGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.md, gap: spacing.sm, marginBottom: spacing.xl },
  featureCard: {
    width: '47%', backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, padding: spacing.md, ...shadow.card,
  },
  featureIconBox: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  featureIcon: { fontSize: 18 },
  featureTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: 5 },
  featureDesc: { fontSize: font.xs, color: colors.textSecondary, lineHeight: 17 },

  // Bottom CTA
  bottomCta: {
    backgroundColor: colors.card, marginHorizontal: spacing.md,
    borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg,
    ...shadow.card,
  },
  bottomCtaTitle: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  bottomCtaSubtitle: { fontSize: font.sm, color: colors.textSecondary, marginBottom: spacing.xs },

  disclaimer: { fontSize: 10, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.xl, lineHeight: 16, marginTop: spacing.sm },
});
