import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { TickerAnalyticsModal } from '@/components/finance/TickerAnalyticsModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  formatCurrency,
  formatDate,
  formatPercent,
  getValueColor,
  MASKED,
  recalculatePortfolio,
  trackStatisticsAction,
  trackStatisticsScreen,
  useRefreshPortfolioPrices,
  useShowPortfolioValue,
} from '@/lib';
import type { InvestmentAnalytics, RealizedGain, RecentClosedTrade, TickerStat } from '@/lib/hooks/useAnalytics';
import { useInvestmentAnalytics } from '@/lib/hooks/useAnalytics';
import { Ionicons } from '@expo/vector-icons';
import {
  DashPathEffect,
  matchFont,
  Line as SkiaLine,
  vec,
} from '@shopify/react-native-skia';
import { router } from 'expo-router';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { Bar, CartesianChart, useChartPressState } from 'victory-native';

type TickerFilter = 'all' | 'winners' | 'losers';

// ============================================================================
// Sub-components
// ============================================================================

function SectionCard({
  children,
  isDark,
  style,
  noBorder = false,
  title,
  dividerColor,
}: {
  children: React.ReactNode;
  isDark: boolean;
  style?: object;
  noBorder?: boolean;
  title?: string;
  dividerColor?: string;
}) {
  const colors = isDark ? Colors.dark : Colors.light;
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.cardBackground,
          ...(noBorder ? {} : { borderWidth: 1, borderColor: colors.cardBorder }),
        },
        style,
      ]}
    >
      {title && (
        <ThemedText style={[styles.sectionTitle, { borderColor: dividerColor ?? colors.cardBorder }]}>
          {title}
        </ThemedText>
      )}
      {children}
    </View>
  );
}

const StreakAndRecent = memo(function StreakAndRecent({
  streak,
  trades,
  isDark,
  dividerColor,
  isVisible,
  neutralColor,
}: {
  streak: number;
  trades: RecentClosedTrade[];
  isDark: boolean;
  dividerColor: string;
  isVisible: boolean;
  neutralColor: string;
}) {
  const isWinStreak = streak > 0;
  const streakCount = Math.abs(streak);

  const colors = isDark ? Colors.dark : Colors.light;
  const streakEmoji = streakCount >= 5 ? '🔥' : streakCount >= 3 ? '⚡' : isWinStreak ? '✓' : '✗';
  const streakLabel = isWinStreak
    ? streakCount === 1 ? 'Last trade was a win' : `${streakCount}-win streak`
    : streakCount === 1 ? 'Last trade was a loss' : `${streakCount}-loss streak`;
  const streakColor = isWinStreak ? colors.green : colors.red;
  const streakBg = isWinStreak ? colors.greenBg : colors.redBg;
  const streakBorder = isWinStreak ? colors.greenBorder : colors.redBorder;

  return (
    <View style={styles.streakSection}>
      {streak !== 0 && (
        <View style={[styles.streakBadge, { backgroundColor: streakBg, borderColor: streakBorder }]}>
          <ThemedText style={[styles.streakEmoji, { color: streakColor }]}>{streakEmoji}</ThemedText>
          <View style={styles.streakText}>
            <ThemedText style={[styles.streakLabel, { color: streakColor }]}>
              {streakLabel}
            </ThemedText>
            <ThemedText style={styles.streakSub}>
              {isWinStreak ? 'Keep it up — close your next winner' : 'Turn it around with your next trade'}
            </ThemedText>
          </View>
        </View>
      )}

      {trades.length > 0 && (
        <View style={styles.recentSection}>
          <ThemedText style={styles.recentTitle}>Recent Closes</ThemedText>
          {trades.map((trade, i) => {
            const isWin = trade.realizedGain > 0;
            const gainColor = isVisible ? getValueColor(trade.realizedGain, neutralColor) : neutralColor;
            return (
              <View key={`${trade.symbol}-${trade.date}-${i}`}>
                {i > 0 && <View style={[styles.recentDivider, { backgroundColor: dividerColor }]} />}
                <View style={styles.recentRow}>
                  <View style={[styles.recentDot, { backgroundColor: isWin ? colors.green : colors.red }]} />
                  <View style={[styles.symbolBadge, { backgroundColor: BRAND_COLORS[trade.symbol] || (isDark ? colors.cardBorder : colors.divider) }]}>
                    <ThemedText style={[styles.symbolBadgeText, { color: !!BRAND_COLORS[trade.symbol] ? colors.textOnColor : colors.text }]}>
                      {trade.symbol}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.recentDate}>{formatDate(trade.date)}</ThemedText>
                  <View style={styles.recentRight}>
                    <ThemedText style={[styles.recentGain, { color: gainColor }]}>
                      {isVisible ? formatCurrency(trade.realizedGain, 'exceptZero') : MASKED.currency}
                    </ThemedText>
                    {isVisible && (
                      <ThemedText style={[styles.recentPct, { color: gainColor }]}>
                        {formatPercent(trade.realizedGainPercent, 'exceptZero')}
                      </ThemedText>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
});

const ActivityGrid = memo(function ActivityGrid({
  analytics,
  isDark,
  isVisible,
}: {
  analytics: InvestmentAnalytics;
  isDark: boolean;
  isVisible: boolean;
}) {
  type Tile = {
    icon: React.ComponentProps<typeof Ionicons>['name'];
    value: string;
    label: string;
    valueColor?: string;
  };

  const colors = isDark ? Colors.dark : Colors.light;
  const tiles: Tile[] = [
    { icon: 'swap-horizontal-outline', value: String(analytics.totalTransactions), label: 'Total trades' },
    { icon: 'pie-chart-outline', value: String(analytics.tickerStats.length), label: 'Unique assets' },
    { icon: 'arrow-up-outline', value: String(analytics.totalBuyTransactions), label: 'Buy orders', valueColor: colors.green },
    { icon: 'arrow-down-outline', value: String(analytics.totalSellTransactions), label: 'Sell orders', valueColor: analytics.totalSellTransactions > 0 ? colors.red : undefined },
    { icon: 'cash-outline', value: isVisible ? formatCurrency(analytics.avgBuyAmount, 'never') : MASKED.currency, label: 'Avg buy size' },
    { icon: 'timer-outline', value: analytics.investingFrequency, label: 'Frequency' },
    ...(analytics.totalCommissions > 0
      ? [{ icon: 'receipt-outline' as const, value: isVisible ? formatCurrency(analytics.totalCommissions, 'never') : MASKED.currency, label: 'Fees paid' }]
      : []),
    ...(analytics.mostTradedSymbol
      ? [{ icon: 'star-outline' as const, value: analytics.mostTradedSymbol, label: `Most traded · ${analytics.mostTradedSymbolCount}x` }]
      : []),
    ...(analytics.mostActiveMonth
      ? [{ icon: 'calendar-outline' as const, value: analytics.mostActiveMonth, label: 'Peak month' }]
      : []),
  ];

  // Keep count even so no lone tile appears
  const evenTiles = tiles.length % 2 === 0 ? tiles : tiles.slice(0, tiles.length - 1);
  const rows: Tile[][] = [];
  for (let i = 0; i < evenTiles.length; i += 2) {
    rows.push(evenTiles.slice(i, i + 2));
  }

  const tileBg = colors.cardBackground;
  const tileBorder = colors.cardBorder;

  return (
    <View style={styles.activityGrid}>
      <ThemedText style={styles.activityGridTitle}>Activity</ThemedText>
      <View style={styles.activityGridRows}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.activityGridRow}>
            {row.map((tile, ti) => (
              <View key={ti} style={[styles.activityTile, { backgroundColor: tileBg, borderColor: tileBorder }]}>
                <Ionicons
                  name={tile.icon}
                  size={13}
                  color={tile.valueColor ?? colors.iconMuted}
                />
                <ThemedText
                  style={[styles.activityTileValue, tile.valueColor ? { color: tile.valueColor } : undefined]}
                  numberOfLines={2}
                >
                  {tile.value}
                </ThemedText>
                <ThemedText style={styles.activityTileLabel}>{tile.label}</ThemedText>
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
});

const TickerRow = memo(function TickerRow({
  ticker,
  isDark,
  isVisible,
  neutralColor,
}: {
  ticker: TickerStat;
  isDark: boolean;
  isVisible: boolean;
  neutralColor: string;
}) {
  const colors = isDark ? Colors.dark : Colors.light;
  const gainColor = isVisible ? getValueColor(ticker.totalReturn, neutralColor) : neutralColor;
  const hasBrandColor = !!BRAND_COLORS[ticker.symbol];
  const badgeBg = BRAND_COLORS[ticker.symbol] || (isDark ? colors.cardBorder : colors.divider);
  const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;

  const isPositive = ticker.totalReturn >= 0;
  const barColor = isPositive ? colors.green : colors.red;
  // Bar = absolute ROI percentage, capped at 100%
  const roiPercent = Math.abs(ticker.totalReturnPercent);
  const barWidth = Math.min(roiPercent, 100);

  const subParts: string[] = [];
  if (ticker.sellCount > 0) subParts.push(`${ticker.sellCount} closed`);
  if (ticker.isHeld) subParts.push('holding');

  const fillOpacity = isDark ? 0.5 : 0.35;

  return (
    <View style={styles.tickerOuter}>
      <View style={styles.tickerContent}>
        <View style={styles.tickerNameRow}>
          <View style={[styles.symbolBadge, { backgroundColor: badgeBg }]}>
            <ThemedText style={[styles.symbolBadgeText, { color: badgeTextColor }]}>
              {ticker.symbol}
            </ThemedText>
          </View>
          <ThemedText style={[styles.tickerName, { color: colors.text }]} numberOfLines={1}>{ticker.name || ticker.symbol}</ThemedText>
          <ThemedText style={[styles.tickerGain, { color: gainColor }]}>
            {isVisible ? formatCurrency(ticker.totalReturn, 'exceptZero') : MASKED.currency}
          </ThemedText>
        </View>

        {isVisible && ticker.totalReturnPercent !== 0 && (
          <View style={styles.barContainer}>
            <View style={[styles.barTrack, { backgroundColor: colors.cardBorder }]}>
              <View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: barColor, opacity: fillOpacity }]} />
            </View>
            <View style={[styles.barLabelWrap, { backgroundColor: colors.cardBackground }]}>
              <ThemedText style={[styles.barLabel, { color: gainColor }]}>
                {formatPercent(ticker.totalReturnPercent, 'exceptZero')}
              </ThemedText>
            </View>
          </View>
        )}

        {subParts.length > 0 && (
          <ThemedText style={styles.tickerSub}>{subParts.join(' · ')}</ThemedText>
        )}
      </View>

      <Ionicons name="chevron-forward" size={14} color={colors.iconMuted} />
    </View>
  );
});

// ============================================================================
// Monthly P&L Chart
// ============================================================================

type PnLRange = '1W' | '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'All';
const PNL_RANGES: PnLRange[] = ['1W', '1M', '3M', '6M', 'YTD', '1Y', 'All'];

function filterRealizedGains(gains: RealizedGain[], range: PnLRange): RealizedGain[] {
  if (range === 'All') return gains;
  const now = new Date();
  let cutoff: Date;
  if (range === '1W') {
    cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  } else if (range === '1M') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  } else if (range === '3M') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 3, 1);
  } else if (range === '6M') {
    cutoff = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  } else if (range === '1Y') {
    cutoff = new Date(now.getFullYear() - 1, now.getMonth(), 1);
  } else {
    // YTD
    cutoff = new Date(now.getFullYear(), 0, 1);
  }
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  const cutoffKey = `${y}-${m}-${d}`;
  return gains.filter((g) => g.dateKey >= cutoffKey);
}

const RealizedPnLChart = memo(function RealizedPnLChart({
  realizedGains,
  isDark,
}: {
  realizedGains: RealizedGain[];
  isDark: boolean;
}) {
  const colors = isDark ? Colors.dark : Colors.light;
  const [pnlRange, setPnlRange] = useState<PnLRange>('1M');

  const filteredGains = useMemo(
    () => filterRealizedGains(realizedGains, pnlRange),
    [realizedGains, pnlRange],
  );

  const font = Platform.OS !== 'web' ? matchFont({
    fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
    fontSize: 10,
    fontWeight: '400',
  }) : undefined;

  // Gesture & tooltip state
  const { state, isActive } = useChartPressState({ x: -1, y: { gain: 0, loss: 0 } });
  const chartTop = useSharedValue(0);
  const chartBottom = useSharedValue(0);
  const actionsRef = useRef<any>(null);

  const crosshairP1 = useDerivedValue(() => vec(state.x.position.value, chartTop.value));
  const crosshairP2 = useDerivedValue(() => vec(state.x.position.value, chartBottom.value));

  const [tooltipData, setTooltipData] = useState<{ value: number; label: string; screenX: number } | null>(null);

  const filteredGainsRef = useRef(filteredGains);
  filteredGainsRef.current = filteredGains;

  const onTooltipUpdate = useCallback((idx: number, screenX: number) => {
    const data = filteredGainsRef.current;
    if (idx >= 0 && idx < data.length) {
      setTooltipData({ value: data[idx].gain, label: data[idx].label, screenX });
    }
  }, []);

  useAnimatedReaction(
    () => state.x.value.value,
    (currentX, previousX) => {
      'worklet';
      if (previousX != null && currentX !== previousX) {
        const idx = Math.round(currentX);
        const screenX = state.x.position.value;
        runOnJS(onTooltipUpdate)(idx, screenX);
      }
    },
  );

  // Tap gesture — show tooltip on single tap
  const handleTap = useCallback((x: number, y: number) => {
    actionsRef.current?.handleTouch(state, x, y);
  }, [state]);

  const tapGesture = useMemo(() =>
    Gesture.Tap().onStart((e) => {
      'worklet';
      state.isActive.value = true;
      runOnJS(handleTap)(e.x, e.y);
    }),
    [state, handleTap],
  );

  const composedGesture = useMemo(() => Gesture.Race(tapGesture), [tapGesture]);

  // Clear tooltip when range changes (tooltip persists after tap/pan)
  useEffect(() => {
    setTooltipData(null);
  }, [pnlRange]);

  if (Platform.OS === 'web' || realizedGains.length === 0) return null;

  // Short labels for x-axis (e.g. "Feb 8"), full labels for tooltip
  const axisLabels = filteredGains.map((m) => {
    // dateKey is "YYYY-MM-DD", extract short "Mon D"
    const [, mo, d] = m.dateKey.split('-').map(Number);
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[mo - 1]} ${d}`;
  });
  const chartData = filteredGains.map((m, i) => ({
    x: i,
    gain: m.gain >= 0 ? m.gain : 0,
    loss: m.gain < 0 ? m.gain : 0,
  }));

  const maxGain = Math.max(...filteredGains.map((m) => m.gain), 1);
  const minGain = Math.min(...filteredGains.map((m) => m.gain), -1);
  const range = maxGain - minGain;
  const pad = Math.max(range * 0.15, 1);

  const gridColor = colors.cardBorder;
  const labelColor = colors.iconMuted;

  return (
    <View>
      <View style={styles.pnlChartWrapper}>
        <CartesianChart
          key={pnlRange}
          data={chartData}
          xKey="x"
          yKeys={['gain', 'loss'] as const}
          chartPressState={state}
          customGestures={composedGesture}
          actionsRef={actionsRef}
          domain={{ x: [-0.5, chartData.length - 0.5], y: [minGain - pad, maxGain + pad] }}
          onChartBoundsChange={({ top, bottom }) => {
            chartTop.value = top;
            chartBottom.value = bottom;
          }}
          xAxis={{
            font,
            tickValues: chartData.map((_, i) => i),
            labelOffset: 4,
            labelPosition: 'outset',
            axisSide: 'bottom',
            lineWidth: 0,
            labelColor: labelColor,
            formatXLabel: (value) => {
              'worklet';
              const index = Math.round(value);
              return axisLabels[index] ?? '';
            },
          }}
          yAxis={[{
            font,
            tickCount: 3,
            labelOffset: 4,
            labelPosition: 'outset',
            axisSide: 'left',
            lineWidth: 1,
            lineColor: gridColor,
            labelColor: labelColor,
            formatYLabel: (value) => {
              'worklet';
              const abs = Math.abs(value);
              const sign = value < 0 ? '-' : '';
              if (abs >= 1000) return `${sign}$${Math.round(abs / 1000)}k`;
              if (abs === 0) return '$0';
              if (abs < 1) return `${sign}$${abs.toFixed(2)}`;
              return `${sign}$${Math.round(abs)}`;
            },
          }]}
          frame={{ lineWidth: 0 }}
          domainPadding={{ left: 16, right: 16 }}
        >
          {({ points, chartBounds }) => (
            <>
              <Bar
                points={points.gain}
                chartBounds={chartBounds}
                color={colors.green}
                roundedCorners={{ topLeft: 4, topRight: 4 }}
                barCount={Math.max(chartData.length, 5)}
              />
              <Bar
                points={points.loss}
                chartBounds={chartBounds}
                color={colors.red}
                roundedCorners={{ bottomLeft: 4, bottomRight: 4 }}
                barCount={Math.max(chartData.length, 5)}
              />
              {isActive && (
                <SkiaLine
                  p1={crosshairP1}
                  p2={crosshairP2}
                  color={colors.crosshairMuted}
                  strokeWidth={StyleSheet.hairlineWidth}
                >
                  <DashPathEffect intervals={[6, 4]} />
                </SkiaLine>
              )}
            </>
          )}
        </CartesianChart>

        {tooltipData && (
          <View
            pointerEvents="none"
            style={[
              styles.pnlTooltip,
              {
                left: tooltipData.screenX,
                backgroundColor: colors.tooltipBg,
                borderColor: colors.tooltipBorder,
              },
            ]}
          >
            <ThemedText
              style={[
                styles.pnlTooltipValue,
                { color: tooltipData.value >= 0 ? colors.green : colors.red },
              ]}
            >
              {formatCurrency(tooltipData.value, 'exceptZero')}
            </ThemedText>
            <ThemedText style={styles.pnlTooltipLabel}>
              {tooltipData.label}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={[styles.pnlTimelineRow, { borderTopColor: colors.divider }]}>
        {PNL_RANGES.map((r) => (
          <TouchableOpacity
            key={r}
            onPress={() => {
              void trackStatisticsAction({ action: 'pnl_range_change', target: r });
              setPnlRange(r);
            }}
            style={[
              styles.pnlTimelineButton,
              {
                backgroundColor:
                  pnlRange === r
                    ? colors.cardBorder
                    : 'transparent',
              },
            ]}
          >
            <ThemedText
              style={[
                styles.pnlTimelineText,
                {
                  opacity: pnlRange === r ? 1 : 0.5,
                  fontWeight: pnlRange === r ? '700' : '600',
                },
              ]}
            >
              {r}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
});

// ============================================================================
// Screen
// ============================================================================

export default function StatisticsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const analytics = useInvestmentAnalytics();
  const isVisible = useShowPortfolioValue();
  const [tickerFilter, setTickerFilter] = useState<TickerFilter>('all');
  const [selectedTicker, setSelectedTicker] = useState<TickerStat | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const { refresh } = useRefreshPortfolioPrices();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    void trackStatisticsScreen();
  }, []);

  const handleSelectAsset = useCallback((asset: { symbol: string }) => {
    void trackStatisticsAction({ action: 'search_select_asset', target: asset.symbol });
    setSearchVisible(false);
    router.push(`/stock/${asset.symbol}`);
  }, []);

  const onRefresh = useCallback(async () => {
    void trackStatisticsAction({ action: 'refresh' });
    setRefreshing(true);
    // Recalculate portfolio to fix any data inconsistencies from out-of-order entries
    recalculatePortfolio();
    await refresh();
    requestAnimationFrame(() => setRefreshing(false));
  }, [refresh]);

  const colors = isDark ? Colors.dark : Colors.light;
  const neutralColor = colors.text;
  const dividerColor = colors.divider;

  const filteredTickers = useMemo(() => analytics.tickerStats.filter((t) => {
    if (tickerFilter === 'winners') return t.totalReturn > 0;
    if (tickerFilter === 'losers') return t.totalReturn < 0;
    return true;
  }), [analytics.tickerStats, tickerFilter]);

  const searchRightElement = (
    <TouchableOpacity
      onPress={() => {
        void trackStatisticsAction({ action: 'search_open' });
        setSearchVisible(true);
      }}
      style={[styles.searchButton ]}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="search" size={20} color={colors.icon} />
    </TouchableOpacity>
  );

  if (analytics.totalBuyTransactions === 0) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
        <View style={styles.safeArea}>
          <PageHeader title="Analytics" rightElement={searchRightElement} />
          <View style={styles.emptyState}>
            <Ionicons
              name="bar-chart-outline"
              size={56}
              color={colors.iconMuted}
              style={{ marginBottom: 16 }}
            />
            <ThemedText style={styles.emptyTitle}>No Data Yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Add your first transaction to start tracking performance.
            </ThemedText>
          </View>
        </View>
        <AssetSearchModal
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelectAsset={handleSelectAsset}
        />
      </ThemedView>
    );
  }


  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.safeArea}>
        <PageHeader title="Analytics" rightElement={searchRightElement} />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.text}
              colors={[colors.text]}
            />
          }
        >
          {/* ── Hero Card (no border, matches PortfolioValueChart) ── */}
          <SectionCard isDark={isDark} noBorder>
            {analytics.firstInvestmentDate && (
              <ThemedText style={styles.sinceLabel}>
                Investing since {formatDate(analytics.firstInvestmentDate)}
                {'  ·  '}
                {analytics.investingDuration}
              </ThemedText>
            )}

            <ThemedText
              style={[
                styles.heroNumber,
                { color: isVisible ? getValueColor(analytics.totalReturn, neutralColor) : neutralColor },
              ]}
            >
              {isVisible ? formatCurrency(analytics.totalReturn, 'exceptZero') : MASKED.currency}
            </ThemedText>
            <ThemedText style={styles.heroNumberLabel}>All-time gain / loss</ThemedText>

            <View style={[styles.divider, { backgroundColor: dividerColor, marginVertical: 16 }]} />

            <View style={styles.threeCol}>
              <View style={styles.colStat}>
                <ThemedText style={styles.colLabel}>Realized</ThemedText>
                <ThemedText
                  style={[
                    styles.colValue,
                    { color: isVisible ? getValueColor(analytics.totalRealizedGain, neutralColor) : neutralColor },
                  ]}
                >
                  {isVisible ? formatCurrency(analytics.totalRealizedGain, 'exceptZero') : MASKED.currency}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.colPercent,
                    { color: isVisible ? getValueColor(analytics.totalRealizedGain, neutralColor) : neutralColor },
                  ]}
                >
                  {isVisible ? formatPercent(analytics.totalRealizedGainPercent, 'exceptZero') : MASKED.percent}
                </ThemedText>
              </View>

              <View style={[styles.colDivider, { backgroundColor: dividerColor }]} />

              <View style={styles.colStat}>
                <ThemedText style={styles.colLabel}>Unrealized</ThemedText>
                <ThemedText
                  style={[
                    styles.colValue,
                    { color: isVisible ? getValueColor(analytics.totalUnrealizedGain, neutralColor) : neutralColor },
                  ]}
                >
                  {isVisible ? formatCurrency(analytics.totalUnrealizedGain, 'exceptZero') : MASKED.currency}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.colPercent,
                    { color: isVisible ? getValueColor(analytics.totalUnrealizedGain, neutralColor) : neutralColor },
                  ]}
                >
                  {isVisible ? formatPercent(analytics.totalUnrealizedGainPercent, 'exceptZero') : MASKED.percent}
                </ThemedText>
              </View>

              <View style={[styles.colDivider, { backgroundColor: dividerColor }]} />

              <View style={styles.colStat}>
                <ThemedText style={styles.colLabel}>Invested</ThemedText>
                <ThemedText style={styles.colValue}>
                  {isVisible ? formatCurrency(analytics.totalInvested, 'never') : MASKED.currency}
                </ThemedText>
                <ThemedText style={styles.colSub}>
                  Total: {isVisible ? formatCurrency(analytics.totalCumulativeInvested, 'never') : MASKED.currency}
                </ThemedText>
              </View>
            </View>

            {analytics.realizedGains.length > 0 && isVisible && (
              <>
                <View style={[styles.divider, { backgroundColor: dividerColor, marginVertical: 16 }]} />
                <ThemedText style={styles.chartLabel}>Realized P&L</ThemedText>
                <RealizedPnLChart realizedGains={analytics.realizedGains} isDark={isDark} />
              </>
            )}
          </SectionCard>

          {/* ── Activity ── */}
          <ActivityGrid analytics={analytics} isDark={isDark} isVisible={isVisible} />

          {/* ── Closed Positions ── */}
          {analytics.totalSellTransactions > 0 && (
            <View style={styles.section}>
              <SectionCard isDark={isDark} title="Closed Positions" dividerColor={dividerColor}>
                <View style={styles.threeCol}>
                  <View style={styles.colStat}>
                    <ThemedText style={[styles.colValueLarge, { color: colors.green }]}>
                      {analytics.winCount}
                    </ThemedText>
                    <ThemedText style={styles.colLabel}>Winners</ThemedText>
                  </View>

                  <View style={[styles.colDivider, { backgroundColor: dividerColor }]} />

                  <View style={styles.colStat}>
                    <ThemedText style={[styles.colValueLarge, { color: colors.red }]}>
                      {analytics.lossCount}
                    </ThemedText>
                    <ThemedText style={styles.colLabel}>Losers</ThemedText>
                  </View>

                  <View style={[styles.colDivider, { backgroundColor: dividerColor }]} />

                  <View style={styles.colStat}>
                    <ThemedText
                      style={[
                        styles.colValueLarge,
                        { color: analytics.winRate >= 50 ? colors.green : colors.red },
                      ]}
                    >
                      {analytics.winRate.toFixed(0)}%
                    </ThemedText>
                    <ThemedText style={styles.colLabel}>Win Rate</ThemedText>
                  </View>
                </View>

                <View style={[styles.divider, { backgroundColor: dividerColor, marginVertical: 14 }]} />
                <StreakAndRecent
                  streak={analytics.currentStreak}
                  trades={analytics.recentClosedTrades}
                  isDark={isDark}
                  dividerColor={dividerColor}
                  isVisible={isVisible}
                  neutralColor={neutralColor}
                />
              </SectionCard>
            </View>
          )}

          {/* ── By Position ── */}
          {analytics.tickerStats.length > 0 && (
            <View style={styles.section}>
              <SectionCard isDark={isDark} dividerColor={dividerColor}>
                <View style={styles.byPositionTitleRow}>
                  <ThemedText style={styles.byPositionTitle}>By Position</ThemedText>
                  <View style={styles.filterRow}>
                    {(['all', 'winners', 'losers'] as TickerFilter[]).map((f) => (
                      <TouchableOpacity
                        key={f}
                        onPress={() => {
                          void trackStatisticsAction({ action: 'ticker_filter_change', target: f });
                          setTickerFilter(f);
                        }}
                        style={[
                          styles.filterPill,
                          {
                            backgroundColor:
                              tickerFilter === f
                                ? colors.cardBorder
                                : 'transparent',
                          },
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.filterPillText,
                            tickerFilter === f && styles.filterPillTextActive,
                          ]}
                        >
                          {f.charAt(0).toUpperCase() + f.slice(1)}
                        </ThemedText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: dividerColor, marginBottom: 16 }]} />
                {filteredTickers.length > 0 ? (
                  <View style={styles.tickerList}>
                    {filteredTickers.map((ticker) => (
                      <TouchableOpacity
                        key={ticker.symbol}
                        activeOpacity={0.7}
                        onPress={() => {
                          void trackStatisticsAction({ action: 'ticker_open_analytics', target: ticker.symbol });
                          setSelectedTicker(ticker);
                        }}
                      >
                        <TickerRow
                          ticker={ticker}
                          isDark={isDark}
                          isVisible={isVisible}
                          neutralColor={neutralColor}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <ThemedText style={styles.emptyFilter}>
                    No positions match this filter.
                  </ThemedText>
                )}
              </SectionCard>
            </View>
          )}
        </ScrollView>
      </View>

      <TickerAnalyticsModal
        visible={selectedTicker !== null}
        onClose={() => setSelectedTicker(null)}
        ticker={selectedTicker}
      />
      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={handleSelectAsset}
      />
    </ThemedView>
  );
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: { flex: 1 },
  contentContainer: {
    paddingTop: 20,
    paddingBottom: 110,
    gap: 20,
  },

  // ── Empty State ──
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    opacity: 0.5,
    textAlign: 'center',
    lineHeight: 22,
  },

  // ── Section wrapper ──
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  // ── Card ──
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  divider: { height: 1, width: '100%' },

  // ── Hero ──
  sinceLabel: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.5,
    marginBottom: 8,
  },
  heroNumber: {
    fontSize: 40,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 46,
  },
  heroNumberLabel: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.5,
  },
  chartLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.45,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: 8,
  },
  pnlChartWrapper: {
    height: 150,
  },
  pnlTooltip: {
    position: 'absolute',
    top: 4,
    transform: [{ translateX: -44 }],
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  pnlTooltipValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  pnlTooltipLabel: {
    fontSize: 10,
    opacity: 0.6,
    marginTop: 1,
  },
  pnlTimelineRow: {
    flexDirection: 'row',
    gap: 6,
    borderTopWidth: 1,
    paddingTop: 12,
    marginTop: 12,
  },
  pnlTimelineButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pnlTimelineText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },

  // ── Three-column layout ──
  threeCol: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  colStat: {
    flex: 1,
    alignItems: 'center',
  },
  colDivider: {
    width: 1,
    height: 40,
  },
  colLabel: {
    fontSize: 11,
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 2,
    lineHeight: 20,
  },
  colValue: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  colValueLarge: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  colPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
  colSub: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.45,
  },

  // ── Streak + Recent Trades ──
  streakSection: {
    gap: 12,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  streakEmoji: {
    fontSize: 22,
  },
  streakText: {
    flex: 1,
    gap: 2,
  },
  streakLabel: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  streakSub: {
    fontSize: 12,
    opacity: 0.5,
    lineHeight: 16,
  },
  recentSection: {
    gap: 0,
  },
  recentTitle: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.4,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 8,
  },
  recentDivider: {
    height: 1,
  },
  recentDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  recentDate: {
    fontSize: 12,
    opacity: 0.4,
    flex: 1,
  },
  recentRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  recentGain: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  recentPct: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 14,
  },

  // ── Symbol Badge ──
  symbolBadge: {
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
    alignSelf: 'center',
  },
  symbolBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Activity Grid (bento) ──
  activityGrid: {
    marginHorizontal: 20,
    gap: 10,
  },
  activityGridTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  activityGridRows: {
    gap: 6,
  },
  activityGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  activityTile: {
    flex: 1,
    borderRadius: 12,
    padding: 12,
    gap: 3,
    borderWidth: 1,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityTileValue: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.4,
    marginTop: 4,
    lineHeight: 21,
  },
  activityTileLabel: {
    fontSize: 11,
    opacity: 0.45,
    fontWeight: '500',
  },

  // ── By Position ──
  filterRow: {
    flexDirection: 'row',
    gap: 4,
  },
  filterPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  byPositionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  byPositionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.5,
  },
  filterPillTextActive: {
    opacity: 1,
    fontWeight: '600',
  },
  tickerOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tickerContent: {
    flex: 1,
    gap: 4,
  },
  tickerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tickerName: {
    fontSize: 12,
    opacity: 0.5,
    fontWeight: '500',
    flex: 1,
  },
  tickerGain: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  barContainer: {
    height: 20,
    justifyContent: 'center',
  },
  barTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 3,
    borderRadius: 1.5,
    overflow: 'hidden',
  },
  barFill: {
    height: 3,
    borderRadius: 1.5,
  },
  barLabelWrap: {
    alignSelf: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    lineHeight: 14,
  },
  tickerSub: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.45,
    lineHeight: 14,
  },
  tickerList: {
    gap: 16,
  },
  emptyFilter: {
    fontSize: 14,
    opacity: 0.4,
    textAlign: 'center',
    paddingVertical: 12,
  },
});
