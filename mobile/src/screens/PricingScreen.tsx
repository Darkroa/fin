import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, SafeAreaView,
} from 'react-native';
import { colors, spacing, radius, font, shadow } from '../theme';

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    icon: '○',
    color: colors.textSecondary,
    features: [
      '1 trading bot',
      'Basic market data',
      'Manual trading',
      '5 price alerts',
      'Community support',
    ],
    cta: 'Current Plan',
    disabled: true,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/month',
    icon: '⚡',
    color: colors.accent,
    popular: true,
    features: [
      '5 trading bots',
      'Real-time market data',
      'AI chat assistant',
      'Unlimited price alerts',
      'Priority support',
      'Portfolio analytics',
      'News feed',
    ],
    cta: 'Upgrade to Pro',
    disabled: false,
  },
  {
    name: 'Elite',
    price: '$99',
    period: '/month',
    icon: '♛',
    color: '#a78bfa',
    features: [
      'Unlimited bots',
      'Premium data feeds',
      'Advanced AI signals',
      'API access',
      'Dedicated support',
      'Custom strategies',
      'P2P priority lanes',
      'Referral rewards',
    ],
    cta: 'Upgrade to Elite',
    disabled: false,
  },
];

export default function PricingScreen() {
  const [billingAnnual, setBillingAnnual] = useState(false);
  const handleUpgrade = (plan: typeof PLANS[0]) => {
    if (plan.disabled) return;
    Alert.alert('Upgrade', `Contact support to upgrade to ${plan.name} plan.`);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <Text style={styles.title}>Plans & Pricing</Text>
        <Text style={styles.subtitle}>Choose the plan that fits your trading needs</Text>

        {/* Billing toggle */}
        <View style={styles.billingToggle}>
          <TouchableOpacity style={[styles.billingBtn, !billingAnnual && styles.billingBtnActive]} onPress={() => setBillingAnnual(false)}>
            <Text style={[styles.billingBtnText, !billingAnnual && styles.billingBtnTextActive]}>Monthly</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.billingBtn, billingAnnual && styles.billingBtnActive]} onPress={() => setBillingAnnual(true)}>
            <Text style={[styles.billingBtnText, billingAnnual && styles.billingBtnTextActive]}>
              Annual{billingAnnual ? '' : ' (save 20%)'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plan cards */}
        {PLANS.map((plan) => (
          <View key={plan.name} style={[styles.planCard, plan.popular && styles.planCardPopular]}>
            {plan.popular && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>MOST POPULAR</Text>
              </View>
            )}
            <View style={styles.planHeader}>
              <View style={[styles.planIconBox, { backgroundColor: plan.color + '22' }]}>
                <Text style={[styles.planIcon, { color: plan.color }]}>{plan.icon}</Text>
              </View>
              <View>
                <Text style={styles.planName}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  <Text style={[styles.planPrice, { color: plan.color }]}>
                    {billingAnnual && !plan.disabled
                      ? `$${Math.round(parseInt(plan.price.replace('$','')) * 0.8)}`
                      : plan.price}
                  </Text>
                  <Text style={styles.planPeriod}>{plan.period}</Text>
                </View>
              </View>
            </View>

            <View style={styles.divider} />

            {plan.features.map((feature) => (
              <View key={feature} style={styles.featureRow}>
                <Text style={[styles.featureCheck, { color: plan.color }]}>✓</Text>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[
                styles.ctaBtn,
                { backgroundColor: plan.disabled ? colors.cardAlt : plan.color },
                plan.popular && !plan.disabled && styles.ctaBtnShadow,
              ]}
              onPress={() => handleUpgrade(plan)}
              disabled={plan.disabled}
            >
              <Text style={[styles.ctaBtnText, { color: plan.disabled ? colors.textMuted : plan.name === 'Pro' ? '#000' : '#fff' }]}>
                {plan.cta}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.footerNote}>
          All plans include 256-bit encryption, 24/7 monitoring, and a 14-day money-back guarantee.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.md, paddingBottom: spacing.xl * 2 },
  title: { fontSize: font.xxl, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: spacing.xs },
  subtitle: { fontSize: font.sm, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.lg },

  billingToggle: {
    flexDirection: 'row', backgroundColor: colors.card, borderRadius: radius.lg,
    padding: 4, marginBottom: spacing.lg, borderWidth: 1, borderColor: colors.border,
  },
  billingBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.md, alignItems: 'center' },
  billingBtnActive: { backgroundColor: colors.accent },
  billingBtnText: { fontSize: font.sm, fontWeight: '600', color: colors.textSecondary },
  billingBtnTextActive: { color: '#000', fontWeight: '700' },

  planCard: {
    backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.md,
    ...shadow.card, position: 'relative',
  },
  planCardPopular: { borderColor: colors.accent, ...shadow.accent },
  popularBadge: {
    position: 'absolute', top: -12, alignSelf: 'center',
    backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4,
  },
  popularBadgeText: { color: '#000', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  planHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm, marginTop: spacing.sm },
  planIconBox: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  planIcon: { fontSize: 24 },
  planName: { fontSize: font.lg, fontWeight: '700', color: colors.text },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3, marginTop: 2 },
  planPrice: { fontSize: font.xl, fontWeight: '800' },
  planPeriod: { fontSize: font.xs, color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.md },

  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, marginBottom: 10 },
  featureCheck: { fontSize: font.sm, fontWeight: '700', lineHeight: 20 },
  featureText: { fontSize: font.sm, color: colors.textSecondary, flex: 1, lineHeight: 20 },

  ctaBtn: { borderRadius: radius.lg, paddingVertical: 15, alignItems: 'center', marginTop: spacing.md },
  ctaBtnShadow: { ...shadow.accent },
  ctaBtnText: { fontSize: font.md, fontWeight: '700' },

  footerNote: { fontSize: font.xs, color: colors.textMuted, textAlign: 'center', paddingHorizontal: spacing.md, lineHeight: 18 },
});
