import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatPercent, getValueColor, MASKED, usePortfolioSummary, useShowPortfolioValue } from '@/lib';
import React from 'react';
import { StyleSheet, View } from 'react-native';

export function PortfolioValueChart() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const portfolioData = usePortfolioSummary();
  const isVisible = useShowPortfolioValue();
  const neutralColor = isDark ? Colors.dark.text : Colors.light.text;

  return (
    <ThemedView
      style={[
        styles.container,
        {
          backgroundColor: isDark ? Colors.dark.cardBackground : Colors.light.cardBackground,
        }
      ]}
    >
      <View style={styles.header}>
        <ThemedText style={styles.label}>Portfolio Value</ThemedText>
        <ThemedText style={styles.value}>
          {isVisible ? formatCurrency(portfolioData.totalValue, 'never') : MASKED.currency}
        </ThemedText>
        <View style={styles.changeContainer}>
          <ThemedText style={[styles.change, { color: isVisible ? getValueColor(portfolioData.todayChange, neutralColor) : neutralColor }]}>
            {isVisible ? formatCurrency(portfolioData.todayChange, 'never') : MASKED.currency}
          </ThemedText>
          <ThemedText style={[styles.changePercent, { color: isVisible ? getValueColor(portfolioData.todayChange, neutralColor) : neutralColor }]}>
            ({isVisible ? formatPercent(portfolioData.todayChangePercent, 'exceptZero') : MASKED.percent})
          </ThemedText>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 8,
    paddingVertical: 16,
    borderRadius: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    paddingHorizontal: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
    marginBottom: 4,
  },
  value: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 42,
    marginBottom: 4,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  change: {
    fontSize: 15,
    fontWeight: '600',
  },
  changePercent: {
    fontSize: 15,
    fontWeight: '600',
  },
});
