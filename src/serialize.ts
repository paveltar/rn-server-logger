/** Bodies and printed values longer than this are cut, on screen and in the export. */
export const MAX_BODY_LENGTH = 64 * 1024;

const describeFunction = (fn: { name?: string }): string => `[Function ${fn.name || 'anonymous'}]`;

type ErrorLike = Error & { cause?: unknown; errors?: unknown };

// cause and AggregateError.errors are non-enumerable, so the spread alone would drop them
const describeErrorObject = (error: ErrorLike): Record<string, unknown> => ({
  ...error,
  name: error.name,
  message: error.message,
  stack: error.stack,
  ...(error.cause !== undefined ? { cause: error.cause } : {}),
  ...(error.errors !== undefined ? { errors: error.errors } : {}),
});

type BlobLike = { size: number; type: string };

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const [size, unit] = bytes < 1024 * 1024 ? [bytes / 1024, 'KB'] : [bytes / (1024 * 1024), 'MB'];
  return `${Math.round(size * 10) / 10} ${unit}`;
};

// tsconfig has no DOM types: Blob is React Native's global (or Node's, in jest)
const isBlob = (value: object): value is BlobLike => {
  const { Blob } = globalThis as { Blob?: abstract new (...args: never[]) => BlobLike };
  return !!Blob && value instanceof Blob;
};

// Binary data as one line, "[Uint8Array, 1.2 MB]": JSON would print an ArrayBuffer as {} and spell out
// a typed array byte by byte. undefined for anything else.
const describeBinary = (value: object): string | undefined => {
  if (value instanceof ArrayBuffer || ArrayBuffer.isView(value)) {
    return `[${value.constructor?.name || 'ArrayBuffer'}, ${formatSize(value.byteLength)}]`;
  }
  if (isBlob(value)) return `[Blob${value.type ? ` ${value.type}` : ''}, ${formatSize(value.size)}]`;
  return undefined;
};

// JSON.stringify with a replacer that never throws and marks only true cycles as [Circular].
// `parents` is the chain of objects JSON.stringify is currently inside (after replacement),
// `originals` the same chain before replacement (what child values point at).
const toJson = (value: object): string | undefined => {
  const parents: unknown[] = [];
  const originals: unknown[] = [];
  return JSON.stringify(
    value,
    function replacer(this: unknown, _key: string, val: unknown) {
      if (typeof val === 'bigint') return `${val}n`;
      if (typeof val === 'symbol') return val.toString();
      if (typeof val === 'function') return describeFunction(val);
      if (typeof val !== 'object' || val === null) return val;
      const binary = describeBinary(val);
      if (binary !== undefined) return binary;
      // `this` is the object holding `val`; drop the ancestors of branches already finished
      while (parents.length && parents[parents.length - 1] !== this) {
        parents.pop();
        originals.pop();
      }
      if (originals.includes(val)) return '[Circular]';
      let out: unknown = val;
      if (val instanceof Error) out = describeErrorObject(val);
      else if (val instanceof Map || val instanceof Set) out = Array.from(val as Iterable<unknown>);
      parents.push(out);
      originals.push(val);
      return out;
    },
    2
  );
};

const truncate = (text: string): string =>
  text.length <= MAX_BODY_LENGTH
    ? text
    : `${text.slice(0, MAX_BODY_LENGTH)}\n... [truncated, ${Math.round(text.length / 1024)} KB total]`;

/** Readable text for any value. Never throws; cut at MAX_BODY_LENGTH. */
export const serialize = (value: unknown): string => {
  if (typeof value === 'string') return truncate(value);
  if (typeof value === 'function') return describeFunction(value);
  if (typeof value !== 'object' || value === null) return String(value);
  const binary = describeBinary(value);
  if (binary !== undefined) return binary;
  let text: string;
  try {
    text = toJson(value) ?? Object.prototype.toString.call(value);
  } catch {
    text = Object.prototype.toString.call(value);
  }
  return truncate(text);
};

// What axios.isCancel checks, in 0.27 (Cancel) and 1.x (CanceledError); avoids loading axios at runtime
const isCancel = (error: unknown): boolean => !!(error as { __CANCEL__?: unknown } | null)?.__CANCEL__;

/** One line for a failed request: "Timeout: ...", "Canceled", "ERR_NETWORK: Network Error", ... */
export const describeError = (error: unknown): string => {
  if (isCancel(error)) return 'Canceled';
  const { code, message } = (error ?? {}) as { code?: string; message?: string };
  const text = message ?? serialize(error);
  // axios uses ECONNABORTED for both timeouts (unless transitional.clarifyTimeoutError is set) and 'Request aborted'
  const isTimeout = code === 'ETIMEDOUT' || (code === 'ECONNABORTED' && text !== 'Request aborted');
  if (isTimeout) return `Timeout: ${text}`;
  return code ? `${code}: ${text}` : text;
};
