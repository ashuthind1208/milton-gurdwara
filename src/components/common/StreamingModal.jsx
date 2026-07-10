import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDaysIcon, CheckCircleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { getStreamingEmbedUrl, verifyStreamingAvailability } from '../../services/streamingService';

const sendYouTubeCommand = (iframe, func, args = []) => {
  if (!iframe?.contentWindow) {
    return;
  }

  iframe.contentWindow.postMessage(
    JSON.stringify({
      event: 'command',
      func,
      args
    }),
    '*'
  );
};

const StreamingModal = ({ open, streams = [], initialStreamId = '', onClose }) => {
  const [status, setStatus] = useState({ loading: false, available: false, checkedAt: '', reason: '', embedUrl: '' });

  const streamItems = useMemo(() => {
    const rawItems = Array.isArray(streams) ? streams : [];
    return rawItems.filter((entry) => entry?.streamUrl).map((entry, index) => ({
      ...entry,
      id: entry.id || `stream-modal-${index}`
    }));
  }, [streams]);

  const selectedStream = useMemo(() => {
    if (streamItems.length === 0) {
      return null;
    }

    return streamItems.find((entry) => entry.id === initialStreamId)
      || streamItems.find((entry) => entry.active)
      || streamItems[0];
  }, [initialStreamId, streamItems]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let mounted = true;
    setStatus({ loading: true, available: false, checkedAt: '', reason: '', embedUrl: '' });

    verifyStreamingAvailability(selectedStream || undefined).then((result) => {
      if (!mounted) {
        return;
      }

      setStatus({
        loading: false,
        available: Boolean(result.available),
        checkedAt: result.checkedAt || '',
        reason: result.reason || '',
        embedUrl: result.embedUrl || ''
      });
    });

    return () => {
      mounted = false;
    };
  }, [open, selectedStream]);

  if (!open) {
    return null;
  }

  const resolvedEmbedUrl = status.embedUrl || getStreamingEmbedUrl(selectedStream?.streamUrl);
  const canPlay = Boolean(selectedStream?.active && resolvedEmbedUrl && status.available);

  return createPortal(
    <div
      className="fixed inset-0 z-[120] overflow-y-auto bg-slate-950/70 px-4 py-6"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center">
        <div
          className="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          style={{ maxHeight: 'calc(100vh - 3rem)' }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-20 rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-brand-blue hover:text-brand-blue"
            onClick={onClose}
            aria-label="Close streaming modal"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>

          <div className="flex max-h-[calc(100vh-3rem)] flex-col overflow-y-auto">
            <div className="border-b border-slate-100 px-5 py-4 pr-14">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-blue">Live Streaming</p>
                  <h3 className="mt-1 text-xl font-bold text-slate-900">{selectedStream?.title || 'Streaming'}</h3>
                  <p className="mt-1 text-sm text-slate-600">{selectedStream?.text || 'Live stream for the sangat.'}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 pr-12 text-xs">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${selectedStream?.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                    <CheckCircleIcon className="h-4 w-4" />
                    {selectedStream?.active ? 'Active' : 'Inactive'}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${status.available ? 'bg-blue-100 text-brand-blue' : 'bg-amber-100 text-amber-800'}`}>
                    <CheckCircleIcon className="h-4 w-4" />
                    {status.loading ? 'Checking...' : status.available ? 'Confirmed' : 'Pending'}
                  </span>
                  {status.checkedAt ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 font-semibold text-slate-600">
                      <CalendarDaysIcon className="h-4 w-4" />
                      {new Date(status.checkedAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="bg-slate-950">
              <div className="aspect-video w-full">
                {canPlay ? (
                  <iframe
                    className="h-full w-full"
                      src={`${resolvedEmbedUrl}${resolvedEmbedUrl.includes('?') ? '&' : '?'}autoplay=1&playsinline=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}`}
                    title={selectedStream?.title || 'Live stream'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    ref={(iframe) => {
                      if (!iframe) {
                        return;
                      }

                      const onLoad = () => {
                        sendYouTubeCommand(iframe, 'unMute');
                        sendYouTubeCommand(iframe, 'setVolume', [50]);
                        sendYouTubeCommand(iframe, 'playVideo');
                      };

                      iframe.addEventListener('load', onLoad, { once: true });
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-white">
                    <div>
                      <p className="text-lg font-semibold">Stream is not available right now.</p>
                      <p className="mt-2 text-sm text-slate-300">
                        {status.loading ? 'Checking availability...' : status.reason === 'not_live' ? 'No live broadcast is active right now.' : 'Please try again after the stream is marked active.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  , document.body);
};

export default StreamingModal;