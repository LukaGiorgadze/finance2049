import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { formatDate, getThesisChecklistStatus, useActiveThesis } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface WhyCardProps {
  symbol: string;
  assetName?: string;
  assetType?: string;
}

function isDue(reviewDate?: string) {
  if (!reviewDate) return false;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return reviewDate <= today;
}

function getStatusTone(status: string, due: boolean, colors: typeof Colors.light) {
  if (due || status === 'Review due' || status === 'Partly changed') {
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

export function WhyCard({ symbol, assetName, assetType }: WhyCardProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const thesis = useActiveThesis(symbol);
  const status = getThesisChecklistStatus(thesis);
  const due = isDue(thesis?.reviewDate);
  const latestReview = thesis?.reviews[thesis.reviews.length - 1];
  const statusTone = getStatusTone(status, due, colors);

  const openEditor = () => {
    router.push({
      pathname: '/why/edit',
      params: {
        symbol,
        assetName,
        assetType,
        id: thesis?.id,
      },
    } as never);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="document-text-outline" size={18} color={colors.icon} />
          <ThemedText style={styles.title}>Thesis</ThemedText>
        </View>
        {thesis && (
          <View style={[styles.statusPill, { backgroundColor: statusTone.backgroundColor }]}>
            <ThemedText style={[styles.statusText, { color: statusTone.color }]}>
              {status}
            </ThemedText>
          </View>
        )}
      </View>

      {thesis ? (
        <>
          <ThemedText style={styles.excerpt} numberOfLines={3}>
            {thesis.why}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText style={styles.metaText}>
              Next review: {formatDate(thesis.reviewDate)}
            </ThemedText>
            {thesis.notifyOnReview && (
              <Ionicons name="notifications-outline" size={14} color={colors.icon} />
            )}
          </View>
          {latestReview?.note ? (
            <View style={[styles.reviewNote, { backgroundColor: colors.cardInactive, borderColor: colors.cardBorder }]}>
              <ThemedText style={styles.reviewNoteLabel}>Latest review</ThemedText>
              <ThemedText style={styles.reviewNoteText} numberOfLines={2}>
                {latestReview.note}
              </ThemedText>
            </View>
          ) : null}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { borderColor: colors.cardBorder }]}
              onPress={openEditor}
              activeOpacity={0.8}
            >
              <ThemedText style={styles.secondaryButtonText}>Open</ThemedText>
            </TouchableOpacity>
            {due && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.orange }]}
                onPress={() => router.push({ pathname: '/why/review', params: { id: thesis.id } } as never)}
                activeOpacity={0.8}
              >
                <ThemedText style={[styles.primaryButtonText, { color: colors.textOnColor }]}>
                  Review
                </ThemedText>
              </TouchableOpacity>
            )}
          </View>
        </>
      ) : (
        <>
          <ThemedText style={styles.emptyTitle}>No thesis yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Capture your reasoning before the price changes the story.
          </ThemedText>
          <TouchableOpacity
            style={[styles.primaryButton, styles.emptyButton, { backgroundColor: colors.tint }]}
            onPress={openEditor}
            activeOpacity={0.8}
          >
            <ThemedText style={[styles.primaryButtonText, { color: colors.textOnColor }]}>
              Write thesis
            </ThemedText>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '500',
  },
  excerpt: {
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '400',
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  metaText: {
    fontSize: 12,
    opacity: 0.55,
  },
  reviewNote: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  reviewNoteLabel: {
    fontSize: 11,
    fontWeight: '500',
    opacity: 0.45,
    marginBottom: 4,
  },
  reviewNoteText: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.72,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    minHeight: 40,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.55,
  },
  emptyButton: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
});
