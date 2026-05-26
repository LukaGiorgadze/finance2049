import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { reportWarning } from './crashlytics';

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

function getReviewDateTime(reviewDate: string) {
  const [year, month, day] = reviewDate.split('-').map(Number);
  const scheduled = new Date(year, (month ?? 1) - 1, day ?? 1, REVIEW_HOUR, REVIEW_MINUTE, 0, 0);
  const now = new Date();

  if (scheduled.getTime() <= now.getTime()) {
    return new Date(now.getTime() + 60_000);
  }

  return scheduled;
}

async function ensureWhyNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

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

export async function scheduleWhyReviewNotification(params: {
  thesisId: string;
  symbol: string;
  reviewDate: string;
  previousNotificationId?: string;
}): Promise<WhyNotificationResult> {
  if (!isSupportedPlatform()) {
    return {
      enabled: false,
      message: 'Review notifications are only available on iOS and Android.',
    };
  }

  const granted = await ensureWhyNotificationPermission();
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
