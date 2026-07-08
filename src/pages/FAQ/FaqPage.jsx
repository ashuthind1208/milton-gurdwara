import PageHero from '../../components/common/PageHero';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';

const faqs = [
  { q: 'What are Gurdwara opening hours?', a: 'The Gurdwara is open daily from 5:00 AM to 9:00 PM.' },
  { q: 'How can I volunteer?', a: 'Use the Seva page form and choose the seva category that fits your schedule.' },
  { q: 'How do online donations work?', a: 'Select campaign, amount, and frequency on the Donation page. Payment integration is modular.' }
];

const FaqPage = () => {
  const meta = useSeoMeta('FAQ', 'Frequently asked questions for visitors, volunteers, and donors.');

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title="Frequently Asked Questions" description="Answers for visitors, volunteers, and contributors." />
      <div className="space-y-4">
        {faqs.map((item) => (
          <article key={item.q} className="border-b border-slate-200 pb-3">
            <h3 className="font-semibold text-brand-blue">{item.q}</h3>
            <p className="mt-1 text-sm text-slate-600">{item.a}</p>
          </article>
        ))}
      </div>
    </div>
  );
};

export default FaqPage;
