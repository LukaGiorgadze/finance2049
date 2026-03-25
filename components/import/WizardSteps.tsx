import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

const STEPS = [
  { icon: 'cloud-upload-outline' as const, iconSize: 14, label: 'Upload' },
  { icon: 'pencil-outline' as const, iconSize: 13, label: 'Review\n& Edit' },
  { icon: 'checkmark' as const, iconSize: 15, label: 'Confirm' },
];

interface Props {
  currentStep: 1 | 2 | 3;
  isDark: boolean;
  colors: typeof Colors.light;
}

export function WizardSteps({ currentStep, isDark, colors }: Props) {
  return (
    <View style={s.row}>
      {STEPS.map((step, i) => {
        const num = i + 1;
        const active = num === currentStep;
        const done = num < currentStep;
        const dotBg = active || done ? Colors.indigo : colors.cardBorder;
        const iconColor = active || done ? colors.textOnColor : colors.icon;
        const labelColor = active ? colors.text : colors.icon;
        return (
          <React.Fragment key={step.label}>
            <View style={s.step}>
              <View style={[s.dot, { backgroundColor: dotBg }]}>
                <Ionicons name={step.icon} size={step.iconSize} color={iconColor} />
              </View>
              <Text style={[s.label, { color: labelColor }]}>{step.label}</Text>
            </View>
            {i < STEPS.length - 1 && (
              <View style={[s.line, { backgroundColor: colors.surfaceElevated }]} />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  step: { alignItems: 'center', width: 72, gap: 8 },
  line: { flex: 1, height: 1, marginTop: 16 },
  dot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '500', textAlign: 'center', lineHeight: 15 },
});
