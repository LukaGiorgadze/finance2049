import {
  type OnboardingDiscoverySource,
  type OnboardingStep,
  type OnboardingThemeMode,
} from "@/constants/onboarding";
import { reportWarning } from "@/lib/crashlytics";
import analytics from "@react-native-firebase/analytics";

type AnalyticsParams = Record<
  string,
  string | number | boolean | string[] | number[] | boolean[] | null | undefined
>;

async function logEvent(name: string, params?: AnalyticsParams) {
  try {
    await analytics().logEvent(name, params);
  } catch (error) {
    reportWarning(`analytics.logEvent failed: ${name}`, error, {
      analytics_method: "logEvent",
      analytics_event_name: name,
      analytics_params: params ? JSON.stringify(params) : undefined,
    });
  }
}

async function setUserProperty(name: string, value: string) {
  try {
    await analytics().setUserProperty(name, value);
  } catch (error) {
    reportWarning(`analytics.setUserProperty failed: ${name}`, error, {
      analytics_method: "setUserProperty",
      analytics_property_name: name,
      analytics_property_value: value,
    });
  }
}

export async function trackOnboardingScreen() {
  try {
    await analytics().logScreenView({
      screen_name: "Onboarding",
      screen_class: "OnboardingScreen",
    });
  } catch (error) {
    reportWarning("analytics.logScreenView failed: onboarding", error, {
      analytics_method: "logScreenView",
      screen_name: "Onboarding",
      screen_class: "OnboardingScreen",
    });
  }
}

export async function trackOnboardingStarted() {
  await Promise.all([
    logEvent("onboarding_started"),
    setUserProperty("onboarding_state", "started"),
  ]);
}

export async function trackOnboardingStepViewed(
  step: OnboardingStep,
  stepIndex: number,
) {
  await logEvent("onboarding_step_viewed", {
    step_name: step,
    step_index: stepIndex,
  });
}

export async function trackOnboardingNavigation(params: {
  action: "next" | "back" | "skip" | "jump_to_rate" | "complete";
  step: OnboardingStep;
  stepIndex: number;
  cta: string;
}) {
  await logEvent("onboarding_navigation", {
    action: params.action,
    step_name: params.step,
    step_index: params.stepIndex,
    cta: params.cta,
  });
}

export async function trackOnboardingDiscoverySelected(
  source: OnboardingDiscoverySource,
) {
  await Promise.all([
    logEvent("onboarding_discovery_selected", { source }),
    setUserProperty("discovery_source", source),
  ]);
}

export async function trackOnboardingThemeSelected(theme: OnboardingThemeMode) {
  await Promise.all([
    logEvent("onboarding_theme_selected", { theme }),
    setUserProperty("theme_pref", theme),
  ]);
}

export async function trackOnboardingImportDecision(
  choice: "import_now" | "later",
) {
  await logEvent("onboarding_import_decision", { choice });
}

export async function trackOnboardingReviewPrompt(
  status: "requested" | "unavailable" | "failed",
) {
  await logEvent("onboarding_review_prompt", { status });
}

export async function trackOnboardingExited(params: {
  step: OnboardingStep;
  stepIndex: number;
  discoverySource: OnboardingDiscoverySource | null;
  importPlanned: boolean;
}) {
  await logEvent("onboarding_exited", {
    step_name: params.step,
    step_index: params.stepIndex,
    discovery_source: params.discoverySource ?? "unknown",
    import_planned: params.importPlanned,
  });
}

export async function trackOnboardingCompleted(params: {
  discoverySource: OnboardingDiscoverySource | null;
  theme: OnboardingThemeMode;
  importPlanned: boolean;
}) {
  await Promise.all([
    logEvent("onboarding_completed", {
      discovery_source: params.discoverySource ?? "unknown",
      theme: params.theme,
      import_planned: params.importPlanned,
    }),
    setUserProperty("onboarding_done", "true"),
    setUserProperty("onboarding_state", "completed"),
  ]);
}
