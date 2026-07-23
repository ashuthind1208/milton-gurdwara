import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const SETTINGS_KEY = 'ssm-hukamnama-settings';
const CACHE_KEY = 'ssm-hukamnama-cache';
const HISTORY_KEY = 'ssm-hukamnama-history';
const ENTRIES_KEY = 'ssm-hukamnama-entries';
const DAILY_MUKHWAK_AUDIO = 'https://hs.sgpc.net/uploadhukamnama/hukamnama.mp3';
const RESOURCE_PREFIX = 'hukamnama';
const DEFAULT_READ_ALONG_EXACT_BASE = 'https://backend.searchgurbani.com/storage/audio/sggs-gms';
const DEFAULT_READ_ALONG_ARCHIVE_ITEM = 'ang-0001-0013';
const DEFAULT_READ_ALONG_BASE_URL = `https://archive.org/download/${DEFAULT_READ_ALONG_ARCHIVE_ITEM}`;
const DEFAULT_READ_ALONG_METADATA_URL = `https://archive.org/metadata/${DEFAULT_READ_ALONG_ARCHIVE_ITEM}`;
const DEFAULT_READ_ALONG_MAP_URL = 'https://gurbaniprakash.org/assets/data/sggs_audio_map.json';
const parseEnvBoolean = (value, fallback = true) => {
  if (typeof value !== 'string') {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
};
const READ_ALONG_ENABLED = parseEnvBoolean(process.env.REACT_APP_HUKAMNAMA_READ_ALONG_ENABLED, true);
const READ_ALONG_EXACT_BASE_URL = String(process.env.REACT_APP_HUKAMNAMA_READ_ALONG_EXACT_BASE_URL || DEFAULT_READ_ALONG_EXACT_BASE).trim().replace(/\/$/, '');
const READ_ALONG_BASE_URL = String(process.env.REACT_APP_HUKAMNAMA_READ_ALONG_BASE_URL || DEFAULT_READ_ALONG_BASE_URL).trim();
const READ_ALONG_METADATA_URL = String(process.env.REACT_APP_HUKAMNAMA_READ_ALONG_METADATA_URL || DEFAULT_READ_ALONG_METADATA_URL).trim();
const READ_ALONG_MAP_URL = String(process.env.REACT_APP_HUKAMNAMA_READ_ALONG_MAP_URL || DEFAULT_READ_ALONG_MAP_URL).trim();
const READ_ALONG_CACHE_KEY = 'ssm-hukamnama-read-along-cache-v3';
const READ_ALONG_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
let readAlongRangesCache = null;

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

const toResourceName = (key) => `${RESOURCE_PREFIX}_${String(key || '').toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

const readJson = async (key, fallback) => {
  try {
    const payload = await contentApiService.getSingleton(toResourceName(key), null);
    return payload ?? fallback;
  } catch {
    return fallback;
  }
};

const writeJson = async (key, value) => {
  await contentApiService.setSingleton(toResourceName(key), value);
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

const parseReadAlongRanges = (files = []) => {
  return (Array.isArray(files) ? files : [])
    .map((file) => ({
      name: String(file?.name || '').trim(),
      lengthSeconds: Number(file?.length) || 0
    }))
    .map(({ name, lengthSeconds }) => {
      const match = name.match(/^Ang-(\d{4})-(\d{4})\.mp3$/i);
      if (!match) {
        return null;
      }

      const start = Number(match[1]);
      const end = Number(match[2]);
      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }

      return { name, start, end, lengthSeconds };
    })
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);
};

const parseReadAlongMapRanges = (entries = []) => {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const name = String(entry?.audio_file || '').trim();
      const start = Number(entry?.start_page);
      const end = Number(entry?.end_page);
      const startLine = Number(entry?.start_line) || 1;
      const endLine = Number(entry?.end_line) || 35;
      if (!name || !Number.isFinite(start) || !Number.isFinite(end)) {
        return null;
      }

      return {
        name,
        start,
        end,
        startLine,
        endLine,
        lengthSeconds: 0
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.start - right.start);
};

const readReadAlongCache = () => {
  try {
    const raw = localStorage.getItem(READ_ALONG_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.ranges) || !Number.isFinite(parsed.updatedAt)) {
      return null;
    }

    if ((Date.now() - parsed.updatedAt) > READ_ALONG_CACHE_TTL_MS) {
      return null;
    }

    return parsed.ranges;
  } catch {
    return null;
  }
};

const writeReadAlongCache = (ranges) => {
  try {
    localStorage.setItem(READ_ALONG_CACHE_KEY, JSON.stringify({
      updatedAt: Date.now(),
      ranges
    }));
  } catch {
    // Ignore cache write failures.
  }
};

const getReadAlongRanges = async () => {
  if (!READ_ALONG_ENABLED || (!READ_ALONG_MAP_URL && !READ_ALONG_METADATA_URL)) {
    return [];
  }

  if (Array.isArray(readAlongRangesCache) && readAlongRangesCache.length > 0) {
    return readAlongRangesCache;
  }

  const cachedRanges = readReadAlongCache();
  if (Array.isArray(cachedRanges) && cachedRanges.length > 0) {
    readAlongRangesCache = cachedRanges;
    return cachedRanges;
  }

  try {
    const [mapRanges, metadataRanges] = await Promise.all([
      (async () => {
        if (!READ_ALONG_MAP_URL) {
          return [];
        }

        try {
          const response = await fetch(READ_ALONG_MAP_URL);
          if (!response.ok) {
            return [];
          }

          const payload = await response.json();
          return parseReadAlongMapRanges(payload);
        } catch {
          return [];
        }
      })(),
      (async () => {
        if (!READ_ALONG_METADATA_URL) {
          return [];
        }

        try {
          const response = await fetch(READ_ALONG_METADATA_URL);
          if (!response.ok) {
            return [];
          }

          const payload = await response.json();
          return parseReadAlongRanges(payload?.files || []);
        } catch {
          return [];
        }
      })()
    ]);

    const metadataByName = new Map(metadataRanges.map((item) => [item.name, item]));
    const ranges = (mapRanges.length > 0 ? mapRanges : metadataRanges)
      .map((item) => {
        const metadataItem = metadataByName.get(item.name);
        return {
          ...item,
          lengthSeconds: Number(metadataItem?.lengthSeconds || item.lengthSeconds || 0)
        };
      })
      .sort((left, right) => left.start - right.start);

    if (ranges.length > 0) {
      readAlongRangesCache = ranges;
      writeReadAlongCache(ranges);
    }

    return ranges;
  } catch {
    return [];
  }
};

const resolveReadAlongAudio = (ang, ranges = []) => {
  if (!READ_ALONG_BASE_URL) {
    return {
      url: '',
      rangeStart: 0,
      rangeEnd: 0,
      startAtSeconds: 0
    };
  }

  const safeAng = Math.max(1, Number(ang) || 1);
  const matches = (Array.isArray(ranges) ? ranges : []).filter((entry) => safeAng >= entry.start && safeAng <= entry.end);
  if (!matches.length) {
    return {
      url: '',
      rangeStart: 0,
      rangeEnd: 0,
      startAtSeconds: 0
    };
  }

  const match = matches.sort((left, right) => {
    const leftSpan = (left.end - left.start) || Number.MAX_SAFE_INTEGER;
    const rightSpan = (right.end - right.start) || Number.MAX_SAFE_INTEGER;
    if (leftSpan !== rightSpan) {
      return leftSpan - rightSpan;
    }
    return left.start - right.start;
  })[0];

  const spanCount = Math.max(1, (match.end - match.start) + 1);
  const rawStep = (Number(match.lengthSeconds) || 0) / spanCount;
  const stepSeconds = Number.isFinite(rawStep) && rawStep > 0 ? rawStep : 0;
  const offsetIndex = Math.max(0, safeAng - match.start);
  const startAtSeconds = stepSeconds > 0 ? Math.floor(offsetIndex * stepSeconds) : 0;

  return {
    url: `${READ_ALONG_BASE_URL}/${encodeURIComponent(match.name)}`,
    rangeStart: match.start,
    rangeEnd: match.end,
    startAtSeconds
  };
};

// Keep legacy resolver helpers available for rapid rollback without triggering lint warnings.
void getReadAlongRanges;
void resolveReadAlongAudio;

const readSettings = async () => readJson(SETTINGS_KEY, {
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

const resolveDailyEntry = (slots) => slots?.morning || slots?.evening || null;

const readScheduledEntries = async () => {
  const raw = await readJson(ENTRIES_KEY, {});
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

const writeScheduledEntries = async (entries) => {
  await writeJson(ENTRIES_KEY, entries);
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
  const cache = await readJson(CACHE_KEY, {});
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
    await writeJson(CACHE_KEY, { ...cache, [ang]: transformed });
    return { ...transformed, isFallback: false };
  } catch {
    return { ...normalizeEntry(cache[ang] || { ...fallbackEntry, ang }), isFallback: true };
  }
};

const writeHistory = async (entry) => {
  const history = await readJson(HISTORY_KEY, []);
  const filtered = history.filter((item) => !(item.date === entry.date && item.slot === entry.slot));
  const nextHistory = [entry, ...filtered].slice(0, 120);
  await writeJson(HISTORY_KEY, nextHistory);
};

const removeHistoryEntry = async (date, slot = 'morning') => {
  const history = await readJson(HISTORY_KEY, []);
  const nextHistory = history.filter((item) => !(item.date === date && item.slot === slot));
  await writeJson(HISTORY_KEY, nextHistory);
};

const runHistoryWriteSafely = async (action) => {
  try {
    await action();
  } catch (error) {
    // History is only a secondary log and should not fail primary hukamnama operations.
    console.warn('[hukamnamaService] History sync skipped after primary save.', error);
  }
};

const hukamnamaService = {
  getReadAlongConfig: () => ({
    enabled: READ_ALONG_ENABLED,
    source: READ_ALONG_EXACT_BASE_URL,
    metadataUrl: READ_ALONG_METADATA_URL,
    mapUrl: READ_ALONG_MAP_URL
  }),
  getAngPreview: async (ang) => {
    const safeAng = Math.max(1, Number(ang) || 1);
    const angData = await fetchAngData(safeAng);

    if (angData.isFallback || !angData.lines?.length) {
      throw new Error('Unable to fetch hukamnama lines for this ang at the moment. Please try again.');
    }

    return serviceResponse({
      ...angData,
      ang: safeAng
    });
  },
  getDailyHukamnama: async (dateValue) => {
    const date = toDateKey(dateValue || new Date());
    const entries = await readScheduledEntries();
    const entry = resolveDailyEntry(entries[date]);
    return serviceResponse({
      date,
      entry,
      morning: entries[date]?.morning || null,
      evening: entries[date]?.evening || null
    });
  },
  getCurrentHukamnama: async () => {
    const today = toDateKey(new Date());
    const entries = await readScheduledEntries();
    const todayEntry = entries[today]?.morning || entries[today]?.evening;
    if (todayEntry) {
      return serviceResponse(todayEntry);
    }

    const settings = normalizeEntry(await readSettings());
    const angData = await fetchAngData(settings.ang);

    if (!angData.isFallback) {
      const nextSettings = {
        ...settings,
        source: angData.source,
        metadata: angData.metadata,
        lines: angData.lines,
        updatedAt: settings.updatedAt || new Date().toISOString()
      };
      await writeJson(SETTINGS_KEY, normalizeEntry(nextSettings));
      return serviceResponse({ ...nextSettings, ang: settings.ang, audioUrl: settings.audioUrl || DAILY_MUKHWAK_AUDIO });
    }

    if (settings.lines?.length) {
      return serviceResponse({ ...settings, audioUrl: settings.audioUrl || DAILY_MUKHWAK_AUDIO });
    }

    return serviceResponse({ ...fallbackEntry, ang: settings.ang, audioUrl: settings.audioUrl || DAILY_MUKHWAK_AUDIO });
  },
  setScheduledHukamnama: async ({ ang, date, slot }) => {
    const safeAng = Math.max(1, Number(ang) || 1);
    const dateKey = toDateKey(date || new Date());
    const normalizedSlot = normalizeSlot(slot);
    const entries = await readScheduledEntries();

    if (resolveDailyEntry(entries[dateKey])) {
      throw new Error(`Hukamnama for ${dateKey} is already set.`);
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

    await writeScheduledEntries(nextEntries);

    if (dateKey === toDateKey(new Date())) {
      await writeJson(SETTINGS_KEY, normalizeEntry(nextEntry));
    }

    await runHistoryWriteSafely(() => writeHistory({
      ang: safeAng,
      date: dateKey,
      slot: normalizedSlot,
      updatedAt: nextEntry.updatedAt,
      preview: nextEntry.lines[0]?.gurmukhi || '',
      translation: nextEntry.lines[0]?.translationEnglish || '',
      raag: nextEntry.metadata?.raag || '',
      writer: nextEntry.metadata?.writer || ''
    }));

    return serviceResponse(nextEntry);
  },
  setCurrentAng: async (ang) => {
    return hukamnamaService.setScheduledHukamnama({ ang, date: toDateKey(new Date()), slot: 'morning' });
  },
  updateScheduledHukamnama: async ({ ang, date }) => {
    const safeAng = Math.max(1, Number(ang) || 1);
    const dateKey = toDateKey(date || new Date());
    const entries = await readScheduledEntries();
    const existingEntry = resolveDailyEntry(entries[dateKey]);

    if (!existingEntry) {
      throw new Error(`No hukamnama found for ${dateKey}.`);
    }

    const angData = await fetchAngData(safeAng);
    if (angData.isFallback || !angData.lines?.length) {
      throw new Error('Unable to fetch hukamnama lines for this ang at the moment. Please try again.');
    }

    const updatedEntry = normalizeScheduledEntry({
      ...angData,
      ang: safeAng,
      date: dateKey,
      slot: existingEntry.slot || 'morning',
      updatedAt: new Date().toISOString(),
      audioUrl: DAILY_MUKHWAK_AUDIO
    }, dateKey, existingEntry.slot || 'morning');

    const nextEntries = {
      ...entries,
      [dateKey]: {
        morning: updatedEntry.slot === 'evening' ? null : updatedEntry,
        evening: updatedEntry.slot === 'evening' ? updatedEntry : null
      }
    };

    await writeScheduledEntries(nextEntries);

    if (dateKey === toDateKey(new Date())) {
      await writeJson(SETTINGS_KEY, normalizeEntry(updatedEntry));
    }

    await runHistoryWriteSafely(() => writeHistory({
      ang: safeAng,
      date: dateKey,
      slot: updatedEntry.slot || 'morning',
      updatedAt: updatedEntry.updatedAt,
      preview: updatedEntry.lines[0]?.gurmukhi || '',
      translation: updatedEntry.lines[0]?.translationEnglish || '',
      raag: updatedEntry.metadata?.raag || '',
      writer: updatedEntry.metadata?.writer || ''
    }));

    return serviceResponse(updatedEntry);
  },
  deleteScheduledHukamnama: async (dateValue) => {
    const dateKey = toDateKey(dateValue || new Date());
    const entries = await readScheduledEntries();
    const existingEntry = resolveDailyEntry(entries[dateKey]);

    if (!existingEntry) {
      throw new Error(`No hukamnama found for ${dateKey}.`);
    }

    const nextEntries = { ...entries };
    delete nextEntries[dateKey];
    await writeScheduledEntries(nextEntries);
    await runHistoryWriteSafely(() => removeHistoryEntry(dateKey, existingEntry.slot || 'morning'));

    return serviceResponse({ success: true, date: dateKey });
  },
  getArchiveByDate: async (dateValue) => {
    const date = toDateKey(dateValue || new Date());
    const entries = await readScheduledEntries();
    return serviceResponse({
      date,
      entry: resolveDailyEntry(entries[date]),
      morning: entries[date]?.morning || null,
      evening: entries[date]?.evening || null
    });
  },
  getArchiveCalendar: async () => {
    const entries = await readScheduledEntries();
    const payload = Object.entries(entries).map(([date, slots]) => ({
      date,
      hasEntry: Boolean(resolveDailyEntry(slots)),
      hasMorning: Boolean(slots?.morning),
      hasEvening: Boolean(slots?.evening),
      angs: [slots?.morning?.ang, slots?.evening?.ang].filter(Boolean),
      ang: resolveDailyEntry(slots)?.ang || null
    }));
    return serviceResponse(payload);
  },
  getArchive: async () => {
    const entries = await readScheduledEntries();
    const flattened = Object.values(entries)
      .map((day) => resolveDailyEntry(day))
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
      return serviceResponse(flattened);
    }

    return serviceResponse(await readJson(HISTORY_KEY, []));
  },
  getReadAlongAudioUrl: async (ang) => {
    const safeAng = Math.max(1, Number(ang) || 1);
    if (!READ_ALONG_ENABLED) {
      return serviceResponse({
        ang: safeAng,
        url: '',
        available: false,
        enabled: false,
        source: READ_ALONG_EXACT_BASE_URL,
        rangeStart: 0,
        rangeEnd: 0,
        startAtSeconds: 0
      });
    }
    const url = `${READ_ALONG_EXACT_BASE_URL}/gms-${safeAng}.mp3`;

    return serviceResponse({
      ang: safeAng,
      url,
      available: Boolean(url),
      enabled: true,
      source: READ_ALONG_EXACT_BASE_URL,
      rangeStart: safeAng,
      rangeEnd: safeAng,
      startAtSeconds: 0
    });
  }
};

export default hukamnamaService;