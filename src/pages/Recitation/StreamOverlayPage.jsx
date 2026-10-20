import { useEffect, useMemo, useState } from 'react';
import { useRecitationLive, useRecitationText } from '../../hooks/useRecitation';
import { useBranding } from '../../context/BrandingContext';
import AnnouncementTicker from '../../components/recitation/AnnouncementTicker';

const clamp = (value, min, max, fallback) => {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, parsed)) : fallback;
};
const hexToRgb = (hex) => {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(String(hex || ''));
  return match ? match.slice(1).map((channel) => Number.parseInt(channel, 16)) : [11, 78, 162];
};
const normalizeHex = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
const formatBroadcastDateTime = (date) => ({
  date: date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  time: date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
});

const StreamOverlayPage = () => {
  const { session } = useRecitationLive();
  const { lines } = useRecitationText(session, 'full');
  const { branding, logoSrc } = useBranding();
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const enabled = params.get('on') !== '0';
  const showLogo = params.get('logo') !== '0';
  const opacity = clamp(params.get('opacity'), 15, 100, 84) / 100;
  const legacyScale = params.get('size');
  const gurmukhiScale = clamp(params.get('sizeg') || legacyScale, 50, 150, 100) / 100;
  const punjabiScale = clamp(params.get('sizep') || legacyScale, 50, 150, 100) / 100;
  const englishScale = clamp(params.get('sizee') || legacyScale, 50, 150, 100) / 100;
  const languages = params.get('lang') || 'gpe';
  const announcement = params.get('announcement') === '1' ? String(params.get('message') || '').trim().slice(0, 180) : '';
  const punjabiAnnouncement = params.get('announcement') === '1' ? String(params.get('messagepa') || '').trim().slice(0, 180) : '';
  const headerScale = clamp(params.get('sizeh'), 50, 150, 100) / 100;
  const headerMessage = String(params.get('header') || '').trim().slice(0, 120);
  const hasTicker = Boolean(announcement || punjabiAnnouncement);
  const [clockNow, setClockNow] = useState(() => new Date());
  const { currentIndex = 0 } = session || {};
  const line = lines[currentIndex] || null;
  const overlayBlue = normalizeHex(params.get('brandBlue'), normalizeHex(branding.primaryColor, '#0B4EA2'));
  const accentColor = normalizeHex(params.get('brandOrange'), normalizeHex(branding.accentColor, '#F4A300'));
  const [blueRed, blueGreen, blueBlue] = hexToRgb(overlayBlue);
  const panelColor = `rgba(${blueRed}, ${blueGreen}, ${blueBlue}, ${opacity})`;
  const dateTime = formatBroadcastDateTime(clockNow);

  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    const body = document.body;
    const html = document.documentElement;
    const previous = { bodyBackground: body.style.background, bodyMargin: body.style.margin, bodyOverflow: body.style.overflow, htmlBackground: html.style.background };
    body.style.background = 'transparent';
    body.style.margin = '0';
    body.style.overflow = 'hidden';
    html.style.background = 'transparent';
    return () => {
      body.style.background = previous.bodyBackground;
      body.style.margin = previous.bodyMargin;
      body.style.overflow = previous.bodyOverflow;
      html.style.background = previous.htmlBackground;
    };
  }, []);
  if (!enabled) return <main className="stream-overlay-root" aria-hidden="true" />;

  const showGurmukhi = languages.includes('g');
  const showPunjabi = languages.includes('p') && Boolean(line?.p);
  const showEnglish = languages.includes('e') && Boolean(line?.e);
  const organizationName = String(branding.organizationName || 'Gurdwara Singh Sabha').replace(/\s+Milton$/i, '').trim();
  const organizationAddress = branding.address || '7035, Sixth Line, Milton';
  return (
    <main className="stream-overlay-root" aria-live="polite" aria-label="Live Gurbani broadcast overlay" style={{ '--gurbani-size': gurmukhiScale, '--punjabi-size': punjabiScale, '--english-size': englishScale }}>
      <style>{`
        .stream-overlay-root{position:fixed;inset:0;width:100vw;height:100vh;overflow:hidden;background:transparent;color:#fff;pointer-events:none;font-family:Manrope,Arial,sans-serif}.stream-overlay-root *{box-sizing:border-box}
        .stream-overlay-header{position:absolute;top:0;left:0;right:0;min-height:clamp(62px,10vh,112px);width:100%;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.2fr) minmax(0,1fr);align-items:center;gap:2vw;padding:1vh 4vw;background-color:${overlayBlue};border-bottom:clamp(3px,.45vh,7px) solid ${accentColor};box-shadow:0 8px 28px rgba(0,0,0,.2)}
        .stream-overlay-identity{display:flex;min-width:0;align-items:center;gap:clamp(12px,1.8vw,28px)}.stream-overlay-logo{width:clamp(52px,8vh,92px);height:clamp(52px,8vh,92px);flex:0 0 auto;border:2px solid ${accentColor};border-radius:50%;background:#fff;object-fit:contain;padding:3px}.stream-overlay-org-block{min-width:0;display:flex;flex-direction:column;gap:.15vh}
        .stream-overlay-org{min-width:0;color:#fff;font-family:'Crimson Text',Georgia,serif;font-size:clamp(15px,1.35vw,24px);font-weight:500;letter-spacing:.01em;line-height:1.12;text-shadow:0 2px 4px rgba(0,0,0,.28);overflow-wrap:anywhere}.stream-overlay-address{min-width:0;color:rgba(255,255,255,.88);font-size:clamp(10px,.85vw,15px);font-weight:400;line-height:1.15;letter-spacing:.025em}
        .stream-overlay-custom-header{min-width:0;text-align:center;color:#fff;font-family:'Crimson Text',Georgia,serif;font-size:clamp(17px,2vw,34px);font-weight:700;line-height:1.15;text-shadow:0 2px 4px rgba(0,0,0,.3);overflow-wrap:anywhere}.stream-overlay-date-time{flex:0 0 auto;text-align:right;color:#fff;line-height:1.35}.stream-overlay-date{font-size:clamp(12px,1.15vw,20px);font-weight:600;opacity:.94}.stream-overlay-time{margin-top:.15vh;color:${accentColor};font-size:clamp(18px,1.8vw,30px);font-weight:800;font-variant-numeric:tabular-nums}
        .stream-overlay-footer{position:absolute;left:0;right:0;bottom:0;width:100%;min-height:clamp(190px,28vh,380px);display:flex;flex-direction:column;justify-content:center;background:${panelColor};border-top:clamp(3px,.45vh,7px) solid ${accentColor};box-shadow:0 -8px 34px rgba(0,0,0,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}.stream-overlay-footer-ticker-only{min-height:0;display:block;background:transparent;border:0;box-shadow:none;backdrop-filter:none;-webkit-backdrop-filter:none}
        .stream-overlay-lines{width:100%;display:flex;flex-direction:column;align-items:center;gap:1.15vh;padding:2.3vh 4vw;text-align:center}.stream-overlay-g{font-family:'Noto Sans Gurmukhi',sans-serif;font-size:clamp(18px,calc(3vw * var(--gurbani-size)),calc(54px * var(--gurbani-size)));font-weight:700;line-height:1.3;color:${accentColor};text-shadow:0 2px 4px rgba(0,0,0,.6);overflow-wrap:anywhere}.stream-overlay-p{font-family:'Noto Sans Gurmukhi',sans-serif;font-size:clamp(13px,calc(1.45vw * var(--punjabi-size)),calc(27px * var(--punjabi-size)));font-weight:600;line-height:1.35;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.55);overflow-wrap:anywhere}.stream-overlay-e{font-size:clamp(13px,calc(1.5vw * var(--english-size)),calc(28px * var(--english-size)));font-weight:600;line-height:1.35;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.6);overflow-wrap:anywhere}
        @media(max-aspect-ratio:4/3){.stream-overlay-header{min-height:54px;padding:1vh 3vw;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)}.stream-overlay-logo{width:clamp(42px,7vh,72px);height:clamp(42px,7vh,72px)}.stream-overlay-org{font-size:clamp(13px,2vw,19px)}.stream-overlay-address{font-size:clamp(9px,1.4vw,13px)}.stream-overlay-custom-header{font-size:clamp(14px,2.5vw,24px)}.stream-overlay-date{font-size:clamp(10px,1.8vw,15px)}.stream-overlay-time{font-size:clamp(15px,2.6vw,22px)}.stream-overlay-footer{min-height:clamp(160px,30vh,300px)}.stream-overlay-lines{padding-left:3vw;padding-right:3vw;gap:1vh}}
      `}</style>
      <header className="stream-overlay-header" aria-label="Gurdwara broadcast header">
        <div className="stream-overlay-identity">{showLogo ? <img className="stream-overlay-logo" src={logoSrc} alt="" /> : null}<div className="stream-overlay-org-block"><p className="stream-overlay-org">{organizationName}</p><p className="stream-overlay-address">{organizationAddress}</p></div></div>
        <p className="stream-overlay-custom-header" style={{ fontSize: `clamp(${14 * headerScale}px, ${2 * headerScale}vw, ${34 * headerScale}px)` }}>{headerMessage}</p>
        <div className="stream-overlay-date-time" aria-label={`${dateTime.date}, ${dateTime.time}`}><p className="stream-overlay-date">{dateTime.date}</p><p className="stream-overlay-time">{dateTime.time}</p></div>
      </header>
      {line || hasTicker ? <section className={`stream-overlay-footer${!line ? ' stream-overlay-footer-ticker-only' : ''}`} aria-label={line ? 'Live Gurbani broadcast footer' : 'Announcement ticker'}>
        {line ? <div className="stream-overlay-lines">{showGurmukhi ? <p className="stream-overlay-g">{line.g}</p> : null}{showPunjabi ? <p className="stream-overlay-p">{line.p}</p> : null}{showEnglish ? <p className="stream-overlay-e">{line.e}</p> : null}</div> : null}
        {hasTicker ? <AnnouncementTicker english={announcement} punjabi={punjabiAnnouncement} backgroundColor={accentColor} color={overlayBlue} /> : null}
      </section> : null}
    </main>
  );
};
export default StreamOverlayPage;