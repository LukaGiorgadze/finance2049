/**
 * Portfolio Hooks
 *
 * Reactive hooks for portfolio data with computed values for UI display.
 */

import { useSelector } from '@legendapp/state/react';
import { store$, selectAllHoldings } from '../store';
import type { Holding as StoreHolding, Transaction as StoreTransaction } from '../store/types';
import { calculateAssetAllocation } from '../utils/calculations';

// ============================================================================
// UI-Ready Types (match what the UI components expect)
// ============================================================================

export interface UIHolding {
  id: string;
  symbol: string;
  name: string;
  shares: number;
  avgCost: number;
  currentPrice: number;
  totalValue: number;
  costBasis: number;
  assetType: string;
  lots: UIHoldingLot[];
}

export interface UIHoldingLot {
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

export interface UITransaction {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'split';
  shares: number;
  price: number;
  total: number;
  date: string;
  commission?: number;
  gain?: number;
  gainPercent?: number;
  splitFrom?: number;
  splitTo?: number;
}

export interface PortfolioSummary {
  totalValue: number;
  todayChange: number;
  todayChangePercent: number;
  totalGain: number;
  totalGainPercent: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function getMarketPrice(symbol: string): { price: number; change: number; changePercent: number } {
  const marketPrice = store$.market.prices[symbol].get();
  if (marketPrice) {
    return {
      price: marketPrice.price,
      change: marketPrice.change,
      changePercent: marketPrice.changePercent,
    };
  }
  // Fallback: use avgCost as price (no change)
  const holding = store$.portfolio.holdings[symbol].get();
  return {
    price: holding?.avgCost ?? 0,
    change: 0,
    changePercent: 0,
  };
}

function transformHoldingToUI(holding: StoreHolding): UIHolding {
  const market = getMarketPrice(holding.symbol);
  const currentPrice = market.price;
  const totalValue = holding.totalShares * currentPrice;
  // Cost basis includes purchase price and commissions
  const costBasis = holding.totalShares * holding.avgCost + (holding.totalCommissions ?? 0);

  // Distribute holding commissions proportionally across lots so per-lot
  // gains sum to the same total as the holding-level gain.
  const totalRemainingShares = holding.lots.reduce((sum, lot) => sum + lot.remainingShares, 0);

  const lots: UIHoldingLot[] = [...holding.lots]
    .sort((a, b) =>
      new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime()
      || b.transactionId.localeCompare(a.transactionId)
    )
    .map((lot) => {
    const lotCommission = totalRemainingShares > 0
      ? (lot.remainingShares / totalRemainingShares) * (holding.totalCommissions ?? 0)
      : 0;
    const lotCurrentValue = lot.remainingShares * currentPrice;
    const lotTotalCost = lot.remainingShares * lot.purchasePrice + lotCommission;
    const lotGain = lotCurrentValue - lotTotalCost;
    const lotGainPercent = lotTotalCost > 0 ? (lotGain / lotTotalCost) * 100 : 0;

    return {
      id: lot.id,
      transactionId: lot.transactionId,
      shares: lot.remainingShares,
      purchasePrice: lot.purchasePrice,
      purchaseDate: lot.purchaseDate,
      currentPrice,
      totalCost: lotTotalCost,
      currentValue: lotCurrentValue,
      gain: lotGain,
      gainPercent: lotGainPercent,
    };
  });

  return {
    id: holding.id,
    symbol: holding.symbol,
    name: holding.name,
    shares: holding.totalShares,
    avgCost: holding.avgCost,
    currentPrice,
    totalValue,
    costBasis,
    assetType: holding.assetType,
    lots,
  };
}

function transformTransactionToUI(tx: StoreTransaction): UITransaction {
  return {
    id: tx.id,
    symbol: tx.symbol,
    type: tx.type,
    shares: tx.shares,
    price: tx.price,
    total: tx.total,
    date: tx.date,
    commission: tx.commission,
    gain: tx.realizedGain,
    gainPercent: tx.realizedGainPercent,
    splitFrom: tx.splitFrom,
    splitTo: tx.splitTo,
  };
}

// ============================================================================
// Portfolio Summary Hook
// ============================================================================

export function usePortfolioSummary(): PortfolioSummary {
  return useSelector(() => {
    const holdings = selectAllHoldings();
    const prices = store$.market.prices.get();

    let totalValue = 0;
    let totalCost = 0;
    let dayChange = 0;

    for (const holding of holdings) {
      const price = prices[holding.symbol]?.price ?? holding.avgCost;
      const priceChange = prices[holding.symbol]?.change ?? 0;

      totalValue += holding.totalShares * price;
      // Cost basis includes purchase price and commissions
      totalCost += holding.totalShares * holding.avgCost + (holding.totalCommissions ?? 0);
      dayChange += holding.totalShares * priceChange;
    }

    const totalGain = totalValue - totalCost;
    const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
    const previousValue = totalValue - dayChange;
    const todayChangePercent = previousValue > 0 ? (dayChange / previousValue) * 100 : 0;

    return {
      totalValue,
      todayChange: dayChange,
      todayChangePercent,
      totalGain,
      totalGainPercent,
    };
  });
}

// ============================================================================
// Holdings Hooks
// ============================================================================

/**
 * Get all holdings as UI-ready format
 */
export function useUIHoldings(): UIHolding[] {
  return useSelector(() => {
    const holdings = selectAllHoldings();
    return holdings.map(transformHoldingToUI);
  });
}

/**
 * Get a specific holding as UI-ready format
 */
export function useUIHolding(symbol: string): UIHolding | null {
  return useSelector(() => {
    const holding = store$.portfolio.holdings[symbol].get();
    if (!holding) return null;
    return transformHoldingToUI(holding);
  });
}

/**
 * Get holdings count
 */
export function useHoldingsCount(): number {
  return useSelector(() => Object.keys(store$.portfolio.holdings.get() || {}).length);
}

// ============================================================================
// Transaction Hooks
// ============================================================================

/**
 * Get all transactions as UI-ready format, sorted by date (newest first)
 */
export function useUITransactions(): UITransaction[] {
  return useSelector(() => {
    const transactions = store$.portfolio.transactions.get();
    return [...transactions]
      .sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map(transformTransactionToUI);
  });
}

/**
 * Get transactions for a specific symbol
 */
export function useUITransactionsBySymbol(symbol: string): UITransaction[] {
  return useSelector(() => {
    const transactions = store$.portfolio.transactions.get();
    return transactions
      .filter((t) => t.symbol === symbol)
      .sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
        || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .map(transformTransactionToUI);
  });
}

// ============================================================================
// Asset Allocation Hook
// ============================================================================

export interface AssetAllocationItem {
  type: string;
  value: number;
  percent: number;
  color: string;
}

/**
 * Get asset allocation breakdown
 */
export function useAssetAllocation(): AssetAllocationItem[] {
  return useSelector(() => {
    const holdings = selectAllHoldings();
    const prices = store$.market.prices.get() || {};
    return calculateAssetAllocation(holdings, prices);
  });
}
