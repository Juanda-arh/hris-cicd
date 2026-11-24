import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { decodeToken } from '../utils/jwt';
import { clearToken, getToken, replaceToken, saveToken } from '../utils/tokenStorage';

const AuthContext = createContext(null);

// Al abrir la app: si hay un token guardado y sigue vigente, se recupera la sesión
function readSession() {
  const token = getToken();
  if (!token) return null;
  const payload = decodeToken(token);
  if (!payload) {
    clearToken();
    return null;
  }
  return payload;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  const login = useCallback((token, remember) => {
    const payload = decodeToken(token);
    if (!payload) throw new Error('Invalid token');
    saveToken(token, remember);
    setUser(payload);
    return payload;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const updateToken = useCallback((token) => {
  const payload = decodeToken(token);
  if (!payload) throw new Error('Invalid token');
  replaceToken(token);
  setUser(payload);
  return payload;
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), login, logout, updateToken }),
    [user, login, logout, updateToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}