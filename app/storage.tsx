import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { clearDatabase, store$, supabase } from '@/lib';
import { ONBOARDING_KEY } from '@/constants/storage-keys';
import { APP_CACHE_KEY } from '@/lib/hooks/useRefreshPortfolioPrices';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface StorageCategory {
  icon: SymbolViewProps['name'];
  label: string;
  description: string;
  records: number;
  sizeBytes: number;
  color: string;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function estimateJsonSize(data: unknown): number {
  try {
    return new Blob([JSON.stringify(data)]).size;
  } catch {
    // Fallback for environments without Blob
    return JSON.stringify(data).length * 2;
  }
}

export default function StorageScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const textColor = colors.text;
  const [totalStorageBytes, setTotalStorageBytes] = useState(0);
  const [miscCacheBytes, setMiscCacheBytes] = useState(0);

  // Read store data
  const holdings = store$.portfolio.holdings.get();
  const transactions = store$.portfolio.transactions.get();
  const marketPrices = store$.market.prices.get();
  const indices = store$.market.indices.get();
  const preferences = store$.preferences.get();

  // Get actual AsyncStorage size
  useEffect(() => {
    async function measureStorage() {
      try {
        const raw = await AsyncStorage.getItem('finance-app-store');
        if (raw) {
          setTotalStorageBytes(raw.length * 2); // UTF-16
        }
      } catch {
        // Fallback to computed
      }

      // Measure misc caches (split checks, etc.)
      try {
        let bytes = 0;
        const cacheRaw = await AsyncStorage.getItem(APP_CACHE_KEY);
        if (cacheRaw) bytes += cacheRaw.length * 2;
        setMiscCacheBytes(bytes);
      } catch {}
    }
    measureStorage();
  }, [holdings, transactions, marketPrices]);

  const categories = useMemo<StorageCategory[]>(() => {
    const holdingsObj = holdings || {};
    const holdingsArray = Object.values(holdingsObj);
    const totalLots = holdingsArray.reduce((sum, h) => sum + (h.lots?.length || 0), 0);

    const transactionsArr = transactions || [];
    const pricesObj = marketPrices || {};
    const pricesArray = Object.keys(pricesObj);
    const indicesArr = indices || [];

    return [
      {
        icon: 'chart.pie.fill',
        label: 'Your Investments',
        description: `${holdingsArray.length} stocks · ${totalLots} tax lots`,
        records: holdingsArray.length,
        sizeBytes: estimateJsonSize(holdingsObj),
        color: colors.green,
      },
      {
        icon: 'arrow.left.arrow.right',
        label: 'Transaction History',
        description: `${transactionsArr.length} transactions recorded`,
        records: transactionsArr.length,
        sizeBytes: estimateJsonSize(transactionsArr),
        color: colors.blue,
      },
      {
        icon: 'chart.line.uptrend.xyaxis',
        label: 'Market Data Cache',
        description: `${pricesArray.length} prices · ${indicesArr.length} indices`,
        records: pricesArray.length + indicesArr.length,
        sizeBytes: estimateJsonSize(pricesObj) + estimateJsonSize(indicesArr),
        color: colors.orange,
      },
      {
        icon: 'gearshape.fill',
        label: 'App Settings',
        description: 'Theme, currency & preferences',
        records: 0,
        sizeBytes: estimateJsonSize(preferences),
        color: colors.icon,
      },
      {
        icon: 'arrow.triangle.2.circlepath',
        label: 'App Cache',
        description: 'API and other temporary data',
        records: 0,
        sizeBytes: miscCacheBytes,
        color: Colors.indigo,
      },
    ];
  }, [holdings, transactions, marketPrices, indices, preferences, miscCacheBytes]);

  const computedTotal = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.sizeBytes, 0);
  }, [categories]);

  const displayTotal = totalStorageBytes || computedTotal;
  const totalRecords = useMemo(() => {
    return categories.reduce((sum, cat) => sum + cat.records, 0);
  }, [categories]);

  const handleClearCache = () => {
    Alert.alert(
      'Clear App Cache',
      'This will clear cached data, such as API and other temporary data. Your investments and settings are not affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Cache',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(APP_CACHE_KEY);
            setMiscCacheBytes(0);
          },
        },
      ],
    );
  };

  const handleClearData = () => {
    Alert.alert(
      'Clear All Data',
      'This will permanently delete all your investments, transactions, and cached data. Your app settings will be kept.\n\nThis cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you sure?',
              'This action is irreversible. All your investment data will be permanently deleted.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: async () => {
                    await clearDatabase();
                    await supabase.auth.signOut();
                    await AsyncStorage.removeItem(ONBOARDING_KEY);
                    Alert.alert('All Clear', 'Your data has been wiped clean.', [
                      { text: 'OK', onPress: () => router.replace('/onboarding') },
                    ]);
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const maxCategorySize = Math.max(...categories.map((c) => c.sizeBytes), 1);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title="Storage"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Total Storage Card */}
        <View
          style={[
            styles.totalCard,
            { backgroundColor: colors.cardBackground },
          ]}
        >
          <View style={styles.totalIconRow}>
            <View style={[styles.totalIconCircle, { backgroundColor: colors.divider }]}>
              <IconSymbol name="externaldrive.fill" size={28} color={colors.tint} />
            </View>
          </View>
          <Text style={[styles.totalSize, { color: colors.text }]}>
            {formatBytes(displayTotal)}
          </Text>
          <Text style={[styles.totalLabel, { color: colors.icon }]}>
            Total storage used
          </Text>
          <View style={styles.totalDivider}>
            <View style={[styles.dividerLine, { backgroundColor: colors.cardBorder }]} />
          </View>
          <View style={styles.totalStatsRow}>
            <View style={styles.totalStat}>
              <Text style={[styles.totalStatValue, { color: colors.text }]}>
                {totalRecords}
              </Text>
              <Text style={[styles.totalStatLabel, { color: colors.icon }]}>
                Records
              </Text>
            </View>
            <View style={[styles.totalStatDivider, { backgroundColor: colors.cardBorder }]} />
            <View style={styles.totalStat}>
              <Text style={[styles.totalStatValue, { color: colors.text }]}>
                {categories.filter((c) => c.records > 0).length}
              </Text>
              <Text style={[styles.totalStatLabel, { color: colors.icon }]}>
                Categories
              </Text>
            </View>
          </View>
        </View>

        {/* Category Breakdown */}
        <Text style={[styles.sectionTitle, { color: colors.icon }]}>
          BREAKDOWN
        </Text>

        <View style={[styles.categoriesCard, { backgroundColor: colors.cardBackground }]}>
          {categories.map((category, index) => {
            const barWidth = category.sizeBytes > 0
              ? Math.max((category.sizeBytes / maxCategorySize) * 100, 3)
              : 0;
            const isLast = index === categories.length - 1;

            const content = (
              <View key={category.label}>
                <View style={styles.categoryRow}>
                  <View style={styles.categoryLeft}>
                    <View style={[styles.categoryIcon, { backgroundColor: category.color + '18' }]}>
                      <IconSymbol name={category.icon} size={18} color={category.color} />
                    </View>
                    <View style={styles.categoryInfo}>
                      <Text style={[styles.categoryLabel, { color: colors.text }]}>
                        {category.label}
                      </Text>
                      <Text style={[styles.categoryDesc, { color: colors.icon }]}>
                        {category.description}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.categorySize, { color: colors.icon }]}>
                    {formatBytes(category.sizeBytes)}
                  </Text>
                </View>

                {/* Usage bar */}
                <View style={styles.barContainer}>
                  <View style={[styles.barTrack, { backgroundColor: colors.divider }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: category.color,
                          width: `${barWidth}%`,
                        },
                      ]}
                    />
                  </View>
                </View>

                {!isLast && (
                  <View
                    style={[
                      styles.categoryDivider,
                      { backgroundColor: colors.divider },
                    ]}
                  />
                )}
              </View>
            );

            return content;
          })}
        </View>

        {/* Clear Data */}
        <Text style={[styles.sectionTitle, { color: colors.icon }]}>
          MANAGE
        </Text>

        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: colors.cardBackground }]}
          onPress={handleClearCache}
          activeOpacity={0.7}
        >
          <View style={styles.clearLeft}>
            <View style={[styles.clearIcon, { backgroundColor: colors.orangeBg }]}>
              <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.orange} />
            </View>
            <View>
              <Text style={[styles.clearTitle, { color: colors.orange }]}>Clear Cache</Text>
              <Text style={[styles.clearSubtitle, { color: colors.icon }]}>
                Clears cached data, not your investments
              </Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.iconMuted} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.clearButton, { backgroundColor: colors.cardBackground }]}
          onPress={handleClearData}
          activeOpacity={0.7}
        >
          <View style={styles.clearLeft}>
            <View style={[styles.clearIcon, { backgroundColor: colors.red + '18' }]}>
              <IconSymbol name="trash.fill" size={18} color={colors.red} />
            </View>
            <View>
              <Text style={[styles.clearTitle, { color: colors.red }]}>Clear All Data</Text>
              <Text style={[styles.clearSubtitle, { color: colors.icon }]}>
                Permanently delete everything
              </Text>
            </View>
          </View>
          <IconSymbol name="chevron.right" size={16} color={colors.iconMuted} />
        </TouchableOpacity>

        <Text style={[styles.footerNote, { color: colors.iconMuted }]}>
          All data is stored locally on your device. Nothing is sent to external servers.
        </Text>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  // Total Storage Card
  totalCard: {
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 28,
  },
  totalIconRow: {
    marginBottom: 16,
  },
  totalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  totalSize: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -1,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  totalDivider: {
    width: '100%',
    paddingVertical: 16,
  },
  dividerLine: {
    height: 1,
    width: '100%',
  },
  totalStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  totalStat: {
    flex: 1,
    alignItems: 'center',
  },
  totalStatValue: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  totalStatLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  totalStatDivider: {
    width: 1,
    height: 32,
  },
  // Section
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  // Categories
  categoriesCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  categoryDesc: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  categorySize: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
  },
  barContainer: {
    paddingLeft: 48,
    paddingTop: 8,
    paddingBottom: 4,
  },
  barTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryDivider: {
    height: 1,
    marginVertical: 12,
    marginLeft: 48,
  },
  // Clear Button
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  clearLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  clearIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clearTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  clearSubtitle: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 1,
  },
  footerNote: {
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});
