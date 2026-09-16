import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Button, FlatList, Modal, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
// react-native's own SafeAreaView is deprecated since RN 0.81; this native view needs no provider inside a Modal
import { SafeAreaView } from 'react-native-safe-area-context';
import { clear, getEntries, isEnabled, isFailed, isTracking, setTracking, subscribe } from './store';
import type { LogEntry } from './store';
import { shareEntries } from './exportText';
import { EntryRow } from './EntryRow';
import { styles } from './styles';

const FILTERS = {
  All: () => true,
  HTTP: (entry: LogEntry) => entry.kind === 'http',
  Errors: isFailed,
  Print: (entry: LogEntry) => entry.kind === 'print',
};
type Filter = keyof typeof FILTERS;
const FILTER_NAMES = Object.keys(FILTERS) as Filter[];

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchableFields = (entry: LogEntry): unknown[] =>
  entry.kind === 'print' ? [entry.text] : [entry.url, entry.requestBody, entry.responseBody, entry.error, entry.status];

// String.prototype.search ignores the regex's lastIndex, so one global regex serves both filtering and highlighting
const matches = (entry: LogEntry, regExp: RegExp): boolean =>
  searchableFields(entry).some((field) => field != null && String(field).search(regExp) !== -1);

const keyExtractor = (entry: LogEntry): string => String(entry.id);

// react-native-shake is loaded only once the logger is enabled: creating its native module starts
// the accelerometer, so an app that never calls attach never loads it. tsconfig has no Node types;
// the emitted CommonJS require is what Metro and jest provide.
declare const require: (id: string) => unknown;
type ShakeModule = typeof import('react-native-shake');
const loadShake = (): ShakeModule['default'] => {
  const loaded = require('react-native-shake') as ShakeModule | ShakeModule['default'];
  return 'default' in loaded ? loaded.default : loaded;
};

/** The log viewer. Render it once; it stays hidden until attach has been called. Opens on shake. */
export const ServerLogger: React.FC = () => {
  const enabled = useSyncExternalStore(subscribe, isEnabled);
  const entries = useSyncExternalStore(subscribe, getEntries);
  const tracking = useSyncExternalStore(subscribe, isTracking);
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<number>>(() => new Set());

  useEffect(() => {
    if (!enabled) return undefined;
    const subscription = loadShake().addListener(() => setOpen(true));
    return () => subscription.remove();
  }, [enabled]);

  // The capturing group makes split() return the matches at the odd indexes, so highlighting scans once
  const searchRegExp = useMemo(
    () => (searchText ? new RegExp(`(${escapeRegExp(searchText)})`, 'gi') : null),
    [searchText]
  );

  const visible = useMemo(() => {
    if (!open) return []; // the Modal renders nothing while closed
    const filtered = filter === 'All' ? entries : entries.filter(FILTERS[filter]);
    return searchRegExp ? filtered.filter((entry) => matches(entry, searchRegExp)) : filtered;
  }, [open, entries, filter, searchRegExp]);

  const toggleExpanded = useCallback((id: number) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: LogEntry }) => (
      <EntryRow entry={item} expanded={expandedIds.has(item.id)} searchRegExp={searchRegExp} onPress={toggleExpanded} />
    ),
    [expandedIds, searchRegExp, toggleExpanded]
  );

  const close = () => setOpen(false);

  const onExport = () => {
    // The share sheet cannot be presented over the modal on iOS: close first, share once it is gone
    close();
    setTimeout(() => shareEntries(getEntries()), 300);
  };

  if (!enabled) return null;
  // The Modal renders nothing while closed; skip building its tree on every store change
  if (!open) return <Modal visible={false} onRequestClose={close} />;

  return (
    <Modal visible animationType="fade" onRequestClose={close}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Server logs</Text>
          <Button testID="close" title="Close" onPress={close} />
        </View>
        <TextInput
          testID="search"
          style={styles.search}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.filters}>
          {FILTER_NAMES.map((name) => (
            <TouchableOpacity key={name} testID={`filter-${name}`} onPress={() => setFilter(name)} style={[styles.chip, name === filter && styles.chipActive]}>
              <Text style={[styles.chipText, name === filter && styles.chipTextActive]}>{name}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <FlatList
          style={styles.list}
          data={visible}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialNumToRender={10}
          // Keeps the rows being read in place when new logs are added above, but follows new logs
          // when the list is already scrolled to the top (Android needs RN 0.72+ for this prop).
          maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
          ListEmptyComponent={<Text testID="empty" style={styles.empty}>No logs yet</Text>}
        />
        <View style={styles.footer}>
          <View style={styles.tracking}>
            <Text style={styles.trackingLabel}>Tracking</Text>
            <Switch testID="tracking" value={tracking} onValueChange={setTracking} />
          </View>
          <Button testID="clear" title="Clear" onPress={clear} disabled={entries.length === 0} />
          <Button testID="export" title="Export" onPress={onExport} disabled={entries.length === 0} />
        </View>
      </SafeAreaView>
    </Modal>
  );
};
