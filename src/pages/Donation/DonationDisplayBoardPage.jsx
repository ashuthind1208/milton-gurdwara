import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  HeartIcon,
  PresentationChartLineIcon,
  QrCodeIcon
} from '@heroicons/react/24/outline';
import Seo from '../../components/common/Seo';
import useSeoMeta from '../../hooks/useSeoMeta';
import donationService from '../../services/donationService';
import advertisementService from '../../services/advertisementService';
import sponsorService from '../../services/sponsorService';
import { formatCurrency } from '../../utils/formatters';
import { siteConfig } from '../../constants/siteConfig';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';

const CAMPAIGN_SPOTLIGHT_INTERVAL_MS = 15000;
const BIG_KPI_ROTATION_MS = 18000;
const QUIET_MODE_START_HOUR = 20;
const QUIET_MODE_END_HOUR = 23;

const isWithinQuietWindow = (hour, startHour, endHour) => {
  if (startHour === endHour) {
    return false;
  }

  if (startHour < endHour) {
    return hour >= startHour && hour < endHour;
  }

  return hour >= startHour || hour < endHour;
};

const toAmountNumber = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  const cleaned = String(value || '').replace(/[^0-9.-]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getLocalDayKey = (value) => {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hashCampaignPalette = (seed = '') => {
  const source = String(seed || 'singh-sabha');
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash << 5) - hash + source.charCodeAt(index);
    hash |= 0;
  }

  const hue = Math.abs(hash) % 360;
  return {
    primary: `hsl(${hue} 72% 50%)`,
    soft: `hsl(${hue} 92% 95%)`
  };
};

const DonationDisplayBoardPage = () => {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search || ''), [location.search]);
  const fullscreen = useMemo(() => params.get('fullscreen') === '1', [params]);
  const projectorFromQuery = useMemo(() => params.get('projector') === '1', [params]);
  const [isBrowserFullscreen, setIsBrowserFullscreen] = useState(Boolean(document.fullscreenElement));
  const [projectorMode, setProjectorMode] = useState(projectorFromQuery);
  const isPresentationFullscreen = fullscreen || isBrowserFullscreen;

  const meta = useSeoMeta(
    'Donation Display Board',
    'Live donation display board with QR code, fundraising progress, and real-time updates.'
  );

  const [confettiBursts, setConfettiBursts] = useState([]);
  const [snapshot, setSnapshot] = useState({ raised: 0, donors: 0 });
  const [clockTickMs, setClockTickMs] = useState(Date.now());
  const [rotatingKpiIndex, setRotatingKpiIndex] = useState(0);
  const [burnInDriftIndex, setBurnInDriftIndex] = useState(0);
  const lastGoodCampaignsRef = useRef([]);
  const lastGoodDonationsRef = useRef([]);
  const lastGoodAdsRef = useRef([]);
  const lastGoodSponsorsRef = useRef([]);
  const burstTimerRef = useRef(null);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setClockTickMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  const {
    data: campaignsResponse = [],
    isError: campaignsErrored,
    dataUpdatedAt: campaignsUpdatedAt
  } = useQuery({
    queryKey: ['donation-board-campaigns'],
    queryFn: () => donationService.getCampaigns().then((res) => res.data),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchIntervalInBackground: true
  });

  const {
    data: donationsResponse = [],
    isError: donationsErrored,
    refetch: refetchDonations,
    dataUpdatedAt: donationsUpdatedAt
  } = useQuery({
    queryKey: ['donation-board-donations'],
    queryFn: () => donationService.getDonations().then((res) => res.data),
    refetchInterval: 5000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchIntervalInBackground: true
  });

  const {
    data: advertisementsResponse = [],
    isError: advertisementsErrored
  } = useQuery({
    queryKey: ['advertisements'],
    queryFn: () => advertisementService.getAds().then((res) => res.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });

  const {
    data: sponsorsResponse = [],
    isError: sponsorsErrored
  } = useQuery({
    queryKey: ['sponsors'],
    queryFn: () => sponsorService.getSponsors().then((res) => res.data),
    refetchInterval: 30000,
    refetchOnWindowFocus: true
  });

  const campaigns = useMemo(() => {
    if (Array.isArray(campaignsResponse)) {
      lastGoodCampaignsRef.current = campaignsResponse;
      return campaignsResponse;
    }

    return lastGoodCampaignsRef.current;
  }, [campaignsResponse]);

  const donations = useMemo(() => {
    if (Array.isArray(donationsResponse)) {
      lastGoodDonationsRef.current = donationsResponse;
      return donationsResponse;
    }

    return lastGoodDonationsRef.current;
  }, [donationsResponse]);

  const advertisements = useMemo(() => {
    if (Array.isArray(advertisementsResponse)) {
      lastGoodAdsRef.current = advertisementsResponse;
      return advertisementsResponse;
    }

    return lastGoodAdsRef.current;
  }, [advertisementsResponse]);

  const sponsors = useMemo(() => {
    if (Array.isArray(sponsorsResponse)) {
      lastGoodSponsorsRef.current = sponsorsResponse;
      return sponsorsResponse;
    }

    return lastGoodSponsorsRef.current;
  }, [sponsorsResponse]);

  const anyFeedErrored = campaignsErrored || donationsErrored || advertisementsErrored || sponsorsErrored;
  const hasFallbackData = campaigns.length > 0 || donations.length > 0;

  const activeCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.isActive && !campaign.isClosed)
      || campaigns.find((campaign) => campaign.isActive)
      || campaigns[0]
      || null,
    [campaigns]
  );

  const latestDonation = useMemo(() => {
    if (!donations.length) {
      return null;
    }

    return [...donations]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0] || null;
  }, [donations]);

  const highlightedCampaign = useMemo(() => {
    if (latestDonation?.campaignId != null) {
      const byId = campaigns.find((campaign) => String(campaign.id) === String(latestDonation.campaignId));
      if (byId) {
        return byId;
      }
    }

    if (latestDonation?.campaignName) {
      const byName = campaigns.find(
        (campaign) => String(campaign.name || '').toLowerCase() === String(latestDonation.campaignName || '').toLowerCase()
      );
      if (byName) {
        return byName;
      }
    }

    return activeCampaign;
  }, [activeCampaign, campaigns, latestDonation?.campaignId, latestDonation?.campaignName]);

  const spotlightCampaigns = useMemo(() => {
    const active = campaigns.filter((campaign) => campaign.isActive && !campaign.isClosed);
    if (active.length > 0) {
      return active;
    }

    const activeFallback = campaigns.filter((campaign) => campaign.isActive);
    if (activeFallback.length > 0) {
      return activeFallback;
    }

    return campaigns;
  }, [campaigns]);

  const [spotlightIndex, setSpotlightIndex] = useState(0);

  useEffect(() => {
    setProjectorMode(projectorFromQuery);
  }, [projectorFromQuery]);

  useEffect(() => {
    if (!spotlightCampaigns.length) {
      setSpotlightIndex(0);
      return;
    }

    setSpotlightIndex((current) => current % spotlightCampaigns.length);
  }, [spotlightCampaigns]);

  useEffect(() => {
    if (spotlightCampaigns.length <= 1) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % spotlightCampaigns.length);
    }, CAMPAIGN_SPOTLIGHT_INTERVAL_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [spotlightCampaigns]);

  const spotlightCampaign = useMemo(() => {
    if (spotlightCampaigns.length > 0) {
      return spotlightCampaigns[spotlightIndex] || spotlightCampaigns[0];
    }

    return highlightedCampaign;
  }, [highlightedCampaign, spotlightCampaigns, spotlightIndex]);

  const campaignDonations = useMemo(() => {
    if (!spotlightCampaign) {
      return [];
    }

    return donations.filter((entry) => String(entry.campaignId) === String(spotlightCampaign.id));
  }, [donations, spotlightCampaign]);

  const latestSpotlightDonation = useMemo(() => {
    if (!campaignDonations.length) {
      return null;
    }

    return [...campaignDonations]
      .sort((left, right) => new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime())[0] || null;
  }, [campaignDonations]);

  const totalRaised = useMemo(() => {
    if (!spotlightCampaign) {
      return 0;
    }

    const byTransactions = campaignDonations.reduce((total, entry) => total + Number(entry.amount || 0), 0);
    return Math.max(Number(spotlightCampaign.raised || 0), byTransactions);
  }, [campaignDonations, spotlightCampaign]);

  const grandRaised = useMemo(
    () => campaigns.reduce((total, campaign) => total + Number(campaign.raised || 0), 0),
    [campaigns]
  );
  const totalCampaignTarget = useMemo(
    () => campaigns.reduce((total, campaign) => total + Number(campaign.target || 0), 0),
    [campaigns]
  );
  const overallCompletionPercent = useMemo(() => {
    if (totalCampaignTarget <= 0) {
      return 0;
    }

    return Math.min(100, Math.round((grandRaised / totalCampaignTarget) * 100));
  }, [grandRaised, totalCampaignTarget]);
  const rotatingKpis = useMemo(() => [
    {
      key: 'overall-raised',
      label: 'All Campaigns Raised',
      value: formatCurrency(grandRaised)
    },
    {
      key: 'overall-target',
      label: 'Combined Target',
      value: formatCurrency(totalCampaignTarget)
    },
    {
      key: 'overall-progress',
      label: 'Overall Completion',
      value: `${overallCompletionPercent}%`
    }
  ], [grandRaised, overallCompletionPercent, totalCampaignTarget]);
  const rotatingKpi = rotatingKpis[rotatingKpiIndex] || rotatingKpis[0];
  const quietModeActive = useMemo(() => {
    const hour = new Date(clockTickMs).getHours();
    return isWithinQuietWindow(hour, QUIET_MODE_START_HOUR, QUIET_MODE_END_HOUR);
  }, [clockTickMs]);
  const latestSyncMs = useMemo(
    () => Math.max(Number(campaignsUpdatedAt || 0), Number(donationsUpdatedAt || 0)),
    [campaignsUpdatedAt, donationsUpdatedAt]
  );
  const syncAgeSeconds = useMemo(() => {
    if (!latestSyncMs) {
      return null;
    }

    return Math.max(0, Math.floor((clockTickMs - latestSyncMs) / 1000));
  }, [clockTickMs, latestSyncMs]);
  const syncStatus = useMemo(() => {
    if (syncAgeSeconds == null) {
      return { label: 'Waiting', dotClass: 'bg-slate-400' };
    }

    if (syncAgeSeconds <= 15) {
      return { label: `Live ${syncAgeSeconds}s`, dotClass: 'bg-emerald-400' };
    }

    if (syncAgeSeconds <= 45) {
      return { label: `${syncAgeSeconds}s old`, dotClass: 'bg-amber-300' };
    }

    return { label: `${syncAgeSeconds}s old`, dotClass: 'bg-red-400' };
  }, [syncAgeSeconds]);

  useEffect(() => {
    if (rotatingKpis.length <= 1) {
      setRotatingKpiIndex(0);
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setRotatingKpiIndex((current) => (current + 1) % rotatingKpis.length);
    }, BIG_KPI_ROTATION_MS);

    return () => {
      window.clearInterval(timerId);
    };
  }, [rotatingKpis.length]);

  useEffect(() => {
    const driftOffsets = 4;
    const timerId = window.setInterval(() => {
      setBurnInDriftIndex((current) => (current + 1) % driftOffsets);
    }, 90000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);
  const todayDayKey = useMemo(() => getLocalDayKey(Date.now()), []);
  const todaysDonations = useMemo(
    () => donations.filter((entry) => getLocalDayKey(entry.createdAt) === todayDayKey),
    [donations, todayDayKey]
  );
  const todaysCommunityTotal = useMemo(
    () => todaysDonations.reduce((total, entry) => total + toAmountNumber(entry.amount), 0),
    [todaysDonations]
  );
  const todaysDonorCount = useMemo(() => {
    const donorSet = new Set();
    todaysDonations.forEach((entry) => {
      const email = String(entry.donorEmail || '').trim().toLowerCase();
      const name = String(entry.donorName || '').trim().toLowerCase();
      donorSet.add(email || name || String(entry.id));
    });
    return donorSet.size || todaysDonations.length;
  }, [todaysDonations]);
  const otherCampaigns = useMemo(
    () => campaigns.filter((campaign) => String(campaign.id) !== String(spotlightCampaign?.id)).slice(0, 6),
    [campaigns, spotlightCampaign?.id]
  );
  const campaignRailItems = useMemo(() => {
    if (!campaigns.length) {
      return [];
    }

    // Build a longer base sequence so each animated track always exceeds viewport width.
    const repeats = Math.max(2, Math.ceil(10 / campaigns.length));
    return Array.from({ length: repeats }, () => campaigns).flat();
  }, [campaigns]);

  const partnerTickerItems = useMemo(() => {
    const nowMs = Date.now();

    const activeAds = advertisements
      .filter((entry) => entry?.active && String(entry?.bannerUrl || '').trim())
      .map((entry) => ({
        id: `ad-${entry.id}`,
        label: String(entry.title || '').trim() || 'Website Advertiser',
        imageUrl: String(entry.bannerUrl || '').trim(),
        type: 'Advertiser'
      }));

    const activeSponsors = sponsors
      .filter((entry) => {
        if (!entry?.active) {
          return false;
        }

        if (!String(entry.bannerUrl || '').trim()) {
          return false;
        }

        if (!entry.expiryDate) {
          return true;
        }

        const expiry = new Date(entry.expiryDate).getTime();
        return Number.isFinite(expiry) && expiry >= nowMs;
      })
      .map((entry) => ({
        id: `sponsor-${entry.id}`,
        label: String(entry.title || '').trim() || 'Proud Sponsor',
        imageUrl: String(entry.bannerUrl || '').trim(),
        type: 'Sponsor'
      }));

    const base = [...activeSponsors, ...activeAds];
    if (!base.length) {
      return [];
    }

    const repeats = Math.max(2, Math.ceil(14 / base.length));
    return Array.from({ length: repeats }, () => base).flat();
  }, [advertisements, sponsors]);

  const donationUrl = useMemo(() => {
    const configuredBase = String(process.env.REACT_APP_DONATION_PUBLIC_URL || '').trim();
    const root = configuredBase || window.location.origin;
    const normalizedRoot = root.endsWith('/') ? root.slice(0, -1) : root;
    return `${normalizedRoot}/donation`;
  }, []);

  const qrImageUrl = useMemo(() => {
    const endpoint = 'https://api.qrserver.com/v1/create-qr-code/';
    const query = new URLSearchParams({
      size: '620x620',
      margin: '8',
      data: donationUrl
    });

    return `${endpoint}?${query.toString()}`;
  }, [donationUrl]);

  const progressPercent = useMemo(() => {
    if (!spotlightCampaign?.target) {
      return 0;
    }

    return Math.min(100, Math.round((totalRaised / Number(spotlightCampaign.target)) * 100));
  }, [spotlightCampaign?.target, totalRaised]);

  const amountToGoal = useMemo(() => {
    const target = Number(spotlightCampaign?.target || 0);
    if (target <= 0) {
      return null;
    }

    return Math.max(0, target - totalRaised);
  }, [spotlightCampaign?.target, totalRaised]);

  useEffect(() => {
    const raisedIncreased = grandRaised > snapshot.raised;
    const donorsIncreased = donations.length > snapshot.donors;

    if ((raisedIncreased || donorsIncreased) && !quietModeActive) {
      const timestamp = Date.now();
      const topBurst = Array.from({ length: 95 }, (_, index) => ({
        id: `${timestamp}-top-${index}`,
        top: '-2%',
        left: `${Math.random() * 100}%`,
        delay: `${Math.random() * 0.22}s`,
        duration: `${1.5 + Math.random() * 1.2}s`,
        scale: `${0.7 + Math.random() * 1}`,
        tx: `${-70 + Math.random() * 140}px`,
        ty: `${82 + Math.random() * 30}vh`,
        rot: `${180 + Math.random() * 540}deg`
      }));
      const nextBursts = topBurst;
      setConfettiBursts(nextBursts);

      if (burstTimerRef.current) {
        window.clearTimeout(burstTimerRef.current);
      }

      burstTimerRef.current = window.setTimeout(() => {
        setConfettiBursts([]);
      }, 2900);
    }

    setSnapshot({
      raised: grandRaised,
      donors: donations.length
    });
  }, [donations.length, grandRaised, quietModeActive, snapshot.donors, snapshot.raised]);

  useEffect(() => () => {
    if (burstTimerRef.current) {
      window.clearTimeout(burstTimerRef.current);
    }
  }, []);

  useEffect(() => {
    // Keep donation rows in lockstep with campaign total updates.
    void refetchDonations();
  }, [campaignsUpdatedAt, refetchDonations]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsBrowserFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleBrowserFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        return;
      }

      const target = document.documentElement;
      if (target?.requestFullscreen) {
        await target.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen API errors (browser policy or unsupported environments).
    }
  };

  const lastUpdatedAt = useMemo(() => {
    const latest = Math.max(Number(campaignsUpdatedAt || 0), Number(donationsUpdatedAt || 0));
    if (!latest) {
      return '--';
    }

    return new Date(latest).toLocaleTimeString();
  }, [campaignsUpdatedAt, donationsUpdatedAt]);

  const palette = useMemo(() => hashCampaignPalette(spotlightCampaign?.name), [spotlightCampaign?.name]);
  const burnInDriftStyle = useMemo(() => {
    const offsets = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: -1, y: 0 }
    ];
    const next = offsets[burnInDriftIndex] || offsets[0];
    return {
      transform: `translate3d(${next.x}px, ${next.y}px, 0)`
    };
  }, [burnInDriftIndex]);

  return (
    <>
      <Seo {...meta} />
      <div className={`relative h-screen overflow-hidden bg-[#05080e] text-slate-100 ${projectorMode ? 'contrast-125 saturate-110' : ''} ${quietModeActive ? 'saturate-95' : ''}`}>
        <style>{`
          @keyframes board-fade-up {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @keyframes board-confetti-fall {
            0% { opacity: 0; transform: translate3d(0, 0, 0) rotate(0deg) scale(var(--scale, 1)); }
            10% { opacity: 1; }
            100% { opacity: 0; transform: translate3d(var(--tx, 0), var(--ty, 100vh), 0) rotate(var(--rot, 360deg)) scale(var(--scale, 1)); }
          }

          @keyframes board-campaign-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          @keyframes board-partner-marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }

          .board-fade-up {
            animation: board-fade-up 550ms ease-out both;
          }

          .board-confetti {
            animation: board-confetti-fall var(--duration, 1.4s) ease-in forwards;
            animation-delay: var(--delay, 0s);
          }

          .board-campaign-marquee {
            animation: board-campaign-marquee 52s linear infinite;
            will-change: transform;
          }

          .board-partner-marquee {
            animation: board-partner-marquee 48s linear infinite;
            will-change: transform;
          }
        `}</style>

        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(10,77,159,0.26),transparent_46%),radial-gradient(ellipse_at_bottom_right,rgba(245,166,35,0.14),transparent_44%)]" />
          <div className="absolute left-1/2 top-1/2 h-[72vmax] w-[72vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-saffron/10" />
          <div className="absolute left-1/2 top-1/2 h-[58vmax] w-[58vmax] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brand-blue/15" />
          <div className="absolute right-8 top-8 opacity-10 md:right-14 md:top-10">
            <img src={gurdwaraLogo} alt="" aria-hidden="true" className="h-44 w-44 rounded-full border border-brand-saffron/30 object-cover md:h-56 md:w-56" />
          </div>
        </div>

        {confettiBursts.length > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-40 overflow-hidden">
            {confettiBursts.map((piece, index) => (
              <span
                key={piece.id}
                className="board-confetti absolute h-3 w-2 rounded"
                style={{
                  top: piece.top,
                  left: piece.left,
                  backgroundColor: ['#f97316', '#22d3ee', '#fde047', '#38bdf8', '#f43f5e'][index % 5],
                  '--delay': piece.delay,
                  '--duration': piece.duration,
                  '--scale': piece.scale,
                  '--tx': piece.tx,
                  '--ty': piece.ty,
                  '--rot': piece.rot
                }}
              />
            ))}
          </div>
        ) : null}

        <main style={burnInDriftStyle} className={`relative z-10 mx-auto flex h-full w-full max-w-[1500px] flex-col p-3 sm:p-4 lg:p-5 ${isPresentationFullscreen ? 'pt-3' : 'pt-8'}`}>
          <header className="mb-1 border-b border-white/10 pb-1.5">
            {anyFeedErrored && hasFallbackData ? (
              <div className="mb-2 rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-100">
                Reconnecting to live feed. Showing last available board data.
              </div>
            ) : null}
            <div className={`grid items-center gap-2 ${isPresentationFullscreen ? 'md:grid-cols-[1fr_auto]' : 'md:grid-cols-[1fr_auto_1fr]'}`}>
              <div className="flex items-center gap-2.5 md:justify-self-stretch">
                <img src={gurdwaraLogo} alt="Singh Sabha Milton Gurdwara logo" className="h-14 w-14 rounded-full border border-brand-saffron/70 object-cover sm:h-16 sm:w-16" />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand-saffron">{siteConfig.shortName}</p>
                  <h1 className={`font-semibold text-white ${projectorMode ? 'text-3xl sm:text-4xl' : 'text-2xl sm:text-3xl'}`}>Live Donation Display Board</h1>
                </div>
              </div>

              <div className={`rounded-xl border border-brand-saffron/30 bg-slate-900/65 px-4 py-2 shadow-[0_0_0_1px_rgba(245,166,35,0.08)] ${isPresentationFullscreen ? 'md:justify-self-end' : 'md:justify-self-center'}`}>
                <div className="flex items-center gap-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-saffron">Community Total Today</p>
                    <p className="text-2xl font-extrabold text-white">{formatCurrency(todaysCommunityTotal)}</p>
                  </div>
                  <div className="h-10 w-px bg-white/20" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Donors Today</p>
                    <p className="text-2xl font-extrabold text-white">{todaysDonorCount}</p>
                  </div>
                  <div className="h-10 w-px bg-white/20" />
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-200">{rotatingKpi?.label}</p>
                    <p className="text-xl font-extrabold text-white">{rotatingKpi?.value}</p>
                  </div>
                </div>
              </div>

              {!isPresentationFullscreen ? (
                <div className="flex items-center gap-2 md:justify-self-end">
                  <button type="button" onClick={() => setProjectorMode((current) => !current)} className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${projectorMode ? 'border-cyan-300/40 bg-cyan-300/10 text-cyan-100 hover:bg-cyan-300/20' : 'border-white/20 bg-white/10 text-white/90 hover:bg-white/20'}`}>
                    {projectorMode ? 'Projector On' : 'Projector Off'}
                  </button>
                  <Link to="/admin/donations" className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/90 hover:bg-white/20">
                    Back To Admin
                  </Link>
                  <button type="button" onClick={() => void toggleBrowserFullscreen()} className="rounded-lg bg-brand-saffron px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-300">
                    {isBrowserFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                  </button>
                </div>
              ) : null}
            </div>
            <div className="hidden pb-2 pt-4 md:block" aria-hidden="true">
              <span className="block h-px w-full bg-gradient-to-r from-white/55 via-white/30 to-white/10" />
            </div>
            <div className="mt-1">
              <div className="flex items-center justify-between text-[10px] text-brand-saffron">
                <span>{formatCurrency(grandRaised)} / {formatCurrency(totalCampaignTarget)}</span>
                <span className="text-[9px] text-slate-300">{overallCompletionPercent}%</span>
              </div>
              <div className="mt-1 h-1 w-full bg-white/15">
                <div className="h-1 bg-brand-saffron transition-all duration-700" style={{ width: `${overallCompletionPercent}%` }} />
              </div>
            </div>
            {campaignRailItems.length > 0 ? (
              <div className="mt-3 overflow-hidden rounded-xl border border-white/10 bg-slate-900/45">
                <div className="board-campaign-marquee flex w-max flex-nowrap items-stretch py-1.5" style={{ animationDuration: quietModeActive ? '86s' : '52s' }}>
                  {[0, 1].map((groupIndex) => (
                    <div key={`marquee-group-${groupIndex}`} className="flex shrink-0 items-stretch gap-2" aria-hidden={groupIndex === 1}>
                      {campaignRailItems.map((campaign) => {
                        const target = Number(campaign.target || 0);
                        const raised = Number(campaign.raised || 0);
                        const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;

                        return (
                          <div key={`${campaign.id}-marquee-${groupIndex}`} className="min-w-[210px] rounded-lg border border-white/10 bg-slate-950/55 px-2.5 py-1.5">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-extrabold text-white">{campaign.name}</p>
                              <span className="text-[11px] font-extrabold text-cyan-100">{pct}%</span>
                            </div>
                            <p className="mt-0.5 text-xs font-semibold text-slate-300 sm:text-sm">{formatCurrency(raised)} / {formatCurrency(target)}</p>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            
          </header>

          <div className="grid flex-1 gap-3 overflow-hidden lg:grid-cols-[1.1fr_1fr]">
            <section className="board-fade-up flex min-h-0 flex-col rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur sm:p-4" style={{ animationDelay: '50ms' }}>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Scan To Donate</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">Choose Campaign On Your Phone</h2>
                  <p className="mt-1 break-all text-xs text-slate-200">http://localhost:3001/donation</p>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full border border-brand-saffron/30 bg-brand-saffron/10 px-3 py-1 text-xs font-semibold text-brand-saffron">
                  <QrCodeIcon className="h-4 w-4" />
                  Live
                </span>
              </div>

              <div className="mx-auto mt-2 flex w-full max-w-[440px] flex-1 items-start justify-center pb-3 sm:max-w-[520px]">
                <img src={qrImageUrl} alt="Donation QR Code" className="aspect-square w-full max-h-[42vh] object-contain" />
              </div>
            </section>

            <section className="min-h-0 overflow-hidden">
              <article className="board-fade-up flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur sm:p-5" style={{ animationDelay: '120ms' }}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100">Campaign Spotlight</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                      <span className={`h-2 w-2 rounded-full ${syncStatus.dotClass}`} />
                      {syncStatus.label}
                    </span>
                    {quietModeActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-300/20 bg-slate-300/10 px-2.5 py-1 text-[10px] font-semibold text-slate-200">
                        Quiet Mode
                      </span>
                    ) : null}
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/35 bg-amber-300/10 px-3 py-1 text-xs font-semibold text-amber-100">
                      Rotates Every 15s
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-300">Last updated: {lastUpdatedAt}</p>

                <h3 className="mt-3 text-xl font-semibold text-white">{spotlightCampaign?.name || 'Waiting for donations'}</h3>
                <p className="mt-2 line-clamp-2 text-xs text-slate-300">{spotlightCampaign?.description || 'Donors can choose any campaign after scanning the QR code. Campaign spotlight rotates while all totals keep updating live.'}</p>

                <div className="mt-4 rounded-2xl border border-brand-saffron/25 bg-brand-saffron/10 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-brand-saffron">Most Recent Gift</p>
                  <p className="mt-1 text-lg font-semibold text-white">
                    {latestSpotlightDonation ? formatCurrency(latestSpotlightDonation.amount || 0) : formatCurrency(0)}
                  </p>
                  <p className="text-[11px] text-slate-200">
                    {latestSpotlightDonation
                      ? `${latestSpotlightDonation.campaignName || spotlightCampaign?.name || 'Campaign'} • ${new Date(latestSpotlightDonation.createdAt || Date.now()).toLocaleTimeString()}`
                      : 'New donations will appear here automatically.'}
                  </p>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Raised</p>
                    <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(totalRaised)}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Target</p>
                    <p className="mt-1 text-xl font-semibold text-white">{formatCurrency(spotlightCampaign?.target || 0)}</p>
                  </div>
                  <div className="rounded-2xl border border-brand-saffron/25 bg-brand-saffron/10 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-brand-saffron">Need To Goal</p>
                    <p className="mt-1 text-xl font-extrabold text-white">{amountToGoal == null ? 'Open Goal' : formatCurrency(amountToGoal)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-900/45 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">Other Campaigns Live</p>
                    <p className="text-[10px] font-semibold text-slate-300">{otherCampaigns.length} shown</p>
                  </div>
                  {otherCampaigns.length > 0 ? (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {otherCampaigns.map((campaign) => {
                        const raised = Number(campaign.raised || 0);
                        const target = Number(campaign.target || 0);
                        const pct = target > 0 ? Math.min(100, Math.round((raised / target) * 100)) : 0;
                        const nearGoal = pct >= 90 && pct < 100;
                        const funded = pct >= 100;
                        return (
                          <div key={`other-campaign-${campaign.id}`} className="rounded-xl border border-white/10 bg-slate-950/55 px-2.5 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-xs font-bold text-white">{campaign.name}</p>
                              {nearGoal ? <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-200">Urgent</span> : null}
                              {funded ? <span className="rounded-full bg-emerald-300/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-200">Funded</span> : null}
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-300">{formatCurrency(raised)} / {formatCurrency(target)}</p>
                            <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
                              <div className="h-1.5 rounded-full bg-gradient-to-r from-cyan-300 to-brand-saffron" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-300">No additional campaigns to show yet.</p>
                  )}
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-200">
                    <span>Completion</span>
                    <span className="font-semibold" style={{ color: palette.primary }}>{progressPercent}%</span>
                  </div>
                  <div className="h-3 rounded-full bg-white/10">
                    <div className="h-3 rounded-full transition-all duration-700" style={{ width: `${progressPercent}%`, backgroundColor: palette.primary }} />
                  </div>
                </div>
              </article>
            </section>
          </div>

          {partnerTickerItems.length > 0 ? (
            <div className="mt-3 overflow-hidden rounded-xl border border-brand-saffron/20 bg-slate-900/60">
              <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-brand-saffron">Proud Sponsors And Advertisers</div>
              <div className="board-partner-marquee flex w-max flex-nowrap items-stretch py-2" style={{ animationDuration: quietModeActive ? '70s' : '48s' }}>
                {[0, 1].map((groupIndex) => (
                  <div key={`partner-marquee-group-${groupIndex}`} className="flex shrink-0 items-stretch gap-2 px-2" aria-hidden={groupIndex === 1}>
                    {partnerTickerItems.map((entry, index) => (
                      <div key={`${entry.id}-partner-marquee-${groupIndex}-${index}`} className="min-w-[260px] overflow-hidden rounded-lg border border-white/10 bg-slate-950/75">
                        <img src={entry.imageUrl} alt={entry.label} className="h-16 w-[260px] object-cover" loading="lazy" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <footer className="mt-3 board-fade-up flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2 text-[11px] text-slate-300" style={{ animationDelay: '320ms' }}>
            <p className="inline-flex items-center gap-1.5"><HeartIcon className="h-4 w-4 text-brand-saffron" /> Powered by sangat generosity</p>
            <p className="inline-flex items-center gap-1.5"><PresentationChartLineIcon className="h-4 w-4 text-cyan-300" /> {siteConfig.name}</p>
          </footer>
        </main>
      </div>
    </>
  );
};

export default DonationDisplayBoardPage;
