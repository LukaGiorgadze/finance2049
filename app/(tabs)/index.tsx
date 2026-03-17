import { MarketChart } from '@/components/finance/MarketChart';
import { MarketStatus } from '@/components/finance/MarketStatus';
import { NewsFeed } from '@/components/finance/NewsFeed';
import { PortfolioSummary } from '@/components/finance/PortfolioSummary';
import { SearchBar } from '@/components/finance/SearchBar';
import { TopMovers } from '@/components/finance/TopMovers';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRefreshPortfolioPrices } from '@/lib';
import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { refresh } = useRefreshPortfolioPrices();
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
    await refresh();
    requestAnimationFrame(() => setRefreshing(false));
  }, [refresh]);

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: (isDark ? Colors.dark : Colors.light).surface }
    ]} edges={['top']}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors[colorScheme].icon}
            colors={[Colors[colorScheme].icon]}
          />
        }
      >
        {/* Market Comparison Chart */}
        <MarketChart refreshKey={refreshKey} />

        {/* Market Status */}
        <MarketStatus />

        {/* Search Bar */}
        <SearchBar />

        {/* Portfolio Summary */}
        <PortfolioSummary />

        {/* Top Movers */}
        <TopMovers refreshKey={refreshKey} />

        {/* Market Insights */}
        {/* <MarketInsights /> */}

        {/* News Feed */}
        <NewsFeed refreshKey={refreshKey} />

        {/* Bottom Padding */}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
    paddingBottom: 95,
  },
});
