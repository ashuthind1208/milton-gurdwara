import { siteConfig } from '../../constants/siteConfig';
import khandaMark from '../../assets/khanda-mark.webp';

const socialIconClass = 'h-4 w-4';

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
  return (
    <footer className="mt-16 border-t border-brand-blue/20 bg-gradient-to-br from-brand-cream via-amber-50 to-blue-50 dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
        <div>
          <div className="flex items-center gap-2">
            <img src={khandaMark} alt="Khanda symbol" className="h-7 w-7" />
            <p className="font-heading text-lg font-semibold text-brand-blue">{siteConfig.name}</p>
          </div>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">A spiritually rooted and community focused digital platform for sangat services.</p>
          <p className="mt-2 text-sm font-gurmukhi text-brand-navy dark:text-brand-cream">ਵਾਹਿਗੁਰੂ ਜੀ ਕਾ ਖਾਲਸਾ, ਵਾਹਿਗੁਰੂ ਜੀ ਕੀ ਫਤਿਹ</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Contact</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{siteConfig.contact.address}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{siteConfig.contact.phone}</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">{siteConfig.contact.email}</p>
        </div>
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">Hours</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Daily: 5:00 AM to 9:00 PM</p>
          <p className="text-sm text-slate-600 dark:text-slate-300">Langar: Weekends and Gurpurab Specials</p>
          <div className="mt-3 flex items-center gap-3 text-brand-blue dark:text-blue-200">
            <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer" aria-label="Facebook" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-white/70 transition hover:-translate-y-0.5 hover:bg-white dark:border-blue-300/40 dark:bg-slate-800">
              <FacebookIcon />
            </a>
            <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer" aria-label="Instagram" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-white/70 transition hover:-translate-y-0.5 hover:bg-white dark:border-blue-300/40 dark:bg-slate-800">
              <InstagramIcon />
            </a>
            <a href={siteConfig.social.youtube} target="_blank" rel="noreferrer" aria-label="YouTube" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/20 bg-white/70 transition hover:-translate-y-0.5 hover:bg-white dark:border-blue-300/40 dark:bg-slate-800">
              <YouTubeIcon />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
