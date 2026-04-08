import { APP_REVIEW_PROMPT_KEY } from '@/constants/storage-keys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

type ReviewPromptState = {
  completedAt: string | null;
  lastPromptedAt: string | null;
  nextEligibleAt: string | null;
};

const DEFAULT_STATE: ReviewPromptState = {
  completedAt: null,
  lastPromptedAt: null,
  nextEligibleAt: null,
};

async function readReviewPromptState(): Promise<ReviewPromptState> {
  try {
    const raw = await AsyncStorage.getItem(APP_REVIEW_PROMPT_KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as Partial<ReviewPromptState>;
    return {
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      lastPromptedAt: typeof parsed.lastPromptedAt === 'string'
        ? parsed.lastPromptedAt
        : typeof (parsed as { lastDismissedAt?: string }).lastDismissedAt === 'string'
          ? (parsed as { lastDismissedAt: string }).lastDismissedAt
          : null,
      nextEligibleAt: typeof parsed.nextEligibleAt === 'string' ? parsed.nextEligibleAt : null,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

async function writeReviewPromptState(state: ReviewPromptState) {
  await AsyncStorage.setItem(APP_REVIEW_PROMPT_KEY, JSON.stringify(state));
}

function isEligible(state: ReviewPromptState, now: number) {
  if (state.completedAt) return false;
  if (!state.nextEligibleAt) return true;

  const nextEligibleMs = Date.parse(state.nextEligibleAt);
  if (Number.isNaN(nextEligibleMs)) return true;

  return now >= nextEligibleMs;
}

export async function maybePromptForAppReview() {
  const available = await StoreReview.isAvailableAsync().catch(() => false);
  if (!available) return;

  const now = Date.now();
  const state = await readReviewPromptState();
  if (!isEligible(state, now)) return;

  try {
    await StoreReview.requestReview();
    await writeReviewPromptState({
      ...state,
      lastPromptedAt: new Date(now).toISOString(),
      nextEligibleAt: new Date(now + REVIEW_COOLDOWN_MS).toISOString(),
    });
  } catch {
    // Ignore failures so the main success flow continues without interruption.
  }
}
