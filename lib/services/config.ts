/**
 * Market Data Service Configuration
 *
 * Base URLs and provider selection.
 * API keys are stored server-side in Supabase Edge Function env vars.
 */

export const API_CONFIG = {
  massive: {
    // Supabase Edge Function proxy — set this to your Supabase project URL
    proxyUrl:
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/massive-proxy`,
  },
  supabase: {
    extractTransactionsUrl:
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/extract-transactions`,
  },
} as const;

export type ProviderName = "massive";

export const DEFAULT_PROVIDER: ProviderName = "massive";
