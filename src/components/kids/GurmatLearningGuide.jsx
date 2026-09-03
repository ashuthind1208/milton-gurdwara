import { useId, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { SparklesIcon } from '@heroicons/react/24/outline';
import kidsLearningService from '../../services/kidsLearningService';

const GurmatLearningGuide = ({ compact = false }) => {
  const inputId = useId();
  const [word, setWord] = useState('');
  const [guide, setGuide] = useState(null);

  const guideMutation = useMutation({
    mutationFn: (requestedWord) => kidsLearningService.generateGurmatGuide(requestedWord).then((res) => res.data),
    onSuccess: (nextGuide) => setGuide(nextGuide)
  });

  const submitWord = (event) => {
    event.preventDefault();
    const requestedWord = word.trim();
    if (!requestedWord || guideMutation.isPending) {
      return;
    }
    setGuide(null);
    guideMutation.mutate(requestedWord);
  };

  return (
    <div className={`${compact ? 'mt-4' : 'mt-5'} border-t border-slate-200 pt-4`}>
      <div className="flex items-start gap-3">
        <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-saffron" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-slate-900">AI Gurmat Learning Guide</h3>
          <p className="mt-1 text-sm text-slate-600">Enter one Punjabi or English word to explore it through a trusted Gurbani line.</p>
        </div>
      </div>

      <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitWord}>
        <label className="sr-only" htmlFor={inputId}>Punjabi or English word</label>
        <input
          id={inputId}
          type="text"
          value={word}
          onChange={(event) => setWord(event.target.value)}
          minLength={2}
          maxLength={40}
          placeholder="Try Seva, courage, or ਦਇਆ"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
          required
        />
        <button
          type="submit"
          disabled={guideMutation.isPending}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-navy disabled:cursor-wait disabled:opacity-60"
        >
          <SparklesIcon className="h-4 w-4" aria-hidden="true" />
          {guideMutation.isPending ? 'Creating lesson...' : 'Create lesson'}
        </button>
      </form>

      {guideMutation.isError ? (
        <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{guideMutation.error?.message || 'The AI guide is unavailable right now.'}</p>
      ) : null}

      {guide ? (
        <div className="mt-5 space-y-5 border-l-4 border-brand-saffron pl-4">
          <div>
            <p className="font-gurmukhi text-2xl font-bold text-brand-navy">{guide.wordPunjabi || guide.requestedWord}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{guide.wordTransliteration || guide.wordEnglish}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">{guide.meaningEnglish}</p>
            <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-7 text-slate-700">{guide.meaningPunjabi}</p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase text-brand-blue">Gurbani connection</p>
            <blockquote lang="pa" className="mt-2 font-gurmukhi text-lg font-semibold leading-8 text-brand-navy">{guide.gurbani?.gurmukhi}</blockquote>
            <p className="mt-1 text-xs font-semibold text-slate-500">{guide.gurbani?.source}</p>
            <p className="mt-3 text-sm leading-6 text-slate-700"><span className="font-bold">English:</span> {guide.gurbani?.translationEnglish}</p>
            <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-7 text-slate-700"><span className="font-bold">ਪੰਜਾਬੀ:</span> {guide.gurbani?.translationPunjabi}</p>
          </div>

          <div>
            <p className="text-sm leading-6 text-slate-700"><span className="font-bold">Why it matters:</span> {guide.importanceEnglish}</p>
            <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-7 text-slate-700">{guide.importancePunjabi}</p>
            {guide.reflectionQuestion ? <p className="mt-3 text-sm font-semibold text-brand-blue">Think about it: {guide.reflectionQuestion}</p> : null}
          </div>

          <p className="text-xs text-slate-500">AI-created learning support. Please explore deeper questions with a parent, teacher, or granthi.</p>
        </div>
      ) : null}
    </div>
  );
};

export default GurmatLearningGuide;