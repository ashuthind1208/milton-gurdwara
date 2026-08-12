import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckBadgeIcon,
  ClipboardDocumentListIcon,
  CalendarDaysIcon,
  ClockIcon,
  EnvelopeIcon,
  IdentificationIcon,
  InformationCircleIcon,
  MapPinIcon,
  PhoneIcon,
  PlusCircleIcon,
  PlayIcon,
  QueueListIcon,
  SparklesIcon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { BookOpenIcon, DocumentTextIcon } from '@heroicons/react/24/solid';
import PageHero from '../../components/common/PageHero';
import BreadcrumbTrail from '../../components/common/BreadcrumbTrail';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import Card from '../../components/ui/Card';
import libraryService from '../../services/libraryService';
import eventService from '../../services/eventService';
import { isLibraryProgramCurrent } from '../../utils/eventAvailability';
import advertisementService from '../../services/advertisementService';
import kidsLearningService from '../../services/kidsLearningService';
import kidsQuizBankService from '../../services/kidsQuizBankService';
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from '../../services/videoService';
import Button from '../../components/ui/Button';
import { useAuth } from '../../context/AuthContext';
import PhoneInput from '../../components/forms/PhoneInput';
import { formatTenDigitPhone, isTenDigitPhone, TEN_DIGIT_PHONE_ERROR } from '../../utils/phone';

const PAGE_SIZE = 10;

const normalizeTextToken = (value) => String(value || '').trim().toLowerCase();

const Pagination = ({ page, total, onChange }) => {
  if (total <= 1) {
    return null;
  }

  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Prev
      </button>
      <span className="text-xs font-semibold text-slate-600">Page {page} of {total}</span>
      <button
        type="button"
        className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40"
        disabled={page >= total}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
};

const getYouTubeVideoId = (url) => {
  const embedUrl = getYouTubeEmbedUrl(url);
  const match = embedUrl.match(/embed\/([A-Za-z0-9_-]{11})/);
  return match ? match[1] : '';
};

const resolveCorrectAnswerIndex = (question = {}) => {
  const options = Array.isArray(question?.options) ? question.options : [];
  const raw = Number(question?.correctAnswer);
  if (Number.isFinite(raw) && raw >= 0 && raw < options.length) {
    return raw;
  }
  if (Number.isFinite(raw) && raw >= 1 && raw <= options.length) {
    return raw - 1;
  }
  return 0;
};

const getDifficultyRibbonClasses = (difficulty = '') => {
  const normalized = String(difficulty || '').trim().toLowerCase();
  if (normalized === 'hard') {
    return 'border-rose-300 bg-rose-100 text-rose-800';
  }
  if (normalized === 'medium') {
    return 'border-amber-300 bg-amber-100 text-amber-900';
  }
  return 'border-emerald-300 bg-emerald-100 text-emerald-800';
};

const loadYouTubeIFrameApi = (() => {
  let apiPromise = null;

  return () => {
    if (typeof window === 'undefined') {
      return Promise.resolve(null);
    }

    if (window.YT?.Player) {
      return Promise.resolve(window.YT);
    }

    if (apiPromise) {
      return apiPromise;
    }

    apiPromise = new Promise((resolve) => {
      const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      const previousCallback = window.onYouTubeIframeAPIReady;

      window.onYouTubeIframeAPIReady = () => {
        if (typeof previousCallback === 'function') {
          previousCallback();
        }
        resolve(window.YT);
      };

      if (!existingScript) {
        const script = document.createElement('script');
        script.src = 'https://www.youtube.com/iframe_api';
        script.async = true;
        script.onerror = () => resolve(null);
        document.head.appendChild(script);
      }
    });

    return apiPromise;
  };
})();

const YouTubeAutoPlayPlayer = ({ url, title, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const videoId = getYouTubeVideoId(url);
    if (!videoId || !containerRef.current) {
      return undefined;
    }

    let player = null;
    let cancelled = false;

    loadYouTubeIFrameApi().then((YT) => {
      if (cancelled || !YT?.Player || !containerRef.current) {
        return;
      }

      player = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 1,
          controls: 1,
          rel: 0,
          modestbranding: 1,
          playsinline: 1
        },
        events: {
          onReady: (event) => {
            try {
              event.target.setVolume(50);
              event.target.playVideo();
            } catch {
              // Ignore player API errors and keep the embedded player visible.
            }
          }
        }
      });
    });

    return () => {
      cancelled = true;
      if (player?.destroy) {
        player.destroy();
      }
    };
  }, [url]);

  return <div ref={containerRef} className={className} aria-label={title} />;
};

const LibraryPage = () => {
  const meta = useSeoMeta('Library', 'Books, PDFs, and downloadable resources for Sikh learning.');
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();
  const [physicalPage, setPhysicalPage] = useState(1);
  const [digitalPage, setDigitalPage] = useState(1);
  const [programEventsPage, setProgramEventsPage] = useState(1);
  const [issueModalBookId, setIssueModalBookId] = useState('');
  const [sessionModalId, setSessionModalId] = useState('');
  const [mediaModalId, setMediaModalId] = useState('');
  const [flashCardQuestionIndex, setFlashCardQuestionIndex] = useState(0);
  const [flashCardSelectedOption, setFlashCardSelectedOption] = useState(null);
  const [flashCardFlipped, setFlashCardFlipped] = useState(false);
  const [quizAnsweredCount, setQuizAnsweredCount] = useState(0);
  const [quizCorrectCount, setQuizCorrectCount] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [quizBestStreak, setQuizBestStreak] = useState(0);
  const registrationDefaults = useMemo(() => ({
    name: String(user?.name || ''),
    email: String(user?.email || ''),
    contact: formatTenDigitPhone(user?.phone)
  }), [user?.email, user?.name, user?.phone]);
  const registrationForm = useForm({ defaultValues: { name: '', email: '', contact: '' } });
  const watchedRegistrationEmail = registrationForm.watch('email');
  const currentUserEmail = normalizeTextToken(user?.email);

  const { data: libraryData } = useQuery({
    queryKey: ['library-content'],
    queryFn: () => libraryService.getLibraryData().then((res) => res.data)
  });

  const { data: ads = [] } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data)
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => eventService.getEvents().then((res) => res.data)
  });

  const { data: kidsLearningContent } = useQuery({
    queryKey: ['kids-learning-content-library'],
    queryFn: () => kidsLearningService.getContent().then((res) => res.data)
  });

  const { data: quizBankQuestions = [] } = useQuery({
    queryKey: ['kids-quiz-bank-filesystem'],
    queryFn: () => kidsQuizBankService.getAllQuestions().then((res) => res.data)
  });

  const physicalBooks = useMemo(() => libraryData?.physicalBooks || [], [libraryData]);
  const digitalResources = useMemo(() => libraryData?.digitalResources || [], [libraryData]);
  const programUpdates = useMemo(() => libraryData?.programUpdates || [], [libraryData]);
  const currentProgramUpdates = useMemo(
    () => programUpdates.filter((entry) => isLibraryProgramCurrent(entry)),
    [programUpdates]
  );
  const mediaResources = useMemo(() => libraryData?.mediaResources || [], [libraryData]);
  const libraryTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Library Top Banner'), [ads]);
  const libraryFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Library Footer Banner'), [ads]);
  const libraryTopAdImageHeightClass = libraryTopAds.length > 2 ? 'h-16 md:h-20' : 'h-24 md:h-28';
  const libraryFooterAdImageHeightClass = libraryFooterAds.length > 2 ? 'h-16 md:h-20' : 'h-24 md:h-28';
  const libraryTopAdsGridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${Math.max(1, libraryTopAds.length)}, minmax(0, 1fr))` }), [libraryTopAds.length]);
  const libraryFooterAdsGridStyle = useMemo(() => ({ gridTemplateColumns: `repeat(${Math.max(1, libraryFooterAds.length)}, minmax(0, 1fr))` }), [libraryFooterAds.length]);
  const filteredFlashCardQuestions = useMemo(() => (Array.isArray(quizBankQuestions) ? quizBankQuestions : []), [quizBankQuestions]);
  const flashCardQuestion = useMemo(() => {
    if (!Array.isArray(filteredFlashCardQuestions) || filteredFlashCardQuestions.length === 0) {
      return null;
    }
    const safeIndex = ((flashCardQuestionIndex % filteredFlashCardQuestions.length) + filteredFlashCardQuestions.length) % filteredFlashCardQuestions.length;
    return filteredFlashCardQuestions[safeIndex];
  }, [flashCardQuestionIndex, filteredFlashCardQuestions]);
  const quizScoreOutOf100 = Math.min(100, quizCorrectCount * 10);
  const quizProgressPercent = filteredFlashCardQuestions.length > 0
    ? Math.min(100, ((Math.min(flashCardQuestionIndex, filteredFlashCardQuestions.length - 1) + 1) / filteredFlashCardQuestions.length) * 100)
    : 0;

  const physicalTotalPages = Math.max(1, Math.ceil(physicalBooks.length / PAGE_SIZE));
  const digitalTotalPages = Math.max(1, Math.ceil(digitalResources.length / PAGE_SIZE));

  const visiblePhysicalBooks = useMemo(() => {
    const start = (physicalPage - 1) * PAGE_SIZE;
    return physicalBooks.slice(start, start + PAGE_SIZE);
  }, [physicalBooks, physicalPage]);

  const visibleDigitalResources = useMemo(() => {
    const start = (digitalPage - 1) * PAGE_SIZE;
    return digitalResources.slice(start, start + PAGE_SIZE);
  }, [digitalPage, digitalResources]);

  const issueModalBook = useMemo(
    () => physicalBooks.find((book) => book.id === issueModalBookId) || null,
    [issueModalBookId, physicalBooks]
  );

  const sessionModalEntry = useMemo(
    () => currentProgramUpdates.find((entry) => entry.id === sessionModalId) || null,
    [currentProgramUpdates, sessionModalId]
  );

  const mediaModalEntry = useMemo(
    () => mediaResources.find((entry) => entry.id === mediaModalId) || null,
    [mediaModalId, mediaResources]
  );

  const breadcrumbItems = useMemo(() => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Library', path: '/library' }
    ];

    if (sessionModalEntry) {
      items.push({ label: 'Program Sessions', isCurrent: true });
      return items;
    }

    if (mediaModalEntry) {
      items.push({ label: 'Digital Media', isCurrent: true });
      return items;
    }

    items[items.length - 1] = { ...items[items.length - 1], isCurrent: true };
    return items;
  }, [mediaModalEntry, sessionModalEntry]);

  const libraryTickerItems = useMemo(() => {
    const items = [
      ...currentProgramUpdates.slice(0, 4).map((entry) => ({
        id: `event-${entry.id}`,
        icon: CalendarDaysIcon,
        primary: `New library event: ${entry.title || 'Library Session'}`,
        secondary: `${entry.scheduleDate || 'Date TBA'}${entry.scheduleTime ? ` at ${entry.scheduleTime}` : ''}`
      })),
      ...physicalBooks.slice(0, 4).map((entry) => ({
        id: `book-${entry.id}`,
        icon: PlusCircleIcon,
        primary: `New book added: ${entry.title || 'Untitled Book'}`,
        secondary: entry.author ? `Author: ${entry.author}` : 'Now available in library'
      })),
      ...mediaResources.slice(0, 4).map((entry) => ({
        id: `media-${entry.id}`,
        icon: PlayIcon,
        primary: `New media resource: ${entry.title || 'Learning Resource'}`,
        secondary: entry.mediaType ? `Type: ${entry.mediaType}` : 'Available in Media section'
      }))
    ];

    return items.slice(0, 12);
  }, [currentProgramUpdates, physicalBooks, mediaResources]);

  const sortedProgramUpdates = useMemo(() => {
    return [...currentProgramUpdates].sort((left, right) => {
      const leftStamp = `${left.scheduleDate || '1970-01-01'}T${left.scheduleTime || '00:00'}`;
      const rightStamp = `${right.scheduleDate || '1970-01-01'}T${right.scheduleTime || '00:00'}`;
      return new Date(leftStamp).getTime() - new Date(rightStamp).getTime();
    });
  }, [currentProgramUpdates]);

  const programEventsTotalPages = Math.max(1, Math.ceil(sortedProgramUpdates.length / PAGE_SIZE));
  const visibleProgramEvents = useMemo(() => {
    const start = (programEventsPage - 1) * PAGE_SIZE;
    return sortedProgramUpdates.slice(start, start + PAGE_SIZE);
  }, [programEventsPage, sortedProgramUpdates]);

  const eventRegistrationsById = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      map.set(Number(event.id), Number(event.registrations || 0));
    });
    return map;
  }, [events]);

  const eventsById = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      map.set(Number(event.id), event);
    });
    return map;
  }, [events]);

  const registeredEventIdsForCurrentUser = useMemo(() => {
    const registeredIds = new Set();
    if (!currentUserEmail) {
      return registeredIds;
    }

    events.forEach((event) => {
      const eventId = Number(event.id);
      if (!Number.isFinite(eventId)) {
        return;
      }

      const registrants = Array.isArray(event.registrants) ? event.registrants : [];
      const isRegistered = registrants.some((entry) => normalizeTextToken(entry?.email) === currentUserEmail);
      if (isRegistered) {
        registeredIds.add(eventId);
      }
    });

    return registeredIds;
  }, [currentUserEmail, events]);

  const selectedSessionEvent = useMemo(() => {
    if (!sessionModalEntry?.eventId) {
      return null;
    }
    return eventsById.get(Number(sessionModalEntry.eventId)) || null;
  }, [eventsById, sessionModalEntry]);

  const isAlreadyRegisteredForSelectedSession = useMemo(() => {
    if (!selectedSessionEvent) {
      return false;
    }

    const lookupEmail = normalizeTextToken(isAuthenticated ? registrationDefaults.email : watchedRegistrationEmail);
    if (!lookupEmail) {
      return false;
    }

    const registrants = Array.isArray(selectedSessionEvent.registrants) ? selectedSessionEvent.registrants : [];
    return registrants.some((entry) => normalizeTextToken(entry?.email) === lookupEmail);
  }, [isAuthenticated, registrationDefaults.email, selectedSessionEvent, watchedRegistrationEmail]);

  const activeIssueRecords = useMemo(() => (
    (issueModalBook?.issueRecords || []).filter((record) => !record.returnedAt)
  ), [issueModalBook]);

  useEffect(() => {
    if (!sessionModalEntry) {
      registrationForm.reset(registrationDefaults);
    }
  }, [registrationDefaults, sessionModalEntry, registrationForm]);

  useEffect(() => {
    registrationForm.reset(registrationDefaults);
  }, [registrationDefaults, registrationForm]);

  useEffect(() => {
    if (programEventsPage > programEventsTotalPages) {
      setProgramEventsPage(programEventsTotalPages);
    }
  }, [programEventsPage, programEventsTotalPages]);

  const registrationMutation = useMutation({
    mutationFn: async (values) => {
      const eventId = Number(sessionModalEntry?.eventId);
      if (!Number.isFinite(eventId)) {
        throw new Error('Event link is still syncing. Please try again shortly.');
      }

      const inputEmail = normalizeTextToken(values?.email);
      if (!inputEmail) {
        throw new Error('Email is required to register.');
      }

      const linkedEvent = eventsById.get(eventId);
      const existingRegistrants = Array.isArray(linkedEvent?.registrants) ? linkedEvent.registrants : [];
      const duplicateByEmail = existingRegistrants.some((entry) => normalizeTextToken(entry?.email) === inputEmail);
      if (duplicateByEmail) {
        throw new Error('You have already registered for this event.');
      }

      return eventService.registerForEvent({
        eventId,
        name: values.name,
        email: values.email,
        contact: values.contact
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      registrationForm.reset(registrationDefaults);
      setSessionModalId('');
      window.alert('Registration saved successfully.');
    },
    onError: (error) => {
      window.alert(error?.message || 'Unable to save registration.');
    }
  });

  const handleQuizAnswerClick = (optionIndex) => {
    if (!flashCardQuestion || flashCardFlipped) {
      return;
    }

    const correctIndex = resolveCorrectAnswerIndex(flashCardQuestion);
    const isCorrect = optionIndex === correctIndex;

    setFlashCardSelectedOption(optionIndex);
    setFlashCardFlipped(true);
    setQuizAnsweredCount((current) => current + 1);
    if (isCorrect) {
      setQuizCorrectCount((current) => current + 1);
      setQuizStreak((current) => {
        const next = current + 1;
        setQuizBestStreak((best) => Math.max(best, next));
        return next;
      });
    } else {
      setQuizStreak(0);
    }
  };

  const handleNextFlashCard = () => {
    if (!Array.isArray(filteredFlashCardQuestions) || filteredFlashCardQuestions.length === 0) {
      return;
    }
    setFlashCardQuestionIndex((current) => (current + 1) % filteredFlashCardQuestions.length);
    setFlashCardSelectedOption(null);
    setFlashCardFlipped(false);
  };

  const handlePreviousFlashCard = () => {
    if (!Array.isArray(filteredFlashCardQuestions) || filteredFlashCardQuestions.length === 0) {
      return;
    }
    setFlashCardQuestionIndex((current) => {
      const total = filteredFlashCardQuestions.length;
      return (current - 1 + total) % total;
    });
    setFlashCardSelectedOption(null);
    setFlashCardFlipped(false);
  };

  const handleResetQuizSession = () => {
    setFlashCardQuestionIndex(0);
    setFlashCardSelectedOption(null);
    setFlashCardFlipped(false);
    setQuizAnsweredCount(0);
    setQuizCorrectCount(0);
    setQuizStreak(0);
    setQuizBestStreak(0);
  };

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title="Library"
        description="Track available hard-copy books and browse downloadable Sikh learning material in one place."
      />
      <BreadcrumbTrail items={breadcrumbItems} className="-mt-4 px-1" />

      {libraryTopAds.length > 0 ? (
        <section className="rounded-xl py-2">
          <div className="grid w-full gap-2" style={libraryTopAdsGridStyle}>
            {libraryTopAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block min-w-0 overflow-hidden rounded-lg transition hover:opacity-95"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className={`${libraryTopAdImageHeightClass} w-full p-1 object-contain`} loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="space-y-2">
        <div className="relative left-1/2 w-screen -translate-x-1/2 overflow-hidden border-y border-brand-blue/70 bg-brand-blue px-3 py-2 text-white">
          <div className="ticker-mask px-2">
            <div className="ticker-track ticker-speed-medium">
              {libraryTickerItems.length > 0 ? [...libraryTickerItems, ...libraryTickerItems].map((entry, index) => (
                <span key={`${entry.id}-${index}`} className="inline-flex shrink-0 items-center gap-2.5 pr-8 text-left">
                  <entry.icon className="h-4 w-4 text-brand-saffron" />
                  <span className="text-sm font-black text-white">{entry.primary}</span>
                  <span className="text-xs font-semibold text-white/95">{entry.secondary}</span>
                  <span className="text-white/80">|</span>
                </span>
              )) : (
                <span className="inline-flex shrink-0 items-center gap-2.5 pr-8 text-left text-sm font-black text-white">
                  Library updates will appear here as new books, events, and media resources are added.
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-sky-200 bg-gradient-to-br from-sky-50 via-amber-50 to-pink-50 p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-heading text-2xl font-semibold text-brand-blue md:text-3xl">Kids Learning Hub</h3>
            <p className="mt-1 text-xs text-slate-600">Stories, vocabulary and interactive Sikh flashcard quiz for children.</p>
          </div>
          <BookOpenIcon className="h-7 w-7 text-brand-blue" />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card className="border border-sky-200/70 bg-gradient-to-br from-sky-100 via-white to-cyan-100">
            <h4 className="text-lg font-bold text-slate-900">Kids Learning</h4>
            <p className="mt-2 text-sm text-slate-700">{kidsLearningContent?.intro || 'Interactive Sikh learning for children ages 6-12.'}</p>
            {kidsLearningContent?.wordOfWeek ? (
              <div className="mt-3 rounded-xl border border-brand-blue/20 bg-white/90 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-blue">Word of the Week</p>
                <p className="mt-1 text-lg font-black text-brand-blue">{kidsLearningContent.wordOfWeek.punjabi || '-'}</p>
                <p className="text-sm font-semibold text-slate-700">{kidsLearningContent.wordOfWeek.transliteration || ''}</p>
                <p className="mt-2 text-sm text-slate-700">{kidsLearningContent.wordOfWeek.englishMeaning || ''}</p>

                {(Array.isArray(kidsLearningContent?.previousWordWeeks) ? kidsLearningContent.previousWordWeeks : []).length > 0 ? (
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Last 3 Weeks</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(kidsLearningContent.previousWordWeeks || []).slice(0, 3).map((entry, index) => (
                        <span key={entry.id || `word-history-${index}`} className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">
                          {entry.punjabi || '-'}
                          {entry.transliteration ? <span className="ml-1 text-slate-500">({entry.transliteration})</span> : null}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="border border-violet-200/70 bg-gradient-to-br from-violet-100 via-white to-indigo-100">
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-lg font-bold text-slate-900">Quiz Flashcard</h4>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-white/90 px-2.5 py-1 text-xs font-black text-violet-900 shadow-sm">Score {quizScoreOutOf100}/100</span>
                <button
                  type="button"
                  onClick={handleResetQuizSession}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-violet-300 bg-white/90 text-sm font-black text-violet-900 transition hover:bg-violet-100"
                  aria-label="Start over quiz"
                  title="Start over"
                >
                  ↺
                </button>
              </div>
            </div>
            {flashCardQuestion ? (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-700">Streak: {quizStreak}</span>
                  <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-700">Best: {quizBestStreak}</span>
                  <span className="rounded-full bg-white/80 px-2 py-1 font-semibold text-slate-700">Answered: {quizAnsweredCount}</span>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span>{Math.min(flashCardQuestionIndex + 1, filteredFlashCardQuestions.length)} / {filteredFlashCardQuestions.length}</span>
                    <span>{Math.round(quizProgressPercent)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/80">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${quizProgressPercent}%`,
                        background: 'linear-gradient(90deg, #16a34a 0%, #eab308 55%, #dc2626 100%)'
                      }}
                    />
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <p className="text-slate-600">{flashCardQuestion.category}</p>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 font-black uppercase tracking-wide ${getDifficultyRibbonClasses(flashCardQuestion?.difficulty)}`}
                    aria-label={`Difficulty ${flashCardQuestion?.difficulty || 'Easy'}`}
                  >
                    {flashCardQuestion?.difficulty || 'Easy'}
                  </span>
                </div>
                <div className="mt-3" style={{ perspective: '1200px' }}>
                  <div
                    className="relative min-h-[300px] w-full transition-transform duration-500"
                    style={{ transformStyle: 'preserve-3d', transform: flashCardFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
                  >
                    <div className="absolute inset-0 rounded-xl border border-violet-200 bg-white p-4 pb-6" style={{ backfaceVisibility: 'hidden' }}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-bold text-slate-900">{flashCardQuestion.question?.en || 'Question'}</p>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={handlePreviousFlashCard}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-violet-300 bg-violet-50 text-xs font-black text-violet-800 transition hover:bg-violet-100"
                            aria-label="Previous flashcard"
                            title="Previous"
                          >
                            &lt;
                          </button>
                          <button
                            type="button"
                            onClick={handleNextFlashCard}
                            className="inline-flex h-6 w-6 items-center justify-center rounded border border-violet-300 bg-violet-50 text-xs font-black text-violet-800 transition hover:bg-violet-100"
                            aria-label="Next flashcard"
                            title="Next"
                          >
                            &gt;
                          </button>
                        </div>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{flashCardQuestion.question?.pa || ''}</p>
                      <div className="mt-4 space-y-2">
                        {(Array.isArray(flashCardQuestion.options) ? flashCardQuestion.options : []).map((option, optionIndex) => (
                          <button
                            key={`${flashCardQuestion.id}-option-${optionIndex}`}
                            type="button"
                            onClick={() => handleQuizAnswerClick(optionIndex)}
                            className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-left text-sm text-slate-700 transition hover:border-violet-400 hover:bg-violet-50"
                          >
                            <span className="font-semibold">{option.en}</span>
                            <span className="ml-1 text-xs text-slate-600">({option.pa})</span>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-xl border border-violet-300 bg-violet-50 p-4 pb-6" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <p className="text-sm font-black text-violet-900">Answer Revealed</p>
                      <p className="mt-2 text-sm text-slate-800">
                        Correct: {(flashCardQuestion.options?.[resolveCorrectAnswerIndex(flashCardQuestion)]?.en) || '-'}
                      </p>
                      {flashCardSelectedOption !== null ? (
                        flashCardSelectedOption === resolveCorrectAnswerIndex(flashCardQuestion) ? (
                          <p className="mt-2 text-xs font-bold text-emerald-700">Correct answer selected.</p>
                        ) : (
                          <p className="mt-2 text-xs font-bold text-rose-700">
                            Wrong answer selected: {(flashCardQuestion.options?.[flashCardSelectedOption]?.en) || '-'}
                          </p>
                        )
                      ) : null}
                      <p className="mt-2 text-sm text-slate-700">{flashCardQuestion.explanation?.en || ''}</p>
                      <p className="mt-1 text-sm text-slate-600">{flashCardQuestion.explanation?.pa || ''}</p>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={handleNextFlashCard}
                          className="rounded border border-violet-300 bg-white px-2 py-1 text-xs font-semibold text-violet-900 transition hover:bg-violet-100"
                        >
                          Next &gt;
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No quiz questions available.</p>
            )}
          </Card>

        </div>
      </section>

      {sortedProgramUpdates.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-2xl font-semibold text-brand-blue md:text-3xl">Library Events Tracker</h3>
              <p className="mt-1 text-xs text-slate-600">Library sessions are automatically tracked in the Events page as soon as they are created.</p>
            </div>
            <QueueListIcon className="h-7 w-7 text-brand-blue" />
          </div>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Session</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Time</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2 text-center">Registered</th>
                  <th className="px-3 py-2 text-center">Registration</th>
                </tr>
              </thead>
              <tbody>
                {visibleProgramEvents.map((entry) => (
                  <tr key={`program-row-${entry.id}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-3 py-2">
                      <p className="font-semibold text-slate-800">{entry.title || 'Library Session'}</p>
                      <p className="text-xs text-slate-500">{entry.speaker || 'Guest Speaker'} • {entry.audience || 'Open to all'}</p>
                    </td>
                    <td className="px-3 py-2">{entry.scheduleDate || 'TBA'}</td>
                    <td className="px-3 py-2">{entry.scheduleTime || 'TBA'}</td>
                    <td className="px-3 py-2">{entry.location || 'Library Hall'}</td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                        {entry.eventId ? (eventRegistrationsById.get(Number(entry.eventId)) ?? 0) : 0}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.eventId && registeredEventIdsForCurrentUser.has(Number(entry.eventId)) ? (
                        <span className="text-[11px] font-semibold text-red-600">Already registered</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSessionModalId(entry.id)}
                          className="inline-flex items-center rounded-full border border-brand-blue/30 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue transition hover:bg-blue-100"
                          title="Open registration modal"
                          aria-label={`Open registration modal for ${entry.title || 'library session'}`}
                        >
                          Register
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={programEventsPage} total={programEventsTotalPages} onChange={setProgramEventsPage} />
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card className="border border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-amber-200/80 pb-3">
            <div>
              <h3 className="font-heading text-xl font-semibold text-brand-blue">
                <span className="inline-flex items-center gap-2">
                  <BookOpenIcon className="h-5 w-5 text-amber-600" />
                  Hard Copies
                </span>
              </h3>
              <p className="mt-1 text-sm text-slate-700">Physical books inventory with issued and available counts.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-3 py-1.5 text-sm font-semibold text-amber-900">{physicalBooks.length} books</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-amber-200/80 bg-white/70 text-[12px] uppercase tracking-wide text-slate-600">
                  <th className="px-2.5 py-2">Title</th>
                  <th className="px-2.5 py-2">Total</th>
                  <th className="px-2.5 py-2">Issued</th>
                  <th className="px-2.5 py-2">Available</th>
                </tr>
              </thead>
              <tbody>
                {visiblePhysicalBooks.map((book) => {
                  const available = Math.max(0, (book.totalCopies || 0) - (book.issuedCopies || 0));
                  const hasMultiCopyIssueDetails = (book.totalCopies || 0) > 1 && (book.issuedCopies || 0) > 0;

                  return (
                    <tr key={book.id} className="border-b border-amber-100/80 last:border-b-0">
                      <td className="px-2.5 py-2">
                        <p className="text-base font-semibold text-slate-800">{book.title || 'Untitled'}</p>
                        <p className="text-sm text-slate-600">{book.author || 'Unknown author'}</p>
                      </td>
                      <td className="px-2.5 py-2 text-sm text-slate-700">{book.totalCopies || 0}</td>
                      <td className="px-2.5 py-2 text-sm text-slate-700">{book.issuedCopies || 0}</td>
                      <td className="px-2.5 py-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">{available}</span>
                          {hasMultiCopyIssueDetails ? (
                            <button
                              type="button"
                              className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                              onClick={() => setIssueModalBookId(book.id)}
                            >
                              View Dates
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {physicalBooks.length === 0 ? (
                  <tr>
                    <td className="px-2.5 py-3 text-center text-sm text-slate-500" colSpan={4}>No physical books listed yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination page={physicalPage} total={physicalTotalPages} onChange={setPhysicalPage} />
          <p className="mt-2 text-xs text-slate-600">
            * Call Gurdwara office to reserve the book.
          </p>
        </Card>

        <Card className="border border-blue-200/70 bg-gradient-to-br from-blue-50 via-white to-sky-50">
          <div className="mb-3 flex items-center justify-between gap-3 border-b border-blue-200/80 pb-3">
            <div>
              <h3 className="font-heading text-xl font-semibold text-brand-blue">
                <span className="inline-flex items-center gap-2">
                  <DocumentTextIcon className="h-5 w-5 text-blue-600" />
                  Soft Copies
                </span>
              </h3>
              <p className="mt-1 text-sm text-slate-700">PDFs and documents with cover image and download links.</p>
            </div>
            <span className="rounded-full bg-blue-100 px-3 py-1.5 text-sm font-semibold text-blue-900">{digitalResources.length} resources</span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[15px]">
              <thead>
                <tr className="border-b border-blue-200/80 bg-white/70 text-[12px] uppercase tracking-wide text-slate-600">
                  <th className="px-2.5 py-2">Resource</th>
                  <th className="px-2.5 py-2">Type</th>
                  <th className="px-2.5 py-2">Download</th>
                </tr>
              </thead>
              <tbody>
                {visibleDigitalResources.map((resource) => (
                  <tr key={resource.id} className="border-b border-blue-100/80 last:border-b-0">
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        {resource.coverImageUrl ? (
                          <img src={resource.coverImageUrl} alt={resource.title || 'Cover'} className="h-10 w-8 rounded object-cover" />
                        ) : (
                          <div className="h-10 w-8 rounded bg-slate-200" />
                        )}
                        <div>
                          <p className="text-base font-semibold text-slate-800">{resource.title || 'Untitled resource'}</p>
                          <p className="text-sm text-slate-600">{resource.description || 'No description'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2.5 py-2 text-sm text-slate-700">{resource.fileType || 'PDF'}</td>
                    <td className="px-2.5 py-2">
                      <a href={resource.downloadUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-brand-blue hover:underline">Download</a>
                    </td>
                  </tr>
                ))}
                {digitalResources.length === 0 ? (
                  <tr>
                    <td className="px-2.5 py-3 text-center text-sm text-slate-500" colSpan={3}>No downloadable resources listed yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <Pagination page={digitalPage} total={digitalTotalPages} onChange={setDigitalPage} />
        </Card>
      </div>

      {issueModalBook ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={() => setIssueModalBookId('')} />
          <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-heading text-lg font-semibold">Issued Copy Schedule: {issueModalBook.title}</h3>
                <p className="text-xs text-slate-600">Only copy number and issue/return dates are shown.</p>
              </div>
              <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700" onClick={() => setIssueModalBookId('')}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-1.5">Copy</th>
                    <th className="px-3 py-1.5">Issue Date</th>
                    <th className="px-3 py-1.5">Return Date</th>
                  </tr>
                </thead>
                <tbody>
                  {activeIssueRecords.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-1.5">Copy {record.copyNumber}</td>
                      <td className="px-3 py-1.5">{record.issueDate || '-'}</td>
                      <td className="px-3 py-1.5">{record.returnDate || '-'}</td>
                    </tr>
                  ))}
                  {activeIssueRecords.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-center text-slate-500" colSpan={3}>No active issued copies.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}

      {sessionModalEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" onClick={() => setSessionModalId('')} />
          <div className="relative z-10 w-full max-w-4xl overflow-hidden rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-50 shadow-2xl">
            {sessionModalEntry.imageUrl ? (
              <img src={sessionModalEntry.imageUrl} alt={sessionModalEntry.title || 'Library session'} className="h-56 w-full object-cover" />
            ) : null}
            <div className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1 rounded-full bg-brand-blue/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-blue">
                    <SparklesIcon className="h-3.5 w-3.5" />
                    <span>Library Session</span>
                  </p>
                  <h3 className="mt-2 flex items-center gap-2 font-heading text-xl font-semibold text-brand-blue">
                    <BookOpenIcon className="h-5 w-5" />
                    <span>{sessionModalEntry.title}</span>
                  </h3>
                </div>
                <button type="button" className="rounded-md border border-brand-blue/20 bg-white/80 p-1 text-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue" onClick={() => setSessionModalId('')}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <ClipboardDocumentListIcon className="h-4 w-4 text-brand-blue" />
                  <span>Total Registrations: {selectedSessionEvent?.registrations || 0}</span>
                </p>
                {sessionModalEntry.eventId ? (
                  <a
                    href={eventService.getEventCalendarUrl(sessionModalEntry.eventId)}
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-400 hover:bg-emerald-100"
                  >
                    <CalendarDaysIcon className="h-3.5 w-3.5" />
                    <span>Add to Calendar</span>
                  </a>
                ) : null}
              </div>
              {sessionModalEntry.eventId ? (
                <section className="mt-5 grid gap-4 md:grid-cols-2">
                  <article className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                    <h4 className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
                      <ClipboardDocumentListIcon className="h-5 w-5 text-brand-blue" />
                      <span>Library Event Details</span>
                    </h4>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDaysIcon className="h-3.5 w-3.5" />
                        <span>{sessionModalEntry.scheduleDate || 'TBA'}</span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        <span>{sessionModalEntry.scheduleTime || 'TBA'}</span>
                      </span>
                    </p>
                    <div className="mt-2 border-b border-slate-200" />
                    <div className="mt-3 space-y-1.5 text-sm text-slate-700">
                      <p className="inline-flex items-center gap-1.5"><UserIcon className="h-4 w-4 text-brand-blue" /><span><span className="font-semibold text-slate-800">Speaker:</span> {sessionModalEntry.speaker || 'Guest Speaker'}</span></p>
                      <p className="inline-flex items-center gap-1.5"><UserGroupIcon className="h-4 w-4 text-brand-blue" /><span><span className="font-semibold text-slate-800">Audience:</span> {sessionModalEntry.audience || 'Open to all'}</span></p>
                      <p className="inline-flex items-center gap-1.5"><MapPinIcon className="h-4 w-4 text-brand-blue" /><span><span className="font-semibold text-slate-800">Location:</span> {sessionModalEntry.location || 'Library Hall'}</span></p>
                    </div>
                    <div className="mt-3 border-b border-slate-200" />
                    <p className="mt-3 inline-flex items-start gap-2 text-sm leading-relaxed text-slate-700">
                      <DocumentTextIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                      <span>{sessionModalEntry.summary || 'Session details will be shared soon.'}</span>
                    </p>
                  </article>

                  <article className="flex h-full flex-col rounded-xl border border-slate-200 p-5">
                    <h4 className="flex items-center gap-2 font-heading text-lg font-semibold text-slate-900">
                      <IdentificationIcon className="h-5 w-5 text-brand-blue" />
                      <span>Person Details</span>
                    </h4>
                    <div className="mt-2 border-b border-slate-200" />
                    <form className="mt-3 flex h-full flex-col" onSubmit={registrationForm.handleSubmit((values) => registrationMutation.mutate(values))}>
                      {isAuthenticated ? <input type="hidden" {...registrationForm.register('name', { required: true })} /> : null}
                      {isAuthenticated ? <input type="hidden" {...registrationForm.register('email', { required: true })} /> : null}
                      {isAuthenticated ? <input type="hidden" {...registrationForm.register('contact')} /> : null}

                      {isAuthenticated ? (
                        <div className="space-y-1 text-sm text-slate-700">
                          <p className="flex items-center gap-1.5"><UserIcon className="h-4 w-4 text-brand-blue" /><span><span className="font-semibold text-slate-800">Name:</span> {registrationDefaults.name || '-'}</span></p>
                          <p className="flex items-center gap-1.5"><EnvelopeIcon className="h-4 w-4 text-brand-blue" /><span><span className="font-semibold text-slate-800">Email:</span> {registrationDefaults.email || '-'}</span></p>
                          <p className="flex items-center gap-1.5"><PhoneIcon className="h-4 w-4 text-brand-blue" /><span><span className="font-semibold text-slate-800">Phone:</span> {registrationDefaults.contact || '-'}</span></p>
                        </div>
                      ) : (
                        <div className="grid gap-2">
                          <label className="text-sm font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1"><UserIcon className="h-4 w-4 text-brand-blue" />Name</span>
                            <input
                              {...registrationForm.register('name', { required: true })}
                              required
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                              placeholder="Enter your name"
                            />
                          </label>
                          <label className="text-sm font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1"><EnvelopeIcon className="h-4 w-4 text-brand-blue" />Email</span>
                            <input
                              type="email"
                              {...registrationForm.register('email', { required: true })}
                              required
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                              placeholder="name@example.com"
                            />
                          </label>
                          <label className="text-sm font-medium text-slate-700">
                            <span className="inline-flex items-center gap-1"><PhoneIcon className="h-4 w-4 text-brand-blue" />Contact (optional)</span>
                            <PhoneInput
                              {...registrationForm.register('contact', { validate: (value) => !value || isTenDigitPhone(value) || TEN_DIGIT_PHONE_ERROR })}
                              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                            />
                          </label>
                        </div>
                      )}

                      <div className="mt-auto pt-4">
                        {isAlreadyRegisteredForSelectedSession ? (
                          <p className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><InformationCircleIcon className="h-4 w-4" />Already registered</p>
                        ) : null}

                        {!isAlreadyRegisteredForSelectedSession ? (
                          <Button type="submit" className="w-full" disabled={registrationMutation.isPending}>
                            <span className="inline-flex items-center gap-1.5">
                              <CheckBadgeIcon className="h-4 w-4" />
                              <span>{registrationMutation.isPending ? 'Saving...' : 'Save Registration'}</span>
                            </span>
                          </Button>
                        ) : null}
                      </div>
                    </form>
                  </article>
                </section>
              ) : (
                <p className="mt-4 inline-flex items-center gap-1 rounded-lg border border-brand-saffron/40 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
                  <InformationCircleIcon className="h-4 w-4" />
                  Event link is still syncing. Please open the Events page to register.
                </p>
              )}

            </div>
          </div>
        </div>
      ) : null}

      {mediaResources.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-2xl font-semibold text-brand-blue md:text-3xl">Media Resources</h3>
              <p className="text-xs text-slate-600">YouTube videos and audio links for learning more about Sikhism.</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mediaResources.slice(0, 6).map((entry) => {
              const embedUrl = entry.mediaType === 'youtube' ? getYouTubeEmbedUrl(entry.url) : '';
              const thumb = entry.thumbnailUrl || (entry.mediaType === 'youtube' ? getYouTubeThumbnail(entry.url) : '');
              const canPlayInModal = entry.mediaType === 'youtube' && Boolean(embedUrl);
              return (
                <div key={entry.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  {canPlayInModal ? (
                    <button
                      type="button"
                      onClick={() => setMediaModalId(entry.id)}
                      className="group relative block aspect-video w-full overflow-hidden bg-slate-800"
                    >
                      {thumb ? <img src={thumb} alt={entry.title} className="h-full w-full object-cover opacity-70 transition group-hover:opacity-50" /> : <div className="h-full w-full" />}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold text-white">Play YouTube Video</span>
                      </span>
                    </button>
                  ) : (
                    <a href={entry.url} target="_blank" rel="noreferrer" className="group relative block aspect-video w-full overflow-hidden bg-slate-800">
                      {thumb ? <img src={thumb} alt={entry.title} className="h-full w-full object-cover opacity-70 transition group-hover:opacity-50" /> : <div className="h-full w-full" />}
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="rounded-full bg-black/50 px-3 py-1.5 text-sm font-semibold text-white capitalize">{entry.mediaType === 'audio' ? '▶ Play Audio' : 'Open Link'}</span>
                      </span>
                    </a>
                  )}
                  <div className="p-2.5">
                    <p className="font-semibold text-sm text-slate-800 leading-snug">{entry.title}</p>
                    {entry.description ? <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{entry.description}</p> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {mediaModalEntry ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-slate-900/70" aria-hidden="true" onClick={() => setMediaModalId('')} />
          <div className="relative z-10 w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[92vh] overflow-y-auto">
            <div className="w-full bg-black">
              <div className="mx-auto aspect-[16/9] w-full max-h-[72vh]">
                <YouTubeAutoPlayPlayer
                  url={mediaModalEntry.url}
                  title={mediaModalEntry.title}
                  className="h-full w-full"
                />
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-heading text-base font-semibold text-slate-800">{mediaModalEntry.title}</h3>
                  {mediaModalEntry.description ? <p className="mt-1 text-xs text-slate-500">{mediaModalEntry.description}</p> : null}
                </div>
                <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100" onClick={() => setMediaModalId('')}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <a href={mediaModalEntry.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-lg bg-brand-blue px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">Open on YouTube →</a>
            </div>
          </div>
        </div>
      ) : null}

      {libraryFooterAds.length > 0 ? (
        <section className="rounded-xl py-2">
          <div className="grid w-full gap-2" style={libraryFooterAdsGridStyle}>
            {libraryFooterAds.map((ad) => (
              <a
                key={ad.id}
                href={ad.website || '#'}
                target="_blank"
                rel="noreferrer"
                onClick={() => {
                  if (ad.website) {
                    void advertisementService.recordAdClick(ad.id);
                  }
                }}
                className="block min-w-0 overflow-hidden rounded-lg transition hover:opacity-95"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className={`${libraryFooterAdImageHeightClass} w-full p-1 object-contain`} loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default LibraryPage;
