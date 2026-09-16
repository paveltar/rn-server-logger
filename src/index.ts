import { attach, detach } from './attach';
import { print } from './print';

export { attach, detach, print };
export { ServerLogger } from './ServerLogger';
export type { HttpEntry, LogEntry, PrintEntry } from './store';

/** For the `serverLogger.print(x)` style. The viewer stays a named export. */
export default { attach, detach, print };
