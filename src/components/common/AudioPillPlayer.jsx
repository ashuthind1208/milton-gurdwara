import { useEffect, useMemo, useRef, useState } from 'react';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';

const AudioPillPlayer = ({
  label,
  subtitle,
  src,
  startAtSeconds = 0,
  className = '',
  accent = 'light',
  stream = false,
  showProgress = false
}) => {
  const audioRef = useRef(null);
  const seekAppliedRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const resolvedSrc = useMemo(() => {
    if (!stream) {
      return src;
    }

    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}t=${Date.now()}`;
  }, [src, stream]);

  useEffect(() => {
    seekAppliedRef.current = false;
  }, [resolvedSrc]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const tryApplySeek = () => {
      if (seekAppliedRef.current) {
        return;
      }

      const seekTo = Math.max(0, Number(startAtSeconds) || 0);
      if (seekTo <= 0 || Number.isNaN(seekTo)) {
        seekAppliedRef.current = true;
        return;
      }

      try {
        audio.currentTime = seekTo;
      } catch {
        return;
      }

      seekAppliedRef.current = true;
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onLoadedMetadata = () => setDuration(Number(audio.duration) || 0);
    const onDurationChange = () => setDuration(Number(audio.duration) || 0);
    const onTimeUpdate = () => setCurrentTime(Number(audio.currentTime) || 0);
    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('error', onError);
    audio.addEventListener('loadedmetadata', tryApplySeek);

    if (audio.readyState >= 1) {
      tryApplySeek();
    }

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('error', onError);
      audio.removeEventListener('loadedmetadata', tryApplySeek);
    };
  }, [startAtSeconds, resolvedSrc]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    setHasError(false);

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        setHasError(true);
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const toneClasses = accent === 'dark'
    ? 'border-white/20 bg-slate-950/35 text-white backdrop-blur-md'
    : 'border-brand-blue/15 bg-white text-slate-900';

  const subtitleClasses = accent === 'dark' ? 'text-blue-100/80' : 'text-slate-500';
  const pulseClasses = isPlaying ? 'bg-green-400 animate-pulse' : accent === 'dark' ? 'bg-white/35' : 'bg-slate-300';
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  const progressPercent = safeDuration > 0 ? Math.min(100, Math.max(0, (currentTime / safeDuration) * 100)) : 0;

  return (
    <div className={`rounded-2xl border px-3 py-2 shadow-lg ${toneClasses} ${className}`}>
      <audio ref={audioRef} preload="none" src={resolvedSrc} />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlayback}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${accent === 'dark' ? 'bg-white text-brand-blue' : 'bg-brand-blue text-white'}`}
          aria-label={`${isPlaying ? 'Pause' : 'Play'} ${label}`}
        >
          {isPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
        </button>

        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{label}</p>
          <p className={`truncate text-xs ${subtitleClasses}`}>{hasError ? 'Audio temporarily unavailable' : subtitle}</p>
        </div>

        <span className={`ml-auto h-2.5 w-2.5 rounded-full ${pulseClasses}`} />
      </div>
      {showProgress ? (
        <div className="mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-brand-blue transition-all duration-150" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AudioPillPlayer;