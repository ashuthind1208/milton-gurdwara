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

const authService = {
  login: async ({ email }) => {
    const resolvedEmail = email || mockUser.email;
    const persisted = await userService.upsertUserByEmail({
      name: resolvedEmail.split('@')[0],
      email: resolvedEmail,
      role: mapRoleByEmail(resolvedEmail) ? 'Super Admin' : 'Member',
      memberType: mapRoleByEmail(resolvedEmail) ? 'Admin' : 'Member',
      authProvider: 'LOCAL',
      registrationComplete: false
    }).then((res) => res.data);

    return mockResponse({
      token: 'mock-jwt-token',
      user: {
        ...mockUser,
        ...persisted,
        email: resolvedEmail,
        role: mapRoleByEmail(resolvedEmail)
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

    const existingMemberType = existingUser?.memberType || (role ? 'Admin' : 'Member');
    const existingRegistrationComplete = Boolean(existingUser?.registrationComplete);
    const existingApprovalStatus = existingUser?.approvalStatus || (role ? 'approved' : 'pending');

    const persisted = await userService.upsertUserByEmail({
      name: existingUser?.name || name || resolvedEmail.split('@')[0],
      email: resolvedEmail,
      role: role ? 'Super Admin' : 'Member',
      memberType: existingMemberType,
      authProvider: 'GOOGLE',
      avatarUrl: avatarUrl || existingUser?.avatarUrl,
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
        role,
        authProvider: 'GOOGLE'
      },
      wasExistingUser: Boolean(existingUser)
    });
  },
  completeRegistration: async ({ email, name, phone, address, memberType, avatarUrl }) => {
    const updatedUser = await userService.completeRegistration({
      email,
      name,
      phone,
      address,
      memberType: memberType || 'Member',
      avatarUrl
    }).then((res) => res.data);

    return mockResponse({
      token: `google-mock-token-${Date.now()}`,
      user: {
        ...updatedUser,
        role: mapRoleByEmail(updatedUser.email)
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
