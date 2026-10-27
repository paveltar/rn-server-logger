// An app without react-native-share: Metro turns the guarded require into a runtime error, which
// this factory reproduces. It needs its own file, because jest would hand back a mock that another
// test in the same file had already loaded.
import { Alert, Share } from 'react-native';
import { entriesToText, shareEntries } from '../exportText';
import type { HttpEntry } from '../store';

jest.mock('react-native-share', () => {
  throw new Error("Cannot find module 'react-native-share'");
});

const entry: HttpEntry = { id: 1, kind: 'http', startedAt: Date.now(), method: 'GET', url: 'https://api.test/users' };

test('export falls back to sharing the text, capped for the share sheet, and never rejects', async () => {
  const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  await shareEntries([entry]);
  expect(share).toHaveBeenCalledWith({ message: entriesToText([entry]), title: 'Server logs' });
  share.mockRejectedValue(new Error('binder'));
  await expect(shareEntries([entry])).resolves.toBeUndefined();
  expect(alert).toHaveBeenCalledWith('Export failed', 'binder');
});
