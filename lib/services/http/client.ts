import { getApp } from "@react-native-firebase/app";
import {
  httpMetric as createHttpMetric,
  getPerformance,
  type FirebasePerformanceTypes,
} from "@react-native-firebase/perf";
import axios, {
  AxiosHeaders,
  isAxiosError,
  type AxiosResponseHeaders,
  type InternalAxiosRequestConfig,
  type RawAxiosResponseHeaders,
} from "axios";
import { getAccessToken } from "../../supabase";

type HttpMetric = FirebasePerformanceTypes.HttpMetric;
type HttpMethod = FirebasePerformanceTypes.HttpMethod;

const VALID_HTTP_METHODS = new Set<HttpMethod>([
  "GET",
  "HEAD",
  "PUT",
  "POST",
  "PATCH",
  "TRACE",
  "DELETE",
  "CONNECT",
  "OPTIONS",
]);

declare module "axios" {
  interface AxiosRequestConfig {
    requiresAuth?: boolean;
    logLabel?: string;
    metadata?: {
      httpMetric?: HttpMetric;
    };
  }
}

export const httpClient = axios.create({
  timeout: 400_000,
});

function normalizeHttpMethod(method?: string): HttpMethod | null {
  const normalized = method?.toUpperCase();
  if (!normalized || !VALID_HTTP_METHODS.has(normalized as HttpMethod)) {
    return null;
  }

  return normalized as HttpMethod;
}

function getResponseContentType(
  headers?: AxiosResponseHeaders | RawAxiosResponseHeaders,
): string | null {
  if (!headers) {
    return null;
  }

  const contentType = headers["content-type"] ?? headers["Content-Type"];
  return typeof contentType === "string" ? contentType : null;
}

async function stopHttpMetric(
  httpMetric: HttpMetric | undefined,
  status?: number,
  headers?: AxiosResponseHeaders | RawAxiosResponseHeaders,
) {
  if (!httpMetric) {
    return;
  }

  if (typeof status === "number") {
    httpMetric.setHttpResponseCode(status);
  }

  httpMetric.setResponseContentType(getResponseContentType(headers));
  await httpMetric.stop();
}

httpClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? "get").toUpperCase();
    const url = config.url ?? "";
    const label = config.logLabel ?? "API";

    console.debug(`[${label}] ${method} ${url}`);

    try {
      const httpMethod = normalizeHttpMethod(config.method);
      if (config.url && httpMethod) {
        const httpMetric = createHttpMetric(
          getPerformance(getApp()),
          config.url,
          httpMethod,
        );
        config.metadata = {
          ...config.metadata,
          httpMetric,
        };
        await httpMetric.start();
      }
    } catch {
      // Ignore performance metric failures so networking behavior stays unchanged.
    }

    if (!config.requiresAuth) {
      return config;
    }

    const token = await getAccessToken();
    if (!token) {
      return config;
    }

    const headers = AxiosHeaders.from(config.headers);
    headers.set("Authorization", `Bearer ${token}`);
    config.headers = headers;

    return config;
  },
);

httpClient.interceptors.response.use(
  async (response) => {
    try {
      await stopHttpMetric(
        response.config.metadata?.httpMetric,
        response.status,
        response.headers,
      );
    } finally {
      return response;
    }
  },
  async (error) => {
    try {
      await stopHttpMetric(
        error.config?.metadata?.httpMetric,
        error.response?.status,
        error.response?.headers,
      );
    } finally {
      return Promise.reject(error);
    }
  },
);

export function isNetworkError(error: unknown): boolean {
  return isAxiosError(error) && !error.response;
}

export function getResponseStatus(error: unknown): number | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }

  return error.response?.status;
}

export function getResponseData<T>(error: unknown): T | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }

  return error.response?.data as T | undefined;
}

export function getResponseText(error: unknown): string {
  if (!isAxiosError(error)) {
    return "";
  }

  const data = error.response?.data;
  if (typeof data === "string") {
    return data;
  }
  if (data == null) {
    return "";
  }

  try {
    return JSON.stringify(data);
  } catch {
    return "";
  }
}
