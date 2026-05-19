import Constants from 'expo-constants';
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
  if (!isSupportedPlatform()) return false;

  if (Platform.OS === 'android') {
    return hasAndroidNotificationPermission();
  }

  const status = await messaging().hasPermission();
  return isAuthorizedStatus(status);
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

  if (Platform.OS === 'ios' && !instance.isDeviceRegisteredForRemoteMessages) {
    await instance.registerDeviceForRemoteMessages();
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

    const fcmToken = await getFcmToken();
    await registerToken(fcmToken);
    updatePreferences({ notificationsEnabled: true });
    void trackNotificationAction({ action: 'registered', target: Platform.OS });

    return { enabled: true, status: 'registered' };
  } catch (error) {
    reportError('[Notifications] Failed to enable push notifications', error, {
      platform: Platform.OS,
    });
    try {
      await messaging().deleteToken();
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
      message: 'Unable to enable notifications. Please try again.',
    };
  }
}

export async function disablePushNotifications(): Promise<PushNotificationResult> {
  if (!isSupportedPlatform()) {
    updatePreferences({ notificationsEnabled: false });
    return { enabled: false, status: 'unsupported' };
  }

  const instance = messaging();

  try {
    const fcmToken = await instance.getToken();
    if (fcmToken && hasSupabaseConfig) {
      await unregisterToken(fcmToken);
    }
  } catch (error) {
    reportWarning('[Notifications] Failed to unregister FCM token', error, {
      platform: Platform.OS,
    });
  }

  try {
    await instance.deleteToken();
  } catch (error) {
    reportWarning('[Notifications] Failed to delete local FCM token', error, {
      platform: Platform.OS,
    });
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
    const hasPermission = await hasPushNotificationPermission();
    if (!hasPermission) {
      await disablePushNotifications();
      return {
        enabled: false,
        status: 'permission_revoked',
        message: 'Notification permission is no longer granted.',
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

  const instance = messaging();

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
    unsubscribeOpened();
    unsubscribeTokenRefresh();
  };
}
