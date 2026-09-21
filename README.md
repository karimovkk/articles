# Articles365 — Frontend

Himoyalangan elektron kutubxona platformasining web-ilovasi: foydalanuvchi ruxsat berilgan
kitoblarni faqat brauzer ichidagi reader'da o'qiydi (PDF.js, Range-stream, shaxsiy watermark),
admin kitoblar/foydalanuvchilar/ruxsatlarni boshqaradi. **Backend alohida** (FastAPI, `/api/v1`) —
uning hujjatlari shu repoda: [`API.md`](API.md) ⭐, [`SECURITY.md`](SECURITY.md), [`STORAGE.md`](STORAGE.md),
[`ARCHITECTURE.md`](ARCHITECTURE.md) (backend README'si — [`DEPLOYMENT.md`](DEPLOYMENT.md) bilan birga).

Ish rejasi va holat: [`FRONTEND_PLAN.md`](FRONTEND_PLAN.md).

## Stack

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · pdfjs-dist.
Qo'shimcha holat kutubxonasi yo'q — `useAsync`/`usePaged` hook'lari va React context.

## Ishga tushirish

```bash
# .env.local yarating (quyidagi jadvaldagi o'zgaruvchilar; .env* fayllar git'ga kirmaydi)
npm ci                          # postinstall: pdf.worker.min.mjs → public/
npm run dev                     # http://localhost:3000
```

Backend `http://localhost:8001` da ishlayotgan bo'lishi kerak (qarang: backend README / Docker).
Dev login: `admin@articles365.local` / `Admin12345!`, `user@articles365.local` / `User12345!` (seed).

| Buyruq | Vazifa |
|---|---|
| `npm run dev` | dev server |
| `npm run build` / `npm start` | production build / start |
| `npm run lint` | ESLint (`public/**` ignore qilingan — pdf.js worker) |
| `npm run typecheck` | `tsc --noEmit` |

## Env o'zgaruvchilar

| Nomi | Default | Izoh |
|---|---|---|
| `BACKEND_URL` | `http://localhost:8001` | Server tomonda: `/api/v1/*` → shu manzilga rewrite (CORS shart emas) |
| `NEXT_PUBLIC_API_URL` | *(bo'sh)* | To'ldirilsa brauzer backendga **to'g'ridan-to'g'ri** murojaat qiladi (ngrok/staging). Backend CORS allowlist'ida frontend origin bo'lishi va `Authorization`, `X-Device-Id`, `Range`, `ngrok-skip-browser-warning` header'lariga ruxsat berilishi kerak |
| `NEXT_PUBLIC_APP_NAME` | `Articles365` | Sarlavha |
| `NEXT_PUBLIC_MAX_PDF_MB` | `500` | Klient tomonidagi PDF hajm tekshiruvi (backend `MAX_BOOK_UPLOAD_SIZE` ga moslang) |
| `NEXT_PUBLIC_MAX_COVER_MB` | `5` | Muqova hajmi (backend `MAX_COVER_UPLOAD_SIZE`) |
| `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS` | *(bo'sh)* | Buyurtma yaratilgach ko'rsatiladigan to'lov ko'rsatmasi (karta, Telegram va h.k.; `\n` — yangi qator) |
| `NEXT_PUBLIC_PURCHASE_URL` | *(bo'sh)* | Ixtiyoriy tashqi havola (Telegram bot), `{book_id}` shabloni; buyurtma paneli yonida "Telegram" tugmasi |

## Tuzilma

```
src/
  app/               App Router: (auth) login/register · (app) library/profile/admin/* · (reader) reader/[bookId]
  proxy.ts           Next 16 Proxy (sobiq middleware): cookie bayrog'i bo'yicha optimistik redirect
  components/
    reader/          PdfViewer (Range transport, scroll/varaqlash, highlight overlay), ReaderView, sidebar, watermark
    admin/           DataTable/usePaged, user/book detail, guard
    ui/              Button, Input, Modal, Badge, Alert, Pagination, …
  lib/
    api/             client (Bearer, refresh single-flight, XHR upload), modullar (auth, library, reader, reading, sessions, admin), error-codes
    reader/          range-transport (PDF.js ↔ /reader/{id}/content), highlights (koordinatalar, ranglar)
    uploads.ts       PDF/muqova klient tekshiruvi (magic bytes, hajm)
  providers/         AuthProvider (/auth/me, auth hodisalari), ThemeProvider
```

## Tillar (uz / ru / en)

- Lug'atlar: `src/i18n/dict/{uz,ru,en}.ts`. `uz` — kalitlar manbai; `ru`/`en` `Dict` tipiga mos bo'lishi shart
  (kalit tushib qolsa `tsc` xato beradi). Interpolyatsiya: `{n}` → `t("common.pageN", { n: 3 })`.
- Komponentlarda `const { t } = useT()`; React'dan tashqarida (API klient, tekshiruvlar) `t()` (`@/i18n`).
- Tanlangan til `localStorage` (`a365.locale`) da saqlanadi, `<html lang>` yangilanadi; default `uz`.
  URL-prefiksli marshrutlash ishlatilmagan — ilova auth'langan SPA (`noindex`).
- Almashtirgich: header (`LocaleSwitcher`) va auth sahifalari.

## Integratsiya kelishuvi (FE registri §0)

- Har himoyalangan so'rov: `Authorization: Bearer <access>`; 401 → `POST /auth/refresh` (rotatsiya) → bir marta qayta.
- Xato konverti `{ error: { code, message, details } }` → `ApiError`; `error.code` → matn: `src/lib/api/error-codes.ts`.
- `X-Device-Id` (barqaror, `localStorage`) va `ngrok-skip-browser-warning: 1` har so'rovda.
- Reader (model A): PDF `GET /reader/{id}/content` dan `Range` bilan, bo'lak-bo'lak; fayl hech qachon to'liq yuklab olinmaydi.
- Highlight koordinatalari: `annotations.location_data = { page, rects: [[x, y, w, h], …] }` — sahifa o'lchamiga nisbatan 0–1 ulushlar (backend tasdiqlagan; ≤ 32 KB). O'qishda eski `location` ham qabul qilinadi.
- Progress `PUT /books/{id}/progress` — debounce 1.5 s + `pagehide` da `keepalive` bilan.
