import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowTopRightOnSquareIcon, ClipboardDocumentIcon, TrashIcon } from '@heroicons/react/24/outline';
import Card from '../../components/ui/Card';
import StatusAlert from '../../components/common/StatusAlert';
import recitationService from '../../services/recitationService';
import { BRANDING_PRESETS } from '../../context/BrandingContext';
import { formatClock, formatDay, formatSpan, useRecitationLive, useRecitationText } from '../../hooks/useRecitation';
import { publishStreamOverlayVisibility } from '../../services/streamOverlayControl';
import { getPublishedStreamOverlaySettings, readStreamOverlaySettings, saveStreamOverlaySettings, publishStreamOverlaySettings } from '../../services/streamOverlaySettings';

const PAGE_SIZE = 10;
const inputClass = 'mt-1 block w-full min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-normal normal-case text-slate-700 outline-none focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20';

const localDateKey = (iso) => {
  const date = new Date(iso || '');
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const StatusPill = ({ status }) => <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${status === 'live' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-700'}`}>{status === 'live' ? 'Live' : 'Ended'}</span>;

const CopyLinkRow = ({ label, path }) => {
  const [copied, setCopied] = useState(false);
  const url = useMemo(() => new URL(path, window.location.origin).toString(), [path]);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link:', url);
    }
  };
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 p-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        <p className="truncate text-xs text-slate-500" title={url}>{url}</p>
      </div>
      <button type="button" onClick={copy} className="shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50" title="Copy link" aria-label={`Copy ${label} link`}><ClipboardDocumentIcon className="h-4 w-4" /></button>
      <a href={path} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brand-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" aria-label={`Go to ${label} page`}>Go to page<ArrowTopRightOnSquareIcon className="h-4 w-4" /></a>
      {copied ? <span className="text-xs font-semibold text-emerald-600">Copied</span> : null}
    </div>
  );
};

const AdminRecitationsPage = () => {
  const queryClient = useQueryClient();
  const { session: live, setSession, connectionStatus = 'connecting' } = useRecitationLive();
  const { lines: fullLines } = useRecitationText(live, 'full');
  const [savedOverlaySettings] = useState(readStreamOverlaySettings);
  const [overlaySettingsLoaded, setOverlaySettingsLoaded] = useState(false);
  const [status, setStatus] = useState({ type: 'success', message: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [page, setPage] = useState(1);
  const [overlayOn, setOverlayOn] = useState(savedOverlaySettings.overlayOn);
  const [overlayLogo, setOverlayLogo] = useState(savedOverlaySettings.overlayLogo);
  const [overlayLanguages, setOverlayLanguages] = useState(savedOverlaySettings.overlayLanguages);
  const [overlayOpacity, setOverlayOpacity] = useState(savedOverlaySettings.overlayOpacity);
  const [gurmukhiSize, setGurmukhiSize] = useState(savedOverlaySettings.gurmukhiSize);
  const [punjabiSize, setPunjabiSize] = useState(savedOverlaySettings.punjabiSize);
  const [englishSize, setEnglishSize] = useState(savedOverlaySettings.englishSize);
  const [overlayAnnouncement, setOverlayAnnouncement] = useState(savedOverlaySettings.overlayAnnouncement);
  const [overlayHeaderMessage, setOverlayHeaderMessage] = useState(savedOverlaySettings.overlayHeaderMessage);
  const [headerSize, setHeaderSize] = useState(savedOverlaySettings.headerSize);
  const [headerPunjabiSize, setHeaderPunjabiSize] = useState(savedOverlaySettings.headerPunjabiSize);
  const [punjabiAnnouncement, setPunjabiAnnouncement] = useState(savedOverlaySettings.punjabiAnnouncement);
  const [headerPunjabi, setHeaderPunjabi] = useState(savedOverlaySettings.headerPunjabi);
  const [upperEnglish, setUpperEnglish] = useState(savedOverlaySettings.upperEnglish);
  const [upperPunjabi, setUpperPunjabi] = useState(savedOverlaySettings.upperPunjabi);
  const [upperSpeed, setUpperSpeed] = useState(savedOverlaySettings.upperSpeed);
  const [lowerSpeed, setLowerSpeed] = useState(savedOverlaySettings.lowerSpeed);
  const [tickerColors, setTickerColors] = useState(savedOverlaySettings.tickerColors);
  const [upperSize, setUpperSize] = useState(savedOverlaySettings.upperSize);
  const [lowerSize, setLowerSize] = useState(savedOverlaySettings.lowerSize);
  const brandColorsPreset = { id: 'brand-colors', label: 'Logo Brand Colors', primaryColor: '#004080', accentColor: '#F89820' };
  const overlayThemePresets = [brandColorsPreset, ...BRANDING_PRESETS];
  const [overlayThemeId, setOverlayThemeId] = useState(savedOverlaySettings.overlayThemeId);
  const selectedOverlayTheme = overlayThemePresets.find((preset) => preset.id === overlayThemeId) || brandColorsPreset;

  useEffect(() => {
    let active = true;
    getPublishedStreamOverlaySettings()
      .then((published) => {
        if (!active) return;
        const settings = { ...savedOverlaySettings, ...(published || {}) };
        setOverlayOn(settings.overlayOn);
        setOverlayLogo(settings.overlayLogo);
        setOverlayLanguages(settings.overlayLanguages);
        setOverlayOpacity(settings.overlayOpacity);
        setGurmukhiSize(settings.gurmukhiSize);
        setPunjabiSize(settings.punjabiSize);
        setEnglishSize(settings.englishSize);
        setOverlayAnnouncement(settings.overlayAnnouncement);
        setOverlayHeaderMessage(settings.overlayHeaderMessage);
        setHeaderSize(settings.headerSize);
        setHeaderPunjabiSize(settings.headerPunjabiSize);
        setPunjabiAnnouncement(settings.punjabiAnnouncement);
        setHeaderPunjabi(settings.headerPunjabi);
        setUpperEnglish(settings.upperEnglish);
        setUpperPunjabi(settings.upperPunjabi);
        setUpperSpeed(settings.upperSpeed);
        setLowerSpeed(settings.lowerSpeed);
        setTickerColors(settings.tickerColors);
        setUpperSize(settings.upperSize);
        setLowerSize(settings.lowerSize);
        setOverlayThemeId(settings.overlayThemeId);
        setOverlaySettingsLoaded(true);
      })
      .catch(() => {
        if (active) setStatus({ type: 'error', message: 'Unable to load published overlay settings. Reload this page before making broadcast changes.' });
      });
    return () => { active = false; };
  // Read the server once on mount. The local snapshot is only a fallback if it is unavailable.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const settings = {
      overlayOn, overlayLogo, overlayLanguages, overlayOpacity, gurmukhiSize, punjabiSize, englishSize,
      overlayAnnouncement, overlayHeaderMessage, headerSize, headerPunjabiSize, punjabiAnnouncement,
      headerPunjabi, upperEnglish, upperPunjabi, upperSpeed, lowerSpeed, tickerColors, upperSize, lowerSize,
      overlayThemeId
    };
    saveStreamOverlaySettings(settings);
    if (!overlaySettingsLoaded) return undefined;
    const timer = window.setTimeout(() => {
      publishStreamOverlaySettings(settings).catch((error) => {
        setStatus({ type: 'error', message: error?.response?.data?.message || 'Unable to publish overlay settings.' });
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [overlayOn, overlayLogo, overlayLanguages, overlayOpacity, gurmukhiSize, punjabiSize, englishSize,
    overlayAnnouncement, overlayHeaderMessage, headerSize, headerPunjabiSize, punjabiAnnouncement,
    headerPunjabi, upperEnglish, upperPunjabi, upperSpeed, lowerSpeed, tickerColors, upperSize, lowerSize,
    overlayThemeId, overlaySettingsLoaded]);

  useEffect(() => {
    publishStreamOverlayVisibility(overlayOn);
  }, [overlayOn]);

  const { data: sessions = [] } = useQuery({ queryKey: ['recitation-sessions'], queryFn: () => recitationService.listSessions(), refetchInterval: 30000 });

  useEffect(() => {
    queryClient.invalidateQueries({ queryKey: ['recitation-sessions'] });
  }, [live?.id, live?.status, queryClient]);

  const onFailure = (error) => {
    setStatus({ type: 'error', message: error?.response?.data?.message || error.message || 'That did not go through.' });
  };

  const filtered = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return sessions.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (dateFilter && localDateKey(entry.startedAt) !== dateFilter) return false;
      return !needle || [entry.title, entry.titleEnglish, entry.reciter, entry.notes].some((value) => String(value || '').toLowerCase().includes(needle));
    });
  }, [sessions, searchTerm, statusFilter, dateFilter]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = useMemo(() => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [filtered, page]);
  useEffect(() => { setPage(1); }, [searchTerm, statusFilter, dateFilter]);
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const stepMutation = useMutation({ mutationFn: (change) => recitationService.step(live.id, change), onSuccess: setSession, onError: onFailure });
  const endMutation = useMutation({
    mutationFn: () => recitationService.end(live.id),
    onSuccess: () => { setSession(null); setStatus({ type: 'success', message: 'Recitation ended and saved to the table below.' }); },
    onError: onFailure
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => recitationService.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recitation-sessions'] }),
    onError: onFailure
  });

  const index = live?.currentIndex ?? 0;
  const line = fullLines[index];
  const streamOverlayPath = '/stream-overlay';
  const streamOverlayPreviewPath = streamOverlayPath;

  return (
    <div className="admin-recitations w-full min-w-0 max-w-full space-y-6 overflow-x-clip">
      <h1 className="sr-only">Recitation &amp; Stream Overlay</h1>
      <StatusAlert type={status.type} message={status.message} />

      <Card className="w-full min-w-0 max-w-full">
        <h2 className="font-heading text-xl font-semibold">Live Recitation Control</h2>
        <p className="mt-1 text-sm text-slate-600">Recitations are started from the Granthi's phone. The Darbar Hall LED screen shows the Gurmukhi with Punjabi and English translations; the sangat follows the Gurbani from the QR code on the LED board.</p>

        {live ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />Live now</p>
                <p className="mt-1 font-gurmukhi text-2xl font-bold text-slate-900">{live.title}</p>
                <p className="text-sm text-slate-600">{live.titleEnglish} · started {formatClock(live.startedAt)} ({formatSpan(live.startedAt)} ago){live.reciter ? ` · ${live.reciter}` : ''}</p>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-[#0b2a5b] p-4 text-center text-white">
              <p className="font-gurmukhi text-2xl font-bold leading-snug">{line?.g || 'Loading...'}</p>
              {line?.p ? <p className="mt-2 font-gurmukhi text-base font-semibold text-amber-300">{line.p}</p> : null}
              {line?.e ? <p className="mt-1 text-base font-semibold text-cyan-100">{line.e}</p> : null}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => stepMutation.mutate({ delta: -1 })} disabled={index <= 0} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Previous line</button>
              <button type="button" onClick={() => stepMutation.mutate({ delta: 1 })} disabled={index >= live.totalLines - 1} className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Next line</button>
              <span className="text-sm font-semibold text-slate-600">Line {index + 1} of {live.totalLines}</span>
              <button type="button" onClick={() => { if (window.confirm('End this recitation now?')) endMutation.mutate(); }} className="ml-auto rounded-full bg-red-600 px-8 py-3 text-base font-extrabold text-white shadow hover:bg-red-700">End recitation</button>
            </div>
          </div>
        ) : null}

        {!live ? <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">No recitation is live right now.</p> : null}
      </Card>

      <Card className="w-full min-w-0 max-w-full">
        <h2 className="font-heading text-xl font-semibold">Screens and links</h2>
        <p className="mt-1 text-sm text-slate-600">Open the LED board on the Darbar Hall screen. Its QR code is for the sangat; the Granthi starts and controls the recitation from the Granthi page on their phone.</p>
        <div className="mt-3 grid min-w-0 gap-2 md:grid-cols-2">
          <CopyLinkRow label="LED board (Darbar Hall screen)" path="/recitation-board" />
          <CopyLinkRow label="Granthi's Recitation Controls (phone)" path="/granthi-remote" />
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-bold text-slate-900">Streamlabs Bani Overlay</h3>
              <p className="mt-0.5 text-xs text-slate-600">Transparent landscape browser source; follows each line selected by the Granthi.</p>
            </div>
            <button type="button" onClick={() => setOverlayOn((value) => !value)} aria-pressed={overlayOn} className={`rounded-full px-4 py-2 text-xs font-bold ${overlayOn ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-800'}`}>Overlay {overlayOn ? 'On' : 'Off'}</button>
            <span role="status" className={`rounded-full px-3 py-2 text-xs font-bold ${connectionStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' : connectionStatus === 'reconnecting' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'}`}>
              {connectionStatus === 'connected' ? (live?.status === 'live' ? 'Recitation LIVE · SYNCED' : 'SYNCED · Waiting for recitation') : connectionStatus === 'reconnecting' || connectionStatus === 'connecting' ? 'Reconnecting to recitation…' : 'Recitation connection offline'}
            </span>
          </div>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Overlay themes">
            <h4 className="font-bold text-slate-900">Themes and background</h4>
          <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Brand color presets">
            {overlayThemePresets.map((preset) => (
              <button key={preset.id} type="button" onClick={() => setOverlayThemeId(preset.id)} aria-pressed={overlayThemeId === preset.id} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${overlayThemeId === preset.id ? 'border-brand-blue ring-2 ring-brand-blue/20' : 'border-slate-200'}`}>
                <span className="flex gap-1"><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: preset.primaryColor }} /><span className="h-4 w-4 rounded-full border border-black/10" style={{ backgroundColor: preset.accentColor }} /></span>
                {preset.label}
              </button>
            ))}
          </div>
            <label className="mt-4 block max-w-sm text-xs font-semibold text-slate-700">Background opacity: {overlayOpacity}%
              <input type="range" min="15" max="100" value={overlayOpacity} onChange={(event) => setOverlayOpacity(Number(event.target.value))} className="mt-3 w-full accent-brand-blue" />
            </label>
          </section>
          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4" aria-label="Overlay text and fonts">
            <h4 className="font-bold text-slate-900">Text and font sizes</h4>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-xs font-semibold text-slate-700">Text shown
              <select value={overlayLanguages} onChange={(event) => setOverlayLanguages(event.target.value)} className={inputClass}><option value="gpe">Gurmukhi + Punjabi + English</option><option value="ge">Gurmukhi + English</option><option value="gp">Gurmukhi + Punjabi</option><option value="g">Gurmukhi only</option></select>
            </label>
            <label className="text-xs font-semibold text-slate-700">Gurbani font size: {gurmukhiSize}%
              <input type="range" min="0" max="100" value={gurmukhiSize} onChange={(event) => setGurmukhiSize(Number(event.target.value))} className="mt-3 w-full accent-brand-blue" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Punjabi translation size: {punjabiSize}%
              <input type="range" min="0" max="100" value={punjabiSize} onChange={(event) => setPunjabiSize(Number(event.target.value))} className="mt-3 w-full accent-brand-blue" />
            </label>
            <label className="text-xs font-semibold text-slate-700">English translation size: {englishSize}%
              <input type="range" min="0" max="100" value={englishSize} onChange={(event) => setEnglishSize(Number(event.target.value))} className="mt-3 w-full accent-brand-blue" />
            </label>
          </div>
          </section>
          <section className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2" aria-label="Header controls">
            <h4 className="font-bold sm:col-span-2">Header — stationary text</h4>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700"><input type="checkbox" checked={overlayLogo} onChange={(event) => setOverlayLogo(event.target.checked)} className="h-4 w-4 accent-brand-blue" />Show Gurdwara logo</label>
            <label className="text-xs font-semibold text-slate-700">Header occasion — English
              <input value={overlayHeaderMessage} onChange={(event) => setOverlayHeaderMessage(event.target.value.slice(0, 120))} maxLength={120} placeholder="e.g. Gurpurab Diwan" className={inputClass} />
            </label>
            <label className="text-xs font-semibold text-slate-700">English header font size: {headerSize}%
              <input type="range" min="0" max="100" value={headerSize} onChange={(event) => setHeaderSize(Number(event.target.value))} className="mt-3 w-full accent-brand-blue" />
            </label>
            <label className="text-xs font-semibold text-slate-700">Header occasion — Punjabi
              <input lang="pa" value={headerPunjabi} onChange={(event) => setHeaderPunjabi(event.target.value)} maxLength={120} className={`${inputClass} font-gurmukhi`} />
            </label>
            <label className="text-xs font-semibold text-slate-700">Punjabi header font size: {headerPunjabiSize}%
              <input type="range" min="0" max="100" value={headerPunjabiSize} onChange={(event) => setHeaderPunjabiSize(Number(event.target.value))} className="mt-3 w-full accent-brand-blue" />
            </label>
          </section>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {[
              { title: 'Upper footer ticker', english: upperEnglish, setEnglish: setUpperEnglish, punjabi: upperPunjabi, setPunjabi: setUpperPunjabi, speed: upperSpeed, setSpeed: setUpperSpeed, size: upperSize, setSize: setUpperSize },
              { title: 'Bottom footer ticker', english: overlayAnnouncement, setEnglish: setOverlayAnnouncement, punjabi: punjabiAnnouncement, setPunjabi: setPunjabiAnnouncement, speed: lowerSpeed, setSpeed: setLowerSpeed, size: lowerSize, setSize: setLowerSize }
            ].map((ticker) => <section key={ticker.title} aria-label={`${ticker.title} controls`} className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <h4 className="font-bold">{ticker.title}</h4>
              <div className="flex flex-wrap gap-4">
                {['bg', 'fg'].map((channel) => {
                  const position = ticker.title === 'Upper footer ticker' ? 'upper' : 'lower';
                  const key = `${position}${channel}`;
                  const fallback = position === 'upper'
                    ? (channel === 'bg' ? selectedOverlayTheme.primaryColor : '#ffffff')
                    : (channel === 'bg' ? selectedOverlayTheme.accentColor : selectedOverlayTheme.primaryColor);
                  return <label key={key} className="text-xs font-semibold">{channel === 'bg' ? 'Background color' : 'Text color'}<input type="color" value={tickerColors[key] || fallback} onChange={(event) => setTickerColors((current) => ({ ...current, [key]: event.target.value }))} className="mt-1 block h-9 w-16 cursor-pointer" /></label>;
                })}
              </div>
              <label className="block text-xs font-semibold">English text<input value={ticker.english} onChange={(event) => ticker.setEnglish(event.target.value)} maxLength={180} placeholder="Leave blank to hide" className={inputClass} /></label>
              <label className="block text-xs font-semibold">Punjabi text<input lang="pa" value={ticker.punjabi} onChange={(event) => ticker.setPunjabi(event.target.value)} maxLength={180} className={`${inputClass} font-gurmukhi`} /></label>
              <label className="block text-xs font-semibold">Scroll speed: {ticker.speed}%{ticker.speed === 0 ? ' (paused)' : ''}<input type="range" min="0" max="100" value={ticker.speed} onChange={(event) => ticker.setSpeed(Number(event.target.value))} className="mt-2 w-full accent-brand-blue" /></label>
              <label className="block text-xs font-semibold">Font size: {ticker.size}%<input type="range" min="0" max="100" value={ticker.size} onChange={(event) => ticker.setSize(Number(event.target.value))} className="mt-2 w-full accent-brand-blue" /></label>
            </section>)}
          </div>
          <div className="mx-auto mt-4 w-full max-w-5xl">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-slate-600"><span>Exact overlay preview</span><span>16:9 · 1920 × 1080</span></div>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-slate-300 bg-transparent shadow-inner" aria-label="Live overlay preview">
              <iframe key={streamOverlayPreviewPath} title="Exact 16:9 Streamlabs overlay preview" src={streamOverlayPreviewPath} className="absolute inset-0 h-full w-full border-0" loading="lazy" />
            </div>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">This is the actual overlay page at 16:9. Published changes reach the preview and Streamlabs automatically within a few seconds; the source URL stays unchanged.</p>
          <div className="mt-3">
            <CopyLinkRow label="Copy configured Streamlabs browser-source URL" path={streamOverlayPath} />
          </div>
          <details className="mt-3 text-sm text-slate-700">
            <summary className="cursor-pointer font-bold text-slate-900">Setup and compatibility</summary>
            <ol className="mt-3 list-decimal space-y-2 pl-5">
              <li>Add the copied URL in Streamlabs as a <strong>Browser Source</strong> or <strong>Web Overlay</strong>.</li>
              <li>Set the source canvas to <strong>1920 × 1080</strong> for landscape and place it above the camera/video source.</li>
              <li>Use a 16:9 (1920 × 1080) Browser Source and choose “Fit to screen” or preserve aspect ratio—do not stretch the source. Streamlabs Mobile browser-source support varies by app/version; test the Web Overlay feature first.</li>
              <li>Start the recitation with the Granthi remote. The overlay follows the same live line and translations as the LED board; toggle it off or remove the source when no text should appear.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-600">The header and footer use the configured Gurdwara brand blue and orange. Custom streaming providers may block embedded playback; test the provider URL and use the “Open stream” fallback where needed.</p>
          </details>
        </div>
      </Card>

      <Card className="w-full min-w-0 max-w-full">
        <h2 className="font-heading text-xl font-semibold">All recitations</h2>
        <p className="mt-1 text-sm text-slate-600">Every recitation by date, with when it started and ended. The audience follows from the QR code displayed on the LED board.</p>
        <div className="mt-4 grid min-w-0 gap-2 md:grid-cols-3">
          <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Search<input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Shabad, reciter, or occasion" className={inputClass} /></label>
          <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Date<input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} className={inputClass} /></label>
          <label className="min-w-0 text-xs font-semibold uppercase tracking-wide text-slate-500">Status<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className={inputClass}><option value="all">All</option><option value="live">Live</option><option value="ended">Ended</option></select></label>
        </div>

        <div className="mt-4 w-full min-w-0 max-w-full overflow-x-auto">
          <table className="w-full min-w-0 divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Recitation</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Date</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Started</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Ended</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Duration</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Reciter</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Progress</th>
                <th className="admin-compact-mobile-hidden px-3 py-2">Status</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-3 py-2">
                    <p className="truncate font-gurmukhi text-base font-bold text-slate-800">{entry.title}</p>
                    <p className="truncate text-xs text-slate-500">{entry.titleEnglish}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 xl:hidden"><StatusPill status={entry.status} /><span className="text-[11px] text-slate-500">{formatDay(entry.startedAt)} · {formatClock(entry.startedAt)} to {entry.endedAt ? formatClock(entry.endedAt) : 'now'}</span></div>
                  </td>
                  <td className="admin-compact-mobile-hidden px-3 py-2">{formatDay(entry.startedAt)}</td>
                  <td className="admin-compact-mobile-hidden px-3 py-2">{formatClock(entry.startedAt)}</td>
                  <td className="admin-compact-mobile-hidden px-3 py-2">{entry.endedAt ? formatClock(entry.endedAt) : '-'}</td>
                  <td className="admin-compact-mobile-hidden px-3 py-2">{formatSpan(entry.startedAt, entry.endedAt)}</td>
                  <td className="admin-compact-mobile-hidden px-3 py-2">{entry.reciter || '-'}</td>
                  <td className="admin-compact-mobile-hidden px-3 py-2">{Math.min(entry.totalLines, entry.currentIndex + 1)} / {entry.totalLines}</td>
                  <td className="admin-compact-mobile-hidden px-3 py-2"><StatusPill status={entry.status} /></td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => { if (window.confirm('Delete this recitation record?')) deleteMutation.mutate(entry.id); }} className="rounded-md border border-red-200 p-1.5 text-red-700" title="Delete" aria-label="Delete recitation"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 ? <tr><td className="px-3 py-6 text-center text-slate-500" colSpan={9}>{sessions.length ? 'No recitations match your filters.' : 'No recitations yet. Start one above and it will be listed here.'}</td></tr> : null}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-600">Showing {visible.length} of {filtered.length} recitations</p>
            <div className="flex items-center gap-2">
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Prev</button>
              <span className="text-xs font-semibold text-slate-600">Page {page} of {totalPages}</span>
              <button type="button" className="rounded border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-40" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
            </div>
          </div>
        ) : null}
      </Card>

    </div>
  );
};

export default AdminRecitationsPage;
