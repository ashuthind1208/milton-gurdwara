import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { SparklesIcon } from '@heroicons/react/24/outline';
import PageHero from '../../components/common/PageHero';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import Card from '../../components/ui/Card';
import BreadcrumbTrail from '../../components/common/BreadcrumbTrail';
import kidsLearningService from '../../services/kidsLearningService';

const todayDateOnly = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isPublishedNow = (item = {}) => {
  if (item?.isPublished === false) {
    return false;
  }

  const publishDate = String(item?.publishDate || '').trim();
  if (!publishDate) {
    return true;
  }

  const parsed = new Date(publishDate);
  if (Number.isNaN(parsed.getTime())) {
    return true;
  }

  return parsed <= todayDateOnly();
};

const KidsLearningPage = () => {
  const meta = useSeoMeta('Kids Learning', 'Weekly Sikh quizzes, stories, and Punjabi word cards for children.');
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [gurmatWord, setGurmatWord] = useState('');
  const [gurmatGuide, setGurmatGuide] = useState(null);

  const { data } = useQuery({
    queryKey: ['kids-learning-content'],
    queryFn: () => kidsLearningService.getContent().then((res) => res.data)
  });

  const publishedQuizzes = useMemo(
    () => (Array.isArray(data?.quizzes) ? data.quizzes : []).filter((item) => isPublishedNow(item)),
    [data?.quizzes]
  );

  const publishedStories = useMemo(
    () => (Array.isArray(data?.stories) ? data.stories : []).filter((item) => isPublishedNow(item)),
    [data?.stories]
  );

  const selectedQuiz = useMemo(
    () => publishedQuizzes.find((item) => item.id === selectedQuizId) || null,
    [publishedQuizzes, selectedQuizId]
  );

  const wordCard = isPublishedNow(data?.wordOfWeek) ? data?.wordOfWeek : null;

  const gurmatGuideMutation = useMutation({
    mutationFn: (word) => kidsLearningService.generateGurmatGuide(word).then((res) => res.data),
    onSuccess: (guide) => setGurmatGuide(guide)
  });

  const submitGurmatWord = (event) => {
    event.preventDefault();
    const word = gurmatWord.trim();
    if (!word || gurmatGuideMutation.isPending) {
      return;
    }
    setGurmatGuide(null);
    gurmatGuideMutation.mutate(word);
  };

  const breadcrumbItems = useMemo(() => {
    const items = [
      { label: 'Home', path: '/' },
      { label: 'Kids Learning', path: '/kids-learning' }
    ];

    if (selectedQuizId) {
      items.push({ label: 'Quiz', isCurrent: true });
      return items;
    }

    items[items.length - 1] = { ...items[items.length - 1], isCurrent: true };
    return items;
  }, [selectedQuizId]);

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title={data?.heroTitle || 'Kids Sikh Learning'}
        description={data?.heroDescription || 'Stories, quizzes, and Punjabi vocabulary for Sikh children and families.'}
      />
      <BreadcrumbTrail items={breadcrumbItems} className="-mt-4 px-1" />

      {data?.intro ? (
        <Card>
          <p className="text-sm leading-relaxed text-slate-700">{data.intro}</p>
        </Card>
      ) : null}

      {wordCard ? (
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Punjabi Word of the Week</h2>
          <div className="mt-3 rounded-xl border border-brand-blue/20 bg-brand-blue/5 p-4">
            <p className="text-2xl font-black text-brand-blue">{wordCard.punjabi || '-'}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">{wordCard.transliteration || ''}</p>
            <p className="mt-3 text-sm text-slate-700"><span className="font-bold">Meaning:</span> {wordCard.englishMeaning || '-'}</p>
            <p className="mt-2 text-sm text-slate-700"><span className="font-bold">Example:</span> {wordCard.example || '-'}</p>
          </div>

          <div className="mt-5 border-t border-slate-200 pt-5">
            <div className="flex items-start gap-3">
              <SparklesIcon className="mt-0.5 h-5 w-5 shrink-0 text-brand-saffron" aria-hidden="true" />
              <div>
                <h3 className="text-base font-bold text-slate-900">AI Gurmat Learning Guide</h3>
                <p className="mt-1 text-sm text-slate-600">Enter one Punjabi or English word to explore it through a trusted Gurbani line.</p>
              </div>
            </div>

            <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={submitGurmatWord}>
              <label className="sr-only" htmlFor="gurmat-word">Punjabi or English word</label>
              <input
                id="gurmat-word"
                type="text"
                value={gurmatWord}
                onChange={(event) => setGurmatWord(event.target.value)}
                minLength={2}
                maxLength={40}
                placeholder="Try Seva, courage, or ਦਇਆ"
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20"
                required
              />
              <button
                type="submit"
                disabled={gurmatGuideMutation.isPending}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-navy disabled:cursor-wait disabled:opacity-60"
              >
                <SparklesIcon className="h-4 w-4" aria-hidden="true" />
                {gurmatGuideMutation.isPending ? 'Creating lesson...' : 'Create lesson'}
              </button>
            </form>

            {gurmatGuideMutation.isError ? (
              <p role="alert" className="mt-3 text-sm font-semibold text-rose-700">{gurmatGuideMutation.error?.message || 'The local AI guide is unavailable right now.'}</p>
            ) : null}

            {gurmatGuide ? (
              <div className="mt-5 space-y-5 border-l-4 border-brand-saffron pl-4">
                <div>
                  <p className="font-gurmukhi text-2xl font-bold text-brand-navy">{gurmatGuide.wordPunjabi || gurmatGuide.requestedWord}</p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{gurmatGuide.wordTransliteration || gurmatGuide.wordEnglish}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-700">{gurmatGuide.meaningEnglish}</p>
                  <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-7 text-slate-700">{gurmatGuide.meaningPunjabi}</p>
                </div>

                <div>
                  <p className="text-xs font-bold uppercase text-brand-blue">Gurbani connection</p>
                  <blockquote lang="pa" className="mt-2 font-gurmukhi text-lg font-semibold leading-8 text-brand-navy">{gurmatGuide.gurbani?.gurmukhi}</blockquote>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{gurmatGuide.gurbani?.source}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700"><span className="font-bold">English:</span> {gurmatGuide.gurbani?.translationEnglish}</p>
                  <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-7 text-slate-700"><span className="font-bold">ਪੰਜਾਬੀ:</span> {gurmatGuide.gurbani?.translationPunjabi}</p>
                </div>

                <div>
                  <p className="text-sm leading-6 text-slate-700"><span className="font-bold">Why it matters:</span> {gurmatGuide.importanceEnglish}</p>
                  <p lang="pa" className="mt-1 font-gurmukhi text-sm leading-7 text-slate-700">{gurmatGuide.importancePunjabi}</p>
                  {gurmatGuide.reflectionQuestion ? <p className="mt-3 text-sm font-semibold text-brand-blue">Think about it: {gurmatGuide.reflectionQuestion}</p> : null}
                </div>

                <p className="text-xs text-slate-500">AI-created learning support. Please explore deeper questions with a parent, teacher, or granthi.</p>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Weekly Quizzes</h2>
          <div className="mt-4 space-y-3">
            {publishedQuizzes.map((quiz) => (
              <button
                key={quiz.id}
                type="button"
                onClick={() => setSelectedQuizId((current) => (current === quiz.id ? '' : quiz.id))}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-brand-blue/50"
              >
                <p className="text-sm font-bold text-slate-900">{quiz.title || 'Untitled Quiz'}</p>
                <p className="mt-1 text-xs text-slate-600">Age Group: {quiz.ageGroup || 'All'}</p>
                {selectedQuiz?.id === quiz.id ? (
                  <div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold">{quiz.question || 'Question pending'}</p>
                    <ul className="list-disc pl-5">
                      {(Array.isArray(quiz.options) ? quiz.options : []).map((option) => (
                        <li key={`${quiz.id}-${option}`}>{option}</li>
                      ))}
                    </ul>
                    {quiz.explanation ? <p className="text-xs text-slate-600">{quiz.explanation}</p> : null}
                  </div>
                ) : null}
              </button>
            ))}
            {publishedQuizzes.length === 0 ? <p className="text-sm text-slate-500">No quizzes published yet.</p> : null}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-bold text-slate-900">Sikh Stories by Age Group</h2>
          <div className="mt-4 space-y-3">
            {publishedStories.map((story) => (
              <article key={story.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">{story.title || 'Untitled Story'}</h3>
                  <span className="rounded-full bg-brand-saffron/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{story.ageGroup || 'All'}</span>
                </div>
                {story.summary ? <p className="mt-2 text-sm text-slate-700">{story.summary}</p> : null}
                {story.content ? <p className="mt-2 text-sm text-slate-600">{story.content}</p> : null}
              </article>
            ))}
            {publishedStories.length === 0 ? <p className="text-sm text-slate-500">No stories published yet.</p> : null}
          </div>
        </Card>
      </div>

      {data?.streakBadge?.enabled ? (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-bold text-emerald-800">Progress Streak Badge</p>
            <p className="text-sm text-emerald-700">{data.streakBadge.badgeLabel || 'Weekly Learner'}: {Number(data.streakBadge.targetDays || 7)} day goal</p>
          </div>
        </Card>
      ) : null}
    </div>
  );
};

export default KidsLearningPage;