import { useQuery } from '@tanstack/react-query';
import PageHero from '../../components/common/PageHero';
import ContactForm from '../../components/forms/ContactForm';
import { siteConfig } from '../../constants/siteConfig';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import cmsService from '../../services/cmsService';

const ContactPage = () => {
  const meta = useSeoMeta('Contact', 'Contact details, map placeholder, directions, and inquiry form.');
  const { data: content } = useQuery({
    queryKey: ['page-content', 'contact'],
    queryFn: () => cmsService.getPageContent('contact').then((res) => res.data)
  });

  const onSubmit = () => {
    window.alert('Thank you. Your message has been submitted.');
  };

  const address = content?.address || siteConfig.contact.address || '7035 Sixth Line, Milton ON';
  const fallbackEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const mapEmbedSrc = content?.mapEmbedUrl || fallbackEmbed;
  const mapOpenLink = content?.mapEmbedUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <PageHero title={content?.heroTitle ?? 'Contact Us'} description={content?.heroDescription ?? 'Reach the Gurdwara team for inquiries, directions, or support.'} />
      {content?.mediaUrl ? <img src={content.mediaUrl} alt="Contact media" className="h-56 w-full rounded-xl object-cover" loading="lazy" /> : null}
      {content?.intro ? <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-700">{content.intro}</p> : null}
      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="font-heading text-xl font-semibold text-brand-blue">Get in Touch</h3>
          <p className="mt-3 text-sm">Phone: {content?.phone || siteConfig.contact.phone}</p>
          <p className="text-sm">Email: {content?.email || siteConfig.contact.email}</p>
          <p className="text-sm">Address: {address}</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <iframe
              title="Gurdwara location map"
              src={mapEmbedSrc}
              className="h-64 w-full"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
          <a href={mapOpenLink} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-brand-blue">Open in Google Maps</a>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <ContactForm onSubmit={onSubmit} />
        </section>
      </div>

      {(content?.sections || []).length > 0 ? (
        <section className="space-y-3">
          {(content.sections || []).map((section) => (
            <article key={section.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="font-heading text-lg font-semibold text-brand-blue">{section.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{section.body}</p>
              {section.mediaUrl ? <img src={section.mediaUrl} alt={section.title} className="mt-3 h-48 w-full rounded-lg object-cover" loading="lazy" /> : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
};

export default ContactPage;
