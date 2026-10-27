// Automatic jest mock for react-native-share (the real module needs a native module at import time).
// Same shape as the real default export, reduced to what the logger calls.
export default {
  open: jest.fn(async () => ({ success: true })),
};
