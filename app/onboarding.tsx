import { ONBOARDING_KEY } from '@/constants/storage-keys';
import { Colors } from '@/constants/theme';
import { useTheme } from '@/contexts/theme-context';
import { ensureSession } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

export { ONBOARDING_KEY } from '@/constants/storage-keys';

const STEP_COUNT = 5;

type ThemeMode = 'light' | 'dark' | 'system';

type OnboardingColors = {
  bg: string;
  card: string;
  text: string;
  subtext: string;
  border: string;
};

function PrimaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.85}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <LinearGradient
        colors={[Colors.indigo, Colors.indigoDark]}
        style={s.primaryBtn}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
      >
        <Text style={s.primaryBtnText}>{label}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}


function Slide({
  colors,
  illustration,
  children,
}: {
  colors: OnboardingColors;
  illustration: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={[s.slide, { backgroundColor: colors.bg }]}>
      <View style={s.illustrationWrap}>{illustration}</View>
      <View style={s.slideContent}>{children}</View>
    </View>
  );
}

function WelcomeSlide({
  colors,
  isDark,
  themeColors,
}: {
  colors: OnboardingColors;
  isDark: boolean;
  themeColors: typeof Colors.dark;
}) {
  const features = [
    { icon: 'trending-up-outline' as const, label: 'Track performance over time', color: Colors.indigo },
    { icon: 'pulse-outline' as const, label: 'Real-time prices & news', color: themeColors.blue },
    { icon: 'lock-closed-outline' as const, label: 'Private — stored on device only', color: themeColors.green },
    { icon: 'code-slash-outline' as const, label: 'Open source & transparent', color: themeColors.warning },
  ];

  const badge = themeColors.badgeFrosted;

  return (
    <Slide colors={colors}
      illustration={
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={[
              s.iconCircle,
              {
                backgroundColor: Colors.indigo,
                shadowColor: Colors.indigo,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 24,
                elevation: 10,
              },
            ]}
          >
            <Ionicons name="shield-checkmark" size={50} color={themeColors.textOnColor} />
          </View>
          <View style={[s.floatBadge, { backgroundColor: badge, position: 'absolute', top: -36, right: -76 }]}>
            <Ionicons name="trending-up-outline" size={16} color={Colors.indigo} />
          </View>
          <View style={[s.floatBadge, { backgroundColor: badge, position: 'absolute', bottom: -28, left: -76 }]}>
            <Ionicons name="lock-closed-outline" size={16} color={themeColors.green} />
          </View>
          <View style={[s.floatBadge, { backgroundColor: badge, position: 'absolute', bottom: -22, right: -76 }]}>
            <Ionicons name="pulse-outline" size={16} color={themeColors.blue} />
          </View>
        </View>
      }
    >
      <Text style={[s.headline, { color: colors.text }]}>Your portfolio,{'\n'}your privacy.</Text>
      <Text style={[s.body, { color: colors.subtext }]}>
        Track long-term investments and watch them grow. Real prices, performance history, and market news.
      </Text>
      <View style={{ gap: 6 }}>
        {features.map((f) => (
          <View key={f.icon} style={s.featureRow}>
            <View style={[s.featureIconWrap, { backgroundColor: `${f.color}14` }]}>
              <Ionicons name={f.icon} size={13} color={f.color} />
            </View>
            <Text style={[s.featureLabel, { color: colors.text }]}>{f.label}</Text>
          </View>
        ))}
      </View>
    </Slide>
  );
}

const SOURCES = [
  { id: 'appstore', label: 'App Store', icon: 'logo-apple' },
  { id: 'google', label: 'Google', icon: 'search-outline' },
  { id: 'twitter', label: 'Twitter / X', icon: 'logo-twitter' },
  { id: 'instagram', label: 'Instagram', icon: 'logo-instagram' },
  { id: 'tiktok', label: 'TikTok', icon: 'logo-tiktok' },
  { id: 'facebook', label: 'Facebook', icon: 'logo-facebook' },
  { id: 'youtube', label: 'YouTube', icon: 'logo-youtube' },
  { id: 'reddit', label: 'Reddit', icon: 'logo-reddit' },
  { id: 'ai', label: 'AI / ChatGPT', icon: 'sparkles-outline' },
  { id: 'friends', label: 'Friends', icon: 'people-outline' },
  { id: 'github', label: 'GitHub', icon: 'logo-github' },
  { id: 'linkedin', label: 'LinkedIn', icon: 'logo-linkedin' },
] as const;

function DiscoverySlide({
  colors,
  isDark,
  themeColors,
  onCanContinueChange,
}: {
  colors: OnboardingColors;
  isDark: boolean;
  themeColors: typeof Colors.dark;
  onCanContinueChange: (v: boolean) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    onCanContinueChange(selected !== null);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide colors={colors}
      illustration={
        <View
          style={[
            s.iconCircle,
            {
              backgroundColor: themeColors.blue,
              shadowColor: themeColors.blue,
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.35,
              shadowRadius: 24,
              elevation: 10,
            },
          ]}
        >
          <Ionicons name="chatbubbles" size={50} color={themeColors.textOnColor} />
        </View>
      }
    >
      <Text style={[s.headline, { color: colors.text }]}>How did you{'\n'}find us?</Text>
      <Text style={[s.body, { color: colors.subtext }]}>
        Helps us understand where people discover the app.
      </Text>
      <View style={s.chipsWrap}>
        {SOURCES.map((src) => {
          const active = selected === src.id;
          return (
            <TouchableOpacity
              key={src.id}
              onPress={() => {
                setSelected(src.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                s.chip,
                {
                  backgroundColor: active
                    ? Colors.indigo
                    : themeColors.chipInactive,
                  borderColor: active ? Colors.indigo : colors.border,
                },
              ]}
              activeOpacity={0.7}
            >
              <Ionicons
                name={src.icon as any}
                size={13}
                color={active ? themeColors.textOnColor : colors.subtext}
              />
              <Text style={[s.chipLabel, { color: active ? themeColors.textOnColor : colors.text }]}>
                {src.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Slide>
  );
}

function ThemeSlide({
  colors,
  isDark,
  themeColors,
  themeMode,
  setThemeMode,
}: {
  colors: OnboardingColors;
  isDark: boolean;
  themeColors: typeof Colors.dark;
  themeMode: ThemeMode;
  setThemeMode: (m: ThemeMode) => void;
}) {
  const THEMES: { id: ThemeMode; label: string; icon: string; desc: string }[] = [
    { id: 'light', label: 'Light', icon: 'sunny', desc: 'Bright & crisp' },
    { id: 'dark', label: 'Dark', icon: 'moon', desc: 'Easy on eyes' },
    { id: 'system', label: 'System', icon: 'phone-portrait', desc: 'Follows device' },
  ];

  return (
    <Slide colors={colors}
      illustration={
        <View style={{ flexDirection: 'row', gap: 18, alignItems: 'center' }}>
          <View
            style={[
              s.themeHalfCard,
              {
                backgroundColor: themeColors.onboardingIllustrationCard,
                shadowColor: Colors.shadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 6,
              },
            ]}
          >
            <Ionicons name="moon" size={32} color={Colors.indigoLight} />
          </View>
          <View
            style={[
              s.iconCircleSm,
              {
                backgroundColor: Colors.indigo,
                shadowColor: Colors.indigo,
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 14,
                elevation: 6,
              },
            ]}
          >
            <Ionicons name="contrast" size={22} color={themeColors.textOnColor} />
          </View>
          <View
            style={[
              s.themeHalfCard,
              {
                backgroundColor: themeColors.onboardingThemeCard,
                shadowColor: Colors.shadow,
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 16,
                elevation: 6,
              },
            ]}
          >
            <Ionicons name="sunny" size={32} color={themeColors.warning} />
          </View>
        </View>
      }
    >
      <Text style={[s.headline, { color: colors.text }]}>Choose{'\n'}your look.</Text>
      <Text style={[s.body, { color: colors.subtext }]}>
        Personalize the app. You can always change it in Settings.
      </Text>
      <View style={s.themeCards}>
        {THEMES.map((t) => {
          const active = themeMode === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => {
                setThemeMode(t.id);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={[
                s.themeCard,
                {
                  backgroundColor: themeColors.cardInactive,
                  borderColor: active ? Colors.indigo : 'transparent',
                  borderWidth: 2,
                },
              ]}
              activeOpacity={0.75}
            >
              {active && (
                <View style={s.themeCheck}>
                  <Ionicons name="checkmark-circle" size={17} color={Colors.indigo} />
                </View>
              )}
              <View
                style={[
                  s.themeIconCircle,
                  {
                    backgroundColor: active
                      ? Colors.indigo
                      : themeColors.iconCircleInactive,
                  },
                ]}
              >
                <Ionicons name={t.icon as any} size={20} color={active ? themeColors.textOnColor : colors.subtext} />
              </View>
              <Text style={[s.themeCardLabel, { color: colors.text }]}>{t.label}</Text>
              <Text style={[s.themeCardDesc, { color: colors.subtext }]}>{t.desc}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Slide>
  );
}

function ImportSlide({ colors, isDark, themeColors }: { colors: OnboardingColors; isDark: boolean; themeColors: typeof Colors.dark }) {
  const badge = themeColors.badgeFrosted;

  return (
    <Slide colors={colors}
      illustration={
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <View
            style={[
              s.iconCircle,
              {
                backgroundColor: themeColors.green,
                shadowColor: themeColors.green,
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.35,
                shadowRadius: 24,
                elevation: 10,
              },
            ]}
          >
            <Ionicons name="cloud-upload" size={50} color={themeColors.textOnColor} />
          </View>
          <View style={[s.fileTag, { backgroundColor: badge, position: 'absolute', top: -32, right: -78 }]}>
            <Text style={[s.fileTagText, { color: themeColors.error }]}>PDF</Text>
          </View>
          <View style={[s.fileTag, { backgroundColor: badge, position: 'absolute', top: -24, left: -80 }]}>
            <Text style={[s.fileTagText, { color: themeColors.green }]}>CSV</Text>
          </View>
          <View style={[s.fileTag, { backgroundColor: badge, position: 'absolute', bottom: -28, right: -78 }]}>
            <Text style={[s.fileTagText, { color: themeColors.blue }]}>XLS</Text>
          </View>
          <View style={[s.fileTag, { backgroundColor: badge, position: 'absolute', bottom: -20, left: -80 }]}>
            <Text style={[s.fileTagText, { color: themeColors.warning }]}>IMG</Text>
          </View>
        </View>
      }
    >
      <Text style={[s.headline, { color: colors.text }]}>Import your{'\n'}portfolio.</Text>
      <Text style={[s.body, { color: colors.subtext }]}>
        Drop a screenshot, CSV, PDF or any broker export. The app reads it instantly — no data stored in the cloud.
      </Text>
      <View style={s.formatRow}>
        {['Screenshot', 'PDF', 'CSV', 'Excel', 'JSON'].map((fmt) => (
          <View
            key={fmt}
            style={[
              s.formatChip,
              { backgroundColor: themeColors.cardInactiveAlt },
            ]}
          >
            <Text style={[s.formatChipText, { color: colors.text }]}>{fmt}</Text>
          </View>
        ))}
      </View>
    </Slide>
  );
}

function RateSlide({
  isActive,
  colors,
  isDark,
  themeColors,
  onCanCompleteChange,
}: {
  isActive: boolean;
  colors: OnboardingColors;
  isDark: boolean;
  themeColors: typeof Colors.dark;
  onCanCompleteChange: (v: boolean) => void;
}) {
  // 5 individual shared values (hooks cannot be called in a loop)
  const s0 = useSharedValue(0);
  const s1 = useSharedValue(0);
  const s2 = useSharedValue(0);
  const s3 = useSharedValue(0);
  const s4 = useSharedValue(0);

  const a0 = useAnimatedStyle(() => ({ opacity: s0.value, transform: [{ scale: s0.value }] }));
  const a1 = useAnimatedStyle(() => ({ opacity: s1.value, transform: [{ scale: s1.value }] }));
  const a2 = useAnimatedStyle(() => ({ opacity: s2.value, transform: [{ scale: s2.value }] }));
  const a3 = useAnimatedStyle(() => ({ opacity: s3.value, transform: [{ scale: s3.value }] }));
  const a4 = useAnimatedStyle(() => ({ opacity: s4.value, transform: [{ scale: s4.value }] }));

  const hasTriggered = useRef(false);

  useEffect(() => {
    if (!isActive || hasTriggered.current) return;
    hasTriggered.current = true;

    [s0, s1, s2, s3, s4].forEach((sv, i) => {
      sv.value = withDelay(i * 100, withTiming(1, { duration: 300 }));
    });

    const timer = setTimeout(async () => {
      try {
        const available = await StoreReview.isAvailableAsync();
        if (available) await StoreReview.requestReview();
      } catch {
        // Unavailable on simulator / quota exceeded
      }
      onCanCompleteChange(true);
    }, 800);

    return () => clearTimeout(timer);
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Slide colors={colors}
      illustration={
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {[a0, a1, a2, a3, a4].map((aStyle, i) => (
            <Animated.View key={i} style={aStyle}>
              <Ionicons name="star" size={40} color={themeColors.yellow} />
            </Animated.View>
          ))}
        </View>
      }
    >
      <Text style={[s.headline, { color: colors.text }]}>Loving{'\n'}the app?</Text>
      <Text style={[s.body, { color: colors.subtext }]}>
        A quick review makes a big difference — it helps others discover privacy-first finance tracking.
      </Text>
    </Slide>
  );
}

const SCREEN_W = Dimensions.get('window').width;
const SPRING = { damping: 22, stiffness: 200, mass: 0.8 };

export default function OnboardingScreen() {
  const [step, setStep] = useState(0);
  const [discoveryCanContinue, setDiscoveryCanContinue] = useState(false);
  const [canComplete, setCanComplete] = useState(false);
  const [pendingImport, setPendingImport] = useState(false);
  const pendingImportRef = useRef(false);
  const { colorScheme, themeMode, setThemeMode } = useTheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  // Shared value mirrors `step` so gesture worklets can read it without crossing the JS bridge
  const stepSV = useSharedValue(0);
  const translateX = useSharedValue(0);

  const themeColors = isDark ? Colors.dark : Colors.light;
  const colors: OnboardingColors = {
    bg: themeColors.onboardingBg,
    card: themeColors.onboardingCard,
    text: themeColors.onboardingText,
    subtext: themeColors.subtextMuted,
    border: themeColors.borderSubtle,
  };

  const animToStep = useCallback((target: number) => {
    setStep(target);
    stepSV.value = target;
    translateX.value = withSpring(-target * SCREEN_W, SPRING);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const complete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'true');
    await ensureSession();
    router.replace('/(tabs)');
    if (pendingImportRef.current) router.push('/import-transactions');
  }, []);

  const goNext = useCallback(
    (fromStep: number) => {
      const next = fromStep + 1;
      if (next >= STEP_COUNT) { complete(); return; }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animToStep(next);
    },
    [complete, animToStep],
  );

  const goBack = useCallback(() => {
    if (step > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      animToStep(step - 1);
    }
  }, [step, animToStep]);

  const goToRateForImport = useCallback(() => {
    pendingImportRef.current = true;
    setPendingImport(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    animToStep(STEP_COUNT - 1);
  }, [animToStep]);

  const panGesture = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      const base = -stepSV.value * SCREEN_W;
      const clamped = Math.max(-(STEP_COUNT - 1) * SCREEN_W, Math.min(0, base + e.translationX));
      translateX.value = clamped;
    })
    .onEnd((e) => {
      if (e.translationX > SCREEN_W * 0.3 && stepSV.value > 0) {
        const prev = stepSV.value - 1;
        stepSV.value = prev;
        translateX.value = withSpring(-prev * SCREEN_W, SPRING);
        runOnJS(setStep)(prev);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      } else {
        translateX.value = withSpring(-stepSV.value * SCREEN_W, SPRING);
      }
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  type FooterConfig = {
    primary: { label: string; onPress: () => void; disabled?: boolean };
    secondary: { label: string; onPress: () => void } | null;
  };

  const footerConfig = (): FooterConfig => {
    switch (step) {
      case 0:
        return { primary: { label: 'Get Started', onPress: () => goNext(0) }, secondary: null };
      case 1:
        return {
          primary: { label: 'Continue', onPress: () => goNext(1), disabled: !discoveryCanContinue },
          secondary: { label: 'Skip', onPress: () => goNext(1) },
        };
      case 2:
        return { primary: { label: 'Continue', onPress: () => goNext(2) }, secondary: null };
      case 3:
        return {
          primary: { label: 'Import Portfolio', onPress: goToRateForImport },
          secondary: { label: 'Set up later', onPress: () => goNext(3) },
        };
      case 4:
        return {
          primary: { label: pendingImport ? 'Continue to Import' : 'Finish', onPress: complete, disabled: !canComplete },
          secondary: null,
        };
      default:
        return { primary: { label: '', onPress: () => {} }, secondary: null };
    }
  };

  const { primary, secondary } = footerConfig();

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={{ height: insets.top }} />

      <View style={s.topBar}>
        {step > 0 ? (
          <TouchableOpacity
            onPress={goBack}
            activeOpacity={0.7}
            style={s.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        ) : (
          <View style={s.backBtn} />
        )}
      </View>

      {/* Clip so off-screen slides are invisible */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <GestureDetector gesture={panGesture}>
          <Animated.View style={[{ flexDirection: 'row', width: SCREEN_W * STEP_COUNT, flex: 1 }, rowStyle]}>
            <View style={{ width: SCREEN_W, flex: 1 }}>
              <WelcomeSlide colors={colors} isDark={isDark} themeColors={themeColors} />
            </View>
            <View style={{ width: SCREEN_W, flex: 1 }}>
              <DiscoverySlide colors={colors} isDark={isDark} themeColors={themeColors} onCanContinueChange={setDiscoveryCanContinue} />
            </View>
            <View style={{ width: SCREEN_W, flex: 1 }}>
              <ThemeSlide colors={colors} isDark={isDark} themeColors={themeColors} themeMode={themeMode} setThemeMode={setThemeMode} />
            </View>
            <View style={{ width: SCREEN_W, flex: 1 }}>
              <ImportSlide colors={colors} isDark={isDark} themeColors={themeColors} />
            </View>
            <View style={{ width: SCREEN_W, flex: 1 }}>
              <RateSlide isActive={step === 4} colors={colors} isDark={isDark} themeColors={themeColors} onCanCompleteChange={setCanComplete} />
            </View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View
        style={[
          s.footer,
          { backgroundColor: colors.bg, paddingBottom: Math.max(insets.bottom, 16) },
        ]}
      >
        <PrimaryButton {...primary} />
        <View style={s.secondarySlot}>
          {secondary && (
            <TouchableOpacity onPress={secondary.onPress} activeOpacity={0.7}>
              <Text style={[s.secondaryText, { color: colors.subtext }]}>{secondary.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Top bar
  topBar: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },

  // Slide
  slide: {
    flex: 1,
  },
  illustrationWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slideContent: {
    paddingHorizontal: 28,
    paddingBottom: 12,
  },

  // Icons
  iconCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSm: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Floating badges (Welcome & Import)
  floatBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  fileTag: {
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 9,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  fileTagText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Theme step
  themeHalfCard: {
    width: 82,
    height: 90,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Typography
  headline: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 38,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 20,
  },

  // Feature list (Welcome)
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 5,
  },
  featureIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Discovery chips
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Theme picker
  themeCards: {
    flexDirection: 'row',
    gap: 10,
  },
  themeCard: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    gap: 6,
    position: 'relative',
  },
  themeIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  themeCardLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  themeCardDesc: {
    fontSize: 11,
    textAlign: 'center',
  },
  themeCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
  },

  // Import formats
  formatRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  formatChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  formatChipText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Footer
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  secondarySlot: {
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Buttons
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: Colors.light.textOnColor,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
