import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarDaysIcon,
  PlusCircleIcon,
  PlayIcon,
  QueueListIcon,
  TicketIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { BookOpenIcon, DocumentTextIcon } from '@heroicons/react/24/solid';
import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import Card from '../../components/ui/Card';
import libraryService from '../../services/libraryService';
import eventService from '../../services/eventService';
import advertisementService from '../../services/advertisementService';
import { getYouTubeEmbedUrl, getYouTubeThumbnail } from '../../services/videoService';
import Button from '../../components/ui/Button';

const PAGE_SIZE = 10;

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
  const [physicalPage, setPhysicalPage] = useState(1);
  const [digitalPage, setDigitalPage] = useState(1);
  const [issueModalBookId, setIssueModalBookId] = useState('');
  const [sessionModalId, setSessionModalId] = useState('');
  const [mediaModalId, setMediaModalId] = useState('');
  const registrationForm = useForm({ defaultValues: { name: '', contact: '' } });

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

  const physicalBooks = useMemo(() => libraryData?.physicalBooks || [], [libraryData]);
  const digitalResources = useMemo(() => libraryData?.digitalResources || [], [libraryData]);
  const programUpdates = useMemo(() => libraryData?.programUpdates || [], [libraryData]);
  const mediaResources = useMemo(() => libraryData?.mediaResources || [], [libraryData]);
  const libraryTopAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Library Top Banner').slice(0, 2), [ads]);
  const libraryFooterAds = useMemo(() => ads.filter((ad) => ad.active && ad.placement === 'Library Footer Banner').slice(0, 2), [ads]);

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
    () => programUpdates.find((entry) => entry.id === sessionModalId) || null,
    [programUpdates, sessionModalId]
  );

  const mediaModalEntry = useMemo(
    () => mediaResources.find((entry) => entry.id === mediaModalId) || null,
    [mediaModalId, mediaResources]
  );

  const libraryTickerItems = useMemo(() => {
    const items = [
      ...programUpdates.slice(0, 4).map((entry) => ({
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
  }, [programUpdates, physicalBooks, mediaResources]);

  const sortedProgramUpdates = useMemo(() => {
    return [...programUpdates].sort((left, right) => {
      const leftStamp = `${left.scheduleDate || '1970-01-01'}T${left.scheduleTime || '00:00'}`;
      const rightStamp = `${right.scheduleDate || '1970-01-01'}T${right.scheduleTime || '00:00'}`;
      return new Date(leftStamp).getTime() - new Date(rightStamp).getTime();
    });
  }, [programUpdates]);

  const eventRegistrationsById = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      map.set(Number(event.id), Number(event.registrations || 0));
    });
    return map;
  }, [events]);

  const activeIssueRecords = useMemo(() => (
    (issueModalBook?.issueRecords || []).filter((record) => !record.returnedAt)
  ), [issueModalBook]);

  useEffect(() => {
    if (!sessionModalEntry) {
      registrationForm.reset({ name: '', contact: '' });
    }
  }, [sessionModalEntry, registrationForm]);

  const registrationMutation = useMutation({
    mutationFn: (values) => eventService.registerForEvent({
      eventId: sessionModalEntry?.eventId,
      name: values.name,
      contact: values.contact
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['admin-events'] });
      registrationForm.reset({ name: '', contact: '' });
      setSessionModalId('');
      window.alert('Registration saved successfully.');
    }
  });

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title="Library"
        description="Track available hard-copy books and browse downloadable Sikh learning material in one place."
      />

      {libraryTopAds.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {libraryTopAds.map((ad) => (
              <a key={ad.id} href={ad.targetLink || ad.website || '#'} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30">
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
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
        <p className="text-xs text-slate-500">Live feed from latest library additions and session updates.</p>
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
                {sortedProgramUpdates.map((entry) => (
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
                      <button
                        type="button"
                        onClick={() => setSessionModalId(entry.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/30 bg-blue-50 text-brand-blue transition hover:bg-blue-100"
                        title="Open registration modal"
                        aria-label={`Open registration modal for ${entry.title || 'library session'}`}
                      >
                        <TicketIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-brand-blue/20 bg-gradient-to-br from-blue-50 via-white to-amber-50 shadow-2xl">
            {sessionModalEntry.imageUrl ? (
              <img src={sessionModalEntry.imageUrl} alt={sessionModalEntry.title || 'Library session'} className="h-56 w-full object-cover" />
            ) : null}
            <div className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="inline-flex rounded-full bg-brand-blue/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-brand-blue">Library Session</p>
                  <h3 className="mt-2 font-heading text-xl font-semibold text-brand-blue">{sessionModalEntry.title}</h3>
                </div>
                <button type="button" className="rounded-md border border-brand-blue/20 bg-white/80 p-1 text-brand-blue hover:bg-brand-blue/10 hover:text-brand-blue" onClick={() => setSessionModalId('')}>
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-3 grid gap-2 rounded-xl border border-brand-blue/15 bg-white/85 p-3 text-sm text-slate-700 sm:grid-cols-2">
                <p><span className="font-semibold text-brand-blue">Speaker:</span> {sessionModalEntry.speaker || 'Guest Speaker'}</p>
                <p><span className="font-semibold text-brand-blue">Audience:</span> {sessionModalEntry.audience || 'Open to all'}</p>
                <p><span className="font-semibold text-brand-blue">Date:</span> {sessionModalEntry.scheduleDate || 'TBA'}</p>
                <p><span className="font-semibold text-brand-blue">Time:</span> {sessionModalEntry.scheduleTime || 'TBA'}</p>
                <p className="sm:col-span-2"><span className="font-semibold text-brand-blue">Location:</span> {sessionModalEntry.location || 'Library Hall'}</p>
              </div>
              <p className="mt-3 rounded-lg border border-brand-saffron/30 bg-amber-50/70 px-3 py-2 text-sm text-slate-700">{sessionModalEntry.summary || 'Session details will be shared soon.'}</p>

              {sessionModalEntry.eventId ? (
                <section className="mt-4 rounded-xl border border-brand-blue/25 bg-gradient-to-r from-blue-50 to-sky-50 p-3">
                  <h4 className="font-heading text-base font-semibold text-brand-blue">Register for This Session</h4>
                  <form className="mt-2 space-y-2.5" onSubmit={registrationForm.handleSubmit((values) => registrationMutation.mutate(values))}>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-brand-blue">Name
                      <input {...registrationForm.register('name', { required: true })} className="mt-1 w-full rounded-lg border border-brand-blue/25 bg-white px-2.5 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                    </label>
                    <label className="block text-xs font-semibold uppercase tracking-wide text-brand-blue">Contact
                      <input {...registrationForm.register('contact', { required: true })} className="mt-1 w-full rounded-lg border border-brand-blue/25 bg-white px-2.5 py-1.5 text-sm focus:border-brand-blue focus:outline-none focus:ring-2 focus:ring-brand-blue/20" />
                    </label>
                    <Button type="submit" className="w-full" disabled={registrationMutation.isPending}>
                      {registrationMutation.isPending ? 'Saving...' : 'Save Registration'}
                    </Button>
                  </form>
                </section>
              ) : (
                <p className="mt-4 rounded-lg border border-brand-saffron/40 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
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
        <section className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="grid gap-2 md:grid-cols-2">
            {libraryFooterAds.map((ad) => (
              <a key={ad.id} href={ad.targetLink || ad.website || '#'} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200 hover:border-brand-blue/30">
                {ad.bannerUrl ? <img src={ad.bannerUrl} alt={ad.title || 'Advertisement'} className="h-24 w-full object-cover" loading="lazy" /> : null}
              </a>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
};

export default LibraryPage;
