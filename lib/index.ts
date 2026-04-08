/**
 * Lib barrel export
 *
 * Central export point for Legend-State store, hooks, and utilities.
 */

// Store
export {
  addTransaction, applySplit, clearStore, deleteHolding, deleteTransaction, initializeStore, recalculatePortfolio, reloadStoreFromStorage,
  selectAllHoldings,
  selectHolding, selectMarketPrice, selectTransactions,
  selectTransactionsBySymbol, store$, toggleShowPortfolioValue, updateMarketPrices,
  updatePreferences, validateTransactionDeletion
} from './store';

export type {
  Holding,
  HoldingLot,
  MarketPrice, Transaction
} from './store';

export { StoreProvider, useStoreReady } from './store/StoreProvider';

// Hooks
export {
  formatChartLabel, formatEmployeeCount, formatMarketCap, setGainView, useAssetAllocation, useDefaultTimeline,
  useGainView, useHolding,
  // Store hooks (raw data)
  useHoldings, useHoldingsCount, useMarketLastUpdated, useMarketPrice,
  useMarketPrices, usePortfolioCostBasis,
  usePortfolioGain,
  // UI-ready hooks (transformed data)
  usePortfolioSummary, usePortfolioValue,
  // Portfolio price refresh
  useRefreshPortfolioPrices, useShowPortfolioValue,
  // Market data hooks
  useTickerData, useTransactions,
  useTransactionsBySymbol,
  useTransactionsCount, useUIHolding, useUIHoldings, useUITransactions,
  useUITransactionsBySymbol,
  // Analytics
  useInvestmentAnalytics,
} from './hooks';

// UI Types
export type {
  PortfolioSummary, UIHolding,
  UIHoldingLot,
  UITransaction
} from './hooks/usePortfolio';

// Utils
export {
  buildAuthenticatedUrl, calculateAssetAllocation, calculateDayChange, calculateHoldingGain, calculateHoldingValue, calculatePortfolioTotals, clearDatabase, clearPortfolio, formatCurrency, formatDate, formatLocalDateISO, formatPercent, formatShares, getApiTypeLabel,
  getTickerTypeInfo, getValueColor, hasMarketPrices, hasStoreData, mapApiTypeToAssetType, MASKED
} from './utils';

// Auth
export { ensureSession, getAccessToken, getSupabase, hasSupabaseConfig, waitForInitialAuth } from './supabase';

// Services
export { marketDataService } from './services/marketDataService';
export { maybePromptForAppReview } from './app-review';

export type {
  HistoricalBarsParams, IndexSnapshot, MarketDataProvider, NewsArticle,
  NewsParams, NewsResponse, OHLCBar, StockQuote,
  StockSplit,
  TickerDetails, TickerSearchResponse, TickerSearchResult
} from './services/types';

// Firebase analytics
export {
  trackHomeAction,
  trackHomeScreen,
  trackImportAction,
  trackImportScreen,
  trackNewsAction,
  trackNewsScreen,
  trackPortfolioAction,
  trackPortfolioScreen,
  trackPositionDetailAction,
  trackSearchAction,
  trackSettingsAction,
  trackSettingsScreen,
  trackStockAction,
  trackStockScreen,
  trackStorageAction,
  trackStorageScreen,
  trackStatisticsAction,
  trackStatisticsScreen,
  trackTopMoversAction,
  trackTopMoversScreen,
  trackTransactionsAction,
  trackTransactionsScreen,
  trackOnboardingCompleted,
  trackOnboardingDiscoverySelected,
  trackOnboardingExited,
  trackOnboardingImportDecision,
  trackOnboardingNavigation,
  trackOnboardingReviewPrompt,
  trackOnboardingScreen,
  trackOnboardingStarted,
  trackOnboardingStepViewed,
  trackOnboardingThemeSelected,
} from './analytics';

export {
  ONBOARDING_SOURCES,
  ONBOARDING_STEPS,
} from '@/constants/onboarding';

export type {
  OnboardingDiscoverySource,
  OnboardingStep,
  OnboardingThemeMode,
} from '@/constants/onboarding';
