import { Colors } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { fileIconForMime } from './ConfirmStep';
import { WizardSteps } from './WizardSteps';

const MAX_FILES = 10;
const FORMATS = ['Screenshot', 'PDF', 'CSV', 'Excel', 'JSON'];

function SparkleIcon() {
  const rotation  = useRef(new Animated.Value(0)).current;
  const breathe   = useRef(new Animated.Value(0)).current;
  const shimmer   = useRef(new Animated.Value(0)).current;
  const orbit1    = useRef(new Animated.Value(0)).current;
  const orbit2    = useRef(new Animated.Value(0)).current;
  const orbit3    = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(rotation, { toValue: 1, duration: 5000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ])).start();

    Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 1, duration: 1600, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.delay(400),
      Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(600),
    ])).start();

    Animated.loop(
      Animated.timing(orbit1, { toValue: 1, duration: 2800, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(orbit2, { toValue: 1, duration: 4500, easing: Easing.linear, useNativeDriver: true })
    ).start();
    Animated.loop(
      Animated.timing(orbit3, { toValue: 1, duration: 6800, easing: Easing.linear, useNativeDriver: true })
    ).start();
  }, [breathe, orbit1, orbit2, orbit3, rotation, shimmer]);

  const spin         = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const scale        = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1.12] });
  const glowOpacity  = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.40] });
  const glowScale    = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.65] });
  const ringScale    = shimmer.interpolate({ inputRange: [0, 1], outputRange: [1, 3.2] });
  const ringOpacity  = shimmer.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0.75, 0.30, 0] });
  const o1           = orbit1.interpolate({ inputRange: [0, 1],  outputRange: ['0deg',   '360deg'] });
  const o2           = orbit2.interpolate({ inputRange: [0, 1],  outputRange: ['120deg', '480deg'] });
  const o3           = orbit3.interpolate({ inputRange: [0, 1],  outputRange: ['240deg', '-120deg'] });

  return (
    <View style={sa.container}>
      <Animated.View style={[sa.glow, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[sa.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]} />

      <Animated.View style={[sa.orbit, { top: 30, left: 30, width: 80, height: 80, transform: [{ rotate: o1 }] }]}>
        <View style={{ position: 'absolute', top: -2, left: 35 }}>
          <Ionicons name="sparkles" size={9} color={Colors.indigo} />
        </View>
      </Animated.View>

      <Animated.View style={[sa.orbit, { top: 15, left: 15, width: 110, height: 110, transform: [{ rotate: o2 }] }]}>
        <View style={{ position: 'absolute', top: -2, left: 51 }}>
          <Ionicons name="star" size={7} color={Colors.indigoLight} />
        </View>
      </Animated.View>

      <Animated.View style={[sa.orbit, { top: 3, left: 3, width: 134, height: 134, transform: [{ rotate: o3 }] }]}>
        <View style={{ position: 'absolute', top: -2, left: 63 }}>
          <Ionicons name="sparkles" size={7} color={Colors.indigoLight} />
        </View>
      </Animated.View>

      <Animated.View style={{ transform: [{ rotate: spin }, { scale }] }}>
        <Ionicons name="sparkles" size={32} color={Colors.indigo} />
      </Animated.View>
    </View>
  );
}

export interface QueuedFile {
  uri: string;
  name: string;
  mimeType: string;
}

interface Props {
  onBrowse: () => void;
  isDark: boolean;
  colors: typeof Colors.light;
  isProcessing?: boolean;
  processingCompleted?: number;
  processingTotal?: number;
  isPreparingFiles?: boolean;
  files: QueuedFile[];
  onRemoveFile: (index: number) => void;
  onConfirmUpload: () => void;
}

export function UploadStep({
  onBrowse, isDark, colors, isProcessing = false, processingCompleted = 0, processingTotal = 0, isPreparingFiles = false,
  files, onRemoveFile, onConfirmUpload,
}: Props) {
  const hasFiles = files.length > 0;
  const canAddMore = files.length < MAX_FILES;
  const showProgress = isProcessing && processingTotal > 0;

  return (
    <View style={s.wrapper}>
      <View style={[s.zone, { borderColor: colors.cardBorder, backgroundColor: colors.rowSurface }]}>
        {isPreparingFiles ? (
          <View style={s.processingContent}>
            <ActivityIndicator size="large" color={Colors.indigo} style={s.processingSpinner} />
            <Text style={[s.zoneTitle, { color: colors.text }]}>Preparing your images</Text>
            <Text style={[s.zoneSub, { color: colors.icon }]}>
              Compressing and adding to the list. This may take a moment.
            </Text>
          </View>
        ) : isProcessing ? (
          <View style={s.processingContent}>
            <SparkleIcon />
            <Text style={[s.zoneTitle, { color: colors.text }]}>
              Processing file{files.length > 1 ? 's' : ''}{showProgress ? ` ${processingCompleted}/${processingTotal}` : ''}
            </Text>
            <Text style={[s.zoneSub, { color: colors.icon }]}>
              Extracting dates, symbols, quantities, and prices.
            </Text>
            <View style={[s.stayOpenBanner, { backgroundColor: Colors.indigo + '14', borderColor: Colors.indigo + '28' }]}>
              <Ionicons name="phone-portrait-outline" size={18} color={Colors.indigo} style={s.stayOpenIcon} />
              <Text style={[s.stayOpenTitle, { color: colors.text }]}>Keep this screen open</Text>
              <Text style={[s.stayOpenSub, { color: colors.icon }]}>
                Import can take up to a minute. Leaving may interrupt it.
              </Text>
            </View>
          </View>
        ) : hasFiles ? (
          <View style={s.filesContainer}>
            {/* Header row */}
            <View style={s.filesHeader}>
              <Ionicons name="documents-outline" size={18} color={Colors.indigo} />
              <Text style={[s.filesHeaderText, { color: colors.text }]}>
                {files.length} file{files.length !== 1 ? 's' : ''} selected
              </Text>
              <Text style={[s.filesLimit, { color: colors.icon }]}>
                {files.length}/{MAX_FILES}
              </Text>
            </View>

            {/* Scrollable file list */}
            <ScrollView
              style={s.filesList}
              contentContainerStyle={s.filesListContent}
              showsVerticalScrollIndicator={true}
            >
              {files.map((file, index) => {
                const fi = fileIconForMime(file.name, file.mimeType);
                return (
                  <View
                    key={`${file.name}-${index}`}
                    style={[s.fileRow, { backgroundColor: colors.surface, borderColor: colors.cardBorder }]}
                  >
                    <View style={[s.fileIconWrap, { backgroundColor: fi.color + '18' }]}>
                      <Ionicons name={fi.icon as any} size={16} color={fi.color} />
                    </View>
                    <Text style={[s.fileRowName, { color: colors.text }]} numberOfLines={1} ellipsizeMode="middle">
                      {file.name}
                    </Text>
                    <TouchableOpacity
                      onPress={() => onRemoveFile(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      style={[s.removeBtn, { backgroundColor: colors.cardBorder + '80' }]}
                    >
                      <Ionicons name="close" size={14} color={colors.icon} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            {/* Bottom actions */}
            <View style={s.filesActions}>
              {canAddMore && (
                <TouchableOpacity style={[s.addMoreBtn, { borderColor: colors.surfaceElevated }]} onPress={onBrowse} activeOpacity={0.85}>
                  <Ionicons name="add" size={16} color={colors.text} style={{ opacity: 0.6, marginRight: -2 }} />
                  <Text style={[s.addMoreText, { color: colors.text }]}>Add More</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={s.confirmBtn} onPress={onConfirmUpload} activeOpacity={0.85}>
                <Ionicons name="cloud-upload-outline" size={16} color={colors.textOnColor} style={{ marginRight: 6 }} />
                <Text style={s.confirmBtnText}>Upload {`file${files.length !== 1 ? 's' : ''}`}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={s.emptyContent}>
            <View style={s.zoneIcon}>
              <Ionicons name="cloud-upload-outline" size={48} color={Colors.indigo} />
            </View>
            <Text style={[s.zoneTitle, { color: colors.text }]}>Upload your files</Text>
            <Text style={[s.zoneSub, { color: colors.icon }]}>
              AI extracts your transactions automatically.{'\n'}Any popular format is supported.
            </Text>
            <TouchableOpacity style={s.browseBtn} onPress={onBrowse} activeOpacity={0.85}>
              <Ionicons name="folder-open-outline" size={16} color={colors.textOnColor} style={{ marginRight: 7 }} />
              <Text style={s.browseBtnText}>Browse Files</Text>
            </TouchableOpacity>
            <Text style={[s.formatsLine, { color: colors.icon }]}>
              {FORMATS.join('  ·  ')}
            </Text>
          </View>
        )}
      </View>

      {/* Wizard progress — at the very bottom */}
      <View style={s.bottomSection}>
        <WizardSteps currentStep={isProcessing ? 2 : 1} isDark={isDark} colors={colors} />
        <View style={s.privacyRow}>
          <Ionicons name="shield-checkmark-outline" size={12} color={colors.icon} style={{ marginRight: 5 }} />
          <Text style={[s.privacy, { color: colors.icon }]}>
            Your files are processed securely and never stored.
          </Text>
        </View>
      </View>
    </View>
  );
}

const sa = StyleSheet.create({
  container: { width: 140, height: 140, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', top: 41, left: 41, width: 58, height: 58, borderRadius: 29, backgroundColor: Colors.indigo + '55' },
  ring: { position: 'absolute', top: 41, left: 41, width: 58, height: 58, borderRadius: 29, borderWidth: 1.5, borderColor: Colors.indigo },
  orbit: { position: 'absolute' },
});

const s = StyleSheet.create({
  wrapper: { flex: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 16, justifyContent: 'space-between' },

  zone: {
    flex: 1,
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 24,
    overflow: 'hidden',
  },

  // Empty state — centered content
  emptyContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoneIcon: { borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  zoneTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.5, marginBottom: 8, marginTop: 20 },
  zoneSub: { fontSize: 13.5, textAlign: 'center', lineHeight: 20, paddingHorizontal: 32, marginBottom: 22 },

  // “Stay on screen” callout — visible during processing
  stayOpenBanner: {
    marginTop: 20,
    marginHorizontal: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  stayOpenIcon: { marginBottom: 8 },
  stayOpenTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 4 },
  stayOpenSub: { fontSize: 13, textAlign: 'center', lineHeight: 18, paddingHorizontal: 8 },
  fileName: { fontSize: 14, fontWeight: '600', marginBottom: 6, paddingHorizontal: 24, maxWidth: '100%' },
  browseBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.indigo, paddingHorizontal: 26, paddingVertical: 14, borderRadius: 16, marginBottom: 20 },
  browseBtnText: { color: Colors.light.textOnColor, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  formatsLine: { fontSize: 11, opacity: 0.4, letterSpacing: 0.2 },

  // Processing state — centered content
  processingContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  processingSpinner: { marginBottom: 12 },

  // Files list state
  filesContainer: { flex: 1, padding: 16 },
  filesHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  filesHeaderText: { fontSize: 15, fontWeight: '700', flex: 1 },
  filesLimit: { fontSize: 12, fontWeight: '500', opacity: 0.6 },

  filesList: { flex: 1 },
  filesListContent: { gap: 8 },

  fileRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, paddingLeft: 12, paddingRight: 8,
    borderRadius: 14, borderWidth: 1,
    gap: 10,
  },
  fileIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  fileRowName: { flex: 1, fontSize: 13.5, fontWeight: '500' },
  removeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  filesActions: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 10 },
  addMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14,
    borderWidth: 1.5, gap: 4,
  },
  addMoreText: { fontSize: 14, fontWeight: '600' },
  confirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.indigo,
    paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14,
  },
  confirmBtnText: { color: Colors.light.textOnColor, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },

  // Bottom section
  bottomSection: { paddingTop: 24, gap: 24 },
  privacyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  privacy: { fontSize: 11, lineHeight: 16 },
});
