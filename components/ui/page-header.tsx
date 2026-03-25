import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface PageHeaderProps {
  title: string;
  leftElement?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export function PageHeader({ title, leftElement, rightElement }: PageHeaderProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  return (
    <ThemedView style={styles.wrapper}>
      <View style={[styles.container, { paddingTop: insets.top + (Platform.OS === 'android' ? 22 : 12) }]}>
        {leftElement}
        <View style={styles.titleWrapper}>
          <ThemedText style={styles.title}>{title}</ThemedText>
        </View>
        {rightElement}
      </View>
      <View style={[
        styles.accent,
        { backgroundColor: colors.headerAccent }
      ]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  wrapper: {},
  container: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  titleWrapper: {
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 32,
  },
  accent: {
    height: 1,
    width: '100%',
  },
});
