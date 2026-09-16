# rn-server-logger

A React Native module for testers: records every axios call the app makes, shows them in-app (shake
the device), and exports them as text. One row per call: method, URL, status, duration, request and
response bodies. Anything you `print` appears in the same timeline.

## Install

```shell
yarn add rn-server-logger react-native-shake@5.1.1 && cd ios && pod install && cd ..
```

Use react-native-shake version 5.1.1 without a caret. Requires axios 0.27 or newer and React 18 or newer.

## Use

Attach the logger to every axios instance you want logged, right after creating it and before adding
your own interceptors, so the log shows the request as sent and the response as received. Recording
starts as soon as `attach` is called, whether or not the viewer is rendered, so guard it with the same
flag you use for the viewer:

```ts
import axios from 'axios';
import { attach } from 'rn-server-logger';

export const api = axios.create({ baseURL: 'https://api.example.com' });
if (TEST_ENV_FLAG) attach(api);
```

Call `detach(api)` to remove the logger from an instance again. The "request as sent, response as
received" guarantee relies on axios running request interceptors last-registered-first, which axios
1.13.3 and 1.13.4 briefly changed and 1.13.5 restored.

Render the viewer once, only in test builds:

```tsx
import { ServerLogger } from 'rn-server-logger';

const App = () => (
  <>
    <Root />
    {TEST_ENV_FLAG && <ServerLogger />}
  </>
);
```

Print any value into the log. It returns the value unchanged, so it can wrap an expression:

```ts
import { print } from 'rn-server-logger';

const user = print(await fetchUser());
```

## What you see

Shake the device to open the viewer. Rows are newest first; tap a row to see the full URL, the request
and response bodies and the error text. Failed calls are red. Filter by All, HTTP, Errors or Print,
and search across URLs, bodies, status codes and printed text.

The footer has a Tracking switch (stop and resume recording), Clear, and Export. Export opens the
share sheet with every recorded entry as text, newest first.

Limits: the last 500 entries are kept; bodies and printed values longer than 64 KB are cut with a
`[truncated, N KB total]` marker; an export is cut to the newest entries that fit the share sheet
(about 250,000 characters, Android's limit) and says how many older entries were left out; if the
share sheet cannot be opened, an alert says so. Nothing is ever redacted: query strings, including
tokens, are logged as sent.

## Migrating from 1.x

1. Delete the two `axios-inherit` lines at the top of your axios file (`require('axios-inherit')` and
   `axiosInherit(axios)`) and call `attach` on each axios instance you want logged instead, or on
   `axios` itself if you use it directly. 1.x recorded only while `<ServerLogger />` was mounted; 2.0
   records from the moment `attach` is called, so guard it with your test-build flag as shown above.
2. Replace `serverLoggerRef.current?.printHelper(x)` with `print(x)` and drop the ref.
3. `import { ServerLogger } from 'rn-server-logger'` (named export, no props, no ref).
4. Remove `axios-inherit`, `react-native-fs`, `react-native-share` and `moment` if nothing else uses
   them, then run `pod install` again so the two native modules are unlinked.
5. Check the new requirements: axios 0.27 or newer and React 18 or newer. 1.x declared none.

What testers will notice: the REQUEST, RESPONSE, ERROR and PRINT tabs are gone. Each call is one row
showing its status and duration, and the filters are All, HTTP, Errors and Print. Export no longer
writes a `logs.txt` file; it opens the share sheet with the log as text, cut to about 250,000
characters (see the limits above).
