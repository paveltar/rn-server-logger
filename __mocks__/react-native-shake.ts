// Automatic jest mock for react-native-shake (the real module needs a native module at import time).
// Jest evaluates this file separately for a plain `import`/`require` (the automatic node_modules
// mock substitution) and for `jest.requireMock`, so module-scoped state would not be shared between
// the two. The listener is kept on `globalThis` instead, which both evaluations see.
type Listener = () => void;
type GlobalWithListener = typeof globalThis & { __rnShakeListener?: Listener | null };
const globalState = globalThis as GlobalWithListener;

/** Test helper: fires the shake listener the component registered. */
export const shake = (): void => {
  globalState.__rnShakeListener?.();
};

export default {
  addListener: (callback: Listener) => {
    globalState.__rnShakeListener = callback;
    return { remove: () => { globalState.__rnShakeListener = null; } };
  },
};
