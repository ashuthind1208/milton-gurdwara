import contentApiService from './contentApiService';
import userService from './userService';

jest.mock('./contentApiService', () => ({
  __esModule: true,
  default: {
    list: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getSingleton: jest.fn()
  }
}));

const unrelatedUser = {
  id: 'existing-user',
  name: 'Existing User',
  role: 'Family',
  email: 'existing@example.com',
  memberType: 'Family',
  isActive: true
};

describe('membership state rules', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    contentApiService.getSingleton.mockResolvedValue([]);
    contentApiService.list.mockResolvedValue([unrelatedUser]);
    contentApiService.create.mockImplementation(async (_resource, payload) => payload);
  });

  test('keeps a new unpaid Member active for sign-in but pending for portal access', async () => {
    const signup = await userService.upsertUserByEmail({
      name: 'New Applicant',
      email: 'new-applicant@example.com',
      role: 'Member',
      memberType: 'Member',
      approvalStatus: 'pending',
      registrationComplete: true
    });

    expect(signup.data.isActive).toBe(true);
    expect(signup.data.approvalStatus).toBe('pending');
    expect(contentApiService.create).toHaveBeenLastCalledWith(
      'users',
      expect.objectContaining({
        email: 'new-applicant@example.com',
        isActive: true,
        approvalStatus: 'pending'
      })
    );

    const registration = await userService.completeRegistration({
      name: 'Second Applicant',
      email: 'second-applicant@example.com',
      role: 'Member',
      memberType: 'Member'
    });

    expect(registration.data.isActive).toBe(true);
    expect(registration.data.approvalStatus).toBe('pending');
    expect(contentApiService.create).toHaveBeenLastCalledWith(
      'users',
      expect.objectContaining({
        email: 'second-applicant@example.com',
        isActive: true,
        approvalStatus: 'pending'
      })
    );
  });

  test('derives Member approval from the current paid fee period', async () => {
    contentApiService.list.mockResolvedValue([
      {
        id: 'paid-member',
        role: 'Member',
        email: 'paid@example.com',
        membershipProfile: { donationSchedule: 'monthly' },
        membershipFeeRecords: [{ status: 'paid', paymentDate: new Date().toISOString() }]
      },
      {
        id: 'expired-member',
        role: 'Member',
        email: 'expired@example.com',
        approvalStatus: 'approved',
        membershipProfile: { donationSchedule: 'monthly' },
        membershipFeeRecords: [{ status: 'paid', paymentDate: '2020-01-01' }]
      },
      {
        id: 'family-user',
        role: 'Family',
        email: 'family@example.com',
        approvalStatus: 'pending'
      }
    ]);

    const response = await userService.getUsers();

    expect(response.data.find((user) => user.id === 'paid-member').approvalStatus).toBe('approved');
    expect(response.data.find((user) => user.id === 'expired-member').approvalStatus).toBe('pending');
    expect(response.data.find((user) => user.id === 'family-user').approvalStatus).toBe('approved');
  });

  test('resets inherited fee coverage when a role changes to Member', async () => {
    contentApiService.list.mockResolvedValue([{
      ...unrelatedUser,
      membershipFeeRecords: [{ status: 'paid', paymentDate: new Date().toISOString() }]
    }]);
    contentApiService.update.mockImplementation(async (_resource, _id, payload) => payload);

    const response = await userService.updateUser(unrelatedUser.id, { role: 'Member' });

    expect(response.data.approvalStatus).toBe('pending');
    expect(response.data.membershipFeeRecords).toEqual([]);
  });

  test('persists a paid fee entry and automatically approves the Member', async () => {
    const existingMember = {
      id: 'fee-member',
      name: 'Fee Member',
      role: 'Member',
      memberType: 'Member',
      email: 'fee-member@example.com',
      isActive: true,
      approvalStatus: 'pending',
      membershipProfile: { donationSchedule: 'monthly' },
      membershipFeeRecords: []
    };
    const paidRecord = {
      id: 'fee-current',
      amount: 25,
      currency: 'CAD',
      status: 'paid',
      paymentDate: new Date().toISOString().slice(0, 10)
    };
    contentApiService.list.mockResolvedValue([existingMember]);
    contentApiService.update.mockImplementation(async (_resource, _id, payload) => payload);

    const response = await userService.updateUser(existingMember.id, {
      membershipFeeRecords: [paidRecord]
    });

    expect(contentApiService.update).toHaveBeenCalledWith(
      'users',
      existingMember.id,
      expect.objectContaining({ membershipFeeRecords: [expect.objectContaining(paidRecord)] })
    );
    expect(response.data.membershipFeeRecords).toEqual([expect.objectContaining(paidRecord)]);
    expect(response.data.approvalStatus).toBe('approved');
  });
});
