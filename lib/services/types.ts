/**
 * Market Data Provider Interface & Normalized Types
 *
 * Provider-agnostic types that any market data provider must implement.
 * Methods are organized by what the UI needs, not by API structure.
 */

import type { TimelineType } from '../store/types';

// ============================================================================
// Normalized Response Types
// ============================================================================

export interface StockQuote {
  symbol: string;
  price: number;
  open?: number;
  change: number;
  changePercent: number;
  volume?: number;
  prevClose?: number;
  dayHigh?: number;
  dayLow?: number;
  name?: string;
  exchange?: string;
  updatedAt: string;
  // Real-time trade data
  lastTradePrice?: number;
  lastTradeSize?: number;
  lastTradeTime?: string;
  // Real-time quote data
  bidPrice?: number;
  bidSize?: number;
  askPrice?: number;
  askSize?: number;
  // Fair market value (Business plans)
  fmv?: number;
}

export interface TickerDetails {
  symbol: string;
  name: string;
  description: string;
  marketCap?: number;
  peRatio?: number;
  dividendYield?: number;
  employees?: number;
  ceo?: string;
  homepage?: string;
  exchange?: string;
  type?: string;
  listDate?: string;
  headquarters?: string;
  industry?: string;
  phoneNumber?: string;
  logoUrl?: string;
  iconUrl?: string;
}

export interface OHLCBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vw?: number; // volume-weighted average price
}

export interface TickerSearchResult {
  symbol: string;
  name: string;
  market?: string;
  type?: string;
  active?: boolean;
}

export interface TickerSearchResponse {
  results: TickerSearchResult[];
  nextUrl?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  author?: string;
  description?: string;
  url: string;
  ampUrl?: string;
  imageUrl?: string;
  publishedAt: string;
  source: string;
  tickers?: string[];
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface IndexSnapshot {
  symbol: string;
  name: string;
  value: number;
  change: number;
  changePercent: number;
}

export interface StockSplit {
  id: string;
  ticker: string;
  executionDate: string;
  splitFrom: number;
  splitTo: number;
  adjustmentType: string; // 'forward_split' | 'reverse_split' | 'stock_dividend'
}

export interface MarketStatus {
  market: string;
  afterHours: boolean;
  earlyHours: boolean;
  exchanges: {
    nasdaq: string;
    nyse: string;
    otc: string;
  };
  currencies: {
    crypto: string;
    fx: string;
  };
  serverTime: string;
}

export interface MarketHoliday {
  date: string;
  exchange: string;
  name: string;
  status: string;
  open?: string;
  close?: string;
}

// ============================================================================
// Request Parameter Types
// ============================================================================

export interface HistoricalBarsParams {
  symbol: string;
  timelineType: TimelineType;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface NewsParams {
  tickers?: string[];
  limit?: number;
  cursor?: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  nextUrl?: string;
}

// ============================================================================
// Provider Interface
// ============================================================================

export interface MarketDataProvider {
  readonly name: string;

  /** Get a single stock quote */
  getQuote(symbol: string): Promise<StockQuote>;

  /** Get multiple stock quotes */
  getQuotes(symbols: string[]): Promise<StockQuote[]>;

  /** Get detailed company/ticker information */
  getTickerDetails(symbol: string): Promise<TickerDetails>;

  /** Get historical OHLC bars for charting */
  getHistoricalBars(params: HistoricalBarsParams): Promise<OHLCBar[]>;

  /** Get top market movers (gainers or losers) */
  getTopMovers(direction: 'gainers' | 'losers'): Promise<StockQuote[]>;

  /** Search for tickers by query string. Pass `nextUrl` to load the next page. */
  searchTickers(query: string, nextUrl?: string): Promise<TickerSearchResponse>;

  /** Get market news. Returns articles and an optional cursor for pagination. */
  getNews(params?: NewsParams): Promise<NewsResponse>;

  /** Get snapshot of major market indices */
  getIndicesSnapshot(): Promise<IndexSnapshot[]>;

  /** Get current market status (open/closed) */
  getMarketStatus(): Promise<MarketStatus>;

  /** Get upcoming market holidays */
  getMarketHolidays(): Promise<MarketHoliday[]>;

  /** Get historical stock splits for a symbol */
  getStockSplits(symbol: string): Promise<StockSplit[]>;
}
