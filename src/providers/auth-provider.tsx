"use client";

/**
 * Auth konteksti: ilova yuklanganda tokenni tekshiradi (GET /auth/me),
 * login/logout hodisalarini tinglaydi va `expired` bo'lganda /login ga yo'naltiradi.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_EVENT, authApi, tokenStore, type AuthChangeReason, type User } from "@/lib/api";

interface AuthState {
  user: User | null;
  /** true — hali /auth/me tekshirilmagan */
  loading: boolean;
  isAdmin: boolean;
  refresh: () => Promise<User | null>;
  setUser: (u: User | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Token bo'lsa /auth/me; xatolik yoki token yo'q — null. setState chaqirmaydi. */
async function fetchMe(): Promise<User | null> {
  if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return null;
  try {
    return await authApi.me();
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    setLoading(false);
    return me;
  }, []);

  useEffect(() => {
    let alive = true;
    fetchMe().then((me) => {
      if (!alive) return;
      setUser(me);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const onChange = (e: Event) => {
      const reason = (e as CustomEvent<AuthChangeReason>).detail;
      if (reason === "login") void refresh();
      if (reason === "logout" || reason === "expired") {
        setUser(null);
        setLoading(false);
        if (reason === "expired" && !pathname.startsWith("/login") && !pathname.startsWith("/register")) {
          router.replace(`/login?next=${encodeURIComponent(pathname)}&reason=expired`);
        }
      }
    };
    window.addEventListener(AUTH_EVENT, onChange);
    return () => window.removeEventListener(AUTH_EVENT, onChange);
  }, [pathname, refresh, router]);

  const logout = useCallback(async () => {
    await authApi.logout();
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, isAdmin: user?.role === "ADMIN", refresh, setUser, logout }),
    [user, loading, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth faqat <AuthProvider> ichida ishlaydi");
  return ctx;
}
