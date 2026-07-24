import { Navigate, Outlet, useLocation, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const FULL_ACCESS_ROLES = new Set(['Super Admin', 'Admin']);

const ProtectedRoute = ({ allowedRoles = [], allowAssignedAdminAccess = true }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();
  const parentOutletContext = useOutletContext();
  const isAdminRoute = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const isUserActive = user?.isActive !== false;
  const hasFullAccessRole = FULL_ACCESS_ROLES.has(String(user?.role || ''));
  const assignedAdminPages = Array.isArray(user?.adminPageAccess)
    ? user.adminPageAccess.map((path) => String(path || '').trim()).filter(Boolean)
    : [];
  const hasAssignedAdminAccess = assignedAdminPages.length > 0;
  const hasRoleBasedAdminAccess = hasFullAccessRole || hasAssignedAdminAccess;
  const isUserApproved = hasRoleBasedAdminAccess
    ? true
    : String(user?.approvalStatus || 'approved').trim().toLowerCase() === 'approved';

  if (!isAuthenticated) {
    if (isAdminRoute) {
      let adminLogoutInProgress = false;
      let forcedLogoutReason = '';
      try {
        adminLogoutInProgress = window.sessionStorage.getItem('ssm_admin_logout_in_progress') === '1';
        forcedLogoutReason = String(
          window.sessionStorage.getItem('ssm_forced_logout_reason')
          || window.localStorage.getItem('ssm_forced_logout_reason')
          || ''
        ).trim();
        if (adminLogoutInProgress) {
          window.sessionStorage.removeItem('ssm_admin_logout_in_progress');
        }
        if (forcedLogoutReason) {
          window.sessionStorage.removeItem('ssm_forced_logout_reason');
          window.localStorage.removeItem('ssm_forced_logout_reason');
        }
      } catch {
        adminLogoutInProgress = false;
        forcedLogoutReason = '';
      }

      if (adminLogoutInProgress || forcedLogoutReason === 'account_inactive') {
        return <Navigate to="/" state={{ from: location, accessNotice: 'account_inactive' }} replace />;
      }

      const next = `${location.pathname}${location.search || ''}`;
      return <Navigate to={`/login?next=${encodeURIComponent(next)}`} state={{ from: location, accessNotice: 'login_required' }} replace />;
    }

    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (!isUserActive || !isUserApproved) {
    if (isAdminRoute) {
      try {
        window.sessionStorage.setItem('ssm_admin_logout_in_progress', '1');
      } catch {
        // Ignore storage write failures.
      }
    }
    return <Navigate to="/" state={{ from: location, accessNotice: 'account_inactive' }} replace />;
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
