/**
 * Next.js 16 Proxy (sobiq middleware): optimistik yo'naltirish.
 * `/catalog*` — public (himoyalanmagan, mehmon uchun ham ochiq).
 * `/reader/*` — 37: himoyalanmagan (tekin kitobni mehmon ham o'qiydi); pullik kitobni reader o'zi (backend 401)
 * bo'yicha kirish sahifasiga yo'naltiradi.
 * Tokenlar localStorage'da (Bearer), shu sababli bu yerda faqat
 * `a365_auth` cookie bayrog'i tekshiriladi. Haqiqiy avtorizatsiya —
 * backendda (har so'rovda) va AuthProvider'da (/auth/me).
 */
import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIE = "a365_auth";
const PROTECTED = ["/library", "/books", "/profile", "/admin", "/notifications", "/vocabulary"];
const GUEST_ONLY = ["/login", "/register"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuth = request.cookies.get(AUTH_COOKIE)?.value === "1";

  // Bosh sahifa: kirganlar → kutubxona, mehmonlar → public katalog (S-7)
  if (pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = hasAuth ? "/library" : "/catalog";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (!hasAuth && PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (hasAuth && GUEST_ONLY.some((p) => pathname === p)) {
    const url = request.nextUrl.clone();
    url.pathname = "/library";
    url.search = "";
    return NextResponse.redirect(url);
  }

  const res = NextResponse.next();
  // Reader ochiq bo'ldi (37) — himoyalangan kontent sahifasi baribir keshlanmasin (next.config headers() sahifalarda
  // Next'ning o'z Cache-Control'i bilan almashtiriladi)
  if (pathname.startsWith("/reader/")) res.headers.set("Cache-Control", "private, no-store, max-age=0");
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|pdf.worker.min.mjs|backend).*)"],
};
