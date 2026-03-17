/**
 * Store Utilities
 *
 * Utility functions for checking and clearing store data.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { APP_CACHE_KEY } from '../hooks/useRefreshPortfolioPrices';
import { store$ } from '../store';

/**
 * Check if store has portfolio data
 */
export function hasStoreData(): boolean {
  const holdings = store$.portfolio.holdings.get();
  return Object.keys(holdings || {}).length > 0;
}

/**
 * Check if market prices are loaded
 */
export function hasMarketPrices(): boolean {
  const prices = store$.market.prices.get();
  return Object.keys(prices || {}).length > 0;
}

/**
 * Clear all portfolio data (holdings and transactions)
 * Useful for resetting the app to a clean state
 */
export function clearPortfolio() {
  store$.portfolio.holdings.set({});
  store$.portfolio.transactions.set([]);
  console.debug('[Store] Portfolio cleared');
}

/**
 * Clear entire database including AsyncStorage
 * Use this for a complete fresh start
 */
export async function clearDatabase() {
  // Clear the observable store
  store$.portfolio.holdings.set({});
  store$.portfolio.transactions.set([]);
  store$.market.prices.set({});
  store$.market.lastUpdated.set(null);

  // Clear AsyncStorage to remove persisted data
  try {
    await AsyncStorage.multiRemove(['finance-app-store', APP_CACHE_KEY]);
    console.debug('[Store] Database cleared (including AsyncStorage)');
  } catch (error) {
    console.error('[Store] Failed to clear AsyncStorage:', error);
  }
}
