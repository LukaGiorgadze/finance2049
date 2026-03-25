import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatPercent, getValueColor, trackHomeAction } from '@/lib';
import { useMarketSummary } from '@/lib/hooks/useMarketSummary';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

const TABS = [
  { key: 'INDEX',    label: 'Indices' },
  { key: 'FUTURE',   label: 'Futures' },
  { key: 'CURRENCY', label: 'Forex'   },
] as const;

type TabKey = typeof TABS[number]['key'];

export function MarketChart({ refreshKey = 0 }: { refreshKey?: number }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { items, loading, error } = useMarketSummary(refreshKey);
  const [activeTab, setActiveTab] = useState<TabKey>('INDEX');

  useEffect(() => {
    AsyncStorage.getItem('market-chart-tab').then((saved) => {
      if (saved && TABS.some((t) => t.key === saved)) {
        setActiveTab(saved as TabKey);
      }
    });
  }, []);

  function handleTabChange(key: TabKey) {
    void trackHomeAction({ action: 'market_chart_tab', target: key });
    setActiveTab(key);
    AsyncStorage.setItem('market-chart-tab', key);
  }

  const filtered = items.filter((item) => item.quoteType === activeTab);

  const neutralColor = isDark ? Colors.dark.text : Colors.light.text;

  return (
    <ThemedView lightColor="transparent" darkColor="transparent" style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <Pressable key={tab.key} onPress={() => handleTabChange(tab.key)} style={styles.tab}>
              <ThemedText style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {tab.label}
              </ThemedText>
              {isActive && <View style={styles.indicator} />}
            </Pressable>
          );
        })}
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="small" color={neutralColor} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {filtered.map((item) => (
            <View key={item.symbol} style={styles.card}>
              <ThemedText style={styles.name} numberOfLines={1}>
                {item.shortName}
              </ThemedText>
              <ThemedText style={styles.price} numberOfLines={1}>
                {item.price}
              </ThemedText>
              <ThemedText
                style={[
                  styles.change,
                  { color: getValueColor(item.changePercent, neutralColor) },
                ]}
              >
                {formatPercent(item.changePercent, 'exceptZero')}
              </ThemedText>
            </View>
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 0,
    padding: 8,
    borderRadius: 16,
  },
  tabBar: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  tab: {
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.1,
    opacity: 0.35,
  },
  tabLabelActive: {
    opacity: 1,
  },
  indicator: {
    height: 1,
    backgroundColor: Colors.light.blue,
    borderRadius: 1,
  },
  center: {
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 12,
    opacity: 0.4,
  },
  scrollContent: {
    gap: 12,
  },
  card: {
    minWidth: 82,
  },
  name: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.45,
  },
  price: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: -0.2,
  },
  change: {
    fontSize: 11,
    fontWeight: '400',
  },
});
