import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import Card from '../../components/ui/Card';
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

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero
        title={data?.heroTitle || 'Kids Sikh Learning'}
        description={data?.heroDescription || 'Stories, quizzes, and Punjabi vocabulary for Sikh children and families.'}
      />

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