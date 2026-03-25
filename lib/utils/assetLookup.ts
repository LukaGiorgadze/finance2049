/**
 * Asset Lookup Utility
 *
 * Look up asset information (name, type) from the searchable assets list.
 * This will eventually be replaced by API calls.
 */

import { getTickerTypeInfo } from '../services/tickerTypes';
import type { AssetType } from '../store/types';

export interface AssetInfo {
  symbol: string;
  name: string;
  type: AssetType;
  exchange?: string;
}

/**
 * Map a Massive/Polygon API type code to our AssetType.
 *
 * Common API type codes:
 *   CS   = Common Stock
 *   ETF  = Exchange Traded Fund
 *   ETV  = Exchange Traded Vehicle (e.g. ETN)
 *   ETN  = Exchange Traded Note
 *   ADRC = American Depositary Receipt
 *   PFD  = Preferred Stock
 *   FUND = Fund
 */
export function mapApiTypeToAssetType(apiType?: string, market?: string): AssetType {
  if (market === 'crypto') return 'CRYPTO';
  const upper = (apiType ?? '').toUpperCase();
  if (!upper) return 'CS';
  return upper;
}

/**
 * Get a user-friendly label for an API type code.
 * Delegates to the tickerTypes reference data.
 */
export { getTickerTypeInfo } from '../services/tickerTypes';
export type { TickerTypeInfo } from '../services/tickerTypes';

export function getApiTypeLabel(apiType?: string): string {
  return getTickerTypeInfo(apiType).label;
}
