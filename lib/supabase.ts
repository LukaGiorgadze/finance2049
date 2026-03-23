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
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { reportError, setCrashAttributes, setCrashUser } from './crashlytics';
import { store$ } from './store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

export const hasSupabaseConfig = Boolean(supabaseUrl && supabasePublishableKey);

let hasReportedMissingConfig = false;
let supabaseClient: SupabaseClient | null = null;

function reportMissingSupabaseConfig(context: string) {
  if (hasReportedMissingConfig || typeof __DEV__ === 'undefined' || __DEV__) {
    return;
  }

  hasReportedMissingConfig = true;

  reportError(
    '[Supabase] Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY. ' +
      'Set them in EAS project environment variables for the production build profile.',
    undefined,
    {
      context,
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasPublishableKey: Boolean(supabasePublishableKey),
      runtime: 'app',
    },
  );
}

export function getSupabase(): SupabaseClient | null {
  if (!hasSupabaseConfig) {
    reportMissingSupabaseConfig('getSupabase');
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  }

  return supabaseClient;
}

/** One-time promise: resolves when the auth client has had a chance to rehydrate session from storage (e.g. after cold start). */
let initialAuthReady: Promise<void> | null = null;

function getInitialAuthReady(): Promise<void> {
  if (initialAuthReady) return initialAuthReady;
  initialAuthReady = (async () => {
    const supabase = getSupabase();
    if (!supabase) return;
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
  if (!hasSupabaseConfig) return;
  await getInitialAuthReady();
}

/**
 * Returns the current access token, or null if no session exists.
 */
export async function getAccessToken(): Promise<string | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

/**
 * Ensures an active auth session exists.
 * Signs in anonymously if the user has no session yet.
 */
export async function ensureSession(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    store$.auth.set({
      userId: session.user.id,
      isAnonymous: session.user.is_anonymous ?? false,
    });
    await Promise.all([
      setCrashUser(session.user.id),
      setCrashAttributes({
        isAnonymous: session.user.is_anonymous ?? false,
        authProvider: session.user.app_metadata?.provider ?? 'unknown',
      }),
    ]);
    return;
  }

  const { error, data } = await supabase.auth.signInAnonymously();
  if (error) {
    reportError('[Auth] Anonymous sign-in failed', error, {
      authAction: 'signInAnonymously',
      hasSupabaseConfig,
    });
  } else if (data.user) {
    store$.auth.set({
      userId: data.user.id,
      isAnonymous: data.user.is_anonymous ?? true,
    });
    await Promise.all([
      setCrashUser(data.user.id),
      setCrashAttributes({
        isAnonymous: data.user.is_anonymous ?? true,
        authProvider: data.user.app_metadata?.provider ?? 'anonymous',
      }),
    ]);
  }
}
