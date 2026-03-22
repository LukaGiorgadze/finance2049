import { ThemedText } from '@/components/themed-text';
import { Input } from '@/components/ui/input';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { reportWarning } from '@/lib/crashlytics';
import { marketDataService } from '@/lib/services/marketDataService';
import type { TickerSearchResult } from '@/lib/services/types';
import { getTickerTypeInfo } from '@/lib/utils/assetLookup';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

interface AssetSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectAsset: (asset: TickerSearchResult) => void;
}

export function AssetSearchModal({ visible, onClose, onSelectAsset }: AssetSearchModalProps) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const nextUrlRef = useRef<string | undefined>(undefined);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const isDark = colorScheme === 'dark';

  // Dismiss keyboard as soon as results appear so single-tap always works
  useEffect(() => {
    if (results.length > 0) {
      Keyboard.dismiss();
    }
  }, [results.length]);

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setSearchText('');
      setResults([]);
      nextUrlRef.current = undefined;
    }
  }, [visible]);

  // Debounced API search — resets results on every query change
  useEffect(() => {
    const query = searchText.trim();
    if (query.length < 2) {
      setResults([]);
      nextUrlRef.current = undefined;
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = setTimeout(async () => {
      try {
        const response = await marketDataService.searchTickers(query);
        setResults(response.results);
        nextUrlRef.current = response.nextUrl;
      } catch (err) {
        reportWarning('[AssetSearchModal] Search failed', err, {
          query,
        });
        setResults([]);
        nextUrlRef.current = undefined;
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [searchText]);

  // Load more results via cursor pagination
  const handleLoadMore = useCallback(async () => {
    const nextUrl = nextUrlRef.current;
    if (!nextUrl || loadingMore) return;

    setLoadingMore(true);
    try {
      const response = await marketDataService.searchTickers('', nextUrl);
      setResults(prev => [...prev, ...response.results]);
      nextUrlRef.current = response.nextUrl;
    } catch (err) {
      reportWarning('[AssetSearchModal] Load more failed', err, {
        nextUrl,
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  // Trigger load-more when scrolled near the bottom
  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 200 && nextUrlRef.current && !loadingMore) {
      handleLoadMore();
    }
  }, [loadingMore, handleLoadMore]);

  const handleSelectAsset = (asset: TickerSearchResult) => {
    onSelectAsset(asset);
  };

  const handleClose = () => {
    Keyboard.dismiss();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlayStrong }]}>
        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Input
              icon="search"
              placeholder="Search for stocks, ETFs & more"
              value={searchText}
              onChangeText={setSearchText}
              onClear={() => setSearchText('')}
              showClearButton={true}
              containerStyle={styles.input}
              autoFocus={true}
            />
            <TouchableOpacity onPress={handleClose} style={styles.cancelButton}>
              <Text style={[styles.cancelText, { color: colors.blue }]}>Cancel</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.resultsContainer}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="always"
            onScroll={handleScroll}
            scrollEventThrottle={400}
          >
            {searching ? (
              <View style={[styles.statusContainer, { backgroundColor: colors.cardBackground }]}>
                <ActivityIndicator size="small" color={colors.text} />
              </View>
            ) : results.length > 0 ? (
              <View style={[styles.resultsList, { backgroundColor: colors.cardBackground }]}>
                {results.map((item, index) => {
                  const hasBrandColor = !!BRAND_COLORS[item.symbol];
                  const brandColor = BRAND_COLORS[item.symbol] || colors.surface;
                  const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;
                  const showDivider = index !== results.length - 1;
                  const typeInfo = getTickerTypeInfo(item.type);

                  return (
                    <TouchableOpacity
                      key={`${item.symbol}-${index}`}
                      style={[
                        styles.resultRow,
                        showDivider && {
                          borderBottomWidth: 1,
                          borderBottomColor: colors.cardBorder,
                        }
                      ]}
                      activeOpacity={0.7}
                      onPress={() => handleSelectAsset(item)}
                    >
                      <View style={styles.leftSection}>
                        <View style={[styles.symbolBadge, { backgroundColor: brandColor }]}>
                          <ThemedText style={[styles.symbolBadgeText, { color: badgeTextColor }]}>
                            {item.symbol}
                          </ThemedText>
                        </View>
                        <View style={styles.stockInfo}>
                          <ThemedText style={styles.companyName} numberOfLines={1}>
                            {item.name}
                          </ThemedText>
                        </View>
                      </View>
                      <View style={styles.rightSection}>
                        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '1A' }]}>
                          <Text style={[styles.typeText, { color: typeInfo.color }]}>
                            {typeInfo.label}
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}

                {/* Loading more indicator */}
                {loadingMore && (
                  <View style={styles.loadingMore}>
                    <ActivityIndicator size="small" color={colors.text} />
                  </View>
                )}
              </View>
            ) : searchText.trim().length >= 2 ? (
              <View style={[styles.statusContainer, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.statusText, { color: colors.icon }]}>
                  No results found for &quot;{searchText}&quot;
                </Text>
              </View>
            ) : (
              <View style={[styles.statusContainer, { backgroundColor: colors.cardBackground }]}>
                <Text style={[styles.statusText, { color: colors.icon }]}>
                  Start typing to search for stocks, ETFs & more
                </Text>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 12,
  },
  input: {
    flex: 1,
    marginBottom: 0,
  },
  cancelButton: {
    paddingVertical: 12,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  resultsList: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 20,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  leftSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  symbolBadge: {
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbolBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  stockInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  companyName: {
    fontSize: 14,
    fontWeight: '600',
  },
  rightSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  statusContainer: {
    height: 100,
    paddingHorizontal: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '400',
    textAlign: 'center',
  },
});
