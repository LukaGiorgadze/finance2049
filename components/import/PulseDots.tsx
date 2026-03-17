import { Colors } from '@/constants/theme';
import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export function PulseDots({ mini = false }: { mini?: boolean }) {
  const r1 = useRef(new Animated.Value(0));
  const r2 = useRef(new Animated.Value(0));
  const r3 = useRef(new Animated.Value(0));
  const dots = useMemo(() => [r1.current, r2.current, r3.current], []);

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 380, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.delay((2 - i) * 160),
        ])
      )
    );
    animations.forEach(a => a.start());
    return () => animations.forEach(a => a.stop());
  }, [dots]);

  const size = mini ? 5 : 9;
  return (
    <View style={[s.dots, mini && { gap: 4, marginBottom: 0 }]}>
      {dots.map((dot, i) => (
        <Animated.View key={i} style={[
          s.dot,
          { width: size, height: size, borderRadius: size / 2 },
          {
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
            transform: [{ scale: dot.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) }],
          },
        ]} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 7, marginBottom: 22 },
  dot: { backgroundColor: Colors.indigo },
});
