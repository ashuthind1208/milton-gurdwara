import { mockResponse } from './mockApi';

const SETTINGS_KEY = 'ssm-hukamnama-settings';
const CACHE_KEY = 'ssm-hukamnama-cache';
const HISTORY_KEY = 'ssm-hukamnama-history';
const ENTRIES_KEY = 'ssm-hukamnama-entries';
const DAILY_MUKHWAK_AUDIO = 'https://hs.sgpc.net/uploadhukamnama/hukamnama.mp3';

const isUnavailable = (value) => !value || value === 'Not available' || value === 'Not available from source API';

const readTextValue = (value) => {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (!value || typeof value !== 'object') {
    return '';
  }

  const directKeys = ['unicode', 'akhar', 'default', 'text', 'value', 'english', 'punjabi'];
  for (const key of directKeys) {
    const candidate = value[key];
    if (typeof candidate === 'string' || typeof candidate === 'number') {
      return String(candidate);
    }
  }

  const nestedKeys = ['english', 'punjabi', 'translation', 'gurmukhi', 'transliteration'];
  for (const key of nestedKeys) {
    const candidate = readTextValue(value[key]);
    if (candidate) {
      return candidate;
    }
  }

  return '';
};

const normalizeLine = (line = {}, index = 0) => ({
  id: line.id || `line-${index}`,
  lineNo: Number(line.lineNo) || Number(line.lineno) || index + 1,
  gurmukhi: readTextValue(line.gurmukhi) || readTextValue(line.gurmukhiUnicode) || '',
  translationEnglish: readTextValue(line.translationEnglish) || readTextValue(line.translation) || '',
  translationPunjabi: readTextValue(line.translationPunjabi) || readTextValue(line.translationPunjabiDefault) || '',
  transliteration: readTextValue(line.transliteration) || ''
});

const normalizeMetadata = (metadata = {}, lineSamples = []) => {
  const normalized = {
    source: readTextValue(metadata.source) || '',
    sourcePunjabi: readTextValue(metadata.sourcePunjabi) || '',
    raag: readTextValue(metadata.raag) || readTextValue(lineSamples[0]?.raag) || '',
    writer: readTextValue(metadata.writer) || readTextValue(lineSamples[0]?.writer) || '',
    totalLines: metadata.totalLines || lineSamples.length || 0,
    pageName: readTextValue(metadata.pageName) || 'Ang',
    placeOfWriting: readTextValue(metadata.placeOfWriting) || ''
  };

  return Object.fromEntries(Object.entries(normalized).filter(([, value]) => !isUnavailable(value)));
};

const normalizeEntry = (entry) => {
  const normalizedLines = (entry.lines || []).map((line, index) => normalizeLine(line, index));
  return {
    ...entry,
    lines: normalizedLines,
    metadata: normalizeMetadata(entry.metadata || {}, normalizedLines)
  };
};

const fallbackEntry = {
  ang: 1,
  source: 'Sri Guru Granth Sahib Ji',
  metadata: {
    source: 'Sri Guru Granth Sahib Ji',
    raag: 'Not available',
    writer: 'Not available',
    totalLines: 1,
    placeOfWriting: 'Not available from source API'
  },
  updatedAt: '2026-07-07T00:00:00.000Z',
  audioUrl: DAILY_MUKHWAK_AUDIO,
  lines: [
    {
      id: 'fallback-1',
      lineNo: 1,
      gurmukhi: 'ੴ ਸਤਿ ਨਾਮੁ ਕਰਤਾ ਪੁਰਖੁ ਨਿਰਭਉ ਨਿਰਵੈਰੁ ਅਕਾਲ ਮੂਰਤਿ ਅਜੂਨੀ ਸੈਭੰ ਗੁਰ ਪ੍ਰਸਾਦਿ ॥',
      translationEnglish: 'One Universal Creator God. The Name Is Truth. Creative Being Personified. No Fear. No Hatred. By Guru\'s Grace.',
      translationPunjabi: '',
      transliteration: ''
    }
  ]
};

const readJson = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const toDateKey = (value = new Date()) => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeSlot = (slot) => (String(slot || '').toLowerCase() === 'evening' ? 'evening' : 'morning');

const readSettings = () => readJson(SETTINGS_KEY, {
  ang: fallbackEntry.ang,
  source: fallbackEntry.source,
  metadata: fallbackEntry.metadata,
  lines: fallbackEntry.lines,
  audioUrl: DAILY_MUKHWAK_AUDIO,
  updatedAt: fallbackEntry.updatedAt
});

const normalizeScheduledEntry = (entry, fallbackDate, fallbackSlot) => {
  const base = normalizeEntry(entry || {});
  return {
    ...base,
    ang: Math.max(1, Number(entry?.ang || base.ang || fallbackEntry.ang)),
    date: toDateKey(entry?.date || fallbackDate || new Date()),
    slot: normalizeSlot(entry?.slot || fallbackSlot),
    audioUrl: entry?.audioUrl || base.audioUrl || DAILY_MUKHWAK_AUDIO,
    updatedAt: entry?.updatedAt || base.updatedAt || new Date().toISOString()
  };
};

const readScheduledEntries = () => {
  const raw = readJson(ENTRIES_KEY, {});
  return Object.entries(raw || {}).reduce((acc, [date, slots]) => {
    const normalizedDate = toDateKey(date);
    const morning = slots?.morning ? normalizeScheduledEntry(slots.morning, normalizedDate, 'morning') : null;
    const evening = slots?.evening ? normalizeScheduledEntry(slots.evening, normalizedDate, 'evening') : null;
    if (morning || evening) {
      acc[normalizedDate] = { morning, evening };
    }
    return acc;
  }, {});
};

const writeScheduledEntries = (entries) => {
  writeJson(ENTRIES_KEY, entries);
};

const transformAngResponse = (data, ang) => ({
  ang,
  source: readTextValue(data.source?.english) || 'Sri Guru Granth Sahib Ji',
  metadata: normalizeMetadata({
    source: readTextValue(data.source?.english) || 'Sri Guru Granth Sahib Ji',
    sourcePunjabi: readTextValue(data.source?.unicode) || '',
    raag: readTextValue(data.page?.[0]?.line?.raag?.english) || '',
    writer: readTextValue(data.page?.[0]?.line?.writer?.english) || '',
    totalLines: data.count || (data.page || []).length,
    pageName: readTextValue(data.source?.pageName?.english) || 'Ang',
    placeOfWriting: ''
  }),
  updatedAt: new Date().toISOString(),
  audioUrl: DAILY_MUKHWAK_AUDIO,
  lines: (data.page || []).map((entry, index) => normalizeLine({
    id: entry.line?.id || `line-${index}`,
    lineNo: Number(entry.line?.lineno) || index + 1,
    gurmukhi: entry.line?.gurmukhi?.unicode || '',
    translationEnglish: entry.line?.translation?.english?.default || '',
    translationPunjabi: entry.line?.translation?.punjabi?.default || '',
    transliteration: entry.line?.transliteration?.english?.default || ''
  }, index))
});

const fetchAngData = async (ang) => {
  const cache = readJson(CACHE_KEY, {});
  if (cache[ang]) {
    return { ...normalizeEntry(cache[ang]), isFallback: false };
  }

  const tryFetch = async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${url}`);
    }
    return response.json();
  };

  const directUrl = `https://api.gurbaninow.com/v2/ang/${ang}`;
  const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(directUrl)}`;

  try {
    let payload;
    try {
      payload = await tryFetch(directUrl);
    } catch {
      payload = await tryFetch(proxyUrl);
    }

    const transformed = normalizeEntry(transformAngResponse(payload, ang));
    writeJson(CACHE_KEY, { ...cache, [ang]: transformed });
    return { ...transformed, isFallback: false };
  } catch {
    return { ...normalizeEntry(cache[ang] || { ...fallbackEntry, ang }), isFallback: true };
  }
};

const writeHistory = (entry) => {
  const history = readJson(HISTORY_KEY, []);
  const filtered = history.filter((item) => !(item.date === entry.date && item.slot === entry.slot));
  const nextHistory = [entry, ...filtered].slice(0, 120);
  writeJson(HISTORY_KEY, nextHistory);
};

const hukamnamaService = {
  getAngPreview: async (ang) => {
    const safeAng = Math.max(1, Number(ang) || 1);
    const angData = await fetchAngData(safeAng);

    if (angData.isFallback || !angData.lines?.length) {
      throw new Error('Unable to fetch hukamnama lines for this ang at the moment. Please try again.');
    }

    return mockResponse({
      ...angData,
      ang: safeAng
    });
  },
  getDailyHukamnama: async (dateValue) => {
    const date = toDateKey(dateValue || new Date());
    const entries = readScheduledEntries();
    return mockResponse({
      date,
      morning: entries[date]?.morning || null,
      evening: entries[date]?.evening || null
    });
  },
  getCurrentHukamnama: async () => {
    const today = toDateKey(new Date());
    const entries = readScheduledEntries();
    const todayEntry = entries[today]?.morning || entries[today]?.evening;
    if (todayEntry) {
      return mockResponse(todayEntry);
    }

    const settings = normalizeEntry(readSettings());
    const angData = await fetchAngData(settings.ang);

    if (!angData.isFallback) {
      const nextSettings = {
        ...settings,
        source: angData.source,
        metadata: angData.metadata,
        lines: angData.lines,
        updatedAt: settings.updatedAt || new Date().toISOString()
      };
      writeJson(SETTINGS_KEY, normalizeEntry(nextSettings));
      return mockResponse({ ...nextSettings, ang: settings.ang, audioUrl: settings.audioUrl || DAILY_MUKHWAK_AUDIO });
    }

    if (settings.lines?.length) {
      return mockResponse({ ...settings, audioUrl: settings.audioUrl || DAILY_MUKHWAK_AUDIO });
    }

    return mockResponse({ ...fallbackEntry, ang: settings.ang, audioUrl: settings.audioUrl || DAILY_MUKHWAK_AUDIO });
  },
  setScheduledHukamnama: async ({ ang, date, slot }) => {
    const safeAng = Math.max(1, Number(ang) || 1);
    const dateKey = toDateKey(date || new Date());
    const normalizedSlot = normalizeSlot(slot);
    const entries = readScheduledEntries();

    if (entries[dateKey]?.[normalizedSlot]) {
      throw new Error(`Hukamnama for ${dateKey} (${normalizedSlot}) is already set.`);
    }

    const angData = await fetchAngData(safeAng);
    if (angData.isFallback || !angData.lines?.length) {
      throw new Error('Unable to fetch hukamnama lines for this ang at the moment. Please try again.');
    }

    const nextEntry = normalizeScheduledEntry({
      ...angData,
      ang: safeAng,
      date: dateKey,
      slot: normalizedSlot,
      updatedAt: new Date().toISOString(),
      audioUrl: DAILY_MUKHWAK_AUDIO
    }, dateKey, normalizedSlot);

    const nextEntries = {
      ...entries,
      [dateKey]: {
        morning: entries[dateKey]?.morning || null,
        evening: entries[dateKey]?.evening || null,
        [normalizedSlot]: nextEntry
      }
    };

    writeScheduledEntries(nextEntries);

    if (dateKey === toDateKey(new Date())) {
      writeJson(SETTINGS_KEY, normalizeEntry(nextEntry));
    }

    writeHistory({
      ang: safeAng,
      date: dateKey,
      slot: normalizedSlot,
      updatedAt: nextEntry.updatedAt,
      preview: nextEntry.lines[0]?.gurmukhi || '',
      translation: nextEntry.lines[0]?.translationEnglish || '',
      raag: nextEntry.metadata?.raag || '',
      writer: nextEntry.metadata?.writer || ''
    });

    return mockResponse(nextEntry);
  },
  setCurrentAng: async (ang) => {
    return hukamnamaService.setScheduledHukamnama({ ang, date: toDateKey(new Date()), slot: 'morning' });
  },
  getArchiveByDate: async (dateValue) => {
    const date = toDateKey(dateValue || new Date());
    const entries = readScheduledEntries();
    return mockResponse({
      date,
      morning: entries[date]?.morning || null,
      evening: entries[date]?.evening || null
    });
  },
  getArchiveCalendar: async () => {
    const entries = readScheduledEntries();
    const payload = Object.entries(entries).map(([date, slots]) => ({
      date,
      hasMorning: Boolean(slots?.morning),
      hasEvening: Boolean(slots?.evening),
      angs: [slots?.morning?.ang, slots?.evening?.ang].filter(Boolean)
    }));
    return mockResponse(payload);
  },
  getArchive: async () => {
    const entries = readScheduledEntries();
    const flattened = Object.values(entries)
      .flatMap((day) => [day?.morning, day?.evening])
      .filter(Boolean)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((entry) => ({
        ang: entry.ang,
        date: entry.date,
        slot: entry.slot,
        updatedAt: entry.updatedAt,
        preview: entry.lines?.[0]?.gurmukhi || '',
        translation: entry.lines?.[0]?.translationEnglish || '',
        raag: entry.metadata?.raag || '',
        writer: entry.metadata?.writer || ''
      }));

    if (flattened.length > 0) {
      return mockResponse(flattened);
    }

    return mockResponse(readJson(HISTORY_KEY, []));
  }
};

export default hukamnamaService;