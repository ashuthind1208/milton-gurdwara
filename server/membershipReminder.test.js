const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveMembershipRenewal } = require('./membershipReminder');

test('returns a 30 day renewal for monthly members', () => {
  const result = resolveMembershipRenewal({
    role: 'Member',
    membershipProfile: { donationSchedule: 'monthly' },
    membershipFeeRecords: [{ status: 'paid', paymentDate: '2026-09-01T12:00:00.000Z' }]
  }, new Date('2026-09-16T12:00:00.000Z'));

  assert.equal(result.daysUntilDue, 15);
  assert.equal(result.schedule, 'monthly');
});

test('returns a 365 day renewal for yearly members', () => {
  const result = resolveMembershipRenewal({
    role: 'Member',
    membershipProfile: { donationSchedule: 'yearly' },
    membershipFeeRecords: [{ status: 'paid', paymentDate: '2026-01-01T12:00:00.000Z' }]
  }, new Date('2026-12-02T12:00:00.000Z'));

  assert.equal(result.daysUntilDue, 30);
  assert.equal(result.schedule, 'yearly');
});

test('uses the latest valid paid record and ignores non-members', () => {
  const memberResult = resolveMembershipRenewal({
    role: 'Member',
    membershipFeeRecords: [
      { status: 'paid', paymentDate: '2026-01-01T12:00:00.000Z' },
      { status: 'pending', paymentDate: '2026-08-01T12:00:00.000Z' },
      { status: 'paid', paymentDate: '2026-09-01T12:00:00.000Z' }
    ]
  }, new Date('2026-09-29T12:00:00.000Z'));

  assert.equal(memberResult.daysUntilDue, 2);
  assert.equal(resolveMembershipRenewal({ role: 'Family', membershipFeeRecords: [] }), null);
});
