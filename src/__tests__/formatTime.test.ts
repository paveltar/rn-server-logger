import { formatClock, formatDateTime } from '../formatTime';

// Local time, so the expected strings do not depend on the machine's zone
const timestamp = new Date(2026, 8, 16, 9, 5, 7, 42).getTime();

test('formatClock is HH:mm:ss', () => {
  expect(formatClock(timestamp)).toBe('09:05:07');
});

test('formatDateTime is DD-MM-YY HH:mm:ss.SSS', () => {
  expect(formatDateTime(timestamp)).toBe('16-09-26 09:05:07.042');
});
