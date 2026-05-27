import { ThemedText } from '@/components/themed-text';
import { AppBottomSheetModal } from '@/components/ui/app-bottom-sheet';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { trackTransactionsAction, useInAppMessageSuppression } from '@/lib';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheetView } from '@gorhom/bottom-sheet';
import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionData, TransactionForm } from './TransactionForm';
import type { Transaction } from '@/lib/store/types';

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialName?: string;
  initialType?: 'buy' | 'sell';
  initialAssetType?: import('@/lib/store/types').AssetType;
  onSubmit?: (data: TransactionData) => void | boolean | Transaction | Promise<void | boolean | Transaction>;
  analyticsContext?: string;
}

export function TransactionModal({ visible, onClose, initialSymbol, initialName, initialType, initialAssetType, onSubmit, analyticsContext = 'transaction_modal' }: TransactionModalProps) {
  useInAppMessageSuppression(visible);

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const textColor = colors.text;
  const wasVisibleRef = useRef(false);

  useEffect(() => {
    if (visible && !wasVisibleRef.current) {
      void trackTransactionsAction({
        action: 'modal_open',
        target: initialType ?? 'buy',
        context: analyticsContext,
      });
    }

    if (!visible && wasVisibleRef.current) {
      void trackTransactionsAction({ action: 'modal_close', context: analyticsContext });
    }

    wasVisibleRef.current = visible;
  }, [analyticsContext, initialType, visible]);

  const handleSubmit = (data: TransactionData) => {
    return onSubmit?.(data);
  };

  return (
    <AppBottomSheetModal
      visible={visible}
      onDismiss={onClose}
      snapPoints={['96%']}
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      backgroundColor={colors.surface}
      backdropColor={colors.overlayStrong}
      handleIndicatorColor={colors.iconMuted}
      topInset={insets.top}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <BottomSheetView style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <ThemedText style={styles.headerTitle}>Record Transaction</ThemedText>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={28} color={textColor} />
          </TouchableOpacity>
        </View>

        {/* Sleek accent line */}
        <View style={[
          styles.headerAccent,
          { backgroundColor: colors.headerAccent }
        ]} />

        {/* Transaction Form */}
        <TransactionForm
          initialSymbol={initialSymbol}
          initialName={initialName}
          initialType={initialType}
          initialAssetType={initialAssetType}
          onSubmit={handleSubmit}
          onCancel={onClose}
          onDone={onClose}
          onImportPress={() => {
            void trackTransactionsAction({ action: 'modal_import', context: analyticsContext });
            onClose();
            setTimeout(() => router.push('/import-transactions'), 350);
          }}
          useBottomSheetTextInputs
          analyticsContext={analyticsContext}
        />
      </BottomSheetView>
    </AppBottomSheetModal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 32,
  },
  closeButton: {
    marginLeft: 16,
  },
  headerAccent: {
    height: 1,
    width: '100%',
  },
});
