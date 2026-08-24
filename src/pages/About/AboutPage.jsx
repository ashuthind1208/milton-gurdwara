import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PhoneIcon, XMarkIcon } from '@heroicons/react/24/outline';
import PageHero from '../../components/common/PageHero';
import SectionTitle from '../../components/common/SectionTitle';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import cmsService from '../../services/cmsService';
import userService from '../../services/userService';

const isImageUrl = (value = '') => /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(String(value || ''));

const AboutPage = () => {
  const [selectedMember, setSelectedMember] = useState(null);
  const meta = useSeoMeta('About', 'History, mission, leadership, and management details of the Gurdwara.');
  const { data: content } = useQuery({
    queryKey: ['page-content', 'about'],
    queryFn: () => cmsService.getPageContent('about').then((res) => res.data)
  });

  const sections = content?.sections || [];
  const { data: publicMembers = [] } = useQuery({
    queryKey: ['public-members'],
    queryFn: () => userService.getPublicMembers().then((res) => res.data)
  });
  const membersByTitle = publicMembers.reduce((groups, member) => {
    const title = String(member.title || '').trim();
    if (!title) return groups;
    groups[title] = [...(groups[title] || []), member];
    return groups;
  }, {});

  return (
    <div className="space-y-10">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle ?? 'About Our Gurdwara'} description={content?.heroDescription ?? 'Serving the sangat with spiritual guidance, seva, and community development.'} />

      {content?.mediaUrl ? <img src={content.mediaUrl} alt="About section" className="h-56 w-full object-cover" loading="lazy" /> : null}

      {content?.intro ? <div className="text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: content.intro }} /> : null}

      <section>
        <SectionTitle title="History, Vision, and Mission" />
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => (
            <article key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-heading text-xl font-semibold text-brand-blue">{section.title}</h3>
              <div className="mt-2 text-sm leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: section.body }} />
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

      {Object.keys(membersByTitle).length > 0 ? (
        <section aria-labelledby="community-members-title">
          <SectionTitle title="Our Community Leadership" />
          <div className="space-y-8">
            {Object.entries(membersByTitle).map(([title, members]) => (
              <div key={title}>
                <h3 className="mb-4 border-b border-slate-200 pb-2 font-heading text-xl font-semibold text-brand-blue">{title}</h3>
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {members.map((member) => (
                    <button key={member.id} type="button" onClick={() => setSelectedMember(member)} className="group min-w-0 text-left" aria-label={`View details for ${member.name}`}>
                      <img
                        src={member.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name || 'Member')}`}
                        alt={member.name}
                        className="aspect-square w-full rounded-lg border border-slate-200 object-cover shadow-sm transition group-hover:border-brand-blue group-hover:shadow-md"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <span className="mt-2 block text-center text-sm font-bold text-slate-900 group-hover:text-brand-blue">{member.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {selectedMember ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="member-dialog-title">
          <button type="button" className="absolute inset-0 cursor-default" onClick={() => setSelectedMember(null)} aria-label="Close member details" />
          <article className="relative z-10 my-auto w-full max-w-2xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="grid sm:grid-cols-[minmax(0,240px)_1fr]">
              <img
                src={selectedMember.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(selectedMember.name || 'Member')}`}
                alt={selectedMember.name}
                className="aspect-square h-full min-h-64 w-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="relative flex min-w-0 flex-col p-6 sm:p-8">
                <button type="button" onClick={() => setSelectedMember(null)} className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Close member details">
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <p className="pr-10 text-xs font-bold uppercase text-brand-saffron">{selectedMember.title}</p>
                <h3 id="member-dialog-title" className="mt-2 font-heading text-3xl font-semibold text-slate-950">{selectedMember.name}</h3>
                {selectedMember.description ? <p className="mt-4 whitespace-pre-line text-sm leading-6 text-slate-600">{selectedMember.description}</p> : null}
                {selectedMember.phone ? (
                  <a href={`tel:${selectedMember.phone}`} className="mt-6 inline-flex w-fit items-center gap-2 rounded-lg bg-brand-blue px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800">
                    <PhoneIcon className="h-4 w-4" />
                    {selectedMember.phone}
                  </a>
                ) : null}
              </div>
            </div>
          </article>
        </div>
      ) : null}
    </div>
  );
};

export default AboutPage;
