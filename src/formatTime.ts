const pad = (value: number, width = 2): string => String(value).padStart(width, '0');

/** "HH:mm:ss" in local time, for list rows. */
export const formatClock = (timestamp: number): string => {
  const date = new Date(timestamp);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** "DD-MM-YY HH:mm:ss.SSS" in local time, for the export. */
export const formatDateTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const day = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${pad(date.getFullYear() % 100)}`;
  return `${day} ${formatClock(timestamp)}.${pad(date.getMilliseconds(), 3)}`;
};
