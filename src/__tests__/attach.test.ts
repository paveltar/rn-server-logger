import axios, { AxiosError } from 'axios';
import type { AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';
import { attach, detach } from '../attach';
import { print } from '../print';
import * as store from '../store';
import { clear, getEntries, setTracking } from '../store';
import type { HttpEntry } from '../store';

// tsconfig.test.json restricts global types to "jest" only, so the ambient Node/DOM setTimeout
// is not visible here; this declaration only affects typechecking, not the runtime function used below.
declare function setTimeout(callback: (...args: unknown[]) => void, ms?: number): unknown;

type Kind = 'ok' | '500' | 'timeout' | 'etimedout' | 'aborted' | 'network' | 'canceled';

// Typed as InternalAxiosRequestConfig (not AxiosRequestConfig) because the object this returns/throws
// is used as an AxiosAdapter's response/error config, which axios 1.20.0's types require to be internal.
const adapter = (kind: Kind) => async (config: InternalAxiosRequestConfig) => {
  switch (kind) {
    case 'ok': return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    case '500': throw new AxiosError('Request failed with status code 500', 'ERR_BAD_RESPONSE', config as never, null,
      { data: { error: 'server exploded' }, status: 500, statusText: 'ISE', headers: {}, config } as never);
    case 'timeout': throw new AxiosError('timeout of 5000ms exceeded', 'ECONNABORTED', config as never);
    case 'etimedout': throw new AxiosError('custom slow message', 'ETIMEDOUT', config as never);
    case 'aborted': throw new AxiosError('Request aborted', 'ECONNABORTED', config as never);
    case 'network': throw new AxiosError('Network Error', 'ERR_NETWORK', config as never);
    case 'canceled': throw new axios.CanceledError('canceled', config as never);
  }
};

const call = (api: AxiosInstance, kind: Kind, path = `/${kind}`, config: AxiosRequestConfig = {}) =>
  api.get(path, { adapter: adapter(kind), ...config }).catch(() => undefined);

const latest = () => getEntries()[0] as HttpEntry;

let api: AxiosInstance;

beforeEach(() => {
  clear();
  setTracking(true);
  api = attach(axios.create({ baseURL: 'https://api.test' }));
});

afterEach(() => {
  axios.defaults.params = undefined;
});

test('attach returns the instance', () => {
  const instance = axios.create();
  expect(attach(instance)).toBe(instance);
});

test('a successful GET is one entry with url, status, duration and body', async () => {
  await call(api, 'ok', '/users', { params: { page: 2 } });
  expect(getEntries()).toHaveLength(1);
  const entry = latest();
  expect(entry.kind).toBe('http');
  expect(entry.method).toBe('GET');
  expect(entry.url).toBe('https://api.test/users?page=2');
  expect(entry.status).toBe(200);
  expect(typeof entry.durationMs).toBe('number');
  expect(entry.requestBody).toBeUndefined();
  expect(JSON.parse(entry.responseBody as string)).toEqual({ ok: true });
  expect(entry.error).toBeUndefined();
});

test('a POST body is serialized on the entry', async () => {
  await api.post('/orders', { a: 1 }, { adapter: adapter('ok') });
  expect(latest().method).toBe('POST');
  expect(latest().requestBody).toBe('{\n  "a": 1\n}');
});

test('an HTTP 500 keeps the status and the server body, plus an error line', async () => {
  await call(api, '500');
  const entry = latest();
  expect(entry.status).toBe(500);
  expect(entry.responseBody).toContain('server exploded');
  expect(entry.error).toBe('ERR_BAD_RESPONSE: Request failed with status code 500');
});

test.each([
  ['timeout', 'Timeout: timeout of 5000ms exceeded'],
  ['etimedout', 'Timeout: custom slow message'],
  ['aborted', 'ECONNABORTED: Request aborted'],
  ['network', 'ERR_NETWORK: Network Error'],
  ['canceled', 'Canceled'],
] as [Kind, string][])('%s has no status and the error "%s"', async (kind, expected) => {
  await call(api, kind);
  expect(latest().status).toBeUndefined();
  expect(latest().responseBody).toBeUndefined();
  expect(latest().error).toBe(expected);
});

test('global axios defaults do not leak into the url', async () => {
  axios.defaults.params = { apiKey: 'k' };
  const late = attach(new axios.Axios({}) as unknown as AxiosInstance);
  await late.request({ url: 'https://inst/rel', method: 'get', params: { own: 1 }, adapter: adapter('ok') });
  expect(latest().url).toBe('https://inst/rel?own=1');
});

test('attach twice logs once; detach stops logging', async () => {
  attach(api);
  await call(api, 'ok');
  expect(getEntries()).toHaveLength(1);
  detach(api);
  await call(api, 'ok');
  expect(getEntries()).toHaveLength(1);
});

test('tracking off records nothing, but a call that started earlier still completes', async () => {
  let release: () => void = () => undefined;
  const slow = api.get('/slow', {
    adapter: async (config) => { await new Promise<void>((resolve) => { release = resolve; }); return { data: 1, status: 200, statusText: 'OK', headers: {}, config }; },
  });
  await new Promise((resolve) => setTimeout(resolve, 0)); // let the request interceptor run
  expect(getEntries()).toHaveLength(1);
  setTracking(false);
  await call(api, 'ok');
  release();
  await slow;
  expect(getEntries()).toHaveLength(1);
  expect(latest().url).toBe('https://api.test/slow');
  expect(latest().status).toBe(200);
});

test('an exception inside the logger never rejects the request', async () => {
  const spy = jest.spyOn(store, 'add').mockImplementation(() => { throw new Error('logger bug'); });
  try {
    const response = await api.get('/ok', { adapter: adapter('ok') });
    expect(response.status).toBe(200);
  } finally {
    spy.mockRestore();
  }
});

test('a response interceptor registered earlier that returns nothing does not break anything', async () => {
  const forgetful = axios.create();
  forgetful.interceptors.response.use(() => undefined as never);
  attach(forgetful);
  const result = await forgetful.get('https://x/ok', { adapter: adapter('ok') });
  expect(result).toBeUndefined();
  expect(getEntries()).toHaveLength(1);
  expect(latest().status).toBeUndefined();
});

test('an error thrown by another request interceptor still gets a row', async () => {
  api.interceptors.request.use(() => { throw new Error('no token'); });
  await call(api, 'ok');
  expect(getEntries()).toHaveLength(1);
  expect(latest().url).toBe('(no request config)');
  expect(latest().error).toBe('no token');
});

test('print adds a print entry and returns its argument', () => {
  const value = { userId: 5 };
  expect(print(value)).toBe(value);
  const entry = getEntries()[0];
  expect(entry.kind).toBe('print');
  expect(entry.kind === 'print' && entry.text).toBe('{\n  "userId": 5\n}');
  setTracking(false);
  expect(print('ignored')).toBe('ignored');
  expect(getEntries()).toHaveLength(1);
});
