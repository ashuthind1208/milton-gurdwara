import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import Card from '../../components/ui/Card';
import BreadcrumbTrail from '../../components/common/BreadcrumbTrail';
import GurmatLearningGuide from '../../components/kids/GurmatLearningGuide';
import AiQuizFlashcards from '../../components/kids/AiQuizFlashcards';
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
  const meta = useSeoMeta('Kids Learning', 'AI-assisted Sikh quizzes, stories, and bilingual Gurmat vocabulary for children.');

  const { data } = useQuery({
    queryKey: ['kids-learning-content'],
    queryFn: () => kidsLearningService.getContent().then((res) => res.data)
  });

  const publishedStories = useMemo(
    () => (Array.isArray(data?.stories) ? data.stories : []).filter((item) => isPublishedNow(item)),
    [data?.stories]
  );

  const breadcrumbItems = useMemo(() => {
    return [
      { label: 'Home', path: '/' },
      { label: 'Kids Learning', path: '/kids-learning', isCurrent: true }
    ];
  }, []);

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

      <Card>
          <GurmatLearningGuide />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <AiQuizFlashcards />
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