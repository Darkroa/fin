// Web-only root layout — avoids ALL native-only imports (reanimated, worklets, etc.)
// Just renders the current route with no decoration.
import { Slot } from 'expo-router';

export default function WebRootLayout() {
  return <Slot />;
}
