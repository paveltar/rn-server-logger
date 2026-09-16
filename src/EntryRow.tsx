import React, { memo } from 'react';
import type { ReactNode } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { isFailed } from './store';
import type { LogEntry } from './store';
import { formatClock } from './formatTime';
import { styles } from './styles';

type Props = {
  entry: LogEntry;
  expanded: boolean;
  searchRegExp: RegExp | null;
  onPress: (id: number) => void;
};

/**
 * The text with every search match wrapped in a highlighted Text; other styling comes from the parent Text.
 * The regex has one capturing group, so split() puts the matches at the odd indexes.
 */
const highlight = (text: unknown, regExp: RegExp | null): ReactNode => {
  const value = String(text ?? '');
  if (!regExp) return value;
  return value.split(regExp).map((part, i) =>
    i % 2 === 1 ? <Text key={i} testID="highlight" style={styles.highlight}>{part}</Text> : part
  );
};

const Section = ({ label, text, regExp }: { label: string; text: string; regExp: RegExp | null }) => (
  <View style={styles.section} testID={`section-${label}`}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.body}>{highlight(text, regExp)}</Text>
  </View>
);

const EntryRowComponent = ({ entry, expanded, searchRegExp, onPress }: Props) => {
  const failed = isFailed(entry);
  const lines = expanded ? undefined : 1;
  return (
    <TouchableOpacity testID={`row-${entry.id}`} onPress={() => onPress(entry.id)} style={[styles.row, failed && styles.rowFailed]}>
      {entry.kind === 'print' ? (
        <>
          <Text style={styles.meta}>{formatClock(entry.startedAt)}  PRINT</Text>
          <Text testID="body" style={styles.body} numberOfLines={lines}>{highlight(entry.text, searchRegExp)}</Text>
        </>
      ) : (
        <>
          <Text style={styles.meta}>{formatClock(entry.startedAt)}  {entry.method}</Text>
          <Text testID="url" style={[styles.url, failed && styles.failedText]} numberOfLines={lines}>{highlight(entry.url, searchRegExp)}</Text>
          <Text testID="status" style={[styles.meta, failed && styles.failedText]}>
            {entry.status !== undefined ? highlight(entry.status, searchRegExp) : failed ? 'no response' : 'pending'}
            {entry.durationMs !== undefined ? `  ${entry.durationMs} ms` : ''}
          </Text>
          {expanded && entry.requestBody !== undefined ? <Section label="Request" text={entry.requestBody} regExp={searchRegExp} /> : null}
          {expanded && entry.responseBody !== undefined ? <Section label="Response" text={entry.responseBody} regExp={searchRegExp} /> : null}
          {expanded && entry.error !== undefined ? <Section label="Error" text={entry.error} regExp={searchRegExp} /> : null}
        </>
      )}
    </TouchableOpacity>
  );
};

/** Memoized so rows re-render only when their entry, expanded flag or the search term changes. */
export const EntryRow = memo(EntryRowComponent);
