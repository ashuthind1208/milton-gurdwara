import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import AudioPillPlayer from '../../components/common/AudioPillPlayer';
import HomeHeroBanner from '../../components/common/HomeHeroBanner';
import SectionTitle from '../../components/common/SectionTitle';
import eventService from '../../services/eventService';
import galleryService from '../../services/galleryService';
import cmsService from '../../services/cmsService';
import hukamnamaService from '../../services/hukamnamaService';
import advertisementService from '../../services/advertisementService';
import newsService from '../../services/newsService';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const toDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeToken = (token) => {
  const match = String(token || '').trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3].toUpperCase();

  if (meridiem === 'PM' && hours < 12) {
    hours += 12;
  }
  if (meridiem === 'AM' && hours === 12) {
    hours = 0;
  }

  return (hours * 60) + minutes;
};

const resolveScheduleRowState = (timeEn, now = new Date()) => {
  const input = String(timeEn || '').trim();
  if (!input) {
    return { isCurrent: false, isPast: false };
  }

  const parts = input.split(/\s*-\s*/);
  const startMinutes = parseTimeToken(parts[0]);
  const endMinutes = parseTimeToken(parts[1] || '');
  if (startMinutes == null) {
    return { isCurrent: false, isPast: false };
  }

  const nowMinutes = (now.getHours() * 60) + now.getMinutes();
  if (endMinutes != null) {
    const effectiveEndMinutes = endMinutes > startMinutes ? endMinutes - 1 : endMinutes;
    return {
      isCurrent: nowMinutes >= startMinutes && nowMinutes <= effectiveEndMinutes,
      isPast: nowMinutes > effectiveEndMinutes
    };
  }

  return {
    isCurrent: Math.abs(nowMinutes - startMinutes) <= 20,
    isPast: nowMinutes > startMinutes + 20
  };
};

const resolveScheduleStartMinutes = (timeEn) => {
  const input = String(timeEn || '').trim();
  if (!input) {
    return Number.POSITIVE_INFINITY;
  }

  const parts = input.split(/\s*-\s*/);
  const startMinutes = parseTimeToken(parts[0]);
  return startMinutes == null ? Number.POSITIVE_INFINITY : startMinutes;
};

const HomePage = () => {
  const navigate = useNavigate();
  const meta = useSeoMeta('Home', 'Daily hukamnama, events, seva, donations, and Sikh education for the sangat.');
  const { data: events = [] } = useQuery({ queryKey: ['events'], queryFn: () => eventService.getEvents().then((res) => res.data) });
  const { data: albums = [] } = useQuery({ queryKey: ['albums'], queryFn: () => galleryService.getPublicAlbums().then((res) => res.data) });
  const { data: cmsData } = useQuery({ queryKey: ['cms-home'], queryFn: () => cmsService.getHomeContent().then((res) => res.data) });
  const todayDateKey = toDateKey(new Date());
  const { data: dailyHukamnama } = useQuery({ queryKey: ['daily-hukamnama', todayDateKey], queryFn: () => hukamnamaService.getDailyHukamnama(todayDateKey).then((res) => res.data) });
  const { data: ads = [] } = useQuery({ queryKey: ['advertisements'], queryFn: () => advertisementService.getAds().then((res) => res.data) });
  const { data: newsArticles = [] } = useQuery({ queryKey: ['news-articles'], queryFn: () => newsService.getArticles().then((res) => res.data) });
  const [selectedTickerEvent, setSelectedTickerEvent] = useState(null);
  const [selectedContentLink, setSelectedContentLink] = useState(null);
  const [selectedSevaCategory, setSelectedSevaCategory] = useState('All');
  const [selectedSevaPage, setSelectedSevaPage] = useState(1);
  const [homeReadAlongStopToken, setHomeReadAlongStopToken] = useState(0);
  const previousSelectedContentTypeRef = useRef(null);

  const tickerItems = useMemo(() => (events.length > 0 ? events : []), [events]);
  const latestArticle = useMemo(
    () => (newsArticles || []).find((article) => newsService.isLiveArticle(article)) || null,
    [newsArticles]
  );

  const langarItems = cmsData?.langarItems || [];
  const activeHukamnama = dailyHukamnama?.entry || null;
  const resolvedScheduleDay = useMemo(() => {
    const scheduleDays = Array.isArray(cmsData?.scheduleDays) ? cmsData.scheduleDays : [];
    const fallbackEntries = [
      ...(cmsData?.schedule?.morning || []).map((item) => ({ ...item, segment: 'morning', titleEn: item.label || '', timeEn: item.time || '' })),
      ...(cmsData?.schedule?.evening || []).map((item) => ({ ...item, segment: 'evening', titleEn: item.label || '', timeEn: item.time || '' }))
    ];

    if (scheduleDays.length === 0) {
      return {
        dateKey: 'default',
        title: 'Daily Schedule',
        highlightTitle: '',
        highlightNoteEn: '',
        highlightNotePa: '',
        entries: fallbackEntries
      };
    }

    return scheduleDays.find((day) => day.dateKey === todayDateKey)
      || scheduleDays.find((day) => day.dateKey === 'default')
      || scheduleDays[0];
  }, [cmsData, todayDateKey]);
  const scheduleRows = useMemo(() => {
    const entries = Array.isArray(resolvedScheduleDay?.entries) ? [...resolvedScheduleDay.entries] : [];

    entries.sort((left, right) => {
      const leftMinutes = resolveScheduleStartMinutes(left.timeEn);
      const rightMinutes = resolveScheduleStartMinutes(right.timeEn);

      if (leftMinutes !== rightMinutes) {
        return leftMinutes - rightMinutes;
      }

      return Number(left.sortOrder || 0) - Number(right.sortOrder || 0);
    });

    return entries.map((item) => ({
      ...item,
      ...resolveScheduleRowState(item.timeEn, new Date())
    }));
  }, [resolvedScheduleDay]);
  const morningScheduleRows = useMemo(
    () => scheduleRows.filter((item) => (item.segment || 'morning') === 'morning'),
    [scheduleRows]
  );
  const eveningScheduleRows = useMemo(
    () => scheduleRows.filter((item) => (item.segment || 'morning') !== 'morning'),
    [scheduleRows]
  );
  const isTodaySpecial = resolvedScheduleDay?.dateKey === todayDateKey && resolvedScheduleDay?.isSpecial !== false;
  const specialDayReason = (resolvedScheduleDay?.specialReason || resolvedScheduleDay?.highlightNoteEn || '').trim();
  const specialDayReasonPa = (resolvedScheduleDay?.specialReasonPa || resolvedScheduleDay?.highlightNotePa || '').trim();
  const specialDayTickerText = [specialDayReason, specialDayReasonPa].filter(Boolean).join(' • ');
  const hukamnamaLines = activeHukamnama?.lines || [];
  const hukamnamaMeta = activeHukamnama?.metadata || {};
  const hasDailyHukamnama = Boolean(activeHukamnama?.ang && hukamnamaLines.length > 0);
  const volunteerOptions = ['Langar', 'Cleaning', 'Parking', 'Teaching', 'Events'];
  const readAlongConfig = useMemo(() => hukamnamaService.getReadAlongConfig(), []);
  const homeHukamnamaAng = Math.max(0, Number(activeHukamnama?.ang || 0));
  const hukamnamaMetaPills = [
    activeHukamnama?.updatedAt ? { key: 'date', label: new Date(activeHukamnama.updatedAt).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) } : null,
    activeHukamnama?.metadata?.raag ? { key: 'raag', label: `Raag: ${activeHukamnama.metadata.raag}` } : null,
    activeHukamnama?.metadata?.writer ? { key: 'writer', label: `Written by: ${activeHukamnama.metadata.writer}` } : null
  ].filter(Boolean);
  const { data: homeReadAlongAudio, isFetching: homeReadAlongLoading } = useQuery({
    queryKey: ['home-hukamnama-read-along', homeHukamnamaAng],
    queryFn: () => hukamnamaService.getReadAlongAudioUrl(homeHukamnamaAng).then((res) => res.data),
    enabled: homeHukamnamaAng > 0 && readAlongConfig.enabled && hasDailyHukamnama
  });

  useEffect(() => {
    const previousSelectedContentType = previousSelectedContentTypeRef.current;
    const currentSelectedContentType = selectedContentLink?.type || null;

    if (previousSelectedContentType === 'hukamnama' && currentSelectedContentType !== 'hukamnama') {
      setHomeReadAlongStopToken((value) => value + 1);
    }

    previousSelectedContentTypeRef.current = currentSelectedContentType;
  }, [selectedContentLink]);

  const featuredAlbum = albums[0];
  const globalBannerAds = ads.filter((ad) => ad.active && ad.placement === 'Global Banner').slice(0, 2);
  const homeSidebarAds = ads.filter((ad) => ad.active && ad.placement === 'Homepage Sidebar').slice(0, 2);
  const homeFooterAds = ads.filter((ad) => ad.active && ad.placement === 'Homepage Footer').slice(0, 2);

  const openContentModal = (path) => {
    const previewMap = {
      '/events': {
        title: 'Upcoming Events',
        path: '/events',
        type: 'events',
        description: 'View the latest samagams, workshops, and seva gatherings.',
        items: events.slice(0, 4).map((event) => ({
          primary: event.title,
          secondary: new Date(event.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
        }))
      },
      '/hukamnama': {
        type: 'hukamnama',
        title: 'Daily Hukamnama',
        path: '/hukamnama',
        description: hasDailyHukamnama ? `Ang ${activeHukamnama?.ang || '-'} with full lines and translations.` : 'Today\'s hukamnama is not available yet.',
        metadata: hukamnamaMeta,
        items: hukamnamaLines
      },
      '/seva': {
        type: 'seva',
        title: 'Seva Opportunities',
        path: '/seva',
        description: 'Choose seva and register your participation with the sangat.',
        tickerItems: volunteerOptions,
        items: langarItems.map((entry) => ({
          primary: entry.name,
          category: entry.category || 'General',
          needed: Boolean(entry.needed),
          secondary: `${entry.addedOn} • ${entry.displayStatusLabel || (entry.needed ? 'Required Soon' : 'Stock Available')}`
        }))
      },
      '/donation': {
        title: 'Support Langar',
        path: '/donation',
        description: 'Your dasvandh supports langar, education, and community outreach.',
        items: [
          { primary: 'Langar Sewa', secondary: 'Weekly groceries, kitchen supplies, and serving support.' },
          { primary: 'Youth Programs', secondary: 'Punjabi school and Gurbani learning activities.' },
          { primary: 'Maintenance', secondary: 'Daily operations and sangat facilities upkeep.' }
        ]
      },
      '/news': {
        type: 'updates',
        title: 'Latest Updates',
        path: '/news',
        description: 'Recent announcements and important community updates.',
        items: (newsArticles || []).map((article) => ({
          primary: article.heading,
          secondary: `Published ${new Date(article.publishedAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })} • ${article.active ? 'Active' : 'Inactive'}`
        }))
      },
      '/gallery': {
        title: 'Gallery',
        path: '/gallery',
        description: 'Browse recent event photos and videos.',
        items: albums.slice(0, 3).map((album) => ({
          primary: album.title,
          secondary: `${album.items} items` 
        }))
      }
    };

    if (path === '/seva') {
      setSelectedSevaCategory('All');
      setSelectedSevaPage(1);
    }

    setSelectedContentLink(previewMap[path] || null);
  };

  return (
    <div className="min-w-0 space-y-3">
      <Seo {...meta} />

      <HomeHeroBanner
        content={cmsData?.hero}
        actions={null}
        onSlideAction={(path) => navigate(path)}
        topRightSlot={null}
      />

      <section className="ticker-shell ticker-shell-home overflow-hidden py-1">
        <div className="ticker-track">
          {[0, 1].map((groupIndex) => (
            <div key={groupIndex} className="ticker-group">
              {tickerItems.map((event) => (
                <button
                  key={`${groupIndex}-${event.id}`}
                  type="button"
                  className="ticker-item ticker-item-home mx-1 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/95 px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-900 transition hover:-translate-y-0.5 hover:bg-slate-200 hover:text-slate-900"
                  onClick={() => setSelectedTickerEvent(event)}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-brand-saffron" />
                  <span className="hidden font-black sm:inline">{event.category}</span>
                  <span className="max-w-[190px] truncate font-black sm:max-w-[280px]">{event.title}</span>
                  <span className="ticker-item-date rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-900">
                    {new Date(event.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                  </span>
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      {globalBannerAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {globalBannerAds.map((ad) => (
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
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full bg-slate-50 p-1 object-contain md:h-28" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      <section className="pb-8">
        <div className="min-w-0 grid gap-3 lg:grid-cols-[1.5fr_0.85fr]">
          <div className="min-w-0 space-y-3">
            <div className="rounded-xl border border-brand-blue/20 bg-white px-5 py-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <SectionTitle title="Daily Hukamnama" subtitle="Today's Gurbani with translation." />
                </div>
                <div className="w-full sm:w-[260px] sm:flex-shrink-0">
                  {hasDailyHukamnama && homeReadAlongAudio?.url ? (
                    <AudioPillPlayer
                      label="Singh Sabha Milton"
                      subtitle={`Ang ${homeHukamnamaAng}`}
                      src={homeReadAlongAudio.url}
                      stopSignal={homeReadAlongStopToken}
                    />
                  ) : (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {!hasDailyHukamnama
                        ? "Read along audio will appear after today's hukamnama is added."
                        : !readAlongConfig.enabled
                        ? 'Read along audio is currently disabled.'
                        : (homeReadAlongLoading ? 'Loading read along audio...' : `Read along audio is unavailable for Ang ${homeHukamnamaAng}.`)}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 h-px w-full bg-slate-200" />
              <div className="space-y-3 pt-4">
                {!hasDailyHukamnama ? (
                  <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">Today's hukamnama is not available yet.</p>
                ) : (hukamnamaLines.slice(0, 4)).map((line) => (
                  <div key={line.id}>
                    <p className="font-gurmukhi text-lg font-bold leading-relaxed text-brand-navy">{line.gurmukhi}</p>
                    {line.translationPunjabi ? <p className="mt-1 text-sm font-normal text-brand-saffron">Punjabi: {line.translationPunjabi}</p> : null}
                    {line.translationEnglish ? <p className="mt-0.5 text-sm font-normal text-brand-blue">English: {line.translationEnglish}</p> : null}
                  </div>
                ))}
              </div>
              {hasDailyHukamnama ? (
                <div className="mt-4 flex justify-end">
                  <button type="button" onClick={() => openContentModal('/hukamnama')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"><span>&gt;</span> Read all hukamnama</button>
                </div>
              ) : null}
            </div>

            <section className={`relative min-w-0 max-w-full overflow-hidden rounded-xl border px-5 py-4 ${isTodaySpecial ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'}`}>
              {isTodaySpecial ? (
                <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-800">
                  <span aria-hidden="true">✦</span>
                  Special Day
                </div>
              ) : null}

              <div className={`flex flex-wrap items-start justify-between gap-3 ${isTodaySpecial ? 'pt-8' : ''}`}>
                <SectionTitle title="Daily Schedule" subtitle="" />
              </div>

              {isTodaySpecial && specialDayTickerText ? (
                <div className="daily-schedule-special-ticker mt-2 w-full min-w-0 max-w-full overflow-hidden bg-brand-saffron">
                  <div className="ticker-mask px-3 py-1.5">
                    <div className="ticker-track daily-schedule-special-track ticker-speed-fast ticker-no-pause">
                      {[0, 1, 2, 3, 4, 5].map((groupIndex) => (
                        <div key={`special-day-note-${groupIndex}`} className="ticker-group">
                          <p className="daily-schedule-special-item inline-flex shrink-0 items-center text-sm font-extrabold text-amber-50">
                            <span>{specialDayTickerText}</span>
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 space-y-4">
                {scheduleRows.length === 0 ? (
                  <p className="py-4 text-sm text-slate-500">No schedule items available for this day.</p>
                ) : null}

                {morningScheduleRows.length > 0 ? (
                  <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-sky-200">
                    <div className="border-b border-sky-200 bg-sky-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-sky-800">Morning</div>
                    <table className="w-full table-fixed border-collapse text-left">
                      <tbody>
                        {morningScheduleRows.map((item) => (
                          <tr key={item.id} className={`border-t border-sky-100 ${item.isCurrent ? 'animate-pulse bg-brand-blue/15' : item.isHighlighted ? 'bg-sky-50/40' : 'bg-sky-50/25'} ${item.isActive === false ? 'opacity-45' : ''}`}>
                            <td className="w-[132px] py-3 pr-3 pl-2 align-top md:w-[170px] md:pr-4">
                              <div className="flex items-start gap-3">
                                <span className={`mt-1 inline-flex h-3 w-3 rounded-full ${item.isCurrent ? 'bg-green-500 shadow-[0_0_0_6px_rgba(34,197,94,0.18)]' : item.isHighlighted ? 'bg-brand-blue/80' : 'bg-slate-300'}`} />
                                <div className="min-w-0">
                                  <p className="whitespace-nowrap text-sm font-bold leading-snug text-slate-900">{item.timeEn || 'Time TBD'}</p>
                                  {item.timePa ? <p className="mt-1 whitespace-nowrap text-xs font-medium leading-snug text-slate-500">{item.timePa}</p> : null}
                                </div>
                              </div>
                            </td>
                            <td className="min-w-0 py-3 align-top">
                              <p className="schedule-cell-clip text-sm font-semibold text-slate-900">{item.titleEn || 'Untitled schedule item'}</p>
                              {item.titlePa ? <p className="schedule-cell-clip mt-1 text-sm text-brand-saffron">{item.titlePa}</p> : null}
                              {item.noteEn ? <p className="schedule-cell-clip mt-1 text-xs text-slate-600">{item.noteEn}</p> : null}
                              {item.notePa ? <p className="schedule-cell-clip mt-1 text-xs text-slate-500">{item.notePa}</p> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {eveningScheduleRows.length > 0 ? (
                  <div className="min-w-0 max-w-full overflow-hidden rounded-lg border border-amber-200">
                    <div className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-800">Evening</div>
                    <table className="w-full table-fixed border-collapse text-left">
                      <tbody>
                        {eveningScheduleRows.map((item) => (
                          <tr key={item.id} className={`border-t border-amber-100 ${item.isCurrent ? 'animate-pulse bg-brand-blue/15' : item.isHighlighted ? 'bg-sky-50/40' : item.segment === 'special' ? 'bg-violet-50/35' : 'bg-amber-50/35'} ${item.isActive === false ? 'opacity-45' : ''}`}>
                            <td className="w-[132px] py-3 pr-3 pl-2 align-top md:w-[170px] md:pr-4">
                              <div className="flex items-start gap-3">
                                <span className={`mt-1 inline-flex h-3 w-3 rounded-full ${item.isCurrent ? 'bg-green-500 shadow-[0_0_0_6px_rgba(34,197,94,0.18)]' : item.isHighlighted ? 'bg-brand-blue/80' : 'bg-slate-300'}`} />
                                <div className="min-w-0">
                                  <p className="whitespace-nowrap text-sm font-bold leading-snug text-slate-900">{item.timeEn || 'Time TBD'}</p>
                                  {item.timePa ? <p className="mt-1 whitespace-nowrap text-xs font-medium leading-snug text-slate-500">{item.timePa}</p> : null}
                                </div>
                              </div>
                            </td>
                            <td className="min-w-0 py-3 align-top">
                              <p className="schedule-cell-clip text-sm font-semibold text-slate-900">{item.titleEn || 'Untitled schedule item'}</p>
                              {item.titlePa ? <p className="schedule-cell-clip mt-1 text-sm text-brand-saffron">{item.titlePa}</p> : null}
                              {item.noteEn ? <p className="schedule-cell-clip mt-1 text-xs text-slate-600">{item.noteEn}</p> : null}
                              {item.notePa ? <p className="schedule-cell-clip mt-1 text-xs text-slate-500">{item.notePa}</p> : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          <div className="min-w-0 space-y-3 self-start">
            <aside className="rounded-xl border border-brand-blue/15 bg-white px-4 py-4">
              <h3 className="font-heading text-2xl font-bold text-brand-blue">Langar Seva Items</h3>
              <ul className="mt-3 divide-y divide-slate-100 text-sm">
                {langarItems.slice(0, 5).map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                    <div>
                      <p className="font-medium text-slate-700">{entry.name}</p>
                      <p className="text-xs text-slate-500">{entry.addedOn}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase ${entry.needed ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>{entry.displayStatusLabel || (entry.needed ? 'Required Soon' : 'Stock Available')}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-end">
                <button type="button" onClick={() => openContentModal('/seva')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-blue hover:underline"><span>&gt;</span> See all seva items</button>
              </div>
            </aside>

            <section className="rounded-xl border border-slate-200 bg-white px-4 py-4">
              <SectionTitle title="Latest Update" subtitle={latestArticle ? 'Community Update' : 'No active update'} />
              <h3 className="font-heading text-lg font-semibold text-slate-900">{latestArticle?.heading || 'No active updates at the moment.'}</h3>
              <p className="mt-1 text-sm text-slate-600">{latestArticle?.content || 'Please check the News page for upcoming announcements.'}</p>
              <div className="mt-2 flex justify-end">
                <button type="button" onClick={() => navigate('/news')} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"><span>&gt;</span> Read all updates</button>
              </div>
            </section>

            {featuredAlbum ? (
              <article className="rounded-xl border border-slate-200 bg-white px-4 py-4">
                <SectionTitle title="Gallery Highlight" subtitle={featuredAlbum.eventDate || 'Featured folder'} />
                <button
                  type="button"
                  onClick={() => navigate('/gallery', { state: { openAlbumId: featuredAlbum.id } })}
                  className="mt-2 w-full overflow-hidden rounded-lg"
                >
                  <img src={featuredAlbum.frontImage || featuredAlbum.coverUrl || featuredAlbum.coverImage || featuredAlbum.cover || ''} alt={featuredAlbum.title} className="h-36 w-full object-cover" loading="lazy" />
                </button>
                <h3 className="mt-2 font-heading text-lg font-semibold">{featuredAlbum.title}</h3>
                <div className="mt-1 flex justify-end">
                  <button type="button" onClick={() => navigate('/gallery', { state: { openAlbumId: featuredAlbum.id } })} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-blue hover:underline"><span>&gt;</span> View gallery</button>
                </div>
              </article>
            ) : null}

            {homeSidebarAds.map((ad) => (
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
                className="block overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-28 w-full bg-slate-50 p-2 object-contain md:h-32" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </div>
      </section>

      {homeFooterAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {homeFooterAds.map((ad) => (
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
                className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30"
              >
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full bg-slate-50 p-1 object-contain md:h-28" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}

      {selectedTickerEvent ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/45 px-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-blue">{selectedTickerEvent.category}</p>
                <h3 className="mt-1 font-heading text-2xl font-semibold text-slate-900">{selectedTickerEvent.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTickerEvent(null)}
                className="rounded-md border border-slate-200 px-2 py-1 text-sm text-slate-600"
              >
                Close
              </button>
            </div>
            <p className="mt-3 text-sm text-slate-600">Date: {new Date(selectedTickerEvent.date).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p className="text-sm text-slate-600">Location: {selectedTickerEvent.location}</p>
            <p className="text-sm text-slate-600">Registrations: {selectedTickerEvent.registrations}</p>
            <div className="mt-4 flex gap-3">
              <Link to="/events" onClick={() => setSelectedTickerEvent(null)} className="rounded-md bg-brand-blue px-3 py-2 text-sm font-semibold text-white">Open Events Page</Link>
              <button type="button" onClick={() => setSelectedTickerEvent(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Dismiss</button>
            </div>
          </div>
        </div>
      ) : null}

      {selectedContentLink ? (
        <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-900/45 px-3 py-4 sm:px-4">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-xl bg-white p-4 shadow-xl sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                {selectedContentLink.type === 'hukamnama' ? (
                  <div>
                    <div className="modal-meta-shell sm:hidden">
                      <div className="modal-meta-track modal-meta-scroll gap-2 pb-1 pr-1">
                        <div className="modal-meta-group gap-2 pr-2">
                          {hukamnamaMetaPills.map((pill) => (
                            <p key={pill.key} className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                              {pill.label}
                            </p>
                          ))}
                        </div>
                        <div className="modal-meta-group gap-2 pr-2" aria-hidden="true">
                          {hukamnamaMetaPills.map((pill) => (
                            <p key={`${pill.key}-clone`} className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                              {pill.label}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="hidden flex-nowrap gap-2 overflow-x-auto pb-1 pr-1 sm:flex">
                      {hukamnamaMetaPills.map((pill) => (
                        <p key={pill.key} className="shrink-0 whitespace-nowrap rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                          {pill.label}
                        </p>
                      ))}
                    </div>
                    {activeHukamnama?.ang ? <h3 className="mt-3 pt-1 font-heading text-3xl font-bold leading-tight text-slate-900 sm:text-4xl">ਅੰਗ {activeHukamnama.ang} | Ang {activeHukamnama.ang}</h3> : null}
                  </div>
                ) : (
                  <>
                    <h3 className="font-heading text-xl font-semibold text-slate-900 sm:text-2xl">{selectedContentLink.title}</h3>
                    <p className="mt-2 text-sm text-slate-600">{selectedContentLink.description}</p>
                  </>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedContentLink(null)}
                className="inline-flex h-8 w-8 shrink-0 flex-none items-center justify-center rounded-full border border-brand-blue bg-brand-blue text-lg leading-none text-white shadow-[0_8px_18px_rgba(10,77,159,0.3)] transition hover:border-brand-saffron hover:bg-brand-saffron hover:text-white"
                aria-label="Close modal"
              >
                ×
              </button>
            </div>

            {selectedContentLink.type === 'hukamnama' ? (
              <>
                <div className="mt-3 h-px bg-slate-200" />
                <div className="mt-4 max-h-[72vh] space-y-4 overflow-y-auto pr-1">
                  {(selectedContentLink.items || []).map((line) => (
                    <article key={line.id}>
                      <p className="mt-1 font-gurmukhi text-lg text-brand-navy">{line.gurmukhi}</p>
                      {line.translationPunjabi ? <p className="mt-1 text-sm font-normal text-brand-saffron">Punjabi: {line.translationPunjabi}</p> : null}
                      {line.translationEnglish ? <p className="mt-0.5 text-sm font-normal text-brand-blue">English: {line.translationEnglish}</p> : null}
                    </article>
                  ))}
                </div>
              </>
            ) : selectedContentLink.type === 'seva' ? (
              <>
                <h4 className="mt-4 text-sm font-semibold uppercase tracking-wide text-brand-blue">Langar Seva Items</h4>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['All', ...Array.from(new Set((selectedContentLink.items || []).map((item) => item.category || 'General')))].map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => {
                        setSelectedSevaCategory(category);
                        setSelectedSevaPage(1);
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${selectedSevaCategory === category ? 'bg-brand-blue text-white' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
                  {(() => {
                    const filteredItems = (selectedContentLink.items || [])
                      .filter((item) => selectedSevaCategory === 'All' || item.category === selectedSevaCategory);
                    const pageSize = 10;
                    const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
                    const safePage = Math.min(selectedSevaPage, totalPages);
                    const pageItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);

                    return (
                      <>
                        <ul className="divide-y divide-slate-100">
                          {pageItems.map((item) => (
                            <li key={`${item.primary}-${item.secondary}`} className="py-2">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{item.primary}</p>
                                <p className="text-xs text-slate-600">{item.category} • {item.secondary}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">Page {safePage} of {totalPages}</p>
                          <div className="flex gap-2">
                            <button type="button" disabled={safePage === 1} onClick={() => setSelectedSevaPage((prev) => Math.max(1, prev - 1))} className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50">Prev</button>
                            <button type="button" disabled={safePage === totalPages} onClick={() => setSelectedSevaPage((prev) => Math.min(totalPages, prev + 1))} className="rounded-md border border-slate-300 px-2 py-1 text-xs disabled:opacity-50">Next</button>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : selectedContentLink.type === 'updates' ? (
              <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
                <ul className="divide-y divide-slate-100">
                  {(selectedContentLink.items || []).map((item) => (
                    <li key={`${item.primary}-${item.secondary}`} className="py-3">
                      <p className="text-sm font-semibold text-slate-800">{item.primary}</p>
                      <p className="mt-1 text-xs text-slate-600 sm:text-sm">{item.secondary}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="mt-4 max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                {(selectedContentLink.items || []).map((item) => (
                  <article key={`${item.primary}-${item.secondary}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-semibold text-slate-800">{item.primary}</p>
                    <p className="mt-0.5 text-xs text-slate-600 sm:text-sm">{item.secondary}</p>
                  </article>
                ))}
              </div>
            )}

            {selectedContentLink.type !== 'hukamnama' ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:gap-3">
                {selectedContentLink.path ? <Link to={selectedContentLink.path} onClick={() => setSelectedContentLink(null)} className="rounded-md bg-brand-blue px-3 py-2 text-center text-sm font-semibold text-white">Open Full Page</Link> : null}
                <button type="button" onClick={() => setSelectedContentLink(null)} className="rounded-md border border-slate-300 px-3 py-2 text-sm">Close</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HomePage;
