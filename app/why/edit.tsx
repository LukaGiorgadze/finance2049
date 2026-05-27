import { AssetSearchModal } from '@/components/finance/AssetSearchModal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import {
  archiveThesis,
  cancelWhyReviewNotification,
  createOrUpdateActiveThesis,
  deleteThesis,
  formatLocalDateISO,
  scheduleWhyReviewNotification,
  useWhyTheses,
} from '@/lib';
import type { TickerSearchResult } from '@/lib/services/types';
import { mapApiTypeToAssetType } from '@/lib/utils/assetLookup';
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
  StyleProp,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OptionalSection = 'assumptions' | 'risks' | 'watchItems';

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

function TextArea({
  label,
  value,
  onChangeText,
  placeholder,
  minHeight = 104,
  containerStyle,
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  minHeight?: number;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  return (
    <View style={[styles.field, containerStyle]}>
      {!!label && <Text style={[styles.label, { color: colors.icon }]}>{label}</Text>}
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
            minHeight,
            color: colors.text,
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
          },
        ]}
      />
    </View>
  );
}

export default function EditWhyScreen() {
  const params = useLocalSearchParams<{
    id?: string;
    symbol?: string;
    assetName?: string;
    assetType?: string;
    transactionId?: string;
  }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const theses = useWhyTheses();
  const id = firstParam(params.id);
  const routeSymbol = firstParam(params.symbol)?.toUpperCase();
  const existing = useMemo(() => {
    if (id) return theses.find((thesis) => thesis.id === id);
    if (routeSymbol) {
      return theses.find((thesis) => thesis.symbol === routeSymbol && thesis.status === 'active');
    }
    return undefined;
  }, [id, routeSymbol, theses]);
  const transactionId = firstParam(params.transactionId);

  const [symbol, setSymbol] = useState(existing?.symbol ?? routeSymbol ?? '');
  const [assetName, setAssetName] = useState(existing?.assetName ?? firstParam(params.assetName) ?? '');
  const [assetType, setAssetType] = useState(existing?.assetType ?? firstParam(params.assetType));
  const [why, setWhy] = useState(existing?.why ?? '');
  const [invalidation, setInvalidation] = useState(existing?.invalidation ?? '');
  const [reviewDate, setReviewDate] = useState(existing?.reviewDate ?? formatLocalDateISO(addDays(30)));
  const [notifyOnReview, setNotifyOnReview] = useState(existing?.notifyOnReview ?? false);
  const [assumptions, setAssumptions] = useState(existing?.assumptions ?? '');
  const [risks, setRisks] = useState(existing?.risks ?? '');
  const [watchItems, setWatchItems] = useState(existing?.watchItems ?? '');
  const [openSections, setOpenSections] = useState<Record<OptionalSection, boolean>>({
    assumptions: !!existing?.assumptions,
    risks: !!existing?.risks,
    watchItems: !!existing?.watchItems,
  });
  const [searchVisible, setSearchVisible] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (!existing) return;
    setSymbol(existing.symbol);
    setAssetName(existing.assetName ?? '');
    setAssetType(existing.assetType);
    setWhy(existing.why);
    setInvalidation(existing.invalidation);
    setReviewDate(existing.reviewDate);
    setNotifyOnReview(existing.notifyOnReview);
    setAssumptions(existing.assumptions ?? '');
    setRisks(existing.risks ?? '');
    setWatchItems(existing.watchItems ?? '');
    setOpenSections({
      assumptions: !!existing.assumptions,
      risks: !!existing.risks,
      watchItems: !!existing.watchItems,
    });
  }, [existing]);

  const selectAsset = (asset: TickerSearchResult) => {
    setSymbol(asset.symbol);
    setAssetName(asset.name);
    setAssetType(mapApiTypeToAssetType(asset.type, asset.market));
    setSearchVisible(false);
  };

  const setPreset = (days: number) => {
    setShowDatePicker(false);
    setReviewDate(formatLocalDateISO(addDays(days)));
  };

  const onDateChange = (_event: unknown, selectedDate?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (!selectedDate) return;

    const today = formatLocalDateISO(new Date());
    const selected = formatLocalDateISO(selectedDate);
    setReviewDate(selected < today ? today : selected);
  };

  const toggleSection = (section: OptionalSection) => {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  };

  const save = async () => {
    if (removing) return;
    const cleanSymbol = symbol.toUpperCase().trim();
    if (!cleanSymbol) {
      Alert.alert('Missing Symbol', 'Choose a stock or ETF first.');
      return;
    }
    if (!why.trim()) {
      Alert.alert('Missing Thesis', 'Write why you are buying or holding this.');
      return;
    }
    if (!invalidation.trim()) {
      Alert.alert('Missing Invalidation', 'Write what would prove this thesis wrong.');
      return;
    }
    if (!reviewDate) {
      Alert.alert('Missing Review Date', 'Choose when to review this thesis.');
      return;
    }

    setSaving(true);
    Keyboard.dismiss();

    try {
      let thesis = createOrUpdateActiveThesis({
        id: existing?.id,
        symbol: cleanSymbol,
        assetName: assetName || undefined,
        assetType,
        why,
        invalidation,
        reviewDate,
        notifyOnReview: false,
        reviewNotificationId: undefined,
        assumptions,
        risks,
        watchItems,
        linkedTransactionIds: transactionId ? [transactionId] : undefined,
      });

      if (notifyOnReview) {
        const result = await scheduleWhyReviewNotification({
          thesisId: thesis.id,
          symbol: cleanSymbol,
          reviewDate,
          previousNotificationId: existing?.reviewNotificationId,
        });

        if (result.enabled) {
          thesis = createOrUpdateActiveThesis({
            id: thesis.id,
            symbol: cleanSymbol,
            assetName: assetName || undefined,
            assetType,
            why,
            invalidation,
            reviewDate,
            notifyOnReview: true,
            reviewNotificationId: result.notificationId,
            assumptions,
            risks,
            watchItems,
            linkedTransactionIds: transactionId ? [transactionId] : undefined,
          });
        } else {
          Alert.alert('Reminder Not Enabled', result.message ?? 'Notification permission was not granted.');
        }
      } else {
        await cancelWhyReviewNotification(existing?.reviewNotificationId);
      }

      router.back();
    } finally {
      setSaving(false);
    }
  };

  const archiveExistingThesis = async () => {
    if (!existing || removing) return;

    setRemoving(true);
    Keyboard.dismiss();

    try {
      await cancelWhyReviewNotification(existing.reviewNotificationId);
      archiveThesis(existing.id);
      router.back();
    } finally {
      setRemoving(false);
    }
  };

  const deleteExistingThesis = async () => {
    if (!existing || removing) return;

    setRemoving(true);
    Keyboard.dismiss();

    try {
      await cancelWhyReviewNotification(existing.reviewNotificationId);
      deleteThesis(existing.id);
      router.back();
    } finally {
      setRemoving(false);
    }
  };

  const showThesisOptions = () => {
    if (!existing) return;

    Alert.alert(
      'Thesis Options',
      'Archive keeps the record in history. Delete removes it permanently.',
      [
        {
          text: 'Archive',
          onPress: () => {
            void archiveExistingThesis();
          },
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Thesis?',
              'This permanently deletes the thesis, review notes, and exit review.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    void deleteExistingThesis();
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const renderOptionalSection = (
    section: OptionalSection,
    title: string,
    value: string,
    onChangeText: (value: string) => void,
    placeholder: string,
  ) => (
    <View style={styles.optionalSection}>
      <TouchableOpacity
        style={[styles.optionalHeader, { borderColor: colors.cardBorder }]}
        onPress={() => toggleSection(section)}
        activeOpacity={0.75}
      >
        <View style={styles.optionalTitleRow}>
          <Ionicons
            name={openSections[section] ? 'remove-circle-outline' : 'add-circle-outline'}
            size={20}
            color={colors.icon}
          />
          <ThemedText style={styles.optionalTitle}>{title}</ThemedText>
        </View>
        <Ionicons
          name={openSections[section] ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={colors.icon}
        />
      </TouchableOpacity>
      {openSections[section] && (
        <TextArea
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          minHeight={78}
          containerStyle={styles.optionalTextAreaField}
        />
      )}
    </View>
  );

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title={existing ? 'Edit Thesis' : 'Write Thesis'}
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
        }
        rightElement={
          existing ? (
            <TouchableOpacity
              onPress={showThesisOptions}
              style={styles.headerButton}
              disabled={removing}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="ellipsis-horizontal" size={24} color={colors.text} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.icon }]}>Stock/ETF Symbol</Text>
          <TouchableOpacity
            style={[styles.symbolButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={() => setSearchVisible(true)}
            activeOpacity={0.75}
          >
            <Ionicons name="search" size={20} color={colors.icon} />
            <View style={styles.symbolTextColumn}>
              <ThemedText style={[styles.symbolText, { color: symbol ? colors.text : colors.icon }]}>
                {symbol || 'Choose a symbol'}
              </ThemedText>
              {!!assetName && <ThemedText style={styles.assetName} numberOfLines={1}>{assetName}</ThemedText>}
            </View>
          </TouchableOpacity>
        </View>

        <TextArea
          label="Why are you buying or holding this?"
          value={why}
          onChangeText={setWhy}
          placeholder="I own this because..."
        />

        <TextArea
          label="What would prove you wrong?"
          value={invalidation}
          onChangeText={setInvalidation}
          placeholder="I should revisit this if..."
        />

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.icon }]}>Review this in</Text>
          <View style={styles.presetRow}>
            {[30, 90].map((days) => (
              <TouchableOpacity
                key={days}
                style={[
                  styles.presetButton,
                  {
                    backgroundColor: reviewDate === formatLocalDateISO(addDays(days)) ? colors.tint : colors.cardBackground,
                    borderColor: colors.cardBorder,
                  },
                ]}
                onPress={() => setPreset(days)}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.presetText,
                  { color: reviewDate === formatLocalDateISO(addDays(days)) ? colors.textOnColor : colors.text },
                ]}>
                  {days} days
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.presetButton, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
              onPress={() => {
                Keyboard.dismiss();
                setShowDatePicker(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.presetText, { color: colors.text }]}>Custom</Text>
            </TouchableOpacity>
          </View>
          <View style={[styles.reviewRow, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <View>
              <ThemedText style={styles.reviewDate}>{reviewDate}</ThemedText>
              <ThemedText style={styles.reviewHint}>Next review date</ThemedText>
            </View>
            <View style={styles.notifyRow}>
              <Ionicons name="notifications-outline" size={18} color={colors.icon} />
              <Switch value={notifyOnReview} onValueChange={setNotifyOnReview} />
            </View>
          </View>
        </View>

        {showDatePicker && (
          <View style={[styles.datePickerCard, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
            <DateTimePicker
              value={parseDateKey(reviewDate)}
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

        {renderOptionalSection(
          'assumptions',
          'Add assumptions',
          assumptions,
          setAssumptions,
          'What must be true for this thesis to work?',
        )}
        {renderOptionalSection(
          'risks',
          'Add risks',
          risks,
          setRisks,
          'What could hurt this idea?',
        )}
        {renderOptionalSection(
          'watchItems',
          'Add watch items',
          watchItems,
          setWatchItems,
          'What catalysts, metrics, or events should you monitor?',
        )}
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.surface,
            borderColor: colors.headerAccent,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.tint, opacity: saving || removing ? 0.6 : 1 }]}
          onPress={save}
          disabled={saving || removing}
          activeOpacity={0.85}
        >
          <ThemedText style={[styles.saveButtonText, { color: colors.textOnColor }]}>
            {saving ? 'Saving...' : removing ? 'Working...' : 'Save Thesis'}
          </ThemedText>
        </TouchableOpacity>
      </View>

      <AssetSearchModal
        visible={searchVisible}
        onClose={() => setSearchVisible(false)}
        onSelectAsset={selectAsset}
        analyticsContext="why_editor"
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
    padding: 16,
    paddingBottom: 120,
  },
  field: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    lineHeight: 20,
  },
  symbolButton: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  symbolTextColumn: {
    flex: 1,
  },
  symbolText: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '500',
  },
  assetName: {
    fontSize: 12,
    lineHeight: 15,
    opacity: 0.55,
  },
  presetRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  presetButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetText: {
    fontSize: 13,
    fontWeight: '500',
  },
  reviewRow: {
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 52,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewDate: {
    fontSize: 16,
    lineHeight: 18,
    fontWeight: '500',
  },
  reviewHint: {
    fontSize: 12,
    lineHeight: 15,
    opacity: 0.5,
  },
  notifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  datePickerCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 14,
    overflow: 'hidden',
  },
  dateDoneButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  dateDoneText: {
    fontSize: 16,
    fontWeight: '500',
  },
  optionalSection: {
    marginBottom: 12,
  },
  optionalHeader: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionalTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  optionalTextAreaField: {
    marginTop: 8,
    marginBottom: 0,
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
});
