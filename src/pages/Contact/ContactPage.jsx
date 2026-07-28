import { useQuery } from '@tanstack/react-query';
import {
  ClockIcon,
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
  PlayCircleIcon
} from '@heroicons/react/24/outline';
import PageHero from '../../components/common/PageHero';
import ContactForm from '../../components/forms/ContactForm';
import { siteConfig } from '../../constants/siteConfig';
import useSeoMeta from '../../hooks/useSeoMeta';
import Seo from '../../components/common/Seo';
import cmsService from '../../services/cmsService';

const QUICK_HOURS = [
  { label: 'Darbar Sahib', value: 'Daily: 5:00 AM to 9:00 PM' },
  { label: 'Langar Hall', value: 'Weekends and Gurpurab Specials' },
  { label: 'Office Support', value: 'Mon-Sun: 10:00 AM to 6:00 PM' }
];

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
  const phone = content?.phone || siteConfig.contact.phone;
  const email = content?.email || siteConfig.contact.email;
  const normalizedPhone = String(phone || '').replace(/[^\d+]/g, '');
  const phoneHref = normalizedPhone ? `tel:${normalizedPhone}` : '#';
  const emailHref = `mailto:${email}`;
  const fallbackEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(address)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;
  const mapEmbedSrc = content?.mapEmbedUrl || fallbackEmbed;
  const mapOpenLink = content?.mapEmbedUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const social = siteConfig.social || {};

  const quickActions = [
    { label: 'Call Now', href: phoneHref, icon: PhoneIcon },
    { label: 'Email Us', href: emailHref, icon: EnvelopeIcon },
    { label: 'Get Directions', href: mapOpenLink, icon: MapPinIcon, external: true }
  ];

  return (
    <div className="space-y-8">
      <Seo {...meta} />
      <section className="overflow-hidden rounded-3xl border border-brand-blue/15 bg-[radial-gradient(circle_at_top_right,_#dbeafe_0%,_#ffffff_36%,_#fff7ed_100%)] p-5 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.65)] sm:p-6">
        <PageHero
          eyebrow="Connect with Sangat"
          title={content?.heroTitle ?? 'Contact Us'}
          description={content?.heroDescription ?? 'Reach the Gurdwara team for inquiries, directions, support, and seva coordination.'}
          containerClassName="max-w-none"
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <a
                key={action.label}
                href={action.href}
                target={action.external ? '_blank' : undefined}
                rel={action.external ? 'noreferrer' : undefined}
                className="group inline-flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 text-sm font-semibold text-slate-800 transition hover:-translate-y-0.5 hover:border-brand-blue/35 hover:shadow-md"
              >
                <span>{action.label}</span>
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-brand-blue transition group-hover:border-brand-blue/30 group-hover:bg-brand-blue/10">
                  <Icon className="h-4 w-4" />
                </span>
              </a>
            );
          })}
        </div>
      </section>

      {content?.mediaUrl ? (
        <img
          src={content.mediaUrl}
          alt="Contact media"
          className="h-56 w-full rounded-2xl border border-slate-200 object-cover shadow-[0_18px_40px_-36px_rgba(15,23,42,0.7)]"
          loading="lazy"
        />
      ) : null}

      {content?.intro ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-700">
          {content.intro}
        </p>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-42px_rgba(15,23,42,0.7)] sm:p-5">
            <h3 className="font-heading text-2xl font-semibold text-brand-blue">Visit or Contact</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <PhoneIcon className="h-4 w-4" />
                  Phone
                </p>
                <a href={phoneHref} className="mt-1 block text-sm font-semibold text-slate-900 hover:text-brand-blue">{phone}</a>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <EnvelopeIcon className="h-4 w-4" />
                  Email
                </p>
                <a href={emailHref} className="mt-1 block truncate text-sm font-semibold text-slate-900 hover:text-brand-blue">{email}</a>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                <p className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <MapPinIcon className="h-4 w-4" />
                  Address
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{address}</p>
              </div>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_18px_45px_-42px_rgba(15,23,42,0.7)] sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <h3 className="font-heading text-xl font-semibold text-brand-blue">Find Us on Map</h3>
              <a href={mapOpenLink} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-brand-blue transition hover:border-brand-blue/30 hover:bg-blue-50">Open Google Maps</a>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <iframe
                title="Gurdwara location map"
                src={mapEmbedSrc}
                className="h-72 w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </article>
        </section>

        <section className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-42px_rgba(15,23,42,0.7)] sm:p-5">
            <h3 className="font-heading text-2xl font-semibold text-brand-blue">Send a Message</h3>
            <p className="mt-1 text-sm text-slate-600">Share your query and the team will connect with you shortly.</p>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/55 p-3 sm:p-4">
              <ContactForm onSubmit={onSubmit} />
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_18px_45px_-42px_rgba(15,23,42,0.7)]">
            <h3 className="font-heading text-xl font-semibold text-brand-blue">Hours &amp; Channels</h3>
            <ul className="mt-3 space-y-2">
              {QUICK_HOURS.map((item) => (
                <li key={item.label} className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
                  <ClockIcon className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                    <p className="text-sm font-semibold text-slate-900">{item.value}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <a href={social.facebook} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Facebook</a>
              <a href={social.instagram} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">Instagram</a>
              <a href={social.youtube} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-center text-xs font-semibold text-slate-700 transition hover:border-brand-blue/30 hover:text-brand-blue">
                <PlayCircleIcon className="h-4 w-4" />
                YouTube
              </a>
            </div>
          </article>
        </section>
      </div>

      {(content?.sections || []).length > 0 ? (
        <section className="space-y-3">
          {(content.sections || []).map((section) => (
            <article key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_14px_35px_-38px_rgba(15,23,42,0.8)]">
              <h3 className="font-heading text-lg font-semibold text-brand-blue">{section.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-700">{section.body}</p>
              {section.mediaUrl ? <img src={section.mediaUrl} alt={section.title} className="mt-3 h-48 w-full rounded-lg object-contain bg-slate-50" loading="lazy" /> : null}
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
};

export default ContactPage;
