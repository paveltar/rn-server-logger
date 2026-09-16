export type HttpEntry = {
  id: number;
  kind: 'http';
  startedAt: number;
  durationMs?: number;
  method: string;
  url: string;
  requestBody?: string;
  responseBody?: string;
  status?: number;
  error?: string;
};

export type PrintEntry = {
  id: number;
  kind: 'print';
  startedAt: number;
  text: string;
};

export type LogEntry = HttpEntry | PrintEntry;

/** An HTTP call that ended in an error (no response, or a status axios rejected). */
export const isFailed = (entry: LogEntry): boolean => entry.kind === 'http' && entry.error !== undefined;

/** The store keeps this many entries; the oldest are dropped. */
export const MAX_ENTRIES = 500;

type Listener = () => void;

let entries: LogEntry[] = [];
let enabled = false;
let tracking = true;
let lastId = 0;
const listeners = new Set<Listener>();

const notify = (): void => {
  listeners.forEach((listener) => listener());
};

export const nextId = (): number => ++lastId;

/** Newest first. The same array is returned until something changes, so it can be used as a snapshot. */
export const getEntries = (): LogEntry[] => entries;

export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** True once attach has been called. Before that nothing is recorded and the viewer stays hidden. */
export const isEnabled = (): boolean => enabled;

/** Turns the logger on. attach calls this; it is internal and not exported from the package. */
export const enable = (): void => {
  if (enabled) return;
  enabled = true;
  notify();
};

export const isTracking = (): boolean => tracking;

/** Whether a new entry would be kept right now: the logger is enabled and tracking is on. */
export const isRecording = (): boolean => enabled && tracking;

export const setTracking = (on: boolean): void => {
  tracking = on;
  notify();
};

/** Ignored until attach has been called, and while tracking is off. */
export const add = (entry: LogEntry): void => {
  if (!isRecording()) return;
  entries = [entry, ...entries.slice(0, MAX_ENTRIES - 1)];
  notify();
};

/** Completes an http entry; applies even while tracking is off so calls that started earlier finish normally. */
export const update = (id: number, patch: Partial<Omit<HttpEntry, 'id' | 'kind'>>): void => {
  const index = entries.findIndex((entry) => entry.id === id);
  const current = entries[index];
  if (!current || current.kind !== 'http') return;
  const next = entries.slice();
  next[index] = { ...current, ...patch };
  entries = next;
  notify();
};

export const clear = (): void => {
  entries = [];
  notify();
};
