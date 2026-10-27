import { Alert, Platform, Share } from 'react-native';
import type { LogEntry } from './store';
import { utf8ToBase64 } from './base64';
import { formatDateTime } from './formatTime';

/**
 * Applies only to the text fallback: Android sends shared text through a Binder transaction limited
 * to 1 MB for the whole process, as UTF-16, so the text has to stay near 500 KB. A shared file only
 * passes its URI, so the file export is not capped.
 */
export const MAX_EXPORT_LENGTH = 250_000;

const TITLE = 'Server logs';
const SEPARATOR = '---------------------------------';

/** One block of text per entry; lines for absent fields are omitted. */
export const entryToText = (entry: LogEntry): string => {
  const time = formatDateTime(entry.startedAt);
  if (entry.kind === 'print') return `${time}  PRINT\n${entry.text}`;
  const lines = [`${time}  ${entry.method} ${entry.url}`];
  if (entry.status !== undefined || entry.durationMs !== undefined) {
    const duration = entry.durationMs !== undefined ? `  (${entry.durationMs} ms)` : '';
    lines.push(`STATUS: ${entry.status ?? '-'}${duration}`);
  }
  if (entry.requestBody !== undefined) lines.push('REQUEST:', entry.requestBody);
  if (entry.responseBody !== undefined) lines.push('RESPONSE:', entry.responseBody);
  if (entry.error !== undefined) lines.push(`ERROR: ${entry.error}`);
  return lines.join('\n');
};

/** Entries newest first. Stops at maxLength and says how many older entries were left out. */
export const entriesToText = (entries: LogEntry[], maxLength = MAX_EXPORT_LENGTH): string => {
  let text = '';
  for (let i = 0; i < entries.length; i++) {
    const block = `${entryToText(entries[i])}\n${SEPARATOR}\n\n`;
    if (text.length + block.length > maxLength) {
      return `${text}[${entries.length - i} older entries omitted to fit the share size limit]\n`;
    }
    text += block;
  }
  return text;
};

// react-native-share is optional and loaded only on export. React Native's Metro config allows
// optional dependencies, so in an app without it this guarded require throws at runtime instead of
// failing the bundle; an installed but unlinked native module throws here too. tsconfig has no Node
// types; the emitted CommonJS require is what Metro and jest provide.
declare const require: (id: string) => unknown;
type ShareModule = typeof import('react-native-share');
const loadFileShare = (): ShareModule['default'] | null => {
  try {
    const loaded = require('react-native-share') as ShareModule | ShareModule['default'];
    return 'default' in loaded ? loaded.default : loaded;
  } catch {
    return null;
  }
};

/** "server-logs_16-09-26_22-17-26", from the local time of the export. */
const fileName = (): string => {
  const [date, time] = formatDateTime(Date.now()).split(' ');
  return `server-logs_${date}_${time.slice(0, 8).replace(/:/g, '-')}`;
};

/**
 * Opens the share sheet with every entry as a .txt file, or as plain text when react-native-share
 * is not installed. Never rejects: a dismissed sheet resolves, so a rejection is a real failure,
 * shown in an alert.
 */
export const shareEntries = async (entries: LogEntry[]): Promise<void> => {
  try {
    const fileShare = loadFileShare();
    if (fileShare) {
      const name = fileName();
      await fileShare.open({
        url: `data:text/plain;base64,${utf8ToBase64(entriesToText(entries, Infinity))}`,
        // Android appends the extension from the type; iOS writes the name as given
        filename: Platform.OS === 'ios' ? `${name}.txt` : name,
        title: TITLE,
        failOnCancel: false,
        // The app's private cache, which react-native-share's file provider covers
        useInternalStorage: true,
      });
    } else {
      await Share.share({ message: entriesToText(entries), title: TITLE });
    }
  } catch (error) {
    const { message } = (error ?? {}) as { message?: string };
    Alert.alert('Export failed', message ?? String(error));
  }
};
