import axios, { AxiosError } from 'axios';
import { describeError, MAX_BODY_LENGTH, serialize } from '../serialize';

describe('serialize', () => {
  test('strings are returned as they are', () => {
    expect(serialize('plain')).toBe('plain');
  });

  test('primitives, null and functions', () => {
    expect(serialize(5)).toBe('5');
    expect(serialize(null)).toBe('null');
    expect(serialize(undefined)).toBe('undefined');
    expect(serialize(function load() {})).toBe('[Function load]');
  });

  test('objects are pretty-printed with two spaces', () => {
    expect(serialize({ a: 1 })).toBe('{\n  "a": 1\n}');
  });

  test('a shared (non-circular) reference is written out both times', () => {
    const address = { city: 'TLV' };
    expect(JSON.parse(serialize({ billing: address, shipping: address }))).toEqual({
      billing: { city: 'TLV' },
      shipping: { city: 'TLV' },
    });
  });

  test('only true cycles print as [Circular]', () => {
    const node: { name: string; self?: unknown } = { name: 'n' };
    node.self = node;
    expect(JSON.parse(serialize(node))).toEqual({ name: 'n', self: '[Circular]' });
  });

  test('errors keep name, message, stack and cause', () => {
    const error = new Error('save failed', { cause: { code: 'ERR_NETWORK' } });
    const parsed = JSON.parse(serialize(error));
    expect(parsed.name).toBe('Error');
    expect(parsed.message).toBe('save failed');
    expect(typeof parsed.stack).toBe('string');
    expect(parsed.cause).toEqual({ code: 'ERR_NETWORK' });
  });

  test('Map, Set, BigInt and symbols do not throw', () => {
    const text = serialize({ map: new Map([['k', 1]]), set: new Set([1, 2]), big: 10n, sym: Symbol('s') });
    expect(JSON.parse(text)).toEqual({ map: [['k', 1]], set: [1, 2], big: '10n', sym: 'Symbol(s)' });
  });

  test('output longer than MAX_BODY_LENGTH is cut with a marker', () => {
    const text = serialize('x'.repeat(100 * 1024));
    expect(text.length).toBeLessThan(MAX_BODY_LENGTH + 100);
    expect(text.endsWith('... [truncated, 100 KB total]')).toBe(true);
  });
});

describe('describeError', () => {
  const error = (message: string, code?: string) => new AxiosError(message, code);

  test('timeouts are labelled', () => {
    expect(describeError(error('timeout of 5000ms exceeded', 'ECONNABORTED'))).toBe('Timeout: timeout of 5000ms exceeded');
    expect(describeError(error('custom slow message', 'ETIMEDOUT'))).toBe('Timeout: custom slow message');
  });

  test('an aborted request is not a timeout', () => {
    expect(describeError(error('Request aborted', 'ECONNABORTED'))).toBe('ECONNABORTED: Request aborted');
  });

  test('code and message otherwise', () => {
    expect(describeError(error('Network Error', 'ERR_NETWORK'))).toBe('ERR_NETWORK: Network Error');
    expect(describeError(error('Request failed with status code 500', 'ERR_BAD_RESPONSE'))).toBe('ERR_BAD_RESPONSE: Request failed with status code 500');
  });

  test('a plain Error has no code', () => {
    expect(describeError(new Error('no token'))).toBe('no token');
  });

  test('a canceled request', () => {
    expect(describeError(new axios.CanceledError('canceled'))).toBe('Canceled');
  });

  test('something that is not an error at all', () => {
    expect(describeError({ weird: true })).toBe('{\n  "weird": true\n}');
  });
});
