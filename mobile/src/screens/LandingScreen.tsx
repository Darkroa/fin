import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
  StatusBar,
} from 'react-native';
import { Svg, Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, font, radius, spacing } from '../theme';

const { width, height } = Dimensions.get('window');

type Props = { navigation: NativeStackNavigationProp<any> };

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
      <StatusBar barStyle="light-content" backgroundColor="#06080B" />

      {/* ── Glow background ── */}
      <View style={styles.glowContainer} pointerEvents="none">
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            {/* Deep orange-red core glow */}
            <RadialGradient id="glow1" cx="50%" cy="52%" r="50%">
              <Stop offset="0%"   stopColor="#FF4500" stopOpacity="0.55" />
              <Stop offset="35%"  stopColor="#C03000" stopOpacity="0.30" />
              <Stop offset="65%"  stopColor="#7A1500" stopOpacity="0.12" />
              <Stop offset="100%" stopColor="#06080B" stopOpacity="0"   />
            </RadialGradient>
            {/* Amber upper accent */}
            <RadialGradient id="glow2" cx="50%" cy="42%" r="40%">
              <Stop offset="0%"   stopColor="#FF6A00" stopOpacity="0.35" />
              <Stop offset="60%"  stopColor="#CC4400" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#06080B" stopOpacity="0"   />
            </RadialGradient>
          </Defs>
          <Ellipse cx={width / 2} cy={height * 0.52} rx={width * 0.75} ry={height * 0.45}
            fill="url(#glow1)" />
          <Ellipse cx={width / 2} cy={height * 0.42} rx={width * 0.55} ry={height * 0.32}
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
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>

        {/* Logo mark */}
        <View style={styles.logoWrap}>
          <View style={styles.logoBox}>
            <Text style={styles.logoIcon}>⚡</Text>
          </View>
          <Text style={styles.logoLabel}>FinAi</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>
          Step Into the{'\n'}Future of{'\n'}AI Trading
        </Text>

        {/* Tagline */}
        <Text style={styles.tagline}>
          AI-powered signals · automated bots · real-time markets
        </Text>

        {/* Get Started CTA */}
        <TouchableOpacity
          style={styles.ctaBtn}
          activeOpacity={0.82}
          onPress={() => navigation.navigate('Login')}
        >
          <Text style={styles.ctaText}>Get Started  →</Text>
        </TouchableOpacity>

        {/* Already have account */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.signInRow}
        >
          <Text style={styles.signInText}>Already have an account? </Text>
          <Text style={[styles.signInText, styles.signInAccent]}>Sign In</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const RING_BASE = width * 1.1;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#06080B',
    alignItems: 'center',
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
    borderColor: 'rgba(200, 60, 0, 0.18)',
    top: height * 0.52 - RING_BASE / 2,
  },
  ringInner: {
    width: RING_BASE * 0.62,
    height: RING_BASE * 0.62,
    borderColor: 'rgba(255, 90, 0, 0.28)',
    top: height * 0.52 - (RING_BASE * 0.62) / 2,
  },

  /* ── Content ── */
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg * 1.5,
    paddingBottom: 48,
  },

  /* Logo */
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl * 1.5,
  },
  logoBox: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: '#F0B90B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIcon: { fontSize: 20 },
  logoLabel: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: 0.5,
  },

  /* Headline */
  headline: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: spacing.md,
  },

  /* Tagline */
  tagline: {
    fontSize: font.sm,
    color: 'rgba(200,200,210,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.xl * 1.8,
    letterSpacing: 0.2,
  },

  /* CTA button */
  ctaBtn: {
    backgroundColor: '#E85D00',
    borderRadius: radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 52,
    shadowColor: '#FF4500',
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
    marginBottom: spacing.xl,
  },
  ctaText: {
    color: '#FFFFFF',
    fontSize: font.md + 1,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  /* Sign in link */
  signInRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  signInText: {
    fontSize: font.sm,
    color: 'rgba(180,185,195,0.55)',
  },
  signInAccent: {
    color: '#F0B90B',
    fontWeight: '600',
  },
});
