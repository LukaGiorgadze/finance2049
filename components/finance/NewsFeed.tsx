import { ThemedText } from '@/components/themed-text';
import { SectionTitle } from '@/components/ui/section-title';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackNewsAction } from '@/lib';
import { reportError } from '@/lib/crashlytics';
import { marketDataService } from '@/lib/services/marketDataService';
import { getAccessToken } from '@/lib/supabase';
import type { NewsArticle } from '@/lib/services/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';


// Track if animation has played globally to prevent re-animation on tab switch
let hasAnimatedNewsFeed = false;

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

export function NewsFeed({ refreshKey = 0 }: { refreshKey?: number }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Only animate on first mount
  const shouldAnimate = useRef(!hasAnimatedNewsFeed);
  useEffect(() => {
    hasAnimatedNewsFeed = true;
  }, []);

  useEffect(() => {
    async function fetchNews() {
      const token = await getAccessToken();
      if (!token) { setIsLoading(false); return; }

      try {
        const { articles: data } = await marketDataService.getNews({ limit: 5 });
        setArticles(data);
      } catch (error) {
        reportError('Failed to fetch news', error, {
          surface: 'home_widget',
          limit: 5,
          refreshKey,
        });
        setArticles([]);
      } finally {
        setIsLoading(false);
      }
    }

    fetchNews();
  }, [refreshKey]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBadge, { backgroundColor: colors.divider }]}>
            <Ionicons name="newspaper-outline" size={16} color={colors.text} />
          </View>
          <SectionTitle style={styles.sectionTitle}>News</SectionTitle>
        </View>
        <TouchableOpacity
          style={styles.moreButton}
          onPress={() => {
            void trackNewsAction({ action: 'open_news_list', source: 'home_feed' });
            router.push('/news');
          }}
        >
          <ThemedText style={styles.moreText}>More</ThemedText>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.icon}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.newsList}>
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={colors.text} />
          </View>
        ) : articles.length === 0 ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>The news desk is on a coffee break. Check back soon! ☕</ThemedText>
          </View>
        ) : (
          articles.map((article, index) => (
            <Animated.View
              key={article.id}
              entering={shouldAnimate.current ? FadeInDown.delay(index * 80).duration(400) : undefined}
            >
              <NewsCard article={article} colors={colors} />
            </Animated.View>
          ))
        )}
      </View>
    </View>
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
        }
      ]}
      onPress={() => {
        void trackNewsAction({
          action: 'open_article',
          target: article.id,
          source: article.source,
        });
        router.push({
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
        });
      }}
    >
      <View style={styles.newsContent}>
        <View style={styles.newsHeader}>
          <View style={[
            styles.sourceBadge,
            {
              backgroundColor: colors.divider,
            }
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
              <View style={[styles.sentimentDot, { backgroundColor: sentimentColor }]} />
            )}
            <ThemedText style={styles.timestamp}>
              {formatRelativeTime(article.publishedAt)}
            </ThemedText>
          </View>
        </View>

        <ThemedText style={styles.newsTitle} numberOfLines={2}>
          {article.title}
        </ThemedText>

        {article.tickers && article.tickers.length > 0 && (
          <View style={styles.tickerRow}>
            {article.tickers.slice(0, 4).map((ticker) => {
              const hasBrandColor = !!BRAND_COLORS[ticker];
              const brandColor = BRAND_COLORS[ticker] || colors.surface;
              const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;
              return (
                <View
                  key={ticker}
                  style={[
                    styles.tickerBadge,
                    { backgroundColor: brandColor },
                  ]}
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
    paddingVertical: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  moreText: {
    fontSize: 15,
    fontWeight: '600',
    opacity: 0.6,
  },
  newsList: {
    paddingHorizontal: 20,
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
  timestamp: {
    fontSize: 12,
    fontWeight: '400',
    opacity: 0.5,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  newsTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
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
  sentimentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: 30,
    fontSize: 14,
    opacity: 0.5,
  },
});
