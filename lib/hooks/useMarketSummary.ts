import { useEffect, useState } from "react";
import { getAccessToken } from "../supabase";
import { httpClient } from "../services/http/client";

const MARKET_SUMMARY_URL =
  "https://query1.finance.yahoo.com/v6/finance/quote/marketSummary?lang=en-US&region=US&corsDomain=finance.yahoo.com";

let marketSummaryInflight: Promise<MarketSummaryItem[]> | null = null;

interface YahooResult {
  symbol: string;
  shortName?: string;
  quoteType: string;
  cryptoTradeable?: boolean;
  regularMarketPrice?: { raw: number; fmt: string };
  regularMarketChange?: { raw: number; fmt: string };
  regularMarketChangePercent?: { raw: number; fmt: string };
}

interface YahooResponse {
  marketSummaryResponse?: {
    result?: YahooResult[];
    error?: unknown;
  };
}

export interface MarketSummaryItem {
  symbol: string;
  shortName: string;
  price: string;
  changePercent: number;
  changePercentFmt: string;
  quoteType: string;
}

export function useMarketSummary(refreshKey = 0) {
  const [items, setItems] = useState<MarketSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchMarketSummary(): Promise<MarketSummaryItem[]> {
      const response = await httpClient.get(MARKET_SUMMARY_URL, {
        logLabel: "SCRAP",
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      const data = response.data as YahooResponse;
      const results = data?.marketSummaryResponse?.result ?? [];

      return results
        .filter((item) => item.quoteType !== "CRYPTOCURRENCY")
        .map(
          (item): MarketSummaryItem => ({
            symbol: item.symbol,
            shortName: item.shortName ?? item.symbol,
            price: item.regularMarketPrice?.fmt ?? "—",
            changePercent: item.regularMarketChangePercent?.raw ?? 0,
            changePercentFmt: item.regularMarketChangePercent?.fmt ?? "—",
            quoteType: item.quoteType,
          }),
        );
    }

    async function load() {
      const token = await getAccessToken();
      if (!token) { setLoading(false); return; }

      try {
        if (items.length === 0) setLoading(true);
        setError(null);

        if (!marketSummaryInflight) {
          marketSummaryInflight = fetchMarketSummary().finally(() => {
            marketSummaryInflight = null;
          });
        }
        const mapped = await marketSummaryInflight;

        if (!cancelled) {
          setItems(mapped);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message ?? "Failed to fetch market summary");
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  return { items, loading, error };
}
