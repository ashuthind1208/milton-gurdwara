const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toValidDate = (value) => {
  const parsed = new Date(value || '');
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveMembershipRenewal = (user = {}, now = new Date()) => {
  if (String(user.role || '').trim().toLowerCase() !== 'member') {
    return null;
  }

  const paidRecords = (Array.isArray(user.membershipFeeRecords) ? user.membershipFeeRecords : [])
    .filter((entry) => String(entry?.status || '').trim().toLowerCase() === 'paid')
    .map((entry) => ({ ...entry, paidAt: toValidDate(entry?.paymentDate || entry?.updatedAt) }))
    .filter((entry) => entry.paidAt)
    .sort((left, right) => right.paidAt.getTime() - left.paidAt.getTime());

  if (paidRecords.length === 0) {
    return null;
  }

  const schedule = String(user.membershipProfile?.donationSchedule || 'monthly').trim().toLowerCase() === 'yearly'
    ? 'yearly'
    : 'monthly';
  const validityDays = schedule === 'yearly' ? 365 : 30;
  const latestPaidRecord = paidRecords[0];
  const dueDate = new Date(latestPaidRecord.paidAt.getTime() + (validityDays * MS_PER_DAY));
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(dueDate);
  dueDay.setHours(0, 0, 0, 0);

  return {
    schedule,
    latestPaidRecord,
    dueDate,
    daysUntilDue: Math.round((dueDay.getTime() - today.getTime()) / MS_PER_DAY)
  };
};

module.exports = {
  resolveMembershipRenewal
};
