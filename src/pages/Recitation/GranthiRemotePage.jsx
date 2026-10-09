import { useState } from 'react';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import RecitationPicker from '../../components/recitation/RecitationPicker';
import recitationService from '../../services/recitationService';
import { formatClock, formatSpan, useRecitationLive, useRecitationText, useWakeLock } from '../../hooks/useRecitation';
import { useBranding } from '../../context/BrandingContext';

const FONT_SIZES = [22, 28, 34, 42, 52];

// Phone remote for the Granthi. The idle screen is intentionally reduced to one clear start action.
const GranthiRemotePage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('Granthi Remote', 'Control the live recitation shown on the Darbar Hall screen.');
  const { session, ready, setSession } = useRecitationLive();
  const [message, setMessage] = useState('');
  const [starting, setStarting] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [fontStep, setFontStep] = useState(2);
  const [jump, setJump] = useState('');
  const { lines } = useRecitationText(session, 'text');
  useWakeLock(Boolean(session));

  const handleError = (error) => {
    setMessage(error?.response?.data?.message || error.message || 'That did not go through. Please try again.');
  };

  const step = async (change) => {
    navigator.vibrate?.(12);
    setMessage('');
    try {
      setSession(await recitationService.step(session.id, change));
    } catch (error) {
      handleError(error);
    }
  };

  const startRecitation = async (payload) => {
    setStarting(true);
    setMessage('');
    try {
      setSession(await recitationService.start(payload));
      setShowPicker(false);
    } catch (error) {
      handleError(error);
    } finally {
      setStarting(false);
    }
  };

  const endRecitation = async () => {
    if (!window.confirm('End this recitation? The screen will return to the waiting message.')) return;
    try {
      await recitationService.end(session.id);
      setSession(null);
    } catch (error) {
      handleError(error);
    }
  };

  const goToLine = (event) => {
    event.preventDefault();
    const number = Number.parseInt(jump, 10);
    if (!Number.isInteger(number) || number < 1) return;
    setJump('');
    step({ index: number - 1 });
  };

  const index = session?.currentIndex ?? 0;
  const atStart = index <= 0;
  const atEnd = session ? index >= session.totalLines - 1 : true;

  return (
    <>
      <Seo {...meta} />
      <div className="flex min-h-screen flex-col bg-[#06142f] text-white" style={{ touchAction: 'manipulation' }}>
        <header className="flex items-center gap-3 border-b border-white/15 px-4 py-3">
          <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-10 w-10 rounded-full border border-brand-saffron object-cover" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand-saffron">Granthi remote</p>
            <h1 className="truncate font-gurmukhi text-base font-bold">{session ? session.title : 'Live recitation'}</h1>
          </div>
          {session ? (
            <form onSubmit={goToLine} className="flex shrink-0 items-center gap-2">
              <input value={jump} onChange={(event) => setJump(event.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Go to line" aria-label="Go to line number" className="w-24 rounded-lg border border-white/25 bg-slate-950/60 px-3 py-2 text-sm text-white placeholder:text-slate-400" />
              <button type="submit" className="rounded-lg border border-white/25 px-3 py-2 text-sm font-bold">Go</button>
            </form>
          ) : null}
        </header>

        {message ? <p className="mx-4 mt-3 rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-100" role="alert">{message}</p> : null}

        {!ready ? <p className="py-16 text-center text-slate-300">Loading...</p> : null}

        {ready && !session ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
            {!showPicker ? (
              <button type="button" onClick={() => setShowPicker(true)} className="min-h-24 w-full max-w-md rounded-2xl bg-brand-saffron px-8 py-6 text-2xl font-extrabold text-slate-950 shadow-xl active:bg-amber-300">Start Recitation</button>
            ) : (
              <div className="w-full space-y-3">
                <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Choose what to recite</h2><button type="button" onClick={() => setShowPicker(false)} className="rounded-lg border border-white/25 px-3 py-2 text-sm font-bold">Cancel</button></div>
                <RecitationPicker tone="dark" busy={starting} startLabel="Start Recitation" onStart={startRecitation} />
              </div>
            )}
          </div>
        ) : null}

        {ready && session ? (
          <>
            <div className="flex items-center justify-between gap-3 px-4 pt-3 text-sm font-semibold text-slate-200">
              <span>Line {index + 1} of {session.totalLines}</span>
              <span>Started {formatClock(session.startedAt)} · {formatSpan(session.startedAt)}</span>
            </div>
            <div className="mx-4 mt-2 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-brand-saffron transition-all" style={{ width: `${Math.round(((index + 1) / session.totalLines) * 100)}%` }} /></div>

            <main className="flex flex-1 flex-col justify-center gap-3 px-4 py-4">
              <p className="font-gurmukhi leading-snug text-slate-400" style={{ fontSize: `${FONT_SIZES[fontStep] * 0.62}px` }}>{lines[index - 1] || ''}</p>
              <p className="rounded-2xl border-l-4 border-brand-saffron bg-white/10 px-4 py-4 font-gurmukhi font-bold leading-snug" style={{ fontSize: `${FONT_SIZES[fontStep]}px` }}>{lines[index] || 'Loading...'}</p>
              <p className="font-gurmukhi leading-snug text-slate-300" style={{ fontSize: `${FONT_SIZES[fontStep] * 0.62}px` }}>{lines[index + 1] || ''}</p>
            </main>

            <div className="grid grid-cols-[1fr_1.6fr] gap-3 px-4 pb-3">
              <button type="button" onClick={() => step({ delta: -1 })} disabled={atStart} className="min-h-24 rounded-2xl border border-white/25 bg-white/10 text-xl font-extrabold active:bg-white/25 disabled:opacity-35">Previous</button>
              <button type="button" onClick={() => step({ delta: 1 })} disabled={atEnd} className="min-h-24 rounded-2xl bg-brand-saffron text-2xl font-extrabold text-slate-950 active:bg-amber-300 disabled:opacity-35">Next line</button>
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-white/15 px-4 py-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setFontStep((value) => Math.max(0, value - 1))} className="h-10 w-10 rounded-lg border border-white/25 text-sm font-bold" aria-label="Smaller text">A-</button>
                <button type="button" onClick={() => setFontStep((value) => Math.min(FONT_SIZES.length - 1, value + 1))} className="h-10 w-10 rounded-lg border border-white/25 text-lg font-bold" aria-label="Larger text">A+</button>
              </div>
              <button type="button" onClick={endRecitation} className="rounded-full bg-red-600 px-6 py-3 text-base font-extrabold text-white shadow-lg active:bg-red-700">End recitation</button>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
};

export default GranthiRemotePage;
