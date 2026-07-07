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

// More-stack screens
import MoreScreen           from '../screens/MoreScreen';
import BotsScreen           from '../screens/BotsScreen';
import ChatScreen           from '../screens/ChatScreen';
import ProfileScreen        from '../screens/ProfileScreen';
import SettingsScreen       from '../screens/SettingsScreen';
import SupportScreen        from '../screens/SupportScreen';
import NewsScreen           from '../screens/NewsScreen';
import AlertsScreen         from '../screens/AlertsScreen';
import NotificationsScreen  from '../screens/NotificationsScreen';
import CalendarScreen       from '../screens/CalendarScreen';
import TransactionHistoryScreen from '../screens/TransactionHistoryScreen';
import OpenPositionsScreen  from '../screens/OpenPositionsScreen';
import PricingScreen        from '../screens/PricingScreen';

const Stack    = createNativeStackNavigator();
const Tab      = createBottomTabNavigator();
const MoreStack = createNativeStackNavigator();

/** Stack for the "More" tab — contains menu + all secondary screens */
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
      <MoreStack.Screen name="MoreMenu"      component={MoreScreen}              options={{ title: 'More' }} />
      <MoreStack.Screen name="Chat"          component={ChatScreen}              options={{ title: 'AI Chat' }} />
      <MoreStack.Screen name="Bots"          component={BotsScreen}              options={{ title: 'Trading Bots' }} />
      <MoreStack.Screen name="Profile"       component={ProfileScreen}           options={{ title: 'Profile' }} />
      <MoreStack.Screen name="Settings"      component={SettingsScreen}          options={{ title: 'Settings' }} />
      <MoreStack.Screen name="Support"       component={SupportScreen}           options={{ title: 'Support' }} />
      <MoreStack.Screen name="News"          component={NewsScreen}              options={{ title: 'News & Events' }} />
      <MoreStack.Screen name="Alerts"        component={AlertsScreen}            options={{ title: 'Price Alerts' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen}     options={{ title: 'Notifications' }} />
      <MoreStack.Screen name="Calendar"      component={CalendarScreen}          options={{ title: 'Calendar' }} />
      <MoreStack.Screen name="Transactions"  component={TransactionHistoryScreen} options={{ title: 'History' }} />
      <MoreStack.Screen name="Positions"     component={OpenPositionsScreen}     options={{ title: 'Open Positions' }} />
      <MoreStack.Screen name="Pricing"       component={PricingScreen}           options={{ title: 'Plans & Pricing' }} />
    </MoreStack.Navigator>
  );
}

/** Custom tab bar with elevated center Trade button */
function CustomTabBar({ state, descriptors, navigation }: any) {
  const tabs = state.routes;
  return (
    <View style={navStyles.tabBar}>
      {tabs.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const isCenter = route.name === 'Trade';

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (isCenter) {
          return (
            <View key={route.key} style={navStyles.centerWrapper}>
              <TouchableOpacity
                style={[navStyles.centerBtn, isFocused && navStyles.centerBtnActive]}
                onPress={onPress}
                activeOpacity={0.85}
              >
                <Text style={navStyles.centerBtnIcon}>⚡</Text>
              </TouchableOpacity>
              <Text style={[navStyles.centerLabel, { color: isFocused ? colors.accent : colors.textMuted }]}>
                Trade
              </Text>
            </View>
          );
        }

        const tabIcons: Record<string, string> = {
          Dashboard: '⌂',
          Markets: '◈',
          Wallet: '◎',
          More: '≡',
        };
        const tabLabels: Record<string, string> = {
          Dashboard: 'Home',
          Markets: 'Markets',
          Wallet: 'Wallet',
          More: 'More',
        };

        return (
          <TouchableOpacity
            key={route.key}
            style={navStyles.tabItem}
            onPress={onPress}
            activeOpacity={0.7}
          >
            <Text style={[navStyles.tabIcon, { color: isFocused ? colors.accent : colors.textMuted }]}>
              {tabIcons[route.name] || '○'}
            </Text>
            <Text style={[navStyles.tabLabel, { color: isFocused ? colors.accent : colors.textMuted }]}>
              {tabLabels[route.name] || route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** Five main tabs with elevated center Trade */
function MainTabs() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Markets"   component={MarketsScreen} />
      <Tab.Screen name="Trade"     component={TradeScreen} />
      <Tab.Screen name="Wallet"    component={WalletScreen} />
      <Tab.Screen name="More"      component={MoreNavigator} />
    </Tab.Navigator>
  );
}

/** Unauthenticated stack */
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
      {user ? <MainTabs /> : <AuthStack />}
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
  tabIcon: {
    fontSize: 20,
    lineHeight: 24,
  },
  tabLabel: {
    fontSize: font.xs,
    fontWeight: '600',
  },
  centerWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 2,
  },
  centerBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    ...shadow.accent,
  },
  centerBtnActive: {
    backgroundColor: colors.accentDark,
  },
  centerBtnIcon: {
    fontSize: 22,
    color: '#000',
  },
  centerLabel: {
    fontSize: font.xs,
    fontWeight: '600',
    marginTop: 2,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBox: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...shadow.accent,
  },
  logoIcon: { fontSize: 36 },
  logoText: { fontSize: 32, fontWeight: '700', color: colors.text },
  logoSub: { fontSize: font.sm, color: colors.textSecondary, marginTop: 4 },
});
