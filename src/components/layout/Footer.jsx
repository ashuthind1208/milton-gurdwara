import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDownIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { siteConfig } from '../../constants/siteConfig';
import phase2Service from '../../services/phase2Service';
import notificationService from '../../services/notificationService';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';

const socialIconClass = 'h-4 w-4';

const newsletterDefaults = {
  name: '',
  email: ''
};

const getFooterForeground = (hexColor) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hexColor || ''));
  if (!match) return '#ffffff';
  const channels = match.slice(1).map((channel) => parseInt(channel, 16) / 255);
  const luminance = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return (0.2126 * luminance[0]) + (0.7152 * luminance[1]) + (0.0722 * luminance[2]) > 0.45 ? '#172033' : '#ffffff';
};

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className={socialIconClass} aria-hidden="true">
    <path d="M13.6 22V13.3h2.9l.4-3.4h-3.3V7.8c0-1 .3-1.7 1.8-1.7H17V3.1c-.8-.1-1.6-.1-2.5-.1-2.5 0-4.1 1.5-4.1 4.4v2.5H7.6v3.4h2.8V22h3.2Z" fill="currentColor" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className={socialIconClass} aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" />
  </svg>
);

const YouTubeIcon = () => (
  <svg viewBox="0 0 24 24" className={socialIconClass} aria-hidden="true">
    <path d="M20.6 7.2c-.2-.9-.9-1.6-1.8-1.8-1.6-.4-8-.4-8-.4s-6.4 0-8 .4c-.9.2-1.6.9-1.8 1.8-.4 1.6-.4 4.8-.4 4.8s0 3.2.4 4.8c.2.9.9 1.6 1.8 1.8 1.6.4 8 .4 8 .4s6.4 0 8-.4c.9-.2 1.6-.9 1.8-1.8.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8Z" fill="currentColor" />
    <path d="M9.5 15.2V8.8l5.4 3.2-5.4 3.2Z" fill="white" />
  </svg>
);

const Footer = () => {
  const { user, isAuthenticated } = useAuth();
  const { branding, logoSrc } = useBranding();
  const footerForeground = getFooterForeground(branding.footerColor || branding.primaryColor);
  const [isNewsletterModalOpen, setIsNewsletterModalOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  const [selectedTopics, setSelectedTopics] = useState([]);
  const [topicError, setTopicError] = useState('');
  const topicDropdownRef = useRef(null);
  const { data: phase2ChannelsConfig } = useQuery({
    queryKey: ['phase2-channels-config-footer'],
    queryFn: () => phase2Service.getChannelsConfig().then((res) => res.data || null),
    staleTime: 60 * 1000,
    retry: false
  });

  const hasWhatsAppInfo = phase2ChannelsConfig?.whatsAppOptInEnabled === true && String(phase2ChannelsConfig?.whatsAppJoinLink || '').trim().length > 0;
  const whatsAppLink = String(phase2ChannelsConfig?.whatsAppJoinLink || '').trim();
  const form = useForm({ defaultValues: newsletterDefaults });

  const { data: topicOptions = [] } = useQuery({
    queryKey: ['newsletter-topics'],
    queryFn: () => notificationService.getNewsletterTopics().then((res) => res.data)
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    form.reset({
      name: String(user?.name || '').trim(),
      email: String(user?.email || '').trim().toLowerCase()
    });
    setSelectedTopics([]);
    setTopicError('');
  }, [form, isAuthenticated, user?.email, user?.name]);

  const closeNewsletterModal = () => {
    setIsNewsletterModalOpen(false);
    setIsTopicDropdownOpen(false);
    setTopicError('');
  };

  const openNewsletterModal = () => {
    setIsNewsletterModalOpen(true);
    setIsTopicDropdownOpen(false);
    setTopicError('');
    subscribeMutation.reset();
  };

  const toggleTopic = (topic) => {
    const normalizedTopic = String(topic || '').trim();
    if (!normalizedTopic) {
      return;
    }

    setSelectedTopics((previous) => {
      const exists = previous.some((entry) => String(entry || '').toLowerCase() === normalizedTopic.toLowerCase());
      if (exists) {
        return previous.filter((entry) => String(entry || '').toLowerCase() !== normalizedTopic.toLowerCase());
      }
      return [...previous, normalizedTopic];
    });
    setTopicError('');
  };

  const subscribeMutation = useMutation({
    mutationFn: (values) => notificationService.subscribe({
      name: values.name,
      email: values.email,
      interests: selectedTopics,
      source: isAuthenticated ? 'Logged in user' : 'Website footer'
    }),
    onSuccess: () => {
      if (!isAuthenticated) {
        form.reset(newsletterDefaults);
      }
      setSelectedTopics([]);
      setTopicError('');
    }
  });

  const topicButtonLabel = selectedTopics.length > 0
    ? `${selectedTopics.length} topic${selectedTopics.length > 1 ? 's' : ''} selected`
    : 'Select topics';

  const handleSubscribe = (values) => {
    if (selectedTopics.length === 0) {
      setTopicError('Please select at least one topic.');
      return;
    }
    setTopicError('');
    subscribeMutation.mutate(values);
  };

  return (
    <footer className="mt-16 border-t border-white/20 dark:border-slate-800" style={{ backgroundColor: branding.footerColor || branding.primaryColor || '#0B4EA2' }}>
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <img src={logoSrc} alt={`${branding.shortName} logo`} className="brand-logo h-8 w-8 rounded-full object-cover" />
            <p className="font-heading text-lg font-semibold" style={{ color: footerForeground }}>{branding.organizationName}</p>
          </div>
          <p className="mt-2 text-sm" style={{ color: footerForeground }}>{branding.tagline}</p>
          <p className="mt-2 text-sm font-gurmukhi" style={{ color: footerForeground }}>ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ</p>
        </div>

        <div className="mt-6 text-center">
          <p className="font-semibold" style={{ color: footerForeground }}>Contact</p>
          <p className="mt-2 text-sm" style={{ color: footerForeground }}>{branding.address || siteConfig.contact.address}</p>
          <p className="text-sm" style={{ color: footerForeground }}>{branding.phone || siteConfig.contact.phone}</p>
          <div className="mt-2 flex items-center justify-center gap-3 text-brand-blue dark:text-blue-200">
            <a href={branding.facebookUrl || siteConfig.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-white/70 transition hover:-translate-y-0.5 hover:bg-white dark:border-blue-300/40 dark:bg-slate-800">
              <FacebookIcon />
            </a>
            <a href={branding.instagramUrl || siteConfig.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-white/70 transition hover:-translate-y-0.5 hover:bg-white dark:border-blue-300/40 dark:bg-slate-800">
              <InstagramIcon />
            </a>
            <a href={branding.youtubeUrl || siteConfig.social.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-white/70 transition hover:-translate-y-0.5 hover:bg-white dark:border-blue-300/40 dark:bg-slate-800">
              <YouTubeIcon />
            </a>
          </div>
          <p className="mt-2 text-sm" style={{ color: footerForeground }}>{branding.email || siteConfig.contact.email}</p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={openNewsletterModal}
              className="inline-flex items-center rounded-full border border-brand-blue/25 bg-blue-50 px-3 py-1 text-xs font-semibold text-brand-blue transition hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-900/20 dark:text-blue-200"
            >
              Sign Up for Newsletter
            </button>
            {hasWhatsAppInfo ? (
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-900/20 dark:text-emerald-200"
              >
                Join WhatsApp Sangat Group
              </a>
            ) : null}
          </div>
        </div>
      </div>

      {isNewsletterModalOpen ? (
        <div className="fixed inset-0 z-[170] bg-slate-950/60 px-4 py-6 backdrop-blur-md">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="w-full max-w-4xl overflow-visible rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_-40px_rgba(15,23,42,0.65)]">
              <div className="relative rounded-t-3xl bg-gradient-to-r from-brand-blue via-blue-700 to-brand-saffron px-5 py-4 text-white">
                <button
                  type="button"
                  onClick={closeNewsletterModal}
                  className="absolute right-4 top-4 rounded-full border border-white/40 bg-white/10 p-1.5 text-white hover:bg-white/20"
                  aria-label="Close newsletter signup popup"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
                <p className="whitespace-nowrap text-xs font-semibold uppercase tracking-[0.18em] text-white/85">{branding.organizationName}</p>
                <h3 className="mt-1 whitespace-nowrap font-heading text-base font-extrabold sm:text-xl">Sign Up for Weekly Newsletter</h3>
                <p className="mt-2 text-sm text-white/90">Choose one or more topics to personalize your newsletter delivery.</p>
              </div>

              <form
                className="grid gap-4 p-5 md:grid-cols-2"
                onSubmit={form.handleSubmit(handleSubscribe)}
                onClickCapture={(event) => {
                  if (!isTopicDropdownOpen) {
                    return;
                  }
                  const target = event.target;
                  if (topicDropdownRef.current && target instanceof Node && !topicDropdownRef.current.contains(target)) {
                    setIsTopicDropdownOpen(false);
                  }
                }}
              >
                {subscribeMutation.isSuccess ? (
                  <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                    <p className="text-base font-bold text-emerald-800">Thank you for subscribing.</p>
                    <p className="mt-1 text-sm text-emerald-700">You will receive updates based on your selected topics.</p>
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={closeNewsletterModal}
                        className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white"
                      >
                        OK
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <label className="text-sm font-semibold text-slate-700">Full name
                      <input
                        {...form.register('name', { required: true })}
                        readOnly={isAuthenticated}
                        required className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">Email
                      <input
                        type="email"
                        {...form.register('email', { required: true })}
                        readOnly={isAuthenticated}
                        required className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5"
                      />
                    </label>
                    <div ref={topicDropdownRef} className="text-sm font-semibold text-slate-700 md:col-span-2">
                      Topics
                      <div className="relative mt-1">
                        <button
                          type="button"
                          onClick={() => setIsTopicDropdownOpen((previous) => !previous)}
                          className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm font-medium text-slate-700"
                          aria-expanded={isTopicDropdownOpen}
                        >
                          <span>{topicButtonLabel}</span>
                          <ChevronDownIcon className={`h-4 w-4 transition ${isTopicDropdownOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isTopicDropdownOpen ? (
                          <div className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                            {topicOptions.map((option) => {
                              const checked = selectedTopics.some((entry) => String(entry || '').toLowerCase() === String(option || '').toLowerCase());
                              return (
                                <label key={option} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-slate-700 hover:bg-blue-50">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleTopic(option)}
                                    className="h-4 w-4 rounded border-slate-300"
                                  />
                                  <span>{option}</span>
                                </label>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                      {selectedTopics.length > 0 ? (
                        <p className="mt-2 text-xs font-medium text-slate-600">Selected: {selectedTopics.join(', ')}</p>
                      ) : null}
                    </div>
                  </>
                )}

                {topicError && !subscribeMutation.isSuccess ? (
                  <p className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {topicError}
                  </p>
                ) : null}

                {subscribeMutation.isError ? (
                  <p className="md:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {String(subscribeMutation.error?.message || 'Unable to subscribe right now.')}
                  </p>
                ) : null}

                <div className="md:col-span-2 flex justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={closeNewsletterModal}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                  >
                    Close
                  </button>
                  {!subscribeMutation.isSuccess ? (
                    <button
                      type="submit"
                      disabled={subscribeMutation.isPending}
                      className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {subscribeMutation.isPending ? 'Subscribing...' : 'Subscribe'}
                    </button>
                  ) : null}
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </footer>
  );
};

export default Footer;
