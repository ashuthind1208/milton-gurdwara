import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

const ZeffyDonationModal = ({ isOpen, formUrl, onClose, onPaymentCompleted, title = 'Donate with Zeffy', requireCompletion = false }) => {
  const [isFrameLoading, setIsFrameLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsFrameLoading(true);
    }
  }, [formUrl, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && !requireCompletion) {
        onPaymentCompleted?.();
        onClose();
      }
    };

    const handlePaymentCompleted = (event) => {
      if (event.origin === window.location.origin && event.data?.type === 'ssm:payment-completed') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('message', handlePaymentCompleted);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('message', handlePaymentCompleted);
    };
  }, [isOpen, onClose, onPaymentCompleted, requireCompletion]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-stretch justify-center bg-slate-950/65 backdrop-blur-sm md:items-center md:p-6" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" onClick={() => { if (!requireCompletion) onClose(); }} aria-label="Dismiss Zeffy donation form" />
      <section className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:h-[90vh] md:max-w-6xl md:rounded-lg" role="dialog" aria-modal="true" aria-labelledby="zeffy-modal-title">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-brand-blue px-4 py-3 text-white">
          <h2 id="zeffy-modal-title" className="font-heading text-lg font-bold tracking-normal">{title}</h2>
          <button type="button" onClick={onClose} disabled={requireCompletion} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-40" aria-label="Close Zeffy donation form">
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>
        {isFrameLoading ? <div className="absolute inset-0 top-14 z-20 flex flex-col items-center justify-center gap-3 bg-white"><span className="block h-12 w-12 animate-spin rounded-full border-4 border-blue-100 border-t-brand-blue" /><p className="text-sm font-semibold text-slate-700">Loading secure checkout...</p></div> : null}
        <iframe
          title="Zeffy secure donation form"
          src={formUrl}
          allow="payment"
          onLoad={() => setIsFrameLoading(false)}
          className="min-h-0 flex-1 border-0 bg-white"
        />
        {requireCompletion ? <button type="button" onClick={onPaymentCompleted} className="absolute bottom-4 right-4 z-20 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-lg">Confirm successful payment</button> : null}
      </section>
    </div>,
    document.body
  );
};

export default ZeffyDonationModal;
