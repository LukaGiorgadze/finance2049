import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { marketDataService } from '../services/marketDataService';
import type { StockQuote, StockSplit } from '../services/types';
import { applySplit, selectAllHoldings, store$, updateMarketPrices } from '../store';
import { useStoreReady } from '../store/StoreProvider';
import type { Holding, HoldingLot, MarketPrice } from '../store/types';
import { getAccessToken } from '../supabase';

function quoteToMarketPrice(quote: StockQuote): MarketPrice {
  return {
    symbol: quote.symbol,
    price: quote.price,
    change: quote.change,
    changePercent: quote.changePercent,
    volume: quote.volume != null ? String(quote.volume) : undefined,
    updatedAt: quote.updatedAt,
  };
}

// Persisted app cache — survives module re-evaluation / fast refresh
export const APP_CACHE_KEY = 'finance-app-cache';

export interface AppCache {
  lastSplitCheck?: number;
}

async function getAppCache(): Promise<AppCache> {
  try {
    const raw = await AsyncStorage.getItem(APP_CACHE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

async function setAppCache(cache: AppCache): Promise<void> {
  await AsyncStorage.setItem(APP_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
}

const SPLIT_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const SPLIT_PRICE_MATCH_THRESHOLD = 0.35;
const SPLIT_MATCH_SAMPLE_SIZE = 2;
let splitCheckInFlight: Promise<void> | null = null;
let refreshInFlight: Promise<void> | null = null;

function relativeDiff(actual: number, expected: number): number {
  if (!Number.isFinite(actual) || !Number.isFinite(expected) || expected <= 0) return Number.POSITIVE_INFINITY;
  return Math.abs(actual - expected) / expected;
}

function getSplitsAffectingLot(lot: HoldingLot, splits: StockSplit[]): StockSplit[] {
  return splits.filter((split) => split.executionDate > lot.purchaseDate);
}

async function getAdjustedReferencePrice(symbol: string, date: string): Promise<number | null> {
  const bars = await marketDataService.getHistoricalBars({
    symbol,
    timelineType: '1D',
    from: date,
    to: date,
  });
  const bar = bars[bars.length - 1];
  const price = bar ? (bar.vw ?? bar.close) : undefined;
  return typeof price === 'number' && Number.isFinite(price) && price > 0 ? price : null;
}

async function holdingAlreadyLooksSplitAdjusted(
  holding: Holding,
  splits: StockSplit[],
): Promise<boolean> {
  const candidateLots = holding.lots
    .filter((lot) => lot.remainingShares > 0 && getSplitsAffectingLot(lot, splits).length > 0)
    .sort((a, b) => a.purchaseDate.localeCompare(b.purchaseDate))
    .slice(0, SPLIT_MATCH_SAMPLE_SIZE);

  if (candidateLots.length === 0) return false;

  const comparisons = await Promise.all(
    candidateLots.map(async (lot) => {
      const adjustedReferencePrice = await getAdjustedReferencePrice(holding.symbol, lot.purchaseDate)
        .catch(() => null);
      if (!adjustedReferencePrice || lot.purchasePrice <= 0) return null;

      const cumulativeRatio = getSplitsAffectingLot(lot, splits).reduce(
        (product, split) => product * (split.splitTo / split.splitFrom),
        1,
      );
      const rawReferencePrice = adjustedReferencePrice * cumulativeRatio;

      return {
        adjustedDiff: relativeDiff(lot.purchasePrice, adjustedReferencePrice),
        rawDiff: relativeDiff(lot.purchasePrice, rawReferencePrice),
      };
    }),
  );

  const decisiveComparisons = comparisons
    .filter((entry): entry is NonNullable<typeof entry> => !!entry)
    .filter(({ adjustedDiff, rawDiff }) =>
      Math.min(adjustedDiff, rawDiff) <= SPLIT_PRICE_MATCH_THRESHOLD,
    );

  if (decisiveComparisons.length === 0) return false;

  const adjustedWins = decisiveComparisons.filter(
    ({ adjustedDiff, rawDiff }) => adjustedDiff < rawDiff,
  ).length;

  return adjustedWins >= Math.ceil(decisiveComparisons.length / 2);
}

async function checkAndApplySplits(): Promise<void> {
  const cache = await getAppCache();
  if (cache.lastSplitCheck && Date.now() - cache.lastSplitCheck < SPLIT_CHECK_INTERVAL_MS) return;

  // Mark as checked before doing work so concurrent calls also bail out
  await setAppCache({ ...cache, lastSplitCheck: Date.now() });

  const holdings = selectAllHoldings();
  for (const holding of holdings) {
    try {
      const splits = await marketDataService.getStockSplits(holding.symbol);
      if (splits.length === 0) continue;

      const transactions = store$.portfolio.transactions.get();

      // Get existing split transaction API IDs for this symbol
      const existingSplitIds = new Set(
        transactions
          .filter((t) => t.symbol === holding.symbol && t.type === 'split' && t.splitApiId)
          .map((t) => t.splitApiId!),
      );

      // Only apply splits that affect at least one currently-open lot.
      const unappliedSplits = splits.filter(
        (split) =>
          !existingSplitIds.has(split.id) &&
          holding.lots.some(
            (lot) => lot.remainingShares > 0 && lot.purchaseDate < split.executionDate,
          ),
      );
      if (unappliedSplits.length === 0) continue;

      const alreadyAdjusted = await holdingAlreadyLooksSplitAdjusted(holding, unappliedSplits);
      if (alreadyAdjusted) {
        console.debug(
          `[splits] Skipping auto-apply for ${holding.symbol}; holding prices already look split-adjusted`,
        );
        continue;
      }

      // Apply splits in chronological order
      const sorted = [...unappliedSplits].sort(
        (a, b) => a.executionDate.localeCompare(b.executionDate),
      );

      for (const split of sorted) {
        console.debug(
          `[splits] Auto-applying ${split.splitFrom}:${split.splitTo} split for ${holding.symbol} (${split.executionDate})`,
        );
        applySplit(holding.symbol, split.splitFrom, split.splitTo, split.executionDate, split.id);
      }
    } catch (err) {
      console.warn(`[splits] Failed to check splits for ${holding.symbol}:`, err);
    }
  }
}

export function useRefreshPortfolioPrices() {
  const isReady = useStoreReady();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    // Skip if no auth session exists yet (e.g. during onboarding before ensureSession)
    const token = await getAccessToken();
    if (!token) return;

    // Deduplicate concurrent refreshes (React strict mode, double-mount, etc.)
    if (refreshInFlight) {
      await refreshInFlight;
      return;
    }

    const holdings = selectAllHoldings();
    const symbols = holdings.map((h) => h.symbol);

    if (symbols.length === 0) return;

    setIsLoading(true);
    setError(null);

    const doRefresh = async () => {
      try {
        const quotes = await marketDataService.getQuotes(symbols);
        const prices = quotes.map(quoteToMarketPrice);
        updateMarketPrices(prices);

        // Deduplicate concurrent split checks — if one is already running, reuse it
        if (!splitCheckInFlight) {
          splitCheckInFlight = checkAndApplySplits().finally(() => {
            splitCheckInFlight = null;
          });
        }
        await splitCheckInFlight;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to fetch prices';
        setError(message);
        console.warn('[useRefreshPortfolioPrices]', message);
      } finally {
        setIsLoading(false);
      }
    };

    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
    await refreshInFlight;
  }, []);

  useEffect(() => {
    if (isReady) {
      refresh();
    }
  }, [isReady, refresh]);

  return { isLoading, error, refresh };
}
