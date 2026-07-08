import { useEffect, useMemo, useRef, useState } from 'react';
import { PauseIcon, PlayIcon } from '@heroicons/react/24/solid';

const AudioPillPlayer = ({
  label,
  subtitle,
  src,
  className = '',
  accent = 'light',
  stream = false
}) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = useMemo(() => {
    if (!stream) {
      return src;
    }

    const separator = src.includes('?') ? '&' : '?';
    return `${src}${separator}t=${Date.now()}`;
  }, [src, stream]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return undefined;
    }

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, []);

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
    </div>
  );
};

export default AudioPillPlayer;