import axios from 'axios';
import { requestUrl } from '../requestUrl';

const B = 'https://api.test';

afterEach(() => {
  axios.defaults.baseURL = undefined;
  axios.defaults.params = undefined;
});

test.each([
  ['baseURL + "/users"', { baseURL: B, url: '/users' }, `${B}/users`],
  ['baseURL with trailing slash', { baseURL: `${B}/`, url: '/users' }, `${B}/users`],
  ['url without leading slash', { baseURL: B, url: 'users' }, `${B}/users`],
  ['baseURL with path', { baseURL: `${B}/v2/`, url: 'users' }, `${B}/v2/users`],
  ['baseURL only', { baseURL: `${B}/health` }, `${B}/health`],
  ['absolute url wins over baseURL', { baseURL: B, url: 'https://other.test/x' }, 'https://other.test/x'],
  ['allowAbsoluteUrls: false', { baseURL: B, url: 'https://other.test/x', allowAbsoluteUrls: false }, `${B}/https://other.test/x`],
  ['no baseURL', { url: 'https://other.test/x' }, 'https://other.test/x'],
  ['params', { baseURL: B, url: '/users', params: { page: 2, tags: ['a', 'b'] } }, `${B}/users?page=2&tags%5B%5D=a&tags%5B%5D=b`],
  ['params appended to an existing query', { baseURL: B, url: '/users?sort=asc', params: { page: 2 } }, `${B}/users?sort=asc&page=2`],
  ['custom serializer', { baseURL: B, url: '/users', params: { page: 2 }, paramsSerializer: { serialize: () => 'custom=1' } }, `${B}/users?custom=1`],
  ['tokens are kept', { baseURL: B, url: '/me?accessToken=SECRET', params: { lang: 'en' } }, `${B}/me?accessToken=SECRET&lang=en`],
])('%s', (_name, config, expected) => {
  expect(requestUrl(config)).toBe(expected);
});

test('no config or no url gives an empty string', () => {
  expect(requestUrl(undefined)).toBe('');
  expect(requestUrl({ method: 'get' })).toBe('');
});

test('global axios defaults never leak in', () => {
  axios.defaults.baseURL = 'https://global.example.com';
  axios.defaults.params = { apiKey: 'k' };
  expect(requestUrl({ url: '/users', params: { own: 1 } })).toBe('/users?own=1');
});

test('a serializer that throws falls back to the plain url', () => {
  const config = { url: 'https://api.test/x', params: { a: 1 }, paramsSerializer: { serialize: () => { throw new Error('boom'); } } };
  expect(requestUrl(config)).toBe('https://api.test/x');
});
