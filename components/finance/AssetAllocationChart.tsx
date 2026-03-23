import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackPortfolioAction, useAssetAllocation, useShowPortfolioValue } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export function AssetAllocationChart() {
  const [isExpanded, setIsExpanded] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const assetAllocation = useAssetAllocation();
  const isVisible = useShowPortfolioValue();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.sectionHeader, { marginBottom: isExpanded ? 12 : 0 }]}
        onPress={() => {
          void trackPortfolioAction({ action: 'asset_allocation_toggle', target: isExpanded ? 'collapse' : 'expand' });
          setIsExpanded(!isExpanded);
        }}
        activeOpacity={0.7}
      >
        <ThemedText style={styles.title}>Asset Allocation</ThemedText>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.icon}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.listContainer}>
          {assetAllocation.map((item) => (
            <View key={item.type} style={styles.listItem}>
              <View style={styles.listLeft}>
                <View style={[styles.listDot, { backgroundColor: item.color }]} />
                <ThemedText style={styles.listType}>{item.type}</ThemedText>
              </View>
              <View style={styles.listRight}>
                <ThemedText style={styles.listValue}>
                  {isVisible
                    ? `$${item.value.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '••••••'}
                </ThemedText>
                <ThemedText style={styles.listPercent}>
                  {`${item.percent.toFixed(2)}%`}
                </ThemedText>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 0.2,
    opacity: 0.85,
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  listLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  listType: {
    fontSize: 15,
    fontWeight: '400',
  },
  listRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  listPercent: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    minWidth: 50,
    textAlign: 'right',
  },
});
