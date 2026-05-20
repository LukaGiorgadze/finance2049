import { APP_REVIEW_PROMPT_KEY } from '@/constants/storage-keys';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';

const REVIEW_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;
const REVIEW_MIN_SUCCESSFUL_ACTIONS = 3;

type ReviewPromptState = {
  successfulActionCount: number;
  lastPromptedAt: string | null;
  nextEligibleAt: string | null;
};

const DEFAULT_STATE: ReviewPromptState = {
  successfulActionCount: 0,
  lastPromptedAt: null,
  nextEligibleAt: null,
};

async function readReviewPromptState(): Promise<ReviewPromptState> {
  try {
    const raw = await AsyncStorage.getItem(APP_REVIEW_PROMPT_KEY);
    if (!raw) return DEFAULT_STATE;

    const parsed = JSON.parse(raw) as Partial<ReviewPromptState>;
    return {
      successfulActionCount: typeof parsed.successfulActionCount === 'number' && parsed.successfulActionCount > 0
        ? parsed.successfulActionCount
        : 0,
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
  if (state.successfulActionCount < REVIEW_MIN_SUCCESSFUL_ACTIONS) return false;
  if (!state.nextEligibleAt) return true;

  const nextEligibleMs = Date.parse(state.nextEligibleAt);
  if (Number.isNaN(nextEligibleMs)) return true;

  return now >= nextEligibleMs;
}

export async function maybePromptForAppReview() {
  const now = Date.now();
  const state = await readReviewPromptState();
  const nextState: ReviewPromptState = {
    ...state,
    successfulActionCount: state.successfulActionCount + 1,
  };

  if (!isEligible(nextState, now)) {
    await writeReviewPromptState(nextState);
    return;
  }

  const available = await StoreReview.hasAction().catch(() => false);
  if (!available) {
    await writeReviewPromptState(nextState);
    return;
  }

  try {
    await StoreReview.requestReview();
    await writeReviewPromptState({
      ...nextState,
      // Expo does not expose whether the user submitted a rating, so store attempts only.
      successfulActionCount: 0,
      lastPromptedAt: new Date(now).toISOString(),
      nextEligibleAt: new Date(now + REVIEW_COOLDOWN_MS).toISOString(),
    });
  } catch {
    await writeReviewPromptState(nextState).catch(() => undefined);
    // Ignore failures so the main success flow continues without interruption.
  }
}
