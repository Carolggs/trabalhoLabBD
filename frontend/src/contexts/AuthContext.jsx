import { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Persiste sessão no sessionStorage para sobreviver a refreshes
  const [user, setUser] = useState(() => {
    const stored = sessionStorage.getItem('f1_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (login, password) => {
    setLoading(true);
    setError('');
    try {
      const userData = await api.login(login, password);
      sessionStorage.setItem('f1_user', JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    if (user) {
      try { await api.logout(user.userid); } catch (_) { /* ignora erro de rede */ }
    }
    sessionStorage.removeItem('f1_user');
    setUser(null);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, error, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
