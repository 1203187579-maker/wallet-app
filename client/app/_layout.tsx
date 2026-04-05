import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, View, ActivityIndicator, Text } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Font from 'expo-font';
import { FontAwesome6 } from '@expo/vector-icons';
import { AuthProvider } from "@/contexts/AuthContext";
import { ColorSchemeProvider } from '@/hooks/useColorScheme';
import { UpdateChecker } from '@/components/UpdateChecker';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

export default function RootLayout() {
  const [fontsLoaded, setFontsLoaded] = useState(false);

  useEffect(() => {
    async function loadFonts() {
      try {
        await Font.loadAsync(FontAwesome6.font);
        setFontsLoaded(true);
      } catch (e) {
        console.warn('Font load error:', e);
        setFontsLoaded(true);
      }
    }
    loadFonts();
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0F' }}>
        <ActivityIndicator size="large" color="#F59E0B" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <ColorSchemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <StatusBar style="light" backgroundColor="#0A0A0F"></StatusBar>
          <Stack screenOptions={{
            animation: 'slide_from_right',
            gestureEnabled: true,
            gestureDirection: 'horizontal',
            headerShown: false,
            contentStyle: { backgroundColor: '#0A0A0F' },
          }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="login" />
            <Stack.Screen name="education" />
            <Stack.Screen name="wallet" />
            <Stack.Screen name="wallet-receive" />
            <Stack.Screen name="wallet-send" />
            <Stack.Screen name="transactions" />
            <Stack.Screen name="kyc" />
            <Stack.Screen name="payment-info" />
            <Stack.Screen name="support" />
            <Stack.Screen name="friends" />
            <Stack.Screen name="team" />
            <Stack.Screen name="chat/[groupId]" />
            <Stack.Screen name="group-settings/[groupId]" />
            <Stack.Screen name="red-packet/send" />
            <Stack.Screen name="discover" />
            <Stack.Screen name="rewards" />
            <Stack.Screen name="announcements" />
            <Stack.Screen name="coin-detail" />
            <Stack.Screen name="settings" />
          </Stack>
          <Toast />
          <UpdateChecker />
        </GestureHandlerRootView>
      </ColorSchemeProvider>
    </AuthProvider>
  );
}
