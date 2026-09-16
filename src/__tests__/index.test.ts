import serverLogger, { attach, detach, print, ServerLogger } from '../index';

test('the default export bundles attach, detach and print, and nothing else', () => {
  expect(serverLogger).toEqual({ attach, detach, print });
  expect(serverLogger.attach).toBe(attach);
  expect(typeof ServerLogger).toBe('function');
  expect((serverLogger as Record<string, unknown>).ServerLogger).toBeUndefined();
});
