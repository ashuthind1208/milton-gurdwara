import { useEffect } from 'react';
import AppRoutes from './routes/AppRoutes';

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

  return <AppRoutes />;
}

export default App;
