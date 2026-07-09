import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-admin-users';

const seedUsers = [
  {
    id: 'user-1',
    name: 'Admin Singh',
    role: 'Super Admin',
    email: 'admin@singhsabhamilton.org',
    phone: '',
    address: '',
    memberType: 'Admin',
    authProvider: 'LOCAL',
    avatarUrl: '',
    registrationComplete: true,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-2',
    name: 'Kirandeep Kaur',
    role: 'Editor',
    email: 'editor@singhsabhamilton.org',
    phone: '',
    address: '',
    memberType: 'Admin',
    authProvider: 'LOCAL',
    avatarUrl: '',
    registrationComplete: true,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-3',
    name: 'Manveer Singh',
    role: 'Finance',
    email: 'finance@singhsabhamilton.org',
    phone: '',
    address: '',
    memberType: 'Admin',
    authProvider: 'LOCAL',
    avatarUrl: '',
    registrationComplete: true,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'user-4',
    name: 'Gurleen Kaur',
    role: 'Volunteer Coordinator',
    email: 'volunteers@singhsabhamilton.org',
    phone: '',
    address: '',
    memberType: 'Volunteer',
    authProvider: 'LOCAL',
    avatarUrl: '',
    registrationComplete: true,
    approvalStatus: 'approved',
    createdAt: new Date().toISOString()
  }
];

const normalizeUser = (user = {}) => ({
  id: user.id || `user-${Date.now()}`,
  name: user.name || '',
  role: user.role || 'Member',
  email: String(user.email || '').toLowerCase(),
  phone: user.phone || '',
  address: user.address || '',
  memberType: user.memberType || 'Member',
  authProvider: user.authProvider || 'LOCAL',
  avatarUrl: user.avatarUrl || user.picture || '',
  registrationComplete: Boolean(user.registrationComplete),
  approvalStatus: user.approvalStatus || (user.memberType === 'Admin' ? 'approved' : 'pending'),
  approvalUpdatedAt: user.approvalUpdatedAt || '',
  createdAt: user.createdAt || new Date().toISOString(),
  updatedAt: user.updatedAt || new Date().toISOString()
});

const readUsers = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedUsers.map(normalizeUser);
    }

    return JSON.parse(raw).map(normalizeUser);
  } catch {
    return seedUsers.map(normalizeUser);
  }
};

const writeUsers = (records) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // Ignore localStorage write errors in mock mode.
  }
};

const userService = {
  getUsers: async () => mockResponse(readUsers()),
  getUserByEmail: async (email) => {
    const normalizedEmail = String(email || '').toLowerCase();
    const record = readUsers().find((entry) => entry.email === normalizedEmail) || null;
    return mockResponse(record);
  },
  upsertUserByEmail: async (payload) => {
    const normalized = normalizeUser(payload);
    const users = readUsers();
    const index = users.findIndex((entry) => entry.email === normalized.email);

    if (index === -1) {
      const next = [{ ...normalized, id: normalized.id || `user-${Date.now()}` }, ...users];
      writeUsers(next);
      return mockResponse(next[0]);
    }

    const updated = {
      ...users[index],
      ...normalized,
      id: users[index].id,
      createdAt: users[index].createdAt,
      updatedAt: new Date().toISOString()
    };
    const next = [...users];
    next[index] = updated;
    writeUsers(next);
    return mockResponse(updated);
  },
  completeRegistration: async ({ email, name, phone, address, memberType, avatarUrl }) => {
    const normalizedEmail = String(email || '').toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required for registration.');
    }

    const users = readUsers();
    const index = users.findIndex((entry) => entry.email === normalizedEmail);
    const base = index >= 0 ? users[index] : normalizeUser({ email: normalizedEmail, name, avatarUrl });
    const resolvedMemberType = memberType || base.memberType || 'Member';
    const approvalStatus = resolvedMemberType === 'Admin' ? 'approved' : 'pending';
    const updated = normalizeUser({
      ...base,
      name: name || base.name,
      phone: phone || '',
      address: address || '',
      memberType: resolvedMemberType,
      avatarUrl: avatarUrl || base.avatarUrl,
      registrationComplete: true,
      approvalStatus,
      approvalUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const next = [...users];
    if (index >= 0) {
      next[index] = { ...updated, id: base.id, createdAt: base.createdAt };
    } else {
      next.unshift(updated);
    }
    writeUsers(next);
    return mockResponse(index >= 0 ? next[index] : next[0]);
  },
  createUser: async (payload) => {
    const record = normalizeUser({
      id: `user-${Date.now()}`,
      name: payload.name,
      role: payload.role,
      email: payload.email,
      phone: payload.phone,
      address: payload.address,
      memberType: payload.memberType || 'Member',
      authProvider: payload.authProvider || 'LOCAL',
      avatarUrl: payload.avatarUrl,
      registrationComplete: Boolean(payload.registrationComplete),
      approvalStatus: payload.approvalStatus || 'approved',
      approvalUpdatedAt: new Date().toISOString()
    });

    const next = [record, ...readUsers()];
    writeUsers(next);
    return mockResponse(record);
  },
  updateUser: async (id, payload) => {
    const next = readUsers().map((user) => (
      user.id === id ? normalizeUser({ ...user, ...payload, id, createdAt: user.createdAt }) : user
    ));

    writeUsers(next);
    return mockResponse(next.find((user) => user.id === id));
  },
  updateApprovalStatus: async (id, approvalStatus) => {
    const next = readUsers().map((user) => {
      if (user.id !== id) {
        return user;
      }

      return normalizeUser({
        ...user,
        approvalStatus,
        approvalUpdatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        registrationComplete: approvalStatus === 'approved' ? user.registrationComplete : false
      });
    });

    writeUsers(next);
    return mockResponse(next.find((user) => user.id === id));
  },
  removeUser: async (id) => {
    const next = readUsers().filter((user) => user.id !== id);
    writeUsers(next);
    return mockResponse({ success: true });
  }
};

export default userService;
