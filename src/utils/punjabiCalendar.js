const NANAKSHAHI_MONTH_STARTS = [
  { name: 'Chet', namePa: 'ਚੇਤ', month: 3, day: 14 },
  { name: 'Vaisakh', namePa: 'ਵੈਸਾਖ', month: 4, day: 14 },
  { name: 'Jeth', namePa: 'ਜੇਠ', month: 5, day: 15 },
  { name: 'Harh', namePa: 'ਹਾੜ', month: 6, day: 15 },
  { name: 'Sawan', namePa: 'ਸਾਵਣ', month: 7, day: 16 },
  { name: 'Bhadon', namePa: 'ਭਾਦੋਂ', month: 8, day: 16 },
  { name: 'Assu', namePa: 'ਅੱਸੂ', month: 9, day: 15 },
  { name: 'Katak', namePa: 'ਕੱਤਕ', month: 10, day: 15 },
  { name: 'Maghar', namePa: 'ਮੱਘਰ', month: 11, day: 14 },
  { name: 'Poh', namePa: 'ਪੋਹ', month: 12, day: 14 },
  { name: 'Magh', namePa: 'ਮਾਘ', month: 1, day: 13 },
  { name: 'Phagun', namePa: 'ਫੱਗਣ', month: 2, day: 12 }
];

const FIXED_OBSERVANCES = [
  { date: '2026-07-14', title: 'Sangrand - Sawan starts', titlePa: 'ਸੰਗਰਾਂਦ - ਸਾਵਣ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-07-15', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-07-31', title: 'Shaheedi Diwas - Bhai Taru Singh Ji', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ - ਭਾਈ ਤਾਰੂ ਸਿੰਘ ਜੀ', type: 'Shaheedi' },
  { date: '2026-08-05', title: 'Gurpurab - Guru Harkrishan Sahib Ji', titlePa: 'ਗੁਰਪੁਰਬ - ਗੁਰੂ ਹਰਿਕ੍ਰਿਸ਼ਨ ਸਾਹਿਬ ਜੀ', type: 'Gurpurab' },
  { date: '2026-08-16', title: 'Sangrand - Bhadon starts', titlePa: 'ਸੰਗਰਾਂਦ - ਭਾਦੋਂ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-08-14', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-09-01', title: 'Shaheedi Diwas - Baba Deep Singh Ji Smagam', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ - ਬਾਬਾ ਦੀਪ ਸਿੰਘ ਜੀ ਸਮਾਗਮ', type: 'Shaheedi' },
  { date: '2026-09-15', title: 'Sangrand - Assu starts', titlePa: 'ਸੰਗਰਾਂਦ - ਅੱਸੂ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-09-12', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-10-01', title: 'Gurpurab - Guru Ram Das Ji', titlePa: 'ਗੁਰਪੁਰਬ - ਗੁਰੂ ਰਾਮ ਦਾਸ ਜੀ', type: 'Gurpurab' },
  { date: '2026-10-15', title: 'Sangrand - Katak starts', titlePa: 'ਸੰਗਰਾਂਦ - ਕੱਤਕ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-10-11', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-11-14', title: 'Sangrand - Maghar starts', titlePa: 'ਸੰਗਰਾਂਦ - ਮੱਘਰ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-11-10', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' },
  { date: '2026-11-24', title: 'Guru Nanak Dev Ji Gurpurab', titlePa: 'ਗੁਰੂ ਨਾਨਕ ਦੇਵ ਜੀ ਗੁਰਪੁਰਬ', type: 'Holiday' },
  { date: '2026-12-07', title: 'Shaheedi Diwas - Sahibzade', titlePa: 'ਸ਼ਹੀਦੀ ਦਿਵਸ - ਸਾਹਿਬਜ਼ਾਦੇ', type: 'Shaheedi' },
  { date: '2026-12-14', title: 'Sangrand - Poh starts', titlePa: 'ਸੰਗਰਾਂਦ - ਪੋਹ ਸ਼ੁਰੂ', type: 'Sangrand' },
  { date: '2026-12-09', title: 'Masya (Maseya)', titlePa: 'ਮੱਸਿਆ', type: 'Masya' }
];

const DAY_MS = 24 * 60 * 60 * 1000;
const GURMUKHI_DIGITS = ['੦', '੧', '੨', '੩', '੪', '੫', '੬', '੭', '੮', '੯'];

const toDateOnly = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const formatDateLabel = (date) => new Intl.DateTimeFormat('en-CA', {
  weekday: 'short',
  month: 'short',
  day: 'numeric'
}).format(date);

const formatDateLabelPa = (date) => {
  const day = date.getDate();
  const month = date.toLocaleString('en-CA', { month: 'short' });
  return `${toGurmukhiNumber(day)} ${month}`;
};

export const toGurmukhiNumber = (value) => String(value)
  .split('')
  .map((char) => (char >= '0' && char <= '9' ? GURMUKHI_DIGITS[Number(char)] : char))
  .join('');

const buildMonthStartCandidates = (year) => {
  const candidates = [];
  for (const monthInfo of NANAKSHAHI_MONTH_STARTS) {
    candidates.push({
      ...monthInfo,
      date: new Date(year, monthInfo.month - 1, monthInfo.day)
    });
  }
  return candidates;
};

export const getNanakshahiDate = (inputDate = new Date()) => {
  const target = toDateOnly(inputDate);
  const candidates = [
    ...buildMonthStartCandidates(target.getFullYear() - 1),
    ...buildMonthStartCandidates(target.getFullYear()),
    ...buildMonthStartCandidates(target.getFullYear() + 1)
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let start = candidates[0];
  for (const candidate of candidates) {
    if (candidate.date.getTime() <= target.getTime()) {
      start = candidate;
    }
  }

  const daysSince = Math.floor((target.getTime() - start.date.getTime()) / DAY_MS);
  const chetStartCurrentYear = new Date(target.getFullYear(), 2, 14);
  const nanakshahiYear = target >= chetStartCurrentYear ? target.getFullYear() - 1468 : target.getFullYear() - 1469;

  return {
    day: daysSince + 1,
    month: start.name,
    monthPa: start.namePa,
    year: nanakshahiYear,
    label: `${daysSince + 1} ${start.name} ${nanakshahiYear} Nanakshahi`,
    labelPa: `${toGurmukhiNumber(daysSince + 1)} ${start.namePa} ${toGurmukhiNumber(nanakshahiYear)} ਨਾਨਕਸ਼ਾਹੀ`
  };
};

export const getUpcomingPunjabiObservances = (daysAhead = 10, now = new Date()) => {
  const today = toDateOnly(now);
  const windowEnd = new Date(today.getTime() + daysAhead * DAY_MS);

  return FIXED_OBSERVANCES
    .map((event) => ({ ...event, dateObj: toDateOnly(event.date) }))
    .filter((event) => event.dateObj >= today && event.dateObj <= windowEnd)
    .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
    .map((event) => {
      const nanakshahi = getNanakshahiDate(event.dateObj);
      return ({
      id: `${event.type}-${event.date}`,
      title: event.title,
      titlePa: event.titlePa || event.title,
      type: event.type,
      date: event.date,
      dateLabel: formatDateLabel(event.dateObj),
      dateLabelPa: formatDateLabelPa(event.dateObj),
      nanakshahiLabel: nanakshahi.label,
      nanakshahiLabelPa: nanakshahi.labelPa
      });
    });
};
