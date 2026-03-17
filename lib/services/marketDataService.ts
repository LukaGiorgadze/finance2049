/**
 * Market Data Service
 *
 * Singleton that holds the active provider and delegates all calls.
 * Import `marketDataService` from '@/lib' to use.
 */

import type {
  MarketDataProvider,
  StockQuote,
  StockSplit,
  TickerDetails,
  OHLCBar,
  HistoricalBarsParams,
  TickerSearchResponse,
  NewsParams,
  NewsResponse,
  IndexSnapshot,
  MarketStatus,
  MarketHoliday,
} from './types';
import type { ProviderName } from './config';
import { DEFAULT_PROVIDER } from './config';
import { createProvider } from './providers';

class MarketDataService {
  private provider: MarketDataProvider;
  private inflight = new Map<string, Promise<unknown>>();

  constructor() {
    this.provider = createProvider(DEFAULT_PROVIDER);
  }

  /** Deduplicates concurrent identical requests. */
  private dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;

    const promise = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  get providerName(): string {
    return this.provider.name;
  }

  setProvider(name: ProviderName): void {
    this.provider = createProvider(name);
  }

  getQuote(symbol: string): Promise<StockQuote> {
    return this.dedupe(`quote:${symbol}`, () => this.provider.getQuote(symbol));
  }

  getQuotes(symbols: string[]): Promise<StockQuote[]> {
    const key = `quotes:${symbols.sort().join(',')}`;
    return this.dedupe(key, () => this.provider.getQuotes(symbols));
  }

  getTickerDetails(symbol: string): Promise<TickerDetails> {
    return this.dedupe(`details:${symbol}`, () => this.provider.getTickerDetails(symbol));
  }

  getHistoricalBars(params: HistoricalBarsParams): Promise<OHLCBar[]> {
    const key = `bars:${params.symbol}:${params.timelineType}:${params.from ?? ''}:${params.to ?? ''}`;
    return this.dedupe(key, () => this.provider.getHistoricalBars(params));
  }

  getTopMovers(direction: 'gainers' | 'losers'): Promise<StockQuote[]> {
    return this.dedupe(`movers:${direction}`, () => this.provider.getTopMovers(direction));
  }

  searchTickers(query: string, nextUrl?: string): Promise<TickerSearchResponse> {
    return this.provider.searchTickers(query, nextUrl);
  }

  getNews(params?: NewsParams): Promise<NewsResponse> {
    const key = `news:${params?.limit ?? ''}:${params?.tickers?.join(',') ?? ''}:${params?.cursor ?? ''}`;
    return this.dedupe(key, () => this.provider.getNews(params));
  }

  getIndicesSnapshot(): Promise<IndexSnapshot[]> {
    return this.dedupe('indices', () => this.provider.getIndicesSnapshot());
  }

  getMarketStatus(): Promise<MarketStatus> {
    return this.dedupe('marketStatus', () => this.provider.getMarketStatus());
  }

  getMarketHolidays(): Promise<MarketHoliday[]> {
    return this.dedupe('marketHolidays', () => this.provider.getMarketHolidays());
  }

  getStockSplits(symbol: string): Promise<StockSplit[]> {
    return this.dedupe(`splits:${symbol}`, () => this.provider.getStockSplits(symbol));
  }
}

export const marketDataService = new MarketDataService();
