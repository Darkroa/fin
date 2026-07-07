import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, SafeAreaView, StatusBar, FlatList, NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { colors, spacing, radius, font, shadow } from '../theme';

const { width: W, height: H } = Dimensions.get('window');

/* ─── Slide data ─────────────────────────────────────────── */
const SLIDES = [
  {
    id: 'hero',
    badge: '● PLATFORM LIVE',
    badgeColor: '#0ECB81',
    topTag: 'TRUSTED BY ELITE TRADERS',
    title: 'Where ',
    titleAccent: 'Intelligence',
    titleRest: '\nMeets Capital.',
    sub: 'AI trading engine + community of ambitious traders.\nCrypto, stocks & forex — all in one platform.',
    btnLabel: 'Join FinAi Today →',
    stats: [
      { value: '50K+', label: 'Active traders worldwide' },
      { value: '$2.4B+', label: 'Volume processed' },
      { value: '6', label: 'Major exchanges connected' },
    ],
  },
  {
    id: 'finbot',
    badge: '● BOT LIVE',
    badgeColor: '#0ECB81',
    topTag: 'AUTOMATED TRADING BOT',
    topTagColor: '#0ECB81',
    title: 'Meet ',
    titleAccent: 'FinBot.',
    titleRest: '',
    sub: 'Your AI trader that never stops — executing with machine precision.',
    btnLabel: '🤖 Activate FinBot →',
    grid: [
      { value: '94.2%', label: 'Accuracy' },
      { value: '87%', label: 'Win rate' },
      { value: '<12ms', label: 'Speed' },
      { value: '24/7', label: 'Active' },
    ],
    features: [
      { icon: '🧠', color: '#a78bfa', title: 'Neural Strategy', desc: 'Self-learning model on 10yrs of market data' },
      { icon: '⚡', color: colors.accent, title: 'Sub-12ms Execution', desc: 'Catches every micro-move, every time' },
      { icon: '🔄', color: '#3b82f6', title: '24/7 Auto-Trading', desc: 'Runs while you sleep, eat, and live' },
      { icon: '🛡️', color: '#0ECB81', title: 'Risk Guard', desc: 'Auto stop-loss, drawdown limits built in' },
    ],
  },
  {
    id: 'partners',
    badge: '🌐 GLOBAL',
    badgeColor: '#0ECB81',
    topTag: 'TRUSTED & INTEGRATED PARTNERS',
    title: 'Powered by\n',
    titleAccent: "the World's Best.",
    titleRest: '',
    sub: "Built on infrastructure trusted by the world's leading institutions.",
    btnLabel: 'Join the Platform →',
    partners: ['AWS', 'ANTHROPIC', 'APPLE', 'BROADCOM', 'CISCO', 'CROWDSTRIKE', 'GOOGLE', 'JPMORGAN', 'LINUX', 'MICROSOFT', 'NVIDIA', 'PALO ALTO'],
    partnerStats: [
      { value: '12+', label: 'Partners' },
      { value: '99.9%', label: 'Uptime' },
      { value: 'SOC 2', label: 'Certified' },
      { value: '150+', label: 'Countries' },
    ],
    trustBadges: ['✓ ISO 27001', '✓ SOC 2 Type II', '✓ GDPR Ready'],
  },
  {
    id: 'tiers',
    badge: '👑 VIP ACCESS',
    badgeColor: colors.accent,
    topTag: 'ACCOUNT TIERS',
    title: 'Unlock Your\n',
    titleAccent: 'Elite Status.',
    titleRest: '',
    sub: 'Your tier defines your power. Higher tiers unlock premium tools and a dedicated VIP team.',
    btnLabel: 'Start KYC Verification →',
    tiers: [
      {
        num: 1, name: 'Verified', perks: ['$500/day', '1 API key', 'Standard support'],
        note: 'KYC approved', borderColor: colors.border, nameColor: colors.text,
      },
      {
        num: 2, name: 'Advanced', perks: ['$5,000/day', '5 API keys', 'Priority support'],
        note: 'Admin elevated', borderColor: '#0ECB81', nameColor: '#0ECB81',
      },
      {
        num: 3, name: 'Elite', perks: ['Unlimited', 'Unlimited keys', 'VIP concierge'],
        note: 'Invitation only', borderColor: colors.accent, nameColor: colors.accent,
        topBadge: '★ TOP',
      },
    ],
  },
] as const;

/* ─── Sub-components ─────────────────────────────────────── */
function SlideHero({ slide, onPress }: { slide: typeof SLIDES[0]; onPress: () => void }) {
  return (
    <View style={s.slide}>
      {/* Top nav */}
      <View style={s.topNav}>
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoIcon}>⚡</Text></View>
          <Text style={s.logoText}>FinAi</Text>
        </View>
        <View style={[s.navBadge, { borderColor: slide.badgeColor + '60' }]}>
          <Text style={[s.navBadgeText, { color: slide.badgeColor }]}>{slide.badge}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={s.slideContent}>
        <View style={s.tagWrap}>
          <Text style={s.topTag}>{slide.topTag}</Text>
        </View>
        <Text style={s.heroTitle}>
          {slide.title}
          <Text style={s.accentText}>{slide.titleAccent}</Text>
          {slide.titleRest}
        </Text>
        <Text style={s.heroParagraph}>{slide.sub}</Text>

        {/* Stats list */}
        <View style={s.statsList}>
          {slide.stats.map((st) => (
            <View key={st.label} style={s.statsListRow}>
              <Text style={s.statsListValue}>{st.value}</Text>
              <Text style={s.statsListLabel}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SlideFinbot({ slide, onPress }: { slide: typeof SLIDES[1]; onPress: () => void }) {
  return (
    <View style={s.slide}>
      <View style={s.topNav}>
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoIcon}>⚡</Text></View>
          <Text style={s.logoText}>FinAi</Text>
        </View>
        <View style={[s.navBadge, { borderColor: slide.badgeColor + '60' }]}>
          <Text style={[s.navBadgeText, { color: slide.badgeColor }]}>{slide.badge}</Text>
        </View>
      </View>

      <View style={s.slideContent}>
        <View style={s.botIconWrap}>
          <Text style={{ fontSize: 40 }}>🤖</Text>
        </View>
        <Text style={[s.topTag, { color: slide.topTagColor ?? colors.textSecondary }]}>{slide.topTag}</Text>
        <Text style={[s.heroTitle, { marginTop: 4 }]}>
          {slide.title}
          <Text style={s.accentText}>{slide.titleAccent}</Text>
        </Text>
        <Text style={s.heroParagraph}>{slide.sub}</Text>

        {/* 2×2 grid */}
        <View style={s.statGrid}>
          {slide.grid.map((g) => (
            <View key={g.label} style={s.statGridCell}>
              <Text style={s.statGridValue}>{g.value}</Text>
              <Text style={s.statGridLabel}>{g.label}</Text>
            </View>
          ))}
        </View>

        {/* Feature rows */}
        <View style={{ gap: 6, marginTop: 8 }}>
          {slide.features.map((f) => (
            <View key={f.title} style={[s.featureRow, { borderLeftColor: f.color }]}>
              <Text style={{ fontSize: 16, width: 24 }}>{f.icon}</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.featureTitle}>{f.title}</Text>
                <Text style={s.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SlidePartners({ slide, onPress }: { slide: typeof SLIDES[2]; onPress: () => void }) {
  return (
    <View style={s.slide}>
      <View style={s.topNav}>
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoIcon}>⚡</Text></View>
          <Text style={s.logoText}>FinAi</Text>
        </View>
        <View style={[s.navBadge, { borderColor: slide.badgeColor + '60' }]}>
          <Text style={[s.navBadgeText, { color: slide.badgeColor }]}>{slide.badge}</Text>
        </View>
      </View>

      <View style={s.slideContent}>
        <Text style={s.topTag}>{slide.topTag}</Text>
        <Text style={s.heroTitle}>
          {slide.title}
          <Text style={s.accentText}>{slide.titleAccent}</Text>
        </Text>
        <Text style={s.heroParagraph}>{slide.sub}</Text>

        {/* Partner logo grid */}
        <View style={s.partnerGrid}>
          {slide.partners.map((p) => (
            <View key={p} style={s.partnerCell}>
              <Text style={s.partnerText}>{p}</Text>
            </View>
          ))}
        </View>

        {/* 2×2 stats */}
        <View style={s.statGrid}>
          {slide.partnerStats.map((st) => (
            <View key={st.label} style={s.statGridCell}>
              <Text style={s.statGridValue}>{st.value}</Text>
              <Text style={s.statGridLabel}>{st.label}</Text>
            </View>
          ))}
        </View>

        {/* Trust badges */}
        <View style={s.trustRow}>
          {slide.trustBadges.map((b) => (
            <View key={b} style={s.trustBadge}>
              <Text style={s.trustBadgeText}>{b}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

function SlideTiers({ slide, onPress }: { slide: typeof SLIDES[3]; onPress: () => void }) {
  return (
    <View style={s.slide}>
      <View style={s.topNav}>
        <View style={s.logoRow}>
          <View style={s.logoBox}><Text style={s.logoIcon}>⚡</Text></View>
          <Text style={s.logoText}>FinAi</Text>
        </View>
        <View style={[s.navBadge, { borderColor: slide.badgeColor + '60' }]}>
          <Text style={[s.navBadgeText, { color: slide.badgeColor }]}>{slide.badge}</Text>
        </View>
      </View>

      <View style={s.slideContent}>
        <Text style={s.topTag}>{slide.topTag}</Text>
        <Text style={s.heroTitle}>
          {slide.title}
          <Text style={s.accentText}>{slide.titleAccent}</Text>
        </Text>
        <Text style={s.heroParagraph}>{slide.sub}</Text>

        <View style={{ gap: 10, marginTop: 8 }}>
          {slide.tiers.map((t) => (
            <View key={t.num} style={[s.tierCard, { borderColor: t.borderColor }]}>
              <View style={s.tierHeader}>
                <Text style={s.tierNum}>Tier {t.num}{'  '}</Text>
                <Text style={[s.tierName, { color: t.nameColor }]}>{t.name}</Text>
                {t.topBadge && (
                  <View style={s.tierTopBadge}>
                    <Text style={s.tierTopBadgeText}>{t.topBadge}</Text>
                  </View>
                )}
              </View>
              <View style={s.tierPerks}>
                {t.perks.map((p) => (
                  <Text key={p} style={s.tierPerk}>✓ {p}</Text>
                ))}
              </View>
              <Text style={s.tierNote}>{t.note}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/* ─── Main ───────────────────────────────────────────────── */
export default function LandingScreen({ navigation }: { navigation: any }) {
  const flatRef = useRef<FlatList>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / W);
    setActiveIdx(idx);
  };

  const handleBtn = () => {
    const slide = SLIDES[activeIdx];
    if (activeIdx < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIdx + 1, animated: true });
    } else {
      navigation.navigate('Signup');
    }
  };

  const renderItem = ({ item, index }: { item: typeof SLIDES[number]; index: number }) => {
    const props = { slide: item as any, onPress: handleBtn };
    if (item.id === 'hero')     return <SlideHero     {...props} />;
    if (item.id === 'finbot')   return <SlideFinbot   {...props} />;
    if (item.id === 'partners') return <SlidePartners {...props} />;
    return <SlideTiers {...props} />;
  };

  const btnLabel = activeIdx < SLIDES.length - 1
    ? SLIDES[activeIdx].btnLabel
    : 'Get Started Free →';

  return (
    <SafeAreaView style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg} />

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES as any}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={{ flex: 1 }}
      />

      {/* Fixed bottom area */}
      <View style={s.bottom}>
        {/* Dot indicators */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <TouchableOpacity
              key={i}
              onPress={() => flatRef.current?.scrollToIndex({ index: i, animated: true })}
              style={[s.dot, i === activeIdx && s.dotActive]}
            />
          ))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={s.ctaBtn} onPress={handleBtn} activeOpacity={0.88}>
          <Text style={s.ctaBtnText}>{btnLabel}</Text>
        </TouchableOpacity>

        {/* Sign in button */}
        <TouchableOpacity style={s.signInBtn} onPress={() => navigation.navigate('Login')} activeOpacity={0.7}>
          <Text style={s.signInBtnText}>Sign In</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

/* ─── Styles ─────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  /* Slide shell */
  slide: { width: W, flex: 1, backgroundColor: colors.bg },
  slideContent: { flex: 1, paddingHorizontal: spacing.md, paddingTop: 4, paddingBottom: 8 },

  /* Top nav */
  topNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  logoBox: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
  },
  logoIcon: { fontSize: 16, color: '#000', fontWeight: '900' },
  logoText: { fontSize: font.xl, fontWeight: '900', color: colors.text },
  navBadge: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  navBadgeText: { fontSize: font.xs, fontWeight: '700' },

  /* Tag + headline */
  tagWrap: { marginBottom: spacing.sm },
  topTag: {
    fontSize: font.xs, fontWeight: '700', letterSpacing: 1,
    color: colors.textSecondary, textTransform: 'uppercase', marginBottom: spacing.sm,
  },
  heroTitle: {
    fontSize: 32, fontWeight: '900', color: colors.text, lineHeight: 40, marginBottom: spacing.sm,
  },
  accentText: { color: colors.accent },
  heroParagraph: { fontSize: font.sm, color: colors.textSecondary, lineHeight: 20, marginBottom: spacing.md },

  /* Slide 1 – stats list */
  statsList: { gap: 8, marginTop: 4 },
  statsListRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.card, borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3, borderLeftColor: colors.accent,
  },
  statsListValue: { fontSize: font.lg, fontWeight: '800', color: colors.accent, width: 64 },
  statsListLabel: { fontSize: font.sm, color: colors.textSecondary, flex: 1 },

  /* Slide 2 – bot */
  botIconWrap: {
    width: 64, height: 64, borderRadius: 16,
    backgroundColor: colors.accentMuted, alignItems: 'center', justifyContent: 'center',
    marginBottom: spacing.sm, borderWidth: 1, borderColor: colors.accent + '40',
  },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm },
  statGridCell: {
    width: '47.5%', backgroundColor: colors.card,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: 12, paddingHorizontal: spacing.sm, alignItems: 'center',
  },
  statGridValue: { fontSize: font.xl, fontWeight: '900', color: colors.accent, marginBottom: 2 },
  statGridLabel: { fontSize: font.xs, color: colors.textSecondary },

  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm,
    backgroundColor: colors.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    borderLeftWidth: 3, paddingHorizontal: spacing.sm, paddingVertical: 10,
  },
  featureTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: 1 },
  featureDesc: { fontSize: font.xs, color: colors.textSecondary },

  /* Slide 3 – partners */
  partnerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.sm, marginBottom: spacing.sm,
  },
  partnerCell: {
    paddingHorizontal: 8, paddingVertical: 5,
    backgroundColor: colors.surface, borderRadius: radius.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  partnerText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary, letterSpacing: 0.3 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  trustBadge: {
    borderRadius: 20, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 4,
    backgroundColor: colors.card,
  },
  trustBadgeText: { fontSize: font.xs, color: colors.textSecondary, fontWeight: '600' },

  /* Slide 4 – tiers */
  tierCard: {
    backgroundColor: colors.card, borderRadius: radius.lg,
    borderWidth: 1, padding: spacing.md,
  },
  tierHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  tierNum: { fontSize: font.sm, color: colors.textSecondary, fontWeight: '600' },
  tierName: { fontSize: font.md, fontWeight: '800', flex: 1 },
  tierTopBadge: {
    backgroundColor: colors.accentMuted, borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.accent + '50',
  },
  tierTopBadgeText: { fontSize: font.xs, color: colors.accent, fontWeight: '700' },
  tierPerks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tierPerk: { fontSize: font.xs, color: colors.textSecondary },
  tierNote: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },

  /* Bottom fixed */
  bottom: {
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.md,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.md },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: colors.border,
  },
  dotActive: { width: 22, backgroundColor: colors.accent },
  ctaBtn: {
    backgroundColor: colors.accent, borderRadius: radius.xl,
    paddingVertical: 16, alignItems: 'center',
    shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  ctaBtnText: { color: '#000', fontWeight: '800', fontSize: font.md },
  signInBtn: {
    marginTop: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, paddingVertical: 14,
    alignItems: 'center',
  },
  signInBtnText: { color: colors.text, fontWeight: '700', fontSize: font.md },
});
