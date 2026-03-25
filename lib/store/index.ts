/**
 * Legend-State Store
 *
 * Central store for the finance app with local persistence.
 * Designed to be sync-ready for future Supabase integration.
 */

import { observable } from '@legendapp/state';
import { configureObservablePersistence, persistObservable } from '@legendapp/state/persist';
import { ObservablePersistAsyncStorage } from '@legendapp/state/persist-plugins/async-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportWarning } from '../crashlytics';
import { SHARES_EPSILON } from '../utils/calculations';
import { getInitialState, migrateState } from './migrations';
import type {
  AssetType,
  Holding,
  HoldingLot,
  MarketPrice,
  RootStore,
  Transaction,
} from './types';

// ============================================================================
// Store Configuration
// ============================================================================

// Configure Legend-State to use AsyncStorage globally
configureObservablePersistence({
  pluginLocal: ObservablePersistAsyncStorage,
  localOptions: {
    asyncStorage: {
      AsyncStorage,
    },
  },
});

// ============================================================================
// Root Store
// ============================================================================

export const store$ = observable<RootStore>(getInitialState());

// ============================================================================
// Persistence Setup
// ============================================================================

let persistenceInitialized = false;

export const initializeStore = async (): Promise<void> => {
  if (persistenceInitialized) return;

  // Set up persistence with migration transform
  persistObservable(store$, {
    local: {
      name: 'finance-app-store',
      transform: {
        // 'in' transforms data coming from storage into the observable
        in: (value: RootStore) => migrateState(value),
        // 'out' transforms data going to storage (identity for now)
        out: (value: RootStore) => value,
      },
    },
    pluginLocal: ObservablePersistAsyncStorage,
  });

  persistenceInitialized = true;

  // Small delay to ensure persistence loads
  await new Promise((resolve) => setTimeout(resolve, 100));
};

// ============================================================================
// Selectors (computed values)
// ============================================================================

/**
 * Get all transactions sorted by date (newest first)
 */
export const selectTransactions = () => {
  return [...store$.portfolio.transactions.get()].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
    || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
};

/**
 * Get transactions for a specific symbol
 */
export const selectTransactionsBySymbol = (symbol: string) => {
  return store$.portfolio.transactions.get()
    .filter((t) => t.symbol === symbol)
    .sort((a, b) =>
      new Date(b.date).getTime() - new Date(a.date).getTime()
      || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
};

/**
 * Get holding for a specific symbol
 */
export const selectHolding = (symbol: string) => {
  return store$.portfolio.holdings[symbol].get();
};

/**
 * Get all holdings as array, filtering out positions closed to floating point residue
 */
export const selectAllHoldings = () => {
  const holdings = store$.portfolio.holdings.get();
  return Object.values(holdings || {}).filter(
    (h): h is NonNullable<typeof h> => !!h && h.totalShares > SHARES_EPSILON,
  );
};

/**
 * Get market price for a symbol
 */
export const selectMarketPrice = (symbol: string) => {
  return store$.market.prices[symbol].get();
};

// ============================================================================
// Actions
// ============================================================================

/**
 * Remove a holding key from the store by rebuilding the object without it.
 * Legend-State's .delete() leaves a null entry in the parent record, so we
 * avoid it and use .set() with the key omitted instead.
 */
const removeHoldingKey = (symbol: string) => {
  const all = store$.portfolio.holdings.get();
  const { [symbol]: _, ...rest } = all;
  store$.portfolio.holdings.set(rest as typeof all);
};

/**
 * Generate a unique ID
 */
const generateId = () => {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Add a new transaction and update holdings.
 * @param assetType - Optional asset type from API (e.g. 'etf', 'stock').
 *                    Used when creating a new holding for this symbol.
 * @param options.skipSellCheck - When true, skip the "cannot sell more than held"
 *                                guard. Used during bulk import where chronological
 *                                ordering may not match existing holdings.
 * @throws Error if selling more shares than currently held (unless skipSellCheck).
 */
export const addTransaction = (
  transaction: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'realizedGain' | 'realizedGainPercent' | 'costBasis'>,
  assetType: AssetType,
  assetName?: string,
  options?: { skipSellCheck?: boolean },
) => {
  const now = new Date().toISOString();
  const id = generateId();

  if (transaction.type === 'sell' && !options?.skipSellCheck) {
    const holding = store$.portfolio.holdings[transaction.symbol].get();
    const available = holding?.totalShares ?? 0;
    if (transaction.shares > available + SHARES_EPSILON) {
      throw new Error(
        `Cannot sell ${transaction.shares} shares of ${transaction.symbol}: only ${available} shares held.`,
      );
    }
  }

  let realizedGainInfo: RealizedGainInfo | null = null;

  if (transaction.type === 'buy') {
    const newTransaction: Transaction = {
      ...transaction,
      id,
      createdAt: now,
      updatedAt: now,
    };
    store$.portfolio.transactions.push(newTransaction);
    addToHolding(newTransaction, assetType, assetName);
    return newTransaction;
  } else {
    const tempTransaction: Transaction = {
      ...transaction,
      id,
      createdAt: now,
      updatedAt: now,
    };
    realizedGainInfo = removeFromHolding(tempTransaction);

    const newTransaction: Transaction = {
      ...transaction,
      id,
      createdAt: now,
      updatedAt: now,
      realizedGain: realizedGainInfo?.realizedGain,
      realizedGainPercent: realizedGainInfo?.realizedGainPercent,
      costBasis: realizedGainInfo?.costBasis,
    };
    store$.portfolio.transactions.push(newTransaction);
    return newTransaction;
  }
};

/**
 * Add shares to a holding (buy transaction)
 */
const addToHolding = (transaction: Transaction, assetType: AssetType, assetName?: string) => {
  const now = new Date().toISOString();
  const holding = store$.portfolio.holdings[transaction.symbol].get();

  const newLot: HoldingLot = {
    id: generateId(),
    transactionId: transaction.id,
    symbol: transaction.symbol,
    shares: transaction.shares,
    purchasePrice: transaction.price,
    purchaseDate: transaction.date,
    remainingShares: transaction.shares,
  };

  if (holding) {
    // Update existing holding
    const newTotalShares = holding.totalShares + transaction.shares;
    const newTotalCost =
      holding.avgCost * holding.totalShares +
      transaction.price * transaction.shares;
    const newAvgCost = newTotalCost / newTotalShares;
    const newTotalCommissions = (holding.totalCommissions ?? 0) + transaction.commission;

    store$.portfolio.holdings[transaction.symbol].set({
      ...holding,
      totalShares: newTotalShares,
      avgCost: newAvgCost,
      totalCommissions: newTotalCommissions,
      lots: [...holding.lots, newLot],
      updatedAt: now,
    });
  } else {
    // Create new holding with asset info lookup
    const newHolding: Holding = {
      id: generateId(),
      symbol: transaction.symbol,
      name: assetName ?? '',
      assetType: assetType,
      totalShares: transaction.shares,
      avgCost: transaction.price,
      totalCommissions: transaction.commission,
      lots: [newLot],
      createdAt: now,
      updatedAt: now,
    };

    store$.portfolio.holdings[transaction.symbol].set(newHolding);
  }
};

/**
 * Realized gain info returned from sell operations
 */
interface RealizedGainInfo {
  costBasis: number;
  realizedGain: number;
  realizedGainPercent: number;
}

/**
 * Remove shares from a holding (sell transaction) using FIFO
 * Returns the realized gain information for the sold shares
 */
const removeFromHolding = (transaction: Transaction): RealizedGainInfo | null => {
  const now = new Date().toISOString();
  const holding = store$.portfolio.holdings[transaction.symbol].get();

  if (!holding) {
    reportWarning(`Cannot sell: no holding found for ${transaction.symbol}`);
    return null;
  }

  if (transaction.shares > holding.totalShares + SHARES_EPSILON) {
    reportWarning(
      `Cannot sell ${transaction.shares} shares of ${transaction.symbol}: only ${holding.totalShares} held. Clamping to available.`,
    );
  }

  let sharesToSell = Math.min(transaction.shares, holding.totalShares);
  const updatedLots: HoldingLot[] = [];
  let costBasis = 0;

  // FIFO: sell from oldest lots first
  const sortedLots = [...holding.lots].sort(
    (a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime()
  );

  for (const lot of sortedLots) {
    if (sharesToSell <= 0) {
      updatedLots.push(lot);
      continue;
    }

    if (lot.remainingShares <= sharesToSell) {
      // Fully consume this lot
      costBasis += lot.remainingShares * lot.purchasePrice;
      sharesToSell -= lot.remainingShares;
      // Don't add to updatedLots (lot is fully sold)
    } else {
      // Partially consume this lot
      costBasis += sharesToSell * lot.purchasePrice;
      updatedLots.push({
        ...lot,
        remainingShares: lot.remainingShares - sharesToSell,
      });
      sharesToSell = 0;
    }
  }

  const newTotalShares = updatedLots.reduce((sum, lot) => sum + lot.remainingShares, 0);

  if (newTotalShares < SHARES_EPSILON) {
    removeHoldingKey(transaction.symbol);
  } else {
    // Recalculate average cost from remaining lots
    const totalCost = updatedLots.reduce(
      (sum, lot) => sum + lot.remainingShares * lot.purchasePrice,
      0
    );
    const newAvgCost = totalCost / newTotalShares;
    // Proportionally reduce commissions based on remaining shares
    const remainingRatio = newTotalShares / holding.totalShares;
    const newTotalCommissions = (holding.totalCommissions ?? 0) * remainingRatio;

    store$.portfolio.holdings[transaction.symbol].set({
      ...holding,
      totalShares: newTotalShares,
      avgCost: newAvgCost,
      totalCommissions: newTotalCommissions,
      lots: updatedLots,
      updatedAt: now,
    });
  }

  // Calculate realized gain
  const proceeds = transaction.shares * transaction.price;
  // Deduct the sell commission from realized gain so net profit is accurate
  const realizedGain = proceeds - costBasis - (transaction.commission ?? 0);
  const realizedGainPercent = costBasis > 0 ? (realizedGain / costBasis) * 100 : 0;

  return {
    costBasis,
    realizedGain,
    realizedGainPercent,
  };
};

/**
 * Update market prices
 */
export const updateMarketPrices = (prices: MarketPrice[]) => {
  const now = new Date().toISOString();

  for (const price of prices) {
    store$.market.prices[price.symbol].set(price);
  }

  store$.market.lastUpdated.set(now);
};

/**
 * Update user preferences
 */
export const updatePreferences = (
  preferences: Partial<RootStore['preferences']>
) => {
  const current = store$.preferences.get();
  store$.preferences.set({ ...current, ...preferences });
};

/**
 * Toggle show portfolio value preference
 */
export const toggleShowPortfolioValue = () => {
  const current = store$.preferences.showPortfolioValue.get();
  store$.preferences.showPortfolioValue.set(!current);
};

/**
 * Validate whether a transaction can be safely deleted by simulating a replay
 * of that symbol's history without it. Returns null if safe, or an error
 * message string describing the inconsistency.
 */
export const validateTransactionDeletion = (transactionId: string): string | null => {
  const transactions = store$.portfolio.transactions.get();
  const transaction = transactions.find((t) => t.id === transactionId);
  if (!transaction) return 'Transaction not found.';

  // Deleting a transaction can only affect the replay of that symbol's lots.
  // Replaying the entire portfolio here would incorrectly block deletions when
  // some other symbol already has inconsistent history.
  const remaining = transactions.filter(
    (t) => t.id !== transactionId && t.symbol === transaction.symbol,
  );

  const sorted = [...remaining].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.createdAt.localeCompare(b.createdAt);
  });

  const holding: {
    totalShares: number;
    lots: { remainingShares: number; purchasePrice: number; purchaseDate: string }[];
  } = {
    totalShares: 0,
    lots: [],
  };

  for (const t of sorted) {
    if (t.type === 'buy') {
      holding.lots.push({
        remainingShares: t.shares,
        purchasePrice: t.price,
        purchaseDate: t.date,
      });
      holding.totalShares += t.shares;
    } else if (t.type === 'sell') {
      const available = holding.totalShares;
      if (t.shares > available + SHARES_EPSILON) {
        const shortfall = t.shares - available;
        return (
          `Deleting this ${transaction.type} would make a later ${t.symbol} sell of ` +
          `${t.shares} shares on ${t.date} invalid (only ${Math.max(0, available).toFixed(6)} shares would be available, ` +
          `short by ${shortfall.toFixed(6)} shares). Delete that sell transaction first.`
        );
      }
      let toSell = t.shares;
      const sortedLots = [...holding.lots].sort(
        (a, b) => new Date(a.purchaseDate).getTime() - new Date(b.purchaseDate).getTime(),
      );
      const updatedLots: typeof holding.lots = [];
      for (const lot of sortedLots) {
        if (toSell <= 0) {
          updatedLots.push(lot);
          continue;
        }
        if (lot.remainingShares <= toSell) {
          toSell -= lot.remainingShares;
        } else {
          updatedLots.push({ ...lot, remainingShares: lot.remainingShares - toSell });
          toSell = 0;
        }
      }
      holding.lots = updatedLots;
      holding.totalShares = updatedLots.reduce((s, l) => s + l.remainingShares, 0);
    } else if (t.type === 'split') {
      const ratio = (t.splitTo ?? 1) / (t.splitFrom ?? 1);
      holding.lots = holding.lots.map((l) => ({
        ...l,
        remainingShares: l.remainingShares * ratio,
        purchasePrice: l.purchasePrice / ratio,
      }));
      holding.totalShares = holding.lots.reduce((s, l) => s + l.remainingShares, 0);
    }
  }

  return null;
};

/**
 * Delete a transaction and fully recalculate all holdings from the
 * remaining transactions. This avoids fragile incremental reversal and
 * guarantees lots and holdings are always consistent.
 *
 * @throws Error if removing this transaction would make a later sell invalid.
 */
export const deleteTransaction = (transactionId: string) => {
  const transactions = store$.portfolio.transactions.get();
  const transaction = transactions.find((t) => t.id === transactionId);

  if (!transaction) {
    reportWarning(`Transaction ${transactionId} not found`);
    return;
  }

  const validationError = validateTransactionDeletion(transactionId);
  if (validationError) {
    throw new Error(validationError);
  }

  const filteredTransactions = transactions.filter((t) => t.id !== transactionId);
  store$.portfolio.transactions.set(filteredTransactions);

  recalculatePortfolio();
};

/**
 * Reconstructs all holdings and recalculates realized gains for all transactions
 * based on chronological order. This fixes data inconsistencies caused by
 * out-of-order entry or imports.
 */
export const recalculatePortfolio = () => {
  const transactions = store$.portfolio.transactions.get();
  if (transactions.length === 0) return;

  // 1. Sort ALL transactions by date, then creation time for stability
  const sortedTransactions = [...transactions].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.createdAt.localeCompare(b.createdAt);
  });

  // 2. Clear current holdings
  const oldHoldings = store$.portfolio.holdings.get();
  store$.portfolio.holdings.set({});

  // Map to preserve asset types and names if possible
  const assetInfoMap = new Map<string, { type: AssetType; name: string }>();
  Object.values(oldHoldings).forEach((h) => {
    if (!h) return;
    assetInfoMap.set(h.symbol, { type: h.assetType, name: h.name });
  });

  // 3. Re-process every transaction
  const updatedTransactions: Transaction[] = [];

  for (const t of sortedTransactions) {
    if (t.type === 'buy') {
      const info = assetInfoMap.get(t.symbol);
      addToHolding(t, info?.type ?? 'CS', info?.name);
      updatedTransactions.push(t);
    } else if (t.type === 'sell') {
      const realizedGainInfo = removeFromHolding(t);
      updatedTransactions.push({
        ...t,
        realizedGain: realizedGainInfo?.realizedGain,
        realizedGainPercent: realizedGainInfo?.realizedGainPercent,
        costBasis: realizedGainInfo?.costBasis,
      });
    } else if (t.type === 'split') {
      // Apply split logic (simplified from applySplit)
      const symbol = t.symbol;
      const holding = store$.portfolio.holdings[symbol].get();
      if (holding) {
        const ratio = (t.splitTo ?? 1) / (t.splitFrom ?? 1);
        const inverseRatio = (t.splitFrom ?? 1) / (t.splitTo ?? 1);
        const adjustedLots = holding.lots.map((lot) => ({
          ...lot,
          shares: lot.shares * ratio,
          remainingShares: lot.remainingShares * ratio,
          purchasePrice: lot.purchasePrice * inverseRatio,
        }));
        const newTotalShares = adjustedLots.reduce((sum, lot) => sum + lot.remainingShares, 0);
        const totalCost = adjustedLots.reduce(
          (sum, lot) => sum + lot.remainingShares * lot.purchasePrice,
          0,
        );
        const newAvgCost = newTotalShares > 0 ? totalCost / newTotalShares : 0;
        store$.portfolio.holdings[symbol].set({
          ...holding,
          totalShares: newTotalShares,
          avgCost: newAvgCost,
          lots: adjustedLots,
          updatedAt: new Date().toISOString(),
        });
      }
      updatedTransactions.push(t);
    }
  }

  // 4. Update transactions in store
  store$.portfolio.transactions.set(updatedTransactions);
  console.debug(`[recalculatePortfolio] Processed ${updatedTransactions.length} transactions`);
};

/**
 * Apply a stock split to all lots of a symbol.
 * Creates a split transaction record and adjusts lot shares/prices.
 */
export const applySplit = (
  symbol: string,
  splitFrom: number,
  splitTo: number,
  date: string,
  splitApiId: string,
) => {
  // Guard: never apply the same split twice
  const alreadyApplied = store$.portfolio.transactions.get().some(
    (t) => t.type === 'split' && t.splitApiId === splitApiId,
  );
  if (alreadyApplied) {
    console.debug(`[applySplit] Split ${splitApiId} already applied for ${symbol}, skipping`);
    return;
  }

  const holding = store$.portfolio.holdings[symbol].get();
  if (!holding) {
    reportWarning(`Cannot apply split: no holding found for ${symbol}`);
    return;
  }
  if (splitFrom <= 0 || splitTo <= 0) {
    reportWarning(`Cannot apply split: invalid ratio ${splitFrom}:${splitTo} for ${symbol}`);
    return;
  }

  const now = new Date().toISOString();

  // Create split transaction record
  const splitTransaction: Transaction = {
    id: generateId(),
    symbol,
    type: 'split',
    shares: 0,
    price: 0,
    total: 0,
    date,
    commission: 0,
    createdAt: now,
    updatedAt: now,
    splitFrom,
    splitTo,
    splitApiId,
  };
  store$.portfolio.transactions.push(splitTransaction);
  // Rebuild holdings chronologically so only lots open on the split date are adjusted.
  recalculatePortfolio();

  console.debug(`[applySplit] Applied ${splitFrom}:${splitTo} split to ${symbol}`);
};

/**
 * Delete all transactions for a symbol and the holding itself (including all lots).
 * This is a hard wipe — no per-transaction reversal needed.
 */
export const deleteHolding = (symbol: string) => {
  const transactions = store$.portfolio.transactions.get();
  const filteredTransactions = transactions.filter((t) => t.symbol !== symbol);
  store$.portfolio.transactions.set(filteredTransactions);
  removeHoldingKey(symbol);
};

/**
 * Clear all data (for testing/reset)
 */
export const clearStore = () => {
  store$.set(getInitialState());
};

/**
 * Re-read portfolio data (holdings, transactions) from AsyncStorage and update the store.
 * Market prices are intentionally excluded since those come from the external API.
 */
export const reloadStoreFromStorage = async (): Promise<void> => {
  try {
    const raw = await AsyncStorage.getItem('finance-app-store');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const migrated = migrateState(parsed);
    store$.portfolio.set(migrated.portfolio);
    store$.preferences.set(migrated.preferences);
  } catch (e) {
    reportWarning('[reloadStoreFromStorage] Failed to reload from storage', e);
  }
};

// ============================================================================
// Export Types
// ============================================================================

export type { Holding, HoldingLot, MarketPrice, Transaction, TransactionType } from './types';
