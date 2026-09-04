import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowsPointingOutIcon, BookOpenIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import askGranthiService from '../../services/askGranthiService';
import { useBranding } from '../../context/BrandingContext';
import granthiWelcomePortrait from '../../assets/granthi-welcome-cutout.png';
import granthiAnswerPortrait from '../../assets/granthi-answer-cutout.png';

const DEFAULT_BRANDING = {
  productName: 'Ask a Granthi Ji',
};

const DISMISSED_ANSWERS_KEY = 'ask_granthi_dismissed_answer_ids';

const readDismissedAnswerIds = () => {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(DISMISSED_ANSWERS_KEY) || '[]');
    return new Set(Array.isArray(stored) ? stored.map(String) : []);
  } catch {
    return new Set();
  }
};

const formatTime = (value) => new Intl.DateTimeFormat('en-CA', {
  hour: 'numeric',
  minute: '2-digit'
}).format(value);

const AskGranthiBoardPage = () => {
  const { branding: globalBranding, logoSrc } = useBranding();
  const [now, setNow] = useState(new Date());
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [dismissedAnswerIds, setDismissedAnswerIds] = useState(readDismissedAnswerIds);
  const [isFullscreen, setIsFullscreen] = useState(Boolean(document.fullscreenElement));
  const welcomeBaselineQuestionIdRef = useRef(null);
  const welcomeBaselineInitializedRef = useRef(false);
  const { data, isError } = useQuery({
    queryKey: ['ask-granthi-board'],
    queryFn: () => askGranthiService.getBoard().then((response) => response.data),
    refetchInterval: 2000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true
  });

  const branding = { ...DEFAULT_BRANDING, ...globalBranding, ...(data?.branding || {}) };
  const questions = useMemo(() => (Array.isArray(data?.questions) ? data.questions : []), [data?.questions]);
  const frequentlyAskedQuestions = questions
    .filter((question) => question.status === 'answered')
    .sort((left, right) => Number(Boolean(right.featured)) - Number(Boolean(left.featured))
      || Number(right.askCount || 0) - Number(left.askCount || 0))
    .slice(0, 8);
  const latestQuestion = questions[0] || null;
  const forceWelcomeScreen = new URLSearchParams(window.location.search).get('screen') === 'welcome';
  if (forceWelcomeScreen && !welcomeBaselineInitializedRef.current && data) {
    welcomeBaselineQuestionIdRef.current = latestQuestion?.id ? String(latestQuestion.id) : '';
    welcomeBaselineInitializedRef.current = true;
  }
  const isNewQuestionAfterWelcome = forceWelcomeScreen
    && latestQuestion?.id
    && String(latestQuestion.id) !== welcomeBaselineQuestionIdRef.current;
  const activeQuestion = (!forceWelcomeScreen || isNewQuestionAfterWelcome)
    && latestQuestion?.id
    && !dismissedAnswerIds.has(String(latestQuestion.id))
    ? latestQuestion
    : null;
  const isThinking = activeQuestion?.status === 'thinking';
  const isAnswered = activeQuestion?.status === 'answered';
  const questionUrl = `${window.location.origin}/ask-a-granthi/question`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const olderAnsweredIds = questions
      .slice(1)
      .filter((question) => question.status === 'answered')
      .map((question) => String(question.id));
    if (olderAnsweredIds.length === 0) return;

    setDismissedAnswerIds((previous) => {
      const next = new Set(previous);
      const previousSize = next.size;
      olderAnsweredIds.forEach((id) => next.add(id));
      if (next.size === previousSize) return previous;
      try {
        window.sessionStorage.setItem(DISMISSED_ANSWERS_KEY, JSON.stringify([...next]));
      } catch {
        // Keep the in-memory dismissal when browser storage is unavailable.
      }
      return next;
    });
  }, [questions]);

  useEffect(() => {
    if (!isAnswered) {
      setSecondsRemaining(30);
      return undefined;
    }

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const remaining = Math.max(0, 30 - Math.floor((Date.now() - startedAt) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0) {
        window.clearInterval(timer);
        setDismissedAnswerIds((previous) => {
          const next = new Set(previous);
          next.add(String(activeQuestion.id));
          try {
            window.sessionStorage.setItem(DISMISSED_ANSWERS_KEY, JSON.stringify([...next]));
          } catch {
            // Keep the in-memory dismissal when browser storage is unavailable.
          }
          return next;
        });
        window.history.replaceState(null, '', '/ask-a-granthi');
      }
    }, 250);

    return () => window.clearInterval(timer);
  }, [activeQuestion?.id, isAnswered]);

  const enterFullscreen = async () => {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen?.();
    } else {
      await document.exitFullscreen?.();
    }
  };

  return (
    <main
      className="flex min-h-screen items-center justify-center overflow-hidden bg-[#020912] p-2 text-white"
      style={{
        '--granthi-primary': branding.primaryColor,
        '--granthi-accent': branding.accentColor,
        '--granthi-surface': branding.surfaceColor
      }}
    >
      <Seo title={`${branding.productName} Display`} description="Live Ask a Granthi Ji questions and bilingual Sikh learning answers." />
      <style>{`
        @keyframes granthi-think { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1.2%); } }
        @keyframes granthi-dot { 0%, 60%, 100% { opacity: .25; } 30% { opacity: 1; } }
        @keyframes granthi-fetch { 0% { transform: translateX(-110%); } 100% { transform: translateX(330%); } }
        @keyframes granthi-answer-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes granthi-faq-ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        .granthi-thinking { animation: granthi-think 1.8s ease-in-out infinite; }
        .granthi-dot { animation: granthi-dot 1.2s ease-in-out infinite; }
        .granthi-fetch { animation: granthi-fetch 1.8s ease-in-out infinite; }
        .granthi-answer { animation: granthi-answer-in .4s ease-out both; }
        .granthi-faq-ticker { animation: granthi-faq-ticker 28s linear infinite; will-change: transform; }
        @media (prefers-reduced-motion: reduce) { .granthi-thinking, .granthi-dot, .granthi-answer, .granthi-faq-ticker { animation: none; } }
      `}</style>

      <div className="relative aspect-video w-full max-w-[177.78vh] overflow-hidden border border-white/20 bg-[#05080e] shadow-2xl">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(10,77,159,0.26),transparent_46%),radial-gradient(ellipse_at_bottom_right,rgba(245,166,35,0.14),transparent_44%)]" />
          <div className="absolute left-1/2 top-1/2 h-[72vw] max-h-[72vmax] w-[72vw] max-w-[72vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-saffron/10" />
          <div className="absolute left-1/2 top-1/2 h-[58vw] max-h-[58vmax] w-[58vw] max-w-[58vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-blue/15" />
        </div>
        {!activeQuestion ? (
          <div className="relative grid h-full grid-rows-[16%_1fr_8%_8%] overflow-hidden">
            <header className="relative z-10 flex items-center justify-between px-[3.2%]">
              <div className="flex items-center gap-[1.2vw]">
                <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-[4.8vw] max-h-[74px] w-[4.8vw] max-w-[74px] rounded-full border-2 border-[color:var(--granthi-accent)] bg-white object-cover" />
                <div>
                  <p className="text-[clamp(12px,1.15vw,22px)] font-bold uppercase tracking-[0.08em] text-[color:var(--granthi-accent)]">{branding.organizationName}</p>
                  <p className="font-gurmukhi text-[clamp(10px,.8vw,15px)] text-amber-100">ਸਿੱਖੋ · ਪੁੱਛੋ · ਸਾਂਝ ਪਾਓ</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isFullscreen ? <Link to="/admin/ask-granthi" className="flex h-[3vw] min-h-9 items-center justify-center border border-white/30 bg-white/10 px-3 text-[clamp(10px,.7vw,14px)] font-bold text-white hover:bg-white/20">Back to Admin</Link> : null}
                <button type="button" onClick={enterFullscreen} className="flex h-[3vw] min-h-9 w-[3vw] min-w-9 items-center justify-center border border-white/30 bg-white/10" aria-label="Toggle fullscreen">
                  <ArrowsPointingOutIcon className="h-1/2 w-1/2" />
                </button>
              </div>
              <div className="absolute inset-x-[3.2%] bottom-[6%] space-y-[3px]" aria-hidden="true">
                <span className="block h-[2px] w-full bg-brand-saffron" />
                <span className="block h-px w-full bg-brand-saffron/55" />
              </div>
            </header>

            <section className="relative z-10 grid min-h-0 grid-cols-[31%_38%_31%] items-center px-[3.2%]">
              <div className="self-center">
                <h1 className="font-heading text-[clamp(38px,5.4vw,92px)] font-bold leading-[.92] text-white">Ask a<br /><span className="text-[color:var(--granthi-accent)]">Granthi Ji</span></h1>
                <p className="mt-[5%] text-[clamp(16px,1.55vw,29px)] font-bold">Scan. Ask. Learn.</p>
                <p className="mt-[3%] max-w-[90%] text-[clamp(11px,.92vw,17px)] leading-[1.45] text-slate-200">Get answers to your questions about Sikhi, Gurbani, and Sikh history.</p>
                <div className="mt-[7%] inline-flex items-center gap-[.8vw] bg-[#f4ead7] px-[6%] py-[4%] text-[color:var(--granthi-primary)] shadow-xl">
                  <DevicePhoneMobileIcon className="h-[2.2vw] min-h-6 w-[2.2vw] min-w-6" />
                  <div><p className="text-[clamp(11px,.9vw,17px)] font-bold">Scan the QR code</p><p className="text-[clamp(9px,.68vw,13px)]">to ask your question</p></div>
                </div>
                {isError ? <p className="mt-[4%] text-[clamp(10px,.75vw,14px)] font-semibold text-amber-300">Reconnecting...</p> : null}
              </div>

              <div className="relative h-full min-h-0">
                <img src={granthiWelcomePortrait} alt="Granthi Ji welcoming questions" className="absolute inset-x-0 bottom-[1%] mx-auto h-[98%] w-[96%] object-contain object-bottom drop-shadow-2xl" />
              </div>

              <div className="justify-self-end bg-[#fffdf8] p-[6%] text-center text-slate-900 shadow-2xl">
                <QRCodeSVG value={questionUrl} size={260} level="M" marginSize={1} fgColor="#111827" bgColor="#fffdf8" className="h-auto w-[16vw] min-w-[150px] max-w-[270px]" />
                <div className="mt-[6%] flex items-center justify-center gap-[.7vw] bg-[color:var(--granthi-primary)] px-[5%] py-[5%] text-white">
                  <DevicePhoneMobileIcon className="h-[2vw] min-h-6 w-[2vw] min-w-6" />
                  <p className="text-left text-[clamp(10px,.84vw,16px)] font-bold leading-tight">Scan with your<br />phone camera</p>
                </div>
              </div>
            </section>

            <section className="relative z-10 flex min-w-0 items-center overflow-hidden border-y border-brand-saffron/30 bg-slate-950/70" aria-label="Frequently asked questions">
              <span className="relative z-20 mx-[.7%] flex h-[72%] shrink-0 items-center rounded-md bg-brand-saffron px-[2.4%] text-[clamp(10px,.82vw,16px)] font-bold uppercase tracking-[.1em] text-slate-950">Frequently asked</span>
              {frequentlyAskedQuestions.length > 0 ? (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <div className="granthi-faq-ticker flex w-max items-center whitespace-nowrap">
                    {[0, 1].map((groupIndex) => (
                      <div key={groupIndex} className="flex shrink-0 items-center" aria-hidden={groupIndex === 1}>
                        {frequentlyAskedQuestions.map((question) => (
                          <span key={`${groupIndex}-${question.id}`} className="mx-[.55vw] inline-flex items-center gap-[.8vw] rounded-md border border-brand-saffron/35 bg-white/10 px-[1.4vw] py-[.65vw] text-[clamp(12px,1vw,19px)] font-semibold text-white">
                            <span className="text-brand-saffron">◆</span>
                            {question.question}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ) : <p className="px-[2%] text-[clamp(10px,.82vw,15px)] text-slate-300">Questions from the Sangat will appear here.</p>}
            </section>

            <footer className="relative z-10 flex items-center justify-between border-t border-[color:var(--granthi-accent)]/40 bg-[#041327]/95 px-[3.2%] text-[clamp(10px,.82vw,16px)]">
              <span>Serving the Community. Spreading Guru's Wisdom.</span><span className="font-heading text-[clamp(13px,1.1vw,20px)] font-bold">{formatTime(now)}</span>
            </footer>
          </div>
        ) : isThinking ? (
          <div className="grid h-full grid-cols-[36%_64%] bg-[#efe4ce] text-slate-900">
            <div className="relative overflow-hidden bg-[color:var(--granthi-primary)]">
              <img src={granthiWelcomePortrait} alt="Granthi Ji considering the question" className="granthi-thinking h-full w-full object-contain object-bottom p-[5%]" />
              <div className="absolute inset-x-[8%] bottom-[6%] bg-[#f4ead7] p-[5%] text-center text-[color:var(--granthi-primary)] shadow-xl">
                <p className="text-[clamp(13px,1.25vw,23px)] font-bold">Question received</p>
                <div className="mt-[4%] flex justify-center gap-2" aria-hidden="true">{[0, 1, 2].map((index) => <span key={index} className="granthi-dot h-2.5 w-2.5 rounded-full bg-[color:var(--granthi-accent)]" style={{ animationDelay: `${index * 160}ms` }} />)}</div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center p-[7%] text-center">
              <div className="w-full max-w-[78%] overflow-hidden rounded-full bg-slate-300/70" aria-hidden="true"><span className="granthi-fetch block h-1.5 w-1/3 rounded-full bg-[color:var(--granthi-primary)]" /></div>
              <p className="mt-[3%] text-[clamp(12px,1vw,19px)] font-bold uppercase tracking-[.15em] text-slate-900">Please wait</p>
              <h1 className="mt-[3%] font-heading text-[clamp(30px,3.5vw,62px)] font-bold leading-tight text-[color:var(--granthi-primary)]">{activeQuestion.question}</h1>
              <p className="mt-[5%] max-w-[80%] text-[clamp(15px,1.45vw,27px)] leading-relaxed text-slate-700">Receiving wisdom from the Holy Abode and preparing a thoughtful bilingual answer for the Sangat.</p>
            </div>
          </div>
        ) : (
          <div key={activeQuestion.id + activeQuestion.updatedAt} className="granthi-answer relative z-10 grid h-full grid-rows-[13%_1fr_8%] bg-[#eee4d0] text-slate-900">
            <header className="flex items-center justify-between bg-[color:var(--granthi-primary)] px-[2.4%] text-white">
              <div className="flex min-w-0 items-center gap-[1.2vw]"><BookOpenIcon className="h-[3vw] min-h-8 w-[3vw] min-w-8 shrink-0 text-[color:var(--granthi-accent)]" /><h1 className="truncate font-heading text-[clamp(20px,2.25vw,41px)] font-bold">{activeQuestion.question}</h1></div>
              <span className="ml-4 shrink-0 text-[clamp(10px,.8vw,15px)] font-bold text-amber-200">Main screen in {secondsRemaining}s</span>
            </header>

            <section className="grid min-h-0 grid-cols-[24%_76%] gap-[1.1%] p-[2.2%]">
              <aside className="relative min-h-0 overflow-hidden rounded-md border border-[#cdbd9f] bg-[#d7c5a7]">
                <img src={granthiAnswerPortrait} alt="Granthi Ji sharing the answer" className="absolute inset-x-[2.5%] bottom-[4%] h-[95%] w-[95%] object-contain object-bottom drop-shadow-xl" />
                <div className="absolute inset-x-[5%] bottom-[4%] flex items-center gap-[5%] bg-[#f4ead7]/95 p-[4%] shadow-xl">
                  <QRCodeSVG value={questionUrl} size={58} level="M" marginSize={0} fgColor="#111827" bgColor="#f4ead7" className="h-auto w-[25%]" />
                  <div><p className="text-[clamp(9px,.72vw,14px)] font-bold text-[color:var(--granthi-primary)]">Ask your question</p><p className="text-[clamp(8px,.58vw,11px)]">Scan QR code</p></div>
                </div>
              </aside>

              <div className="grid min-w-0 grid-rows-[35%_65%] gap-[1.8%]">
                <article className="min-h-0 overflow-y-auto rounded-md border border-[#ded2bc] bg-[#fffdf8] p-[3%] shadow-sm">
                  <span className="inline-block bg-violet-800 px-[2%] py-[.7%] text-[clamp(10px,.78vw,15px)] font-bold text-white">Gurbani Reference</span>
                  {activeQuestion.gurbani ? <><p className="mt-[1.2%] font-gurmukhi text-[clamp(16px,1.45vw,28px)] font-bold leading-[1.3] text-[color:var(--granthi-primary)]">{activeQuestion.gurbani.gurmukhi}</p><p className="mt-[.7%] text-[clamp(11px,.8vw,15px)] font-bold text-violet-800">{activeQuestion.gurbani.source}</p><p className="mt-[.8%] font-gurmukhi text-[clamp(12px,.9vw,18px)] font-semibold leading-[1.35] text-slate-800"><span className="font-bold text-violet-800">ਪੰਜਾਬੀ ਅਰਥ: </span>{activeQuestion.gurbani.translationPunjabi}</p><p className="mt-[.6%] text-[clamp(12px,.88vw,17px)] font-semibold leading-[1.35] text-slate-700"><span className="font-bold text-violet-800">English: </span>{activeQuestion.gurbani.translationEnglish}</p></> : <p className="mt-[3%] text-[clamp(12px,.95vw,18px)] font-bold text-red-800">Gurbani reference required. This answer is awaiting review.</p>}
                </article>
                <div className="grid min-h-0 grid-cols-2 gap-[1.8%]">
                  <article className="min-h-0 overflow-y-auto rounded-md border border-[#ded2bc] bg-[#fffdf8] p-[3.5%] shadow-sm">
                    <span className="inline-block bg-emerald-700 px-[2%] py-[.7%] text-[clamp(10px,.78vw,15px)] font-bold text-white">English Answer</span>
                    <p className="mt-[1.5%] text-[clamp(18px,1.7vw,32px)] font-bold leading-[1.35] text-slate-900">{activeQuestion.answerEnglish}</p>
                  </article>
                  <article className="min-h-0 overflow-y-auto rounded-md border border-[#ded2bc] bg-[#fffdf8] p-[3.5%] shadow-sm">
                    <span className="inline-block bg-slate-900 px-[2%] py-[.7%] text-[clamp(10px,.78vw,15px)] font-bold text-white">Punjabi (ਪੰਜਾਬੀ)</span>
                    <p className="mt-[1.5%] font-gurmukhi text-[clamp(18px,1.8vw,34px)] font-bold leading-[1.4] text-slate-900">{activeQuestion.answerPunjabi}</p>
                  </article>
                </div>
              </div>
            </section>

            <footer className="flex items-center justify-between bg-[color:var(--granthi-primary)] px-[2.4%] text-[clamp(9px,.72vw,14px)] text-slate-200">
              <span>AI-assisted response for educational purposes. Please verify Gurbani references with trusted sources.</span><span className="font-heading text-[clamp(12px,1vw,19px)] font-bold text-white">{formatTime(now)}</span>
            </footer>
          </div>
        )}
      </div>
    </main>
  );
};

export default AskGranthiBoardPage;
