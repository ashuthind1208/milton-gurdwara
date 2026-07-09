import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-admin-users';
const USERS_API_BASE = '/api/users';

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

const normalizeRole = (value) => {
  const raw = String(value || '').trim().toLowerCase();
  if (raw === 'super admin' || raw === 'super_admin' || raw === 'superadmin') {
    return 'Super Admin';
  }
  if (raw === 'admin') {
    return 'Admin';
  }
  if (raw === 'volunteer' || raw === 'volunteer coordinator' || raw === 'volunteer_coordinator') {
    return 'Volunteer';
  }
  return 'Member';
};

const resolveMemberType = (role, fallback) => {
  if (fallback) {
    return fallback;
  }
  if (role === 'Super Admin' || role === 'Admin') {
    return 'Admin';
  }
  if (role === 'Volunteer') {
    return 'Volunteer';
  }
  return 'Member';
};

const normalizeUser = (user = {}) => {
  const role = normalizeRole(user.role);
  const memberType = resolveMemberType(role, user.memberType || '');

  return {
  id: user.id || `user-${Date.now()}`,
  name: user.name || '',
  role,
  email: String(user.email || '').toLowerCase(),
  phone: user.phone || '',
  address: user.address || '',
  memberType,
  authProvider: user.authProvider || 'LOCAL',
  avatarUrl: user.avatarUrl || user.picture || '',
  registrationComplete: Boolean(user.registrationComplete),
  isActive: user.isActive !== false,
  approvalStatus: user.approvalStatus || (memberType === 'Admin' ? 'approved' : 'pending'),
  approvalUpdatedAt: user.approvalUpdatedAt || '',
  createdAt: user.createdAt || new Date().toISOString(),
  updatedAt: user.updatedAt || new Date().toISOString()
  };
};

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

const fetchJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.ok === false) {
    throw new Error(data?.message || `Request failed for ${url}`);
  }
  return data;
};

const userService = {
  getUsers: async () => {
    try {
      const response = await fetchJson(USERS_API_BASE, { headers: { Accept: 'application/json' } });
      const users = Array.isArray(response.data) ? response.data.map(normalizeUser) : [];
      writeUsers(users);
      return mockResponse(users);
    } catch {
      return mockResponse(readUsers());
    }
  },
  getUserByEmail: async (email) => {
    const normalizedEmail = String(email || '').toLowerCase();
    try {
      const url = `${USERS_API_BASE}/by-email?email=${encodeURIComponent(normalizedEmail)}`;
      const response = await fetchJson(url, { headers: { Accept: 'application/json' } });
      return mockResponse(response.data ? normalizeUser(response.data) : null);
    } catch {
      const record = readUsers().find((entry) => entry.email === normalizedEmail) || null;
      return mockResponse(record);
    }
  },
  upsertUserByEmail: async (payload) => {
    try {
      const response = await fetchJson(`${USERS_API_BASE}/upsert-by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return mockResponse(normalizeUser(response.data));
    } catch {
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
    }
  },
  completeRegistration: async ({ email, name, phone, address, memberType, role, avatarUrl }) => {
    try {
      const response = await fetchJson(`${USERS_API_BASE}/complete-registration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, phone, address, memberType, role, avatarUrl })
      });
      return mockResponse(normalizeUser(response.data));
    } catch {
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
        role: role || base.role,
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
    }
  },
  createUser: async (payload) => {
    try {
      const response = await fetchJson(USERS_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return mockResponse(normalizeUser(response.data));
    } catch {
      const record = normalizeUser({
        id: `user-${Date.now()}`,
        name: payload.name,
        role: payload.role,
        email: payload.email,
        phone: payload.phone,
        address: payload.address,
        memberType: payload.memberType || '',
        authProvider: payload.authProvider || 'LOCAL',
        avatarUrl: payload.avatarUrl,
        registrationComplete: Boolean(payload.registrationComplete),
        approvalStatus: payload.approvalStatus || 'approved',
        approvalUpdatedAt: new Date().toISOString()
      });

      const next = [record, ...readUsers()];
      writeUsers(next);
      return mockResponse(record);
    }
  },
  updateUser: async (id, payload) => {
    try {
      const response = await fetchJson(`${USERS_API_BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload || {})
      });
      return mockResponse(normalizeUser(response.data));
    } catch {
      const next = readUsers().map((user) => (
        user.id === id ? normalizeUser({ ...user, ...payload, id, createdAt: user.createdAt }) : user
      ));

      writeUsers(next);
      return mockResponse(next.find((user) => user.id === id));
    }
  },
  updateApprovalStatus: async (id, approvalStatus) => {
    try {
      const response = await fetchJson(`${USERS_API_BASE}/${encodeURIComponent(id)}/approval`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalStatus })
      });
      return mockResponse(normalizeUser(response.data));
    } catch {
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
    }
  },
  removeUser: async (id) => {
    try {
      await fetchJson(`${USERS_API_BASE}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Accept: 'application/json' }
      });
      return mockResponse({ success: true });
    } catch {
      const next = readUsers().filter((user) => user.id !== id);
      writeUsers(next);
      return mockResponse({ success: true });
    }
  }
};

export default userService;
