import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, type ViewStyle } from 'react-native';

interface Props {
  onPress?: () => void;
  style?: ViewStyle;
}

export function ImportButton({ onPress, style }: Props) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const sparkleScale = useRef(new Animated.Value(1)).current;
  const sparkleRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    );
    const sparkle = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sparkleScale, { toValue: 1.35, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sparkleRotate, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sparkleScale, { toValue: 1, duration: 500, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sparkleRotate, { toValue: 0, duration: 500, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.delay(2000),
      ])
    );
    shimmer.start();
    sparkle.start();
    return () => { shimmer.stop(); sparkle.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 0.3, 0.55, 1],
    outputRange: [-100, -100, 100, 100],
  });
  const sparkleRotateDeg = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '25deg'],
  });

  const handlePress = onPress ?? (() => router.push('/import-transactions'));

  return (
    <TouchableOpacity style={[s.shadow, style]} onPress={handlePress} activeOpacity={0.8}>
      <LinearGradient
        colors={[Colors.indigoLight, Colors.indigo, Colors.indigoDarker]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.gradient}
      >
        <Animated.View style={{ transform: [{ scale: sparkleScale }, { rotate: sparkleRotateDeg }] }}>
          <Ionicons name="sparkles" size={13} color={colors.textOnColor} />
        </Animated.View>
        <Text style={s.label}>Import</Text>
        <Animated.View
          pointerEvents="none"
          style={[s.shimmer, { backgroundColor: colors.glassWhite, transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }] }]}
        />
      </LinearGradient>
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
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    borderRadius: 12,
    overflow: 'hidden',
  },
  label: {
    color: Colors.light.textOnColor,
    fontSize: 15,
    fontWeight: '700',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 36,
  },
});
