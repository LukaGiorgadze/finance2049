/**
 * Provider Registry
 *
 * Maps provider names to their implementations.
 * Add new providers here as they are built.
 */

import type { MarketDataProvider } from '../types';
import type { ProviderName } from '../config';
import { MassiveProvider } from './massive/MassiveProvider';

const providers: Record<ProviderName, () => MarketDataProvider> = {
  massive: () => new MassiveProvider(),
};

export function createProvider(name: ProviderName): MarketDataProvider {
  const factory = providers[name];
  if (!factory) {
    throw new Error(`Unknown market data provider: ${name}`);
  }
  return factory();
}
