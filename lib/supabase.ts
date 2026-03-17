/**
 * Supabase Client
 *
 * Auth-capable Supabase JS client with AsyncStorage session persistence.
 *
 * EAS production builds: set EXPO_PUBLIC_SUPABASE_URL and
 * EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in EAS project environment variables
 * (or in eas.json build.production.env). Local .env is not used by EAS Build.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { store$ } from './store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

const hasValidConfig = Boolean(supabaseUrl && supabasePublishableKey);
if (!hasValidConfig && typeof __DEV__ !== 'undefined' && !__DEV__) {
  console.error(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Set them in EAS project environment variables for the production build profile.',
  );
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/** One-time promise: resolves when the auth client has had a chance to rehydrate session from storage (e.g. after cold start). */
let initialAuthReady: Promise<void> | null = null;

function getInitialAuthReady(): Promise<void> {
  if (initialAuthReady) return initialAuthReady;
  initialAuthReady = (async () => {
    await supabase.auth.getSession();
    await new Promise((r) => setTimeout(r, 80));
    await supabase.auth.getSession();
  })();
  return initialAuthReady;
}

/**
 * Call before ensureSession() on app init so the client has rehydrated from AsyncStorage.
 * Prevents "Missing Authorization header" on first API calls in production (e.g. TestFlight).
 */
export async function waitForInitialAuth(): Promise<void> {
  if (!hasValidConfig) return;
  await getInitialAuthReady();
}

/**
 * Returns the current access token, or null if no session exists.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!hasValidConfig) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Ensures an active auth session exists.
 * Signs in anonymously if the user has no session yet.
 */
export async function ensureSession(): Promise<void> {
  if (!hasValidConfig) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    store$.auth.set({
      userId: session.user.id,
      isAnonymous: session.user.is_anonymous ?? false,
    });
    return;
  }

  const { error, data } = await supabase.auth.signInAnonymously();
  if (error) {
    console.error('[Auth] Anonymous sign-in failed:', error.message);
  } else if (data.user) {
    store$.auth.set({
      userId: data.user.id,
      isAnonymous: data.user.is_anonymous ?? true,
    });
  }
}
