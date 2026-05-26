import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  addExitReview,
  cancelWhyReviewNotification,
  formatDate,
  useWhyTheses,
} from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.icon }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
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
  );
}

export default function ExitReviewScreen() {
  const params = useLocalSearchParams<{ id?: string; transactionId?: string }>();
  const id = firstParam(params.id);
  const transactionId = firstParam(params.transactionId);
  const theses = useWhyTheses();
  const thesis = useMemo(() => theses.find((item) => item.id === id), [id, theses]);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const [whatHappened, setWhatHappened] = useState(thesis?.exitReview?.whatHappened ?? '');
  const [whatWasRight, setWhatWasRight] = useState(thesis?.exitReview?.whatWasRight ?? '');
  const [whatWasWrong, setWhatWasWrong] = useState(thesis?.exitReview?.whatWasWrong ?? '');
  const [lesson, setLesson] = useState(thesis?.exitReview?.lesson ?? '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!thesis) return;
    if (!whatHappened.trim()) {
      Alert.alert('Missing Summary', 'Write what happened before saving the exit review.');
      return;
    }
    if (!lesson.trim()) {
      Alert.alert('Missing Lesson', 'Write one lesson for next time.');
      return;
    }

    setSaving(true);
    Keyboard.dismiss();
    try {
      await cancelWhyReviewNotification(thesis.reviewNotificationId);
      addExitReview(thesis.id, {
        whatHappened,
        whatWasRight,
        whatWasWrong,
        lesson,
        transactionId: transactionId ?? thesis.exitReview?.transactionId,
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
          title="Exit Review"
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
        title="Exit Review"
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
            <ThemedText style={styles.dateText}>
              {thesis.closedAt ? `Closed ${formatDate(thesis.closedAt)}` : 'Closing thesis'}
            </ThemedText>
          </View>
          <ThemedText style={styles.originalLabel}>Original thesis</ThemedText>
          <ThemedText style={styles.originalText}>{thesis.why}</ThemedText>
          <View style={[styles.divider, { backgroundColor: colors.cardBorder }]} />
          <ThemedText style={styles.originalLabel}>Invalidation condition</ThemedText>
          <ThemedText style={styles.originalText}>{thesis.invalidation}</ThemedText>
        </View>

        <TextArea
          label="What happened?"
          value={whatHappened}
          onChangeText={setWhatHappened}
          placeholder="Describe the outcome in plain language."
        />
        <TextArea
          label="What was right?"
          value={whatWasRight}
          onChangeText={setWhatWasRight}
          placeholder="What did your original reasoning get right?"
        />
        <TextArea
          label="What was wrong?"
          value={whatWasWrong}
          onChangeText={setWhatWasWrong}
          placeholder="What did you miss or misjudge?"
        />
        <TextArea
          label="Lesson for next time"
          value={lesson}
          onChangeText={setLesson}
          placeholder="What should future you remember?"
        />
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderColor: colors.headerAccent }]}>
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint, opacity: saving ? 0.6 : 1 }]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          <ThemedText style={[styles.saveButtonText, { color: colors.textOnColor }]}>
            {saving ? 'Saving...' : 'Save Lesson'}
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
  textArea: {
    minHeight: 104,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
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
