import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  getPushPermission,
  isPushSupported,
  getExistingPushSubscription,
  syncGrantedPushSubscription,
  subscribeToPushNotifications
} from '../../services/pushNotificationService';

const isInstalledPwa = () => {
  if (typeof window === 'undefined') return false;
  const displayMode = window.matchMedia?.('(display-mode: standalone)').matches
    || window.matchMedia?.('(display-mode: fullscreen)').matches
    || window.matchMedia?.('(display-mode: minimal-ui)').matches;
  return Boolean(displayMode || window.navigator.standalone === true);
};

const NotificationPermissionPrompt = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    const checkPermission = async () => {
      if (!isInstalledPwa() || !isPushSupported()) return;

      if (getPushPermission() === 'granted') {
        const existingSubscription = await getExistingPushSubscription().catch(() => null);
        if (existingSubscription) {
          await syncGrantedPushSubscription().catch(() => undefined);
          return;
        }
        if (!cancelled) setIsOpen(true);
        return;
      }
      if (getPushPermission() !== 'default') return;

      if (!cancelled) {
        setIsOpen(true);
      }
    };

    checkPermission();
    return () => {
      cancelled = true;
    };
  }, []);

  const enableNotifications = async () => {
    if (isBusy) return;

    setIsBusy(true);
    setErrorMessage('');
    try {
      await subscribeToPushNotifications();
      setIsOpen(false);
    } catch (error) {
      setErrorMessage(error?.message || 'Unable to enable notifications right now.');
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-slate-950/65 px-4 py-6 backdrop-blur-sm" role="presentation">
      <section
        className="w-full max-w-md rounded-2xl border border-brand-blue/20 bg-white p-6 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-permission-title"
        aria-describedby="notification-permission-description"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-blue/10 text-2xl text-brand-blue" aria-hidden="true">&#128276;</div>
        <h2 id="notification-permission-title" className="mt-4 text-center font-heading text-2xl font-bold text-brand-navy">View notifications</h2>
        <p id="notification-permission-description" className="mt-3 text-center text-sm leading-6 text-slate-600">
          Receive timely alerts when Langar needs or commitments change, deliveries are marked received, events are added or changed, volunteers sign up, bookings change, or a Hukamnama is posted. These help you know what changed without keeping the site open. On Android, allow notifications for this site (or install the app and allow them there).
        </p>
        {errorMessage ? <p className="mt-3 text-center text-sm font-semibold text-red-600">{errorMessage}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            disabled={isBusy}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={enableNotifications}
            disabled={isBusy}
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-brand-saffron bg-brand-saffron px-5 py-2.5 text-sm font-extrabold text-brand-blue shadow-[0_8px_18px_rgba(245,166,35,0.35)] transition hover:bg-amber-300 disabled:cursor-wait disabled:opacity-60"
          >
            {isBusy ? 'Enabling...' : getPushPermission() === 'granted' ? 'Enable on this device' : 'Enable notifications'}
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
};

export default NotificationPermissionPrompt;
