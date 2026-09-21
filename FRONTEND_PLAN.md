# Articles365 Frontend — Yakunlash rejasi

**Asos:** `articlesdoc/Articles365_Frontend_Vazifalar_v1.0.md` (FE-ID'lar) + tijorat taklifi (14 modul).
**Tartib:** backend'ga bog'liq bo'lmagan ishlar avval, kichikdan kattaga.
**Qoida:** har task tugagach `tsc --noEmit`, `eslint`, `next build` toza o'tishi va
funksional tekshiruv bajarilishi shart — shundan keyingina `[ ]` → `[x]`.

Holat: `[ ]` bajarilmagan · `[x]` bajarilgan va tekshirilgan · `[~]` bloklangan (backend kutilmoqda)

---

## 1. Texnik tozalash

- [x] 1.1 `package-lock.json` ni `package.json` bilan sinxronlash (`npm ci` xatosiz o'tsin)
- [x] 1.2 `eslint.config.mjs` — `public/**` ni ignore qilish (`npm run lint` xatosiz o'tsin)
- [x] 1.3 `.env.example` (`NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_NAME`, `BACKEND_URL`)

**Tekshiruv:** `npm ci` ✅ · `npm run lint` ✅ · `npm run typecheck` ✅ · `npm run build` ✅ (2026-09-21)

---

## 2. Reader — o'qish funksiyalarini yakunlash (FE-4, FE-5)

- [x] 2.1 Highlight'ni sahifa ustida vizual tiklash (FE-5.2) — tanlangan matn koordinatalari
      `location.rects` ga (sahifa o'lchamiga nisbatan 0–1 ulushlarda) saqlanadi, qayta ochilganda
      rangli overlay sifatida chiziladi; zoom o'zgarsa ham joyida qoladi
- [x] 2.2 8 xil rang tanlash (FE-5.5) — tanlash paneli + mavjud highlight rangini o'zgartirish;
      oxirgi tanlangan rang eslab qolinadi
- [x] 2.3 Nusxalash / chop etish cheklovi (FE-4.6, TZ §4) — `copy`/`cut`/`dragstart` bloklanadi,
      `Ctrl+P`/`Ctrl+S` ushlanadi, `@media print` da reader yashiriladi
- [x] 2.4 Varaqlash rejimi (FE-4.4, S-29=C) — "scroll" va "sahifa-sahifa" rejimlari o'rtasida
      almashish, klaviatura + swipe navigatsiya, rejim eslab qolinadi

**Tekshiruv (2026-09-21):** `lint` ✅ · `typecheck` ✅ · `build` ✅ · e2e (mock backend + headless Chrome,
`playwright-core`) — 32/32 ✅, ikki marta ketma-ket; 360px mobil + tungi rejim + swipe ✅.
Yo'l-yo'lakay topilib tuzatilgan buglar:
- progress `pagehide` da yuborilgan `PUT` brauzer tomonidan bekor qilinardi → `keepalive: true`
  ("davom ettirish" ishonchsiz edi)
- chop etish dialogi (`display:none`) `ResizeObserver` ga 0 o'lcham berib masshtabni buzardi va scroll
  holatini yo'qotardi → 0 o'lcham e'tiborsiz, `afterprint` da sahifa tiklanadi
- sahifa raqami kiritib Enter bosilganda fokus input'da qolib, klaviatura yorliqlari ishlamasdi → blur
- zoom o'zgarganda joriy sahifa saqlanmasdi → stride o'zgarganda sahifa boshiga suriladi

---

## 3. Xato / UX qatlami (FE-0.5, FE-1.7, 0-bo'lim kelishuvi)

- [x] 3.1 `ERROR_CODES` xaritasi — `API.md` dagi barcha kodlar uchun tushunarli matn;
      `errorMessage()` avval xaritadan, keyin backend `message`dan oladi
- [x] 3.2 `DEVICE_LIMIT_REACHED` UX — login sahifasida aniq xabar
- [x] 3.3 `ngrok-skip-browser-warning: 1` header (barcha so'rovlar, shu jumladan refresh)
- [x] 3.4 Fayl yuklash: progress bar (XHR) + klient tomonida format/hajm tekshiruvi (FE-6.5)
- [x] 3.5 Frontend `README.md` (ishga tushirish, env, backend hujjatlariga havola)

**Tekshiruv (2026-09-21):** `lint` ✅ · `typecheck` ✅ · `build` ✅ · e2e (mock backend) — 16/16 ✅:
INVALID_CREDENTIALS/500 → o'zbekcha matn; DEVICE_LIMIT_REACHED → maxsus yo'l-yo'riq (`details.limit` bilan);
har so'rovda `ngrok-skip-browser-warning: 1` + barqaror `X-Device-Id`; yaroqsiz PDF/muqova serverga
yuborilmaydi (magic bytes); 3 MB yuklashda progress 0→100 (CDP throttle bilan); reader regressiya testi ✅.
Eslatma: `NEXT_PUBLIC_API_URL` bilan to'g'ridan-to'g'ri ulanganda backend CORS `ngrok-skip-browser-warning`
header'iga ruxsat berishi kerak (registr §0 kelishuvi).

---

## 4. Ko'p tillilik — uz / ru / en (FE-7.2, S-6)

- [x] 4.1 `LocaleProvider` + lug'atlar (`src/i18n/`), `localStorage` da saqlash, `<html lang>`
- [x] 4.2 Til almashtirgich (header + auth sahifalar)
- [x] 4.3 Barcha UI matnlarini lug'atga ko'chirish (auth, kutubxona, profil, reader, admin, xatolar)

**Tekshiruv (2026-09-21):** `lint` ✅ · `typecheck` ✅ · `build` ✅ · e2e i18n — 21/21 ✅ (login/kutubxona/profil/
reader/admin uz·ru·en, almashtirgich, reload'da saqlanish, `<html lang>`, xato matnlari, interpolyatsiya, ekranda
xom kalit yo'q, hidratsiya xatosi yo'q); reader 32/32 ✅, xato/UX 16/16 ✅, mobil ✅ — regressiya yo'q.
Yondashuv: `localStorage` + `useSyncExternalStore` (URL-prefiksli marshrutlash emas — ilova auth'langan SPA, noindex);
lug'atlar `src/i18n/dict/{uz,ru,en}.ts` — `uz` kalitlar manbai, ru/en `Dict` tipi bilan to'liqlikka tekshiriladi (tsc).
Default til `uz` (brauzer tilidan taxmin qilinmaydi). `metadata.description` (server, noindex) o'zbekcha qoldi.

---

## 5. Public katalog (FE-2) — backend tasdiqladi (2026-09-21)

- [x] 5.1 `/catalog` ro'yxat sahifasi — `GET /catalog` (auth yo'q, rate-limit): qidiruv, kategoriya, pagination,
      `price`, `article_count`, `has_cover`; public qobiq (`PublicShell`: kirish/kutubxona, til, mavzu)
- [x] 5.2 Kitob batafsil (public) `/catalog/[bookId]` — `GET /catalog/{id}` yo'q: ro'yxatdan (sessionStorage kesh →
      sahifalab qidirish) olinadi; backend'dan alohida endpoint so'ralgan
- [x] 5.3 "Sotib olish" tugmasi — `NEXT_PUBLIC_PURCHASE_URL` (Telegram bot havolasi, `{book_id}` shabloni); yo'q bo'lsa
      "administrator bilan bog'laning". Aniq oqim — PM Q2 dan keyin

## 6. Backend javoblari bo'yicha moslashtirish (2026-09-21)

- [x] 6.1 Annotatsiya maydoni `location` → **`location_data`** (yozishda `location_data`, o'qishda ikkalasi ham qabul
      qilinadi — eski yozuvlar uchun); `page` yuqori darajada qoladi
- [x] 6.2 Admin dashboard (FE-6.9) — `GET /admin/stats` (users/books/articles/categories/access/annotations/
      active_sessions, holat bo'yicha taqsimot); 404 bo'lsa eski hisoblashga qaytadi
- [x] 6.3 `DEVICE_LIMIT_REACHED` — `details` hozircha `null` (limit 2); backend `{limit, active_devices[]}` qo'shsa
      qurilmalar ro'yxati ko'rsatiladi (FE tayyor turadi)
**Tekshiruv (2026-09-21):** `lint` ✅ · `typecheck` ✅ · `build` ✅ (`/catalog`, `/catalog/[bookId]`) · e2e katalog/stats/
location_data — 26/26 ✅ (mehmon `/`→`/catalog`, narx/kategoriya/maqola soni, qidiruv `?q=`, pagination, batafsil kesh va
keshsiz, topilmadi, `Sotib olish` `{book_id}` havolasi, kirgan foydalanuvchi uchun `O'qish`, eski `location` highlight
chiziladi, yangi `location_data` bilan yuboriladi, `/admin/stats` plitkalar+taqsimot); regressiya: reader 32 ✅,
xato/UX 16 ✅, i18n 21 ✅, mobil ✅. Eslatma: raqam formati ICU'ga bog'liq emas (`formatNumber`) — Chrome `uz-UZ`
uchun "45,000", Node "45 000" berardi. Public kategoriya filtri — public `/categories` endpointi yo'q (so'ralgan).

- [~] 6.4 **Article ierarxiyasi (Q7)** — backend namunasi `POST /articles/{article_id}/annotations`. Reader, progress,
      search, TOC, kutubxona ham article bo'yichami? `API.md` eskirgan — **`/openapi.json` kerak**; tasdiqlanmaguncha
      `/books/{book_id}/...` saqlanadi

---

## Backend bilan muloqot

**Javob olindi (2026-09-21):** `/catalog` va `/admin/stats` bor (API.md eskirgan, OpenAPI — manba haqiqati);
highlight formati mos, maydon nomi `location_data` (≤ 32 KB); `DEVICE_LIMIT_REACHED.details = null`, limit 2.

**Yangi savollar / so'rovlar:**
1. ❗ `POST /articles/{article_id}/annotations` — Article ierarxiyasi (Q7) joriy qilinganmi? Reader/progress/search/TOC/
   kutubxona endpointlari article bo'yichami? **`/openapi.json` faylini yuboring** — reader shunga qarab qayta quriladi.
2. `GET /catalog/{book_id}` (bitta kitob) — batafsil sahifa uchun; hozir ro'yxatdan qidiriladi (≤ 10 sahifa × 100).
2a. Public `GET /categories` — katalogda kategoriya filtri uchun (`category_id` query bor, lekin ro'yxat manbai yo'q).
3. Public muqova: `has_cover` bor, lekin auth'siz muqova endpointi yo'q (`/reader/{id}/cover` ruxsat talab qiladi).
   `GET /catalog/{book_id}/cover` bo'lsa yaxshi.
4. `DEVICE_LIMIT_REACHED.details = { limit, active_devices[] }` — **ha, qo'shing**; FE ko'rsatishga tayyor.
5. `price` valyutasi/birligi (so'm?) va `null` bo'lishi mumkinmi?
