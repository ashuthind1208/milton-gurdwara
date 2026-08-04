import { isCalendarDateCurrent, isEventCurrent, isLibraryProgramCurrent } from './eventAvailability';

describe('event availability', () => {
  const middayAugustFourth = new Date(2026, 7, 4, 12, 0, 0).getTime();

  test('keeps an event visible until its end time', () => {
    expect(isEventCurrent({
      date: '2026-08-04T09:00:00-04:00',
      endDate: '2026-08-04T13:00:00-04:00'
    }, middayAugustFourth)).toBe(true);
  });

  test('uses the start time when an event has no end time', () => {
    expect(isEventCurrent({ date: '2026-08-04T09:00:00-04:00' }, middayAugustFourth)).toBe(false);
  });

  test('keeps malformed event dates visible instead of discarding records', () => {
    expect(isEventCurrent({ date: 'Date TBA' }, middayAugustFourth)).toBe(true);
  });

  test('keeps Library programs visible through their scheduled local day', () => {
    expect(isCalendarDateCurrent('2026-08-04', middayAugustFourth)).toBe(true);
    expect(isLibraryProgramCurrent({ scheduleDate: '2026-08-03' }, middayAugustFourth)).toBe(false);
  });
});