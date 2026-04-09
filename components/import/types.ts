import type { ImportedTxExtractionMode } from '@/lib/import/extraction-mode';

export type ImportStep = 'upload' | 'processing' | 'confirm';
export type TxType = 'buy' | 'sell';

export interface ImportedTx {
  id: string;
  date: string;
  quantity: string;
  price: string;
  commission: string;
  type: TxType;
  extractionMode?: ImportedTxExtractionMode;
  isDuplicate?: boolean;
  skipDuplicate?: boolean;
  consistencyError?: string;
  /** e.g. selling more than available at this date — shown as warning, does not block import */
  consistencyWarning?: string;
}

export interface ImportedGroup {
  id: string;
  symbol: string;
  name?: string;
  assetType?: string;
  symbolNotFound?: boolean;
  transactions: ImportedTx[];
}

export interface SplitPreviewImpact {
  symbol: string;
  splitCount: number;
  firstExecutionDate: string;
  lastExecutionDate: string;
}

export function groupError(g: ImportedGroup): string | null {
  if (!g.symbol.trim()) return 'Symbol is required';
  if (g.symbolNotFound) return 'Symbol not found';
  return null;
}

export function txError(tx: ImportedTx): string | null {
  if (tx.consistencyError) return tx.consistencyError;
  const dateStr = tx.date.trim();
  if (!dateStr) return 'Date is required';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 'Date must be YYYY-MM-DD';
  const [y, m, d] = dateStr.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  if (isNaN(parsed.getTime()) || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return 'Invalid date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (parsed > today) return 'Date cannot be in the future';
  if (!tx.quantity.trim() || parseFloat(tx.quantity) <= 0) return 'Quantity is required';
  if (!tx.price.trim()) return 'Price is required';
  const price = parseFloat(tx.price);
  if (Number.isNaN(price)) return 'Price is required';
  if (price <= 0) return 'Price must be more than zero';
  return null;
}

export function hasAnyError(g: ImportedGroup): boolean {
  return !!groupError(g) || g.transactions.some(t => !!txError(t));
}

export function txWarning(tx: ImportedTx): string | null {
  return tx.consistencyWarning ?? null;
}

export function hasAnyWarning(g: ImportedGroup): boolean {
  return g.transactions.some(t => !!txWarning(t));
}

/**
 * Simulate a chronological replay of all import transactions (combined with
 * existing store holdings) to detect sells that exceed available shares.
 * Those are set as consistencyWarning (warning only, import still allowed).
 * Returns updated groups with consistencyWarning set on those transactions.
 */
export function validateImportConsistency(
  groups: ImportedGroup[],
  existingHoldings: Record<string, number>,
): ImportedGroup[] {
  const allTxs: { groupId: string; txId: string; symbol: string; type: TxType; shares: number; date: string }[] = [];

  for (const g of groups) {
    if (!g.symbol.trim()) continue;
    for (const tx of g.transactions) {
      if (tx.isDuplicate && tx.skipDuplicate) continue;
      const qty = parseFloat(tx.quantity);
      if (isNaN(qty) || qty <= 0) continue;
      allTxs.push({
        groupId: g.id,
        txId: tx.id,
        symbol: g.symbol.toUpperCase(),
        type: tx.type,
        shares: qty,
        date: tx.date,
      });
    }
  }

  allTxs.sort((a, b) => a.date.localeCompare(b.date));

  const holdings = new Map<string, number>();
  for (const [sym, shares] of Object.entries(existingHoldings)) {
    holdings.set(sym.toUpperCase(), shares);
  }

  const warningMap = new Map<string, string>();

  for (const tx of allTxs) {
    const current = holdings.get(tx.symbol) ?? 0;
    if (tx.type === 'buy') {
      holdings.set(tx.symbol, current + tx.shares);
    } else {
      if (tx.shares > current + 1e-9) {
        const available = Math.max(0, current);
        const avail = available % 1 === 0 ? available.toString() : available.toFixed(6);
        warningMap.set(
          tx.txId,
          `Selling ${tx.shares} shares but only ${avail} available at this date`,
        );
        holdings.set(tx.symbol, 0);
      } else {
        holdings.set(tx.symbol, current - tx.shares);
      }
    }
  }

  // if (warningMap.size === 0) return groups;

  return groups.map(g => ({
    ...g,
    transactions: g.transactions.map(tx => ({
      ...tx,
      consistencyWarning: warningMap.get(tx.id) ?? undefined,
    })),
  }));
}
