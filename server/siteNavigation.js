const DEFAULT_SITE_NAVIGATION = [
  { label: 'Home', path: '/' },
  { label: 'About', path: '/about' },
  { label: 'Sikhism', path: '/sikhism' },
  { label: 'Events', path: '/events' },
  { label: 'Library', path: '/library' },
  { label: 'Media', path: '/media' },
  { label: 'Bookings', path: '/bookings' },
  { label: 'Seva', path: '/seva' },
  { label: 'Donation', path: '/donation' },
  { label: 'Contact', path: '/contact' }
].map((item, index) => ({ ...item, id: `nav-${index + 1}`, children: [] }));

const validNavigationPath = (value) => {
  if (typeof value !== 'string' || value.length > 1000 || /[\s\\\u0000-\u001f]/.test(value)) return false;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
};

const normalizeSiteNavigation = (items) => {
  const fail = (message) => { throw Object.assign(new Error(message), { status: 400 }); };
  if (!Array.isArray(items) || items.length < 1 || items.length > 10) fail('Provide between 1 and 10 main navigation items.');
  const ids = new Set();
  const normalizeLink = (item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) fail('Each menu item must be an object.');
    const id = String(item.id || '').trim();
    const label = String(item.label || '').trim();
    const path = String(item.path || '').trim();
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) fail('Each menu item needs a unique identifier.');
    ids.add(id);
    if (!label || label.length > 50) fail('Menu labels must have 1–50 characters.');
    if (!validNavigationPath(path)) fail('Menu links must use a site path beginning with / or a full HTTP/HTTPS URL.');
    return { id, label, path };
  };
  return items.map((item) => {
    const link = normalizeLink(item);
    const children = item.children === undefined ? [] : item.children;
    if (!Array.isArray(children) || children.length > 30) fail('Each main item can contain up to 30 submenu links.');
    return { ...link, children: children.map((child) => {
      if (child?.children?.length) fail('Submenus support one level of links.');
      return normalizeLink(child);
    }) };
  });
};

module.exports = { DEFAULT_SITE_NAVIGATION, normalizeSiteNavigation, validNavigationPath };