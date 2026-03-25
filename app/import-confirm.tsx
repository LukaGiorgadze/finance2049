import { ConfirmStep } from '@/components/import/ConfirmStep';
import type { ImportedGroup, SplitPreviewImpact } from '@/components/import/types';
import { groupError, hasAnyError, txError, validateImportConsistency } from '@/components/import/types';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackImportAction, trackImportScreen } from '@/lib';
import { importSession } from '@/lib/import-session';
import { marketDataService } from '@/lib/services/marketDataService';
import type { StockSplit } from '@/lib/services/types';
import { addTransaction, selectAllHoldings, selectTransactions } from '@/lib/store';
import type { MarketPrice } from '@/lib/store/types';
import { mapApiTypeToAssetType } from '@/lib/utils/assetLookup';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ImportConfirmScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const session = importSession.get();
  const [groups, setGroupsRaw] = useState<ImportedGroup[]>(session?.groups ?? []);
  const [validating, setValidating] = useState(false);
  const [marketPrices, setMarketPrices] = useState<Record<string, MarketPrice>>({});
  const [splitPreviewImpacts, setSplitPreviewImpacts] = useState<Record<string, SplitPreviewImpact>>({});

  const bg = colors.surface;

  useEffect(() => {
    void trackImportScreen('confirm');
  }, []);

  const runConsistencyValidation = useCallback((grps: ImportedGroup[]): ImportedGroup[] => {
    const existingHoldings: Record<string, number> = {};
    for (const h of selectAllHoldings()) {
      existingHoldings[h.symbol] = h.totalShares;
    }
    return validateImportConsistency(grps, existingHoldings);
  }, []);

  const setGroups: typeof setGroupsRaw = useCallback((action) => {
    setGroupsRaw(prev => {
      const next = typeof action === 'function' ? action(prev) : action;
      return runConsistencyValidation(next);
    });
  }, [runConsistencyValidation]);

  const hasErrors = groups.some(g => hasAnyError(g));
  const validTxCount = groups
    .filter(g => !groupError(g))
    .reduce((sum, g) => sum + g.transactions.filter(t => !txError(t) && !(t.isDuplicate && t.skipDuplicate)).length, 0);

  useEffect(() => {
    const symbolsToValidate = [...new Set(
      groups.filter(g => g.symbol.trim()).map(g => g.symbol.toUpperCase())
    )];
    if (symbolsToValidate.length === 0) {
      setMarketPrices({});
      return;
    }

    let cancelled = false;
    setValidating(true);

    Promise.all([
      marketDataService.getQuotes(symbolsToValidate),
      Promise.all(symbolsToValidate.map(s =>
        marketDataService.getTickerDetails(s).catch(() => null)
      )),
    ]).then(([quotes, detailsResults]) => {
      if (cancelled) return;
      const foundMap = new Map(quotes.map(q => [q.symbol.toUpperCase(), q]));
      const canDetect = symbolsToValidate.length > 1 || quotes.length > 0;

      const priceMap: Record<string, MarketPrice> = {};
      quotes.forEach(q => {
        if (typeof q.price !== 'number' || Number.isNaN(q.price)) return;
        const key = q.symbol.toUpperCase();
        priceMap[key] = {
          symbol: key,
          price: q.price,
          change: q.change,
          changePercent: q.changePercent,
          updatedAt: q.updatedAt,
        };
      });
      setMarketPrices(priceMap);

      const nameMap = new Map<string, string>();
      const typeMap = new Map<string, string>();
      symbolsToValidate.forEach((sym, i) => {
        const details = detailsResults[i];
        if (details?.name) nameMap.set(sym.toUpperCase(), details.name);
        if (details) typeMap.set(sym.toUpperCase(), mapApiTypeToAssetType(details.type));
      });

      setGroups(prev => prev.map(g => {
        if (!g.symbol.trim()) return g;
        const upper = g.symbol.toUpperCase();
        return {
          ...g,
          name: nameMap.get(upper) ?? foundMap.get(upper)?.name ?? g.name,
          assetType: typeMap.get(upper) ?? g.assetType,
          symbolNotFound: canDetect ? !foundMap.has(upper) : false,
        };
      }));
    }).catch(() => {
      if (cancelled) return;
      if (symbolsToValidate.length === 1) {
        setGroups(prev => prev.map(g =>
          g.symbol.toUpperCase() === symbolsToValidate[0] ? { ...g, symbolNotFound: true } : g
        ));
      }
    }).finally(() => {
      if (!cancelled) setValidating(false);
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitPreviewKey = groups
    .map(g => {
      const upper = g.symbol.trim().toUpperCase();
      const dates = g.transactions.map(t => t.date.trim()).filter(Boolean).sort();
      return `${upper}:${dates[0] ?? ''}:${dates[dates.length - 1] ?? ''}`;
    })
    .sort()
    .join('|');

  useEffect(() => {
    const targets = groups
      .map(g => ({
        symbol: g.symbol.trim().toUpperCase(),
        earliestDate: g.transactions
          .map(t => t.date.trim())
          .filter(Boolean)
          .sort()[0] ?? '',
      }))
      .filter((target, index, arr) =>
        !!target.symbol &&
        !!target.earliestDate &&
        arr.findIndex(other => other.symbol === target.symbol) === index
      );

    if (targets.length === 0) {
      setSplitPreviewImpacts({});
      return;
    }

    let cancelled = false;

    Promise.all(
      targets.map(async ({ symbol, earliestDate }) => {
        const splits = await marketDataService
          .getStockSplits(symbol)
          .catch((): StockSplit[] => []);
        const applicable = splits
          .filter(split => split.executionDate > earliestDate)
          .sort((a, b) => a.executionDate.localeCompare(b.executionDate));

        if (applicable.length === 0) return null;

        return {
          symbol,
          splitCount: applicable.length,
          firstExecutionDate: applicable[0].executionDate,
          lastExecutionDate: applicable[applicable.length - 1].executionDate,
        } satisfies SplitPreviewImpact;
      }),
    ).then(results => {
      if (cancelled) return;
      const next: Record<string, SplitPreviewImpact> = {};
      for (const result of results) {
        if (!result) continue;
        next[result.symbol] = result;
      }
      setSplitPreviewImpacts(next);
    });

    return () => {
      cancelled = true;
    };
  }, [groups, splitPreviewKey]);

  useEffect(() => {
    const existing = selectTransactions();
    if (existing.length === 0) return;

    // Relative float comparison — tolerates AI rounding (1% threshold)
    const closeEnough = (a: number, b: number) => {
      if (a === b) return true;
      const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
      return Math.abs(a - b) / denom < 0.01;
    };

    // Normalize date to YYYY-MM-DD regardless of input format
    const normalizeDate = (d: string) => {
      if (!d) return '';
      // Already YYYY-MM-DD — fast path
      if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return d.trim();
      // Use UTC to avoid timezone shifts
      const y = parsed.getUTCFullYear();
      const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
      const day = String(parsed.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };

    setGroups(prev => prev.map(g => ({
      ...g,
      transactions: g.transactions.map(tx => {
        const qty = parseFloat(tx.quantity);
        const prc = parseFloat(tx.price);
        const txDate = normalizeDate(tx.date);
        const dup = existing.some(e =>
          e.symbol.toUpperCase() === g.symbol.toUpperCase() &&
          normalizeDate(e.date) === txDate &&
          closeEnough(e.shares, qty) &&
          closeEnough(e.price, prc)
        );
        return dup ? { ...tx, isDuplicate: true, skipDuplicate: true } : tx;
      }),
    })));
   
  }, []);

  useEffect(() => {
    setGroups(prev => prev);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = () => {
    if (hasErrors) {
      const errLines = groups
        .filter(g => hasAnyError(g))
        .map(g => {
          const ge = groupError(g);
          if (ge) return `${g.symbol || 'Unknown'}: ${ge}`;
          const txErrors = g.transactions.filter(t => txError(t));
          const consistencyCount = txErrors.filter(t => t.consistencyError).length;
          const fieldCount = txErrors.length - consistencyCount;
          const parts: string[] = [];
          if (consistencyCount > 0) parts.push(`${consistencyCount} sell${consistencyCount !== 1 ? 's' : ''} exceed available shares`);
          if (fieldCount > 0) parts.push(`${fieldCount} transaction${fieldCount !== 1 ? 's' : ''} with missing fields`);
          return `${g.symbol}: ${parts.join(', ')}`;
        })
        .join('\n');
      Alert.alert('Fix errors before importing', errLines);
      return;
    }

    // Collect all valid transactions into a single list and sort by date
    // to ensure holdings are constructed chronologically (Buys before Sells)
    const allImportedTx: { symbol: string; name?: string; assetType: string; tx: any }[] = [];
    for (const group of groups) {
      for (const tx of group.transactions) {
        if (tx.isDuplicate && tx.skipDuplicate) continue;
        allImportedTx.push({
          symbol: group.symbol,
          name: group.name,
          assetType: group.assetType ?? 'CS',
          tx,
        });
      }
    }

    allImportedTx.sort((a, b) => a.tx.date.localeCompare(b.tx.date));

    for (const item of allImportedTx) {
      const shares = parseFloat(item.tx.quantity);
      const price = parseFloat(item.tx.price);
      const commission = parseFloat(item.tx.commission) || 0;
      try {
        addTransaction(
          {
            symbol: item.symbol,
            type: item.tx.type,
            shares,
            price,
            total: shares * price,
            date: item.tx.date,
            commission,
          },
          item.assetType as any,
          item.name,
          { skipSellCheck: true },
        );
      } catch (e) {
        Alert.alert(
          'Import Error',
          `${item.symbol} ${item.tx.type} ${item.tx.date}: ${e instanceof Error ? e.message : 'Unknown error'}`,
        );
        return;
      }
    }

    void trackImportAction({ action: 'upload_success', step: 'confirm', count: allImportedTx.length });
    importSession.clear();
    router.dismissAll();
    router.replace('/(tabs)');
  };

  return (
    <View style={[s.page, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <PageHeader
        title="Review & Import"
        leftElement={
          <TouchableOpacity
            onPress={() => {
              void trackImportAction({ action: 'back', step: 'confirm' });
              router.back();
            }}
            style={[s.backBtn, { backgroundColor: isDark ? colors.cardBackground : colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} style={{ opacity: 0.7 }} />
          </TouchableOpacity>
        }
      />

      <ConfirmStep
        groups={groups}
        setGroups={setGroups}
        validating={validating}
        hasErrors={hasErrors}
        validTxCount={validTxCount}
        onImport={handleImport}
        isDark={isDark}
        colors={colors}
        insets={insets}
        bg={bg}
        files={session?.files ?? []}
        failedFiles={session?.failedFiles ?? []}
        marketPrices={marketPrices}
        splitPreviewImpacts={splitPreviewImpacts}
      />
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
