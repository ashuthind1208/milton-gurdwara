import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';

const ZeffyDonationModal = ({ isOpen, formUrl, onClose }) => {
  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[180] flex items-stretch justify-center bg-slate-950/65 backdrop-blur-sm md:items-center md:p-6" role="presentation">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Dismiss Zeffy donation form" />
      <section className="relative z-10 flex h-full w-full flex-col overflow-hidden bg-white shadow-2xl md:h-[90vh] md:max-w-6xl md:rounded-lg" role="dialog" aria-modal="true" aria-labelledby="zeffy-modal-title">
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-200 bg-brand-blue px-4 py-3 text-white">
          <h2 id="zeffy-modal-title" className="font-heading text-lg font-bold tracking-normal">Donate with Zeffy</h2>
          <button type="button" onClick={onClose} className="inline-flex h-10 w-10 items-center justify-center rounded-md text-white hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Close Zeffy donation form">
            <XMarkIcon className="h-6 w-6" aria-hidden="true" />
          </button>
        </header>
        <iframe
          title="Zeffy secure donation form"
          src={formUrl}
          allow="payment"
          className="min-h-0 flex-1 border-0 bg-white"
        />
      </section>
    </div>,
    document.body
  );
};

export default ZeffyDonationModal;
