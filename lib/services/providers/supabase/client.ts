/**
 * Supabase Edge Functions HTTP Client
 *
 * Thin wrapper around fetch for calling Supabase Edge Functions.
 * Logs requests in the same [API] format used by the Massive client.
 */

import { getAccessToken } from '../../../supabase';
import { API_CONFIG } from '../../config';

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

function isTransientNetworkError(err: unknown): boolean {
  return err instanceof TypeError;
}

async function supabasePost<T>(url: string, body: unknown): Promise<T> {
  console.debug(`[API] POST ${url}`);

  const jsonBody = JSON.stringify(body);

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: jsonBody,
      });

      if (!response.ok) {
        let message: string;
        try {
          const data = await response.json();
          message = data.message || data.error || `Request failed (${response.status})`;
        } catch {
          message = `Server returned ${response.status} (${response.statusText || 'no body'})`;
        }
        throw new SupabaseEdgeFunctionError(message, response.status);
      }

      try {
        return await response.json() as T;
      } catch {
        throw new SupabaseEdgeFunctionError('Invalid JSON in response body', response.status);
      }
    } catch (err) {
      if (isTransientNetworkError(err) && attempt < MAX_RETRIES) {
        console.debug(`[API] Network error, retrying (${attempt + 1}/${MAX_RETRIES})…`);
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
        continue;
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
