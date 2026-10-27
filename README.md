# rn-server-logger

A React Native module for testers: records every axios call the app makes, shows them in-app (shake
the device), and exports them as a text file. One row per call: method, URL, status, duration, request and
response bodies. Anything you `print` appears in the same timeline.

## Install

Install it from this repository, pinned to a tag. The `rn-server-logger` package on npm is an
unrelated package (upstream's own 2.0.0, with a different API), so do not `yarn add rn-server-logger`.

```shell
yarn add https://github.com/paveltar/rn-server-logger.git#v2.1.0 react-native-shake@^6.10.0 react-native-safe-area-context react-native-share && cd ios && pod install && cd ..
```

Requirements:

- React Native with the new architecture.
- react-native-shake 6.10.0 or newer. It is loaded only once the logger is attached, so the
  accelerometer never runs in builds that do not attach.
- react-native-safe-area-context 4 or newer. Most apps already have it.
- react-native-share 12 or newer, optional. With it, Export shares a `.txt` file; without it, Export
  shares the log as plain text. It is loaded only when Export is pressed.
- axios 0.27 or newer. The library never loads axios itself: it only uses the instance you attach,
  so the app keeps a single axios copy in the bundle.
- React 18 or newer.

The git install compiles `dist` on the spot (a `prepare` script runs `tsc`), so a cold install takes
a little longer than an npm package.

## Use

Nothing is recorded and the viewer stays hidden until `attach` is called. Only `attach` needs the
test-build guard; `print` calls and `<ServerLogger />` can stay in place in every build.

```ts
import axios from 'axios';
import serverLogger from 'rn-server-logger';

export const api = axios.create({ baseURL: 'https://api.example.com' });
if (TEST_ENV_FLAG) serverLogger.attach(api);
```

Named imports work too: `import { attach, detach, print, ServerLogger } from 'rn-server-logger'`.
Call `detach(api)` to remove the logger from an instance again.

Render the viewer once. It renders nothing until `attach` has run:

```tsx
import { ServerLogger } from 'rn-server-logger';

const App = () => (
  <>
    <Root />
    <ServerLogger />
  </>
);
```

Print any value into the log. It returns the value unchanged, so it can wrap an expression, and it
does nothing before `attach`:

```ts
const user = serverLogger.print(await fetchUser());
```

### Where to call attach

axios runs request interceptors in the reverse order of registration: the last one registered runs
first. The logger records the config its request interceptor receives, so:

- Call `attach` right after creating the instance, before interceptors that change the request
  (auth headers, URL rewrites). The logger then runs last and logs the request as sent, and its
  response interceptor runs first and logs the response as received.
- Register interceptors that only reject without changing the config, such as mock interceptors,
  before `attach`. They then run after the logger has recorded the request, so their rows keep the
  request body and the duration. Registered after `attach`, they reject before the logger sees the
  request, and the row shows `(no request config)`.

Since axios 1.13.5 this order is controlled by `transitional.legacyInterceptorReqResOrdering`
(default `true`). If you set it to `false`, request interceptors run in registration order and the
two rules above swap: attach after the request-changing interceptors, and mocks after `attach`.

## What you see

Shake the device to open the viewer. Rows are newest first; tap a row to see the full URL, the request
and response bodies and the error text. Failed calls are red. Filter by All, HTTP, Errors or Print,
and search across URLs, bodies, status codes and printed text.

The footer has a Tracking switch (stop and resume recording), Clear, and Export. Export opens the
share sheet with every recorded entry, newest first, as a file named like
`server-logs_16-09-26_22-17-26.txt`. The file is written to the app's private cache. Without
react-native-share, Export shares the same text as a message instead.

Limits: the last 500 entries are kept; bodies and printed values longer than 64 KB are cut with a
`[truncated, N KB total]` marker; the file export holds every entry, while the plain-text fallback is
cut to the newest entries that fit the share sheet (about 250,000 characters, Android's limit) and
says how many older entries were left out; if the share sheet cannot be opened, an alert says so.
Nothing is ever redacted: query strings, including tokens, are logged as sent.

## Migrating from 1.x

1. Install from the git URL above, not from npm. Upgrade react-native-shake to 6.x and drop any
   patch you carried for its 5.x Android build (6.x uses mavenCentral). Add
   react-native-safe-area-context if the app does not have it yet.
2. Delete the two `axios-inherit` lines at the top of your axios file (`require('axios-inherit')` and
   `axiosInherit(axios)`) and call `attach` on each axios instance you want logged instead, or on
   `axios` itself if you use it directly. Guard it with your test-build flag: 1.x recorded only while
   `<ServerLogger />` was mounted, 2.x records from the moment `attach` is called.
3. Replace `serverLoggerRef.current?.printHelper(x)` with `print(x)` (or `serverLogger.print(x)`)
   and drop the ref. No guard is needed: it does nothing until `attach`.
4. `import { ServerLogger } from 'rn-server-logger'` (named export, no props, no ref). No guard is
   needed either: it renders nothing until `attach`.
5. Keep `react-native-share`, upgraded to 12 or newer, so Export keeps sharing a file. Remove
   `axios-inherit`, `react-native-fs` and `moment` if nothing else uses them, then run `pod install`
   again so react-native-fs is unlinked.
6. Check the requirements above: the new architecture, axios 0.27 or newer and React 18 or newer.

What testers will notice: the REQUEST, RESPONSE, ERROR and PRINT tabs are gone. Each call is one row
showing its status and duration, and the filters are All, HTTP, Errors and Print. Export still shares
a `.txt` file, now named with the export time instead of `logs.txt`.
