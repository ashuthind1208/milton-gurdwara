import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import {
  Bars3Icon,
  XMarkIcon,
  PauseIcon,
  PlayIcon,
  PlayCircleIcon,
  HomeIcon,
  InformationCircleIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  HandRaisedIcon,
  GiftIcon,
  PhotoIcon,
  PhoneIcon,
  FilmIcon
} from '@heroicons/react/24/outline';
import { publicNav } from '../../constants/navigation';
import { siteConfig } from '../../constants/siteConfig';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';
import { getNanakshahiDate, getUpcomingPunjabiObservances } from '../../utils/punjabiCalendar';
import streamingService from '../../services/streamingService';
import StreamingModal from '../common/StreamingModal';
import AudioPillPlayer from '../common/AudioPillPlayer';

const navClass = ({ isActive }) =>
  `border-b-[3px] px-3 py-2 text-base font-semibold tracking-tight transition ${isActive ? 'border-brand-saffron text-brand-blue' : 'border-transparent text-slate-600 hover:border-slate-200 hover:text-brand-blue'}`;

const compactNavClass = ({ isActive }) =>
  `border-b-[2px] px-1.5 py-1 text-[13px] font-bold tracking-tight text-brand-blue transition ${isActive ? 'border-brand-saffron' : 'border-transparent hover:border-brand-blue/30'}`;

const iconClass = 'h-4.5 w-4.5';
const socialGlyphClass = 'h-3.5 w-3.5';
const streamGlyphClass = 'h-6 w-6';
const darbarSahibDirectFallbackUrl = 'https://live.sgpc.net:8442/';

const WebsiteGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" fill="none" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const YouTubeGlyph = () => (
  <svg viewBox="0 0 24 24" className={streamGlyphClass} aria-hidden="true">
    <path d="M22 12c0 2.5-.3 4.2-.7 5.2a3.6 3.6 0 0 1-2 2C18.2 19.6 16.5 20 12 20s-6.2-.4-7.3-.8a3.6 3.6 0 0 1-2-2C2.3 16.2 2 14.5 2 12s.3-4.2.7-5.2a3.6 3.6 0 0 1 2-2C5.8 4.4 7.5 4 12 4s6.2.4 7.3.8a3.6 3.6 0 0 1 2 2c.4 1 .7 2.7.7 5.2Z" fill="currentColor" />
    <path d="m10 9 5 3-5 3V9Z" fill="#f5a623" />
  </svg>
);

const LiveStreamGlyph = () => (
  <svg viewBox="0 0 24 24" className={streamGlyphClass} aria-hidden="true">
    <path d="M22 12c0 2.5-.3 4.2-.7 5.2a3.6 3.6 0 0 1-2 2C18.2 19.6 16.5 20 12 20s-6.2-.4-7.3-.8a3.6 3.6 0 0 1-2-2C2.3 16.2 2 14.5 2 12s.3-4.2.7-5.2a3.6 3.6 0 0 1 2-2C5.8 4.4 7.5 4 12 4s6.2.4 7.3.8a3.6 3.6 0 0 1 2 2c.4 1 .7 2.7.7 5.2Z" fill="#0a4d9f" />
    <path d="m10 9 5 3-5 3V9Z" fill="#ffffff" />
    <circle cx="19" cy="6.5" r="1.6" fill="#f5a623" />
  </svg>
);

const FacebookGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <path d="M13.6 22V13.3h2.9l.4-3.4h-3.3V7.8c0-1 .3-1.7 1.8-1.7H17V3.1c-.8-.1-1.6-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.4v2.5H7.6v3.4h2.8V22h3.2Z" fill="currentColor" />
  </svg>
);

const InstagramGlyph = () => (
  <svg viewBox="0 0 24 24" className={socialGlyphClass} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
  </svg>
);

const leftMenu = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'About', path: '/about', icon: InformationCircleIcon },
  { label: 'Sikhism', path: '/sikhism', icon: BookOpenIcon },
  { label: 'Events', path: '/events', icon: CalendarDaysIcon }
];

const rightMenu = [
  { label: 'Library', path: '/library', icon: BookOpenIcon },
  { label: 'Videos', path: '/videos', icon: FilmIcon },
  { label: 'Seva', path: '/seva', icon: HandRaisedIcon },
  { label: 'Donation', path: '/donation', icon: GiftIcon },
  { label: 'Gallery', path: '/gallery', icon: PhotoIcon },
  { label: 'Contact', path: '/contact', icon: PhoneIcon }
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [compactStreamsOpen, setCompactStreamsOpen] = useState(false);
  const [dateInfoOpen, setDateInfoOpen] = useState(false);
  const [isKirtanPlaying, setIsKirtanPlaying] = useState(false);
  const [isKirtanLoading, setIsKirtanLoading] = useState(false);
  const [streamModalState, setStreamModalState] = useState({ open: false, id: '' });
  const liveAudioRef = useRef(null);
  const kirtanRetryTimeoutRef = useRef(null);
  const kirtanPlaybackRequestedRef = useRef(false);
  const kirtanPausedByUserRef = useRef(false);
  const kirtanUseDirectFallbackRef = useRef(false);
  const kirtanReconnectInFlightRef = useRef(false);
  const compactScrollRestoreRef = useRef(null);
  const compactRestoreFramesRef = useRef({ first: 0, second: 0 });
  const preserveCompactUntilRef = useRef(0);
  const nanakshahiDate = useMemo(() => getNanakshahiDate(new Date()), []);
  const location = useLocation();
  const { data: streamingItems = [] } = useQuery({
    queryKey: ['streaming-config'],
    queryFn: () => streamingService.getStreamingItems().then((res) => res.data)
  });
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const upcomingObservances = useMemo(() => getUpcomingPunjabiObservances(20, new Date()), []);

  const leftMenuBalanced = useMemo(() => {
    const libraryFromRight = rightMenu.find((item) => item.path === '/library');
    return libraryFromRight ? [...leftMenu, libraryFromRight] : leftMenu;
  }, []);
  const rightMenuBalanced = useMemo(() => rightMenu.filter((item) => item.path !== '/library'), []);
  const compactMenuItems = useMemo(
    () => [...leftMenuBalanced, ...rightMenuBalanced].filter((item) => item.path !== '/'),
    [leftMenuBalanced, rightMenuBalanced]
  );
  const mobileMenuItems = useMemo(
    () => publicNav.filter((item) => item.path !== '/gurbani-library' && item.path !== '/faq'),
    []
  );

  useEffect(() => {
    const onScroll = () => {
      if (Date.now() < preserveCompactUntilRef.current) {
        setIsCompact(true);
        return;
      }
      setIsCompact(window.scrollY > 56);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (compactScrollRestoreRef.current == null) {
      return undefined;
    }

    const restoreY = compactScrollRestoreRef.current;
    const safeRestoreY = Math.max(restoreY, 76);
    setIsCompact(true);

    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        window.scrollTo({ top: safeRestoreY, behavior: 'auto' });
        setIsCompact(true);
        compactScrollRestoreRef.current = null;
      });
      compactRestoreFramesRef.current.second = frameTwo;
    });
    compactRestoreFramesRef.current.first = frameOne;

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [location.pathname]);

  useEffect(() => {
    setCompactStreamsOpen(false);
    setDateInfoOpen(false);
  }, [location.pathname]);

  const liveStreams = useMemo(
    () => streamingItems.filter((entry) => entry?.streamUrl && entry?.active),
    [streamingItems]
  );
  const miltonPrimaryStream = useMemo(() => {
    if (liveStreams.length === 0) {
      return null;
    }

    return liveStreams.find((stream) => {
      const haystack = `${stream?.title || ''} ${stream?.text || ''} ${stream?.streamUrl || ''}`.toLowerCase();
      return haystack.includes('milton') || haystack.includes('singh sabha');
    }) || null;
  }, [liveStreams]);
  const secondaryLiveStreams = useMemo(
    () => liveStreams.filter((stream) => stream.id !== miltonPrimaryStream?.id),
    [liveStreams, miltonPrimaryStream?.id]
  );
  const todayObservance = useMemo(
    () => upcomingObservances.find((entry) => entry.date === todayIso) || null,
    [todayIso, upcomingObservances]
  );

  const dateContext = useMemo(() => {
    const weekdayEn = new Date().toLocaleDateString('en-CA', { weekday: 'long' });
    const monthInsight = {
      Chet: {
        en: 'Chet marks renewal and fresh spiritual beginnings in the Nanakshahi cycle.',
        pa: 'ਚੇਤ ਨਵੇਂ ਆਰੰਭ ਅਤੇ ਰੂਹਾਨੀ ਤਾਜ਼ਗੀ ਦਾ ਮਹੀਨਾ ਮੰਨਿਆ ਜਾਂਦਾ ਹੈ।'
      },
      Vaisakh: {
        en: 'Vaisakh inspires discipline, seva, and gratitude for collective growth.',
        pa: 'ਵੈਸਾਖ ਸੇਵਾ, ਅਨੁਸ਼ਾਸਨ ਅਤੇ ਸੰਗਤਕ ਇਕਤਾ ਦੀ ਯਾਦ ਦਿਵਾਂਦਾ ਹੈ।'
      },
      Jeth: {
        en: 'Jeth emphasizes steadiness in simran and humility in daily conduct.',
        pa: 'ਜੇਠ ਸਿਮਰਨ ਵਿੱਚ ਨਿਰੰਤਰਤਾ ਅਤੇ ਜੀਵਨ ਵਿੱਚ ਨਿਮਰਤਾ ਦਾ ਸੰਦੇਸ਼ ਦਿੰਦਾ ਹੈ।'
      },
      Harh: {
        en: 'Harh reminds us to stay cool in thought and deep in Naam, even in intensity.',
        pa: 'ਹਾੜ ਗਰਮੀ ਵਿੱਚ ਵੀ ਚਿੱਤ ਸ਼ਾਂਤ ਰੱਖ ਕੇ ਨਾਮ ਨਾਲ ਜੋੜ ਬਣਾਈ ਰੱਖਣ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
      },
      Sawan: {
        en: 'Sawan is often associated with devotion, reflection, and heartfelt prayer.',
        pa: 'ਸਾਵਣ ਭਗਤੀ, ਮਨਨ ਅਤੇ ਅਰਦਾਸ ਭਰੇ ਜੀਵਨ ਦੀ ਪ੍ਰੇਰਣਾ ਨਾਲ ਜੋੜਿਆ ਜਾਂਦਾ ਹੈ।'
      },
      Bhadon: {
        en: 'Bhadon calls for patience, service, and strengthening one another in sangat.',
        pa: 'ਭਾਦੋਂ ਸਬਰ, ਸੇਵਾ ਅਤੇ ਸੰਗਤਕ ਸਹਿਯੋਗ ਨੂੰ ਮਜ਼ਬੂਤ ਕਰਨ ਦਾ ਸੰਦੇਸ਼ ਦਿੰਦਾ ਹੈ।'
      },
      Assu: {
        en: 'Assu encourages introspection and conscious spiritual commitments.',
        pa: 'ਅੱਸੂ ਅੰਤਰ-ਝਾਤ ਅਤੇ ਰੂਹਾਨੀ ਵਚਨਬੱਧਤਾ ਨੂੰ ਮਜ਼ਬੂਤ ਕਰਨ ਦੀ ਯਾਦ ਦਿਵਾਂਦਾ ਹੈ।'
      },
      Katak: {
        en: 'Katak inspires remembrance of Gurmat values through daily discipline.',
        pa: 'ਕੱਤਕ ਗੁਰਮਤ ਮੁੱਲਾਂ ਨੂੰ ਰੋਜ਼ਾਨਾ ਜੀਵਨ ਵਿੱਚ ਪੱਕਾ ਕਰਨ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
      },
      Maghar: {
        en: 'Maghar emphasizes resilience and hope through Guru-centered living.',
        pa: 'ਮੱਘਰ ਗੁਰੂ ਕੇਂਦਰਿਤ ਜੀਵਨ ਰਾਹੀਂ ਹੌਂਸਲਾ ਅਤੇ ਆਸ ਕਾਇਮ ਰੱਖਣ ਦਾ ਸੰਦੇਸ਼ ਦਿੰਦਾ ਹੈ।'
      },
      Poh: {
        en: 'Poh is a time for courage, remembrance, and steadfast faith.',
        pa: 'ਪੋਹ ਹਿੰਮਤ, ਯਾਦ ਅਤੇ ਅਡੋਲ ਵਿਸ਼ਵਾਸ ਦਾ ਮਹੀਨਾ ਮੰਨਿਆ ਜਾਂਦਾ ਹੈ।'
      },
      Magh: {
        en: 'Magh invites deeper sangat connection and focused spiritual practice.',
        pa: 'ਮਾਘ ਸੰਗਤ ਨਾਲ ਗਹਿਰੇ ਜੋੜ ਅਤੇ ਕੇਂਦ੍ਰਿਤ ਰੂਹਾਨੀ ਅਭਿਆਸ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
      },
      Phagun: {
        en: 'Phagun reflects joy in divine love, unity, and gratitude.',
        pa: 'ਫੱਗਣ ਇਸ਼ਕੀ-ਇਲਾਹੀ, ਇਕਤਾ ਅਤੇ ਸ਼ੁਕਰਾਨੇ ਦੀ ਖੁਸ਼ੀ ਨਾਲ ਜੁੜਿਆ ਮਹੀਨਾ ਹੈ।'
      }
    };

    const fallbackInsight = {
      en: 'This day invites us to stay connected to Gurbani, seva, and sangat.',
      pa: 'ਇਹ ਦਿਨ ਸਾਨੂੰ ਗੁਰਬਾਣੀ, ਸੇਵਾ ਅਤੇ ਸੰਗਤ ਨਾਲ ਜੁੜੇ ਰਹਿਣ ਦੀ ਯਾਦ ਦਿਵਾਂਦਾ ਹੈ।'
    };

    return {
      weekdayEn,
      insight: monthInsight[nanakshahiDate.month] || fallbackInsight
    };
  }, [nanakshahiDate.month]);

  const clearKirtanRetryTimer = () => {
    if (kirtanRetryTimeoutRef.current) {
      window.clearTimeout(kirtanRetryTimeoutRef.current);
      kirtanRetryTimeoutRef.current = null;
    }
  };

  const resolveKirtanStreamUrl = () => {
    const configured = String(siteConfig.liveKirtanStreamUrl || '').trim();
    if (kirtanUseDirectFallbackRef.current && /^\/api\/streaming\/darbar-sahib\/live\/?$/i.test(configured)) {
      return darbarSahibDirectFallbackUrl;
    }
    return configured;
  };

  const scheduleKirtanReconnect = () => {
    if (!kirtanPlaybackRequestedRef.current) {
      return;
    }

    if (kirtanRetryTimeoutRef.current || kirtanReconnectInFlightRef.current) {
      return;
    }

    kirtanRetryTimeoutRef.current = window.setTimeout(async () => {
      kirtanRetryTimeoutRef.current = null;
      if (!kirtanPlaybackRequestedRef.current || !liveAudioRef.current) {
        return;
      }

      const baseStreamUrl = resolveKirtanStreamUrl();
      if (!baseStreamUrl) {
        setIsKirtanPlaying(false);
        setIsKirtanLoading(false);
        return;
      }

      try {
        kirtanReconnectInFlightRef.current = true;
        const separator = baseStreamUrl.includes('?') ? '&' : '?';
        const refreshedUrl = `${baseStreamUrl}${separator}t=${Date.now()}`;
        setIsKirtanLoading(true);
        liveAudioRef.current.src = refreshedUrl;
        liveAudioRef.current.load();
        await liveAudioRef.current.play();
      } catch {
        if (!kirtanUseDirectFallbackRef.current && /^\/api\/streaming\/darbar-sahib\/live\/?$/i.test(String(siteConfig.liveKirtanStreamUrl || '').trim())) {
          kirtanUseDirectFallbackRef.current = true;
        }
        setIsKirtanPlaying(false);
        setIsKirtanLoading(false);
        kirtanReconnectInFlightRef.current = false;
        scheduleKirtanReconnect();
        return;
      }

      kirtanReconnectInFlightRef.current = false;
    }, 2200);
  };

  useEffect(() => () => {
    clearKirtanRetryTimer();
    kirtanReconnectInFlightRef.current = false;
  }, []);

  const toggleLiveKirtan = async () => {
    if (!liveAudioRef.current) {
      return;
    }

    const baseStreamUrl = resolveKirtanStreamUrl();
    if (!baseStreamUrl) {
      kirtanPlaybackRequestedRef.current = false;
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      return;
    }

    if (isKirtanPlaying) {
      kirtanPlaybackRequestedRef.current = false;
      kirtanPausedByUserRef.current = true;
      clearKirtanRetryTimer();
      kirtanReconnectInFlightRef.current = false;
      liveAudioRef.current.pause();
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      return;
    }

    try {
      kirtanPlaybackRequestedRef.current = true;
      kirtanPausedByUserRef.current = false;
      kirtanUseDirectFallbackRef.current = false;
      clearKirtanRetryTimer();
      kirtanReconnectInFlightRef.current = false;
      const separator = baseStreamUrl.includes('?') ? '&' : '?';
      const refreshedUrl = `${baseStreamUrl}${separator}t=${Date.now()}`;
      setIsKirtanLoading(true);
      liveAudioRef.current.src = refreshedUrl;
      liveAudioRef.current.load();
      await liveAudioRef.current.play();
      setIsKirtanPlaying(true);
      setIsKirtanLoading(false);
    } catch {
      if (!kirtanUseDirectFallbackRef.current && /^\/api\/streaming\/darbar-sahib\/live\/?$/i.test(String(siteConfig.liveKirtanStreamUrl || '').trim())) {
        kirtanUseDirectFallbackRef.current = true;
      }
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      scheduleKirtanReconnect();
    }
  };

  const statusDotClass = isKirtanPlaying ? 'bg-emerald-400' : (isKirtanLoading ? 'bg-amber-300' : 'bg-red-400');
  const featuredStream = miltonPrimaryStream || liveStreams[0] || null;

  const openStreamModal = (id) => {
    setStreamModalState({ open: true, id });
  };

  const handleCompactNavClick = () => {
    compactScrollRestoreRef.current = window.scrollY;
    preserveCompactUntilRef.current = Date.now() + 800;
  };

  return (
    <header className={`sticky top-0 z-50 bg-gradient-to-b from-blue-50/85 via-white to-amber-50/70 shadow-[0_6px_24px_-8px_rgba(10,77,159,0.18)] ring-1 ring-slate-200/70 backdrop-blur-md transition-all duration-300 ${isCompact ? 'pb-1' : ''}`}>
      <div className="hidden bg-brand-navy px-4 py-1 text-xs text-blue-50 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between md:px-2">
          <div className="flex items-center gap-2">
            <p>{siteConfig.contact.address}</p>
            <span className="text-blue-200">|</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-white hover:bg-blue-800/40"
                onClick={toggleLiveKirtan}
                aria-label={isKirtanPlaying ? 'Pause live kirtan' : 'Play live kirtan'}
              >
                {isKirtanPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              </button>
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
              <span className="text-[11px] font-semibold text-blue-50">Live Kirtan from Darbar Sahib</span>
              <audio
                ref={liveAudioRef}
                src={siteConfig.liveKirtanStreamUrl}
                preload="none"
                onPlaying={() => {
                  clearKirtanRetryTimer();
                  kirtanReconnectInFlightRef.current = false;
                  kirtanPausedByUserRef.current = false;
                  setIsKirtanPlaying(true);
                  setIsKirtanLoading(false);
                }}
                onPause={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(kirtanPlaybackRequestedRef.current && !kirtanPausedByUserRef.current);
                }}
                onEnded={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(kirtanPlaybackRequestedRef.current);
                  if (kirtanPlaybackRequestedRef.current && !kirtanPausedByUserRef.current) {
                    scheduleKirtanReconnect();
                  }
                }}
                onWaiting={() => setIsKirtanLoading(true)}
                onStalled={() => {
                  setIsKirtanLoading(true);
                  if (kirtanPlaybackRequestedRef.current && !kirtanPausedByUserRef.current) {
                    scheduleKirtanReconnect();
                  }
                }}
                onError={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(false);
                  scheduleKirtanReconnect();
                }}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDateInfoOpen(true)}
              className="max-w-[340px] truncate whitespace-nowrap rounded-full border border-blue-200/30 px-2 py-0.5 text-[11px] font-extrabold leading-none tracking-tight text-blue-50 transition hover:bg-blue-800/40"
              title="View Nanakshahi date details"
              aria-label="View Nanakshahi date details"
            >
              {nanakshahiDate.labelPa}
            </button>
            <Link to="/login?mode=admin&next=/admin" className="rounded-full border border-blue-200/40 px-2 py-0.5 text-[11px] font-semibold text-blue-50 hover:bg-blue-800/40">Admin Portal</Link>
            <Link to="/login?mode=join&type=volunteer" className="rounded-full border border-blue-200/40 px-2 py-0.5 text-[11px] font-semibold text-blue-50 hover:bg-blue-800/40">Join Volunteer</Link>
            <a href={siteConfig.baseUrl} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="Website">
              <WebsiteGlyph />
            </a>
            <a href={siteConfig.social.youtube} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="YouTube">
                <YouTubeGlyph />
            </a>
            <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="Facebook">
              <FacebookGlyph />
            </a>
            <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer" className="text-blue-50/90 transition hover:text-white" aria-label="Instagram">
              <InstagramGlyph />
            </a>
          </div>
        </div>
      </div>

      <div className="w-full bg-gradient-to-r from-blue-50/55 via-white/95 to-amber-50/45">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className={`relative hidden items-center transition-[min-height,padding] duration-500 ease-in-out lg:flex ${isCompact ? 'min-h-[86px] py-2' : 'min-h-[146px] py-2'}`}>
          <Link
            to="/"
            preventScrollReset={isCompact}
            onClick={isCompact ? handleCompactNavClick : undefined}
            className={`absolute top-1/2 z-20 flex -translate-y-1/2 items-center justify-center text-brand-blue transition-all duration-500 ease-in-out ${isCompact ? 'left-0 translate-x-0' : 'left-1/2 -translate-x-1/2'}`}
          >
            <img
              src={gurdwaraLogo}
              alt="Gurdwara Singh Sabha Milton logo"
              className={`rounded-full border-2 border-brand-saffron object-cover shadow-[0_4px_16px_rgba(245,166,35,0.25)] transition-all duration-500 ease-in-out ${isCompact ? 'h-[4.5rem] w-[4.5rem]' : 'h-[7.7rem] w-[7.7rem]'}`}
            />
          </Link>

          {!isCompact ? (
            <>
              <nav className="flex w-full items-center justify-between pr-8" aria-label="Left navigation">
                {leftMenuBalanced.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.path} to={item.path} className={navClass}>
                      <span className="inline-flex items-center gap-1.5"><Icon className={iconClass} /> {item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="w-[7.5rem] shrink-0" aria-hidden="true" />

              <div className="flex w-full items-center justify-end pl-8">
                <nav className="flex w-full items-center justify-between" aria-label="Right navigation">
                  {rightMenuBalanced.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink key={item.path} to={item.path} preventScrollReset className={navClass}>
                        <span className="inline-flex items-center gap-1.5"><Icon className={iconClass} /> {item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            </>
          ) : (
            <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(210px,36%)] items-center gap-2 pl-[5.4rem]">
              <nav className="flex min-w-0 items-center overflow-x-auto pr-2" aria-label="Compact navigation">
                {compactMenuItems.map((item) => (
                  <span key={item.path} className="inline-flex items-center whitespace-nowrap">
                    <NavLink to={item.path} preventScrollReset onClick={handleCompactNavClick} className={compactNavClass}>
                      {item.label}
                    </NavLink>
                    {item.path !== compactMenuItems[compactMenuItems.length - 1]?.path ? (
                      <span aria-hidden="true" className="mx-2 inline-flex items-center justify-center text-[18px] font-black leading-none text-brand-blue">.</span>
                    ) : null}
                  </span>
                ))}
              </nav>

              <div className="flex min-w-0 items-center justify-end pr-2">
                {liveStreams.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCompactStreamsOpen(true)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-brand-blue/20 bg-gradient-to-r from-white via-blue-50 to-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-blue shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-brand-blue/40"
                  >
                    <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-amber-100 text-brand-blue shadow-inner">
                      <LiveStreamGlyph />
                    </span>
                    <span>View all live channels</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      <div className="lg:hidden px-4 pb-4 pt-1">
        <div className="flex items-center">
          <div className="flex w-1/3 justify-start">
            <Link to="/" className="inline-flex items-center" aria-label="Go to homepage">
              <img
                src={gurdwaraLogo}
                alt="Gurdwara Singh Sabha Milton logo"
                className="h-[4.5rem] w-[4.5rem] rounded-full border border-brand-saffron object-cover"
              />
            </Link>
          </div>

          <div className="flex w-1/3 justify-center">
            {liveStreams.length > 0 ? (
              <button
                type="button"
                onClick={() => setCompactStreamsOpen(true)}
                className="rounded-full bg-brand-blue px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(10,77,159,0.35)] [animation:pulse_2.1s_ease-in-out_infinite]"
              >
                Watch Live
              </button>
            ) : null}
          </div>

          <div className="flex w-1/3 justify-end">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="z-[240] rounded-lg p-2 text-slate-700"
              aria-label="Open mobile menu"
              aria-expanded={open}
            >
              {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {!isCompact ? (
        <div className="hidden border-b-2 border-brand-blue/45 bg-gradient-to-r from-blue-50/60 via-white to-amber-50/55 pb-5 pt-1 md:block">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 md:px-6">
              {miltonPrimaryStream ? (
                <div className="flex justify-center pt-0.5 pb-3">
                  <button
                    type="button"
                    onClick={() => openStreamModal(miltonPrimaryStream.id)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-brand-saffron bg-brand-blue px-6 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_10px_28px_rgba(10,77,159,0.45)] transition hover:-translate-y-0.5 hover:bg-blue-700 [animation:pulse_2.1s_ease-in-out_infinite]"
                  >
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-saffron" />
                    Milton Gurdwara Live Stream
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {secondaryLiveStreams.length > 0
            ? secondaryLiveStreams.map((stream) => {
                const title = stream.title || 'Live Stream';
                const buttonLabel = title.length > 50 ? `${title.slice(0, 50)}...` : title;

                return (
                    <button
                    key={stream.id}
                    type="button"
                    onClick={() => openStreamModal(stream.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/20 bg-gradient-to-r from-white via-blue-50 to-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-brand-blue/40"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-amber-100 text-brand-blue shadow-inner">
                      <LiveStreamGlyph />
                    </span>
                    <span className="max-w-[320px] animate-pulse truncate">{buttonLabel}</span>
                  </button>
                );
              })
            : null}
              </div>
        </div>
        </div>
      ) : null}

      {compactStreamsOpen ? createPortal(
        <div className="fixed inset-0 z-[220] overflow-y-auto bg-slate-950/60 px-4 py-6" onClick={() => setCompactStreamsOpen(false)}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="inline-flex items-center gap-2 text-lg font-bold text-brand-blue">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-brand-blue">
                    <YouTubeGlyph />
                  </span>
                  Live Streaming
                </h3>
                <button
                  type="button"
                  onClick={() => setCompactStreamsOpen(false)}
                  className="rounded-full border border-slate-200 p-1.5 text-slate-600 hover:border-brand-blue hover:text-brand-blue"
                  aria-label="Close live channels list"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="px-3 pt-3">
                <AudioPillPlayer
                  label="Live Kirtan"
                  subtitle="Sri Darbar Sahib audio"
                  src={siteConfig.liveKirtanStreamUrl}
                  className="w-full"
                />
              </div>
              <ul className="max-h-[60vh] overflow-y-auto px-2 py-2">
                {miltonPrimaryStream ? (
                  <li className="px-1 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCompactStreamsOpen(false);
                        openStreamModal(miltonPrimaryStream.id);
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-brand-blue/20 bg-blue-50 px-3 py-2 text-left"
                    >
                      <span className="text-sm font-extrabold uppercase tracking-wide text-brand-blue">Milton Gurdwara Live Stream</span>
                      <span className="inline-flex shrink-0 rounded-full bg-brand-blue px-2 py-0.5 text-[11px] font-semibold text-white">Watch</span>
                    </button>
                  </li>
                ) : null}
                {secondaryLiveStreams.map((stream) => (
                  <li key={stream.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCompactStreamsOpen(false);
                        openStreamModal(stream.id);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-blue-50"
                    >
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-brand-blue">
                          <PlayCircleIcon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-brand-blue">{stream.title || 'Live Stream'}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{stream.text || 'Open channel'}</span>
                        </span>
                      </span>
                      <span className="ml-3 inline-flex items-center gap-2">
                        <span className="inline-flex shrink-0 rounded-full border border-brand-blue/20 bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-blue">Open</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      , document.body) : null}

      {dateInfoOpen ? createPortal(
        <div className="fixed inset-0 z-[230] overflow-y-auto bg-slate-950/65 px-4 py-6" onClick={() => setDateInfoOpen(false)}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 bg-blue-50 px-4 py-3">
                <h3 className="text-lg font-bold text-brand-blue">Nanakshahi Date Details</h3>
                <button
                  type="button"
                  onClick={() => setDateInfoOpen(false)}
                  className="rounded-full border border-slate-200 p-1.5 text-slate-600 hover:border-brand-blue hover:text-brand-blue"
                  aria-label="Close Nanakshahi date details"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Today</p>
                  <p className="mt-1 text-xl font-bold text-brand-blue">{nanakshahiDate.labelPa}</p>
                  <p className="mt-1 text-sm text-slate-700">{nanakshahiDate.label} • {dateContext.weekdayEn}</p>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <p className="text-sm font-semibold text-slate-800">ਅੱਜ ਦੀ ਰੂਹਾਨੀ ਸੋਚ</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{dateContext.insight.pa}</p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-800">Today’s Significance</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{dateContext.insight.en}</p>
                </div>

                {todayObservance ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm font-semibold text-amber-900">Today in Sikh Calendar</p>
                    <p className="mt-1 text-sm font-semibold text-amber-900">{todayObservance.titlePa}</p>
                    <p className="text-sm text-amber-800">{todayObservance.title}</p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">No major fixed observance is listed for today in the current calendar set.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body) : null}

      {streamModalState.open ? (
        <StreamingModal
          open={streamModalState.open}
          streams={liveStreams}
          initialStreamId={streamModalState.id || featuredStream?.id || ''}
          onClose={() => setStreamModalState({ open: false, id: '' })}
        />
      ) : null}

      {open ? (
        <div className="max-h-[calc(100vh-6.5rem)] overflow-y-auto border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-3 lg:hidden">
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <Link
              to="/login?mode=admin&next=/admin"
              className="rounded-xl border border-brand-blue/20 bg-brand-blue px-3 py-2 text-center text-sm font-semibold text-white"
              onClick={() => setOpen(false)}
            >
              Admin Portal
            </Link>
            <Link
              to="/login?mode=join&type=volunteer"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700"
              onClick={() => setOpen(false)}
            >
              Join Volunteer
            </Link>
          </div>
          <div className="grid gap-2">
            {mobileMenuItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={navClass} onClick={() => setOpen(false)}>
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
