import { stripHtml, truncateHeading, truncateHtmlByCharacters, truncateHtmlByWords } from './newsContent';

test('preserves article markup while limiting the visible excerpt by words', () => {
  const article = '<p>One <strong>two three</strong> <a href="https://example.com">four five</a> six</p>';
  const excerpt = truncateHtmlByWords(article, 5);

  expect(excerpt).toContain('<strong>two three</strong>');
  expect(excerpt).toContain('<a href="https://example.com">four five...</a>');
  expect(stripHtml(excerpt)).toBe('One two three four five...');
  expect(excerpt).not.toContain('six');
});

test('returns short article markup unchanged', () => {
  expect(truncateHtmlByWords('<h2>Short update</h2>', 150)).toBe('<h2>Short update</h2>');
});

test('keeps a truncated heading within 40 characters', () => {
  const heading = truncateHeading('A community announcement that should remain on one line', 40);

  expect(heading).toBe('A community announcement that should...');
  expect(heading.length).toBeLessThanOrEqual(40);
});

test('preserves markup while limiting an excerpt to 80 visible characters', () => {
  const article = `<p>Read our <a href="https://example.com">important community announcement</a> ${'and more details '.repeat(8)}</p>`;
  const excerpt = truncateHtmlByCharacters(article, 80);

  expect(excerpt).toContain('<a href="https://example.com">important community announcement</a>');
  expect(stripHtml(excerpt)).toHaveLength(80);
  expect(stripHtml(excerpt)).toMatch(/\.\.\.$/);
});