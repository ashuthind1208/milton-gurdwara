import { useLayoutEffect, useRef } from 'react';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import useDailyHukamnama from '../../hooks/useDailyHukamnama';
import { useBranding } from '../../context/BrandingContext';

const MIN_FONT_PX = 9;
const MAX_FONT_PX = 64;
const BOTTOM_CLEARANCE_PX = 28;
const VERSE_GAP_EM = 0.7;

// One text size for the whole page: the largest where both balanced columns fit the screen height with room at the bottom.
const fitToBox = (box, content) => {
  const verses = [...content.querySelectorAll('[data-hukamnama-verse]')];
  verses.forEach((verse) => { verse.style.marginBottom = `${VERSE_GAP_EM}em`; });
  const limit = box.clientHeight - BOTTOM_CLEARANCE_PX;
  const fits = (size) => {
    content.style.fontSize = `${size}px`;
    const gurmukhiFits = [...content.querySelectorAll('[data-hukamnama-gurmukhi]')].every((line) => line.scrollWidth <= line.clientWidth + 1);
    return gurmukhiFits && content.getBoundingClientRect().height <= limit;
  };
  let low = MIN_FONT_PX;
  let high = MAX_FONT_PX;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  content.style.fontSize = `${low}px`;

  // Spread the shorter column's spare height across its verse gaps so both columns end together.
  const columns = new Map();
  verses.forEach((verse) => {
    const left = Math.round(verse.getBoundingClientRect().left);
    columns.set(left, [...(columns.get(left) || []), verse]);
  });
  const measured = [...columns.values()].map((column) => ({
    column,
    height: column.at(-1).getBoundingClientRect().bottom - column[0].getBoundingClientRect().top
  }));
  if (measured.length === 2 && measured.every(({ column }) => column.length > 1)) {
    const [first, second] = measured;
    const shorter = first.height < second.height ? first : second;
    const spare = Math.abs(first.height - second.height);
    const extraPerGap = (spare * 0.95) / (shorter.column.length - 1);
    shorter.column.slice(0, -1).forEach((verse) => { verse.style.marginBottom = `calc(${VERSE_GAP_EM}em + ${extraPerGap}px)`; });
  }
};

const LedHukamnamaBoardPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('Daily Hukamnama Board', 'Today\'s hukamnama with translation for the Gurdwara LED display.');
  const { entry, lines, hasHukamnama } = useDailyHukamnama();
  const boxRef = useRef(null);
  const contentRef = useRef(null);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const content = contentRef.current;
    if (!box || !content) return undefined;
    const fit = () => fitToBox(box, content);
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    document.fonts?.ready.then(fit);
    return () => observer.disconnect();
  }, [lines, hasHukamnama]);

  const pills = [
    entry?.ang ? `Ang ${entry.ang}` : '',
    entry?.metadata?.raag ? `Raag: ${entry.metadata.raag}` : '',
    entry?.metadata?.writer ? `Writer: ${entry.metadata.writer}` : ''
  ].filter(Boolean);

  return (
    <>
      <Seo {...meta} />
      <div className="relative flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] px-8 py-5 text-white">
        <img src={logoSrc} alt="" aria-hidden="true" className="pointer-events-none absolute bottom-4 right-6 z-0 h-48 w-48 rounded-full border border-brand-saffron/30 object-cover opacity-20" />
        <header className="relative z-10 flex shrink-0 items-center gap-4 border-b border-white/20 pb-3">
          <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-14 w-14 rounded-full border-2 border-brand-saffron object-cover" />
          <div className="min-w-[15rem] flex-1">
            <h1 className="whitespace-nowrap font-heading text-[clamp(1.125rem,2vw,2rem)] font-bold leading-tight">Daily Hukamnama</h1>
            <p className="text-sm text-cyan-100">Today&apos;s Gurbani with translation.</p>
          </div>
          <div className="flex shrink-0 flex-nowrap justify-end gap-1.5 text-xs font-bold">
            {pills.map((label) => <span key={label} className="whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-2 py-1">{label}</span>)}
          </div>
        </header>

        <div ref={boxRef} className="relative z-10 mt-4 min-h-0 flex-1 overflow-hidden">
          {hasHukamnama ? (
            <div ref={contentRef} style={{ columnCount: 2, columnGap: '3em', columnRule: '1px solid rgba(255,255,255,.15)' }}>
              {lines.map((line) => (
                <div key={line.id} data-hukamnama-verse style={{ breakInside: 'avoid' }}>
                  <p data-hukamnama-gurmukhi className="font-gurmukhi font-bold leading-snug text-white" style={{ whiteSpace: 'nowrap' }}>{line.gurmukhi}</p>
                  {line.translationPunjabi ? <p className="font-gurmukhi text-[0.8em] font-semibold leading-snug text-amber-300" style={{ marginTop: '.15em' }}>Punjabi: {line.translationPunjabi}</p> : null}
                  {line.translationEnglish ? <p className="text-[0.8em] font-semibold leading-snug text-cyan-100" style={{ marginTop: '.1em' }}>English: {line.translationEnglish}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="flex h-full items-center justify-center text-2xl font-bold text-amber-200">Today&apos;s hukamnama is not available yet.</p>
          )}
        </div>
      </div>
    </>
  );
};

export default LedHukamnamaBoardPage;
