import {
  getCrashlytics,
  log as logToCrashlytics,
  recordError as recordCrashlyticsError,
  setAttribute as setCrashlyticsAttribute,
  setAttributes as setCrashlyticsAttributes,
  setCrashlyticsCollectionEnabled,
  setUserId as setCrashlyticsUserId,
} from '@react-native-firebase/crashlytics';

let hasInstalledGlobalHandler = false;
const crashlytics = getCrashlytics();

type ErrorHandler = (error: Error, isFatal?: boolean) => void;
type CrashAttributeValue = string | number | boolean | null | undefined;
type CrashAttributes = Record<string, CrashAttributeValue>;

type ErrorUtilsShape = {
  getGlobalHandler?: () => ErrorHandler | undefined;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

export function initializeCrashlytics() {
  void setCrashlyticsCollectionEnabled(crashlytics, !__DEV__);

  if (hasInstalledGlobalHandler) {
    return;
  }

  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;

  if (!errorUtils?.setGlobalHandler) {
    hasInstalledGlobalHandler = true;
    return;
  }

  const defaultHandler = errorUtils.getGlobalHandler?.();

  errorUtils.setGlobalHandler((error, isFatal) => {
    recordCrashlyticsError(crashlytics, error);

    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });

  hasInstalledGlobalHandler = true;
}

function normalizeAttributes(attributes?: CrashAttributes): Record<string, string> {
  if (!attributes) return {};

  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([, value]) => value != null)
      .map(([key, value]) => [key, String(value)]),
  );
}

export async function setCrashUser(userId: string | null | undefined) {
  await setCrashlyticsUserId(crashlytics, userId ?? '');
}

export async function setCrashAttribute(key: string, value: CrashAttributeValue) {
  if (value == null) return;
  await setCrashlyticsAttribute(crashlytics, key, String(value));
}

export async function setCrashAttributes(attributes: CrashAttributes) {
  const normalized = normalizeAttributes(attributes);
  if (Object.keys(normalized).length === 0) return;
  await setCrashlyticsAttributes(crashlytics, normalized);
}

export function recordError(error: unknown, context?: string, attributes?: CrashAttributes) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const normalizedAttributes = normalizeAttributes(attributes);

  if (context) {
    logToCrashlytics(crashlytics, context);
  }

  if (Object.keys(normalizedAttributes).length > 0) {
    void setCrashlyticsAttributes(crashlytics, normalizedAttributes);
  }

  recordCrashlyticsError(crashlytics, normalizedError);
}

function debugLocally(level: 'warn' | 'error', context: string, error?: unknown) {
  if (!__DEV__) return;

  if (typeof error === 'undefined') {
    console.debug(`[${level}] ${context}`);
    return;
  }

  console.debug(`[${level}] ${context}`, error);
}

export function reportWarning(context: string, error?: unknown, attributes?: CrashAttributes) {
  debugLocally('warn', context, error);
  recordError(error ?? new Error(context), context, attributes);
}

export function reportError(context: string, error?: unknown, attributes?: CrashAttributes) {
  debugLocally('error', context, error);
  recordError(error ?? new Error(context), context, attributes);
}

export function logCrashlyticsMessage(message: string) {
  logToCrashlytics(crashlytics, message);
}
