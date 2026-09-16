import axios from 'axios';
import { requestUrl } from '../requestUrl';

const B = 'https://api.test';
const api = axios.create();

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
  expect(requestUrl(api, config)).toBe(expected);
});

test('no config or no url gives an empty string', () => {
  expect(requestUrl(api, undefined)).toBe('');
  expect(requestUrl(api, { method: 'get' })).toBe('');
});

test("the instance's own defaults take part, as they do in the request", () => {
  const own = axios.create({ baseURL: B, params: { apiKey: 'k' } });
  expect(requestUrl(own, { url: '/users', params: { own: 1 } })).toBe(`${B}/users?apiKey=k&own=1`);
});

test('defaults of other instances and of the global axios never leak in', () => {
  axios.create({ baseURL: 'https://other.example.com', params: { other: 1 } });
  axios.defaults.baseURL = 'https://global.example.com';
  axios.defaults.params = { apiKey: 'k' };
  expect(requestUrl(api, { url: '/users', params: { own: 1 } })).toBe('/users?own=1');
});

test('a serializer that throws falls back to the plain url', () => {
  const config = { url: 'https://api.test/x', params: { a: 1 }, paramsSerializer: { serialize: () => { throw new Error('boom'); } } };
  expect(requestUrl(api, config)).toBe('https://api.test/x');
});
