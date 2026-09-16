import { Alert, Share } from 'react-native';
import { entriesToText, entryToText, MAX_EXPORT_LENGTH, shareEntries } from '../exportText';
import type { HttpEntry, LogEntry, PrintEntry } from '../store';

const at = new Date(2026, 8, 16, 22, 17, 26, 66).getTime();
const time = '16-09-26 22:17:26.066';

const http = (over: Partial<HttpEntry> = {}): HttpEntry => ({
  id: 1, kind: 'http', startedAt: at, method: 'GET', url: 'https://api.test/users?page=2', ...over,
});

test('a completed call', () => {
  expect(entryToText(http({ status: 200, durationMs: 123, requestBody: '{\n  "a": 1\n}', responseBody: '{\n  "ok": true\n}' }))).toBe(
    [`${time}  GET https://api.test/users?page=2`, 'STATUS: 200  (123 ms)', 'REQUEST:', '{\n  "a": 1\n}', 'RESPONSE:', '{\n  "ok": true\n}'].join('\n')
  );
});

test('a call still in flight has only the first line', () => {
  expect(entryToText(http())).toBe(`${time}  GET https://api.test/users?page=2`);
});

test('a failed call without a response', () => {
  expect(entryToText(http({ durationMs: 5000, error: 'Timeout: timeout of 5000ms exceeded' }))).toBe(
    [`${time}  GET https://api.test/users?page=2`, 'STATUS: -  (5000 ms)', 'ERROR: Timeout: timeout of 5000ms exceeded'].join('\n')
  );
});

test('a print entry', () => {
  const entry: PrintEntry = { id: 2, kind: 'print', startedAt: at, text: 'hello\nworld' };
  expect(entryToText(entry)).toBe(`${time}  PRINT\nhello\nworld`);
});

test('entries are separated and kept in the given order', () => {
  const text = entriesToText([http({ id: 2, url: 'https://api.test/second' }), http({ id: 1, url: 'https://api.test/first' })]);
  expect(text.indexOf('/second')).toBeLessThan(text.indexOf('/first'));
  expect(text).toBe(
    `${time}  GET https://api.test/second\n---------------------------------\n\n${time}  GET https://api.test/first\n---------------------------------\n\n`
  );
});

test('older entries past the size cap are left out with a note', () => {
  const body = 'x'.repeat(128 * 1024);
  const entries: LogEntry[] = Array.from({ length: 10 }, (_, i) => http({ id: 10 - i, url: `https://api.test/${10 - i}`, responseBody: body }));
  const text = entriesToText(entries);
  expect(text.length).toBeLessThanOrEqual(MAX_EXPORT_LENGTH + 100);
  expect(text).toContain('https://api.test/10');
  expect(text).not.toContain('https://api.test/1\n');
  expect(text).toMatch(/\[\d+ older entries omitted to fit the share size limit\]\n$/);
});

test('shareEntries hands the text to Share.share and never rejects', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await shareEntries([http()]);
  expect(share).toHaveBeenCalledWith({ message: entriesToText([http()]), title: 'Server logs' });
  share.mockRejectedValue(new Error('dismissed'));
  await expect(shareEntries([http()])).resolves.toBeUndefined();
  expect(alert).toHaveBeenCalledWith('Export failed', 'dismissed');
  share.mockRestore();
  alert.mockRestore();
});
