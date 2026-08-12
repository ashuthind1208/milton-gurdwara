const normalizeText = (value) => String(value || '').trim().toLowerCase();
const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

export const bookingBelongsToProfile = (booking = {}, profile = {}) => {
  const profileEmail = normalizeText(profile.email);
  const profilePhone = normalizePhone(profile.phone);
  const profileName = normalizeText(profile.name);
  const bookingEmail = normalizeText(booking.requesterEmail);
  const bookingPhone = normalizePhone(booking.requesterPhone);
  const bookingName = normalizeText(booking.requesterName);

  if (profileEmail && bookingEmail === profileEmail) {
    return true;
  }
  if (profilePhone && bookingPhone === profilePhone) {
    return true;
  }
  return !profileEmail && !profilePhone && Boolean(profileName && bookingName === profileName);
};

export const isBookingPaymentDonation = (donation = {}, bookings = []) => {
  const pendingId = String(donation.sourcePendingId || '').trim();
  const campaignId = String(donation.campaignId ?? '').trim();
  const linkedToBooking = bookings.some((booking) => (
    (pendingId && pendingId === String(booking.donationPendingId || '').trim())
    || (campaignId && campaignId === String(booking.donationCampaignId || '').trim())
  ));
  const campaignName = normalizeText(donation.campaignName);

  return linkedToBooking || campaignName === 'booking payments';
};

export const sortBookingsBySchedule = (bookings = [], direction = 'asc') => [...bookings].sort((first, second) => {
  const firstValue = `${first.date || ''}T${first.startTime || '00:00'}`;
  const secondValue = `${second.date || ''}T${second.startTime || '00:00'}`;
  return direction === 'desc' ? secondValue.localeCompare(firstValue) : firstValue.localeCompare(secondValue);
});