import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { reportWarning } from './crashlytics';
import type { InvestmentThesis } from './store/types';

const WHY_REVIEW_CHANNEL_ID = 'why-reviews';
const REVIEW_HOUR = 9;
const REVIEW_MINUTE = 0;

export interface WhyNotificationResult {
  enabled: boolean;
  notificationId?: string;
  message?: string;
}

function isSupportedPlatform() {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

function isFutureReviewDate(reviewDate: string) {
  const [year, month, day] = reviewDate.split('-').map(Number);
  const scheduled = new Date(year, (month ?? 1) - 1, day ?? 1, REVIEW_HOUR, REVIEW_MINUTE, 0, 0);
  return scheduled.getTime() > Date.now();
}

function getReviewDateTime(reviewDate: string) {
  const [year, month, day] = reviewDate.split('-').map(Number);
  const scheduled = new Date(year, (month ?? 1) - 1, day ?? 1, REVIEW_HOUR, REVIEW_MINUTE, 0, 0);
  const now = new Date();

  if (scheduled.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 60_000);
  }

  return scheduled;
}

async function ensureWhyNotificationPermission(requestPermission = true) {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!requestPermission) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync(WHY_REVIEW_CHANNEL_ID, {
    name: 'Thesis reviews',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export async function cancelWhyReviewNotification(notificationId?: string) {
  if (!notificationId || !isSupportedPlatform()) return;

  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch (error) {
    reportWarning('[WHY] Failed to cancel review notification', error, {
      notificationId,
    });
  }
}

function isWhyReviewNotification(request: Notifications.NotificationRequest) {
  const data = request.content.data ?? {};
  const type = typeof data.type === 'string' ? data.type : undefined;
  const route = typeof data.route === 'string' ? data.route : undefined;

  return type === 'why_review' || route?.startsWith('/why/review');
}

export async function cancelAllWhyReviewNotifications(notificationIds: Array<string | undefined> = []) {
  if (!isSupportedPlatform()) return;

  const uniqueIds = [...new Set(notificationIds.filter((id): id is string => !!id))];

  for (const notificationId of uniqueIds) {
    await cancelWhyReviewNotification(notificationId);
  }

  try {
    const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();

    await Promise.all(
      scheduledNotifications
        .filter((request) => !uniqueIds.includes(request.identifier) && isWhyReviewNotification(request))
        .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
    );
  } catch (error) {
    reportWarning('[WHY] Failed to cancel scheduled review notifications', error, {
      notificationCount: uniqueIds.length,
    });
  }
}

export async function scheduleWhyReviewNotification(params: {
  thesisId: string;
  symbol: string;
  reviewDate: string;
  previousNotificationId?: string;
  requestPermission?: boolean;
}): Promise<WhyNotificationResult> {
  if (!isSupportedPlatform()) {
    return {
      enabled: false,
      message: 'Review notifications are only available on iOS and Android.',
    };
  }

  const granted = await ensureWhyNotificationPermission(params.requestPermission ?? true);
  if (!granted) {
    return {
      enabled: false,
      message: 'Notification permission was not granted.',
    };
  }

  await cancelWhyReviewNotification(params.previousNotificationId);
  await ensureAndroidChannel();

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Review thesis: ${params.symbol}`,
        body: 'Revisit your thesis and decide what changed.',
        data: {
          type: 'why_review',
          route: `/why/review?id=${encodeURIComponent(params.thesisId)}`,
          thesis_id: params.thesisId,
          symbol: params.symbol,
        },
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: getReviewDateTime(params.reviewDate),
        channelId: WHY_REVIEW_CHANNEL_ID,
      },
    });

    return { enabled: true, notificationId };
  } catch (error) {
    reportWarning('[WHY] Failed to schedule review notification', error, {
      thesisId: params.thesisId,
      symbol: params.symbol,
      reviewDate: params.reviewDate,
    });
    return {
      enabled: false,
      message: 'Unable to schedule review notification.',
    };
  }
}

export async function restoreWhyReviewNotifications(theses: InvestmentThesis[]) {
  const normalizedTheses: InvestmentThesis[] = theses.map((thesis) => ({
    ...thesis,
    notifyOnReview: false,
    reviewNotificationId: undefined,
  }));

  const restorableTheses = theses.filter(
    (thesis) => thesis.status === 'active' && thesis.notifyOnReview && isFutureReviewDate(thesis.reviewDate),
  );

  if (!restorableTheses.length || !isSupportedPlatform()) {
    return {
      theses: normalizedTheses,
      scheduledCount: 0,
    };
  }

  const restoredById = new Map(normalizedTheses.map((thesis) => [thesis.id, thesis]));
  let scheduledCount = 0;

  for (const thesis of restorableTheses) {
    const result = await scheduleWhyReviewNotification({
      thesisId: thesis.id,
      symbol: thesis.symbol,
      reviewDate: thesis.reviewDate,
      requestPermission: false,
    });

    if (result.enabled) {
      restoredById.set(thesis.id, {
        ...thesis,
        notifyOnReview: true,
        reviewNotificationId: result.notificationId,
      });
      scheduledCount += 1;
    }
  }

  return {
    theses: normalizedTheses.map((thesis) => restoredById.get(thesis.id) ?? thesis),
    scheduledCount,
  };
}
