import { ThemedText } from '@/components/themed-text';
import { SectionTitle } from '@/components/ui/section-title';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatPercent, getValueColor } from '@/lib';
import { reportError } from '@/lib/crashlytics';
import { marketDataService } from '@/lib/services/marketDataService';
import type { StockQuote } from '@/lib/services/types';
import { getAccessToken } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

export function TopMovers({ refreshKey = 0 }: { refreshKey?: number }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const [allMovers, setAllMovers] = useState<StockQuote[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchTopMovers() {
      const token = await getAccessToken();
      if (!token) { setIsLoading(false); return; }

      try {
        // Fetch both gainers and losers in parallel
        const [gainersData, losersData] = await Promise.all([
          marketDataService.getTopMovers('gainers'),
          marketDataService.getTopMovers('losers'),
        ]);

        // Combine and sort by absolute percentage change
        const combined = [...gainersData, ...losersData]
          .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
          .slice(0, 10);

        setAllMovers(combined);
      } catch (error) {
        reportError('Failed to fetch top movers', error, {
          surface: 'home_widget',
          refreshKey,
        });
        setAllMovers([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchTopMovers();
  }, [refreshKey]);

  return (
    <View style={styles.container}>
      <View style={styles.sectionHeader}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: colors.divider }]}>
            <Ionicons name="pulse" size={16} color={colors.text} />
          </View>
          <SectionTitle style={styles.sectionTitle}>Top Movers</SectionTitle>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => router.push('/top-movers')}
        >
          <ThemedText style={styles.moreText}>More</ThemedText>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.icon}
          />
        </TouchableOpacity>
      </View>

      <View style={[
        styles.listContainer,
        {
          backgroundColor: colors.cardBackground,
        }
      ]}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.text} />
          </View>
        ) : allMovers.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>Markets are taking a breather — no big movers yet. Swing by later! 🏃‍♂️</ThemedText>
          </View>
        ) : (
          allMovers.map((stock, index) => (
            <StockRow
              key={stock.symbol}
              stock={stock}
              colors={colors}
              showDivider={index < allMovers.length - 1}
            />
          ))
        )}
      </View>
    </View>
  );
}

interface StockRowProps {
  stock: StockQuote;
  colors: typeof Colors.light;
  showDivider: boolean;
}

function StockRow({ stock, colors, showDivider }: StockRowProps) {
  const hasBrandColor = !!BRAND_COLORS[stock.symbol];
  const brandColor = BRAND_COLORS[stock.symbol] || colors.surface;
  const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;

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
      onPress={() => router.push(`/stock/${stock.symbol}`)}
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
            {stock.symbol}
          </ThemedText>
        </View>

        <View style={styles.stockInfo}>
          <ThemedText style={styles.companyName} numberOfLines={1}>
            {stock.name || stock.symbol}
          </ThemedText>
          {stock.exchange && (
            <ThemedText style={styles.exchange}>{stock.exchange}</ThemedText>
          )}
        </View>
      </View>

      <View style={styles.rightSection}>
        <ThemedText style={styles.price}>
          {formatCurrency(stock.price, 'never')}
        </ThemedText>
        <ThemedText style={[
          styles.changeAmount,
          { color: getValueColor(stock.changePercent, colors.icon) }
        ]}>
          {formatPercent(stock.changePercent, 'exceptZero')}
        </ThemedText>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.6,
  },
  listContainer: {
    borderRadius: 12,
    overflow: 'hidden',
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
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    paddingHorizontal: 30,
    fontSize: 14,
    opacity: 0.5,
    textAlign: 'center',
  },
});
