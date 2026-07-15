import { useQuery } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import SectionTitle from '../../components/common/SectionTitle';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import cmsService from '../../services/cmsService';

const isImageUrl = (value = '') => /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(String(value || ''));

const AboutPage = () => {
  const meta = useSeoMeta('About', 'History, mission, leadership, and management details of the Gurdwara.');
  const { data: content } = useQuery({
    queryKey: ['page-content', 'about'],
    queryFn: () => cmsService.getPageContent('about').then((res) => res.data)
  });

  const sections = content?.sections || [];

  return (
    <div className="space-y-10">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle ?? 'About Our Gurdwara'} description={content?.heroDescription ?? 'Serving the sangat with spiritual guidance, seva, and community development.'} />

      {content?.mediaUrl ? <img src={content.mediaUrl} alt="About section" className="h-56 w-full object-cover" loading="lazy" /> : null}

      {content?.intro ? <p className="text-sm leading-relaxed text-slate-700">{content.intro}</p> : null}

      <section>
        <SectionTitle title="History, Vision, and Mission" />
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-heading text-xl font-semibold text-brand-blue">{section.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">{section.body}</p>
              {section.mediaUrl ? (
                isImageUrl(section.mediaUrl) ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    <img src={section.mediaUrl} alt={section.title || 'Section media'} className="h-48 w-full object-contain" loading="lazy" />
                  </div>
                ) : (
                  <a href={section.mediaUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-xs font-semibold text-brand-blue hover:underline">Open section media</a>
                )
              ) : null}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
