import inAppMessaging from '@react-native-firebase/in-app-messaging';
import installations from '@react-native-firebase/installations';
import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { trackInAppMessagingAction } from './analytics';
import { reportWarning } from './crashlytics';
import { store$, updatePreferences } from './store';

const SUPPRESSED_ROUTE_PREFIXES = [
  '/onboarding',
  '/import-transactions',
  '/import-confirm',
  '/modal',
];

let transientSuppressionCount = 0;
let hasLoggedInstallationId = false;

type SyncOptions = {
  throwOnError?: boolean;
};

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

export function shouldSuppressInAppMessages(pathname: string | null | undefined) {
  if (!pathname) return false;
  return SUPPRESSED_ROUTE_PREFIXES.some((prefix) => (
    pathname === prefix || pathname.startsWith(`${prefix}/`)
  ));
}

export async function syncInAppMessagingState(pathname?: string | null, options: SyncOptions = {}) {
  if (!isSupportedPlatform()) {
    return;
  }

  const enabled = store$.preferences.inAppMessagesEnabled.get() ?? true;
  const suppressed = (
    !enabled ||
    transientSuppressionCount > 0 ||
    shouldSuppressInAppMessages(pathname)
  );

  try {
    await Promise.all([
      inAppMessaging().setAutomaticDataCollectionEnabled(enabled),
      inAppMessaging().setMessagesDisplaySuppressed(suppressed),
    ]);
  } catch (error) {
    reportWarning('[InAppMessaging] Failed to sync state', error, {
      enabled,
      suppressed,
      pathname,
    });
    if (options.throwOnError) {
      throw error;
    }
  }
}

export async function logFirebaseInstallationId() {
  if (!__DEV__ || !isSupportedPlatform() || hasLoggedInstallationId) {
    return;
  }

  hasLoggedInstallationId = true;

  try {
    const installationId = await installations().getId();
    console.info(`[F2049_FIREBASE_INSTALLATION_ID] ${installationId}`);
  } catch (error) {
    hasLoggedInstallationId = false;
    reportWarning('[FirebaseInstallations] Failed to get installation ID', error);
  }
}

export async function setInAppMessagesEnabled(enabled: boolean, pathname?: string | null) {
  const previousEnabled = store$.preferences.inAppMessagesEnabled.get() ?? true;
  updatePreferences({ inAppMessagesEnabled: enabled });

  try {
    await syncInAppMessagingState(pathname, { throwOnError: true });
    void trackInAppMessagingAction({
      action: enabled ? 'enabled' : 'disabled',
      target: Platform.OS,
    });
  } catch (error) {
    updatePreferences({ inAppMessagesEnabled: previousEnabled });
    void syncInAppMessagingState(pathname);
    throw error;
  }
}

export function useInAppMessageSuppression(active: boolean) {
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  useEffect(() => {
    pathnameRef.current = pathname;
    if (active) {
      void syncInAppMessagingState(pathname);
    }
  }, [active, pathname]);

  useEffect(() => {
    if (!active) return;

    transientSuppressionCount += 1;
    void syncInAppMessagingState(pathnameRef.current);

    return () => {
      transientSuppressionCount = Math.max(0, transientSuppressionCount - 1);
      void syncInAppMessagingState(pathnameRef.current);
    };
  }, [active]);
}

export async function triggerInAppMessage(eventId: string) {
  if (!isSupportedPlatform()) {
    return;
  }

  try {
    await inAppMessaging().triggerEvent(eventId);
    void trackInAppMessagingAction({ action: 'triggered', target: eventId });
  } catch (error) {
    reportWarning('[InAppMessaging] Failed to trigger event', error, {
      eventId,
    });
  }
}
