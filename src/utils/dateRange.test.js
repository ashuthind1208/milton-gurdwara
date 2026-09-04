import { expandDateRange, isAkhandPathBooking, toDateOnlyKey } from './dateRange';

describe('date range utilities', () => {
  test('expands an inclusive multi-day range', () => {
    expect(expandDateRange('2026-09-01', '2026-09-03')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03'
    ]);
  });

  test('supports a single day and rejects a reversed range', () => {
    expect(expandDateRange('2026-09-01')).toEqual(['2026-09-01']);
    expect(expandDateRange('2026-09-03', '2026-09-01')).toEqual([]);
  });

  test('normalizes timestamps and identifies Akhand Paath bookings', () => {
    expect(toDateOnlyKey('2026-09-01T18:00:00Z')).toBe('2026-09-01');
    expect(isAkhandPathBooking({ categoryName: 'Akhand Paath Sahib' })).toBe(true);
    expect(isAkhandPathBooking({ title: 'Sehaj Path' })).toBe(false);
  });
});
