import { useEffect, useRef, useState } from 'react';
import { CheckIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';

const getActionLabel = (element) => String(
  element.getAttribute('aria-label')
  || element.getAttribute('title')
  || element.textContent
  || ''
).replace(/\s+/g, ' ').trim();

const getPageLabel = () => {
  const heading = [...document.querySelectorAll('main h1, main h2, [role="main"] h1, [role="main"] h2')]
    .find((element) => String(element.textContent || '').trim());
  if (heading) {
    return String(heading.textContent || '').replace(/\s+/g, ' ').trim();
  }

  const segment = window.location.pathname.split('/').filter(Boolean).pop() || 'this page';
  return segment.replace(/-/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

const DeleteConfirmationGuard = () => {
  const [pendingAction, setPendingAction] = useState(null);
  const bypassElementRef = useRef(null);
  const cancelButtonRef = useRef(null);

  useEffect(() => {
    const interceptDelete = (event) => {
      const actionElement = event.target instanceof Element
        ? event.target.closest('button, [role="button"], a')
        : null;
      if (!actionElement || actionElement.closest('[data-delete-guard-ignore="true"]')) {
        return;
      }

      if (bypassElementRef.current === actionElement) {
        bypassElementRef.current = null;
        return;
      }

      const actionLabel = getActionLabel(actionElement);
      if (!/^(delete|remove)\b/i.test(actionLabel) || actionElement.disabled || actionElement.getAttribute('aria-disabled') === 'true') {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const itemLabel = actionLabel.replace(/^(delete|remove)\s*/i, '').trim() || 'this item';
      const pageLabel = getPageLabel();
      setPendingAction({
        element: actionElement,
        itemLabel,
        pageLabel,
        message: `Are you sure you want to delete ${itemLabel} from ${pageLabel}? This action cannot be undone.`
      });
    };

    document.addEventListener('click', interceptDelete, true);
    return () => document.removeEventListener('click', interceptDelete, true);
  }, []);

  useEffect(() => {
    if (!pendingAction) {
      return undefined;
    }

    cancelButtonRef.current?.focus();
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setPendingAction(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingAction]);

  if (!pendingAction) {
    return null;
  }

  const confirmDelete = () => {
    const actionElement = pendingAction.element;
    bypassElementRef.current = actionElement;
    setPendingAction(null);
    actionElement.click();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/60 px-4 backdrop-blur-sm" role="presentation" data-delete-guard-ignore="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={() => setPendingAction(null)} aria-label="Close delete confirmation" />
      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-lg border border-red-200 bg-white shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirmation-title" aria-describedby="delete-confirmation-message">
        <header className="flex items-center gap-3 bg-red-700 px-5 py-4 text-white">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15">
            <ExclamationTriangleIcon className="h-6 w-6" aria-hidden="true" />
          </span>
          <h2 id="delete-confirmation-title" className="text-lg font-bold tracking-normal">Confirm deletion</h2>
        </header>
        <div className="px-5 py-5">
          <p id="delete-confirmation-message" className="text-sm font-bold leading-6 text-slate-800">{pendingAction.message}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button ref={cancelButtonRef} type="button" onClick={() => setPendingAction(null)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400">
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              No
            </button>
            <button type="button" onClick={confirmDelete} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              <CheckIcon className="h-5 w-5" aria-hidden="true" />
              Yes
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default DeleteConfirmationGuard;
