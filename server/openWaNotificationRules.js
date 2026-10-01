const crypto = require('crypto');

const stableJson = (value) => JSON.stringify(value ?? null);
const hashValue = (value) => crypto.createHash('sha256').update(stableJson(value)).digest('hex');

const newsIsPublic = (article, now = Date.now()) => {
  if (!article || article.active === false || article.active === 0 || String(article.active).toLowerCase() === 'false') return false;
  const publishedAt = new Date(article.publishedAt || '').getTime();
  if (!Number.isFinite(publishedAt) || publishedAt > now) return false;
  if (!article.expiryDate) return true;
  const expiry = new Date(article.expiryDate).getTime();
  if (!Number.isFinite(expiry)) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(String(article.expiryDate))
    ? new Date(`${article.expiryDate}T23:59:59.999`).getTime() >= now
    : expiry >= now;
};

const torontoDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};

const stripVolatile = (value) => {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['updatedAt', 'lastModifiedAt'].includes(key))
    .map(([key, nested]) => [key, stripVolatile(nested)]));
};

const getLangarMaterialChanges = (previousItems = [], nextItems = []) => {
  const previousById = new Map(previousItems.map((item) => [String(item?.id || ''), item]));
  const nextById = new Map(nextItems.map((item) => [String(item?.id || ''), item]));
  const added = nextItems.filter((item) => item?.id && !previousById.has(String(item.id)));
  const fields = ['name', 'category', 'needed', 'quantityRequired', 'unit', 'imageUrl', 'expiryDate', 'description'];
  const updated = nextItems.filter((item) => {
    const previous = previousById.get(String(item?.id || ''));
    return item?.id && previous && fields.some((field) => item[field] !== previous[field]);
  });
  const removed = previousItems.filter((item) => item?.id && !nextById.has(String(item.id)));
  return { added, updated, removed };
};

module.exports = { stableJson, hashValue, newsIsPublic, torontoDateKey, stripVolatile, getLangarMaterialChanges };