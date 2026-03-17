import { useEffect, useState } from 'react';

import { marketDataService } from '../services/marketDataService';
import { getAccessToken } from '../supabase';
import type { MarketHoliday, MarketStatus } from '../services/types';

export function useMarketStatus() {
  const [status, setStatus] = useState<MarketStatus | null>(null);
  const [holidays, setHolidays] = useState<MarketHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      const token = await getAccessToken();
      if (!token) return;

      try {
        const [statusData, holidaysData] = await Promise.all([
          marketDataService.getMarketStatus(),
          marketDataService.getMarketHolidays(),
        ]);
        if (!cancelled) {
          setStatus(statusData);
          setHolidays(holidaysData);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          console.warn('[useMarketStatus] Failed to fetch market status:', (err as Error).message);
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchStatus();

    // Refresh market status every 5 minutes
    const interval = setInterval(fetchStatus, 5 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { status, holidays, loading, error };
}
