import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  addThesisReview,
  cancelWhyReviewNotification,
  formatDate,
  formatLocalDateISO,
  scheduleWhyReviewNotification,
  useWhyTheses,
} from '@/lib';
import type { ThesisReviewResult } from '@/lib/store/types';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

const RESULTS: { value: ThesisReviewResult; label: string }[] = [
  { value: 'still_valid', label: 'Still true' },
  { value: 'partly_changed', label: 'Partly changed' },
  { value: 'invalidated', label: 'Broken' },
];

function getResultTone(result: ThesisReviewResult, colors: typeof Colors.light) {
  if (result === 'invalidated') {
    return { backgroundColor: colors.redTintBg, borderColor: colors.red, color: colors.red };
  }
  if (result === 'partly_changed') {
    return { backgroundColor: colors.orangeBg, borderColor: colors.orange, color: colors.orange };
  }
  return { backgroundColor: colors.greenTintBg, borderColor: colors.green, color: colors.green };
}

export default function ReviewWhyScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = firstParam(params.id);
  const theses = useWhyTheses();
  const thesis = useMemo(() => theses.find((item) => item.id === id), [id, theses]);
  const latestReview = thesis?.reviews[thesis.reviews.length - 1];
  const latestReviewResult = latestReview?.result;
  const thesisId = thesis?.id;
  const thesisNotifyOnReview = thesis?.notifyOnReview;
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [result, setResult] = useState<ThesisReviewResult>(latestReview?.result ?? 'still_valid');
  const [note, setNote] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState(formatLocalDateISO(addDays(30)));
  const [notifyOnReview, setNotifyOnReview] = useState(thesis?.notifyOnReview ?? false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!thesisId) return;

    setResult(latestReviewResult ?? 'still_valid');
    setNotifyOnReview(thesisNotifyOnReview ?? false);
  }, [latestReviewResult, thesisId, thesisNotifyOnReview]);

  const onDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selectedDate) return;
    const today = formatLocalDateISO(new Date());
    const selected = formatLocalDateISO(selectedDate);
    setNextReviewDate(selected < today ? today : selected);
  };

  const save = async () => {
    if (!thesis) return;
    if (!note.trim()) {
      Alert.alert('Missing Note', 'Write what changed before saving the review.');
      return;
    }

    setSaving(true);
    Keyboard.dismiss();
    try {
      let notificationId: string | undefined;
      let notifyEnabled = false;

      if (notifyOnReview) {
        const scheduled = await scheduleWhyReviewNotification({
          thesisId: thesis.id,
          symbol: thesis.symbol,
          reviewDate: nextReviewDate,
          previousNotificationId: thesis.reviewNotificationId,
        });
        notifyEnabled = scheduled.enabled;
        notificationId = scheduled.notificationId;

        if (!scheduled.enabled) {
          Alert.alert('Reminder Not Enabled', scheduled.message ?? 'Notification permission was not granted.');
        }
      } else {
        await cancelWhyReviewNotification(thesis.reviewNotificationId);
      }

      addThesisReview(thesis.id, {
        result,
        note,
        nextReviewDate,
        notifyOnReview: notifyEnabled,
        reviewNotificationId: notificationId,
      });
      router.back();
    } finally {
      setSaving(false);
    }
  };

  if (!thesis) {
    return (
      <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
        <PageHeader
          title="Review Thesis"
          leftElement={
            <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="arrow-back" size={24} color={colors.text} />
            </TouchableOpacity>
          }
        />
        <View style={styles.missing}>
          <ThemedText style={styles.missingTitle}>Thesis not found</ThemedText>
          <ThemedText style={styles.missingText}>This thesis may have been deleted or restored from an older backup.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title="Review Thesis"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.originalCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
          <View style={styles.originalHeader}>
            <ThemedText style={styles.symbol}>{thesis.symbol}</ThemedText>
            <ThemedText style={styles.dateText}>Review was {formatDate(thesis.reviewDate)}</ThemedText>
          </View>
          <ThemedText style={styles.originalLabel}>Original thesis</ThemedText>
          <ThemedText style={styles.originalText}>{thesis.why}</ThemedText>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <ThemedText style={styles.originalLabel}>What would prove it wrong</ThemedText>
          <ThemedText style={styles.originalText}>{thesis.invalidation}</ThemedText>
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.icon }]}>Still true?</Text>
          <View style={styles.resultRow}>
            {RESULTS.map((option) => {
              const selected = option.value === result;
              const tone = getResultTone(option.value, colors);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.resultButton,
                    {
                      backgroundColor: selected ? tone.backgroundColor : colors.cardBackground,
                      borderColor: selected ? tone.borderColor : colors.cardBorder,
                    },
                  ]}
                  onPress={() => setResult(option.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.resultText, { color: selected ? tone.color : colors.text }]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {latestReview?.note ? (
          <View style={[styles.latestReviewCard, { backgroundColor: colors.cardInactive, borderColor: colors.cardBorder }]}>
            <ThemedText style={styles.latestReviewLabel}>Latest review</ThemedText>
            <ThemedText style={styles.latestReviewText}>{latestReview.note}</ThemedText>
          </View>
        ) : null}

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.icon }]}>What changed?</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Write what changed since you created this thesis."
            placeholderTextColor={colors.icon}
            multiline
            textAlignVertical="top"
            style={[
              styles.textArea,
              {
                color: colors.text,
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder,
              },
            ]}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.icon }]}>Next review</Text>
          <View style={styles.presetRow}>
            {[30, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.presetButton,
                  {
                    backgroundColor: nextReviewDate === formatLocalDateISO(addDays(days)) ? colors.tint : colors.cardBackground,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() => setNextReviewDate(formatLocalDateISO(addDays(days)))}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.presetText,
                  { color: nextReviewDate === formatLocalDateISO(addDays(days)) ? colors.textOnColor : colors.text },
                ]}>
                  {days} days
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.presetButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetText, { color: colors.text }]}>Custom</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.reviewRow, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <ThemedText style={styles.reviewDate}>{nextReviewDate}</ThemedText>
            <View style={styles.notifyRow}>
              <Ionicons name="notifications-outline" size={18} color={colors.icon} />
              <Switch value={notifyOnReview} onValueChange={setNotifyOnReview} />
            </View>
          </View>
        </View>

        {showDatePicker && (
          <View style={[styles.datePickerCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <DateTimePicker
              value={parseDateKey(nextReviewDate)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              minimumDate={new Date()}
              onChange={onDateChange}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity onPress={() => setShowDatePicker(false)} style={styles.dateDoneButton}>
                <Text style={[styles.dateDoneText, { color: colors.blue }]}>Done</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.headerAccent }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 }]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          <ThemedText style={[styles.saveButtonText, { color: colors.textOnColor }]}>
            {saving ? 'Saving...' : 'Save Review'}
          </ThemedText>
        </TouchableOpacity>
      </View>
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
  content: {
    padding: 20,
    paddingBottom: 120,
  },
  originalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
  },
  originalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  symbol: {
    fontSize: 22,
    fontWeight: '600',
  },
  dateText: {
    fontSize: 12,
    opacity: 0.55,
  },
  originalLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.5,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  originalText: {
    fontSize: 15,
    lineHeight: 21,
  },
  divider: {
    height: 1,
    marginVertical: 14,
  },
  field: {
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  resultRow: {
    flexDirection: 'row',
    gap: 8,
  },
  resultButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  resultText: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
  },
  latestReviewCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
  },
  latestReviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.5,
    marginBottom: 6,
  },
  latestReviewText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.72,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  presetButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '600',
  },
  reviewRow: {
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 58,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewDate: {
    fontSize: 16,
    fontWeight: '600',
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePickerCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginBottom: 18,
    overflow: 'hidden',
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  dateDoneText: {
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  missingTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  missingText: {
    fontSize: 14,
    lineHeight: 20,
    opacity: 0.6,
    textAlign: 'center',
  },
});
