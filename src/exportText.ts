import { Alert, Share } from 'react-native';
import type { LogEntry } from './store';
import { formatDateTime } from './formatTime';

/**
 * Android sends the text through a Binder transaction limited to 1 MB for the whole process, as
 * UTF-16, so the text has to stay near 500 KB.
 */
export const MAX_EXPORT_LENGTH = 250_000;

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

/** Entries newest first. Stops at MAX_EXPORT_LENGTH and says how many older entries were left out. */
export const entriesToText = (entries: LogEntry[]): string => {
  let text = '';
  for (let i = 0; i < entries.length; i++) {
    const block = `${entryToText(entries[i])}\n${SEPARATOR}\n\n`;
    if (text.length + block.length > MAX_EXPORT_LENGTH) {
      return `${text}[${entries.length - i} older entries omitted to fit the share size limit]\n`;
    }
    text += block;
  }
  return text;
};

/**
 * Opens the share sheet with the log text. Never rejects: React Native's Share.share never rejects
 * when the user dismisses the sheet, so a rejection here is a real failure, shown in an alert.
 */
export const shareEntries = async (entries: LogEntry[]): Promise<void> => {
  try {
    await Share.share({ message: entriesToText(entries), title: 'Server logs' });
  } catch (error) {
    const { message } = (error ?? {}) as { message?: string };
    Alert.alert('Export failed', message ?? String(error));
  }
};
