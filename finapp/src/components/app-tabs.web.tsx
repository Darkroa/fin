// Web version — expo-router/ui Tabs requires native navigation context.
// On web, just use Slot to render the current route directly.
import { Slot } from 'expo-router';

export default function AppTabs() {
  return <Slot />;
}
