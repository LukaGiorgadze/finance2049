import { ThemedText } from '@/components/themed-text';
import { ImportButton } from '@/components/ui/import-button';
import { SectionTitle } from '@/components/ui/section-title';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addTransaction, formatCurrency, formatPercent, getValueColor, MASKED, toggleShowPortfolioValue, trackHomeAction, useHoldingsCount, usePortfolioSummary, useShowPortfolioValue } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { TransactionData } from './TransactionForm';
import { TransactionModal } from './TransactionModal';

// Track if animation has played globally to prevent re-animation on tab switch
let hasAnimatedPortfolioSummary = false;

export function PortfolioSummary() {
  const isVisible = useShowPortfolioValue();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  // Get portfolio data from store
  const portfolioData = usePortfolioSummary();
  const holdingsCount = useHoldingsCount();
  const hasHoldings = holdingsCount > 0;

  // Transaction modal state
  const [showTransactionModal, setShowTransactionModal] = useState(false);

  // Only animate on first mount
  const shouldAnimate = useRef(!hasAnimatedPortfolioSummary);
  useEffect(() => {
    hasAnimatedPortfolioSummary = true;
  }, []);

  const colors = isDark ? Colors.dark : Colors.light;
  const neutralColor = colors.text;

  const handleTransactionSubmit = (data: TransactionData) => {
    const shares = parseFloat(data.quantity) || 0;
    const price = parseFloat(data.price) || 0;
    try {
      addTransaction({
        type: data.type,
        symbol: data.symbol,
        shares,
        price,
        total: shares * price,
        commission: parseFloat(data.commission) || 0,
        date: data.date.toISOString(),
      }, data.assetType ?? '', data.name ?? '');
    } catch (e) {
      Alert.alert('Transaction Failed', e instanceof Error ? e.message : 'Failed to record transaction.');
    }
  };

  return (
    <Animated.View
      entering={shouldAnimate.current ? FadeInDown.duration(400) : undefined}
      style={[
        styles.container,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
        }
      ]}
    >
      <View style={styles.header}>
        <SectionTitle>Portfolio</SectionTitle>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            onPress={() => {
              void trackHomeAction({
                action: 'portfolio_toggle_visibility',
                target: isVisible ? 'hide' : 'show',
              });
              toggleShowPortfolioValue();
            }}
            style={styles.eyeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isVisible ? 'eye-outline' : 'eye-off-outline'}
              size={24}
              color={colors.text}
              style={{ opacity: 0.6 }}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ThemedText style={styles.totalLabel}>Total Value</ThemedText>
      <ThemedText style={styles.totalValue}>
        {isVisible ? formatCurrency(portfolioData.totalValue, 'never') : MASKED.currency}
      </ThemedText>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <ThemedText style={styles.statLabel}>Today&apos;s Return</ThemedText>
          <View style={styles.statValue}>
            <ThemedText style={[
              styles.statAmount,
              { color: isVisible ? getValueColor(portfolioData.todayChange, neutralColor) : neutralColor }
            ]}>
              {isVisible ? formatCurrency(portfolioData.todayChange, 'never') : MASKED.currency}
            </ThemedText>
          </View>
          <ThemedText style={[
            styles.statPercent,
            { color: isVisible ? getValueColor(portfolioData.todayChange, neutralColor) : neutralColor }
          ]}>
            {isVisible ? formatPercent(portfolioData.todayChangePercent, 'exceptZero') : MASKED.percent}
          </ThemedText>
        </View>

        <View style={[
          styles.divider,
          { backgroundColor: colors.cardBorder }
        ]} />

        <View style={styles.statBox}>
          <ThemedText style={styles.statLabel}>Total Return</ThemedText>
          <View style={styles.statValue}>
            <ThemedText style={[
              styles.statAmount,
              { color: isVisible ? getValueColor(portfolioData.totalGain, neutralColor) : neutralColor }
            ]}>
              {isVisible ? formatCurrency(portfolioData.totalGain, 'never') : MASKED.currency}
            </ThemedText>
          </View>
          <ThemedText style={[
            styles.statPercent,
            { color: isVisible ? getValueColor(portfolioData.totalGain, neutralColor) : neutralColor }
          ]}>
            {isVisible ? formatPercent(portfolioData.totalGainPercent, 'exceptZero') : MASKED.percent}
          </ThemedText>
        </View>
      </View>

      {hasHoldings ? (
        <TouchableOpacity
          style={[styles.viewButton, { backgroundColor: colors.surfaceElevated }]}
          onPress={() => {
            void trackHomeAction({ action: 'portfolio_view_details' });
            router.push('/(tabs)/portfolio');
          }}
        >
          <Ionicons name="chevron-forward" size={16} color={colors.text} style={{ opacity: 0.6 }} />
          <ThemedText style={styles.viewButtonText}>View Details</ThemedText>
        </TouchableOpacity>
      ) : (
        <View style={styles.emptyActions}>
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.surfaceElevated }]}
            onPress={() => {
              void trackHomeAction({ action: 'portfolio_add_transaction' });
              setShowTransactionModal(true);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color={colors.text} style={{ opacity: 0.7 }} />
            <ThemedText style={styles.addBtnText}>Add</ThemedText>
          </TouchableOpacity>
          <ImportButton
            style={{ flex: 1 }}
            onPress={() => {
              void trackHomeAction({ action: 'portfolio_import' });
              router.push('/import-transactions');
            }}
          />
        </View>
      )}

      <TransactionModal
        visible={showTransactionModal}
        onClose={() => setShowTransactionModal(false)}
        onSubmit={handleTransactionSubmit}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '400',
    opacity: 0.6,
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 36,
    fontWeight: '700',
    letterSpacing: -1.5,
    lineHeight: 42,
    marginBottom: 16,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyeButton: {
    padding: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '400',
    opacity: 0.5,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statAmount: {
    fontSize: 15,
    fontWeight: '600',
  },
  statPercent: {
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    width: 1,
    marginHorizontal: 12,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 4,
  },
  viewButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  emptyActions: {
    flexDirection: 'row',
    gap: 8,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 16,
  },
});
