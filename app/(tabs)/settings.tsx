import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
// import { AVAILABLE_CURRENCIES, Currency, useCurrency } from '@/contexts/currency-context';
import { useTheme } from '@/contexts/theme-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { store$, trackSettingsAction, trackSettingsScreen } from '@/lib';
import { reportError } from '@/lib/crashlytics';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import type { SymbolViewProps } from 'expo-symbols';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsScreen() {
  const SUPPORT_EMAIL = 'hi@finance2049.com';
  const DISCORD_URL = 'https://discord.gg/XdXRAHUKMh';
  const DISCORD_BRAND_COLOR = '#5661EB';
  const GITHUB_URL = 'https://github.com/LukaGiorgadze/finance2049';
  const WEBSITE_URL = 'https://finance2049.com';
  const colorScheme = useColorScheme();
  const { setThemeMode } = useTheme();
  // const { currency, setCurrency } = useCurrency();
  // const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const isDarkMode = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const scrollY = useRef(new Animated.Value(0)).current;
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [activeModal, setActiveModal] = useState<'support' | 'about' | null>(null);

  useEffect(() => {
    void trackSettingsScreen();
  }, []);

  const handleOpenUrl = async (url: string) => {
    void trackSettingsAction({ action: 'open_external_link', target: url });
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        if (url.startsWith('mailto:')) {
          Alert.alert('Email Support', SUPPORT_EMAIL);
          return;
        }
        Alert.alert('Unable to Open Link', 'This link is not available on your device.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      reportError('[Linking] Failed to open URL', error, {
        url,
        surface: 'settings',
      });
      if (url.startsWith('mailto:')) {
        Alert.alert('Email Support', SUPPORT_EMAIL);
        return;
      }
      Alert.alert('Unable to Open Link', 'Please try again in a moment.');
    }
  };

  const handleExportData = async () => {
    if (isExporting) return;
    void trackSettingsAction({ action: 'backup_export' });
    setIsExporting(true);
    try {
      const holdings = store$.portfolio.holdings.get();
      const transactions = store$.portfolio.transactions.get();

      const hasData = Object.keys(holdings || {}).length > 0 || (transactions || []).length > 0;
      if (!hasData) {
        Alert.alert('Nothing to Export', 'Add some investments or transactions first.');
        return;
      }

      const data = {
        exportedAt: new Date().toISOString(),
        version: 1,
        portfolio: {
          holdings: store$.portfolio.holdings.get(),
          transactions: store$.portfolio.transactions.get(),
        },
        market: {
          prices: store$.market.prices.get(),
          indices: store$.market.indices.get(),
          lastUpdated: store$.market.lastUpdated.get(),
        },
        preferences: store$.preferences.get(),
      };

      const json = JSON.stringify(data, null, 2);
      const now = new Date();
      const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
      const fileName = `finance-backup-${timestamp}.json`;
      const file = new File(Paths.cache, fileName);
      if (file.exists) file.delete();
      file.create();
      file.write(json);

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Export Financial Data',
        UTI: 'public.json',
      });

      // Clean up cache file after sharing
      try { if (file.exists) file.delete(); } catch { };
    } catch (error) {
      reportError('[Export] Failed to export data', error, {
        holdingsCount: Object.keys(store$.portfolio.holdings.get() || {}).length,
        transactionCount: store$.portfolio.transactions.get().length,
        surface: 'settings',
      });
      Alert.alert('Export Failed', 'Something went wrong while exporting your data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRestoreData = async () => {
    if (isRestoring) return;
    void trackSettingsAction({ action: 'backup_restore' });
    setIsRestoring(true);
    try {
      // Clean up any leftover backup files in cache to avoid iOS conflicts
      const cacheDir = new Directory(Paths.cache);
      if (cacheDir.exists) {
        for (const item of cacheDir.list()) {
          if (item instanceof File && item.uri.includes('finance-backup')) {
            try { item.delete(); } catch { }
          }
        }
      }

      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'public.json'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];
      const content = new File(asset.uri).textSync();
      const data = JSON.parse(content);

      if (!data.portfolio || !data.portfolio.holdings || !Array.isArray(data.portfolio.transactions)) {
        Alert.alert('Invalid Backup', 'This file doesn\'t look like a valid backup.');
        return;
      }

      const holdingsCount = Object.keys(data.portfolio.holdings).length;
      const transactionsCount = data.portfolio.transactions.length;

      Alert.alert(
        'Restore Data',
        `This will replace all your current data with the backup (${holdingsCount} investments, ${transactionsCount} transactions). This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Restore',
            style: 'destructive',
            onPress: () => {
              store$.portfolio.holdings.set(data.portfolio.holdings);
              store$.portfolio.transactions.set(data.portfolio.transactions);

              if (data.market) {
                if (data.market.prices) store$.market.prices.set(data.market.prices);
                if (data.market.indices) store$.market.indices.set(data.market.indices);
                if (data.market.lastUpdated) store$.market.lastUpdated.set(data.market.lastUpdated);
              }

              if (data.preferences) {
                store$.preferences.set(data.preferences);
              }

              Alert.alert('Restored', 'Your data has been restored from backup.');
            },
          },
        ]
      );
    } catch (error) {
      reportError('[Restore] Failed to restore data', error, {
        surface: 'settings',
      });
      Alert.alert('Restore Failed', 'The file could not be read or contains invalid data.');
    } finally {
      setIsRestoring(false);
    }
  };

  const headerTranslateY = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, -50],
    extrapolate: 'clamp',
  });

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 80],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const headerScale = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [1, 0.9],
    extrapolate: 'clamp',
  });

  const headerBackgroundOpacity = scrollY.interpolate({
    inputRange: [0, 100],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const SettingsCard = ({ icon, title, subtitle, onPress, rightElement, iconBg }: {
    icon: SymbolViewProps['name'];
    title: string;
    subtitle?: string;
    onPress?: () => void;
    rightElement?: React.ReactNode;
    iconBg?: string;
  }) => (
    <TouchableOpacity
      style={[styles.card, {
        backgroundColor: colors.cardBackground,
        shadowColor: Colors.shadow,
        shadowOpacity: isDarkMode ? 0.3 : 0.1,
      }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.cardLeft}>
        <View style={[styles.iconContainer, {
          backgroundColor: iconBg || (isDarkMode ? colors.tint + '20' : colors.tint + '15')
        }]}>
          <IconSymbol name={icon} size={22} color={iconBg ? colors.textOnColor : colors.tint} />
        </View>
        <View style={styles.textContainer}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          {subtitle && <Text style={[styles.cardSubtitle, { color: colors.icon }]}>{subtitle}</Text>}
        </View>
      </View>
      {rightElement ?? <IconSymbol name="chevron.right" size={18} color={colors.icon} />}
    </TouchableOpacity>
  );

  const InfoModal = ({ visible, onClose, children }: {
    visible: boolean;
    onClose: () => void;
    children: React.ReactNode;
  }) => (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.supportOverlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[styles.supportModalCard, { backgroundColor: colors.surface }]}
          onPress={(event) => event.stopPropagation()}
        >
          <TouchableOpacity
            onPress={onClose}
            style={[styles.supportCloseButton, { backgroundColor: isDarkMode ? colors.surfaceElevated : colors.cardBackground }]}
            activeOpacity={0.8}
          >
            <IconSymbol name="xmark" size={16} color={colors.text} />
          </TouchableOpacity>

          <ScrollView
            style={styles.supportScroll}
            contentContainerStyle={styles.supportContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.wrapper} edges={['top']}>
      <LinearGradient
        colors={isDarkMode
          ? [colors.cardBackground, colors.surface]
          : [colors.green, colors.tint]}
        style={styles.backgroundGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Animated Gray Background Overlay */}
      <Animated.View
        style={[
          styles.headerBackgroundOverlay,
          {
            backgroundColor: colors.surface,
            opacity: headerBackgroundOpacity
          }
        ]}
      />

      <Animated.ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        {/* Header with Gradient - Parallax Effect */}
        <Animated.View style={[
          styles.header,
          {
            transform: [
              { translateY: headerTranslateY },
              { scale: headerScale }
            ],
            opacity: headerOpacity,
          }
        ]}>
          <View style={styles.avatarContainer}>
            <View style={[styles.avatarCircle, {
              backgroundColor: isDarkMode ? colors.greenTintBgSettings : colors.surfaceTint,
            }]}>
              <Image
                source={require('@/assets/images/logo-white.png')}
                style={styles.avatarLogo}
                resizeMode="contain"
              />
            </View>
          </View>
          <Text style={[styles.headerTitle, { color: isDarkMode ? colors.text : colors.textOnColor }]}>
            Settings
          </Text>
        </Animated.View>

        <View style={[styles.content, { backgroundColor: colors.surface }]}>
          {/* Appearance Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.icon }]}>APPEARANCE</Text>

            <SettingsCard
              icon={isDarkMode ? "moon.stars.fill" : "sun.max.fill"}
              title="Theme"
              subtitle={isDarkMode ? "Dark mode" : "Light mode"}
              rightElement={
                <Switch
                  value={isDarkMode}
                  onValueChange={(value) => {
                    void trackSettingsAction({ action: 'theme_change', target: value ? 'dark' : 'light' });
                    setThemeMode(value ? 'dark' : 'light');
                  }}
                  trackColor={{ false: colors.cardBorder, true: colors.tint }}
                  thumbColor={colors.textOnColor}
                  ios_backgroundColor={colors.surfaceElevated}
                />
              }
            />
          </View>

          {/* Data & Storage Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.icon }]}>DATA & STORAGE</Text>

            <SettingsCard
              icon="icloud.and.arrow.up.fill"
              title="Backup Data"
              subtitle={isExporting ? 'Preparing backup...' : 'Export your financial data'}
              onPress={handleExportData}
              rightElement={isExporting
                ? <ActivityIndicator size="small" color={colors.text} />
                : <View />
              }
            />

            <SettingsCard
              icon="icloud.and.arrow.down.fill"
              title="Restore Data"
              subtitle={isRestoring ? 'Reading backup...' : 'Import from backup'}
              onPress={handleRestoreData}
              rightElement={isRestoring
                ? <ActivityIndicator size="small" color={colors.text} />
                : <View />
              }
            />

            <SettingsCard
              icon="externaldrive.fill"
              title="Storage"
              subtitle="Manage local storage"
              onPress={() => {
                void trackSettingsAction({ action: 'open_storage' });
                router.push('/storage');
              }}
            />
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.icon }]}>ABOUT</Text>

            <SettingsCard
              icon="questionmark.circle.fill"
              title="Help & Support"
              subtitle="Contact us, report bugs, and share feedback"
              onPress={() => {
                void trackSettingsAction({ action: 'open_support' });
                setActiveModal('support');
              }}
              rightElement={<View />}
            />

            <SettingsCard
              icon="info.circle.fill"
              title="About"
              subtitle="Version 1.0.0"
              onPress={() => {
                void trackSettingsAction({ action: 'open_about' });
                setActiveModal('about');
              }}
              rightElement={<View />}
            />
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.icon }]}>
              Made with <Text style={{ color: colors.red }}>♥</Text> for offline-first finance
            </Text>
          </View>
        </View>
      </Animated.ScrollView>

      <InfoModal visible={activeModal === 'support'} onClose={() => setActiveModal(null)}>
        <Text style={[styles.supportParagraph, { color: colors.text }]}>
          Want faster updates and feedback? Join our{' '}
          <Text
            style={[styles.supportInlineLink, { color: DISCORD_BRAND_COLOR }]}
            onPress={() => handleOpenUrl(DISCORD_URL)}
          >
            Discord community
          </Text>
          .
        </Text>

        <Text style={[styles.supportParagraph, { color: colors.text }]}>
          Questions, bugs, or feature ideas? Email us at{' '}
          <Text
            style={[styles.supportInlineLink]}
            onPress={() => handleOpenUrl(`mailto:${SUPPORT_EMAIL}`)}
          >
            {SUPPORT_EMAIL}
          </Text>
          .
        </Text>

        <Text style={[styles.supportParagraph, { color: colors.text }]}>
          We read every message and use your feedback to improve Finance 2049.
        </Text>

        <View style={[styles.supportActions, { borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: DISCORD_BRAND_COLOR, borderColor: DISCORD_BRAND_COLOR }]}
            onPress={() => handleOpenUrl(DISCORD_URL)}
            activeOpacity={0.85}
          >
            <IconSymbol name="person.2.fill" size={16} color={colors.textOnColor} />
            <Text style={[styles.secondaryActionText, { color: colors.textOnColor }]}>Join Discord</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={() => handleOpenUrl(`mailto:${SUPPORT_EMAIL}`)}
            activeOpacity={0.85}
          >
            <IconSymbol name="envelope.fill" size={16} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Email Support</Text>
          </TouchableOpacity>
        </View>
      </InfoModal>

      <InfoModal visible={activeModal === 'about'} onClose={() => setActiveModal(null)}>
        <Text style={[styles.supportParagraph, { color: colors.text }]}>
          Finance 2049 is a simple portfolio tracking app for long-term investors.
        </Text>

        <Text style={[styles.supportParagraph, { color: colors.text }]}>
          Track your invested capital, real gains, and performance without noise, subscriptions, or complex tools.
        </Text>

        <Text style={[styles.supportParagraph, { color: colors.text }]}>
          Local-first and open-source.
        </Text>

        <View style={[styles.supportActions, { borderTopColor: colors.cardBorder }]}>
          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={() => handleOpenUrl(WEBSITE_URL)}
            activeOpacity={0.85}
          >
            <IconSymbol name="globe" size={16} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>Visit Website</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryAction, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
            onPress={() => handleOpenUrl(GITHUB_URL)}
            activeOpacity={0.85}
          >
            <IconSymbol name="chevron.left.forwardslash.chevron.right" size={16} color={colors.text} />
            <Text style={[styles.secondaryActionText, { color: colors.text }]}>View GitHub</Text>
          </TouchableOpacity>
        </View>
      </InfoModal>

      {/* Currency Selection Modal - TODO: Enable later
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHeader, { backgroundColor: colors.cardBackground, borderBottomColor: colors.borderGray }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Currency</Text>
            <TouchableOpacity
              onPress={() => setCurrencyModalVisible(false)}
              style={styles.modalCloseButton}
            >
              <IconSymbol name="xmark.circle.fill" size={28} color={colors.icon} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={AVAILABLE_CURRENCIES}
            keyExtractor={(item) => item.code}
            contentContainerStyle={styles.currencyList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.currencyItem,
                  {
                    backgroundColor: colors.cardBackground,
                    borderColor: item.code === currency.code ? colors.tint : 'transparent',
                    borderWidth: item.code === currency.code ? 2 : 0,
                  },
                ]}
                onPress={() => {
                  setCurrency(item);
                  setCurrencyModalVisible(false);
                }}
              >
                <View style={styles.currencyInfo}>
                  <Text style={[styles.currencyCode, { color: colors.text }]}>{item.code}</Text>
                  <Text style={[styles.currencyName, { color: colors.icon }]}>{item.name}</Text>
                </View>
                <Text style={[styles.currencySymbol, { color: colors.tint }]}>{item.symbol}</Text>
                {item.code === currency.code && (
                  <IconSymbol name="checkmark.circle.fill" size={22} color={colors.tint} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
      */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  backgroundGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  headerBackgroundOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 200,
    zIndex: 0,
  },
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  content: {
    paddingTop: 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  section: {
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 12,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    marginBottom: 10,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 14,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 0,
    paddingBottom: 120,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  modalCloseButton: {
    padding: 4,
  },
  supportOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    alignItems: 'center',
  },
  supportModalCard: {
    borderRadius: 28,
    overflow: 'hidden',
    maxHeight: '82%',
    width: '100%',
    maxWidth: 420,
    shadowColor: Colors.shadow,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.22,
    shadowRadius: 28,
    elevation: 12,
  },
  supportCloseButton: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  supportScroll: {
    maxHeight: 420,
  },
  supportContent: {
    paddingHorizontal: 22,
    paddingTop: 52,
    paddingBottom: 24,
  },
  supportParagraph: {
    fontSize: 15,
    lineHeight: 24,
    marginBottom: 16,
  },
  supportInlineLink: {
    fontWeight: '700',
  },
  supportActions: {
    marginTop: 8,
    paddingTop: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  primaryAction: {
    minHeight: 52,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  secondaryAction: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  currencyList: {
    padding: 16,
  },
  currencyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  currencyInfo: {
    flex: 1,
  },
  currencyCode: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  currencyName: {
    fontSize: 13,
  },
  currencySymbol: {
    fontSize: 18,
    fontWeight: '600',
    marginRight: 12,
  },
});
