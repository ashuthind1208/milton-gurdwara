import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowPathIcon } from '@heroicons/react/24/outline';
import './App.css';
import AppRoutes from './routes/AppRoutes';
import DeleteConfirmationGuard from './components/common/DeleteConfirmationGuard';
import FormValidationGuard from './components/common/FormValidationGuard';
import AppInstallPrompt from './components/common/AppInstallPrompt';
import { isPushSupported, syncGrantedPushSubscription } from './services/pushNotificationService';

function App() {
  const queryClient = useQueryClient();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const touchStartRef = useRef(null);
  const refreshThreshold = 74;

  const refreshingRef = useRef(false);
  const refreshAppData = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setIsRefreshing(true);
    setPullDistance(refreshThreshold);
    try {
      await Promise.all([
        queryClient.invalidateQueries(),
        queryClient.refetchQueries({ type: 'active' })
      ]);
    } finally {
      refreshingRef.current = false;
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [queryClient]);

  useEffect(() => {
    const onTouchStart = (event) => {
      if (window.scrollY > 0 || document.documentElement.scrollTop > 0 || event.touches.length !== 1) {
        touchStartRef.current = null;
        return;
      }
      touchStartRef.current = event.touches[0].clientY;
    };
    const onTouchMove = (event) => {
      if (touchStartRef.current == null || refreshingRef.current || window.scrollY > 0 || document.documentElement.scrollTop > 0) return;
      const delta = event.touches[0].clientY - touchStartRef.current;
      if (delta > 0) setPullDistance(Math.min(refreshThreshold, delta * 0.55));
    };
    const onTouchEnd = () => {
      if (touchStartRef.current == null) return;
      const shouldRefresh = pullDistance >= refreshThreshold * 0.72;
      touchStartRef.current = null;
      if (shouldRefresh) void refreshAppData();
      else setPullDistance(0);
    };
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [pullDistance, refreshAppData]);

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
      {(pullDistance > 0 || isRefreshing) ? <div className="fixed inset-x-0 top-0 z-[1000] flex justify-center pointer-events-none" style={{ height: `${Math.max(0, pullDistance)}px` }} aria-live="polite">
        <div className="mt-2 flex h-10 items-center gap-2 rounded-full border border-blue-100 bg-white/95 px-4 text-xs font-bold text-brand-blue shadow-lg">
          <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing…' : pullDistance >= refreshThreshold * 0.72 ? 'Release to refresh' : 'Pull to refresh'}
        </div>
      </div> : null}
      <AppRoutes />
      <FormValidationGuard />
      <DeleteConfirmationGuard />
      <AppInstallPrompt />
    </>
  );
}

export default App;
