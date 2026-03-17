/**
 * Investment Analytics Hook
 *
 * Computes historical performance statistics from transactions and holdings.
 */

import { useSelector } from '@legendapp/state/react';
import { selectAllHoldings, store$ } from '../store';
import { formatDate } from '../utils/calculations';

// ============================================================================
// Types
// ============================================================================

export interface TickerStat {
  symbol: string;
  name?: string;
  isHeld: boolean;
  realizedGain: number;
  realizedCostBasis: number;
  realizedGainPercent: number;
  unrealizedGain: number;
  unrealizedCostBasis: number;
  totalReturn: number;
  totalReturnPercent: number;
  sellCount: number;
}

export interface RecentClosedTrade {
  symbol: string;
  date: string;
  realizedGain: number;
  realizedGainPercent: number;
}

export interface RealizedGain {
  label: string;
  /** "YYYY-MM-DD" date key for filtering */
  dateKey: string;
  gain: number;
}

export interface InvestmentAnalytics {
  firstInvestmentDate: string | null;
  lastInvestmentDate: string | null;
  investingDuration: string;
  totalInvested: number;
  /** All-time maximum amount ever put to work in the market */
  totalCumulativeInvested: number;
  totalRealizedGain: number;
  totalRealizedCostBasis: number;
  totalRealizedGainPercent: number;
  totalUnrealizedGain: number;
  totalUnrealizedCostBasis: number;
  totalUnrealizedGainPercent: number;
  totalReturn: number;
  winCount: number;
  lossCount: number;
  winRate: number;
  tickerStats: TickerStat[];
  /** Positive = win streak length, negative = loss streak length, 0 = no sells */
  currentStreak: number;
  /** Last 5 closed (sell) trades, newest first */
  recentClosedTrades: RecentClosedTrade[];
  totalTransactions: number;
  totalBuyTransactions: number;
  totalSellTransactions: number;
  // Activity stats
  avgBuyAmount: number;
  totalCommissions: number;
  avgDaysBetweenBuys: number;
  investingFrequency: string;
  mostTradedSymbol: string | null;
  mostTradedSymbolCount: number;
  mostActiveMonth: string | null;
  mostActiveMonthCount: number;
  realizedGains: RealizedGain[];
}

// ============================================================================
// Helpers
// ============================================================================

function getInvestingDuration(startDate: string): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0 && months === 0) return 'Just started';
  if (years === 0) return `${months}mo`;
  if (months === 0) return `${years}yr`;
  return `${years}yr ${months}mo`;
}

function formatFrequency(avgDays: number): string {
  if (avgDays <= 1.2) return '🔥 Daily Grind';
  if (avgDays <= 2.5) return '⚡ Hyper-active';
  if (avgDays <= 4.5) return '🚀 Rapid Rhythm';
  if (avgDays <= 8.5) return '📅 Weekly Habit';
  if (avgDays <= 12.5) return '🧘 Zen Steady';
  if (avgDays <= 18.5) return '🔄 Fortnightly Flow';
  if (avgDays <= 35.5) return '🌙 Monthly Orbit';
  if (avgDays <= 55) return '🌊 Tidal Shift';
  if (avgDays <= 110) return '🏔️ Seasonal Pace';
  if (avgDays <= 200) return '🐢 Patient Builder';
  return '🎯 Sniper Entry';
}

function formatMonthShort(key: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [year, month] = key.split('-').map(Number);
  return `${months[month - 1]} '${String(year).slice(2)}`;
}

function formatMonthYear(key: string): string {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const [year, month] = key.split('-').map(Number);
  return `${months[month - 1]} ${year}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useInvestmentAnalytics(): InvestmentAnalytics {
  return useSelector(() => {
    const transactions = store$.portfolio.transactions.get() ?? [];
    const holdings = selectAllHoldings();
    const prices = store$.market.prices.get() ?? {};

    const buyTransactions = transactions.filter((t) => t.type === 'buy');
    const sellTransactions = transactions.filter((t) => t.type === 'sell');

    // First investment date
    const firstInvestmentDate =
      buyTransactions.length > 0
        ? buyTransactions.reduce(
            (earliest, t) => (t.date < earliest ? t.date : earliest),
            buyTransactions[0].date,
          )
        : null;

    const investingDuration = firstInvestmentDate
      ? getInvestingDuration(firstInvestmentDate)
      : '';

    // Total capital deployed (cost of all buys)
    const totalBuyAmount = buyTransactions.reduce(
      (sum, t) => sum + (t.shares * t.price + (t.commission ?? 0)),
      0,
    );

    // Realized gain from sell transactions
    const totalRealizedGain = sellTransactions.reduce(
      (sum, t) => sum + (t.realizedGain ?? 0),
      0,
    );
    const totalRealizedCostBasis = sellTransactions.reduce(
      (sum, t) => sum + (t.costBasis ?? 0),
      0,
    );
    const totalRealizedGainPercent =
      totalRealizedCostBasis > 0
        ? (totalRealizedGain / totalRealizedCostBasis) * 100
        : 0;

    // Unrealized gain from current holdings
    let totalUnrealizedGain = 0;
    let totalUnrealizedCostBasis = 0;
    for (const holding of holdings) {
      const currentPrice = prices[holding.symbol]?.price ?? holding.avgCost;
      const value = holding.totalShares * currentPrice;
      const cost =
        holding.totalShares * holding.avgCost + (holding.totalCommissions ?? 0);
      totalUnrealizedGain += value - cost;
      totalUnrealizedCostBasis += cost;
    }

    // Money currently invested is the cost basis of all holdings
    const totalInvested = totalUnrealizedCostBasis;

    // Calculate all-time maximum invested capital (Peak Cost Basis)
    // This tracks the "Total Invested" as defined by the user: 
    // selling and buying back doesn't increase it, but reinvesting profits does.
    const sortedTransactions = [...transactions].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    );
    let runningCostBasis = 0;
    let totalCumulativeInvested = 0;
    for (const t of sortedTransactions) {
      if (t.type === 'buy') {
        runningCostBasis += (t.shares * t.price + (t.commission ?? 0));
      } else if (t.type === 'sell') {
        // We use the recorded cost basis from the sell transaction
        runningCostBasis -= (t.costBasis ?? 0);
      }
      if (runningCostBasis > totalCumulativeInvested) {
        totalCumulativeInvested = runningCostBasis;
      }
    }

    const totalUnrealizedGainPercent =
      totalUnrealizedCostBasis > 0
        ? (totalUnrealizedGain / totalUnrealizedCostBasis) * 100
        : 0;

    const totalReturn = totalRealizedGain + totalUnrealizedGain;

    // Win/loss from closed trades (break-even trades counted as losses so counts always sum to total)
    const winCount = sellTransactions.filter((t) => (t.realizedGain ?? 0) > 0).length;
    const lossCount = sellTransactions.filter((t) => (t.realizedGain ?? 0) <= 0).length;
    const winRate =
      sellTransactions.length > 0 ? (winCount / sellTransactions.length) * 100 : 0;

    // Per-ticker stats
    const tickerMap: Record<string, Omit<TickerStat, 'realizedGainPercent' | 'totalReturn' | 'totalReturnPercent' | 'isHeld'>> = {};

    for (const t of sellTransactions) {
      if (!tickerMap[t.symbol]) {
        tickerMap[t.symbol] = {
          symbol: t.symbol,
          realizedGain: 0,
          realizedCostBasis: 0,
          unrealizedGain: 0,
          unrealizedCostBasis: 0,
          sellCount: 0,
        };
      }
      tickerMap[t.symbol].realizedGain += t.realizedGain ?? 0;
      tickerMap[t.symbol].realizedCostBasis += t.costBasis ?? 0;
      tickerMap[t.symbol].sellCount++;
    }

    // Merge unrealized from current holdings
    const holdingSymbols = new Set(holdings.map((h) => h.symbol));
    for (const holding of holdings) {
      const currentPrice = prices[holding.symbol]?.price ?? holding.avgCost;
      const value = holding.totalShares * currentPrice;
      const cost =
        holding.totalShares * holding.avgCost + (holding.totalCommissions ?? 0);
      const unrealized = value - cost;

      if (!tickerMap[holding.symbol]) {
        tickerMap[holding.symbol] = {
          symbol: holding.symbol,
          name: holding.name,
          realizedGain: 0,
          realizedCostBasis: 0,
          unrealizedGain: unrealized,
          unrealizedCostBasis: cost,
          sellCount: 0,
        };
      } else {
        tickerMap[holding.symbol].unrealizedGain = unrealized;
        tickerMap[holding.symbol].unrealizedCostBasis = cost;
        if (holding.name) tickerMap[holding.symbol].name = holding.name;
      }
    }

    const tickerStats: TickerStat[] = Object.values(tickerMap)
      .map((t) => {
        const totalCostBasis = t.realizedCostBasis + t.unrealizedCostBasis;
        const totalReturn = t.realizedGain + t.unrealizedGain;
        const totalReturnPercent = totalCostBasis > 0 ? (totalReturn / totalCostBasis) * 100 : 0;
        return {
          ...t,
          isHeld: holdingSymbols.has(t.symbol),
          realizedGainPercent:
            t.realizedCostBasis > 0 ? (t.realizedGain / t.realizedCostBasis) * 100 : 0,
          totalReturn,
          totalReturnPercent,
        };
      })
      .sort((a, b) => b.totalReturn - a.totalReturn);

    // Current win/loss streak — walk sells newest-first, count consecutive same outcome
    const sortedSells = [...sellTransactions].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
    let currentStreak = 0;
    if (sortedSells.length > 0) {
      const firstIsWin = (sortedSells[0].realizedGain ?? 0) > 0;
      let count = 0;
      for (const sell of sortedSells) {
        const isWin = (sell.realizedGain ?? 0) > 0;
        if (isWin === firstIsWin) {
          count++;
        } else {
          break;
        }
      }
      currentStreak = firstIsWin ? count : -count;
    }

    // Last 5 closed trades (newest first)
    const recentClosedTrades: RecentClosedTrade[] = sortedSells.slice(0, 5).map((t) => ({
      symbol: t.symbol,
      date: t.date,
      realizedGain: t.realizedGain ?? 0,
      realizedGainPercent: t.realizedGainPercent ?? 0,
    }));

    // ── Activity stats ────────────────────────────────────────────────────

    // Average buy transaction value
    const avgBuyAmount =
      buyTransactions.length > 0 ? totalBuyAmount / buyTransactions.length : 0;

    // Total commissions across all transactions
    const totalCommissions = transactions.reduce(
      (sum, t) => sum + (t.commission ?? 0),
      0,
    );

    // Average days between consecutive investment DAYS (unique dates)
    const uniqueBuyDates = Array.from(new Set(buyTransactions.map((t) => t.date))).sort();
    let avgDaysBetweenBuys = 0;
    if (uniqueBuyDates.length >= 2) {
      let totalGapDays = 0;
      for (let i = 1; i < uniqueBuyDates.length; i++) {
        const [ay, am, ad] = uniqueBuyDates[i - 1].split('-').map(Number);
        const [by, bm, bd] = uniqueBuyDates[i].split('-').map(Number);
        const prev = new Date(ay, am - 1, ad).getTime();
        const curr = new Date(by, bm - 1, bd).getTime();
        totalGapDays += (curr - prev) / 86_400_000;
      }
      avgDaysBetweenBuys = totalGapDays / (uniqueBuyDates.length - 1);
    }
    const investingFrequency =
      uniqueBuyDates.length >= 2 ? formatFrequency(avgDaysBetweenBuys) : '—';

    // Most traded symbol (by non-split transaction count)
    const txCountBySymbol: Record<string, number> = {};
    for (const t of transactions) {
      if (t.type === 'split') continue;
      txCountBySymbol[t.symbol] = (txCountBySymbol[t.symbol] ?? 0) + 1;
    }
    const [mostTradedSymbol, mostTradedSymbolCount] =
      Object.entries(txCountBySymbol).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];

    // Most active month (by buy count)
    const buysByMonth: Record<string, number> = {};
    for (const t of buyTransactions) {
      const key = t.date.substring(0, 7);
      buysByMonth[key] = (buysByMonth[key] ?? 0) + 1;
    }
    const mostActiveEntry = Object.entries(buysByMonth).sort((a, b) => b[1] - a[1])[0];
    const mostActiveMonth = mostActiveEntry ? formatMonthYear(mostActiveEntry[0]) : null;
    const mostActiveMonthCount = mostActiveEntry?.[1] ?? 0;

    // Realized gains per sell date
    const gainsByDate: Record<string, number> = {};
    for (const t of sellTransactions) {
      gainsByDate[t.date] = (gainsByDate[t.date] ?? 0) + (t.realizedGain ?? 0);
    }
    const realizedGains: RealizedGain[] = Object.keys(gainsByDate)
      .sort()
      .map((key) => ({ label: formatDate(key), dateKey: key, gain: gainsByDate[key] }));

    // Last investment date
    const lastInvestmentDate =
      buyTransactions.length > 0
        ? buyTransactions.reduce(
            (latest, t) => (t.date > latest ? t.date : latest),
            buyTransactions[0].date,
          )
        : null;

    return {
      firstInvestmentDate,
      lastInvestmentDate,
      investingDuration,
      totalInvested,
      totalCumulativeInvested,
      totalRealizedGain,
      totalRealizedCostBasis,
      totalRealizedGainPercent,
      totalUnrealizedGain,
      totalUnrealizedCostBasis,
      totalUnrealizedGainPercent,
      totalReturn,
      winCount,
      lossCount,
      winRate,
      tickerStats,
      currentStreak,
      recentClosedTrades,
      totalTransactions: transactions.length,
      totalBuyTransactions: buyTransactions.length,
      totalSellTransactions: sellTransactions.length,
      avgBuyAmount,
      totalCommissions,
      avgDaysBetweenBuys,
      investingFrequency,
      mostTradedSymbol: mostTradedSymbol ?? null,
      mostTradedSymbolCount,
      mostActiveMonth,
      mostActiveMonthCount,
      realizedGains,
    };
  });
}
