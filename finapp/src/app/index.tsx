import { StyleSheet, View, StatusBar, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? 'https://fin--aifin.replit.app';

function WebViewScreen() {
  const insets = useSafeAreaInsets();
  const url = `${BASE_URL}/login`;

  if (Platform.OS === 'web') {
    return (
      <iframe
        src={url}
        style={{ width: '100%', height: '100vh', border: 'none' }}
      />
    );
  }

  // Native: lazy-import WebView so it doesn't break the web bundle
  const { WebView } = require('react-native-webview');

  return (
    <View style={[
      styles.container,
      { paddingTop: Platform.OS === 'ios' ? insets.top : StatusBar.currentHeight }
    ]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <WebView
        source={{ uri: url }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        originWhitelist={['*']}
        allowsInlineMediaPlayback={true}
      />
    </View>
  );
}

export default function HomeScreen() {
  return (
    <SafeAreaProvider>
      <WebViewScreen />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  webview: {
    flex: 1,
  },
});
