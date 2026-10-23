const COMMUNITY_ANNOUNCEMENT_CATEGORIES = Object.freeze([
  'community-service', 'celebration', 'condolence', 'blood-drive', 'school-education',
  'nonprofit-services', 'newcomer-government-services', 'lost-found', 'volunteer-seva',
  'housing-rental', 'other'
]);

const CONTACT_PREFERENCES = Object.freeze(['none', 'email', 'phone', 'whatsapp']);
const cleanText = (value, max = 500) => String(value || '').trim().slice(0, max);
const isIsoDate = (value) => {
  const normalized = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false;
  const parsed = new Date(`${normalized}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === normalized;
};

const createValidationError = (message, status = 400) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const normalizeCommunityAnnouncementSubmission = (payload = {}, actor = {}, now = new Date(), categories = COMMUNITY_ANNOUNCEMENT_CATEGORIES) => {
  const suppliedTitleEnglish = cleanText(payload.titleEnglish, 100);
  const suppliedTitlePunjabi = cleanText(payload.titlePunjabi, 100);
  const suppliedDescriptionEnglish = cleanText(payload.descriptionEnglish, 1000);
  const suppliedDescriptionPunjabi = cleanText(payload.descriptionPunjabi, 1000);
  const rawImageUrl = String(payload.imageUrl || '').trim();
  const noticeFormat = String(payload.noticeFormat || (rawImageUrl ? 'poster' : 'text')).trim();
  const actorRole = String(actor.role || '').trim().toLowerCase();
  const publisherName = ['admin', 'super admin'].includes(actorRole)
    ? cleanText(payload.publisherName || actor.name, 120)
    : cleanText(actor.name, 120);
  const titleEnglish = noticeFormat === 'text' ? suppliedTitleEnglish : '';
  const titlePunjabi = noticeFormat === 'text' ? suppliedTitlePunjabi : '';
  const descriptionEnglish = noticeFormat === 'text' ? suppliedDescriptionEnglish : '';
  const descriptionPunjabi = noticeFormat === 'text' ? suppliedDescriptionPunjabi : '';
  const category = String(payload.category || '').trim();
  const audience = String(payload.audience || '').trim();
  const contactPreference = String(payload.contactPreference || 'none').trim();
  const contactValue = contactPreference === 'none' ? '' : cleanText(payload.contactValue, 180);
  const publishFrom = String(payload.publishFrom || '').trim();
  const publishUntil = String(payload.publishUntil || '').trim();
  const imageUrl = noticeFormat === 'poster' ? rawImageUrl : '';
  const consent = payload.consent === true;

  if (!['text', 'poster'].includes(noticeFormat)) throw createValidationError('Choose text or full-page poster format.');
  if (noticeFormat === 'text' && !titleEnglish && !titlePunjabi) throw createValidationError('Add a title in English or Punjabi.');
  if (noticeFormat === 'text' && !descriptionEnglish && !descriptionPunjabi) throw createValidationError('Add a description in English or Punjabi.');
  if (noticeFormat === 'poster' && !imageUrl) throw createValidationError('Upload a poster image for full-page display.');
  if (!categories.includes(category)) throw createValidationError('Choose a valid announcement category.');
  if (!['sangat', 'public'].includes(audience)) throw createValidationError('Choose who the notice is for.');
  if (!CONTACT_PREFERENCES.includes(contactPreference)) throw createValidationError('Choose a valid contact preference.');
  if (contactPreference !== 'none' && !contactValue) throw createValidationError('Add the contact detail selected for this notice.');
  if (!isIsoDate(publishFrom) || !isIsoDate(publishUntil)) throw createValidationError('Choose valid start and end dates.');

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fromDate = new Date(`${publishFrom}T12:00:00`);
  const untilDate = new Date(`${publishUntil}T12:00:00`);
  const daysLive = Math.ceil((untilDate.getTime() - Math.max(today.getTime(), fromDate.getTime())) / 86400000);
  if (untilDate < fromDate || untilDate < today) throw createValidationError('The end date must be today or later and not before the start date.');
  if (daysLive > 60) throw createValidationError('Community notices can be scheduled for up to 60 days.');
  if (imageUrl && !imageUrl.startsWith('/api/uploads/community-notices/')) throw createValidationError('Upload photos using the community notice photo uploader.');
  if (!consent) throw createValidationError('Confirm that you have permission to share this notice and any included contact details or photos.');

  return {
    titleEnglish,
    titlePunjabi,
    descriptionEnglish,
    descriptionPunjabi,
    noticeFormat,
    category,
    audience,
    contactPreference,
    contactValue,
    imageUrl,
    publishFrom,
    publishUntil,
    consent,
    status: 'pending',
    featured: false,
    showContact: false,
    submitterId: String(actor.id || ''),
    submitterName: cleanText(actor.name, 120),
    publisherName: publisherName || 'Sangat member',
    submitterEmail: String(actor.email || '').trim().toLowerCase(),
    submittedAt: now.toISOString(),
    reviewedAt: '',
    reviewedBy: ''
  };
};

const isCommunityAnnouncementCurrentlyPublished = (entry, now = new Date()) => {
  if (entry?.status !== 'approved') return false;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return isIsoDate(entry.publishFrom) && isIsoDate(entry.publishUntil)
    && entry.publishFrom <= today && entry.publishUntil >= today;
};

const projectPublicCommunityAnnouncement = (entry = {}) => ({
  id: String(entry.id || ''),
  titleEnglish: cleanText(entry.titleEnglish, 100),
  titlePunjabi: cleanText(entry.titlePunjabi, 100),
  descriptionEnglish: cleanText(entry.descriptionEnglish, 1000),
  descriptionPunjabi: cleanText(entry.descriptionPunjabi, 1000),
  noticeFormat: String(entry.noticeFormat || (entry.imageUrl ? 'poster' : 'text')),
  submitterName: cleanText(entry.publisherName || entry.submitterName, 120) || 'Sangat member',
  category: String(entry.category || ''),
  audience: String(entry.audience || 'sangat'),
  imageUrl: String(entry.imageUrl || ''),
  publishFrom: String(entry.publishFrom || ''),
  publishUntil: String(entry.publishUntil || ''),
  featured: entry.featured === true,
  contactPreference: entry.showContact === true ? String(entry.contactPreference || 'none') : 'none',
  contactValue: entry.showContact === true ? cleanText(entry.contactValue, 180) : ''
});

const normalizeCommunityAnnouncementReview = (payload = {}, existing = {}, reviewer = {}, now = new Date(), categories = COMMUNITY_ANNOUNCEMENT_CATEGORIES) => {
  const allowedStatuses = ['pending', 'approved', 'rejected'];
  const status = payload.status === undefined ? existing.status : String(payload.status).trim();
  const publishFrom = payload.publishFrom === undefined ? existing.publishFrom : String(payload.publishFrom).trim();
  const publishUntil = payload.publishUntil === undefined ? existing.publishUntil : String(payload.publishUntil).trim();
  if (!allowedStatuses.includes(status)) throw createValidationError('Choose pending, approved, or rejected status.');
  if (!isIsoDate(publishFrom) || !isIsoDate(publishUntil) || publishUntil < publishFrom) {
    throw createValidationError('The published end date must be valid and not before the start date.');
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (Math.ceil((new Date(`${publishUntil}T12:00:00`).getTime() - Math.max(today.getTime(), new Date(`${publishFrom}T12:00:00`).getTime())) / 86400000) > 60) {
    throw createValidationError('Community notices can be scheduled for up to 60 days.');
  }
  const audience = payload.audience === undefined ? (existing.audience || 'sangat') : String(payload.audience).trim();
  if (!['sangat', 'public'].includes(audience)) throw createValidationError('Choose who the notice is for.');
  const noticeFormat = String(payload.noticeFormat === undefined ? (existing.noticeFormat || (existing.imageUrl ? 'poster' : 'text')) : payload.noticeFormat).trim();
  const titleEnglish = noticeFormat === 'text' ? (payload.titleEnglish === undefined ? existing.titleEnglish : cleanText(payload.titleEnglish, 100)) : '';
  const titlePunjabi = noticeFormat === 'text' ? (payload.titlePunjabi === undefined ? existing.titlePunjabi : cleanText(payload.titlePunjabi, 100)) : '';
  const descriptionEnglish = noticeFormat === 'text' ? (payload.descriptionEnglish === undefined ? existing.descriptionEnglish : cleanText(payload.descriptionEnglish, 1000)) : '';
  const descriptionPunjabi = noticeFormat === 'text' ? (payload.descriptionPunjabi === undefined ? existing.descriptionPunjabi : cleanText(payload.descriptionPunjabi, 1000)) : '';
  if (!['text', 'poster'].includes(noticeFormat)) throw createValidationError('Choose text or full-page poster format.');
  if (noticeFormat === 'text' && !titleEnglish && !titlePunjabi) throw createValidationError('At least one notice title must remain.');
  if (noticeFormat === 'text' && !descriptionEnglish && !descriptionPunjabi) throw createValidationError('At least one notice description must remain.');
  if (noticeFormat === 'poster' && !String(payload.imageUrl === undefined ? existing.imageUrl || '' : payload.imageUrl || '').trim()) throw createValidationError('Upload a poster image for full-page display.');
  const category = payload.category === undefined ? existing.category : String(payload.category).trim();
  if (!categories.includes(category)) throw createValidationError('Choose a valid announcement category.');
  const contactPreference = payload.contactPreference === undefined ? existing.contactPreference : String(payload.contactPreference).trim();
  const contactValue = contactPreference === 'none'
    ? ''
    : (payload.contactValue === undefined ? existing.contactValue : cleanText(payload.contactValue, 180));
  if (!CONTACT_PREFERENCES.includes(contactPreference)) throw createValidationError('Choose a valid contact preference.');
  if (contactPreference !== 'none' && !contactValue) throw createValidationError('A contact detail is required for the selected contact method.');
  const imageUrl = noticeFormat === 'poster' ? (payload.imageUrl === undefined ? existing.imageUrl : String(payload.imageUrl).trim()) : '';
  if (noticeFormat === 'poster' && !imageUrl) throw createValidationError('Upload a poster image for full-page display.');
  if (imageUrl && !imageUrl.startsWith('/api/uploads/community-notices/')) throw createValidationError('The photo must use an approved community notice upload.');
  return {
    ...existing,
    titleEnglish,
    titlePunjabi,
    descriptionEnglish,
    descriptionPunjabi,
    noticeFormat,
    publisherName: payload.publisherName === undefined ? cleanText(existing.publisherName || existing.submitterName, 120) : cleanText(payload.publisherName, 120),
    category,
    audience,
    contactPreference,
    contactValue,
    imageUrl,
    status,
    publishFrom,
    publishUntil,
    featured: payload.featured === undefined ? existing.featured === true : payload.featured === true,
    showContact: payload.showContact === undefined ? existing.showContact === true : payload.showContact === true,
    reviewedAt: status === 'pending' ? '' : now.toISOString(),
    reviewedBy: status === 'pending' ? '' : String(reviewer.email || '').trim().toLowerCase(),
    updatedAt: now.toISOString()
  };
};

module.exports = {
  COMMUNITY_ANNOUNCEMENT_CATEGORIES,
  CONTACT_PREFERENCES,
  isCommunityAnnouncementCurrentlyPublished,
  normalizeCommunityAnnouncementReview,
  normalizeCommunityAnnouncementSubmission,
  projectPublicCommunityAnnouncement
};
