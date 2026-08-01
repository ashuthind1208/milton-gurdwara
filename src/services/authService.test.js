import authService from './authService';
import userService from './userService';

jest.mock('./userService', () => ({
  __esModule: true,
  default: {
    getUserByEmail: jest.fn(),
    upsertUserByEmail: jest.fn()
  }
}));

describe('inactive Member authentication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks an inactive pending Member applicant', async () => {
    const applicant = {
      id: 'pending-member',
      name: 'Pending Member',
      email: 'pending@example.com',
      role: 'Member',
      memberType: 'Member',
      approvalStatus: 'pending',
      isActive: false
    };
    userService.getUserByEmail.mockResolvedValue({ data: applicant });
    await expect(authService.loginWithGoogle({
      email: applicant.email,
      name: applicant.name,
      intent: 'signup'
    })).rejects.toThrow('Admin has marked your account inactive. Please contact admin for access.');
  });

  test('continues blocking an inactive approved account', async () => {
    userService.getUserByEmail.mockResolvedValue({
      data: {
        id: 'inactive-approved-member',
        email: 'inactive@example.com',
        role: 'Member',
        approvalStatus: 'approved',
        isActive: false
      }
    });

    await expect(authService.loginWithGoogle({
      email: 'inactive@example.com',
      intent: 'signin'
    })).rejects.toThrow('Admin has marked your account inactive. Please contact admin for access.');
  });
});