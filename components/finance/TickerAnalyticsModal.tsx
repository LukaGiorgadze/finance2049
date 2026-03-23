import { ThemedText } from '@/components/themed-text';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  formatCurrency,
  formatPercent,
  formatShares,
  getValueColor,
  MASKED,
  trackPositionDetailAction,
  useShowPortfolioValue,
  useUIHolding,
  useUITransactionsBySymbol,
} from '@/lib';
import type { TickerStat } from '@/lib/hooks/useAnalytics';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LotsAndHistoryModal } from './LotsAndHistoryModal';

interface Props {
  visible: boolean;
  onClose: () => void;
  ticker: TickerStat | null;
}

export function TickerAnalyticsModal({ visible, onClose, ticker }: Props) {
  const [historyVisible, setHistoryVisible] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const isVisible = useShowPortfolioValue();
  const neutralColor = colors.text;
  const dividerColor = colors.divider;
  const wasVisibleRef = useRef(false);

  const symbol = ticker?.symbol ?? '';
  const transactions = useUITransactionsBySymbol(symbol);
  const holding = useUIHolding(symbol);

  if (!ticker) return null;

  const hasBrandColor = !!BRAND_COLORS[ticker.symbol];
  const badgeBg = BRAND_COLORS[ticker.symbol] || colors.surface;
  const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;

  const sellTransactions = transactions.filter((t) => t.type === 'sell');
  const buyTransactions = transactions.filter((t) => t.type === 'buy');

  const textColor = colors.text;

  useEffect(() => {
    if (!ticker) return;
    if (visible && !wasVisibleRef.current) {
      void trackPositionDetailAction({
        context: 'statistics',
        action: 'modal_open',
        symbol: ticker.symbol,
        target: 'ticker_analytics',
      });
    }
    if (!visible && wasVisibleRef.current) {
      void trackPositionDetailAction({
        context: 'statistics',
        action: 'modal_close',
        symbol: ticker.symbol,
        target: 'ticker_analytics',
      });
    }
    wasVisibleRef.current = visible;
  }, [ticker, visible]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerContent}>
            <ThemedText style={styles.headerTitle}>{ticker.symbol}</ThemedText>
            <View style={styles.headerSubtitleRow}>
              <View style={[styles.headerBadge, { backgroundColor: badgeBg }]}>
                <ThemedText style={[styles.headerBadgeText, { color: badgeTextColor }]}>
                  {ticker.symbol}
                </ThemedText>
              </View>
              <ThemedText style={styles.headerDot}>·</ThemedText>
              <ThemedText style={styles.headerSub}>
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
                {'  ·  '}{ticker.isHeld ? 'currently held' : 'fully closed'}
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
        <View style={[styles.accent, { backgroundColor: colors.headerAccent }]} />

        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Total Return ── */}
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <ThemedText style={styles.cardLabel}>Total Return</ThemedText>
            <ThemedText
              style={[
                styles.totalReturnNumber,
                { color: isVisible ? getValueColor(ticker.totalReturn, neutralColor) : neutralColor },
              ]}
            >
              {isVisible ? formatCurrency(ticker.totalReturn, 'exceptZero') : MASKED.currency}
            </ThemedText>

            <View style={[styles.divider, { backgroundColor: dividerColor, marginVertical: 14 }]} />

            {/* Realized / Unrealized split */}
            <View style={styles.twoCol}>
              <View style={styles.colItem}>
                <ThemedText style={styles.colLabel}>Realized</ThemedText>
                <ThemedText
                  style={[
                    styles.colValue,
                    { color: isVisible ? getValueColor(ticker.realizedGain, neutralColor) : neutralColor },
                  ]}
                >
                  {isVisible ? formatCurrency(ticker.realizedGain, 'exceptZero') : MASKED.currency}
                </ThemedText>
                {ticker.realizedCostBasis > 0 && (
                  <ThemedText
                    style={[
                      styles.colPercent,
                      { color: isVisible ? getValueColor(ticker.realizedGain, neutralColor) : neutralColor },
                    ]}
                  >
                    {isVisible ? formatPercent(ticker.realizedGainPercent, 'exceptZero') : MASKED.percent}
                  </ThemedText>
                )}
                {ticker.sellCount > 0 && (
                  <ThemedText style={styles.colSub}>
                    {ticker.sellCount} {ticker.sellCount === 1 ? 'sale' : 'sales'}
                  </ThemedText>
                )}
              </View>

              <View style={[styles.colDivider, { backgroundColor: dividerColor }]} />

              <View style={styles.colItem}>
                <ThemedText style={styles.colLabel}>Unrealized</ThemedText>
                {ticker.isHeld ? (
                  <>
                    <ThemedText
                      style={[
                        styles.colValue,
                        { color: neutralColor },
                      ]}
                    >
                      {isVisible ? formatCurrency(ticker.unrealizedGain, 'exceptZero') : MASKED.currency}
                    </ThemedText>
                    <ThemedText style={styles.colSub}>Open Position</ThemedText>
                  </>
                ) : (
                  <>
                    <ThemedText style={[styles.colValue, { opacity: 0.35 }]}>—</ThemedText>
                    <ThemedText style={styles.colSub}>Position Closed</ThemedText>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* ── Current Holding ── */}
          {holding && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.cardBorder }]}>
              <ThemedText style={styles.cardLabel}>Current Position</ThemedText>
              <View style={styles.statsList}>
                <StatLine
                  label="Shares"
                  value={isVisible ? formatShares(holding.shares) : MASKED.shares}
                  isDark={isDark}
                  dividerColor={dividerColor}
                />
                <StatLine
                  label="Avg Cost"
                  value={isVisible ? formatCurrency(holding.avgCost, 'never') : MASKED.currency}
                  isDark={isDark}
                  dividerColor={dividerColor}
                />
                <StatLine
                  label="Current Price"
                  value={isVisible ? formatCurrency(holding.currentPrice, 'never') : MASKED.currency}
                  isDark={isDark}
                  dividerColor={dividerColor}
                />
                <StatLine
                  label="Market Value"
                  value={isVisible ? formatCurrency(holding.totalValue, 'never') : MASKED.currency}
                  valueWeight="700"
                  isDark={isDark}
                  dividerColor={dividerColor}
                  isLast
                />
              </View>
            </View>
          )}

          {/* ── Trade History ── */}
          {transactions.length > 0 && (
            <TouchableOpacity
              style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.cardBorder }]}
              onPress={() => {
                void trackPositionDetailAction({
                  context: 'statistics',
                  action: 'open_history',
                  symbol,
                });
                setHistoryVisible(true);
              }}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.cardLabel}>Transaction History</ThemedText>
              <View style={styles.historyLinkRow}>
                <ThemedText style={styles.historyCount}>
                  {transactions.length} {transactions.length === 1 ? 'transaction' : 'transactions'}
                </ThemedText>
                <Ionicons name="chevron-forward" size={18} color={colors.iconMuted} />
              </View>
            </TouchableOpacity>
          )}

          {/* ── Summary stats ── */}
          {(buyTransactions.length > 0 || sellTransactions.length > 0) && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.cardBorder }]}>
              <ThemedText style={styles.cardLabel}>Summary</ThemedText>
              <View style={styles.statsList}>
                <StatLine
                  label="Total Invested"
                  value={
                    isVisible
                      ? formatCurrency(
                          buyTransactions.reduce(
                            (s, t) => s + (t.shares * t.price + (t.commission ?? 0)),
                            0,
                          ),
                          'never',
                        )
                      : MASKED.currency
                  }
                  isDark={isDark}
                  dividerColor={dividerColor}
                />
                {sellTransactions.length > 0 && (
                  <StatLine
                    label="Total Proceeds"
                    value={
                      isVisible
                        ? formatCurrency(
                            sellTransactions.reduce(
                              (s, t) => s + t.total - (t.commission ?? 0),
                              0,
                            ),
                            'never',
                          )
                        : MASKED.currency
                    }
                    isDark={isDark}
                    dividerColor={dividerColor}
                  />
                )}
                <StatLine
                  label="Win / Loss trades"
                  value={`${sellTransactions.filter((t) => (t.gain ?? 0) > 0).length} W  /  ${sellTransactions.filter((t) => (t.gain ?? 0) < 0).length} L`}
                  isDark={isDark}
                  dividerColor={dividerColor}
                  isLast
                />
              </View>
            </View>
          )}
        </ScrollView>

        <LotsAndHistoryModal
          visible={historyVisible}
          onClose={() => setHistoryVisible(false)}
          type="history"
          symbol={symbol}
          analyticsContext="statistics"
        />
      </View>
    </Modal>
  );
}

// ── StatLine helper ──────────────────────────────────────────────────────────

function StatLine({
  label,
  value,
  valueColor,
  valueWeight = '500',
  isDark,
  dividerColor,
  isLast = false,
}: {
  label: string;
  value: string;
  valueColor?: string;
  valueWeight?: '500' | '600' | '700';
  isDark: boolean;
  dividerColor: string;
  isLast?: boolean;
}) {
  return (
    <>
      <View style={styles.statLineRow}>
        <ThemedText style={styles.statLineLabel}>{label}</ThemedText>
        <ThemedText
          style={[
            styles.statLineValue,
            { fontWeight: valueWeight },
            valueColor ? { color: valueColor } : undefined,
          ]}
        >
          {value}
        </ThemedText>
      </View>
      {!isLast && <View style={[styles.rowDivider, { backgroundColor: dividerColor }]} />}
    </>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

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
  headerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 0,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  headerDot: {
    fontSize: 14,
    opacity: 0.4,
  },
  headerSub: {
    fontSize: 13,
    opacity: 0.6,
  },
  closeButton: {
    marginLeft: 16,
  },
  accent: {
    height: 1,
    width: '100%',
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },

  card: {
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardLabel: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
    marginBottom: 4,
  },
  totalReturnNumber: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 42,
  },

  divider: { height: 1, width: '100%' },

  twoCol: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  colItem: {
    flex: 1,
    alignItems: 'center',
  },
  colDivider: {
    width: 1,
    height: 56,
  },
  colLabel: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  colValue: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  colPercent: {
    fontSize: 12,
    fontWeight: '500',
  },
  colSub: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.4,
  },


  statsList: { gap: 0 },
  statLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  statLineLabel: {
    fontSize: 15,
    opacity: 0.65,
  },
  statLineValue: {
    fontSize: 15,
  },

  rowDivider: { height: 1 },

  // Transaction History link card
  historyLinkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  historyCount: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
});
