import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackwardIcon, ForwardIcon, PauseIcon, PlayIcon, XMarkIcon } from '@heroicons/react/24/solid';
import LedAnnouncementSlide from './LedAnnouncementSlide';

const CONTROLS_HIDE_DELAY_MS = 3000;

// kiosk: the unattended LED screen; no on-screen controls and no way to exit.
const LedSlideshow = ({ slides, intervalSeconds, onExit, kiosk = false, onCurrentSlideChange }) => {
  const containerRef = useRef(null);
  const enteredFullscreenRef = useRef(false);
  const hideTimerRef = useRef(null);
  const onExitRef = useRef(onExit);
  onExitRef.current = onExit;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  const count = slides.length;
  const current = count ? index % count : 0;
  const currentSlide = slides[current];
  const slideSeconds = currentSlide?.durationSeconds || intervalSeconds;

  useEffect(() => { onCurrentSlideChange?.(currentSlide?.label || 'Idle'); }, [currentSlide?.key, currentSlide?.label, onCurrentSlideChange]);

  const goTo = useCallback((offset) => setIndex((value) => (count ? (value + offset + count) % count : 0)), [count]);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => setControlsVisible(false), CONTROLS_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    if (paused || count < 2) return undefined;
    const timer = window.setTimeout(() => goTo(1), slideSeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [paused, count, slideSeconds, current, goTo]);

  useEffect(() => {
    revealControls();
    return () => window.clearTimeout(hideTimerRef.current);
  }, [revealControls]);

  useEffect(() => {
    const container = containerRef.current;
    const onFullscreenChange = () => {
      if (!kiosk && !document.fullscreenElement && enteredFullscreenRef.current) onExitRef.current();
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    container?.requestFullscreen?.()
      .then(() => { enteredFullscreenRef.current = true; })
      .catch(() => { /* Fullscreen can be refused by the browser; the slideshow still runs in-page. */ });

    return () => {
      enteredFullscreenRef.current = false;
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, [kiosk]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') { goTo(1); revealControls(); }
      else if (event.key === 'ArrowLeft') { goTo(-1); revealControls(); }
      else if (event.key === ' ') { event.preventDefault(); setPaused((value) => !value); revealControls(); }
      else if (event.key === 'Escape' && !kiosk) onExitRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo, revealControls, kiosk]);

  const mountedSlides = useMemo(() => {
    if (!count) return [];
    const positions = [...new Set([(current - 1 + count) % count, current, (current + 1) % count])];
    return positions.map((position) => ({ slide: slides[position], isCurrent: position === current }));
  }, [count, current, slides]);

  const controlButton = 'flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 focus:outline-none focus:ring-2 focus:ring-brand-saffron';

  return (
    <div ref={containerRef} className={`fixed inset-0 z-[300] overflow-hidden bg-black text-white ${controlsVisible && !kiosk ? '' : 'cursor-none'}`} role="dialog" aria-label="LED board slideshow">
      {mountedSlides.map(({ slide, isCurrent }) => (
        <div key={slide.key} className="absolute inset-0 transition-opacity duration-700" style={{ opacity: isCurrent ? 1 : 0, zIndex: isCurrent ? 20 : 10 }} aria-hidden={!isCurrent}>
          {slide.kind === 'announcement'
            ? <LedAnnouncementSlide announcement={slide.announcement} />
            : <iframe title={slide.label} src={slide.src} className="h-full w-full border-0" tabIndex={-1} />}
        </div>
      ))}

      {/* Covers the iframes so pointer and keyboard input stay with the slideshow controls. */}
      <div className="absolute inset-0 z-30" onMouseMove={revealControls} onClick={() => { revealControls(); if (kiosk && !document.fullscreenElement) containerRef.current?.requestFullscreen?.().catch(() => {}); }} />

      {kiosk ? null : <>
      <div className={`pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent p-4 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0'}`}>
        <p className="rounded-full bg-black/50 px-4 py-2 text-sm font-bold">{current + 1} / {count} · {currentSlide?.label}</p>
        <button type="button" onClick={onExit} className={`${controlButton} ${controlsVisible ? 'pointer-events-auto' : 'pointer-events-none'}`} aria-label="Exit slideshow" title="Exit slideshow (Esc)"><XMarkIcon className="h-6 w-6" /></button>
      </div>

      <div className={`absolute inset-x-0 bottom-0 z-40 flex justify-center gap-3 bg-gradient-to-t from-black/70 to-transparent p-5 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        <button type="button" onClick={() => goTo(-1)} className={controlButton} aria-label="Previous slide" title="Previous (Left arrow)"><BackwardIcon className="h-5 w-5" /></button>
        <button type="button" onClick={() => setPaused((value) => !value)} className={controlButton} aria-label={paused ? 'Resume slideshow' : 'Pause slideshow'} title={paused ? 'Resume (Space)' : 'Pause (Space)'}>{paused ? <PlayIcon className="h-5 w-5" /> : <PauseIcon className="h-5 w-5" />}</button>
        <button type="button" onClick={() => goTo(1)} className={controlButton} aria-label="Next slide" title="Next (Right arrow)"><ForwardIcon className="h-5 w-5" /></button>
      </div>
      </>}

      {!paused && count > 1 ? (
        <div className="absolute inset-x-0 bottom-0 z-50 h-1 bg-white/10">
          <div key={`${current}-${slideSeconds}`} className="h-full bg-brand-saffron" style={{ animation: `led-slideshow-progress ${slideSeconds}s linear forwards` }} />
        </div>
      ) : null}
      <style>{'@keyframes led-slideshow-progress { from { width: 0%; } to { width: 100%; } }'}</style>
    </div>
  );
};

export default LedSlideshow;
