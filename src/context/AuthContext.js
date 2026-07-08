import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('gurdwara_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('gurdwara_token'));
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (payload) => {
    setLoading(true);
    try {
      const response = await authService.login(payload);
      setUser(response.data.user);
      setToken(response.data.token);
      localStorage.setItem('gurdwara_user', JSON.stringify(response.data.user));
      localStorage.setItem('gurdwara_token', response.data.token);
      return response;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    setToken(null);
    localStorage.removeItem('gurdwara_user');
    localStorage.removeItem('gurdwara_token');
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, isAuthenticated: Boolean(token), login, logout }),
    [user, token, loading, login, logout]
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
