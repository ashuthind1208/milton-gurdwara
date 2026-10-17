import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_HUKAMNAMA_LED_SETTINGS, normalizeHukamnamaLedSettings } from '../../constants/hukamnamaLedTemplates';
import { getNanakshahiDate } from '../../utils/punjabiCalendar';

const SAMPLE_LINES = [
  { id: 'demo-1', gurmukhi: 'ਦਿਨ ਤੇ ਪਹਰ ਪਹਰ ਤੇ ਘੜੀਆ ਆਵੈ ਘਟੈ ਤਨੁ ਛੀਜੈ ॥', translationPunjabi: 'ਦਿਨ, ਪਹਰ ਅਤੇ ਘੜੀ ਹਰ ਪਲ ਜੀਵਨ ਘਟਦਾ ਜਾਂਦਾ ਹੈ।', translationEnglish: 'Day by day, hour by hour, life runs its course, and the body withers away.' },
  { id: 'demo-2', gurmukhi: 'ਕਾਲੁ ਅਹੇਰੀ ਫਿਰੈ ਬਧਿਕ ਜਿਉ ਕਹਹੁ ਕਬ ਛੂਟਸਿ ਪ੍ਰਾਨੀ ॥', translationPunjabi: 'ਕਾਲ ਸ਼ਿਕਾਰੀ ਵਾਂਗ ਫਿਰਦਾ ਹੈ; ਜੀਵ ਇਸ ਤੋਂ ਕਦੋਂ ਬਚੇਗਾ?', translationEnglish: 'Death, like a hunter, is on the prowl; tell me, when will the mortal be free?' },
  { id: 'demo-3', gurmukhi: 'ਕਹੁ ਕਬੀਰ ਇਹੁ ਰਾਮ ਕੀ ਅੰਸੁ ॥', translationPunjabi: 'ਕਬੀਰ ਜੀ ਆਖਦੇ ਹਨ, ਇਹ ਜੀਵ ਪ੍ਰਭੂ ਦਾ ਹੀ ਅੰਸ਼ ਹੈ।', translationEnglish: 'Says Kabir, this soul is a spark of the Divine.' }
];
const getTemplateFrame = (templateId) => {
  if (['original-default', 'original-paired-columns', 'single-column-translation'].includes(templateId)) return 'bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] text-white';
  return 'bg-[#f8f1dd] text-[#263950]';
};

const HukamnamaLedTemplate = ({ settings: rawSettings, entry = {}, lines: suppliedLines, branding = {}, preview = false, hasHukamnama = true }) => {
  const settings = useMemo(() => normalizeHukamnamaLedSettings(rawSettings || DEFAULT_HUKAMNAMA_LED_SETTINGS), [rawSettings]);
  const lines = useMemo(() => (Array.isArray(suppliedLines) && suppliedLines.length ? suppliedLines : preview ? SAMPLE_LINES : []), [preview, suppliedLines]);
  const rootRef = useRef(null);
  const [now, setNow] = useState(() => new Date());
  const templateId = settings.templateId;
  const isDark = ['original-default', 'original-paired-columns', 'single-column-translation'].includes(templateId);
  const gurmukhi = lines.map((line) => String(line?.gurmukhi || '').trim()).filter(Boolean).join(' ');
  const punjabi = lines.map((line) => String(line?.translationPunjabi || line?.transliteration || '').trim()).filter(Boolean).join(' ');
  const english = lines.map((line) => String(line?.translationEnglish || '').trim()).filter(Boolean).join(' ');
  const shortTemplateLines = lines.slice(0, 4);
  const shortTemplateGurmukhi = shortTemplateLines.map((line) => String(line?.gurmukhi || '').trim()).filter(Boolean).join(' ');
  const shortTemplatePunjabi = shortTemplateLines.map((line) => String(line?.translationPunjabi || line?.transliteration || '').trim()).filter(Boolean).join(' ');
  const shortTemplateEnglish = shortTemplateLines.map((line) => String(line?.translationEnglish || '').trim()).filter(Boolean).join(' ');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const fit = () => {
      root.querySelectorAll('[data-fit-text]').forEach((element) => {
        const box = element.parentElement;
        if (!box) return;
        const boxStyle = window.getComputedStyle(box);
        const availableHeight = box.clientHeight - parseFloat(boxStyle.paddingTop) - parseFloat(boxStyle.paddingBottom);
        const availableWidth = box.clientWidth - parseFloat(boxStyle.paddingLeft) - parseFloat(boxStyle.paddingRight);
        const fitClearance = Number(element.dataset.fitClearance || 0);
        const max = Number(element.dataset.maxSize || 32);
        const min = Number(element.dataset.minSize || 12);
        const fits = () => {
          let usedHeight = element.scrollHeight;
          if (['columns', 'stacked-lines'].includes(element.dataset.fitMode)) {
            const elementTop = element.getBoundingClientRect().top;
            const childRects = [...element.children].map((child) => child.getBoundingClientRect());
            const top = childRects.length ? Math.min(...childRects.map((rect) => rect.top)) : elementTop;
            const bottom = childRects.length ? Math.max(...childRects.map((rect) => rect.bottom)) : elementTop;
            usedHeight = Math.max(0, bottom - top);
          }
          return usedHeight <= availableHeight - fitClearance && element.scrollWidth <= availableWidth + 1;
        };
        element.style.fontSize = `${max}px`;
        if (fits()) return;
        if (element.dataset.fitMode === 'columns') {
          for (let size = max - 1; size >= min; size -= 1) {
            element.style.fontSize = `${size}px`;
            if (fits()) return;
          }
          element.style.fontSize = `${min}px`;
          return;
        }
        let low = min;
        let high = max;
        let best = min;
        while (low <= high) {
          const size = Math.floor((low + high) / 2);
          element.style.fontSize = `${size}px`;
          if (fits()) {
            best = size;
            low = size + 1;
          } else {
            high = size - 1;
          }
        }
        element.style.fontSize = `${best}px`;
      });
    };
    const initialFit = requestAnimationFrame(fit);
    const observer = new ResizeObserver(() => requestAnimationFrame(fit));
    observer.observe(root);
    const resizeFit = () => requestAnimationFrame(fit);
    window.addEventListener('resize', resizeFit);
    window.visualViewport?.addEventListener('resize', resizeFit);
    document.fonts?.ready.then(resizeFit);
    return () => {
      cancelAnimationFrame(initialFit);
      observer.disconnect();
      window.removeEventListener('resize', resizeFit);
      window.visualViewport?.removeEventListener('resize', resizeFit);
    };
  }, [lines, templateId, settings]);

  const title = (
    <header className="relative z-10 grid min-h-[clamp(68px,8vw,112px)] shrink-0 grid-cols-[clamp(100px,13vw,180px)_minmax(0,1fr)_clamp(100px,13vw,180px)] items-center gap-2 border-b border-[#b99647]/60 px-1 pb-2 text-center">
      <img src={branding.logoSrc || branding.logoUrl || '/gurdwara-logo.webp'} alt={`${branding.organizationName || 'Gurdwara'} logo`} className={`-translate-y-[clamp(4px,.5vw,8px)] h-[clamp(54px,6vw,88px)] w-[clamp(54px,6vw,88px)] justify-self-start border border-[#b99647]/70 object-contain ${branding.logoShape === 'original' ? 'bg-transparent' : 'rounded-full bg-white'}`} />
      <div className="flex min-w-0 flex-col items-center justify-center gap-1 overflow-hidden">
        <div className="flex min-w-0 flex-nowrap items-baseline justify-center gap-x-[clamp(6px,1vw,18px)] overflow-hidden">
          {settings.showTitlePunjabi ? <h1 className="whitespace-nowrap font-bold leading-none" style={{ color: settings.titlePunjabiColor, fontFamily: `'${settings.titlePunjabiFont}', sans-serif`, fontSize: `clamp(16px, ${settings.titlePunjabiSize / 16}vw, ${settings.titlePunjabiSize}px)` }}>{settings.titlePunjabi}</h1> : null}
          {settings.showTitleEnglish ? <h2 className="whitespace-nowrap font-bold leading-none" style={{ color: settings.titleEnglishColor, fontFamily: `'${settings.titleEnglishFont}', serif`, fontSize: `clamp(16px, ${settings.titleEnglishSize / 16}vw, ${settings.titleEnglishSize}px)` }}>{settings.titleEnglish}</h2> : null}
        </div>
        <p className="mt-[clamp(5px,.5vw,9px)] mb-[clamp(6px,.7vw,12px)] max-w-full whitespace-nowrap rounded-full border border-amber-300 bg-amber-100 px-4 py-2 text-[clamp(11px,1vw,16px)] font-bold text-[#173d78] shadow-sm">Ang {entry.ang || '—'}{entry?.metadata?.raag ? ` · ${entry.metadata.raag}` : ''}{entry?.metadata?.writer ? ` · ${entry.metadata.writer}` : ''}</p>
      </div>
      <div className="-translate-y-[clamp(4px,.5vw,8px)] flex min-w-0 flex-col items-end justify-center gap-1 justify-self-end">
        <p aria-label="Current time" className={`whitespace-nowrap rounded-md px-2 py-1 font-mono text-[clamp(12px,1.25vw,20px)] font-bold tabular-nums tracking-wide ${isDark ? 'bg-white/15 text-white' : 'bg-[#173d78] text-white'}`}>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>
      </div>
    </header>
  );

  const nanakshahiLabel = getNanakshahiDate(now).labelPa.replace(/\s+ਨਾਨਕਸ਼ਾਹੀ$/, '');
  const gregorianLabel = now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const dateStrip = <div className="relative z-10 mt-2 flex shrink-0 flex-wrap items-center justify-center gap-x-4 gap-y-1 border border-brand-saffron bg-brand-saffron px-3 py-1.5 text-center text-[clamp(12px,1vw,17px)] font-bold text-[#173d78] shadow-sm"><span className="whitespace-nowrap">{gregorianLabel}</span><span className="hidden opacity-60 sm:inline" aria-hidden="true">•</span><span className="whitespace-nowrap font-gurmukhi">{nanakshahiLabel}</span></div>;
  const footer = settings.showFooter ? <footer className="relative z-10 -mx-[clamp(10px,1.5vw,28px)] mt-3 flex shrink-0 items-center justify-center gap-3 bg-amber-100 px-3 py-2 text-center text-[clamp(11px,1vw,16px)] font-bold text-[#173d78]"><span>{branding.organizationName || 'Gurdwara'}</span><span aria-hidden="true">•</span><span>{branding.address || 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh'}</span></footer> : null;
  const fitted = (text, className, maxSize, minSize = 12, fitClearance = 0) => <p data-fit-text data-max-size={maxSize} data-min-size={minSize} data-fit-clearance={fitClearance} className={className}>{text}</p>;

  let layout;
  if (templateId === 'ornate-tricolumn') {
    layout = <div className="grid min-h-0 flex-1 grid-cols-3 gap-[clamp(6px,1vw,16px)]">
        <section className="min-h-0 overflow-hidden border-2 border-double border-[#b99647] bg-[#fffdf5]/90 p-[clamp(8px,1vw,18px)]"><h3 className="mb-2 border-b border-[#b99647]/70 pb-1 text-center text-[clamp(11px,1.2vw,18px)] font-bold text-[#193e75]">ਪੰਜਾਬੀ ਵਿਆਖਿਆ</h3><div className="h-[calc(100%-2rem)] overflow-hidden px-[clamp(6px,.8vw,14px)] pt-[clamp(8px,.8vh,16px)] text-justify text-[#282217]">{fitted(punjabi, 'font-gurmukhi leading-[1.5]', 72, 10)}</div></section>
        <section className="flex min-h-0 flex-col overflow-hidden border-2 border-double border-[#b99647] bg-[#fffdf5]/90 p-[clamp(8px,1vw,18px)]"><div className="min-h-0 flex-1 overflow-hidden px-[clamp(6px,.8vw,14px)] pt-[clamp(12px,1.5vh,26px)] pb-1 text-left text-[#164b9c]">{fitted(gurmukhi, 'font-gurmukhi font-bold leading-[1.28] text-justify', 320, 14, 20)}</div></section>
      <section className="min-h-0 overflow-hidden border-2 border-double border-[#b99647] bg-[#fffdf5]/90 p-[clamp(8px,1vw,18px)]"><h3 className="mb-2 border-b border-[#b99647]/70 pb-1 text-center text-[clamp(11px,1.2vw,18px)] font-bold text-[#193e75]">English Translation</h3><div className="h-[calc(100%-2rem)] overflow-hidden px-[clamp(6px,.8vw,14px)] pt-[clamp(8px,.8vh,16px)] text-justify text-[#252525]">{fitted(english, 'font-semibold leading-[1.5]', 72, 10)}</div></section>
    </div>;
  } else if (templateId === 'original-paired-columns') {
    layout = <div className="min-h-0 flex-1 overflow-hidden px-[clamp(12px,1.5vw,28px)] pt-2 pb-1">
      <div
        data-fit-text
        data-fit-mode="columns"
        data-max-size="64"
        data-min-size="10"
        data-fit-clearance="12"
        className="h-full w-full"
        style={{ columnCount: 2, columnGap: 'clamp(20px,3vw,48px)', columnRule: '1px solid rgba(255,255,255,.18)', columnFill: 'balance' }}
      >
        {lines.map((line, index) => (
          <div key={line.id || `paired-line-${index}`} className="mb-[.7em] break-inside-avoid">
            {line.gurmukhi ? <p className="font-gurmukhi text-[1em] font-bold leading-snug text-white">{line.gurmukhi}</p> : null}
            {line.translationPunjabi ? <p className="mt-[.15em] font-gurmukhi text-[.8em] font-semibold leading-snug text-amber-300">Punjabi: {line.translationPunjabi}</p> : null}
            {line.translationEnglish ? <p className="mt-[.1em] text-[.8em] font-semibold leading-snug text-cyan-100">English: {line.translationEnglish}</p> : null}
          </div>
        ))}
      </div>
    </div>;
  } else if (templateId === 'single-column-translation') {
    layout = <div className="relative z-10 mt-[clamp(6px,.7vw,12px)] flex min-h-0 flex-1 flex-col overflow-hidden px-2 pb-1">
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[.16em] overflow-hidden">
        <section className="flex min-h-0 w-full max-w-[94vw] flex-[2.2] flex-col items-center justify-center overflow-hidden px-[clamp(28px,3.2vw,64px)]">
          {fitted(shortTemplateGurmukhi, 'w-full text-justify font-gurmukhi font-bold leading-[1.32] text-amber-100', 100, 12, 16)}
        </section>
        <div aria-hidden="true" className="my-1 h-px w-[min(72vw,1100px)] shrink-0 bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
        <section className="grid min-h-0 w-full max-w-[min(94vw,1600px)] flex-[1.6] grid-cols-2 gap-[clamp(18px,2.4vw,44px)] overflow-hidden px-[clamp(14px,1.8vw,34px)] py-[clamp(10px,1vh,18px)] text-left">
          <div className="flex min-h-0 flex-col overflow-hidden px-[clamp(10px,1vw,20px)]">
            <div className="min-h-0 flex-1 overflow-hidden pt-1 text-justify">{fitted(shortTemplatePunjabi, 'font-gurmukhi leading-[1.6] text-white', 48, 10, 4)}</div>
          </div>
          <div className="flex min-h-0 flex-col overflow-hidden px-[clamp(10px,1vw,20px)]">
            <div className="min-h-0 flex-1 overflow-hidden pt-1 text-justify">{fitted(shortTemplateEnglish, 'leading-[1.6] text-white', 48, 10, 4)}</div>
          </div>
        </section>
      </div>
    </div>;
  } else {
    layout = <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_.85fr] gap-5"><section className="flex min-h-0 flex-col overflow-hidden border-r border-white/20 pr-5"><div className="min-h-0 flex-1 overflow-hidden px-[clamp(24px,2vw,44px)] pt-[clamp(20px,2vh,40px)] pb-2 text-left">{fitted(gurmukhi, 'font-gurmukhi font-bold leading-[1.28] text-justify text-white', 320, 12, 20)}</div></section><div className="grid min-h-0 flex-1 grid-rows-2 gap-4"><section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white/5 px-[clamp(16px,1.4vw,28px)] py-4"><h3 className="mb-2 shrink-0 border-b border-white/25 pb-2 text-xs font-bold uppercase text-amber-200">ਪੰਜਾਬੀ ਅਰਥ</h3><div className="min-h-0 flex-1 overflow-hidden pt-[clamp(8px,.8vh,16px)] text-justify">{fitted(punjabi, 'font-gurmukhi leading-[1.5] text-amber-50', 64, 8)}</div></section><section className="flex min-h-0 flex-col overflow-hidden rounded-xl bg-white/5 px-[clamp(16px,1.4vw,28px)] py-4"><h3 className="mb-2 shrink-0 border-b border-white/25 pb-2 text-xs font-bold uppercase text-cyan-100">English Translation</h3><div className="min-h-0 flex-1 overflow-hidden pt-[clamp(8px,.8vh,16px)] text-justify">{fitted(english, 'leading-[1.5] text-cyan-50', 64, 8)}</div></section></div></div>;
  }

  return <div ref={rootRef} className={`relative flex h-full w-full flex-col overflow-hidden border-[clamp(5px,.65vw,10px)] border-double border-[#b99647] px-[clamp(10px,1.5vw,28px)] pt-[clamp(24px,2.4vw,42px)] pb-0 ${getTemplateFrame(templateId)}`}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-[clamp(2px,.28vw,5px)] rounded-[4px] border border-[#b99647]/70" />
    {title}
    {dateStrip}
    <div className="relative z-10 mt-[clamp(6px,.7vw,12px)] flex min-h-0 flex-1 flex-col">{!hasHukamnama && !preview ? <p className="grid h-full place-items-center text-center text-2xl font-bold">Today&apos;s Hukamnama is not available yet.</p> : layout}</div>
    {footer}
    {preview ? <span className="absolute right-2 top-2 z-20 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold text-white">PREVIEW</span> : null}
  </div>;
};

export default HukamnamaLedTemplate;
