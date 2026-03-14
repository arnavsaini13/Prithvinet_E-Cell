import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, type UserOut } from "../../api/client";

interface AuthState {
  user: UserOut | null;
  token: string | null;
  role: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserOut | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("prithvinet_token"),
  );
  const [role, setRole] = useState<string | null>(
    () => localStorage.getItem("prithvinet_role"),
  );
  const [loading, setLoading] = useState(!!token);

  // On mount, if we have a stored token, validate it by fetching /users/me
  useEffect(() => {
    if (!token) return;
    authApi
      .me()
      .then((u) => {
        setUser(u);
        setRole(u.role);
      })
      .catch(() => {
        // Token is invalid / expired — clear it
        localStorage.removeItem("prithvinet_token");
        localStorage.removeItem("prithvinet_role");
        setToken(null);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    localStorage.setItem("prithvinet_token", res.access_token);
    localStorage.setItem("prithvinet_role", res.role);
    setToken(res.access_token);
    setRole(res.role);

    const me = await authApi.me();
    setUser(me);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("prithvinet_token");
    localStorage.removeItem("prithvinet_role");
    setToken(null);
    setRole(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, role, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
