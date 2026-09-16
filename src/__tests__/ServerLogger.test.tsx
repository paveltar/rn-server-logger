import React from 'react';
import { Modal, Share, TouchableOpacity } from 'react-native';
import TestRenderer, { act } from 'react-test-renderer';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { ServerLogger } from '../ServerLogger';
import { add, clear, enable, getEntries, isTracking, nextId, setTracking } from '../store';
import type { HttpEntry, PrintEntry } from '../store';

const { shake } = jest.requireMock('react-native-shake') as { shake: () => void };

const http = (over: Partial<HttpEntry> = {}): HttpEntry => ({
  id: nextId(), kind: 'http', startedAt: Date.now(), method: 'GET', url: 'https://api.test/users', status: 200, durationMs: 12, ...over,
});
const printEntry = (text: string): PrintEntry => ({ id: nextId(), kind: 'print', startedAt: Date.now(), text });

let renderer: ReactTestRenderer;

const byTestId = (id: string): ReactTestInstance =>
  renderer.root.findAll((node) => node.props.testID === id && typeof node.type !== 'string')[0];
const rows = (): ReactTestInstance[] =>
  renderer.root.findAllByType(TouchableOpacity).filter((node) => String(node.props.testID).startsWith('row-'));
const textOf = (node: unknown): string =>
  node == null ? '' : typeof node === 'string' ? node : Array.isArray(node) ? node.map(textOf).join('') : textOf((node as { children?: unknown }).children);
const screen = (): string => textOf(renderer.toJSON());
const press = async (id: string) => act(async () => { byTestId(id).props.onPress(); });
const type = async (text: string) => act(async () => { byTestId('search').props.onChangeText(text); });

beforeEach(async () => {
  enable();
  clear();
  setTracking(true);
  add(http({ url: 'https://api.test/first' }));
  add(http({ url: 'https://api.test/boom', status: 500, requestBody: '{\n  "a": 1\n}', responseBody: '{\n  "error": "server exploded"\n}', error: 'ERR_BAD_RESPONSE: Request failed with status code 500' }));
  add(printEntry('hello world\nsecond line'));
  add(http({ url: 'https://api.test/latest' }));
  await act(async () => { renderer = TestRenderer.create(<ServerLogger />); });
});

afterEach(async () => {
  await act(async () => renderer.unmount());
});

test('closed until shaken, then shows every entry newest first', async () => {
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => shake());
  expect(renderer.root.findByType(Modal).props.visible).toBe(true);
  const ids = rows().map((row) => row.props.testID);
  const expected = getEntries().map((entry) => `row-${entry.id}`);
  expect(ids).toEqual(expected);
  expect(screen()).toContain('https://api.test/latest');
});

test('filters', async () => {
  await act(async () => shake());
  await press('filter-Errors');
  expect(rows()).toHaveLength(1);
  expect(screen()).toContain('https://api.test/boom');
  await press('filter-Print');
  expect(rows()).toHaveLength(1);
  expect(screen()).toContain('hello world');
  await press('filter-HTTP');
  expect(rows()).toHaveLength(3);
  await press('filter-All');
  expect(rows()).toHaveLength(4);
});

test('search matches url, status and print text, and highlights the match', async () => {
  await act(async () => shake());
  await type('latest');
  expect(rows()).toHaveLength(1);
  const highlighted = renderer.root.findAll((node) => node.props.testID === 'highlight' && typeof node.type !== 'string');
  expect(highlighted.length).toBeGreaterThan(0);
  expect(textOf(highlighted[0].props.children)).toBe('latest');
  await type('500');
  expect(rows()).toHaveLength(1);
  await type('exploded');
  expect(rows()).toHaveLength(1);
  await type('HELLO');
  expect(rows()).toHaveLength(1);
  await type('');
  expect(rows()).toHaveLength(4);
});

test('a live entry arriving while open appears at the top', async () => {
  await act(async () => shake());
  await act(async () => { add(http({ url: 'https://api.test/live' })); });
  expect(rows()[0].props.testID).toBe(`row-${getEntries()[0].id}`);
});

test('tap expands a row to show the bodies, tap again collapses it', async () => {
  await act(async () => shake());
  const boom = getEntries().find((entry) => entry.kind === 'http' && entry.status === 500) as HttpEntry;
  expect(screen()).not.toContain('server exploded');
  await press(`row-${boom.id}`);
  expect(screen()).toContain('server exploded');
  expect(screen()).toContain('"a": 1');
  expect(screen()).toContain('ERR_BAD_RESPONSE');
  await press(`row-${boom.id}`);
  expect(screen()).not.toContain('server exploded');
});

test('export shares every entry even with a filter and search active, after closing the modal', async () => {
  jest.useFakeTimers();
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  await act(async () => shake());
  await press('filter-Errors');
  await type('boom');
  await press('export');
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => { jest.advanceTimersByTime(300); });
  expect(share).toHaveBeenCalledTimes(1);
  const { message } = share.mock.calls[0][0] as { message: string };
  expect(message).toContain('https://api.test/latest');
  expect(message).toContain('https://api.test/first');
  expect(message).toContain('hello world');
  share.mockRestore();
  jest.useRealTimers();
});

test('clear empties the store and shows the empty state', async () => {
  await act(async () => shake());
  expect(byTestId('clear').props.disabled).toBe(false);
  expect(byTestId('export').props.disabled).toBe(false);
  await press('clear');
  expect(getEntries()).toEqual([]);
  expect(rows()).toHaveLength(0);
  expect(screen()).toContain('No logs yet');
  expect(byTestId('clear').props.disabled).toBe(true);
  expect(byTestId('export').props.disabled).toBe(true);
});

test('the tracking switch drives the store', async () => {
  await act(async () => shake());
  expect(byTestId('tracking').props.value).toBe(true);
  await act(async () => { byTestId('tracking').props.onValueChange(false); });
  expect(isTracking()).toBe(false);
  expect(byTestId('tracking').props.value).toBe(false);
});

test('close hides the modal', async () => {
  await act(async () => shake());
  await press('close');
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
});
