import axios, {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from 'axios';
import { getAccessToken } from '../../supabase';

declare module 'axios' {
  interface AxiosRequestConfig {
    requiresAuth?: boolean;
    logLabel?: string;
  }
}

export const httpClient = axios.create({
  timeout: 30_000,
});

httpClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toUpperCase();
  const url = config.url ?? '';
  const label = config.logLabel ?? 'API';

  console.debug(`[${label}] ${method} ${url}`);

  if (!config.requiresAuth) {
    return config;
  }

  const token = await getAccessToken();
  if (!token) {
    return config;
  }

  const headers = AxiosHeaders.from(config.headers);
  headers.set('Authorization', `Bearer ${token}`);
  config.headers = headers;

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error),
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
    return '';
  }

  const data = error.response?.data;
  if (typeof data === 'string') {
    return data;
  }
  if (data == null) {
    return '';
  }

  try {
    return JSON.stringify(data);
  } catch {
    return '';
  }
}

export function isAxiosError(error: unknown): error is AxiosError {
  return isAxiosError(error);
}
