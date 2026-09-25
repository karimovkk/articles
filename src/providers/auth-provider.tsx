"use client";

/**
 * Auth konteksti: ilova yuklanganda tokenni tekshiradi (GET /auth/me),
 * login/logout hodisalarini tinglaydi va `expired` bo'lganda /login ga yo'naltiradi.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AUTH_EVENT, authApi, clearVocabCache, tokenStore, type AuthChangeReason, type User } from "@/lib/api";
import { clearOwnedBooks } from "@/lib/owned-books";
import { cart } from "@/lib/cart";
import { sessionGet, sessionSet } from "@/lib/session-cache";

interface AuthState {
  user: User | null;
  /** true — hali /auth/me tekshirilmagan */
  loading: boolean;
  /** Sessiya muddati tugagan/bekor qilingan (refresh ham ishlamadi) — login sahifasida xabar uchun */
  expired: boolean;
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
    const me = await authApi.me();
    sessionSet(ME_KEY, me);
    return me;
  } catch {
    return null;
  }
}

/**
 * 26.4: `GET /auth/me` javobi qisqa muddatga sessiyada saqlanadi. Har sahifa ochilganda interfeys (sarlavha,
 * "mening kutubxonam") shu keshdan darhol chiziladi, so'rov esa fonda ketadi — sekin tarmoqda kutish yo'qoladi.
 * Sessiya tugasa API qatlami `expired` hodisasini yuboradi va kesh tozalanadi.
 */
const ME_KEY = "a365.me";
const ME_TTL = 5 * 60 * 1000;

function cachedMe(): User | null {
  if (!tokenStore.getAccess() && !tokenStore.getRefresh()) return null;
  return sessionGet<User>(ME_KEY, ME_TTL);
}

function clearMe() {
  try {
    window.sessionStorage.removeItem(ME_KEY);
  } catch {
    /* kesh yo'q — muammo emas */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const router = useRouter();

  const refresh = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
    setLoading(false);
    return me;
  }, []);

  useEffect(() => {
    let alive = true;
    const cached = cachedMe();
    // Kesh hidratatsiyadan keyin qo'llanadi (mikrotask) — SSR HTML bilan farq qilmasin
    if (cached)
      queueMicrotask(() => {
        if (!alive) return;
        setUser(cached);
        setLoading(false);
      });
    fetchMe().then((me) => {
      if (!alive) return;
      // Fonda tekshirishda tarmoq uzilsa keshdagi foydalanuvchi saqlanib qoladi; haqiqiy 401 bo'lsa
      // API qatlami `expired` hodisasini yuboradi va quyidagi tinglovchi uni tozalaydi.
      if (me || !cached || (!tokenStore.getAccess() && !tokenStore.getRefresh())) setUser(me);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Yo'naltirish AppShell'da (himoyalangan sahifalar): `expired` bo'lsa /login?reason=expired.
  // Public sahifalarda (katalog) sessiya tugasa foydalanuvchi shunchaki mehmonga aylanadi.
  useEffect(() => {
    const onChange = (e: Event) => {
      const reason = (e as CustomEvent<AuthChangeReason>).detail;
      if (reason === "login") {
        setExpired(false);
        void refresh();
      }
      clearOwnedBooks(); // boshqa foydalanuvchi — katalog keshini tozalaymiz (26.4)
      clearMe();
      if (reason !== "login") clearVocabCache(); // 33: boshqa foydalanuvchi — lug'at indeksi/keshi
      if (reason === "logout") cart.clear(); // 35: savatcha — shu qurilmadagi foydalanuvchiniki
      if (reason === "logout" || reason === "expired") {
        setUser(null);
        setLoading(false);
        setExpired(reason === "expired");
      }
    };
    window.addEventListener(AUTH_EVENT, onChange);
    return () => window.removeEventListener(AUTH_EVENT, onChange);
  }, [refresh]);

  const logout = useCallback(async () => {
    await authApi.logout();
    router.replace("/login");
  }, [router]);

  const value = useMemo<AuthState>(
    () => ({ user, loading, expired, isAdmin: user?.role === "ADMIN", refresh, setUser, logout }),
    [user, loading, expired, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth faqat <AuthProvider> ichida ishlaydi");
  return ctx;
}
