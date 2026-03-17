import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { marketDataService } from '@/lib/services/marketDataService';
import type { NewsArticle } from '@/lib/services/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type SentimentFilter = 'all' | 'positive' | 'negative';

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

export default function NewsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const textColor = colors.text;

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [selectedTicker, setSelectedTicker] = useState<{ symbol: string; name: string } | null>(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const nextUrlRef = useRef<string | undefined>(undefined);
  const scrollViewRef = useRef<ScrollView>(null);

  const fetchNews = useCallback(async (reset = true) => {
    try {
      if (reset) {
        nextUrlRef.current = undefined;
      }

      const params: { limit: number; tickers?: string[]; cursor?: string } = {
        limit: 20,
      };

      if (selectedTicker) {
        params.tickers = [selectedTicker.symbol];
      }

      if (!reset && nextUrlRef.current) {
        params.cursor = nextUrlRef.current;
      }

      const response = await marketDataService.getNews(params);
      nextUrlRef.current = response.nextUrl;

      if (reset) {
        setArticles(response.articles);
      } else {
        setArticles(prev => [...prev, ...response.articles]);
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
      if (reset) setArticles([]);
    }
  }, [selectedTicker]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews(true);
    requestAnimationFrame(() => setRefreshing(false));
  }, [fetchNews]);

  useEffect(() => {
    setIsLoading(true);
    fetchNews(true).finally(() => setIsLoading(false));
  }, [fetchNews]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !nextUrlRef.current) return;
    setIsLoadingMore(true);
    await fetchNews(false);
    setIsLoadingMore(false);
  }, [isLoadingMore, fetchNews]);

  const handleScroll = useCallback((event: { nativeEvent: { contentOffset: { y: number }; layoutMeasurement: { height: number }; contentSize: { height: number } } }) => {
    const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
    const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
    if (distanceFromBottom < 200) {
      loadMore();
    }
  }, [loadMore]);

  const handleSelectAsset = useCallback((asset: { symbol: string; name: string }) => {
    setSearchVisible(false);
    setSelectedTicker({ symbol: asset.symbol, name: asset.name });
  }, []);

  const filteredArticles = useMemo(() => {
    if (sentimentFilter === 'all') return articles;
    return articles.filter(a => a.sentiment === sentimentFilter);
  }, [articles, sentimentFilter]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title="News"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
        }
      />

      {/* Ticker Filter */}
      <View style={styles.tickerFilterContainer}>
        <TouchableOpacity
          style={[
            styles.tickerSearchBar,
            { backgroundColor: colors.cardBackground },
          ]}
          activeOpacity={0.7}
          onPress={() => setSearchVisible(true)}
        >
          <Ionicons name="search" size={16} color={colors.icon} style={{ marginRight: 8 }} />
          {selectedTicker ? (
            <ThemedText style={styles.tickerSearchText} numberOfLines={1}>
              {selectedTicker.symbol} - {selectedTicker.name}
            </ThemedText>
          ) : (
            <ThemedText style={[styles.tickerSearchPlaceholder, { color: colors.icon }]}>
              Filter by ticker
            </ThemedText>
          )}
          {selectedTicker && (
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                setSelectedTicker(null);
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color={colors.icon} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </View>

      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={handleSelectAsset}
      />

      {/* Sentiment Filter Tabs */}
      <View style={styles.filterContainer}>
        <View style={[
          styles.segmentedControl,
          { backgroundColor: colors.divider },
        ]}>
          <TouchableOpacity
            style={[
              styles.segment,
              sentimentFilter === 'all' && {
                backgroundColor: colors.surfaceElevated,
              },
            ]}
            onPress={() => setSentimentFilter('all')}
          >
            <ThemedText style={[
              styles.segmentText,
              { opacity: sentimentFilter === 'all' ? 1 : 0.5 },
            ]}>
              All
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segment,
              sentimentFilter === 'positive' && {
                backgroundColor: colors.surfaceElevated,
              },
            ]}
            onPress={() => setSentimentFilter('positive')}
          >
            <View style={styles.segmentContent}>
              <View style={[styles.sentimentDot, { backgroundColor: colors.green }]} />
              <ThemedText style={[
                styles.segmentText,
                { opacity: sentimentFilter === 'positive' ? 1 : 0.5 },
              ]}>
                Positive
              </ThemedText>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segment,
              sentimentFilter === 'negative' && {
                backgroundColor: colors.surfaceElevated,
              },
            ]}
            onPress={() => setSentimentFilter('negative')}
          >
            <View style={styles.segmentContent}>
              <View style={[styles.sentimentDot, { backgroundColor: colors.red }]} />
              <ThemedText style={[
                styles.segmentText,
                { opacity: sentimentFilter === 'negative' ? 1 : 0.5 },
              ]}>
                Negative
              </ThemedText>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* News List */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.listWrapper}
        contentContainerStyle={styles.listContentContainer}
        showsVerticalScrollIndicator={true}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
            colors={[colors.text]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.text} />
            <ThemedText style={styles.loadingText}>Loading news...</ThemedText>
          </View>
        ) : filteredArticles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="newspaper-outline" size={48} color={colors.icon} />
            <ThemedText style={styles.emptyText}>The news desk is on a coffee break. Check back soon! ☕</ThemedText>
          </View>
        ) : (
          <View style={styles.newsList}>
            {filteredArticles.map((article) => (
              <NewsCard key={article.id} article={article} colors={colors} />
            ))}
            {isLoadingMore && (
              <View style={styles.loadingMoreContainer}>
                <ActivityIndicator size="small" color={colors.text} />
              </View>
            )}
            {!nextUrlRef.current && !isLoadingMore && articles.length > 0 && (
              <ThemedText style={styles.endText}>No more articles</ThemedText>
            )}
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

interface NewsCardProps {
  article: NewsArticle;
  colors: typeof Colors.light;
}

function NewsCard({ article, colors }: NewsCardProps) {
  const sentimentColor =
    article.sentiment === 'positive' ? colors.green :
    article.sentiment === 'negative' ? colors.red :
    undefined;

  return (
    <TouchableOpacity
      style={[
        styles.newsCard,
        {
          backgroundColor: colors.cardBackground,
          borderColor: colors.cardBorder,
        },
      ]}
      activeOpacity={0.7}
      onPress={() => router.push({
        pathname: '/news/[id]',
        params: {
          id: article.id,
          title: article.title,
          url: article.url,
          source: article.source,
          publishedAt: article.publishedAt,
          ...(article.ampUrl && { ampUrl: article.ampUrl }),
          ...(article.author && { author: article.author }),
          ...(article.description && { description: article.description }),
          ...(article.imageUrl && { imageUrl: article.imageUrl }),
          ...(article.tickers && article.tickers.length > 0 && { tickers: article.tickers.join(',') }),
          ...(article.sentiment && { sentiment: article.sentiment }),
        },
      })}
    >
      <View style={styles.newsContent}>
        <View style={styles.newsHeader}>
          <View style={[
            styles.sourceBadge,
            { backgroundColor: colors.divider },
          ]}>
            <Ionicons
              name="newspaper-outline"
              size={12}
              color={colors.text}
              style={{ opacity: 0.6, marginRight: 4 }}
            />
            <ThemedText style={styles.sourceText}>{article.source}</ThemedText>
          </View>
          <View style={styles.headerRight}>
            {sentimentColor && (
              <View style={[styles.sentimentIndicator, { backgroundColor: sentimentColor }]} />
            )}
            <ThemedText style={styles.timestamp}>
              {formatRelativeTime(article.publishedAt)}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.newsTitle} numberOfLines={2}>
          {article.title}
        </ThemedText>

        {article.description && (
          <ThemedText style={styles.newsDescription} numberOfLines={2}>
            {article.description}
          </ThemedText>
        )}

        {article.tickers && article.tickers.length > 0 && (
          <View style={styles.tickerRow}>
            {article.tickers.slice(0, 4).map((ticker) => {
              const hasBrandColor = !!BRAND_COLORS[ticker];
              const brandColor = BRAND_COLORS[ticker] || colors.surface;
              const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;
              return (
                <View
                  key={ticker}
                  style={[styles.tickerBadge, { backgroundColor: brandColor }]}
                >
                  <ThemedText style={[styles.tickerText, { color: badgeTextColor }]}>{ticker}</ThemedText>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tickerFilterContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  tickerSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  tickerSearchText: {
    flex: 1,
    fontSize: 15,
  },
  tickerSearchPlaceholder: {
    flex: 1,
    fontSize: 15,
  },
  filterContainer: {
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
  },
  segment: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sentimentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  listWrapper: {
    flex: 1,
  },
  listContentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  newsList: {
    gap: 8,
  },
  newsCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  newsContent: {
    padding: 16,
  },
  newsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.7,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sentimentIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.5,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    marginBottom: 8,
  },
  newsDescription: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.6,
    marginBottom: 8,
  },
  tickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tickerBadge: {
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
    minWidth: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  tickerText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    opacity: 0.6,
  },
  loadingMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 100,
    gap: 12,
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: 30,
    fontSize: 16,
    opacity: 0.6,
  },
  endText: {
    textAlign: 'center',
    fontSize: 13,
    opacity: 0.4,
    paddingVertical: 16,
  },
});
