import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BookOpenIcon, PaperAirplaneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useBranding } from '../../context/BrandingContext';
import askGranthiService from '../../services/askGranthiService';
import granthiWelcomePortrait from '../../assets/granthi-welcome-cutout.png';

const FloatingAskGranthi = () => {
  const { branding } = useBranding();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const questionRef = useRef(null);
  const askMutation = useMutation({
    mutationFn: (value) => askGranthiService.askQuestion(value),
    onSuccess: (response) => setAnswer(response.data)
  });

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !askMutation.isPending) setIsOpen(false);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    questionRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, askMutation.isPending]);

  const openAssistant = () => {
    setQuestion('');
    setAnswer(null);
    askMutation.reset();
    setIsOpen(true);
  };

  const askErrorMessage = askMutation.error?.response?.data?.message;
  const isAiUnconfigured = askMutation.error?.response?.status === 503 && /AI is not configured/i.test(askErrorMessage || '');

  const closeAssistant = () => {
    if (askMutation.isPending) return;
    setIsOpen(false);
  };

  const submitQuestion = (event) => {
    event.preventDefault();
    const value = question.trim();
    if (value.length < 8 || value.length > 500 || askMutation.isPending) return;
    setAnswer(null);
    askMutation.mutate(value);
  };

  const askAnother = () => {
    setQuestion('');
    setAnswer(null);
    askMutation.reset();
    questionRef.current?.focus();
  };

  return (
    <>
      <div
        data-testid="floating-granthi-widget"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-[80] sm:right-6"
      >
        <button
          type="button"
          onClick={openAssistant}
          aria-label="Ask a Granthi Ji a question"
          title="Ask a Granthi Ji"
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border-[3px] border-[#e6b64c] bg-[#07162b] shadow-[0_5px_22px_rgba(15,23,42,.32)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/70 sm:h-16 sm:w-16"
        >
          <img src={granthiWelcomePortrait} alt="" className="absolute inset-x-0 bottom-0 h-[118%] w-full object-contain object-bottom" />
        </button>
      </div>

      {isOpen ? (
        <div
          data-testid="granthi-modal-backdrop"
          className="granthi-modal-backdrop-in fixed inset-0 z-[100] flex items-end justify-center overflow-y-auto bg-slate-950/55 p-3 backdrop-blur-[2px] sm:items-center sm:p-5"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeAssistant(); }}
        >
          <style>{`
            @keyframes granthi-modal-backdrop-in { from { opacity: 0; } to { opacity: 1; } }
            @keyframes granthi-modal-card-in { from { opacity: 0; transform: translateY(20px) scale(.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
            .granthi-modal-backdrop-in { animation: granthi-modal-backdrop-in 220ms ease-out both; }
            .granthi-modal-card-in { transform-origin: center bottom; animation: granthi-modal-card-in 300ms cubic-bezier(.2,.8,.2,1) both; }
            @media (prefers-reduced-motion: reduce) { .granthi-modal-backdrop-in, .granthi-modal-card-in { animation: none; } }
          `}</style>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="floating-granthi-title"
            className="granthi-modal-card-in my-auto flex max-h-[min(88vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
            style={{ '--granthi-primary': branding.primaryColor, '--granthi-accent': branding.accentColor }}
          >
            <header className="flex shrink-0 items-center justify-between gap-3 bg-[color:var(--granthi-primary)] px-4 py-3 text-white sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-center gap-3">
                <img src={granthiWelcomePortrait} alt="" className="h-12 w-12 shrink-0 rounded-full border-2 border-[color:var(--granthi-accent)] bg-[#07162b] object-contain object-bottom" />
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[color:var(--granthi-accent)]">Sikh learning assistant</p>
                  <h2 id="floating-granthi-title" className="truncate font-heading text-lg font-bold sm:text-xl">Ask a Granthi Ji</h2>
                </div>
              </div>
              <button type="button" onClick={closeAssistant} disabled={askMutation.isPending} aria-label="Close Ask a Granthi Ji" className="rounded-full p-2 text-white/90 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </header>

            <div className="overflow-y-auto p-4 sm:p-5">
              {!answer ? (
                <form onSubmit={submitQuestion}>
                  <p className="text-sm leading-6 text-slate-600">Ask about Sikhi, Gurbani, Sikh history, or daily practice. Your question and answer will also appear on the Gurdwara display.</p>
                  <label htmlFor="floating-granthi-question" className="mt-4 block text-sm font-bold text-slate-800">Your question</label>
                  <textarea
                    ref={questionRef}
                    id="floating-granthi-question"
                    value={question}
                    onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
                    rows={4}
                    minLength={8}
                    maxLength={500}
                    required
                    disabled={askMutation.isPending}
                    placeholder="For example: What is the meaning of Ik Onkar?"
                    className="mt-2 w-full resize-y rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm leading-6 text-slate-900 outline-none transition focus:border-[color:var(--granthi-primary)] focus:bg-white focus:ring-2 focus:ring-[color:var(--granthi-primary)]/20 disabled:opacity-70 sm:p-4"
                  />
                  <div className="mt-1 flex items-center justify-between gap-3 text-[11px] text-slate-500">
                    <span>Do not include private or sensitive information.</span>
                    <span>{question.length}/500</span>
                  </div>
                  {askMutation.isError ? <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">{isAiUnconfigured ? 'The Granthi Ji assistant is temporarily unavailable because its AI service is not configured. Please contact the site administrator.' : askMutation.error?.message || 'Unable to answer right now. Please try again.'}</p> : null}
                  {askMutation.isPending ? (
                    <div role="status" aria-live="polite" className="mt-4 flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-[color:var(--granthi-primary)]" />
                      Preparing a thoughtful answer…
                    </div>
                  ) : null}
                  <button type="submit" disabled={question.trim().length < 8 || askMutation.isPending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[color:var(--granthi-accent)] px-4 py-2.5 text-sm font-extrabold text-slate-950 transition hover:brightness-105 focus:outline-none focus-visible:ring-4 focus-visible:ring-amber-300/60 disabled:cursor-not-allowed disabled:opacity-50">
                    <PaperAirplaneIcon className="h-4 w-4" /> Ask
                  </button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl bg-slate-100 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your question</p>
                    <p className="mt-1 font-semibold text-slate-900">{answer.question}</p>
                  </div>
                  <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">AI-assisted response for educational purposes. Please verify Gurbani references with trusted sources and consult a Granthi Ji for guidance.</p>
                  <article>
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Punjabi (ਪੰਜਾਬੀ)</p>
                    <p className="mt-1 font-gurmukhi text-base font-semibold leading-7 text-[color:var(--granthi-primary)]">{answer.answerPunjabi}</p>
                  </article>
                  <article className="border-t border-slate-200 pt-3">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">English</p>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-800">{answer.answerEnglish}</p>
                  </article>
                  {answer.gurbani ? (
                    <article className="rounded-xl border border-violet-200 bg-violet-50 p-3 sm:p-4">
                      <p className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-violet-800"><BookOpenIcon className="h-4 w-4" /> Gurbani reference</p>
                      <p className="mt-2 font-gurmukhi text-base font-bold leading-7 text-violet-950">{answer.gurbani.gurmukhi}</p>
                      <p className="mt-1 text-xs font-bold text-violet-700">{answer.gurbani.source}</p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-violet-700">ਪੰਜਾਬੀ ਅਰਥ</p>
                      <p className="mt-1 font-gurmukhi text-sm font-semibold leading-6 text-violet-950">{answer.gurbani.translationPunjabi}</p>
                      <p className="mt-3 text-xs font-bold uppercase tracking-wider text-violet-700">English translation</p>
                      <p className="mt-1 text-sm font-semibold leading-6 text-violet-950">{answer.gurbani.translationEnglish}</p>
                    </article>
                  ) : null}
                  <button type="button" onClick={askAnother} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-[color:var(--granthi-primary)] transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--granthi-primary)]"><PaperAirplaneIcon className="h-4 w-4" /> Ask another question</button>
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default FloatingAskGranthi;
