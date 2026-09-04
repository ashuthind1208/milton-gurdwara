export const toDateOnlyKey = (value) => {
  const rawValue = String(value || '').trim();
  const dateOnlyMatch = rawValue.match(/^(\d{4}-\d{2}-\d{2})/);
  if (dateOnlyMatch) {
    return dateOnlyMatch[1];
  }

  const date = value instanceof Date ? value : new Date(value || '');
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const expandDateRange = (fromValue, toValue = fromValue) => {
  const fromDate = toDateOnlyKey(fromValue);
  const toDate = toDateOnlyKey(toValue) || fromDate;
  if (!fromDate || !toDate || toDate < fromDate) {
    return [];
  }

  const dates = [];
  const cursor = new Date(`${fromDate}T12:00:00`);
  const end = new Date(`${toDate}T12:00:00`);
  while (cursor <= end && dates.length < 3660) {
    dates.push(toDateOnlyKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

export const isAkhandPathBooking = (entry = {}) => (
  /akhand\s*(paath|path)/i.test(`${entry.categoryName || ''} ${entry.title || ''}`)
);
