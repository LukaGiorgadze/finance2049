import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackHomeAction } from '@/lib';
import type { TickerSearchResult } from '@/lib/services/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AssetSearchModal } from './AssetSearchModal';

export function SearchBar() {
  const [showModal, setShowModal] = useState(false);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  const handleSelectAsset = (asset: TickerSearchResult) => {
    void trackHomeAction({ action: 'search_select_asset', target: asset.symbol });
    setShowModal(false);
    router.push(`/stock/${asset.symbol}`);
  };

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity onPress={() => {
          void trackHomeAction({ action: 'search_open' });
          setShowModal(true);
        }} activeOpacity={0.7}>
          <View style={[
            styles.searchButton,
            {
              backgroundColor: colors.cardBackground,
              borderColor: colors.cardBorder,
            }
          ]}>
            <Ionicons name="search" size={20} color={colors.icon} style={styles.searchIcon} />
            <Text style={[styles.searchPlaceholder, { color: colors.icon }]}>
              Search for stocks, ETFs & more
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      <AssetSearchModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        onSelectAsset={handleSelectAsset}
        analyticsContext="home_search_bar"
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchPlaceholder: {
    fontSize: 16,
    fontWeight: '400',
  },
});
