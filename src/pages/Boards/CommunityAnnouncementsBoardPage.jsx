import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { ArrowsPointingOutIcon, CalendarDaysIcon, PhoneIcon } from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import { COMMUNITY_ANNOUNCEMENT_CATEGORY_LABELS } from '../../constants/communityAnnouncements';
import { readScreenId } from '../../constants/ledBoards';
import useLedScreenHeartbeat from '../../hooks/useLedScreenHeartbeat';
import { useBranding } from '../../context/BrandingContext';
import communityAnnouncementService from '../../services/communityAnnouncementService';

const formatExpiry = (value) => {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

const STICKY_COLORS = [
  { paper: '#fff2b8', tape: '#f1b6a4', pin: '#d74d3f' },
  { paper: '#f4f2d9', tape: '#b8d9ce', pin: '#3975bd' },
  { paper: '#e9dfcd', tape: '#d7c4a8', pin: '#bd3c6b' },
  { paper: '#ffe7bd', tape: '#d5c9b8', pin: '#d77743' },
  { paper: '#f4ead9', tape: '#a9d8d3', pin: '#4f9f77' },
  { paper: '#e3eaf0', tape: '#e7c5ad', pin: '#5d6db5' }
];

const NOTICE_LAYOUTS = [
  'col-start-1 col-span-4 row-start-1 row-span-3',
  'col-start-5 col-span-4 row-start-1 row-span-3',
  'col-start-9 col-span-4 row-start-1 row-span-3',
  'col-start-2 col-span-3 row-start-4 row-span-3',
  'col-start-5 col-span-4 row-start-4 row-span-3',
  'col-start-9 col-span-3 row-start-4 row-span-3'
];

const CommunityAnnouncementsBoardPage = () => {
  const { branding, logoSrc } = useBranding();
  const [searchParams] = useSearchParams();
  const screenId = readScreenId(searchParams.get('screen'));
  const [pageIndex, setPageIndex] = useState(0);
  const [slideElapsed, setSlideElapsed] = useState(0);
  const { data: boardSettings = { slideDurationSeconds: 24 } } = useQuery({
    queryKey: ['community-announcement-board-settings'],
    queryFn: communityAnnouncementService.getBoardSettings,
    staleTime: 0,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    retry: 1
  });
  const slideDurationSeconds = Math.min(120, Math.max(5, Number(boardSettings.slideDurationSeconds) || 24));
  const { data: announcements = [], isError } = useQuery({
    queryKey: ['community-announcements-public'],
    queryFn: communityAnnouncementService.listPublic,
    refetchInterval: 15000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 2
  });
  const { data: noticeTypes = [] } = useQuery({
    queryKey: ['community-announcement-categories'],
    queryFn: communityAnnouncementService.getCategories,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });
  const categoryLabels = useMemo(() => ({
    ...COMMUNITY_ANNOUNCEMENT_CATEGORY_LABELS,
    ...Object.fromEntries(noticeTypes.map((entry) => [entry.value, entry.label]))
  }), [noticeTypes]);

  const pageCount = Math.max(1, Math.ceil(announcements.length / 6));
  const currentPage = pageIndex % pageCount;
  const pageAnnouncements = useMemo(
    () => announcements.slice(currentPage * 6, currentPage * 6 + 6),
    [announcements, currentPage]
  );
  useLedScreenHeartbeat(screenId, `Community Notices · ${announcements.length} active`);

  useEffect(() => {
    setSlideElapsed(0);
    if (pageCount < 2) return undefined;
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      if (elapsed >= slideDurationSeconds * 1000) setPageIndex((current) => (current + 1) % pageCount);
      else setSlideElapsed(elapsed);
    }, 100);
    return () => window.clearInterval(timer);
  }, [pageCount, pageIndex, slideDurationSeconds]);

  useEffect(() => {
    const previousBodyBackground = document.body.style.background;
    const previousBodyMargin = document.body.style.margin;
    document.body.style.background = '#c99a67';
    document.body.style.margin = '0';
    return () => {
      document.body.style.background = previousBodyBackground;
      document.body.style.margin = previousBodyMargin;
    };
  }, []);

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen?.();
    else await document.documentElement.requestFullscreen?.();
  };

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-[#c99a67] text-slate-900" aria-label="Community announcements LED board">
      <Seo title="Community Announcements Board" description="Community poster and text announcements on the Gurdwara corkboard LED display." />
      <style>{'@keyframes community-card-enter { from { opacity: 0; } to { opacity: 1; } } .community-notice-card { animation: community-card-enter 450ms ease-out both; filter: drop-shadow(0 9px 8px rgba(57,35,17,.22)); } .community-cork { background-color:#b77945; background-image:radial-gradient(ellipse at 18% 22%,rgba(255,224,177,.32),transparent 35%),radial-gradient(ellipse at 78% 68%,rgba(92,48,19,.22),transparent 42%),repeating-linear-gradient(13deg,rgba(92,48,19,.12) 0 1px,transparent 1px 5px),repeating-linear-gradient(97deg,rgba(255,237,205,.14) 0 1px,transparent 1px 7px); } .community-board-wood { background:linear-gradient(135deg,#f4d9b3 0%,#c58c58 18%,#f0d1a6 33%,#b97d4b 52%,#edcc9e 72%,#bc8050 100%); box-shadow:inset 0 0 0 3px rgba(255,245,223,.62),inset 0 0 0 8px rgba(100,57,27,.2),0 12px 34px rgba(49,29,14,.45); } .community-paper-tape { position:absolute;top:-.5%;left:50%;z-index:12;width:clamp(32px,5vw,84px);height:clamp(11px,1.5vw,22px);transform:translateX(-50%) rotate(-4deg);background:rgba(161,211,202,.7);box-shadow:0 1px 2px rgba(55,43,30,.15); } @media (prefers-reduced-motion: reduce) { .community-notice-card { animation:none; } }'}</style>
      <header data-testid="community-board-header" className="absolute inset-x-0 top-0 z-20 flex h-[clamp(76px,12vh,112px)] items-center gap-4 border-b-[5px] border-[#8c5a35] bg-[linear-gradient(110deg,#f1d4ad,#c38a56_46%,#e8c59a)] px-[clamp(16px,4vw,64px)] text-slate-800 shadow-[0_5px_14px_rgba(57,35,17,.28)]">
        <img src={logoSrc} alt="" className="h-[clamp(44px,7vh,76px)] w-[clamp(44px,7vh,76px)] shrink-0 rounded-full border-[3px] border-[#fff4df] bg-white object-cover shadow" />
        <div className="min-w-0"><p className="truncate text-[clamp(10px,.9vw,17px)] font-extrabold uppercase tracking-[.12em] text-[#fff8ea] drop-shadow">{branding.organizationName}</p><h1 className="truncate font-heading text-[clamp(22px,2.8vw,54px)] font-black leading-tight text-[#233a5f]">Community Announcements</h1></div>
      </header>
      <section className="community-board-wood absolute inset-x-[1.8%] bottom-[2.5%] top-[calc(clamp(76px,12vh,112px)+1.2%)] rounded-[clamp(10px,1.5vw,24px)] p-[clamp(9px,1.4vw,22px)]" aria-label="Framed cork community notice board">
      <div className="community-cork relative h-full w-full overflow-hidden rounded-[clamp(4px,.7vw,11px)] border border-[#84512e]/70 p-[clamp(12px,2vw,30px)]">
      <div className="grid h-full w-full grid-cols-12 grid-rows-6 gap-x-[1.4%] gap-y-[2.2%]" aria-label="Pinned community notices">
        {pageAnnouncements.map((notice, index) => {
          const palette = STICKY_COLORS[(currentPage * 2 + index) % STICKY_COLORS.length];
          const rotations = [-1.2, 1.1, -0.8, 1.4, -1.3, 0.7];
          const isPoster = notice.noticeFormat === 'poster' && Boolean(notice.imageUrl);
          return (
            <article key={notice.id} className={`community-notice-card ${NOTICE_LAYOUTS[index % NOTICE_LAYOUTS.length]} relative min-h-0 min-w-0 overflow-hidden rounded-[clamp(3px,.45vw,8px)] border border-white/75 p-[clamp(9px,1.3vw,20px)]`} style={{ backgroundColor: palette.paper, transform: `rotate(${rotations[index % rotations.length]}deg)` }}>
              <span className="community-paper-tape" aria-hidden="true" style={{ backgroundColor: palette.tape }} />
              <span aria-hidden="true" className="absolute left-1/2 top-[1.6%] z-10 h-[clamp(10px,1.1vw,18px)] w-[clamp(10px,1.1vw,18px)] -translate-x-1/2 rounded-full border border-white/70 shadow-md" style={{ background: `radial-gradient(circle at 32% 28%,#fff7 0 10%,${palette.pin} 26%,#33251d 100%)` }} />
              {isPoster ? <img src={notice.imageUrl} alt={notice.titleEnglish || notice.titlePunjabi || 'Community poster'} className="h-full w-full rounded-md object-contain" /> : (
                <div className="flex h-full min-h-0 flex-col pt-[1%]">
                  <div data-testid={`notice-text-${notice.id}`} className="flex min-h-0 flex-1 flex-col items-start justify-start overflow-hidden pt-0 text-left">
                    <div className="flex w-full shrink-0 items-center justify-between gap-[2%]">
                      <div className="min-w-0 flex-1">
                        {notice.titlePunjabi ? <h2 lang="pa" className="line-clamp-2 w-full font-gurmukhi text-[clamp(15px,1.35vw,25px)] font-extrabold leading-tight text-slate-900">{notice.titlePunjabi}</h2> : null}
                        {notice.titleEnglish ? <h3 className={`${notice.titlePunjabi ? 'mt-[1%]' : ''} line-clamp-2 w-full text-[clamp(15px,1.3vw,24px)] font-black leading-tight text-slate-900`}>{notice.titleEnglish}</h3> : null}
                      </div>
                      {(notice.titleEnglish || notice.titlePunjabi) ? <div data-testid={`notice-meta-${notice.id}`} className="flex max-w-[48%] shrink-0 flex-wrap items-center justify-end gap-1">
                        <span className="max-w-full truncate rounded-full border border-slate-900/10 bg-white/60 px-2 py-1 text-[clamp(10px,.78vw,15px)] font-extrabold uppercase tracking-wide text-slate-700">{categoryLabels[notice.category] || 'Community notice'}</span>
                        <span className="shrink-0 rounded-full border border-slate-900/10 bg-white/60 px-2 py-1 text-[clamp(10px,.72vw,14px)] font-bold text-slate-600">Until {formatExpiry(notice.publishUntil)}</span>
                      </div> : null}
                      {(notice.titleEnglish || notice.titlePunjabi) ? <div data-testid={`notice-title-divider-${notice.id}`} aria-hidden="true" className="mt-[1.2%] h-px w-full bg-slate-900/25" /> : null}
                    </div>
                    {notice.descriptionPunjabi ? <p lang="pa" className="mt-[2%] line-clamp-3 w-full font-gurmukhi text-[clamp(13px,1vw,19px)] font-semibold leading-snug text-slate-700">{notice.descriptionPunjabi}</p> : null}
                    {notice.descriptionEnglish ? <p className="mt-[1.5%] line-clamp-3 w-full text-[clamp(13px,.95vw,18px)] font-medium leading-snug text-slate-700">{notice.descriptionEnglish}</p> : null}
                  </div>
                  <footer className="flex shrink-0 flex-wrap items-center justify-between gap-1 border-t border-slate-900/10 pt-[2%] text-[clamp(8px,.62vw,12px)] font-semibold text-slate-600">
                    <span className="truncate">{notice.submitterName || 'Sangat member'}</span>
                    {notice.contactValue ? <span className="inline-flex items-center gap-1 font-bold"><PhoneIcon className="h-[1em] w-[1em]" />{notice.contactValue}</span> : null}
                  </footer>
                </div>
              )}
            </article>
          );
        })}
        {pageAnnouncements.length === 0 ? <div className="col-span-12 row-span-6 flex flex-col items-center justify-center gap-4 rounded-xl border border-white/60 bg-[#f2e4ca] text-center text-slate-700 shadow-lg"><CalendarDaysIcon className="h-[8vh] w-[8vh] text-[#8c7253]" /><h2 className="font-heading text-[clamp(28px,3.5vw,65px)] font-bold">Community announcements</h2><p className="text-[clamp(16px,1.6vw,30px)]">No current notices · ਕੋਈ ਮੌਜੂਦਾ ਸੁਨੇਹਾ ਨਹੀਂ</p></div> : null}
      </div>
      </div>
      </section>
      <div className="pointer-events-none absolute bottom-[.35%] right-[2%] z-20 px-2 text-[clamp(10px,.7vw,14px)] font-bold text-[#fff2dd] drop-shadow">{isError ? 'Reconnecting…' : `${pageCount > 1 ? currentPage + 1 : 1} / ${pageCount} · ${announcements.length} notices`}</div>
      {pageCount > 1 ? <div role="progressbar" aria-label="Time until next notice slide" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.floor((slideElapsed / (slideDurationSeconds * 1000)) * 100))} className="absolute inset-x-0 bottom-0 z-20 h-[clamp(5px,.7vh,9px)] bg-black/35"><div className="h-full bg-[#f6d27a] shadow-[0_0_12px_rgba(255,222,143,.8)]" style={{ width: `${Math.min(100, (slideElapsed / (slideDurationSeconds * 1000)) * 100)}%` }} /></div> : null}
      <button type="button" data-board-control onClick={() => void toggleFullscreen()} aria-label="Toggle community board fullscreen" className="absolute right-3 top-3 z-30 rounded-lg border border-white/20 bg-black/30 p-2 text-white opacity-25 transition hover:opacity-100"><ArrowsPointingOutIcon className="h-5 w-5" /></button>
    </main>
  );
};

export default CommunityAnnouncementsBoardPage;
