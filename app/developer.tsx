import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { PageHeader } from '@/components/ui/page-header';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { hasSupabaseConfig, store$ } from '@/lib';
import { CURRENT_SCHEMA_VERSION } from '@/lib/store/types';
import { Ionicons } from '@expo/vector-icons';
import { getApp } from '@react-native-firebase/app';
import installations from '@react-native-firebase/installations';
import messaging, { AuthorizationStatus } from '@react-native-firebase/messaging';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Clipboard, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NOT_AVAILABLE = 'Not available';
const NOT_APPLICABLE = 'Not applicable';

type DiagnosticItem = {
  key: string;
  label: string;
  value: string;
  copyValue?: string | null;
  mono?: boolean;
};

type DiagnosticSection = {
  title: string;
  items: DiagnosticItem[];
};

type DeveloperDiagnostics = {
  loadedAt: string;
  sections: DiagnosticSection[];
  errors: string[];
};

function isSupportedNativePlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function normalizeValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function formatBoolean(value: boolean | null | undefined) {
  if (value == null) return null;
  return value ? 'Yes' : 'No';
}

function formatMessagingAuthorizationStatus(status: number | null) {
  if (status == null) return null;

  switch (status) {
    case AuthorizationStatus.NOT_DETERMINED:
      return 'Not determined (-1)';
    case AuthorizationStatus.DENIED:
      return 'Denied (0)';
    case AuthorizationStatus.AUTHORIZED:
      return 'Authorized (1)';
    case AuthorizationStatus.PROVISIONAL:
      return 'Provisional (2)';
    case AuthorizationStatus.EPHEMERAL:
      return 'Ephemeral (3)';
    default:
      return `Unknown (${status})`;
  }
}

function formatIosNotificationStatus(status?: Notifications.IosAuthorizationStatus) {
  switch (status) {
    case Notifications.IosAuthorizationStatus.NOT_DETERMINED:
      return 'not determined';
    case Notifications.IosAuthorizationStatus.DENIED:
      return 'denied';
    case Notifications.IosAuthorizationStatus.AUTHORIZED:
      return 'authorized';
    case Notifications.IosAuthorizationStatus.PROVISIONAL:
      return 'provisional';
    case Notifications.IosAuthorizationStatus.EPHEMERAL:
      return 'ephemeral';
    default:
      return null;
  }
}

function formatExpoNotificationPermission(status: Notifications.NotificationPermissionsStatus | null) {
  if (!status) return null;

  const parts = [
    status.status,
    status.granted ? 'granted' : 'not granted',
  ];
  const iosStatus = formatIosNotificationStatus(status.ios?.status);

  if (iosStatus) {
    parts.push(`iOS ${iosStatus}`);
  }

  return parts.join(' / ');
}

function configuredApplicationId() {
  if (Platform.OS === 'ios') {
    return Constants.expoConfig?.ios?.bundleIdentifier ?? null;
  }

  if (Platform.OS === 'android') {
    return Constants.expoConfig?.android?.package ?? null;
  }

  return null;
}

function makeItem(key: string, label: string, value: unknown, mono = false): DiagnosticItem {
  const normalized = normalizeValue(value);
  const displayValue = normalized ?? NOT_AVAILABLE;

  return {
    key,
    label,
    value: displayValue,
    copyValue: normalized === NOT_APPLICABLE ? null : normalized,
    mono,
  };
}

function notApplicableItem(key: string, label: string, mono = false): DiagnosticItem {
  return {
    key,
    label,
    value: NOT_APPLICABLE,
    copyValue: null,
    mono,
  };
}

async function readDiagnostic<T>(
  label: string,
  errors: string[],
  read: () => Promise<T> | T,
): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    errors.push(`${label}: ${getErrorMessage(error)}`);
    return null;
  }
}

async function collectDeveloperDiagnostics(): Promise<DeveloperDiagnostics> {
  const errors: string[] = [];
  const loadedAt = new Date().toISOString();
  const supportedNativePlatform = isSupportedNativePlatform();

  const firebaseApp = await readDiagnostic('Firebase app', errors, () => getApp());
  const firebaseOptions = firebaseApp?.options;

  const installationId = supportedNativePlatform
    ? await readDiagnostic('Firebase installation ID', errors, () => installations().getId())
    : NOT_APPLICABLE;

  const installationAuthToken = supportedNativePlatform
    ? await readDiagnostic('Firebase installation auth token', errors, () => installations().getToken(false))
    : NOT_APPLICABLE;

  let messagingPermission: string | null = supportedNativePlatform ? null : NOT_APPLICABLE;
  let expoNotificationPermission: string | null = null;
  let notificationCanAskAgain: string | null = null;
  let remoteMessagesRegistered: string | null = supportedNativePlatform ? null : NOT_APPLICABLE;
  let fcmAutoInit: string | null = supportedNativePlatform ? null : NOT_APPLICABLE;
  let apnsToken: string | null = Platform.OS === 'ios' ? null : NOT_APPLICABLE;
  let fcmToken: string | null = supportedNativePlatform ? null : NOT_APPLICABLE;

  const notificationPermissions = await readDiagnostic(
    'Expo notification permissions',
    errors,
    () => Notifications.getPermissionsAsync(),
  );
  expoNotificationPermission = formatExpoNotificationPermission(notificationPermissions);
  notificationCanAskAgain = formatBoolean(notificationPermissions?.canAskAgain);

  if (supportedNativePlatform) {
    const messagingInstance = messaging();

    fcmAutoInit = formatBoolean(messagingInstance.isAutoInitEnabled);
    remoteMessagesRegistered = formatBoolean(messagingInstance.isDeviceRegisteredForRemoteMessages);

    const authorizationStatus = await readDiagnostic(
      'Firebase messaging permission',
      errors,
      () => messagingInstance.hasPermission(),
    );
    messagingPermission = formatMessagingAuthorizationStatus(authorizationStatus);

    if (Platform.OS === 'ios') {
      if (!messagingInstance.isDeviceRegisteredForRemoteMessages) {
        await readDiagnostic(
          'Register device for remote messages',
          errors,
          () => messagingInstance.registerDeviceForRemoteMessages(),
        );
      }

      remoteMessagesRegistered = formatBoolean(messagingInstance.isDeviceRegisteredForRemoteMessages);
      apnsToken = await readDiagnostic('APNs token', errors, () => messagingInstance.getAPNSToken());
    }

    fcmToken = await readDiagnostic('FCM token', errors, () => messagingInstance.getToken());
  }

  const auth = store$.auth.get();
  const preferences = store$.preferences.get();

  const sections: DiagnosticSection[] = [
    {
      title: 'Firebase Identifiers',
      items: [
        makeItem('installation-id', 'Installation ID', installationId, true),
        makeItem('installation-token', 'Installation Auth Token', installationAuthToken, true),
        makeItem('fcm-token', 'FCM Token', fcmToken, true),
        Platform.OS === 'ios'
          ? makeItem('apns-token', 'APNs Token', apnsToken, true)
          : notApplicableItem('apns-token', 'APNs Token', true),
      ],
    },
    {
      title: 'Push State',
      items: [
        makeItem('messaging-permission', 'Firebase Messaging Permission', messagingPermission),
        makeItem('notification-permission', 'Expo Notification Permission', expoNotificationPermission),
        makeItem('notification-can-ask-again', 'Can Ask Notification Permission Again', notificationCanAskAgain),
        makeItem('remote-messages-registered', 'Remote Messages Registered', remoteMessagesRegistered),
        makeItem('fcm-auto-init', 'FCM Auto Init Enabled', fcmAutoInit),
        makeItem('notifications-preference', 'Notifications Preference', formatBoolean(preferences.notificationsEnabled)),
        makeItem('in-app-messages-preference', 'In-App Messages Preference', formatBoolean(preferences.inAppMessagesEnabled)),
      ],
    },
    {
      title: 'App',
      items: [
        makeItem('app-version', 'App Version', Constants.nativeAppVersion ?? Constants.expoConfig?.version),
        makeItem('build-version', 'Build Version', Constants.nativeBuildVersion),
        makeItem('application-id', Platform.OS === 'ios' ? 'Bundle ID' : 'Application ID', configuredApplicationId(), true),
        makeItem('platform', 'Platform', Platform.OS),
        makeItem('platform-version', 'Platform Version', String(Platform.Version)),
        makeItem('runtime-version', 'Runtime Version', Constants.expoRuntimeVersion),
        makeItem('execution-environment', 'Execution Environment', Constants.executionEnvironment),
        makeItem('debug-mode', 'Debug Mode', formatBoolean(__DEV__)),
        makeItem('session-id', 'Expo Session ID', Constants.sessionId, true),
      ],
    },
    {
      title: 'Backend',
      items: [
        makeItem('firebase-app-name', 'Firebase App Name', firebaseApp?.name),
        makeItem('firebase-app-id', 'Firebase App ID', firebaseOptions?.appId, true),
        makeItem('firebase-project-id', 'Firebase Project ID', firebaseOptions?.projectId, true),
        makeItem('messaging-sender-id', 'Messaging Sender ID', firebaseOptions?.messagingSenderId, true),
        makeItem('eas-project-id', 'EAS Project ID', Constants.expoConfig?.extra?.eas?.projectId, true),
        makeItem('supabase-configured', 'Supabase Configured', formatBoolean(hasSupabaseConfig)),
        makeItem('auth-user-id', 'Supabase Auth User ID', auth.userId, true),
        makeItem('anonymous-auth', 'Anonymous Auth', formatBoolean(auth.isAnonymous)),
        makeItem('store-schema', 'Store Schema Version', store$._schema.version.get() ?? CURRENT_SCHEMA_VERSION),
      ],
    },
  ];

  return {
    loadedAt,
    sections,
    errors,
  };
}

function buildCopyAllPayload(diagnostics: DeveloperDiagnostics) {
  const payload = diagnostics.sections.reduce<Record<string, Record<string, string>>>((acc, section) => {
    acc[section.title] = section.items.reduce<Record<string, string>>((items, item) => {
      items[item.label] = item.value;
      return items;
    }, {});
    return acc;
  }, {});

  return JSON.stringify({
    loadedAt: diagnostics.loadedAt,
    ...payload,
    errors: diagnostics.errors,
  }, null, 2);
}

function DiagnosticRow({
  item,
  colors,
  copiedKey,
  onCopy,
  isLast,
}: {
  item: DiagnosticItem;
  colors: typeof Colors.light;
  copiedKey: string | null;
  onCopy: (item: DiagnosticItem) => void;
  isLast: boolean;
}) {
  const canCopy = Boolean(item.copyValue);
  const isCopied = copiedKey === item.key;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={[styles.rowLabel, { color: colors.icon }]}>{item.label}</Text>
          <Text
            selectable
            style={[
              styles.rowValue,
              item.mono && styles.mono,
              { color: colors.text },
            ]}
          >
            {item.value}
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.copyButton,
            { backgroundColor: canCopy ? colors.divider : colors.cardInactiveAlt },
          ]}
          disabled={!canCopy}
          activeOpacity={0.75}
          onPress={() => onCopy(item)}
          accessibilityRole="button"
          accessibilityLabel={`Copy ${item.label}`}
        >
          <Ionicons
            name={isCopied ? 'checkmark' : 'copy-outline'}
            size={17}
            color={canCopy ? colors.text : colors.iconMuted}
          />
        </TouchableOpacity>
      </View>
      {!isLast && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
    </View>
  );
}

export default function DeveloperScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const colors = Colors[colorScheme ?? 'light'];
  const [diagnostics, setDiagnostics] = useState<DeveloperDiagnostics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const textColor = colors.text;

  const resetCopiedKey = useCallback(() => {
    if (copyResetTimer.current) {
      clearTimeout(copyResetTimer.current);
    }

    copyResetTimer.current = setTimeout(() => {
      setCopiedKey(null);
      copyResetTimer.current = null;
    }, 1200);
  }, []);

  const copyText = useCallback((key: string, value: string) => {
    Clipboard.setString(value);
    setCopiedKey(key);
    resetCopiedKey();
  }, [resetCopiedKey]);

  const loadDiagnostics = useCallback(async () => {
    setIsLoading(true);
    try {
      const nextDiagnostics = await collectDeveloperDiagnostics();
      setDiagnostics(nextDiagnostics);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDiagnostics();
  }, [loadDiagnostics]);

  useEffect(() => {
    return () => {
      if (copyResetTimer.current) {
        clearTimeout(copyResetTimer.current);
      }
    };
  }, []);

  const copyAllValue = useMemo(() => {
    return diagnostics ? buildCopyAllPayload(diagnostics) : null;
  }, [diagnostics]);

  const handleCopyItem = useCallback((item: DiagnosticItem) => {
    if (!item.copyValue) return;
    copyText(item.key, item.copyValue);
  }, [copyText]);

  return (
    <ThemedView style={[styles.container, { backgroundColor: colors.surface }]}>
      <PageHeader
        title="Developer"
        leftElement={
          <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={24} color={textColor} />
          </TouchableOpacity>
        }
        rightElement={
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerButton, { backgroundColor: colors.cardBackground }]}
              onPress={loadDiagnostics}
              disabled={isLoading}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Refresh diagnostics"
            >
              {isLoading
                ? <ActivityIndicator size="small" color={textColor} />
                : <Ionicons name="refresh" size={19} color={textColor} />
              }
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.headerButton,
                { backgroundColor: copyAllValue ? colors.cardBackground : colors.cardInactiveAlt },
              ]}
              onPress={() => {
                if (copyAllValue) {
                  copyText('copy-all', copyAllValue);
                }
              }}
              disabled={!copyAllValue}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Copy all diagnostics"
            >
              <Ionicons
                name={copiedKey === 'copy-all' ? 'checkmark' : 'copy-outline'}
                size={19}
                color={copyAllValue ? textColor : colors.iconMuted}
              />
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!diagnostics && isLoading && (
          <View style={[styles.loadingCard, { backgroundColor: colors.cardBackground }]}>
            <ActivityIndicator size="small" color={textColor} />
            <Text style={[styles.loadingText, { color: colors.icon }]}>Loading diagnostics</Text>
          </View>
        )}

        {diagnostics && (
          <>
            <View style={[styles.summaryCard, { backgroundColor: colors.cardBackground }]}>
              <View style={[styles.summaryIcon, { backgroundColor: isDark ? colors.greenTintBgSettings : colors.greenTintBg }]}>
                <IconSymbol name="chevron.left.forwardslash.chevron.right" size={24} color={colors.tint} />
              </View>
              <View style={styles.summaryText}>
                <Text style={[styles.summaryTitle, { color: colors.text }]}>Diagnostics</Text>
                <Text style={[styles.summarySubtitle, { color: colors.icon }]}>
                  Updated {new Date(diagnostics.loadedAt).toLocaleString()}
                </Text>
              </View>
              {copiedKey && (
                <View style={[styles.copiedPill, { backgroundColor: colors.greenTintBg }]}>
                  <Text style={[styles.copiedText, { color: colors.green }]}>Copied</Text>
                </View>
              )}
            </View>

            {diagnostics.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.icon }]}>{section.title}</Text>
                <View style={[styles.sectionCard, { backgroundColor: colors.cardBackground }]}>
                  {section.items.map((item, index) => (
                    <DiagnosticRow
                      key={item.key}
                      item={item}
                      colors={colors}
                      copiedKey={copiedKey}
                      onCopy={handleCopyItem}
                      isLast={index === section.items.length - 1}
                    />
                  ))}
                </View>
              </View>
            ))}

            {diagnostics.errors.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: colors.icon }]}>Diagnostic Errors</Text>
                <View style={[styles.errorCard, { backgroundColor: colors.errorBg }]}>
                  {diagnostics.errors.map((error, index) => (
                    <Text key={`${error}-${index}`} selectable style={[styles.errorText, { color: colors.error }]}>
                      {error}
                    </Text>
                  ))}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingCard: {
    minHeight: 96,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  summaryIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  summarySubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  copiedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  copiedText: {
    fontSize: 12,
    fontWeight: '700',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    paddingHorizontal: 4,
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  rowValue: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
  },
  mono: {
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
  },
  copyButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  errorCard: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
  },
});
