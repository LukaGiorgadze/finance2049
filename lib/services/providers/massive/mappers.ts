/**
 * Massive API Response Mappers
 *
 * Pure functions that convert Massive API response shapes
 * into our normalized provider-agnostic types.
 */

import type {
  StockQuote,
  TickerDetails,
  OHLCBar,
  TickerSearchResult,
  NewsArticle,
  IndexSnapshot,
  StockSplit,
} from '../../types';

// ============================================================================
// Massive API Response Shapes
// ============================================================================

export interface MassiveSnapshotTicker {
  ticker: string;
  todaysChange?: number;
  todaysChangePerc?: number;
  updated?: number; // nanoseconds since epoch
  day?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  min?: {
    av?: number;
    t?: number; // milliseconds since epoch
    n?: number;
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  prevDay?: {
    o?: number;
    h?: number;
    l?: number;
    c?: number;
    v?: number;
    vw?: number;
  };
  lastTrade?: {
    p?: number;  // price
    s?: number;  // size
    t?: number;  // timestamp (nanoseconds)
    x?: number;  // exchange ID
    c?: number[]; // conditions
    i?: string;  // trade ID
  };
  lastQuote?: {
    p?: number;  // bid price
    P?: number;  // ask price
    s?: number;  // bid size
    S?: number;  // ask size
    t?: number;  // timestamp (nanoseconds)
  };
  fmv?: number;  // fair market value (Business plans)
  name?: string;
}

export interface MassiveTickerDetails {
  ticker: string;
  name?: string;
  description?: string;
  market_cap?: number;
  homepage_url?: string;
  total_employees?: number;
  list_date?: string;
  type?: string;
  primary_exchange?: string;
  sic_description?: string;
  phone_number?: string;
  address?: {
    address1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
  };
  branding?: {
    logo_url?: string;
    icon_url?: string;
  };
}

export interface MassiveAggBar {
  o: number;  // open
  h: number;  // high
  l: number;  // low
  c: number;  // close
  v: number;  // volume
  t: number;  // timestamp (unix ms)
  vw?: number; // volume weighted average price
  n?: number;  // number of trades
}

export interface MassiveSearchTicker {
  ticker: string;
  name?: string;
  market?: string;
  type?: string;
  active?: boolean;
}

export interface MassiveNewsArticle {
  id: string;
  title: string;
  author?: string;
  description?: string;
  article_url: string;
  amp_url?: string;
  image_url?: string;
  published_utc: string;
  publisher?: {
    name: string;
  };
  tickers?: string[];
  insights?: Array<{
    sentiment?: string;
    ticker?: string;
  }>;
}

export interface MassiveSplitResult {
  id: string;
  ticker: string;
  execution_date: string;
  split_from: number;
  split_to: number;
  type?: string; // 'forward_split' | 'reverse_split' | 'stock_dividend'
}

export interface MassivePrevDayResult {
  T: string;   // ticker
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  t?: number;
}

// ============================================================================
// Mapper Functions
// ============================================================================

export function mapSnapshotToQuote(snapshot: MassiveSnapshotTicker): StockQuote {
  // `updated` is in nanoseconds; `min.t` is in milliseconds
  let updatedAt: string;
  if (snapshot.min?.t) {
    updatedAt = new Date(snapshot.min.t).toISOString();
  } else if (snapshot.updated) {
    updatedAt = new Date(Math.floor(snapshot.updated / 1e6)).toISOString();
  } else {
    updatedAt = new Date().toISOString();
  }

  // Extract last trade data
  const lastTradePrice = snapshot.lastTrade?.p;
  const lastTradeSize = snapshot.lastTrade?.s;
  const lastTradeTime = snapshot.lastTrade?.t
    ? new Date(Math.floor(snapshot.lastTrade.t / 1e6)).toISOString()
    : undefined;

  // Extract last quote data (bid/ask)
  const bidPrice = snapshot.lastQuote?.p;
  const bidSize = snapshot.lastQuote?.s;
  const askPrice = snapshot.lastQuote?.P;
  const askSize = snapshot.lastQuote?.S;

  // On a trading day, day.c holds today's close; on non-trading days (weekends/
  // holidays) the day fields are 0/empty so we fall back to the previous day's close.
  const price = snapshot.day?.c || snapshot.prevDay?.c || 0;
  const prevClose = snapshot.prevDay?.c;

  // Calculate change from price vs previous day's close (matches Google/Yahoo).
  const change = prevClose ? price - prevClose : (snapshot.todaysChange ?? 0);
  const changePercent = prevClose ? ((price - prevClose) / prevClose) * 100 : (snapshot.todaysChangePerc ?? 0);

  return {
    symbol: snapshot.ticker,
    price,
    open: snapshot.day?.o,
    change,
    changePercent,
    volume: snapshot.day?.v,
    prevClose,
    dayHigh: snapshot.day?.h,
    dayLow: snapshot.day?.l,
    name: snapshot.name,
    updatedAt,
    // Real-time data from snapshot
    lastTradePrice,
    lastTradeSize,
    lastTradeTime,
    bidPrice,
    bidSize,
    askPrice,
    askSize,
    fmv: snapshot.fmv,
  };
}

export function mapTickerDetailsToDetails(raw: MassiveTickerDetails): TickerDetails {
  const headquarters =
    raw.address?.city && raw.address?.state
      ? `${raw.address.city}, ${raw.address.state}`
      : undefined;

  return {
    symbol: raw.ticker,
    name: raw.name ?? raw.ticker,
    description: raw.description ?? '',
    marketCap: raw.market_cap,
    homepage: raw.homepage_url,
    employees: raw.total_employees,
    exchange: raw.primary_exchange,
    type: raw.type,
    listDate: raw.list_date,
    headquarters,
    industry: raw.sic_description,
    phoneNumber: raw.phone_number,
    logoUrl: raw.branding?.logo_url,
    iconUrl: raw.branding?.icon_url,
  };
}

export function mapAggBarToOHLC(bar: MassiveAggBar): OHLCBar {
  return {
    timestamp: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    vw: bar.vw,
  };
}

export function mapSearchResult(raw: MassiveSearchTicker): TickerSearchResult {
  return {
    symbol: raw.ticker,
    name: raw.name ?? raw.ticker,
    market: raw.market,
    type: raw.type,
    active: raw.active,
  };
}

export function mapNewsArticle(raw: MassiveNewsArticle): NewsArticle {
  // Derive overall sentiment from insights if available
  let sentiment: NewsArticle['sentiment'];
  if (raw.insights && raw.insights.length > 0) {
    const first = raw.insights[0].sentiment?.toLowerCase();
    if (first === 'positive' || first === 'negative' || first === 'neutral') {
      sentiment = first;
    }
  }

  return {
    id: raw.id,
    title: raw.title,
    author: raw.author,
    description: raw.description,
    url: raw.article_url,
    ampUrl: raw.amp_url,
    imageUrl: raw.image_url,
    publishedAt: raw.published_utc,
    source: raw.publisher?.name ?? 'Unknown',
    tickers: raw.tickers,
    sentiment,
  };
}

const INDEX_NAMES: Record<string, string> = {
  'I:DJI': 'Dow Jones',
  'I:SPX': 'S&P 500',
  'I:COMP': 'Nasdaq',
  'I:RUT': 'Russell 2000',
};

export function mapPrevDayToIndex(raw: MassivePrevDayResult): IndexSnapshot {
  return {
    symbol: raw.T,
    name: INDEX_NAMES[raw.T] ?? raw.T,
    value: raw.c,
    change: raw.c - raw.o,
    changePercent: raw.o !== 0 ? ((raw.c - raw.o) / raw.o) * 100 : 0,
  };
}

export function mapSplitResult(raw: MassiveSplitResult): StockSplit {
  return {
    id: raw.id,
    ticker: raw.ticker,
    executionDate: raw.execution_date,
    splitFrom: raw.split_from,
    splitTo: raw.split_to,
    adjustmentType: raw.type ?? 'forward_split',
  };
}
