export const stripHtml = (value) => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const truncateHeading = (value, maxLength = 24) => {
  const heading = String(value || '').trim();
  if (heading.length <= maxLength) {
    return heading;
  }

  return `${heading.slice(0, Math.max(0, maxLength - 3)).trimEnd()}...`;
};

export const truncateHtmlByWords = (value, maxWords = 150) => {
  const html = String(value || '').trim();
  const words = stripHtml(html).match(/\S+/g) || [];
  if (!html || words.length <= maxWords || typeof document === 'undefined') {
    return html;
  }

  const source = document.createElement('div');
  const result = document.createElement('div');
  source.innerHTML = html;
  let remainingWords = maxWords;

  const copyNode = (node) => {
    if (remainingWords <= 0) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      const tokens = String(node.textContent || '').match(/\S+\s*/g) || [];
      if (tokens.length === 0) {
        return node.cloneNode();
      }

      const selectedTokens = tokens.slice(0, remainingWords);
      remainingWords -= selectedTokens.length;
      const suffix = remainingWords === 0 ? '...' : '';
      return document.createTextNode(`${selectedTokens.join('').trimEnd()}${suffix}`);
    }

    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }

    const copy = node.cloneNode(false);
    Array.from(node.childNodes).some((child) => {
      const childCopy = copyNode(child);
      if (childCopy) {
        copy.appendChild(childCopy);
      }
      return remainingWords <= 0;
    });
    return copy;
  };

  Array.from(source.childNodes).some((node) => {
    const copy = copyNode(node);
    if (copy) {
      result.appendChild(copy);
    }
    return remainingWords <= 0;
  });

  return result.innerHTML;
};