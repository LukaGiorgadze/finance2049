import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackNewsAction, trackNewsScreen } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Linking, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

function formatPublishedDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatPublishedTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function NewsDetailScreen() {
  const params = useLocalSearchParams<{
    id: string;
    title: string;
    author: string;
    description: string;
    url: string;
    ampUrl: string;
    imageUrl: string;
    publishedAt: string;
    source: string;
    tickers: string;
    sentiment: string;
  }>();

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const textColor = colors.text;
  const [searchVisible, setSearchVisible] = useState(false);

  useEffect(() => {
    void trackNewsScreen({
      articleId: params.id,
      source: params.source,
    });
  }, [params.id, params.source]);

  const handleSelectAsset = (asset: { symbol: string }) => {
    void trackNewsAction({
      action: 'search_select_asset',
      target: asset.symbol,
      source: params.source,
    });
    setSearchVisible(false);
    router.push(`/stock/${asset.symbol}`);
  };

  const tickers = params.tickers ? params.tickers.split(',') : [];
  const sentimentColor =
    params.sentiment === 'positive' ? colors.green :
    params.sentiment === 'negative' ? colors.red :
    undefined;
  const sentimentLabel =
    params.sentiment === 'positive' ? 'Positive' :
    params.sentiment === 'negative' ? 'Negative' :
    params.sentiment === 'neutral' ? 'Neutral' :
    undefined;

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={styles.safeArea}>
        <PageHeader
          title={params.source || 'News'}
          leftElement={
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={textColor} />
            </TouchableOpacity>
          }
          rightElement={
            <TouchableOpacity
              onPress={() => {
                void trackNewsAction({ action: 'search_open', source: params.source });
                setSearchVisible(true);
              }}
              style={[styles.externalButton ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="search" size={20} color={colors.icon} />
            </TouchableOpacity>
          }
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Article Image */}
          {params.imageUrl ? (
            <View style={styles.imageContainer}>
              <Image
                source={{ uri: params.imageUrl }}
                style={styles.articleImage}
                contentFit="cover"
              />
            </View>
          ) : null}

          {/* Article Content Card */}
          <View style={[
            styles.contentCard,
            { backgroundColor: colors.cardBackground },
          ]}>
            {/* Meta: Source + Date */}
            <View style={styles.metaRow}>
              <View style={[
                styles.sourceBadge,
                { backgroundColor: colors.divider },
              ]}>
                <Ionicons
                  name="newspaper-outline"
                  size={12}
                  color={textColor}
                  style={{ opacity: 0.6, marginRight: 4 }}
                />
                <ThemedText style={styles.sourceText}>{params.source}</ThemedText>
              </View>
              {sentimentColor && sentimentLabel && (
                <View style={styles.sentimentBadge}>
                  <View style={[styles.sentimentDot, { backgroundColor: sentimentColor }]} />
                  <ThemedText style={[styles.sentimentText, { color: sentimentColor }]}>
                    {sentimentLabel}
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Title */}
            <ThemedText style={styles.articleTitle}>{params.title}</ThemedText>

            {/* Author + Timestamp */}
            <View style={styles.authorRow}>
              {params.author ? (
                <ThemedText style={styles.authorText}>
                  By {params.author}
                </ThemedText>
              ) : null}
              {params.publishedAt ? (
                <ThemedText style={styles.dateText}>
                  {formatPublishedDate(params.publishedAt)} at {formatPublishedTime(params.publishedAt)}
                </ThemedText>
              ) : null}
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />

            {/* Description */}
            {params.description ? (
              <ThemedText style={styles.descriptionText}>{params.description}</ThemedText>
            ) : (
              <ThemedText style={styles.noDescriptionText}>
                No preview available. Tap the button below to read the full article.
              </ThemedText>
            )}

            {/* Tickers */}
            {tickers.length > 0 && (
              <>
                <View style={[styles.divider, { backgroundColor: colors.divider }]} />
                <ThemedText style={styles.tickersSectionTitle}>Related Tickers</ThemedText>
                <View style={styles.tickerRow}>
                  {tickers.map((ticker) => {
                    const hasBrandColor = !!BRAND_COLORS[ticker];
                    const brandColor = BRAND_COLORS[ticker] || colors.surface;
                    const badgeTextColor = hasBrandColor ? colors.textOnColor : colors.text;
                    return (
                      <TouchableOpacity
                        key={ticker}
                        style={[
                          styles.tickerBadge,
                          { backgroundColor: brandColor },
                        ]}
                        onPress={() => {
                          void trackNewsAction({
                            action: 'open_related_ticker',
                            target: ticker,
                            source: params.source,
                          });
                          router.push(`/stock/${ticker}`);
                        }}
                      >
                        <ThemedText style={[styles.tickerText, { color: badgeTextColor }]}>{ticker}</ThemedText>
                        <Ionicons
                          name="chevron-forward"
                          size={10}
                          color={badgeTextColor}
                          style={{ opacity: 0.4 }}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* Read Original Article Button */}
          <TouchableOpacity
            style={[styles.readArticleButton, { backgroundColor: colors.blue }]}
            onPress={() => {
              void trackNewsAction({
                action: 'open_full_article',
                target: params.id,
                source: params.source,
              });
              Linking.openURL(params.ampUrl || params.url);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name="globe-outline" size={20} color={colors.textOnColor} />
            <ThemedText style={[styles.readArticleText, { color: colors.textOnColor }]}>Read Full Article</ThemedText>
            <Ionicons name="open-outline" size={16} color={colors.textOnColor} style={{ opacity: 0.7 }} />
          </TouchableOpacity>

          <ThemedText style={styles.sourceAttribution}>
            Source: {params.source}
          </ThemedText>
        </ScrollView>
      </View>
      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={handleSelectAsset}
        analyticsContext="news_detail"
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
  externalButton: {
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
    paddingBottom: 40,
  },
  imageContainer: {
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
  },
  articleImage: {
    width: '100%',
    height: 200,
  },
  contentCard: {
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.7,
  },
  sentimentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  sentimentDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  sentimentText: {
    fontSize: 12,
    fontWeight: '600',
  },
  articleTitle: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 30,
    letterSpacing: -0.5,
    marginBottom: 12,
  },
  authorRow: {
    gap: 4,
  },
  authorText: {
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.7,
  },
  dateText: {
    fontSize: 13,
    opacity: 0.5,
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  descriptionText: {
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.85,
  },
  noDescriptionText: {
    fontSize: 15,
    lineHeight: 22,
    opacity: 0.5,
    fontStyle: 'italic',
  },
  tickersSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
    opacity: 0.7,
  },
  tickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tickerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    paddingVertical: 0,
    borderRadius: 4,
    minWidth: 36,
    gap: 2,
  },
  tickerText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  readArticleButton: {
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  readArticleText: {
    fontSize: 17,
    fontWeight: '600',
  },
  sourceAttribution: {
    textAlign: 'center',
    fontSize: 12,
    opacity: 0.4,
    marginTop: 12,
    marginHorizontal: 20,
  },
});
