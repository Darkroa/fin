import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { colors, spacing, radius, font } from '../theme';
import { getPricingPlans } from '../lib/api';

const FALLBACK_PLANS = [
  {
    name: 'Free',
    price: 0,
    period: 'Forever free',
    tier: 0,
    highlight: false,
    features: ['1 Trading Bot', '1 API Key', '$500/day limit', 'Basic market data', 'Email alerts'],
  },
  {
    name: 'Pro',
    price: 500,
    period: '/month',
    tier: 2,
    highlight: true,
    features: ['10 Trading Bots', 'FinEventAI Bots', '5 API Keys', '$5,000/day limit', 'All alert channels', 'Priority support'],
  },
  {
    name: 'Elite',
    price: 1500,
    period: '/month',
    tier: 3,
    highlight: false,
    features: ['Unlimited Bots', 'Unlimited withdrawals', 'Custom strategies', 'Dedicated support', 'White-glove onboarding'],
  },
];

export default function PricingScreen({ navigation }: { navigation: any }) {
  const { user } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const userTier = user?.tier ?? 0;

  const loadPlans = useCallback(async () => {
    try {
      const res = await getPricingPlans();
      const raw = res?.data;
      const list = Array.isArray(raw) ? raw : Array.isArray(raw?.results) ? raw.results : [];
      setPlans(list.length > 0 ? list : FALLBACK_PLANS);
    } catch (_) {
      setPlans(FALLBACK_PLANS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlans();
  }, [loadPlans]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Plans & Pricing</Text>
        <Text style={styles.headerSub}>Choose the plan that's right for you</Text>
      </View>

      {/* Plan Cards */}
      {(Array.isArray(plans) ? plans : []).map((plan, idx) => {
        const isCurrent = userTier >= plan.tier;
        const isHighlight = plan.highlight === true;

        return (
          <View
            key={plan.name ?? idx}
            style={[
              styles.planCard,
              isHighlight && styles.planCardHighlight,
            ]}
          >
            {/* Most Popular Badge */}
            {isHighlight && (
              <View style={styles.popularBadge}>
                <Text style={styles.popularBadgeText}>Most Popular</Text>
              </View>
            )}

            {/* Plan Name + Price */}
            <Text style={styles.planName}>{plan.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.planPrice}>
                {plan.price === 0 ? 'Free' : `$${plan.price}`}
              </Text>
              {plan.price > 0 && (
                <Text style={styles.planPeriod}>{plan.period}</Text>
              )}
            </View>
            {plan.price === 0 && (
              <Text style={styles.planPeriodFree}>{plan.period}</Text>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Features */}
            {(Array.isArray(plan.features) ? plan.features : []).map((feat: string, fi: number) => (
              <View key={fi} style={styles.featureRow}>
                <Text style={styles.checkmark}>✓</Text>
                <Text style={styles.featureText}>{feat}</Text>
              </View>
            ))}

            {/* CTA Button */}
            <TouchableOpacity
              style={[
                styles.ctaBtn,
                isCurrent ? styles.ctaBtnCurrent : isHighlight ? styles.ctaBtnHighlight : styles.ctaBtnDefault,
              ]}
              disabled={isCurrent}
              onPress={() =>
                Alert.alert(
                  `Upgrade to ${plan.name}`,
                  'Contact support@finai.com to upgrade your plan.'
                )
              }
            >
              <Text
                style={[
                  styles.ctaBtnText,
                  isCurrent ? styles.ctaBtnTextCurrent : styles.ctaBtnTextDefault,
                ]}
              >
                {isCurrent ? 'Current Plan' : 'Upgrade'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {/* Footer */}
      <Text style={styles.footer}>Prices in USDT · Billed monthly</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: spacing.xl * 2,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  headerSub: {
    fontSize: font.sm,
    color: colors.textSecondary,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  planCardHighlight: {
    borderColor: colors.accent,
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  popularBadgeText: {
    fontSize: font.xs,
    fontWeight: '700',
    color: colors.bg,
  },
  planName: {
    fontSize: font.xl,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.xs,
  },
  planPrice: {
    fontSize: font.xxl,
    fontWeight: '700',
    color: colors.accent,
  },
  planPeriod: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginBottom: 4,
    marginLeft: 4,
  },
  planPeriodFree: {
    fontSize: font.sm,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  checkmark: {
    color: colors.green,
    fontSize: font.md,
    fontWeight: '700',
    marginRight: spacing.sm,
    width: 18,
  },
  featureText: {
    fontSize: font.sm,
    color: colors.text,
    flex: 1,
  },
  ctaBtn: {
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  ctaBtnDefault: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ctaBtnHighlight: {
    backgroundColor: colors.accent,
  },
  ctaBtnCurrent: {
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    opacity: 0.6,
  },
  ctaBtnText: {
    fontSize: font.md,
    fontWeight: '700',
  },
  ctaBtnTextDefault: {
    color: colors.text,
  },
  ctaBtnTextCurrent: {
    color: colors.textMuted,
  },
  footer: {
    textAlign: 'center',
    fontSize: font.xs,
    color: colors.textMuted,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
});
