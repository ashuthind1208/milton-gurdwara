import {
  bookingBelongsToProfile,
  isBookingPaymentDonation,
  sortBookingsBySchedule
} from './profileBookings';

describe('profile bookings', () => {
  test('matches bookings by email or normalized phone', () => {
    expect(bookingBelongsToProfile(
      { requesterEmail: 'member@example.com' },
      { email: 'MEMBER@example.com' }
    )).toBe(true);
    expect(bookingBelongsToProfile(
      { requesterPhone: '905-555-0123' },
      { phone: '(905) 555 0123' }
    )).toBe(true);
  });

  test('does not use a name match when stronger profile identifiers are present', () => {
    expect(bookingBelongsToProfile(
      { requesterName: 'Same Name', requesterEmail: 'other@example.com' },
      { name: 'Same Name', email: 'member@example.com' }
    )).toBe(false);
  });

  test('identifies linked booking payments without excluding genuine donations', () => {
    const bookings = [{
      donationPendingId: 'pending-1786407728206',
      donationCampaignId: '7'
    }];

    expect(isBookingPaymentDonation(
      { sourcePendingId: 'pending-1786407728206', campaignName: 'General Fund' },
      bookings
    )).toBe(true);
    expect(isBookingPaymentDonation(
      { campaignName: 'Booking Payments' },
      []
    )).toBe(true);
    expect(isBookingPaymentDonation(
      { sourcePendingId: 'pending-genuine', campaignName: 'General Fund' },
      bookings
    )).toBe(false);
  });

  test('sorts booking dates and times in either direction', () => {
    const bookings = [
      { id: 'later', date: '2026-08-12', startTime: '10:00' },
      { id: 'earlier', date: '2026-08-11', startTime: '18:00' }
    ];

    expect(sortBookingsBySchedule(bookings).map((booking) => booking.id)).toEqual(['earlier', 'later']);
    expect(sortBookingsBySchedule(bookings, 'desc').map((booking) => booking.id)).toEqual(['later', 'earlier']);
  });
});
