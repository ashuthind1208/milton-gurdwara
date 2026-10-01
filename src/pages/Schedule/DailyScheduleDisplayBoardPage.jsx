import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import cmsService, { resolveScheduleForDate } from '../../services/cmsService';
import { getNanakshahiDate } from '../../utils/punjabiCalendar';
import { useBranding } from '../../context/BrandingContext';

const HERO_IMAGE = 'https://assets.cdn.filesafe.space/b9aAKZlXnebGhQoRLosa/media/654583d092b8570d5a8c5f1a.png';
const toDateKey = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const parseTime = (value) => {
  const match = String(value || '').trim().match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return null;
  let hour = Number(match[1]);
  if (match[3].toUpperCase() === 'PM' && hour < 12) hour += 12;
  if (match[3].toUpperCase() === 'AM' && hour === 12) hour = 0;
  return hour * 60 + Number(match[2]);
};
const rowState = (time, now) => {
  const [start, end] = String(time || '').split(/\s*-\s*/).map(parseTime);
  const current = now.getHours() * 60 + now.getMinutes();
  if (start == null) return { current: false, past: false };
  const endMinute = end == null ? start + 20 : Math.max(start, end - 1);
  return { current: current >= start && current <= endMinute, past: current > endMinute };
};
const sortRows = (entries = []) => [...entries].sort((a, b) => (parseTime(a.timeEn || a.time) || 9999) - (parseTime(b.timeEn || b.time) || 9999));
const getSegment = (entry) => {
  const raw = String(entry.segment || '').trim().toLowerCase();
  const start = parseTime(entry.timeEn || entry.time);
  if (start != null && start < 12 * 60 && (raw === '' || raw === 'morning')) return 'morning';
  if (raw === 'afternoon' || raw === 'evening' || raw === 'morning') {
    if (raw === 'morning' && start != null && start >= 17 * 60) return 'evening';
    if (raw === 'morning' && start != null && start >= 12 * 60) return 'afternoon';
    return raw;
  }
  if (start == null) return 'morning';
  if (start >= 17 * 60) return 'evening';
  if (start >= 12 * 60) return 'afternoon';
  return 'morning';
};

const DailyScheduleDisplayBoardPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('Daily Schedule Display Board', 'Live daily schedule display with current activity and upcoming Sikh occasions.');
  const [now, setNow] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const { data: content } = useQuery({
    queryKey: ['daily-schedule-display-board-content'],
    queryFn: () => cmsService.getHomeContent().then((response) => response.data),
    refetchInterval: 10000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    const onFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreen);
    return () => { window.clearInterval(timer); document.removeEventListener('fullscreenchange', onFullscreen); };
  }, []);

  const todayKey = toDateKey(now);
  const days = useMemo(() => (Array.isArray(content?.scheduleDays) && content.scheduleDays.length
    ? content.scheduleDays
    : [{ dateKey: 'default', entries: [...(content?.schedule?.morning || []), ...(content?.schedule?.evening || [])] }]), [content]);
  const today = useMemo(() => resolveScheduleForDate(days, todayKey), [days, todayKey]);
  const rows = useMemo(() => sortRows(today?.entries || []).map((entry) => ({ ...entry, segmentKey: getSegment(entry), state: rowState(entry.timeEn || entry.time, now) })), [now, today]);
  const segments = useMemo(() => ({
    morning: rows.filter((entry) => entry.segmentKey === 'morning'),
    afternoon: rows.filter((entry) => entry.segmentKey === 'afternoon'),
    evening: rows.filter((entry) => entry.segmentKey === 'evening')
  }), [rows]);
  const todaySpecialText = String(today?.specialReason || today?.highlightNoteEn || '').trim();
  const todaySpecialTextPa = String(today?.specialReasonPa || today?.highlightNotePa || '').trim();
  const isTodaySpecial = Boolean(today?.isSpecial && today?.dateKey !== 'default');
  const upcoming = useMemo(() => {
    const date = new Date(now);
    date.setDate(date.getDate() + (7 - date.getDay() || 7));
    const sunday = resolveScheduleForDate(days, toDateKey(date));
    const special = days.filter((day) => day.dateKey && day.dateKey !== 'default' && day.dateKey > todayKey && day.isSpecial !== false)
      .sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0];
    return { sunday, sundayDate: toDateKey(date), special: special ? resolveScheduleForDate(days, special.dateKey) : null, specialDate: special?.dateKey || '' };
  }, [days, now, todayKey]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  };
  const formatDualDate = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const gregorian = date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `${gregorian} · ${getNanakshahiDate(date).label}`;
  };
  const renderScheduleRows = (scheduleRows) => scheduleRows.map((entry) => (
    <article key={entry.id || `${entry.timeEn}-${entry.titleEn}`} className={`grid grid-cols-[max-content_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/20 px-2 py-2.5 ${entry.state.past ? 'opacity-55' : ''}`}>
      <div className="flex min-w-0 items-center gap-2 whitespace-nowrap text-base font-bold text-cyan-100 sm:text-lg xl:text-xl"><ClockIcon className="h-5 w-5 shrink-0 text-cyan-200" /><span>{entry.timeEn || entry.time || 'Time TBD'}</span></div>
      <div className="min-w-0"><h3 className="break-words text-xl font-extrabold leading-tight text-white xl:text-2xl">{entry.titleEn || entry.label || 'Untitled activity'}</h3>{entry.titlePa ? <p className="mt-0.5 break-words font-gurmukhi text-base leading-snug text-amber-200 xl:text-lg">{entry.titlePa}</p> : null}{entry.noteEn ? <p className="mt-0.5 break-words text-base leading-snug text-slate-200">{entry.noteEn}</p> : null}{entry.notePa ? <p className="mt-0.5 break-words font-gurmukhi text-base leading-snug text-cyan-100">{entry.notePa}</p> : null}</div>
      {entry.state.current ? <span className="rounded-full bg-emerald-400 px-2.5 py-1 text-xs font-black uppercase tracking-wide text-[#06142f]">Live now</span> : <span />}
    </article>
  ));
  const renderSegment = (label, segmentRows, tone) => segmentRows.length ? (
    <section className={`min-h-0 ${label === 'Evening' ? 'pt-3' : ''}`}>
      <h3 className={`mb-1 flex items-center gap-2 px-2 py-1.5 text-base font-black uppercase tracking-[0.16em] ${tone}`}><span className="h-3 w-3 rounded-full bg-current" />{label}<span className="ml-auto text-sm font-semibold normal-case tracking-normal text-cyan-100/75">{segmentRows.length} activities</span></h3>
      <div>{renderScheduleRows(segmentRows)}</div>
    </section>
  ) : null;

  return (
    <>
      <Seo {...meta} />
      <div className="daily-schedule-board flex h-screen w-full flex-col overflow-hidden bg-[#06142f] text-white">
        <style>{`@keyframes schedule-glow { 0%,100% { box-shadow: 0 0 0 1px rgba(245,166,35,.35), 0 0 18px rgba(34,197,94,.12); } 50% { box-shadow: 0 0 0 2px rgba(245,166,35,.8), 0 0 34px rgba(34,197,94,.45); } } .schedule-current { animation: schedule-glow 2s ease-in-out infinite; } .daily-schedule-board * { scrollbar-width: none; } .daily-schedule-board *::-webkit-scrollbar { display: none; }`}</style>
        <header className="relative flex h-[22vh] min-h-[150px] max-h-[250px] shrink-0 items-center overflow-hidden bg-cover bg-center px-5 py-4 sm:px-8 lg:px-12" style={{ backgroundImage: `linear-gradient(90deg, rgba(3,20,48,.97) 0%, rgba(3,20,48,.92) 55%, rgba(3,20,48,.78) 80%, rgba(3,20,48,.16) 100%), url("${HERO_IMAGE}")` }}>
          <div className="absolute inset-0 bg-gradient-to-t from-[#06142f]/55 via-transparent to-[#06142f]/10" />
          <div className="relative flex w-full items-center gap-4">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-14 w-14 rounded-full border-2 border-brand-saffron bg-white/10 object-cover sm:h-20 sm:w-20" />
            <div className="min-w-0 flex-1 self-start pt-1">
              <p className="pt-3 text-sm font-bold uppercase tracking-[0.25em] text-amber-200 sm:text-base">{branding.shortName}</p>
              <h1 className="mt-1 font-heading text-4xl font-bold leading-none sm:text-5xl xl:text-6xl">Daily Schedule</h1>
              <p className="mt-2 text-base font-medium text-white sm:text-lg">Gurbani · Seva · Sangat</p>
            </div>
            <div className="hidden shrink-0 items-center gap-5 sm:flex"><div className="text-right drop-shadow-[0_2px_6px_rgba(0,0,0,.95)]"><p className="text-lg font-extrabold text-white xl:text-xl">{formatDualDate(todayKey)}</p><p className="mt-1 text-3xl font-black tabular-nums text-amber-200 xl:text-4xl">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p></div><button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg border border-white/50 bg-[#082c58]/85 px-4 py-3 text-sm font-bold text-white shadow-lg backdrop-blur">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</button></div>
            <button type="button" onClick={() => void toggleFullscreen()} className="absolute right-0 top-0 rounded-lg border border-white/25 bg-black/25 px-3 py-2 text-xs font-bold text-white sm:hidden">{isFullscreen ? 'Exit' : 'Fullscreen'}</button>
          </div>
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 sm:gap-4 sm:p-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,.75fr)]">
          <section className="flex min-h-0 flex-col overflow-hidden rounded-3xl border border-[#315a88] bg-gradient-to-br from-[#12386d] via-[#0c2d57] to-[#071b3b] p-3 text-white shadow-2xl sm:p-5 xl:p-6">
            <div className="mb-3 flex shrink-0 items-center justify-between border-b border-white/20 pb-3"><div><p className="text-base font-extrabold uppercase tracking-[0.2em] text-cyan-100 sm:text-lg">Today&apos;s activities</p><h2 className="mt-1 font-heading text-2xl font-bold text-white sm:text-3xl xl:text-4xl">Today at the Gurdwara</h2><p className="mt-1 text-sm font-bold text-amber-300 sm:text-base">{formatDualDate(todayKey)}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/50 bg-emerald-300/15 px-3 py-1.5 text-xs font-bold text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-300" />Live</span></div>
            {isTodaySpecial || todaySpecialText || todaySpecialTextPa ? <div className="mb-3 grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-300/20 via-orange-300/15 to-rose-300/15 p-3 sm:p-4"><SparklesIcon className="mt-0.5 h-6 w-6 text-amber-300" /><div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.15em] text-amber-200">{today?.highlightTitle || 'Special occasion'} <span className="ml-2 normal-case tracking-normal">· {formatDualDate(todayKey)}</span></p>{todaySpecialText ? <p className="mt-1 break-words text-base font-bold leading-snug text-white sm:text-lg">{todaySpecialText}</p> : null}{todaySpecialTextPa ? <p className="mt-1 break-words font-gurmukhi text-base leading-snug text-amber-100 sm:text-lg">{todaySpecialTextPa}</p> : null}</div></div> : null}
            <div className="min-h-0 flex-1 space-y-3 overflow-hidden xl:space-y-4">
              {renderSegment('Morning', segments.morning, 'text-amber-300')}
              {renderSegment('Afternoon', segments.afternoon, 'text-sky-300')}
              {renderSegment('Evening', segments.evening, 'text-violet-300')}
              {!rows.length ? <p className="rounded-xl border border-white/15 bg-white/10 p-6 text-center text-slate-200">No activities are scheduled for today.</p> : null}
            </div>
            <p className="mt-2 shrink-0 text-right text-[10px] font-semibold text-white/50 sm:hidden">{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</p>
          </section>

          <aside className="grid min-h-0 grid-cols-1 gap-3 overflow-hidden sm:grid-cols-2 xl:grid-cols-1 xl:grid-rows-2">
            <section className="min-h-0 overflow-hidden rounded-3xl border border-[#d6b76c] bg-gradient-to-br from-[#f2dfb5] via-[#f8edd2] to-[#e7eef8] p-4 text-[#102b4d] shadow-xl sm:p-5">
              <div className="flex items-center gap-2 text-amber-800"><CalendarDaysIcon className="h-6 w-6" /><p className="text-xs font-black uppercase tracking-[0.18em]">Upcoming Sunday</p></div>
              <h2 className="mt-2 font-heading text-3xl font-bold text-[#12365d] sm:text-4xl">Sunday Schedule</h2><p className="mt-1 text-base font-bold text-amber-900 sm:text-lg">{formatDualDate(upcoming.sundayDate)}</p><hr className="my-3 h-px w-full border-0 bg-amber-800/30" />
              <div className="overflow-hidden">{sortRows(upcoming.sunday?.entries || []).slice(0, 4).map((entry) => <div key={entry.id || entry.timeEn} className="grid grid-cols-[max-content_minmax(0,1fr)] gap-3 border-b border-[#12365d]/25 py-2.5 text-base last:border-b-0"><span className="whitespace-nowrap font-bold text-[#174a7c]">{entry.timeEn || entry.time || 'Time TBD'}</span><span className="min-w-0 break-words font-semibold text-slate-900">{entry.titleEn || entry.label}</span></div>)}</div>
            </section>
            <section className="min-h-0 overflow-hidden rounded-3xl border border-[#9bbde1] bg-gradient-to-br from-[#d9e9fa] via-[#edf4fc] to-[#dce7f4] p-4 text-[#102b4d] shadow-xl sm:p-5">
              <div className="flex items-center gap-2 text-[#176082]"><SparklesIcon className="h-6 w-6" /><p className="text-xs font-black uppercase tracking-[0.18em]">Upcoming special occasion</p></div>
              {upcoming.special ? <><h2 className="mt-2 break-words font-heading text-2xl font-bold text-[#12365d] sm:text-3xl">{upcoming.special.title || 'Special occasion'}</h2><p className="mt-1 break-words text-sm font-bold text-amber-800 sm:text-base">{formatDualDate(upcoming.specialDate)}</p><div className="mt-3 border-t border-sky-200" /><div className="mt-2 max-h-[calc(100%-7rem)] space-y-1 overflow-hidden">{[upcoming.special.specialReason || upcoming.special.highlightNoteEn, upcoming.special.specialReasonPa || upcoming.special.highlightNotePa].filter(Boolean).map((text) => <p key={text} className="break-words text-sm leading-snug text-slate-700">{text}</p>)}</div></> : <><h2 className="mt-3 font-heading text-xl font-bold text-slate-600">No special occasion posted</h2><div className="mt-3 border-t border-sky-200" /><p className="mt-3 text-sm text-slate-500">Upcoming special schedules will appear here.</p></>}
            </section>
          </aside>
        </main>
      </div>
    </>
  );
};

export default DailyScheduleDisplayBoardPage;
