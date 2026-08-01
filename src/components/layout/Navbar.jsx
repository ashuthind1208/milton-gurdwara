import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import Hls from 'hls.js';
import {
  Bars3Icon,
  XMarkIcon,
  MagnifyingGlassIcon,
  PauseIcon,
  PlayIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,
  HomeIcon,
  InformationCircleIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  HandRaisedIcon,
  GiftIcon,
  PhotoIcon,
  PhoneIcon,
  FilmIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon,
  HeartIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { publicNav } from '../../constants/navigation';
import { siteConfig } from '../../constants/siteConfig';
import gurdwaraLogo from '../../assets/gurdwara-logo.webp';
import notoSansGurmukhiRegular from '../../assets/fonts/NotoSansGurmukhi-Regular.ttf';
import notoSansGurmukhiBold from '../../assets/fonts/NotoSansGurmukhi-Bold.ttf';
import { getNanakshahiDate, getNanakshahiMonthCalendar, getUpcomingPunjabiObservances } from '../../utils/punjabiCalendar';
import streamingService from '../../services/streamingService';
import nanakshahiHolidayService from '../../services/nanakshahiHolidayService';
import sponsorService from '../../services/sponsorService';
import advertisementService from '../../services/advertisementService';
import eventService from '../../services/eventService';
import volunteerService from '../../services/volunteerService';
import donationService from '../../services/donationService';
import uploadService from '../../services/uploadService';
import userService from '../../services/userService';
import addressLookupService from '../../services/addressLookupService';
import { useAuth } from '../../context/AuthContext';
import { formatTenDigitPhone, isTenDigitPhone } from '../../utils/phone';
import StreamingModal from '../common/StreamingModal';
import AudioPillPlayer from '../common/AudioPillPlayer';
import GlobalSearchBar from '../common/GlobalSearchBar';

const navClass = ({ isActive }) =>
  `border-b-[3px] px-3 py-2.5 text-base font-semibold tracking-tight transition ${isActive ? 'border-brand-saffron text-white' : 'border-transparent text-blue-100 hover:border-blue-200/70 hover:text-white'}`;

const compactNavClass = ({ isActive }) =>
  `border-b-[2px] px-2.5 py-2 text-[13px] font-bold tracking-tight text-blue-100 transition ${isActive ? 'border-brand-saffron text-white' : 'border-transparent hover:border-blue-200/50 hover:text-white'}`;

const mobileDrawerNavClass = ({ isActive }) =>
  `rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${isActive ? 'border-brand-blue/45 bg-brand-blue/10 text-brand-blue' : 'border-slate-200 bg-white text-slate-800 hover:border-brand-blue/35 hover:text-brand-blue'}`;

const iconClass = 'h-4.5 w-4.5';
const streamGlyphClass = 'h-6 w-6';
const NANAKSHAHI_WEEKDAY_LABELS_PA = ['ਐ', 'ਸੋ', 'ਮੰ', 'ਬੁੱ', 'ਵੀ', 'ਸ਼ੁੱ', 'ਸ਼ੱ'];
const CALENDAR_NAV_DAY_MS = 24 * 60 * 60 * 1000;
const PDF_HEADER_BG = [0, 64, 129];
const COMPACT_ENTER_SCROLL_Y = 72;
const COMPACT_EXIT_SCROLL_Y = 36;
const COMPACT_TOGGLE_COOLDOWN_MS = 220;
const PDF_HOLIDAY_PILL_PALETTE = [
  { bg: [220, 252, 231], text: [22, 101, 52] },
  { bg: [254, 243, 199], text: [146, 64, 14] },
  { bg: [237, 233, 254], text: [91, 33, 182] },
  { bg: [224, 242, 254], text: [3, 105, 161] },
  { bg: [255, 228, 230], text: [159, 18, 57] },
  { bg: [254, 249, 195], text: [133, 77, 14] },
  { bg: [226, 232, 240], text: [30, 41, 59] },
  { bg: [240, 253, 244], text: [21, 128, 61] }
];

const getPdfEventTone = (type = '') => {
  const token = String(type || '').toLowerCase();
  if (token.includes('puranmashi')) return { bg: [254, 249, 195], text: [146, 64, 14] };
  if (token.includes('gurpurab') || token.includes('gurgaddi') || token.includes('joti jot') || token.includes('prakash') || token.includes('birth') || token.includes('birthday') || token.includes('holiday')) return { bg: [254, 243, 199], text: [146, 64, 14] };
  if (token.includes('masya') || token.includes('massia')) return { bg: [237, 233, 254], text: [91, 33, 182] };
  if (token.includes('sangrand')) return { bg: [254, 243, 199], text: [146, 64, 14] };
  if (token.includes('shaheedi')) return { bg: [255, 232, 238], text: [159, 18, 57] };
  return { bg: [220, 252, 231], text: [22, 101, 52] };
};

const getToneHash = (value = '') => {
  const token = String(value || 'x');
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = ((hash << 5) - hash) + token.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
};

const getPdfHolidayPillTone = (event = {}) => {
  const token = String(event?.type || '').toLowerCase();
  if (token.includes('massia') || token.includes('masya')) return { bg: [237, 233, 254], text: [91, 33, 182] };
  if (token.includes('puranmashi')) return { bg: [254, 249, 195], text: [146, 64, 14] };

  const key = `${event?.id || ''}-${event?.titlePa || event?.title || ''}`;
  const toneIndex = getToneHash(key) % PDF_HOLIDAY_PILL_PALETTE.length;
  return PDF_HOLIDAY_PILL_PALETTE[toneIndex];
};

const formatGregorianLabel = (date) => new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: '2-digit',
  year: 'numeric'
}).format(date);

const formatGregorianMiniLabel = (date) => {
  const [month, day] = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit'
  }).format(date).split(' ');
  return `${month}, ${day}`;
};

const formatCompactDonationTotal = (value) => {
  const amount = Number(value) || 0;
  const absAmount = Math.abs(amount);

  if (absAmount >= 1000) {
    const inThousands = amount / 1000;
    const fractionDigits = Math.abs(inThousands) >= 100 ? 0 : 1;
    return `$${inThousands.toFixed(fractionDigits)}K`;
  }

  return `$${amount.toFixed(2)}`;
};

const toDateKey = (value) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const day = String(parsed.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseTimeTokenToMinutes = (token) => {
  const raw = String(token || '').trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return null;
  }

  let hour = Number(match[1]);
  const minute = Number(match[2] || '0');
  const meridiem = String(match[3] || '').toLowerCase();

  if (!Number.isFinite(hour) || !Number.isFinite(minute) || minute < 0 || minute > 59) {
    return null;
  }

  if (meridiem) {
    if (hour < 1 || hour > 12) {
      return null;
    }
    if (meridiem === 'am') {
      hour = hour % 12;
    } else {
      hour = (hour % 12) + 12;
    }
  } else if (hour > 23) {
    return null;
  }

  return hour * 60 + minute;
};

const extractRangeEndMinutes = (value) => {
  const raw = String(value || '').trim();
  if (!raw) {
    return null;
  }

  const parts = raw.split(/\s*-\s*/);
  if (parts.length < 2) {
    return null;
  }

  const endRaw = parts[parts.length - 1] || '';
  const startRaw = parts[0] || '';
  const endHasMeridiem = /\b(am|pm)\b/i.test(endRaw);
  const startMeridiemMatch = startRaw.match(/\b(am|pm)\b/i);
  const normalizedEnd = endHasMeridiem || !startMeridiemMatch
    ? endRaw
    : `${endRaw} ${startMeridiemMatch[1]}`;

  return parseTimeTokenToMinutes(normalizedEnd);
};

const nowLocalMinutes = () => {
  const now = new Date();
  return (now.getHours() * 60) + now.getMinutes();
};

const isEventAvailable = (event, now = Date.now()) => {
  const endStamp = Number.isNaN(new Date(event?.endDate || event?.end).getTime())
    ? null
    : new Date(event?.endDate || event?.end).getTime();
  const startStamp = Number.isNaN(new Date(event?.date).getTime()) ? null : new Date(event?.date).getTime();
  const referenceStamp = Number.isFinite(endStamp) ? endStamp : startStamp;

  if (!Number.isFinite(referenceStamp)) {
    return true;
  }

  return referenceStamp >= now;
};

const toBase64FromArrayBuffer = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return window.btoa(binary);
};

const truncatePdfText = (value = '', max = 30) => (value.length > max ? `${value.slice(0, max - 1)}...` : value);

const toIsoDateKeyFromDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const resolveObservanceTypeKey = (type = '') => {
  const token = String(type || '').toLowerCase();
  if (token.includes('puranmashi') || token.includes('pooranmashi') || token.includes('pooranmasi')) return 'puranmashi';
  if (token.includes('masya') || token.includes('massia') || token.includes('maseya') || token.includes('masseya')) return 'massia';
  if (token.includes('gurpurab')) return 'gurpurab';
  if (token.includes('joti jot')) return 'joti-jot';
  if (token.includes('gurgaddi')) return 'gurgaddi';
  if (token.includes('prakash') || token.includes('parkash')) return 'prakash';
  if (token.includes('shaheedi')) return 'shaheedi';
  if (token.includes('sangrand')) return 'sangrand';
  if (token.includes('historical') || token.includes('history')) return 'historical';
  if (token.includes('festival') || token.includes('celebration') || token.includes('holiday') || token.includes('birth') || token.includes('birthday')) return 'festival';
  return 'default';
};

const getObservanceTypeStyles = (type = '') => {
  const key = resolveObservanceTypeKey(type);
  const palette = {
    puranmashi: {
      cell: 'ring-1 ring-yellow-300/70 bg-yellow-100 text-yellow-900',
      badge: 'bg-yellow-100 text-yellow-900 ring-1 ring-yellow-300/70',
      title: 'text-yellow-900',
      dot: 'bg-yellow-500',
      gradient: '#facc15'
    },
    massia: {
      cell: 'ring-1 ring-violet-300/70 bg-violet-100 text-violet-900',
      badge: 'bg-violet-100 text-violet-900 ring-1 ring-violet-300/70',
      title: 'text-violet-900',
      dot: 'bg-violet-500',
      gradient: '#a78bfa'
    },
    gurpurab: {
      cell: 'ring-1 ring-amber-300/70 bg-amber-100 text-amber-900',
      badge: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300/70',
      title: 'text-amber-900',
      dot: 'bg-amber-500',
      gradient: '#f59e0b'
    },
    'joti-jot': {
      cell: 'ring-1 ring-rose-300/70 bg-rose-100 text-rose-900',
      badge: 'bg-rose-100 text-rose-900 ring-1 ring-rose-300/70',
      title: 'text-rose-900',
      dot: 'bg-rose-500',
      gradient: '#fb7185'
    },
    gurgaddi: {
      cell: 'ring-1 ring-green-300/70 bg-green-100 text-green-900',
      badge: 'bg-green-100 text-green-900 ring-1 ring-green-300/70',
      title: 'text-green-900',
      dot: 'bg-green-500',
      gradient: '#22c55e'
    },
    prakash: {
      cell: 'ring-1 ring-orange-300/70 bg-orange-100 text-orange-900',
      badge: 'bg-orange-100 text-orange-900 ring-1 ring-orange-300/70',
      title: 'text-orange-900',
      dot: 'bg-orange-500',
      gradient: '#fb923c'
    },
    shaheedi: {
      cell: 'ring-1 ring-red-300/70 bg-red-100 text-red-900',
      badge: 'bg-red-100 text-red-900 ring-1 ring-red-300/70',
      title: 'text-red-900',
      dot: 'bg-red-500',
      gradient: '#ef4444'
    },
    sangrand: {
      cell: 'ring-1 ring-lime-300/70 bg-lime-100 text-lime-900',
      badge: 'bg-lime-100 text-lime-900 ring-1 ring-lime-300/70',
      title: 'text-lime-900',
      dot: 'bg-lime-500',
      gradient: '#84cc16'
    },
    historical: {
      cell: 'ring-1 ring-sky-300/70 bg-sky-100 text-sky-900',
      badge: 'bg-sky-100 text-sky-900 ring-1 ring-sky-300/70',
      title: 'text-sky-900',
      dot: 'bg-sky-500',
      gradient: '#38bdf8'
    },
    festival: {
      cell: 'ring-1 ring-fuchsia-300/70 bg-fuchsia-100 text-fuchsia-900',
      badge: 'bg-fuchsia-100 text-fuchsia-900 ring-1 ring-fuchsia-300/70',
      title: 'text-fuchsia-900',
      dot: 'bg-fuchsia-500',
      gradient: '#d946ef'
    },
    default: {
      cell: 'ring-1 ring-emerald-300/70 bg-emerald-100 text-emerald-900',
      badge: 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-300/70',
      title: 'text-emerald-900',
      dot: 'bg-emerald-500',
      gradient: '#10b981'
    }
  };

  return palette[key] || palette.default;
};

const observanceToneClass = (type = '') => getObservanceTypeStyles(type).cell;

const getObservanceGradientStyle = (observances = []) => {
  const uniqueTones = Array.from(new Map(
    observances.map((event) => [resolveObservanceTypeKey(event.type), getObservanceTypeStyles(event.type)])
  ).values());

  if (uniqueTones.length <= 1) {
    return null;
  }

  const step = 100 / uniqueTones.length;
  const stops = uniqueTones.map((tone, index) => {
    const start = (index * step).toFixed(2);
    const end = ((index + 1) * step).toFixed(2);
    return `${tone.gradient} ${start}% ${end}%`;
  }).join(', ');

  return {
    backgroundImage: `linear-gradient(135deg, ${stops})`,
    color: '#0f172a'
  };
};

const YouTubeGlyph = () => (
  <svg viewBox="0 0 24 24" className={streamGlyphClass} aria-hidden="true">
    <path d="M22 12c0 2.5-.3 4.2-.7 5.2a3.6 3.6 0 0 1-2 2C18.2 19.6 16.5 20 12 20s-6.2-.4-7.3-.8a3.6 3.6 0 0 1-2-2C2.3 16.2 2 14.5 2 12s.3-4.2.7-5.2a3.6 3.6 0 0 1 2-2C5.8 4.4 7.5 4 12 4s6.2.4 7.3.8a3.6 3.6 0 0 1 2 2c.4 1 .7 2.7.7 5.2Z" fill="none" stroke="currentColor" strokeWidth="1.8" />
    <path d="m10 9 5 3-5 3V9Z" fill="#f5a623" />
  </svg>
);

const LiveStreamGlyph = () => (
  <svg viewBox="0 0 24 24" className={streamGlyphClass} aria-hidden="true">
    <path d="M22 12c0 2.5-.3 4.2-.7 5.2a3.6 3.6 0 0 1-2 2C18.2 19.6 16.5 20 12 20s-6.2-.4-7.3-.8a3.6 3.6 0 0 1-2-2C2.3 16.2 2 14.5 2 12s.3-4.2.7-5.2a3.6 3.6 0 0 1 2-2C5.8 4.4 7.5 4 12 4s6.2.4 7.3.8a3.6 3.6 0 0 1 2 2c.4 1 .7 2.7.7 5.2Z" fill="#0a4d9f" />
    <path d="m10 9 5 3-5 3V9Z" fill="#ffffff" />
    <circle cx="19" cy="6.5" r="1.6" fill="#f5a623" />
  </svg>
);

const leftMenu = [
  { label: 'Home', path: '/', icon: HomeIcon },
  { label: 'About', path: '/about', icon: InformationCircleIcon },
  { label: 'Sikhism', path: '/sikhism', icon: BookOpenIcon },
  { label: 'Events', path: '/events', icon: CalendarDaysIcon }
];

const rightMenu = [
  { label: 'Library', path: '/library', icon: BookOpenIcon },
  { label: 'Videos', path: '/videos', icon: FilmIcon },
  { label: 'Seva', path: '/seva', icon: HandRaisedIcon },
  { label: 'Donation', path: '/donation', icon: GiftIcon },
  { label: 'Gallery', path: '/gallery', icon: PhotoIcon },
  { label: 'Contact', path: '/contact', icon: PhoneIcon }
];

const FULL_ACCESS_ROLES = new Set(['Super Admin', 'Admin']);
const PENDING_APPROVAL_MESSAGE = 'Access is pending till your status is approved by an admin.';

const resolveLandingPathByRole = () => '/';

const getAvatarFallbackUrl = (name = 'Member') => `https://ui-avatars.com/api/?name=${encodeURIComponent(String(name || 'Member'))}`;

const normalizeAvatarUrl = (rawValue = '', displayName = 'Member') => {
  const value = String(rawValue || '').trim();
  if (!value) {
    return getAvatarFallbackUrl(displayName);
  }

  if (/^(https?:)?\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:')) {
    return value;
  }

  if (value.startsWith('/')) {
    return value;
  }

  // Stored media paths may be relative (for example: uploads/users/avatar.jpg).
  return `/${value.replace(/^\/+/, '')}`;
};

const Navbar = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout, updateProfile, persistUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [compactStreamsOpen, setCompactStreamsOpen] = useState(false);
  const [isCompactProfileLanyardOpen, setIsCompactProfileLanyardOpen] = useState(false);
  const [dateInfoOpen, setDateInfoOpen] = useState(false);
  const [isDatePopoverOpen, setIsDatePopoverOpen] = useState(false);
  const [isProfilePopoverOpen, setIsProfilePopoverOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isProfileImageUploading, setIsProfileImageUploading] = useState(false);
  const [profileImageUploadProgress, setProfileImageUploadProgress] = useState(0);
  const [profileError, setProfileError] = useState('');
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    address: '',
    avatarUrl: ''
  });
  const [isMembershipModalOpen, setIsMembershipModalOpen] = useState(false);
  const [membershipPromptEnforced, setMembershipPromptEnforced] = useState(false);
  const [membershipPromptNotice, setMembershipPromptNotice] = useState('');
  const [membershipFormError, setMembershipFormError] = useState('');
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [isAddressSearching, setIsAddressSearching] = useState(false);
  const [addressSearchError, setAddressSearchError] = useState('');
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const selectedAddressRef = useRef('');
  const [membershipForm, setMembershipForm] = useState({
    phone: '',
    address: '',
    dateOfBirth: '',
    canadianStatus: '',
    donationMethod: '',
    donationSchedule: 'monthly',
    membershipPledgeAccepted: false,
    notes: ''
  });
  const [isPdfBusy, setIsPdfBusy] = useState(false);
  const [isKirtanPlaying, setIsKirtanPlaying] = useState(false);
  const [isKirtanLoading, setIsKirtanLoading] = useState(false);
  const [streamModalState, setStreamModalState] = useState({ open: false, id: '' });
  const [selectedNanakshahiDateKey, setSelectedNanakshahiDateKey] = useState(() => toDateKey(new Date()));
  const liveAudioRef = useRef(null);
  const kirtanHlsRef = useRef(null);
  const kirtanRetryTimeoutRef = useRef(null);
  const kirtanPlaybackRequestedRef = useRef(false);
  const kirtanPausedByUserRef = useRef(false);
  const kirtanReconnectInFlightRef = useRef(false);
  const datePopoverCloseTimeoutRef = useRef(null);
  const profilePopoverCloseTimeoutRef = useRef(null);
  const viewportResetTimeoutRef = useRef(null);
  const compactStreamsBackdropGuardRef = useRef(false);
  const compactLanyardBackdropGuardRef = useRef(false);
  const dateInfoBackdropGuardRef = useRef(false);
  const searchBackdropGuardRef = useRef(false);
  const compactStreamsBackdropGuardTimeoutRef = useRef(null);
  const compactLanyardBackdropGuardTimeoutRef = useRef(null);
  const dateInfoBackdropGuardTimeoutRef = useRef(null);
  const searchBackdropGuardTimeoutRef = useRef(null);
  const pdfFontCacheRef = useRef(null);
  const compactScrollRestoreRef = useRef(null);
  const compactRestoreFramesRef = useRef({ first: 0, second: 0 });
  const preserveCompactUntilRef = useRef(0);
  const compactToggleCooldownUntilRef = useRef(0);
  const isCompactRef = useRef(false);
  const lastScrollYRef = useRef(0);
  const mobileNanakshahiDetailsRef = useRef(null);
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());
  const nanakshahiDate = useMemo(() => getNanakshahiDate(new Date()), []);
  const calendarViewNanakshahiYear = useMemo(
    () => nanakshahiHolidayService.getNanakshahiYearFromDate(calendarViewDate),
    [calendarViewDate]
  );
  const { data: nanakshahiObservances = [] } = useQuery({
    queryKey: ['nanakshahi-holidays-window', calendarViewNanakshahiYear],
    queryFn: () => nanakshahiHolidayService.getHolidaysForDateWindow(calendarViewDate),
    staleTime: 12 * 60 * 60 * 1000,
    placeholderData: (previousData) => previousData
  });
  const nanakshahiMonthCalendar = useMemo(
    () => getNanakshahiMonthCalendar(calendarViewDate, nanakshahiObservances),
    [calendarViewDate, nanakshahiObservances]
  );
  const location = useLocation();
  const userEmail = String(user?.email || '').trim().toLowerCase();
  const userName = String(user?.name || '').trim().toLowerCase();
  const userPhone = String(user?.phone || '').trim().toLowerCase();
  const userPhoneDigits = userPhone.replace(/\D/g, '');
  const userDisplayName = String(user?.name || '').trim() || 'Sangat Member';
  const userDisplayEmail = String(user?.email || '').trim() || 'No email available';
  const rawUserAvatarUrl = user?.avatarUrl || user?.picture || user?.photoURL || '';
  const userAvatarUrl = normalizeAvatarUrl(rawUserAvatarUrl, userDisplayName);
  const userInitial = userDisplayName.charAt(0).toUpperCase() || 'S';
  const profilePhoneMissing = !String(user?.phone || '').trim();
  const approvalStatus = String(user?.approvalStatus || '').toLowerCase();
  const hasFullAccess = FULL_ACCESS_ROLES.has(String(user?.role || ''));
  const userRole = String(user?.role || '').trim();
  const assignedAdminPages = Array.isArray(user?.adminPageAccess)
    ? user.adminPageAccess.map((path) => String(path || '').trim()).filter(Boolean)
    : [];
  const hasRoleBasedAdminAccess = hasFullAccess || assignedAdminPages.length > 0;
  const canSeeAdminPortalButton = hasRoleBasedAdminAccess
    && approvalStatus === 'approved'
    && user?.isActive !== false;
  const isApprovalPending = isAuthenticated && userRole !== 'Family' && approvalStatus === 'pending';
  const membershipProfile = user?.membershipProfile && typeof user.membershipProfile === 'object' ? user.membershipProfile : {};
  const isMembershipProfileCompleted = membershipProfile.completed === true;
  const shouldShowPendingMembershipPrompt = isAuthenticated && isApprovalPending && isMembershipProfileCompleted && userRole === 'Member';
  const { data: familyEvents = [] } = useQuery({
    queryKey: ['navbar-family-events'],
    queryFn: () => eventService.getEvents().then((res) => res.data),
    enabled: isAuthenticated
  });
  const { data: familySeva = [] } = useQuery({
    queryKey: ['admin-volunteers', 'navbar'],
    queryFn: () => volunteerService.getApplications().then((res) => res.data),
    enabled: isAuthenticated
  });
  const { data: familySevaOpportunities = [] } = useQuery({
    queryKey: ['seva-opportunities', 'navbar', 'all-statuses'],
    queryFn: () => volunteerService.getSevaOpportunities({ includeInactive: true, includeClosed: true }).then((res) => res.data),
    enabled: isAuthenticated
  });
  const { data: familyDonations = [] } = useQuery({
    queryKey: ['navbar-family-donations'],
    queryFn: () => donationService.getDonations().then((res) => res.data),
    enabled: isAuthenticated
  });
  const { data: streamingItems = [] } = useQuery({
    queryKey: ['streaming-config'],
    queryFn: () => streamingService.getStreamingItems().then((res) => res.data)
  });
  const { data: sponsors = [] } = useQuery({
    queryKey: ['public-sponsors', 'pdf-banners'],
    queryFn: () => sponsorService.getSponsors().then((res) => res.data || []),
    staleTime: 12 * 60 * 60 * 1000
  });
  const { data: advertisements = [] } = useQuery({
    queryKey: ['public-advertisements', 'pdf-banners'],
    queryFn: () => advertisementService.getAds().then((res) => res.data || []),
    staleTime: 12 * 60 * 60 * 1000
  });
  const todayIso = useMemo(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);
  const todayGregorianKey = todayIso;
  const upcomingObservances = useMemo(
    () => getUpcomingPunjabiObservances(20, new Date(), nanakshahiObservances),
    [nanakshahiObservances]
  );
  const pdfBannerImageUrls = useMemo(() => {
    const sponsorBanners = (Array.isArray(sponsors) ? sponsors : [])
      .filter((entry) => entry?.active !== false && entry?.bannerUrl)
      .map((entry) => String(entry.bannerUrl || '').trim())
      .filter(Boolean);
    const advertisementBanners = (Array.isArray(advertisements) ? advertisements : [])
      .filter((entry) => entry?.active !== false && entry?.bannerUrl)
      .map((entry) => String(entry.bannerUrl || '').trim())
      .filter(Boolean);

    return [...sponsorBanners, ...advertisementBanners].slice(0, 8);
  }, [sponsors, advertisements]);

  useEffect(() => {
    const previousAnchorDate = new Date(calendarViewDate.getTime() - (32 * CALENDAR_NAV_DAY_MS));
    const nextAnchorDate = new Date(calendarViewDate.getTime() + (32 * CALENDAR_NAV_DAY_MS));
    const previousYear = nanakshahiHolidayService.getNanakshahiYearFromDate(previousAnchorDate);
    const nextYear = nanakshahiHolidayService.getNanakshahiYearFromDate(nextAnchorDate);

    queryClient.prefetchQuery({
      queryKey: ['nanakshahi-holidays-window', previousYear],
      queryFn: () => nanakshahiHolidayService.getHolidaysForDateWindow(previousAnchorDate),
      staleTime: 12 * 60 * 60 * 1000
    });

    queryClient.prefetchQuery({
      queryKey: ['nanakshahi-holidays-window', nextYear],
      queryFn: () => nanakshahiHolidayService.getHolidaysForDateWindow(nextAnchorDate),
      staleTime: 12 * 60 * 60 * 1000
    });
  }, [calendarViewDate, queryClient]);

  const leftMenuBalanced = useMemo(() => {
    const libraryFromRight = rightMenu.find((item) => item.path === '/library');
    return libraryFromRight ? [...leftMenu, libraryFromRight] : leftMenu;
  }, []);
  const rightMenuBalanced = useMemo(() => rightMenu.filter((item) => item.path !== '/library'), []);
  const compactMenuItems = useMemo(
    () => [...leftMenuBalanced, ...rightMenuBalanced].filter((item) => item.path !== '/'),
    [leftMenuBalanced, rightMenuBalanced]
  );
  const mobileMenuItems = useMemo(
    () => publicNav.filter((item) => item.path !== '/gurbani-library' && item.path !== '/faq' && item.path !== '/family-dashboard'),
    []
  );

  const renderNanakshahiCalendar = (compact = false) => (
    <div className={`overflow-visible rounded-2xl border border-brand-blue/35 bg-gradient-to-br from-blue-50 via-white to-amber-50 ${compact ? 'p-3 pb-24 sm:pb-28' : 'p-4 pb-24 sm:pb-28'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">ਨਾਨਕਸ਼ਾਹੀ ਮਹੀਨਾ</p>
          <p className="mt-1 text-lg font-bold text-brand-blue">{nanakshahiMonthCalendar.labelPa}</p>
          <p className="text-xs text-slate-600">{nanakshahiMonthCalendar.currentDayPa} {nanakshahiMonthCalendar.monthPa} {nanakshahiMonthCalendar.yearPa}</p>
        </div>
        <div className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-brand-blue">
          {nanakshahiDate.labelPa}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setCalendarViewDate(new Date(nanakshahiMonthCalendar.monthStartGregorian.getTime() - CALENDAR_NAV_DAY_MS))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-brand-blue/25 bg-white/90 text-sm font-bold text-brand-blue shadow-sm transition hover:border-brand-blue hover:bg-blue-50"
          aria-label="Previous Nanakshahi month"
          title="Previous Nanakshahi month"
        >
          &lt;
        </button>
        <button
          type="button"
          onClick={() => setCalendarViewDate(new Date(nanakshahiMonthCalendar.nextMonthStartGregorian.getTime()))}
          className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-brand-blue/25 bg-white/90 text-sm font-bold text-brand-blue shadow-sm transition hover:border-brand-blue hover:bg-blue-50"
          aria-label="Next Nanakshahi month"
          title="Next Nanakshahi month"
        >
          &gt;
        </button>
      </div>
      <div className="relative z-10 mt-3 grid grid-cols-7 gap-1 text-center">
        {NANAKSHAHI_WEEKDAY_LABELS_PA.map((label) => (
          <span key={label} className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
        ))}
        {nanakshahiMonthCalendar.weeks.flat().map((cell, index) => {
          if (!cell) {
            return <span key={`blank-${index}`} className="inline-flex h-8 items-center justify-center rounded-lg text-transparent">•</span>;
          }

          const primaryObservance = cell.observances[0] || null;
          const eventTone = primaryObservance ? observanceToneClass(primaryObservance.type) : '';
          const gradientStyle = cell.hasObservance ? getObservanceGradientStyle(cell.observances) : null;
          const hasMultiTypeGradient = Boolean(gradientStyle);
          const cellGregorianKey = `${cell.gregorianDate.getFullYear()}-${String(cell.gregorianDate.getMonth() + 1).padStart(2, '0')}-${String(cell.gregorianDate.getDate()).padStart(2, '0')}`;
          const isGregorianToday = cellGregorianKey === todayGregorianKey;
          const englishDateLabel = new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: '2-digit',
            year: 'numeric'
          }).format(cell.gregorianDate);
          const hasScrollableObservances = cell.observances.length > 2;
          const isSelectedNanakshahiDate = selectedNanakshahiDateKey === cellGregorianKey;

          const uniqueTypeDots = Array.from(new Map(
            cell.observances.map((event) => [resolveObservanceTypeKey(event.type), getObservanceTypeStyles(event.type)])
          ).values()).slice(0, 4);

          return (
            <button
              type="button"
              key={`${cell.day}-${cell.gregorianDate.toISOString()}`}
              onClick={(event) => {
                event.stopPropagation();
                setSelectedNanakshahiDateKey(cellGregorianKey);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedNanakshahiDateKey(cellGregorianKey);
                }
              }}
              className={`group/date relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent p-0 text-left ${isGregorianToday ? 'ring-2 ring-cyan-400 shadow-[0_0_0_4px_rgba(34,211,238,0.24)] bg-cyan-100/55' : ''} ${isSelectedNanakshahiDate ? 'ring-2 ring-brand-saffron shadow-[0_0_0_4px_rgba(245,166,35,0.18)]' : ''}`}
              aria-label={`Select Nanakshahi date ${cell.dayPa}`}
            >
              <span
                className={`relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold ${cell.isToday ? 'bg-brand-blue text-white shadow-[0_8px_18px_rgba(10,77,159,0.22)]' : cell.hasObservance ? (hasMultiTypeGradient ? 'ring-1 ring-slate-300/70 text-slate-900' : eventTone) : 'text-slate-700'} ${isGregorianToday ? '!bg-cyan-600 !text-white ring-2 ring-white/70 shadow-[0_10px_22px_rgba(8,145,178,0.45)] animate-pulse' : ''}`}
                style={!cell.isToday && hasMultiTypeGradient ? gradientStyle : undefined}
              >
                {cell.dayPa}
              </span>
              {cell.hasObservance ? (
                <span className="absolute bottom-0.5 right-0.5 inline-flex items-center gap-0.5 rounded-full bg-white/80 px-0.5 py-0.5 shadow-sm">
                  {uniqueTypeDots.map((tone, dotIndex) => (
                    <span
                      key={`${cell.day}-${dotIndex}`}
                      className={`h-1.5 w-1.5 rounded-full ${tone.dot}`}
                    />
                  ))}
                </span>
              ) : null}
              {cell.hasObservance ? (
                <span className={`pointer-events-none invisible absolute left-1/2 top-[calc(100%+8px)] z-[1200] hidden w-64 -translate-x-1/2 rounded-2xl border border-brand-blue/30 bg-gradient-to-br from-amber-50 via-white to-blue-50 p-3 text-left opacity-0 shadow-[0_16px_38px_rgba(15,23,42,0.2)] transition duration-150 group-hover/date:visible group-hover/date:opacity-100 xl:block ${hasScrollableObservances ? 'max-h-72 overflow-y-auto pr-2' : ''}`}>
                  {cell.observances.map((event, eventIndex) => {
                    const tone = getObservanceTypeStyles(event.type);
                    return (
                    <span
                      key={`${event.type}-${event.titlePa}-${eventIndex}`}
                      className={`block ${eventIndex > 0 ? 'mt-3 border-t border-brand-blue/15 pt-3' : ''}`}
                    >
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>
                        <CalendarDaysIcon className="h-3 w-3 flex-shrink-0" />
                        {event.occasion}
                      </span>
                      <span className={`mt-1 block text-[11px] font-bold ${tone.title}`}>{event.titlePa}</span>
                      <span className="block text-[10px] font-semibold text-slate-700">{event.title}</span>
                      <span className="mt-0.5 block text-[10px] font-bold tracking-wide text-slate-700">{englishDateLabel}</span>
                      <span className="mt-1 block text-[10px] leading-snug text-slate-600">{event.blurbPa}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-slate-600">{event.blurb}</span>
                    </span>
                    );
                  })}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  useEffect(() => {
    isCompactRef.current = isCompact;
  }, [isCompact]);

  useEffect(() => {
    let rafId = 0;
    let ticking = false;

    const syncCompactState = (nextValue) => {
      if (isCompactRef.current === nextValue) {
        return;
      }

      isCompactRef.current = nextValue;
      compactToggleCooldownUntilRef.current = Date.now() + COMPACT_TOGGLE_COOLDOWN_MS;
      setIsCompact(nextValue);
    };

    const evaluateCompactState = () => {
      ticking = false;

      if (Date.now() < preserveCompactUntilRef.current) {
        lastScrollYRef.current = Math.max(window.scrollY, 0);
        syncCompactState(true);
        return;
      }

      if (Date.now() < compactToggleCooldownUntilRef.current) {
        lastScrollYRef.current = Math.max(window.scrollY, 0);
        return;
      }

      const scrollY = Math.max(window.scrollY, 0);
      const scrollDirection = scrollY === lastScrollYRef.current
        ? 0
        : (scrollY > lastScrollYRef.current ? 1 : -1);

      let nextCompact = isCompactRef.current;
      if (isCompactRef.current) {
        if (scrollY <= COMPACT_EXIT_SCROLL_Y && scrollDirection < 0) {
          nextCompact = false;
        }
      } else if (scrollY >= COMPACT_ENTER_SCROLL_Y && scrollDirection > 0) {
        nextCompact = true;
      }

      lastScrollYRef.current = scrollY;
      syncCompactState(nextCompact);
    };

    const onScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      rafId = window.requestAnimationFrame(evaluateCompactState);
    };

    evaluateCompactState();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.cancelAnimationFrame(rafId);
    };
  }, []);

  useEffect(() => {
    if (compactScrollRestoreRef.current == null) {
      return undefined;
    }

    const restoreY = compactScrollRestoreRef.current;
    const safeRestoreY = Math.max(restoreY, 76);
    isCompactRef.current = true;
    setIsCompact(true);

    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        window.scrollTo({ top: safeRestoreY, behavior: 'auto' });
        isCompactRef.current = true;
        setIsCompact(true);
        compactScrollRestoreRef.current = null;
      });
      compactRestoreFramesRef.current.second = frameTwo;
    });
    compactRestoreFramesRef.current.first = frameOne;

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [location.pathname]);

  useEffect(() => {
    setCompactStreamsOpen(false);
    setDateInfoOpen(false);
  }, [location.pathname]);

  const liveStreams = useMemo(
    () => streamingItems.filter((entry) => entry?.streamUrl && entry?.active),
    [streamingItems]
  );
  const miltonPrimaryStream = useMemo(() => {
    if (liveStreams.length === 0) {
      return null;
    }

    return liveStreams.find((stream) => {
      const haystack = `${stream?.title || ''} ${stream?.text || ''} ${stream?.streamUrl || ''}`.toLowerCase();
      return haystack.includes('milton') || haystack.includes('singh sabha');
    }) || null;
  }, [liveStreams]);
  const secondaryLiveStreams = useMemo(
    () => liveStreams.filter((stream) => stream.id !== miltonPrimaryStream?.id),
    [liveStreams, miltonPrimaryStream?.id]
  );
  const todayObservance = useMemo(
    () => upcomingObservances.find((entry) => entry.date === todayIso) || null,
    [todayIso, upcomingObservances]
  );
  const visibleFamilyEvents = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const now = Date.now();
    return familyEvents.filter((event) => event?.active !== false && isEventAvailable(event, now));
  }, [familyEvents, isAuthenticated]);
  const visibleFamilySeva = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const todayDateKey = toDateKey(Date.now());
    const opportunitiesById = new Map(
      familySevaOpportunities.map((item) => [String(item?.id || ''), item])
    );

    return familySeva.filter((entry) => {
      const entryEmail = String(entry.email || '').trim().toLowerCase();
      const entryPhoneRaw = String(entry.phone || entry.whatsapp || '').trim().toLowerCase();
      const entryPhoneDigits = entryPhoneRaw.replace(/\D/g, '');
      const entryName = String(entry.name || '').trim().toLowerCase();
      const hasUserIdentifier = Boolean(userEmail || userPhoneDigits || userPhone);
      const hasEntryIdentifier = Boolean(entryEmail || entryPhoneDigits || entryPhoneRaw);

      let belongsToUser = false;

      if (userEmail && entryEmail === userEmail) {
        belongsToUser = true;
      }

      if (!belongsToUser && userPhoneDigits && entryPhoneDigits && userPhoneDigits === entryPhoneDigits) {
        belongsToUser = true;
      }

      if (!belongsToUser && userPhone && entryPhoneRaw && entryPhoneRaw === userPhone) {
        belongsToUser = true;
      }

      if (!belongsToUser) {
        belongsToUser = !hasUserIdentifier && !hasEntryIdentifier && userName && entryName === userName;
      }

      if (!belongsToUser) {
        return false;
      }

      const linkedOpportunity = opportunitiesById.get(String(entry.opportunityId || ''));
      if (linkedOpportunity) {
        return linkedOpportunity.isClosed !== true && linkedOpportunity.active !== false;
      }

      const sevaDateKey = toDateKey(entry.sevaDate || entry.date);
      if (!sevaDateKey) {
        return true;
      }

      if (sevaDateKey === todayDateKey) {
        const endMinutes = extractRangeEndMinutes(entry.sevaTime || entry.time);
        if (Number.isFinite(endMinutes) && nowLocalMinutes() > endMinutes) {
          return false;
        }
      }

      return sevaDateKey >= todayDateKey;
    });
  }, [familySeva, familySevaOpportunities, isAuthenticated, userEmail, userName, userPhone, userPhoneDigits]);
  const familySummary = useMemo(() => {
    if (!isAuthenticated) {
      return {
        eventCount: 0,
        waitlistCount: 0,
        sevaCount: 0,
        donationTotal: 0
      };
    }

    let eventCount = 0;
    let waitlistCount = 0;
    visibleFamilyEvents.forEach((event) => {
      const registrants = Array.isArray(event.registrants) ? event.registrants : [];
      registrants.forEach((entry) => {
        const entryName = String(entry.name || '').trim().toLowerCase();
        const entryContact = String(entry.contact || '').trim().toLowerCase();
        const entryEmail = String(entry.email || '').trim().toLowerCase();
        const belongsToUser = (userEmail && (entryEmail === userEmail || entryContact === userEmail)) || (userName && entryName === userName);
        if (!belongsToUser) {
          return;
        }
        eventCount += 1;
        if (String(entry.status || '').toLowerCase() === 'waitlisted') {
          waitlistCount += 1;
        }
      });
    });

    const sevaCount = visibleFamilySeva.length;

    const donationTotal = familyDonations
      .filter((entry) => String(entry.donorEmail || '').trim().toLowerCase() === userEmail)
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return {
      eventCount,
      waitlistCount,
      sevaCount,
      donationTotal
    };
  }, [familyDonations, isAuthenticated, userEmail, userName, visibleFamilyEvents, visibleFamilySeva]);

  const handleLogout = async () => {
    setIsProfilePopoverOpen(false);
    setIsCompactProfileLanyardOpen(false);
    await logout();
    setOpen(false);
    navigate('/', { replace: true });
  };

  const openProfileModal = () => {
    setProfileError('');
    setIsProfilePopoverOpen(false);
    setProfileImageUploadProgress(0);
    setProfileForm({
      name: String(user?.name || ''),
      phone: String(user?.phone || ''),
      address: String(user?.address || ''),
      avatarUrl: String(user?.avatarUrl || user?.picture || user?.photoURL || '')
    });
    setIsProfileModalOpen(true);
  };

  const handleProfileFormChange = (field) => (event) => {
    setProfileForm((previous) => ({ ...previous, [field]: event.target.value }));
  };

  const handleProfileAvatarSelected = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      setIsProfileImageUploading(true);
      setProfileError('');
      const uploaded = await uploadService.uploadFile({
        service: 'users',
        file,
        allowedMimeTypes: ['image/*'],
        maxSizeMB: 5,
        onProgress: setProfileImageUploadProgress
      });
      setProfileForm((previous) => ({ ...previous, avatarUrl: String(uploaded?.url || '') }));
    } catch (error) {
      setProfileError(error?.message || 'Unable to upload profile image right now.');
    } finally {
      setIsProfileImageUploading(false);
      event.target.value = '';
    }
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    const nextName = String(profileForm.name || '').trim();
    const nextPhone = String(profileForm.phone || '').trim();

    if (!nextName || !nextPhone) {
      setProfileError('Name and phone are required.');
      return;
    }

    try {
      setIsProfileSaving(true);
      setProfileError('');
      await updateProfile({
        name: nextName,
        email: String(user?.email || '').trim().toLowerCase(),
        phone: nextPhone,
        address: String(profileForm.address || '').trim(),
        avatarUrl: String(profileForm.avatarUrl || '').trim()
      });
      setIsProfileModalOpen(false);
    } catch (error) {
      setProfileError(error?.message || 'Unable to update profile right now.');
    } finally {
      setIsProfileSaving(false);
    }
  };

  const membershipDetailsMutation = useMutation({
    mutationFn: async (payload) => {
      let userId = String(user?.id || '').trim();
      if (!userId && user?.email) {
        const response = await userService.getUserByEmail(user.email);
        userId = String(response?.data?.id || '').trim();
      }
      if (!userId) {
        throw new Error('Unable to find your registration record. Please sign in again.');
      }
      return userService.submitMembershipDetails(userId, payload);
    },
    onSuccess: (response) => {
      if (response?.data) {
        persistUser(response.data);
      }
      setIsMembershipModalOpen(false);
      setMembershipPromptEnforced(false);
      setMembershipFormError('');
      try {
        window.sessionStorage.removeItem('ssm_prompt_member_details');
        window.localStorage.removeItem('ssm_prompt_member_details');
      } catch {
        // Ignore storage errors.
      }
    },
    onError: (error) => {
      setMembershipFormError(error?.message || 'Unable to submit member details right now.');
    }
  });

  const cancelMembershipMutation = useMutation({
    mutationFn: async () => {
      const userId = String(user?.id || '').trim();
      if (!userId) {
        throw new Error('Unable to find your registration record.');
      }

      await userService.removeUser(userId);
      await logout();
      return true;
    },
    onSuccess: () => {
      setMembershipPromptEnforced(false);
      setIsMembershipModalOpen(false);
      setMembershipFormError('');
      try {
        window.sessionStorage.removeItem('ssm_prompt_member_details');
        window.localStorage.removeItem('ssm_prompt_member_details');
      } catch {
        // Ignore storage errors.
      }
      navigate('/', { replace: true });
    },
    onError: (error) => {
      setMembershipFormError(error?.message || 'Unable to cancel registration right now.');
    }
  });

  const handleCancelMembershipRegistration = () => {
    setMembershipFormError('');
    cancelMembershipMutation.mutate();
  };

  const openMembershipModal = useCallback(() => {
    setMembershipFormError('');
    setAddressSuggestions([]);
    setAddressSearchError('');
    setShowAddressSuggestions(false);
    selectedAddressRef.current = String(user?.address || '').trim();
    setMembershipForm({
      phone: formatTenDigitPhone(user?.phone),
      address: String(user?.address || '').trim(),
      dateOfBirth: String(membershipProfile?.dateOfBirth || '').trim(),
      canadianStatus: String(membershipProfile?.canadianStatus || '').trim(),
      donationMethod: String(membershipProfile?.donationMethod || '').trim(),
      donationSchedule: String(membershipProfile?.donationSchedule || 'monthly').trim() || 'monthly',
      membershipPledgeAccepted: membershipProfile?.membershipPledgeAccepted === true,
      notes: String(membershipProfile?.notes || '').trim()
    });
    setIsMembershipModalOpen(true);
  }, [membershipProfile?.canadianStatus, membershipProfile?.dateOfBirth, membershipProfile?.donationMethod, membershipProfile?.donationSchedule, membershipProfile?.membershipPledgeAccepted, membershipProfile?.notes, user?.address, user?.phone]);

  const closeMembershipModal = () => {
    if (membershipPromptEnforced) {
      setMembershipFormError('Please complete your membership details to continue.');
      return;
    }

    setIsMembershipModalOpen(false);
  };

  const handleMembershipFieldChange = (field) => (event) => {
    const nextValue = event?.target?.type === 'checkbox' ? event.target.checked : event.target.value;
    setMembershipForm((previous) => ({ ...previous, [field]: nextValue }));
  };

  const handleMembershipPhoneChange = (event) => {
    setMembershipForm((previous) => ({
      ...previous,
      phone: formatTenDigitPhone(event.target.value)
    }));
  };

  const handleMembershipAddressChange = (event) => {
    selectedAddressRef.current = '';
    setShowAddressSuggestions(true);
    setMembershipForm((previous) => ({ ...previous, address: event.target.value }));
  };

  const handleMembershipAddressSelect = (address) => {
    selectedAddressRef.current = address;
    setMembershipForm((previous) => ({ ...previous, address }));
    setAddressSuggestions([]);
    setAddressSearchError('');
    setShowAddressSuggestions(false);
  };

  const handleSignInClick = (event) => {
    if (!isAuthenticated) {
      return;
    }

    event.preventDefault();
    navigate(resolveLandingPathByRole());
  };

  const handleBecomeMemberClick = (event) => {
    if (!isAuthenticated) {
      try {
        window.sessionStorage.setItem('ssm_prompt_member_details', '1');
        window.localStorage.setItem('ssm_prompt_member_details', '1');
      } catch {
        // Ignore storage errors.
      }
      return;
    }

    event.preventDefault();

    if (userRole === 'Member' && approvalStatus === 'approved' && user?.isActive !== false) {
      try {
        window.sessionStorage.removeItem('ssm_prompt_member_details');
        window.localStorage.removeItem('ssm_prompt_member_details');
      } catch {
        // Ignore storage errors.
      }
      navigate(resolveLandingPathByRole());
      return;
    }

    if (userRole === 'Member' && isMembershipProfileCompleted && approvalStatus === 'approved' && user?.isActive !== false) {
      navigate(resolveLandingPathByRole());
      return;
    }

    if (userRole === 'Member' && isMembershipProfileCompleted) {
      setIsMembershipModalOpen(false);
      setMembershipFormError('');
      setMembershipPromptNotice('Your membership request is already on record with the admin team. You will be notified soon.');
      return;
    }

    if (userRole === 'Member' && !isMembershipProfileCompleted) {
      setMembershipPromptNotice('');
      openMembershipModal();
      return;
    }

    navigate(resolveLandingPathByRole());
  };

  const handleSaveMembershipDetails = (event) => {
    event.preventDefault();
    setMembershipFormError('');

    const payload = {
      phone: String(membershipForm.phone || '').trim(),
      address: String(membershipForm.address || '').trim(),
      dateOfBirth: String(membershipForm.dateOfBirth || '').trim(),
      canadianStatus: String(membershipForm.canadianStatus || '').trim(),
      donationMethod: String(membershipForm.donationMethod || '').trim(),
      donationSchedule: String(membershipForm.donationSchedule || '').trim().toLowerCase(),
      membershipPledgeAccepted: membershipForm.membershipPledgeAccepted === true,
      notes: String(membershipForm.notes || '').trim()
    };

    if (!payload.phone || !payload.address || !payload.dateOfBirth || !payload.canadianStatus || !payload.donationMethod || !payload.donationSchedule) {
      setMembershipFormError('Phone, address, date of birth, citizenship status, donation method, and schedule are required.');
      return;
    }

    if (!isTenDigitPhone(payload.phone)) {
      setMembershipFormError('Enter a 10-digit phone number in the format (###)-###-####.');
      return;
    }

    if (!payload.membershipPledgeAccepted) {
      setMembershipFormError('Please accept the membership pledge to continue.');
      return;
    }

    membershipDetailsMutation.mutate(payload);
  };

  useEffect(() => {
    const query = String(membershipForm.address || '').trim();
    if (!isMembershipModalOpen || query.length < 3 || query === selectedAddressRef.current) {
      setAddressSuggestions([]);
      setIsAddressSearching(false);
      setAddressSearchError('');
      return undefined;
    }

    const controller = new AbortController();
    const timerId = window.setTimeout(async () => {
      setIsAddressSearching(true);
      setAddressSearchError('');
      try {
        const results = await addressLookupService.searchCanadianAddresses(query, { signal: controller.signal });
        setAddressSuggestions(results);
        setShowAddressSuggestions(true);
      } catch (error) {
        if (error?.name !== 'AbortError') {
          setAddressSuggestions([]);
          setAddressSearchError('Suggestions unavailable. You can still enter the full address manually.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsAddressSearching(false);
        }
      }
    }, 700);

    return () => {
      window.clearTimeout(timerId);
      controller.abort();
    };
  }, [isMembershipModalOpen, membershipForm.address]);

  useEffect(() => {
    if (!shouldShowPendingMembershipPrompt) {
      setMembershipPromptEnforced(false);
      setMembershipPromptNotice('');
      return;
    }

    setMembershipPromptEnforced(true);
    try {
      const noticeKey = `ssm_member_details_notice_${String(user?.id || 'member')}`;
      const hasShown = window.sessionStorage.getItem(noticeKey) === '1';
      if (!hasShown) {
        window.sessionStorage.setItem(noticeKey, '1');
        setMembershipPromptNotice('Your membership application is pending admin approval. Please wait for an update from the admin team.');
      }
    } catch {
      setMembershipPromptNotice('Your membership application is pending admin approval. Please wait for an update from the admin team.');
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMembershipProfileCompleted, shouldShowPendingMembershipPrompt, user?.id]);

  useEffect(() => {
    if (!isAuthenticated || userRole !== 'Member') {
      return undefined;
    }

    if (approvalStatus === 'approved' && user?.isActive !== false) {
      try {
        window.sessionStorage.removeItem('ssm_prompt_member_details');
        window.localStorage.removeItem('ssm_prompt_member_details');
      } catch {
        // Ignore storage errors.
      }
      setMembershipPromptNotice('');
      setIsMembershipModalOpen(false);
      return undefined;
    }

    let shouldPromptMembershipDetails = false;
    try {
      shouldPromptMembershipDetails = window.sessionStorage.getItem('ssm_prompt_member_details') === '1'
        || window.localStorage.getItem('ssm_prompt_member_details') === '1';
    } catch {
      shouldPromptMembershipDetails = false;
    }

    if (!shouldPromptMembershipDetails) {
      return undefined;
    }

    if (isMembershipModalOpen) {
      return undefined;
    }

    setMembershipPromptNotice('');
    openMembershipModal();
    return undefined;
  }, [isAuthenticated, isMembershipModalOpen, isMembershipProfileCompleted, openMembershipModal, userRole, approvalStatus, user?.isActive]);

  useEffect(() => {
    if (!membershipPromptNotice) {
      return undefined;
    }

    const timerId = window.setTimeout(() => setMembershipPromptNotice(''), 5000);
    return () => window.clearTimeout(timerId);
  }, [membershipPromptNotice]);

  const handleProfileQuickLink = (targetPath) => (event) => {
    setIsProfilePopoverOpen(false);
    setIsCompactProfileLanyardOpen(false);
    if (location.pathname === targetPath) {
      event.preventDefault();
      window.location.reload();
    }
  };

  const handleCompactProfileLinkTouch = (targetPath) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    setIsProfilePopoverOpen(false);
    setIsCompactProfileLanyardOpen(false);
    if (location.pathname === targetPath) {
      window.location.reload();
      return;
    }
    navigate(targetPath);
  };

  const dateContext = useMemo(() => {
    const weekdayEn = new Date().toLocaleDateString('en-CA', { weekday: 'long' });
    const monthInsight = {
      Chet: {
        en: 'Chet marks renewal and fresh spiritual beginnings in the Nanakshahi cycle.',
        pa: 'ਚੇਤ ਨਵੇਂ ਆਰੰਭ ਅਤੇ ਰੂਹਾਨੀ ਤਾਜ਼ਗੀ ਦਾ ਮਹੀਨਾ ਮੰਨਿਆ ਜਾਂਦਾ ਹੈ।'
      },
      Vaisakh: {
        en: 'Vaisakh inspires discipline, seva, and gratitude for collective growth.',
        pa: 'ਵੈਸਾਖ ਸੇਵਾ, ਅਨੁਸ਼ਾਸਨ ਅਤੇ ਸੰਗਤਕ ਇਕਤਾ ਦੀ ਯਾਦ ਦਿਵਾਂਦਾ ਹੈ।'
      },
      Jeth: {
        en: 'Jeth emphasizes steadiness in simran and humility in daily conduct.',
        pa: 'ਜੇਠ ਸਿਮਰਨ ਵਿੱਚ ਨਿਰੰਤਰਤਾ ਅਤੇ ਜੀਵਨ ਵਿੱਚ ਨਿਮਰਤਾ ਦਾ ਸੰਦੇਸ਼ ਦਿੰਦਾ ਹੈ।'
      },
      Harh: {
        en: 'Harh reminds us to stay cool in thought and deep in Naam, even in intensity.',
        pa: 'ਹਾੜ ਗਰਮੀ ਵਿੱਚ ਵੀ ਚਿੱਤ ਸ਼ਾਂਤ ਰੱਖ ਕੇ ਨਾਮ ਨਾਲ ਜੋੜ ਬਣਾਈ ਰੱਖਣ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
      },
      Sawan: {
        en: 'Sawan is often associated with devotion, reflection, and heartfelt prayer.',
        pa: 'ਸਾਵਣ ਭਗਤੀ, ਮਨਨ ਅਤੇ ਅਰਦਾਸ ਭਰੇ ਜੀਵਨ ਦੀ ਪ੍ਰੇਰਣਾ ਨਾਲ ਜੋੜਿਆ ਜਾਂਦਾ ਹੈ।'
      },
      Bhadon: {
        en: 'Bhadon calls for patience, service, and strengthening one another in sangat.',
        pa: 'ਭਾਦੋਂ ਸਬਰ, ਸੇਵਾ ਅਤੇ ਸੰਗਤਕ ਸਹਿਯੋਗ ਨੂੰ ਮਜ਼ਬੂਤ ਕਰਨ ਦਾ ਸੰਦੇਸ਼ ਦਿੰਦਾ ਹੈ।'
      },
      Assu: {
        en: 'Assu encourages introspection and conscious spiritual commitments.',
        pa: 'ਅੱਸੂ ਅੰਤਰ-ਝਾਤ ਅਤੇ ਰੂਹਾਨੀ ਵਚਨਬੱਧਤਾ ਨੂੰ ਮਜ਼ਬੂਤ ਕਰਨ ਦੀ ਯਾਦ ਦਿਵਾਂਦਾ ਹੈ।'
      },
      Katak: {
        en: 'Katak inspires remembrance of Gurmat values through daily discipline.',
        pa: 'ਕੱਤਕ ਗੁਰਮਤ ਮੁੱਲਾਂ ਨੂੰ ਰੋਜ਼ਾਨਾ ਜੀਵਨ ਵਿੱਚ ਪੱਕਾ ਕਰਨ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
      },
      Maghar: {
        en: 'Maghar emphasizes resilience and hope through Guru-centered living.',
        pa: 'ਮੱਘਰ ਗੁਰੂ ਕੇਂਦਰਿਤ ਜੀਵਨ ਰਾਹੀਂ ਹੌਂਸਲਾ ਅਤੇ ਆਸ ਕਾਇਮ ਰੱਖਣ ਦਾ ਸੰਦੇਸ਼ ਦਿੰਦਾ ਹੈ।'
      },
      Poh: {
        en: 'Poh is a time for courage, remembrance, and steadfast faith.',
        pa: 'ਪੋਹ ਹਿੰਮਤ, ਯਾਦ ਅਤੇ ਅਡੋਲ ਵਿਸ਼ਵਾਸ ਦਾ ਮਹੀਨਾ ਮੰਨਿਆ ਜਾਂਦਾ ਹੈ।'
      },
      Magh: {
        en: 'Magh invites deeper sangat connection and focused spiritual practice.',
        pa: 'ਮਾਘ ਸੰਗਤ ਨਾਲ ਗਹਿਰੇ ਜੋੜ ਅਤੇ ਕੇਂਦ੍ਰਿਤ ਰੂਹਾਨੀ ਅਭਿਆਸ ਦੀ ਪ੍ਰੇਰਨਾ ਦਿੰਦਾ ਹੈ।'
      },
      Phagun: {
        en: 'Phagun reflects joy in divine love, unity, and gratitude.',
        pa: 'ਫੱਗਣ ਇਸ਼ਕੀ-ਇਲਾਹੀ, ਇਕਤਾ ਅਤੇ ਸ਼ੁਕਰਾਨੇ ਦੀ ਖੁਸ਼ੀ ਨਾਲ ਜੁੜਿਆ ਮਹੀਨਾ ਹੈ।'
      }
    };

    const fallbackInsight = {
      en: 'This day invites us to stay connected to Gurbani, seva, and sangat.',
      pa: 'ਇਹ ਦਿਨ ਸਾਨੂੰ ਗੁਰਬਾਣੀ, ਸੇਵਾ ਅਤੇ ਸੰਗਤ ਨਾਲ ਜੁੜੇ ਰਹਿਣ ਦੀ ਯਾਦ ਦਿਵਾਂਦਾ ਹੈ।'
    };

    return {
      weekdayEn,
      insight: monthInsight[nanakshahiDate.month] || fallbackInsight
    };
  }, [nanakshahiDate.month]);

  const clearKirtanRetryTimer = () => {
    if (kirtanRetryTimeoutRef.current) {
      window.clearTimeout(kirtanRetryTimeoutRef.current);
      kirtanRetryTimeoutRef.current = null;
    }
  };

  const resolveKirtanStreamUrl = () => {
    return String(siteConfig.liveKirtanStreamUrl || '').trim();
  };

  const loadKirtanStream = (streamUrl) => {
    if (kirtanHlsRef.current) {
      kirtanHlsRef.current.startLoad();
      return;
    }
    liveAudioRef.current.src = streamUrl;
    liveAudioRef.current.load();
  };

  const scheduleKirtanReconnect = () => {
    if (!kirtanPlaybackRequestedRef.current) {
      return;
    }

    if (kirtanRetryTimeoutRef.current || kirtanReconnectInFlightRef.current) {
      return;
    }

    kirtanRetryTimeoutRef.current = window.setTimeout(async () => {
      kirtanRetryTimeoutRef.current = null;
      if (!kirtanPlaybackRequestedRef.current || !liveAudioRef.current) {
        return;
      }

      const baseStreamUrl = resolveKirtanStreamUrl();
      if (!baseStreamUrl) {
        setIsKirtanPlaying(false);
        setIsKirtanLoading(false);
        return;
      }

      try {
        kirtanReconnectInFlightRef.current = true;
        setIsKirtanLoading(true);
        loadKirtanStream(baseStreamUrl);
        await liveAudioRef.current.play();
      } catch {
        setIsKirtanPlaying(false);
        setIsKirtanLoading(false);
        kirtanReconnectInFlightRef.current = false;
        scheduleKirtanReconnect();
        return;
      }

      kirtanReconnectInFlightRef.current = false;
    }, 2200);
  };

  useEffect(() => {
    const audio = liveAudioRef.current;
    const streamUrl = resolveKirtanStreamUrl();
    if (!audio || !/\.m3u8(?:$|\?)/i.test(streamUrl) || !Hls.isSupported()) {
      return undefined;
    }

    const hls = new Hls({ enableWorker: true, lowLatencyMode: true, liveSyncDurationCount: 3 });
    kirtanHlsRef.current = hls;
    hls.attachMedia(audio);
    hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(streamUrl));
    hls.on(Hls.Events.ERROR, (_event, data) => {
      if (!data.fatal) {
        return;
      }
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
      } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
      }
    });

    return () => {
      kirtanHlsRef.current = null;
      hls.destroy();
    };
  }, []);

  useEffect(() => () => {
    clearKirtanRetryTimer();
    kirtanReconnectInFlightRef.current = false;
  }, []);

  const toggleLiveKirtan = async () => {
    if (!liveAudioRef.current) {
      return;
    }

    const baseStreamUrl = resolveKirtanStreamUrl();
    if (!baseStreamUrl) {
      kirtanPlaybackRequestedRef.current = false;
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      return;
    }

    if (isKirtanPlaying) {
      kirtanPlaybackRequestedRef.current = false;
      kirtanPausedByUserRef.current = true;
      clearKirtanRetryTimer();
      kirtanReconnectInFlightRef.current = false;
      liveAudioRef.current.pause();
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      return;
    }

    try {
      kirtanPlaybackRequestedRef.current = true;
      kirtanPausedByUserRef.current = false;
      clearKirtanRetryTimer();
      kirtanReconnectInFlightRef.current = false;
      setIsKirtanLoading(true);
      loadKirtanStream(baseStreamUrl);
      await liveAudioRef.current.play();
      setIsKirtanPlaying(true);
      setIsKirtanLoading(false);
    } catch {
      setIsKirtanPlaying(false);
      setIsKirtanLoading(false);
      scheduleKirtanReconnect();
    }
  };

  const statusDotClass = isKirtanPlaying ? 'bg-emerald-400' : (isKirtanLoading ? 'bg-amber-300' : 'bg-red-400');
  const featuredStream = miltonPrimaryStream || liveStreams[0] || null;

  const openStreamModal = (id) => {
    setStreamModalState({ open: true, id });
  };

  const openDatePopover = () => {
    if (datePopoverCloseTimeoutRef.current) {
      window.clearTimeout(datePopoverCloseTimeoutRef.current);
      datePopoverCloseTimeoutRef.current = null;
    }
    if (profilePopoverCloseTimeoutRef.current) {
      window.clearTimeout(profilePopoverCloseTimeoutRef.current);
      profilePopoverCloseTimeoutRef.current = null;
    }
    setIsProfilePopoverOpen(false);
    setIsDatePopoverOpen(true);
  };

  const closeDatePopoverWithDelay = () => {
    if (datePopoverCloseTimeoutRef.current) {
      window.clearTimeout(datePopoverCloseTimeoutRef.current);
    }
    datePopoverCloseTimeoutRef.current = window.setTimeout(() => {
      setIsDatePopoverOpen(false);
      datePopoverCloseTimeoutRef.current = null;
    }, 180);
  };

  const openProfilePopover = () => {
    if (profilePopoverCloseTimeoutRef.current) {
      window.clearTimeout(profilePopoverCloseTimeoutRef.current);
      profilePopoverCloseTimeoutRef.current = null;
    }
    setIsProfilePopoverOpen(true);
  };

  const closeProfilePopoverWithDelay = () => {
    if (profilePopoverCloseTimeoutRef.current) {
      window.clearTimeout(profilePopoverCloseTimeoutRef.current);
    }
    profilePopoverCloseTimeoutRef.current = window.setTimeout(() => {
      setIsProfilePopoverOpen(false);
      profilePopoverCloseTimeoutRef.current = null;
    }, 220);
  };

  const handleCompactNavClick = () => {
    compactScrollRestoreRef.current = window.scrollY;
    preserveCompactUntilRef.current = Date.now() + 800;
  };

  const armBackdropGuard = (guardRef, timeoutRef) => {
    guardRef.current = true;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      guardRef.current = false;
      timeoutRef.current = null;
    }, 280);
  };

  const openCompactStreams = () => {
    armBackdropGuard(compactStreamsBackdropGuardRef, compactStreamsBackdropGuardTimeoutRef);
    setCompactStreamsOpen(true);
  };

  useEffect(() => {
    if (!dateInfoOpen || !mobileNanakshahiDetailsRef.current) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => {
      mobileNanakshahiDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [dateInfoOpen, selectedNanakshahiDateKey]);

  const closeSearchModal = () => {
    setIsSearchModalOpen(false);
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      const currentContent = viewportMeta.getAttribute('content') || 'width=device-width, initial-scale=1';
      const normalizedContent = currentContent
        .replace(/,\s*maximum-scale\s*=\s*[^,]+/gi, '')
        .replace(/,\s*minimum-scale\s*=\s*[^,]+/gi, '')
        .replace(/,\s*user-scalable\s*=\s*[^,]+/gi, '')
        .trim();

      viewportMeta.setAttribute('content', `${normalizedContent}, maximum-scale=1, minimum-scale=1, user-scalable=1`);

      if (viewportResetTimeoutRef.current) {
        window.clearTimeout(viewportResetTimeoutRef.current);
      }

      viewportResetTimeoutRef.current = window.setTimeout(() => {
        viewportMeta.setAttribute('content', normalizedContent);
      }, 180);
    }

    window.scrollTo({ top: window.scrollY, left: 0, behavior: 'auto' });
    window.dispatchEvent(new Event('resize'));
  };

  const getImageDataUrl = async (source) => new Promise((resolve) => {
    const src = String(source || '').trim();
    if (!src) {
      resolve(null);
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(null);
        return;
      }

      context.drawImage(image, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });

  const getLogoDataUrl = async () => getImageDataUrl(gurdwaraLogo);

  const getPdfBannerDataUrls = async (urls = []) => {
    const selected = (Array.isArray(urls) ? urls : []).slice(0, 8);
    if (selected.length === 0) {
      return [];
    }

    const settled = await Promise.all(selected.map((url) => getImageDataUrl(url).catch(() => null)));
    return settled.filter(Boolean);
  };

  const getPdfGurmukhiFonts = async () => {
    if (pdfFontCacheRef.current) {
      return pdfFontCacheRef.current;
    }

    try {
      const [regularRes, boldRes] = await Promise.all([
        fetch(notoSansGurmukhiRegular),
        fetch(notoSansGurmukhiBold)
      ]);
      const [regularBuffer, boldBuffer] = await Promise.all([
        regularRes.arrayBuffer(),
        boldRes.arrayBuffer()
      ]);

      pdfFontCacheRef.current = {
        regular: toBase64FromArrayBuffer(regularBuffer),
        bold: toBase64FromArrayBuffer(boldBuffer)
      };
      return pdfFontCacheRef.current;
    } catch {
      return null;
    }
  };

  const drawPdfHeader = (doc, logoDataUrl, title, subtitle, hasGurmukhiFont = false) => {
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFillColor(...PDF_HEADER_BG);
    doc.rect(0, 0, pageWidth, 36, 'F');

    if (logoDataUrl) {
      doc.addImage(logoDataUrl, 'PNG', 10, 6, 20, 20);
    }

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(siteConfig.name, 34, 14);

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(219, 234, 254);
    doc.setFontSize(9.5);
    doc.text(siteConfig.contact.address, 34, 20);
    doc.text(siteConfig.contact.phone, 34, 25);

    doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11.8);
    doc.text(title, pageWidth - 10, 14, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(219, 234, 254);
    doc.setFontSize(9.5);
    doc.text(subtitle, pageWidth - 10, 20, { align: 'right' });
  };

  const getNanakshahiYearMonths = () => {
    let firstMonth = getNanakshahiMonthCalendar(nanakshahiMonthCalendar.monthStartGregorian, nanakshahiObservances);
    let rewindGuard = 0;

    while (firstMonth.month !== 'Chet' && rewindGuard < 14) {
      firstMonth = getNanakshahiMonthCalendar(new Date(firstMonth.monthStartGregorian.getTime() - CALENDAR_NAV_DAY_MS), nanakshahiObservances);
      rewindGuard += 1;
    }

    const yearMonths = [];
    let cursor = firstMonth;

    for (let index = 0; index < 12; index += 1) {
      yearMonths.push(cursor);
      cursor = getNanakshahiMonthCalendar(new Date(cursor.nextMonthStartGregorian.getTime()), nanakshahiObservances);
    }

    return yearMonths;
  };

  const generateCalendarPdf = async (variant = 'compact') => {
    if (isPdfBusy) {
      return;
    }

    setIsPdfBusy(true);
    try {
      const isDetailed = variant === 'detailed';
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      const fontPayload = await getPdfGurmukhiFonts();
      const hasGurmukhiFont = Boolean(fontPayload?.regular && fontPayload?.bold);
      if (hasGurmukhiFont) {
        doc.addFileToVFS('NotoSansGurmukhi-Regular.ttf', fontPayload.regular);
        doc.addFont('NotoSansGurmukhi-Regular.ttf', 'NotoSansGurmukhi', 'normal');
        doc.addFileToVFS('NotoSansGurmukhi-Bold.ttf', fontPayload.bold);
        doc.addFont('NotoSansGurmukhi-Bold.ttf', 'NotoSansGurmukhi', 'bold');
      }
      const logoDataUrl = await getLogoDataUrl();
      const bannerDataUrls = await getPdfBannerDataUrls(pdfBannerImageUrls);
      const monthStart = nanakshahiMonthCalendar.monthStartGregorian;
      const nextMonthStart = nanakshahiMonthCalendar.nextMonthStartGregorian;
      const monthEnd = new Date(nextMonthStart.getTime() - CALENDAR_NAV_DAY_MS);

      if (!isDetailed) {
        const yearMonths = getNanakshahiYearMonths();
        const yearStart = yearMonths[0].monthStartGregorian;
        const yearEnd = new Date(yearMonths[yearMonths.length - 1].nextMonthStartGregorian.getTime() - CALENDAR_NAV_DAY_MS);

        drawPdfHeader(
          doc,
          logoDataUrl,
          `${yearMonths[0].yearPa} ਨਾਨਕਸ਼ਾਹੀ ਕੈਲੰਡਰ - ਸੰਖੇਪ`,
          `${formatGregorianLabel(yearStart)} - ${formatGregorianLabel(yearEnd)}`,
          hasGurmukhiFont
        );

        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const marginX = 8;
        const bannerStripHeight = bannerDataUrls.length > 0 ? 9 : 0;
        const marginBottom = 8 + (bannerStripHeight > 0 ? bannerStripHeight + 2 : 0);
        const topY = 40;
        const columns = 4;
        const rows = 3;
        const gapX = 3.5;
        const gapY = 2.5;
        const cardWidth = (pageWidth - (marginX * 2) - ((columns - 1) * gapX)) / columns;
        const cardHeight = (pageHeight - topY - marginBottom - ((rows - 1) * gapY)) / rows;

        yearMonths.forEach((monthData, monthIndex) => {
          const col = monthIndex % columns;
          const row = Math.floor(monthIndex / columns);
          const x = marginX + (col * (cardWidth + gapX));
          const y = topY + (row * (cardHeight + gapY));

          doc.setDrawColor(10, 77, 159);
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(x, y, cardWidth, cardHeight, 1.2, 1.2, 'FD');

          doc.setFillColor(239, 246, 255);
          doc.roundedRect(x + 0.6, y + 0.6, cardWidth - 1.2, 6.6, 1, 1, 'F');
          doc.setTextColor(10, 77, 159);
          doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
          doc.setFontSize(8.6);
          doc.text(`${monthData.monthPa} ${monthData.yearPa}`, x + 1.5, y + 5.3);

          const miniColWidth = (cardWidth - 2.2) / 7;
          NANAKSHAHI_WEEKDAY_LABELS_PA.forEach((label, weekdayIndex) => {
            doc.setTextColor(100, 116, 139);
            doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
            doc.setFontSize(5.1);
            doc.text(label, x + 1.1 + (weekdayIndex * miniColWidth) + (miniColWidth / 2), y + 9.7, { align: 'center' });
          });

          const monthWeeks = monthData.weeks.slice(0, 6);
          const calendarTopY = y + 10.4;
          const calendarBottomY = y + 31.2;
          const calendarHeight = calendarBottomY - calendarTopY;
          const cellHeight = calendarHeight / 6;

          monthWeeks.forEach((week, weekIndex) => {
            week.forEach((cell, dayIndex) => {
              const cellX = x + 1.1 + (dayIndex * miniColWidth);
              const cellY = calendarTopY + (weekIndex * cellHeight);

              doc.setDrawColor(10, 77, 159);
              doc.setLineWidth(0.14);
              doc.rect(cellX, cellY, miniColWidth, cellHeight);

              if (!cell) {
                return;
              }

              const cellKey = `${cell.gregorianDate.getFullYear()}-${String(cell.gregorianDate.getMonth() + 1).padStart(2, '0')}-${String(cell.gregorianDate.getDate()).padStart(2, '0')}`;

              if (cellKey === todayGregorianKey) {
                doc.setFillColor(255, 236, 179);
                doc.roundedRect(cellX + 0.1, cellY + 0.15, miniColWidth - 0.25, cellHeight - 0.3, 0.5, 0.5, 'F');
              }

              if (cell.hasObservance) {
                const tone = getPdfEventTone(cell.observances[0]?.type);
                doc.setFillColor(...tone.bg);
                doc.roundedRect(cellX + 0.08, cellY + 0.08, miniColWidth - 0.16, cellHeight - 0.16, 0.3, 0.3, 'F');
                doc.setFillColor(245, 166, 35);
                doc.circle(cellX + miniColWidth - 0.6, cellY + 0.7, 0.26, 'F');
              }

              doc.setTextColor(cell.hasObservance ? 10 : 51, cell.hasObservance ? 77 : 65, cell.hasObservance ? 159 : 85);
              doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
              doc.setFontSize(4.7);
              doc.text(String(cell.dayPa), cellX + (miniColWidth / 2), cellY + 1.75, { align: 'center' });

              doc.setFont('helvetica', 'normal');
              doc.setTextColor(71, 85, 105);
              doc.setFontSize(3.5);
              doc.text(formatGregorianMiniLabel(cell.gregorianDate), cellX + (miniColWidth / 2), cellY + (cellHeight - 0.35), { align: 'center' });
            });
          });

          const monthEvents = monthData.weeks
            .flat()
            .filter(Boolean)
            .flatMap((cell) => cell.observances.map((event) => ({
              dateKey: toIsoDateKeyFromDate(cell.gregorianDate),
              event,
              dateObj: cell.gregorianDate
            })))
            .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());

          const uniqueEvents = [];
          const seenEventKeys = new Set();
          monthEvents.forEach((entry) => {
            const key = `${entry.dateKey}::${entry.event.title}`;
            if (!seenEventKeys.has(key)) {
              seenEventKeys.add(key);
              uniqueEvents.push(entry);
            }
          });

          uniqueEvents.sort((left, right) => {
            const leftPriority = Number(left?.event?.importance || 999);
            const rightPriority = Number(right?.event?.importance || 999);
            if (leftPriority !== rightPriority) {
              return leftPriority - rightPriority;
            }
            return left.dateObj.getTime() - right.dateObj.getTime();
          });

          const listTitleY = y + 33.4;
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(4.9);
          doc.text('Holidays:', x + 1.2, listTitleY);

          const pillHeight = 2.25;
          const pillGapX = 0.55;
          const pillGapY = 0.55;
          const pillsStartX = x + 1.2;
          const pillsMaxX = x + cardWidth - 1.2;
          const availablePillHeight = (y + cardHeight - 1.2) - (listTitleY + 1.1);
          const maxRows = Math.max(1, Math.floor((availablePillHeight + pillGapY) / (pillHeight + pillGapY)));
          let cursorX = pillsStartX;
          let cursorY = listTitleY + 1.1;
          let pillRow = 1;

          uniqueEvents.forEach((entry) => {
            if (pillRow > maxRows) {
              return;
            }

            const sourceTitle = String(entry?.event?.titlePa || entry?.event?.title || '').trim();
            const label = truncatePdfText(sourceTitle, 30);
            doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
            doc.setFontSize(3.2);
            const textWidth = doc.getTextWidth(label);
            const estimatedWidth = Math.min((pillsMaxX - pillsStartX), Math.max(6.2, textWidth + 1.5));

            if (cursorX + estimatedWidth > pillsMaxX) {
              cursorX = pillsStartX;
              cursorY += pillHeight + pillGapY;
              pillRow += 1;
              if (pillRow > maxRows) {
                return;
              }
            }

            const tone = getPdfHolidayPillTone(entry.event);
            doc.setFillColor(...tone.bg);
            doc.roundedRect(cursorX, cursorY, estimatedWidth, pillHeight, 1.2, 1.2, 'F');
            doc.setTextColor(...tone.text);
            doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
            doc.setFontSize(3.2);
            doc.text(label, cursorX + 0.7, cursorY + 1.55);

            cursorX += estimatedWidth + pillGapX;
          });
        });

        if (bannerDataUrls.length > 0) {
          const stripY = pageHeight - bannerStripHeight - 4;
          const stripGap = 1.4;
          const itemWidth = (pageWidth - (marginX * 2) - ((bannerDataUrls.length - 1) * stripGap)) / bannerDataUrls.length;

          bannerDataUrls.forEach((bannerDataUrl, index) => {
            const imageX = marginX + (index * (itemWidth + stripGap));
            doc.setDrawColor(203, 213, 225);
            doc.roundedRect(imageX, stripY, itemWidth, bannerStripHeight, 0.8, 0.8, 'S');
            doc.addImage(bannerDataUrl, 'PNG', imageX + 0.25, stripY + 0.25, itemWidth - 0.5, bannerStripHeight - 0.5);
          });
        }

        doc.save(`nanakshahi-${yearMonths[0].year}-compact-year-grid.pdf`);
        return;
      }

      const subtitle = `${formatGregorianLabel(monthStart)} - ${formatGregorianLabel(monthEnd)}`;

      drawPdfHeader(
        doc,
        logoDataUrl,
        `${nanakshahiMonthCalendar.labelPa} ਨਾਨਕਸ਼ਾਹੀ ਕੈਲੰਡਰ - ਵਿਸਥਾਰ`,
        subtitle,
        hasGurmukhiFont
      );

      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 10;
      const colWidth = (pageWidth - marginX * 2) / 7;
      const headerY = 42;
      const rowHeight = isDetailed ? 23 : 26;

      NANAKSHAHI_WEEKDAY_LABELS_PA.forEach((label, index) => {
        const x = marginX + (index * colWidth);
        doc.setFillColor(239, 246, 255);
        doc.rect(x, headerY, colWidth, 8, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(x, headerY, colWidth, 8);
        doc.setTextColor(71, 85, 105);
        doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
        doc.setFontSize(8);
        doc.text(label, x + (colWidth / 2), headerY + 5.2, { align: 'center' });
      });

      const weeks = nanakshahiMonthCalendar.weeks;
      const todayKey = todayGregorianKey;

      weeks.forEach((week, rowIndex) => {
        week.forEach((cell, colIndex) => {
          const x = marginX + (colIndex * colWidth);
          const y = headerY + 8 + (rowIndex * rowHeight);

          doc.setDrawColor(203, 213, 225);
          doc.setFillColor(255, 255, 255);
          doc.rect(x, y, colWidth, rowHeight, 'FD');

          if (!cell) {
            return;
          }

          const cellKey = `${cell.gregorianDate.getFullYear()}-${String(cell.gregorianDate.getMonth() + 1).padStart(2, '0')}-${String(cell.gregorianDate.getDate()).padStart(2, '0')}`;
          if (cellKey === todayKey) {
            doc.setDrawColor(245, 166, 35);
            doc.setLineWidth(0.8);
            doc.rect(x + 0.5, y + 0.5, colWidth - 1, rowHeight - 1);
            doc.setLineWidth(0.2);
          }

          if (cell.hasObservance) {
            const tone = getPdfEventTone(cell.observances[0]?.type);
            doc.setFillColor(...tone.bg);
            doc.roundedRect(x + 0.4, y + 0.4, colWidth - 0.8, rowHeight - 0.8, 0.7, 0.7, 'F');
          }

          doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
          doc.setTextColor(10, 77, 159);
          doc.setFontSize(isDetailed ? 12 : 15);
          doc.text(String(cell.dayPa), x + 1.2, y + 6.2);

          if (isDetailed) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            doc.setFontSize(6.7);
            doc.text(formatGregorianLabel(cell.gregorianDate), x + 1.2, y + 10.2);

            let chipY = y + 12;
            const maxChips = 3;
            cell.observances.slice(0, maxChips).forEach((event) => {
              const tone = getPdfEventTone(event.type);
              doc.setFillColor(...tone.bg);
              doc.roundedRect(x + 1, chipY, colWidth - 2, 4.8, 1, 1, 'F');
              doc.setTextColor(...tone.text);
              doc.setFont(hasGurmukhiFont ? 'NotoSansGurmukhi' : 'helvetica', 'bold');
              doc.setFontSize(6.2);
              doc.text(truncatePdfText(event.titlePa || event.title, 28), x + 1.8, chipY + 3.2);
              chipY += 5.4;
            });
          }
        });
      });

      const suffix = isDetailed ? 'detailed' : 'compact';
      doc.save(`nanakshahi-${nanakshahiMonthCalendar.month.toLowerCase()}-${nanakshahiMonthCalendar.year}-${suffix}.pdf`);
    } finally {
      setIsPdfBusy(false);
    }
  };

  useEffect(() => () => {
    if (datePopoverCloseTimeoutRef.current) {
      window.clearTimeout(datePopoverCloseTimeoutRef.current);
    }
    if (profilePopoverCloseTimeoutRef.current) {
      window.clearTimeout(profilePopoverCloseTimeoutRef.current);
    }
    if (viewportResetTimeoutRef.current) {
      window.clearTimeout(viewportResetTimeoutRef.current);
    }
    if (compactStreamsBackdropGuardTimeoutRef.current) {
      window.clearTimeout(compactStreamsBackdropGuardTimeoutRef.current);
    }
    if (compactLanyardBackdropGuardTimeoutRef.current) {
      window.clearTimeout(compactLanyardBackdropGuardTimeoutRef.current);
    }
    if (dateInfoBackdropGuardTimeoutRef.current) {
      window.clearTimeout(dateInfoBackdropGuardTimeoutRef.current);
    }
    if (searchBackdropGuardTimeoutRef.current) {
      window.clearTimeout(searchBackdropGuardTimeoutRef.current);
    }
  }, []);

  return (
    <header className={`sticky top-0 z-50 bg-slate-950/95 shadow-[0_10px_26px_-10px_rgba(2,6,23,0.65)] ring-1 ring-slate-700/80 backdrop-blur-md transition-all duration-300 ${isCompact ? 'pb-1' : ''}`}>
      <div className="hidden border-b border-white/20 bg-[#0a1a33] px-4 py-1 text-xs text-blue-50 xl:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between md:px-2">
          <div className="flex items-center gap-2">
            <p>{siteConfig.contact.address}</p>
            <span className="hidden text-blue-200 xl:inline">|</span>
            <div className="hidden items-center gap-1.5 xl:flex">
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded text-white hover:bg-blue-800/40"
                onClick={toggleLiveKirtan}
                aria-label={isKirtanPlaying ? 'Pause live kirtan' : 'Play live kirtan'}
              >
                {isKirtanPlaying ? <PauseIcon className="h-4 w-4" /> : <PlayIcon className="h-4 w-4" />}
              </button>
              <span className={`h-2.5 w-2.5 rounded-full ${statusDotClass}`} />
              <span className="text-[11px] font-semibold text-blue-50">Live Kirtan from Darbar Sahib</span>
              <audio
                ref={liveAudioRef}
                src={Hls.isSupported() ? undefined : siteConfig.liveKirtanStreamUrl}
                preload="none"
                onPlaying={() => {
                  clearKirtanRetryTimer();
                  kirtanReconnectInFlightRef.current = false;
                  kirtanPausedByUserRef.current = false;
                  setIsKirtanPlaying(true);
                  setIsKirtanLoading(false);
                }}
                onPause={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(kirtanPlaybackRequestedRef.current && !kirtanPausedByUserRef.current);
                }}
                onEnded={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(kirtanPlaybackRequestedRef.current);
                  if (kirtanPlaybackRequestedRef.current && !kirtanPausedByUserRef.current) {
                    scheduleKirtanReconnect();
                  }
                }}
                onWaiting={() => setIsKirtanLoading(true)}
                onStalled={() => {
                  setIsKirtanLoading(true);
                  if (kirtanPlaybackRequestedRef.current && !kirtanPausedByUserRef.current) {
                    scheduleKirtanReconnect();
                  }
                }}
                onError={() => {
                  setIsKirtanPlaying(false);
                  setIsKirtanLoading(false);
                  scheduleKirtanReconnect();
                }}
              />
            </div>
            <span className="hidden text-blue-200 xl:inline">|</span>
            <div
              className="group relative hidden xl:block"
              onMouseEnter={openDatePopover}
              onMouseLeave={closeDatePopoverWithDelay}
              onFocus={openDatePopover}
              onBlur={closeDatePopoverWithDelay}
            >
              <button
                type="button"
                onClick={() => setDateInfoOpen(true)}
                onMouseEnter={() => {
                  if (profilePopoverCloseTimeoutRef.current) {
                    window.clearTimeout(profilePopoverCloseTimeoutRef.current);
                    profilePopoverCloseTimeoutRef.current = null;
                  }
                  setIsProfilePopoverOpen(false);
                }}
                onFocus={() => {
                  if (profilePopoverCloseTimeoutRef.current) {
                    window.clearTimeout(profilePopoverCloseTimeoutRef.current);
                    profilePopoverCloseTimeoutRef.current = null;
                  }
                  setIsProfilePopoverOpen(false);
                }}
                className="max-w-[260px] truncate whitespace-nowrap rounded-full border border-blue-200/30 px-2 py-1 text-xs font-bold leading-none tracking-tight text-blue-50 transition hover:bg-blue-800/40"
                title="View Nanakshahi date details"
                aria-label="View Nanakshahi date details"
              >
                {nanakshahiDate.labelPa}
              </button>
              <div className={`pointer-events-auto absolute left-0 top-full z-[250] w-[360px] rounded-3xl border-2 border-brand-blue/35 bg-gradient-to-br from-blue-50/95 via-white to-amber-50/95 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.22)] transition duration-200 ${isDatePopoverOpen ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-1 opacity-0'}`}>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">ਅੱਜ</p>
                    <p className="mt-1 text-lg font-bold text-brand-blue">{nanakshahiDate.labelPa}</p>
                    <p className="mt-1 text-xs font-bold text-slate-600">{nanakshahiDate.label} • {dateContext.weekdayEn}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => generateCalendarPdf('compact')}
                      disabled={isPdfBusy}
                      className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border border-brand-blue/25 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:bg-brand-saffron/40 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowDownTrayIcon className="mr-1 h-3.5 w-3.5" />
                      Year Snapshot
                    </button>
                    <button
                      type="button"
                      onClick={() => generateCalendarPdf('detailed')}
                      disabled={isPdfBusy}
                      className="inline-flex h-7 items-center justify-center whitespace-nowrap rounded-full border border-brand-blue/25 bg-white px-3 text-[10px] font-bold text-brand-blue transition hover:bg-brand-saffron/40 hover:text-brand-blue disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ArrowDownTrayIcon className="mr-1 h-3.5 w-3.5" />
                      Current Month
                    </button>
                  </div>
                  {renderNanakshahiCalendar(true)}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(true)}
              className="hidden items-center gap-1.5 rounded-full border border-brand-blue/70 bg-brand-blue/20 px-2.5 py-0.5 text-[11px] font-bold text-blue-50 shadow-[0_6px_12px_rgba(10,77,159,0.28)] transition hover:bg-brand-blue/35 xl:inline-flex"
            >
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
              Search
            </button>
            {!isAuthenticated ? (
              <Link to="/login?mode=join&next=/family-dashboard" onClick={handleBecomeMemberClick} className="rounded-full border border-brand-saffron bg-brand-saffron px-3 py-1 text-[11px] font-extrabold text-brand-navy shadow-[0_8px_18px_rgba(245,166,35,0.4)] transition hover:-translate-y-0.5 hover:bg-amber-300">Become Member</Link>
            ) : null}
            {isAuthenticated ? (
              <div className="relative flex items-center gap-2">
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  className="h-7 w-7 rounded-full border border-brand-saffron/80 object-cover shadow-[0_4px_10px_rgba(15,23,42,0.24)]"
                  onError={(event) => {
                    const fallback = getAvatarFallbackUrl(userDisplayName);
                    if (event.currentTarget.src !== fallback) {
                      event.currentTarget.src = fallback;
                    }
                  }}
                />
                <span className="text-[11px] font-bold text-blue-50">Welcome, {userDisplayName}</span>
                <button
                  type="button"
                  onClick={() => setIsProfilePopoverOpen((previous) => !previous)}
                  onMouseEnter={openProfilePopover}
                  onMouseLeave={closeProfilePopoverWithDelay}
                  onFocus={openProfilePopover}
                  onBlur={closeProfilePopoverWithDelay}
                  aria-expanded={isProfilePopoverOpen}
                  className="inline-flex items-center gap-1.5 rounded-full border border-brand-saffron bg-brand-saffron px-2.5 py-0.5 text-[11px] font-bold text-brand-navy shadow-[0_6px_12px_rgba(245,166,35,0.3)] transition hover:bg-amber-300"
                >
                  <span>Details</span>
                </button>
                <div className="pointer-events-auto absolute right-0 top-full z-[275] h-4 w-full min-w-[360px]" />
                <div onMouseEnter={openProfilePopover} onMouseLeave={closeProfilePopoverWithDelay} className={`absolute right-0 top-[calc(100%+8px)] z-[276] w-[360px] rounded-3xl border border-brand-blue/35 bg-gradient-to-br from-blue-50/95 via-white to-amber-50/95 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)] transition duration-200 ${isProfilePopoverOpen ? 'pointer-events-auto translate-y-0 opacity-100' : 'pointer-events-none translate-y-1 opacity-0'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={userAvatarUrl}
                        alt={userDisplayName}
                        className="h-12 w-12 rounded-full border-2 border-brand-saffron object-cover"
                        onError={(event) => {
                          const fallback = getAvatarFallbackUrl(userDisplayName);
                          if (event.currentTarget.src !== fallback) {
                            event.currentTarget.src = fallback;
                          }
                        }}
                      />
                      <div>
                        <p className="text-sm font-extrabold text-brand-blue">{userDisplayName}</p>
                        <p className="text-xs font-semibold text-slate-600">{userDisplayEmail}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 transition hover:bg-rose-100"
                    >
                      <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
                      Logout
                    </button>
                  </div>

                  <div className="mt-2.5 grid grid-cols-2 grid-rows-2 gap-2">
                    <div className="flex h-[62px] flex-col justify-center rounded-xl border border-brand-blue/20 bg-white px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Event RSVPs</p>
                      <p className="mt-0.5 text-base font-black leading-none text-brand-blue">{familySummary.eventCount}</p>
                      <p className="mt-0.5 text-[10px] text-amber-700">Waitlist: {familySummary.waitlistCount}</p>
                    </div>
                    <div className="row-span-2 flex min-h-[126px] flex-col items-start justify-start rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Donations</p>
                      <p className="mt-1 text-[1.85rem] font-black leading-none text-emerald-700">{formatCompactDonationTotal(familySummary.donationTotal)}</p>
                    </div>
                    <div className="flex h-[62px] flex-col justify-center rounded-xl border border-brand-blue/20 bg-white px-2 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Seva Applications</p>
                      <p className="mt-0.5 text-base font-black leading-none text-brand-blue">{familySummary.sevaCount}</p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2">
                    <button type="button" onClick={openProfileModal} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue hover:bg-blue-50">
                      <UserCircleIcon className="h-4.5 w-4.5" />
                      Profile
                    </button>
                    <Link to="/events" onClick={handleProfileQuickLink('/events')} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue hover:bg-blue-50">
                      <CalendarDaysIcon className="h-4.5 w-4.5" />
                      Events
                    </Link>
                    <Link to="/seva" onClick={handleProfileQuickLink('/seva')} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue hover:bg-blue-50">
                      <HandRaisedIcon className="h-4.5 w-4.5" />
                      Seva
                    </Link>
                    <Link to="/donation" onClick={handleProfileQuickLink('/donation')} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue hover:bg-blue-50">
                      <HeartIcon className="h-4.5 w-4.5" />
                      Donation
                    </Link>
                  </div>

                  <Link to="/family-dashboard" onClick={handleProfileQuickLink('/family-dashboard')} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-saffron bg-brand-saffron px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-navy transition hover:bg-amber-300">
                    <SparklesIcon className="h-4 w-4" />
                    Open Family Dashboard
                  </Link>
                  {canSeeAdminPortalButton ? (
                    <Link to="/admin" onClick={handleProfileQuickLink('/admin')} className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-brand-blue/30 bg-gradient-to-r from-brand-blue via-blue-600 to-brand-saffron px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(10,77,159,0.28)] transition hover:from-blue-700 hover:via-brand-blue hover:to-amber-500">
                      Go to Admin Portal
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : (
              <Link to="/login" onClick={handleSignInClick} className="rounded-full border border-brand-blue bg-brand-blue px-3 py-1 text-[11px] font-extrabold text-white shadow-[0_8px_18px_rgba(10,77,159,0.42)] transition hover:-translate-y-0.5 hover:bg-blue-700">Sign In</Link>
            )}
          </div>
        </div>
      </div>

      <div className="w-full bg-slate-900/92 xl:mt-2">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className={`relative hidden items-center transition-[min-height,padding] duration-300 ease-in-out xl:flex ${isCompact ? 'min-h-[86px] py-2' : 'min-h-[146px] py-2'}`}>
          <Link
            to="/"
            className={`absolute left-1/2 top-1/2 z-20 flex -translate-y-1/2 -translate-x-1/2 items-center justify-center text-brand-blue transition-all duration-300 ease-in-out ${isCompact ? 'pointer-events-none opacity-0 scale-[0.94]' : 'pointer-events-auto opacity-100 scale-100'}`}
            aria-hidden={isCompact}
            tabIndex={isCompact ? -1 : 0}
          >
            <img
              src={gurdwaraLogo}
              alt="Gurdwara Singh Sabha Milton logo"
              className="h-[7.7rem] w-[7.7rem] rounded-full border-2 border-brand-saffron object-cover shadow-[0_4px_16px_rgba(245,166,35,0.25)] transition-all duration-300 ease-in-out"
            />
          </Link>

          <Link
            to="/"
            preventScrollReset={isCompact}
            onClick={isCompact ? handleCompactNavClick : undefined}
            className={`absolute left-0 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center text-brand-blue transition-all duration-300 ease-in-out ${isCompact ? 'pointer-events-auto opacity-100 translate-x-0 scale-100' : 'pointer-events-none opacity-0 -translate-x-2 scale-[0.92]'}`}
            aria-hidden={!isCompact}
            tabIndex={isCompact ? 0 : -1}
          >
            <img
              src={gurdwaraLogo}
              alt="Gurdwara Singh Sabha Milton logo"
              className="h-[4.5rem] w-[4.5rem] rounded-full border-2 border-brand-saffron object-cover shadow-[0_4px_16px_rgba(245,166,35,0.25)] transition-all duration-300 ease-in-out"
            />
          </Link>

          {!isCompact ? (
            <>
              <nav className="flex w-full items-center justify-start gap-2 pr-10" aria-label="Left navigation">
                {leftMenuBalanced.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink key={item.path} to={item.path} className={navClass}>
                      <span className="inline-flex items-center gap-2"><Icon className={iconClass} /> {item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="w-[7.5rem] shrink-0" aria-hidden="true" />

              <div className="flex w-full items-center justify-end pl-10">
                <nav className="flex w-full items-center justify-end gap-2" aria-label="Right navigation">
                  {rightMenuBalanced.map((item) => {
                    const Icon = item.icon;
                    return (
                      <NavLink key={item.path} to={item.path} preventScrollReset className={navClass}>
                        <span className="inline-flex items-center gap-2"><Icon className={iconClass} /> {item.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>
              </div>
            </>
          ) : (
            <div className="grid w-full grid-cols-[minmax(0,1fr)_minmax(210px,36%)] items-center gap-2 pl-[5.4rem]">
              <nav className="flex min-w-0 items-center overflow-x-auto pr-2" aria-label="Compact navigation">
                {compactMenuItems.map((item) => {
                  const isLastItem = item.path === compactMenuItems[compactMenuItems.length - 1]?.path;

                  return (
                    <span key={item.path} className="inline-flex items-center whitespace-nowrap">
                      <NavLink to={item.path} preventScrollReset onClick={handleCompactNavClick} className={compactNavClass}>
                        {item.label}
                      </NavLink>
                      {!isLastItem ? (
                        <span aria-hidden="true" className="mx-2 inline-flex items-center justify-center text-[18px] font-black leading-none text-brand-blue">·</span>
                      ) : null}
                    </span>
                  );
                })}
              </nav>

              <div className="flex min-w-0 items-center justify-end pr-2">
                {liveStreams.length > 0 ? (
                  <button
                    type="button"
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openCompactStreams();
                    }}
                    onTouchStart={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openCompactStreams();
                    }}
                    onClick={openCompactStreams}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-blue-100/35 bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-brand-blue shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-blue-100/70"
                  >
                    <span className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-amber-100 text-brand-blue shadow-inner">
                      <LiveStreamGlyph />
                    </span>
                    <span>View all live channels</span>
                  </button>
                ) : null}
              </div>
            </div>
          )}
        </div>

      </div>
      </div>

      <div className="bg-slate-900/92 px-4 py-2 xl:hidden">
        <div className="relative flex min-h-[3.7rem] items-center justify-between py-1">
          <div className="flex items-center justify-start">
            <Link to="/" className="inline-flex items-center" aria-label="Go to homepage">
              <img
                src={gurdwaraLogo}
                alt="Gurdwara Singh Sabha Milton logo"
                className="h-[3.55rem] w-[3.55rem] rounded-full border border-brand-saffron object-cover"
              />
            </Link>
          </div>

          <div className="pointer-events-none absolute inset-x-0 top-1/2 z-[205] -translate-y-1/2 px-[4.25rem] md:px-[5.5rem]">
            <div className="pointer-events-auto flex items-center justify-center gap-1.5 whitespace-nowrap">
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  armBackdropGuard(searchBackdropGuardRef, searchBackdropGuardTimeoutRef);
                  setIsSearchModalOpen(true);
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  armBackdropGuard(searchBackdropGuardRef, searchBackdropGuardTimeoutRef);
                  setIsSearchModalOpen(true);
                }}
                onClick={() => {
                  armBackdropGuard(searchBackdropGuardRef, searchBackdropGuardTimeoutRef);
                  setIsSearchModalOpen(true);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-sky-300 bg-sky-100 text-sky-900 touch-manipulation select-none md:w-auto md:gap-1 md:px-2.5"
                aria-label="Open search"
                title="Search"
              >
                <MagnifyingGlassIcon className="h-3.5 w-3.5" />
                <span className="hidden text-[10px] font-bold md:inline">Search</span>
              </button>
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  armBackdropGuard(dateInfoBackdropGuardRef, dateInfoBackdropGuardTimeoutRef);
                  setDateInfoOpen(true);
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  armBackdropGuard(dateInfoBackdropGuardRef, dateInfoBackdropGuardTimeoutRef);
                  setDateInfoOpen(true);
                }}
                onClick={() => {
                  armBackdropGuard(dateInfoBackdropGuardRef, dateInfoBackdropGuardTimeoutRef);
                  setDateInfoOpen(true);
                }}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-brand-blue/30 bg-gradient-to-r from-white via-blue-50 to-amber-50 text-brand-blue touch-manipulation select-none md:w-auto md:gap-1 md:px-2.5"
                aria-label="Open calendar"
                title="Calendar"
              >
                <CalendarDaysIcon className="h-3.5 w-3.5" />
                <span className="hidden text-[10px] font-bold md:inline">Calendar</span>
              </button>
              {liveStreams.length > 0 ? (
                <button
                  type="button"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openCompactStreams();
                  }}
                  onTouchStart={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    openCompactStreams();
                  }}
                  onClick={openCompactStreams}
                  className="inline-flex items-center gap-1 rounded-full bg-brand-blue px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(10,77,159,0.35)] touch-manipulation select-none"
                >
                  <LiveStreamGlyph />
                  Live
                </button>
              ) : null}
            </div>
          </div>

          <div className="relative z-[245] flex items-center justify-end gap-1.5">
            {isAuthenticated ? (
              <button
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  armBackdropGuard(compactLanyardBackdropGuardRef, compactLanyardBackdropGuardTimeoutRef);
                  setOpen(false);
                  setIsCompactProfileLanyardOpen(true);
                }}
                onTouchStart={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  armBackdropGuard(compactLanyardBackdropGuardRef, compactLanyardBackdropGuardTimeoutRef);
                  setOpen(false);
                  setIsCompactProfileLanyardOpen(true);
                }}
                onClick={() => {
                  armBackdropGuard(compactLanyardBackdropGuardRef, compactLanyardBackdropGuardTimeoutRef);
                  setOpen(false);
                  setIsCompactProfileLanyardOpen(true);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/10 p-0.5 touch-manipulation select-none"
                aria-label="Open profile lanyard"
                aria-expanded={isCompactProfileLanyardOpen}
              >
                <img
                  src={userAvatarUrl}
                  alt={userDisplayName}
                  className="h-8 w-8 rounded-full border border-brand-saffron/80 object-cover shadow-[0_4px_10px_rgba(15,23,42,0.24)]"
                  onError={(event) => {
                    const fallback = getAvatarFallbackUrl(userDisplayName);
                    if (event.currentTarget.src !== fallback) {
                      event.currentTarget.src = fallback;
                    }
                  }}
                />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setIsCompactProfileLanyardOpen(false);
                setOpen((prev) => !prev);
              }}
              className="z-[240] rounded-lg p-2 text-white"
              aria-label="Open mobile menu"
              aria-expanded={open}
            >
              {open ? <XMarkIcon className="h-6 w-6" /> : <Bars3Icon className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {!isCompact ? (
        <div className="hidden border-b-2 border-brand-blue/45 bg-slate-900/92 pb-5 pt-1 xl:block">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 md:px-6">
              {miltonPrimaryStream ? (
                <div className="flex justify-center pt-0.5 pb-3">
                  <button
                    type="button"
                    onClick={() => openStreamModal(miltonPrimaryStream.id)}
                    className="inline-flex items-center gap-2 rounded-full border-2 border-brand-saffron bg-brand-blue px-6 py-2 text-xs font-extrabold uppercase tracking-wider text-white shadow-[0_10px_28px_rgba(10,77,159,0.45)] transition hover:-translate-y-0.5 hover:bg-blue-700 [animation:pulse_2.1s_ease-in-out_infinite]"
                  >
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-brand-saffron" />
                    Milton Gurdwara Live Stream
                  </button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              {secondaryLiveStreams.length > 0
            ? secondaryLiveStreams.map((stream) => {
                const title = stream.title || 'Live Stream';
                const buttonLabel = title.length > 50 ? `${title.slice(0, 50)}...` : title;

                return (
                    <button
                    key={stream.id}
                    type="button"
                    onClick={() => openStreamModal(stream.id)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue/20 bg-gradient-to-r from-white via-blue-50 to-amber-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-brand-blue shadow-[0_4px_14px_rgba(15,23,42,0.08)] transition hover:-translate-y-0.5 hover:border-brand-blue/40"
                  >
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-amber-100 text-brand-blue shadow-inner">
                      <LiveStreamGlyph />
                    </span>
                    <span className="max-w-[320px] animate-pulse truncate">{buttonLabel}</span>
                  </button>
                );
              })
            : null}
              </div>
        </div>
        </div>
      ) : null}

      {compactStreamsOpen ? createPortal(
        <div className="fixed inset-0 z-[220] overflow-y-auto bg-slate-950/60 px-4 py-6" onClick={() => {
          if (compactStreamsBackdropGuardRef.current) {
            compactStreamsBackdropGuardRef.current = false;
            return;
          }
          setCompactStreamsOpen(false);
        }}>
          <div className="flex min-h-full items-center justify-center">
            <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <h3 className="inline-flex items-center gap-2 text-lg font-bold text-brand-blue">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-brand-blue">
                    <YouTubeGlyph />
                  </span>
                  Live Streaming
                </h3>
                <button
                  type="button"
                  onClick={() => setCompactStreamsOpen(false)}
                  className="rounded-full border border-brand-blue/40 bg-blue-50 p-1.5 text-brand-blue transition hover:border-brand-saffron hover:bg-amber-100 hover:text-amber-700"
                  aria-label="Close live channels list"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="px-3 pt-3">
                <AudioPillPlayer
                  label="Live Kirtan"
                  subtitle="Sri Darbar Sahib audio"
                  src={siteConfig.liveKirtanStreamUrl}
                  stream
                  className="w-full"
                />
              </div>
              <ul className="max-h-[60vh] overflow-y-auto px-2 py-2">
                {miltonPrimaryStream ? (
                  <li className="px-1 pb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCompactStreamsOpen(false);
                        openStreamModal(miltonPrimaryStream.id);
                      }}
                      className="flex w-full items-center justify-between rounded-lg border border-brand-blue/20 bg-blue-50 px-3 py-2 text-left"
                    >
                      <span className="text-sm font-extrabold uppercase tracking-wide text-brand-blue">Milton Gurdwara Live Stream</span>
                      <span className="inline-flex shrink-0 rounded-full bg-brand-blue px-2 py-0.5 text-[11px] font-semibold text-white">Watch</span>
                    </button>
                  </li>
                ) : null}
                {secondaryLiveStreams.map((stream) => (
                  <li key={stream.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCompactStreamsOpen(false);
                        openStreamModal(stream.id);
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-blue-50"
                    >
                      <span className="flex min-w-0 items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-brand-blue">
                          <PlayCircleIcon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-brand-blue">{stream.title || 'Live Stream'}</span>
                          <span className="mt-0.5 block truncate text-xs text-slate-500">{stream.text || 'Open channel'}</span>
                        </span>
                      </span>
                      <span className="ml-3 inline-flex items-center gap-2">
                        <span className="inline-flex shrink-0 rounded-full border border-brand-blue/20 bg-white px-2 py-0.5 text-[11px] font-semibold text-brand-blue">Open</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      , document.body) : null}

      {isCompactProfileLanyardOpen ? createPortal(
        <div className="fixed inset-0 z-[260] overflow-y-auto bg-slate-950/55 px-4 py-6 xl:hidden" onClick={() => {
          if (compactLanyardBackdropGuardRef.current) {
            compactLanyardBackdropGuardRef.current = false;
            return;
          }
          setIsCompactProfileLanyardOpen(false);
        }}>
          <div className="flex min-h-full items-start justify-end pt-16 md:pt-20">
            <div className="w-full max-w-sm rounded-3xl border border-brand-blue/35 bg-gradient-to-br from-blue-50/95 via-white to-amber-50/95 p-4 shadow-[0_24px_60px_rgba(15,23,42,0.24)]" onClick={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={userAvatarUrl}
                    alt={userDisplayName}
                    className="h-12 w-12 rounded-full border-2 border-brand-saffron object-cover"
                    onError={(event) => {
                      const fallback = getAvatarFallbackUrl(userDisplayName);
                      if (event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-brand-blue">{userDisplayName}</p>
                    <p className="truncate text-xs font-semibold text-slate-600">{userDisplayEmail}</p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700"
                  >
                    <ArrowRightOnRectangleIcon className="h-3.5 w-3.5" />
                    Logout
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsCompactProfileLanyardOpen(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600"
                    aria-label="Close profile lanyard"
                    title="Close"
                  >
                    <XMarkIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-emerald-200 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Donations</p>
                  <p className="mt-1 text-xl font-black leading-none text-emerald-700">{formatCompactDonationTotal(familySummary.donationTotal)}</p>
                </div>
                <div className="rounded-xl border border-brand-blue/20 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Event RSVPs</p>
                  <p className="mt-1 text-lg font-black leading-none text-brand-blue">{familySummary.eventCount}</p>
                  <p className="mt-0.5 text-[10px] text-amber-700">Waitlist: {familySummary.waitlistCount}</p>
                </div>
                <div className="col-span-2 rounded-xl border border-brand-blue/20 bg-white px-2.5 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Seva Applications</p>
                  <p className="mt-1 text-lg font-black leading-none text-brand-blue">{familySummary.sevaCount}</p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <button type="button" onClick={openProfileModal} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue">
                  <UserCircleIcon className="h-4.5 w-4.5" />
                  Profile
                </button>
                <Link to="/events" onClick={handleProfileQuickLink('/events')} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue">
                  <CalendarDaysIcon className="h-4.5 w-4.5" />
                  Events
                </Link>
                <Link to="/seva" onClick={handleProfileQuickLink('/seva')} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue">
                  <HandRaisedIcon className="h-4.5 w-4.5" />
                  Seva
                </Link>
                <Link to="/donation" onClick={handleProfileQuickLink('/donation')} className="inline-flex flex-col items-center rounded-xl border border-brand-blue/25 bg-white px-2 py-1.5 text-[10px] font-bold text-brand-blue">
                  <HeartIcon className="h-4.5 w-4.5" />
                  Donate
                </Link>
              </div>

              <Link to="/family-dashboard" onTouchEnd={handleCompactProfileLinkTouch('/family-dashboard')} onClick={handleProfileQuickLink('/family-dashboard')} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full border border-brand-saffron bg-brand-saffron px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-brand-navy transition hover:bg-amber-300 touch-manipulation select-none">
                <SparklesIcon className="h-4 w-4" />
                Open Family Dashboard
              </Link>
              {canSeeAdminPortalButton ? (
                <Link to="/admin" onTouchEnd={handleCompactProfileLinkTouch('/admin')} onClick={handleProfileQuickLink('/admin')} className="mt-2 inline-flex w-full items-center justify-center rounded-full border border-brand-blue/30 bg-gradient-to-r from-brand-blue via-blue-600 to-brand-saffron px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white shadow-[0_8px_20px_rgba(10,77,159,0.28)] transition hover:from-blue-700 hover:via-brand-blue hover:to-amber-500 touch-manipulation select-none">
                  Go to Admin Portal
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      , document.body) : null}

      {dateInfoOpen ? createPortal(
        <div className="fixed inset-0 z-[230] overflow-y-auto bg-slate-950/65 px-4 py-6" onClick={() => {
          if (dateInfoBackdropGuardRef.current) {
            dateInfoBackdropGuardRef.current = false;
            return;
          }
          setDateInfoOpen(false);
        }}>
          <div className="flex min-h-full items-center justify-center">
            <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
              <div className="sticky top-0 z-20 flex items-center justify-between border-b border-blue-900 bg-brand-blue px-4 py-3">
                <h3 className="text-lg font-bold text-white">Nanakshahi Date Details</h3>
                <button
                  type="button"
                  onClick={() => setDateInfoOpen(false)}
                  className="rounded-full border border-white/60 bg-blue-900/30 p-1.5 text-white transition hover:border-brand-saffron hover:bg-amber-100 hover:text-amber-700"
                  aria-label="Close Nanakshahi date details"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-4 p-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Today</p>
                  <p className="mt-1 text-xl font-bold text-brand-blue">{nanakshahiDate.labelPa}</p>
                  <p className="mt-1 text-sm font-bold text-slate-700">{nanakshahiDate.label} • {dateContext.weekdayEn}</p>
                </div>

                {renderNanakshahiCalendar()}

                <div ref={mobileNanakshahiDetailsRef} className="rounded-xl border border-amber-200 bg-amber-50 p-3 xl:hidden">
                  <p className="text-sm font-semibold text-amber-900">Selected day</p>
                  {(() => {
                    const selectedCell = nanakshahiMonthCalendar.weeks.flat().find((cell) => {
                      if (!cell) {
                        return false;
                      }

                      const gregorianKey = `${cell.gregorianDate.getFullYear()}-${String(cell.gregorianDate.getMonth() + 1).padStart(2, '0')}-${String(cell.gregorianDate.getDate()).padStart(2, '0')}`;
                      return gregorianKey === selectedNanakshahiDateKey;
                    }) || nanakshahiMonthCalendar.weeks.flat().find((cell) => {
                      if (!cell) {
                        return false;
                      }

                      const gregorianKey = `${cell.gregorianDate.getFullYear()}-${String(cell.gregorianDate.getMonth() + 1).padStart(2, '0')}-${String(cell.gregorianDate.getDate()).padStart(2, '0')}`;
                      return gregorianKey === todayGregorianKey;
                    }) || null;

                    if (!selectedCell || !selectedCell.hasObservance || selectedCell.observances.length === 0) {
                      return <p className="mt-1 text-sm text-amber-800">No event for today.</p>;
                    }

                    const selectedEnglishDateLabel = new Intl.DateTimeFormat('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric'
                    }).format(selectedCell.gregorianDate);

                    return (
                      <div className="mt-2 space-y-2">
                        {selectedCell.observances.map((event, eventIndex) => {
                          const tone = getObservanceTypeStyles(event.type);

                          return (
                            <div key={`${event.type}-${event.titlePa}-${eventIndex}`} className="rounded-xl border border-amber-200 bg-white p-3">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone.badge}`}>
                                <CalendarDaysIcon className="h-3 w-3 flex-shrink-0" />
                                {event.occasion}
                              </span>
                              <p className={`mt-2 text-sm font-bold ${tone.title}`}>{event.titlePa}</p>
                              <p className="text-xs font-semibold text-slate-700">{event.title}</p>
                              <p className="mt-1 text-[11px] font-semibold tracking-wide text-slate-600">{selectedEnglishDateLabel}</p>
                              <p className="mt-1 text-xs leading-relaxed text-slate-600">{event.blurbPa}</p>
                              <p className="mt-1 text-xs leading-relaxed text-slate-600">{event.blurb}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <div className="hidden rounded-xl border border-blue-100 bg-blue-50/60 p-3 xl:block">
                  <p className="text-sm font-semibold text-slate-800">ਅੱਜ ਦੀ ਰੂਹਾਨੀ ਸੋਚ</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{dateContext.insight.pa}</p>
                </div>

                <div className="hidden rounded-xl border border-slate-200 bg-white p-3 xl:block">
                  <p className="text-sm font-semibold text-slate-800">Today’s Significance</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-700">{dateContext.insight.en}</p>
                </div>

                {todayObservance ? (
                  <div className="hidden rounded-xl border border-amber-200 bg-amber-50 p-3 xl:block">
                    <p className="text-sm font-semibold text-amber-900">Today in Sikh Calendar</p>
                    <p className="mt-1 text-sm font-semibold text-amber-900">{todayObservance.titlePa}</p>
                    <p className="text-sm text-amber-800">{todayObservance.title}</p>
                    <p className="mt-1 text-xs font-semibold text-amber-900/90">{todayObservance.nanakshahiLabelPa}</p>
                    {todayObservance.hasAlternateNanakshahiLabel ? (
                      <p className="text-xs text-amber-800/90">Alternate published date: {todayObservance.alternateNanakshahiLabel}</p>
                    ) : null}
                    {todayObservance.significanceEn ? (
                      <p className="mt-1 text-xs text-amber-800">{todayObservance.significanceEn}</p>
                    ) : null}
                  </div>
                ) : (
                  <div className="hidden rounded-xl border border-slate-200 bg-slate-50 p-3 xl:block">
                    <p className="text-sm text-slate-700">No major fixed observance is listed for today in the current calendar set.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      , document.body) : null}

      {streamModalState.open ? (
        <StreamingModal
          open={streamModalState.open}
          streams={liveStreams}
          initialStreamId={streamModalState.id || featuredStream?.id || ''}
          onClose={() => setStreamModalState({ open: false, id: '' })}
        />
      ) : null}

      {membershipPromptNotice ? (
        <div className="fixed inset-0 z-[285] flex items-start justify-center bg-slate-900/45 px-4 py-20 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">Approval Pending</p>
            <p className="mt-3 text-sm font-semibold leading-6 text-amber-900">{membershipPromptNotice}</p>
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setMembershipPromptNotice('')}
                className="rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMembershipModalOpen ? createPortal(
        <div className="fixed inset-0 z-[279] overflow-y-auto bg-slate-900/70 px-4 py-6 backdrop-blur-md" onClick={closeMembershipModal}>
          <div className="mx-auto flex min-h-full items-start justify-center py-2 lg:items-center lg:py-6">
            <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl bg-white shadow-2xl lg:max-h-none lg:overflow-visible" onClick={(event) => event.stopPropagation()}>
              <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-brand-blue via-blue-700 to-brand-saffron px-5 py-4 text-white">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.26),transparent_44%)]" aria-hidden="true" />
                <div className="relative flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <img src={gurdwaraLogo} alt="Gurdwara Singh Sabha Milton" className="h-14 w-14 rounded-full border-2 border-white/70 bg-white object-cover" />
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/85">Gurdwara Singh Sabha Milton</p>
                      <h3 className="mt-1 font-heading text-lg font-semibold">Membership Registration Form</h3>
                    </div>
                  </div>
                  <button type="button" onClick={closeMembershipModal} className="rounded-full border border-white/55 bg-white/10 p-1.5 text-white hover:bg-white/20" aria-label="Close membership details modal">
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <form className="grid gap-4 px-5 py-4 lg:grid-cols-2" onSubmit={handleSaveMembershipDetails}>
                <p className="lg:col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold leading-5 text-amber-900">
                  To become a lifetime member of Gurdwara Singh Sabha Milton (GSSM), please complete the form below. An initiation fee of $500 is due upon signup. Going forward, membership will need to be renewed as of January 1st of the following year, at a cost of $50 per month to maintain your membership in good standing. After completing 10 years of $50 monthly donations, your membership will become permanent at no cost.
                </p>
                <section className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">Personal Details</h4>
                  <div className="h-px w-full bg-slate-200" />
                  <label className="block text-sm font-semibold text-slate-700">Phone
                    <input
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel"
                      maxLength={14}
                      placeholder="(905)-123-4567"
                      value={membershipForm.phone}
                      onChange={handleMembershipPhoneChange}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-700">Date of Birth
                    <input type="date" value={membershipForm.dateOfBirth} onChange={handleMembershipFieldChange('dateOfBirth')} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                  </label>
                  <div className="relative">
                    <label htmlFor="membership-address" className="block text-sm font-semibold text-slate-700">Address</label>
                    <input
                      id="membership-address"
                      type="search"
                      autoComplete="street-address"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={showAddressSuggestions && addressSuggestions.length > 0}
                      aria-controls="membership-address-suggestions"
                      placeholder="Start typing your Canadian address"
                      value={membershipForm.address}
                      onChange={handleMembershipAddressChange}
                      onFocus={() => setShowAddressSuggestions(true)}
                      onBlur={() => window.setTimeout(() => setShowAddressSuggestions(false), 150)}
                      required
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2"
                    />
                    {isAddressSearching ? <p className="mt-1 text-xs font-medium text-slate-500">Searching addresses...</p> : null}
                    {addressSearchError ? <p className="mt-1 text-xs font-medium text-amber-700">{addressSearchError}</p> : null}
                    {showAddressSuggestions && addressSuggestions.length > 0 ? (
                      <div id="membership-address-suggestions" role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
                        {addressSuggestions.map((suggestion) => (
                          <button
                            key={suggestion.id}
                            type="button"
                            role="option"
                            aria-selected={membershipForm.address === suggestion.label}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleMembershipAddressSelect(suggestion.label)}
                            className="block w-full rounded-lg px-3 py-2 text-left text-xs leading-5 text-slate-700 hover:bg-blue-50 hover:text-brand-blue"
                          >
                            {suggestion.label}
                          </button>
                        ))}
                        <p className="border-t border-slate-100 px-3 py-1.5 text-[10px] text-slate-400">Address data © OpenStreetMap contributors</p>
                      </div>
                    ) : null}
                  </div>
                </section>

                <section className="space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">Citizenship and Donation Method</h4>
                  <div className="h-px w-full bg-slate-200" />
                  <label className="block text-sm font-semibold text-slate-700">Canadian Status *
                    <select value={membershipForm.canadianStatus} onChange={handleMembershipFieldChange('canadianStatus')} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                      <option value="">Select Canadian Status</option>
                      <option value="Citizen">Citizen</option>
                      <option value="Permanent Resident">Permanent Resident</option>
                      <option value="Immigrant">Immigrant</option>
                    </select>
                  </label>
                  <div className="grid gap-2 md:grid-cols-[minmax(0,220px)_1fr] md:items-end">
                    <label className="block text-sm font-semibold text-slate-700 md:pr-4">Donation Method *
                      <select value={membershipForm.donationMethod} onChange={handleMembershipFieldChange('donationMethod')} required className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                        <option value="">Select Method</option>
                        <option value="Interac E-Transfer">Interac E-Transfer</option>
                        <option value="Cash at Gurdwara">Cash at Gurdwara</option>
                      </select>
                    </label>
                    <fieldset className="min-w-0">
                      <legend className="text-sm font-semibold text-slate-700">Schedule *</legend>
                      <div className="mt-1 flex flex-nowrap items-center gap-4 pl-2 md:justify-start">
                        <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="donation-schedule"
                          checked={membershipForm.donationSchedule === 'monthly'}
                          onChange={() => setMembershipForm((previous) => ({ ...previous, donationSchedule: 'monthly' }))}
                        />
                        Monthly
                      </label>
                        <label className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700">
                        <input
                          type="radio"
                          name="donation-schedule"
                          checked={membershipForm.donationSchedule === 'yearly'}
                          onChange={() => setMembershipForm((previous) => ({ ...previous, donationSchedule: 'yearly' }))}
                        />
                        Yearly
                      </label>
                      </div>
                    </fieldset>
                  </div>
                  <label className="block text-sm font-semibold text-slate-700">Additional Notes
                    <textarea rows={2} value={membershipForm.notes} onChange={handleMembershipFieldChange('notes')} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" />
                  </label>
                </section>

                <label className="lg:col-span-2 inline-flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                  <input type="checkbox" checked={membershipForm.membershipPledgeAccepted} onChange={handleMembershipFieldChange('membershipPledgeAccepted')} className="mt-1" />
                  <span>
                    I hereby pledge that upon becoming a member of Gurdwara Singh Sabha Milton, I will wholeheartedly commit myself to upholding the rules and regulations set forth by the Executive Committee of Gurdwara Singh Sabha Milton.
                  </span>
                </label>

                {membershipFormError ? <p className="lg:col-span-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{membershipFormError}</p> : null}

                <div className="lg:col-span-2 flex items-center justify-end gap-2 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={handleCancelMembershipRegistration}
                    aria-label="Delete pending member profile"
                    disabled={cancelMembershipMutation.isPending || membershipDetailsMutation.isPending}
                    className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-60"
                  >
                    {cancelMembershipMutation.isPending ? 'Cancelling...' : 'Cancel Registration'}
                  </button>
                  <button
                    type="submit"
                    disabled={membershipDetailsMutation.isPending || cancelMembershipMutation.isPending}
                    className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {membershipDetailsMutation.isPending ? 'Submitting...' : 'Submit Details'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      , document.body) : null}

      {isProfileModalOpen ? createPortal(
        <div className="fixed inset-0 z-[280] overflow-y-auto bg-slate-900/55 px-4 py-6" onClick={() => setIsProfileModalOpen(false)}>
          <div className="mx-auto flex min-h-full items-center justify-center">
          <div className="w-full max-w-lg max-h-[88vh] overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-heading text-lg font-semibold text-slate-900">Update Profile</h3>
              <button type="button" onClick={() => setIsProfileModalOpen(false)} className="rounded-full border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Close profile modal">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <form className="mt-4 space-y-3" onSubmit={handleSaveProfile}>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {profileForm.avatarUrl ? (
                  <img
                    src={normalizeAvatarUrl(profileForm.avatarUrl, profileForm.name || userDisplayName)}
                    alt={profileForm.name || userDisplayName}
                    className="h-16 w-16 rounded-full border-2 border-brand-saffron object-cover"
                    onError={(event) => {
                      const fallback = getAvatarFallbackUrl(profileForm.name || userDisplayName);
                      if (event.currentTarget.src !== fallback) {
                        event.currentTarget.src = fallback;
                      }
                    }}
                  />
                ) : (
                  <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border-2 border-brand-saffron bg-brand-blue text-xl font-black text-white">{userInitial}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-brand-blue">{profileForm.name || userDisplayName}</p>
                  <p className="truncate text-xs font-semibold text-slate-500">{userDisplayEmail}</p>
                  <label className="mt-2 inline-flex cursor-pointer rounded-full border border-brand-blue/30 bg-white px-3 py-1 text-xs font-bold text-brand-blue hover:bg-blue-50">
                    Upload photo
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfileAvatarSelected} />
                  </label>
                  {isProfileImageUploading ? <p className="mt-1 text-[11px] font-semibold text-slate-500">Uploading {profileImageUploadProgress}%</p> : null}
                </div>
              </div>
              <label className="block text-sm font-semibold text-slate-700">
                Name
                <input value={profileForm.name} onChange={handleProfileFormChange('name')} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-extrabold text-slate-900" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Phone
                <input value={profileForm.phone} onChange={handleProfileFormChange('phone')} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-extrabold text-slate-900" />
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Address (optional)
                <input value={profileForm.address} onChange={handleProfileFormChange('address')} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>

              {profileError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{profileError}</p> : null}
              {profilePhoneMissing ? <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Add a phone number to unlock event, seva, and donation registrations.</p> : null}

              <button type="submit" disabled={isProfileSaving || isProfileImageUploading} className="w-full rounded-lg bg-brand-blue px-3 py-2 text-sm font-bold text-white disabled:opacity-60">
                {isProfileSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </form>
          </div>
          </div>
        </div>
      , document.body) : null}

      {isSearchModalOpen ? createPortal(
        <div className="fixed inset-0 z-[281] overflow-x-hidden overflow-y-auto bg-slate-950/45 px-4 py-8 backdrop-blur-sm sm:px-8 sm:py-12" onClick={() => {
          if (searchBackdropGuardRef.current) {
            searchBackdropGuardRef.current = false;
            return;
          }
          closeSearchModal();
        }}>
          <div className="mx-auto w-full max-w-lg box-border overflow-x-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_30px_70px_-34px_rgba(15,23,42,0.75)] sm:max-w-xl lg:max-w-2xl sm:p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-heading text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Search</h3>
              </div>
              <button
                type="button"
                onClick={closeSearchModal}
                className="rounded-full border border-slate-300 p-1.5 text-slate-600 transition hover:bg-slate-100"
                aria-label="Close search modal"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <GlobalSearchBar
              className="w-full min-w-0 max-w-full px-0"
              panelClassName="!static !left-auto !right-auto !top-auto !z-10 mt-2 max-w-full overflow-x-hidden"
              inputClassName="py-2.5 text-[16px] md:text-sm"
              placeholder="Search website content"
              autoFocus
              inputId="global-search-modal-input"
              scope="public"
              onResultSelect={closeSearchModal}
            />
          </div>
        </div>
      , document.body) : null}

      {open ? (
        <div className="h-[calc(100dvh-6.5rem)] overflow-y-auto border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 px-4 py-3 pb-10 xl:hidden">
          <div className="mb-3 grid gap-2">
            {!isAuthenticated ? (
              <Link
                to="/login?next=/family-dashboard"
                onClick={(event) => {
                  handleBecomeMemberClick(event);
                  setOpen(false);
                }}
                className="rounded-xl border border-brand-saffron bg-brand-saffron px-3 py-2 text-center text-sm font-extrabold text-brand-navy shadow-[0_8px_18px_rgba(245,166,35,0.35)]"
              >
                Become Member
              </Link>
            ) : null}
            {!isAuthenticated ? (
              <Link
              to={isAuthenticated ? resolveLandingPathByRole(user?.role) : '/login'}
              onClick={(event) => {
                handleSignInClick(event);
                setOpen(false);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-blue bg-brand-blue px-3 py-2 text-center text-sm font-extrabold text-white shadow-[0_8px_18px_rgba(10,77,159,0.34)]"
            >
              Sign In
              </Link>
            ) : null}
          </div>
          {isApprovalPending ? (
            <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{PENDING_APPROVAL_MESSAGE}</p>
          ) : null}
          <div className="grid gap-2">
            {mobileMenuItems.map((item) => (
              <NavLink key={item.path} to={item.path} className={mobileDrawerNavClass} onClick={() => setOpen(false)}>
                {item.path === '/hukamnama' ? 'Hukamnama' : item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
};

export default Navbar;
