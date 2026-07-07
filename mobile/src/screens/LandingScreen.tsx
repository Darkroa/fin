import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, radius, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<any> };

const FEATURES = [
  {
    icon: '⚡',
    title: 'AI-Powered Signals',
    subtitle: 'Real-time market intelligence',
    color: colors.accent,
  },
  {
    icon: '📊',
    title: 'Live Markets',
    subtitle: 'Track 1000+ assets globally',
    color: '#3B82F6',
  },
  {
    icon: '🔒',
    title: 'Secure Wallet',
    subtitle: 'Bank-grade security',
    color: colors.green,
  },
];

export default function LandingScreen({ navigation }: Props) {
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const fadeIn  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 900,
      useNativeDriver: true,
    }).start();

    // Slow pulse for outer ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse1, { toValue: 1.08, duration: 2800, useNativeDriver: true }),
        Animated.timing(pulse1, { toValue: 1,    duration: 2800, useNativeDriver: true }),
      ])
    ).start();

    // Offset pulse for inner ring
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse2, { toValue: 1.12, duration: 2200, useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1,    duration: 2200, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* ── Glow background ── */}
      <View style={styles.glowContainer} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glow1" cx="50%" cy="52%" r="50%">
              <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.18" />
              <Stop offset="40%"  stopColor="#C89B09" stopOpacity="0.08" />
              <Stop offset="100%" stopColor={colors.bg} stopOpacity="0"   />
            </RadialGradient>
            <RadialGradient id="glow2" cx="50%" cy="38%" r="35%">
              <Stop offset="0%"   stopColor="#F0B90B" stopOpacity="0.10" />
              <Stop offset="100%" stopColor={colors.bg} stopOpacity="0"   />
            </RadialGradient>
          </Defs>
          <Ellipse cx={width / 2} cy={height * 0.45} rx={width * 0.70} ry={height * 0.40}
            fill="url(#glow1)" />
          <Ellipse cx={width / 2} cy={height * 0.35} rx={width * 0.45} ry={height * 0.25}
            fill="url(#glow2)" />
        </Svg>

        {/* Animated outer ring */}
        <Animated.View
          style={[styles.ring, styles.ringOuter, { transform: [{ scale: pulse1 }] }]}
        />
        {/* Animated inner ring */}
        <Animated.View
          style={[styles.ring, styles.ringInner, { transform: [{ scale: pulse2 }] }]}
        />
      </View>

      {/* ── Content ── */}
      <SafeAreaView style={styles.safe}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={[styles.content, { opacity: fadeIn }]}>

            {/* Logo */}
            <View style={styles.logoSection}>
              <View style={styles.logoBox}>
                <Text style={styles.logoIcon}>⚡</Text>
              </View>
              <Text style={styles.logoText}>FinAi</Text>
              <Text style={styles.logoSub}>Your AI Trading Partner</Text>
            </View>

            {/* Feature cards */}
            <View style={styles.featuresContainer}>
              {FEATURES.map((f, i) => (
                <View key={i} style={styles.featureCard}>
                  <View style={[styles.featureIconBox, { backgroundColor: f.color + '26' }]}>
                    <Text style={styles.featureIconText}>{f.icon}</Text>
                  </View>
                  <View style={styles.featureTextWrap}>
                    <Text style={styles.featureTitle}>{f.title}</Text>
                    <Text style={styles.featureSubtitle}>{f.subtitle}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Get Started CTA */}
            <TouchableOpacity
              style={styles.ctaBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Signup')}
            >
              <Text style={styles.ctaText}>Get Started</Text>
            </TouchableOpacity>

            {/* Sign in link */}
            <View style={styles.signInRow}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.signInAccent}>Sign In</Text>
              </TouchableOpacity>
            </View>

          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const RING_BASE = width * 1.05;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safe: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },

  /* ── Glow layer ── */
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 1,
    alignSelf: 'center',
  },
  ringOuter: {
    width: RING_BASE,
    height: RING_BASE,
    borderColor: 'rgba(240, 185, 11, 0.10)',
    top: height * 0.45 - RING_BASE / 2,
  },
  ringInner: {
    width: RING_BASE * 0.60,
    height: RING_BASE * 0.60,
    borderColor: 'rgba(240, 185, 11, 0.16)',
    top: height * 0.45 - (RING_BASE * 0.60) / 2,
  },

  /* ── Content ── */
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    alignItems: 'center',
  },

  /* ── Logo ── */
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoBox: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  logoIcon: { fontSize: 40 },
  logoText: {
    fontSize: 38,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  logoSub: {
    fontSize: font.sm,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  /* ── Feature cards ── */
  featuresContainer: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  featureIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureIconText: { fontSize: 20 },
  featureTextWrap: { flex: 1 },
  featureTitle: {
    fontSize: font.md,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  featureSubtitle: {
    fontSize: font.xs,
    color: colors.textSecondary,
  },

  /* ── CTA button ── */
  ctaBtn: {
    width: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  ctaText: {
    color: '#000',
    fontSize: font.md,
    fontWeight: '700',
  },

  /* ── Sign in link ── */
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInText: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  signInAccent: {
    fontSize: font.sm,
    color: colors.accent,
    fontWeight: '600',
  },
});
