const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_SITE_NAVIGATION, normalizeSiteNavigation, validNavigationPath } = require('./siteNavigation');

test('keeps the existing ten main menu items by default', () => {
  assert.equal(normalizeSiteNavigation(DEFAULT_SITE_NAVIGATION).length, 10);
});

test('supports renamed parents and links underneath any item', () => {
  const items = [{ id: 'services', label: 'Services offered', path: '/bookings', children: [{ id: 'seva', label: 'Seva bookings', path: '/bookings' }] }];
  assert.deepEqual(normalizeSiteNavigation(items), items);
});

test('enforces menu count and unique IDs', () => {
  assert.throws(() => normalizeSiteNavigation([...DEFAULT_SITE_NAVIGATION, { id: 'extra', label: 'Extra', path: '/' }]), /10/);
  assert.throws(() => normalizeSiteNavigation([]), /10/);
  assert.throws(() => normalizeSiteNavigation([DEFAULT_SITE_NAVIGATION[0], DEFAULT_SITE_NAVIGATION[0]]), /unique/);
});

test('rejects unsafe URLs and accepts internal routes or HTTPS links', () => {
  ['javascript:alert(1)', '//evil.com', '/\\evil.com', 'data:text/html,test', '/\nevil'].forEach((path) => assert.equal(validNavigationPath(path), false));
  ['/bookings', '/events?type=programs', 'https://example.com/programs'].forEach((path) => assert.equal(validNavigationPath(path), true));
  assert.throws(() => normalizeSiteNavigation([{ id: 'bad', label: 'Bad', path: 'javascript:alert(1)' }]), /HTTP/);
});