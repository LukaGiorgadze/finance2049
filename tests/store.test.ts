import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, test } from 'node:test';

type JsonTransaction = {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'split';
  shares: number;
  price: number;
  total: number;
  date: string;
  commission: number;
  createdAt: string;
  updatedAt: string;
  splitFrom?: number;
  splitTo?: number;
};

type HoldingSnapshot = {
  symbol: string;
  totalShares: number;
  avgCost: number;
  totalCommissions: number;
  lots: Array<{
    transactionId: string;
    shares: number;
    purchasePrice: number;
    purchaseDate: string;
    remainingShares: number;
  }>;
};

type TransactionSnapshot = {
  id: string;
  symbol: string;
  type: 'buy' | 'sell' | 'split';
  shares: number;
  price: number;
  total: number;
  date: string;
  commission: number;
  costBasis: number | null;
  realizedGain: number | null;
  realizedGainPercent: number | null;
  splitFrom: number | null;
  splitTo: number | null;
};

type ReplayFixture = {
  scenarios: Array<{
    name: string;
    transactions: JsonTransaction[];
    expected: {
      holdings: HoldingSnapshot[];
      transactions: TransactionSnapshot[];
    };
  }>;
};

type DeleteFixture = {
  scenarios: Array<{
    name: string;
    targetTransactionId: string;
    transactions: JsonTransaction[];
    expectedValidationError: string | null;
    expectedRemainingTransactionIdsAfterDelete?: string[];
    expectedHoldingsAfterDelete?: HoldingSnapshot[];
  }>;
};

(globalThis as typeof globalThis & { __DEV__?: boolean }).__DEV__ = false;

const AsyncStorage = require('@react-native-async-storage/async-storage').default;
const storeModule = require('../lib/store/index');
const migrationModule = require('../lib/store/migrations');
const typesModule = require('../lib/store/types');

const {
  addTransaction,
  applySplit,
  clearStore,
  deleteHolding,
  deleteTransaction,
  initializeStore,
  recalculatePortfolio,
  reloadStoreFromStorage,
  selectAllHoldings,
  selectHolding,
  selectMarketPrice,
  selectTransactions,
  selectTransactionsBySymbol,
  store$,
  toggleShowPortfolioValue,
  updateMarketPrices,
  updatePreferences,
  validateTransactionDeletion,
} = storeModule;

const {
  getInitialState,
  migrateState,
} = migrationModule;

const {
  CURRENT_SCHEMA_VERSION,
} = typesModule;

const NUMBER_EPSILON = 1e-9;

const replayFixtures = readJsonFixture<ReplayFixture>('recalculate-portfolio-scenarios.json');
const deleteFixtures = readJsonFixture<DeleteFixture>('transaction-deletion-scenarios.json');

beforeEach(async () => {
  clearStore();
  await AsyncStorage.clear();
});

test('recalculatePortfolio replays scenario fixtures end to end', async (t) => {
  for (const scenario of replayFixtures.scenarios) {
    await t.test(scenario.name, () => {
      seedTransactions(scenario.transactions);
      recalculatePortfolio();

      assertApproxDeepEqual(
        normalizeHoldings(),
        scenario.expected.holdings,
        `${scenario.name}.holdings`,
      );
      assertApproxDeepEqual(
        normalizeTransactions(),
        scenario.expected.transactions,
        `${scenario.name}.transactions`,
      );
    });
  }
});

test('validateTransactionDeletion and deleteTransaction honor deletion fixture scenarios', async (t) => {
  for (const scenario of deleteFixtures.scenarios) {
    await t.test(scenario.name, () => {
      seedTransactions(scenario.transactions);
      recalculatePortfolio();

      const validationError = validateTransactionDeletion(scenario.targetTransactionId);
      assert.equal(validationError, scenario.expectedValidationError);

      if (scenario.expectedValidationError) {
        assert.throws(
          () => deleteTransaction(scenario.targetTransactionId),
          new Error(scenario.expectedValidationError),
        );
        return;
      }

      deleteTransaction(scenario.targetTransactionId);

      assert.equal(
        store$.portfolio.transactions.get().some((tx: JsonTransaction) => tx.id === scenario.targetTransactionId),
        false,
      );

      if (scenario.expectedRemainingTransactionIdsAfterDelete) {
        assert.deepEqual(
          store$.portfolio.transactions.get().map((tx: JsonTransaction) => tx.id),
          scenario.expectedRemainingTransactionIdsAfterDelete,
        );
      }

      if (scenario.expectedHoldingsAfterDelete) {
        assertApproxDeepEqual(
          normalizeHoldings(),
          scenario.expectedHoldingsAfterDelete,
          `${scenario.name}.holdingsAfterDelete`,
        );
      }
    });
  }
});

test('addTransaction buy creates a lot and preserves asset metadata', () => {
  const created = addTransaction(
    {
      symbol: 'META',
      type: 'buy',
      shares: 2,
      price: 50,
      total: 100,
      date: '2026-06-01',
      commission: 1,
    },
    'ETF',
    'Meta Test Fund',
  );

  assert.equal(created.symbol, 'META');
  assert.equal(created.type, 'buy');
  assert.match(created.id, /-/);
  assert.match(created.createdAt, /T/);

  const holding = selectHolding('META');
  assert.ok(holding);
  assert.equal(holding.symbol, 'META');
  assert.equal(holding.name, 'Meta Test Fund');
  assert.equal(holding.assetType, 'ETF');
  assert.equal(holding.totalShares, 2);
  assert.equal(holding.avgCost, 50);
  assert.equal(holding.totalCommissions, 1);
  assert.equal(holding.lots.length, 1);
  assert.equal(holding.lots[0].transactionId, created.id);
  assert.equal(holding.lots[0].remainingShares, 2);
});

test('addTransaction sell uses FIFO, updates commissions, and records realized gain', () => {
  addTransaction(
    {
      symbol: 'FIFO',
      type: 'buy',
      shares: 10,
      price: 100,
      total: 1000,
      date: '2026-06-01',
      commission: 1,
    },
    'CS',
    'FIFO Corp',
  );
  addTransaction(
    {
      symbol: 'FIFO',
      type: 'buy',
      shares: 5,
      price: 120,
      total: 600,
      date: '2026-06-02',
      commission: 2,
    },
    'CS',
    'FIFO Corp',
  );

  const sell = addTransaction(
    {
      symbol: 'FIFO',
      type: 'sell',
      shares: 12,
      price: 150,
      total: 1800,
      date: '2026-06-03',
      commission: 3,
    },
    'CS',
    'FIFO Corp',
  );

  assert.equal(sell.costBasis, 1240);
  assert.equal(sell.realizedGain, 557);
  assert.equal(sell.realizedGainPercent, 44.91935483870968);

  const holding = selectHolding('FIFO');
  assert.ok(holding);
  assert.equal(holding.totalShares, 3);
  assert.equal(holding.avgCost, 120);
  assert.ok(Math.abs(holding.totalCommissions - 0.6) <= NUMBER_EPSILON);
  assert.equal(holding.lots.length, 1);
  assert.equal(holding.lots[0].remainingShares, 3);
});

test('addTransaction rejects oversells by default and allows them only with skipSellCheck', () => {
  addTransaction(
    {
      symbol: 'OVR',
      type: 'buy',
      shares: 5,
      price: 100,
      total: 500,
      date: '2026-06-01',
      commission: 1,
    },
    'CS',
    'Oversell Inc',
  );

  assert.throws(
    () => addTransaction(
      {
        symbol: 'OVR',
        type: 'sell',
        shares: 8,
        price: 110,
        total: 880,
        date: '2026-06-02',
        commission: 2,
      },
      'CS',
      'Oversell Inc',
    ),
    /Cannot sell 8 shares of OVR: only 5 shares held/,
  );

  const skipped = addTransaction(
    {
      symbol: 'OVR',
      type: 'sell',
      shares: 8,
      price: 110,
      total: 880,
      date: '2026-06-02',
      commission: 2,
    },
    'CS',
    'Oversell Inc',
    { skipSellCheck: true },
  );

  assert.equal(skipped.costBasis, 500);
  assert.equal(skipped.realizedGain, 378);
  assert.equal(selectHolding('OVR'), undefined);
});

test('applySplit creates a split transaction, adjusts lots, and ignores duplicate splitApiId', () => {
  addTransaction(
    {
      symbol: 'SPLX',
      type: 'buy',
      shares: 10,
      price: 100,
      total: 1000,
      date: '2026-06-01',
      commission: 0,
    },
    'ETF',
    'Split Example',
  );

  applySplit('SPLX', 1, 2, '2026-06-02', 'split-dup-id');

  let holding = selectHolding('SPLX');
  assert.ok(holding);
  assert.equal(holding.totalShares, 20);
  assert.equal(holding.avgCost, 50);
  assert.equal(store$.portfolio.transactions.get().filter((tx: JsonTransaction) => tx.symbol === 'SPLX').length, 2);

  applySplit('SPLX', 1, 2, '2026-06-02', 'split-dup-id');

  holding = selectHolding('SPLX');
  assert.ok(holding);
  assert.equal(holding.totalShares, 20);
  assert.equal(store$.portfolio.transactions.get().filter((tx: JsonTransaction) => tx.symbol === 'SPLX').length, 2);
});

test('deleteTransaction removes the last remaining transaction and clears stale holdings', () => {
  addTransaction(
    {
      symbol: 'LAST',
      type: 'buy',
      shares: 3,
      price: 10,
      total: 30,
      date: '2026-06-01',
      commission: 0,
    },
    'CS',
    'Last Position',
  );

  const [onlyTransaction] = store$.portfolio.transactions.get();
  deleteTransaction(onlyTransaction.id);

  assert.deepEqual(store$.portfolio.transactions.get(), []);
  assert.deepEqual(store$.portfolio.holdings.get(), {});
});

test('selectors, market prices, and preferences work together', () => {
  store$.portfolio.transactions.set([
    makeTransaction({
      id: 'sort-2',
      symbol: 'BBB',
      type: 'buy',
      shares: 1,
      price: 20,
      total: 20,
      date: '2026-06-02',
      commission: 0,
      createdAt: '2026-06-02T11:00:00.000Z',
    }),
    makeTransaction({
      id: 'sort-1b',
      symbol: 'AAA',
      type: 'buy',
      shares: 1,
      price: 10,
      total: 10,
      date: '2026-06-01',
      commission: 0,
      createdAt: '2026-06-01T11:00:00.000Z',
    }),
    makeTransaction({
      id: 'sort-1a',
      symbol: 'AAA',
      type: 'buy',
      shares: 1,
      price: 9,
      total: 9,
      date: '2026-06-01',
      commission: 0,
      createdAt: '2026-06-01T09:00:00.000Z',
    }),
  ]);
  store$.portfolio.holdings.set({
    AAA: {
      id: 'holding-aaa',
      symbol: 'AAA',
      name: 'AAA Corp',
      assetType: 'CS',
      totalShares: 2,
      avgCost: 9.5,
      totalCommissions: 0,
      lots: [],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T09:00:00.000Z',
    },
    DUST: {
      id: 'holding-dust',
      symbol: 'DUST',
      name: 'Dust',
      assetType: 'CS',
      totalShares: 1e-12,
      avgCost: 1,
      totalCommissions: 0,
      lots: [],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T09:00:00.000Z',
    },
  });

  assert.deepEqual(selectTransactions().map((tx: JsonTransaction) => tx.id), ['sort-2', 'sort-1b', 'sort-1a']);
  assert.deepEqual(selectTransactionsBySymbol('AAA').map((tx: JsonTransaction) => tx.id), ['sort-1b', 'sort-1a']);
  assert.equal(selectHolding('AAA')?.symbol, 'AAA');
  assert.deepEqual(selectAllHoldings().map((holding: { symbol: string }) => holding.symbol), ['AAA']);

  updateMarketPrices([
    {
      symbol: 'AAA',
      price: 42,
      change: 1.5,
      changePercent: 3.7,
      updatedAt: '2026-06-03T00:00:00.000Z',
    },
  ]);
  assert.equal(selectMarketPrice('AAA')?.price, 42);

  updatePreferences({ defaultCurrency: 'EUR', gainView: 'total' });
  assert.equal(store$.preferences.defaultCurrency.get(), 'EUR');
  assert.equal(store$.preferences.gainView.get(), 'total');
  toggleShowPortfolioValue();
  assert.equal(store$.preferences.showPortfolioValue.get(), false);
});

test('deleteHolding removes one symbol without touching others and clearStore resets everything', () => {
  addTransaction(
    {
      symbol: 'AAA',
      type: 'buy',
      shares: 1,
      price: 10,
      total: 10,
      date: '2026-06-01',
      commission: 0,
    },
    'CS',
    'AAA Corp',
  );
  addTransaction(
    {
      symbol: 'BBB',
      type: 'buy',
      shares: 2,
      price: 20,
      total: 40,
      date: '2026-06-01',
      commission: 0,
    },
    'CS',
    'BBB Corp',
  );

  deleteHolding('AAA');

  assert.equal(selectHolding('AAA'), undefined);
  assert.equal(selectHolding('BBB')?.totalShares, 2);
  assert.deepEqual(store$.portfolio.transactions.get().map((tx: JsonTransaction) => tx.symbol), ['BBB']);

  clearStore();
  assertApproxDeepEqual(store$.get(), getInitialState(), 'clearStore');
});

test('reloadStoreFromStorage reloads persisted portfolio and preferences, and migrations upgrade old state', async () => {
  const storedState = getInitialState();
  storedState.portfolio.transactions = [
    makeTransaction({
      id: 'reload-buy-1',
      symbol: 'LOAD',
      type: 'buy',
      shares: 3,
      price: 25,
      total: 75,
      date: '2026-06-01',
      commission: 0.5,
      createdAt: '2026-06-01T09:00:00.000Z',
    }),
  ];
  storedState.portfolio.holdings = {
    LOAD: {
      id: 'reload-holding',
      symbol: 'LOAD',
      name: 'Reload Co',
      assetType: 'ETF',
      totalShares: 3,
      avgCost: 25,
      totalCommissions: 0.5,
      lots: [
        {
          id: 'reload-lot',
          transactionId: 'reload-buy-1',
          symbol: 'LOAD',
          shares: 3,
          purchasePrice: 25,
          purchaseDate: '2026-06-01',
          remainingShares: 3,
        },
      ],
      createdAt: '2026-06-01T09:00:00.000Z',
      updatedAt: '2026-06-01T09:00:00.000Z',
    },
  };
  storedState.preferences.defaultCurrency = 'GBP';
  await AsyncStorage.setItem('finance-app-store', JSON.stringify(storedState));

  clearStore();
  await reloadStoreFromStorage();

  assert.equal(selectHolding('LOAD')?.symbol, 'LOAD');
  assert.equal(store$.preferences.defaultCurrency.get(), 'GBP');

  const migrated = migrateState({
    ...getInitialState(),
    _schema: { version: 1 },
    portfolio: {
      holdings: {
        OLD: {
          id: 'old-holding',
          symbol: 'OLD',
          name: 'Old Co',
          assetType: 'CS',
          totalShares: 1,
          avgCost: 10,
          lots: [],
          createdAt: '2026-06-01T09:00:00.000Z',
          updatedAt: '2026-06-01T09:00:00.000Z',
        },
      },
      transactions: [],
    },
  });

  assert.equal(migrated._schema.version, CURRENT_SCHEMA_VERSION);
  assert.equal(migrated.portfolio.holdings.OLD.totalCommissions, 0);
});

test('validateTransactionDeletion and deleteTransaction handle missing ids safely', () => {
  assert.equal(validateTransactionDeletion('missing-id'), 'Transaction not found.');
  assert.doesNotThrow(() => deleteTransaction('missing-id'));
});

test('initializeStore is idempotent in the test runtime', async () => {
  await initializeStore();
  await initializeStore();
  assert.ok(true);
});

function readJsonFixture<T>(filename: string): T {
  const filePath = path.resolve(process.cwd(), 'tests', 'fixtures', filename);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function makeTransaction(overrides: Partial<JsonTransaction> & Pick<JsonTransaction, 'id' | 'symbol' | 'type' | 'shares' | 'price' | 'total' | 'date' | 'commission' | 'createdAt'>): JsonTransaction {
  return {
    updatedAt: overrides.createdAt,
    ...overrides,
  };
}

function seedTransactions(transactions: JsonTransaction[]) {
  clearStore();
  store$.portfolio.transactions.set(transactions);
}

function normalizeHoldings(): HoldingSnapshot[] {
  return Object.values(store$.portfolio.holdings.get())
    .filter(Boolean)
    .sort((a: any, b: any) => a.symbol.localeCompare(b.symbol))
    .map((holding: any) => ({
      symbol: holding.symbol,
      totalShares: holding.totalShares,
      avgCost: holding.avgCost,
      totalCommissions: holding.totalCommissions ?? 0,
      lots: [...holding.lots]
        .sort((a: any, b: any) => a.purchaseDate.localeCompare(b.purchaseDate) || a.transactionId.localeCompare(b.transactionId))
        .map((lot: any) => ({
          transactionId: lot.transactionId,
          shares: lot.shares,
          purchasePrice: lot.purchasePrice,
          purchaseDate: lot.purchaseDate,
          remainingShares: lot.remainingShares,
        })),
    }));
}

function normalizeTransactions(): TransactionSnapshot[] {
  return [...store$.portfolio.transactions.get()]
    .sort((a: any, b: any) =>
      a.date.localeCompare(b.date)
      || a.createdAt.localeCompare(b.createdAt)
      || a.id.localeCompare(b.id)
    )
    .map((tx: any) => ({
      id: tx.id,
      symbol: tx.symbol,
      type: tx.type,
      shares: tx.shares,
      price: tx.price,
      total: tx.total,
      date: tx.date,
      commission: tx.commission,
      costBasis: tx.costBasis ?? null,
      realizedGain: tx.realizedGain ?? null,
      realizedGainPercent: tx.realizedGainPercent ?? null,
      splitFrom: tx.splitFrom ?? null,
      splitTo: tx.splitTo ?? null,
    }));
}

function assertApproxDeepEqual(actual: unknown, expected: unknown, pathLabel: string) {
  if (typeof expected === 'number') {
    assert.equal(typeof actual, 'number', `${pathLabel} should be a number`);
    assert.ok(
      Math.abs((actual as number) - expected) <= NUMBER_EPSILON,
      `${pathLabel} expected ${expected} but received ${actual}`,
    );
    return;
  }

  if (expected === null || typeof expected !== 'object') {
    assert.deepEqual(actual, expected, pathLabel);
    return;
  }

  assert.ok(actual && typeof actual === 'object', `${pathLabel} should be an object`);

  if (Array.isArray(expected)) {
    assert.ok(Array.isArray(actual), `${pathLabel} should be an array`);
    assert.equal((actual as unknown[]).length, expected.length, `${pathLabel} length mismatch`);
    expected.forEach((value, index) => {
      assertApproxDeepEqual((actual as unknown[])[index], value, `${pathLabel}[${index}]`);
    });
    return;
  }

  const expectedObject = expected as Record<string, unknown>;
  const actualObject = actual as Record<string, unknown>;
  assert.deepEqual(
    Object.keys(actualObject).sort(),
    Object.keys(expectedObject).sort(),
    `${pathLabel} keys mismatch`,
  );

  for (const [key, value] of Object.entries(expectedObject)) {
    assertApproxDeepEqual(actualObject[key], value, `${pathLabel}.${key}`);
  }
}
