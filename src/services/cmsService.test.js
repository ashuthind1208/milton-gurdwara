import { resolveScheduleForDate } from './cmsService';

const defaultDay = {
  id: 'schedule-default',
  dateKey: 'default',
  entries: [
    {
      id: 'daily-entry',
      segment: 'morning',
      timeEn: '5:00 AM - 5:15 AM',
      titleEn: 'Daily Entry',
      isActive: true,
      sortOrder: 1
    }
  ]
};

test('adds the Sunday program to the ordinary daily schedule only on Sundays', () => {
  const sunday = resolveScheduleForDate([defaultDay], '2026-08-23');
  const monday = resolveScheduleForDate([defaultDay], '2026-08-24');

  expect(sunday.entries.map((entry) => [entry.timeEn, entry.titleEn])).toEqual([
    ['5:00 AM - 5:15 AM', 'Daily Entry'],
    ['10:30 AM - 12:00 PM', 'Sri Sukhmani Sahib Path'],
    ['12:00 PM - 12:45 PM', 'Kirtan'],
    ['12:45 PM - 1:30 PM', 'Katha']
  ]);
  expect(monday.entries.map((entry) => entry.titleEn)).toEqual(['Daily Entry']);
});

test('keeps a saved Sunday schedule as the manual override', () => {
  const manualSunday = {
    id: 'manual-sunday',
    dateKey: '2026-08-23',
    entries: [
      {
        id: 'manual-entry',
        segment: 'special',
        timeEn: '11:00 AM - 12:00 PM',
        titleEn: 'Adjusted Sunday Program',
        isActive: true,
        sortOrder: 1
      }
    ]
  };

  const resolved = resolveScheduleForDate([defaultDay, manualSunday], '2026-08-23');

  expect(resolved.entries.map((entry) => entry.titleEn)).toEqual(['Adjusted Sunday Program']);
});

test('migrates the legacy default schedule to the Monday-Saturday timings', () => {
  const legacyDefault = {
    dateKey: 'default',
    entries: [
      { segment: 'morning', timeEn: '5:15AM - 6:15AM', titleEn: '5 Baani da Paath' },
      { segment: 'morning', timeEn: '6:15 AM - 6:40 AM', titleEn: 'Ardaas and Hukamnama' },
      { segment: 'evening', timeEn: '7:45 PM - 8:00 PM', titleEn: 'Kirtan Sohila Sahib' },
      { segment: 'evening', timeEn: '8:00PM - 8:30PM', titleEn: 'Sukh Asan Sri Guru Granth Sahib' }
    ]
  };

  const resolved = resolveScheduleForDate([legacyDefault], '2026-08-24');

  expect(resolved.entries.map((entry) => [entry.timeEn, entry.titleEn])).toEqual([
    ['5:15AM - 6:00AM', '5 Baani da Paath'],
    ['6:00 AM - 6:15 AM', 'Ardaas and Hukamnama'],
    ['7:45 PM - 8:00 PM', 'Kirtan Sohila Sahib and Sukh Asan Sri Guru Granth Sahib']
  ]);
});