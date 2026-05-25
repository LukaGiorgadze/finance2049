/**
 * Store Migrations
 *
 * Handles schema migrations when the app updates.
 * Each migration transforms data from version N to version N+1.
 */

import type { RootStore } from "./types";
import { CURRENT_SCHEMA_VERSION } from "./types";

type Migration = (state: any) => any;

function hasBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function inferSchemaVersion(state: any) {
  const explicitVersion = state?._schema?.version;
  if (typeof explicitVersion === "number") return explicitVersion;

  const preferences = state?.preferences ?? {};
  if (hasBoolean(preferences.inAppMessagesEnabled)) return 4;
  if (hasBoolean(preferences.notificationsEnabled)) return 3;

  const holdings = Object.values(state?.portfolio?.holdings ?? {});
  if (
    holdings.length === 0 ||
    holdings.every((holding: any) => typeof holding?.totalCommissions === "number")
  ) {
    return 2;
  }

  return 1;
}

/**
 * Migration registry
 * Key is the version we're migrating FROM
 * Value is the function that transforms to the next version
 */
const migrations: Record<number, Migration> = {
  // Migration from v1 to v2: Add totalCommissions to holdings
  1: (state) => {
    const holdings = state.portfolio?.holdings ?? {};
    const migratedHoldings: Record<string, any> = {};

    for (const [symbol, holding] of Object.entries(holdings)) {
      migratedHoldings[symbol] = {
        ...(holding as object),
        totalCommissions: 0, // Default to 0 for existing holdings
      };
    }

    return {
      ...state,
      portfolio: {
        ...state.portfolio,
        holdings: migratedHoldings,
      },
      _schema: { version: 2 },
    };
  },
  // Migration from v2 to v3: Add push notifications preference as explicit opt-in.
  2: (state) => {
    return {
      ...state,
      preferences: {
        ...state.preferences,
        notificationsEnabled: hasBoolean(state.preferences?.notificationsEnabled)
          ? state.preferences.notificationsEnabled
          : false,
      },
      _schema: { version: 3 },
    };
  },
  // Migration from v3 to v4: Enable Firebase In-App Messaging by default.
  3: (state) => {
    return {
      ...state,
      preferences: {
        ...state.preferences,
        inAppMessagesEnabled: hasBoolean(state.preferences?.inAppMessagesEnabled)
          ? state.preferences.inAppMessagesEnabled
          : true,
      },
      _schema: { version: 4 },
    };
  },
};

/**
 * Run all necessary migrations to bring state up to current version
 */
export function migrateState(state: any): RootStore {
  if (!state) {
    return getInitialState();
  }

  let currentVersion = inferSchemaVersion(state);
  let migratedState = { ...state };

  while (currentVersion < CURRENT_SCHEMA_VERSION) {
    const migration = migrations[currentVersion];
    if (migration) {
      console.debug(
        `[Store] Migrating from v${currentVersion} to v${currentVersion + 1}`,
      );
      migratedState = migration(migratedState);
    }
    currentVersion++;
  }

  // Ensure schema version is set
  migratedState._schema = { version: CURRENT_SCHEMA_VERSION };

  return migratedState as RootStore;
}

/**
 * Get initial state for fresh installs
 */
export function getInitialState(): RootStore {
  return {
    portfolio: {
      holdings: {},
      transactions: [],
    },
    market: {
      prices: {},
      indices: [],
      lastUpdated: null,
    },
    preferences: {
      defaultCurrency: "USD",
      showPortfolioValue: true,
      defaultTimeline: "1M",
      gainView: "today",
      notificationsEnabled: false,
      inAppMessagesEnabled: true,
    },
    auth: {
      userId: null,
      isAnonymous: false,
    },
    _schema: {
      version: CURRENT_SCHEMA_VERSION,
    },
  };
}
