import { add, isRecording, nextId } from './store';
import { serialize } from './serialize';

/**
 * Adds the value to the log and returns it unchanged, so it can wrap an expression.
 * Does nothing until attach has been called, so it needs no test-build guard.
 */
export const print = <T>(value: T): T => {
  if (isRecording()) {
    add({ id: nextId(), kind: 'print', startedAt: Date.now(), text: serialize(value) });
  }
  return value;
};
