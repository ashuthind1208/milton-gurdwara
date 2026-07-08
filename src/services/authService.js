import { mockResponse } from './mockApi';
import { userRoles } from '../constants/siteConfig';

const mockUser = {
  id: '1',
  name: 'Admin Singh',
  email: 'admin@singhsabhamilton.org',
  role: userRoles.SUPER_ADMIN
};

const authService = {
  login: async ({ email }) => {
    return mockResponse({
      token: 'mock-jwt-token',
      user: { ...mockUser, email: email || mockUser.email }
    });
  },
  logout: async () => mockResponse({ success: true }),
  me: async () => mockResponse({ user: mockUser })
};

export default authService;
