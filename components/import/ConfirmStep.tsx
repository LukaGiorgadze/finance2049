import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { formatCurrency, trackImportAction } from '@/lib';
import type { FailedFileInfo, ImportFileInfo } from '@/lib/import-session';
import type { TickerSearchResult } from '@/lib/services/types';
import type { Holding, MarketPrice } from '@/lib/store/types';
import { calculatePortfolioTotals, formatDate } from '@/lib/utils/calculations';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { EdgeInsets } from 'react-native-safe-area-context';
import { PulseDots } from './PulseDots';
import { groupError, hasAnyError, hasAnyWarning, ImportedGroup, ImportedTx, SplitPreviewImpact, txError, TxType } from './types';

function groupsToHoldings(groups: ImportedGroup[]): Holding[] {
  return groups.map(group => {
    let shares = 0;
    let costBasis = 0;
    let totalCommissions = 0;

    const sorted = [...group.transactions].sort(
      (a, b) => a.date.localeCompare(b.date),
    );

    for (const tx of sorted) {
      const qty = parseFloat(tx.quantity) || 0;
      const price = parseFloat(tx.price) || 0;
      const commission = parseFloat(tx.commission) || 0;
      totalCommissions += commission;

      if (tx.type === 'buy') {
        costBasis += qty * price;
        shares += qty;
      } else {
        if (shares !== 0) {
          costBasis -= qty * (costBasis / shares);
        }
        shares -= qty;
      }
    }

    const avgCost = shares !== 0 ? costBasis / shares : 0;

    return {
      id: group.id,
      symbol: group.symbol.toUpperCase(),
      name: group.name ?? '',
      assetType: group.assetType ?? 'stock',
      totalShares: shares,
      avgCost,
      totalCommissions,
      lots: [],
      createdAt: '',
      updatedAt: '',
    } satisfies Holding;
  }).filter(h => h.totalShares !== 0);
}

export function fileIconForMime(name: string, mimeType: string): { icon: string; color: string } {
  const lower = name.toLowerCase();
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf'))
    return { icon: 'document-text-outline', color: Colors.light.red };
  if (mimeType === 'text/csv' || lower.endsWith('.csv'))
    return { icon: 'grid-outline', color: Colors.light.green };
  if (mimeType === 'application/json' || lower.endsWith('.json'))
    return { icon: 'code-slash-outline', color: Colors.light.orange };
  if (mimeType.includes('spreadsheet') || lower.endsWith('.xls') || lower.endsWith('.xlsx'))
    return { icon: 'grid-outline', color: Colors.light.blue };
  if (mimeType.startsWith('image/'))
    return { icon: 'image-outline', color: Colors.indigo };
  return { icon: 'document-outline', color: Colors.indigo };
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function ImportSummaryCard({
  groups, validating, files, isDark, colors, marketPrices, splitPreviewImpacts,
}: {
  groups: ImportedGroup[];
  validating: boolean;
  files: ImportFileInfo[];
  isDark: boolean;
  colors: typeof Colors.light;
  marketPrices: Record<string, MarketPrice>;
  splitPreviewImpacts: Record<string, SplitPreviewImpact>;
}) {
  const [filesExpanded, setFilesExpanded] = useState(false);
  const txCount = groups.reduce((s, g) => s + g.transactions.length, 0);
  const { totalValue } = calculatePortfolioTotals(groupsToHoldings(groups), marketPrices);
  const impactedCount = Object.keys(splitPreviewImpacts).length;

  return (
    <View style={[cs.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      {files.length > 0 ? (
        <>
          <TouchableOpacity
            style={[cs.fileRow, { borderBottomColor: colors.cardBorder }]}
            onPress={() => {
              void trackImportAction({ action: 'review_expand_files', step: 'confirm', target: filesExpanded ? 'collapse' : 'expand' });
              setFilesExpanded(v => !v);
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="documents-outline" size={12} color={colors.icon} />
            <Text style={[cs.fileName, { color: colors.icon }]}>
              {files.length} File{files.length !== 1 ? 's' : ''}
            </Text>
            <Ionicons
              name={filesExpanded ? 'chevron-up' : 'chevron-down'}
              size={12}
              color={colors.icon}
            />
          </TouchableOpacity>
          {filesExpanded && (
            <View style={[cs.fileList, { borderBottomColor: colors.cardBorder }]}>
              {files.map((f, i) => {
                const fi = fileIconForMime(f.name, f.mimeType);
                return (
                  <View key={`${f.name}-${i}`} style={cs.fileItem}>
                    <View style={[cs.fileIconWrap, { backgroundColor: fi.color + '18' }]}>
                      <Ionicons name={fi.icon as any} size={14} color={fi.color} />
                    </View>
                    <View style={cs.fileItemText}>
                      <Text style={[cs.fileItemName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                        {f.name}
                      </Text>
                      <Text style={[cs.fileItemMeta, { color: colors.icon }]}>
                        {fileExtension(f.name).toUpperCase().replace('.', '') || 'File'}  ·  {formatFileSize(f.sizeBytes)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </>
      ) : null}
      <View style={cs.body}>
        <Text style={[cs.value, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {formatCurrency(totalValue, 'never')}
        </Text>
        <View style={cs.metaRow}>
          {validating ? (
            <>
              <PulseDots mini />
              <Text style={[cs.metaText, { color: colors.icon }]}>Validating tickers…</Text>
            </>
          ) : (
            <Text style={[cs.metaText, { color: colors.icon }]}>
              {txCount} transaction{txCount !== 1 ? 's' : ''} · {groups.length} ticker{groups.length !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
        {impactedCount > 0 && (
          <View style={[
            cs.infoRow,
            {
              backgroundColor: isDark ? colors.warningBannerDark : colors.warningBannerLight,
              borderColor: colors.warning + '35',
            },
          ]}>
            <Ionicons name="information-circle-outline" size={13} color={colors.warningIcon} />
            <Text style={[cs.infoText, { color: colors.warningIcon }]}>
              Preview uses imported values. Historical splits will be applied after import for {impactedCount} ticker{impactedCount !== 1 ? 's' : ''}.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function FailedFilesBanner({
  failedFiles, colors,
}: {
  failedFiles: FailedFileInfo[];
  colors: typeof Colors.light;
}) {
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (failedFiles.length === 0 || dismissed) return null;

  return (
    <View style={[fb.container, { backgroundColor: colors.errorBg, borderColor: colors.error + '30' }]}>
      <TouchableOpacity
        style={fb.header}
        onPress={() => {
          void trackImportAction({ action: 'review_toggle_failed_files', step: 'confirm', target: expanded ? 'collapse' : 'expand' });
          setExpanded(v => !v);
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="alert-circle-outline" size={14} color={colors.error} />
        <Text style={[fb.title, { color: colors.error }]}>
          {failedFiles.length} file{failedFiles.length !== 1 ? 's' : ''} couldn&apos;t be read
        </Text>
        <TouchableOpacity
          onPress={() => {
            void trackImportAction({ action: 'review_dismiss_failed_files', step: 'confirm', count: failedFiles.length });
            setDismissed(true);
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close" size={14} color={colors.error} style={{ opacity: 0.6 }} />
        </TouchableOpacity>
      </TouchableOpacity>
      {expanded && (
        <ScrollView
          style={fb.listScroll}
          contentContainerStyle={fb.list}
          nestedScrollEnabled
          showsVerticalScrollIndicator
        >
          {failedFiles.map((f, i) => {
            const fi = fileIconForMime(f.name, f.mimeType);
            return (
              <View key={`${f.name}-${i}`} style={fb.item}>
                <Ionicons name={fi.icon as any} size={12} color={colors.icon} style={fb.itemIcon} />
                <View style={fb.itemContent}>
                  <Text style={[fb.fileName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                    {f.name}
                  </Text>
                  <Text style={[fb.errorMsg, { color: colors.icon }]}>
                    {f.error}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const fb = StyleSheet.create({
  container: {
    marginHorizontal: 16, marginBottom: 8,
    borderRadius: 12, borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  title: { fontSize: 12, fontWeight: '600', flex: 1 },
  listScroll: { maxHeight: 300 },
  list: { paddingHorizontal: 12, paddingBottom: 10, gap: 8 },
  item: { flexDirection: 'row', gap: 6 },
  itemIcon: { marginTop: 2 },
  itemContent: { flex: 1 },
  fileName: { fontSize: 12, fontWeight: '500' },
  errorMsg: { fontSize: 11, marginTop: 2, lineHeight: 15 },
});

function Field({ label, children, flex, error, colors }: { label: string; children: React.ReactNode; flex: number; error?: boolean; colors: typeof Colors.light }) {
  return (
    <View style={{ flex }}>
      <Text style={[s.fieldLabel, { color: colors.icon }, error && { color: colors.error }]}>{label}</Text>
      {children}
    </View>
  );
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function summarizeMeta(txs: ImportedTx[]): string {
  const buys = txs.filter(t => t.type === 'buy').length;
  const sells = txs.filter(t => t.type === 'sell').length;
  const typeStr = buys > 0 && sells > 0
    ? `${buys} buy${buys !== 1 ? 's' : ''} · ${sells} sell${sells !== 1 ? 's' : ''}`
    : buys > 0 ? (buys === 1 ? '1 buy' : `${buys} buys`)
      : (sells === 1 ? '1 sell' : `${sells} sells`);

  const dates = txs.map(t => t.date).filter(Boolean).sort();
  const dateStr = dates.length === 0 ? '—'
    : dates[0] === dates[dates.length - 1] ? formatDate(dates[0])
      : `${formatDate(dates[0])}  –  ${formatDate(dates[dates.length - 1])}`;

  return `${typeStr}  ·  ${dateStr}`;
}

function TxSubRow({
  tx, onChange, onDelete, isDark, colors,
}: {
  tx: ImportedTx;
  onChange: (t: ImportedTx) => void;
  onDelete?: () => void;
  isDark: boolean;
  colors: typeof Colors.light;
}) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const inputBg = isDark ? colors.cardBorder : colors.cardBackground;
  const parsedDate = tx.date ? parseLocalDate(tx.date) : new Date();
  const isSkipped = tx.isDuplicate && tx.skipDuplicate;
  const errorMessage = txError(tx);

  return (
    <View style={[s.subRow, { backgroundColor: colors.rowSurface, opacity: isSkipped ? 0.5 : 1 }]}>
      {/* Consistency error banner */}
      {!!tx.consistencyError && (
        <View style={[s.dupRow, { backgroundColor: colors.errorBg, borderRadius: 6, padding: 6, gap: 5 }]}>
          <Ionicons name="alert-circle" size={12} color={colors.error} />
          <Text style={[s.dupLabel, { color: colors.error, flex: 1 }]}>{tx.consistencyError}</Text>
        </View>
      )}
      {/* Consistency warning banner (e.g. selling more than available at date — import still allowed) */}
      {!!tx.consistencyWarning && (
        <View style={[s.dupRow, { backgroundColor: isDark ? colors.warningBannerDark : colors.warningBannerLight, borderRadius: 6, padding: 6, gap: 5 }]}>
          <Ionicons name="warning" size={12} color={colors.warningIcon} />
          <Text style={[s.dupLabel, { color: colors.warningIcon, flex: 1 }]}>{tx.consistencyWarning}</Text>
        </View>
      )}
      {/* Duplicate inline row */}
      {tx.isDuplicate && (
        <View style={s.dupRow}>
          <Ionicons name="warning" size={11} color={colors.warningIcon} />
          <Text style={[s.dupLabel, { color: colors.warningIcon }]}>Transaction already exists</Text>
          <View style={[s.dupPills, { backgroundColor: colors.cardBorder }]}>
            <TouchableOpacity
              style={[s.dupPill, tx.skipDuplicate && { backgroundColor: colors.redBg }]}
              onPress={() => onChange({ ...tx, skipDuplicate: true })}
              activeOpacity={0.8}
            >
              <Text style={[s.dupPillText, { color: tx.skipDuplicate ? colors.error : colors.icon }]}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.dupPill, !tx.skipDuplicate && { backgroundColor: colors.greenBg }]}
              onPress={() => onChange({ ...tx, skipDuplicate: false })}
              activeOpacity={0.8}
            >
              <Text style={[s.dupPillText, { color: !tx.skipDuplicate ? colors.green : colors.icon }]}>Add Anyway</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
      {/* Buy/Sell toggle + delete */}
      <View style={s.subRowHead}>
        <View style={[s.typeRow, { backgroundColor: colors.cardBorder }]}>
          {(['buy', 'sell'] as TxType[]).map(tp => (
            <TouchableOpacity
              key={tp}
              style={[s.typeBtn, tx.type === tp && { backgroundColor: tp === 'buy' ? colors.green : colors.error }]}
              onPress={() => {
                void trackImportAction({ action: 'review_change_tx_type', step: 'confirm', target: tp });
                onChange({ ...tx, type: tp });
              }}
              activeOpacity={0.8}
            >
              <Text style={[s.typeBtnText, { color: tx.type === tp ? colors.textOnColor : colors.icon }]}>
                {tp === 'buy' ? 'Buy' : 'Sell'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {onDelete && (
          <TouchableOpacity onPress={() => {
            void trackImportAction({ action: 'review_remove_tx', step: 'confirm', target: tx.id });
            onDelete();
          }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="trash-outline" size={14} color={colors.error} />
          </TouchableOpacity>
        )}
      </View>

      {/* Date + Quantity */}
      <View style={s.fieldRow}>
        <Field label="Date *" flex={1} error={!tx.date.trim() || !!errorMessage?.startsWith('Date')} colors={colors}>
          <TouchableOpacity
            style={[s.input, { backgroundColor: inputBg, justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.7}
          >
            <Text style={{ color: tx.date ? colors.text : colors.icon, fontSize: 14 }}>
              {tx.date || 'YYYY-MM-DD'}
            </Text>
          </TouchableOpacity>
        </Field>
        <View style={{ width: 8 }} />
        <Field label="Quantity *" flex={1} error={!tx.quantity.trim() || !!errorMessage?.startsWith('Quantity')} colors={colors}>
          <TextInput
            style={[s.input, { backgroundColor: inputBg, color: colors.text }]}
            value={tx.quantity}
            onChangeText={v => onChange({ ...tx, quantity: v })}
            placeholder="Shares"
            placeholderTextColor={colors.icon}
            keyboardType="decimal-pad"
          />
        </Field>
      </View>

      {/* Price + Commission */}
      <View style={s.fieldRow}>
        <Field label="Price *" flex={1} error={!tx.price.trim() || !!errorMessage?.startsWith('Price')} colors={colors}>
          <TextInput
            style={[s.input, { backgroundColor: inputBg, color: colors.text }]}
            value={tx.price}
            onChangeText={v => onChange({ ...tx, price: v })}
            placeholder="Per share"
            placeholderTextColor={colors.icon}
            keyboardType="decimal-pad"
          />
        </Field>
        <View style={{ width: 8 }} />
        <Field label="Commission" flex={1} colors={colors}>
          <TextInput
            style={[s.input, { backgroundColor: inputBg, color: colors.text }]}
            value={tx.commission}
            onChangeText={v => onChange({ ...tx, commission: v })}
            placeholder="Optional"
            placeholderTextColor={colors.icon}
            keyboardType="decimal-pad"
          />
        </Field>
      </View>

      {/* Android date picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={parsedDate}
          mode="date"
          display="spinner"
          onChange={(_, d) => { setShowDatePicker(false); if (d) onChange({ ...tx, date: fmtDate(d) }); }}
        />
      )}

      {/* iOS date picker */}
      {Platform.OS === 'ios' && (
        <Modal visible={showDatePicker} transparent animationType="none">
          <Pressable style={[s.dateOverlay, { backgroundColor: colors.overlay }]} onPress={() => setShowDatePicker(false)}>
            <Pressable style={[s.dateSheet, { backgroundColor: colors.cardBackground }]} onPress={e => e.stopPropagation()}>
              <View style={s.dateSheetHeader}>
                <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                  <Text style={[s.dateSheetDone, { color: colors.blue }]}>Done</Text>
                </TouchableOpacity>
              </View>
              <View style={{ alignItems: 'center' }}>
                <DateTimePicker
                  value={parsedDate}
                  mode="date"
                  display="spinner"
                  onChange={(_, d) => { if (d) onChange({ ...tx, date: fmtDate(d) }); }}
                  themeVariant={isDark ? 'dark' : 'light'}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

function GroupRow({
  group, onChange, onDelete, isDark, colors, splitPreviewImpact,
}: {
  group: ImportedGroup;
  onChange: (g: ImportedGroup) => void;
  onDelete: () => void;
  isDark: boolean;
  colors: typeof Colors.light;
  splitPreviewImpact?: SplitPreviewImpact;
}) {
  const [open, setOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const gErr = groupError(group);
  const anyErr = hasAnyError(group);
  const anyWarn = hasAnyWarning(group);
  const hasDuplicates = group.transactions.some(t => t.isDuplicate);
  const inputBg = colors.surface;

  const hasBrandColor = !!BRAND_COLORS[group.symbol];
  const brandColor = group.symbol
    ? (BRAND_COLORS[group.symbol] || colors.surface)
    : colors.errorBg;
  const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;

  const updateTx = (updated: ImportedTx) =>
    onChange({ ...group, transactions: group.transactions.map(t => t.id === updated.id ? updated : t) });

  const removeTx = (id: string) =>
    onChange({ ...group, transactions: group.transactions.filter(t => t.id !== id) });

  return (
    <View style={[s.row, {
      backgroundColor: colors.cardBackground,
      borderColor: anyErr ? colors.error : hasDuplicates || anyWarn ? colors.warning : 'transparent',
    }]}>
      <View style={[s.errorBar, { backgroundColor: anyErr ? colors.error : hasDuplicates || anyWarn ? colors.warning : 'transparent' }]} />

      <TouchableOpacity style={s.rowHead} onPress={() => {
        void trackImportAction({ action: 'review_toggle_group', step: 'confirm', target: open ? `collapse:${group.symbol}` : `expand:${group.symbol}` });
        setOpen(o => !o);
      }} activeOpacity={0.7}>
      
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <View style={[s.symbolBadge, { backgroundColor: brandColor }]}>
              <Text style={[s.symbolBadgeText, { color: group.symbol ? badgeTextColor : colors.error }]}>
                {group.symbol || '?'}
              </Text>
            </View>
            {group.name ? (
              <Text style={[s.rowName, { color: gErr ? colors.error : colors.text, flex: 1 }]} numberOfLines={1}>
                {group.name}
              </Text>
            ) : null}
          </View>
          <Text style={[s.rowMeta, { color: colors.icon }]} numberOfLines={1}>
            {summarizeMeta(group.transactions)}
          </Text>
          {!!splitPreviewImpact && (
            <View style={s.rowInfoWrap}>
              <Ionicons name="information-circle-outline" size={12} color={colors.warningIcon} />
              <Text style={[s.rowInfoText, { color: colors.warningIcon }]} numberOfLines={2}>
                {splitPreviewImpact.splitCount === 1
                  ? `1 historical split after ${formatDate(splitPreviewImpact.firstExecutionDate)}`
                  : `${splitPreviewImpact.splitCount} historical splits after ${formatDate(splitPreviewImpact.firstExecutionDate)}`}
              </Text>
            </View>
          )}
        </View>
        <View style={[s.txCountBadge, { backgroundColor: colors.cardBorder }]}>
          <Text style={[s.txCountText, { color: colors.icon }]}>{group.transactions.length}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={15} color={colors.icon} style={{ marginLeft: 6 }} />
      </TouchableOpacity>

      {open && (
        <View style={s.editArea}>
          <Field label="Symbol *" flex={1} error={!!gErr} colors={colors}>
            <TouchableOpacity
              style={[s.input, { backgroundColor: inputBg, flexDirection: 'row', alignItems: 'center' }]}
              onPress={() => {
                void trackImportAction({ action: 'review_open_symbol_search', step: 'confirm', target: group.symbol });
                setShowSearch(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={{ color: group.symbol ? colors.text : colors.icon, fontSize: 14, flex: 1 }} numberOfLines={1}>
                {group.symbol || 'Search symbol…'}
              </Text>
              <Ionicons name="search" size={13} color={colors.icon} />
            </TouchableOpacity>
          </Field>

          {group.transactions.map((tx, i) => (
            <React.Fragment key={tx.id}>
              {i > 0 && <View style={[s.subDivider, { backgroundColor: colors.cardBorder }]} />}
              <TxSubRow
                tx={tx}
                onChange={updateTx}
                onDelete={group.transactions.length > 1 ? () => removeTx(tx.id) : undefined}
                isDark={isDark}
                colors={colors}
              />
            </React.Fragment>
          ))}

          <TouchableOpacity style={s.removeBtn} onPress={() => {
            void trackImportAction({ action: 'review_remove_group', step: 'confirm', target: group.symbol });
            onDelete();
          }}>
            <Ionicons name="trash-outline" size={13} color={colors.error} />
            <Text style={[s.removeBtnText, { color: colors.error }]}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      <AssetSearchModal
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onSelectAsset={(asset: TickerSearchResult) => {
          void trackImportAction({ action: 'review_select_symbol', step: 'confirm', target: asset.symbol });
          onChange({ ...group, symbol: asset.symbol, name: asset.name, symbolNotFound: false });
          setShowSearch(false);
        }}
        analyticsContext="import_confirm_group"
      />
    </View>
  );
}

interface ConfirmStepProps {
  groups: ImportedGroup[];
  setGroups: React.Dispatch<React.SetStateAction<ImportedGroup[]>>;
  validating: boolean;
  hasErrors: boolean;
  validTxCount: number;
  onImport: () => void;
  isDark: boolean;
  colors: typeof Colors.light;
  insets: EdgeInsets;
  bg: string;
  files: ImportFileInfo[];
  failedFiles: FailedFileInfo[];
  marketPrices: Record<string, MarketPrice>;
  splitPreviewImpacts: Record<string, SplitPreviewImpact>;
}

export function ConfirmStep({
  groups, setGroups, validating, hasErrors, validTxCount, onImport, isDark, colors, insets, bg, files, failedFiles, marketPrices, splitPreviewImpacts,
}: ConfirmStepProps) {
  // Count only transactions that will be imported (valid, not skipped as duplicates)
  const toImportCount = groups
    .filter(g => !groupError(g))
    .reduce(
      (sum, g) =>
        sum +
        g.transactions.filter(t => !txError(t) && !(t.isDuplicate && t.skipDuplicate)).length,
      0,
    );

  return (
    <>
      {/* Summary card */}
      <View style={s.summaryWrap}>
        <ImportSummaryCard
          groups={groups}
          validating={validating}
          files={files}
          isDark={isDark}
          colors={colors}
          marketPrices={marketPrices}
          splitPreviewImpacts={splitPreviewImpacts}
        />
      </View>

      {/* Failed files banner */}
      <FailedFilesBanner failedFiles={failedFiles} colors={colors} />

      {/* Group list */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        {groups.map(g => (
          <GroupRow
            key={g.id}
            group={g}
            onChange={updated => setGroups(prev => prev.map(x => x.id === updated.id ? updated : x))}
            onDelete={() => setGroups(prev => prev.filter(x => x.id !== g.id))}
            isDark={isDark}
            colors={colors}
            splitPreviewImpact={splitPreviewImpacts[g.symbol.toUpperCase()]}
          />
        ))}
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, {
        backgroundColor: bg,
        paddingBottom: insets.bottom + 12,
        borderTopColor: colors.footerBorder,
      }]}>
        <View style={s.footerHintRow}>
          {toImportCount === 0 && groups.length > 0 && (
            <>
              <Ionicons name="information-circle-outline" size={12} color={colors.icon} />
              <Text style={[s.footerErrText, { color: colors.icon }]}>
                No transactions to import — fix errors or unskip duplicates
              </Text>
            </>
          )}
          {hasErrors && toImportCount > 0 && (
            <>
              <Ionicons name="alert-circle" size={12} color={colors.error} />
              <Text style={[s.footerErrText, { color: colors.error }]}>
                {groups.filter(g => hasAnyError(g)).length} row{groups.filter(g => hasAnyError(g)).length !== 1 ? 's' : ''} need fixing — tap to edit
              </Text>
            </>
          )}
        </View>
        <TouchableOpacity
          style={[s.importBtn, { opacity: groups.length === 0 || validating || hasErrors || toImportCount === 0 ? 0.45 : 1 }]}
          onPress={() => {
            if (validating) {
              alert('Please wait until ticker validation finishes.');
              return;
            }
            if (toImportCount === 0) return;
            void trackImportAction({ action: 'review_import', step: 'confirm', count: toImportCount });
            onImport();
          }}
          disabled={groups.length === 0 || toImportCount === 0}
          activeOpacity={0.85}
        >
          <Ionicons name="sparkles" size={15} color={colors.textOnColor} style={{ marginRight: 7 }} />
          <Text style={[s.importBtnText, { color: colors.textOnColor }]}>
            {toImportCount === 0
              ? 'No transactions to import'
              : `Import ${toImportCount} Transaction${toImportCount !== 1 ? 's' : ''}`}
          </Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const cs = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  fileRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fileName: { fontSize: 13, fontWeight: '600', flex: 1 },
  fileList: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  fileItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fileIconWrap: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  fileItemText: { flex: 1 },
  fileItemName: { fontSize: 13, fontWeight: '500' },
  fileItemMeta: { fontSize: 11, marginTop: 1 },
  body: { paddingVertical: 18, paddingHorizontal: 20 },
  value: { fontSize: 26, fontWeight: '700', letterSpacing: -0.5, marginBottom: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 20 },
  metaText: { fontSize: 13, fontWeight: '400' },
  infoRow: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '500' },
});

const s = StyleSheet.create({
  summaryWrap: { paddingTop: 12, paddingBottom: 10 },

  // Group list
  listContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },

  // Group row
  row: { borderRadius: 14, borderWidth: 1, overflow: 'hidden' },
  errorBar: { height: 3 },
  rowHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 14, gap: 10 },
  symbolBadge: { paddingHorizontal: 5, paddingVertical: 3, borderRadius: 5, minWidth: 38, alignItems: 'center', justifyContent: 'center' },
  symbolBadgeText: { fontSize: 9, fontWeight: '700', letterSpacing: 0.3 },
  rowName: { fontSize: 14, fontWeight: '500', letterSpacing: -0.3 },
  rowMeta: { fontSize: 12, marginTop: 3 },
  rowInfoWrap: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 7, paddingRight: 8 },
  rowInfoText: { fontSize: 11, lineHeight: 15, fontWeight: '500', flex: 1 },
  txCountBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  txCountText: { fontSize: 11, fontWeight: '600' },

  // Expanded area
  editArea: { paddingHorizontal: 13, paddingBottom: 14, gap: 10 },
  subDivider: { height: StyleSheet.hairlineWidth },
  removeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', paddingTop: 2 },
  removeBtnText: { fontSize: 12, fontWeight: '500' },

  // Duplicate
  dupRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dupLabel: { fontSize: 11, flex: 1 },
  dupPills: { flexDirection: 'row', borderRadius: 7, padding: 2, gap: 2 },
  dupPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 5 },
  dupPillText: { fontSize: 11 },

  // Sub-row
  subRow: { borderRadius: 10, padding: 11, gap: 10 },
  subRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  typeRow: { flexDirection: 'row', borderRadius: 9, padding: 3, alignSelf: 'flex-start' },
  typeBtn: { paddingHorizontal: 16, paddingVertical: 5, borderRadius: 7 },
  typeBtnText: { fontSize: 12, fontWeight: '600' },

  // Fields
  fieldRow: { flexDirection: 'row' },
  fieldLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.2, marginBottom: 5 },
  input: { borderRadius: 9, paddingHorizontal: 10, paddingVertical: Platform.OS === 'ios' ? 9 : 6, fontSize: 14 },

  // Date picker (overlay uses theme.overlay via inline style where colors available)
  dateOverlay: { flex: 1, justifyContent: 'flex-end' },
  dateSheet: { borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingBottom: 34 },
  dateSheetHeader: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  dateSheetDone: { fontSize: 17, fontWeight: '600' },

  // Footer
  footer: { paddingHorizontal: 20, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  footerHintRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 28 },
  footerErrText: { fontSize: 12, fontWeight: '500' },
  importBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.indigo, paddingVertical: 16, borderRadius: 16 },
  importBtnText: { fontSize: 16, fontWeight: '700', letterSpacing: -0.2 },
});
