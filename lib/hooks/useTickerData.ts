import { useEffect, useRef, useState } from 'react';

import { reportWarning } from '../crashlytics';
import { MassiveApiError } from '../services/providers/massive/client';
import { marketDataService } from '../services/marketDataService';
import type { OHLCBar, StockQuote, TickerDetails } from '../services/types';
import type { TimelineType } from '../store/types';

export interface TickerData {
  details: TickerDetails | null;
  quote: StockQuote | null;
  bars: OHLCBar[];
  loading: boolean;
  error: string | null;
}

// ============================================================================
// Mock data fallbacks (used when API plan doesn't cover the endpoint)
// ============================================================================

function generateMockQuote(symbol: string): StockQuote {
  const seed = symbol.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  const basePrice = 50 + (seed % 900);
  const change = parseFloat(((Math.random() - 0.4) * basePrice * 0.04).toFixed(2));
  const price = parseFloat((basePrice + change).toFixed(2));

  return {
    symbol,
    price,
    change,
    changePercent: parseFloat(((change / basePrice) * 100).toFixed(2)),
    volume: Math.floor(10_000_000 + Math.random() * 90_000_000),
    prevClose: basePrice,
    dayHigh: parseFloat((price + Math.random() * 5).toFixed(2)),
    dayLow: parseFloat((price - Math.random() * 5).toFixed(2)),
    updatedAt: new Date().toISOString(),
  };
}

function generateMockDetails(symbol: string): TickerDetails {
  return {
    symbol,
    name: symbol,
    description: `${symbol} is a publicly traded company listed on a major US exchange.`,
    marketCap: Math.floor(50_000_000_000 + Math.random() * 2_000_000_000_000),
    employees: Math.floor(5000 + Math.random() * 200_000),
    exchange: 'XNAS',
    type: 'CS',
    listDate: '2000-01-01',
    headquarters: 'United States',
    industry: 'Technology',
  };
}

function generateMockBars(timeline: TimelineType, basePrice: number): OHLCBar[] {
  const now = Date.now();
  let count: number;
  let intervalMs: number;

  switch (timeline) {
    case '1D':
      count = 78;
      intervalMs = 5 * 60 * 1000;
      break;
    case '5D':
      count = 65;
      intervalMs = 30 * 60 * 1000;
      break;
    case '1M':
      count = 22;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case '6M':
      count = 126;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case 'YTD':
      count = 30;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case '1Y':
      count = 252;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case '5Y':
      count = 260;
      intervalMs = 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      count = 30;
      intervalMs = 24 * 60 * 60 * 1000;
  }

  const bars: OHLCBar[] = [];
  let price = basePrice * (0.7 + Math.random() * 0.3);

  for (let i = 0; i < count; i++) {
    const volatility = price * 0.02;
    const open = price;
    const change = (Math.random() - 0.48) * volatility;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;

    bars.push({
      timestamp: now - (count - i) * intervalMs,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(1_000_000 + Math.random() * 50_000_000),
    });

    price = close;
  }

  return bars;
}

// ============================================================================
// Helpers
// ============================================================================

function quoteFromBars(symbol: string, bars: OHLCBar[]): StockQuote {
  const last = bars[bars.length - 1];
  const prev = bars.length >= 2 ? bars[bars.length - 2] : last;
  const change = parseFloat((last.close - prev.close).toFixed(2));
  return {
    symbol,
    price: last.close,
    change,
    changePercent: parseFloat(((change / prev.close) * 100).toFixed(2)),
    volume: last.volume,
    prevClose: prev.close,
    dayHigh: last.high,
    dayLow: last.low,
    updatedAt: new Date(last.timestamp).toISOString(),
  };
}

// ============================================================================
// Hook
// ============================================================================

export function useTickerData(symbol: string, timeline: TimelineType, refreshKey = 0): TickerData {
  const [details, setDetails] = useState<TickerDetails | null>(null);
  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [bars, setBars] = useState<OHLCBar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache details + quote so we don't re-fetch them on timeline changes
  const cachedSymbol = useRef<string>('');
  const cachedDetails = useRef<TickerDetails | null>(null);
  const cachedQuote = useRef<StockQuote | null>(null);

  useEffect(() => {
    let cancelled = false;
    const symbolChanged = cachedSymbol.current !== symbol;
    const shouldRefetch = symbolChanged || refreshKey > 0;

    async function fetchAll() {
      if (symbolChanged) {
        setLoading(true);
        // Clear previous data so the page shows loading placeholders
        setDetails(null);
        setQuote(null);
        setBars([]);
      }
      if (shouldRefetch) {
        setError(null);
      }

      // On timeline-only change, reuse cached details/quote and just fetch bars
      if (!shouldRefetch) {
        setDetails(cachedDetails.current);
        setQuote(cachedQuote.current);

        let barsResult: OHLCBar[] = [];
        try {
          barsResult = await marketDataService.getHistoricalBars({ symbol, timelineType: timeline });
          if (!Array.isArray(barsResult)) barsResult = [];
        } catch (err) {
          reportWarning(`[useTickerData] getHistoricalBars failed for ${symbol}, using mock`, err, {
            symbol,
            timeline,
            stage: 'timeline_only_bars',
          });
          barsResult = generateMockBars(timeline, cachedQuote.current?.price ?? 150);
        }
        if (!cancelled) {
          setBars(barsResult);
          setLoading(false);
        }
        return;
      }

      // --- Full fetch: details first (needed for 404 check) ---
      let detailsResult: TickerDetails | null;
      try {
        detailsResult = await marketDataService.getTickerDetails(symbol);
      } catch (err) {
        reportWarning(`[useTickerData] getTickerDetails failed for ${symbol}`, err, {
          symbol,
          timeline,
          stage: 'details',
        });
        if (err instanceof MassiveApiError && err.status === 404) {
          if (!cancelled) {
            setError(`Ticker "${symbol}" was not found. Only US-listed securities are supported.`);
            setLoading(false);
          }
          return;
        }
        detailsResult = null;
      }

      cachedSymbol.current = symbol;
      cachedDetails.current = detailsResult;
      cachedQuote.current = null;

      if (cancelled) return;

      // Set details immediately so the page structure renders
      const finalDetails = detailsResult ?? generateMockDetails(symbol);
      setDetails(finalDetails);
      setLoading(false);

      // --- Fetch quote and bars in parallel ---
      const quotePromise = marketDataService.getQuote(symbol).catch((err) => {
        reportWarning(`[useTickerData] getQuote failed for ${symbol}`, err, {
          symbol,
          timeline,
          stage: 'quote',
        });
        return null;
      });

      const barsPromise = marketDataService.getHistoricalBars({ symbol, timelineType: timeline })
        .then((result) => (Array.isArray(result) ? result : []))
        .catch((err) => {
          reportWarning(`[useTickerData] getHistoricalBars failed for ${symbol}, using mock`, err, {
            symbol,
            timeline,
            stage: 'full_fetch_bars',
          });
          return null as OHLCBar[] | null;
        });

      const [quoteResult, barsResult] = await Promise.all([quotePromise, barsPromise]);

      if (cancelled) return;

      const finalBars = barsResult ?? generateMockBars(timeline, quoteResult?.price ?? 150);
      setBars(finalBars);

      const finalQuote = quoteResult
        ?? (finalBars.length > 0 ? quoteFromBars(symbol, finalBars) : generateMockQuote(symbol));
      cachedQuote.current = finalQuote;
      setQuote(finalQuote);
    }

    fetchAll();
    return () => { cancelled = true; };
  }, [symbol, timeline, refreshKey]);

  return { details, quote, bars, loading, error };
}

// ============================================================================
// Formatting utilities
// ============================================================================

export function formatMarketCap(value: number | undefined): string {
  if (value == null) return 'N/A';
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  return value.toLocaleString();
}

export function formatEmployeeCount(value: number | undefined): string {
  if (value == null) return 'N/A';
  return value.toLocaleString();
}

export function formatChartLabel(timestamp: number, timeline: TimelineType): string {
  const d = new Date(timestamp);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const formatHour = (date: Date): string => {
    let hours = date.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours} ${ampm}`;
  };

  switch (timeline) {
    case '1D':
      return formatHour(d);
    case '5D':
      return `${days[d.getDay()]}`;
    case '1M':
    case '6M':
    case 'YTD':
      return `${months[d.getMonth()]} ${d.getDate()}`;
    case '1Y':
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    case '5Y':
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    default:
      return `${months[d.getMonth()]} ${d.getDate()}`;
  }
}
