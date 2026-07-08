import { siteConfig } from '../../constants/siteConfig';
import khandaMark from '../../assets/khanda-mark.webp';

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
          <div className="mt-3 flex gap-3 text-sm text-brand-blue dark:text-blue-200">
            <a href={siteConfig.social.facebook} target="_blank" rel="noreferrer">Facebook</a>
            <a href={siteConfig.social.instagram} target="_blank" rel="noreferrer">Instagram</a>
            <a href={siteConfig.social.youtube} target="_blank" rel="noreferrer">YouTube</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
