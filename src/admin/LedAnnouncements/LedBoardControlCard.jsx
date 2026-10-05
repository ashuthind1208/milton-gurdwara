import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import useDailyHukamnama from '../../hooks/useDailyHukamnama';
import ledAnnouncementService, { isAnnouncementLive } from '../../services/ledAnnouncementService';
import ledBoardSettingsService, { clampHukamnamaSeconds, clampInterval } from '../../services/ledBoardSettingsService';
import { HUKAMNAMA_MAX_SECONDS, HUKAMNAMA_MIN_SECONDS, HUKAMNAMA_PRESETS, INTERVAL_PRESETS, LED_BOARDS, MAX_INTERVAL_SECONDS, MIN_INTERVAL_SECONDS, buildLedSlides } from '../../constants/ledBoards';

const SETTINGS_QUERY_KEY = ['led-board-settings'];

const formatDuration = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours ? `${hours}h` : '', minutes ? `${minutes}m` : '', seconds || (!hours && !minutes) ? `${seconds}s` : ''].filter(Boolean).join(' ');
};

const SecondsControl = ({ id, label, value, min, max, presets, onCommit, compact = false }) => {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);

  return (
    <div className={compact ? 'mr-2 shrink-0 rounded-lg border border-brand-blue/20 bg-blue-50 p-1.5' : ''}>
      {compact ? null : <label htmlFor={id} className="block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</label>}
      <div className={`flex items-center gap-1.5 ${compact ? '' : 'mt-1'}`}>
        <input id={id} aria-label={label} type="number" inputMode="numeric" min={min} max={max} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={() => onCommit(draft)} onKeyDown={(event) => { if (event.key === 'Enter') onCommit(draft); }} className={`${compact ? 'w-16 px-2 py-1.5' : 'w-24 px-3 py-2'} rounded-lg border border-slate-300 text-sm font-bold text-slate-800 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20`} />
        <div className="flex gap-1" role="group" aria-label={`${label} presets`}>
          {presets.map((preset) => <button key={preset} type="button" onClick={() => onCommit(preset)} aria-pressed={value === preset} className={`rounded-lg border px-2.5 py-2 text-xs font-bold ${value === preset ? 'border-brand-blue bg-brand-blue text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-50'}`}>{preset}s</button>)}
        </div>
      </div>
    </div>
  );
};

const LedBoardControlCard = () => {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState({ type: 'success', message: '' });

  const { data: settings } = useQuery({
    queryKey: SETTINGS_QUERY_KEY,
    queryFn: () => ledBoardSettingsService.getSettings().then((response) => response.data)
  });
  const { data: announcements = [] } = useQuery({
    queryKey: ['led-board-announcements'],
    queryFn: () => ledAnnouncementService.getAnnouncements().then((response) => response.data)
  });
  const { hasHukamnama } = useDailyHukamnama();
  const liveAnnouncements = useMemo(() => announcements.filter((entry) => isAnnouncementLive(entry)), [announcements]);

  // Changes save immediately and optimistically; the LED screen picks them up on its next refresh.
  const saveMutation = useMutation({
    mutationFn: (next) => ledBoardSettingsService.saveSettings(next),
    onMutate: async (next) => {
      await queryClient.cancelQueries({ queryKey: SETTINGS_QUERY_KEY });
      const previous = queryClient.getQueryData(SETTINGS_QUERY_KEY);
      queryClient.setQueryData(SETTINGS_QUERY_KEY, next);
      return { previous };
    },
    onError: (error, _next, context) => {
      if (context?.previous) queryClient.setQueryData(SETTINGS_QUERY_KEY, context.previous);
      setStatus({ type: 'error', message: error.message || 'Unable to save the LED board settings.' });
    },
    onSuccess: () => setStatus({ type: 'success', message: 'Saved. The LED screen updates within about 15 seconds.' })
  });

  const slides = useMemo(
    () => (settings ? buildLedSlides(settings, { liveAnnouncements, hasHukamnama }) : []),
    [settings, liveAnnouncements, hasHukamnama]
  );

  if (!settings) return <Card><p className="text-sm text-slate-600">Loading LED board settings...</p></Card>;

  const save = (patch) => saveMutation.mutate({ ...(queryClient.getQueryData(SETTINGS_QUERY_KEY) || settings), ...patch });
  const toggleBoard = (key) => {
    const current = queryClient.getQueryData(SETTINGS_QUERY_KEY) || settings;
    save({ enabled: { ...current.enabled, [key]: !current.enabled[key] } });
  };
  const commitInterval = (value) => {
    const next = clampInterval(value);
    if (next !== settings.intervalSeconds) save({ intervalSeconds: next });
  };
  const commitHukamnamaSeconds = (value) => {
    const next = clampHukamnamaSeconds(value);
    if (next !== settings.hukamnamaSeconds) save({ hukamnamaSeconds: next });
  };

  const cycleSeconds = slides.reduce((total, slide) => total + slide.durationSeconds, 0);

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-semibold">LED Board Slideshow</h2>
          <p className="mt-1 text-sm text-slate-600">Choose which boards the LED screen plays and how long each stays on screen. Changes apply automatically; nothing needs to be restarted.</p>
        </div>
        <a href="/led-boards" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/30 px-3 py-2 text-sm font-semibold text-brand-blue hover:bg-blue-50"><ArrowTopRightOnSquareIcon className="h-4 w-4" /> Open LED screen</a>
      </div>

      <div className="mt-3"><StatusAlert type={status.type} message={status.message} /></div>

      <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-3 border-b border-slate-100 pb-4">
        <SecondsControl id="led-interval" label="Seconds per slide" value={settings.intervalSeconds} min={MIN_INTERVAL_SECONDS} max={MAX_INTERVAL_SECONDS} presets={INTERVAL_PRESETS} onCommit={commitInterval} />
        <p className="pb-2 text-sm font-semibold text-slate-700" aria-live="polite">
          {slides.length ? `${slides.length} slide${slides.length === 1 ? '' : 's'} · full cycle ${formatDuration(cycleSeconds)}` : 'No slides active. The LED screen shows the Gurdwara logo.'}
        </p>
      </div>

      <ul className="mt-3 grid gap-2 md:grid-cols-2">
        {LED_BOARDS.map((board) => {
          const Icon = board.icon;
          const enabled = settings.enabled[board.key];
          const note = board.isAnnouncementBoard
            ? (liveAnnouncements.length === 0 ? 'No active announcements; skipped until one is added' : `${liveAnnouncements.length} active announcement${liveAnnouncements.length === 1 ? '' : 's'}, one slide each`)
            : board.key === 'hukamnama' && !hasHukamnama
              ? 'Not posted for today yet; skipped until it is'
              : board.hasOwnDuration ? `${board.description} Shown for ${formatDuration(settings.hukamnamaSeconds)}.` : board.description;
          return (
            <li key={board.key} className={`rounded-lg border border-slate-200 px-3 py-2.5 ${board.key === 'hukamnama' ? 'md:col-span-2' : ''}`}>
              <div className={`flex items-center gap-2.5 ${board.key === 'hukamnama' ? 'flex-nowrap' : 'flex-wrap'}`}>
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${board.accent}`}><Icon className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-semibold text-slate-800">{board.title}</p>
                  <p className="truncate text-xs text-slate-500" title={note}>{note}</p>
                </div>
                {board.key === 'hukamnama' ? <SecondsControl id="led-hukamnama-seconds" label="Hukamnama slide duration in seconds" value={settings.hukamnamaSeconds} min={HUKAMNAMA_MIN_SECONDS} max={HUKAMNAMA_MAX_SECONDS} presets={HUKAMNAMA_PRESETS} onCommit={commitHukamnamaSeconds} compact /> : null}
                <a href={board.path} target="_blank" rel="noreferrer" className="shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title={`Open ${board.title}`} aria-label={`Open ${board.title}`}><ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>
                <button type="button" role="switch" aria-checked={enabled} aria-label={`${board.title} ${enabled ? 'active' : 'inactive'}`} onClick={() => toggleBoard(board.key)} className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
                  <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
};

export default LedBoardControlCard;
