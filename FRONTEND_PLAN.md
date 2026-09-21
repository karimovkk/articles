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
