import {
  getCrashlytics,
  log as logToCrashlytics,
  recordError as recordCrashlyticsError,
  setCrashlyticsCollectionEnabled,
} from '@react-native-firebase/crashlytics';

let hasInstalledGlobalHandler = false;
const crashlytics = getCrashlytics();

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

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

export function recordError(error: unknown, context?: string) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  if (context) {
    logToCrashlytics(crashlytics, context);
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

export function reportWarning(context: string, error?: unknown) {
  debugLocally('warn', context, error);
  recordError(error ?? new Error(context), context);
}

export function reportError(context: string, error?: unknown) {
  debugLocally('error', context, error);
  recordError(error ?? new Error(context), context);
}

export function logCrashlyticsMessage(message: string) {
  logToCrashlytics(crashlytics, message);
}
