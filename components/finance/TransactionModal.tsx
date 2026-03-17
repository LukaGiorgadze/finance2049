import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TransactionData, TransactionForm } from './TransactionForm';

interface TransactionModalProps {
  visible: boolean;
  onClose: () => void;
  initialSymbol?: string;
  initialName?: string;
  initialType?: 'buy' | 'sell';
  initialAssetType?: import('@/lib/store/types').AssetType;
  onSubmit?: (data: TransactionData) => void;
}

export function TransactionModal({ visible, onClose, initialSymbol, initialName, initialType, initialAssetType, onSubmit }: TransactionModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? Colors.dark : Colors.light;
  const insets = useSafeAreaInsets();
  const textColor = colors.text;

  const handleSubmit = (data: TransactionData) => {
    onSubmit?.(data);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: colors.surface }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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
            onClose();
            setTimeout(() => router.push('/import-transactions'), 350);
          }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
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
