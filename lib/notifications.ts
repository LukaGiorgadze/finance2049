import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import messaging, {
  AuthorizationStatus,
  type FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import { trackNotificationAction } from './analytics';
import { reportError, reportWarning } from './crashlytics';
import { API_CONFIG } from './services/config';
import { ensureSession, getAccessToken, hasSupabaseConfig } from './supabase';
import { store$, updatePreferences } from './store';

const ANDROID_POST_NOTIFICATIONS_PERMISSION = 'android.permission.POST_NOTIFICATIONS';
const ANDROID_FOREGROUND_CHANNEL_ID = 'default';
const APNS_TOKEN_WAIT_ATTEMPTS = 10;
const APNS_TOKEN_WAIT_MS = 500;

let hasConfiguredForegroundNotificationPresentation = false;

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

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function ensureForegroundNotificationPresentation() {
  if (hasConfiguredForegroundNotificationPresentation || !isSupportedPlatform()) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => {
      const shouldShow = store$.preferences.notificationsEnabled.get() ?? true;

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
    data.target ??
    data.route ??
    data.notification_id ??
    data.type ??
    message.messageId ??
    message.from;

  return typeof candidate === 'string' ? candidate : undefined;
}

async function displayAndroidForegroundNotification(
  message: FirebaseMessagingTypes.RemoteMessage,
) {
  if (Platform.OS !== 'android') return;
  if (!(store$.preferences.notificationsEnabled.get() ?? true)) return;
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

async function hasAndroidNotificationPermission() {
  if (Platform.OS !== 'android') return true;
  const apiLevel = getAndroidApiLevel();
  if (apiLevel < 33) return true;
  return PermissionsAndroid.check(ANDROID_POST_NOTIFICATIONS_PERMISSION as never);
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
  if (!isSupportedPlatform()) return AuthorizationStatus.DENIED;

  if (Platform.OS === 'android') {
    return (await hasAndroidNotificationPermission())
      ? AuthorizationStatus.AUTHORIZED
      : AuthorizationStatus.DENIED;
  }

  return messaging().hasPermission();
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
  const notificationsEnabled = store$.preferences.notificationsEnabled.get() ?? true;

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
  }).catch((error) => {
    reportWarning('[Notifications] Failed to read initial notification', error, {
      platform: Platform.OS,
    });
  });

  return () => {
    unsubscribeForeground();
    unsubscribeOpened();
    unsubscribeTokenRefresh();
  };
}
