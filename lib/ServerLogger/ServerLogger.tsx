//@ts-nocheck
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Modal,
  View,
  Text,
  Switch,
  Button,
  VirtualizedList,
  TextInput,
} from 'react-native';
import RNShake from 'react-native-shake';
import moment from 'moment';
import useServerLogger from '../hooks/useServerLogger';
import exportLogsToFileAndShare from '../services/exportLogsToFileAndShare';
import styles from './styles';
import LogTypeButtonGroup from './LogTypeButtons';
import { LOG_TYPE, LOG_TABS } from '../types/types';
import type { ServerLoggerHandle } from '../types/types';

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The fields a search term is matched against
const searchableFields = (log) => [log.url, log.requestData, log.responseData, log.message, log.error, log.status];

// The text with every match wrapped in a highlighted Text; the rest of the styling comes from the enclosing Text
const highlightedText = (text, searchRegExp) => {
  const value = String(text ?? '');
  if (!searchRegExp) return value;
  const matches = value.match(searchRegExp);
  return value.split(searchRegExp).map((part, i) => (
    <React.Fragment key={i}>
      {part}
      {matches && matches[i] && <Text style={styles.highlightedText}>{matches[i]}</Text>}
    </React.Fragment>
  ));
};

// Memoized so rows only re-render when their log or the search term changes
const LogRow = React.memo(({ item, searchRegExp }) => {
  const isError = item.type === LOG_TYPE.ERROR;
  return (
    <View style={[styles.logContainer, isError && styles.errorLogContainer]}>
      <View>
        <Text style={styles.text}>
          {moment(item.timestamp).format('HH:mm:ss')}
        </Text>
        {item.type !== LOG_TYPE.PRINT && <Text style={[styles.text, isError && styles.errorText]}>HTTP {item.type}</Text>}
      </View>
      <Text style={styles.text}>
        Message: {highlightedText(item.message ?? item.url, searchRegExp)}
      </Text>
      {item.status != null && <Text style={styles.text}>
        Status: {highlightedText(item.status, searchRegExp)}
      </Text>}
      {!!item.error && <Text style={[styles.text, styles.errorText]}>
        Error: {highlightedText(item.error, searchRegExp)}
      </Text>}
      {!!item.requestData && <Text style={styles.text}>
        Request Data: {highlightedText(item.requestData, searchRegExp)}
      </Text>}
      {!!item.responseData && <Text style={styles.text}>
        Response Data:{" "}
        {highlightedText(item.responseData, searchRegExp)}
      </Text>}
    </View>
  );
});

const EmptyList = () => (
  <View style={styles.emptyListContainer}>
    <Text style={styles.title}>{'No logs in the\npast 60 seconds'}</Text>
  </View>
);

const keyExtractor = (item) => String(item.id);
const getItemCount = (data) => data.length;
const getItem = (data, index) => data[index];

const ServerLogger = forwardRef<ServerLoggerHandle>((_, ref) => {
  const [logs, isTrackingLogs, toggleTracking, clearLogs, printHelper] = useServerLogger();
  const [logType, setLogType] = useState(LOG_TYPE.REQUEST);
  const [showLogger, setShowLogger] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');

  const onDismiss = () => setShowLogger(false);

  useEffect(() => {
    const subscription = RNShake.addListener(() => setShowLogger(true));
    return () => {
      subscription.remove();
    };
  }, []);

  const onExport = useCallback(() => {
    onDismiss();
    setTimeout(() => exportLogsToFileAndShare(LOG_TABS.flatMap((tab) => logs[tab])), 300);
  }, [logs]);

  const isEmpty = LOG_TABS.every((tab) => logs[tab].length === 0);

  // Built once per search term and shared by the filter and the highlighter
  const searchRegExp = useMemo(
    () => (searchText ? new RegExp(escapeRegExp(searchText), 'gi') : null),
    [searchText]
  );

  const tabLogs = logs[logType];
  const filteredLogs = useMemo(() => {
    if (!showLogger) return []; // the Modal renders nothing while closed, so skip the work
    if (!searchRegExp) return tabLogs;
    // String.prototype.search ignores the regex's lastIndex, so the shared global regex is safe here
    return tabLogs.filter((log) =>
      searchableFields(log).some((field) => field != null && String(field).search(searchRegExp) !== -1)
    );
  }, [showLogger, tabLogs, searchRegExp]);

  const renderItem = useCallback(
    ({ item }) => <LogRow item={item} searchRegExp={searchRegExp} />,
    [searchRegExp]
  );

  useImperativeHandle(
    ref,
    () => {
      return { printHelper };
    },
    [printHelper]
  );

  return (
    <Modal
      visible={showLogger}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.container}>
        <View style={styles.headerContainer}>
          <Text style={styles.title}>SERVER LOGS</Text>
          <Button
            title="Close"
            onPress={onDismiss}
          />
          <Button
            title="Export"
            onPress={onExport}
            disabled={isEmpty}
          />
          <Button
            title="Clear"
            onPress={clearLogs}
            disabled={isEmpty}
          />
        </View>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.TextInput}
            onChangeText={setSearchText}
            value={searchText}
            placeholder="Search"
          />
        </View>
        <View style={styles.logsContainer}>
          {/* maintainVisibleContentPosition keeps the rows being read in place when a new log is added at the top (Android: RN 0.72+) */}
          <VirtualizedList
            data={filteredLogs}
            extraData={searchRegExp}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            getItemCount={getItemCount}
            getItem={getItem}
            initialNumToRender={5}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListEmptyComponent={EmptyList}
          />
        </View>
        <View style={styles.footerContainer}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={styles.text}>Tracking</Text>
            <Switch
              value={isTrackingLogs}
              onValueChange={toggleTracking}
              style={{ marginLeft: 5 }}
            />
          </View>
          <View style={styles.logTypeButtonsContainer}>
            <LogTypeButtonGroup logType={logType} setLogType={setLogType} />
          </View>
        </View>
      </View>
    </Modal>
  );
});

export default ServerLogger;
