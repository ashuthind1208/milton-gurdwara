import { useEffect, useState } from 'react';
import { ArrowDownTrayIcon, ShareIcon, XMarkIcon } from '@heroicons/react/24/outline';

const DISMISSED_AT_KEY = 'ssm_app_install_dismissed_at';
const DISMISSAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

const isIosDevice = () => {
  const userAgent = window.navigator.userAgent || '';
  return /iPad|iPhone|iPod/i.test(userAgent)
    || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
};

const isInstalled = () => (typeof window.matchMedia === 'function'
  && window.matchMedia('(display-mode: standalone)').matches)
  || window.navigator.standalone === true;

const AppInstallPrompt = () => {
  const [installEvent, setInstallEvent] = useState(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY) || 0);
    return Date.now() - dismissedAt < DISMISSAL_DURATION_MS;
  });
  const ios = isIosDevice();

  useEffect(() => {
    const captureInstallEvent = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', captureInstallEvent);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallEvent);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (dismissed || isInstalled() || (!ios && !installEvent)) {
    return null;
  }

  const dismiss = () => {
    window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (ios) {
      setShowIosHelp(true);
      return;
    }
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  return (
    <>
      <aside className="fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-2xl lg:hidden" aria-label="Install Singh Sabha app">
        <img src="/logo192.png" alt="" className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-slate-900">Singh Sabha Milton</p>
          <button type="button" onClick={install} className="mt-0.5 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-blue">
            <ArrowDownTrayIcon className="h-4 w-4" />
            Install app
          </button>
        </div>
        <button type="button" onClick={dismiss} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Dismiss install app prompt">
          <XMarkIcon className="h-5 w-5" />
        </button>
      </aside>

      {showIosHelp ? (
        <div className="fixed inset-0 z-50 flex items-end bg-slate-950/65 p-3 lg:hidden" role="dialog" aria-modal="true" aria-labelledby="ios-install-title">
          <button type="button" className="absolute inset-0" onClick={() => setShowIosHelp(false)} aria-label="Close install instructions" />
          <div className="relative z-10 w-full rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="ios-install-title" className="font-heading text-xl font-semibold text-slate-950">Add to Home Screen</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">In Safari, tap <ShareIcon className="mx-1 inline h-5 w-5 text-brand-blue" /> Share, then choose <strong>Add to Home Screen</strong>.</p>
              </div>
              <button type="button" onClick={() => setShowIosHelp(false)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Close install instructions">
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default AppInstallPrompt;