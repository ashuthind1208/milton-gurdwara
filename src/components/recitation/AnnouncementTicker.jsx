const AnnouncementTicker = ({ english = '', punjabi = '', backgroundColor, color }) => {
  const items = [english.trim(), punjabi.trim()].filter(Boolean);
  if (!items.length) return null;
  const repetitions = Math.max(1, Math.ceil(300 / items.join(' ').length));
  const duration = Math.max(20, items.join(' ').length * repetitions / 5);
  return (
    <div className="recitation-announcement-ticker" aria-label="Footer announcement ticker" style={{ backgroundColor, color }}>
      <style>{`
        .recitation-announcement-ticker{width:100%;overflow:hidden;padding:.18em 0;text-align:center;font-size:clamp(14px,1.5vw,26px);font-weight:600;line-height:1.4}
        .recitation-announcement-track{display:flex;align-items:flex-start;width:max-content;margin-inline:auto;animation:recitation-announcement-scroll var(--ticker-duration) linear infinite}
        .recitation-announcement-copy{display:flex;align-items:flex-start;justify-content:center;flex-shrink:0;gap:1em;padding:0 .5em;white-space:nowrap;text-align:center}
        .recitation-announcement-copy span{margin:0;padding:0;line-height:inherit}
        .recitation-announcement-copy [lang="pa"]{padding-top:.18em}
        @keyframes recitation-announcement-scroll{to{transform:translateX(-50%)}}
        @media(prefers-reduced-motion:reduce){.recitation-announcement-track{animation:none;width:100%}.recitation-announcement-copy{min-width:0;white-space:normal;flex-wrap:wrap}.recitation-announcement-copy[aria-hidden]{display:none}}
      `}</style>
      <div className="recitation-announcement-track" style={{ '--ticker-duration': `${duration}s` }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="recitation-announcement-copy" aria-hidden={copy ? 'true' : undefined}>
            {Array.from({ length: repetitions }, (_, index) => (
              <span key={index} style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '1em' }}>
                {english.trim() ? <span lang="en">{english.trim()}</span> : null}
                {punjabi.trim() ? <span lang="pa" className="font-gurmukhi">{punjabi.trim()}</span> : null}
                <span aria-hidden="true">✦</span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnnouncementTicker;