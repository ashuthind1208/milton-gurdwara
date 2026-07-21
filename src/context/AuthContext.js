import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import authService from '../services/authService';
import userService from '../services/userService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('gurdwara_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('gurdwara_token'));
  const [loading, setLoading] = useState(false);

  const persistUser = useCallback((nextUser) => {
    setUser(nextUser);
    if (nextUser) {
      localStorage.setItem('gurdwara_user', JSON.stringify(nextUser));
      return;
    }
    localStorage.removeItem('gurdwara_user');
  }, []);

  const login = useCallback(async (payload) => {
    setLoading(true);
    try {
      const response = await authService.login(payload);
      persistUser(response.data.user);
      setToken(response.data.token);
      localStorage.setItem('gurdwara_token', response.data.token);
      return response;
    } finally {
      setLoading(false);
    }
  }, [persistUser]);

  const loginWithGoogle = useCallback(async (payload) => {
    setLoading(true);
    try {
      const response = await authService.loginWithGoogle(payload || {});
      persistUser(response.data.user);
      setToken(response.data.token);
      localStorage.setItem('gurdwara_token', response.data.token);
      return response;
    } finally {
      setLoading(false);
    }
  }, [persistUser]);

  const completeRegistration = useCallback(async (payload) => {
    setLoading(true);
    try {
      const response = await authService.completeRegistration(payload || {});
      persistUser(response.data.user);
      if (response.data.token) {
        setToken(response.data.token);
        localStorage.setItem('gurdwara_token', response.data.token);
      }
      return response;
    } finally {
      setLoading(false);
    }
  }, [persistUser]);

  const updateProfile = useCallback(async (payload) => {
    if (!user?.id) {
      throw new Error('No signed-in user found.');
    }

    setLoading(true);
    try {
      const response = await userService.updateUser(user.id, payload || {});
      const nextUser = response?.data || { ...user, ...(payload || {}) };
      persistUser(nextUser);
      return response;
    } finally {
      setLoading(false);
    }
  }, [persistUser, user]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Clear local auth state even if server-side logout fails.
    } finally {
      persistUser(null);
      setToken(null);
      localStorage.removeItem('gurdwara_token');
    }
  }, [persistUser]);

  useEffect(() => {
    const email = String(user?.email || '').trim().toLowerCase();
    if (!token || !email) {
      return undefined;
    }

    let cancelled = false;

    const syncCurrentUser = async () => {
      try {
        const response = await userService.getUserByEmail(email);
        const latestUser = response?.data;
        if (!latestUser || cancelled) {
          return;
        }

        const currentSnapshot = JSON.stringify(user || {});
        const latestSnapshot = JSON.stringify(latestUser || {});
        if (currentSnapshot !== latestSnapshot) {
          persistUser(latestUser);
        }
      } catch {
        // Ignore background refresh failures.
      }
    };

    syncCurrentUser();
    const timerId = window.setInterval(syncCurrentUser, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [persistUser, token, user, user?.email]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      isAuthenticated: Boolean(token),
      login,
      loginWithGoogle,
      completeRegistration,
      updateProfile,
      persistUser,
      logout
    }),
    [user, token, loading, login, loginWithGoogle, completeRegistration, updateProfile, persistUser, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
