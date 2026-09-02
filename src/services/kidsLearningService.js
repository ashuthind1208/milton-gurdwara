import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';
import apiClient from './apiClient';

const RESOURCE = 'kids_learning_content';

const defaultKidsLearningContent = {
  heroTitle: 'Kids Sikh Learning',
  heroDescription: 'Stories, quizzes, and Punjabi vocabulary for Sikh children and families.',
  intro: 'Build Sikh knowledge week by week with age-friendly content curated by the gurdwara team.',
  wordOfWeek: {
    id: 'word-1',
    punjabi: 'Seva',
    transliteration: 'Seva',
    englishMeaning: 'Selfless service',
    example: 'We do seva in the langar hall with humility.',
    isPublished: true,
    publishDate: ''
  },
  weeklyWords: [
    {
      id: 'week-word-1',
      week: 'Current Week',
      punjabi: 'Seva',
      transliteration: 'Seva',
      englishMeaning: 'Selfless service'
    },
    {
      id: 'week-word-2',
      week: 'Last Week',
      punjabi: 'Naam',
      transliteration: 'Naam',
      englishMeaning: 'Divine Name'
    },
    {
      id: 'week-word-3',
      week: '2 Weeks Ago',
      punjabi: 'Nimrata',
      transliteration: 'Nimrata',
      englishMeaning: 'Humility'
    },
    {
      id: 'week-word-4',
      week: '3 Weeks Ago',
      punjabi: 'Daya',
      transliteration: 'Daya',
      englishMeaning: 'Compassion'
    }
  ],
  previousWordWeeks: [
    {
      id: 'word-prev-1',
      punjabi: 'Naam',
      transliteration: 'Naam',
      englishMeaning: 'Divine Name'
    },
    {
      id: 'word-prev-2',
      punjabi: 'Nimrata',
      transliteration: 'Nimrata',
      englishMeaning: 'Humility'
    },
    {
      id: 'word-prev-3',
      punjabi: 'Daya',
      transliteration: 'Daya',
      englishMeaning: 'Compassion'
    }
  ],
  streakBadge: {
    enabled: true,
    badgeLabel: 'Weekly Learner',
    targetDays: 7
  },
  quizzes: [
    {
      id: 'quiz-1',
      title: 'Guru Nanak Dev Ji Basics',
      ageGroup: '6-9',
      question: 'Who was the first Sikh Guru?',
      options: ['Guru Gobind Singh Ji', 'Guru Nanak Dev Ji', 'Guru Arjan Dev Ji'],
      correctOption: 'Guru Nanak Dev Ji',
      explanation: 'Guru Nanak Dev Ji is the first Guru and founder of Sikhi.',
      isPublished: true,
      publishDate: ''
    }
  ],
  stories: [
    {
      id: 'story-1',
      title: 'The Value of Sharing',
      ageGroup: '6-9',
      summary: 'A short story on Vand Chhakna and caring for others.',
      content: 'Guru Nanak Dev Ji taught us to share what we have with others. This value is called Vand Chhakna.',
      mediaUrl: '',
      isPublished: true,
      publishDate: ''
    }
  ]
};

const normalizeBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }
  return fallback;
};

const toStringArray = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((entry) => String(entry || '').trim()).filter(Boolean);
};

const normalizeQuiz = (item = {}, index = 0) => {
  const normalizedOptions = toStringArray(item.options);
  const fallbackCorrect = normalizedOptions[0] || '';
  return {
    id: String(item.id || `quiz-${Date.now()}-${index}`),
    title: String(item.title || ''),
    ageGroup: String(item.ageGroup || ''),
    question: String(item.question || ''),
    options: normalizedOptions,
    correctOption: String(item.correctOption || fallbackCorrect),
    explanation: String(item.explanation || ''),
    isPublished: normalizeBoolean(item.isPublished, true),
    publishDate: String(item.publishDate || '')
  };
};

const normalizeStory = (item = {}, index = 0) => ({
  id: String(item.id || `story-${Date.now()}-${index}`),
  title: String(item.title || ''),
  ageGroup: String(item.ageGroup || ''),
  summary: String(item.summary || ''),
  content: String(item.content || ''),
  mediaUrl: String(item.mediaUrl || ''),
  isPublished: normalizeBoolean(item.isPublished, true),
  publishDate: String(item.publishDate || '')
});

const normalizeWordCard = (item = {}) => ({
  id: String(item.id || 'word-1'),
  punjabi: String(item.punjabi || ''),
  transliteration: String(item.transliteration || ''),
  englishMeaning: String(item.englishMeaning || ''),
  example: String(item.example || ''),
  isPublished: normalizeBoolean(item.isPublished, true),
  publishDate: String(item.publishDate || '')
});

const normalizePreviousWordEntry = (item = {}, index = 0) => ({
  id: String(item.id || `word-prev-${index + 1}`),
  punjabi: String(item.punjabi || ''),
  transliteration: String(item.transliteration || ''),
  englishMeaning: String(item.englishMeaning || '')
});

const normalizeWeeklyWordEntry = (item = {}, index = 0) => ({
  id: String(item.id || `week-word-${Date.now()}-${index}`),
  week: String(item.week || `Week ${index + 1}`),
  punjabi: String(item.punjabi || ''),
  transliteration: String(item.transliteration || ''),
  englishMeaning: String(item.englishMeaning || '')
});

const deriveWeeklyWords = (content = {}) => {
  if (Array.isArray(content.weeklyWords) && content.weeklyWords.length > 0) {
    return content.weeklyWords.map((entry, index) => normalizeWeeklyWordEntry(entry, index));
  }

  const currentWord = normalizeWordCard(content.wordOfWeek || defaultKidsLearningContent.wordOfWeek);
  const previousWords = (
    Array.isArray(content.previousWordWeeks) && content.previousWordWeeks.length > 0
      ? content.previousWordWeeks
      : defaultKidsLearningContent.previousWordWeeks
  ).slice(0, 3).map((entry, index) => normalizePreviousWordEntry(entry, index));

  return [
    {
      id: String(currentWord.id || 'week-word-1'),
      week: 'Current Week',
      punjabi: currentWord.punjabi,
      transliteration: currentWord.transliteration,
      englishMeaning: currentWord.englishMeaning
    },
    ...previousWords.map((entry, index) => ({
      id: String(entry.id || `week-word-${index + 2}`),
      week: index === 0 ? 'Last Week' : `${index + 1} Weeks Ago`,
      punjabi: entry.punjabi,
      transliteration: entry.transliteration,
      englishMeaning: entry.englishMeaning
    }))
  ];
};

const normalizeKidsLearningContent = (content = {}) => ({
  ...(() => {
    const weeklyWords = deriveWeeklyWords(content);
    const currentWeeklyWord = weeklyWords[0] || normalizeWeeklyWordEntry(defaultKidsLearningContent.weeklyWords[0], 0);
    const currentWordCard = normalizeWordCard({
      ...(content.wordOfWeek || defaultKidsLearningContent.wordOfWeek),
      punjabi: currentWeeklyWord.punjabi,
      transliteration: currentWeeklyWord.transliteration,
      englishMeaning: currentWeeklyWord.englishMeaning
    });

    return {
      heroTitle: String(content.heroTitle || defaultKidsLearningContent.heroTitle),
      heroDescription: String(content.heroDescription || defaultKidsLearningContent.heroDescription),
      intro: String(content.intro || defaultKidsLearningContent.intro),
      wordOfWeek: currentWordCard,
      weeklyWords,
      previousWordWeeks: weeklyWords
        .slice(1, 4)
        .map((entry, index) => normalizePreviousWordEntry({
          id: entry.id || `word-prev-${index + 1}`,
          punjabi: entry.punjabi,
          transliteration: entry.transliteration,
          englishMeaning: entry.englishMeaning
        }, index)),
      streakBadge: {
        enabled: normalizeBoolean(content?.streakBadge?.enabled, defaultKidsLearningContent.streakBadge.enabled),
        badgeLabel: String(content?.streakBadge?.badgeLabel || defaultKidsLearningContent.streakBadge.badgeLabel),
        targetDays: Number(content?.streakBadge?.targetDays || defaultKidsLearningContent.streakBadge.targetDays)
      },
      quizzes: (Array.isArray(content.quizzes) ? content.quizzes : defaultKidsLearningContent.quizzes).map(normalizeQuiz),
      stories: (Array.isArray(content.stories) ? content.stories : defaultKidsLearningContent.stories).map(normalizeStory)
    };
  })()
});

const getStoredKidsLearningContent = async () => {
  const payload = await contentApiService.getSingleton(RESOURCE, null);
  if (!payload) {
    const seeded = normalizeKidsLearningContent(defaultKidsLearningContent);
    await contentApiService.setSingleton(RESOURCE, seeded);
    return seeded;
  }
  return normalizeKidsLearningContent(payload);
};

const kidsLearningService = {
  getContent: async () => {
    const content = await getStoredKidsLearningContent();
    return serviceResponse(content);
  },

  updateContent: async (payload) => {
    const normalized = normalizeKidsLearningContent(payload || {});
    await contentApiService.setSingleton(RESOURCE, normalized);
    const latest = await getStoredKidsLearningContent();
    return serviceResponse(latest);
  },

  generateGurmatGuide: async (word) => {
    const response = await apiClient.post('/kids-learning/gurmat-guide', { word }, { timeout: 75000 });
    return serviceResponse(response.data?.data);
  },

  getDefaultContent: () => normalizeKidsLearningContent(defaultKidsLearningContent)
};

export default kidsLearningService;