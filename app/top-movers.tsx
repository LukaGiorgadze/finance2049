import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatPercent, getValueColor } from '@/lib';
import { reportError } from '@/lib/crashlytics';
import { marketDataService } from '@/lib/services/marketDataService';
import type { StockQuote } from '@/lib/services/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

type FilterType = 'all' | 'gainers' | 'losers';

export default function TopMoversScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const [gainers, setGainers] = useState<StockQuote[]>([]);
  const [losers, setLosers] = useState<StockQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const colors = isDark ? Colors.dark : Colors.light;
  const textColor = colors.text;

  const fetchTopMovers = useCallback(async () => {
    try {
      const [gainersData, losersData] = await Promise.all([
        marketDataService.getTopMovers('gainers'),
        marketDataService.getTopMovers('losers'),
      ]);
      setGainers(gainersData);
      setLosers(losersData);
    } catch (error) {
      reportError('Failed to fetch top movers', error);
    }
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTopMovers();
    requestAnimationFrame(() => setRefreshing(false));
  }, [fetchTopMovers]);

  useEffect(() => {
    setIsLoading(true);
    fetchTopMovers().finally(() => setIsLoading(false));
  }, [fetchTopMovers]);

  const filteredStocks = useMemo(() => {
    let stocks: StockQuote[] = [];

    if (selectedFilter === 'gainers') {
      stocks = gainers;
    } else if (selectedFilter === 'losers') {
      stocks = losers;
    } else {
      stocks = [...gainers, ...losers];
    }

    return stocks.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  }, [selectedFilter, gainers, losers]);

  const renderStockItem = (item: StockQuote, index: number) => {
    const hasBrandColor = !!BRAND_COLORS[item.symbol];
    const brandColor = BRAND_COLORS[item.symbol] || colors.surface;
    const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;
    const showDivider = index !== filteredStocks.length - 1;

    return (
      <TouchableOpacity
        style={[
          styles.stockRow,
          showDivider && {
            borderBottomWidth: 1,
            borderBottomColor: colors.cardBorder,
          }
        ]}
        activeOpacity={0.7}
        onPress={() => router.push(`/stock/${item.symbol}`)}
      >
        <View style={styles.leftSection}>
          {/* Ticker Symbol Badge with Brand Color */}
          <View style={[
            styles.symbolBadge,
            { backgroundColor: brandColor }
          ]}>
            <ThemedText style={[
              styles.symbolBadgeText,
              { color: badgeTextColor }
            ]}>
              {item.symbol}
            </ThemedText>
          </View>

          <View style={styles.stockInfo}>
            <ThemedText style={styles.companyName} numberOfLines={1}>
              {item.name || item.symbol}
            </ThemedText>
            {item.exchange && (
              <ThemedText style={styles.exchange}>{item.exchange}</ThemedText>
            )}
          </View>
        </View>

        <View style={styles.rightSection}>
          <ThemedText style={styles.price}>
            {formatCurrency(item.price, 'never')}
          </ThemedText>
          <ThemedText style={[
            styles.changeAmount,
            { color: getValueColor(item.changePercent, isDark ? Colors.dark.text : Colors.light.text) }
          ]}>
            {formatPercent(item.changePercent, 'exceptZero')}
          </ThemedText>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title="Top Movers"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
        }
      />

      {/* Filter Tabs - Fixed at top */}
      <View style={styles.filterContainer}>
        <View style={[
          styles.segmentedControl,
          { backgroundColor: colors.divider }
        ]}>
          <TouchableOpacity
            style={[
              styles.segment,
              selectedFilter === 'all' && {
                backgroundColor: colors.surfaceElevated
              }
            ]}
            onPress={() => setSelectedFilter('all')}
          >
            <ThemedText style={[
              styles.segmentText,
              { opacity: selectedFilter === 'all' ? 1 : 0.5 }
            ]}>
              All
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segment,
              selectedFilter === 'gainers' && {
                backgroundColor: colors.surfaceElevated
              }
            ]}
            onPress={() => setSelectedFilter('gainers')}
          >
            <View style={styles.segmentContent}>
              <Ionicons
                name="trending-up"
                size={11}
                color={selectedFilter === 'gainers' ? colors.green : colors.text}
                style={{ opacity: selectedFilter === 'gainers' ? 1 : 0.5 }}
              />
              <ThemedText style={[
                styles.segmentText,
                { opacity: selectedFilter === 'gainers' ? 1 : 0.5 }
              ]}>
                Gainers
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segment,
              selectedFilter === 'losers' && {
                backgroundColor: colors.surfaceElevated
              }
            ]}
            onPress={() => setSelectedFilter('losers')}
          >
            <View style={styles.segmentContent}>
              <Ionicons
                name="trending-down"
                size={11}
                color={selectedFilter === 'losers' ? colors.red : colors.text}
                style={{ opacity: selectedFilter === 'losers' ? 1 : 0.5 }}
              />
              <ThemedText style={[
                styles.segmentText,
                { opacity: selectedFilter === 'losers' ? 1 : 0.5 }
              ]}>
                Losers
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Stock List */}
      <ScrollView
        style={styles.listWrapper}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        <View style={[
          styles.listContainer,
          {
            backgroundColor: colors.cardBackground,
          }
        ]}>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.text} />
              <ThemedText style={styles.loadingText}>Loading market movers...</ThemedText>
            </View>
          ) : filteredStocks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ThemedText style={styles.emptyText}>Markets are taking a breather — no big movers yet. Swing by later! 🏃‍♂️</ThemedText>
            </View>
          ) : (
            filteredStocks.map((item, index) => (
              <React.Fragment key={`${item.symbol}-${index}`}>
                {renderStockItem(item, index)}
              </React.Fragment>
            ))
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listWrapper: {
    flex: 1,
    paddingHorizontal: 20,
  },
  listContainer: {
    borderRadius: 12,
    marginBottom: 30,
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 16,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  symbolBadge: {
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stockInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 14,
    fontWeight: '600',
  },
  exchange: {
    fontSize: 10,
    opacity: 0.5,
    marginTop: 1,
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
  price: {
    fontSize: 14,
    fontWeight: '600',
  },
  changeAmount: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 16,
    height: 200,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  emptyContainer: {
    flex: 1,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    paddingHorizontal: 30,
    textAlign: 'center',
    fontSize: 16,
    opacity: 0.6,
  },
});
