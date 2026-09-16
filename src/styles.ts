import { Platform, StyleSheet } from 'react-native';

const RED = '#d33';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#ddd' },
  title: { fontSize: 14, fontWeight: 'bold' },
  search: { height: 36, marginHorizontal: 16, marginVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderColor: '#bbb', borderRadius: 6 },
  filters: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 4, marginHorizontal: 4, borderWidth: 1, borderColor: '#bbb', borderRadius: 12 },
  chipActive: { backgroundColor: '#444', borderColor: '#444' },
  chipText: { fontSize: 12, color: '#444' },
  chipTextActive: { color: '#fff' },
  list: { flex: 1 },
  empty: { textAlign: 'center', marginTop: 40, color: '#888' },
  row: { marginHorizontal: 10, marginBottom: 8, padding: 10, borderWidth: 1, borderColor: '#bbb', borderRadius: 6 },
  rowFailed: { borderColor: RED, borderWidth: 2 },
  meta: { fontSize: 10, color: '#666' },
  url: { fontSize: 11, color: '#222' },
  failedText: { color: RED },
  section: { marginTop: 6 },
  label: { fontSize: 10, fontWeight: 'bold', color: '#444' },
  body: { fontSize: 10, color: '#222', fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }) },
  highlight: { color: '#fff', backgroundColor: '#444' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, paddingBottom: 20, borderTopWidth: 1, borderTopColor: '#ddd' },
  tracking: { flexDirection: 'row', alignItems: 'center' },
  trackingLabel: { fontSize: 12, marginRight: 6 },
});
