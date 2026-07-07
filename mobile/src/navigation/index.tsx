import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

import { useAuth } from '../context/AuthContext';
import { colors, font } from '../theme';

// Auth screens
import LandingScreen        from '../screens/LandingScreen';
import LoginScreen          from '../screens/LoginScreen';
import SignupScreen         from '../screens/SignupScreen';

// Main tab screens
import DashboardScreen      from '../screens/DashboardScreen';
import MarketsScreen        from '../screens/MarketsScreen';
import WalletScreen         from '../screens/WalletScreen';

// More-stack screens
import MoreScreen           from '../screens/MoreScreen';
import BotsScreen           from '../screens/BotsScreen';
import ChatScreen           from '../screens/ChatScreen';
import TradeScreen          from '../screens/TradeScreen';
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

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: focused ? 22 : 20, opacity: focused ? 1 : 0.5 }}>
      {emoji}
    </Text>
  );
}

/** Stack for the "More" tab — contains menu + all secondary screens */
function MoreNavigator() {
  return (
    <MoreStack.Navigator
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700', fontSize: font.lg },
        headerBackTitle: 'Back',
      }}
    >
      <MoreStack.Screen name="MoreMenu"     component={MoreScreen}              options={{ title: 'More' }} />
      <MoreStack.Screen name="Chat"         component={ChatScreen}              options={{ title: 'AI Chat' }} />
      <MoreStack.Screen name="Bots"         component={BotsScreen}              options={{ title: 'Trading Bots' }} />
      <MoreStack.Screen name="Trade"        component={TradeScreen}             options={{ title: 'Trade' }} />
      <MoreStack.Screen name="Profile"      component={ProfileScreen}           options={{ title: 'Profile' }} />
      <MoreStack.Screen name="Settings"     component={SettingsScreen}          options={{ title: 'Settings' }} />
      <MoreStack.Screen name="Support"      component={SupportScreen}           options={{ title: 'Support' }} />
      <MoreStack.Screen name="News"         component={NewsScreen}              options={{ title: 'News & Events' }} />
      <MoreStack.Screen name="Alerts"       component={AlertsScreen}            options={{ title: 'Price Alerts' }} />
      <MoreStack.Screen name="Notifications" component={NotificationsScreen}    options={{ title: 'Notifications' }} />
      <MoreStack.Screen name="Calendar"     component={CalendarScreen}          options={{ title: 'Calendar' }} />
      <MoreStack.Screen name="Transactions" component={TransactionHistoryScreen} options={{ title: 'History' }} />
      <MoreStack.Screen name="Positions"    component={OpenPositionsScreen}     options={{ title: 'Open Positions' }} />
      <MoreStack.Screen name="Pricing"      component={PricingScreen}           options={{ title: 'Plans & Pricing' }} />
    </MoreStack.Navigator>
  );
}

/** Five main tabs */
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          paddingBottom: 8,
          paddingTop: 6,
          height: 62,
        },
        tabBarActiveTintColor:   colors.accent,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: '600' },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Markets"
        component={MarketsScreen}
        options={{
          tabBarLabel: 'Markets',
          tabBarIcon: ({ focused }) => <TabIcon emoji="📈" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Wallet"
        component={WalletScreen}
        options={{
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💰" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreNavigator}
        options={{
          tabBarLabel: 'More',
          tabBarIcon: ({ focused }) => <TabIcon emoji="☰" focused={focused} />,
        }}
      />
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
      <View style={styles.loading}>
        <View style={styles.logoBox}>
          <Text style={styles.logoIcon}>⚡</Text>
        </View>
        <Text style={styles.logoText}>FinAi</Text>
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? <MainTabs /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  logoBox: {
    width: 64, height: 64, borderRadius: 14,
    backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  logoIcon: { fontSize: 32 },
  logoText:  { fontSize: 28, fontWeight: '700', color: colors.text },
});
