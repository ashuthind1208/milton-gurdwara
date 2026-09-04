import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ArrowPathIcon, BookOpenIcon, PaperAirplaneIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import askGranthiService from '../../services/askGranthiService';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';
import khandaMark from '../../assets/khanda-mark.webp';

const DEFAULT_BRANDING = {
  organizationName: 'Gurdwara Singh Sabha Milton',
  productName: 'Ask a Granthi Ji',
  logoUrl: '',
  primaryColor: '#0B1F3A',
  accentColor: '#F4A300',
  surfaceColor: '#FFF9EE'
};

const AskGranthiQuestionPage = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const { data } = useQuery({
    queryKey: ['ask-granthi-branding'],
    queryFn: () => askGranthiService.getBranding().then((response) => response.data)
  });
  const branding = { ...DEFAULT_BRANDING, ...(data || {}) };
  const logoSrc = branding.logoUrl || gurdwaraLogo;
  const askMutation = useMutation({
    mutationFn: (value) => askGranthiService.askQuestion(value),
    onSuccess: (response) => setAnswer(response.data)
  });

  const submitQuestion = (event) => {
    event.preventDefault();
    const value = question.trim();
    if (value.length < 8 || value.length > 500 || askMutation.isPending) {
      return;
    }
    setAnswer(null);
    askMutation.mutate(value);
  };

  const askAnother = () => {
    setQuestion('');
    setAnswer(null);
    askMutation.reset();
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#05080e] px-4 py-6 text-slate-100 sm:py-10"
      style={{
        '--granthi-primary': branding.primaryColor,
        '--granthi-accent': branding.accentColor,
        '--granthi-surface': branding.surfaceColor
      }}
    >
      <Seo title={branding.productName} description="Ask a Sikh learning question and receive a bilingual AI-assisted answer." />
      <style>{`
        @keyframes granthi-mobile-think { 0%, 100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-7px) rotate(2deg); } }
        @keyframes granthi-mobile-dot { 0%, 70%, 100% { opacity: .25; } 35% { opacity: 1; } }
        .granthi-mobile-thinking { animation: granthi-mobile-think 1.7s ease-in-out infinite; }
        .granthi-mobile-dot { animation: granthi-mobile-dot 1.1s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .granthi-mobile-thinking, .granthi-mobile-dot { animation: none; } }
      `}</style>
      <img src={khandaMark} alt="" aria-hidden="true" className="pointer-events-none absolute -right-24 top-24 w-96 opacity-[0.045]" />

      <div className="relative z-10 mx-auto w-full max-w-2xl">
        <header className="text-center">
          <img src={logoSrc} alt={`${branding.organizationName} logo`} className="mx-auto h-20 w-20 rounded-full border-2 border-[color:var(--granthi-accent)] bg-white object-cover shadow-xl" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.18em] text-[color:var(--granthi-accent)]">{branding.organizationName}</p>
          <h1 className="mt-2 font-heading text-4xl font-bold text-white sm:text-5xl">{branding.productName}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-300">Ask about Sikhi, Gurbani, Sikh history, or daily practice. Your question and answer will appear on the Gurdwara display.</p>
        </header>

        {!answer ? (
          <form onSubmit={submitQuestion} className="mt-8 rounded-md border border-white/15 bg-white/[0.07] p-4 shadow-2xl backdrop-blur-sm sm:p-6">
            <label htmlFor="granthi-question" className="block text-sm font-bold text-white">Your question</label>
            <textarea
              id="granthi-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 500))}
              rows={6}
              minLength={8}
              maxLength={500}
              required
              autoFocus
              placeholder="For example: What is the meaning of Ik Onkar?"
              className="mt-2 w-full resize-none rounded-md border border-slate-300 bg-white p-4 text-base leading-6 text-slate-900 outline-none focus:border-[color:var(--granthi-accent)] focus:ring-2 focus:ring-[color:var(--granthi-accent)]/30"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span>Do not include private or sensitive information.</span>
              <span>{question.length}/500</span>
            </div>
            {askMutation.isError ? (
              <p role="alert" className="mt-4 rounded-md border border-red-400/40 bg-red-950/50 px-3 py-2 text-sm font-semibold text-red-100">{askMutation.error?.message || 'Unable to answer right now. Please try again.'}</p>
            ) : null}
            <button
              type="submit"
              disabled={question.trim().length < 8 || askMutation.isPending}
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[color:var(--granthi-accent)] px-5 py-3 text-base font-bold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              Ask
            </button>
          </form>
        ) : (
          <section className="mt-8 overflow-hidden rounded-md bg-[color:var(--granthi-surface)] text-slate-900 shadow-2xl">
            <div className="bg-[color:var(--granthi-primary)] px-5 py-4 text-white">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--granthi-accent)]">Answered on the main screen</p>
              <h2 className="mt-2 font-heading text-2xl font-bold leading-tight">{answer.question}</h2>
            </div>
            <div className="space-y-4 p-5">
              <article>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Punjabi (ਪੰਜਾਬੀ)</p>
                <p className="mt-2 font-gurmukhi text-lg font-semibold leading-8 text-[color:var(--granthi-primary)]">{answer.answerPunjabi}</p>
              </article>
              <article className="border-t border-slate-200 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">English</p>
                <p className="mt-2 font-semibold leading-7 text-slate-800">{answer.answerEnglish}</p>
              </article>
              {answer.gurbani ? (
                <article className="rounded-md border border-violet-200 bg-violet-50 p-4">
                  <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-700"><BookOpenIcon className="h-4 w-4" /> Gurbani reference</p>
                  <p className="mt-2 font-gurmukhi text-base font-bold leading-7 text-violet-950">{answer.gurbani.gurmukhi}</p>
                  <p className="mt-2 text-xs font-bold text-violet-700">{answer.gurbani.source}</p>
                </article>
              ) : null}
              <button type="button" onClick={askAnother} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-[color:var(--granthi-primary)] hover:bg-slate-50">
                <ArrowPathIcon className="h-5 w-5" /> Ask another question
              </button>
            </div>
          </section>
        )}
      </div>

      {askMutation.isPending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 px-5 backdrop-blur-md" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-md border border-[color:var(--granthi-accent)]/50 bg-[color:var(--granthi-primary)] p-7 text-center shadow-2xl">
            <img src={logoSrc} alt="" className="granthi-mobile-thinking mx-auto h-24 w-24 rounded-full border-2 border-[color:var(--granthi-accent)] bg-white object-cover" />
            <h2 className="mt-5 font-heading text-2xl font-bold text-white">Please wait</h2>
            <p className="mt-2 text-sm leading-6 text-slate-200">Finding a thoughtful answer and sharing it with the main screen.</p>
            <div className="mt-5 flex justify-center gap-2" aria-hidden="true">
              {[0, 1, 2].map((index) => <span key={index} className="granthi-mobile-dot h-2.5 w-2.5 rounded-full bg-[color:var(--granthi-accent)]" style={{ animationDelay: `${index * 150}ms` }} />)}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
};

export default AskGranthiQuestionPage;