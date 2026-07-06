import { createContext, useContext, useState, useEffect } from "react";
import { api } from "../utils/api";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("apg_token");
    if (!token) { setLoading(false); return; }
    api.me()
      .then(u => setUser(u))
      .catch(() => localStorage.removeItem("apg_token"))
      .finally(() => setLoading(false));
  }, []);

  async function login(email, password) {
    const res = await api.login(email, password);
    localStorage.setItem("apg_token", res.token);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    localStorage.removeItem("apg_token");
    setUser(null);
  }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
