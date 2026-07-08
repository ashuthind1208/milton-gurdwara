import { mockResponse } from './mockApi';

const STORAGE_KEY = 'ssm-admin-users';

const seedUsers = [
  { id: 'user-1', name: 'Admin Singh', role: 'Super Admin', email: 'admin@singhsabhamilton.org' },
  { id: 'user-2', name: 'Kirandeep Kaur', role: 'Editor', email: 'editor@singhsabhamilton.org' },
  { id: 'user-3', name: 'Manveer Singh', role: 'Finance', email: 'finance@singhsabhamilton.org' },
  { id: 'user-4', name: 'Gurleen Kaur', role: 'Volunteer Coordinator', email: 'volunteers@singhsabhamilton.org' }
];

const readUsers = () => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return seedUsers;
    }

    return JSON.parse(raw);
  } catch {
    return seedUsers;
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
  createUser: async (payload) => {
    const record = {
      id: `user-${Date.now()}`,
      name: payload.name,
      role: payload.role,
      email: payload.email
    };

    const next = [record, ...readUsers()];
    writeUsers(next);
    return mockResponse(record);
  },
  updateUser: async (id, payload) => {
    const next = readUsers().map((user) => (
      user.id === id ? { ...user, ...payload } : user
    ));

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
