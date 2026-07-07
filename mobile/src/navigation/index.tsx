import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors, font, spacing, radius, shadow } from '../theme';

// Auth screens
import LandingScreen        from '../screens/LandingScreen';
import LoginScreen          from '../screens/LoginScreen';
import SignupScreen         from '../screens/SignupScreen';

// Main tab screens
import DashboardScreen      from '../screens/DashboardScreen';
import MarketsScreen        from '../screens/MarketsScreen';
import WalletScreen         from '../screens/WalletScreen';
import TradeScreen          from '../screens/TradeScreen';
import ProfileScreen        from '../screens/ProfileScreen';

// More-stack screens (secondary nav)
import MoreScreen           from '../screens/MoreScreen';
import BotsScreen           from '../screens/BotsScreen';
import ChatScreen           from '../screens/ChatScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import SupportScreen        from '../screens/SupportScreen';
import NewsScreen           from '../screens/NewsScreen';
import AlertsScreen         from '../screens/AlertsScreen';
import NotificationsScreen  from '../screens/NotificationsScreen';
import CalendarScreen       from '../screens/CalendarScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import OpenPositionsScreen  from '../screens/OpenPositionsScreen';
import PricingScreen        from '../screens/PricingScreen';

const Stack     = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

/** Secondary screens reachable from drawer / quick-actions */
function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
        headerBackTitle: 'Back',
        headerShadowVisible: false,
      }}
    >
      <MoreStack.Screen name="MoreMenu"      component={MoreScreen}               options={{ title: 'More' }} />
      <MoreStack.Screen name="Chat"          component={ChatScreen}               options={{ title: 'AI Chat' }} />
      <MoreStack.Screen name="Bots"          component={BotsScreen}               options={{ title: 'Trading Bots' }} />
      <MoreStack.Screen name="Settings"      component={SettingsScreen}           options={{ title: 'Settings' }} />
      <MoreStack.Screen name="Support"       component={SupportScreen}            options={{ title: 'Support' }} />
      <MoreStack.Screen name="News"          component={NewsScreen}               options={{ title: 'News & Events' }} />
      <MoreStack.Screen name="Alerts"        component={AlertsScreen}             options={{ title: 'Price Alerts' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen}      options={{ title: 'Notifications' }} />
      <MoreStack.Screen name="Calendar"      component={CalendarScreen}           options={{ title: 'Calendar' }} />
      <MoreStack.Screen name="Transactions"  component={TransactionHistoryScreen} options={{ title: 'History' }} />
      <MoreStack.Screen name="Positions"     component={OpenPositionsScreen}      options={{ title: 'Open Positions' }} />
      <MoreStack.Screen name="Pricing"       component={PricingScreen}            options={{ title: 'Plans & Pricing' }} />
      <MoreStack.Screen name="Wallet"        component={WalletScreen}             options={{ title: 'Wallet' }} />
    </MoreStack.Navigator>
  );
}

/**
 * Custom bottom tab bar — mirrors the frontend layout:
 *   Home | Trade | FinBot (elevated center) | Markets | Profile
 */
function CustomTabBar({ state, descriptors, navigation }: any) {
  const { user } = useAuth();
  const tabs = state.routes;

  return (
    <View style={navStyles.tabBar}>
      {tabs.map((route: any, index: number) => {
        const isFocused = state.index === index;
        const isCenter  = route.name === 'Bots';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        /* ── Elevated centre FinBot button ── */
        if (isCenter) {
          return (
            <View key={route.key} style={navStyles.centerWrapper}>
              <TouchableOpacity
                style={[navStyles.centerBtn, isFocused && navStyles.centerBtnActive]}
                onPress={onPress}
                activeOpacity={0.85}
              >
                <Text style={navStyles.centerBtnIcon}>🤖</Text>
              </TouchableOpacity>
              <Text style={[navStyles.tabLabel, { color: isFocused ? colors.accent : colors.textMuted }]}>
                FinBot
              </Text>
            </View>
          );
        }

        /* ── Profile tab with avatar ── */
        if (route.name === 'Profile') {
          return (
            <TouchableOpacity key={route.key} style={navStyles.tabItem} onPress={onPress} activeOpacity={0.7}>
              <View style={[navStyles.avatarRing, { borderColor: isFocused ? colors.accent : colors.border }]}>
                {user?.avatar_url ? (
                  // eslint-disable-next-line @typescript-eslint/no-var-requires
                  <Text style={{ fontSize: 12 }}>👤</Text>
                ) : (
                  <Text style={[navStyles.avatarInitial, { color: isFocused ? colors.accent : colors.textMuted }]}>
                    {(user?.email?.[0] ?? 'U').toUpperCase()}
                  </Text>
                )}
              </View>
              <Text style={[navStyles.tabLabel, { color: isFocused ? colors.accent : colors.textMuted }]}>
                Profile
              </Text>
              {isFocused && <View style={navStyles.activeDot} />}
            </TouchableOpacity>
          );
        }

        /* ── Regular tabs ── */
        const tabConfig: Record<string, { icon: string; label: string }> = {
          Dashboard: { icon: '⌂', label: 'Home' },
          Trade:     { icon: '📈', label: 'Trade' },
          Markets:   { icon: '◈', label: 'Markets' },
          More:      { icon: '≡', label: 'More' },
        };
        const cfg = tabConfig[route.name] ?? { icon: '○', label: route.name };

        return (
          <TouchableOpacity key={route.key} style={navStyles.tabItem} onPress={onPress} activeOpacity={0.7}>
            <Text style={[navStyles.tabIcon, { color: isFocused ? colors.accent : colors.textMuted }]}>
              {cfg.icon}
            </Text>
            <Text style={[navStyles.tabLabel, { color: isFocused ? colors.accent : colors.textMuted }]}>
              {cfg.label}
            </Text>
            {isFocused && <View style={navStyles.activeDot} />}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/**
 * Main tab shell — matches frontend bottom nav order:
 *   Dashboard | Trade | Bots (centre) | Markets | Profile
 */
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Trade"     component={TradeScreen} />
      <Tab.Screen name="Bots"      component={BotsScreen} />
      <Tab.Screen name="Markets"   component={MarketsScreen} />
      <Tab.Screen name="Profile"   component={ProfileScreen} />
      {/* Hidden tabs — reachable by navigating, not via tab bar */}
      <Tab.Screen name="More"      component={MoreNavigator}  options={{ tabBarItemStyle: { display: 'none' } }} />
    </Tab.Navigator>
  );
}

const SECONDARY_OPTS = {
  headerShown: true,
  headerStyle: { backgroundColor: colors.card },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '700' as const, fontSize: font.lg },
  headerBackTitle: 'Back',
  headerShadowVisible: false,
};

/**
 * Root stack sits above the tabs — secondary screens registered here
 * are reachable via navigation.navigate('ScreenName') from ANY tab.
 */
function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs"     component={MainTabs} />
      {/* Secondary screens navigable from anywhere */}
      <RootStack.Screen name="Settings"     component={SettingsScreen}            options={{ ...SECONDARY_OPTS, title: 'Settings' }} />
      <RootStack.Screen name="Pricing"      component={PricingScreen}             options={{ ...SECONDARY_OPTS, title: 'Plans & Pricing' }} />
      <RootStack.Screen name="Wallet"       component={WalletScreen}              options={{ ...SECONDARY_OPTS, title: 'Wallet' }} />
      <RootStack.Screen name="Notifications" component={NotificationsScreen}      options={{ ...SECONDARY_OPTS, title: 'Notifications' }} />
      <RootStack.Screen name="Transactions"  component={TransactionHistoryScreen} options={{ ...SECONDARY_OPTS, title: 'History' }} />
      <RootStack.Screen name="Positions"    component={OpenPositionsScreen}       options={{ ...SECONDARY_OPTS, title: 'Open Positions' }} />
      <RootStack.Screen name="Calendar"     component={CalendarScreen}            options={{ ...SECONDARY_OPTS, title: 'Calendar' }} />
      <RootStack.Screen name="Alerts"       component={AlertsScreen}              options={{ ...SECONDARY_OPTS, title: 'Price Alerts' }} />
      <RootStack.Screen name="News"         component={NewsScreen}                options={{ ...SECONDARY_OPTS, title: 'News & Events' }} />
      <RootStack.Screen name="Chat"         component={ChatScreen}                options={{ ...SECONDARY_OPTS, title: 'AI Chat' }} />
      <RootStack.Screen name="Support"      component={SupportScreen}             options={{ ...SECONDARY_OPTS, title: 'Support' }} />
    </RootStack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Landing" component={LandingScreen} />
      <Stack.Screen name="Login"   component={LoginScreen} />
      <Stack.Screen name="Signup"  component={SignupScreen} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={navStyles.loading}>
        <View style={navStyles.logoBox}>
          <Text style={navStyles.logoIcon}>⚡</Text>
        </View>
        <Text style={navStyles.logoText}>FinAi</Text>
        <Text style={navStyles.logoSub}>AI-Powered Trading</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <AppNavigator /> : <AuthStack />}
    </NavigationContainer>
  );
}

const TAB_HEIGHT = Platform.OS === 'ios' ? 80 : 64;

const navStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    height: TAB_HEIGHT,
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
    alignItems: 'center',
    ...shadow.card,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabIcon: { fontSize: 20, lineHeight: 24 },
  tabLabel: { fontSize: font.xs, fontWeight: '600' },
  activeDot: {
    width: 16, height: 2, borderRadius: 1,
    backgroundColor: colors.accent, marginTop: 2,
  },

  /* Centre FinBot button */
  centerWrapper: {
    flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 2,
  },
  centerBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -20, ...shadow.accent,
  },
  centerBtnActive: { backgroundColor: colors.accentDark },
  centerBtnIcon: { fontSize: 22, color: '#000' },

  /* Profile avatar ring */
  avatarRing: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  avatarInitial: { fontSize: 10, fontWeight: '700' },

  /* Loading screen */
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16, ...shadow.accent,
  },
  logoIcon: { fontSize: 36 },
  logoText: { fontSize: 32, fontWeight: '700', color: colors.text },
  logoSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },
});
