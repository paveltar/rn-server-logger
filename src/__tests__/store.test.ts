import { add, clear, enable, getEntries, isTracking, MAX_ENTRIES, nextId, setTracking, subscribe, update } from '../store';
import type { HttpEntry } from '../store';

const http = (over: Partial<HttpEntry> = {}): HttpEntry => ({
  id: nextId(), kind: 'http', startedAt: Date.now(), method: 'GET', url: 'https://api.test/x', ...over,
});

beforeEach(() => {
  enable();
  clear();
  setTracking(true);
});

test('entries are newest first', () => {
  const first = http();
  const second = http();
  add(first);
  add(second);
  expect(getEntries().map((e) => e.id)).toEqual([second.id, first.id]);
});

test('ids increase', () => {
  expect(nextId()).toBeLessThan(nextId());
});

test('the list is capped at MAX_ENTRIES, dropping the oldest', () => {
  const ids: number[] = [];
  for (let i = 0; i < MAX_ENTRIES + 1; i++) {
    const entry = http();
    ids.push(entry.id);
    add(entry);
  }
  const entries = getEntries();
  expect(entries).toHaveLength(MAX_ENTRIES);
  expect(entries[0].id).toBe(ids[ids.length - 1]);
  expect(entries[entries.length - 1].id).toBe(ids[1]);
});

test('update patches an http entry in place and keeps the order', () => {
  const entry = http();
  add(entry);
  add(http());
  update(entry.id, { status: 200, durationMs: 12 });
  const updated = getEntries()[1] as HttpEntry;
  expect(updated.status).toBe(200);
  expect(updated.durationMs).toBe(12);
  expect(updated.url).toBe('https://api.test/x');
});

test('update of an unknown id does nothing', () => {
  add(http());
  const before = getEntries();
  update(999999, { status: 1 });
  expect(getEntries()).toBe(before);
});

test('tracking off skips add but still applies update', () => {
  const entry = http();
  add(entry);
  setTracking(false);
  expect(isTracking()).toBe(false);
  add(http());
  expect(getEntries()).toHaveLength(1);
  update(entry.id, { status: 204 });
  expect((getEntries()[0] as HttpEntry).status).toBe(204);
});

test('getEntries returns the same array until something changes', () => {
  add(http());
  const a = getEntries();
  expect(getEntries()).toBe(a);
  add(http());
  expect(getEntries()).not.toBe(a);
});

test('subscribers are notified on add, update, clear and tracking, and can unsubscribe', () => {
  const listener = jest.fn();
  const unsubscribe = subscribe(listener);
  const entry = http();
  add(entry);
  update(entry.id, { status: 200 });
  setTracking(false);
  clear();
  expect(listener).toHaveBeenCalledTimes(4);
  unsubscribe();
  setTracking(true);
  add(http());
  expect(listener).toHaveBeenCalledTimes(4);
});

test('update against a print entry id does nothing', () => {
  const entry = { id: nextId(), kind: 'print' as const, startedAt: Date.now(), text: 'x' };
  add(entry);
  const before = getEntries();
  update(entry.id, { status: 200 });
  expect(getEntries()).toBe(before);
  expect(getEntries()[0]).toEqual(entry);
});

test('clear empties the list', () => {
  add(http());
  clear();
  expect(getEntries()).toEqual([]);
});
