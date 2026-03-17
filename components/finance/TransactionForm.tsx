import { Input } from '@/components/ui/input';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { APP_CACHE_KEY } from '@/lib/hooks/useRefreshPortfolioPrices';
import { useHolding } from '@/lib/hooks/useStore';
import { marketDataService } from '@/lib/services/marketDataService';
import type { TickerSearchResult } from '@/lib/services/types';
import type { AssetType } from '@/lib/store/types';
import { mapApiTypeToAssetType } from '@/lib/utils/assetLookup';
import { useTransactionType } from '@/lib/contexts/TransactionTypeContext';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AssetSearchModal } from './AssetSearchModal';

type TransactionType = 'buy' | 'sell';

interface TransactionFormProps {
  initialSymbol?: string;
  initialName?: string;
  initialType?: TransactionType;
  initialAssetType?: AssetType;
  onSubmit?: (data: TransactionData) => void;
  onCancel?: () => void;
  /** When provided, the confirmation alert includes a "Done" button that calls this after recording. */
  onDone?: () => void;
  /**
   * Called when the user taps "Import". If omitted the form navigates to
   * /import-transactions directly. Pass a custom handler when the form lives
   * inside a Modal so the caller can dismiss the modal first.
   */
  onImportPress?: () => void;
}

export interface TransactionData {
  type: TransactionType;
  symbol: string;
  name?: string;
  quantity: string;
  date: Date;
  price: string;
  commission: string;
  assetType?: AssetType;
}

export function TransactionForm({ initialSymbol = '', initialType = 'buy', initialAssetType, initialName, onSubmit, onCancel, onDone, onImportPress }: TransactionFormProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];

  const { setTransactionType: setGlobalTransactionType } = useTransactionType();
  const [transactionType, setTransactionType] = useState<TransactionType>(initialType);

  // Sync transaction type to global context for tab icon color
  useEffect(() => {
    setGlobalTransactionType(transactionType);
  }, [transactionType, setGlobalTransactionType]);
  const [ticker, setTicker] = useState(initialSymbol);
  const [assetName, setAssetName] = useState(initialName ?? '');
  const [assetType, setAssetType] = useState<AssetType | undefined>(initialAssetType);
  const [quantityMode, setQuantityMode] = useState<'shares' | 'amount'>('shares');
  const [quantity, setQuantity] = useState('');
  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [price, setPrice] = useState('');
  const [priceLoading, setPriceLoading] = useState(false);
  const [commission, setCommission] = useState('');
  const [showSearchModal, setShowSearchModal] = useState(false);
  const holding = useHolding(ticker);

  const maxDate = new Date();

  // Import button magic animation
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const sparkleScale = useRef(new Animated.Value(1)).current;
  const sparkleRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    const sparkle = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sparkleScale, { toValue: 1.35, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sparkleRotate, { toValue: 1, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(sparkleScale, { toValue: 1, duration: 500, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
          Animated.timing(sparkleRotate, { toValue: 0, duration: 500, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.delay(2000),
      ])
    );
    shimmer.start();
    sparkle.start();
    return () => {
      shimmer.stop();
      sparkle.stop();
    };
  }, [shimmerAnim, sparkleScale, sparkleRotate]);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 0.3, 0.55, 1],
    outputRange: [-100, -100, 100, 100],
  });
  const sparkleRotateDeg = sparkleRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '25deg'],
  });

  const handleImportPress = () => {
    if (onImportPress) {
      onImportPress();
    } else {
      router.push('/import-transactions');
    }
  };

  // Fetch price whenever ticker or date changes
  useEffect(() => {
    if (!ticker) return;
    let cancelled = false;
    setPriceLoading(true);

    const fetchPrice = async () => {
      try {
        const todayStr = new Date().toISOString().split('T')[0];
        const dateStr = date.toISOString().split('T')[0];
        const isToday = dateStr === todayStr;

        // For today, try the live quote first
        if (isToday) {
          const quote = await marketDataService.getQuote(ticker);
          if (!cancelled && quote.price) {
            setPrice(quote.price.toString());
            return;
          }
        }

        // For past dates, or today when market is closed (price is 0),
        // fetch the historical bar and use the volume-weighted average price
        const bars = await marketDataService.getHistoricalBars({
          symbol: ticker,
          timelineType: '1D',
          from: dateStr,
          to: dateStr,
        });
        if (!cancelled && bars.length > 0) {
          const bar = bars[bars.length - 1];
          setPrice((bar.vw ?? bar.close).toString());
        }
      } catch {
        // Leave price unchanged if fetch fails
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    };

    fetchPrice();
    return () => { cancelled = true; };
  }, [ticker, date]);

  const handleSelectAsset = (asset: TickerSearchResult) => {
    setTicker(asset.symbol);
    setAssetName(asset.name);
    setAssetType(mapApiTypeToAssetType(asset.type, asset.market));
    setShowSearchModal(false);
    setDate(new Date());
  };

  const handleQuantityModeChange = (mode: 'shares' | 'amount') => {
    if (mode !== quantityMode) {
      setQuantity('');
      setQuantityMode(mode);
    }
  };

  const resetForm = () => {
    setTransactionType('buy');
    setQuantityMode('shares');
    setQuantity('');
    setDate(new Date());
    setPrice('');
    setCommission('');
    setTicker('');
    setAssetName('');
    setAssetType(undefined);
  };

  const handleSubmit = () => {
    if (!ticker.trim()) {
      Alert.alert('Missing Symbol', 'Please enter a ticker symbol.');
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      Alert.alert('Invalid Price', 'Please enter a valid price per share.');
      return;
    }

    const parsedInput = parseFloat(quantity);
    if (isNaN(parsedInput) || parsedInput <= 0) {
      Alert.alert(
        quantityMode === 'shares' ? 'Invalid Quantity' : 'Invalid Amount',
        quantityMode === 'shares' ? 'Please enter a valid number of shares.' : 'Please enter a valid dollar amount.',
      );
      return;
    }

    const shares = quantityMode === 'amount' ? parsedInput / parsedPrice : parsedInput;
    const sharesRounded = Math.round(shares * 1e6) / 1e6;

    if (transactionType === 'sell') {
      const available = holding?.totalShares ?? 0;
      if (sharesRounded > available + 1e-9) {
        Alert.alert(
          'Insufficient Shares',
          available > 0
            ? `You only hold ${parseFloat(available.toPrecision(15))} shares of ${ticker.toUpperCase().trim()}. You cannot sell ${sharesRounded} shares.`
            : `You don't hold any shares of ${ticker.toUpperCase().trim()}.`,
        );
        return;
      }
    }

    const label = transactionType === 'buy' ? 'Purchased' : 'Sold';
    const sharesDisplay = sharesRounded % 1 === 0 ? sharesRounded.toString() : sharesRounded.toFixed(4);
    const message = quantityMode === 'amount'
      ? `${label} ${sharesDisplay} shares of ${ticker.toUpperCase().trim()} at $${parsedPrice}/share ($${parsedInput.toFixed(2)} total).`
      : `${label} ${sharesDisplay} shares of ${ticker.toUpperCase().trim()} at $${parsedPrice}/share.`;

    const submit = async () => {
      onSubmit?.({
        type: transactionType,
        symbol: ticker,
        name: assetName || undefined,
        quantity: sharesRounded.toString(),
        date,
        price,
        commission,
        assetType,
      });
      await AsyncStorage.removeItem(APP_CACHE_KEY);
    };

    void submit();
    Alert.alert('Transaction Recorded', message, onDone
      ? [
        { text: 'Record Another', onPress: () => { resetForm(); } },
        { text: 'OK', style: 'cancel', onPress: () => { onDone(); } },
      ]
      : [{ text: 'OK', style: 'cancel', onPress: () => { resetForm(); } }]
    );
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    const todayStr = new Date().toISOString().split('T')[0];
    const selectedStr = currentDate.toISOString().split('T')[0];
    setDate(selectedStr > todayStr ? new Date() : currentDate);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
      >
        {/* Transaction Type Toggle */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text style={[styles.sectionLabel, { color: colors.icon }]}>Transaction Type</Text>
            <TouchableOpacity
              onPress={handleImportPress}
              activeOpacity={0.75}
            >
              <View style={styles.importChipShadow}>
                <LinearGradient
                  colors={[Colors.indigoLight, Colors.indigo, Colors.indigoDarker]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.importChip}
                >
                  <Animated.View style={{ transform: [{ scale: sparkleScale }, { rotate: sparkleRotateDeg }] }}>
                    <Ionicons name="sparkles" size={11} color={colors.textOnColor} />
                  </Animated.View>
                  <Text style={styles.importChipText}>Import</Text>
                  <Animated.View
                    pointerEvents="none"
                    style={[styles.shimmer, { backgroundColor: colors.glassWhite, transform: [{ translateX: shimmerTranslate }, { skewX: '-20deg' }] }]}
                  />
                </LinearGradient>
              </View>
            </TouchableOpacity>
          </View>
          <View style={[styles.toggleContainer, { backgroundColor: colors.cardBackground }]}>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                transactionType === 'buy' && { backgroundColor: colors.tint }
              ]}
              onPress={() => setTransactionType('buy')}
            >
              <Ionicons
                name="add"
                size={16}
                color={transactionType === 'buy' ? colors.textOnColor : colors.text}
                style={{ marginRight: 4 }}
              />
              <Text style={[
                styles.toggleText,
                { color: transactionType === 'buy' ? colors.textOnColor : colors.text }
              ]}>
                Purchase
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.toggleButton,
                transactionType === 'sell' && { backgroundColor: colors.red }
              ]}
              onPress={() => setTransactionType('sell')}
            >
              <Ionicons
                name="remove"
                size={16}
                color={transactionType === 'sell' ? colors.textOnColor : colors.text}
                style={{ marginRight: 4 }}
              />
              <Text style={[
                styles.toggleText,
                { color: transactionType === 'sell' ? colors.textOnColor : colors.text }
              ]}>
                Sell
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Stock/ETF Search */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.icon, marginBottom: 8, paddingHorizontal: 4 }]}>Stock/ETF Symbol</Text>
          <TouchableOpacity
            style={[
              styles.symbolButton,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder,
              }
            ]}
            onPress={() => {
              setShowDatePicker(false);
              setShowSearchModal(true);
            }}
          >
            <Ionicons name="search" size={20} color={colors.icon} style={{ marginRight: 12 }} />
            <Text style={[
              styles.symbolButtonText,
              { color: ticker ? colors.text : colors.icon }
            ]}>
              {ticker || 'e.g., SPY, VOO, AAPL'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.icon, marginBottom: 8, paddingHorizontal: 4 }]}>
            {transactionType === 'buy' ? 'Purchase Date' : 'Sell Date'}
          </Text>
          <TouchableOpacity
            style={[
              styles.dateButton,
              {
                backgroundColor: colors.cardBackground,
                borderColor: colors.cardBorder,
              }
            ]}
            onPress={() => {
              Keyboard.dismiss();
              setShowDatePicker(true);
            }}
          >
            <Text style={[styles.dateText, { color: colors.text }]}>
              {date.toISOString().split('T')[0]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Android: native dialog; iOS: shown inside Modal below */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={date}
            mode="date"
            display="spinner"
            maximumDate={maxDate}
            onChange={onDateChange}
          />
        )}

        {/* iOS: date picker in a modal popup */}
        {Platform.OS === 'ios' && (
          <Modal
            visible={showDatePicker}
            transparent
            animationType="none"
          >
            <Pressable
              style={[styles.datePickerOverlay, { backgroundColor: colors.overlay }]}
              onPress={() => setShowDatePicker(false)}
            >
              <Pressable style={[styles.datePickerSheet, { backgroundColor: colors.cardBackground }]} onPress={(e) => e.stopPropagation()}>
                <View style={styles.datePickerHeader}>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                    <Text style={[styles.datePickerDone, { color: colors.blue }]}>Done</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerSpinnerWrapper}>
                  <DateTimePicker
                    value={date}
                    mode="date"
                    display="spinner"
                    maximumDate={maxDate}
                    onChange={(event, selectedDate) => {
                      if (selectedDate) {
                        const todayStr = new Date().toISOString().split('T')[0];
                        const selectedStr = selectedDate.toISOString().split('T')[0];
                        setDate(selectedStr > todayStr ? new Date() : selectedDate);
                      }
                    }}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        )}

        {/* Price */}
        <Input
          label={transactionType === 'buy' ? 'Purchase Price' : 'Sell Price'}
          icon="pricetag-outline"
          placeholder={priceLoading ? 'Loading…' : 'Price per share'}
          value={price}
          onChangeText={setPrice}
          onClear={() => setPrice('')}
          keyboardType="decimal-pad"
          showClearButton={false}
          onFocus={() => setShowDatePicker(false)}
          rightAccessory={priceLoading ? <ActivityIndicator size="small" color={colors.icon} style={styles.priceLoader} /> : undefined}
          editable={!priceLoading}
        />

        {/* Quantity / Amount */}
        <Input
          label={quantityMode === 'shares' ? 'Quantity' : 'Total Amount'}
          labelAccessory={
            <View style={[styles.modeTabs, { backgroundColor: colors.cardBorder }]}>
              <TouchableOpacity
                style={[styles.modeTab, quantityMode === 'shares' && { backgroundColor: isDark ? colors.surfaceElevated : colors.cardBackground }]}
                onPress={() => handleQuantityModeChange('shares')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeTabText, { color: quantityMode === 'shares' ? colors.text : colors.icon }]}>
                  Shares
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, quantityMode === 'amount' && { backgroundColor: isDark ? colors.surfaceElevated : colors.cardBackground }]}
                onPress={() => handleQuantityModeChange('amount')}
                activeOpacity={0.7}
              >
                <Text style={[styles.modeTabText, { color: quantityMode === 'amount' ? colors.text : colors.icon }]}>
                  Amount
                </Text>
              </TouchableOpacity>
            </View>
          }
          icon={quantityMode === 'shares' ? 'layers-outline' : 'cash-outline'}
          placeholder={quantityMode === 'shares' ? 'Number of shares' : 'Dollar amount'}
          value={quantity}
          onChangeText={setQuantity}
          onClear={() => setQuantity('')}
          keyboardType="decimal-pad"
          showClearButton={false}
          onFocus={() => setShowDatePicker(false)}
          rightAccessory={quantityMode === 'shares' && transactionType === 'sell' && holding && holding.totalShares > 0 ? (
            <TouchableOpacity
              style={styles.allButton}
              onPress={() => setQuantity(parseFloat(holding.totalShares.toPrecision(15)).toString())}
            >
              <Text style={[styles.allButtonText, { color: colors.icon }]}>All</Text>
            </TouchableOpacity>
          ) : undefined}
        />

        {/* Commission (Optional) */}
        <Input
          label="Commission Amount (Optional)"
          icon="card-outline"
          placeholder="Trading fees/commission"
          value={commission}
          onChangeText={setCommission}
          onClear={() => setCommission('')}
          keyboardType="decimal-pad"
          showClearButton={false}
          onFocus={() => setShowDatePicker(false)}
        />

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              { backgroundColor: transactionType === 'buy' ? colors.tint : colors.red }
            ]}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              {transactionType === 'buy' ? 'Record Purchase' : 'Record Sale'}
            </Text>
          </TouchableOpacity>

          {onCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, { backgroundColor: isDark ? colors.cardBackground : colors.surface }]}
              onPress={onCancel}
            >
              <Text style={[styles.cancelButtonText, { color: colors.text }]}>
                Cancel
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      <AssetSearchModal
        visible={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onSelectAsset={handleSelectAsset}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  importChipShadow: {
    shadowColor: Colors.indigo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
    borderRadius: 20,
  },
  importChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 28,
  },
  importChipText: {
    color: Colors.light.textOnColor,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  toggleContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  symbolButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 50,
  },
  symbolButtonText: {
    fontSize: 16,
    fontWeight: '400',
  },
  dateButton: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateText: {
    fontSize: 17,
    fontWeight: '500',
  },
  datePickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  datePickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 34,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  datePickerSpinnerWrapper: {
    alignItems: 'center',
  },
  datePickerDone: {
    fontSize: 17,
    fontWeight: '600',
  },
  modeTabs: {
    flexDirection: 'row',
    borderRadius: 6,
    padding: 2,
  },
  modeTab: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 5,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  allButton: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginVertical: -(Platform.OS === 'ios' ? 14 : 10),
    marginRight: -16,
  },
  allButtonText: {
    fontSize: 13,
    fontWeight: '400',
  },
  priceLoader: {
    marginLeft: 8,
  },
  buttonContainer: {
    marginTop: 12,
    gap: 12,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonText: {
    color: Colors.light.textOnColor,
    fontSize: 17,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
