import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, ClockIcon, SparklesIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import cmsService, { resolveScheduleForDate } from '../../services/cmsService';
import { getNanakshahiDate } from '../../utils/punjabiCalendar';
import { useBranding } from '../../context/BrandingContext';

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
  const days = useMemo(() => (Array.isArray(content?.scheduleDays) && content.scheduleDays.length ? content.scheduleDays : [{ dateKey: 'default', entries: [...(content?.schedule?.morning || []), ...(content?.schedule?.evening || [])] }]), [content]);
  const today = useMemo(() => resolveScheduleForDate(days, todayKey), [days, todayKey]);
  const rows = useMemo(() => sortRows(today?.entries || []).map((entry) => ({ ...entry, state: rowState(entry.timeEn || entry.time, now) })), [now, today]);
  const morningRows = useMemo(() => rows.filter((entry) => (entry.segment || 'morning') === 'morning'), [rows]);
  const eveningRows = useMemo(() => rows.filter((entry) => (entry.segment || 'morning') !== 'morning'), [rows]);
  const todaySpecialText = String(today?.specialReason || today?.highlightNoteEn || '').trim();
  const todaySpecialTextPa = String(today?.specialReasonPa || today?.highlightNotePa || '').trim();
  const upcoming = useMemo(() => {
    const date = new Date(now);
    date.setDate(date.getDate() + (7 - date.getDay() || 7));
    const sunday = resolveScheduleForDate(days, toDateKey(date));
    const special = days.filter((day) => day.dateKey && day.dateKey !== 'default' && day.dateKey > todayKey && day.isSpecial !== false).sort((a, b) => a.dateKey.localeCompare(b.dateKey))[0];
    return { sunday, sundayDate: toDateKey(date), special: special ? resolveScheduleForDate(days, special.dateKey) : null, specialDate: special?.dateKey || '' };
  }, [days, now, todayKey]);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  };
  const renderPreviewRows = (schedule) => sortRows(schedule?.entries || []).slice(0, 4);
  const formatDualDate = (dateValue) => {
    if (!dateValue) return '';
    const date = new Date(`${dateValue}T12:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    const gregorian = date.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    return `${gregorian} · ${getNanakshahiDate(date).label}`;
  };
  const renderScheduleRows = (scheduleRows) => scheduleRows.map((entry) => <article key={entry.id || `${entry.timeEn}-${entry.titleEn}`} className={`rounded-2xl border p-3 transition ${entry.state.current ? 'schedule-current border-brand-saffron bg-brand-saffron/15' : entry.state.past ? 'border-white/10 bg-white/5 opacity-60' : 'border-white/20 bg-sky-300/15'}`}><div className="grid grid-cols-[10.5rem_minmax(0,1fr)_auto] items-start gap-3"><div className="flex min-w-0 items-start gap-2 whitespace-nowrap text-sm font-bold text-cyan-100"><ClockIcon className={`mt-0.5 h-5 w-5 shrink-0 ${entry.state.current ? 'text-brand-saffron' : 'text-cyan-200'}`} /><span>{entry.timeEn || entry.time || 'Time TBD'}</span></div><div className="min-w-0 break-words"><h3 className="text-lg font-extrabold leading-tight">{entry.titleEn || entry.label || 'Untitled activity'}</h3>{entry.titlePa ? <p className="mt-0.5 font-gurmukhi text-sm leading-tight text-brand-saffron">{entry.titlePa}</p> : null}{entry.noteEn ? <p className="mt-0.5 text-xs leading-tight text-slate-300">{entry.noteEn}</p> : null}{entry.notePa ? <p className="mt-0.5 font-gurmukhi text-xs leading-tight text-cyan-100">{entry.notePa}</p> : null}</div>{entry.state.current ? <span className="shrink-0 rounded-full bg-emerald-400 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#06142f]">Ongoing</span> : <span />}</div></article>);
  const renderPreviewSection = (label, scheduleRows) => {
    if (!scheduleRows.length) return null;
    return <section className={label === 'Morning' ? 'border-t border-brand-saffron/40 pt-3' : 'pt-2'}><p className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-brand-saffron">{label}</p><div className="space-y-2">{scheduleRows.map((entry) => <div key={entry.id || entry.timeEn} className="grid grid-cols-[max-content_minmax(0,1fr)] gap-2 border-b border-white/15 pb-2 text-sm"><span className="whitespace-nowrap font-bold text-cyan-100">{entry.timeEn || entry.time || 'Time TBD'}</span><div className="min-w-0 break-words font-semibold">{entry.titleEn || entry.label}{entry.titlePa ? <p className="font-gurmukhi text-xs font-normal text-cyan-100">{entry.titlePa}</p> : null}</div></div>)}</div></section>;
  };
  const renderPreviewSections = (schedule) => {
    const previewRows = sortRows(schedule?.entries || []);
    return <div className="mt-4 space-y-3">{renderPreviewSection('Morning', previewRows.filter((entry) => (entry.segment || 'morning') === 'morning').slice(0, 4))}{renderPreviewSection('Evening', previewRows.filter((entry) => (entry.segment || 'morning') !== 'morning').slice(0, 4))}</div>;
  };

  return (
    <>
      <Seo {...meta} />
      <div className="daily-schedule-board min-h-screen w-full overflow-x-hidden bg-[#06142f] text-white">
        <style>{`@keyframes schedule-glow { 0%,100% { box-shadow: 0 0 0 1px rgba(245,166,35,.35), 0 0 18px rgba(34,197,94,.12); } 50% { box-shadow: 0 0 0 2px rgba(245,166,35,.8), 0 0 34px rgba(34,197,94,.45); } } @keyframes schedule-special-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } } .schedule-current { animation: schedule-glow 2s ease-in-out infinite; } .schedule-special-ticker { animation: schedule-special-ticker 34s linear infinite; } .daily-schedule-board aside > section:first-child { display: grid; grid-template-columns: auto minmax(0,1fr); column-gap: .55rem; } .daily-schedule-board aside > section:first-child > div:first-child { display: contents; } .daily-schedule-board aside > section:first-child > div:first-child p { display: none; } .daily-schedule-board aside > section:first-child > div:first-child svg { grid-column: 1; grid-row: 1; } .daily-schedule-board aside > section:first-child > h2 { grid-column: 2; grid-row: 1; margin-top: 0; } .daily-schedule-board aside > section:first-child > p { grid-column: 1 / -1; } .daily-schedule-board aside > section:first-child > div:last-child { grid-column: 1 / -1; }`}</style>
        <div className="mx-auto flex min-h-screen w-full flex-col px-5 py-5 sm:px-8 lg:px-10">
          <header className="flex items-center gap-4 pb-4"><img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-16 w-16 rounded-full border-2 border-brand-saffron object-cover" /><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.25em] text-brand-saffron">{branding.shortName}</p><h1 className="font-heading text-4xl font-bold leading-none sm:text-5xl">Daily Schedule</h1><p className="mt-1 text-sm text-cyan-100">Gurbani, seva, and sangat activities for today</p>{todaySpecialText || todaySpecialTextPa ? <div className="mt-3 max-w-full overflow-hidden rounded-xl border border-brand-saffron/40 bg-gradient-to-r from-amber-300/25 via-orange-300/20 to-rose-300/25 px-3 py-2 text-sm font-bold text-amber-50"><div className="schedule-special-ticker flex w-max gap-10">{[0, 1].map((copy) => <span key={copy} className="inline-flex items-center gap-4 whitespace-nowrap">{todaySpecialText ? <span>{todaySpecialText}</span> : null}{todaySpecialTextPa ? <span className="font-gurmukhi">{todaySpecialTextPa}</span> : null}<span aria-hidden="true">✦</span></span>)}</div></div> : null}</div><button type="button" onClick={() => void toggleFullscreen()} className="rounded-lg border border-white/25 bg-white/10 px-3 py-2 text-xs font-bold text-white">{isFullscreen ? 'Exit' : 'Fullscreen'}</button></header>
          <div className="mt-5 grid flex-1 gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,.8fr)]">
            <main className="rounded-3xl border border-sky-200/25 bg-gradient-to-br from-sky-300/20 via-white/10 to-amber-300/10 p-5 shadow-2xl backdrop-blur sm:p-7"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-cyan-100">Today&apos;s activities</p><h2 className="mt-1 font-heading text-3xl font-bold sm:text-4xl">Today at the Gurdwara</h2><p className="mt-2 text-sm font-bold text-brand-saffron">{formatDualDate(todayKey)}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200"><span className="h-2 w-2 rounded-full bg-emerald-400" /> Live</span></div>{!todaySpecialText && !todaySpecialTextPa ? <div className="mt-4 border-t border-white/40" /> : null}<div className="mt-5 space-y-5">{morningRows.length ? <section><h3 className="mb-2 rounded-lg border border-sky-200/40 bg-sky-300/30 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-sky-50">Morning</h3><div className="space-y-3">{renderScheduleRows(morningRows)}</div></section> : null}{eveningRows.length ? <section><h3 className="mb-2 rounded-lg border border-amber-200/40 bg-amber-300/30 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-amber-50">Evening</h3><div className="space-y-3">{renderScheduleRows(eveningRows)}</div></section> : null}{!rows.length ? <p className="rounded-xl bg-white/10 p-6 text-center text-slate-300">No activities are scheduled for today.</p> : null}</div></main>
            <aside className="space-y-5"><section className="rounded-3xl border border-brand-saffron/30 bg-brand-saffron/10 p-5"><div className="flex items-center gap-2 text-brand-saffron"><CalendarDaysIcon className="h-6 w-6" /><p className="text-xs font-black uppercase tracking-[0.18em]">Upcoming Sunday</p></div><h2 className="mt-2 font-heading text-3xl font-bold">Upcoming Sunday Schedule</h2><p className="mt-1 text-xs font-semibold text-brand-saffron">{formatDualDate(upcoming.sundayDate)}</p>{renderPreviewSections(upcoming.sunday)}</section><section className="rounded-3xl border border-cyan-200/20 bg-white/10 p-5"><div className="flex items-center gap-2 text-cyan-100"><SparklesIcon className="h-6 w-6" /><p className="text-xs font-black uppercase tracking-[0.18em]">Upcoming special occasion</p></div><h2 className="mt-2 font-heading text-3xl font-bold">{upcoming.special?.title || 'No special occasion posted'}</h2>{upcoming.specialDate ? <p className="mt-1 text-sm font-bold text-brand-saffron">{formatDualDate(upcoming.specialDate)}</p> : null}<div className="mt-4 space-y-2">{renderPreviewRows(upcoming.special).map((entry) => <div key={entry.id || entry.timeEn} className="border-b border-white/15 pb-2 text-sm"><span className="font-bold text-cyan-100">{entry.timeEn || entry.time || 'Time TBD'}</span><span className="ml-2 font-semibold">{entry.titleEn || entry.label}</span>{entry.titlePa ? <p className="font-gurmukhi text-xs text-cyan-100">{entry.titlePa}</p> : null}</div>)}</div></section></aside>
          </div>
        </div>
      </div>
    </>
  );
};

export default DailyScheduleDisplayBoardPage;
