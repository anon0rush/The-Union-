import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from './api.js';
import { clearOfflineCopies } from './offline.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(tokenStore.get()));

  useEffect(() => {
    if (!tokenStore.get()) return;
    api('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('union:session-expired', onExpired);
    return () => window.removeEventListener('union:session-expired', onExpired);
  }, []);

  const authenticate = useCallback(async (mode, fields) => {
    const { token, user } = await api(`/auth/${mode}`, { method: 'POST', body: fields });
    tokenStore.set(token);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    if (user) await clearOfflineCopies(user.id);
    tokenStore.clear();
    setUser(null);
  }, [user]);

  const value = useMemo(() => ({ user, loading, authenticate, logout }), [user, loading, authenticate, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
