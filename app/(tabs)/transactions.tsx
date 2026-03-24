import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { TransactionData, TransactionForm } from '@/components/finance/TransactionForm';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { addTransaction, formatLocalDateISO, trackTransactionsAction, trackTransactionsScreen } from '@/lib';
import { reportError } from '@/lib/crashlytics';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function TransactionsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;

  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    void trackTransactionsScreen();
  }, []);

  const handleSelectAsset = (asset: { symbol: string }) => {
    void trackTransactionsAction({ action: 'search_select_asset', target: asset.symbol, context: 'transactions_screen' });
    setSearchVisible(false);
    router.push(`/stock/${asset.symbol}`);
  };

  const handleSubmit = useCallback((data: TransactionData) => {
    const shares = parseFloat(data.quantity);
    const price = parseFloat(data.price);
    const commission = data.commission ? parseFloat(data.commission) : 0;
    const symbol = data.symbol.toUpperCase().trim();
    const total = shares * price + commission;

    try {
      addTransaction(
        {
          symbol,
          type: data.type,
          shares,
          price,
          total,
          date: formatLocalDateISO(data.date),
          commission,
        },
        data.assetType ?? 'stock',
        data.name,
      );
    } catch (e) {
      reportError(`[Transactions] Failed to record transaction for ${symbol}`, e, {
        symbol,
        type: data.type,
        screen: 'transactions_tab',
      });
      Alert.alert('Transaction Failed', e instanceof Error ? e.message : 'Failed to record transaction.');
    }
  }, []);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.safeArea}>
        <PageHeader
          title="Record Transaction"
          rightElement={
            <TouchableOpacity
              onPress={() => {
                void trackTransactionsAction({ action: 'search_open', context: 'transactions_screen' });
                setSearchVisible(true);
              }}
              style={[styles.searchButton]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="search" size={20} color={colors.icon} />
            </TouchableOpacity>
          }
        />

        <TransactionForm onSubmit={handleSubmit} analyticsContext="transactions_screen" />
      </View>
      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={handleSelectAsset}
        analyticsContext="transactions_screen"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  searchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
