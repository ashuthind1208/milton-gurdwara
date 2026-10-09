import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const BOARD_PATHS = ['/led-boards', '/donation-board', '/event-calendar-board', '/langar-board', '/daily-schedule-board', '/special-events-board', '/hukamnama-board', '/recitation-board', '/ask-a-granthi'];
const MAIN_BUNDLE_PATTERN = /\/static\/js\/main\.[\w-]+\.js/;

const loadedBundle = () => document.querySelector('script[src*="/static/js/main."]')?.getAttribute('src')?.match(MAIN_BUNDLE_PATTERN)?.[0] || '';

// Unattended LED screens never reload on their own, so they pick up a new deployment by watching the bundle name in index.html.
const AutoReloadOnNewBuild = () => {
  const { pathname, search } = useLocation();
  const isBoard = BOARD_PATHS.includes(pathname) && new URLSearchParams(search).get('embed') !== '1';

  useEffect(() => {
    const current = loadedBundle();
    if (!isBoard || !current) return undefined;

    const check = async () => {
      try {
        const response = await fetch('/', { cache: 'no-store' });
        const latest = (await response.text()).match(MAIN_BUNDLE_PATTERN)?.[0];
        if (latest && latest !== current) window.location.reload();
      } catch {
        // Offline or the server is restarting; try again on the next interval.
      }
    };

    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [isBoard]);

  return null;
};

export default AutoReloadOnNewBuild;
