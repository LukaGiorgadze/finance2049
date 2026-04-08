import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';

interface Props {
  onPress?: () => void;
  size?: 'default' | 'small';
  style?: ViewStyle;
}

export function ImportButton({ onPress, size = 'default', style }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const pressAnim = useRef(new Animated.Value(0)).current;
  const isSmall = size === 'small';

  const handlePressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      tension: 220,
      friction: 24,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      tension: 220,
      friction: 24,
      useNativeDriver: true,
    }).start();
  };

  const buttonScale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.985],
  });
  const buttonTranslateY = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const handlePress = onPress ?? (() => router.push('/import-transactions'));

  return (
    <TouchableOpacity
      style={style}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={0.96}
    >
      <Animated.View
        style={[
          isSmall ? s.smallShadow : s.shadow,
          { transform: [{ scale: buttonScale }, { translateY: buttonTranslateY }] },
        ]}
      >
        <LinearGradient
          colors={[Colors.indigoLight, Colors.indigo, Colors.indigoDarker]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={isSmall ? s.smallGradient : s.gradient}
        >
          <Ionicons name="sparkles" size={isSmall ? 11 : 13} color={colors.textOnColor} />
          <Text style={isSmall ? s.smallLabel : s.label}>Import</Text>
        </LinearGradient>
      </Animated.View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  shadow: {
    shadowColor: Colors.indigo,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
    borderRadius: 12,
  },
  smallShadow: {
    shadowColor: Colors.indigo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    borderRadius: 20,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  smallGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 20,
    overflow: 'hidden',
  },
  label: {
    color: Colors.light.textOnColor,
    fontSize: 15,
    fontWeight: '700',
  },
  smallLabel: {
    color: Colors.light.textOnColor,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});
