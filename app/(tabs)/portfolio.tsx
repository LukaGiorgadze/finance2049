import { AssetAllocationChart } from '@/components/finance/AssetAllocationChart';
import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { PortfolioHighlights } from '@/components/finance/PortfolioHighlights';
import { PortfolioHoldingsList } from '@/components/finance/PortfolioHoldingsList';
import { PortfolioValueChart } from '@/components/finance/PortfolioValueChart';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackPortfolioAction, trackPortfolioScreen, useRefreshPortfolioPrices } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function PortfolioScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [searchVisible, setSearchVisible] = useState(false);
  const { refresh } = useRefreshPortfolioPrices();
  const [refreshing, setRefreshing] = useState(false);
  const colors = isDark ? Colors.dark : Colors.light;

  useEffect(() => {
    void trackPortfolioScreen();
  }, []);

  const onRefresh = useCallback(async () => {
    void trackPortfolioAction({ action: 'refresh' });
    setRefreshing(true);
    await refresh();
    requestAnimationFrame(() => setRefreshing(false));
  }, [refresh]);

  const handleSelectAsset = (asset: { symbol: string }) => {
    void trackPortfolioAction({ action: 'search_select_asset', target: asset.symbol });
    setSearchVisible(false);
    router.push(`/stock/${asset.symbol}`);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: (isDark ? Colors.dark : Colors.light).surface }]}>
        <View style={styles.safeArea}>
          <PageHeader
            title="Portfolio"
            rightElement={
              <TouchableOpacity
                onPress={() => {
                  void trackPortfolioAction({ action: 'search_open' });
                  setSearchVisible(true);
                }}
                style={[styles.searchButton]}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="search" size={20} color={colors.icon} />
              </TouchableOpacity>
            }
          />

          <ScrollView
            style={[
              styles.scrollView,
              { backgroundColor: (isDark ? Colors.dark : Colors.light).surface }
            ]}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={Colors[colorScheme].icon}
                colors={[Colors[colorScheme].icon]}
              />
            }
          >

            {/* Portfolio Value Chart */}
            <PortfolioValueChart />

            {/* Portfolio Highlights */}
            <PortfolioHighlights />

            {/* Asset Allocation Chart */}
            <AssetAllocationChart />

            {/* Holdings List */}
            <PortfolioHoldingsList />
          </ScrollView>
        </View>
        <AssetSearchModal
          visible={searchVisible}
          onClose={() => setSearchVisible(false)}
          onSelectAsset={handleSelectAsset}
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
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  divider: {
    height: 1,
    marginVertical: 20,
    marginHorizontal: 20,
  },
});
