/**
 * API Utilities
 *
 * Helper functions for working with API and other temporary data.
 */

import { API_CONFIG } from "../services/config";

/**
 * Routes a Massive API resource URL (like logo/icon URLs) through the proxy.
 * Returns undefined if the input URL is undefined.
 */
export function buildAuthenticatedUrl(
  url: string | undefined,
): string | undefined {
  if (!url) return undefined;

  try {
    const original = new URL(url);
    const proxy = new URL(API_CONFIG.massive.proxyUrl);
    proxy.searchParams.set("path", original.pathname);

    // Forward original query params (except apiKey)
    for (const [key, value] of original.searchParams.entries()) {
      if (key !== "apiKey") {
        proxy.searchParams.set(key, value);
      }
    }

    return proxy.toString();
  } catch {
    return undefined;
  }
}
