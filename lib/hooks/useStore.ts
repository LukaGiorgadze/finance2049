/**
 * Store Hooks
 *
 * React hooks for accessing Legend-State store with fine-grained reactivity.
 */

import { useSelector } from '@legendapp/state/react';
import {
  store$,
  selectAllHoldings,
  selectHolding,
  selectTransactions,
  selectTransactionsBySymbol,
  selectMarketPrice,
} from '../store';
import type { Holding, Transaction, MarketPrice } from '../store/types';

// ============================================================================
// Portfolio Hooks
// ============================================================================

/**
 * Get all holdings reactively
 */
export function useHoldings(): Holding[] {
  return useSelector(() => selectAllHoldings());
}

/**
 * Get a specific holding by symbol
 */
export function useHolding(symbol: string): Holding | undefined {
  return useSelector(() => selectHolding(symbol));
}

/**
 * Get holdings count
 */
export function useHoldingsCount(): number {
  return useSelector(() => Object.keys(store$.portfolio.holdings.get()).length);
}

// ============================================================================
// Transaction Hooks
// ============================================================================

/**
 * Get all transactions sorted by date
 */
export function useTransactions(): Transaction[] {
  return useSelector(() => selectTransactions());
}

/**
 * Get transactions for a specific symbol
 */
export function useTransactionsBySymbol(symbol: string): Transaction[] {
  return useSelector(() => selectTransactionsBySymbol(symbol));
}

/**
 * Get transaction count
 */
export function useTransactionsCount(): number {
  return useSelector(() => store$.portfolio.transactions.get().length);
}

// ============================================================================
// Market Data Hooks
// ============================================================================

/**
 * Get market price for a symbol
 */
export function useMarketPrice(symbol: string): MarketPrice | undefined {
  return useSelector(() => selectMarketPrice(symbol));
}

/**
 * Get all market prices
 */
export function useMarketPrices(): Record<string, MarketPrice> {
  return useSelector(() => store$.market.prices.get());
}

/**
 * Get market data last updated timestamp
 */
export function useMarketLastUpdated(): string | null {
  return useSelector(() => store$.market.lastUpdated.get());
}

// ============================================================================
// Preferences Hooks
// ============================================================================

/**
 * Get show portfolio value preference
 */
export function useShowPortfolioValue(): boolean {
  return useSelector(() => store$.preferences.showPortfolioValue.get());
}

/**
 * Get default timeline preference
 */
export function useDefaultTimeline() {
  return useSelector(() => store$.preferences.defaultTimeline.get());
}

/**
 * Get gain view preference (today vs total)
 */
export function useGainView() {
  return useSelector(() => store$.preferences.gainView.get() ?? 'today') as 'today' | 'total';
}

/**
 * Set gain view preference
 */
export function setGainView(value: 'today' | 'total') {
  store$.preferences.gainView.set(value);
}

// ============================================================================
// Computed Portfolio Values
// ============================================================================

/**
 * Calculate total portfolio value based on holdings and market prices
 */
export function usePortfolioValue(): number {
  return useSelector(() => {
    const holdings = selectAllHoldings();
    const prices = store$.market.prices.get();

    return holdings.reduce((total, holding) => {
      const price = prices[holding.symbol]?.price ?? holding.avgCost;
      return total + holding.totalShares * price;
    }, 0);
  });
}

/**
 * Calculate total portfolio cost basis
 */
export function usePortfolioCostBasis(): number {
  return useSelector(() => {
    const holdings = selectAllHoldings();
    return holdings.reduce((total, holding) => {
      return total + holding.totalShares * holding.avgCost;
    }, 0);
  });
}

/**
 * Calculate total portfolio gain/loss
 */
export function usePortfolioGain(): { amount: number; percent: number } {
  return useSelector(() => {
    const holdings = selectAllHoldings();
    const prices = store$.market.prices.get();

    let totalValue = 0;
    let totalCost = 0;

    for (const holding of holdings) {
      const price = prices[holding.symbol]?.price ?? holding.avgCost;
      totalValue += holding.totalShares * price;
      totalCost += holding.totalShares * holding.avgCost;
    }

    const amount = totalValue - totalCost;
    const percent = totalCost > 0 ? (amount / totalCost) * 100 : 0;

    return { amount, percent };
  });
}
