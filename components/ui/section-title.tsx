import { ThemedText } from '@/components/themed-text';
import { StyleProp, StyleSheet, TextStyle } from 'react-native';

interface SectionTitleProps {
  children: React.ReactNode;
  style?: StyleProp<TextStyle>;
}

export function SectionTitle({ children, style }: SectionTitleProps) {
  return (
    <ThemedText style={[styles.title, style]}>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
