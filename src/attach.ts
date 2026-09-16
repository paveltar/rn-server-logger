import type { AxiosError, AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { add, isTracking, nextId, update } from './store';
import type { HttpEntry } from './store';
import { describeError, serialize } from './serialize';
import { requestUrl } from './requestUrl';

type Pending = { id: number; startedAt: number };

// axios hands the same config object to the request interceptor and back on response.config / error.config
const pending = new WeakMap<object, Pending>();
const attached = new WeakMap<AxiosInstance, { request: number; response: number }>();

const takePending = (config: object | undefined): Pending | undefined => {
  const started = config && pending.get(config);
  if (started) pending.delete(config);
  return started || undefined;
};

// Logging must never break a request: anything thrown inside the logger is swallowed
const guarded = <A extends unknown[]>(fn: (...args: A) => void) => (...args: A): void => {
  try {
    fn(...args);
  } catch {
    // ignore
  }
};

const methodOf = (config: AxiosRequestConfig | undefined): string => (config?.method ?? 'get').toUpperCase();

const complete = guarded((response: AxiosResponse | undefined) => {
  // `response` can be undefined when an interceptor registered earlier returned nothing
  const started = takePending(response?.config);
  if (!response || !started) return;
  const patch: Partial<HttpEntry> = { status: response.status, durationMs: Date.now() - started.startedAt };
  if (response.data !== undefined) patch.responseBody = serialize(response.data);
  update(started.id, patch);
});

// The URL is built by the instance itself (its getUri), so the handlers are created per instance
const createHandlers = (instance: AxiosInstance) => {
  const record = guarded((config: AxiosRequestConfig) => {
    if (!isTracking()) return;
    const startedAt = Date.now();
    const entry: HttpEntry = { id: nextId(), kind: 'http', startedAt, method: methodOf(config), url: requestUrl(instance, config) };
    if (config.data !== undefined) entry.requestBody = serialize(config.data);
    pending.set(config, { id: entry.id, startedAt });
    add(entry);
  });

  const fail = guarded((error: unknown) => {
    const { config, response } = (error ?? {}) as Partial<AxiosError>;
    const patch: Partial<HttpEntry> = { error: describeError(error) };
    if (response?.status !== undefined) patch.status = response.status;
    if (response?.data !== undefined) patch.responseBody = serialize(response.data);
    const started = takePending(config);
    if (started) {
      update(started.id, { ...patch, durationMs: Date.now() - started.startedAt });
      return;
    }
    // Thrown by another interceptor before the request was recorded: still worth a row.
    // If that interceptor was registered before attach, the logger already ran first and recorded
    // the entry; this plain Error carries no config, so this adds a second "(no request config)"
    // row while the first stays pending. The README's "attach first" advice avoids that order.
    add({
      id: nextId(),
      kind: 'http',
      startedAt: Date.now(),
      method: methodOf(config),
      url: config ? requestUrl(instance, config) : '(no request config)',
      ...patch,
    });
  });

  return {
    onRequest: <C extends AxiosRequestConfig>(config: C): C => {
      record(config);
      return config;
    },
    onResponse: <R extends AxiosResponse>(response: R): R => {
      complete(response);
      return response;
    },
    onError: (error: unknown): Promise<never> => {
      fail(error);
      return Promise.reject(error);
    },
  };
};

/**
 * Logs every request made through this instance. Call it right after axios.create, before adding your
 * own interceptors, so the log shows the request as sent and the response as received. Idempotent.
 */
export const attach = <T extends AxiosInstance>(instance: T): T => {
  if (!attached.has(instance)) {
    const { onRequest, onResponse, onError } = createHandlers(instance);
    attached.set(instance, {
      request: instance.interceptors.request.use(onRequest),
      response: instance.interceptors.response.use(onResponse, onError),
    });
  }
  return instance;
};

/** Stops logging this instance. */
export const detach = (instance: AxiosInstance): void => {
  const ids = attached.get(instance);
  if (!ids) return;
  instance.interceptors.request.eject(ids.request);
  instance.interceptors.response.eject(ids.response);
  attached.delete(instance);
};
