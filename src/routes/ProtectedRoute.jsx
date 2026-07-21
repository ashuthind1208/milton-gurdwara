import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [], allowAssignedAdminAccess = true }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const parentOutletContext = useOutletContext();
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const assignedAdminPages = Array.isArray(user?.adminPageAccess)
    ? user.adminPageAccess.map((path) => String(path || '').trim()).filter(Boolean)
    : [];
  const hasAssignedAdminAccess = assignedAdminPages.length > 0;

  if (!isAuthenticated) {
    if (isAdminRoute) {
      let adminLogoutInProgress = false;
      try {
        adminLogoutInProgress = window.sessionStorage.getItem('ssm_admin_logout_in_progress') === '1';
        if (adminLogoutInProgress) {
          window.sessionStorage.removeItem('ssm_admin_logout_in_progress');
        }
      } catch {
        adminLogoutInProgress = false;
      }

      if (adminLogoutInProgress) {
        return <Navigate to="/" replace />;
      }

      const next = `${location.pathname}${location.search || ''}`;
      return <Navigate to={`/login?next=${encodeURIComponent(next)}`} state={{ from: location, accessNotice: 'login_required' }} replace />;
    }

    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    if (allowAssignedAdminAccess && isAdminRoute && hasAssignedAdminAccess) {
      return <Outlet context={parentOutletContext} />;
    }

    return (
      <Navigate
        to="/family-dashboard"
        state={{
          from: location,
          accessDenied: true,
          deniedPath: location.pathname,
          requiredRoles: allowedRoles
        }}
        replace
      />
    );
  }

  return <Outlet context={parentOutletContext} />;
};

export const RegistrationProtectedRoute = () => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login?mode=join" state={{ from: location }} replace />;
  }

  if (!user?.registrationComplete) {
    return <Navigate to="/login?mode=join" state={{ from: location, accessNotice: 'registration_required' }} replace />;
  }

  if (user?.approvalStatus !== 'approved') {
    const accessNotice = user?.approvalStatus === 'rejected' ? 'registration_rejected' : 'approval_pending';
    return <Navigate to="/login?mode=join" state={{ from: location, accessNotice }} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
