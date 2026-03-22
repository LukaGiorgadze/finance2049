import { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Tabs, usePathname } from 'expo-router';
import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTransactionType } from '@/lib/contexts/TransactionTypeContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const isTransactionsActive = pathname === '/transactions';
  const { transactionType } = useTransactionType();

  const FloatingTabButton = ({ children, onPress, accessibilityRole, accessibilityState }: BottomTabBarButtonProps) => {
    const scale = React.useRef(new Animated.Value(1)).current;

    const animateIn = () => {
      if (process.env.EXPO_OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }).start();
    };

    const animateOut = () => {
      Animated.timing(scale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Pressable
        onPress={onPress}
        onPressIn={animateIn}
        onPressOut={animateOut}
        accessibilityRole={accessibilityRole}
        accessibilityState={accessibilityState}
        style={styles.floatingButtonWrapper}>
        <Animated.View
          style={[
            Platform.OS === 'android' ? styles.floatingButtonAndroid : styles.floatingButtonBorder,
            Platform.OS !== 'android' && { borderColor: colors.tabBarBorder },
            Platform.OS === 'android' && { backgroundColor: colors.cardBackground },
            { transform: [{ scale }] },
          ]}>
          {Platform.OS !== 'android' && (
            <View style={styles.floatingButton}>
              <BlurView
                intensity={60}
                tint={isDark ? 'dark' : 'light'}
                style={styles.floatingButtonBlur}
              />
              <IconSymbol
                size={28}
                name="arrow.left.arrow.right"
                color={isTransactionsActive && transactionType ? (transactionType === 'sell' ? colors.red : colors.green) : colors.icon}
              />
            </View>
          )}
          {Platform.OS === 'android' && (
            <IconSymbol
              size={28}
              name="arrow.left.arrow.right"
              color={isTransactionsActive && transactionType ? (transactionType === 'sell' ? colors.red : colors.green) : colors.icon}
            />
          )}
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarInactiveTintColor: colors.icon,
        headerShown: false,
        tabBarButton: HapticTab,
        lazy: true,
        freezeOnBlur: true,
        animation: 'none',
        sceneStyle: {
          backgroundColor: 'transparent',
        },
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: Platform.OS === 'ios' ? 75 : 65,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
          paddingTop: Platform.OS === 'ios' ? 12 : 10,
          left: 16,
          right: 16,
          marginHorizontal: 32,
          marginBottom: insets.bottom,
          borderRadius: 24,
          shadowColor: Colors.shadow,
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: isDark ? 0.6 : 0.15,
          shadowRadius: 24,
          borderWidth: 1,
          borderColor: colors.tabBarBorder,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarBackground: () => (
          <BlurView
            intensity={Platform.OS === 'android' ? 90 : 50}
            tint={isDark ? 'dark' : 'light'}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              borderRadius: 24,
              overflow: 'hidden',
              ...(Platform.OS === 'android' && {
                backgroundColor: colors.tabBarBackgroundAndroid,
              }),
            }}
          />
        ),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="briefcase.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: '',
          tabBarButton: FloatingTabButton,
        }}
      />
      <Tabs.Screen
        name="statistics"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="chart.bar.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="gearshape.fill" color={color} />,
        }}
      />
    </Tabs>
  );
}

const FLOATING_SIZE = 56;

const styles = StyleSheet.create({
  floatingButtonWrapper: {
    top: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButtonBorder: {
    width: FLOATING_SIZE,
    height: FLOATING_SIZE,
    borderRadius: FLOATING_SIZE / 2,
    borderColor: 'transparent',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  floatingButtonAndroid: {
    width: FLOATING_SIZE,
    height: FLOATING_SIZE,
    borderRadius: FLOATING_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: Colors.shadow,
  },
  floatingButton: {
    width: '100%',
    height: '100%',
    borderRadius: FLOATING_SIZE / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingButtonBlur: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FLOATING_SIZE / 2,
  },
});
