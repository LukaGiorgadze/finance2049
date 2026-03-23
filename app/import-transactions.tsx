import type { ImportedGroup, ImportedTx, TxType } from '@/components/import/types';
import { UploadStep, type QueuedFile } from '@/components/import/UploadStep';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackImportAction, trackImportScreen } from '@/lib';
import { reportError, reportWarning } from '@/lib/crashlytics';
import { importSession, type FailedFileInfo, type ImportFileInfo } from '@/lib/import-session';
import { extractTransactions } from '@/lib/services/providers/supabase/client';
import { getSupabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { decode } from 'base64-arraybuffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const MAX_FILES = 10;

type PickSource = 'camera' | 'photos' | 'files';

const SOURCE_OPTIONS: { id: PickSource; title: string; sub: string; icon: string; color: string }[] = [
  { id: 'camera', title: 'Camera', sub: 'Take a photo of your statement', icon: 'camera-outline', color: Colors.light.blue },
  { id: 'photos', title: 'Photo Library', sub: 'Choose a screenshot or photo', icon: 'image-outline', color: Colors.indigo },
  { id: 'files', title: 'Files', sub: 'PDF, CSV, Excel, JSON, or images', icon: 'folder-open-outline', color: Colors.light.green },
];

export default function ImportTransactionsScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [files, setFiles] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingCompleted, setProcessingCompleted] = useState(0);
  const [isPreparingFiles, setIsPreparingFiles] = useState(false);
  const [showSourceSheet, setShowSourceSheet] = useState(false);

  const bg = colors.surface;

  useEffect(() => {
    void trackImportScreen('upload');
  }, []);

  const MAX_IMAGE_WIDTH = 1024;

  const compressImage = async (uri: string): Promise<{ uri: string; mimeType: string }> => {
    const context = ImageManipulator.manipulate(uri);
    const ref = await context.renderAsync();

    if (ref.width > MAX_IMAGE_WIDTH) {
      context.reset();
      context.resize({ width: MAX_IMAGE_WIDTH, height: null });
    } else {
      context.reset();
    }

    const rendered = await context.renderAsync();
    const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
    const info = await FileSystem.getInfoAsync(result.uri);
    const sizeKb = (info.exists && 'size' in info && info.size != null) ? (info.size / 1024).toFixed(1) : '?';
    console.debug(`[Import] Compressed image: ${rendered.width}x${rendered.height}px, ${sizeKb} KB`);
    return { uri: result.uri, mimeType: 'image/jpeg' };
  };

  const addFiles = useCallback((newFiles: QueuedFile[]) => {
    if (newFiles.length > 0) {
      void trackImportAction({ action: 'files_added', count: newFiles.length, step: 'upload' });
    }
    setFiles(prev => {
      const remaining = MAX_FILES - prev.length;
      if (remaining <= 0) {
        Alert.alert('Limit reached', `You can upload up to ${MAX_FILES} files at once.`);
        return prev;
      }
      const toAdd = newFiles.slice(0, remaining);
      if (toAdd.length < newFiles.length) {
        Alert.alert('Some files skipped', `Only ${remaining} more file${remaining !== 1 ? 's' : ''} can be added (max ${MAX_FILES}).`);
      }
      return [...prev, ...toAdd];
    });
  }, []);

  const removeFile = useCallback((index: number) => {
    void trackImportAction({ action: 'file_removed', count: 1, step: 'upload' });
    setFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const STORAGE_BUCKET = 'extractions';
  const SIGNED_URL_TTL = 300;

  const processAllFiles = async () => {
    if (files.length === 0) return;
    const supabase = getSupabase();
    if (!supabase) {
      Alert.alert(
        'App configuration error',
        'This build is missing its Supabase configuration. Rebuild it with the production EAS environment variables.',
      );
      return;
    }

    void trackImportAction({ action: 'upload_start', count: files.length, step: 'upload' });
    setIsProcessing(true);
    setProcessingCompleted(0);

    const { data: { session } } = await supabase.auth.getSession();
    const folder = session?.user?.id ?? `anon-${Date.now()}`;

    let completed = 0;
    const tick = () => { completed++; setProcessingCompleted(completed); };
    const uploadedPaths: string[] = [];

    type FileResult =
      | { status: 'ok'; groups: ImportedGroup[]; fileInfo: ImportFileInfo }
      | { status: 'failed'; name: string; mimeType: string; error: string };

    const processOne = async (file: QueuedFile, fi: number): Promise<FileResult> => {
      const mime = file.mimeType.toLowerCase();
      const ext = (file.name.split('.').pop() ?? '').toLowerCase();
      const isText =
        mime.startsWith('text/') ||
        mime === 'application/json' ||
        ['csv', 'tsv', 'json', 'txt'].includes(ext);
      const normalizedMime = isText && !mime.startsWith('text/') && mime !== 'application/json'
        ? (ext === 'json' ? 'application/json' : `text/${ext || 'plain'}`)
        : mime;

      const lastDot = file.name.lastIndexOf('.');
      const baseName = lastDot >= 0 ? file.name.slice(0, lastDot) : file.name;
      const extPart = lastDot >= 0 ? file.name.slice(lastDot) : '';
      const storagePath = `${folder}/${baseName}-${fi}${extPart}`;

      try {
        const info = await FileSystem.getInfoAsync(file.uri);
        const sizeBytes = (info.exists && 'size' in info && info.size != null) ? info.size : 0;

        const base64Content = await FileSystem.readAsStringAsync(file.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .upload(storagePath, decode(base64Content), { contentType: normalizedMime, upsert: true });

        if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
        uploadedPaths.push(storagePath);

        const { data: urlData, error: urlError } = await supabase.storage
          .from(STORAGE_BUCKET)
          .createSignedUrl(storagePath, SIGNED_URL_TTL);

        if (urlError || !urlData?.signedUrl) throw new Error(`Signed URL failed: ${urlError?.message}`);

        const data = await extractTransactions({
          signedUrl: urlData.signedUrl,
          storagePath,
          mimeType: normalizedMime,
          fileName: file.name,
        });

        const rawTxs = data.transactions ?? [];
        if (rawTxs.length === 0) {
          return { status: 'failed', name: file.name, mimeType: file.mimeType, error: data.message || 'No transactions found' };
        }

        const groupMap = new Map<string, ImportedTx[]>();
        const groupOrder: string[] = [];
        for (const t of rawTxs) {
          const sym = (t.symbol ?? '').toUpperCase();
          if (!groupMap.has(sym)) {
            groupMap.set(sym, []);
            groupOrder.push(sym);
          }
          groupMap.get(sym)!.push({
            id: `f${fi}t${groupMap.get(sym)!.length}s${sym}`,
            date: t.date ?? '',
            quantity: t.quantity != null ? String(t.quantity) : '',
            price: t.price != null ? String(t.price) : '',
            commission: t.commission != null ? String(t.commission) : '0',
            type: (t.type === 'sell' ? 'sell' : 'buy') as TxType,
          });
        }

        const groups: ImportedGroup[] = groupOrder.map((sym, gi) => ({
          id: `f${fi}g${gi}`,
          symbol: sym,
          transactions: groupMap.get(sym)!,
        }));
        return { status: 'ok', groups, fileInfo: { name: file.name, mimeType: file.mimeType, sizeBytes } as ImportFileInfo };
      } catch (err) {
        reportWarning(`[Import] Failed to process file ${file.name}`, err, {
          fileName: file.name,
          mimeType: file.mimeType,
          fileIndex: fi,
          source: 'import_transactions',
        });
        return { status: 'failed', name: file.name, mimeType: file.mimeType, error: err instanceof Error ? err.message : 'Unknown error' };
      } finally {
        tick();
      }
    };

    try {
      const results = await Promise.all(files.map((f, i) => processOne(f, i)));

      const fileInfos: ImportFileInfo[] = [];
      const failedFiles: FailedFileInfo[] = [];
      const mergedMap = new Map<string, ImportedGroup>();
      const mergedOrder: string[] = [];

      for (const r of results) {
        if (r.status === 'ok') {
          for (const g of r.groups) {
            const key = g.symbol.toUpperCase();
            const existing = mergedMap.get(key);
            if (existing) {
              existing.transactions.push(...g.transactions);
            } else {
              mergedMap.set(key, { ...g });
              mergedOrder.push(key);
            }
          }
          fileInfos.push(r.fileInfo);
        } else {
          failedFiles.push({ name: r.name, mimeType: r.mimeType, error: r.error });
        }
      }

      const allGroups = mergedOrder.map(key => mergedMap.get(key)!);

      if (allGroups.length === 0) {
        void trackImportAction({ action: 'upload_failure', count: failedFiles.length, step: 'upload' });
        const detail = failedFiles.length > 0
          ? failedFiles.map(f => `${f.name}: ${f.error}`).join('\n')
          : 'The AI could not find any transactions in the selected files.';
        Alert.alert('No transactions found', detail);
        return;
      }

      importSession.set({
        groups: allGroups,
        fileName: fileInfos.map(f => f.name).join(', '),
        files: fileInfos,
        failedFiles,
      });
      void trackImportAction({ action: 'upload_success', count: allGroups.length, step: 'upload' });
      router.push('/import-confirm');
    } catch (err) {
      void trackImportAction({ action: 'upload_failure', count: files.length, step: 'upload' });
      reportError('[Import] Extraction failed', err, {
        fileCount: files.length,
        uploadedPathCount: uploadedPaths.length,
        source: 'import_transactions',
      });
      const msg = err instanceof Error ? err.message : 'Something went wrong';
      Alert.alert('Extraction failed', msg);
    } finally {
      if (uploadedPaths.length > 0) {
        supabase.storage.from(STORAGE_BUCKET).remove(uploadedPaths).catch((err) => {
          reportWarning('[Import] Failed to clean up uploaded files', err, {
            uploadedPathCount: uploadedPaths.length,
            storageBucket: STORAGE_BUCKET,
          });
        });
      }
      setIsProcessing(false);
      setProcessingCompleted(0);
    }
  };

  const handleBrowse = () => {
    void trackImportAction({ action: 'open_source_sheet', step: 'upload' });
    setShowSourceSheet(true);
  };

  const handlePickSource = async (source: PickSource) => {
    void trackImportAction({ action: 'pick_source', target: source, step: 'upload' });
    setShowSourceSheet(false);
    await new Promise<void>(resolve => setTimeout(resolve, 100));

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow camera access in Settings.');
        return;
      }
      try {
        const result = await ImagePicker.launchCameraAsync({ quality: 0.85 });
        if (result.canceled || !result.assets?.[0]) return;
        const { uri, fileName } = result.assets[0];
        if (uri == null) return;
        setIsPreparingFiles(true);
        try {
          const compressed = await compressImage(uri);
          addFiles([{ uri: compressed.uri, mimeType: compressed.mimeType, name: fileName ?? 'photo.jpg' }]);
        } finally {
          setIsPreparingFiles(false);
        }
      } catch (err) {
        reportWarning('[Import] Camera launch failed', err, {
          source: 'camera',
        });
        setIsPreparingFiles(false);
        Alert.alert('Camera unavailable', 'Camera is not available on this device or simulator.');
      }

    } else if (source === 'photos') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please allow photo library access in Settings.');
        return;
      }
      try {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
          allowsMultipleSelection: true,
          selectionLimit: MAX_FILES - files.length,
        });
        if (result.canceled || !result.assets?.length) return;
        setIsPreparingFiles(true);
        try {
          const compressed = await Promise.all(
            result.assets.map(async (asset) => {
              if (!asset.uri) return null;
              const c = await compressImage(asset.uri);
              return { uri: c.uri, mimeType: c.mimeType, name: asset.fileName ?? 'photo.jpg' } as QueuedFile;
            })
          );
          addFiles(compressed.filter((f): f is QueuedFile => f !== null));
        } finally {
          setIsPreparingFiles(false);
        }
      } catch (e) {
        reportWarning('[Import] Photo library selection failed', e, {
          source: 'photos',
          existingFileCount: files.length,
        });
        setIsPreparingFiles(false);
        const msg = e instanceof Error ? e.message : '';
        if (msg.includes('public.png') || msg.includes('representation')) {
          Alert.alert('Cannot read photo', 'This photo may not be downloaded from iCloud. Open it in the Photos app first, then try again.');
        } else {
          Alert.alert('Error', 'Could not open the photo.');
        }
      }

    } else {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: [
            'application/pdf',
            'text/csv',
            'text/plain',
            'application/json',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'public.comma-separated-values-text',
            'image/png',
            'image/jpeg',
            'image/jpg',
            'image/webp',
          ],
          copyToCacheDirectory: true,
          multiple: true,
        });
        if (result.canceled || !result.assets?.length) return;
        const picked: QueuedFile[] = result.assets
          .filter(a => a.uri && a.name)
          .map(a => ({ uri: a.uri, mimeType: a.mimeType ?? 'application/octet-stream', name: a.name }));
        addFiles(picked);
      } catch (err) {
        reportWarning('[Import] File picker failed', err, {
          source: 'files',
          existingFileCount: files.length,
        });
        Alert.alert('Error', 'Could not open the file picker.');
      }
    }
  };

  return (
    <View style={[s.page, { backgroundColor: bg }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <PageHeader
        title="Import Transactions"
        leftElement={
          <TouchableOpacity
            onPress={() => {
              void trackImportAction({ action: 'back', step: 'upload' });
              router.back();
            }}
            style={[s.backBtn, { backgroundColor: isDark ? colors.cardBackground : colors.surface }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} style={{ opacity: 0.7 }} />
          </TouchableOpacity>
        }
      />

      <UploadStep
        onBrowse={handleBrowse}
        isDark={isDark}
        colors={colors}
        isProcessing={isProcessing}
        processingCompleted={processingCompleted}
        processingTotal={isProcessing ? files.length : 0}
        isPreparingFiles={isPreparingFiles}
        files={files}
        onRemoveFile={removeFile}
        onConfirmUpload={processAllFiles}
      />

      {/* Source picker bottom sheet */}
      <Modal visible={showSourceSheet} transparent animationType="none">
        <Pressable style={[s.overlay, { backgroundColor: colors.overlay }]} onPress={() => {
          void trackImportAction({ action: 'close_source_sheet', step: 'upload' });
          setShowSourceSheet(false);
        }}>
          <Pressable
            style={[s.sheet, { backgroundColor: colors.cardBackground, paddingBottom: Math.max(insets.bottom, 8) + 16 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={[s.handle, { backgroundColor: colors.iconMuted }]} />
            <Text style={[s.sheetTitle, { color: colors.text }]}>Choose Source</Text>
            {SOURCE_OPTIONS.map((opt, i) => (
              <TouchableOpacity
                key={opt.id}
                style={[s.option, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.divider }]}
                onPress={() => handlePickSource(opt.id)}
                activeOpacity={0.7}
              >
                <View style={[s.optIcon, { backgroundColor: opt.color + '22' }]}>
                  <Ionicons name={opt.icon as any} size={22} color={opt.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optTitle, { color: colors.text }]}>{opt.title}</Text>
                  <Text style={[s.optSub, { color: colors.icon }]}>{opt.sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={colors.icon} />
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[s.cancel, { borderTopColor: colors.cardBorder }]}
              onPress={() => {
                void trackImportAction({ action: 'close_source_sheet', step: 'upload' });
                setShowSourceSheet(false);
              }}
            >
              <Text style={[s.cancelText, { color: colors.icon }]}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  page: { flex: 1 },
  backBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },

  // Source picker
  overlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.1, paddingHorizontal: 20, marginBottom: 8, opacity: 0.5 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20, gap: 14 },
  optIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  optTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  optSub: { fontSize: 12 },
  cancel: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 16, alignItems: 'center' },
  cancelText: { fontSize: 16, fontWeight: '500' },
});
