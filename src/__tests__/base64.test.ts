import { utf8ToBase64 } from '../base64';

// Node's Buffer is the reference; tsconfig.test.json has only jest types, so declare the slice used here
declare const Buffer: { from(text: string, encoding: 'utf8'): { toString(encoding: 'base64'): string } };
const reference = (text: string): string => Buffer.from(text, 'utf8').toString('base64');

test.each([
  ['empty', ''],
  ['one byte of padding left', 'a'],
  ['two bytes', 'ab'],
  ['no padding', 'abc'],
  ['ascii with newlines', 'GET https://api.test/users?accessToken=SECRET\nSTATUS: 200'],
  ['two-byte characters', 'café, naïve, ñ'],
  ['three-byte characters', 'שלום עולם, 日本語'],
  ['four-byte characters (surrogate pairs)', 'logs 🚀📦 done'],
  ['a long mixed text', 'abc שלום 🚀\n'.repeat(5000)],
])('%s matches Node', (_name, text) => {
  expect(utf8ToBase64(text)).toBe(reference(text));
});

test('lone surrogates become U+FFFD, as TextEncoder does', () => {
  expect(utf8ToBase64('a\uD800b\uDC00c')).toBe(reference('a�b�c'));
  expect(utf8ToBase64('end\uD83D')).toBe(reference('end�'));
});
