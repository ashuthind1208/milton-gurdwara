import { useQuery } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import cmsService from '../../services/cmsService';

const SikhismPage = () => {
  const meta = useSeoMeta('Sikhism', 'Structured Sikh educational content for beginners, families, and youth.');
  const { data: content } = useQuery({
    queryKey: ['page-content', 'sikhism'],
    queryFn: () => cmsService.getPageContent('sikhism').then((res) => res.data)
  });

  const sections = content?.sections || [];

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle ?? 'Learn Sikhism'} description={content?.heroDescription ?? 'Structured learning resources prepared for community education.'} />
      {content?.mediaUrl ? <img src={content.mediaUrl} alt="Sikh education" className="h-56 w-full object-cover" loading="lazy" /> : null}
      {content?.intro ? <p className="text-sm leading-relaxed text-slate-700">{content.intro}</p> : null}
      <div className="grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <h3 className="font-heading text-lg font-semibold text-brand-blue">{section.title}</h3>
            <p className="mt-1 text-sm text-slate-700">{section.body}</p>
            {section.mediaUrl ? <a href={section.mediaUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-semibold text-brand-blue hover:underline">Open reference media</a> : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SikhismPage;
