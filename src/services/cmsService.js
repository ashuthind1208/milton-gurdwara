import { mockResponse } from './mockApi';

const STORAGE_KEY = 'gurdwara_cms_home_content';
const PAGE_CONTENT_STORAGE_KEY = 'gurdwara_cms_page_content';

const defaultLangarItems = [
  { id: 'langar-1', name: 'Ginger', category: 'Grocery', addedOn: '2026-07-07', expiryDate: '', needed: true },
  { id: 'langar-2', name: 'Tomato', category: 'Grocery', addedOn: '2026-07-07', expiryDate: '', needed: true },
  { id: 'langar-3', name: 'Onions', category: 'Grocery', addedOn: '2026-07-06', expiryDate: '', needed: false },
  { id: 'langar-4', name: 'Flour (Atta)', category: 'Grocery', addedOn: '2026-07-07', expiryDate: '', needed: true },
  { id: 'langar-5', name: 'Lentils (Daal)', category: 'Grocery', addedOn: '2026-07-05', expiryDate: '', needed: false }
];

const defaultSchedule = {
  morning: [
    { id: 'morning-1', time: '5:00 AM', label: 'Parkash Sri Guru Granth Sahib' },
    { id: 'morning-2', time: '5:15 AM', label: '5 Baani da Paath' },
    { id: 'morning-3', time: '6:15 AM - 6:40 AM', label: 'Ardaas and Hukamnama' }
  ],
  evening: [
    { id: 'evening-1', time: '7:00 PM', label: 'Rehraas Sahib' },
    { id: 'evening-2', time: '7:30 PM - 7:45 PM', label: 'Hukamnama Katha' },
    { id: 'evening-3', time: '7:45 PM - 8:00 PM', label: 'Kirtan Sohila Sahib' },
    { id: 'evening-4', time: '8:00 PM', label: 'Sukh Asan Sri Guru Granth Sahib' }
  ]
};

const defaultPageContent = {
  about: {
    heroTitle: 'About Our Gurdwara',
    heroDescription: 'Serving the sangat with spiritual guidance, seva, and community development.',
    intro: 'Our Gurdwara supports spiritual learning, family connection, and seva-led community development in Milton.',
    mediaUrl: 'https://images.unsplash.com/photo-1592861956120-e524fc739696?auto=format&fit=crop&w=1400&q=80',
    sections: [
      {
        id: 'about-history',
        title: 'History',
        body: 'Established to support Sikh families in Milton through worship, education, and seva.',
        mediaUrl: ''
      },
      {
        id: 'about-vision',
        title: 'Vision',
        body: 'A spiritually strong, inclusive, and service-led community for future generations.',
        mediaUrl: ''
      },
      {
        id: 'about-mission',
        title: 'Mission',
        body: 'Promote Sikh values, support youth, and provide meaningful seva opportunities for all.',
        mediaUrl: ''
      },
      {
        id: 'about-management',
        title: 'Committee and Management',
        body: 'Executive committee, granthis, and volunteers work together for daily maryada and community support.',
        mediaUrl: ''
      }
    ]
  },
  sikhism: {
    heroTitle: 'Learn Sikhism',
    heroDescription: 'Structured learning resources prepared for community education.',
    intro: 'Begin with core Sikh beliefs and continue into Gurus, Gurbani, and history.',
    mediaUrl: '',
    sections: [
      { id: 'sikhism-1', title: 'Introduction to Sikhism', body: 'Foundational Sikh principles and spiritual worldview.', mediaUrl: '' },
      { id: 'sikhism-2', title: 'Ten Gurus', body: 'Teachings, legacy, and contributions of the ten Sikh Gurus.', mediaUrl: '' },
      { id: 'sikhism-3', title: 'Guru Granth Sahib', body: 'Understanding Gurbani, structure, and daily relationship with Shabad.', mediaUrl: '' },
      { id: 'sikhism-4', title: 'Five Ks and Rehat', body: 'Identity, discipline, and practical living in Sikhi.', mediaUrl: '' }
    ]
  },
  events: {
    heroTitle: 'Events and Registrations',
    heroDescription: 'Calendar, list view, filters, and RSVP for all programs.',
    intro: 'Track samagams, workshops, seva drives, and Gurpurab programs in one place.',
    mediaUrl: '',
    sections: []
  },
  gallery: {
    heroTitle: 'Gallery',
    heroDescription: 'Browse albums of photos and videos from samagams and seva drives.',
    intro: '',
    mediaUrl: '',
    sections: []
  },
  contact: {
    heroTitle: 'Contact Us',
    heroDescription: 'Reach the Gurdwara team for inquiries, directions, or support.',
    intro: 'Use phone, email, or the contact form below for support and program information.',
    mediaUrl: '',
    phone: '',
    email: '',
    address: '',
    mapEmbedUrl: '',
    sections: []
  }
};

const normalizeScheduleEntries = (entries = [], prefix) => entries.map((entry, index) => {
  if (typeof entry === 'string') {
    const splitIndex = entry.indexOf(' - ');
    if (splitIndex === -1) {
      return {
        id: `${prefix}-${index + 1}`,
        time: entry,
        label: ''
      };
    }

    return {
      id: `${prefix}-${index + 1}`,
      time: entry.slice(0, splitIndex),
      label: entry.slice(splitIndex + 3)
    };
  }

  return {
    id: entry.id || `${prefix}-${index + 1}`,
    time: entry.time || '',
    label: entry.label || ''
  };
});

const normalizeSlides = (slides = []) => {
  const sorted = [...slides]
    .map((slide, index) => ({
      id: slide.id || `slide-${Date.now()}-${index}`,
      order: Number.isFinite(Number(slide.order)) ? Number(slide.order) : index + 1,
      image: slide.image || '',
      eyebrow: slide.eyebrow || '',
      title: slide.title || slide.heading || '',
      description: slide.description || slide.caption || '',
      primaryCtaLabel: slide.primaryCtaLabel || slide.ctaLabel || '',
      primaryCtaPath: slide.primaryCtaPath || slide.ctaPath || '',
      secondaryCtaLabel: slide.secondaryCtaLabel || '',
      secondaryCtaPath: slide.secondaryCtaPath || '',
      contentLinkLabel: slide.contentLinkLabel || '',
      contentLinkPath: slide.contentLinkPath || '',
      contentLinkTwoLabel: slide.contentLinkTwoLabel || '',
      contentLinkTwoPath: slide.contentLinkTwoPath || ''
    }))
    .sort((a, b) => a.order - b.order);

  return sorted.map((slide, index) => ({ ...slide, order: index + 1 }));
};

const insertSlideAtOrder = (slides, nextSlide, requestedOrder) => {
  const orderedSlides = normalizeSlides(slides);
  const normalizedOrder = Math.max(1, Math.min(Number(requestedOrder) || orderedSlides.length + 1, orderedSlides.length + 1));
  const before = orderedSlides.slice(0, normalizedOrder - 1);
  const after = orderedSlides.slice(normalizedOrder - 1);
  return normalizeSlides([...before, nextSlide, ...after]);
};

const normalizePageEntry = (pageValue = {}, fallback = {}) => ({
  ...fallback,
  ...pageValue,
  sections: (pageValue.sections || fallback.sections || []).map((section, index) => ({
    id: section.id || `section-${index + 1}`,
    title: section.title || '',
    body: section.body || '',
    mediaUrl: section.mediaUrl || ''
  }))
});

const normalizeAllPageContent = (allContent = {}) => ({
  about: normalizePageEntry(allContent.about, defaultPageContent.about),
  sikhism: normalizePageEntry(allContent.sikhism, defaultPageContent.sikhism),
  events: normalizePageEntry(allContent.events, defaultPageContent.events),
  gallery: normalizePageEntry(allContent.gallery, defaultPageContent.gallery),
  contact: normalizePageEntry(allContent.contact, defaultPageContent.contact)
});

const normalizeContent = (content) => ({
  ...defaultContent,
  ...content,
  hero: {
    ...defaultContent.hero,
    ...(content.hero || {}),
    slides: normalizeSlides(content.hero?.slides || defaultContent.hero.slides)
  },
  schedule: {
    morning: normalizeScheduleEntries(content.schedule?.morning || defaultSchedule.morning, 'morning'),
    evening: normalizeScheduleEntries(content.schedule?.evening || defaultSchedule.evening, 'evening')
  },
  langarItems: (content.langarItems || defaultLangarItems).map((item, index) => ({
    id: item.id || `langar-${index + 1}`,
    name: item.name || '',
    category: item.category || 'Grocery',
    addedOn: item.addedOn || new Date().toISOString().slice(0, 10),
    expiryDate: item.expiryDate || '',
    needed: typeof item.needed === 'boolean' ? item.needed : true
  }))
});

const persistContent = (nextValue) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextValue));
  return nextValue;
};

const readAllPageContent = () => {
  const raw = localStorage.getItem(PAGE_CONTENT_STORAGE_KEY);
  if (!raw) {
    return normalizeAllPageContent(defaultPageContent);
  }

  try {
    return normalizeAllPageContent(JSON.parse(raw));
  } catch {
    return normalizeAllPageContent(defaultPageContent);
  }
};

const persistPageContent = (nextValue) => {
  localStorage.setItem(PAGE_CONTENT_STORAGE_KEY, JSON.stringify(nextValue));
  return nextValue;
};

const defaultContent = {
  hero: {
    eyebrow: 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh',
    title: 'Gurdwara Singh Sabha Milton',
    description:
      'Daily hukamnama, Sunday samagams, seva opportunities, and community updates for the sangat in Milton and beyond.',
    primaryCta: 'Donate for Langar',
    primaryCtaPath: '/donation',
    secondaryCta: 'Join Seva',
    secondaryCtaPath: '/seva',
    slides: [
      {
        image:
          'https://assets.cdn.filesafe.space/b9aAKZlXnebGhQoRLosa/media/654583d092b8570d5a8c5f1a.png',
        eyebrow: 'Weekly Diwan',
        title: 'Sunday Samagam',
        description: 'Sukhmani Sahib, Kirtan, Katha, and Ardaas with Langar sewa for the full sangat.',
        primaryCtaLabel: 'View Sunday Program',
        primaryCtaPath: '/events',
        secondaryCtaLabel: 'Register for Seva',
        secondaryCtaPath: '/seva',
        contentLinkLabel: 'See full weekly schedule',
        contentLinkPath: '/events',
        contentLinkTwoLabel: 'Support langar',
        contentLinkTwoPath: '/donation'
      },
      {
        image:
          'https://images.leadconnectorhq.com/image/f_webp/q_80/r_320/u_https://storage.googleapis.com/msgsndr/knES3eSWYIsc5YSZ3YLl/media/62beef4f9f43b0c53e585a8f.jpeg',
        eyebrow: 'Community Life',
        title: 'Sangat and Community',
        description: 'Families, youth, and elders connected through Gurbani, seva, and shared learning.',
        primaryCtaLabel: 'Register for Seva',
        primaryCtaPath: '/seva',
        secondaryCtaLabel: 'Explore Sikh Education',
        secondaryCtaPath: '/sikhism',
        contentLinkLabel: 'Read daily hukamnama',
        contentLinkPath: '/hukamnama',
        contentLinkTwoLabel: 'Browse gallery',
        contentLinkTwoPath: '/gallery'
      }
    ]
  },
  schedule: defaultSchedule,
  langarItems: defaultLangarItems
};

const readHomeContent = () => {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return normalizeContent(defaultContent);
  }

  try {
    return normalizeContent(JSON.parse(raw));
  } catch {
    return normalizeContent(defaultContent);
  }
};

const cmsService = {
  getHomeContent: async () => mockResponse(readHomeContent()),
  updateHomeContent: async (payload) => {
    const current = readHomeContent();
    const nextValue = {
      ...current,
      ...payload,
      hero: {
        ...current.hero,
        ...(payload.hero || {}),
        slides: normalizeSlides(payload.hero?.slides || current.hero.slides)
      },
      schedule: payload.schedule
        ? {
            morning: normalizeScheduleEntries(payload.schedule.morning || current.schedule.morning, 'morning'),
            evening: normalizeScheduleEntries(payload.schedule.evening || current.schedule.evening, 'evening')
          }
        : current.schedule,
      langarItems: payload.langarItems || current.langarItems
    };

    return mockResponse(normalizeContent(persistContent(nextValue)));
  },
  getHeroSlides: async () => mockResponse(readHomeContent().hero.slides),
  addHeroSlide: async (payload) => {
    const current = readHomeContent();
    const nextSlide = {
      ...payload,
      id: payload.id || `slide-${Date.now()}`
    };

    const nextSlides = insertSlideAtOrder(current.hero.slides, nextSlide, payload.order);
    const nextValue = {
      ...current,
      hero: {
        ...current.hero,
        slides: nextSlides
      }
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).hero.slides);
  },
  updateHeroSlide: async (id, payload) => {
    const current = readHomeContent();
    const existing = current.hero.slides.find((slide) => slide.id === id);
    if (!existing) {
      return mockResponse(current.hero.slides);
    }

    const remaining = current.hero.slides.filter((slide) => slide.id !== id);
    const nextSlide = {
      ...existing,
      ...payload,
      id
    };

    const nextSlides = insertSlideAtOrder(remaining, nextSlide, payload.order || existing.order);
    const nextValue = {
      ...current,
      hero: {
        ...current.hero,
        slides: nextSlides
      }
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).hero.slides);
  },
  removeHeroSlide: async (id) => {
    const current = readHomeContent();
    const nextValue = {
      ...current,
      hero: {
        ...current.hero,
        slides: normalizeSlides(current.hero.slides.filter((slide) => slide.id !== id))
      }
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).hero.slides);
  },
  addLangarItem: async (payload) => {
    const current = readHomeContent();
    const nextValue = {
      ...current,
      langarItems: [
        {
          id: `langar-${Date.now()}`,
          name: payload.name,
          category: payload.category || 'Grocery',
          addedOn: payload.addedOn || new Date().toISOString().slice(0, 10),
          expiryDate: payload.expiryDate || '',
          needed: payload.needed
        },
        ...current.langarItems
      ]
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).langarItems);
  },
  removeLangarItem: async (id) => {
    const current = readHomeContent();
    const nextValue = {
      ...current,
      langarItems: current.langarItems.filter((item) => item.id !== id)
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).langarItems);
  },
  updateLangarItem: async (id, payload) => {
    const current = readHomeContent();
    const nextValue = {
      ...current,
      langarItems: current.langarItems.map((item) => (
        item.id === id ? { ...item, ...payload } : item
      ))
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).langarItems);
  },
  updateSchedule: async (schedule) => {
    const current = readHomeContent();
    const nextValue = {
      ...current,
      schedule: {
        morning: normalizeScheduleEntries(schedule.morning || [], 'morning'),
        evening: normalizeScheduleEntries(schedule.evening || [], 'evening')
      }
    };

    return mockResponse(normalizeContent(persistContent(nextValue)).schedule);
  },
  getAllPageContent: async () => mockResponse(readAllPageContent()),
  getPageContent: async (pageKey) => {
    const allContent = readAllPageContent();
    return mockResponse(allContent[pageKey] || allContent.about);
  },
  updatePageContent: async (pageKey, payload) => {
    const allContent = readAllPageContent();
    const fallback = defaultPageContent[pageKey] || defaultPageContent.about;
    const nextValue = {
      ...allContent,
      [pageKey]: normalizePageEntry({
        ...allContent[pageKey],
        ...payload,
        sections: payload.sections || allContent[pageKey]?.sections || []
      }, fallback)
    };

    const saved = normalizeAllPageContent(persistPageContent(nextValue));
    return mockResponse(saved[pageKey]);
  }
};

export default cmsService;
