import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { StockChart } from '@/components/finance/StockChart';
import { StockHoldingsHistory } from '@/components/finance/StockHoldingsHistory';
import { TransactionData } from '@/components/finance/TransactionForm';
import { TransactionModal } from '@/components/finance/TransactionModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  addTransaction,
  buildAuthenticatedUrl,
  deleteHolding,
  formatChartLabel,
  formatCurrency,
  formatEmployeeCount,
  formatMarketCap,
  formatPercent,
  getValueColor,
  mapApiTypeToAssetType,
  useTickerData,
  useTransactionsBySymbol,
  useUIHolding
} from '@/lib';
import type { TimelineType } from '@/lib/store/types';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Skeleton({ width, height, borderRadius = 6, backgroundColor = Colors.light.placeholder, style }: { width: number | `${number}%`; height: number; borderRadius?: number; backgroundColor?: string; style?: object }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);
  return <Animated.View style={[{ width, height, borderRadius, backgroundColor, opacity }, style]} />;
}

function formatVolume(v: number): string {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatTooltipLabel(timestamp: number, timeline: TimelineType): string {
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const day = d.getDate();
  const year = d.getFullYear();

  if (timeline === '1D' || timeline === '5D') {
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${month} ${day}, ${hours}:${minutes} ${ampm}`;
  }

  return `${month} ${day}, ${year}`;
}

export default function StockDetailScreen() {
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const [selectedTimeline, setSelectedTimeline] = useState<TimelineType>('1D');
  // committedTimeline lags behind selectedTimeline until new bars arrive,
  // giving us a synchronous isChartLoading signal without relying on effects.
  const [committedTimeline, setCommittedTimeline] = useState<TimelineType>('1D');
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSelectAsset = (asset: { symbol: string }) => {
    setSearchVisible(false);
    router.replace(`/stock/${asset.symbol}`);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((k) => k + 1);
  }, []);

  const tickerSymbol = symbol as string;

  // Fetch real data from market data service
  const { details, quote, bars, loading, error } = useTickerData(tickerSymbol, selectedTimeline, refreshKey);

  // When real bars arrive for the pending timeline, commit it.
  // Guard bars.length > 0 so an empty-bars reset during fetch doesn't clear loading early.
  useEffect(() => {
    if (bars.length > 0) {
      setCommittedTimeline(selectedTimeline);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars]);

  // Stop the refresh spinner once data has loaded
  useEffect(() => {
    if (!loading && refreshing) {
      requestAnimationFrame(() => setRefreshing(false));
    }
  }, [loading, refreshing]);

  // Get holding from store
  const holding = useUIHolding(tickerSymbol);
  const symbolTransactions = useTransactionsBySymbol(tickerSymbol);
  const hasHistory = symbolTransactions.length > 0;

  const handleDeleteHolding = useCallback(() => {
    if (!holding && !hasHistory) return;

    Alert.alert(
      'Delete Holding',
      `Are you sure you want to delete all ${tickerSymbol} transactions? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteHolding(tickerSymbol);
            router.back();
          },
        },
      ]
    );
  }, [holding, hasHistory, tickerSymbol]);

  const handleTransactionSubmit = useCallback((data: TransactionData) => {
    const shares = parseFloat(data.quantity);
    const price = parseFloat(data.price);
    const commission = data.commission ? parseFloat(data.commission) : 0;
    const symbolUpper = data.symbol.toUpperCase().trim();
    const total = shares * price + commission;

    const resolvedAssetType = data.assetType ?? mapApiTypeToAssetType(details?.type);
    try {
      addTransaction({
        symbol: symbolUpper,
        type: data.type,
        shares,
        price,
        total,
        date: data.date.toISOString().split('T')[0],
        commission,
      }, resolvedAssetType, data.name || details?.name);
    } catch (e) {
      Alert.alert('Transaction Failed', e instanceof Error ? e.message : 'Failed to record transaction.');
    }
  }, [details?.type, details?.name]);

  const currentPrice = quote?.price ?? 0;
  const change = quote?.change ?? 0;
  const changePercent = quote?.changePercent ?? 0;
  const isPositive = change >= 0;
  const textColor = colors.text;

  // Memoize the authenticated logo URL so it doesn't recompute on every render
  const logoUrl = useMemo(() => buildAuthenticatedUrl(details?.logoUrl), [details?.logoUrl]);

  // Map OHLC bars to chart-compatible data
  const isChartLoading = committedTimeline !== selectedTimeline;

  const chartData = useMemo(() => {
    if (bars.length === 0) return [];
    return bars.map((bar, index) => ({
      x: index,
      y: bar.close,
      label: formatChartLabel(bar.timestamp, committedTimeline),
      tooltipLabel: formatTooltipLabel(bar.timestamp, committedTimeline),
    }));
  }, [bars, committedTimeline]);

  if (error) {
    const isNotFound = error.includes('not found');
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
        <PageHeader
          title={tickerSymbol}
          leftElement={
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={textColor} />
            </TouchableOpacity>
          }
        />
        <View style={[styles.centered, { flex: 1, paddingHorizontal: 32 }]}>
          <Ionicons
            name={isNotFound ? 'search-outline' : 'alert-circle-outline'}
            size={56}
            color={colors.icon}
          />
          <ThemedText style={[styles.errorTitle, { marginTop: 16 }]}>
            {isNotFound ? 'Ticker Not Found' : 'Something Went Wrong'}
          </ThemedText>
          <ThemedText style={[styles.errorText, { marginTop: 8 }]}>
            {error}
          </ThemedText>
          {isNotFound && (
            <View style={[styles.errorHintCard, { backgroundColor: colors.cardBackground }]}>
              <ThemedText style={styles.errorHintTitle}>This can happen when:</ThemedText>
              <ThemedText style={styles.errorHintItem}>- The ticker symbol is misspelled</ThemedText>
              <ThemedText style={styles.errorHintItem}>- The security is listed on a non-US exchange</ThemedText>
              <ThemedText style={styles.errorHintItem}>- The ticker has been delisted</ThemedText>
            </View>
          )}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.errorButton, { backgroundColor: colors.tint }]}
          >
            <ThemedText style={{ color: colors.textOnColor, fontWeight: '600' }}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.safeArea}>
        <PageHeader
          title={tickerSymbol}
          leftElement={
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={textColor} />
            </TouchableOpacity>
          }
          rightElement={
            <View style={styles.headerActions}>
              <TouchableOpacity
                onPress={() => setSearchVisible(true)}
                style={[styles.headerActionButton]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="search" size={20} color={colors.icon} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowMenu(true)}
                style={[styles.headerActionButton, { backgroundColor: colors.cardBackground }]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="ellipsis-vertical" size={18} color={textColor} style={{ opacity: 0.7 }} />
              </TouchableOpacity>
            </View>
          }
        />

        <ScrollView
          style={[
            styles.scrollView,
            { backgroundColor: colors.surface }
          ]}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.icon}
              colors={[colors.icon]}
            />
          }
        >
        {/* Price Section */}
        <View style={styles.priceSection}>
          {quote ? (
            <>
              <ThemedText style={styles.price}>{formatCurrency(currentPrice, 'never')}</ThemedText>
              <View style={styles.changeContainer}>
                <ThemedText style={[styles.change, { color: getValueColor(change, colors.text) }]}>
                  {formatCurrency(change, 'never')}
                </ThemedText>
                <ThemedText style={[styles.changePercent, { color: getValueColor(change, colors.text) }]}>
                  ({formatPercent(changePercent, 'exceptZero')})
                </ThemedText>
                <ThemedText style={styles.changePeriod}>Today</ThemedText>
              </View>
            </>
          ) : (
            <View style={styles.pricePlaceholder}>
              <Skeleton width={200} height={42} borderRadius={8} backgroundColor={colors.placeholder} />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                <Skeleton width={80} height={10} backgroundColor={colors.placeholder} />
                <Skeleton width={60} height={10} backgroundColor={colors.placeholder} />
              </View>
            </View>
          )}

          {(!loading && details?.exchange) ? (
            <ThemedText style={styles.closedAt}>
              {details.name} · USD · {details.exchange}
            </ThemedText>
          ) : (
            <Skeleton width="80%" height={20} borderRadius={8} backgroundColor={colors.placeholder} />
          )}
        </View>

        {/* Chart Section */}
        {chartData.length === 0 && !quote ? (
          <View style={[styles.chartPlaceholder, { backgroundColor: colors.cardBackground }]}>
            <Skeleton width="90%" height={300} borderRadius={8} backgroundColor={colors.placeholder} />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 16 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} width={48} height={28} borderRadius={8} backgroundColor={colors.placeholder} />
              ))}
            </View>
          </View>
        ) : (
          <StockChart
            chartData={chartData}
            selectedTimeline={selectedTimeline}
            onTimelineChange={setSelectedTimeline}
            isPositive={isPositive}
            isDark={isDark}
            isLoading={isChartLoading}
          />
        )}

        {/* Holdings & History */}
        <StockHoldingsHistory
          holding={holding}
          symbol={tickerSymbol}
          totalGain={holding ? holding.totalValue - holding.costBasis : 0}
          totalGainPercent={holding && holding.costBasis > 0 ? ((holding.totalValue - holding.costBasis) / holding.costBasis) * 100 : 0}
          dayChange={(holding?.shares ?? 0) * change}
          dayChangePercent={changePercent}
        />

        {/* Real-time Trade Data */}
        {(quote?.lastTradePrice != null || quote?.bidPrice != null || quote?.askPrice != null) && (
          <View style={[styles.statsCard, { backgroundColor: colors.cardBackground }]}>
            <ThemedText style={[styles.sectionTitle, { borderColor: colors.borderMuted }]}>Real-time Data</ThemedText>
            <View style={styles.statsGrid}>
              {quote?.lastTradePrice != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Last trade</ThemedText>
                    <ThemedText style={styles.statValue}>
                      {formatCurrency(quote.lastTradePrice, 'never')}
                      {quote.lastTradeSize != null && (
                        <ThemedText style={{ fontSize: 13, opacity: 0.6 }}>
                          {' '}× {quote.lastTradeSize.toLocaleString()}
                        </ThemedText>
                      )}
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {quote?.bidPrice != null && quote?.askPrice != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Bid × Ask</ThemedText>
                    <ThemedText style={styles.statValue}>
                      {formatCurrency(quote.bidPrice, 'never')}
                      {quote.bidSize != null && ` ×${quote.bidSize}`}
                      {' → '}
                      {formatCurrency(quote.askPrice, 'never')}
                      {quote.askSize != null && ` ×${quote.askSize}`}
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {quote?.bidPrice != null && quote?.askPrice != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Spread</ThemedText>
                    <ThemedText style={styles.statValue}>
                      {formatCurrency(quote.askPrice - quote.bidPrice, 'never')}
                      <ThemedText style={{ fontSize: 13, opacity: 0.6 }}>
                        {' '}({formatPercent(((quote.askPrice - quote.bidPrice) / quote.bidPrice) * 100, 'exceptZero')})
                      </ThemedText>
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {quote?.fmv != null && (
                <View style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Fair market value</ThemedText>
                  <ThemedText style={styles.statValue}>
                    {formatCurrency(quote.fmv, 'never')}
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Key Statistics */}
        <View style={[styles.statsCard, { backgroundColor: colors.cardBackground }]}>
          <ThemedText style={[styles.sectionTitle, { borderColor: colors.borderMuted }]}>Key Statistics</ThemedText>
          {!quote && !details ? (
            <View style={styles.statsGrid}>
              {Array.from({ length: 5 }).map((_, i) => (
                <React.Fragment key={i}>
                  <View style={styles.statRow}>
                    <Skeleton width={100} height={16} backgroundColor={colors.placeholder} />
                    <Skeleton width={70} height={16} backgroundColor={colors.placeholder} />
                  </View>
                  {i < 4 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                </React.Fragment>
              ))}
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {quote?.prevClose != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Previous close</ThemedText>
                    <ThemedText style={styles.statValue}>
                      {formatCurrency(quote.prevClose, 'never')}
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {quote?.open != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Open</ThemedText>
                    <ThemedText style={styles.statValue}>
                      {formatCurrency(quote.open, 'never')}
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {quote?.dayHigh != null && quote?.dayLow != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Day range</ThemedText>
                    <ThemedText style={styles.statValue}>
                      {formatCurrency(quote.dayLow, 'never')} - {formatCurrency(quote.dayHigh, 'never')}
                    </ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details?.marketCap != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Market cap</ThemedText>
                    <ThemedText style={styles.statValue}>{formatMarketCap(details.marketCap)}</ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {quote?.volume != null && (
                <>
                  <View style={styles.statRow}>
                    <ThemedText style={styles.statLabel}>Volume</ThemedText>
                    <ThemedText style={styles.statValue}>{formatVolume(quote.volume)}</ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details?.exchange && (
                <View style={styles.statRow}>
                  <ThemedText style={styles.statLabel}>Primary exchange</ThemedText>
                  <ThemedText style={styles.statValue}>{details.exchange}</ThemedText>
                </View>
              )}
            </View>
          )}
        </View>

        {/* About Section */}
        {details ? (
          <View style={[styles.aboutCard, { backgroundColor: colors.cardBackground }]}>
            <ThemedText style={[styles.sectionTitle, { borderColor: colors.borderMuted }]}>About</ThemedText>

            {/* Company Logo */}
            {logoUrl && (
              <View style={styles.logoContainer}>
                <Image
                  source={{ uri: logoUrl }}
                  style={styles.companyLogo}
                  contentFit="contain"
                />
              </View>
            )}

            {details.description ? (
              <ThemedText style={styles.aboutText}>{details.description}</ThemedText>
            ) : null}

            <View style={styles.companyInfoGrid}>
              {details.industry && (
                <>
                  <View style={styles.companyInfoRow}>
                    <ThemedText style={styles.companyInfoLabel}>Industry</ThemedText>
                    <ThemedText style={styles.companyInfoValue}>{details.industry}</ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details.listDate && (
                <>
                  <View style={styles.companyInfoRow}>
                    <ThemedText style={styles.companyInfoLabel}>Listed</ThemedText>
                    <ThemedText style={styles.companyInfoValue}>{details.listDate}</ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details.headquarters && (
                <>
                  <View style={styles.companyInfoRow}>
                    <ThemedText style={styles.companyInfoLabel}>Headquarters</ThemedText>
                    <ThemedText style={styles.companyInfoValue}>{details.headquarters}</ThemedText>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details.homepage && (
                <>
                  <View style={styles.companyInfoRow}>
                    <ThemedText style={styles.companyInfoLabel}>Website</ThemedText>
                    <TouchableOpacity onPress={() => Linking.openURL(details.homepage!)}>
                      <ThemedText style={[styles.companyInfoValue, styles.linkText, { color: colors.blue }]}>
                        {details.homepage.replace(/^https?:\/\/(www\.)?/, '')}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details.phoneNumber && (
                <>
                  <View style={styles.companyInfoRow}>
                    <ThemedText style={styles.companyInfoLabel}>Phone</ThemedText>
                    <TouchableOpacity onPress={() => Linking.openURL(`tel:${details.phoneNumber}`)}>
                      <ThemedText style={[styles.companyInfoValue, styles.linkText, { color: colors.blue }]}>
                        {details.phoneNumber}
                      </ThemedText>
                    </TouchableOpacity>
                  </View>
                  <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                </>
              )}

              {details.employees != null && (
                <View style={styles.companyInfoRow}>
                  <ThemedText style={styles.companyInfoLabel}>Employees</ThemedText>
                  <ThemedText style={styles.companyInfoValue}>{formatEmployeeCount(details.employees)}</ThemedText>
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={[styles.aboutCard, { backgroundColor: colors.cardBackground }]}>
            <ThemedText style={[styles.sectionTitle, { borderColor: colors.borderMuted }]}>About</ThemedText>
            <Skeleton width={120} height={40} borderRadius={8} style={{ marginBottom: 16 }} />
            <View style={{ gap: 8, marginBottom: 20 }}>
              <Skeleton width="100%" height={14} />
              <Skeleton width="100%" height={14} />
              <Skeleton width="70%" height={14} />
            </View>
            <View style={styles.companyInfoGrid}>
              {Array.from({ length: 4 }).map((_, i) => (
                <React.Fragment key={i}>
                  <View style={styles.companyInfoRow}>
                    <Skeleton width={90} height={16} />
                    <Skeleton width={120} height={16} />
                  </View>
                  {i < 3 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
                </React.Fragment>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      </View>

      {/* Menu Dropdown */}
      <Modal visible={showMenu} transparent animationType="none" onRequestClose={() => setShowMenu(false)}>
        <Pressable style={[styles.menuOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowMenu(false)}>
          <View style={[styles.menuDropdown, { top: insets.top + 52, backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              onPress={() => {
                setShowMenu(false);
                setShowTransactionModal(true);
              }}
            >
              <Ionicons name="add-circle-outline" size={18} color={textColor} />
              <ThemedText style={styles.menuItemText}>Record Transaction</ThemedText>
            </TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: colors.divider }]} />
            <TouchableOpacity
              style={styles.menuItem}
              activeOpacity={0.7}
              disabled={!holding && !hasHistory}
              onPress={() => {
                setShowMenu(false);
                handleDeleteHolding();
              }}
            >
              <Ionicons name="trash-outline" size={18} color={colors.red} style={{ opacity: (holding || hasHistory) ? 1 : 0.3 }} />
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.menuItemText, { color: colors.red, opacity: (holding || hasHistory) ? 1 : 0.3 }]}>Remove Position</ThemedText>
                {!holding && !hasHistory && (
                  <ThemedText style={styles.menuItemHint}>No holdings to remove</ThemedText>
                )}
              </View>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Asset Search Modal */}
      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={handleSelectAsset}
      />

      {/* Transaction Modal */}
      <TransactionModal
        visible={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        initialSymbol={tickerSymbol}
        initialName={details?.name}
        initialAssetType={mapApiTypeToAssetType(details?.type)}
        onSubmit={handleTransactionSubmit}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  safeArea: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
  },
  priceSection: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  price: {
    fontSize: 48,
    fontWeight: '700',
    letterSpacing: -2,
    lineHeight: 56,
    marginBottom: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  change: {
    fontSize: 17,
    fontWeight: '600',
  },
  changePercent: {
    fontSize: 17,
    fontWeight: '600',
  },
  changePeriod: {
    fontSize: 15,
    opacity: 0.6,
  },
  pricePlaceholder: {
    paddingBottom: 12,
  },
  chartPlaceholder: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  closedAt: {
    fontSize: 13,
    opacity: 0.5,
  },
  statsCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    borderBottomWidth: 1,
    paddingBottom: 12,
  },
  statsGrid: {
    gap: 0,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statLabel: {
    fontSize: 15,
    opacity: 0.6,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
  },
  aboutCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    paddingBottom: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  logoContainer: {
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  companyLogo: {
    width: 120,
    height: 50,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.8,
    marginBottom: 20,
  },
  companyInfoGrid: {
    gap: 0,
  },
  companyInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  companyInfoLabel: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  companyInfoValue: {
    fontSize: 15,
    opacity: 0.8,
    flex: 2,
    textAlign: 'right',
  },
  linkText: {
    textDecorationLine: 'underline',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
  },
  errorHintCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    width: '100%',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  errorHintTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    opacity: 0.7,
  },
  errorHintItem: {
    fontSize: 14,
    opacity: 0.6,
    lineHeight: 22,
  },
  errorButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  menuOverlay: {
    flex: 1,
  },
  menuDropdown: {
    position: 'absolute',
    right: 20,
    minWidth: 200,
    borderRadius: 10,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    
  },
  menuItemHint: {
    fontSize: 10,
    opacity: 0.4,
    lineHeight: 11,
  },
  menuDivider: {
    height: 1,
  },
});
