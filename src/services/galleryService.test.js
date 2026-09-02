import { normalizeUrl } from './galleryService';

test('preserves root-relative gallery upload URLs', () => {
  expect(normalizeUrl('/api/uploads/gallery/2026/09/cover.png'))
    .toBe('/api/uploads/gallery/2026/09/cover.png');
});

test('adds https to external gallery URLs without a protocol', () => {
  expect(normalizeUrl('drive.google.com/drive/folders/example'))
    .toBe('https://drive.google.com/drive/folders/example');
});