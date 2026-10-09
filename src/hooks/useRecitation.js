import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import recitationService from '../services/recitationService';

const SAFETY_POLL_MS = 30000;

// Live state arrives over a server-sent stream; the occasional poll only covers a dropped connection.
export const useRecitationLive = () => {
  const [state, setState] = useState({ session: null, last: null, ready: false });

  const apply = useCallback((payload) => {
    setState((current) => ({
      session: payload?.session ?? null,
      last: payload?.last ?? null,
      ready: true
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = () => recitationService.getState().then((payload) => { if (!cancelled) apply(payload); }).catch(() => {});
    poll();
    const timer = window.setInterval(poll, SAFETY_POLL_MS);
    let source = null;
    if (typeof EventSource !== 'undefined') {
      source = new EventSource('/api/live/recitation');
      source.addEventListener('state', (event) => {
        try {
          if (!cancelled) apply(JSON.parse(event.data));
        } catch {
          // Ignore a malformed message; the next one carries the full state.
        }
      });
    }
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      source?.close();
    };
  }, [apply]);

  const setSession = useCallback((session) => setState((current) => ({ ...current, session, ready: true })), []);
  return { ...state, setSession };
};

// view 'text' is Gurmukhi only (phones); 'full' adds the Punjabi and English translations (LED screen).
export const useRecitationText = (session, view = 'text') => {
  const query = useQuery({
    queryKey: ['recitation-text', session?.sourceType, session?.sourceId, view],
    queryFn: () => recitationService.getText(session.sourceType, session.sourceId, view),
    enabled: Boolean(session?.sourceType && session?.sourceId),
    staleTime: Infinity,
    gcTime: 60 * 60 * 1000,
    retry: 3
  });
  return { lines: query.data?.lines || [], loading: query.isLoading, error: query.isError, refetch: query.refetch };
};

// Keeps a phone screen awake while someone follows along or controls the recitation.
export const useWakeLock = (enabled = true) => {
  useEffect(() => {
    if (!enabled || !navigator.wakeLock?.request) return undefined;
    let lock = null;
    let released = false;
    const acquire = () => navigator.wakeLock.request('screen').then((value) => {
      if (released) value.release().catch(() => {});
      else lock = value;
    }).catch(() => {});
    acquire();
    const onVisible = () => { if (document.visibilityState === 'visible') acquire(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      released = true;
      document.removeEventListener('visibilitychange', onVisible);
      lock?.release().catch(() => {});
    };
  }, [enabled]);
};

export const formatClock = (iso) => {
  const date = new Date(iso || '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
};

export const formatDay = (iso) => {
  const date = new Date(iso || '');
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
};

export const formatSpan = (startIso, endIso, nowMs = Date.now()) => {
  const start = new Date(startIso || '').getTime();
  if (Number.isNaN(start)) return '';
  const end = endIso ? new Date(endIso).getTime() : nowMs;
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};
