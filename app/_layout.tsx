import { Colors } from '@/constants/theme';
import { CurrencyProvider } from '@/contexts/currency-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { StoreProvider } from '@/lib';
import { TransactionTypeProvider } from '@/lib/contexts/TransactionTypeContext';
import { initializeCrashlytics } from '@/lib/crashlytics';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

SplashScreen.setOptions({
  duration: 500,
  fade: false,
});

export const unstable_settings = {
  anchor: '(tabs)',
};

function LoadingFallback() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;

  return (
    <View style={[styles.loading, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.text} />
    </View>
  );
}

function RootLayoutContent() {
  const colorScheme = useColorScheme();

  return (
    <NavigationThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ animation: 'none' }} />
        <Stack.Screen name="onboarding" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="stock/[symbol]" />
        <Stack.Screen name="news/[id]" />
        <Stack.Screen name="news/index" />
        <Stack.Screen name="storage" />
        <Stack.Screen name="import-transactions" />
        <Stack.Screen name="import-confirm" />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    initializeCrashlytics();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <CurrencyProvider>
          <StoreProvider fallback={<LoadingFallback />}>
            <TransactionTypeProvider>
              <RootLayoutContent />
            </TransactionTypeProvider>
          </StoreProvider>
        </CurrencyProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
