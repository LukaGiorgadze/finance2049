/**
 * Legend-State Store Types
 *
 * These types define the shape of our local-first database.
 * Designed to be sync-ready for future Supabase integration.
 */

// ============================================================================
// Core Types
// ============================================================================

export type TransactionType = 'buy' | 'sell' | 'split';
export type AssetType = string;
export type TimelineType = '1D' | '5D' | '1M' | '6M' | 'YTD' | '1Y' | '5Y';

// ============================================================================
// Transaction - The source of truth for all portfolio data
// ============================================================================

export interface Transaction {
  id: string;
  symbol: string;
  type: TransactionType;
  shares: number;
  price: number;
  total: number;
  date: string; // ISO date string
  commission: number;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  // Realized gain fields (only for sell transactions)
  realizedGain?: number; // Absolute gain/loss amount
  realizedGainPercent?: number; // Percentage gain/loss
  costBasis?: number; // Total cost basis of shares sold
  // Split fields (only for split transactions)
  splitFrom?: number;
  splitTo?: number;
  splitApiId?: string; // API split ID to prevent re-applying
}

// ============================================================================
// Holding - Computed from transactions, but can be persisted for performance
// ============================================================================

export interface HoldingLot {
  id: string;
  transactionId: string; // Links to the buy transaction
  symbol: string;
  shares: number;
  purchasePrice: number;
  purchaseDate: string;
  remainingShares: number; // Shares not yet sold (for FIFO tracking)
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  totalShares: number;
  avgCost: number;
  totalCommissions: number;
  lots: HoldingLot[];
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Asset - Static asset information (stocks, ETFs & more)
// ============================================================================

export interface Asset {
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
}

// ============================================================================
// Market Data - Cached market prices (not user data)
// ============================================================================

export interface MarketPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume?: string;
  updatedAt: string;
}

export interface MarketIndex {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
  chartData: Record<TimelineType, number[]>;
}

// ============================================================================
// User Preferences
// ============================================================================

export type GainViewType = 'today' | 'total';

export interface UserPreferences {
  defaultCurrency: string;
  showPortfolioValue: boolean;
  defaultTimeline: TimelineType;
  gainView: GainViewType;
}

// ============================================================================
// Store State Shape
// ============================================================================

export interface PortfolioState {
  holdings: Record<string, Holding>; // Keyed by symbol for fast lookup
  transactions: Transaction[];
}

export interface MarketState {
  prices: Record<string, MarketPrice>; // Keyed by symbol
  indices: MarketIndex[];
  lastUpdated: string | null;
}

export interface PreferencesState extends UserPreferences {}

// ============================================================================
// Auth State
// ============================================================================

export interface AuthState {
  userId: string | null;
  isAnonymous: boolean;
}

// ============================================================================
// Root Store Shape
// ============================================================================

export interface RootStore {
  portfolio: PortfolioState;
  market: MarketState;
  preferences: PreferencesState;
  auth: AuthState;
  _schema: {
    version: number;
  };
}

// ============================================================================
// Schema Version
// ============================================================================

export const CURRENT_SCHEMA_VERSION = 2;
