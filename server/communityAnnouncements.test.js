const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isCommunityAnnouncementCurrentlyPublished,
  normalizeCommunityAnnouncementReview,
  normalizeCommunityAnnouncementSubmission,
  projectPublicCommunityAnnouncement
} = require('./communityAnnouncements');

const basePayload = {
  titleEnglish: 'Basement for rent',
  titlePunjabi: 'ਬੇਸਮੈਂਟ ਕਿਰਾਏ ਲਈ',
  descriptionEnglish: 'Two-bedroom basement available in Milton.',
  descriptionPunjabi: 'ਮਿਲਟਨ ਵਿੱਚ ਦੋ ਕਮਰਿਆਂ ਵਾਲਾ ਬੇਸਮੈਂਟ ਉਪਲਬਧ ਹੈ।',
  category: 'housing-rental',
  audience: 'public',
  contactPreference: 'phone',
  contactValue: '905-555-0100',
  noticeFormat: 'text',
  imageUrl: '',
  publishFrom: '2026-10-22',
  publishUntil: '2026-11-01',
  consent: true
};

test('creates a pending notice using server supplied submitter identity', () => {
  const now = new Date('2026-10-22T12:00:00.000Z');
  const submission = normalizeCommunityAnnouncementSubmission(basePayload, { id: 'user-1', name: 'Sangat Member', email: 'member@example.com' }, now);
  assert.equal(submission.status, 'pending');
  assert.equal(submission.submitterEmail, 'member@example.com');
  assert.equal(submission.contactValue, '905-555-0100');
  assert.equal(submission.showContact, false);
});

test('requires consent, valid bilingual content/category/dates and managed image paths', () => {
  assert.throws(() => normalizeCommunityAnnouncementSubmission({ ...basePayload, consent: false }), /permission/i);
  assert.throws(() => normalizeCommunityAnnouncementSubmission({ ...basePayload, category: 'unknown' }), /category/i);
  assert.throws(() => normalizeCommunityAnnouncementSubmission({ ...basePayload, noticeFormat: 'poster', imageUrl: 'https://example.com/image.jpg' }), /photo uploader/i);
  assert.throws(() => normalizeCommunityAnnouncementSubmission({ ...basePayload, publishUntil: '2026-10-01' }, {}, new Date('2026-10-22T12:00:00Z')), /end date/i);
  assert.throws(() => normalizeCommunityAnnouncementSubmission({ ...basePayload, publishUntil: '2026-02-31' }), /valid start and end dates/i);
});

test('requires an uploaded image for poster format and strips images from text format', () => {
  assert.throws(() => normalizeCommunityAnnouncementSubmission({ ...basePayload, noticeFormat: 'poster', imageUrl: '' }), /poster image/i);
  const posterNotice = normalizeCommunityAnnouncementSubmission({ ...basePayload, noticeFormat: 'poster', imageUrl: '/api/uploads/community-notices/poster.jpg' });
  assert.equal(posterNotice.titleEnglish, '');
  assert.equal(posterNotice.descriptionEnglish, '');
  const textNotice = normalizeCommunityAnnouncementSubmission({ ...basePayload, noticeFormat: 'text', imageUrl: '/api/uploads/community-notices/poster.jpg' });
  assert.equal(textNotice.imageUrl, '');
});

test('switching a poster to text removes poster imagery and text to poster removes all text', () => {
  const poster = normalizeCommunityAnnouncementSubmission({
    ...basePayload,
    noticeFormat: 'poster',
    imageUrl: '/api/uploads/community-notices/poster.jpg'
  });
  assert.equal(poster.titleEnglish, '');
  const text = normalizeCommunityAnnouncementReview({
    noticeFormat: 'text', titleEnglish: 'Community event', descriptionEnglish: 'Come join us.'
  }, poster);
  assert.equal(text.imageUrl, '');
  const posterAgain = normalizeCommunityAnnouncementReview({
    noticeFormat: 'poster', imageUrl: '/api/uploads/community-notices/poster.jpg'
  }, text);
  assert.equal(posterAgain.titleEnglish, '');
  assert.equal(posterAgain.descriptionEnglish, '');
});

test('publishes only approved notices within their date window', () => {
  const entry = { status: 'approved', publishFrom: '2026-10-22', publishUntil: '2026-10-23' };
  assert.equal(isCommunityAnnouncementCurrentlyPublished(entry, new Date('2026-10-22T12:00:00')), true);
  assert.equal(isCommunityAnnouncementCurrentlyPublished({ ...entry, status: 'pending' }, new Date('2026-10-22T12:00:00')), false);
  assert.equal(isCommunityAnnouncementCurrentlyPublished(entry, new Date('2026-10-24T12:00:00')), false);
});

test('hides submitter and contact details from public projection unless admin permits contact display', () => {
  const entry = { ...basePayload, status: 'approved', submitterEmail: 'private@example.com', submitterName: 'Private', showContact: false };
  assert.equal(projectPublicCommunityAnnouncement(entry).contactPreference, 'none');
  assert.equal(projectPublicCommunityAnnouncement(entry).contactValue, '');
  assert.equal(projectPublicCommunityAnnouncement(entry).submitterName, 'Private');
  assert.equal(projectPublicCommunityAnnouncement({ ...entry, showContact: true }).contactPreference, 'phone');
  assert.equal(projectPublicCommunityAnnouncement({ ...entry, showContact: true }).contactValue, '905-555-0100');
  assert.equal(Object.hasOwn(projectPublicCommunityAnnouncement(entry), 'submitterEmail'), false);
});

test('allows admin review transitions without accepting arbitrary status', () => {
  const now = new Date('2026-10-22T14:00:00Z');
  const existing = normalizeCommunityAnnouncementSubmission(basePayload, { id: 'user-1', email: 'member@example.com' }, now);
  const approved = normalizeCommunityAnnouncementReview({ status: 'approved', showContact: true }, existing, { email: 'admin@example.com' }, now);
  assert.equal(approved.status, 'approved');
  assert.equal(approved.showContact, true);
  assert.equal(approved.reviewedBy, 'admin@example.com');
  assert.throws(() => normalizeCommunityAnnouncementReview({ status: 'published' }, existing), /status/i);
});

test('admin editing preserves all common creation fields including audience and start date', () => {
  const now = new Date('2026-10-22T12:00:00Z');
  const existing = normalizeCommunityAnnouncementSubmission(basePayload, { name: 'Member' }, now);
  const edited = normalizeCommunityAnnouncementReview({
    noticeFormat: 'text', publisherName: 'Committee', audience: 'sangat',
    publishFrom: '2026-10-25', publishUntil: '2026-11-10', showContact: true
  }, existing, { email: 'admin@example.com' }, now);
  assert.equal(edited.publisherName, 'Committee');
  assert.equal(edited.audience, 'sangat');
  assert.equal(edited.publishFrom, '2026-10-25');
  assert.equal(edited.publishUntil, '2026-11-10');
  assert.equal(edited.noticeFormat, 'text');
  assert.equal(edited.showContact, true);
  assert.throws(() => normalizeCommunityAnnouncementReview({ audience: 'invalid' }, existing, {}, now), /who the notice is for/i);
  assert.throws(() => normalizeCommunityAnnouncementReview({ publishFrom: '2026-11-15' }, existing, {}, now), /start date/i);
  assert.throws(() => normalizeCommunityAnnouncementReview({ publishFrom: '2026-02-31' }, existing, {}, now), /valid/i);
  assert.throws(() => normalizeCommunityAnnouncementReview({ publishUntil: '2027-01-30' }, existing, {}, now), /60 days/i);
});
