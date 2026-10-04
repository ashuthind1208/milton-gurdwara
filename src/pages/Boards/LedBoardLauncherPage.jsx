import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowTopRightOnSquareIcon, CalendarDaysIcon, ClipboardDocumentIcon, GiftIcon, MegaphoneIcon, PlayIcon, QueueListIcon, SparklesIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import LedSlideshow from '../../components/boards/LedSlideshow';
import useSeoMeta from '../../hooks/useSeoMeta';
import ledAnnouncementService, { isAnnouncementLive } from '../../services/ledAnnouncementService';
import { useBranding } from '../../context/BrandingContext';

const SETTINGS_STORAGE_KEY = 'ssm_led_slideshow_v1';
const MIN_INTERVAL_SECONDS = 3;
const MAX_INTERVAL_SECONDS = 600;
const DEFAULT_INTERVAL_SECONDS = 15;
const INTERVAL_PRESETS = [10, 15, 30, 60];

const boards = [
  { key: 'donation', title: 'Donation Board', description: 'Live campaigns, progress, donors, and donation QR code.', path: '/donation-board', embedParams: { fullscreen: '1' }, icon: GiftIcon, accent: 'border-amber-300 bg-amber-50 text-amber-800' },
  { key: 'events', title: 'Events Calendar Board', description: 'Upcoming events, Nanakshahi dates, and registration activity.', path: '/event-calendar-board', icon: CalendarDaysIcon, accent: 'border-sky-300 bg-sky-50 text-sky-800' },
  { key: 'langar', title: 'Langar Needs Board', description: 'Current grocery needs, progress, contributors, and QR code.', path: '/langar-board', icon: QueueListIcon, accent: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { key: 'schedule', title: 'Daily Schedule Board', description: 'Today\'s activities with the ongoing program highlighted.', path: '/daily-schedule-board', icon: Squares2X2Icon, accent: 'border-blue-300 bg-blue-50 text-blue-800' },
  { key: 'granthi', title: 'Ask a Granthi Board', description: 'A public question screen for the sangat.', path: '/ask-a-granthi?screen=welcome', icon: SparklesIcon, accent: 'border-violet-300 bg-violet-50 text-violet-800' },
  { key: 'special', title: 'Special Events Board', description: 'Event photos and formatted announcements managed from the admin portal.', path: '/special-events-board', icon: MegaphoneIcon, accent: 'border-rose-300 bg-rose-50 text-rose-800', isAnnouncementBoard: true }
];

const allBoardKeys = boards.map((board) => board.key);

const clampInterval = (value) => Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.round(Number(value) || DEFAULT_INTERVAL_SECONDS)));

const readSavedSettings = () => {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) || 'null');
    return {
      selected: Array.isArray(saved?.selected) ? saved.selected.filter((key) => allBoardKeys.includes(key)) : allBoardKeys,
      intervalSeconds: clampInterval(saved?.intervalSeconds)
    };
  } catch {
    return { selected: allBoardKeys, intervalSeconds: DEFAULT_INTERVAL_SECONDS };
  }
};

const toEmbedSrc = (board) => {
  const url = new URL(board.path, window.location.origin);
  url.searchParams.set('embed', '1');
  Object.entries(board.embedParams || {}).forEach(([name, value]) => url.searchParams.set(name, value));
  return `${url.pathname}${url.search}`;
};

const formatDuration = (totalSeconds) => {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (!minutes) return `${seconds}s`;
  return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
};

const LedBoardLauncherPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('LED Board Launcher', 'Open the Singh Sabha Milton LED display boards.');
  const [copiedKey, setCopiedKey] = useState('');
  const [initialSettings] = useState(readSavedSettings);
  const [selectedKeys, setSelectedKeys] = useState(initialSettings.selected);
  const [intervalSeconds, setIntervalSeconds] = useState(initialSettings.intervalSeconds);
  const [intervalDraft, setIntervalDraft] = useState(String(initialSettings.intervalSeconds));
  const [slideshowRunning, setSlideshowRunning] = useState(false);
  const origin = useMemo(() => window.location.origin, []);

  const { data: announcements = [] } = useQuery({
    queryKey: ['led-board-announcements'],
    queryFn: () => ledAnnouncementService.getAnnouncements().then((response) => response.data),
    refetchInterval: 20000
  });
  const liveAnnouncements = useMemo(() => announcements.filter((entry) => isAnnouncementLive(entry)), [announcements]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify({ selected: selectedKeys, intervalSeconds }));
    } catch {
      // Settings are a convenience; the launcher works without storage.
    }
  }, [selectedKeys, intervalSeconds]);

  const slides = useMemo(() => boards
    .filter((board) => selectedKeys.includes(board.key))
    .flatMap((board) => (board.isAnnouncementBoard
      ? liveAnnouncements.map((announcement) => ({ key: `announcement:${announcement.id}`, kind: 'announcement', label: `Special Event · ${announcement.title || 'Announcement'}`, announcement }))
      : [{ key: `board:${board.key}`, kind: 'board', label: board.title, src: toEmbedSrc(board) }])), [liveAnnouncements, selectedKeys]);

  const toggleBoard = (key) => setSelectedKeys((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));

  const commitInterval = (value) => {
    const next = clampInterval(value);
    setIntervalSeconds(next);
    setIntervalDraft(String(next));
  };

  const stopSlideshow = useCallback(() => setSlideshowRunning(false), []);

  const copyUrl = async (board) => {
    const url = `${origin}${board.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(board.key);
      window.setTimeout(() => setCopiedKey(''), 1800);
    } catch {
      window.prompt('Copy this LED board URL:', url);
    }
  };

  return (
    <>
      <Seo {...meta} />
      <main className="min-h-screen bg-gradient-to-br from-brand-cream via-white to-blue-50 px-4 py-8 text-slate-900 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <header className="flex items-center gap-4 border-b border-brand-blue/15 pb-6">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-16 w-16 rounded-full border-2 border-brand-saffron object-cover" />
            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.24em] text-brand-blue">{branding.shortName}</p><h1 className="mt-1 font-heading text-4xl font-bold text-brand-navy sm:text-5xl">LED Board Launcher</h1><p className="mt-1 text-sm text-slate-600">Open a single board, or choose boards below and run them as a slideshow.</p></div>
          </header>

          <section className="mt-6 rounded-2xl border border-brand-blue/20 bg-white p-5 shadow-sm" aria-labelledby="slideshow-heading">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 id="slideshow-heading" className="font-heading text-2xl font-bold text-brand-navy">Slideshow</h2>
                <p className="mt-1 text-sm text-slate-600">Tick the boards to include, set how long each stays on screen, then start.</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label htmlFor="slideshow-interval" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Seconds per slide</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input id="slideshow-interval" type="number" inputMode="numeric" min={MIN_INTERVAL_SECONDS} max={MAX_INTERVAL_SECONDS} value={intervalDraft} onChange={(event) => setIntervalDraft(event.target.value)} onBlur={() => commitInterval(intervalDraft)} onKeyDown={(event) => { if (event.key === 'Enter') commitInterval(intervalDraft); }} className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20" />
                    <div className="flex gap-1" role="group" aria-label="Interval presets">
                      {INTERVAL_PRESETS.map((preset) => <button key={preset} type="button" onClick={() => commitInterval(preset)} aria-pressed={intervalSeconds === preset} className={`rounded-lg border px-2.5 py-2 text-xs font-bold ${intervalSeconds === preset ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{preset}s</button>)}
                    </div>
                  </div>
                </div>
                <button type="button" onClick={() => setSlideshowRunning(true)} disabled={!slides.length} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand-saffron px-5 py-2.5 text-sm font-extrabold text-brand-navy shadow hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"><PlayIcon className="h-5 w-5" /> Start slideshow</button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-sm">
              <p className="font-semibold text-slate-700" aria-live="polite">
                {slides.length ? `${slides.length} slide${slides.length === 1 ? '' : 's'} · full cycle ${formatDuration(slides.length * intervalSeconds)}` : 'No slides selected. Tick at least one board with content.'}
              </p>
              <div className="flex gap-3 text-xs font-bold">
                <button type="button" onClick={() => setSelectedKeys(allBoardKeys)} className="text-brand-blue hover:underline">Select all</button>
                <button type="button" onClick={() => setSelectedKeys([])} className="text-slate-500 hover:underline">Clear</button>
              </div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => {
              const Icon = board.icon;
              const url = `${origin}${board.path}`;
              const isSelected = selectedKeys.includes(board.key);
              const hasNoContent = board.isAnnouncementBoard && liveAnnouncements.length === 0;
              return <article key={board.key} className={`flex min-h-[220px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${isSelected ? 'border-brand-blue ring-2 ring-brand-blue/20' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${board.accent}`}><Icon className="h-6 w-6" /></div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50">
                    <input type="checkbox" checked={isSelected} onChange={() => toggleBoard(board.key)} className="h-4 w-4" />
                    In slideshow
                  </label>
                </div>
                <h2 className="mt-4 font-heading text-2xl font-bold text-brand-navy">{board.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{board.description}</p>
                {board.isAnnouncementBoard ? <p className={`mt-2 text-xs font-bold ${hasNoContent ? 'text-amber-700' : 'text-emerald-700'}`}>{hasNoContent ? 'No active announcements. Skipped in the slideshow until one is added.' : `${liveAnnouncements.length} active announcement${liveAnnouncements.length === 1 ? '' : 's'}, one slide each`}</p> : null}
                <p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500" title={url}>{url}</p><div className="mt-3 flex gap-2"><a href={board.path} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-blue px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><ArrowTopRightOnSquareIcon className="h-4 w-4" /> Open board</a><button type="button" onClick={() => void copyUrl(board)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" title="Copy board URL"><ClipboardDocumentIcon className="h-4 w-4" />{copiedKey === board.key ? 'Copied' : 'Copy'}</button></div>
              </article>;
            })}
          </section>
        </div>
      </main>
      {slideshowRunning && slides.length ? <LedSlideshow slides={slides} intervalSeconds={intervalSeconds} onExit={stopSlideshow} /> : null}
    </>
  );
};

export default LedBoardLauncherPage;
