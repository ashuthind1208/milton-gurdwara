import { useLayoutEffect, useMemo, useRef } from 'react';
import { DEFAULT_HUKAMNAMA_LED_SETTINGS, normalizeHukamnamaLedSettings } from '../../constants/hukamnamaLedTemplates';

const SAMPLE_LINES = [
  { id: 'demo-1', gurmukhi: 'ਦਿਨ ਤੇ ਪਹਰ ਪਹਰ ਤੇ ਘੜੀਆ ਆਵੈ ਘਟੈ ਤਨੁ ਛੀਜੈ ॥', translationPunjabi: 'ਦਿਨ, ਪਹਰ ਅਤੇ ਘੜੀ ਹਰ ਪਲ ਜੀਵਨ ਘਟਦਾ ਜਾਂਦਾ ਹੈ।', translationEnglish: 'Day by day, hour by hour, life runs its course, and the body withers away.' },
  { id: 'demo-2', gurmukhi: 'ਕਾਲੁ ਅਹੇਰੀ ਫਿਰੈ ਬਧਿਕ ਜਿਉ ਕਹਹੁ ਕਬ ਛੂਟਸਿ ਪ੍ਰਾਨੀ ॥', translationPunjabi: 'ਕਾਲ ਸ਼ਿਕਾਰੀ ਵਾਂਗ ਫਿਰਦਾ ਹੈ; ਜੀਵ ਇਸ ਤੋਂ ਕਦੋਂ ਬਚੇਗਾ?', translationEnglish: 'Death, like a hunter, is on the prowl; tell me, when will the mortal be free?' },
  { id: 'demo-3', gurmukhi: 'ਕਹੁ ਕਬੀਰ ਇਹੁ ਰਾਮ ਕੀ ਅੰਸੁ ॥', translationPunjabi: 'ਕਬੀਰ ਜੀ ਆਖਦੇ ਹਨ, ਇਹ ਜੀਵ ਪ੍ਰਭੂ ਦਾ ਹੀ ਅੰਸ਼ ਹੈ।', translationEnglish: 'Says Kabir, this soul is a spark of the Divine.' }
];
const getTemplateFrame = (templateId) => {
  if (templateId === 'original-default') return 'bg-gradient-to-br from-[#06142f] via-[#0b2a5b] to-[#06142f] text-white';
  return 'bg-[#f8f1dd] text-[#263950]';
};

const HukamnamaLedTemplate = ({ settings: rawSettings, entry = {}, lines: suppliedLines, branding = {}, preview = false, hasHukamnama = true }) => {
  const settings = useMemo(() => normalizeHukamnamaLedSettings(rawSettings || DEFAULT_HUKAMNAMA_LED_SETTINGS), [rawSettings]);
  const lines = useMemo(() => (Array.isArray(suppliedLines) && suppliedLines.length ? suppliedLines : preview ? SAMPLE_LINES : []), [preview, suppliedLines]);
  const rootRef = useRef(null);
  const templateId = settings.templateId;
  const isDark = templateId === 'original-default';
  const gurmukhi = lines.map((line) => String(line?.gurmukhi || '').trim()).filter(Boolean).join(' ');
  const punjabi = lines.map((line) => String(line?.translationPunjabi || line?.transliteration || '').trim()).filter(Boolean).join(' ');
  const english = lines.map((line) => String(line?.translationEnglish || '').trim()).filter(Boolean).join(' ');

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
        const max = Number(element.dataset.maxSize || 32);
        const min = Number(element.dataset.minSize || 12);
        element.style.fontSize = `${max}px`;
        if (element.scrollHeight <= availableHeight && element.scrollWidth <= availableWidth) return;
        let low = min;
        let high = max;
        let best = min;
        while (low <= high) {
          const size = Math.floor((low + high) / 2);
          element.style.fontSize = `${size}px`;
          if (element.scrollHeight <= availableHeight && element.scrollWidth <= availableWidth) {
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
    document.fonts?.ready.then(() => requestAnimationFrame(fit));
    return () => {
      cancelAnimationFrame(initialFit);
      observer.disconnect();
    };
  }, [lines, templateId, settings]);

  const title = (
    <header className="relative z-10 grid min-h-[clamp(54px,6vw,88px)] shrink-0 grid-cols-[clamp(42px,5vw,76px)_1fr_clamp(42px,5vw,76px)] items-center gap-2 border-b border-[#b99647]/60 px-1 pb-2 text-center">
      <img src={branding.logoSrc || branding.logoUrl || '/gurdwara-logo.webp'} alt={`${branding.organizationName || 'Gurdwara'} logo`} className={`h-[clamp(38px,4.4vw,68px)] w-[clamp(38px,4.4vw,68px)] justify-self-start border border-[#b99647]/70 object-contain ${branding.logoShape === 'original' ? 'bg-transparent' : 'rounded-full bg-white'}`} />
      <div className="flex min-w-0 flex-nowrap items-baseline justify-center gap-x-[clamp(6px,1vw,18px)] overflow-hidden">
        {settings.showTitlePunjabi ? <h1 className="whitespace-nowrap font-bold leading-none" style={{ color: settings.titlePunjabiColor, fontFamily: `'${settings.titlePunjabiFont}', sans-serif`, fontSize: `clamp(16px, ${settings.titlePunjabiSize / 16}vw, ${settings.titlePunjabiSize}px)` }}>{settings.titlePunjabi}</h1> : null}
        {settings.showTitleEnglish ? <h2 className="whitespace-nowrap font-bold leading-none" style={{ color: settings.titleEnglishColor, fontFamily: `'${settings.titleEnglishFont}', serif`, fontSize: `clamp(16px, ${settings.titleEnglishSize / 16}vw, ${settings.titleEnglishSize}px)` }}>{settings.titleEnglish}</h2> : null}
      </div>
      <p className={`justify-self-end whitespace-nowrap rounded-full px-2 py-1 text-[clamp(9px,.75vw,13px)] font-bold ${isDark ? 'bg-white/10 text-amber-200' : 'bg-[#b99647]/10 text-[#806325]'}`}>Ang {entry.ang || '—'}{entry?.metadata?.raag ? ` · ${entry.metadata.raag}` : ''}</p>
    </header>
  );

  const footer = settings.showFooter ? <footer className={`relative z-10 mt-3 flex shrink-0 items-center justify-center gap-3 border-t px-3 py-2 text-center text-[clamp(10px,1vw,16px)] font-bold ${isDark ? 'border-white/30 bg-white/5 text-white' : 'border-[#b99647]/70 bg-[#173d78] text-white'}`}><span>{branding.organizationName || 'Gurdwara'}</span><span aria-hidden="true">•</span><span>{branding.address || 'Waheguru Ji Ka Khalsa, Waheguru Ji Ki Fateh'}</span></footer> : null;
  const fitted = (text, className, maxSize, minSize = 12) => <p data-fit-text data-max-size={maxSize} data-min-size={minSize} className={className}>{text}</p>;

  let layout;
  if (templateId === 'ornate-tricolumn') {
    layout = <div className="grid min-h-0 flex-1 grid-cols-3 gap-[clamp(6px,1vw,16px)]">
        <section className="min-h-0 overflow-hidden border-2 border-double border-[#b99647] bg-[#fffdf5]/90 p-[clamp(8px,1vw,18px)]"><h3 className="mb-2 border-b border-[#b99647]/70 pb-1 text-center text-[clamp(11px,1.2vw,18px)] font-bold text-[#193e75]">ਪੰਜਾਬੀ ਵਿਆਖਿਆ</h3><div className="h-[calc(100%-2rem)] overflow-hidden px-[clamp(6px,.8vw,14px)] pt-[clamp(8px,.8vh,16px)] text-justify text-[#282217]">{fitted(punjabi, 'font-gurmukhi leading-[1.5]', 72, 10)}</div></section>
        <section className="flex min-h-0 flex-col overflow-hidden border-2 border-double border-[#b99647] bg-[#fffdf5]/90 p-[clamp(8px,1vw,18px)]"><div className="min-h-0 flex-1 overflow-hidden px-[clamp(6px,.8vw,14px)] pt-[clamp(12px,1.5vh,26px)] pb-1 text-left text-[#164b9c]">{fitted(gurmukhi, 'font-gurmukhi font-bold leading-[1.15] text-justify', 320, 14)}</div></section>
      <section className="min-h-0 overflow-hidden border-2 border-double border-[#b99647] bg-[#fffdf5]/90 p-[clamp(8px,1vw,18px)]"><h3 className="mb-2 border-b border-[#b99647]/70 pb-1 text-center text-[clamp(11px,1.2vw,18px)] font-bold text-[#193e75]">English Translation</h3><div className="h-[calc(100%-2rem)] overflow-hidden px-[clamp(6px,.8vw,14px)] pt-[clamp(8px,.8vh,16px)] text-justify text-[#252525]">{fitted(english, 'font-semibold leading-[1.5]', 72, 10)}</div></section>
    </div>;
  } else {
    layout = <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_.85fr] gap-5"><section className="flex min-h-0 flex-col overflow-hidden border-r border-white/20 pr-5"><div className="min-h-0 flex-1 overflow-hidden px-[clamp(24px,2vw,44px)] pt-[clamp(20px,2vh,40px)] pb-2 text-left">{fitted(gurmukhi, 'font-gurmukhi font-bold leading-[1.15] text-justify text-white', 320, 12)}</div></section><div className="grid min-h-0 flex-1 grid-rows-2 gap-4"><section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-white/5 px-[clamp(16px,1.4vw,28px)] py-4"><h3 className="mb-2 shrink-0 text-xs font-bold uppercase text-amber-200">ਪੰਜਾਬੀ ਅਰਥ</h3><div className="min-h-0 flex-1 overflow-hidden pt-[clamp(8px,.8vh,16px)] text-justify">{fitted(punjabi, 'font-gurmukhi leading-[1.5] text-amber-50', 64, 8)}</div></section><section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/15 bg-white/5 px-[clamp(16px,1.4vw,28px)] py-4"><h3 className="mb-2 shrink-0 text-xs font-bold uppercase text-cyan-100">English Translation</h3><div className="min-h-0 flex-1 overflow-hidden pt-[clamp(8px,.8vh,16px)] text-justify">{fitted(english, 'leading-[1.5] text-cyan-50', 64, 8)}</div></section></div></div>;
  }

  return <div ref={rootRef} className={`relative flex h-full w-full flex-col overflow-hidden border-[clamp(5px,.65vw,10px)] border-double border-[#b99647] p-[clamp(10px,1.5vw,28px)] ${getTemplateFrame(templateId)}`}>
    <div aria-hidden="true" className="pointer-events-none absolute inset-[clamp(2px,.28vw,5px)] rounded-[4px] border border-[#b99647]/70" />
    {title}
    <div className="relative z-10 mt-[clamp(6px,.7vw,12px)] flex min-h-0 flex-1 flex-col">{!hasHukamnama && !preview ? <p className="grid h-full place-items-center text-center text-2xl font-bold">Today&apos;s Hukamnama is not available yet.</p> : layout}</div>
    {templateId === 'original-default' && hasHukamnama ? <div aria-label="End of today's Hukamnama" className="relative z-10 my-2 shrink-0 border-t border-white/35" /> : null}
    {settings.showFooter ? footer : null}
    {preview ? <span className="absolute right-2 top-2 z-20 rounded-full bg-black/40 px-2 py-1 text-[10px] font-bold text-white">PREVIEW</span> : null}
  </div>;
};

export default HukamnamaLedTemplate;
