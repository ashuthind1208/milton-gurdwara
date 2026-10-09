import { useLayoutEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import { useRecitationLive, useRecitationText } from '../../hooks/useRecitation';
import { useBranding } from '../../context/BrandingContext';

const MIN_FONT_PX = 16;
const MAX_FONT_PX = 150;
const CORNER_QR_PX = 120;
const HEADER_PX = 150;

// Largest size at which the Gurmukhi line and both translations fit the screen without cutting anything off.
const fitText = (box, content) => {
  const style = window.getComputedStyle(box);
  const limit = box.clientHeight - Number.parseFloat(style.paddingTop) - Number.parseFloat(style.paddingBottom) - 8;
  let low = MIN_FONT_PX;
  let high = MAX_FONT_PX;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    content.style.fontSize = `${mid}px`;
    if (content.getBoundingClientRect().height <= limit) low = mid;
    else high = mid - 1;
  }
  content.style.fontSize = `${low}px`;
};

// Waiting: one large QR code in the middle. Live: only the Gurbani with its translations, and the QR code moves to the top right.
const RecitationLedBoardPage = () => {
  const meta = useSeoMeta('Live Recitation Board', 'Live Gurbani recitation with translations for the Gurdwara LED display.');
  const { branding, logoSrc } = useBranding();
  const { session } = useRecitationLive();
  const { lines } = useRecitationText(session, 'full');
  const boxRef = useRef(null);
  const contentRef = useRef(null);

  const index = session?.currentIndex ?? 0;
  const line = lines[index] || null;
  const followUrl = useMemo(() => new URL(session ? `/follow/${session.id}` : '/follow', window.location.origin).toString(), [session]);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return undefined;
    const fit = () => fitText(box, content);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [line]);

  return (
    <>
      <Seo {...meta} />
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] text-white">
        <style>{'@keyframes recitation-line-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } } .recitation-line-in { animation: recitation-line-in 450ms ease-out both; }'}</style>

        {session ? (
          <>
            <header className="absolute inset-x-0 top-0 z-10 flex items-center border-b border-white/25 px-6" style={{ height: HEADER_PX }}>
              <div className="flex items-center gap-5">
                <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-16 w-16 rounded-full border-2 border-brand-saffron object-cover shadow-lg sm:h-20 sm:w-20" />
                <div className="text-left">
                  <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-saffron sm:text-base">{branding.shortName || branding.organizationName}</p>
                  <h1 className="mt-1 text-3xl font-black tracking-wide text-white sm:text-5xl">Live Recitation</h1>
                </div>
              </div>
            </header>
            <div className="absolute right-6 z-20 rounded-2xl bg-white p-2.5 shadow-xl" style={{ top: (HEADER_PX - CORNER_QR_PX - 20) / 2 }}>
              <QRCodeSVG value={followUrl} size={CORNER_QR_PX} level="M" marginSize={0} fgColor="#071b3b" bgColor="#ffffff" aria-label="Scan to follow along on your phone" />
            </div>
            <div ref={boxRef} className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-12 pb-8" style={{ paddingTop: HEADER_PX + 24 }}>
              {line ? (
                <div key={index} ref={contentRef} className="recitation-line-in w-full text-center" style={{ fontSize: '48px' }}>
                  <p className="font-gurmukhi font-bold leading-snug text-white">{line.g}</p>
                  {line.p ? <p className="mt-[0.3em] font-gurmukhi text-[0.5em] font-semibold leading-snug text-amber-300">{line.p}</p> : null}
                  {line.e ? <p className="mt-[0.2em] text-[0.5em] font-semibold leading-snug text-cyan-100">{line.e}</p> : null}
                </div>
              ) : <p className="text-2xl font-semibold text-slate-300">Loading Gurbani...</p>}
            </div>
          </>
        ) : (
          <>
            <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-5 px-6 py-7 sm:py-9">
              <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-16 w-16 rounded-full border-2 border-brand-saffron object-cover shadow-lg sm:h-20 sm:w-20" />
              <div className="text-left">
                <p className="text-sm font-bold uppercase tracking-[0.24em] text-brand-saffron sm:text-base">{branding.shortName || branding.organizationName}</p>
                <h1 className="mt-1 text-3xl font-black tracking-wide text-white sm:text-5xl">Live Recitation</h1>
              </div>
            </header>
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-4">
              <div className="rounded-3xl bg-white p-5 shadow-2xl">
                <QRCodeSVG value={followUrl} size={Math.round(Math.min(window.innerHeight, window.innerWidth) * 0.46)} level="M" marginSize={0} fgColor="#071b3b" bgColor="#ffffff" aria-label="Scan to follow the recitation on your phone" />
              </div>
              <p className="text-xl font-bold tracking-wide text-cyan-100 sm:text-2xl">Scan to follow along</p>
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default RecitationLedBoardPage;
