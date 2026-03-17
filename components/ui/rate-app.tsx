import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as StoreReview from 'expo-store-review';
import React, { useCallback } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface RateAppProps {
  colors: { subtext: string };
  onRate?: () => void;
  onSkip?: () => void;
}

export function RateApp({ colors, onRate, onSkip }: RateAppProps) {
  const handleRate = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      }
    } catch {
      // Review unavailable (simulator, quota exhausted, etc.)
    }
    onRate?.();
  }, [onRate]);

  return (
    <View>
      <TouchableOpacity onPress={handleRate} activeOpacity={0.85}>
        <LinearGradient
          colors={[Colors.indigo, Colors.indigoDark]}
          style={s.rateBtn}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Ionicons name="star" size={18} color={Colors.light.yellow} />
          <Text style={s.rateBtnText}>Rate on App Store</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onSkip}
        style={{ alignSelf: 'center', paddingVertical: 14 }}
        activeOpacity={0.7}
      >
        <Text style={[s.skipText, { color: colors.subtext }]}>Maybe later</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  rateBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  rateBtnText: {
    color: Colors.light.textOnColor,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
