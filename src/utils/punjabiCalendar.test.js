import { getFallbackNanakshahiObservances, getNanakshahiDate, getNanakshahiMonthCalendar, getUpcomingPunjabiObservances, mergeNanakshahiObservances, registerNanakshahiMonthStarts } from './punjabiCalendar';
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

test('calendar popup data preserves community event titles and details for the selected date', () => {
  const observances = [
    ...getFallbackNanakshahiObservances(),
    { id: 'community-event-1', date: '2026-11-08', title: 'Sunday Program', titlePa: 'ਐਤਵਾਰ ਦਾ ਪ੍ਰੋਗਰਾਮ', type: 'Community Event', blurb: '10:00 AM · Darbar Hall' }
  ];
  const calendar = getNanakshahiMonthCalendar('2026-11-08', observances);
  const day = calendar.weeks.flat().find((cell) => cell?.gregorianDate?.toISOString().slice(0, 10) === '2026-11-08');
  expect(day.observances.map((entry) => entry.title)).toEqual(expect.arrayContaining(['Bandi Chhor (Divali)', 'Sunday Program']));
  expect(day.observances.find((entry) => entry.title === 'Sunday Program').blurb).toContain('Darbar Hall');
});

test('bundles fixed Gurpurab observances for when the remote holiday feed is empty', () => {
  const fallback = getFallbackNanakshahiObservances();
  expect(fallback.find((entry) => entry.date === '2026-11-08')).toMatchObject({ title: 'Bandi Chhor (Divali)', type: 'Holiday' });
  const calendar = getNanakshahiMonthCalendar('2026-11-08', fallback);
  const bandiChhor = calendar.weeks.flat().find((cell) => cell?.gregorianDate?.toISOString().slice(0, 10) === '2026-11-08');
  expect(bandiChhor.observances.some((entry) => entry.title === 'Bandi Chhor (Divali)')).toBe(true);
});

test('partial remote holiday feeds retain missing local event details without duplicates', () => {
  const fallback = getFallbackNanakshahiObservances();
  const remote = [{ ...fallback.find((item) => item.date === '2026-11-08'), id: 'api-bandi', significanceEn: 'Remote details' }];
  const merged = mergeNanakshahiObservances(remote, fallback);
  expect(merged.filter((item) => item.date === '2026-11-08' && item.title === 'Bandi Chhor (Divali)')).toHaveLength(1);
  expect(merged.find((item) => item.date === '2026-11-08').significanceEn).toBe('Remote details');
  expect(merged.some((item) => item.title === 'Guru Nanak Dev Ji' && item.date === '2026-11-24')).toBe(true);
});

const expectedTorontoPhases = {
  Masya: [
    '2026-01-18', '2026-02-17', '2026-03-18', '2026-04-17', '2026-05-16', '2026-06-14',
    '2026-07-14', '2026-08-12', '2026-09-10', '2026-10-10', '2026-11-09', '2026-12-08',
    '2027-01-07', '2027-02-06', '2027-03-08', '2027-04-06', '2027-05-06', '2027-06-04',
    '2027-07-03', '2027-08-02', '2027-08-31', '2027-09-29', '2027-10-29', '2027-11-27', '2027-12-27'
  ],
  Puranmashi: [
    '2026-01-03', '2026-02-01', '2026-03-03', '2026-04-01', '2026-05-01', '2026-05-31',
    '2026-06-29', '2026-07-29', '2026-08-28', '2026-09-26', '2026-10-26', '2026-11-24', '2026-12-23',
    '2027-01-22', '2027-02-20', '2027-03-22', '2027-04-20', '2027-05-20', '2027-06-18',
    '2027-07-18', '2027-08-17', '2027-09-15', '2027-10-15', '2027-11-13', '2027-12-13'
  ]
};

test.each(Object.entries(expectedTorontoPhases))('fallback has exactly the verified Toronto %s dates', (type, dates) => {
  const phases = getFallbackNanakshahiObservances().filter((item) => item.type === type);
  expect(phases.map((item) => item.date).sort()).toEqual(dates);
  expect(phases.every((item) => item.blurb.includes('Astronomical moon phase date in Toronto')
    && item.blurb.includes('Traditional Sikh observance dates may differ')
    && item.blurb.includes('not a sunrise-tithi calculation') && item.blurbPa)).toBe(true);
});

test('calendar defaults use Toronto phases across month and year boundaries while retaining religious events', () => {
  const dayFor = (date, source) => {
    const calendar = getNanakshahiMonthCalendar(date, source);
    return calendar.weeks.flat().find((cell) => cell && [
      cell.gregorianDate.getFullYear(),
      String(cell.gregorianDate.getMonth() + 1).padStart(2, '0'),
      String(cell.gregorianDate.getDate()).padStart(2, '0')
    ].join('-') === date);
  };
  for (const [date, type] of [
    ['2026-10-26', 'Puranmashi'], ['2026-11-09', 'Masya'], ['2026-11-24', 'Puranmashi'],
    ['2026-12-08', 'Masya'], ['2026-12-23', 'Puranmashi'], ['2027-01-07', 'Masya'],
    ['2027-02-20', 'Puranmashi'], ['2026-05-01', 'Puranmashi'], ['2026-05-31', 'Puranmashi']
  ]) {
    const phases = dayFor(date).observances.filter((item) => ['Masya', 'Puranmashi'].includes(item.type));
    expect(phases).toEqual([expect.objectContaining({ type })]);
  }
  expect(dayFor('2026-12-08', null).observances).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'Masya' })]));
  expect(dayFor('2027-02-20').observances).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'Bhagat Ravidas Ji', type: 'Birth' })
  ]));
  expect(dayFor('2026-12-23').observances).toEqual(expect.arrayContaining([
    expect.objectContaining({ title: 'Saka Chamkaur Sahib Ji', type: 'Historical' })
  ]));
  expect(getUpcomingPunjabiObservances(0, new Date(2026, 11, 8))).toEqual(expect.arrayContaining([
    expect.objectContaining({ date: '2026-12-08', type: 'Masya' })
  ]));
});

test('verified-year remote phase duplicates and conflicts yield to canonical dates without removing history or other years', () => {
  const remote = [
    { id: 'conflict', date: '2026-12-06', title: 'Full Moon', type: 'full moon' },
    { id: 'duplicate', date: '2026-12-23', title: 'Purnima', type: 'observance' },
    { id: 'duplicate-2', gregorianDate: '2026-12-23', title: 'Puranmaasi (full moon)', type: 'Puranmashi' },
    { id: 'type-only', date: '2027-02-05', title: 'Moon phase', type: 'Maseya' },
    { id: 'historic', date: '2026-12-06', title: 'Gurpurab on the Full Moon', type: 'Puranmashi', isGurpurab: true },
    { id: 'historic-no-flag', date: '2026-12-06', title: 'History of Masya at Anandpur', type: 'Masya' },
    { id: 'future', date: '2028-01-01', title: 'Full Moon', type: 'full moon' },
    { id: 'future-duplicate', date: '2028-01-01', title: 'Purnima', type: 'Purnima' }
  ];
  const merged = mergeNanakshahiObservances(remote);
  expect(merged.filter((item) => ['conflict', 'duplicate', 'duplicate-2', 'type-only'].includes(item.id))).toHaveLength(0);
  expect(merged.filter((item) => item.date === '2026-12-23' && item.type === 'Puranmashi')).toHaveLength(1);
  expect(merged.filter((item) => item.date === '2026-12-08' && item.type === 'Masya')).toHaveLength(1);
  expect(merged).toEqual(expect.arrayContaining(remote.slice(4)));
  expect(merged.filter((item) => String(item.date || '').startsWith('2028-'))).toEqual(remote.slice(6));
});

test.each([
  ['Masya', 'new moon'], ['Maseya', 'new moon'], ['Massia', 'new moon'], ['Amavasya', 'new moon'],
  ['Puranmaasi', 'full moon'], ['Puranmashi', 'full moon'], ['Purnima', 'full moon'],
  ['new moon', 'new moon'], ['full moon', 'full moon']
])('reconciles standalone %s in both title and type', (alias, generic) => {
  const remote = [
    { id: 'title', date: '2027-04-01', title: alias, type: 'observance' },
    { id: 'type', date: '2027-04-02', title: '', type: alias },
    { id: 'combined', date: '2027-04-03', title: `${alias} (${generic})`, type: 'observance' }
  ];
  const merged = mergeNanakshahiObservances(remote, []);
  expect(merged.some((item) => remote.some(({ id }) => id === item.id))).toBe(false);
  expect(merged.filter((item) => item.type === 'Masya').map((item) => item.date).sort()).toEqual(expectedTorontoPhases.Masya);
  expect(merged.filter((item) => item.type === 'Puranmashi').map((item) => item.date).sort()).toEqual(expectedTorontoPhases.Puranmashi);
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