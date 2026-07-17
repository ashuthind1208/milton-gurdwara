import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import AdminLayout from '../layouts/AdminLayout';
import ProtectedRoute from './ProtectedRoute';
import { userRoles } from '../constants/siteConfig';

const HomePage = lazy(() => import('../pages/Home/HomePage'));
const AboutPage = lazy(() => import('../pages/About/AboutPage'));
const SikhismPage = lazy(() => import('../pages/Sikhism/SikhismPage'));
const GurbaniLibraryPage = lazy(() => import('../pages/GurbaniLibrary/GurbaniLibraryPage'));
const HukamnamaPage = lazy(() => import('../pages/Hukamnama/HukamnamaPage'));
const EventsPage = lazy(() => import('../pages/Events/EventsPage'));
const SevaPage = lazy(() => import('../pages/Seva/SevaPage'));
const FamilyDashboardPage = lazy(() => import('../pages/Family/FamilyDashboardPage'));
const DonationPage = lazy(() => import('../pages/Donation/DonationPage'));
const KidsLearningPage = lazy(() => import('../pages/KidsLearning/KidsLearningPage'));
const DonationDisplayBoardPage = lazy(() => import('../pages/Donation/DonationDisplayBoardPage'));
const DonationSuccessPage = lazy(() => import('../pages/Donation/DonationSuccessPage'));
const GalleryPage = lazy(() => import('../pages/Gallery/GalleryPage'));
const NewsPage = lazy(() => import('../pages/News/NewsPage'));
const LibraryPage = lazy(() => import('../pages/Library/LibraryPage'));
const VideosPage = lazy(() => import('../pages/Videos/VideosPage'));
const FaqPage = lazy(() => import('../pages/FAQ/FaqPage'));
const ContactPage = lazy(() => import('../pages/Contact/ContactPage'));
const LoginPage = lazy(() => import('../pages/Auth/LoginPage'));

const AdminDashboardPage = lazy(() => import('../admin/Dashboard/AdminDashboardPage'));
const AdminCmsPage = lazy(() => import('../admin/CMS/AdminCmsPage'));
const AdminNewsPage = lazy(() => import('../admin/News/AdminNewsPage'));
const AdminSchedulePage = lazy(() => import('../admin/Schedule/AdminSchedulePage'));
const AdminHukamnamaPage = lazy(() => import('../admin/Hukamnama/AdminHukamnamaPage'));
const AdminLangarPage = lazy(() => import('../admin/Langar/AdminLangarPage'));
const AdminSevaOpportunitiesPage = lazy(() => import('../admin/SevaOpportunities/AdminSevaOpportunitiesPage'));
const AdminGalleryPage = lazy(() => import('../admin/Gallery/AdminGalleryPage'));
const AdminLibraryPage = lazy(() => import('../admin/Library/AdminLibraryPage'));
const AdminVideosPage = lazy(() => import('../admin/Videos/AdminVideosPage'));
const AdminStreamingPage = lazy(() => import('../admin/Streaming/AdminStreamingPage'));
const AdminAdvertisementsPage = lazy(() => import('../admin/Advertisements/AdminAdvertisementsPage'));
const AdminSponsorsPage = lazy(() => import('../admin/Sponsors/AdminSponsorsPage'));
const AdminEventsPage = lazy(() => import('../admin/Events/AdminEventsPage'));
const AdminDonationsPage = lazy(() => import('../admin/Donations/AdminDonationsPage'));
const AdminUsersPage = lazy(() => import('../admin/Users/AdminUsersPage'));
const AdminKidsLearningPage = lazy(() => import('../admin/KidsLearning/AdminKidsLearningPage'));
const AdminAuditTrailPage = lazy(() => import('../admin/AuditTrail/AdminAuditTrailPage'));

const LoadingFallback = () => <div className="py-20 text-center text-slate-600">Loading page...</div>;

const FULL_ADMIN_ROLES = [userRoles.SUPER_ADMIN, userRoles.ADMIN];
const LIMITED_ADMIN_ROLES = [userRoles.SUPER_ADMIN, userRoles.ADMIN, userRoles.MEMBER, userRoles.VOLUNTEER];

const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/sikhism" element={<SikhismPage />} />
          <Route path="/gurbani-library" element={<GurbaniLibraryPage />} />
          <Route path="/hukamnama" element={<HukamnamaPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/join" element={<Navigate to="/login?mode=join" replace />} />
          <Route path="/seva" element={<SevaPage />} />
          <Route path="/family-dashboard" element={<FamilyDashboardPage />} />
          <Route path="/donation" element={<DonationPage />} />
          <Route path="/kids-learning" element={<KidsLearningPage />} />
          <Route path="/donationsuccess" element={<DonationSuccessPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/videos" element={<VideosPage />} />
          <Route path="/faq" element={<FaqPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/login" element={<LoginPage />} />
        </Route>

        <Route path="/donation-board" element={<DonationDisplayBoardPage />} />

        <Route element={<ProtectedRoute allowedRoles={FULL_ADMIN_ROLES} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/cms" element={<AdminCmsPage />} />
            <Route path="/admin/news" element={<AdminNewsPage />} />
            <Route path="/admin/schedule" element={<AdminSchedulePage />} />
            <Route path="/admin/langar" element={<AdminLangarPage />} />
            <Route path="/admin/advertisements" element={<AdminAdvertisementsPage />} />
            <Route path="/admin/sponsors" element={<AdminSponsorsPage />} />
            <Route path="/admin/donations" element={<AdminDonationsPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/kids-learning" element={<AdminKidsLearningPage />} />
            <Route path="/admin/audit-trail" element={<AdminAuditTrailPage />} />
          </Route>
        </Route>

        <Route element={<ProtectedRoute allowedRoles={LIMITED_ADMIN_ROLES} />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/hukamnama" element={<AdminHukamnamaPage />} />
            <Route path="/admin/gallery" element={<AdminGalleryPage />} />
            <Route path="/admin/library" element={<AdminLibraryPage />} />
            <Route path="/admin/videos" element={<AdminVideosPage />} />
            <Route path="/admin/streaming" element={<AdminStreamingPage />} />
            <Route path="/admin/seva-opportunities" element={<AdminSevaOpportunitiesPage />} />
            <Route path="/admin/events" element={<AdminEventsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
