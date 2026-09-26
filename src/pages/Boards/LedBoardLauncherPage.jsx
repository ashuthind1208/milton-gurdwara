import { useMemo, useState } from 'react';
import { ArrowTopRightOnSquareIcon, CalendarDaysIcon, ClipboardDocumentIcon, GiftIcon, QueueListIcon, SparklesIcon, Squares2X2Icon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import { useBranding } from '../../context/BrandingContext';

const boards = [
  { key: 'donation', title: 'Donation Board', description: 'Live campaigns, progress, donors, and donation QR code.', path: '/donation-board', icon: GiftIcon, accent: 'border-amber-300 bg-amber-50 text-amber-800' },
  { key: 'events', title: 'Events Calendar Board', description: 'Upcoming events, Nanakshahi dates, and registration activity.', path: '/event-calendar-board', icon: CalendarDaysIcon, accent: 'border-sky-300 bg-sky-50 text-sky-800' },
  { key: 'langar', title: 'Langar Needs Board', description: 'Current grocery needs, progress, contributors, and QR code.', path: '/langar-board', icon: QueueListIcon, accent: 'border-emerald-300 bg-emerald-50 text-emerald-800' },
  { key: 'schedule', title: 'Daily Schedule Board', description: 'Today\'s activities with the ongoing program highlighted.', path: '/daily-schedule-board', icon: Squares2X2Icon, accent: 'border-blue-300 bg-blue-50 text-blue-800' },
  { key: 'granthi', title: 'Ask a Granthi Board', description: 'A public question screen for the sangat.', path: '/ask-a-granthi?screen=welcome', icon: SparklesIcon, accent: 'border-violet-300 bg-violet-50 text-violet-800' }
];

const LedBoardLauncherPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('LED Board Launcher', 'Open the Singh Sabha Milton LED display boards.');
  const [copiedKey, setCopiedKey] = useState('');
  const origin = useMemo(() => window.location.origin, []);

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
            <div className="min-w-0 flex-1"><p className="text-xs font-black uppercase tracking-[0.24em] text-brand-blue">{branding.shortName}</p><h1 className="mt-1 font-heading text-4xl font-bold text-brand-navy sm:text-5xl">LED Board Launcher</h1><p className="mt-1 text-sm text-slate-600">Open a board on each display screen, then use fullscreen mode inside the board.</p></div>
          </header>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {boards.map((board) => {
              const Icon = board.icon;
              const url = `${origin}${board.path}`;
              return <article key={board.key} className="flex min-h-[220px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`flex h-12 w-12 items-center justify-center rounded-xl border ${board.accent}`}><Icon className="h-6 w-6" /></div><h2 className="mt-4 font-heading text-2xl font-bold text-brand-navy">{board.title}</h2><p className="mt-2 flex-1 text-sm leading-6 text-slate-600">{board.description}</p><p className="mt-3 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500" title={url}>{url}</p><div className="mt-3 flex gap-2"><a href={board.path} target="_blank" rel="noreferrer" className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-blue px-3 py-2.5 text-sm font-bold text-white hover:bg-blue-700"><ArrowTopRightOnSquareIcon className="h-4 w-4" /> Open board</a><button type="button" onClick={() => void copyUrl(board)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50" title="Copy board URL"><ClipboardDocumentIcon className="h-4 w-4" />{copiedKey === board.key ? 'Copied' : 'Copy'}</button></div></article>;
            })}
          </section>
        </div>
      </main>
    </>
  );
};

export default LedBoardLauncherPage;
