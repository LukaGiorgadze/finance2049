import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { BRAND_COLORS } from '@/constants/brand-colors';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate, getThesisChecklistStatus, useWhyTheses } from '@/lib';
import type { TickerSearchResult } from '@/lib/services/types';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getStatusTone(status: string, colors: typeof Colors.light) {
  if (status === 'Review due' || status === 'Partly changed') {
    return { backgroundColor: colors.orangeBg, color: colors.orange };
  }
  if (status === 'Broken') {
    return { backgroundColor: colors.redTintBg, color: colors.red };
  }
  if (status === 'Still true' || status === 'Ready for review') {
    return { backgroundColor: colors.greenTintBg, color: colors.green };
  }
  return { backgroundColor: colors.cardInactiveAlt, color: colors.icon };
}

function ThesisRow({
  thesis,
  action,
}: {
  thesis: ReturnType<typeof useWhyTheses>[number];
  action: 'review' | 'open' | 'exit';
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const brandColor = BRAND_COLORS[thesis.symbol] || colors.surfaceElevated;
  const hasBrandColor = !!BRAND_COLORS[thesis.symbol];
  const status = getThesisChecklistStatus(thesis);
  const statusTone = getStatusTone(status, colors);
  const latestReview = thesis.reviews[thesis.reviews.length - 1];
  const rowText = thesis.status === 'closed' && thesis.exitReview?.lesson
    ? thesis.exitReview.lesson
    : latestReview?.note ?? thesis.why;

  const handlePress = () => {
    if (action === 'review') {
      router.push({ pathname: '/why/review', params: { id: thesis.id } } as never);
      return;
    }

    if (action === 'exit') {
      router.push({ pathname: '/why/exit-review', params: { id: thesis.id } } as never);
      return;
    }

    router.push({ pathname: '/why/edit', params: { id: thesis.id, symbol: thesis.symbol } } as never);
  };

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
      onPress={handlePress}
      activeOpacity={0.75}
    >
      <View style={[styles.symbolBadge, { backgroundColor: brandColor }]}>
        <ThemedText style={[styles.symbolText, { color: hasBrandColor ? colors.textOnColor : colors.text }]}>
          {thesis.symbol}
        </ThemedText>
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <ThemedText style={styles.rowTitle} numberOfLines={1}>
            {thesis.assetName || thesis.symbol}
          </ThemedText>
          <ThemedText style={styles.rowDate}>
            {thesis.status === 'closed'
              ? thesis.closedAt ? formatDate(thesis.closedAt) : 'Closed'
              : formatDate(thesis.reviewDate)}
          </ThemedText>
        </View>
        <ThemedText style={styles.rowExcerpt} numberOfLines={2}>
          {rowText}
        </ThemedText>
        <View style={styles.rowMeta}>
          <View style={[styles.statusBadge, { backgroundColor: statusTone.backgroundColor }]}>
            <ThemedText style={[styles.statusText, { color: statusTone.color }]}>{status}</ThemedText>
          </View>
          {thesis.notifyOnReview && thesis.status === 'active' && (
            <Ionicons name="notifications-outline" size={13} color={colors.icon} />
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.icon} />
    </TouchableOpacity>
  );
}

function Section({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
      {children.length > 0 ? children : <ThemedText style={styles.emptyText}>{empty}</ThemedText>}
    </View>
  );
}

export default function WhyHubScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const theses = useWhyTheses();
  const [searchVisible, setSearchVisible] = useState(false);

  const today = todayKey();
  const due = useMemo(
    () => theses.filter((thesis) => thesis.status === 'active' && thesis.reviewDate <= today),
    [theses, today],
  );
  const active = useMemo(
    () => theses.filter((thesis) => thesis.status === 'active' && thesis.reviewDate > today),
    [theses, today],
  );
  const closed = useMemo(
    () => theses.filter((thesis) => thesis.status === 'closed' || thesis.status === 'archived'),
    [theses],
  );

  const handleSelectAsset = (asset: TickerSearchResult) => {
    setSearchVisible(false);
    router.push({
      pathname: '/why/edit',
      params: {
        symbol: asset.symbol,
        assetName: asset.name,
        assetType: asset.type,
      },
    } as never);
  };

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title="Thesis"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        }
        rightElement={
          <TouchableOpacity
            onPress={() => setSearchVisible(true)}
            style={styles.headerButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="add" size={24} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {theses.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <Ionicons name="document-text-outline" size={44} color={colors.icon} />
            <ThemedText style={styles.emptyTitle}>No theses yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Start with one position and write the reason before you need to review it.
            </ThemedText>
            <TouchableOpacity
              style={[styles.emptyButton, { backgroundColor: colors.tint }]}
              onPress={() => setSearchVisible(true)}
              activeOpacity={0.85}
            >
              <ThemedText style={[styles.emptyButtonText, { color: colors.textOnColor }]}>Write thesis</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Section title="Reviews Due" empty="No reviews due.">
              {due.map((thesis) => <ThesisRow key={thesis.id} thesis={thesis} action="review" />)}
            </Section>
            <Section title="Active" empty="No active theses.">
              {active.map((thesis) => <ThesisRow key={thesis.id} thesis={thesis} action="open" />)}
            </Section>
            <Section title="Closed" empty="No closed theses.">
              {closed.map((thesis) => <ThesisRow key={thesis.id} thesis={thesis} action="exit" />)}
            </Section>
          </>
        )}
      </ScrollView>

      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={handleSelectAsset}
        analyticsContext="why_hub"
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 110,
  },
  section: {
    marginBottom: 22,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 2,
  },
  row: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  symbolBadge: {
    minWidth: 44,
    height: 30,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  symbolText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
  },
  rowDate: {
    fontSize: 11,
    opacity: 0.55,
  },
  rowExcerpt: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.7,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.5,
    paddingVertical: 8,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    textAlign: 'center',
  },
  emptyButton: {
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  emptyButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
