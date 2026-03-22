import crashlytics from '@react-native-firebase/crashlytics';

let hasInstalledGlobalHandler = false;

type ErrorHandler = (error: Error, isFatal?: boolean) => void;

type ErrorUtilsShape = {
  getGlobalHandler?: () => ErrorHandler | undefined;
  setGlobalHandler: (handler: ErrorHandler) => void;
};

export function initializeCrashlytics() {
  crashlytics().setCrashlyticsCollectionEnabled(!__DEV__);

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
    crashlytics().recordError(error);

    if (defaultHandler) {
      defaultHandler(error, isFatal);
    }
  });

  hasInstalledGlobalHandler = true;
}

export function recordError(error: unknown, context?: string) {
  const normalizedError = error instanceof Error ? error : new Error(String(error));

  if (context) {
    crashlytics().log(context);
  }

  crashlytics().recordError(normalizedError);
}

export function logCrashlyticsMessage(message: string) {
  crashlytics().log(message);
}
