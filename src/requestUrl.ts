import type { AxiosInstance, AxiosRequestConfig } from 'axios';

/**
 * The URL this instance requests for the config. Never throws.
 * Request interceptors see the config already merged with the instance defaults, and getUri merges
 * them once more, which changes nothing: the result is the URL as sent, and no other instance's
 * defaults take part. Needs axios >= 0.27 (earlier getUri ignores baseURL).
 */
export const requestUrl = (instance: Pick<AxiosInstance, 'getUri'>, config: AxiosRequestConfig | undefined): string => {
  if (!config) return '';
  try {
    return instance.getUri(config) || config.url || '';
  } catch {
    return config.url || '';
  }
};
