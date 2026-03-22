/**
 * Supabase Edge Functions HTTP Client
 *
 * Thin wrapper around Axios for calling Supabase Edge Functions.
 * Logs requests in the same [API] format used by the Massive client.
 */

import { API_CONFIG } from '../../config';
import { getResponseData, getResponseStatus, httpClient, isNetworkError } from '../../http/client';

export class SupabaseEdgeFunctionError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = 'SupabaseEdgeFunctionError';
  }
}

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1500;

async function supabasePost<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await httpClient.post<T>(url, body, {
        requiresAuth: true,
        logLabel: 'API',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.data as T;
    } catch (err) {
      if (isNetworkError(err) && attempt < MAX_RETRIES) {
        console.debug(`[API] Network error, retrying (${attempt + 1}/${MAX_RETRIES})…`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
      }

      const data = getResponseData<{ message?: string; error?: string }>(err);
      const responseStatus = getResponseStatus(err);

      if (responseStatus) {
        const message =
          data?.message ||
          data?.error ||
          `Request failed (${responseStatus})`;
        throw new SupabaseEdgeFunctionError(message, responseStatus);
      }

      throw err;
    }
  }

  throw new Error('Unreachable');
}

// ── extract-transactions ────────────────────────────────────────────────────

export interface ExtractTransactionsPayload {
  signedUrl: string;
  storagePath: string;
  mimeType: string;
  fileName?: string;
}

export interface RawTransaction {
  symbol?: string;
  date?: string;
  quantity?: number | string;
  price?: number | string;
  commission?: number | string;
  type?: string;
}

export interface ExtractTransactionsResult {
  transactions: RawTransaction[];
  message: string;
}

export async function extractTransactions(
  payload: ExtractTransactionsPayload,
): Promise<ExtractTransactionsResult> {
  return supabasePost<ExtractTransactionsResult>(
    API_CONFIG.supabase.extractTransactionsUrl,
    payload,
  );
}
