/**
 * Massive API HTTP Client
 *
 * Thin wrapper around Axios that routes requests through the
 * Supabase Edge Function proxy. The proxy injects the API key
 * server-side so it never leaves the backend.
 */

import { API_CONFIG } from "../../config";
import {
  getResponseStatus,
  getResponseText,
  httpClient,
} from "../../http/client";

export class MassiveApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "MassiveApiError";
  }
}

export class MassiveRateLimitError extends MassiveApiError {
  constructor(requestId?: string) {
    super("Rate limit exceeded", 429, requestId);
    this.name = "MassiveRateLimitError";
  }
}

/**
 * Returns true when the error is a 401 caused by no active session
 * (e.g. during onboarding before the user has authenticated).
 * Callers can use this to suppress noisy logs for an expected state.
 */
export function isNoSessionError(err: unknown): boolean {
  return err instanceof MassiveApiError && err.status === 401;
}

interface MassiveResponse<T> {
  status?: string;
  results?: T;
  result?: T;
  request_id?: string;
  count?: number;
  ticker?: T;
  tickers?: T;
  next_url?: string;
}

// ============================================================================
// Shared helpers
// ============================================================================

function buildUrl(
  pathOrUrl: string,
  queryParams?: Record<string, string | number | boolean | undefined>,
): URL {
  const { proxyUrl } = API_CONFIG.massive;

  // For full URLs (e.g. next_url pagination cursors), extract the path + query
  // and route through the proxy as well.
  if (pathOrUrl.startsWith("http")) {
    const original = new URL(pathOrUrl);
    const url = new URL(proxyUrl);
    url.searchParams.set("path", original.pathname);
    // Forward original query params (except apiKey — the proxy adds it)
    for (const [key, value] of original.searchParams.entries()) {
      if (key !== "apiKey") {
        url.searchParams.set(key, value);
      }
    }
    return url;
  }

  const url = new URL(proxyUrl);
  url.searchParams.set("path", pathOrUrl);

  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

function redactUrl(url: URL): string {
  return url.toString();
}

async function fetchAndParse<T>(url: URL): Promise<MassiveResponse<T>> {
  try {
    const response = await httpClient.get(redactUrl(url), {
      requiresAuth: true,
      logLabel: "API",
    });

    const data = response.data as MassiveResponse<T>;

    if (data.status === "ERROR" || data.status === "NOT_FOUND") {
      throw new MassiveApiError(
        `Massive API returned ${data.status}`,
        response.status,
        data.request_id,
      );
    }

    return data;
  } catch (err) {
    const status = getResponseStatus(err);

    if (status === 401) {
      // No active session (e.g. during onboarding) — skip the request entirely
      throw new MassiveApiError("No active session", 401);
    }

    if (status === 429) {
      throw new MassiveRateLimitError();
    }

    if (status) {
      const body = getResponseText(err);
      throw new MassiveApiError(
        `Massive API error: ${status} - ${body}`,
        status,
      );
    }

    throw err;
  }
}

function unwrapPayload<T>(data: MassiveResponse<T>): T {
  if (data.results !== undefined) return data.results;
  if (data.result !== undefined) return data.result;
  if (data.ticker !== undefined) return data.ticker;
  if (data.tickers !== undefined) return data.tickers;
  return data as unknown as T;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Standard GET — returns the unwrapped payload, discarding pagination info.
 */
export async function massiveGet<T>(
  path: string,
  queryParams?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = buildUrl(path, queryParams);
  const data = await fetchAndParse<T>(url);
  return unwrapPayload(data);
}

/**
 * Paginated GET — returns both the unwrapped payload and `nextUrl` for
 * cursor-based pagination. Accepts either a relative path or a full
 * `next_url` from a previous response.
 */
export interface PaginatedResult<T> {
  data: T;
  nextUrl?: string;
}

export async function massiveGetPaginated<T>(
  pathOrUrl: string,
  queryParams?: Record<string, string | number | boolean | undefined>,
): Promise<PaginatedResult<T>> {
  const url = buildUrl(pathOrUrl, queryParams);
  const raw = await fetchAndParse<T>(url);

  return {
    data: unwrapPayload(raw),
    nextUrl: raw.next_url,
  };
}
