/**
 * Stock Ticker Types
 *
 * Static reference data from the Massive API ticker types endpoint.
 * Source: GET /v3/reference/tickers/types?asset_class=stocks&locale=us
 *
 * This data changes very rarely — safe to store as a constant.
 */

export interface TickerTypeInfo {
  code: string;
  /** Short display label for badges (e.g. "Stock", "ETF") */
  label: string;
  /** Full description from the API */
  description: string;
  /** Badge color (works as background with white text) */
  color: string;
}

const TICKER_TYPES: Record<string, TickerTypeInfo> = {
  // Equities
  CS:      { code: 'CS',      label: 'Stock',     description: 'Common Stock',                          color: '#007AFF' },
  OS:      { code: 'OS',      label: 'Stock',     description: 'Ordinary Shares',                       color: '#007AFF' },
  PFD:     { code: 'PFD',     label: 'Preferred', description: 'Preferred Stock',                       color: '#5856D6' },
  NYRS:    { code: 'NYRS',    label: 'NYRS',      description: 'New York Registry Shares',              color: '#5856D6' },

  // ETFs & Vehicles
  ETF:     { code: 'ETF',     label: 'ETF',       description: 'Exchange Traded Fund',                  color: '#FF9F0A' },
  ETS:     { code: 'ETS',     label: 'ETF',       description: 'Single-security ETF',                   color: '#FF9F0A' },
  ETN:     { code: 'ETN',     label: 'ETN',       description: 'Exchange Traded Note',                  color: '#AF52DE' },
  ETV:     { code: 'ETV',     label: 'ETV',       description: 'Exchange Traded Vehicle',               color: '#AF52DE' },

  // Funds
  FUND:    { code: 'FUND',    label: 'Fund',      description: 'Fund',                                  color: '#34C759' },

  // Bonds
  BOND:    { code: 'BOND',    label: 'Bond',      description: 'Corporate Bond',                        color: '#0A84FF' },
  AGEN:    { code: 'AGEN',    label: 'Bond',      description: 'Agency Bond',                           color: '#0A84FF' },
  EQLK:    { code: 'EQLK',    label: 'Bond',      description: 'Equity Linked Bond',                    color: '#5856D6' },

  // ADRs / GDRs
  ADRC:    { code: 'ADRC',    label: 'ADR',       description: 'American Depository Receipt Common',    color: '#32ADE6' },
  ADRP:    { code: 'ADRP',    label: 'ADR',       description: 'American Depository Receipt Preferred', color: '#5856D6' },
  ADRW:    { code: 'ADRW',    label: 'ADR',       description: 'American Depository Receipt Warrants',  color: '#FF9500' },
  ADRR:    { code: 'ADRR',    label: 'ADR',       description: 'American Depository Receipt Rights',    color: '#FF2D55' },
  GDR:     { code: 'GDR',     label: 'GDR',       description: 'Global Depository Receipts',            color: '#32ADE6' },

  // Derivatives & Other
  WARRANT: { code: 'WARRANT', label: 'Warrant',   description: 'Warrant',                               color: '#FF9500' },
  RIGHT:   { code: 'RIGHT',   label: 'Rights',    description: 'Rights',                                color: '#FF2D55' },
  SP:      { code: 'SP',      label: 'SP',        description: 'Structured Product',                    color: '#BF5AF2' },
  BASKET:  { code: 'BASKET',  label: 'Basket',    description: 'Basket',                                color: '#8E8E93' },
  UNIT:    { code: 'UNIT',    label: 'Unit',      description: 'Unit',                                  color: '#30B0C7' },
  LT:      { code: 'LT',     label: 'Trust',     description: 'Liquidating Trust',                     color: '#FF453A' },
  OTHER:   { code: 'OTHER',   label: 'Other',     description: 'Other Security Type',                   color: '#8E8E93' },

  // Legacy values (stored before raw API codes were used)
  STOCK:   { code: 'STOCK',   label: 'Stock',     description: 'Common Stock',                          color: '#007AFF' },
  CRYPTO:  { code: 'CRYPTO',  label: 'Crypto',    description: 'Cryptocurrency',                        color: '#5AC8FA' },
};

const DEFAULT_TYPE: TickerTypeInfo = {
  code: '',
  label: 'Other',
  description: 'Unknown Type',
  color: '#8E8E93',
};

/**
 * Look up display info for an API ticker type code.
 */
export function getTickerTypeInfo(code?: string): TickerTypeInfo {
  if (!code) return DEFAULT_TYPE;
  return TICKER_TYPES[code.toUpperCase()] ?? { ...DEFAULT_TYPE, code, label: code };
}
