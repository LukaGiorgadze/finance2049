import { Colors } from '@/constants/theme';
import { CurrencyProvider } from '@/contexts/currency-context';
import { ThemeProvider } from '@/contexts/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { TransactionTypeProvider } from '@/lib/contexts/TransactionTypeContext';
import { initializeCrashlytics } from '@/lib/crashlytics';
import { StoreProvider } from '@/lib/store/StoreProvider';
// The published package points its root typings at missing build artifacts, but the source entry is complete.
import * as Clarity from '@microsoft/react-native-clarity/src';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useMemo } from 'react';
import 'react-native-reanimated';

SplashScreen.setOptions({
  duration: 500,
  fade: false,
});

initializeCrashlytics();

export const unstable_settings = {
  anchor: '(tabs)',
};

const CLARITY_PROJECT_ID = 'wf8c1t82m7';

function useClarityTracking() {
  const pathname = usePathname();
  // Clarity iOS 3.5.1 has a touch-handling bug around lifecycle transitions.
  // Keep iOS disabled until the React Native wrapper ships the native 3.5.2+ fix.
  const isClarityEnabled = Platform.OS === 'android';
  const clarityConfig = useMemo(
    () => ({
      logLevel: __DEV__ ? Clarity.LogLevel.Verbose : Clarity.LogLevel.Warning,
    }),
    []
  );

  useEffect(() => {
    if (!isClarityEnabled) {
      return;
    }

    Clarity.initialize(CLARITY_PROJECT_ID, clarityConfig);
    void Clarity.consent(true, true);
  }, [clarityConfig, isClarityEnabled]);

  useEffect(() => {
    if (!isClarityEnabled) {
      return;
    }

    Clarity.setOnSessionStartedCallback(() => {
      void Clarity.setCurrentScreenName(pathname || '/');
    });
    void Clarity.setCurrentScreenName(pathname || '/');
  }, [isClarityEnabled, pathname]);
}

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
  useClarityTracking();

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
