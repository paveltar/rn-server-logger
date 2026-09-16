import { add, isTracking, nextId } from './store';
import { serialize } from './serialize';

/** Adds the value to the log and returns it unchanged, so it can wrap an expression. */
export const print = <T>(value: T): T => {
  if (isTracking()) {
    add({ id: nextId(), kind: 'print', startedAt: Date.now(), text: serialize(value) });
  }
  return value;
};
