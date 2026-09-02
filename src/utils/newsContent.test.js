import { stripHtml, truncateHeading, truncateHtmlByWords } from './newsContent';

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

test('keeps a truncated heading within 24 characters', () => {
  const heading = truncateHeading('A community announcement that wraps');

  expect(heading).toBe('A community announcem...');
  expect(heading).toHaveLength(24);
});