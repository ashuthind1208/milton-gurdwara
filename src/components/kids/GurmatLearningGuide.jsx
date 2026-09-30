import { useState } from 'react';
import { SparklesIcon } from '@heroicons/react/24/outline';

const GurmatLearningGuide = ({ compact = false, publishedGuide = null, publishedArchive = [] }) => {
  const [selectedGuide, setSelectedGuide] = useState(null);
  const guide = selectedGuide || publishedGuide || null;

  return (
    <div className={`${compact ? 'mt-4' : 'mt-5'} border-t border-slate-200 pt-4`}>
      <div className="flex items-start gap-3">
        <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-saffron" aria-hidden="true" />
        <div>
          <h3 className="text-base font-bold text-slate-900">Word of the Day</h3>
          <p className="mt-1 text-sm text-slate-600">Today&apos;s featured Gurmat word, selected by the Gurdwara team.</p>
        </div>
      </div>

      {publishedArchive.length > 1 ? (
        <div className="mt-4">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Published word archive</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {publishedArchive.slice(0, 5).map((entry) => (
              <button
                key={entry.searchId}
                type="button"
                onClick={() => setSelectedGuide(entry)}
                aria-pressed={guide?.searchId === entry.searchId}
                className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:border-brand-blue/50 hover:text-brand-blue aria-pressed:border-brand-blue aria-pressed:bg-brand-blue aria-pressed:text-white"
              >
                {entry.wordEnglish || entry.requestedWord}
                {entry.wordPunjabi ? <span className="ml-1 font-gurmukhi">· {entry.wordPunjabi}</span> : null}
              </button>
            ))}
          </div>
        </div>
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