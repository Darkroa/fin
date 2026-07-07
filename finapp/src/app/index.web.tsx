const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL ?? 'https://fin--aifin.replit.app';

export default function HomeScreen() {
  return (
    <iframe
      src={`${BASE_URL}/login`}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        border: 'none',
        margin: 0,
        padding: 0,
      }}
      title="FinAi"
    />
  );
}
