import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ allowedRoles = [] }) => {
  const { isAuthenticated, user } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return <Outlet />;
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
