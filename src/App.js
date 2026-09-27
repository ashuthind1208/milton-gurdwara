import { useEffect } from 'react';
import './App.css';
import AppRoutes from './routes/AppRoutes';
import DeleteConfirmationGuard from './components/common/DeleteConfirmationGuard';
import FormValidationGuard from './components/common/FormValidationGuard';
import AppInstallPrompt from './components/common/AppInstallPrompt';
import { isPushSupported, syncGrantedPushSubscription } from './services/pushNotificationService';

function App() {
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const initialOverflow = body.style.overflow;
    const initialPaddingRight = body.style.paddingRight;

    const syncScrollLock = () => {
      // Most modal overlays in this app render as fixed inset-0 containers.
      const hasOverlay = Boolean(document.querySelector('[class*="fixed"][class*="inset-0"]'));

      if (hasOverlay) {
        const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
        body.style.overflow = 'hidden';
        body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '';
      } else {
        body.style.overflow = initialOverflow;
        body.style.paddingRight = initialPaddingRight;
      }
    };

    syncScrollLock();

    const observer = new MutationObserver(syncScrollLock);
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });

    window.addEventListener('resize', syncScrollLock);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScrollLock);
      body.style.overflow = initialOverflow;
      body.style.paddingRight = initialPaddingRight;
    };
  }, []);

  useEffect(() => {
    if (!isPushSupported() || Notification.permission !== 'granted') return undefined;
    let cancelled = false;
    const syncSubscription = () => {
      if (!cancelled) syncGrantedPushSubscription().catch((error) => console.warn('Unable to sync push subscription:', error?.message || error));
    };
    syncSubscription();
    navigator.serviceWorker?.addEventListener('controllerchange', syncSubscription);
    return () => {
      cancelled = true;
      navigator.serviceWorker?.removeEventListener('controllerchange', syncSubscription);
    };
  }, []);

  return (
    <>
      <AppRoutes />
      <FormValidationGuard />
      <DeleteConfirmationGuard />
      <AppInstallPrompt />
    </>
  );
}

export default App;
