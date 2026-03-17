import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatPercent, getValueColor, MASKED, usePortfolioSummary, useShowPortfolioValue } from '@/lib';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export function PortfolioHighlights() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const portfolioData = usePortfolioSummary();
  const isVisible = useShowPortfolioValue();

  const totalInvested = portfolioData.totalValue - portfolioData.totalGain;
  const neutralColor = isDark ? Colors.dark.text : Colors.light.text;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        {/* Today's Return */}
        <View style={styles.block}>
          <ThemedText style={styles.label}>Today&apos;s Return</ThemedText>
          <ThemedText style={[styles.value, { color: isVisible ? getValueColor(portfolioData.todayChange, neutralColor) : neutralColor }]}>
            {isVisible ? formatCurrency(portfolioData.todayChange, 'never') : MASKED.currency}
          </ThemedText>
          <ThemedText style={[styles.percent, { color: isVisible ? getValueColor(portfolioData.todayChange, neutralColor) : neutralColor }]}>
            {isVisible ? formatPercent(portfolioData.todayChangePercent, 'exceptZero') : MASKED.percent}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: (isDark ? Colors.dark : Colors.light).surfaceElevated }]} />

        {/* Total Return */}
        <View style={styles.block}>
          <ThemedText style={styles.label}>Total Return</ThemedText>
          <ThemedText style={[styles.value, { color: isVisible ? getValueColor(portfolioData.totalGain, neutralColor) : neutralColor }]}>
            {isVisible ? formatCurrency(portfolioData.totalGain, 'never') : MASKED.currency}
          </ThemedText>
          <ThemedText style={[styles.percent, { color: isVisible ? getValueColor(portfolioData.totalGain, neutralColor) : neutralColor }]}>
            {isVisible ? formatPercent(portfolioData.totalGainPercent, 'exceptZero') : MASKED.percent}
          </ThemedText>
        </View>

        <View style={[styles.divider, { backgroundColor: (isDark ? Colors.dark : Colors.light).surfaceElevated }]} />

        {/* Principal & Market Value */}
        <View style={styles.block}>
          <ThemedText style={styles.label}>Cost Basis</ThemedText>
          <ThemedText style={styles.value}>
            {isVisible ? formatCurrency(totalInvested, 'never') : MASKED.currency}
          </ThemedText>
          <ThemedText style={styles.secondaryLabel}>
            Value: {isVisible ? formatCurrency(portfolioData.totalValue, 'never') : MASKED.currency}
          </ThemedText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  block: {
    flex: 1,
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  percent: {
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryLabel: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.6,
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 36,
  },
});
