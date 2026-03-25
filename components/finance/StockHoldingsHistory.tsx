import { LotsAndHistoryModal } from '@/components/finance/LotsAndHistoryModal';
import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatCurrency, formatDate, formatPercent, formatShares, getValueColor, MASKED, trackPositionDetailAction, useShowPortfolioValue, useUITransactionsBySymbol, type UIHolding } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface StockHoldingsHistoryProps {
  holding?: UIHolding | null;
  symbol: string;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

type ViewMode = 'holdings' | 'history';

const MAX_ITEMS_PREVIEW = 5;

export function StockHoldingsHistory({ holding, symbol, totalGain, totalGainPercent, dayChange, dayChangePercent }: StockHoldingsHistoryProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const [viewMode, setViewMode] = useState<ViewMode>('holdings');
  const [showFullLotsModal, setShowFullLotsModal] = useState(false);
  const [showFullHistoryModal, setShowFullHistoryModal] = useState(false);
  const isVisible = useShowPortfolioValue();

  // Get transactions from store
  const transactions = useUITransactionsBySymbol(symbol);

  const neutralColor = colors.text;

  const hasHolding = !!holding;
  const hasHistory = transactions.length > 0;

  if (!hasHolding && !hasHistory) {
    return null;
  }

  const displayedTransactions = transactions.slice(0, MAX_ITEMS_PREVIEW);
  return (
    <View style={[styles.container, { backgroundColor: colors.cardBackground }]}>
      {/* Segmented Control */}
      <View style={styles.header}>
        <View style={[styles.segmentedControl, { backgroundColor: colors.divider }]}>
          <TouchableOpacity
            style={[
              styles.segment,
              viewMode === 'holdings' && { backgroundColor: isDark ? colors.surfaceElevated : colors.cardBackground }
            ]}
            onPress={() => {
              void trackPositionDetailAction({ context: 'stock_detail', action: 'toggle_view', symbol, target: 'holdings' });
              setViewMode('holdings');
            }}
          >
            <ThemedText style={[
              styles.segmentText,
              { opacity: viewMode === 'holdings' ? 1 : 0.5 }
            ]}>
              Holdings
            </ThemedText>
          </TouchableOpacity>
          {hasHistory && (
            <TouchableOpacity
              style={[
                styles.segment,
                viewMode === 'history' && { backgroundColor: isDark ? colors.surfaceElevated : colors.cardBackground }
              ]}
              onPress={() => {
                void trackPositionDetailAction({ context: 'stock_detail', action: 'toggle_view', symbol, target: 'history' });
                setViewMode('history');
              }}
            >
              <ThemedText style={[
                styles.segmentText,
                { opacity: viewMode === 'history' ? 1 : 0.5 }
              ]}>
                History
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {viewMode === 'holdings' && !holding && (
        <View style={styles.emptyState}>
          <ThemedText style={styles.emptyStateText}>
            All {symbol} shares have been sold.
          </ThemedText>
          <ThemedText style={styles.emptyStateHint}>
            Tap ⋮ to record a transaction.
          </ThemedText>
        </View>
      )}
      {viewMode === 'holdings' && holding && (
        <View style={styles.content}>
          {/* Summary */}
          <View style={styles.summaryContainer}>
            {/* Stats Row */}

            <View style={styles.statsRow}>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Shares</ThemedText>
                <ThemedText style={styles.statValue}>{isVisible ? formatShares(holding.shares) : MASKED.shares}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Avg Cost</ThemedText>
                <ThemedText style={styles.statValue}>{isVisible ? formatCurrency(holding.avgCost, 'never') : MASKED.currency}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Cost Basis</ThemedText>
                <ThemedText style={styles.statValue}>{isVisible ? formatCurrency(holding.costBasis, 'never') : MASKED.currency}</ThemedText>
              </View>
              <View style={styles.statRow}>
                <ThemedText style={styles.statLabel}>Total Value</ThemedText>
                <ThemedText style={[styles.statValue, styles.statTotalValue]}>
                  {isVisible ? formatCurrency(holding.totalValue, 'never') : MASKED.currency}
                </ThemedText>
              </View>
            </View>

            {/* Gains Section */}
            <View style={styles.gainsSection}>
              <View style={styles.gainItem}>
                <View style={styles.gainHeader}>
                  <ThemedText style={styles.gainTitle}>Total Return</ThemedText>
                </View>
                <View style={styles.gainValueContainer}>
                  <ThemedText style={[
                    styles.gainValue,
                    { color: isVisible ? getValueColor(totalGain, neutralColor) : neutralColor }
                  ]}>
                    {isVisible ? formatCurrency(totalGain, 'never') : MASKED.currency}
                  </ThemedText>
                  <ThemedText style={[
                    styles.gainPercentage,
                    { color: isVisible ? getValueColor(totalGain, neutralColor) : neutralColor }
                  ]}>
                    ({isVisible ? formatPercent(totalGainPercent, 'exceptZero') : MASKED.percent})
                  </ThemedText>
                </View>
              </View>

              <View style={styles.gainItem}>
                <ThemedText style={styles.gainTitle}>Today&apos;s Return</ThemedText>
                <View style={styles.gainValueContainer}>
                  <ThemedText style={[
                    styles.gainValue,
                    { color: isVisible ? getValueColor(dayChange, neutralColor) : neutralColor }
                  ]}>
                    {isVisible ? formatCurrency(dayChange, 'never') : MASKED.currency}
                  </ThemedText>
                  <ThemedText style={[
                    styles.gainPercentage,
                    { color: isVisible ? getValueColor(dayChange, neutralColor) : neutralColor }
                  ]}>
                    ({isVisible ? formatPercent(dayChangePercent, 'exceptZero') : MASKED.percent})
                  </ThemedText>
                </View>
              </View>
            </View>
          </View>

          {/* View All Lots Button */}
          {holding.lots.length > 0 && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => {
                void trackPositionDetailAction({ context: 'stock_detail', action: 'open_lots', symbol });
                setShowFullLotsModal(true);
              }}
            >
              <ThemedText style={styles.showAllText}>
                View Lots
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {viewMode === 'history' && (
        <View style={styles.content}>
          {displayedTransactions.map((transaction, index) => {
            const isSplit = transaction.type === 'split';
            const badgeBg = isSplit ? colors.orangeBg : (transaction.type === 'buy' ? colors.greenTintBg : colors.redTintBg);
            const badgeIcon = isSplit ? 'swap-horizontal' as const : (transaction.type === 'buy' ? 'add' as const : 'remove' as const);
            const badgeColor = isSplit ? colors.orange : (transaction.type === 'buy' ? colors.green : colors.red);

            const splitLabel = isSplit
              ? (transaction.splitTo != null && transaction.splitFrom != null
                ? (transaction.splitTo < transaction.splitFrom
                  ? `${transaction.splitTo}:${transaction.splitFrom} reverse split`
                  : `${transaction.splitFrom}:${transaction.splitTo} stock split`)
                : 'Stock Split')
              : '';

            return (
              <View key={transaction.id}>
                {index > 0 && <View style={[{ backgroundColor: colors.divider }]} />}
                <View style={[
                  styles.transactionRow,
                  index < displayedTransactions.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: colors.listItemBorder,
                  }
                ]}>
                  <View style={styles.transactionLeft}>
                    <View style={styles.transactionHeader}>
                      <View style={[
                        styles.typeBadge,
                        { backgroundColor: badgeBg }
                      ]}>
                        <Ionicons
                          name={badgeIcon}
                          size={10}
                          color={badgeColor}
                        />
                      </View>
                      <ThemedText style={styles.transactionDate}>{formatDate(transaction.date)}</ThemedText>
                    </View>
                    {isSplit ? (
                      <ThemedText style={styles.transactionDetails}>
                        {splitLabel}
                      </ThemedText>
                    ) : (
                      <ThemedText style={styles.transactionDetails}>
                        {isVisible ? `${formatShares(transaction.shares)} shares @ ${formatCurrency(transaction.price, 'never')}` : `${MASKED.shares} shares @ ${MASKED.currency}`}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.transactionRight}>
                    {!isSplit && (
                      <>
                        <ThemedText style={styles.transactionTotal}>
                          {isVisible ? formatCurrency(transaction.total, 'never') : MASKED.currency}
                        </ThemedText>
                        {isVisible && !!transaction.commission && (
                          <ThemedText style={styles.transactionCommission}>
                            incl. {formatCurrency(transaction.commission, 'never')} fee
                          </ThemedText>
                        )}
                      </>
                    )}
                    {transaction.type === 'sell' && transaction.gain !== undefined && (
                      <View style={styles.transactionGain}>
                        <ThemedText style={[
                          styles.transactionGainAmount,
                          { color: isVisible ? getValueColor(transaction.gain, neutralColor) : undefined }
                        ]}>
                          {isVisible ? formatCurrency(transaction.gain, 'never') : MASKED.currency}
                        </ThemedText>
                        <ThemedText style={[
                          styles.transactionGainPercent,
                          { color: isVisible ? getValueColor(transaction.gain, neutralColor) : undefined }
                        ]}>
                          ({isVisible ? formatPercent(transaction.gainPercent ?? 0, 'exceptZero') : MASKED.percent})
                        </ThemedText>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}

          {transactions.length > 0 && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => {
                void trackPositionDetailAction({ context: 'stock_detail', action: 'open_history', symbol });
                setShowFullHistoryModal(true);
              }}
            >
              <ThemedText style={styles.showAllText}>
                All Transactions
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Full Lots Modal */}
      {holding && (
        <LotsAndHistoryModal
          visible={showFullLotsModal}
          onClose={() => setShowFullLotsModal(false)}
          type="lots"
          lots={holding.lots.map((lot) => ({
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
          symbol={holding.symbol}
          holding={{
            symbol: holding.symbol,
            name: holding.name,
            shares: holding.shares,
            avgCost: holding.avgCost,
            currentPrice: holding.currentPrice,
            totalValue: holding.totalValue,
            totalGain,
            totalGainPercent,
            dayChange,
            dayChangePercent,
            lots: holding.lots,
          }}
          analyticsContext="stock_detail"
        />
      )}

      {/* Full History Modal */}
      <LotsAndHistoryModal
        visible={showFullHistoryModal}
        onClose={() => setShowFullHistoryModal(false)}
        type="history"
        symbol={symbol}
        analyticsContext="stock_detail"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    padding: 8,
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
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 12,
  },
  summaryContainer: {
    gap: 8,
  },
  statsRow: {
    gap: 2,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.5,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '500',
  },
  statTotalValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  gainsSection: {
    gap: 4,
  },
  gainItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gainHeader: {
    gap: 1,
  },
  gainTitle: {
    fontSize: 12,
    opacity: 0.6,
  },
  gainValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  gainValue: {
    fontSize: 13,
    fontWeight: '600',
  },
  gainPercentage: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
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
    fontSize: 12,
    opacity: 0.5,
  },
  transactionRight: {
    alignItems: 'flex-end',
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
    fontSize: 12,
    fontWeight: '600',
  },
  transactionGainPercent: {
    fontSize: 12,
    fontWeight: '600',
  },
  showAllButton: {
    paddingVertical: 8,
    alignItems: 'center',
    marginTop: 6,
  },
  showAllText: {
    fontSize: 12,
    opacity: 0.5,
  },
  emptyState: {
    paddingHorizontal: 12,
    paddingBottom: 16,
    alignItems: 'center',
    gap: 4,
  },
  emptyStateText: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.5,
  },
  emptyStateHint: {
    fontSize: 12,
    opacity: 0.35,
  },
});
