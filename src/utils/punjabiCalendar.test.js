import { getNanakshahiDate, getNanakshahiMonthCalendar, registerNanakshahiMonthStarts } from './punjabiCalendar';
import { NANAKSHAHI_ANNUAL_MONTH_STARTS } from '../constants/nanakshahiMonthStarts';

test('18 October 2026 matches SGPC and the API: 2 Katak 558', () => {
  expect(getNanakshahiDate('2026-10-18')).toMatchObject({ day: 2, month: 'Katak', year: 558, labelPa: '੨ ਕੱਤਕ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ' });
});

test.each(NANAKSHAHI_ANNUAL_MONTH_STARTS[558])('%s is the first day of its published month', (date) => {
  expect(getNanakshahiDate(date)).toMatchObject({ day: 1, year: 558 });
});

test('dates either side of Katak Sangrand stay in the correct month', () => {
  expect(getNanakshahiDate('2026-10-16')).toMatchObject({ day: 30, month: 'Assu' });
  expect(getNanakshahiDate('2026-10-17')).toMatchObject({ day: 1, month: 'Katak' });
  expect(getNanakshahiDate('2026-11-15')).toMatchObject({ day: 30, month: 'Katak' });
  expect(getNanakshahiDate('2026-11-16')).toMatchObject({ day: 1, month: 'Maghar' });
});

test('calendar cells follow civil dates across the November DST change', () => {
  const calendar = getNanakshahiMonthCalendar('2026-11-03', []);
  const cells = calendar.weeks.flat().filter(Boolean);
  expect(cells).toHaveLength(30);
  const keys = cells.map(({ gregorianDate: d }) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
  expect(new Set(keys).size).toBe(30);
  expect(getNanakshahiDate('2026-11-03')).toMatchObject({ day: 18, month: 'Katak' });
});

test('partial API data does not replace verified annual month starts', () => {
  registerNanakshahiMonthStarts([{ type: 'sangrand', gregorian: '2026-10-15', nanakshahi: { year: 558, month: 8, day: 1 } }]);
  expect(getNanakshahiDate('2026-10-18').day).toBe(2);
});

test('year 559 uses its own complete API dates without changing year 558', () => {
  // Synthetic API fixture: tests registration, not a published 559 calendar.
  const dates = NANAKSHAHI_ANNUAL_MONTH_STARTS[558].map((date) => `${Number(date.slice(0, 4)) + 1}${date.slice(4)}`);
  dates[7] = '2027-10-18';
  const previous = NANAKSHAHI_ANNUAL_MONTH_STARTS[559];
  try {
    registerNanakshahiMonthStarts(dates.map((gregorian, index) => ({
      type: 'sangrand', gregorian, nanakshahi: { year: 559, month: index + 1, day: 1 }
    })));
    expect(getNanakshahiDate('2027-10-18')).toMatchObject({ day: 1, month: 'Katak', year: 559 });
    expect(getNanakshahiDate('2026-10-18')).toMatchObject({ day: 2, month: 'Katak', year: 558 });
    expect(getNanakshahiDate('2028-01-14')).toMatchObject({ day: 1, month: 'Magh', year: 559 });
  } finally {
    if (previous) NANAKSHAHI_ANNUAL_MONTH_STARTS[559] = previous;
    else delete NANAKSHAHI_ANNUAL_MONTH_STARTS[559];
  }
});