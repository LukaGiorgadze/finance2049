/**
 * Portfolio Calculations
 *
 * Utility functions for calculating portfolio values, gains, etc.
 */

import { Colors } from "@/constants/theme";
import { getTickerTypeInfo } from "../services/tickerTypes";
import type { Holding, MarketPrice } from "../store/types";

/**
 * Calculate holding value with current market price
 */
export function calculateHoldingValue(
  holding: Holding,
  marketPrice?: MarketPrice,
): number {
  const price = marketPrice?.price ?? holding.avgCost;
  return holding.totalShares * price;
}

/**
 * Calculate holding gain/loss
 */
export function calculateHoldingGain(
  holding: Holding,
  marketPrice?: MarketPrice,
): { amount: number; percent: number } {
  const currentPrice = marketPrice?.price ?? holding.avgCost;
  const currentValue = holding.totalShares * currentPrice;
  // Cost basis includes purchase price and commissions
  const costBasis =
    holding.totalShares * holding.avgCost + (holding.totalCommissions ?? 0);
  const amount = currentValue - costBasis;
  const percent = costBasis > 0 ? (amount / costBasis) * 100 : 0;

  return { amount, percent };
}

/**
 * Calculate day change for a holding
 */
export function calculateDayChange(
  holding: Holding,
  marketPrice?: MarketPrice,
): { amount: number; percent: number } {
  if (!marketPrice) {
    return { amount: 0, percent: 0 };
  }

  const amount = holding.totalShares * marketPrice.change;
  const percent = marketPrice.changePercent;

  return { amount, percent };
}

/**
 * Calculate portfolio totals
 */
export function calculatePortfolioTotals(
  holdings: Holding[],
  prices: Record<string, MarketPrice>,
): {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  dayChange: number;
  dayChangePercent: number;
} {
  let totalValue = 0;
  let totalCost = 0;
  let dayChange = 0;

  for (const holding of holdings) {
    const price = prices[holding.symbol];
    const currentPrice = price?.price ?? holding.avgCost;

    totalValue += holding.totalShares * currentPrice;
    // Cost basis includes purchase price and commissions
    totalCost +=
      holding.totalShares * holding.avgCost + (holding.totalCommissions ?? 0);

    if (price) {
      dayChange += holding.totalShares * price.change;
    }
  }

  const totalGain = totalValue - totalCost;
  const totalGainPercent = totalCost > 0 ? (totalGain / totalCost) * 100 : 0;
  const previousValue = totalValue - dayChange;
  const dayChangePercent =
    previousValue > 0 ? (dayChange / previousValue) * 100 : 0;

  return {
    totalValue,
    totalCost,
    totalGain,
    totalGainPercent,
    dayChange,
    dayChangePercent,
  };
}

/**
 * Calculate asset allocation from holdings
 */
export function calculateAssetAllocation(
  holdings: Holding[],
  prices: Record<string, MarketPrice>,
): {
  type: string;
  value: number;
  percent: number;
  color: string;
}[] {
  // Calculate total value by asset type
  const valueByType: Record<string, number> = {};
  let totalValue = 0;

  for (const holding of holdings) {
    const price = prices[holding.symbol]?.price ?? holding.avgCost;
    const value = holding.totalShares * price;
    const typeCode = holding.assetType;
    valueByType[typeCode] = (valueByType[typeCode] ?? 0) + value;
    totalValue += value;
  }

  // Convert to allocation array, using tickerTypes for labels/colors
  return Object.entries(valueByType).map(([type, value]) => {
    const info = getTickerTypeInfo(type);
    return {
      type: info.label,
      value,
      percent: totalValue > 0 ? (value / totalValue) * 100 : 0,
      color: info.color,
    };
  });
}

/**
 * Format a dollar amount: $1,234.56
 * Always 2 decimal places, absolute value, with $ prefix.
 */
export function formatCurrency(amount: number, signDisplay: keyof Intl.NumberFormatOptionsSignDisplayRegistry | undefined): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    signDisplay,
  }).format(amount);

  return formatted;
}

/**
 * Format percentage: +1.23% or -1.23%
 */
export function formatPercent(percent: number, signDisplay: keyof Intl.NumberFormatOptionsSignDisplayRegistry | undefined): string {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay,
  }).format(percent / 100);

  return formatted;
}

/**
 * Get the appropriate color for a gain/loss value.
 * Returns green for positive, red for negative, or the provided neutral color.
 */
export function getValueColor(value: number, neutralColor: string): string {
  if (value < 0) return Colors.light.red;
  if (value > 0) return Colors.light.green;
  return neutralColor;
}

/**
 * Format shares count, rounding to avoid floating-point artifacts.
 */
export function formatShares(shares: number, maximumFractionDigits: number = 6): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(shares);
}

/**
 * Format an ISO date string as "Feb 11, 2025".
 */
export function formatDate(dateStr: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day] = dateStr.split('-').map(Number);
  return `${months[month - 1]} ${day}, ${year}`;
}

/**
 * Format a Date as a local calendar date string in YYYY-MM-DD form.
 * Avoids UTC conversion so date pickers do not shift by timezone.
 */
export function formatLocalDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Minimum share count treated as a real position.
 * Values below this are floating-point residue from sell arithmetic and should
 * be considered zero. Safe for any purchase quantity up to ~10M shares rounded
 * to 6 decimal places (max float error ~1e-13 per subtraction).
 */
export const SHARES_EPSILON = 1e-9;

/**
 * Masked display constants for hidden portfolio values.
 */
export const MASKED = {
  currency: "••••••",
  percent: "••••",
  shares: "••",
} as const;
