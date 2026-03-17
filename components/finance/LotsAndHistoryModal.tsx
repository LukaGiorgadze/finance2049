import { ThemedText } from '@/components/themed-text';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { deleteTransaction, formatCurrency, formatDate, formatPercent, formatShares, getValueColor, UITransaction, useUITransactionsBySymbol, validateTransactionDeletion } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Alert, FlatList, Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Local types that match what we pass to the modal
interface ModalHoldingLot {
  id: string;
  transactionId: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: string;
  currentPrice: number;
  totalCost: number;
  currentValue: number;
  gain: number;
  gainPercent: number;
}

interface ModalHolding {
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  totalValue: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
  lots: ModalHoldingLot[];
}

interface LotsAndHistoryModalProps {
  visible: boolean;
  onClose: () => void;
  type: 'lots' | 'history';
  lots?: ModalHoldingLot[];
  symbol: string;
  holding?: ModalHolding;
}

export function LotsAndHistoryModal({ visible, onClose, type, lots = [], symbol, holding }: LotsAndHistoryModalProps) {
  // Get transactions from store
  const transactions = useUITransactionsBySymbol(symbol);
  const colorScheme = useColorScheme();
  const swipeableRefs = useRef<Map<string, React.RefObject<SwipeableMethods | null>>>(new Map());
  const openSwipeableId = useRef<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const refs = swipeableRefs.current;
    const openIdRef = openSwipeableId;
    return () => {
      isMountedRef.current = false;
      refs.clear();
      openIdRef.current = null;
    };
  }, []);

  const getRefForId = (id: string): React.RefObject<SwipeableMethods | null> => {
    let ref = swipeableRefs.current.get(id);
    if (!ref) {
      ref = { current: null };
      swipeableRefs.current.set(id, ref);
    }
    return ref;
  };
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const colors = isDark ? Colors.dark : Colors.light;
  const textColor = colors.text;
  const hasBrandColor = !!BRAND_COLORS[symbol];
  const brandColor = BRAND_COLORS[symbol] || colors.surface;
  const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;

  const handleDelete = (id: string, itemType: 'lot' | 'transaction', lotTransactionId?: string) => {
    const txId = itemType === 'lot' && lotTransactionId ? lotTransactionId : id;

    const validationError = validateTransactionDeletion(txId);
    if (validationError) {
      Alert.alert('Cannot Delete', validationError);
      return;
    }

    const label = itemType === 'lot' ? 'lot (and its buy transaction)' : 'transaction';

    Alert.alert(
      'Delete Confirmation',
      `Are you sure you want to delete this ${label}? All lots and realized gains will be recalculated.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteTransaction(txId);
            } catch (e) {
              Alert.alert(
                'Cannot Delete',
                e instanceof Error ? e.message : 'Failed to delete transaction.',
              );
            }
          },
        },
      ]
    );
  };

  const renderRightActions = (onDelete: () => void) => {
    return (
      <TouchableOpacity
        style={[styles.deleteButton, { backgroundColor: colors.red }]}
        onPress={onDelete}
      >
        <Ionicons name="trash-outline" size={24} color={colors.textOnColor} />
      </TouchableOpacity>
    );
  };

  const renderLot = ({ item }: { item: ModalHoldingLot }) => (
    <Swipeable
      ref={getRefForId(item.id)}
      renderRightActions={() => renderRightActions(() => handleDelete(item.id, 'lot', item.transactionId))}
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
      onSwipeableClose={() => {
        if (openSwipeableId.current === item.id) {
          openSwipeableId.current = null;
        }
      }}
    >
      <View style={[styles.itemContainer, { backgroundColor: colors.cardBackground }]}>
        <View style={styles.lotRow}>
          <View style={styles.lotLeft}>
            <ThemedText style={styles.lotDate}>{formatDate(item.purchaseDate)}</ThemedText>
            <ThemedText style={styles.lotDetails}>
              {item.shares} shares @ {formatCurrency(item.purchasePrice, 'never')}
            </ThemedText>
          </View>
          <View style={styles.lotRight}>
            <ThemedText style={styles.lotTotal}>
              {formatCurrency(item.totalCost, 'never')}
            </ThemedText>
            <View style={styles.lotGain}>
              <ThemedText style={[
                styles.lotGainAmount,
                { color: getValueColor(item.gain, isDark ? Colors.dark.text : Colors.light.text) }
              ]}>
                {formatCurrency(item.gain, 'never')}
              </ThemedText>
              <ThemedText style={[
                styles.lotGainPercent,
                { color: getValueColor(item.gain, isDark ? Colors.dark.text : Colors.light.text) }
              ]}>
                ({formatPercent(item.gainPercent, 'exceptZero')})
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    </Swipeable>
  );

  const getSplitBadgeConfig = () => ({
    backgroundColor: colors.orangeBg,
    iconName: 'swap-horizontal' as const,
    iconColor: colors.orange,
  });

  const getBadgeConfig = (type: string) => {
    if (type === 'split') return getSplitBadgeConfig();
    return {
      backgroundColor: type === 'buy' ? colors.greenTintBg : colors.redTintBg,
      iconName: (type === 'buy' ? 'add' : 'remove') as 'add' | 'remove',
      iconColor: type === 'buy' ? colors.green : colors.red,
    };
  };

  const formatSplitRatio = (splitFrom?: number, splitTo?: number) => {
    if (!splitFrom || !splitTo) return 'Stock Split';
    if (splitTo < splitFrom) return `${splitTo}:${splitFrom} reverse split`;
    return `${splitFrom}:${splitTo} stock split`;
  };

  const renderTransaction = ({ item }: { item: UITransaction }) => {
    const badge = getBadgeConfig(item.type);

    return (
      <Swipeable
        ref={getRefForId(item.id)}
        renderRightActions={() => renderRightActions(() => handleDelete(item.id, 'transaction'))}
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
        onSwipeableClose={() => {
          if (openSwipeableId.current === item.id) {
            openSwipeableId.current = null;
          }
        }}
      >
        <View style={[styles.itemContainer, { backgroundColor: colors.cardBackground }]}>
          <View style={styles.transactionRow}>
            <View style={styles.transactionLeft}>
              <View style={styles.transactionHeader}>
                <View style={[
                  styles.typeBadge,
                  { backgroundColor: badge.backgroundColor }
                ]}>
                  <Ionicons
                    name={badge.iconName}
                    size={10}
                    color={badge.iconColor}
                  />
                </View>
                <ThemedText style={styles.transactionDate}>{formatDate(item.date)}</ThemedText>
              </View>
              {item.type === 'split' ? (
                <ThemedText style={styles.transactionDetails}>
                  {formatSplitRatio(item.splitFrom, item.splitTo)}
                </ThemedText>
              ) : (
                <ThemedText style={styles.transactionDetails}>
                  {formatShares(item.shares)} shares @ {formatCurrency(item.price, 'never')}
                </ThemedText>
              )}
            </View>
            <View style={styles.transactionRight}>
              {item.type !== 'split' && (
                <>
                  <ThemedText style={styles.transactionTotal}>
                    {formatCurrency(item.total, 'never')}
                  </ThemedText>
                  {!!item.commission && (
                    <ThemedText style={styles.transactionCommission}>
                      incl. {formatCurrency(item.commission, 'never')} fee
                    </ThemedText>
                  )}
                </>
              )}
              {item.type === 'sell' && item.gain !== undefined && (
                <View style={styles.transactionGain}>
                  <ThemedText style={[
                    styles.transactionGainAmount,
                    { color: getValueColor(item.gain, isDark ? Colors.dark.text : Colors.light.text) }
                  ]}>
                    {formatCurrency(item.gain, 'never')}
                  </ThemedText>
                  <ThemedText style={[
                    styles.transactionGainPercent,
                    { color: getValueColor(item.gain, isDark ? Colors.dark.text : Colors.light.text) }
                  ]}>
                    ({formatPercent(item.gainPercent ?? 0, 'exceptZero')})
                  </ThemedText>
                </View>
              )}
            </View>
          </View>
        </View>
      </Swipeable>
    );
  };

  const renderSeparator = () => (
    <View style={styles.separator} />
  );

  const keyExtractorLot = (item: ModalHoldingLot) => item.id;
  const keyExtractorTransaction = (item: UITransaction) => item.id;

  const renderLotsHeader = () => {
    if (!holding) return null;

    return (
      <View style={styles.summaryContainer}>
        {/* Main Stats Line */}
        <View style={styles.mainStatsLine}>
          <View style={styles.compactStat}>
            <ThemedText style={styles.compactStatValue}>{formatShares(holding.shares)}</ThemedText>
            <ThemedText style={styles.compactStatLabel}>shares</ThemedText>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.dividerGrayStrong }]} />

          <View style={styles.compactStat}>
            <ThemedText style={styles.compactStatValue}>{formatCurrency(holding.avgCost, 'never')}</ThemedText>
            <ThemedText style={styles.compactStatLabel}>avg</ThemedText>
          </View>

          <View style={[styles.statDivider, { backgroundColor: colors.dividerGrayStrong }]} />

          <View style={styles.compactStat}>
            <ThemedText style={styles.compactStatValue}>{formatCurrency(holding.totalValue, 'never')}</ThemedText>
            <ThemedText style={styles.compactStatLabel}>value</ThemedText>
          </View>
        </View>

        {/* Performance Line */}
        <View style={styles.performanceLine}>
          <View style={styles.performanceItem}>
            <ThemedText style={styles.performanceLabel}>Total</ThemedText>
            <View style={styles.performanceValues}>
              <ThemedText style={[
                styles.performanceAmount,
                { color: getValueColor(holding.totalGain, isDark ? Colors.dark.text : Colors.light.text) }
              ]}>
                {formatCurrency(holding.totalGain, 'never')}
              </ThemedText>
              <ThemedText style={[
                styles.performancePercent,
                { color: getValueColor(holding.totalGain, isDark ? Colors.dark.text : Colors.light.text) }
              ]}>
                {formatPercent(holding.totalGainPercent, 'exceptZero')}
              </ThemedText>
            </View>
          </View>

          <View style={[styles.performanceDivider, { backgroundColor: colors.dividerGray }]} />

          <View style={styles.performanceItem}>
            <ThemedText style={styles.performanceLabel}>Today</ThemedText>
            <View style={styles.performanceValues}>
              <ThemedText style={[
                styles.performanceAmount,
                { color: getValueColor(holding.dayChange, isDark ? Colors.dark.text : Colors.light.text) }
              ]}>
                {formatCurrency(holding.dayChange, 'never')}
              </ThemedText>
              <ThemedText style={[
                styles.performancePercent,
                { color: getValueColor(holding.dayChange, isDark ? Colors.dark.text : Colors.light.text) }
              ]}>
                {formatPercent(holding.dayChangePercent, 'exceptZero')}
              </ThemedText>
            </View>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerContent}>
            <ThemedText style={styles.headerTitle}>
              {type === 'lots' ? 'Lots' : 'Transaction History'}
            </ThemedText>
            <View style={styles.headerSubtitleRow}>
              <View style={[
                styles.symbolBadge,
                { backgroundColor: brandColor }
              ]}>
                <ThemedText style={[
                  styles.symbolBadgeText,
                  { color: badgeTextColor }
                ]}>
                  {symbol}
                </ThemedText>
              </View>
              <ThemedText style={styles.headerDot}>·</ThemedText>
              <ThemedText style={styles.headerCount}>
                {type === 'lots' ? `${lots.length} lots` : `${transactions.length} transactions`}
              </ThemedText>
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Sleek accent line */}
        <View style={[
          styles.headerAccent,
          { backgroundColor: colors.headerAccent }
        ]} />

        {/* Content */}
        {type === 'lots' ? (
          <>
            {/* Fixed Summary */}
            {holding && (
              <View
                style={[
                  styles.fixedSummaryContainer,
                  {
                    backgroundColor: colors.surface,
                    shadowColor: Colors.shadow,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: isDark ? 0.15 : 0.02,
                    shadowRadius: 6,
                    elevation: 2,
                    zIndex: 5,
                  },
                ]}
              >
                {renderLotsHeader()}
              </View>
            )}

            {/* Scrollable Lots List */}
            <FlatList<ModalHoldingLot>
              data={lots}
              renderItem={renderLot}
              keyExtractor={keyExtractorLot}
              ItemSeparatorComponent={renderSeparator}
              contentContainerStyle={styles.listContentContainer}
              showsVerticalScrollIndicator={true}
              windowSize={10}
              maxToRenderPerBatch={20}
              updateCellsBatchingPeriod={50}
              removeClippedSubviews={true}
              initialNumToRender={20}
            />
          </>
        ) : (
          <FlatList<UITransaction>
            data={transactions}
            renderItem={renderTransaction}
            keyExtractor={keyExtractorTransaction}
            ItemSeparatorComponent={renderSeparator}
            contentContainerStyle={styles.listContentContainer}
            showsVerticalScrollIndicator={true}
            windowSize={10}
            maxToRenderPerBatch={20}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={true}
            initialNumToRender={20}
          />
        )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 32,
  },
  headerSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  symbolBadge: {
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerDot: {
    fontSize: 14,
    opacity: 0.4,
  },
  headerCount: {
    fontSize: 13,
    opacity: 0.6,
  },
  closeButton: {
    marginLeft: 16,
  },
  headerAccent: {
    height: 1,
    width: '100%',
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 26,
  },
  separator: {
    height: 8,
  },
  itemContainer: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  lotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  lotLeft: {
    flex: 1,
    gap: 1,
  },
  lotDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  lotDetails: {
    fontSize: 11,
    opacity: 0.5,
  },
  lotRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  lotTotal: {
    fontSize: 12,
    fontWeight: '600',
  },
  lotGain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  lotGainAmount: {
    fontSize: 11,
    fontWeight: '600',
  },
  lotGainPercent: {
    fontSize: 10,
    fontWeight: '600',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  transactionLeft: {
    flex: 1,
    gap: 1,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionDate: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionDetails: {
    fontSize: 11,
    opacity: 0.5,
  },
  transactionRight: {
    alignItems: 'flex-end',
    gap: 1,
  },
  transactionTotal: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  transactionCommission: {
    fontSize: 10,
    opacity: 0.4,
    lineHeight: 18,
  },
  transactionGain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  transactionGainAmount: {
    fontSize: 11,
    fontWeight: '600',
  },
  transactionGainPercent: {
    fontSize: 10,
    fontWeight: '600',
  },
  fixedSummaryContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  summaryContainer: {
    gap: 10,
  },
  mainStatsLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 6,
  },
  compactStat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  compactStatValue: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  compactStatLabel: {
    fontSize: 10,
    opacity: 0.35,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  statDivider: {
    width: 1,
    height: 14,
  },
  performanceLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 4,
  },
  performanceItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  performanceLabel: {
    fontSize: 10,
    opacity: 0.35,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  performanceValues: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  performanceAmount: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  performancePercent: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.7,
  },
  performanceDivider: {
    width: 1,
    height: 12,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
    marginLeft: 8,
  },
});
