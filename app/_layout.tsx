import '@/i18n';
import { Cinzel_700Bold } from '@expo-google-fonts/cinzel';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GameStoreProvider } from '@/state/GameStore';
import { color } from '@/ui/theme';

export default function RootLayout() {
  const [loaded] = useFonts({ Cinzel_700Bold, Inter_400Regular, Inter_500Medium, Inter_700Bold });
  if (!loaded) return <View style={{ flex: 1, backgroundColor: color.bgApp }} />;
  return (
    <SafeAreaProvider>
      <GameStoreProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bgApp }, animation: 'fade' }} />
      </GameStoreProvider>
    </SafeAreaProvider>
  );
}
