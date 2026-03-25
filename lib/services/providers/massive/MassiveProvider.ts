/**
 * Massive Market Data Provider
 *
 * Implements MarketDataProvider using the Massive (Polygon-compatible) API.
 */

import type { TimelineType } from "../../../store/types";
import type {
  HistoricalBarsParams,
  IndexSnapshot,
  MarketDataProvider,
  MarketStatus,
  NewsParams,
  NewsResponse,
  OHLCBar,
  StockQuote,
  StockSplit,
  TickerDetails,
  TickerSearchResponse,
} from "../../types";
import { massiveGet, massiveGetPaginated } from "./client";
import {
  mapAggBarToOHLC,
  mapNewsArticle,
  mapPrevDayToIndex,
  mapSearchResult,
  mapSnapshotToQuote,
  mapSplitResult,
  mapTickerDetailsToDetails,
  type MassiveAggBar,
  type MassiveNewsArticle,
  type MassivePrevDayResult,
  type MassiveSearchTicker,
  type MassiveSnapshotTicker,
  type MassiveSplitResult,
  type MassiveTickerDetails,
} from "./mappers";

// ============================================================================
// Timeline → API parameter mapping
// ============================================================================

interface AggParams {
  multiplier: number;
  timespan: string;
  from: string;
  to: string;
}

function getAggParams(timelineType: TimelineType): AggParams {
  const now = new Date();
  const to = formatDate(now);

  const from = new Date(now);
  let multiplier: number;
  let timespan: string;

  switch (timelineType) {
    case "1D":
      multiplier = 5;
      timespan = "minute";
      from.setDate(from.getDate() - 1);
      break;
    case "5D":
      multiplier = 30;
      timespan = "minute";
      from.setDate(from.getDate() - 5);
      break;
    case "1M":
      multiplier = 1;
      timespan = "day";
      from.setMonth(from.getMonth() - 1);
      break;
    case "6M":
      multiplier = 1;
      timespan = "day";
      from.setMonth(from.getMonth() - 6);
      break;
    case "YTD":
      multiplier = 1;
      timespan = "day";
      from.setMonth(0);
      from.setDate(1);
      break;
    case "1Y":
      multiplier = 1;
      timespan = "day";
      from.setFullYear(from.getFullYear() - 1);
      break;
    case "5Y":
      multiplier = 1;
      timespan = "week";
      from.setFullYear(from.getFullYear() - 5);
      break;
    default:
      multiplier = 1;
      timespan = "day";
      from.setMonth(from.getMonth() - 1);
  }

  return { multiplier, timespan, from: formatDate(from), to };
}

function formatDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Index tickers used for market overview
// ============================================================================

const INDEX_TICKERS = ["I:DJI", "I:SPX", "I:COMP", "I:RUT"];

// ============================================================================
// Provider Implementation
// ============================================================================

export class MassiveProvider implements MarketDataProvider {
  readonly name = "massive";

  async getQuote(symbol: string): Promise<StockQuote> {
    const snapshot = await massiveGet<MassiveSnapshotTicker>(
      `/v2/snapshot/locale/us/markets/stocks/tickers/${encodeURIComponent(symbol)}`,
    );
    return mapSnapshotToQuote(snapshot);
  }

  async getQuotes(symbols: string[]): Promise<StockQuote[]> {
    if (symbols.length === 0) return [];
    if (symbols.length === 1) return [await this.getQuote(symbols[0])];

    const snapshots = await massiveGet<MassiveSnapshotTicker[]>(
      `/v2/snapshot/locale/us/markets/stocks/tickers`,
      { tickers: symbols.join(",") },
    );

    if (!Array.isArray(snapshots)) return [];
    return snapshots.map(mapSnapshotToQuote);
  }

  async getTickerDetails(symbol: string): Promise<TickerDetails> {
    const details = await massiveGet<MassiveTickerDetails>(
      `/v3/reference/tickers/${encodeURIComponent(symbol)}`,
    );
    return mapTickerDetailsToDetails(details);
  }

  async getHistoricalBars(params: HistoricalBarsParams): Promise<OHLCBar[]> {
    const { multiplier, timespan, from, to } =
      params.from && params.to
        ? { multiplier: 1, timespan: "day", from: params.from, to: params.to }
        : getAggParams(params.timelineType);

    const bars = await massiveGet<MassiveAggBar[]>(
      `/v2/aggs/ticker/${encodeURIComponent(params.symbol)}/range/${multiplier}/${timespan}/${from}/${to}`,
      { adjusted: true, sort: "asc", limit: 5000 },
    );

    if (!Array.isArray(bars)) return [];
    return bars.map(mapAggBarToOHLC);
  }

  async getTopMovers(direction: "gainers" | "losers"): Promise<StockQuote[]> {
    const snapshots = await massiveGet<MassiveSnapshotTicker[]>(
      `/v2/snapshot/locale/us/markets/stocks/${direction}`,
    );

    if (!Array.isArray(snapshots)) return [];
    return snapshots.map(mapSnapshotToQuote);
  }

  async searchTickers(
    query: string,
    nextUrl?: string,
  ): Promise<TickerSearchResponse> {
    // When a cursor URL is provided, fetch the next page directly
    if (nextUrl) {
      const response =
        await massiveGetPaginated<MassiveSearchTicker[]>(nextUrl);
      return {
        results: Array.isArray(response.data)
          ? response.data.map(mapSearchResult)
          : [],
        nextUrl: response.nextUrl,
      };
    }

    const response = await massiveGetPaginated<MassiveSearchTicker[]>(
      "/v3/reference/tickers",
      { search: query, active: true, limit: 20, market: "stocks", sort: "market", order: "DESC" },
    );

    return {
      results: Array.isArray(response.data)
        ? response.data.map(mapSearchResult)
        : [],
      nextUrl: response.nextUrl,
    };
  }

  async getNews(params?: NewsParams): Promise<NewsResponse> {
    if (params?.cursor) {
      const response =
        await massiveGetPaginated<MassiveNewsArticle[]>(params.cursor);
      return {
        articles: Array.isArray(response.data)
          ? response.data.map(mapNewsArticle)
          : [],
        nextUrl: response.nextUrl,
      };
    }

    const queryParams: Record<string, string | number | boolean | undefined> = {
      limit: params?.limit ?? 20,
      order: "desc",
      sort: "published_utc",
    };

    if (params?.tickers && params.tickers.length > 0) {
      queryParams["ticker"] = params.tickers.join(",");
    }

    const response = await massiveGetPaginated<MassiveNewsArticle[]>(
      "/v2/reference/news",
      queryParams,
    );

    return {
      articles: Array.isArray(response.data)
        ? response.data.map(mapNewsArticle)
        : [],
      nextUrl: response.nextUrl,
    };
  }

  async getIndicesSnapshot(): Promise<IndexSnapshot[]> {
    const results = await Promise.all(
      INDEX_TICKERS.map(async (ticker) => {
        const raw = await massiveGet<MassivePrevDayResult[]>(
          `/v2/aggs/ticker/${encodeURIComponent(ticker)}/prev`,
        );
        if (!Array.isArray(raw) || raw.length === 0) return null;
        return mapPrevDayToIndex(raw[0]);
      }),
    );

    return results.filter((r): r is IndexSnapshot => r !== null);
  }

  async getMarketStatus(): Promise<MarketStatus> {
    return massiveGet<MarketStatus>("/v1/marketstatus/now");
  }

  async getMarketHolidays(): Promise<import("../../types").MarketHoliday[]> {
    const holidays = await massiveGet<import("../../types").MarketHoliday[]>(
      "/v1/marketstatus/upcoming",
    );
    if (!Array.isArray(holidays)) return [];
    return holidays;
  }

  async getStockSplits(symbol: string): Promise<StockSplit[]> {
    const splits = await massiveGet<MassiveSplitResult[]>(
      "/stocks/v1/splits",
      { ticker: symbol },
    );
    if (!Array.isArray(splits)) return [];
    return splits.map(mapSplitResult);
  }
}
