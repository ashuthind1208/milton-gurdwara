import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import recitationService from '../../services/recitationService';
import { formatClock, formatDay, formatSpan, useRecitationLive, useRecitationText, useWakeLock } from '../../hooks/useRecitation';
import { useBranding } from '../../context/BrandingContext';

const FONT_KEY = 'ssm_follow_font';
const FONT_SIZES = [18, 22, 26, 32, 40];
const LINES_BEFORE = 3;
const LINES_AFTER = 24;
const ENDED_SUMMARY_MS = 12000;

const readFontStep = () => {
  const saved = Number(window.localStorage.getItem(FONT_KEY));
  return Number.isInteger(saved) && saved >= 0 && saved < FONT_SIZES.length ? saved : 1;
};

const Detail = ({ label, value }) => (value ? <div className="rounded-xl bg-white/10 px-3 py-2"><dt className="text-[11px] font-bold uppercase tracking-wide text-slate-300">{label}</dt><dd className="mt-0.5 text-sm font-semibold text-white">{value}</dd></div> : null);

// Read-only view for the sangat: the Gurbani only, kept in step with the Granthi and the Darbar Hall screen.
const RecitationFollowPage = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('Follow the Recitation', 'Follow the live Gurbani recitation on your phone.');
  const { session: liveSession, last, ready } = useRecitationLive();
  const [fontStep, setFontStep] = useState(readFontStep);
  const [following, setFollowing] = useState(true);
  const [followedId, setFollowedId] = useState('');
  const currentRef = useRef(null);

  const { data: fetched, refetch: refetchSession } = useQuery({
    queryKey: ['recitation-session', sessionId],
    queryFn: () => recitationService.getSession(sessionId),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => (query.state.data?.status === 'live' ? false : 60000)
  });

  // The shared QR link has no recitation id: show what is live now, and only an ended one if this visitor was following it.
  useEffect(() => {
    if (!sessionId && liveSession?.id) setFollowedId(liveSession.id);
  }, [sessionId, liveSession?.id]);

  const endedFollowed = !sessionId && !liveSession && last && last.id === followedId ? last : null;
  const target = sessionId ? (liveSession?.id === sessionId ? liveSession : fetched) : (liveSession || endedFollowed);
  const isLive = target?.status === 'live';

  // Only a recitation this visitor watched live gets the short summary; afterwards the page goes back to waiting for the next one.
  const watchedLiveId = useRef('');
  useEffect(() => {
    if (isLive) { watchedLiveId.current = target.id; return undefined; }
    if (!target || watchedLiveId.current !== target.id) return undefined;
    const timer = window.setTimeout(() => {
      watchedLiveId.current = '';
      if (sessionId) navigate('/follow', { replace: true });
      else setFollowedId('');
    }, ENDED_SUMMARY_MS);
    return () => window.clearTimeout(timer);
  }, [isLive, target, sessionId, navigate]);

  // A session opened by its own link only learns it ended by asking again once the live stream no longer lists it.
  useEffect(() => {
    if (sessionId && ready && fetched?.status === 'live' && liveSession?.id !== sessionId) refetchSession();
  }, [sessionId, ready, fetched?.status, liveSession?.id, refetchSession]);
  const { lines, loading } = useRecitationText(isLive ? target : null, 'text');
  useWakeLock(isLive);

  const index = target?.currentIndex ?? 0;
  const start = Math.max(0, index - LINES_BEFORE);
  const visible = lines.slice(start, index + LINES_AFTER + 1);

  useEffect(() => {
    if (following) currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [index, following, lines.length]);

  const changeFont = (delta) => {
    const next = Math.min(FONT_SIZES.length - 1, Math.max(0, fontStep + delta));
    setFontStep(next);
    try {
      window.localStorage.setItem(FONT_KEY, String(next));
    } catch {
      // The size simply is not remembered next time.
    }
  };

  // Browsers only let a page close itself when it was opened by a script, so fall back to leaving for the home page.
  const closePage = () => {
    window.close();
    window.setTimeout(() => navigate('/'), 300);
  };

  const stopFollowing = () => setFollowing(false);
  const resume = () => { setFollowing(true); currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }); };

  return (
    <>
      <Seo {...meta} />
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-[#06142f] to-[#0b2a5b] text-white">
        <header className="sticky top-0 z-20 border-b border-white/15 bg-[#06142f]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-11 w-11 shrink-0 rounded-full border border-brand-saffron object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-brand-saffron">
                {isLive ? <><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Live now</> : target ? 'Recitation ended' : 'Live recitation'}
              </p>
              <h1 className="truncate font-gurmukhi text-lg font-bold leading-tight">{target ? target.title : 'Follow along'}</h1>
              {target ? <p className="truncate text-xs text-cyan-100">{target.titleEnglish}</p> : null}
            </div>
            {isLive ? (
              <div className="flex shrink-0 gap-1" role="group" aria-label="Text size">
                <button type="button" onClick={() => changeFont(-1)} disabled={fontStep === 0} className="h-10 w-10 rounded-lg border border-white/25 text-sm font-bold disabled:opacity-40" aria-label="Smaller text">A-</button>
                <button type="button" onClick={() => changeFont(1)} disabled={fontStep === FONT_SIZES.length - 1} className="h-10 w-10 rounded-lg border border-white/25 text-lg font-bold disabled:opacity-40" aria-label="Larger text">A+</button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4" onTouchStart={stopFollowing} onWheel={stopFollowing}>
          {target && !isLive ? (
            <div className="mb-4 rounded-2xl bg-red-600 px-4 py-4 text-center shadow-lg" role="status">
              <p className="text-xl font-extrabold">This recitation has ended</p>
              {target.endedAt ? <p className="mt-1 text-sm font-semibold text-red-100">Ended at {formatClock(target.endedAt)}</p> : null}
            </div>
          ) : null}
          {!ready && !target ? <p className="py-16 text-center text-slate-300">Loading...</p> : null}

          {ready && !target ? (
            <div className="py-16 text-center">
              <p className="font-heading text-3xl font-bold">Waiting for the next recitation</p>
              <p className="mt-2 text-slate-300">Keep this page open. The Gurbani will appear here by itself when a recitation begins.</p>
              <button type="button" onClick={closePage} className="fixed inset-x-0 bottom-8 mx-auto w-fit rounded-full border border-white/30 bg-white/10 px-8 py-3 text-base font-bold text-white active:bg-white/25">Close</button>
            </div>
          ) : null}

          {target ? (
            <dl className="grid grid-cols-2 gap-2">
              <Detail label="Date" value={formatDay(target.startedAt)} />
              <Detail label="Started" value={formatClock(target.startedAt)} />
              <Detail label="Ended" value={target.endedAt ? formatClock(target.endedAt) : isLive ? 'In progress' : ''} />
              <Detail label="Duration" value={formatSpan(target.startedAt, target.endedAt)} />
              <Detail label="Reciter" value={target.reciter} />
              <Detail label="Occasion" value={target.notes} />
            </dl>
          ) : null}

          {isLive ? (
            <section className="mt-5" aria-live="polite">
              {loading ? <p className="py-10 text-center text-slate-300">Loading Gurbani...</p> : null}
              {visible.map((text, offset) => {
                const lineIndex = start + offset;
                const isCurrent = lineIndex === index;
                return (
                  <p key={lineIndex} ref={isCurrent ? currentRef : undefined} className={`my-2 scroll-mt-32 rounded-xl px-3 py-2 font-gurmukhi leading-snug ${isCurrent ? 'border-l-4 border-brand-saffron bg-white/15 font-bold text-white' : lineIndex < index ? 'text-slate-400' : 'text-slate-100'}`} style={{ fontSize: `${FONT_SIZES[fontStep]}px` }}>{text}</p>
                );
              })}
            </section>
          ) : null}

          {target && !isLive ? (
            <div className="mt-5 rounded-2xl border border-white/15 bg-white/10 p-4 text-center">
              <p className="text-base font-semibold">This recitation finished after {Math.min(target.totalLines, target.currentIndex + 1)} of {target.totalLines} lines.</p>
              {liveSession ? <Link to={`/follow/${liveSession.id}`} className="mt-3 inline-block rounded-xl bg-brand-saffron px-4 py-2.5 text-sm font-extrabold text-slate-950">Join the recitation happening now</Link> : <p className="mt-1 text-sm text-slate-300">Keep this page open to follow the next one.</p>}
            </div>
          ) : null}
        </main>

        {isLive && !following ? (
          <button type="button" onClick={resume} className="fixed inset-x-4 bottom-5 z-30 mx-auto max-w-sm rounded-full bg-brand-saffron px-5 py-3.5 text-base font-extrabold text-slate-950 shadow-2xl">Back to the current line</button>
        ) : null}
      </div>
    </>
  );
};

export default RecitationFollowPage;
