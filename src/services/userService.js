import { serviceResponse } from './serviceResponse';
import contentApiService from './contentApiService';

const RESOURCE = 'users';

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
    role: 'Admin',
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
    role: 'Member',
    email: 'finance@singhsabhamilton.org',
    phone: '',
    address: '',
    memberType: 'Member',
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
  if (raw === 'family') {
    return 'Family';
  }
  if (raw === 'editor') {
    return 'Editor';
  }
  if (raw === 'finance') {
    return 'Finance';
  }
  return 'Member';
};

const resolveMemberType = (role, fallback) => {
  if (role === 'Super Admin' || role === 'Admin' || role === 'Editor' || role === 'Finance') {
    return 'Admin';
  }
  if (role === 'Volunteer') {
    return 'Volunteer';
  }
  if (role === 'Family') {
    return 'Family';
  }
  return fallback || 'Member';
};

const resolveAvatarUrl = (user = {}) => (
  user.avatarUrl || user.picture || user.photoURL || user.imageUrl || user.profileImageUrl || ''
);

const normalizeUser = (user = {}) => {
  const role = normalizeRole(user.role);
  const memberType = resolveMemberType(role, user.memberType || '');
  const resolvedAvatarUrl = resolveAvatarUrl(user);
  const isPrivilegedRole = role === 'Super Admin' || role === 'Admin' || memberType === 'Admin';

  return {
    id: user.id || `user-${Date.now()}`,
    name: user.name || '',
    role,
    email: String(user.email || '').toLowerCase(),
    phone: user.phone || '',
    address: user.address || '',
    memberType,
    authProvider: user.authProvider || 'LOCAL',
    avatarUrl: resolvedAvatarUrl,
    registrationComplete: Boolean(user.registrationComplete),
    isActive: user.isActive !== false,
    approvalStatus: user.approvalStatus || (isPrivilegedRole ? 'approved' : 'pending'),
    approvalUpdatedAt: user.approvalUpdatedAt || '',
    createdAt: user.createdAt || new Date().toISOString(),
    updatedAt: user.updatedAt || new Date().toISOString()
  };
};

const ensureSeedUsers = async () => {
  const rows = await contentApiService.list(RESOURCE);
  if (rows.length > 0) {
    return rows.map((row) => normalizeUser(row));
  }

  await Promise.all(seedUsers.map((user) => contentApiService.create(RESOURCE, normalizeUser(user))));
  const seeded = await contentApiService.list(RESOURCE);
  return seeded.map((row) => normalizeUser(row));
};

const findUserByEmail = async (email) => {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const rows = await ensureSeedUsers();
  return rows.find((entry) => entry.email === normalizedEmail) || null;
};

const userService = {
  getUsers: async () => {
    const users = await ensureSeedUsers();
    return serviceResponse(users);
  },

  getUserByEmail: async (email) => {
    const user = await findUserByEmail(email);
    return serviceResponse(user);
  },

  upsertUserByEmail: async (payload) => {
    const normalized = normalizeUser(payload);
    const existing = await findUserByEmail(normalized.email);

    if (!existing) {
      const created = await contentApiService.create(RESOURCE, {
        ...normalized,
        id: normalized.id || `user-${Date.now()}`
      });
      return serviceResponse(normalizeUser(created || normalized));
    }

    const updated = await contentApiService.update(RESOURCE, existing.id, {
      ...existing,
      ...normalized,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString()
    });

    return serviceResponse(normalizeUser(updated || { ...existing, ...normalized }));
  },

  completeRegistration: async ({ email, name, phone, address, memberType, role, avatarUrl }) => {
    const normalizedEmail = String(email || '').toLowerCase();
    if (!normalizedEmail) {
      throw new Error('Email is required for registration.');
    }

    const existing = await findUserByEmail(normalizedEmail);
    const base = existing || normalizeUser({ email: normalizedEmail, name, avatarUrl });
    const resolvedRole = normalizeRole(role || base.role);
    const resolvedMemberType = resolveMemberType(resolvedRole, memberType || base.memberType || 'Member');
    const approvalStatus = resolvedRole === 'Super Admin' || resolvedRole === 'Admin' || resolvedMemberType === 'Admin' ? 'approved' : 'pending';
    const updated = normalizeUser({
      ...base,
      name: name || base.name,
      phone: phone || '',
      address: address || '',
      role: resolvedRole,
      memberType: resolvedMemberType,
      avatarUrl: avatarUrl || base.avatarUrl,
      registrationComplete: true,
      approvalStatus,
      approvalUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (existing?.id) {
      const saved = await contentApiService.update(RESOURCE, existing.id, {
        ...updated,
        id: existing.id,
        createdAt: existing.createdAt
      });
      return serviceResponse(normalizeUser(saved || updated));
    }

    const created = await contentApiService.create(RESOURCE, updated);
    return serviceResponse(normalizeUser(created || updated));
  },

  createUser: async (payload) => {
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

    const created = await contentApiService.create(RESOURCE, record);
    return serviceResponse(normalizeUser(created || record));
  },

  updateUser: async (id, payload) => {
    const users = await ensureSeedUsers();
    const existing = users.find((user) => user.id === id) || { id };
    const record = normalizeUser({ ...existing, ...payload, id, createdAt: existing.createdAt });
    const updated = await contentApiService.update(RESOURCE, id, record);
    return serviceResponse(normalizeUser(updated || record));
  },

  updateApprovalStatus: async (id, approvalStatus) => {
    const users = await ensureSeedUsers();
    const existing = users.find((user) => user.id === id);
    if (!existing) {
      return serviceResponse(null);
    }

    const updated = normalizeUser({
      ...existing,
      approvalStatus,
      approvalUpdatedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      registrationComplete: approvalStatus === 'approved' ? existing.registrationComplete : false
    });

    const saved = await contentApiService.update(RESOURCE, id, updated);
    return serviceResponse(normalizeUser(saved || updated));
  },

  removeUser: async (id) => {
    await contentApiService.remove(RESOURCE, id);
    return serviceResponse({ success: true });
  }
};

export default userService;
