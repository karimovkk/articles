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

## 7. Jonli API auditi (2026-09-21, `https://articles.api.cognilabs.org/openapi.json`, 61 endpoint)

**Xulosa:** `API.md` eskirgan. Backend'da **Article ierarxiyasi** joriy: kitob = maqolalar (PDF) to'plami; reader,
progress, annotatsiya, qidiruv, TOC — **maqola bo'yicha** (`/reader/articles/{id}`, `/articles/{id}/...`). Bundan tashqari
buyurtmalar (orders), bildirishnomalar, 2FA, parol o'zgartirish, admin foydalanuvchi yaratish/parol tiklash, eksport
(XLSX), qo'lda TOC, mark-read, reading-heartbeat bor. Eski `/reader/{book_id}`, `/books/{id}/progress` → **404**.
Jonli tekshiruv (faqat o'qish + admin'ga bitta kitobga vaqtinchalik ruxsat berib, keyin bekor qilindi): xato konverti
✅, refresh rotatsiya ✅ (eski token → `INVALID_TOKEN`), logout → `SESSION_REVOKED` ✅, CORS `localhost:3000` ✅
(`authorization, x-device-id, ngrok-skip-browser-warning, range` ruxsat), stats ✅, katalog ✅, annotatsiya CRUD
(`location_data` saqlanadi) ✅, progress/heartbeat/mark-read ✅, search/toc ✅, **`/content` 206 lekin `Content-Range`
yo'q** ❗ (416 javobida `details.size` bor).

### Frontend tasklari (tartib bilan)

- [x] 7.1 **API qatlami** OpenAPI'ga moslash: login `{identifier, password, device_name, totp_code?}`; register → `UserResponse`
      (token yo'q → login); logout `{refresh_token}`; sessiya `last_active_at`/`revoked_at`; `LibraryItem` (tekis:
      `book_id, overall_percentage, read_count, article_count, last_read_at`); `Annotation` (`article_id, selected_text,
      note_text, label, location_data`); `ProgressResponse` (`percentage, is_read, reading_seconds`); `SearchResponse.matches`;
      `TocResponse.entries` (`level`); `Watermark.watermark_text`; `ReaderMetadata` (`processing_status, features.can_*`);
      `BookAdmin` (`price` string, status ACTIVE|INACTIVE, `category` nested); `Category.status`; audit `meta`/`action` enum;
      yangi modullar: articles, orders, notifications, me (password, 2fa), admin articles/orders/users/export.
      Xato kodlari: `INVALID_TOKEN`, `RANGE_NOT_SATISFIABLE.details.size`.
  **Tekshiruv (7.1):** typecheck/lint/build ✅; **prod smoke** (dev server → `articles.api.cognilabs.org`, faqat o'qish)
  20/20 ✅: katalog (decimal narx), login/INVALID_CREDENTIALS, profil sessiyalari (`last_active_at`, bekor qilinganlar
  yashirin), `/admin/stats`, kitoblar (narx/ACTIVE), kitob sahifasi (maqolalar READY/2 sahifa), kategoriyalar (`status`),
  audit (enum filtr, `meta`), foydalanuvchilar, logout. Topildi va tuzatildi: `/library?sort=recent` → 422 (faqat
  `granted|title`, B11); Chrome ICU `uz` oy nomlari yo'q → `formatDateTime`.
- [x] 7.2 **Kutubxona → kitob sahifasi**: `/library` kartalari kitob darajasida (`overall_percentage`, `read_count/article_count`,
      muqova `?size=thumb`); `/books/[bookId]` — maqolalar ro'yxati (`/reader/books/{id}/articles`: holat, %, o'qilgan),
      "davom ettirish".
  **Tekshiruv (7.2):** typecheck/lint/build ✅; e2e (OpenAPI-shakldagi yangi mock) 12/12 ✅: kutubxona kartasi
  (`read_count/article_count`, `overall_percentage`), kitob sahifasi (holatlar, %, "Davom ettirish" → yarim o'qilgan
  maqola, PROCESSING havolasiz), keshsiz ochilganda katalogdan ma'lumot, 403 ekrani, reader maqola id bilan
  (Content-Range'siz 206 → 416 `details.size` workaround ishladi). Backend eslatma B12: `GET /library/{book_id}` yo'q.
- [x] 7.3 **Reader maqola bo'yicha** `/reader/[articleId]`: metadata/content/watermark `/reader/articles/{id}`;
      `Content-Range` yo'qligi uchun hajm 416 `details.size` orqali (workaround); `features.can_search/has_toc/watermark`;
      `processing_status != READY` ekrani; progress `PUT {current_page, current_location, percentage}`;
      `reading-heartbeat` (30 s, faqat ko'rinayotganda); "O'qib bo'lindi" (`mark-read`, FE-5.8); annotatsiya maydonlari;
      TOC `entries`; qidiruv `matches`; maqolalar orasida oldingi/keyingi.
  **Tekshiruv (7.3):** typecheck/lint/build ✅; e2e 19/19 ✅: `/reader/[articleId]`, qo'shni maqolalar (faqat READY),
  `watermark_text`, TOC `entries`/`level`, qidiruv `matches`, mark-read qo'lda + avtomatik (oxirgi sahifa), progress
  `current_page/percentage/current_location`, heartbeat (30 s + yashirilganda/yopilganda qoldiq, `keepalive`),
  PROCESSING holat ekrani (content so'ralmaydi), 403, highlight `selected_text`/`location_data`/`article_id`, `note_text`,
  Ctrl+P, varaqlash. `features.watermark=false` bo'lsa overlay yashirinadi; `can_read=false` → holat ekrani.
- [x] 7.4 **Profil**: parol o'zgartirish (FE-1.9, `/me/password`); 2FA sozlash (QR `provisioning_uri`, enable/disable);
      sessiyalar (`last_active_at`, bekor qilinganlar ajratiladi); buyurtmalarim (`/orders`).
  **Tekshiruv (7.4):** typecheck/lint/build ✅; e2e 12/12 ✅: parol (mos kelmaslik, noto'g'ri joriy parol, muvaffaqiyat),
  2FA (QR `qrcode` bilan lokal chiziladi, secret, noto'g'ri/to'g'ri kod, enable/disable), buyurtmalarim (kitob nomi
  katalogdan, PENDING → chek → AWAITING_REVIEW → admin approve → APPROVED + kitob havolasi). Backend eslatma B13:
  `UserResponse` da 2FA holati (`two_factor_enabled`) yo'q — ikkala tugma ham ko'rsatiladi.
- [x] 7.5 **Buyurtma oqimi** (FE-2.3, PM S-16): katalog → "Sotib olish" → `POST /orders {book_id}` (PENDING) → to'lov
      ko'rsatmasi (`NEXT_PUBLIC_PAYMENT_INSTRUCTIONS`/Telegram) → "To'ladim" `POST /orders/{id}/receipt` (AWAITING_REVIEW)
      → holat kuzatuvi; login'da `totp_code` maydoni (2FA talab qilinsa).
  **Tekshiruv (7.5):** typecheck/lint/build ✅; e2e 12/12 ✅: mehmon → `login?next=`, `POST /orders` (summa kitob
  narxidan), PENDING → chek → AWAITING_REVIEW, reload'da holat, REJECTED sabab + qayta buyurtma, APPROVED → ruxsat →
  "O'qish", 2FA login (`TWO_FACTOR_REQUIRED` → kod maydoni, `INVALID_TOTP`, muvaffaqiyat). `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS`
  env — to'lov ko'rsatmasi; `NEXT_PUBLIC_PURCHASE_URL` ixtiyoriy Telegram havolasi.
- [x] 7.6 **Bildirishnomalar** (FE-7.3): header'da qo'ng'iroq + `unread-count`, ro'yxat, o'qildi / barchasini o'qildi.
  **Tekshiruv (7.6):** typecheck/lint/build ✅; e2e 7/7 ✅: qo'ng'iroq badge (`unread-count`, 60 s + fokus), `/notifications`
  ro'yxati (o'qilmagan ajratilgan, tur yorlig'i, `meta.book_id` → kitob havolasi), ochish → o'qildi, `unread_only` filtri,
  barchasini o'qildi → badge yo'qoladi.
- [x] 7.7 **Admin**: kitob (`price`, ACTIVE/INACTIVE, `book_metadata`); **maqolalar** (yaratish/tahrirlash/o'chirish/tartib,
      fayl yuklash `.../articles/{id}/file`, qo'lda TOC muharriri `PUT .../toc` — FE-6.10); kategoriyalar (`status`, qidiruv,
      pagination); foydalanuvchilar (yaratish FE-6.11, parol tiklash FE-1.8, barcha sessiyalarni bekor qilish);
      **buyurtmalar** (ro'yxat, approve/reject); eksport XLSX (FE-6.14); audit (`meta`, `action` enum filtr);
      ruxsatlar ro'yxatida user/book nomlarini resolve qilish (kesh bilan).
  **Tekshiruv (7.7):** typecheck/lint/build ✅; e2e 19/19 ✅: dashboard "tekshiruvdagi buyurtmalar", `/admin/orders`
  (nomlar resolve, approve → ruxsat, reject + sabab), maqolalar (yaratish, PDF yuklash progress → PROCESSING → READY
  polling, qo'lda TOC `PUT .../toc`, rename, tartib ↑↓, o'chirish), foydalanuvchi yaratish → parol tiklash → barcha
  sessiyalar bekor, XLSX eksport (fayl nomi FE'da), ruxsatlar ro'yxatida user/kitob nomlari (N+1 kesh, B5).
- [x] 7.8 **Mock backend'ni OpenAPI'ga moslash**, barcha e2e to'plamlarni yangilash, **prod smoke test** (login, katalog,
      kutubxona, reader Range, annotatsiya, progress — admin akkaunt bilan, keyin tozalash).

  **Tekshiruv (7.8):** mock to'liq OpenAPI shaklida (kitob→maqolalar, orders, notifications, 2FA, Content-Range'siz 206);
  barcha 11 e2e to'plam ✅ (reader 32, xato/UX 16, i18n 21, katalog 26, kitob 12, reader-maqola 19, profil 12,
  buyurtma 12, bildirishnoma 7, admin 19, mobil 3 — jami **179**); **prod smoke** (admin akkaunt, vaqtinchalik ruxsat →
  o'qish → tozalash) 16/16 funksional ✅: kutubxona, kitob sahifasi, reader haqiqiy PDF (Range 416-workaround),
  prod watermark, highlight saqlash/tiklash, qidiruv, mark-read, progress, katalog buyurtma tugmasi, admin sahifalar.
  Prod'da qoldirilgan iz: audit logda BOOK_ACCESS_GRANTED/REVOKED yozuvlari (annotatsiya o'chirildi, ruxsat bekor).

## 8. Backend B-javoblari bo'yicha moslashtirish (2026-09-21, ikkinchi deploy — 65 endpoint)

- [x] 8.1 `GET /catalog/{id}` → batafsil sahifa to'g'ridan-to'g'ri; `GET /categories` → katalogda kategoriya filtri
      (`?category=`); `GET /catalog/{id}/cover` → mehmonlar uchun ham public muqova (`BookCover source="catalog"`)
- [x] 8.2 `GET /library/{id}` → kitob sahifasi ma'lumoti (kesh/katalog o'rniga); `sort=recent` qaytarildi (default)
- [x] 8.3 `two_factor_enabled` → profilda 2FA holati (badge) va faqat tegishli amal; yoqish/o'chirishdan keyin `/auth/me`
- [x] 8.4 `user_email/user_full_name/book_title` → admin ruxsatlar, buyurtmalar, kitob/foydalanuvchi sahifalari,
      buyurtmalarim — N+1 resolver faqat maydon bo'lmaganda (eski backend) ishlaydi
- [x] 8.5 `DEVICE_LIMIT_REACHED.details.active_devices` ko'rsatiladi; `TOTP_REQUIRED`/`INVALID_TOTP` matnlari;
      eksport fayl nomi `Content-Disposition`dan; heartbeat 30 s (≤ 120 s cheklovi ichida)

**Tekshiruv (8):** typecheck/lint/build ✅; mock yangilandi (Content-Range prod kabi bor, `__setnocr` bilan B1-workaround
ham sinaladi); barcha 11 e2e to'plam ✅; **prod smoke (faqat o'qish) 8/8 ✅**: kategoriya filtri, `/catalog/{id}`,
mehmon holati, `sort=recent`, 2FA badge, admin ruxsatlarda N+1 yo'q.

**Tuzatish (mening xatom):** B1 va B6 backend'da avvaldan to'g'ri edi — audit skriptim javob header'larini
katta-kichik harfga sezgir qidirgan (`Content-Range` vs nginx'dan kelgan `content-range`). curl bilan tasdiqlandi:
206 da `content-range`, `accept-ranges`, `cache-control: private, no-store`, `x-content-type-options: nosniff`,
`content-disposition: inline`, `access-control-expose-headers: Content-Range, Accept-Ranges`; eksportda
`content-disposition: attachment; filename="users.xlsx"`. FE 416-workaround zararsiz zaxira sifatida qoldi.

## 9. Mustaqil sifat tekshiruvi (2026-09-21) — tashqi ruxsat talab qilmaydigan ishlar

- [x] 9.1 e2e testlar + mock backend'ni repoga ko'chirish (`e2e/`), portativ brauzer topish, `npm run e2e`, README
- [x] 9.2 **Production build** (`next build` + `next start`) bilan barcha e2e to'plamlar (hozirgacha faqat dev server)
  **Tekshiruv (9.1–9.2):** `e2e/` (mock, 11 to'plam, 3 prod smoke, `lib.mjs`, `run.mjs`, README), `npm run e2e` dev —
  11/11 ✅; `npm run e2e -- --prod` (next build + start) — **11/11 ✅**. Ikki poyga (ma'lumot kelishidan oldin tekshirish)
  testlarda tuzatildi. `playwright-core` devDependency; skrinshotlar `e2e/out/` (gitignore).
- [x] 9.3 Token muddati tugashi: 401 → refresh → qayta so'rov (reader Range bo'laklari o'rtasida ham); refresh xato →
      login'ga yo'naltirish; parallel so'rovlarda bitta refresh (single-flight)
- [x] 9.4 Katta PDF (≥ 60 MB) Range streaming: faqat kerakli bo'laklar so'raladi, to'liq yuklab olinmaydi, ochilish
      vaqti, xotira
  **Tekshiruv (9.3):** `session` to'plami 11/11 ✅ — eskirgan token: parallel so'rovlarda 1 ta refresh, reader ichida
  mark-read/progress 401 → refresh → 200, ishlatilgan refresh → `INVALID_TOKEN`, refresh xatosi → tokenlar/cookie
  tozalanadi → `/login?reason=expired`. **Topilib tuzatilgan bug:** sahifa yangilanganda sessiya tugagan bo'lsa
  AppShell guard'i `reason=expired` siz yo'naltirar edi (xabar ko'rinmasdi) — `expired` holati auth kontekstiga
  ko'chirildi, redirect faqat AppShell'da.
  **Tekshiruv (9.4):** `bigpdf` to'plami 11/11 ✅ — 60.2 MB / 300 sahifa sintetik PDF: birinchi sahifa **1.0 s**,
  dastlab **1.82 MB** so'raldi, 300-sahifaga sakrash **+0.52 MB** (fayl oxiridagi bo'lak), jami 2.34 MB (3.9 %),
  Range'siz to'liq GET yo'q, JS heap 34 MB. Eslatma: sahifa obyektlari fayl bo'ylab sochilgan PDF'larda PDF.js
  ochilishda (`checkLastPage`) ko'p bo'lak so'raydi — backend PDF'larni linearizatsiya qilsa (qpdf `--linearize`)
  ochilish ancha tezlashadi (B14, tavsiya).
- [x] 9.5 Boshqa brauzerlar: Firefox va WebKit (Safari dvigateli) — Playwright build'lari; iPhone emulyatsiyasi
- [x] 9.6 Tarmoq/limit xatolari: 429 `RATE_LIMIT_EXCEEDED`, offline (`NETWORK_ERROR`), 5xx — tushunarli xabarlar,
      "oq ekran" yo'q (registr §11.7)
- [x] 9.7 Frontend xavfsizlik header'lari (`X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`)
      barcha sahifalar uchun + tekshiruv
- [x] 9.8 Vizual o'tish: barcha sahifalar tungi rejim + 360px (skrinshotlar), kesilgan/ustma-ust elementlar
  **Tekshiruv (9.5):** Firefox (Playwright build) — **13/13 to'plam ✅**; WebKit build yuklandi, lekin bu mashinada
  ishlamaydi (ICU 74 / libjpeg8 kerak, tizimda ICU 78 — Kali; sudo'siz o'rnatib bo'lmaydi) → Safari **jamoa** tomonidan.
  Chromium'ga xos joylar (CDP throttle, `isMobile`, `performance.memory`) testlarda shartli.
  **Tekshiruv (9.6):** `network` 10/10 ✅ — 429, API uzilishi (NETWORK_ERROR), 503 login, 500 kutubxona/reader, 404.
  Topilib tuzatildi: (a) xatodan keyin **bir xil so'rovni qayta yuborish** qayta so'ramas edi (katalog/kutubxona —
  endi `reload()`); (b) reader kontent xatosida backend'ning xom xabari ko'rinar edi — endi `errorMessage()` xaritasi.
  **Tekshiruv (9.7):** `headers` 12/12 ✅ — `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`, `/reader` va `/books` `no-store`; `/books`, `/notifications` proxy guard'ga qo'shildi.
  **Tekshiruv (9.8):** `visual` — 18 sahifa × 360/1280 × kunduzgi/tungi = 72 ko'rinish ✅ (gorizontal scroll yo'q, bo'sh
  sahifa yo'q). Topilib tuzatildi: `LocaleSwitcher`/`buttonClass` ning `inline-flex` sinfi `hidden sm:...` bilan
  to'qnashib mobil header'ni toshirar edi (katalog 514px, admin 409px); mobil nav endi aylantiriladi; admin
  jadvallari `overflow-x-auto`; dashboard audit qatori `truncate`. Skrinshotlar: `e2e/out/visual/`.
  **Yakuniy regressiya:** 16 to'plam (Chrome, dev) ✅, production build ✅, lint/typecheck ✅.
- [~] 9.9 Prod'da to'liq foydalanuvchi zanjiri (test user/kitob/buyurtma), 2FA, katta PDF yuklash — **ruxsat kutilmoqda**
- [~] 9.10 Deploy (Vercel) + jonli URL smoke, Safari/Edge/haqiqiy telefon — **jamoa**

## 10. Dizayn yangilanishi (2026-09-21) — ilhom: Alfa-FCUI "Floodlight" tizimi

Tamoyil: qora ramka + suzuvchi och "varaq", bitta aksent, display shrift sarlavhalarda, yumaloq kartalar/tugmalar,
jadvalda tinted sarlavha, chip'lar; **barcha dropdown-simon elementlar qo'lbola** (native `<select>`, `confirm()`,
`checkbox` yo'q) — portal orqali, klaviatura va mobil bilan.

- [x] 10.1 Dizayn tizimi: tokenlar (light/dark), shriftlar (Manrope + Unbounded, `next/font`, self-hosted), bazaviy CSS
      (`src/app/design.css`, `globals.css` `@theme inline` orqali Tailwind'ga bog'langan): tugmalar, chip, karta,
      page-head, stat plitka, jadval, forma, menyu, select, kalendar, modal, pill/tab, bo'sh holat, skeleton, progress
- [x] 10.2 Qo'lbola boshqaruv elementlari (`src/components/ui/`): `Select` (portal, ≥6 variantda qidiruv, ↑↓/Home/End/
      Enter/Esc, harf bilan sakrash, combobox/listbox aria), `DatePicker` (kun/oy/yil, Bugun/Tozalash, min/max, uz/ru/en),
      `Menu`/`MenuItem`, `Switch`, `ConfirmProvider`+`useConfirm`, `Modal` (portal, Esc, fokus), `DropdownPanel`
      (viewport'ga sig'masa yuqoriga, scroll/resize/ResizeObserver), inline SVG ikonkalar (`icons.tsx`)
- [x] 10.3 Admin qobig'i (`AdminShell`): sidebar (4 bo'lim, faol element aksent, yig'iladigan — `localStorage`,
      <900px drawer), topbar (crumbs + `useAdminCrumb` detal nomi, bildirishnoma, til menyusi, mavzu, "Ilovaga qaytish"),
      foydalanuvchi chipi + menyu; `src/app/(admin)/admin/*` route guruhi (`AppShell chromeless` → `AdminGuard`)
- [x] 10.4 Admin sahifalari: dashboard (`Stat` plitkalar + so'nggi amallar), kitoblar/foydalanuvchilar/ruxsatlar/
      buyurtmalar/audit (`Toolbar` + `DataTable`, qo'lbola `Select` filtrlar, qator bosilsa detal), kitob (hero + tablar
      Ma'lumotlar/Maqolalar/Ruxsatlar, **nashr sanasi — `DatePicker`** → `book_metadata.published_at`, holat `Switch`
      + tasdiqlash, maqola amallari `Menu`, TOC darajasi `Select`), foydalanuvchi (hero, hisob, sessiyalar, ruxsatlar,
      bloklash tasdiqlash), kategoriyalar (`Switch` holat, inline tahrir), `GrantModal` — qidiruvli `Select`
- [x] 10.5 Kutubxona (page-head statistika, "Davom ettirish" kartasi, `.book-grid` muqova kartalari: progress,
      o'qilgan/jami badge) va kitob sahifasi (`.book-hero`, 3 stat, progress, "O'qishni boshlash/Davom ettirish",
      maqolalar "playlist"i: raqam/✓/▶, holat chip); katalog (toolbar, kartalar, narx) va batafsil (`.book-hero`, buyurtma
      paneli); muqova placeholder'i nom bilan (`BookCover`, admin uchun `source="auto"`)
- [x] 10.6 Umumiy qobiq: `SiteHeader` (pill nav, til menyusi, mavzu, bildirishnoma icon-btn, foydalanuvchi chipi + menyu:
      profil/bildirishnomalar/admin/chiqish; mobil pill nav), auth layout (qora "art" panel + forma varag'i), profil,
      bildirishnomalar (`Switch` "faqat o'qilmaganlar"), 404/xato; reader toolbar/sidebar ikonkalar va tablar;
      barcha `confirm()` → `useConfirm`; native `<select>`/`checkbox` qolmadi; `+`/`←`/`→` matnli prefikslar → ikonkalar
- [x] 10.7 Testlar: e2e yordamchilari (`selectPick`, `selectOptionCount`, `confirmDialog`, `datePick`), 7 to'plam va
      2 prod smoke yangilandi; `tsc` ✅ · `eslint` ✅ · **production build 16/16 to'plam (226 tekshiruv) ✅** ·
      Chrome dev 16/16 ✅ · Firefox 16/16 ✅ (visual alohida ishga tushirilganda — uzoq dev sessiyada 90 s timeout) ·
      vizual sweep 72 ko'rinish (360/1280 × light/dark, gorizontal scroll yo'q) ✅ (2026-09-21)

**Tekshiruv:** skrinshotlar `e2e/out/visual/` (gitignored). Eslatma: `.next/types` eskirgan bo'lsa `tsc` `(app)/admin`
yo'llari haqida xato beradi — `rm -rf .next/types .next/dev/types` yoki `next build` yangilaydi.

## 11. Dizayn tuzatishlari (2026-09-21, foydalanuvchi fikri)

- [x] 11.1 To'liq kenglik: foydalanuvchi qobig'i (`.site-main`, `.site-header-inner`) va admin varag'i (`.sheet-content`)
      `max-width` cheklovisiz — kontent ekran kengligini to'ldiradi (gutter'lar saqlanadi)
- [x] 11.2 Jonli qidiruv (`useDebounced` / `useDebouncedCallback`, `src/lib/use-debounce.ts`): tugmalar olib tashlandi,
      yozilayotganda 300 ms debounce; eskirgan javob e'tiborsiz (`useAsync` kalit tekshiruvi, reader'da `seq`), fokus
      saqlanadi, Enter — darhol (flush; bir xil so'rov → `reload`); katalog URL `?q=` `router.replace` bilan (tarix toza,
      tashqi URL o'zgarishi input'ga qaytadi), kutubxona/admin kitoblar/foydalanuvchilar/audit (sahifa 1 ga qaytadi),
      reader sidebar (≥2 belgi). Test: `e2e/tests/search.test.mjs` (23 tekshiruv, jumladan mock `/__delay` bilan poyga) ✅
- [x] 11.3 Til almashtirgichda bayroqlar — inline SVG (`src/components/ui/flags.tsx`, emoji Windows'da chiqmaydi):
      header/topbar menyusi (trigger + har bir variant), auth segmenti
- [x] 11.4 `ThemeSwitch` (`src/components/ui/theme-switch.tsx`, `role=switch`): chapda oy, o'ngda quyosh, tugmacha
      pruzhinali suriladi, ikonkalar aylanib almashadi (CSS); `ThemeProvider.toggle(origin)` — bosilgan nuqtadan aylana
      "to'lqin" (View Transitions API + `clip-path: circle()`, 750 ms; API yo'q / `prefers-reduced-motion` → oddiy),
      klaviaturada tugma markazidan. Header va admin topbar'da. Test: `e2e/tests/theme.test.mjs` (13) — Chrome (to'lqin)
      ✅, Firefox ✅
- [x] 11.5 Admin sidebar yig'ish tugmasi (`.sidebar-collapse`) — sidebar'ning o'ng chekkasida, yuqorida (y=50px), ikkala
      holatda ham bir xil balandlikda (« / » ikonkalari); `admin` to'plamida o'lchov tekshiruvi ✅
- [x] 11.6 Testlar: yangi to'plamlar `search` (23) va `theme` (13), `admin` ga sidebar o'lchovi; mock `/__delay`
      (poyga) va audit `entity_type` filtri. `tsc` ✅ · `eslint` ✅ · **production build 18/18 to'plam (265 tekshiruv)
      ✅** · Firefox 18/18 ✅ (visual — alohida; uzoq dev sessiyada 90 s timeout, mahsulot xatosi emas) · brauzerda
      vizual: to'liq kenglik 1920px, bayroqlar (segment + menyu), switch ikkala holat, to'lqin kadrlari, sidebar
      tugmasi (2026-09-21)

## 12. Tuzatishlar (2026-09-22, foydalanuvchi fikri)

- [x] 12.1 Mavzu almashishdan keyingi bug'lar (tekshirib topildi va tuzatildi):
      (a) dark saqlangan holda sahifa qayta yuklanganda ~100 ms **oq "flash"** — `<head>` dagi inline skript mavzuni
      birinchi paint'dan oldin qo'llaydi (`src/app/layout.tsx`, `THEME_SCRIPT`); test: dastlabki kadrlar dark;
      (b) to'lqin paytida (~0.75 s) brauzer **bosishlarni yutardi** (`::view-transition` qatlami, Chrome'da
      `pointer-events` yordam bermaydi) — endi bosilsa to'lqin darhol tugatiladi va bosish asl elementga qayta
      yuboriladi (`withWave` → `skipTransition` + `elementFromPoint`), davomiylik 600 ms;
      (c) ketma-ket ikki bosish bir marta almashardi — yangi qiymat apply paytida joriy saqlangan mavzudan hisoblanadi,
      atribut faqat oxirgi to'lqinda tozalanadi. Test: `theme` to'plami (15) Chrome ✅ Firefox ✅
- [x] 12.2 Buyurtmalar: holat filtri default **"Barcha holatlar"** (avval "Tekshirilmoqda"); `admin` testida tekshiruv
- [x] 12.3 Audit: 19 ta amal va 7 ta obyekt turi uz/ru/en'ga tarjima qilindi (`audit.action.*`, `audit.entity.*`,
      `auditActionLabel`/`auditEntityLabel`): filtr Select'da tarjima + kod, jadvalda tarjima (kod ostida), dashboard'da
      ham; obyekt filtri — matn o'rniga tarjimali qo'lbola Select. Test: `search` to'plami (audit qismi)
- [x] 12.4 Tekshiruv: `tsc` ✅ · `eslint` ✅ · **production build 18/18 to'plam (272 tekshiruv) ✅**

## 13. Auth dizayni, parol ko'rsatish, varaqlash animatsiyasi (2026-09-22, foydalanuvchi fikri)

- [x] 13.1 `PasswordInput` (`src/components/ui/password-input.tsx`): ko'z tugmasi — `type` almashganda fokus va kursor
      joyi saqlanadi (`mousedown` preventDefault + `setSelectionRange`), `aria-pressed`/yorliq, Caps Lock ogohlantirishi,
      `strength` (0–4, `passwordStrength`) indikatori. Qo'llanildi: login, ro'yxat (parol + tasdiqlash), profil (3 maydon),
      admin (foydalanuvchi yaratish, parol tiklash)
- [x] 13.2 Login/Register (tadqiqot: eleken.co "50+ login page examples", muz.li login screens, AND Academy —
      split-screen + brend paneli, feature karuseli, "Welcome back" microcopy, ikonkali maydonlar, ko'rsatish/yashirish,
      parol kuchi, real-vaqt tekshiruv, katta CTA): chap panel — "aurora" animatsiyali fon + nuqtali to'r, CSS kitob
      illyustratsiyasi (3 varaq, suzadi, qulf belgisi, suv belgisi), 3 slaydli avto-karusel (hover'da to'xtaydi, nuqtalar);
      o'ng karta — Kirish/Ro'yxat segment-tab, "Xush kelibsiz!"/"Hisob yarating" + microcopy, ikonkali maydonlar,
      parol kuchi, mos kelish ✓/✗, rozilik matni, `lg` CTA; mobil — brend + karta
- [x] 13.3 Reader varaqlash (`FlipStage`, `pdf-viewer.tsx`): joriy ± 1 sahifa oldindan render (yashirin), varaq
      almashishi 3D `rotateY` (orqa tomon oq, soya, 90° dan keyin xiralashadi, 480 ms); sichqoncha bilan sudrash —
      sahifaning chap/o'ng 14% chekkasidan yoki fondan (kursor `grab`), varaq kursorga ergashadi, yarmidan o'tsa yoki
      tez tortilsa varaqlanadi, aks holda qaytadi; fonning chap/o'ng yarmini bosish — oldingi/keyingi (hover'da
      ko'rsatkich); tugma/klaviatura/sahifa raqami/TOC — avtomatik animatsiya; sensor swipe pointer events'da;
      sahifa o'rtasida matn tanlash (highlight) o'zgarmagan
- [x] 13.4 Testlar: `auth-ui` (19: ko'z/fokus/kursor/Caps Lock/kuch/mos kelish/tablar/karusel/profil), `reader` (sudrash,
      qisqa sudrash, fon bosish, animatsiya), `mobile` (swipe → animatsiya); `tsc` ✅ · `eslint` ✅ · **production build
      19/19 to'plam (297 tekshiruv) ✅** · Firefox auth-ui/reader/mobile/theme ✅ (2026-09-22)

- [x] 13.5 Varaq animatsiyasi tuzatildi (foydalanuvchi fikri): varaq kitob qoplamasidek 180° ag'darilmaydi — yupqa
      sahifa umurtqa atrofida faqat 90° gacha buriladi, oxirgi chorakda so'nadi, orqa tomon (`.face.back`) olib tashlandi;
      birinchi/oxirgi sahifalar ham bir xil (1↔2, 5↔6 da maks. 90° o'lchandi). `reader`/`reader-article`/`mobile` ✅,
      Firefox ✅

- [x] 13.6 Login chap paneli — yer shari va orbitadagi kitoblar (`src/components/auth/globe-orbit.tsx`): canvas'da
      aylanuvchi nuqtali globus (Natural Earth 1:110m quruqlik → 7000 nuqtali Fibonacci sferasi, 1.2 KB bitset
      `src/lib/land-mask.ts`; aksent "shahar chiroqlari", chekka nur, soya); `public/` dagi 5 ta kitob rasmi qayta
      ishlandi → `public/auth/book-{1..5}.webp` (fon olib tashlandi — 2 tasida chizilgan shaxmat fon, kesildi,
      520px, jami ~220 KB); og'ma ellips orbita — kitoblar **yuqori-o'ngdan** globus orqasidan chiqib, oldidan
      o'tadi va **pastki-chapda** orqaga kiradi (orqada kichik/xira). Faqat ko'rinib turganda animatsiya
      (IntersectionObserver), reduced-motion — statik, mobilda panel yashirin. Test: `auth-ui` (+6: rasmlar,
      canvas, kirish/chiqish tomonlari o'lchab, reduced-motion, mobil); prod build 19/19 (303) ✅, Firefox ✅

## 14. Buyurtma oqimi v1.0 (2026-09-22, `articlesdoc/Articles365_Buyurtma_Oqimi_Frontend_v1.0.md`)

Backend chekni endi **rasm** bilan qabul qiladi (`POST /orders/{id}/receipt` — `multipart/form-data`: `file` + `receipt_note`),
tasdiqlash/rad etish asosan admin Telegram chatida (bot) bo'ladi. Frontend JSON yuborayotgan edi — rasm yetib bormaydi.

- [x] 14.1 Chek rasm bilan: `ordersApi.submitReceipt(orderId, { file, note })` → `multipart/form-data` (XHR `apiUpload`,
      progress, 401→refresh); umumiy `ReceiptForm` (`src/components/orders/receipt-form.tsx`): rasm tanlash/sudrab
      tashlash, oldindan ko'rish (blob), almashtirish/olib tashlash, `validateReceipt` (JPEG/PNG/WebP magic-bayt, ≤ 10 MB),
      izoh ≤ 1000, yuklash progressi; `OrderPanel` (katalog) va `MyOrders` (profil) da
- [x] 14.2 Xato kodlari `ALREADY_HAS_ACCESS` (409 → "allaqachon kutubxonangizda" + kitobni ochish), `INVALID_FILE`,
      `ORDER_NOT_FOUND` — uz/ru/en
- [x] 14.3 Holat kuzatuvi `useOrderPoll`: AWAITING_REVIEW paytida 20 s, sahifaga qaytilganda (focus/visibility) va
      bildirishnoma o'zgarganda `GET /orders`; APPROVED → "To'lov tasdiqlandi ✅ Kitob kutubxonangizda" + kitobni
      ochish / kutubxonaga o'tish; REJECTED → "To'lov rad etildi ❌" + sabab + "Qayta buyurtma berish"
- [x] 14.4 Admin (web): rad etish sababi majburiy (bo'sh bo'lsa tugma o'chiq, ≤ 500), placeholder "userga ko'rsatiladi"
- [x] 14.5 Bildirishnomalar: `ORDER_APPROVED`/`ACCESS_GRANTED` → `/books/{meta.book_id}` (yo'q bo'lsa `/library`),
      `ORDER_REJECTED` → `/catalog/{meta.book_id}` (yo'q bo'lsa `/profile`)
- [x] 14.6 Mock: receipt faqat multipart (JSON → 422), fayl ≤ 10 MB (413), magic-bayt (422 `INVALID_FILE`), `/__receipts`;
      409 `ALREADY_HAS_ACCESS`; bildirishnoma `meta.book_id`. e2e: `orders` (22 — rasm, rasm emas/katta fayl, server 422,
      rasmsiz fallback, kuzatuv REJECTED/APPROVED reload'siz, 409, bildirishnoma havolasi), `profile` (rasm bilan chek,
      kuzatuv), `admin` (sabab majburiy, multipart tayyorlov). **Prod build 19/19 (314) ✅**, Firefox orders/profile/admin ✅
- [x] 14.7 Backend savollari — pastda B15–B25

## 15. Backend javoblari bo'yicha (2026-09-22, `articlesdoc/Articles365_Buyurtma_Savollar_Javoblar_v1.0.md`)

Backend B15–B25 ning hammasini javobladi va deploy qildi (69 endpoint): `GET /orders/{id}`, `POST /orders/{id}/cancel`
(`CANCELLED`), `GET /payment-info`, `GET /admin/orders/{id}/receipt`, `OrderResponse.has_receipt_file`, reject `reason`
majburiy, 409 `ORDER_ALREADY_PENDING` / `INVALID_ORDER_STATE`, 404 `RECEIPT_NOT_FOUND`, chek PDF ham, AWAITING'da qayta yuborish.

- [x] 15.1 Tiplar va API: `Order.has_receipt_file`, `OrderStatus` + `CANCELLED`; `ordersApi.get/cancel/paymentInfo`,
      `adminApi.orderReceipt` (blob); xato kodlari + `CANCELLED` holati uz/ru/en
- [x] 15.2 Buyurtma paneli va "Buyurtmalarim": 409 `ORDER_ALREADY_PENDING` → mavjud buyurtmaga o'tish; AWAITING'da
      "Chekni almashtirish"; "Bekor qilish" (tasdiqlash oynasi) → CANCELLED (qayta buyurtma mumkin); kuzatuv
      `GET /orders/{id}` bilan
- [x] 15.3 Chek formasi: PDF (magic `%PDF`, fayl kartochkasi), HEIC → JPEG (brauzer dekodlay olsa canvas orqali,
      aks holda aniq xabar)
- [x] 15.4 To'lov rekvizitlari `GET /payment-info`: karta raqami (guruhlab, nusxalash tugmasi), qabul qiluvchi,
      ko'rsatma; bo'sh bo'lsa env'dagi `NEXT_PUBLIC_PAYMENT_INSTRUCTIONS` zaxira
- [x] 15.5 Admin buyurtmalar: "chek bor" belgisi + "Chekni ko'rish" oynasi (rasm yoki PDF, blob URL),
      `RECEIPT_NOT_FOUND`; `INVALID_ORDER_STATE` → xabar + ro'yxat yangilanadi; filtrga `CANCELLED`
- [x] 15.6 Mock + e2e (orders, profile, admin), prod build, Firefox — mock: `ORDER_ALREADY_PENDING` (details), `GET/cancel
      /orders/{id}`, PDF chek + `has_receipt_file`, `/payment-info` (`/__payment?empty=1`), admin chek fayli, approve
      idempotent / 409, bo'sh sabab 422. Natija: `--prod` 19/19 (334 tekshiruv), Firefox orders/profile/admin 3/3.
      ⚠️ Prod'da `/payment-info` qiymatlari hozircha bo'sh — rekvizitlar bloki yashirin, backend `.env` ga karta kiritilsin.

## 16. Mijoz tomoni yangi dizayni (2026-09-22, foydalanuvchi namunasi + `~/Desktop/article.png` fon)

Namuna: qora-oltin uslub — chapda sidebar (nav + kategoriyalar soni bilan + promo karta), tepada header (logo, markazda
nav, qidiruv/qo'ng'iroq/profil), hero (eyebrow, serif sarlavha + oltin kursiv urg'u, qidiruv "pill"), kategoriya
chip'lari, gorizontal kitob kartalari, dumaloq pagination. Backend'da yo'q narsalar (reyting yulduzlari, sevimlilar,
savat, katalog saralash) — qo'shilmaydi (soxta ma'lumot ko'rsatilmaydi); o'rniga maqola soni, narx, "Batafsil"/"O'qish".

- [x] 16.1 Fon: `article.png` → `public/bg/article-*.webp` (desktop + mobil o'lcham, asl fayl repoga kirmaydi);
      qobiq ortida `position: fixed` qatlam + qoraytiruvchi gradient (qorong'i mavzu). Yorug' mavzu uchun alohida
      kunduzgi rasm (`public/bg/light-*.webp` + promo kesimi): sahifa ortida oq parda bilan, hero va promo kartada banner
- [x] 16.2 Mijoz qobig'i (`ClientShell`): header (365 emblema, markazda nav, qidiruv, til, mavzu, qo'ng'iroq, profil) +
      sidebar (nav + o'qilmagan soni, "Kategoriyalar" — kitoblar soni bilan, "Barchasi →", promo karta) + mobil drawer;
      katalog/kutubxona/kitob/bildirishnoma/profil shu qobiqda, reader va auth — o'zgarmaydi
- [x] 16.3 Katalog: hero (eyebrow, serif sarlavha, qidiruv pill + oltin tugma, "kichik qadamlar" yozuvi), kategoriya
      chip'lari (+ "Yana"), gorizontal kartalar (muqova, kategoriya, nom, tavsif, maqola soni, narx, "Batafsil";
      kutubxonada bo'lsa "O'qish"), dumaloq pagination
- [x] 16.4 Qolgan sahifalar: kutubxona (xuddi shu kartalar + progress, "Davom ettirish"), kitob sahifasi, katalog
      tafsiloti, bildirishnomalar, profil — yangi sirtlar (shaffof-qora kartalar, oltin chegara), serif sarlavhalar
- [x] 16.5 i18n (uz/ru/en), e2e (katalog chip'lari, mobil drawer, visual 360/1280 × light/dark), `--prod`, Firefox,
      brauzer skrinshotlari — `--prod` 19/19 (337 tekshiruv, visual 360/1280 × light/dark), Firefox (catalog, search,
      notifications, book, orders) 5/5. Qidiruv "pill"ida tugma yo'q (11.2 talabi: yozilayotganda ishlaydi).
- B27 ❗ Konsol/devtools orqali foydalanuvchi o'z tokeni bilan `GET /reader/articles/{id}/content` ni Range
  so'rovlari bilan chaqirib butun PDF'ni yig'ib olishi mumkin (klient tomonda bartaraf etib bo'lmaydi). Tavsiya:
  qisqa muddatli alohida "reader token", Range so'rovlari uchun rate-limit/anomaliya nazorati (bir sessiyada
  butun faylni ketma-ket so'rash), server tomonda foydalanuvchi bo'yicha suv belgisi (PDF'ga chizilgan).
- B26 (backend uchun) `GET /categories` javobida `book_count` (hozir FE har kategoriya uchun `/catalog?page_size=1`
  so'raydi); katalogda `sort` (mashhur / yangi / narx) bo'lsa FE'da saralash qo'shiladi.

## 17. Haqiqiy varaqlash va qidiruv natijasini bo'rttirish (2026-09-23, foydalanuvchi fikri)

Hozir varaq tekis holda umurtqa atrofida 90° buriladi — "qog'oz" hissi yo'q. Maqsad: qo'lda varaqlangandek —
qog'oz egiladi, chekkasi kursor ortidan keladi, ostidagi sahifaga soya tushadi, qo'yib yuborilganda tabiiy tugaydi.
Texnika: varaqlash paytida sahifa ustida `canvas` qatlami — sahifa rasmi tasmalarga bo'linib, silindr bo'ylab
egilgan holda chiziladi (matn qatlami shu paytda yashiriladi, tugagach qaytadi).

- [x] 17.1 Egiluvchi varaq (canvas): tasmali silindr geometriyasi, perspektiva, yorug'lik bo'yicha soyalash
      (qorayish + yaltirash), 90° dan oshgan uchi — varaqning orqa tomoni (ko'zgu, oqartirilgan)
- [x] 17.2 Soyalar va kitob hissi: ko'tarilgan varaqdan ostidagi sahifaga tushadigan soya, umurtqa (gutter)
      qorayishi, varaqlar stacki qirralari
- [x] 17.3 Tabiiy harakat: varaq chekkasi kursor/barmoq ortidan aniq ergashadi (progress ↔ chekka koordinatasi),
      qo'yib yuborilganda tezlikka bog'liq tugash (spring), tugmalar/klaviatura ham shu animatsiyada
- [x] 17.4 Ishlash va zaxira yo'l: rAF sikli, DPR, 40 ga yaqin tasma; `prefers-reduced-motion` va sahifa hali
      render bo'lmagan holatda — animatsiyasiz o'tish
- [x] 17.5 Qidiruv natijasi PDF'da: natija bosilganda o'sha sahifadagi barcha mosliklar sariq fon bilan
      bo'rttiriladi (~6 s, keyin sekin so'nadi), scroll rejimida birinchi moslikka olib boradi
- [x] 17.6 Testlar (reader, reader-article, mobil swipe), `--prod`, Firefox, kadrlar bo'yicha skrinshot
- [x] 17.7 ❗ Yo'l-yo'lakay topilgan xato: matn qatlami (`textLayer`) canvas bilan mos tushmayotgan edi —
      pdfjs-dist 6 `--total-scale-factor` va span o'lchov o'zgaruvchilarini talab qiladi, bizdagi CSS eski
      formatda edi (span'lar ~2 barobar kichik). Endi matn tanlash, highlight va qidiruv aniq joyida.

## 18. Yorug' mavzu foni (2026-09-23, foydalanuvchi fikri: "oq fonda background yaxshi ko'rinmayapti")

Muammo: kunduzgi rasm butun sahifa ortiga qo'yilib, ustidan kuchli oq parda tortilgan — rasm ham ko'rinmaydi,
ham matn ortida kulrang dog' bo'lib turadi. Yechim: rasm tasodifiy "fon" emas, ataylab qo'yilgan yuqori band
bo'lsin — tepada aniq ko'rinadi, pastga qarab kremga silliq so'nadi; hero esa o'z rasmini takrorlamaydi
(sahifa foni ko'rinib turadi), matn ustida oq parda bo'ladi va yorug' mavzuda **to'q rangda** yoziladi.

- [x] 18.1 Fon qatlami qayta qurildi: rasm — `::before` (yuqori band, to'yinganlik/yorqinlik moslangan),
      parda — `::after` (kremga silliq o'tish). Qorong'i mavzu ham shu tuzilmada (ko'rinishi o'zgarmaydi)
- [x] 18.2 Hero: yorug' mavzuda o'z rasmi yo'q (ikki marta rasm chiqmasin) — sahifa foni ko'rinadi, matn
      to'q rangda, chap tomonda oq parda; qidiruv maydoni ham och sirtda
- [x] 18.3 Sirtlar: header va sidebar yorug' mavzuda zichroq (rasm ustida o'qilishi uchun), kartalar soyasi kuchliroq
- [x] 18.4 Mobil: rasm bandi balandligi va parda kuchi kichik ekranga moslandi
- [x] 18.5 Skrinshotlar (katalog, kutubxona, profil, kitob; 1440/390), `--prod`, Firefox — rasm endi katalogda
      keng band, ichki sahifalarda sarlavha ortidagi yupqa osmon tasmasi; qorong'i mavzu o'zgarmadi

## 19. Yorug' fon ko'rinishi va bildirishnoma nishoni (2026-09-23, foydalanuvchi fikri)

Fikr: "yorug' mavzuda fon deyarli oppoq, rasm ko'rinmayapti" + "bildirishnoma ikonkasi va undagi sonlar dizayni
chiroyliroq bo'lsin". Har vazifadan keyin test qilinadi.

- [x] 19.1 Yorug' fon haqiqatan ko'rinsin: rasm butun ekran ortida (faqat yuqori band emas), parda ancha yengil;
      o'qilishi uchun sahifa sarlavhalari ortida yumshoq oq parda, kartalar to'liq oq
      → test: katalog/kutubxona/profil/kitob skrinshotlari (1440/390) + `visual` to'plami
- [x] 19.2 Bildirishnoma nishoni: qo'ng'iroq ikonkasi va o'qilmaganlar soni (oltin gradient, halqa bilan ajratilgan,
      99+ holati, yangi xabar kelganda yengil animatsiya); sidebar badge ham shu uslubda
      → test: `notifications` to'plami + skrinshot (ikkala mavzu)
- [x] 19.3 Yakuniy: `--prod` 19/19 (339 tekshiruv), Firefox (catalog, notifications) 2/2

## 20. Hero matni rasm ustida (2026-09-23, foydalanuvchi fikri: "textlar orqasidagi oq rang olinsin, rasm tursin")

- [x] 20.1 Katalog hero: yorug' mavzudagi oq panel olib tashlanadi — matn to'g'ridan-to'g'ri rasm ustida turadi;
      o'qilishi uchun matnga yumshoq oq "nur" (text-shadow) va juda yengil parda; qidiruv maydoni och sirtda qoladi
- [x] 20.2 Ichki sahifalar sarlavhasi (kutubxona/profil/kitob) ham shu uslubda — katta oq panel yo'q
- [x] 20.3 Test: skrinshotlar (1440/1280/390, yorug' va qorong'i), `visual` + `catalog`, `--prod` 19/19 (339);
      yo'l-yo'lakay `auth-ui` dagi beqaror globus tekshiruvlari barqarorlashtirildi (canvas chizilishini kutish)

## 21. Reader himoyasi va highlight tuzatishlari (2026-09-23, foydalanuvchi fikri)

Talab: (a) Ctrl+C bilan matn olinmasin; (b) highlight qilingach uni sahifaning o'zidan o'chirish mumkin bo'lsin;
(c) highlight paytida matn ustiga matn chiqmasin — oqimdagi buglar topilib tuzatilsin; (d) kitob matnini olishning
boshqa yo'llari ham topilib yopilsin. Har vazifadan keyin test.

- [x] 21.1 Audit: hozir matnni olishning qaysi yo'llari ochiq — brauzerda tekshirish (Ctrl+C/X, Ctrl+A, kontekst
      menyu, sudrab tashlash, mobil long-press, chop etish, saqlash, highlight oqimidagi xatolar) va ro'yxat
- [x] 21.2 Nusxalashni to'sish: hujjat darajasida `copy`/`cut` (clipboard'ga ogohlantirish matni), Ctrl+A/Ctrl+C/X,
      kontekst menyu, `dragstart`, mobil `-webkit-touch-callout`; foydalanuvchiga tushunarli xabar
- [x] 21.3 Highlight'ni sahifada boshqarish: belgilangan joyni bosish → kichik panel (rang almashtirish, o'chirish)
- [x] 21.4 Highlight oqimidagi buglarni tuzatish (21.1 da topilganlar)
- [x] 21.5 Testlar: yangi `reader-protect` to'plami (nusxalash bloklari, chop etish, highlight paneli/o'chirish,
      dublikat), `--prod`, Firefox

Audit natijasi (21.1): **ochiq teshik** — matn tanlab Ctrl+C bloklangan edi, lekin **Ctrl+A → Ctrl+C butun sahifani,
jumladan kitob matnini nusxalar edi** (`copy` hodisasi himoyalangan blokdan tashqarida, `body` da ushlanmasdi).
Tuzatildi. Highlight "matn ustiga matn" emas — u faqat rangli to'rtburchak; ilgari matn qatlami canvas bilan mos
tushmagani (17.7) shunday taassurot bergan, u ham tuzatilgan. Yana bir bug: bir joyni qayta belgilaganda dublikat
yaratilardi — endi mavjudining rangi yangilanadi.

Bartaraf etilmaydigan yo'llar (brauzer darajasida, hujjat uchun): devtools/konsol, ekran surati, Linux'dagi
"primary selection" (o'rta tugma bilan qo'yish), brauzer menyusidan sahifani saqlash (faqat ko'rinayotgan
sahifalar matni tushadi — qolganlari render qilinmagan), ekran o'quvchi dasturlar.

## 22. Qolgan matn olish yo'llarini yopish (2026-09-23, "devtools/screenshot/primary selection/screen reader ham tekshirilsin")

Asosiy g'oya: sanab o'tilgan yo'llarning aksariyati **brauzer tanlovi (selection)** ga tayanadi — Ctrl/Cmd+C,
Linux'dagi "primary selection" (o'rta tugma), macOS "Look Up"/Services, sudrab tashlash, ekran o'quvchidagi
"tanlangan matnni o'qish". Shuning uchun brauzer tanlovi butunlay o'chiriladi va o'rniga o'zimizning tanlov
mexanizmi (faqat belgilash uchun) qo'yiladi.

- [x] 22.1 O'z tanlov mexanizmi: `user-select: none`, sudrash bo'yicha tanlov (caret nuqtalaridan Range),
      o'z overlay'i; brauzer Selection hech qachon to'ldirilmaydi (bufer, primary selection, Look Up — bo'sh)
- [x] 22.2 Matn qatlami yordamchi texnologiyalardan yashiriladi (`aria-hidden`) — ekran o'quvchi kitob matnini
      o'qib bera olmaydi (savdo qaroriga bog'liq, hujjatlanadi)
- [x] 22.3 Suv belgisi canvas ichiga chiziladi: ekran suratida ham qoladi va devtools'dan o'chirib bo'lmaydi
- [x] 22.4 Platformalar: Linux (primary selection), macOS (Cmd+C / Cmd+A / Cmd+Shift+4), Windows (Ctrl+Insert,
      Win+Shift+S) — klaviatura kombinatsiyalari va tanlov holati testda tekshiriladi
- [x] 22.5 B27 (backend): konsoldan token bilan butun PDF'ni yuklab olish mumkin — qisqa muddatli reader tokeni,
      Range so'rovlari uchun rate-limit va server tomonda foydalanuvchi bo'yicha suv belgisi tavsiya etiladi
- [x] 22.6 Testlar: `reader-protect` kengaytirildi (brauzer tanlovi bo'shligi, Cmd/Ctrl+C, Ctrl+Insert,
      aria-hidden, canvas suv belgisi), reader/catalog to'plamlari sudrash bilan tanlashga moslandi —
      `--prod` 20/20 (354 tekshiruv), Firefox 2/2

Natija: **brauzer tanlovi umuman to'ldirilmaydi**, shuning uchun bufer (Ctrl/Cmd+C, Ctrl+Insert),
Linux "primary selection", macOS "Look Up"/Services, sudrab tashlash va ekran o'quvchidagi "tanlangan matn"
yo'llari ishlamaydi. Ekran surati oldini olib bo'lmaydi, lekin endi suv belgisi rasm piksellarida —
DOM'dan o'chirib tashlab bo'lmaydi. DevTools/konsol orqali matn qatlamini o'qish yoki token bilan faylni
yuklab olish brauzer darajasida bartaraf etib bo'lmaydi → B27 (backend).

## 23. Responsivlik: har bir sahifa × har bir qurilma (2026-09-23, foydalanuvchi talabi)

Qurilmalar: telefon (320 / 360 / 390 / 430), planshet (768 portret, 1024 landshaft), kompyuter (1280 / 1440 /
1920), televizor (2560 / 3840). Sahifalar: mehmon (login, ro'yxat, katalog, kitob tafsiloti), foydalanuvchi
(kutubxona, kitob, profil, bildirishnomalar, reader), admin (9 sahifa). Har vazifadan keyin test.

- [x] 23.1 Audit asbobi: har sahifa × har qurilma — gorizontal scroll, chekkadan chiqqan elementlar,
      kichik bosish maydonlari (<32px), juda kichik shrift (<12px), kesilgan matn; hisobot
- [x] 23.2 Telefon (320–430) topilgan muammolar tuzatiladi
- [x] 23.3 Planshet (768 / 1024) tuzatiladi
- [x] 23.4 Kompyuter (1280 / 1440 / 1920) tuzatiladi
- [x] 23.5 Televizor (2560 / 3840): maksimal kenglik, o'lcham va masshtab
- [x] 23.6 Reader alohida: varaqlash, yon panel, toolbar — har qurilmada
- [x] 23.7 Yakuniy: `visual` to'plami endi 320 / 360 / 768 / 1280 / 2560 da ishlaydi (126 ta sahifa ko'rinishi,
      chekkadan chiqqan element tekshiruvi ham qo'shildi) — `--prod` 20/20 (354), Firefox visual+mobile 2/2

Tuzatilgan muammolar: reader sarlavhasi 320px da kesilardi (endi ikkinchi qatorda, maqola o'tish havolalari
yashiriladi); sensorli qurilmalarda jadval/breadcrumb havolalari va tab/pill bosish maydoni kichik edi (≥28px);
mayda shriftlar (9.5–10.5px → 11–11.5px: admin yon panel yorliqlari, jadval sarlavhalari, eyebrow, user chip,
audit amal kodi, watermark trace); televizor uchun (≥2200px va ≥3200px) o'lchamlar kattalashtirildi va kontent
kengligi cheklandi; suv belgisi ikki qavat bo'lgani uchun DOM qatlami yengillashtirildi.

## 24. Belgilashni tanlov panelidan o'chirish (2026-09-23, foydalanuvchi fikri)

- [x] 24.1 "O'chirg'ich" ikonkasi qo'shiladi; tepadagi tanlov panelida (ranglar yonida) o'chirish tugmasi —
      tanlangan joy allaqachon belgilangan bo'lsa chiqadi va o'sha belgilashni o'chiradi
- [x] 24.2 Sahifadagi belgilash panelida ham xuddi shu o'chirg'ich ikonkasi (bir xil uslub)
- [x] 24.3 Test: `reader-protect` da uch tekshiruv (o'chirg'ich chiqishi, o'chirishi, belgilanmagan matnda
      chiqmasligi) — `--prod` 20/20 (357 tekshiruv)

## 25. Yil kuni ko'rsatkichi (2026-09-23, "brend 365 ustiga qurilgan")

- [x] 25.1 `dayOfYear` yordamchisi (kabisa yilida 366) + `YearProgress` komponenti: emblema atrofida
      to'ldiriladigan oltin halqa va yonida "266 / 365" nishoni; yarim tunda o'zi yangilanadi
- [x] 25.2 Mijoz header'i va auth (login/ro'yxat) sahifalarida ko'rinadi; SSR/klient farqi bo'lmasligi uchun
      qiymat mount'dan keyin hisoblanadi
- [x] 25.3 i18n (uz/ru/en) + test: `catalog` to'plamida bugungi kun va halqa ulushi tekshiriladi —
      `--prod` 20/20 (358 tekshiruv). Eslatma: `visual` to'liq qurilma ro'yxatini faqat `--prod` da yuritadi
      (dev serverda 126 ta sahifa yuklash juda sekin, timeout berardi).

## 26. Ishlash tezligi (2026-09-23, "sayt sekin ishlayapti")

- [x] 26.1 O'lchash: production build'da metrikalar (TTFB, FCP, LCP, JS hajmi, so'rovlar soni), dev bilan farqi
      **Natija:** mahalliy production tez (TTFB < 70 ms, FCP 60–170 ms, scroll 61 FPS) — sekinlik **jonli saytda**:
      `/catalog` FCP 1152 ms, 614 KB, 48 so'rov; `GET /categories` 1279 ms, `GET /catalog` 1325 ms (backend javobi),
      Next'ning `/login` (863 ms) va `/register` (560 ms) oldindan yuklashi, shriftlar ≈231 KB, `/login` 586 KB.
      Xulosa: asosiy yo'qotish — **ortiqcha va sekin API so'rovlari** hamda oldindan yuklashlar, JS bandle emas.
- [x] 26.2 JS/shrift yuki: `Unbounded` faqat lotin qismida (kirill preload'i har sahifada ortiqcha edi),
      `Playfair Display` faqat 700 (600 hech qayerda ishlatilmaydi) → **har sahifada preload 121 KB → 88 KB (−27%)**.
      pdf.js (424 KB) faqat reader sahifasida yuklanadi — boshqa sahifalarga tegmaydi (tekshirildi).
- [x] 26.3 Renderlash: telefonlarda (≤640px) sarlavha va qidiruv "pill"idagi `backdrop-filter` o'chirildi (har kadrda
      qayta hisoblanardi), butun ekranli fon rasmidagi `filter: saturate/brightness` olib tashlandi (ko'zga ilinmas
      effekt, lekin qo'shimcha kompozitsiya qatlami). Ishlatilmayotgan 2 ta fon rasmi repodan o'chirildi (208 KB).
- [x] 26.4 Tarmoq: (a) kategoriyalar va ulardagi kitoblar soni sessiya keshiga olindi, sonlar endi asosiy ro'yxatdan
      keyin, brauzer bo'sh turganda so'raladi; (b) katalogdagi "kutubxonada" so'rovi (`/library?page_size=100`)
      keshlanadi (60 s, sotib olish/kirish-chiqishda tozalanadi); (c) `GET /auth/me` keshdan darhol ko'rsatiladi,
      tekshiruv fonda ketadi; (d) past qiymatli havolalarda (`/login`, `/register`, `/admin`, promo, kategoriya
      chip'lari, kitob kartalari, maqolalar ro'yxati) Next'ning oldindan yuklashi o'chirildi.
      **Natija:** katalogda sahifa ochilishida 6 ta API so'rovi (ilgari 6 + har kategoriya uchun bittadan; jonlida
      ≈12 ta edi), takroriy ochishlarda 3 ta.
- [x] 26.5 Reader: pdf.js bo'lagi va worker endi metadata javobini kutmay, sahifa ochilishi bilan yuklana boshlaydi
      (ilgari `GET /reader/articles/{id}` tugagachgina — jonlida ≈1 s yo'qotish).
- [x] 26.6 Yakuniy o'lchash + `--prod` testlar
      **Oldin → keyin** (bir xil sharoitda: production build, har API javobiga +700 ms kechikish qo'shilgan):
      · `/catalog` jami so'rovlar **56 → 43**, Next'ning RSC oldindan yuklashlari **20 → 8**, o'tkazilgan hajm
      **290 KB → 123 KB** · `/library` oldindan yuklashlar **10 → 8** · katalogni ikkinchi marta ochish:
      API so'rovlari **6 → 3** (kesh) · reader'da 1-sahifa chizilishi **3262 → 3145 ms** · har sahifadagi shrift
      preload'i **121 KB → 88 KB**. Testlar: `npm run e2e -- --prod` → **20/20 to'plam, 358 tekshiruv o'tdi**.
      **Jonli saytda (deploy'dan keyin o'lchandi):** `/catalog` FCP **1152 → 632 ms**, so'rovlar **48 → 31**,
      hajm **614 → 526 KB**, RSC oldindan yuklash **2 ta** qoldi. Kitoblar ko'rinishi ≈1.9 s — qolgani backend:
      `GET /catalog` 1247 ms, `GET /categories` 1260 ms (B28).

## 27. Uzun matnlar kichik ekranlarda (2026-09-23, "email yoki kitob nomi uzun bo'lsa width'dan oshib ketyapti")

Sabab: 23-bo'limdagi responsiv audit mock'dagi qisqa ma'lumotlar bilan o'tgan — uzun email/kitob nomi sinalmagan.

- [x] 27.1 Qayta ishlab chiqarish: API javoblaridagi matnlar (email, ism, kitob nomi, muallif, kategoriya, maqola
      nomi, bildirishnoma) bo'shliqsiz uzun satrlarga almashtirilib, har sahifa 320/360/390/430/768 px da tekshiriladi
- [x] 27.2 Umumiy qoida: foydalanuvchi/backend matni chiqadigan joylarda `overflow-wrap: anywhere` + flex/grid
      bolalarida `min-width: 0` (bitta joyda, dizayn tizimida)
- [x] 27.3 Sahifama-sahifa qolgan joylar (profil, kutubxona, kitob, katalog, reader sarlavhasi, bildirishnomalar,
      buyurtmalar, header'dagi foydalanuvchi chip'i, admin jadvallari) — kerak joyda qisqartirish (`…`) yoki ko'chirish
- [x] 27.4 Doimiy e2e test: uzun ma'lumotlar bilan barcha sahifalar kichik ekranlarda (gorizontal scroll va chekkadan
      chiqqan matn yo'qligi)
      **Natija:** oldin 80 ta sahifa×ekran holatida matn chiqib ketgan/toshgan edi → 0. Tuzatilganlar: profil emaili
      (ekrandan chiqib, sahifa 612px bo'lib ketardi), kitob/katalog/kutubxona kartalaridagi kategoriya teglari (`…`),
      muqova o'rnidagi nom (tepadan toshardi → 5 qator + `…`), kitob sahifasidagi "O'qishni boshlash: <maqola>"
      tugmasi, bildirishnoma sarlavhasi va havolali matni, admin foydalanuvchi sahifasidagi email, audit yozuvlari,
      profildagi "joriy" sessiya belgisi (uzun qurilma nomi uni ekrandan surib chiqarardi), login/ro'yxat sahifasida
      tor ekranda "Articles365" ustiga tushgan "kun/365" belgisi. Umumiy: `body { overflow-wrap: break-word }`,
      `Badge` matni `.chip-text` (ellipsis), `.page-title/.page-sub/.track-sub/.card-title/.user-text` → `anywhere`.
      Test: `e2e/tests/long-text.test.mjs`.
- [x] 27.5 `--prod` to'liq testlar → **21/21 to'plam, 359 tekshiruv o'tdi**.
      Yo'l-yo'lakay topilgan yashirin xato: parallel so'rovlardan biri eski token bilan 401 olib, boshqasi refresh'ni
      tugatgandan keyin qaytsa, klient **ikkinchi marta** refresh qilardi (rotatsiya → birinchi yangi token bekor →
      kutilmagan chiqib ketish xavfi). `session` to'plami 3 martadan 2 tasida yiqilardi. Tuzatildi (`client.ts`):
      token so'rovdan keyin allaqachon yangilangan bo'lsa — refresh'siz, yangi token bilan takrorlanadi; 4/4 barqaror.

## 28. iPhone Safari'da reader ochilmaydi (2026-09-24, skrinshot: "this._requestsByChunk.getOrInsertComputed is not a function")

Sabab: pdf.js 6 ning oddiy build'i eng yangi JS imkoniyatlariga tayanadi (`Map.prototype.getOrInsertComputed`,
`Promise.try` va h.k.) — iOS Safari'da ular yo'q, worker ichida yiqilib, reader xom JS xatosini ko'rsatardi.

- [x] 28.1 pdf.js `legacy` build'ga o'tkazildi (kutubxona ham, `public/pdf.worker.min.mjs` ham — `copy-pdf-worker`
      skripti legacy'dan nusxalaydi). API bir xil; legacy'da core-js polyfill'lari bor. Narxi: faqat reader'da
      ≈+60 KB (kutubxona) va ≈+50 KB (worker).
- [x] 28.2 Tushunarli xato: brauzer imkoniyati yetishmasa (TypeError / worker'dan `UnknownErrorException`) xom
      xabar o'rniga "Kitobni bu brauzerda ochib bo'lmadi… brauzerni yangilang" (uz/en/ru); tafsilot konsolda.
- [x] 28.3 Doimiy test `e2e/tests/reader-safari.test.mjs`: Chrome'da sahifadan **va worker ichidan** Safari'da yo'q
      imkoniyatlar o'chiriladi, reader ochilib sahifa chizilishi tekshiriladi. Tekshirildi: eski build bilan test
      yiqiladi (`Promise.try is not a function`), legacy bilan o'tadi. (WebKit bu mashinada ishga tushmaydi —
      tizim kutubxonalari yo'q; haqiqiy iPhone'da deploy'dan keyin tekshiriladi.)
- [x] 28.4 `--prod` to'liq testlar → **22/22 to'plam, 363 tekshiruv o'tdi**; Firefox'da reader to'plamlari 3/3

### Backend uchun eslatmalar (jonli auditdan) — holat: B1 ✅(avvaldan) · B2 ✅ · B3 ✅ · B4 ✅ · B5 ✅ · B6 ✅(avvaldan) ·
B7 ✅ · B8 ✅ (OpenAPI manba) · B9 ✅ · B10 ✅ · B11 ✅ · B12 ✅ · B13 ✅ — **ochiq savol yo'q**

- B1 ❗ `GET /reader/articles/{id}/content`: 206 javobda `Content-Range`, `Accept-Ranges: bytes` yo'q; `Cache-Control:
  private, no-store`, `X-Content-Type-Options: nosniff`, `Content-Disposition: inline` ham yo'q (STORAGE.md/SECURITY.md
  va'da qilgan). To'g'ridan-to'g'ri (CORS) rejim uchun `Access-Control-Expose-Headers: Content-Range, Accept-Ranges` kerak.
- B2 2FA yoqilgan foydalanuvchi login'ida qaytadigan xato kodi hujjatlanmagan (`TWO_FACTOR_REQUIRED`?). FE `totp_code`
  maydonini shu kod bo'yicha ko'rsatadi — kodni ayting.
- B3 `DEVICE_LIMIT_REACHED.details = {limit, active_devices[]}` — kutilmoqda. `X-Device-Id` header ishlatiladimi?
- B4 Public: `GET /catalog/{book_id}`, public muqova (`/catalog/{id}/cover`), public `GET /categories` — katalog uchun.
- B5 `BookAccessResponse` da user/book qisqacha ma'lumoti (ism, email, kitob nomi) yo'q → admin ro'yxatida N+1 so'rov.
  `OrderResponse` da ham user/book nomi yo'q.
- B6 Eksport (`/admin/export/*`) XLSX qaytaradi, lekin `Content-Disposition` (fayl nomi) yo'q.
- B7 CORS allowlist'ga prod frontend origin'ini qo'shish kerak (hozir `localhost:3000`; boshqa origin → 400).
- B8 `API.md` ni OpenAPI'ga moslab yangilash (reader/annotations/progress endpointlari, orders, notifications, 2FA).
- B9 Progress: `current_page` 0 = boshlanmagan, 1-based; `percentage` ni FE hisoblab yuboradi — backend `page_count` dan
  o'zi hisoblasa ishonchliroq.
- B10 `reading-heartbeat` chastotasi/limiti (rate-limit) — tavsiya etilgan interval?
- B13 `UserResponse` da `two_factor_enabled` yo'q — profil 2FA holatini ko'rsata olmaydi. ✅
- B14 (tavsiya) Yuklangan PDF'larni saqlashda linearizatsiya (`qpdf --linearize`): sahifa obyektlari sochilgan katta
  PDF'larda PDF.js ochilishda ko'p Range bo'lagi so'raydi; linearizatsiya birinchi sahifani bir bo'lakda beradi.
- B12 `GET /library/{book_id}` (bitta kitob: sarlavha, muallif, tavsif, muqova, ruxsat) yo'q — kitob sahifasi kutubxona
  keshi yoki public katalogdan oladi (INACTIVE kitob katalogda ko'rinmaydi → ma'lumot topilmasligi mumkin).
- B11 `GET /library?sort=` faqat `granted|title`; registrdagi "So'nggi o'qilgan" (`recent`, `last_read_at` bo'yicha)
  tartibi yo'q — qo'shilsa FE'da tayyor.

Holat: B15–B25 ✅ hammasi javoblandi va deploy qilindi (15-bo'lim) — B21: PDF ✅, HEIC ❌ (FE JPEG'ga o'giradi).

- B28 ❗ (26-bo'lim, tezlik) Jonli backend javob vaqti katta: `GET /categories` **1279 ms**, `GET /catalog` **1325 ms**
  (o'lchov: Vercel'dagi frontend, 2026-09-23). Frontend tomondan so'rovlar soni kamaytirildi, lekin bitta so'rovning
  o'zi ~1.3 s bo'lsa sayt baribir sekin seziladi. Tavsiya: (a) `categories` va `catalog` uchun keshlash
  (`Cache-Control: public, max-age=60` yoki server keshi), (b) `catalog` da `category_id` bo'yicha **kitoblar sonini
  `GET /categories` javobining o'ziga qo'shish** (B26) — hozir FE har kategoriya uchun alohida so'rov yuboradi,
  (c) sovuq start (cold start) bormi — birinchi so'rov keyingilaridan sezilarli sekinmi, shuni tekshirish.

- B15 ❗ Web admin chek rasmini ko'ra olmaydi: `GET /admin/orders/{id}/receipt` (himoyalangan rasm oqimi) va
  `OrderResponse.has_receipt_file` kerak — hozir web'dan tasdiqlagan admin chekni ko'rmaydi.
- B16 Web ↔ Telegram sinxronligi: web'da tasdiqlansa/rad etilsa Telegram'dagi tugmalar ham yopiladimi?
- B17 Takroriy buyurtma va holat xatolari: bir kitobga PENDING/AWAITING buyurtma bor bo'lsa `POST /orders` nima qaytaradi;
  PENDING bo'lmagan buyurtmaga chek yuborilsa qaysi kod (409 `INVALID_ORDER_STATE`?).
- B18 Rad etish sababi API'da ixtiyoriy (`reason: null`), Telegram'da majburiy — API ham majburiy qilinsinmi?
- B19 Bildirishnoma `meta` formati (`order_id`, `book_id`?) — FE `meta.book_id` bilan kitob sahifasiga olib boradi.
- B20 AWAITING_REVIEW paytida chekni qayta yuborish (noto'g'ri rasm) mumkinmi?
- B21 Chek formati: PDF (bank ilovasi kvitansiyasi) va HEIC qabul qilinadimi?
- B22 To'lov rekvizitlari (karta, qabul qiluvchi, summa izohi) API'dan berilsinmi (hozir FE env'da)?
- B23 Holat kuzatuvi: `GET /orders` 20 s da — rate-limit'ga to'g'ri keladimi; `GET /orders/{id}` bo'ladimi?
- B24 Foydalanuvchi PENDING buyurtmani bekor qila oladimi (`POST /orders/{id}/cancel`)?
- B25 Hujjatlar eskirgan: API.md/STORAGE.md/SECURITY.md/README kitob darajasidagi yo'llar; buyurtma/katalog/bildirishnoma/
  2FA/eksport va yangi xato kodlari (`INVALID_FILE`, `ALREADY_HAS_ACCESS`, ...) yo'q.

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
