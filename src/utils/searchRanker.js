const normalizeText = (value = '') => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();

const TYPE_ORDER = ['event', 'news', 'library', 'seva', 'cms', 'admin', 'other'];

const getTypeLabel = (type) => {
  if (type === 'event') return 'Events';
  if (type === 'news') return 'News';
  if (type === 'library') return 'Library';
  if (type === 'seva') return 'Seva';
  if (type === 'cms') return 'Pages';
  if (type === 'admin') return 'Admin Pages';
  return 'Other';
};

const splitTerms = (query = '') => normalizeText(query).split(' ').filter(Boolean);

const scoreFieldAgainstTerm = (fieldValue = '', term = '') => {
  const field = normalizeText(fieldValue);
  if (!field || !term) {
    return 0;
  }

  if (field.startsWith(term)) {
    return 12;
  }

  if (field.includes(` ${term}`)) {
    return 9;
  }

  if (field.includes(term)) {
    return 6;
  }

  return 0;
};

const scoreItem = (item, terms = []) => {
  const fields = [
    item.title,
    item.subtitle,
    item.body,
    ...(Array.isArray(item.keywords) ? item.keywords : [])
  ];

  const combined = normalizeText(fields.join(' '));
  if (!combined) {
    return 0;
  }

  let total = 0;
  for (const term of terms) {
    if (!combined.includes(term)) {
      return 0;
    }

    let bestForTerm = 0;
    fields.forEach((field) => {
      bestForTerm = Math.max(bestForTerm, scoreFieldAgainstTerm(field, term));
    });
    total += bestForTerm;
  }

  return total;
};

export const groupSearchResultsByType = (items = [], options = {}) => {
  const maxResults = Number(options.maxResults || 8);
  const maxPerGroup = Number(options.maxPerGroup || 3);

  const sorted = [...(Array.isArray(items) ? items : [])].sort((left, right) => {
    const rightScore = Number(right?._score ?? right?.score ?? 0);
    const leftScore = Number(left?._score ?? left?.score ?? 0);
    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    const rightStamp = new Date(right?.updatedAt || right?.publishedAt || right?.date || 0).getTime();
    const leftStamp = new Date(left?.updatedAt || left?.publishedAt || left?.date || 0).getTime();
    return rightStamp - leftStamp;
  });

  const groups = new Map();
  sorted.forEach((item) => {
    const key = item.type || 'other';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    const current = groups.get(key);
    if (current.length < maxPerGroup) {
      current.push(item);
    }
  });

  const groupedResults = TYPE_ORDER
    .map((type) => {
      const entries = groups.get(type) || [];
      if (entries.length === 0) {
        return null;
      }
      return {
        type,
        label: getTypeLabel(type),
        items: entries
      };
    })
    .filter(Boolean);

  const flatResults = groupedResults.flatMap((group) => group.items).slice(0, maxResults);

  return {
    groupedResults,
    flatResults,
    total: sorted.length
  };
};

export const performGlobalSearch = (items = [], query = '', options = {}) => {
  const terms = splitTerms(query);
  if (terms.length === 0) {
    return {
      groupedResults: [],
      flatResults: [],
      total: 0
    };
  }

  const maxResults = Number(options.maxResults || 8);
  const maxPerGroup = Number(options.maxPerGroup || 3);

  const scored = (Array.isArray(items) ? items : [])
    .map((item) => {
      const score = scoreItem(item, terms);
      return score > 0 ? { ...item, _score: score } : null;
    })
    .filter(Boolean)
    .sort((left, right) => {
      if (right._score !== left._score) {
        return right._score - left._score;
      }

      const rightStamp = new Date(right.updatedAt || right.publishedAt || right.date || 0).getTime();
      const leftStamp = new Date(left.updatedAt || left.publishedAt || left.date || 0).getTime();
      return rightStamp - leftStamp;
    });

  return groupSearchResultsByType(scored, { maxResults, maxPerGroup });
};
