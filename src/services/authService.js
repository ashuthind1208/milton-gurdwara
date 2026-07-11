import { mockResponse } from './mockApi';
import { userRoles } from '../constants/siteConfig';
import userService from './userService';

const mockUser = {
  id: '1',
  name: 'Admin Singh',
  email: 'admin@singhsabhamilton.org',
  role: userRoles.SUPER_ADMIN
};

const getAdminEmails = () => {
  const configured = process.env.REACT_APP_ADMIN_EMAILS || '';
  if (!configured.trim()) {
    return [];
  }
  return configured
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
};

const resolveMemberType = (role) => {
  if (role === userRoles.SUPER_ADMIN || role === userRoles.ADMIN) {
    return 'Admin';
  }
  if (role === userRoles.VOLUNTEER) {
    return 'Volunteer';
  }
  return 'Member';
};

const mapRoleByEmail = (email) => {
  const adminEmails = getAdminEmails();
  const normalizedEmail = String(email || '').toLowerCase();

  // If admin emails are not configured, keep a safe fallback for the seeded admin account only.
  if (adminEmails.length === 0) {
    return normalizedEmail === String(mockUser.email).toLowerCase()
      ? userRoles.SUPER_ADMIN
      : null;
  }

  return adminEmails.includes(normalizedEmail)
    ? userRoles.SUPER_ADMIN
    : null;
};

const getAssignedRole = ({ email, fallbackRole = userRoles.MEMBER }) => mapRoleByEmail(email) || fallbackRole;

const authService = {
  login: async ({ email }) => {
    const resolvedEmail = email || mockUser.email;
    const assignedRole = getAssignedRole({ email: resolvedEmail, fallbackRole: userRoles.MEMBER });
    const persisted = await userService.upsertUserByEmail({
      name: resolvedEmail.split('@')[0],
      email: resolvedEmail,
      role: assignedRole,
      memberType: resolveMemberType(assignedRole),
      authProvider: 'LOCAL',
      registrationComplete: false
    }).then((res) => res.data);

    return mockResponse({
      token: 'mock-jwt-token',
      user: {
        ...mockUser,
        ...persisted,
        email: resolvedEmail,
        role: assignedRole
      }
    });
  },
  loginWithGoogle: async ({ email, name, avatarUrl, intent = 'signin' }) => {
    const resolvedEmail = email || mockUser.email;
    const role = mapRoleByEmail(resolvedEmail);
    const existingUser = await userService.getUserByEmail(resolvedEmail).then((res) => res.data);

    if (intent === 'signin' && !existingUser) {
      const error = new Error('Please register.');
      error.code = 'USER_NOT_REGISTERED';
      throw error;
    }

    const fallbackRole = existingUser?.role || (role || userRoles.MEMBER);
    const assignedRole = getAssignedRole({ email: resolvedEmail, fallbackRole });
    const existingMemberType = resolveMemberType(assignedRole);
    const existingRegistrationComplete = Boolean(existingUser?.registrationComplete);
    const existingApprovalStatus = assignedRole === userRoles.SUPER_ADMIN || assignedRole === userRoles.ADMIN
      ? 'approved'
      : (existingUser?.approvalStatus || 'pending');

    const persisted = await userService.upsertUserByEmail({
      name: existingUser?.name || name || resolvedEmail.split('@')[0],
      email: resolvedEmail,
      role: assignedRole,
      memberType: existingMemberType,
      authProvider: 'GOOGLE',
      avatarUrl: avatarUrl || existingUser?.avatarUrl || existingUser?.picture || existingUser?.photoURL,
      phone: existingUser?.phone || '',
      address: existingUser?.address || '',
      registrationComplete: intent === 'signin' ? true : existingRegistrationComplete,
      approvalStatus: existingApprovalStatus
    }).then((res) => res.data);

    return mockResponse({
      token: `google-mock-token-${Date.now()}`,
      user: {
        ...persisted,
        id: persisted.id,
        name: persisted.name,
        email: resolvedEmail,
        role: assignedRole,
        authProvider: 'GOOGLE'
      },
      wasExistingUser: Boolean(existingUser)
    });
  },
  completeRegistration: async ({ email, name, phone, address, memberType, role, avatarUrl }) => {
    const assignedRole = getAssignedRole({ email, fallbackRole: role || userRoles.MEMBER });
    const updatedUser = await userService.completeRegistration({
      email,
      name,
      phone,
      address,
      memberType: memberType || resolveMemberType(assignedRole),
      role: assignedRole,
      avatarUrl
    }).then((res) => res.data);

    return mockResponse({
      token: `google-mock-token-${Date.now()}`,
      user: {
        ...updatedUser,
        role: getAssignedRole({ email: updatedUser.email, fallbackRole: updatedUser.role || assignedRole })
      }
    });
  },
  getGoogleOAuthUrl: () => {
    const raw = String(process.env.REACT_APP_GOOGLE_OAUTH_URL || '').trim();
    const sanitized = raw.replace(/^['"]|['"]$/g, '');
    if (!sanitized) {
      return '';
    }

    try {
      const parsed = new URL(sanitized);
      if (/accounts\.google\.com$/.test(parsed.hostname)) {
        const redirectUri = `${window.location.origin}/login`;
        parsed.searchParams.set('redirect_uri', redirectUri);

        if (!parsed.searchParams.get('response_type')) {
          parsed.searchParams.set('response_type', 'token');
        }
        if (!parsed.searchParams.get('scope')) {
          parsed.searchParams.set('scope', 'openid email profile');
        }
        if (!parsed.searchParams.get('prompt')) {
          parsed.searchParams.set('prompt', 'select_account');
        }
      }
      return parsed.toString();
    } catch {
      return sanitized;
    }
  },
  logout: async () => mockResponse({ success: true }),
  me: async () => mockResponse({ user: mockUser })
};

export default authService;
