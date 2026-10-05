import { useLayoutEffect, useRef } from 'react';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import useDailyHukamnama from '../../hooks/useDailyHukamnama';
import { useBranding } from '../../context/BrandingContext';

const MIN_FONT_PX = 9;
const MAX_FONT_PX = 56;
const BOTTOM_CLEARANCE_PX = 24;

const getBalancedSplitIndex = (lines) => {
  if (lines.length < 2) return lines.length;
  const weights = lines.map((line) => 1 + Number(Boolean(line.translationPunjabi)) + Number(Boolean(line.translationEnglish)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let running = 0;
  let splitIndex = 1;
  let smallestDifference = Infinity;
  weights.slice(0, -1).forEach((weight, index) => {
    running += weight;
    const difference = Math.abs(total - running * 2);
    if (difference < smallestDifference) {
      smallestDifference = difference;
      splitIndex = index + 1;
    }
  });
  return splitIndex;
};

// Picks the largest text size that keeps both balanced columns inside the screen bounds.
const fitToBox = (box, content) => {
  [...content.querySelectorAll('[data-hukamnama-verse]')].forEach((verse) => { verse.style.marginBottom = '.6em'; });
  const fits = (size) => {
    content.style.fontSize = `${size}px`;
    [...content.querySelectorAll('p')].forEach((line) => line.style.removeProperty('font-size'));
    const fitsHeight = [...content.children].every((column) => {
      if (!column.children.length) return true;
      const usedHeight = column.lastElementChild.getBoundingClientRect().bottom - column.firstElementChild.getBoundingClientRect().top;
      return usedHeight <= box.clientHeight - BOTTOM_CLEARANCE_PX;
    });
    return fitsHeight;
  };
  let low = MIN_FONT_PX;
  let high = MAX_FONT_PX;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (fits(mid)) low = mid;
    else high = mid - 1;
  }
  content.style.fontSize = `${low}px`;
  [...content.querySelectorAll('p')].forEach((line) => {
    const availableWidth = line.clientWidth - 6;
    if (line.scrollWidth > availableWidth && availableWidth > 0) {
      const fittedFontSize = Number.parseFloat(getComputedStyle(line).fontSize) * (availableWidth / line.scrollWidth);
      line.style.fontSize = `${fittedFontSize}px`;
    }
  });

  const columns = [...content.children];
  const measurements = columns.map((column) => {
    const verses = [...column.children];
    if (!verses.length) return { column, verses, height: 0, gaps: 0 };
    return {
      column,
      verses,
      height: verses.at(-1).getBoundingClientRect().bottom - verses[0].getBoundingClientRect().top,
      gaps: Math.max(0, verses.length - 1)
    };
  });
  if (measurements.length === 2 && measurements.every((column) => column.gaps > 0)) {
    const difference = measurements[0].height - measurements[1].height;
    if (Math.abs(difference) >= 1) {
      const shorter = measurements[difference < 0 ? 0 : 1];
      const adjustment = Math.abs(difference) / shorter.gaps;
      shorter.verses.slice(0, -1).forEach((verse) => { verse.style.marginBottom = `calc(.6em + ${adjustment}px)`; });
    }
  }
};

const LedHukamnamaBoardPage = () => {
  const { branding, logoSrc } = useBranding();
  const meta = useSeoMeta('Daily Hukamnama Board', 'Today\'s hukamnama with translation for the Gurdwara LED display.');
  const { entry, lines, hasHukamnama } = useDailyHukamnama();
  const boxRef = useRef(null);
  const contentRef = useRef(null);
  const splitIndex = getBalancedSplitIndex(lines);
  const columns = [lines.slice(0, splitIndex), lines.slice(splitIndex)];

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
  }, [lines, hasHukamnama, splitIndex]);

  const pills = [
    entry?.ang ? `Ang ${entry.ang}` : '',
    entry?.metadata?.raag ? `Raag: ${entry.metadata.raag}` : '',
    entry?.metadata?.writer ? `Writer: ${entry.metadata.writer}` : ''
  ].filter(Boolean);

  return (
    <>
      <Seo {...meta} />
      <div className="flex h-screen w-full flex-col overflow-hidden bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] px-8 py-5 text-white">
        <header className="flex shrink-0 items-center gap-4 border-b border-white/20 pb-3">
          <img src={logoSrc} alt={`${branding.organizationName} logo`} className="h-14 w-14 rounded-full border-2 border-brand-saffron object-cover" />
          <div className="min-w-[15rem] flex-1">
            <h1 className="whitespace-nowrap font-heading text-[clamp(1.125rem,2vw,2rem)] font-bold leading-tight">Daily Hukamnama</h1>
            <p className="text-sm text-cyan-100">Today&apos;s Gurbani with translation.</p>
          </div>
          <div className="flex shrink-0 flex-nowrap justify-end gap-1.5 text-xs font-bold">
            {pills.map((label) => <span key={label} className="whitespace-nowrap rounded-full border border-white/25 bg-white/10 px-2 py-1">{label}</span>)}
          </div>
        </header>

        <div ref={boxRef} className="mt-4 min-h-0 flex-1 overflow-hidden">
          {hasHukamnama ? (
            <div ref={contentRef} className="grid h-full grid-cols-2" style={{ columnGap: '3em', backgroundImage: 'linear-gradient(to right, transparent calc(50% - .5px), rgba(255,255,255,.15) calc(50% - .5px), rgba(255,255,255,.15) calc(50% + .5px), transparent calc(50% + .5px))' }}>
              {columns.map((column, columnIndex) => (
                <div key={`column-${columnIndex}`} className="min-w-0" style={{ paddingRight: columnIndex === 0 ? '1.5em' : 0, paddingLeft: columnIndex === 1 ? '1.5em' : 0 }}>
                  {column.map((line, columnLineIndex) => (
                    <div key={line.id} data-hukamnama-verse={columnIndex === 0 ? columnLineIndex : splitIndex + columnLineIndex} style={{ marginBottom: '.6em' }}>
                      <p className="font-gurmukhi font-bold leading-snug text-white" style={{ whiteSpace: 'nowrap' }}>{line.gurmukhi}</p>
                      {line.translationPunjabi ? <p className="font-gurmukhi text-[0.68em] font-semibold leading-snug text-amber-300" style={{ marginTop: '.15em', whiteSpace: 'nowrap' }}>Punjabi: {line.translationPunjabi}</p> : null}
                      {line.translationEnglish ? <p className="text-[0.68em] font-semibold leading-snug text-cyan-100" style={{ marginTop: '.1em', marginBottom: '.3em', whiteSpace: 'nowrap' }}>English: {line.translationEnglish}</p> : null}
                    </div>
                  ))}
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
