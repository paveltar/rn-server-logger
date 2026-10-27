import { Alert, Platform, Share } from 'react-native';
import { utf8ToBase64 } from '../base64';
import { entriesToText, entryToText, MAX_EXPORT_LENGTH, shareEntries } from '../exportText';
import type { HttpEntry, LogEntry, PrintEntry } from '../store';

// A plain require gets the same mock instance the code under test gets (jest.requireMock would not)
const rnShare = (require('react-native-share') as { default: { open: jest.Mock } }).default;

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

test('a larger cap keeps every entry', () => {
  const body = 'x'.repeat(128 * 1024);
  const entries: LogEntry[] = Array.from({ length: 10 }, (_, i) => http({ id: 10 - i, url: `https://api.test/${10 - i}`, responseBody: body }));
  const text = entriesToText(entries, Infinity);
  expect(text).toContain('https://api.test/1\n');
  expect(text).not.toContain('omitted');
});

describe('shareEntries', () => {
  let alert: jest.SpyInstance;
  let share: jest.SpyInstance;

  beforeEach(() => {
    rnShare.open.mockReset().mockResolvedValue({ success: true });
    share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.useFakeTimers().setSystemTime(at);
  });

  afterEach(() => {
    jest.useRealTimers();
    share.mockRestore();
    alert.mockRestore();
  });

  test('shares every entry, uncapped, as a txt file from the app cache; dismissing the sheet resolves', async () => {
    const entries = [http({ responseBody: 'x'.repeat(MAX_EXPORT_LENGTH) }), http({ id: 2, url: 'https://api.test/older' })];
    await shareEntries(entries);
    expect(share).not.toHaveBeenCalled();
    expect(rnShare.open).toHaveBeenCalledTimes(1);
    const options = rnShare.open.mock.calls[0][0];
    expect(options).toEqual({
      url: `data:text/plain;base64,${utf8ToBase64(entriesToText(entries, Infinity))}`,
      filename: Platform.OS === 'ios' ? 'server-logs_16-09-26_22-17-26.txt' : 'server-logs_16-09-26_22-17-26',
      title: 'Server logs',
      failOnCancel: false,
      useInternalStorage: true,
    });
    expect(alert).not.toHaveBeenCalled();
  });

  test('android gets the name without an extension, because it appends one from the type', async () => {
    const os = Platform.OS;
    try {
      Platform.OS = 'android';
      await shareEntries([http()]);
      expect(rnShare.open.mock.calls[0][0].filename).toBe('server-logs_16-09-26_22-17-26');
      Platform.OS = 'ios';
      await shareEntries([http()]);
      expect(rnShare.open.mock.calls[1][0].filename).toBe('server-logs_16-09-26_22-17-26.txt');
    } finally {
      Platform.OS = os;
    }
  });

  test('a failure shows an alert and never rejects', async () => {
    rnShare.open.mockRejectedValue(new Error('no space left'));
    await expect(shareEntries([http()])).resolves.toBeUndefined();
    expect(alert).toHaveBeenCalledWith('Export failed', 'no space left');
  });
});
