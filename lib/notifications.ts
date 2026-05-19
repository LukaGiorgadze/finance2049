import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import messaging, {
  AuthorizationStatus,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { ONBOARDING_KEY } from '@/constants/storage-keys';
import { trackNotificationAction } from './analytics';
import { reportError, reportWarning } from './crashlytics';
import { API_CONFIG } from './services/config';
import { ensureSession, getAccessToken, hasSupabaseConfig } from './supabase';
import { store$, updatePreferences } from './store';

const ANDROID_POST_NOTIFICATIONS_PERMISSION = 'android.permission.POST_NOTIFICATIONS';
const ANDROID_FOREGROUND_CHANNEL_ID = 'default';
const APNS_TOKEN_WAIT_ATTEMPTS = 10;
const APNS_TOKEN_WAIT_MS = 500;
const INITIAL_NOTIFICATION_NAVIGATION_DELAY_MS = 800;
const NOTIFICATION_OPEN_DEDUPE_WINDOW_MS = 10_000;
const PUSH_NOTIFICATION_PROMPT_SEEN_KEY = '@push_notifications_prompt_seen_v1';

let hasConfiguredForegroundNotificationPresentation = false;
let hasShownPushNotificationPrompt = false;
const handledNotificationOpenKeys = new Map<string, number>();

type NotificationData = Record<string, unknown>;
type NotificationDestination = Parameters<typeof router.push>[0];
type NewsArticleRouteParams = {
  id: string;
  title?: string;
  author?: string;
  description?: string;
  url?: string;
  ampUrl?: string;
  imageUrl?: string;
  publishedAt?: string;
  source?: string;
  tickers?: string;
  sentiment?: string;
};

export type PushNotificationStatus =
  | 'registered'
  | 'unregistered'
  | 'permission_denied'
  | 'permission_revoked'
  | 'unsupported'
  | 'server_unavailable'
  | 'error';

export interface PushNotificationResult {
  enabled: boolean;
  status: PushNotificationStatus;
  message?: string;
}

interface NotificationDevicePayload {
  fcmToken: string;
  platform: 'ios' | 'android';
  appVersion?: string;
}

interface TestNotificationResponse {
  sent: number;
  failed: number;
  disabledTokens: number;
}

interface PushAuthorizationState {
  status: FirebaseMessagingTypes.AuthorizationStatus;
  granted: boolean;
  canAskAgain: boolean;
}

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function ensureForegroundNotificationPresentation() {
  if (hasConfiguredForegroundNotificationPresentation || !isSupportedPlatform()) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const shouldShow = store$.preferences.notificationsEnabled.get() ?? false;

      return {
        shouldShowBanner: shouldShow,
        shouldShowList: shouldShow,
        shouldPlaySound: shouldShow,
        shouldSetBadge: false,
        priority: Notifications.AndroidNotificationPriority.HIGH,
      };
    },
  });

  hasConfiguredForegroundNotificationPresentation = true;
}

function getAndroidApiLevel() {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : Number.parseInt(String(Platform.Version), 10);
}

function isAuthorizedStatus(status: FirebaseMessagingTypes.AuthorizationStatus) {
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL ||
    status === AuthorizationStatus.EPHEMERAL
  );
}

function getAppVersion() {
  return Constants.nativeAppVersion ?? Constants.expoConfig?.version;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function markPushNotificationPromptSeen() {
  hasShownPushNotificationPrompt = true;
  void AsyncStorage.setItem(PUSH_NOTIFICATION_PROMPT_SEEN_KEY, 'true').catch((error) => {
    reportWarning('[Notifications] Failed to store prompt seen state', error, {
      platform: Platform.OS,
    });
  });
}

function getEnableFailureMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('APNs token')) {
    return 'iOS has not returned a push token yet. Check Push Notifications capability, use a supported device, then try again.';
  }

  if (message.includes('Failed to checkin before token registration')) {
    return 'Firebase could not create a device token. Check network/Firebase setup, then try again.';
  }

  return 'Unable to enable notifications. Please try again.';
}

function isUnregisteredForRemoteMessagesError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('[messaging/unregistered]') ||
    message.includes('must be registered for remote messages')
  );
}

function getMessageTarget(message: FirebaseMessagingTypes.RemoteMessage) {
  const data = message.data ?? {};
  const candidate =
    data.deep_link ??
    data.href ??
    data.target ??
    data.route ??
    data.screen ??
    data.symbol ??
    data.ticker ??
    data.article_id ??
    data.news_id ??
    data.notification_id ??
    data.type ??
    message.messageId ??
    message.from;

  return typeof candidate === 'string' ? candidate : undefined;
}

function readString(data: NotificationData, keys: string[]) {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function normalizeRouteInput(route: string) {
  const trimmed = route.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.protocol !== 'finance2049:') return null;

    if (url.hostname) {
      return `/${url.hostname}${url.pathname}${url.search}`;
    }

    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}

function getSearchParamString(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key);
    if (value?.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function decodePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function getNewsArticleParams(
  data: NotificationData,
  urlSearchParams?: URLSearchParams,
): NewsArticleRouteParams | null {
  const id =
    readString(data, ['article_id', 'news_id', 'id']) ??
    (urlSearchParams ? getSearchParamString(urlSearchParams, ['article_id', 'news_id', 'id']) : undefined);

  if (!id) return null;

  const params: NewsArticleRouteParams = { id };
  const aliases: Array<[Exclude<keyof NewsArticleRouteParams, 'id'>, string[]]> = [
    ['title', ['title', 'article_title']],
    ['author', ['author', 'article_author']],
    ['description', ['description', 'article_description', 'body']],
    ['url', ['url', 'article_url']],
    ['ampUrl', ['ampUrl', 'amp_url']],
    ['imageUrl', ['imageUrl', 'image_url']],
    ['publishedAt', ['publishedAt', 'published_at', 'published_utc']],
    ['source', ['source', 'publisher']],
    ['tickers', ['tickers', 'ticker', 'symbol']],
    ['sentiment', ['sentiment']],
  ];

  for (const [paramName, keys] of aliases) {
    const value =
      readString(data, keys) ??
      (urlSearchParams ? getSearchParamString(urlSearchParams, keys) : undefined);
    if (value) {
      params[paramName] = value;
    }
  }

  return params;
}

function getStockDestination(symbol: string): NotificationDestination {
  return {
    pathname: '/stock/[symbol]',
    params: { symbol },
  };
}

function getNewsArticleDestination(params: NewsArticleRouteParams): NotificationDestination {
  return {
    pathname: '/news/[id]',
    params,
  };
}

function routePathToDestination(
  route: string,
  data: NotificationData = {},
): NotificationDestination | null {
  const normalizedRoute = normalizeRouteInput(route);
  if (!normalizedRoute) return null;

  const url = new URL(normalizedRoute, 'finance2049://app');
  const pathname = url.pathname.replace(/\/+$/, '') || '/';

  if (pathname === '/portfolio' || pathname === '/(tabs)/portfolio') {
    return '/(tabs)/portfolio';
  }

  if (pathname === '/import-result' || pathname === '/import-confirm') {
    return '/import-confirm';
  }

  if (pathname === '/import' || pathname === '/import-transactions') {
    return '/import-transactions';
  }

  if (pathname === '/news' || pathname === '/news/index') {
    const articleParams = getNewsArticleParams(data, url.searchParams);
    if (articleParams) {
      return getNewsArticleDestination(articleParams);
    }
    return '/news';
  }

  const stockMatch = pathname.match(/^\/stock\/([^/]+)$/);
  if (stockMatch?.[1]) {
    return getStockDestination(decodePathSegment(stockMatch[1]).toUpperCase());
  }

  const newsMatch = pathname.match(/^\/news\/([^/]+)$/);
  if (newsMatch?.[1]) {
    const articleParams = getNewsArticleParams(
      { ...data, id: decodePathSegment(newsMatch[1]) },
      url.searchParams,
    );
    if (articleParams) {
      return getNewsArticleDestination(articleParams);
    }
  }

  return null;
}

function getNotificationDestination(data: NotificationData): NotificationDestination | null {
  const explicitRoute = readString(data, ['deep_link', 'href', 'route']);
  if (explicitRoute) {
    const destination = routePathToDestination(explicitRoute, data);
    if (destination) return destination;
  }

  const type = readString(data, ['type', 'target', 'screen'])?.toLowerCase();
  const symbol = readString(data, ['symbol', 'ticker']);

  if ((type === 'stock' || type === 'ticker' || type === 'asset') && symbol) {
    return getStockDestination(symbol.toUpperCase());
  }

  if (type === 'portfolio') {
    return '/(tabs)/portfolio';
  }

  if (type === 'import_result' || type === 'import-result' || type === 'import_confirm') {
    return '/import-confirm';
  }

  if (type === 'import' || type === 'import_transactions' || type === 'import-transactions') {
    return '/import-transactions';
  }

  if (type === 'news' || type === 'article' || type === 'news_article') {
    const articleParams = getNewsArticleParams(data);
    if (articleParams) {
      return getNewsArticleDestination(articleParams);
    }
    return '/news';
  }

  return null;
}

function getDestinationTarget(destination: NotificationDestination) {
  return typeof destination === 'string'
    ? destination
    : `${destination.pathname}`;
}

function getNotificationOpenKey(
  data: NotificationData,
  fallback?: string | null,
) {
  return (
    readString(data, ['notification_id', 'message_id', 'google.message_id', 'id']) ??
    fallback ??
    readString(data, ['deep_link', 'href', 'route', 'type', 'target'])
  );
}

function shouldSkipDuplicateNotificationOpen(openKey: string) {
  const now = Date.now();
  for (const [key, handledAt] of handledNotificationOpenKeys) {
    if (now - handledAt > NOTIFICATION_OPEN_DEDUPE_WINDOW_MS) {
      handledNotificationOpenKeys.delete(key);
    }
  }

  const lastHandledAt = handledNotificationOpenKeys.get(openKey);
  if (lastHandledAt && now - lastHandledAt <= NOTIFICATION_OPEN_DEDUPE_WINDOW_MS) {
    return true;
  }

  handledNotificationOpenKeys.set(openKey, now);
  return false;
}

function navigateFromNotification(
  data: NotificationData,
  source: 'opened' | 'initial_open' | 'expo_response',
  fallbackKey?: string | null,
  delayMs = 0,
) {
  const destination = getNotificationDestination(data);
  if (!destination) return;

  const openKey = getNotificationOpenKey(data, fallbackKey);
  if (openKey) {
    if (shouldSkipDuplicateNotificationOpen(openKey)) return;
  }

  const navigate = () => {
    try {
      router.push(destination);
      void trackNotificationAction({
        action: 'deep_link_opened',
        target: getDestinationTarget(destination),
        source,
      });
    } catch (error) {
      reportWarning('[Notifications] Failed to open notification deep link', error, {
        source,
        destination: getDestinationTarget(destination),
      });
    }
  };

  if (delayMs > 0) {
    setTimeout(navigate, delayMs);
  } else {
    requestAnimationFrame(navigate);
  }
}

async function displayAndroidForegroundNotification(
  message: FirebaseMessagingTypes.RemoteMessage,
) {
  if (Platform.OS !== 'android') return;
  if (!(store$.preferences.notificationsEnabled.get() ?? false)) return;
  ensureForegroundNotificationPresentation();

  const title = message.notification?.title ?? 'Finance 2049';
  const body = message.notification?.body;

  await Notifications.setNotificationChannelAsync(ANDROID_FOREGROUND_CHANNEL_ID, {
    name: 'Notifications',
    importance: Notifications.AndroidImportance.HIGH,
  });

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data: message.data as Record<string, unknown> | undefined,
      sound: 'default',
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: { channelId: ANDROID_FOREGROUND_CHANNEL_ID },
  });
}

async function getAuthHeaders() {
  await ensureSession();
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('Missing Supabase access token');
  }

  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

async function postNotifications<TResponse>(
  route: 'register' | 'unregister' | 'test',
  body: object,
): Promise<TResponse> {
  if (!hasSupabaseConfig) {
    throw new Error('Missing Supabase configuration');
  }

  const response = await fetch(`${API_CONFIG.supabase.notificationsUrl}/${route}`, {
    method: 'POST',
    headers: await getAuthHeaders(),
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  const parsed = raw ? JSON.parse(raw) : {};

  if (!response.ok) {
    throw new Error(parsed?.error ?? `Notifications request failed: ${response.status}`);
  }

  return parsed as TResponse;
}

async function requestAndroidNotificationPermission() {
  if (Platform.OS !== 'android') return true;
  const apiLevel = getAndroidApiLevel();
  if (apiLevel < 33) return true;

  const status = await PermissionsAndroid.request(
    ANDROID_POST_NOTIFICATIONS_PERMISSION as never,
  );

  return status === PermissionsAndroid.RESULTS.GRANTED;
}

export async function hasPushNotificationPermission() {
  const status = await getPushAuthorizationStatus();
  return isAuthorizedStatus(status);
}

async function getPushAuthorizationStatus(): Promise<FirebaseMessagingTypes.AuthorizationStatus> {
  return (await getPushAuthorizationState()).status;
}

async function getPushAuthorizationState(): Promise<PushAuthorizationState> {
  if (!isSupportedPlatform()) {
    return {
      status: AuthorizationStatus.DENIED,
      granted: false,
      canAskAgain: false,
    };
  }

  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted) {
    return {
      status: AuthorizationStatus.AUTHORIZED,
      granted: true,
      canAskAgain: permissions.canAskAgain,
    };
  }

  if (Platform.OS === 'ios') {
    if (permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return {
        status: AuthorizationStatus.PROVISIONAL,
        granted: false,
        canAskAgain: permissions.canAskAgain,
      };
    }
    if (permissions.ios?.status === Notifications.IosAuthorizationStatus.EPHEMERAL) {
      return {
        status: AuthorizationStatus.EPHEMERAL,
        granted: false,
        canAskAgain: permissions.canAskAgain,
      };
    }
    if (permissions.ios?.status === Notifications.IosAuthorizationStatus.NOT_DETERMINED) {
      return {
        status: AuthorizationStatus.NOT_DETERMINED,
        granted: false,
        canAskAgain: permissions.canAskAgain,
      };
    }
  }

  return {
    status: permissions.status === 'undetermined'
      ? AuthorizationStatus.NOT_DETERMINED
      : AuthorizationStatus.DENIED,
    granted: false,
    canAskAgain: permissions.canAskAgain,
  };
}

async function requestPushNotificationPermission() {
  if (!isSupportedPlatform()) return false;

  if (Platform.OS === 'android') {
    return requestAndroidNotificationPermission();
  }

  const status = await messaging().requestPermission({
    alert: true,
    badge: true,
    sound: true,
  });

  return isAuthorizedStatus(status);
}

function canPromptForPushNotificationPermission(authorizationState: PushAuthorizationState) {
  return (
    authorizationState.status === AuthorizationStatus.NOT_DETERMINED ||
    isAuthorizedStatus(authorizationState.status) ||
    authorizationState.canAskAgain
  );
}

function shouldUseAndroidSystemNotificationPrompt(authorizationState: PushAuthorizationState) {
  return (
    Platform.OS === 'android' &&
    getAndroidApiLevel() >= 33 &&
    !authorizationState.granted &&
    authorizationState.canAskAgain
  );
}

export async function maybePromptForPushNotifications() {
  if (hasShownPushNotificationPrompt || !isSupportedPlatform() || !hasSupabaseConfig) {
    return;
  }

  try {
    const onboardingComplete = await AsyncStorage.getItem(ONBOARDING_KEY);
    if (!onboardingComplete) return;

    const promptSeen = await AsyncStorage.getItem(PUSH_NOTIFICATION_PROMPT_SEEN_KEY);
    if (promptSeen) return;

    if (store$.preferences.notificationsEnabled.get() ?? false) {
      return;
    }

    const authorizationState = await getPushAuthorizationState();
    if (!canPromptForPushNotificationPermission(authorizationState)) return;

    hasShownPushNotificationPrompt = true;

    if (shouldUseAndroidSystemNotificationPrompt(authorizationState)) {
      markPushNotificationPromptSeen();
      const result = await enablePushNotifications();
      if (!result.enabled && result.status !== 'permission_denied') {
        Alert.alert(
          'Notifications Not Enabled',
          result.message ?? 'Unable to enable notifications. Please try again.',
        );
      }
      return;
    }

    Alert.alert(
      'Enable Notifications?',
      'Get important portfolio updates and app announcements.',
      [
        {
          text: 'Not Now',
          style: 'cancel',
          onPress: () => {
            updatePreferences({ notificationsEnabled: false });
            markPushNotificationPromptSeen();
          },
        },
        {
          text: 'Enable',
          onPress: () => {
            markPushNotificationPromptSeen();
            void enablePushNotifications().then((result) => {
              if (!result.enabled && result.status !== 'permission_denied') {
                Alert.alert(
                  'Notifications Not Enabled',
                  result.message ?? 'Unable to enable notifications. Please try again.',
                );
              }
            }).catch((error) => {
              reportWarning('[Notifications] Prompt enable failed', error, {
                platform: Platform.OS,
              });
              updatePreferences({ notificationsEnabled: false });
            });
          },
        },
      ],
    );
  } catch (error) {
    reportWarning('[Notifications] Failed to show opt-in prompt', error, {
      platform: Platform.OS,
    });
  }
}

async function getFcmToken() {
  const instance = messaging();

  await instance.setAutoInitEnabled(true);

  if (Platform.OS === 'ios') {
    if (!instance.isDeviceRegisteredForRemoteMessages) {
      await instance.registerDeviceForRemoteMessages();
    }

    for (let attempt = 0; attempt < APNS_TOKEN_WAIT_ATTEMPTS; attempt++) {
      const apnsToken = await instance.getAPNSToken();
      if (apnsToken) break;

      if (attempt === APNS_TOKEN_WAIT_ATTEMPTS - 1) {
        throw new Error('APNs token was not available before FCM token registration.');
      }

      await sleep(APNS_TOKEN_WAIT_MS);
    }
  }

  return instance.getToken();
}

async function registerToken(fcmToken: string) {
  const payload: NotificationDevicePayload = {
    fcmToken,
    platform: Platform.OS as 'ios' | 'android',
    appVersion: getAppVersion(),
  };

  await postNotifications('register', payload);
}

async function unregisterToken(fcmToken: string) {
  await postNotifications('unregister', { fcmToken });
}

export async function enablePushNotifications(): Promise<PushNotificationResult> {
  if (!isSupportedPlatform()) {
    return { enabled: false, status: 'unsupported' };
  }

  if (!hasSupabaseConfig) {
    return {
      enabled: false,
      status: 'server_unavailable',
      message: 'Notifications require Supabase configuration.',
    };
  }

  let fcmToken: string | null = null;

  try {
    const hasPermission = await requestPushNotificationPermission();

    if (!hasPermission) {
      await messaging().setAutoInitEnabled(false);
      updatePreferences({ notificationsEnabled: false });
      void trackNotificationAction({ action: 'permission_denied' });
      return {
        enabled: false,
        status: 'permission_denied',
        message: 'Notification permission was not granted.',
      };
    }

    fcmToken = await getFcmToken();
    await registerToken(fcmToken);
    updatePreferences({ notificationsEnabled: true });
    void trackNotificationAction({ action: 'registered', target: Platform.OS });

    return { enabled: true, status: 'registered' };
  } catch (error) {
    reportError('[Notifications] Failed to enable push notifications', error, {
      platform: Platform.OS,
    });
    try {
      if (fcmToken) {
        await messaging().deleteToken();
      }
      await messaging().setAutoInitEnabled(false);
    } catch (cleanupError) {
      reportWarning('[Notifications] Failed to clean up after enable failure', cleanupError, {
        platform: Platform.OS,
      });
    }
    updatePreferences({ notificationsEnabled: false });
    return {
      enabled: false,
      status: 'error',
      message: getEnableFailureMessage(error),
    };
  }
}

export async function disablePushNotifications(): Promise<PushNotificationResult> {
  if (!isSupportedPlatform()) {
    updatePreferences({ notificationsEnabled: false });
    return { enabled: false, status: 'unsupported' };
  }

  const instance = messaging();
  let fcmToken: string | null = null;

  if (Platform.OS !== 'ios' || instance.isDeviceRegisteredForRemoteMessages) {
    try {
      fcmToken = await instance.getToken();
      if (fcmToken && hasSupabaseConfig) {
        await unregisterToken(fcmToken);
      }
    } catch (error) {
      if (!isUnregisteredForRemoteMessagesError(error)) {
        reportWarning('[Notifications] Failed to unregister FCM token', error, {
          platform: Platform.OS,
        });
      }
    }
  }

  if (fcmToken) {
    try {
      await instance.deleteToken();
    } catch (error) {
      reportWarning('[Notifications] Failed to delete local FCM token', error, {
        platform: Platform.OS,
      });
    }
  }

  try {
    if (Platform.OS === 'ios' && instance.isDeviceRegisteredForRemoteMessages) {
      await instance.unregisterDeviceForRemoteMessages();
    }
    await instance.setAutoInitEnabled(false);
  } catch (error) {
    reportWarning('[Notifications] Failed to disable messaging auto-init', error, {
      platform: Platform.OS,
    });
  }

  updatePreferences({ notificationsEnabled: false });
  void trackNotificationAction({ action: 'unregistered', target: Platform.OS });

  return { enabled: false, status: 'unregistered' };
}

export async function syncPushNotificationsOnStartup(): Promise<PushNotificationResult> {
  const notificationsEnabled = store$.preferences.notificationsEnabled.get() ?? false;

  if (!notificationsEnabled) {
    if (isSupportedPlatform()) {
      void messaging().setAutoInitEnabled(false);
    }
    return { enabled: false, status: 'unregistered' };
  }

  if (!isSupportedPlatform()) {
    updatePreferences({ notificationsEnabled: false });
    return { enabled: false, status: 'unsupported' };
  }

  if (!hasSupabaseConfig) {
    return {
      enabled: false,
      status: 'server_unavailable',
      message: 'Notifications require Supabase configuration.',
    };
  }

  try {
    const permissionStatus = await getPushAuthorizationStatus();
    if (!isAuthorizedStatus(permissionStatus)) {
      await messaging().setAutoInitEnabled(false);
      if (permissionStatus !== AuthorizationStatus.NOT_DETERMINED) {
        return disablePushNotifications();
      }
      return {
        enabled: notificationsEnabled,
        status: 'unregistered',
        message: 'Notification permission has not been requested.',
      };
    }

    const fcmToken = await getFcmToken();
    await registerToken(fcmToken);
    return { enabled: true, status: 'registered' };
  } catch (error) {
    reportWarning('[Notifications] Startup sync failed', error, {
      platform: Platform.OS,
    });
    return {
      enabled: notificationsEnabled,
      status: 'error',
      message: 'Notification sync failed.',
    };
  }
}

export async function sendTestPushNotification(): Promise<TestNotificationResponse> {
  const response = await postNotifications<TestNotificationResponse>('test', {});
  void trackNotificationAction({
    action: 'test_send',
    target: `${response.sent}`,
    source: response.failed > 0 ? 'partial_failure' : 'settings',
  });
  return response;
}

export function subscribeToPushNotificationHandlers() {
  if (!isSupportedPlatform()) {
    return () => {};
  }

  ensureForegroundNotificationPresentation();

  const instance = messaging();

  const expoResponseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateFromNotification(
      response.notification.request.content.data ?? {},
      'expo_response',
      response.notification.request.identifier,
    );
    Notifications.clearLastNotificationResponse();
  });

  const unsubscribeForeground = instance.onMessage((message) => {
    void displayAndroidForegroundNotification(message).catch((error) => {
      reportWarning('[Notifications] Failed to display foreground notification', error, {
        platform: Platform.OS,
      });
    });
    void trackNotificationAction({
      action: 'foreground_received',
      target: getMessageTarget(message),
      source: message.from,
    });
  });

  const unsubscribeOpened = instance.onNotificationOpenedApp((message) => {
    void trackNotificationAction({
      action: 'opened',
      target: getMessageTarget(message),
      source: message.from,
    });
    navigateFromNotification(message.data ?? {}, 'opened', message.messageId);
  });

  const unsubscribeTokenRefresh = instance.onTokenRefresh((fcmToken) => {
    if (!(store$.preferences.notificationsEnabled.get() ?? false)) return;

    void (async () => {
      try {
        if (!(await hasPushNotificationPermission())) return;
        await registerToken(fcmToken);
        void trackNotificationAction({ action: 'token_refresh', target: Platform.OS });
      } catch (error) {
        reportWarning('[Notifications] Token refresh registration failed', error, {
          platform: Platform.OS,
        });
      }
    })();
  });

  void instance.getInitialNotification().then((message) => {
    if (!message) return;
    void trackNotificationAction({
      action: 'initial_open',
      target: getMessageTarget(message),
      source: message.from,
    });
    navigateFromNotification(
      message.data ?? {},
      'initial_open',
      message.messageId,
      INITIAL_NOTIFICATION_NAVIGATION_DELAY_MS,
    );
  }).catch((error) => {
    reportWarning('[Notifications] Failed to read initial notification', error, {
      platform: Platform.OS,
    });
  });

  try {
    const lastNotificationResponse = Notifications.getLastNotificationResponse();
    if (lastNotificationResponse) {
      navigateFromNotification(
        lastNotificationResponse.notification.request.content.data ?? {},
        'expo_response',
        lastNotificationResponse.notification.request.identifier,
        INITIAL_NOTIFICATION_NAVIGATION_DELAY_MS,
      );
      Notifications.clearLastNotificationResponse();
    }
  } catch (error) {
    reportWarning('[Notifications] Failed to read Expo notification response', error, {
      platform: Platform.OS,
    });
  }

  return () => {
    expoResponseSubscription.remove();
    unsubscribeForeground();
    unsubscribeOpened();
    unsubscribeTokenRefresh();
  };
}
