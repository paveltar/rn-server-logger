import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

// An instance with no defaults: only the request's own baseURL, url, params and serializer take part.
// axios.getUri on the root instance would merge axios.defaults in. Needs axios >= 0.27 (earlier getUri ignores baseURL).
const bare = new axios.Axios({});

/** The URL axios actually requests for this config. Never throws. */
export const requestUrl = (config: AxiosRequestConfig | undefined): string => {
  if (!config) return '';
  try {
    return bare.getUri(config) || config.url || '';
  } catch {
    return config.url || '';
  }
};
