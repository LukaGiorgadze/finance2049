import { ThemedText } from '@/components/themed-text';
import { ImportButton } from '@/components/ui/import-button';
import { SectionTitle } from '@/components/ui/section-title';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addTransaction, formatCurrency, formatLocalDateISO, formatPercent, formatShares, getValueColor, MASKED, setGainView, trackPortfolioAction, UIHolding, useGainView, useMarketPrices, useShowPortfolioValue, useUIHoldings } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { LotsAndHistoryModal } from './LotsAndHistoryModal';
import type { TransactionData } from './TransactionForm';
import { TransactionModal } from './TransactionModal';

type SortOption = 'value' | 'gain' | 'alpha';

export function PortfolioHoldingsList() {
  const [sortBy, setSortBy] = useState<SortOption>('value');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [transactionModalVisible, setTransactionModalVisible] = useState(false);
  const [transactionType, setTransactionType] = useState<'buy' | 'sell'>('buy');
  const gainView = useGainView();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const isVisible = useShowPortfolioValue();
  const swipingRef = useRef<string | null>(null);
  const swipeableRefs = useRef<Map<string, React.RefObject<SwipeableMethods | null>>>(new Map());
  const openSwipeableId = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  const getRefForId = useCallback((id: string): React.RefObject<SwipeableMethods | null> => {
    let ref = swipeableRefs.current.get(id);
    if (!ref) {
      ref = { current: null };
      swipeableRefs.current.set(id, ref);
    }
    return ref;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    const refs = swipeableRefs.current;
    return () => {
      isMountedRef.current = false;
      refs.clear();
      openSwipeableId.current = null;
    };
  }, []);

  // Get holdings and market prices from store
  const holdings = useUIHoldings() ?? [];
  const marketPrices = useMarketPrices();

  const handleTransactionSubmit = useCallback((data: TransactionData) => {
    if (!data.symbol.trim()) {
      Alert.alert('Missing Symbol', 'Please enter a ticker symbol.');
      return;
    }
    const shares = parseFloat(data.quantity);
    if (isNaN(shares) || shares <= 0) {
      Alert.alert('Invalid Quantity', 'Please enter a valid number of shares.');
      return;
    }
    const price = parseFloat(data.price);
    if (isNaN(price) || price <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price per share.');
      return;
    }
    const commission = data.commission ? parseFloat(data.commission) : 0;
    const symbol = data.symbol.toUpperCase().trim();
    const total = shares * price + commission;
    try {
      addTransaction({
        symbol,
        type: data.type,
        shares,
        price,
        total,
        date: formatLocalDateISO(data.date),
        commission,
      }, data.assetType as string, data.name);
    } catch (e) {
      Alert.alert('Transaction Failed', e instanceof Error ? e.message : 'Failed to record transaction.');
    }
  }, []);


  const getGainPercent = (h: UIHolding) => h.costBasis > 0 ? ((h.totalValue - h.costBasis) / h.costBasis) * 100 : 0;

  const sortedHoldings = [...holdings].sort((a, b) => {
    switch (sortBy) {
      case 'value':
        return b.totalValue - a.totalValue;
      case 'gain':
        return getGainPercent(b) - getGainPercent(a);
      case 'alpha':
        return a.symbol.localeCompare(b.symbol);
      default:
        return 0;
    }
  });

  // Find the selected holding for the modal
  const selectedHolding = holdings.find((h) => h.symbol === selectedSymbol);

  const handleOpenTransaction = (symbol: string, type: 'buy' | 'sell') => {
    void trackPortfolioAction({
      action: type === 'buy' ? 'holding_buy' : 'holding_sell',
      target: symbol,
    });
    setSelectedSymbol(symbol);
    setTransactionType(type);
    setTransactionModalVisible(true);
  };

  const renderRightActions = (symbol: string) => {
    return (
      <View style={styles.swipeActionsContainer}>
        <TouchableOpacity
          style={styles.buyButton}
          onPress={() => handleOpenTransaction(symbol, 'buy')}
          activeOpacity={0.7}
        >
          <Ionicons name="add" size={22} color={colors.textOnColor} />
          <ThemedText style={styles.swipeActionText}>Buy</ThemedText>
        </TouchableOpacity>
        <View style={[styles.buttonDivider, { backgroundColor: colors.glassWhiteAlt }]} />
        <TouchableOpacity
          style={styles.sellButton}
          onPress={() => handleOpenTransaction(symbol, 'sell')}
          activeOpacity={0.7}
        >
          <Ionicons name="remove" size={22} color={colors.textOnColor} />
          <ThemedText style={styles.swipeActionText}>Sell</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  const renderHolding = ({ item }: { item: UIHolding }) => {
    const totalGain = item.totalValue - item.costBasis;
    // const totalGainPercent = getGainPercent(item);
    const mp = marketPrices[item.symbol];
    const dayChange = item.shares * (mp?.change ?? 0);
    const dayChangePercent = mp?.changePercent ?? 0;
    const neutralColor = isDark ? Colors.dark.text : Colors.light.text;
    const hasBrandColor = !!BRAND_COLORS[item.symbol];
    const brandColor = BRAND_COLORS[item.symbol] || colors.surface;
    const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;

    const handlePress = () => {
      // Don't navigate if we just swiped
      if (swipingRef.current === item.symbol) {
        return;
      }
      void trackPortfolioAction({ action: 'holding_open_stock', target: item.symbol });
      router.push(`/stock/${item.symbol}`);
    };

    const handleSwipeBegin = () => {
      swipingRef.current = item.symbol;
    };

    const handleSwipeEnd = () => {
      // Clear the ref after a delay to prevent onPress from firing
      setTimeout(() => {
        swipingRef.current = null;
      }, 200);
    };

    return (
      <Swipeable
        ref={getRefForId(item.id)}
        renderRightActions={() => renderRightActions(item.symbol)}
        overshootRight={false}
        onSwipeableWillOpen={() => {
          if (!isMountedRef.current) return;
          const prevId = openSwipeableId.current;
          if (prevId && prevId !== item.id) {
            const prevRef = swipeableRefs.current.get(prevId)?.current;
            if (prevRef?.close) prevRef.close();
          }
          openSwipeableId.current = item.id;
        }}
        onSwipeableOpenStartDrag={handleSwipeBegin}
        onSwipeableCloseStartDrag={handleSwipeBegin}
        onSwipeableClose={() => {
          if (openSwipeableId.current === item.id) {
            openSwipeableId.current = null;
          }
          handleSwipeEnd();
        }}
      >
        <TouchableOpacity
          style={[
            styles.holdingCard,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
            }
          ]}
          activeOpacity={0.7}
          onPress={handlePress}
        >
          <View style={styles.holdingHeader}>
            <View style={styles.holdingTopRow}>
              <View style={styles.nameRow}>
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
                <ThemedText style={styles.name} numberOfLines={1}>
                  {item.name}
                </ThemedText>
              </View>
              <ThemedText style={styles.totalValue}>
                {isVisible ? formatCurrency(item.totalValue, 'never') : MASKED.currency}
              </ThemedText>
            </View>
            <View style={styles.holdingBottomRow}>
              <View style={styles.priceRow}>
                <ThemedText style={styles.currentPrice}>
                  {formatCurrency(item.currentPrice, 'never')}
                </ThemedText>
                <ThemedText style={[
                  styles.dayChange,
                  { color: getValueColor(dayChange, neutralColor) }
                ]}>
                  {formatPercent(dayChangePercent, 'exceptZero')}
                </ThemedText>
              </View>
              <TouchableOpacity
                style={styles.gainRow}
                onPress={() => {
                  const nextGainView = gainView === 'today' ? 'total' : 'today';
                  void trackPortfolioAction({ action: 'holding_toggle_gain_view', target: nextGainView });
                  setGainView(nextGainView);
                }}
                activeOpacity={0.6}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ThemedText style={[
                  styles.gainAmount,
                  { color: isVisible ? getValueColor(gainView === 'today' ? dayChange : totalGain, neutralColor) : neutralColor }
                ]}>
                  {isVisible
                    ? formatCurrency(gainView === 'today' ? dayChange : totalGain, 'never')
                    : MASKED.currency}
                </ThemedText>
                <ThemedText style={styles.gainLabel}>
                  {gainView === 'today' ? 'today' : 'total'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[
            styles.divider,
            { backgroundColor: colors.cardBorder }
          ]} />

          <View style={styles.gainContainer}>
            <View style={styles.sharesAndLots}>
              {item.lots && item.lots.length > 0 && (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      void trackPortfolioAction({ action: 'holding_open_lots', target: item.symbol });
                      setSelectedSymbol(item.symbol);
                      setModalVisible(true);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.lotsButton}
                  >
                    <ThemedText style={styles.shares}>
                      {isVisible ? `${formatShares(item.shares)} ${item.shares === 1 ? 'share' : 'shares'}` : `${MASKED.shares} shares`}
                    </ThemedText>
                    <ThemedText style={styles.dotSeparator}>·</ThemedText>
                    <ThemedText style={styles.lotsButtonText}>
                      {item.lots.length} {item.lots.length === 1 ? 'lot' : 'lots'}
                    </ThemedText>
                    <Ionicons
                      name="chevron-forward"
                      size={10}
                      color={colors.icon}
                      style={{ marginLeft: 2 }}
                    />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Swipeable>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SectionTitle style={styles.title}>Holdings ({holdings.length})</SectionTitle>
        <View style={styles.sortButtons}>
          <TouchableOpacity
            onPress={() => {
              void trackPortfolioAction({ action: 'holding_sort', target: 'value' });
              setSortBy('value');
            }}
            style={[
              styles.sortButton,
              {
                backgroundColor: sortBy === 'value'
                  ? colors.surfaceElevated
                  : 'transparent',
              }
            ]}
          >
            <ThemedText style={[
              styles.sortText,
              { opacity: sortBy === 'value' ? 1 : 0.5 }
            ]}>
              Value
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              void trackPortfolioAction({ action: 'holding_sort', target: 'gain' });
              setSortBy('gain');
            }}
            style={[
              styles.sortButton,
              {
                backgroundColor: sortBy === 'gain'
                  ? colors.surfaceElevated
                  : 'transparent',
              }
            ]}
          >
            <ThemedText style={[
              styles.sortText,
              { opacity: sortBy === 'gain' ? 1 : 0.5 }
            ]}>
              Gain
            </ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              void trackPortfolioAction({ action: 'holding_sort', target: 'alpha' });
              setSortBy('alpha');
            }}
            style={[
              styles.sortButton,
              {
                backgroundColor: sortBy === 'alpha'
                  ? colors.surfaceElevated
                  : 'transparent',
              }
            ]}
          >
            <ThemedText style={[
              styles.sortText,
              { opacity: sortBy === 'alpha' ? 1 : 0.5 }
            ]}>
              A-Z
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {holdings.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.cardBackground }]}>
          <Ionicons name="wallet-outline" size={48} color={colors.iconMuted} />
          <ThemedText style={styles.emptyTitle}>No Holdings Yet</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            Record your first transaction to start tracking your portfolio
          </ThemedText>
          <View style={styles.emptyActions}>
            <TouchableOpacity
              style={[styles.addManualBtn, { backgroundColor: colors.cardBorder }]}
              onPress={() => {
                void trackPortfolioAction({ action: 'empty_add_transaction' });
                setTransactionModalVisible(true);
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="add" size={16} color={colors.text} style={{ opacity: 0.7 }} />
              <ThemedText style={styles.addManualBtnText}>Add</ThemedText>
            </TouchableOpacity>
            <ImportButton
              style={{ flex: 1 }}
              onPress={() => {
                void trackPortfolioAction({ action: 'empty_import' });
                router.push('/import-transactions');
              }}
            />
          </View>
        </View>
      ) : (
        <View style={styles.list}>
          {sortedHoldings.map((item) => (
            <React.Fragment key={item.id}>
              {renderHolding({ item })}
            </React.Fragment>
          ))}
        </View>
      )}

      {selectedHolding && (
        <LotsAndHistoryModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          type="lots"
          lots={selectedHolding.lots.map((lot) => ({
            id: lot.id,
            transactionId: lot.transactionId,
            shares: lot.shares,
            purchasePrice: lot.purchasePrice,
            purchaseDate: lot.purchaseDate,
            currentPrice: lot.currentPrice,
            totalCost: lot.totalCost,
            currentValue: lot.currentValue,
            gain: lot.gain,
            gainPercent: lot.gainPercent,
          }))}
          symbol={selectedSymbol}
          holding={(() => {
            const tg = selectedHolding.totalValue - selectedHolding.costBasis;
            const tgp = getGainPercent(selectedHolding);
            const smp = marketPrices[selectedHolding.symbol];
            return {
              symbol: selectedHolding.symbol,
              name: selectedHolding.name,
              shares: selectedHolding.shares,
              avgCost: selectedHolding.avgCost,
              currentPrice: selectedHolding.currentPrice,
              totalValue: selectedHolding.totalValue,
              totalGain: tg,
              totalGainPercent: tgp,
              dayChange: selectedHolding.shares * (smp?.change ?? 0),
              dayChangePercent: smp?.changePercent ?? 0,
              lots: selectedHolding.lots,
            };
          })()}
        />
      )}

      <TransactionModal
        visible={transactionModalVisible}
        onClose={() => {
          setTransactionModalVisible(false);
          setSelectedSymbol('');
        }}
        initialSymbol={selectedSymbol}
        initialType={transactionType}
        onSubmit={handleTransactionSubmit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 6,
  },
  sortButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: 8,
  },
  holdingCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    borderWidth: 1,
  },
  holdingHeader: {
    gap: 8,
    marginBottom: 10,
  },
  holdingTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  holdingBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 17,
    fontWeight: '600',
    flexShrink: 1,
  },
  symbolBadge: {
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
  },
  symbolBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  shares: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.5,
  },
  totalValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentPrice: {
    fontSize: 13,
    fontWeight: '500',
  },
  dayChange: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginBottom: 8,
  },
  gainContainer: {
  },
  gainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gainAmount: {
    fontSize: 12,
    fontWeight: '500',
  },
  gainLabel: {
    fontSize: 10,
    fontWeight: '500',
    opacity: 0.4,
  },
  gainPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  sharesAndLots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dotSeparator: {
    fontSize: 12,
    opacity: 0.4,
    marginHorizontal: 6,
  },
  lotsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  lotsButtonText: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.5,
  },
  emptyState: {
    padding: 40,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 16,
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  addManualBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 14,
    borderRadius: 14,
  },
  addManualBtnText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 16,
  },
  swipeActionsContainer: {
    flexDirection: 'column',
    marginLeft: 8,
    width: 80,
    borderRadius: 16,
    overflow: 'hidden',
  },
  buyButton: {
    flex: 1,
    backgroundColor: Colors.light.green,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  sellButton: {
    flex: 1,
    backgroundColor: Colors.light.red,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  buttonDivider: {
    height: 1,
  },
  swipeActionText: {
    color: Colors.light.textOnColor,
    fontSize: 11,
    fontWeight: '600',
  },
});
