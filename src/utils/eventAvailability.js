const toTimestamp = (value) => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
};

export const isEventCurrent = (event, now = Date.now()) => {
  const endTimestamp = toTimestamp(event?.endDate || event?.end);
  const startTimestamp = toTimestamp(event?.date);
  const cutoffTimestamp = endTimestamp ?? startTimestamp;

  return cutoffTimestamp == null || cutoffTimestamp >= now;
};

export const isCalendarDateCurrent = (value, now = Date.now()) => {
  const dateToken = String(value || '').trim();
  if (!dateToken) {
    return true;
  }

  const dateOnlyMatch = dateToken.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const parsedDate = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
    : new Date(dateToken);

  if (Number.isNaN(parsedDate.getTime())) {
    return true;
  }

  parsedDate.setHours(23, 59, 59, 999);
  return parsedDate.getTime() >= now;
};

export const isLibraryProgramCurrent = (program, now = Date.now()) => (
  isCalendarDateCurrent(program?.scheduleDate, now)
);